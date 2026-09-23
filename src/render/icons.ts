/**
 * Ícones de itens para a interface: um atlas (canvas) com blocos em isométrico (três faces sombreadas,
 * como nos inventários clássicos) e sprites 2D para os demais itens. Também gera o texture array
 * dos sprites (para itens "extrudados" em 3D na mão e no chão).
 */
import * as THREE from 'three';
import { ITEMS } from '../game/items/registry';
import type { ItemDef } from '../game/items/types';
import { S, FACE_TEX, SHAPE, SHAPE_IDS, TINT, BLOCKS, BLOCK_OF, TEXTURES } from '../world/blocks';
import { SIZE, Tex } from './textures/tex';
import type { TextureArrays } from './textures/atlas';
import { ITEM_SPRITES } from './items/painters';

export const ICON = 32;
const COLS = 32;

export interface IconAtlas {
  canvas: HTMLCanvasElement;
  url: string;
  index: Map<string, number>;
  /** sprites 16×16 (RGBA) por item (só os que não são cubos) */
  sprites: Map<string, Uint8ClampedArray>;
  spriteArray: THREE.DataArrayTexture;
  spriteLayer: Map<string, number>;
}

const TINTS: Record<number, [number, number, number]> = {
  1: [0x7f, 0xb2, 0x4a], 2: [0x59, 0xae, 0x30], 3: [0x3f, 0x76, 0xe4], 4: [0x80, 0xa7, 0x55], 5: [0x61, 0x99, 0x61], 6: [0x5f, 0xd9, 0xea], 7: [0x9c, 0xbf, 0x3a],
};

function layerPixels(data: TextureArrays, layer: number): Uint8ClampedArray {
  const n = SIZE * SIZE * 4;
  return new Uint8ClampedArray(data.albedo[0].buffer, data.albedo[0].byteOffset + layer * n, n).slice();
}

