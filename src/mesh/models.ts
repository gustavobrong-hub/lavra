/**
 * Construtores de modelo por forma (tudo que não é cubo nem fluido).
 * As geometrias seguem as proporções do original (em 1/16 de bloco), mas as texturas são próprias.
 */
import {
  BLOCK_OF, BLOCKS, FACE_TEX, FLAGS, F_LEAVES, OPAQUE, SHAPE, SHAPE_IDS, STATE_PROPS, TINT, WAVING, texLayer,
  OCCLUDES, RENDER_LAYER,
} from '../world/blocks/registry';
import type { ShapeKind } from '../world/blocks/types';
import { pidx } from './padded';
import { box, FACING_ROT, freeBox, L_CUTOUT, L_SOLID, L_TRANSLUCENT, plane, quad, rotatePts, type ModelContext } from './modelkit';
import { tintColor } from './tints';
import { FLAG_EMISSIVE, N_DERIV, N_PLANT, N_UP } from './vertex';
import { hash3 } from '../core/rng';

export type { ModelContext };

const SHAPE_NAME: ShapeKind[] = [];
for (const k in SHAPE_IDS) SHAPE_NAME[SHAPE_IDS[k as ShapeKind]] = k as ShapeKind;

const T = (b: number, f: number): number => FACE_TEX[b * 6 + f] & 0xfff;
const T6 = (b: number): number[] => [T(b, 0), T(b, 1), T(b, 2), T(b, 3), T(b, 4), T(b, 5)];
const extraCache = new Map<string, number>();
function extra(b: number, key: string): number {
  const def = BLOCKS[BLOCK_OF[b]].def;
  const spec = typeof def.tex === 'function' ? def.tex(STATE_PROPS[b]) : def.tex;
  const name = typeof spec === 'object' && spec ? spec[key] : undefined;
  if (!name) return T(b, 2);
  let l = extraCache.get(name);
  if (l === undefined) { l = texLayer(name.split('@')[0]); extraCache.set(name, l); }
  return l;
}
const nb = (ctx: ModelContext, x: number, y: number, z: number): number => ctx.blocks[pidx(x, y, z)];
const P = (s: number) => STATE_PROPS[s];
const layerOf = (b: number) => (RENDER_LAYER[b] === 2 ? L_TRANSLUCENT : RENDER_LAYER[b] === 1 ? L_CUTOUT : L_SOLID);
const tintOf = (ctx: ModelContext, b: number, x: number, z: number) => (TINT[b] ? tintColor(TINT[b], b, ctx.tints, x, z) : 0xffff);
const nameOf = (s: number) => BLOCKS[BLOCK_OF[s]].name;
const shapeOf = (s: number) => SHAPE_NAME[SHAPE[s]];
const DX = [0, 0, 0, 0, -1, 1], DZ = [0, 0, -1, 1, 0, 0];
const H_DIRS = [2, 3, 4, 5]; // norte, sul, oeste, leste
const DIR_OF: Record<string, number> = { north: 2, south: 3, west: 4, east: 5, up: 1, down: 0 };

export function buildModel(ctx: ModelContext, x: number, y: number, z: number, b: number, shapeId: number): void {
  const shape = SHAPE_NAME[shapeId];
  switch (shape) {
    case 'cross': case 'sapling': case 'mushroom': case 'bush': case 'cobweb': return cross(ctx, x, y, z, b, 1);
    case 'doubleplant': return cross(ctx, x, y, z, b, P(b).half === 'upper' ? 3 : 2);
    case 'kelp': return cross(ctx, x, y, z, b, 2, true);
    case 'crop': return crop(ctx, x, y, z, b);
    case 'stem': return stem(ctx, x, y, z, b);
    case 'slab': return slab(ctx, x, y, z, b);
    case 'stairs': return stairs(ctx, x, y, z, b);
    case 'fence': return fence(ctx, x, y, z, b);
    case 'wall': return wall(ctx, x, y, z, b);
    case 'pane': case 'bars': return pane(ctx, x, y, z, b);
    case 'fencegate': return fenceGate(ctx, x, y, z, b);
    case 'door': return door(ctx, x, y, z, b);
    case 'trapdoor': return trapdoor(ctx, x, y, z, b);
    case 'torch': return torch(ctx, x, y, z, b, null);
    case 'walltorch': return torch(ctx, x, y, z, b, P(b).facing as string);
    case 'ladder': return ladder(ctx, x, y, z, b);
    case 'vine': return vine(ctx, x, y, z, b);
    case 'lilypad': return lilypad(ctx, x, y, z, b);
    case 'carpet': return box(ctx, x, y, z, 0, 0, 0, 16, 1, 16, T6(b));
    case 'snowlayer': return box(ctx, x, y, z, 0, 0, 0, 16, (P(b).layers as number) * 2, 16, T6(b));
    case 'farmland': case 'path': return box(ctx, x, y, z, 0, 0, 0, 16, 15, 16, T6(b));
    case 'cactus': return cactus(ctx, x, y, z, b);
    case 'rail': return rail(ctx, x, y, z, b);
    case 'dust': return dust(ctx, x, y, z, b);
    case 'lever': return lever(ctx, x, y, z, b);
    case 'button': return button(ctx, x, y, z, b);
    case 'plate': {
      const pressed = P(b).powered === true || ((P(b).power as number) ?? 0) > 0;
      return box(ctx, x, y, z, 1, 0, 1, 15, pressed ? 0.5 : 1, 15, T6(b));
    }
    case 'repeater': case 'comparator': return diode(ctx, x, y, z, b, shape === 'comparator');
    case 'bed': return bed(ctx, x, y, z, b);
    case 'chest': return chest(ctx, x, y, z, b);
    case 'sign': return sign(ctx, x, y, z, b, false);
    case 'wallsign': return sign(ctx, x, y, z, b, true);
    case 'lantern': return lantern(ctx, x, y, z, b);
    case 'chain': return chain(ctx, x, y, z, b);
    case 'cake': {
      const bites = (P(b).bites as number) ?? 0;
      const t = [T(b, 0), T(b, 1), T(b, 2), T(b, 3), bites > 0 ? extra(b, 'inner') : T(b, 4), T(b, 5)];
      return box(ctx, x, y, z, 1 + bites * 2, 0, 1, 15, 8, 15, t);
    }
    case 'portal': return portal(ctx, x, y, z, b);
    case 'fire': return fire(ctx, x, y, z, b);
    case 'piston': return piston(ctx, x, y, z, b);
    case 'pistonhead': return pistonHead(ctx, x, y, z, b);
    case 'enchanting': return box(ctx, x, y, z, 0, 0, 0, 16, 12, 16, T6(b));
    case 'daylight': return box(ctx, x, y, z, 0, 0, 0, 16, 6, 16, T6(b));
    case 'anvil': return anvil(ctx, x, y, z, b);
    case 'cauldron': return cauldron(ctx, x, y, z, b);
    case 'composter': return composter(ctx, x, y, z, b);
    case 'lectern': {
      const r = FACING_ROT[P(b).facing as string] ?? 0;
      box(ctx, x, y, z, 0, 0, 0, 16, 2, 16, T6(b), { rot: r });
      box(ctx, x, y, z, 4, 2, 4, 12, 13, 12, [-1, -1, T(b, 2), T(b, 2), T(b, 2), T(b, 2)], { rot: r });
      return box(ctx, x, y, z, 0, 12, 1, 16, 15, 15, [T(b, 0), T(b, 1), T(b, 2), T(b, 2), T(b, 2), T(b, 2)], { rot: r });
    }
    case 'brewing': {
      box(ctx, x, y, z, 7, 0, 7, 9, 14, 9, [-1, T(b, 2), T(b, 2), T(b, 2), T(b, 2), T(b, 2)], { layer: L_CUTOUT });
      const base = extra(b, 'bottom');
      box(ctx, x, y, z, 9, 0, 5, 15, 2, 11, [base, base, base, base, base, base], { layer: L_CUTOUT });
      box(ctx, x, y, z, 1, 0, 1, 7, 2, 7, [base, base, base, base, base, base], { layer: L_CUTOUT });
      return box(ctx, x, y, z, 1, 0, 9, 7, 2, 15, [base, base, base, base, base, base], { layer: L_CUTOUT });
    }
    case 'grindstone': {
      const r = FACING_ROT[P(b).facing as string] ?? 0;
      box(ctx, x, y, z, 4, 4, 2, 12, 16, 14, T6(b), { rot: r, cull: false });
      return box(ctx, x, y, z, 2, 0, 6, 4, 10, 10, [T(b, 2), T(b, 2), T(b, 2), T(b, 2), T(b, 2), T(b, 2)], { rot: r });
    }
    case 'stonecutter': box(ctx, x, y, z, 0, 0, 0, 16, 9, 16, T6(b)); return;
    case 'bell': {
      const t = T6(b);
      box(ctx, x, y, z, 5, 6, 5, 11, 13, 11, t, { cull: false });
      return box(ctx, x, y, z, 4, 4, 4, 12, 6, 12, t, { cull: false });
    }
    case 'campfire': return campfire(ctx, x, y, z, b);
    case 'flowerpot': return box(ctx, x, y, z, 5, 0, 5, 11, 6, 11, T6(b), { layer: L_CUTOUT });
    case 'crystal': return cross(ctx, x, y, z, b, 0, false, FLAG_EMISSIVE);
    case 'scaffold': {
      box(ctx, x, y, z, 0, 14, 0, 16, 16, 16, T6(b), { layer: L_CUTOUT });
      for (const [px, pz] of [[0, 0], [14, 0], [0, 14], [14, 14]]) box(ctx, x, y, z, px, 0, pz, px + 2, 14, pz + 2, T6(b), { layer: L_CUTOUT });
      return;
    }
    default:
      box(ctx, x, y, z, 0, 0, 0, 16, 16, 16, T6(b), { layer: layerOf(b) });
  }
}

