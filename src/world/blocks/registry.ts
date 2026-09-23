/**
 * Registro de blocos e estados. Tudo é construído de forma determinística a partir das definições,
 * então a thread principal e os workers chegam exatamente às mesmas tabelas.
 */
import type { BlockDef, FaceKey, PropDef, Props, PropValue, ShapeKind, TexFaces, TintKind } from './types';
import { FACE_KEYS } from './types';
import { texMeta } from './texmeta';

export const MAX_STATES = 16384;

// ------------------------------------------------------------------ flags por estado
export const F_SOLID = 1;           // tem colisão
export const F_REPLACEABLE = 2;     // pode ser substituído ao colocar (grama alta, líquidos, neve fina)
export const F_FLUID = 4;
export const F_CLIMBABLE = 8;
export const F_CULL_SAME = 16;      // vidro: esconde faces entre blocos iguais
export const F_GRAVITY = 32;
export const F_RANDOM_TICK = 64;
export const F_FLAMMABLE = 128;
export const F_WATER = 256;
export const F_LAVA = 512;
export const F_FULL_CUBE_COLLISION = 1024;
export const F_AIR = 2048;
export const F_LEAVES = 4096;
/** planta aquática: a célula também contém água (alga, capim-marinho) */
export const F_WATERLOGGED = 8192;

export const SHAPE_IDS: Record<ShapeKind, number> = (() => {
  const kinds: ShapeKind[] = [
    'none', 'cube', 'cross', 'crop', 'fluid', 'slab', 'stairs', 'fence', 'fencegate', 'wall', 'pane', 'door',
    'trapdoor', 'torch', 'walltorch', 'ladder', 'rail', 'dust', 'lever', 'button', 'plate', 'carpet', 'snowlayer',
    'farmland', 'path', 'cactus', 'bed', 'chest', 'sign', 'wallsign', 'repeater', 'comparator', 'piston',
    'pistonhead', 'lantern', 'cake', 'lilypad', 'vine', 'anvil', 'cauldron', 'brewing', 'enchanting', 'portal',
    'fire', 'kelp', 'doubleplant', 'bush', 'chain', 'lectern', 'composter', 'grindstone', 'stonecutter', 'campfire',
    'flowerpot', 'crystal', 'hopper', 'daylight', 'endrod', 'bars', 'candle', 'head', 'stem', 'cocoa', 'bell',
    'scaffold', 'cobweb', 'sapling', 'mushroom',
  ];
  const o = {} as Record<ShapeKind, number>;
  kinds.forEach((k, i) => (o[k] = i));
  return o;
})();
export const SHAPE_NONE = 0, SHAPE_CUBE = 1, SHAPE_CROSS = 2, SHAPE_FLUID = 4;

export const LAYER_SOLID = 0, LAYER_CUTOUT = 1, LAYER_TRANSLUCENT = 2, LAYER_WATER = 3, LAYER_NONE = 4;
const LAYER_IDS = { solid: 0, cutout: 1, translucent: 2, water: 3, none: 4 } as const;
export const TINT_IDS: Record<TintKind, number> = {
  none: 0, grass: 1, foliage: 2, water: 3, birch: 4, spruce: 5, fulgor: 6, stem: 7, lume: 8,
};

// ------------------------------------------------------------------ tabelas por estado
export const BLOCK_OF = new Uint16Array(MAX_STATES);
export const OPAQUE = new Uint8Array(MAX_STATES);
export const LIGHT_EMIT = new Uint8Array(MAX_STATES);
export const LIGHT_OPACITY = new Uint8Array(MAX_STATES);
export const SHAPE = new Uint8Array(MAX_STATES);
export const RENDER_LAYER = new Uint8Array(MAX_STATES);
export const TINT = new Uint8Array(MAX_STATES);
export const FLAGS = new Uint16Array(MAX_STATES);
export const WAVING = new Uint8Array(MAX_STATES);
/** layer | (rotação << 12) por face (ordem down, up, north, south, west, east) */
export const FACE_TEX = new Uint16Array(MAX_STATES * 6);
/** máscara de 6 bits: faces deste estado que cobrem totalmente o vizinho (para descarte). */
export const OCCLUDES = new Uint8Array(MAX_STATES);
/** nível do fluido (0 = fonte) ou 255 */
export const FLUID_LEVEL = new Uint8Array(MAX_STATES).fill(255);

// ------------------------------------------------------------------ texturas
export interface TextureEntry { name: string; layer: number; frames: number }
export const TEXTURES: TextureEntry[] = [];
const texByName = new Map<string, TextureEntry>();
let nextLayer = 0;

