/**
 * Formas de colisão e de contorno (seleção) por estado de bloco, em unidades de bloco (0..1).
 * Seguem as caixas do original: lajes, escadas (com cantos), cercas de 1,5 de altura, portas, alçapões etc.
 */
import { BLOCK_OF, BLOCKS, FLAGS, F_FULL_CUBE_COLLISION, F_SOLID, OPAQUE, SHAPE, SHAPE_IDS, STATE_PROPS } from './registry';
import type { ShapeKind } from './types';

export type Box = [number, number, number, number, number, number];
export type BlockGetter = (x: number, y: number, z: number) => number;

const SHAPE_NAME: ShapeKind[] = [];
for (const k in SHAPE_IDS) SHAPE_NAME[SHAPE_IDS[k as ShapeKind]] = k as ShapeKind;
const px = (v: number) => v / 16;
const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box => [px(x0), px(y0), px(z0), px(x1), px(y1), px(z1)];
const FULL: Box = [0, 0, 0, 1, 1, 1];
const P = (s: number) => STATE_PROPS[s];
const shapeOf = (s: number) => SHAPE_NAME[SHAPE[s]];
const nameOf = (s: number) => BLOCKS[BLOCK_OF[s]].name;

/** gira uma caixa (em referencial "norte") em torno do eixo Y pelo facing */
function rotY(b: Box, facing: string): Box {
  const [x0, y0, z0, x1, y1, z1] = b;
  switch (facing) {
    case 'east': return [1 - z1, y0, x0, 1 - z0, y1, x1];
    case 'south': return [1 - x1, y0, 1 - z1, 1 - x0, y1, 1 - z0];
    case 'west': return [z0, y0, 1 - x1, z1, y1, 1 - x0];
    default: return b;
  }
}

const DOOR_BOX: Record<string, Box> = {
  north: B(0, 0, 13, 16, 16, 16), south: B(0, 0, 0, 16, 16, 3), west: B(13, 0, 0, 16, 16, 16), east: B(0, 0, 0, 3, 16, 16),
};
const DIRV: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const H4 = ['north', 'south', 'west', 'east'];

function doorPanel(facing: string, open: boolean, hinge: string): string {
  if (!open) return facing;
  const map: Record<string, [string, string]> = { east: ['north', 'south'], south: ['east', 'west'], west: ['south', 'north'], north: ['west', 'east'] };
  return hinge === 'right' ? map[facing][0] : map[facing][1];
}

function fenceConnects(s: number, n: number, dir: string): boolean {
  const sh = shapeOf(n);
  if (sh === 'fence') return nameOf(s).startsWith('infero') === nameOf(n).startsWith('infero');
  if (sh === 'fencegate') {
    const f = P(n).facing as string;
    return (f === 'north' || f === 'south') ? (dir === 'west' || dir === 'east') : (dir === 'north' || dir === 'south');
  }
  return OPAQUE[n] === 1 && sh === 'cube';
}

function paneConnects(n: number): boolean {
  const sh = shapeOf(n);
  return sh === 'pane' || sh === 'wall' || (OPAQUE[n] === 1 && sh === 'cube');
}

/**
 * Caixas de colisão do bloco em (x,y,z). `get` lê vizinhos (para cercas, escadas, painéis).
 * `forOutline` devolve a forma de seleção (plantas e tochas têm contorno mas não colidem).
 */