function faceCanvas(px: Uint8ClampedArray, tint: [number, number, number] | null, tintMask: boolean, shade: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    let r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3];
    if (tint) {
      const k = tintMask ? a / 255 : 1;
      r = r * (1 - k) + (r * tint[0] / 255) * k; gg = gg * (1 - k) + (gg * tint[1] / 255) * k; b = b * (1 - k) + (b * tint[2] / 255) * k;
      if (tintMask) a = 255;
    }
    img.data[i * 4] = r * shade; img.data[i * 4 + 1] = gg * shade; img.data[i * 4 + 2] = b * shade; img.data[i * 4 + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const TINT_MASK_NAMES = new Set(['grass_side']);

function isCubeLike(state: number): boolean {
  const sh = SHAPE[state];
  return sh === SHAPE_IDS.cube || sh === SHAPE_IDS.slab || sh === SHAPE_IDS.stairs || sh === SHAPE_IDS.fence || sh === SHAPE_IDS.wall
    || sh === SHAPE_IDS.chest || sh === SHAPE_IDS.piston || sh === SHAPE_IDS.farmland || sh === SHAPE_IDS.path || sh === SHAPE_IDS.cactus
    || sh === SHAPE_IDS.snowlayer || sh === SHAPE_IDS.carpet || sh === SHAPE_IDS.enchanting || sh === SHAPE_IDS.anvil || sh === SHAPE_IDS.fencegate
    || sh === SHAPE_IDS.daylight || sh === SHAPE_IDS.lectern || sh === SHAPE_IDS.composter || sh === SHAPE_IDS.grindstone || sh === SHAPE_IDS.stonecutter
    || sh === SHAPE_IDS.plate || sh === SHAPE_IDS.trapdoor || sh === SHAPE_IDS.scaffold || sh === SHAPE_IDS.portal;
}

/** Desenha um bloco em isométrico no contexto (32×32 em ox, oy). */
function drawIsoBlock(g: CanvasRenderingContext2D, data: TextureArrays, state: number, ox: number, oy: number): void {
  const texName = (layer: number) => TEXTURES.find((t) => layer >= t.layer && layer < t.layer + t.frames)?.name ?? '';
  const tintId = TINT[state];
  const tint = tintId ? TINTS[tintId] ?? null : null;
  const face = (f: number, shade: number) => {
    const layer = FACE_TEX[state * 6 + f] & 0xfff;
    const nm = texName(layer);
    const mask = TINT_MASK_NAMES.has(nm);
    const useTint = tint && (f === 1 || mask || !BLOCKS[BLOCK_OF[state]].name.startsWith('grass_block')) ? tint : null;
    return faceCanvas(layerPixels(data, layer), useTint, mask, shade);
  };
  let h = 1;
  const sh = SHAPE[state];
  if (sh === SHAPE_IDS.slab) h = 0.5;
  else if (sh === SHAPE_IDS.carpet || sh === SHAPE_IDS.plate) h = 1 / 16;
  else if (sh === SHAPE_IDS.snowlayer) h = 2 / 16;
  else if (sh === SHAPE_IDS.trapdoor) h = 3 / 16;
  else if (sh === SHAPE_IDS.daylight) h = 6 / 16;
  const top = face(1, 1), left = face(3, 0.78), right = face(5, 0.6);
  const k = 1 / SIZE;
  const dy = (1 - h) * 15.5;
  g.save();
  g.imageSmoothingEnabled = false;
  // lado esquerdo (sul)
  g.setTransform(15 * k, 7.5 * k, 0, 15.5 * k * h, ox + 1, oy + 8.5 + dy);
  g.drawImage(left, 0, SIZE * (1 - h), SIZE, SIZE * h, 0, 0, SIZE, SIZE);
  // lado direito (leste)
  g.setTransform(15 * k, -7.5 * k, 0, 15.5 * k * h, ox + 16, oy + 16 + dy);
  g.drawImage(right, 0, SIZE * (1 - h), SIZE, SIZE * h, 0, 0, SIZE, SIZE);
  // topo
  g.setTransform(15 * k, 7.5 * k, -15 * k, 7.5 * k, ox + 16, oy + 1 + dy);
  g.drawImage(top, 0, 0);
  g.restore();
}

function spriteFor(it: ItemDef, data: TextureArrays): Uint8ClampedArray | null {
  const painter = ITEM_SPRITES[it.id];
  if (painter) {
    const t = new Tex(`item:${it.id}`);
    t.transparent();
    painter(t);
    return new Uint8ClampedArray(t.rgba);
  }
  if (it.block) {
    const st = S(it.block);
    if (!isCubeLike(st)) {
      // plantas, tochas etc.: usa a textura do bloco
      const layer = FACE_TEX[st * 6 + 2] & 0xfff;
      const px = layerPixels(data, layer);
      const tint = TINTS[TINT[st]];
      if (tint) for (let i = 0; i < 256; i++) { px[i * 4] = px[i * 4] * tint[0] / 255; px[i * 4 + 1] = px[i * 4 + 1] * tint[1] / 255; px[i * 4 + 2] = px[i * 4 + 2] * tint[2] / 255; }
      return px;
    }
    return null;
  }
  // sem sprite ainda: losango neutro
  const t = new Tex(`fallback:${it.id}`);
  t.transparent();
  let h = 7;
  for (let i = 0; i < it.id.length; i++) h = (h * 31 + it.id.charCodeAt(i)) >>> 0;
  const col: [number, number, number] = [120 + (h & 90), 110 + ((h >> 8) & 90), 110 + ((h >> 16) & 90)];
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (Math.abs(x - 7.5) + Math.abs(y - 7.5) < 6) t.px(x, y, Math.abs(x - 7.5) + Math.abs(y - 7.5) > 4.6 ? [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6] : col);
  return new Uint8ClampedArray(t.rgba);
}

export function buildIconAtlas(data: TextureArrays): IconAtlas {
  const items = ITEMS.filter((i) => i.tab !== 'none' || i.id === 'filled_map');
  const all = ITEMS;
  const rows = Math.ceil(all.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * ICON; canvas.height = rows * ICON;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const index = new Map<string, number>();
  const sprites = new Map<string, Uint8ClampedArray>();
  const tmp = document.createElement('canvas');
  tmp.width = SIZE; tmp.height = SIZE;
  const tg = tmp.getContext('2d')!;
  all.forEach((it, i) => {
    index.set(it.id, i);
    const ox = (i % COLS) * ICON, oy = Math.floor(i / COLS) * ICON;
    const sp = spriteFor(it, data);
    if (sp) {
      sprites.set(it.id, sp);
      const img = tg.createImageData(SIZE, SIZE);
      img.data.set(sp);
      tg.putImageData(img, 0, 0);
      g.drawImage(tmp, ox, oy, ICON, ICON);
    } else if (it.block) {
      drawIsoBlock(g, data, S(it.block), ox, oy);
    }
  });
  void items;
  // texture array dos sprites
  const ids = [...sprites.keys()];
  const arr = new Uint8Array(Math.max(1, ids.length) * SIZE * SIZE * 4);
  const spriteLayer = new Map<string, number>();
  ids.forEach((id, i) => { arr.set(sprites.get(id)!, i * SIZE * SIZE * 4); spriteLayer.set(id, i); });
  const spriteArray = new THREE.DataArrayTexture(arr, SIZE, SIZE, Math.max(1, ids.length));
  spriteArray.colorSpace = THREE.SRGBColorSpace;
  spriteArray.magFilter = THREE.NearestFilter;
  spriteArray.minFilter = THREE.NearestFilter;
  spriteArray.needsUpdate = true;
  return { canvas, url: canvas.toDataURL('image/png'), index, sprites, spriteArray, spriteLayer };
}

let current: IconAtlas | null = null;
let styleEl: HTMLStyleElement | null = null;

export function installIcons(atlas: IconAtlas, scale = 1): void {
  current = atlas;
  if (!styleEl) { styleEl = document.createElement('style'); document.head.appendChild(styleEl); }
  const w = atlas.canvas.width * scale, h = atlas.canvas.height * scale;
  styleEl.textContent = `.icon{display:inline-block;width:${ICON * scale}px;height:${ICON * scale}px;background-image:url(${atlas.url});background-size:${w}px ${h}px;image-rendering:pixelated;background-repeat:no-repeat}`;
}

/** Estilo inline (posição no atlas) para o ícone de um item. */
export function iconPos(id: string, scale = 1): string {
  const i = current?.index.get(id) ?? 0;
  const x = (i % COLS) * ICON * scale, y = Math.floor(i / COLS) * ICON * scale;
  return `background-position:-${x}px -${y}px`;
}

export function iconAtlas(): IconAtlas | null { return current; }
