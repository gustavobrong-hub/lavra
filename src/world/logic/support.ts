/**
 * "canSurvive": se um bloco consegue ficar onde está (plantas precisam de solo, tochas de parede,
 * trilhos de chão firme, portas de base…). Usado ao colocar e quando um vizinho muda.
 */
import { BLOCKS, BLOCK_OF, FLAGS, F_WATER, F_WATERLOGGED, OCCLUDES, OPAQUE, SHAPE, SHAPE_IDS, STATE_PROPS, FLUID_LEVEL, F_SOLID } from '../blocks/registry';
import type { ShapeKind } from '../blocks/types';

export type Getter = (x: number, y: number, z: number) => number;

const SHAPE_NAME: ShapeKind[] = [];
for (const k in SHAPE_IDS) SHAPE_NAME[SHAPE_IDS[k as ShapeKind]] = k as ShapeKind;
const nameOf = (s: number) => BLOCKS[BLOCK_OF[s]].name;
const shapeOf = (s: number) => SHAPE_NAME[SHAPE[s]];
const DIRV: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const FACE_BIT: Record<string, number> = { down: 1, up: 2, north: 4, south: 8, west: 16, east: 32 };

const SOIL = new Set(['grass_block', 'dirt', 'coarse_dirt', 'podzol', 'rooted_dirt', 'moss_block', 'farmland', 'mud', 'lume_moss', 'mycelium']);
const SAND = new Set(['sand', 'red_sand']);

/** Topo firme (suporta tocha, trilho, pó de fulgor…). */
export function sturdyTop(s: number): boolean {
  if (OPAQUE[s]) return true;
  if (OCCLUDES[s] & FACE_BIT.up) return true;
  const sh = shapeOf(s);
  return sh === 'slab' && STATE_PROPS[s].type !== 'bottom';
}

/** Face lateral firme para prender tocha/escada/alavanca na direção `face` do bloco. */
export function sturdySide(s: number, face: string): boolean {
  if (OPAQUE[s]) return true;
  return (OCCLUDES[s] & FACE_BIT[face]) !== 0;
}

/** Suporte "central" (tocha em cima de cerca, muro, vidro). */
function centerSupport(s: number): boolean {
  if (sturdyTop(s)) return true;
  const sh = shapeOf(s);
  return sh === 'fence' || sh === 'wall' || sh === 'pane' || nameOf(s) === 'glass' || nameOf(s).endsWith('_stained_glass') || sh === 'scaffold';
}