export function blockBoxes(state: number, x: number, y: number, z: number, get: BlockGetter, forOutline = false, out: Box[] = []): Box[] {
  out.length = 0;
  if (state === 0) return out;
  const fl = FLAGS[state];
  if (!forOutline && !(fl & F_SOLID)) return out;
  if (fl & F_FULL_CUBE_COLLISION) { out.push(FULL); return out; }
  const p = P(state);
  const sh = shapeOf(state);
  switch (sh) {
    case 'cube': out.push(FULL); break;
    case 'slab':
      out.push(p.type === 'top' ? B(0, 8, 0, 16, 16, 16) : p.type === 'double' ? FULL : B(0, 0, 0, 16, 8, 16));
      break;
    case 'stairs': {
      const top = p.half === 'top';
      out.push(top ? B(0, 8, 0, 16, 16, 16) : B(0, 0, 0, 16, 8, 16));
      const y0 = top ? 0 : 8, y1 = top ? 8 : 16;
      const shape = stairShapeAt(state, x, y, z, get);
      const f = p.facing as string;
      const q: Box[] = [];
      if (shape === 'outer_left') q.push(B(0, y0, 0, 8, y1, 8));
      else if (shape === 'outer_right') q.push(B(8, y0, 0, 16, y1, 8));
      else if (shape === 'inner_left') q.push(B(0, y0, 0, 16, y1, 8), B(0, y0, 8, 8, y1, 16));
      else if (shape === 'inner_right') q.push(B(0, y0, 0, 16, y1, 8), B(8, y0, 8, 16, y1, 16));
      else q.push(B(0, y0, 0, 16, y1, 8));
      for (const b of q) out.push(rotY(b, f));
      break;
    }
    case 'fence': {
      const h = forOutline ? 16 : 24;
      out.push(B(6, 0, 6, 10, h, 10));
      for (const d of H4) {
        const [dx, dz] = DIRV[d];
        if (!fenceConnects(state, get(x + dx, y, z + dz), d)) continue;
        out.push(rotY(B(6, 0, 0, 10, h, 6), d));
      }
      break;
    }
    case 'wall': {
      const h = forOutline ? 16 : 24;
      out.push(B(4, 0, 4, 12, h, 12));
      for (const d of H4) {
        const [dx, dz] = DIRV[d];
        const n = get(x + dx, y, z + dz);
        if (!(shapeOf(n) === 'wall' || paneConnects(n) || shapeOf(n) === 'fencegate')) continue;
        out.push(rotY(B(5, 0, 0, 11, h, 4), d));
      }
      break;
    }
    case 'pane': case 'bars': {
      out.push(B(7, 0, 7, 9, 16, 9));
      for (const d of H4) {
        const [dx, dz] = DIRV[d];
        if (!paneConnects(get(x + dx, y, z + dz))) continue;
        out.push(rotY(B(7, 0, 0, 9, 16, 7), d));
      }
      break;
    }
    case 'fencegate': {
      if (p.open && !forOutline) break;
      const f = p.facing as string;
      const h = forOutline ? 16 : 24;
      out.push(f === 'north' || f === 'south' ? B(0, 0, 6, 16, h, 10) : B(6, 0, 0, 10, h, 16));
      break;
    }
    case 'door': out.push(DOOR_BOX[doorPanel(p.facing as string, p.open as boolean, p.hinge as string)]); break;
    case 'trapdoor':
      if (!p.open) out.push(p.half === 'top' ? B(0, 13, 0, 16, 16, 16) : B(0, 0, 0, 16, 3, 16));
      else out.push(DOOR_BOX[p.facing as string]);
      break;
    case 'carpet': out.push(B(0, 0, 0, 16, 1, 16)); break;
    case 'snowlayer': {
      const l = p.layers as number;
      const h = forOutline ? l * 2 : (l - 1) * 2;
      if (h > 0) out.push(B(0, 0, 0, 16, h, 16));
      break;
    }
    case 'farmland': case 'path': out.push(B(0, 0, 0, 16, 15, 16)); break;
    case 'cactus': out.push(forOutline ? FULL : B(1, 0, 1, 15, 15, 15)); break;
    case 'bed': out.push(B(0, 0, 0, 16, 9, 16)); break;
    case 'chest': out.push(B(1, 0, 1, 15, 14, 15)); break;
    case 'cake': out.push(B(1 + ((p.bites as number) ?? 0) * 2, 0, 1, 15, 8, 15)); break;
    case 'lilypad': out.push(B(1, 0, 1, 15, 1.5, 15)); break;
    case 'enchanting': out.push(B(0, 0, 0, 16, 12, 16)); break;
    case 'daylight': out.push(B(0, 0, 0, 16, 6, 16)); break;
    case 'repeater': case 'comparator': out.push(B(0, 0, 0, 16, 2, 16)); break;
    case 'plate': out.push(B(1, 0, 1, 15, 1, 15)); break;
    case 'anvil': out.push(p.facing === 'north' || p.facing === 'south' ? B(0, 0, 2, 16, 16, 14) : B(2, 0, 0, 14, 16, 16)); break;
    case 'lantern': out.push(p.hanging ? B(5, 1, 5, 11, 10, 11) : B(5, 0, 5, 11, 9, 11)); break;
    case 'chain': out.push(p.axis === 'y' ? B(6.5, 0, 6.5, 9.5, 16, 9.5) : p.axis === 'x' ? B(0, 6.5, 6.5, 16, 9.5, 9.5) : B(6.5, 6.5, 0, 9.5, 9.5, 16)); break;
    case 'cauldron': case 'composter': case 'lectern': case 'brewing': case 'grindstone': case 'stonecutter': case 'bell': case 'campfire': case 'scaffold':
      out.push(sh === 'stonecutter' ? B(0, 0, 0, 16, 9, 16) : sh === 'campfire' ? B(0, 0, 0, 16, 7, 16) : sh === 'brewing' ? B(1, 0, 1, 15, 14, 15) : FULL);
      break;
    case 'flowerpot': out.push(B(5, 0, 5, 11, 6, 11)); break;
    case 'piston': {
      if (p.extended) {
        const f = p.facing as string;
        const m: Record<string, Box> = {
          up: B(0, 0, 0, 16, 12, 16), down: B(0, 4, 0, 16, 16, 16), north: B(0, 0, 4, 16, 16, 16),
          south: B(0, 0, 0, 16, 16, 12), west: B(4, 0, 0, 16, 16, 16), east: B(0, 0, 0, 12, 16, 16),
        };
        out.push(m[f]);
      } else out.push(FULL);
      break;
    }
    case 'pistonhead': {
      const f = p.facing as string;
      const m: Record<string, Box> = {
        up: B(0, 12, 0, 16, 16, 16), down: B(0, 0, 0, 16, 4, 16), north: B(0, 0, 0, 16, 16, 4),
        south: B(0, 0, 12, 16, 16, 16), west: B(0, 0, 0, 4, 16, 16), east: B(12, 0, 0, 16, 16, 16),
      };
      out.push(m[f]);
      break;
    }
    // formas sem colisão mas com contorno
    case 'torch': out.push(B(6, 0, 6, 10, 10, 10)); break;
    case 'walltorch': out.push(rotY(B(5.5, 3, 11, 10.5, 13, 16), p.facing as string)); break;
    case 'ladder': out.push(DOOR_BOX[p.facing as string]); break;
    case 'vine': {
      const e = 1;
      if (p.north) out.push(B(0, 0, 0, 16, 16, e));
      if (p.south) out.push(B(0, 0, 16 - e, 16, 16, 16));
      if (p.west) out.push(B(0, 0, 0, e, 16, 16));
      if (p.east) out.push(B(16 - e, 0, 0, 16, 16, 16));
      if (p.up) out.push(B(0, 16 - e, 0, 16, 16, 16));
      if (!out.length) out.push(B(0, 0, 0, 16, 16, 1));
      break;
    }
    case 'dust': out.push(B(0, 0, 0, 16, 1, 16)); break;
    case 'rail': out.push(String(p.shape).startsWith('ascending') ? B(0, 0, 0, 16, 8, 16) : B(0, 0, 0, 16, 2, 16)); break;
    case 'lever': case 'button': {
      const face = p.face as string;
      const f = p.facing as string;
      const small = sh === 'button' ? (p.powered ? B(5, 0, 6, 11, 1, 10) : B(5, 0, 6, 11, 2, 10)) : B(4, 0, 4, 12, 6, 12);
      if (face === 'floor') out.push(rotY(small, f));
      else if (face === 'ceiling') out.push(rotY([small[0], 1 - small[4], small[2], small[3], 1 - small[1], small[5]], f));
      else {
        // na parede: encostado no lado oposto ao facing
        const d = sh === 'button' ? (p.powered ? 1 : 2) / 16 : 6 / 16;
        const bb: Box = sh === 'button' ? [5 / 16, 6 / 16, 1 - d, 11 / 16, 10 / 16, 1] : [5 / 16, 3 / 16, 1 - d, 11 / 16, 13 / 16, 1];
        out.push(rotY(bb, f));
      }
      break;
    }
    case 'sign': out.push(B(4, 0, 4, 12, 16, 12)); break;
    case 'wallsign': out.push(rotY(B(0, 4.5, 14, 16, 12.5, 16), p.facing as string)); break;
    case 'cross': case 'sapling': case 'mushroom': case 'bush': case 'doubleplant': case 'kelp': case 'cobweb': case 'crop': case 'stem':
      out.push(sh === 'crop' ? B(0, 0, 0, 16, 2 + ((p.age as number) ?? 0) * 2, 16) : sh === 'mushroom' ? B(5, 0, 5, 11, 6, 11) : B(2, 0, 2, 14, 13, 14));
      break;
    case 'fire': case 'portal': out.push(sh === 'portal' ? (p.axis === 'x' ? B(0, 0, 6, 16, 16, 10) : B(6, 0, 0, 10, 16, 16)) : B(0, 0, 0, 16, 1, 16)); break;
    case 'fluid': out.push(FULL); break;
    case 'none': break;
    default: out.push(FULL);
  }
  return out;
}