// ---------------------------------------------------------------- plantas
function cross(ctx: ModelContext, x: number, y: number, z: number, b: number, wave: number, underwater = false, flags = 0): void {
  const t = T(b, 2);
  const tint = tintOf(ctx, b, x, z);
  // pequeno deslocamento aleatório como no original (quebra a grade)
  const h = hash3(0x5eed, ctx.sx * 16 + x, ctx.sy * 16 + y, ctx.sz * 16 + z);
  const name = nameOf(b);
  const jitter = name === 'short_grass' || name === 'fern' || name.includes('tulip') || name === 'daisy' || name === 'poppy' || name === 'buttercup' || name === 'cornflower';
  const ox = jitter ? ((h & 15) / 15 - 0.5) * 6 : 0, oz = jitter ? (((h >> 4) & 15) / 15 - 0.5) * 6 : 0;
  const oy = jitter ? -((h >> 8) & 3) : 0;
  const a = 0.8, c = 15.2;
  const top = 16 + oy;
  const w = WAVING[b] ? wave : 0;
  plane(ctx, x, y, z, L_CUTOUT, [a + ox, oy, a + oz, c + ox, oy, c + oz, c + ox, top, c + oz, a + ox, top, a + oz], [0, 16, 16, 16, 16, 0, 0, 0], t, tint, w, flags | (underwater ? 1 : 0));
  plane(ctx, x, y, z, L_CUTOUT, [a + ox, oy, c + oz, c + ox, oy, a + oz, c + ox, top, a + oz, a + ox, top, c + oz], [0, 16, 16, 16, 16, 0, 0, 0], t, tint, w, flags | (underwater ? 1 : 0));
}

function crop(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T(b, 2);
  const tint = tintOf(ctx, b, x, z);
  const yo = nameOf(nb(ctx, x, y - 1, z)) === 'farmland' ? -1 : 0;
  for (const p of [4, 12]) {
    plane(ctx, x, y, z, L_CUTOUT, [p, yo, 0, p, yo, 16, p, 16 + yo, 16, p, 16 + yo, 0], [0, 16, 16, 16, 16, 0, 0, 0], t, tint, 2);
    plane(ctx, x, y, z, L_CUTOUT, [0, yo, p, 16, yo, p, 16, 16 + yo, p, 0, 16 + yo, p], [0, 16, 16, 16, 16, 0, 0, 0], t, tint, 2);
  }
}

function stem(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const t = T(b, 2);
  const tint = tintOf(ctx, b, x, z);
  if ('facing' in p) {
    const d = DIR_OF[p.facing as string];
    const ex = 8 + DX[d] * 8, ez = 8 + DZ[d] * 8;
    plane(ctx, x, y, z, L_CUTOUT, [8, -1, 8, ex, -1, ez, ex, 9, ez, 8, 9, 8], [16, 16, 0, 16, 0, 6, 16, 6], t, tint, 2);
    return;
  }
  const h = ((p.age as number) + 1) * 2 - 1;
  plane(ctx, x, y, z, L_CUTOUT, [1, -1, 1, 15, -1, 15, 15, h, 15, 1, h, 1], [0, 16, 16, 16, 16, 16 - h - 1, 0, 16 - h - 1], t, tint, 2);
  plane(ctx, x, y, z, L_CUTOUT, [1, -1, 15, 15, -1, 1, 15, h, 1, 1, h, 15], [0, 16, 16, 16, 16, 16 - h - 1, 0, 16 - h - 1], t, tint, 2);
}

function cactus(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T6(b);
  box(ctx, x, y, z, 0, 0, 0, 16, 16, 16, [t[0], t[1], -1, -1, -1, -1], { layer: L_CUTOUT });
  box(ctx, x, y, z, 1, 0, 1, 15, 16, 15, [-1, -1, t[2], t[3], t[4], t[5]], { layer: L_CUTOUT, cull: false, uv: (f) => (f >= 2 ? [0, 0, 16, 16] : null) });
}