export function canSurvive(state: number, x: number, y: number, z: number, get: Getter): boolean {
  if (state === 0) return true;
  const name = nameOf(state);
  const sh = shapeOf(state);
  const p = STATE_PROPS[state] ?? {};
  const below = () => get(x, y - 1, z);
  const belowName = () => nameOf(below());
  switch (sh) {
    case 'cross': case 'sapling': case 'bush': {
      const b = belowName();
      if (name === 'dead_bush') return SAND.has(b) || b.endsWith('terracotta') || SOIL.has(b);
      if (name === 'ember_fungus' || name === 'ember_roots') return b === 'brasalito' || b.endsWith('nylium') || b === 'lament_soil';
      if (name === 'lume_bloom') return SOIL.has(b);
      if (name === 'sugar_cane') return sugarCaneOk(x, y, z, get);
      if (name === 'crystal' || name === 'ember_crystal') return true;
      if (name === 'cobweb') return true;
      return SOIL.has(b);
    }
    case 'mushroom': return OPAQUE[below()] === 1;
    case 'doubleplant': {
      if (p.half === 'upper') {
        const b = below();
        return BLOCK_OF[b] === BLOCK_OF[state] && STATE_PROPS[b].half === 'lower';
      }
      return SOIL.has(belowName());
    }
    case 'kelp': {
      const b = below();
      if (name === 'tall_seagrass' && p.half === 'upper') return BLOCK_OF[b] === BLOCK_OF[state];
      if (name === 'kelp' || name === 'kelp_plant') return OPAQUE[b] === 1 || nameOf(b) === 'kelp_plant' || nameOf(b) === 'kelp';
      return OPAQUE[b] === 1;
    }
    case 'crop': {
      const b = belowName();
      if (name === 'ember_wart') return b === 'lament_sand';
      return b === 'farmland';
    }
    case 'stem': return belowName() === 'farmland';
    case 'cactus': {
      const b = belowName();
      if (!(b === 'cactus' || SAND.has(b))) return false;
      for (const [dx, dz] of Object.values(DIRV)) {
        const n = get(x + dx, y, z + dz);
        if (FLAGS[n] & F_SOLID || nameOf(n) === 'lava') return false;
      }
      return true;
    }
    case 'torch': return centerSupport(below());
    case 'walltorch': case 'ladder': case 'wallsign': {
      const f = p.facing as string;
      const [dx, dz] = DIRV[f];
      const opp = f === 'north' ? 'south' : f === 'south' ? 'north' : f === 'west' ? 'east' : 'west';
      return sturdySide(get(x - dx, y, z - dz), f) || (sh === 'wallsign' && (FLAGS[get(x - dx, y, z - dz)] & F_SOLID) !== 0) || (void opp, false);
    }
    case 'lever': case 'button': {
      const face = p.face as string;
      if (face === 'floor') return sturdyTop(below());
      if (face === 'ceiling') return sturdySide(get(x, y + 1, z), 'down');
      const f = p.facing as string;
      const [dx, dz] = DIRV[f];
      return sturdySide(get(x - dx, y, z - dz), f);
    }
    case 'rail': case 'dust': case 'repeater': case 'comparator': case 'plate': case 'carpet': return sh === 'carpet' ? below() !== 0 : sturdyTop(below()) || (sh === 'plate' && centerSupport(below()));
    case 'door': {
      if (p.half === 'upper') {
        const b = below();
        return BLOCK_OF[b] === BLOCK_OF[state] && STATE_PROPS[b].half === 'lower';
      }
      return sturdyTop(below());
    }
    case 'snowlayer': {
      const b = below();
      const bn = nameOf(b);
      if (bn === 'ice' || bn === 'packed_ice' || bn === 'blue_ice') return false;
      return OPAQUE[b] === 1 || (FLAGS[b] & 4096) !== 0 || (bn === 'snow' && STATE_PROPS[b].layers === 8);
    }
    case 'lilypad': {
      const b = below();
      return (FLAGS[b] & (F_WATER | F_WATERLOGGED)) !== 0 && (FLUID_LEVEL[b] === 0 || (FLAGS[b] & F_WATERLOGGED) !== 0) || nameOf(b) === 'ice';
    }
    case 'vine': {
      const sides: [string, number, number, number][] = [['north', 0, 0, -1], ['south', 0, 0, 1], ['west', -1, 0, 0], ['east', 1, 0, 0], ['up', 0, 1, 0]];
      let any = false;
      for (const [k, dx, dy, dz] of sides) {
        if (!p[k]) continue;
        const n = get(x + dx, y + dy, z + dz);
        if (OPAQUE[n] || (FLAGS[n] & 4096)) any = true;
        else if (k !== 'up' && shapeOf(get(x, y + 1, z)) === 'vine' && STATE_PROPS[get(x, y + 1, z)][k]) any = true;
      }
      return any;
    }
    case 'lantern': return p.hanging ? (sturdySide(get(x, y + 1, z), 'down') || shapeOf(get(x, y + 1, z)) === 'chain' || shapeOf(get(x, y + 1, z)) === 'fence') : centerSupport(below());
    case 'cake': return FLAGS[below()] & F_SOLID ? true : false;
    case 'fire': return true;
    default: return true;
  }
}

function sugarCaneOk(x: number, y: number, z: number, get: Getter): boolean {
  const b = get(x, y - 1, z);
  const bn = nameOf(b);
  if (bn === 'sugar_cane') return true;
  if (!(SOIL.has(bn) || SAND.has(bn))) return false;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = get(x + dx, y - 1, z + dz);
    if (FLAGS[n] & (F_WATER | F_WATERLOGGED) || nameOf(n) === 'ice') return true;
  }
  return false;
}
