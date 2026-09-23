/**
 * Construtor de estruturas: coordenadas locais (x à direita, z para a frente, y para cima) com rotação
 * em quartos de volta, girando também as propriedades dos blocos (facing, axis). Escreve só dentro do
 * chunk-alvo (ChunkWriter), então a mesma construção pode ser chamada por todos os chunks que ela toca.
 */
import { S, STATE_PROPS, BLOCKS, BLOCK_OF, withProp, FLAGS, F_SOLID, F_FLUID, OPAQUE } from '../../blocks';
import type { ChunkWriter } from '../writer';
import type { Chunk } from '../../chunk';

export type Rot = 0 | 1 | 2 | 3;
const CW: Record<string, string> = { north: 'east', east: 'south', south: 'west', west: 'north' };

/** Gira as propriedades de orientação de um estado k quartos de volta (sentido horário, visto de cima). */
export function rotateState(state: number, k: number): number {
  k &= 3;
  if (!k) return state;
  const p = STATE_PROPS[state];
  let s = state;
  if (typeof p.facing === 'string' && CW[p.facing]) {
    let f = p.facing;
    for (let i = 0; i < k; i++) f = CW[f];
    s = withProp(s, 'facing', f);
  }
  if ((p.axis === 'x' || p.axis === 'z') && k % 2 === 1) s = withProp(s, 'axis', p.axis === 'x' ? 'z' : 'x');
  return s;
}

/** Transforma (dx, dz) local em deslocamento no mundo para a rotação k. */
export function rotXZ(x: number, z: number, k: number): [number, number] {
  switch (k & 3) {
    case 0: return [x, z];
    case 1: return [-z, x];
    case 2: return [-x, -z];
    default: return [z, -x];
  }
}

/** Direção da frente (local +z) após a rotação. */
export const FRONT: string[] = ['south', 'west', 'north', 'east'];

export interface StylePalette {
  name: string;
  planks: string; log: string; stairs: string; slab: string; fence: string; door: string; trapdoor: string;
  wall: string; wallAlt: string; foundation: string; roof: string; roofSlab: string; floor: string;
  path: string; glass: string; light: 'torch' | 'lantern'; bed: string; carpet: string;
  crops: string[];
  /** paredes de pedra (oficinas pesadas) */
  stone: string; stoneStairs: string;
}