function lilypad(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T(b, 1);
  const h = hash3(0x11, ctx.sx * 16 + x, ctx.sy * 16 + y, ctx.sz * 16 + z) & 3;
  const uvs = [[0, 0, 0, 16, 16, 16, 16, 0], [0, 16, 16, 16, 16, 0, 0, 0], [16, 16, 16, 0, 0, 0, 0, 16], [16, 0, 0, 0, 0, 16, 16, 16]][h];
  quad(ctx, x, y, z, L_CUTOUT, [0, 0.25, 0, 0, 0.25, 16, 16, 0.25, 16, 16, 0.25, 0], uvs, t, N_UP, tintOf(ctx, b, x, z));
  quad(ctx, x, y, z, L_CUTOUT, [16, 0.25, 0, 16, 0.25, 16, 0, 0.25, 16, 0, 0.25, 0], uvs, t, 0, tintOf(ctx, b, x, z));
}

function vine(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const t = T(b, 2);
  const tint = tintOf(ctx, b, x, z);
  const e = 0.8;
  if (p.north) plane(ctx, x, y, z, L_CUTOUT, [16, 0, e, 0, 0, e, 0, 16, e, 16, 16, e], [0, 16, 16, 16, 16, 0, 0, 0], t, tint, 1);
  if (p.south) plane(ctx, x, y, z, L_CUTOUT, [0, 0, 16 - e, 16, 0, 16 - e, 16, 16, 16 - e, 0, 16, 16 - e], [0, 16, 16, 16, 16, 0, 0, 0], t, tint, 1);
  if (p.west) plane(ctx, x, y, z, L_CUTOUT, [e, 0, 0, e, 0, 16, e, 16, 16, e, 16, 0], [0, 16, 16, 16, 16, 0, 0, 0], t, tint, 1);
  if (p.east) plane(ctx, x, y, z, L_CUTOUT, [16 - e, 0, 16, 16 - e, 0, 0, 16 - e, 16, 0, 16 - e, 16, 16], [0, 16, 16, 16, 16, 0, 0, 0], t, tint, 1);
  if (p.up) plane(ctx, x, y, z, L_CUTOUT, [0, 16 - e, 0, 0, 16 - e, 16, 16, 16 - e, 16, 16, 16 - e, 0], [0, 0, 0, 16, 16, 16, 16, 0], t, tint, 1);
}

function ladder(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const d = DIR_OF[P(b).facing as string];
  const t = T(b, 2);
  const e = 15.2;
  // a escada fica encostada na parede oposta à direção para onde "olha"
  const pts: Record<number, number[]> = {
    2: [16, 0, e, 0, 0, e, 0, 16, e, 16, 16, e],
    3: [0, 0, 16 - e, 16, 0, 16 - e, 16, 16, 16 - e, 0, 16, 16 - e],
    4: [e, 0, 0, e, 0, 16, e, 16, 16, e, 16, 0],
    5: [16 - e, 0, 16, 16 - e, 0, 0, 16 - e, 16, 0, 16 - e, 16, 16],
  };
  plane(ctx, x, y, z, L_CUTOUT, pts[d], [0, 16, 16, 16, 16, 0, 0, 0], t, 0xffff, 0, 0, d);
}

// ---------------------------------------------------------------- construção
function slab(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const type = P(b).type;
  const t = T6(b);
  if (type === 'double') return box(ctx, x, y, z, 0, 0, 0, 16, 16, 16, t);
  if (type === 'top') return box(ctx, x, y, z, 0, 8, 0, 16, 16, 16, t);
  box(ctx, x, y, z, 0, 0, 0, 16, 8, 16, t);
}

const isStairs = (s: number) => shapeOf(s) === 'stairs';
const CCW: Record<string, string> = { north: 'west', west: 'south', south: 'east', east: 'north' };
const OPP: Record<string, string> = { north: 'south', south: 'north', west: 'east', east: 'west' };
const V: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

export function stairShape(get: (dx: number, dz: number) => number, s: number): string {
  const p = P(s);
  const f = p.facing as string, half = p.half;
  const [fx, fz] = V[f];
  const behind = get(fx, fz);
  const canTake = (face: string): boolean => {
    const [ox, oz] = V[face];
    const n = get(ox, oz);
    return !(isStairs(n) && P(n).facing === f && P(n).half === half);
  };
  if (isStairs(behind) && P(behind).half === half) {
    const bf = P(behind).facing as string;
    if ((bf === 'north' || bf === 'south') !== (f === 'north' || f === 'south') && canTake(OPP[bf])) {
      return bf === CCW[f] ? 'outer_left' : 'outer_right';
    }
  }
  const front = get(-fx, -fz);
  if (isStairs(front) && P(front).half === half) {
    const ff = P(front).facing as string;
    if ((ff === 'north' || ff === 'south') !== (f === 'north' || f === 'south') && canTake(ff)) {
      return ff === CCW[f] ? 'inner_left' : 'inner_right';
    }
  }
  return 'straight';
}

function stairs(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const t = T6(b);
  const top = p.half === 'top';
  const shape = stairShape((dx, dz) => nb(ctx, x + dx, y, z + dz), b);
  const r = FACING_ROT[p.facing as string];
  // base (laje)
  if (top) box(ctx, x, y, z, 0, 8, 0, 16, 16, 16, t); else box(ctx, x, y, z, 0, 0, 0, 16, 8, 16, t);
  const y0 = top ? 0 : 8, y1 = top ? 8 : 16;
  // quadrantes do degrau alto, no referencial "virado para o norte": NW, NE, SW, SE
  const q: [number, number, number, number][] = [];
  const NW: [number, number, number, number] = [0, 0, 8, 8], NE: [number, number, number, number] = [8, 0, 16, 8];
  const SW: [number, number, number, number] = [0, 8, 8, 16], SE: [number, number, number, number] = [8, 8, 16, 16];
  switch (shape) {
    case 'outer_left': q.push(NW); break;
    case 'outer_right': q.push(NE); break;
    case 'inner_left': q.push([0, 0, 16, 8], SW); break;
    case 'inner_right': q.push([0, 0, 16, 8], SE); break;
    default: q.push([0, 0, 16, 8]);
  }
  for (const [x0, z0, x1, z1] of q) box(ctx, x, y, z, x0, y0, z0, x1, y1, z1, t, { rot: r });
}

function connects(ctx: ModelContext, s: number, n: number, d: number, kind: 'fence' | 'wall' | 'pane'): boolean {
  const sh = shapeOf(n);
  if (kind === 'fence') {
    if (sh === 'fence') return nameOf(s).startsWith('infero') === nameOf(n).startsWith('infero');
    if (sh === 'fencegate') {
      const f = P(n).facing as string;
      const along = f === 'north' || f === 'south' ? (d === 4 || d === 5) : (d === 2 || d === 3);
      return along;
    }
  } else if (kind === 'wall') {
    if (sh === 'wall' || sh === 'pane' || sh === 'fencegate') return true;
  } else if (kind === 'pane') {
    if (sh === 'pane' || sh === 'wall') return true;
    if (nameOf(n).includes('glass')) return true;
  }
  return OPAQUE[n] === 1 && !(FLAGS[n] & F_LEAVES) && shapeOf(n) === 'cube' && nameOf(n) !== 'pumpkin' && nameOf(n) !== 'melon';
}

