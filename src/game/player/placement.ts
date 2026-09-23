/**
 * Estado do bloco ao ser colocado (getStateForPlacement do original): eixo de troncos, metade de escadas
 * e lajes, tochas de parede, portas e camas (duas partes), orientação de fornalhas, pistões, observadores...
 */
import { BLOCKS, block, BLOCK_OF, FLAGS, F_REPLACEABLE, F_WATER, F_WATERLOGGED, STATE_PROPS, S, hasProp, withProp, SHAPE, SHAPE_IDS, getProp } from '../../world/blocks';
import type { World } from '../../world/world';
import { canSurvive } from '../../world/logic/support';

export interface PlaceContext {
  world: World;
  x: number; y: number; z: number; // posição onde vai ficar
  face: number; // face clicada (0 baixo … 5 leste)
  hitX: number; hitY: number; hitZ: number; // fração dentro do bloco clicado (0..1)
  yaw: number; pitch: number; // do jogador (graus, convenção do original)
  sneaking: boolean;
  replacing: number; // estado atual na posição
}

export interface Placement { states: [number, number, number, number][] } // [x,y,z,state]

const FACE_NAME = ['down', 'up', 'north', 'south', 'west', 'east'];
const OPP: Record<string, string> = { north: 'south', south: 'north', west: 'east', east: 'west', up: 'down', down: 'up' };

/** Direção horizontal para onde o jogador olha. */
export function horizontalFacing(yaw: number): string {
  const i = Math.floor(((yaw % 360) + 360 + 45) / 90) & 3;
  return ['south', 'west', 'north', 'east'][i];
}

/** Direção (6) mais próxima do olhar. */
export function lookingDirection(yaw: number, pitch: number): string {
  if (pitch > 45) return 'down';
  if (pitch < -45) return 'up';
  return horizontalFacing(yaw);
}

const DIRV: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const shapeOf = (s: number) => SHAPE[s];