export const STYLES: Record<string, StylePalette> = {
  // casas caiadas com enxaimel de madeira, janelas azuis e telhado de telha cerâmica
  planicie: {
    name: 'planicie', planks: 'oak_planks', log: 'oak_log', stairs: 'oak_stairs', slab: 'oak_slab', fence: 'oak_fence', door: 'oak_door', trapdoor: 'oak_trapdoor',
    wall: 'white_terracotta', wallAlt: 'oak_planks', foundation: 'cobblestone', roof: 'brick_stairs', roofSlab: 'brick_slab', floor: 'oak_planks',
    path: 'dirt_path', glass: 'glass_pane', light: 'lantern', bed: 'blue_bed', carpet: 'blue_carpet', crops: ['wheat', 'carrots', 'potatoes', 'beetroots'],
    stone: 'stone_bricks', stoneStairs: 'stone_brick_stairs',
  },
  deserto: {
    name: 'deserto', planks: 'jungle_planks', log: 'jungle_log', stairs: 'sandstone_stairs', slab: 'sandstone_slab', fence: 'jungle_fence', door: 'jungle_door', trapdoor: 'jungle_trapdoor',
    wall: 'cut_sandstone', wallAlt: 'smooth_sandstone', foundation: 'sandstone', roof: 'sandstone_stairs', roofSlab: 'sandstone_slab', floor: 'smooth_sandstone',
    path: 'smooth_sandstone', glass: 'glass_pane', light: 'torch', bed: 'orange_bed', carpet: 'orange_carpet', crops: ['wheat', 'potatoes'],
    stone: 'cut_sandstone', stoneStairs: 'sandstone_stairs',
  },
  savana: {
    name: 'savana', planks: 'acacia_planks', log: 'acacia_log', stairs: 'acacia_stairs', slab: 'acacia_slab', fence: 'acacia_fence', door: 'acacia_door', trapdoor: 'acacia_trapdoor',
    wall: 'orange_terracotta', wallAlt: 'acacia_planks', foundation: 'terracotta', roof: 'acacia_stairs', roofSlab: 'acacia_slab', floor: 'acacia_planks',
    path: 'dirt_path', glass: 'glass_pane', light: 'torch', bed: 'yellow_bed', carpet: 'yellow_carpet', crops: ['wheat', 'beetroots'],
    stone: 'terracotta', stoneStairs: 'brick_stairs',
  },
  taiga: {
    name: 'taiga', planks: 'spruce_planks', log: 'spruce_log', stairs: 'spruce_stairs', slab: 'spruce_slab', fence: 'spruce_fence', door: 'spruce_door', trapdoor: 'spruce_trapdoor',
    wall: 'spruce_planks', wallAlt: 'stripped_spruce_log', foundation: 'mossy_cobblestone', roof: 'spruce_stairs', roofSlab: 'spruce_slab', floor: 'spruce_planks',
    path: 'dirt_path', glass: 'glass_pane', light: 'lantern', bed: 'green_bed', carpet: 'green_carpet', crops: ['potatoes', 'carrots'],
    stone: 'cobblestone', stoneStairs: 'cobblestone_stairs',
  },
  neve: {
    name: 'neve', planks: 'spruce_planks', log: 'stripped_spruce_log', stairs: 'stone_brick_stairs', slab: 'stone_brick_slab', fence: 'spruce_fence', door: 'spruce_door', trapdoor: 'spruce_trapdoor',
    wall: 'snow_block', wallAlt: 'spruce_planks', foundation: 'stone_bricks', roof: 'spruce_stairs', roofSlab: 'spruce_slab', floor: 'spruce_planks',
    path: 'dirt_path', glass: 'glass_pane', light: 'lantern', bed: 'red_bed', carpet: 'red_carpet', crops: ['potatoes', 'beetroots'],
    stone: 'stone_bricks', stoneStairs: 'stone_brick_stairs',
  },
  // palafitas de madeira de selva com telhado de palha (feno)
  selva: {
    name: 'selva', planks: 'jungle_planks', log: 'jungle_log', stairs: 'jungle_stairs', slab: 'jungle_slab', fence: 'jungle_fence', door: 'jungle_door', trapdoor: 'jungle_trapdoor',
    wall: 'jungle_planks', wallAlt: 'stripped_jungle_log', foundation: 'jungle_log', roof: 'jungle_stairs', roofSlab: 'jungle_slab', floor: 'jungle_planks',
    path: 'dirt_path', glass: 'glass_pane', light: 'lantern', bed: 'lime_bed', carpet: 'lime_carpet', crops: ['carrots', 'potatoes', 'wheat'],
    stone: 'mossy_cobblestone', stoneStairs: 'mossy_cobblestone_stairs',
  },
  pantano: {
    name: 'pantano', planks: 'dark_oak_planks', log: 'dark_oak_log', stairs: 'dark_oak_stairs', slab: 'dark_oak_slab', fence: 'dark_oak_fence', door: 'dark_oak_door', trapdoor: 'dark_oak_trapdoor',
    wall: 'mud_bricks', wallAlt: 'dark_oak_planks', foundation: 'dark_oak_log', roof: 'dark_oak_stairs', roofSlab: 'dark_oak_slab', floor: 'dark_oak_planks',
    path: 'mud_bricks', glass: 'glass_pane', light: 'lantern', bed: 'brown_bed', carpet: 'brown_carpet', crops: ['beetroots', 'potatoes'],
    stone: 'mud_bricks', stoneStairs: 'mud_brick_stairs',
  },
};

const stateCache = new Map<string, number>();
/** Estado por nome com propriedades, com cache (usado a cada bloco). */
export function st(name: string, props?: Record<string, string | number | boolean>): number {
  const key = props ? `${name}|${JSON.stringify(props)}` : name;
  let s = stateCache.get(key);
  if (s === undefined) { s = S(name, props); stateCache.set(key, s); }
  return s;
}

export interface BlockEntityOut { x: number; y: number; z: number; data: Record<string, unknown> }

/** Construção posicionada: origem (canto local 0,0,0), rotação, paleta e acesso ao chunk-alvo. */
export class Build {
  constructor(
    readonly w: ChunkWriter, readonly ox: number, readonly oy: number, readonly oz: number,
    readonly rot: Rot, readonly pal: StylePalette,
  ) {}