function fence(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T6(b);
  box(ctx, x, y, z, 6, 0, 6, 10, 16, 10, t);
  for (const d of H_DIRS) {
    const n = nb(ctx, x + DX[d], y, z + DZ[d]);
    if (!connects(ctx, b, n, d, 'fence')) continue;
    const r = { 2: 0, 5: 1, 3: 2, 4: 3 }[d] as number;
    box(ctx, x, y, z, 7, 12, 0, 9, 15, 6, t, { rot: r });
    box(ctx, x, y, z, 7, 6, 0, 9, 9, 6, t, { rot: r });
  }
}

function wall(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T6(b);
  const con = H_DIRS.map((d) => connects(ctx, b, nb(ctx, x + DX[d], y, z + DZ[d]), d, 'wall'));
  const above = nb(ctx, x, y + 1, z);
  const straightNS = con[0] && con[1] && !con[2] && !con[3];
  const straightEW = con[2] && con[3] && !con[0] && !con[1];
  const post = !(straightNS || straightEW) || above !== 0;
  if (post) box(ctx, x, y, z, 4, 0, 4, 12, 16, 12, t);
  H_DIRS.forEach((d, i) => {
    if (!con[i]) return;
    const r = { 2: 0, 5: 1, 3: 2, 4: 3 }[d] as number;
    box(ctx, x, y, z, 5, 0, 0, 11, 14, post ? 4 : 8, t, { rot: r });
  });
}

function pane(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const side = T(b, 2), top = T(b, 1);
  const layer = layerOf(b);
  const con = H_DIRS.map((d) => connects(ctx, b, nb(ctx, x + DX[d], y, z + DZ[d]), d, 'pane'));
  const tex = [top, top, side, side, side, side];
  const cullTop = (f: number) => (f <= 1 ? [7, 7, 9, 9] as [number, number, number, number] : null);
  box(ctx, x, y, z, 7, 0, 7, 9, 16, 9, tex, { layer, uv: cullTop });
  H_DIRS.forEach((d, i) => {
    if (!con[i]) return;
    const r = { 2: 0, 5: 1, 3: 2, 4: 3 }[d] as number;
    box(ctx, x, y, z, 7, 0, 0, 9, 16, 7, tex, { rot: r, layer, uv: (f) => (f <= 1 ? [7, 0, 9, 7] : f === 4 || f === 5 ? [0, 0, 7, 16] : null) });
  });
}

function fenceGate(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const t = T6(b);
  const r = FACING_ROT[p.facing as string];
  const dy = p.in_wall ? -3 : 0;
  // postes nas pontas (portão ao longo do eixo X quando virado para norte)
  box(ctx, x, y, z, 0, 5 + dy, 7, 2, 16 + dy, 9, t, { rot: r });
  box(ctx, x, y, z, 14, 5 + dy, 7, 16, 16 + dy, 9, t, { rot: r });
  if (!p.open) {
    box(ctx, x, y, z, 6, 6 + dy, 7, 8, 15 + dy, 9, t, { rot: r });
    box(ctx, x, y, z, 8, 6 + dy, 7, 10, 15 + dy, 9, t, { rot: r });
    box(ctx, x, y, z, 2, 6 + dy, 7, 6, 9 + dy, 9, t, { rot: r });
    box(ctx, x, y, z, 2, 12 + dy, 7, 6, 15 + dy, 9, t, { rot: r });
    box(ctx, x, y, z, 10, 6 + dy, 7, 14, 9 + dy, 9, t, { rot: r });
    box(ctx, x, y, z, 10, 12 + dy, 7, 14, 15 + dy, 9, t, { rot: r });
  } else {
    // folhas abertas para dentro (sul no referencial)
    box(ctx, x, y, z, 0, 6 + dy, 13, 2, 15 + dy, 15, t, { rot: r });
    box(ctx, x, y, z, 14, 6 + dy, 13, 16, 15 + dy, 15, t, { rot: r });
    box(ctx, x, y, z, 0, 6 + dy, 9, 2, 9 + dy, 13, t, { rot: r });
    box(ctx, x, y, z, 0, 12 + dy, 9, 2, 15 + dy, 13, t, { rot: r });
    box(ctx, x, y, z, 14, 6 + dy, 9, 16, 9 + dy, 13, t, { rot: r });
    box(ctx, x, y, z, 14, 12 + dy, 9, 16, 15 + dy, 13, t, { rot: r });
  }
}

/** Caixa (em referencial norte) ocupada pela folha da porta/alçapão. */
function doorPanel(facing: string, open: boolean, hinge: string): string {
  if (!open) return facing;
  const right = hinge === 'right';
  const map: Record<string, [string, string]> = { east: ['north', 'south'], south: ['east', 'west'], west: ['south', 'north'], north: ['west', 'east'] };
  return right ? map[facing][0] : map[facing][1];
}

function door(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const upper = p.half === 'upper';
  const main = upper ? T(b, 1) : T(b, 0);
  const panelDir = doorPanel(p.facing as string, p.open as boolean, p.hinge as string);
  // painel ocupa 3/16 do lado oposto à direção
  const boxes: Record<string, number[]> = {
    north: [0, 13, 16, 16], south: [0, 0, 16, 3], west: [13, 0, 16, 16], east: [0, 0, 3, 16],
  };
  const [x0, z0, x1, z1] = boxes[panelDir];
  const t = [upper ? -1 : main, upper ? main : -1, main, main, main, main];
  const mirror = (p.hinge === 'right') !== (p.open as boolean);
  box(ctx, x, y, z, x0, 0, z0, x1, 16, z1, t, {
    layer: L_CUTOUT,
    cull: false,
    uv: (f) => {
      if (f <= 1) return [x0, z0, x1, z1];
      const thin = (f === 2 || f === 3) ? (x1 - x0 < 4) : (z1 - z0 < 4);
      if (thin) return [0, 0, 3, 16];
      return mirror ? [16, 0, 0, 16] : [0, 0, 16, 16];
    },
  });
}

function trapdoor(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const t = T(b, 2);
  const tex = [t, t, t, t, t, t];
  if (!p.open) {
    if (p.half === 'top') box(ctx, x, y, z, 0, 13, 0, 16, 16, 16, tex, { layer: L_CUTOUT, uv: (f) => (f <= 1 ? null : [0, 0, 16, 3]) });
    else box(ctx, x, y, z, 0, 0, 0, 16, 3, 16, tex, { layer: L_CUTOUT, uv: (f) => (f <= 1 ? null : [0, 0, 16, 3]) });
    return;
  }
  const boxes: Record<string, number[]> = {
    north: [0, 13, 16, 16], south: [0, 0, 16, 3], west: [13, 0, 16, 16], east: [0, 0, 3, 16],
  };
  const [x0, z0, x1, z1] = boxes[p.facing as string];
  box(ctx, x, y, z, x0, 0, z0, x1, 16, z1, tex, { layer: L_CUTOUT, uv: (f) => (f <= 1 ? [0, 0, 16, 3] : null) });
}