let frozen = false;
/** Depois de congelado, nomes novos são um erro (o worker não pode inventar camadas). */
export function freezeTextures(): void { frozen = true; }

export function texLayer(name: string): number {
  let e = texByName.get(name);
  if (!e) {
    if (frozen) {
      console.warn(`textura não registrada: ${name}`);
      return 0;
    }
    const frames = texMeta(name).frames ?? 1;
    e = { name, layer: nextLayer, frames };
    nextLayer += frames;
    texByName.set(name, e);
    TEXTURES.push(e);
  }
  return e.layer;
}
export const textureCount = (): number => nextLayer;
export const textureByName = (n: string): TextureEntry | undefined => texByName.get(n);

// ------------------------------------------------------------------ tipos de bloco
export interface BlockType {
  id: number;
  name: string;
  label: string;
  def: BlockDef;
  baseState: number;
  stateCount: number;
  props: PropDef[];
  strides: number[];
  defaultState: number;
  shape: ShapeKind;
}

export const BLOCKS: BlockType[] = [];
const byName = new Map<string, BlockType>();
export const STATE_PROPS: Props[] = [];

let stateCounter = 0;

function propIndexOf(p: PropDef, v: PropValue): number {
  const i = p.values.indexOf(v);
  if (i < 0) throw new Error(`valor ${String(v)} inválido para ${p.name}`);
  return i;
}

function parseTex(spec: string | undefined): number {
  if (!spec) return 0;
  const at = spec.indexOf('@');
  if (at < 0) return texLayer(spec);
  const rot = (parseInt(spec.slice(at + 1), 10) / 90) & 3;
  return texLayer(spec.slice(0, at)) | (rot << 12);
}

const FACING_OF: Record<string, FaceKey> = { north: 'north', south: 'south', west: 'west', east: 'east', up: 'up', down: 'down' };
const OPP_FACE: Record<FaceKey, FaceKey> = { north: 'south', south: 'north', west: 'east', east: 'west', up: 'down', down: 'up' };

function resolveFaces(def: BlockDef, props: Props): (string | undefined)[] {
  const spec = typeof def.tex === 'function' ? def.tex(props) : def.tex;
  if (spec === undefined) return [undefined, undefined, undefined, undefined, undefined, undefined];
  if (typeof spec === 'string') return [spec, spec, spec, spec, spec, spec];
  const f = spec as TexFaces;
  const facing = typeof props.facing === 'string' ? FACING_OF[props.facing] : undefined;
  return FACE_KEYS.map((k) => {
    if (f[k]) return f[k];
    if (facing && f.front && k === facing) return f.front;
    if (facing && f.back && k === OPP_FACE[facing]) return f.back;
    if (k === 'up') return f.top ?? f.end ?? f.all ?? f.side;
    if (k === 'down') return f.bottom ?? f.end ?? f.top ?? f.all ?? f.side;
    return f.side ?? f.all;
  });
}