export function placementFor(name: string, ctx: PlaceContext): Placement | null {
  const bt = block(name);
  let st = bt.defaultState;
  const face = FACE_NAME[ctx.face];
  const get = (a: number, b: number, c: number) => ctx.world.getBlock(a, b, c);
  const upperHalf = ctx.face === 0 || (ctx.face !== 1 && ctx.hitY > 0.5);
  const hf = horizontalFacing(ctx.yaw);
  const set = (k: string, v: string | number | boolean) => { st = withProp(st, k, v); };
  const sh = bt.shape;
  const out: [number, number, number, number][] = [];

  // tochas: chão ou parede
  if (sh === 'torch') {
    if (face === 'up' || face === 'down') {
      if (face === 'down') return tryWallOrFloor(name, ctx);
      return one(ctx, st);
    }
    const wall = name === 'torch' ? 'wall_torch' : name === 'soul_torch' ? 'soul_wall_torch' : 'fulgor_wall_torch';
    return one(ctx, S(wall, { facing: face }));
  }
  if (sh === 'sign') {
    if (face !== 'up' && face !== 'down') return one(ctx, S(name.replace('_sign', '_wall_sign'), { facing: face }));
    const rot = Math.floor(((ctx.yaw + 180) * 16) / 360 + 0.5) & 15;
    return one(ctx, withProp(st, 'rotation', rot));
  }
  switch (sh) {
    case 'stairs': set('facing', hf); set('half', upperHalf ? 'top' : 'bottom'); break;
    case 'slab': {
      const cur = ctx.replacing;
      if (BLOCK_OF[cur] === bt.id && getProp(cur, 'type') !== 'double') return one(ctx, withProp(cur, 'type', 'double'));
      set('type', upperHalf ? 'top' : 'bottom');
      break;
    }
    case 'ladder': case 'wallsign': case 'walltorch':
      if (face === 'up' || face === 'down') return null;
      set('facing', face);
      break;
    case 'lever': case 'button':
      if (face === 'up') { set('face', 'floor'); set('facing', hf); } else if (face === 'down') { set('face', 'ceiling'); set('facing', hf); } else { set('face', 'wall'); set('facing', face); }
      break;
    case 'door': {
      const up = ctx.y + 1;
      const above = get(ctx.x, up, ctx.z);
      if (!(above === 0 || FLAGS[above] & F_REPLACEABLE)) return null;
      set('facing', hf);
      // dobradiça: se já existe porta à esquerda, abre para o outro lado
      const left = { north: 'west', south: 'east', west: 'south', east: 'north' }[hf]!;
      const [lx, lz] = DIRV[left];
      const ln = get(ctx.x + lx, ctx.y, ctx.z + lz);
      let hinge = 'left';
      if (shapeOf(ln) === SHAPE_IDS.door && STATE_PROPS[ln].hinge === 'left') hinge = 'right';
      set('hinge', hinge);
      const lower = withProp(st, 'half', 'lower');
      const upper = withProp(st, 'half', 'upper');
      if (!canSurvive(lower, ctx.x, ctx.y, ctx.z, get)) return null;
      out.push([ctx.x, ctx.y, ctx.z, lower], [ctx.x, up, ctx.z, upper]);
      return { states: out };
    }
    case 'doubleplant': {
      const up = ctx.y + 1;
      const above = get(ctx.x, up, ctx.z);
      if (!(above === 0 || FLAGS[above] & F_REPLACEABLE)) return null;
      const lower = withProp(st, 'half', 'lower');
      if (!canSurvive(lower, ctx.x, ctx.y, ctx.z, get)) return null;
      out.push([ctx.x, ctx.y, ctx.z, lower], [ctx.x, up, ctx.z, withProp(st, 'half', 'upper')]);
      return { states: out };
    }
    case 'bed': {
      const [dx, dz] = DIRV[hf];
      const hx = ctx.x + dx, hz = ctx.z + dz;
      const other = get(hx, ctx.y, hz);
      if (!(other === 0 || FLAGS[other] & F_REPLACEABLE)) return null;
      const foot = S(name, { facing: hf, part: 'foot' }), head = S(name, { facing: hf, part: 'head' });
      out.push([ctx.x, ctx.y, ctx.z, foot], [hx, ctx.y, hz, head]);
      return { states: out };
    }
    case 'fencegate': set('facing', hf); break;
    case 'trapdoor':
      if (face === 'up' || face === 'down') { set('facing', OPP[hf]); set('half', face === 'down' ? 'top' : 'bottom'); } else { set('facing', face); set('half', upperHalf ? 'top' : 'bottom'); }
      break;
    case 'repeater': case 'comparator': set('facing', OPP[hf]); break;
    case 'bed' as never: break;
    case 'chest': {
      set('facing', OPP[hf]);
      // baú duplo: junta com baú vizinho de mesma direção (lado esquerdo/direito)
      if (!ctx.sneaking) {
        const f = OPP[hf];
        const right = { north: 'east', south: 'west', west: 'north', east: 'south' }[f]!;
        const left = OPP[right];
        for (const [side, type, otherType] of [[left, 'right', 'left'], [right, 'left', 'right']] as const) {
          const [ox, oz] = DIRV[side];
          const n = get(ctx.x + ox, ctx.y, ctx.z + oz);
          if (BLOCK_OF[n] === bt.id && STATE_PROPS[n].facing === f && STATE_PROPS[n].type === 'single') {
            set('type', type);
            out.push([ctx.x + ox, ctx.y, ctx.z + oz, withProp(n, 'type', otherType)]);
            break;
          }
        }
      }
      out.unshift([ctx.x, ctx.y, ctx.z, st]);
      return { states: out };
    }
    case 'piston': set('facing', OPP[lookingDirection(ctx.yaw, ctx.pitch)]); break;
    case 'lectern': case 'anvil': case 'grindstone': case 'stonecutter': case 'bell': case 'campfire':
      if (hasProp(st, 'facing')) set('facing', sh === 'anvil' ? { north: 'east', south: 'west', west: 'north', east: 'south' }[hf]! : OPP[hf]);
      break;
    case 'vine': {
      if (face === 'up' || face === 'down') { if (face === 'down') set('up', true); else return null; } else set(OPP[face], true);
      break;
    }
    case 'lantern': set('hanging', face === 'down'); break;
    case 'snowlayer': {
      const cur = ctx.replacing;
      if (BLOCK_OF[cur] === bt.id) {
        const l = STATE_PROPS[cur].layers as number;
        if (l < 8) return one(ctx, withProp(cur, 'layers', l + 1));
      }
      break;
    }
    default: break;
  }
  // propriedades genéricas por nome
  const def = BLOCKS[bt.id].def;
  if (hasProp(st, 'axis') && sh !== 'chain' && sh !== 'portal') {
    set('axis', face === 'up' || face === 'down' ? 'y' : face === 'north' || face === 'south' ? 'z' : 'x');
  }
  if (sh === 'chain') set('axis', face === 'up' || face === 'down' ? 'y' : face === 'north' || face === 'south' ? 'z' : 'x');
  if (hasProp(st, 'facing') && (sh === 'cube')) {
    const six = (def.props ?? []).find((p) => p.name === 'facing')!.values.length === 6;
    if (name === 'observer') set('facing', lookingDirection(ctx.yaw, ctx.pitch));
    else if (six) set('facing', OPP[lookingDirection(ctx.yaw, ctx.pitch)]);
    else set('facing', OPP[hf]);
  }
  if (hasProp(st, 'persistent')) set('persistent', true);
  if (name === 'barrel') set('facing', OPP[lookingDirection(ctx.yaw, ctx.pitch)]);
  if (!canSurvive(st, ctx.x, ctx.y, ctx.z, get)) return null;
  // plantas aquáticas e vitória-régia
  const curFl = FLAGS[ctx.replacing];
  if ((name === 'kelp' || name === 'seagrass') && !(curFl & (F_WATER | F_WATERLOGGED))) return null;
  return one(ctx, st);
}

function one(ctx: PlaceContext, st: number): Placement {
  return { states: [[ctx.x, ctx.y, ctx.z, st]] };
}

function tryWallOrFloor(name: string, ctx: PlaceContext): Placement | null {
  // clicou embaixo de um bloco: tenta uma parede próxima (como o original faz com tochas)
  const get = (a: number, b: number, c: number) => ctx.world.getBlock(a, b, c);
  const wall = name === 'torch' ? 'wall_torch' : name === 'soul_torch' ? 'soul_wall_torch' : 'fulgor_wall_torch';
  for (const f of ['north', 'south', 'west', 'east']) {
    const st = S(wall, { facing: f });
    if (canSurvive(st, ctx.x, ctx.y, ctx.z, get)) return one(ctx, st);
  }
  const floor = S(name);
  return canSurvive(floor, ctx.x, ctx.y, ctx.z, get) ? one(ctx, floor) : null;
}