// ---------------------------------------------------------------- luz e decoração
function torch(ctx: ModelContext, x: number, y: number, z: number, b: number, facing: string | null): void {
  const t = T(b, 2);
  const tex = [t, t, t, t, t, t];
  const uv = (f: number): [number, number, number, number] => (f === 1 ? [7, 6, 9, 8] : f === 0 ? [7, 14, 9, 16] : [7, 6, 9, 16]);
  if (!facing) {
    box(ctx, x, y, z, 7, 0, 7, 9, 10, 9, tex, { layer: L_CUTOUT, cull: false, uv, flags: FLAG_EMISSIVE });
    return;
  }
  // tocha de parede: inclinada 22,5° para longe da parede, base encostada
  const d = DIR_OF[facing];
  const ang = (22.5 * Math.PI) / 180;
  const xf = (pts: number[]): number[] => {
    // base em (8, 3.5, 8) antes de mover até a parede
    let q = pts.map((v, i) => (i % 3 === 1 ? v + 3.5 : v));
    // inclina: eixo perpendicular à direção
    if (d === 2) q = rotatePts(q, 'x', ang, 8, 3.5, 8);
    else if (d === 3) q = rotatePts(q, 'x', -ang, 8, 3.5, 8);
    else if (d === 4) q = rotatePts(q, 'z', -ang, 8, 3.5, 8);
    else q = rotatePts(q, 'z', ang, 8, 3.5, 8);
    // desloca até a parede (lado oposto da direção)
    const off = 8 - 1;
    return q.map((v, i) => (i % 3 === 0 ? v - DX[d] * off : i % 3 === 2 ? v - DZ[d] * off : v));
  };
  freeBox(ctx, x, y, z, 7, 0, 7, 9, 10, 9, tex, [uv(0), uv(1), uv(2), uv(3), uv(4), uv(5)], xf, L_CUTOUT);
}

function lantern(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T(b, 2);
  const tex = [t, t, t, t, t, t];
  const oy = P(b).hanging ? 1 : 0;
  box(ctx, x, y, z, 5, oy, 5, 11, 7 + oy, 11, tex, { layer: L_CUTOUT, cull: false, uv: (f) => (f <= 1 ? [0, 9, 6, 15] : [0, 2, 6, 9]), flags: FLAG_EMISSIVE });
  box(ctx, x, y, z, 6, 7 + oy, 6, 10, 9 + oy, 10, tex, { layer: L_CUTOUT, cull: false, uv: (f) => (f <= 1 ? [0, 10, 4, 14] : [0, 0, 4, 2]) });
  if (P(b).hanging) plane(ctx, x, y, z, L_CUTOUT, [6.5, 10, 8, 9.5, 10, 8, 9.5, 16, 8, 6.5, 16, 8], [11, 6, 14, 6, 14, 0, 11, 0], t);
}

function chain(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T(b, 2);
  const ax = P(b).axis as string;
  const pts1 = [6.5, 0, 8, 9.5, 0, 8, 9.5, 16, 8, 6.5, 16, 8];
  const pts2 = [8, 0, 6.5, 8, 0, 9.5, 8, 16, 9.5, 8, 16, 6.5];
  const xf = (p: number[]) => ax === 'y' ? p : ax === 'x' ? rotatePts(p, 'z', Math.PI / 2, 8, 8, 8) : rotatePts(p, 'x', Math.PI / 2, 8, 8, 8);
  plane(ctx, x, y, z, L_CUTOUT, xf(pts1), [0, 16, 3, 16, 3, 0, 0, 0], t, 0xffff, 0, 0, N_DERIV);
  plane(ctx, x, y, z, L_CUTOUT, xf(pts2), [3, 16, 6, 16, 6, 0, 3, 0], t, 0xffff, 0, 0, N_DERIV);
}

function portal(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T(b, 2);
  const tex = [-1, -1, t, t, t, t];
  const axis = P(b).axis;
  if (axis === 'x') box(ctx, x, y, z, 0, 0, 6, 16, 16, 10, [t, t, t, t, -1, -1], { layer: L_TRANSLUCENT, flags: FLAG_EMISSIVE });
  else box(ctx, x, y, z, 6, 0, 0, 10, 16, 16, [t, t, -1, -1, t, t], { layer: L_TRANSLUCENT, flags: FLAG_EMISSIVE });
  void tex;
}

function fire(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t0 = T(b, 2), t1 = extra(b, 'alt');
  const below = nb(ctx, x, y - 1, z);
  const flags = FLAG_EMISSIVE;
  if (OPAQUE[below] || below !== 0) {
    // chão: planos inclinados nas bordas
    const i = 0.8;
    plane(ctx, x, y, z, L_CUTOUT, [0, 0, i, 16, 0, i, 16, 22.4, 5, 0, 22.4, 5], [0, 16, 16, 16, 16, 0, 0, 0], t0, 0xffff, 0, flags, N_DERIV);
    plane(ctx, x, y, z, L_CUTOUT, [16, 0, 16 - i, 0, 0, 16 - i, 0, 22.4, 11, 16, 22.4, 11], [0, 16, 16, 16, 16, 0, 0, 0], t1, 0xffff, 0, flags, N_DERIV);
    plane(ctx, x, y, z, L_CUTOUT, [i, 0, 16, i, 0, 0, 5, 22.4, 0, 5, 22.4, 16], [0, 16, 16, 16, 16, 0, 0, 0], t1, 0xffff, 0, flags, N_DERIV);
    plane(ctx, x, y, z, L_CUTOUT, [16 - i, 0, 0, 16 - i, 0, 16, 11, 22.4, 16, 11, 22.4, 0], [0, 16, 16, 16, 16, 0, 0, 0], t0, 0xffff, 0, flags, N_DERIV);
  }
  // cruz central
  plane(ctx, x, y, z, L_CUTOUT, [0.5, 0, 0.5, 15.5, 0, 15.5, 15.5, 16, 15.5, 0.5, 16, 0.5], [0, 16, 16, 16, 16, 0, 0, 0], t0, 0xffff, 0, flags, N_DERIV);
  plane(ctx, x, y, z, L_CUTOUT, [0.5, 0, 15.5, 15.5, 0, 0.5, 15.5, 16, 0.5, 0.5, 16, 15.5], [0, 16, 16, 16, 16, 0, 0, 0], t1, 0xffff, 0, flags, N_DERIV);
}