export function registerBlock(def: BlockDef): BlockType {
  if (byName.has(def.name)) throw new Error(`bloco duplicado: ${def.name}`);
  const props = def.props ?? [];
  const strides: number[] = [];
  let count = 1;
  for (const p of props) { strides.push(count); count *= p.values.length; }
  const baseState = stateCounter;
  if (baseState + count > MAX_STATES) throw new Error('estados demais');
  stateCounter += count;
  const shape: ShapeKind = def.shape ?? 'cube';
  const bt: BlockType = {
    id: BLOCKS.length, name: def.name, label: def.label, def, baseState, stateCount: count,
    props, strides, defaultState: baseState, shape,
  };
  // estado padrão
  if (props.length) {
    let idx = 0;
    props.forEach((p, i) => {
      const v = def.defaults?.[p.name] ?? p.values[0];
      idx += propIndexOf(p, v) * strides[i];
    });
    bt.defaultState = baseState + idx;
  }
  BLOCKS.push(bt);
  byName.set(def.name, bt);

  const isAir = def.name === 'air' || def.name === 'cave_air' || def.name === 'void_air';
  const layer = def.layer ?? (shape === 'cube' ? 'solid' : shape === 'none' ? 'none' : 'cutout');
  const opaque = def.opaque ?? (shape === 'cube' && layer === 'solid');
  const solid = def.solid ?? !(isAir || ['cross', 'crop', 'fluid', 'torch', 'walltorch', 'dust', 'rail', 'plate', 'button',
    'lever', 'vine', 'portal', 'fire', 'kelp', 'doubleplant', 'bush', 'sapling', 'mushroom', 'none', 'sign', 'wallsign', 'cobweb'].includes(shape));

  for (let i = 0; i < count; i++) {
    const s = baseState + i;
    const p: Props = {};
    props.forEach((pd, j) => { p[pd.name] = pd.values[Math.floor(i / strides[j]) % pd.values.length]; });
    STATE_PROPS[s] = p;
    BLOCK_OF[s] = bt.id;
    SHAPE[s] = SHAPE_IDS[shape];
    RENDER_LAYER[s] = LAYER_IDS[layer];
    OPAQUE[s] = opaque ? 1 : 0;
    const light = typeof def.light === 'function' ? def.light(p) : def.light ?? 0;
    LIGHT_EMIT[s] = light;
    LIGHT_OPACITY[s] = def.opacity ?? (opaque ? 15 : 0);
    TINT[s] = TINT_IDS[def.tint ?? 'none'];
    WAVING[s] = def.waving ?? 0;
    let fl = 0;
    if (solid) fl |= F_SOLID;
    if (solid && shape === 'cube') fl |= F_FULL_CUBE_COLLISION;
    if (def.replaceable || isAir) fl |= F_REPLACEABLE;
    if (def.fluid) fl |= F_FLUID | (def.fluid === 'water' ? F_WATER : F_LAVA);
    if (def.climbable) fl |= F_CLIMBABLE;
    if (def.cullSame) fl |= F_CULL_SAME;
    if (def.gravity) fl |= F_GRAVITY;
    if (def.randomTicks) fl |= F_RANDOM_TICK;
    if (def.flammable) fl |= F_FLAMMABLE;
    if (isAir) fl |= F_AIR;
    if (def.name.endsWith('_leaves')) fl |= F_LEAVES;
    FLAGS[s] = fl;
    if (def.fluid) FLUID_LEVEL[s] = (p.level as number) ?? 0;
    OCCLUDES[s] = opaque ? 63 : 0;
    const faces = resolveFaces(def, p);
    for (let f = 0; f < 6; f++) FACE_TEX[s * 6 + f] = parseTex(faces[f]);
    // registra também texturas extras usadas pelos modelos (ex.: 'inner', 'handle')
    const spec = typeof def.tex === 'function' ? def.tex(p) : def.tex;
    if (spec && typeof spec === 'object') for (const v of Object.values(spec)) if (typeof v === 'string') parseTex(v);
  }
  return bt;
}

export function stateCount(): number { return stateCounter; }

export function block(name: string): BlockType {
  const b = byName.get(name);
  if (!b) throw new Error(`bloco desconhecido: ${name}`);
  return b;
}
export const hasBlock = (name: string): boolean => byName.has(name);
export const blockTypeOf = (state: number): BlockType => BLOCKS[BLOCK_OF[state]];
export const blockNameOf = (state: number): string => BLOCKS[BLOCK_OF[state]].name;

/** Estado de um bloco pelo nome, com propriedades opcionais. Ex.: `S('oak_log', {axis:'x'})`. */
export function S(name: string, props?: Props): number {
  const b = block(name);
  if (!props) return b.defaultState;
  let s = b.defaultState;
  for (const k in props) s = withProp(s, k, props[k]);
  return s;
}

export function getProp(state: number, prop: string): PropValue | undefined {
  return STATE_PROPS[state]?.[prop];
}

export function withProp(state: number, prop: string, value: PropValue): number {
  const b = BLOCKS[BLOCK_OF[state]];
  const i = b.props.findIndex((p) => p.name === prop);
  if (i < 0) return state;
  const pd = b.props[i];
  const cur = Math.floor((state - b.baseState) / b.strides[i]) % pd.values.length;
  const nv = pd.values.indexOf(value);
  if (nv < 0) return state;
  return state + (nv - cur) * b.strides[i];
}

export function hasProp(state: number, prop: string): boolean {
  return STATE_PROPS[state] !== undefined && prop in STATE_PROPS[state];
}

/** Marca faces que um estado não-cúbico cobre por completo (lajes, escadas, etc.). */
export function setOccludes(name: string, fn: (p: Props) => number): void {
  const b = block(name);
  for (let i = 0; i < b.stateCount; i++) {
    const s = b.baseState + i;
    OCCLUDES[s] = fn(STATE_PROPS[s]);
  }
}

export const isAir = (s: number): boolean => (FLAGS[s] & F_AIR) !== 0;
export const isSolid = (s: number): boolean => (FLAGS[s] & F_SOLID) !== 0;
export const isFluid = (s: number): boolean => (FLAGS[s] & F_FLUID) !== 0;
export const isWater = (s: number): boolean => (FLAGS[s] & F_WATER) !== 0;
export const isLava = (s: number): boolean => (FLAGS[s] & F_LAVA) !== 0;
export const isReplaceable = (s: number): boolean => (FLAGS[s] & F_REPLACEABLE) !== 0;