const isStairs = (s: number) => shapeOf(s) === 'stairs';
const CCW: Record<string, string> = { north: 'west', west: 'south', south: 'east', east: 'north' };
const OPP: Record<string, string> = { north: 'south', south: 'north', west: 'east', east: 'west' };

export function stairShapeAt(s: number, x: number, y: number, z: number, get: BlockGetter): string {
  const p = P(s);
  const f = p.facing as string, half = p.half;
  const [fx, fz] = DIRV[f];
  const behind = get(x + fx, y, z + fz);
  const canTake = (face: string): boolean => {
    const [ox, oz] = DIRV[face];
    const n = get(x + ox, y, z + oz);
    return !(isStairs(n) && P(n).facing === f && P(n).half === half);
  };
  if (isStairs(behind) && P(behind).half === half) {
    const bf = P(behind).facing as string;
    if ((bf === 'north' || bf === 'south') !== (f === 'north' || f === 'south') && canTake(OPP[bf])) return bf === CCW[f] ? 'outer_left' : 'outer_right';
  }
  const front = get(x - fx, y, z - fz);
  if (isStairs(front) && P(front).half === half) {
    const ff = P(front).facing as string;
    if ((ff === 'north' || ff === 'south') !== (f === 'north' || f === 'south') && canTake(ff)) return ff === CCW[f] ? 'inner_left' : 'inner_right';
  }
  return 'straight';
}

/** Altura do topo da colisão (para "degraus" e superfícies de apoio). */
export function collisionTop(state: number, x: number, y: number, z: number, get: BlockGetter): number {
  const boxes = blockBoxes(state, x, y, z, get);
  let top = 0;
  for (const b of boxes) top = Math.max(top, b[4]);
  return top;
}