function campfire(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const log = extra(b, 'side'), lit = extra(b, 'lit');
  const r = FACING_ROT[p.facing as string] ?? 0;
  const L = [log, log, log, log, log, log];
  box(ctx, x, y, z, 1, 0, 0, 5, 4, 16, L, { rot: r });
  box(ctx, x, y, z, 11, 0, 0, 15, 4, 16, L, { rot: r });
  box(ctx, x, y, z, 0, 3, 11, 16, 7, 15, L, { rot: r });
  box(ctx, x, y, z, 0, 3, 1, 16, 7, 5, L, { rot: r });
  box(ctx, x, y, z, 5, 0, 0, 11, 1, 16, [lit, lit, lit, lit, lit, lit], { rot: r });
  if (p.lit) {
    const f = extra(b, 'fire');
    plane(ctx, x, y, z, L_CUTOUT, [0.8, 1, 0.8, 15.2, 1, 15.2, 15.2, 17, 15.2, 0.8, 17, 0.8], [0, 16, 16, 16, 16, 0, 0, 0], f, 0xffff, 0, FLAG_EMISSIVE, N_DERIV);
    plane(ctx, x, y, z, L_CUTOUT, [0.8, 1, 15.2, 15.2, 1, 0.8, 15.2, 17, 0.8, 0.8, 17, 15.2], [0, 16, 16, 16, 16, 0, 0, 0], f, 0xffff, 0, FLAG_EMISSIVE, N_DERIV);
  }
}

// ---------------------------------------------------------------- fulgor
function rail(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const shape = P(b).shape as string;
  const t = T(b, 1);
  const up = 1;
  let pts: number[];
  let uvs = [0, 16, 16, 16, 16, 0, 0, 0];
  switch (shape) {
    case 'east_west': pts = [0, up, 16, 16, up, 16, 16, up, 0, 0, up, 0]; uvs = [0, 0, 0, 16, 16, 16, 16, 0]; break;
    case 'ascending_east': pts = [0, up, 16, 16, 16 + up, 16, 16, 16 + up, 0, 0, up, 0]; uvs = [0, 0, 0, 16, 16, 16, 16, 0]; break;
    case 'ascending_west': pts = [0, 16 + up, 16, 16, up, 16, 16, up, 0, 0, 16 + up, 0]; uvs = [0, 0, 0, 16, 16, 16, 16, 0]; break;
    case 'ascending_north': pts = [0, up, 16, 16, up, 16, 16, 16 + up, 0, 0, 16 + up, 0]; break;
    case 'ascending_south': pts = [0, 16 + up, 16, 16, 16 + up, 16, 16, up, 0, 0, up, 0]; break;
    case 'south_east': pts = [0, up, 16, 16, up, 16, 16, up, 0, 0, up, 0]; uvs = [0, 0, 0, 16, 16, 16, 16, 0]; break;
    case 'south_west': pts = [0, up, 16, 16, up, 16, 16, up, 0, 0, up, 0]; uvs = [0, 16, 0, 0, 16, 0, 16, 16]; break;
    case 'north_west': pts = [0, up, 16, 16, up, 16, 16, up, 0, 0, up, 0]; uvs = [16, 16, 16, 0, 0, 0, 0, 16]; break;
    case 'north_east': pts = [0, up, 16, 16, up, 16, 16, up, 0, 0, up, 0]; uvs = [16, 0, 16, 16, 0, 16, 0, 0]; break;
    default: pts = [0, up, 16, 16, up, 16, 16, up, 0, 0, up, 0];
  }
  const powered = P(b).powered === true;
  plane(ctx, x, y, z, L_CUTOUT, pts, uvs, t, 0xffff, 0, powered ? FLAG_EMISSIVE : 0, shape.startsWith('ascending') ? N_DERIV : N_UP);
}

const isWire = (s: number) => shapeOf(s) === 'dust';
function wireConnects(ctx: ModelContext, x: number, y: number, z: number, d: number): 0 | 1 | 2 {
  const nx = x + DX[d], nz = z + DZ[d];
  const n = nb(ctx, nx, y, nz);
  if (isWire(n)) return 1;
  const sh = shapeOf(n);
  if (sh === 'repeater') {
    const f = DIR_OF[P(n).facing as string];
    if (f === d || f === (d ^ 1)) return 1;
  }
  if (sh === 'comparator' || sh === 'lever' || sh === 'button' || sh === 'plate' || sh === 'torch' || sh === 'walltorch' || nameOf(n) === 'fulgor_block' || nameOf(n).includes('observer') || nameOf(n) === 'target' || nameOf(n) === 'daylight_detector') {
    if (nameOf(n).startsWith('fulgor') || sh !== 'torch' || nameOf(n).includes('fulgor')) return 1;
  }
  // subida: fio no vizinho de cima e nada opaco acima deste
  if (!OPAQUE[nb(ctx, x, y + 1, z)] && isWire(nb(ctx, nx, y + 1, nz))) return 2;
  // descida: vizinho não opaco com fio embaixo
  if (!OPAQUE[n] && isWire(nb(ctx, nx, y - 1, nz))) return 1;
  return 0;
}

function dust(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const dot = T(b, 1), line = T(b, 2);
  const tint = tintOf(ctx, b, x, z);
  const power = (P(b).power as number) ?? 0;
  const flags = power > 0 ? FLAG_EMISSIVE : 0;
  const c = [2, 3, 4, 5].map((d) => wireConnects(ctx, x, y, z, d)); // N S W E
  const n = c[0] > 0, s = c[1] > 0, w = c[2] > 0, e = c[3] > 0;
  const count = +n + +s + +w + +e;
  const yy = 0.25;
  const flat = (pts: number[], uvs: number[], tex: number) => {
    quad(ctx, x, y, z, L_CUTOUT, pts, uvs, tex, N_UP, tint, 0, flags);
  };
  const full = [0, yy, 0, 0, yy, 16, 16, yy, 16, 16, yy, 0];
  if (count === 0) {
    flat(full, [0, 0, 0, 16, 16, 16, 16, 0], dot);
  } else if ((n || s) && !w && !e) {
    flat(full, [0, 0, 0, 16, 16, 16, 16, 0], line); // linha N-S
  } else if ((w || e) && !n && !s) {
    flat(full, [16, 0, 0, 0, 0, 16, 16, 16], line); // linha L-O (girada)
  } else {
    flat(full, [0, 0, 0, 16, 16, 16, 16, 0], dot);
    // braços
    if (n) flat([0, yy + 0.01, 0, 0, yy + 0.01, 8, 16, yy + 0.01, 8, 16, yy + 0.01, 0], [0, 0, 0, 8, 16, 8, 16, 0], line);
    if (s) flat([0, yy + 0.01, 8, 0, yy + 0.01, 16, 16, yy + 0.01, 16, 16, yy + 0.01, 8], [0, 8, 0, 16, 16, 16, 16, 8], line);
    if (w) flat([0, yy + 0.02, 0, 0, yy + 0.02, 16, 8, yy + 0.02, 16, 8, yy + 0.02, 0], [16, 0, 0, 0, 0, 8, 16, 8], line);
    if (e) flat([8, yy + 0.02, 0, 8, yy + 0.02, 16, 16, yy + 0.02, 16, 16, yy + 0.02, 0], [16, 8, 0, 8, 0, 16, 16, 16], line);
  }
  // subidas pela parede
  [2, 3, 4, 5].forEach((d, i) => {
    if (c[i] !== 2) return;
    const e2 = 0.25;
    const pts: Record<number, number[]> = {
      2: [16, 0, e2, 0, 0, e2, 0, 16, e2, 16, 16, e2],
      3: [0, 0, 16 - e2, 16, 0, 16 - e2, 16, 16, 16 - e2, 0, 16, 16 - e2],
      4: [e2, 0, 0, e2, 0, 16, e2, 16, 16, e2, 16, 0],
      5: [16 - e2, 0, 16, 16 - e2, 0, 0, 16 - e2, 16, 0, 16 - e2, 16, 16],
    };
    plane(ctx, x, y, z, L_CUTOUT, pts[d], [0, 16, 16, 16, 16, 0, 0, 0], line, tint, 0, flags, d ^ 1);
  });
}