  world(x: number, y: number, z: number): [number, number, number] {
    const [dx, dz] = rotXZ(x, z, this.rot);
    return [this.ox + dx, this.oy + y, this.oz + dz];
  }
  set(x: number, y: number, z: number, state: number): void {
    const [wx, wy, wz] = this.world(x, y, z);
    this.w.set(wx, wy, wz, rotateState(state, this.rot));
  }
  /** Coloca por nome (atalho) com propriedades locais (facing relativo ao modelo). */
  put(x: number, y: number, z: number, name: string, props?: Record<string, string | number | boolean>): void {
    this.set(x, y, z, st(name, props));
  }
  get(x: number, y: number, z: number): number {
    const [wx, wy, wz] = this.world(x, y, z);
    return this.w.get(wx, wy, wz);
  }
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, name: string | number, props?: Record<string, string | number | boolean>): void {
    const s = typeof name === 'number' ? name : st(name, props);
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, s);
  }
  clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void { this.fill(x0, y0, z0, x1, y1, z1, 0); }
  /** Paredes (contorno) de uma caixa. */
  walls(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, name: string): void {
    const s = st(name);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (x === x0 || x === x1 || z === z0 || z === z1) this.set(x, y, z, s);
    }
  }
  /** Alicerce: preenche para baixo até achar chão firme (máx. `depth`). */
  foundation(x0: number, z0: number, x1: number, z1: number, name: string, depth = 12): void {
    const s = st(name);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      for (let y = -1; y >= -depth; y--) {
        const cur = this.get(x, y, z);
        if (cur === -1) break; // fora do chunk
        if (cur !== 0 && FLAGS[cur] & F_SOLID && OPAQUE[cur] && !(FLAGS[cur] & F_FLUID)) break;
        this.set(x, y, z, s);
      }
    }
  }
  /** Postes (palafitas) até o chão. */
  pillar(x: number, z: number, name: string, depth = 16): void { this.foundation(x, z, x, z, name, depth); }
  /** Telhado em duas águas ao longo de x (cumeeira paralela a x), de z0 a z1, começando em y. */
  gableRoof(x0: number, x1: number, z0: number, z1: number, y: number, name: string, fill?: string): void {
    const depth = z1 - z0;
    const half = Math.floor((depth + 1) / 2);
    for (let i = 0; i < half; i++) {
      for (let x = x0; x <= x1; x++) {
        this.put(x, y + i, z0 + i, name, { facing: 'south' });
        this.put(x, y + i, z1 - i, name, { facing: 'north' });
      }
      if (fill && i > 0) for (const x of [x0 + 1, x1 - 1]) for (let z = z0 + i; z <= z1 - i; z++) this.put(x, y + i - 1, z, fill);
    }
    if ((depth + 1) % 2 === 1) for (let x = x0; x <= x1; x++) this.put(x, y + half - 1, z0 + half, this.pal.roofSlab, { type: 'bottom' });
  }
  /** Porta de 2 blocos voltada para a frente (+z local). */
  door(x: number, y: number, z: number, name = this.pal.door, facing = 'south'): void {
    this.put(x, y, z, name, { facing, half: 'lower' });
    this.put(x, y + 1, z, name, { facing, half: 'upper' });
  }
  /** Cama: pé em (x,z), cabeceira em direção a `facing`. */
  bed(x: number, y: number, z: number, facing: 'north' | 'south' | 'east' | 'west', name = this.pal.bed): [number, number, number] {
    const d: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
    const [dx, dz] = d[facing];
    this.put(x, y, z, name, { facing, part: 'foot' });
    this.put(x + dx, y, z + dz, name, { facing, part: 'head' });
    return this.world(x + dx, y, z + dz);
  }
  /** Bloco de entidade (baú com saque, etc.) em coordenadas locais. */
  entity(out: Chunk, x: number, y: number, z: number, data: Record<string, unknown>): void {
    const [wx, wy, wz] = this.world(x, y, z);
    if (!this.w.inside(wx, wy, wz)) return;
    out.blockEntities.set(((wy + 64) << 8) | ((wz & 15) << 4) | (wx & 15), data as never);
  }
  isName(x: number, y: number, z: number, name: string): boolean {
    const s = this.get(x, y, z);
    return s >= 0 && BLOCKS[BLOCK_OF[s]].name === name;
  }
}