function attach(p: Record<string, unknown>): { rotX: number; r: number } {
  const face = p.face as string;
  const r = FACING_ROT[p.facing as string] ?? 0;
  return { rotX: face === 'floor' ? 0 : face === 'ceiling' ? 2 : 1, r };
}

/** Aplica orientação de itens presos (piso/parede/teto) a pontos em referencial "piso, virado para o norte". */
function attachXf(face: string, r: number) {
  return (pts: number[]): number[] => {
    let q = pts;
    if (face === 'ceiling') q = rotatePts(q, 'x', Math.PI, 8, 8, 8);
    else if (face === 'wall') q = rotatePts(q, 'x', -Math.PI / 2, 8, 8, 8); // gira para a parede sul→ encosta no lado sul? ajusta abaixo
    // rotação horizontal
    const ang = -r * Math.PI / 2;
    if (r) q = rotatePts(q, 'y', ang, 8, 8, 8);
    return q;
  };
}

function lever(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const base = extra(b, 'side'), handle = extra(b, 'handle');
  const face = p.face as string;
  const { r } = attach(p);
  const xf = attachXf(face, (r + 2) & 3);
  const B = [base, base, base, base, base, base];
  freeBox(ctx, x, y, z, 5, 0, 4, 11, 3, 12, B, [null, null, null, null, null, null], xf, L_SOLID);
  const on = p.powered === true;
  const ang = (on ? -45 : 45) * Math.PI / 180;
  const H = [handle, handle, handle, handle, handle, handle];
  freeBox(ctx, x, y, z, 7, 1, 7, 9, 11, 9, H, [[7, 6, 9, 8], [7, 6, 9, 8], [7, 6, 9, 16], [7, 6, 9, 16], [7, 6, 9, 16], [7, 6, 9, 16]],
    (pts) => xf(rotatePts(pts, 'x', ang, 8, 1, 8)), L_CUTOUT);
}

function button(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const t = T(b, 2);
  const face = p.face as string;
  const { r } = attach(p);
  const xf = attachXf(face, (r + 2) & 3);
  const h = p.powered ? 1 : 2;
  freeBox(ctx, x, y, z, 5, 0, 6, 11, h, 10, [t, t, t, t, t, t], [[5, 6, 11, 10], [5, 6, 11, 10], [5, 14, 11, 16], [5, 14, 11, 16], [6, 14, 10, 16], [6, 14, 10, 16]], xf, L_SOLID);
}

function diode(ctx: ModelContext, x: number, y: number, z: number, b: number, comparator: boolean): void {
  const p = P(b);
  const t = T6(b);
  const r = (FACING_ROT[p.facing as string] + 2) & 3;
  box(ctx, x, y, z, 0, 0, 0, 16, 2, 16, t, { rot: r });
  const torchTex = texLayer(p.powered ? 'fulgor_torch' : 'fulgor_torch_off');
  const TT = [torchTex, torchTex, torchTex, torchTex, torchTex, torchTex];
  const uv = (f: number): [number, number, number, number] => (f === 1 ? [7, 6, 9, 8] : [7, 6, 9, 11]);
  const fl = p.powered ? FLAG_EMISSIVE : 0;
  if (!comparator) {
    const delay = (p.delay as number) ?? 1;
    box(ctx, x, y, z, 7, 2, 12, 9, 7, 14, TT, { rot: r, layer: L_CUTOUT, cull: false, uv, flags: fl });
    const zz = 6 - (delay - 1) * 2 + 2;
    if (p.locked) box(ctx, x, y, z, 2, 2, zz, 14, 4, zz + 2, [t[1], t[1], t[1], t[1], t[1], t[1]], { rot: r });
    else box(ctx, x, y, z, 7, 2, zz, 9, 7, zz + 2, TT, { rot: r, layer: L_CUTOUT, cull: false, uv, flags: fl });
  } else {
    box(ctx, x, y, z, 4, 2, 11, 6, 7, 13, TT, { rot: r, layer: L_CUTOUT, cull: false, uv, flags: fl });
    box(ctx, x, y, z, 10, 2, 11, 12, 7, 13, TT, { rot: r, layer: L_CUTOUT, cull: false, uv, flags: fl });
    const front = p.mode === 'subtract' ? texLayer('fulgor_torch') : texLayer('fulgor_torch_off');
    box(ctx, x, y, z, 7, 2, 2, 9, 5, 4, [front, front, front, front, front, front], { rot: r, layer: L_CUTOUT, cull: false, uv, flags: p.mode === 'subtract' ? FLAG_EMISSIVE : 0 });
  }
}

function piston(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const f = p.facing as string;
  const ext = p.extended === true;
  const top = T(b, 1), side = T(b, 2), bottom = T(b, 0), inner = extra(b, 'inner');
  // no referencial "virado para cima": topo = frente
  const faceTex = [bottom, ext ? inner : top, side, side, side, side];
  const xf = orient6(f);
  const y1 = ext ? 12 : 16;
  freeBox(ctx, x, y, z, 0, 0, 0, 16, y1, 16, faceTex,
    [null, null, [0, ext ? 4 : 0, 16, 16], [0, ext ? 4 : 0, 16, 16], [0, ext ? 4 : 0, 16, 16], [0, ext ? 4 : 0, 16, 16]], xf, L_SOLID);
}

function pistonHead(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const xf = orient6(p.facing as string);
  const top = T(b, 1), side = T(b, 2);
  freeBox(ctx, x, y, z, 0, 12, 0, 16, 16, 16, [top, top, side, side, side, side], [null, null, [0, 0, 16, 4], [0, 0, 16, 4], [0, 0, 16, 4], [0, 0, 16, 4]], xf, L_SOLID);
  freeBox(ctx, x, y, z, 6, -4, 6, 10, 12, 10, [-1, -1, side, side, side, side], [null, null, [0, 4, 4, 16], [0, 4, 4, 16], [0, 4, 4, 16], [0, 4, 4, 16]], xf, L_SOLID);
}

/** Transforma um modelo feito "virado para cima" para a direção dada. */
function orient6(f: string) {
  return (pts: number[]): number[] => {
    switch (f) {
      case 'down': return rotatePts(pts, 'x', Math.PI, 8, 8, 8);
      case 'north': return rotatePts(pts, 'x', -Math.PI / 2, 8, 8, 8);
      case 'south': return rotatePts(pts, 'x', Math.PI / 2, 8, 8, 8);
      case 'west': return rotatePts(pts, 'z', Math.PI / 2, 8, 8, 8);
      case 'east': return rotatePts(pts, 'z', -Math.PI / 2, 8, 8, 8);
      default: return pts;
    }
  };
}

// ---------------------------------------------------------------- mobília
function bed(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const wool = T(b, 2), wood = T(b, 0);
  const head = p.part === 'head';
  const r = FACING_ROT[p.facing as string];
  // colchão
  box(ctx, x, y, z, 0, 3, 0, 16, 9, 16, [wood, wool, wool, wool, wool, wool], { rot: r });
  // pés
  const W = [wood, wood, wood, wood, wood, wood];
  if (head) { box(ctx, x, y, z, 0, 0, 0, 3, 3, 3, W, { rot: r }); box(ctx, x, y, z, 13, 0, 0, 16, 3, 3, W, { rot: r }); }
  else { box(ctx, x, y, z, 0, 0, 13, 3, 3, 16, W, { rot: r }); box(ctx, x, y, z, 13, 0, 13, 16, 3, 16, W, { rot: r }); }
  if (head) {
    const pillow = texLayer('white_wool');
    box(ctx, x, y, z, 2, 9, 2, 14, 11, 7, [pillow, pillow, pillow, pillow, pillow, pillow], { rot: r });
  }
}

function chest(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const p = P(b);
  const r = FACING_ROT[p.facing as string];
  const t = T6(b);
  const type = p.type as string;
  const x0 = type === 'right' ? 0 : 1, x1 = type === 'left' ? 16 : 15;
  // no referencial "virado para o norte" a frente é a face norte
  const rr = r;
  const front = extra(b, 'front');
  box(ctx, x, y, z, x0, 0, 1, x1, 14, 15, [t[0], t[1], front, t[2], t[2], t[2]], { rot: rr, uv: (f) => (f >= 2 ? [x0, 2, x1, 16] : null) });
  if (type !== 'right') {
    const latch = texLayer('iron_block');
    box(ctx, x, y, z, type === 'left' ? 15 : 7, 7, 0, type === 'left' ? 16 : 9, 11, 1, [latch, latch, latch, latch, latch, latch], { rot: rr });
  }
}

function sign(ctx: ModelContext, x: number, y: number, z: number, b: number, wall: boolean): void {
  const p = P(b);
  const t = T(b, 2);
  const tex = [t, t, t, t, t, t];
  if (wall) {
    const r = FACING_ROT[p.facing as string];
    // placa encostada na parede atrás (sul no referencial norte)
    box(ctx, x, y, z, 0, 4.5, 14, 16, 12.5, 16, tex, { rot: r });
    return;
  }
  const ang = -((p.rotation as number) ?? 0) * (Math.PI / 8);
  const xf = (pts: number[]) => rotatePts(pts, 'y', ang, 8, 8, 8);
  const log = texLayer(String((BLOCKS[BLOCK_OF[b]].def.data?.log as string) ?? 'oak_log'));
  freeBox(ctx, x, y, z, 7.25, 0, 7.25, 8.75, 9.3, 8.75, [log, log, log, log, log, log], [null, null, [7, 0, 9, 9], [7, 0, 9, 9], [7, 0, 9, 9], [7, 0, 9, 9]], xf, L_SOLID);
  freeBox(ctx, x, y, z, 0, 9.3, 7.25, 16, 17.3, 8.75, tex, [null, null, null, null, null, null], xf, L_SOLID);
}

function anvil(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const r = FACING_ROT[P(b).facing as string];
  const t = T6(b), s = T(b, 2);
  const S6 = [s, s, s, s, s, s];
  box(ctx, x, y, z, 2, 0, 2, 14, 4, 14, S6, { rot: r });
  box(ctx, x, y, z, 4, 4, 3, 12, 5, 13, S6, { rot: r });
  box(ctx, x, y, z, 6, 5, 4, 10, 10, 12, S6, { rot: r });
  box(ctx, x, y, z, 3, 10, 0, 13, 16, 16, t, { rot: r });
}

function cauldron(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T6(b), inner = extra(b, 'inner');
  const side = T(b, 2);
  const W = [side, t[1], side, side, side, side];
  box(ctx, x, y, z, 0, 3, 0, 2, 16, 16, W);
  box(ctx, x, y, z, 14, 3, 0, 16, 16, 16, W);
  box(ctx, x, y, z, 2, 3, 0, 14, 16, 2, W);
  box(ctx, x, y, z, 2, 3, 14, 14, 16, 16, W);
  box(ctx, x, y, z, 0, 3, 0, 16, 4, 16, [t[0], inner, -1, -1, -1, -1]);
  for (const [px, pz] of [[0, 0], [12, 0], [0, 12], [12, 12]]) box(ctx, x, y, z, px, 0, pz, px + 4, 3, pz + 4, [t[0], -1, side, side, side, side]);
  const level = (P(b).level as number) ?? 0;
  if (level > 0) {
    const wy = 4 + level * 3.5;
    const wt = texLayer('water_still');
    quad(ctx, x, y, z, 3, [2, wy, 2, 2, wy, 14, 14, wy, 14, 14, wy, 2], [2, 2, 2, 14, 14, 14, 14, 2], wt, N_UP, tintColor(3, b, ctx.tints, x, z));
  }
}

function composter(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const t = T6(b), side = T(b, 2);
  const W = [side, t[1], side, side, side, side];
  box(ctx, x, y, z, 0, 0, 0, 16, 2, 16, [t[0], t[0], side, side, side, side]);
  box(ctx, x, y, z, 0, 2, 0, 2, 16, 16, W);
  box(ctx, x, y, z, 14, 2, 0, 16, 16, 16, W);
  box(ctx, x, y, z, 2, 2, 0, 14, 16, 2, W);
  box(ctx, x, y, z, 2, 2, 14, 14, 16, 16, W);
  const level = (P(b).level as number) ?? 0;
  if (level > 0) {
    const c = extra(b, 'inner');
    const h = 2 + Math.min(level, 7) * 2;
    quad(ctx, x, y, z, L_SOLID, [2, h, 2, 2, h, 14, 14, h, 14, 14, h, 2], [2, 2, 2, 14, 14, 14, 14, 2], c, N_UP);
  }
}

export { OCCLUDES, N_PLANT };
