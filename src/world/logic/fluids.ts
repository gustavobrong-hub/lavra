/**
 * Líquidos com as regras do FlowingFluid do original: água a cada 5 ticks (perde 1 nível por bloco,
 * alcança 7), lava a cada 30 ticks no mundo normal (perde 2, alcança 3) e 10 no Ínfero (perde 1);
 * procura o declive mais próximo (4 blocos para água, 2 para lava) e escorre para lá; fontes infinitas
 * de água (2 fontes vizinhas sobre chão firme ou fonte); lava + água → obsidiana (fonte) ou pedregulho;
 * lava caindo na água → pedra. Estados: nível 0 = fonte, 1–7 = corrente, 8+ = caindo.
 */
import type { Level } from '../../game/level';
import { BLOCKS, BLOCK_OF, FLAGS, F_SOLID, F_WATER, F_LAVA, F_WATERLOGGED, F_REPLACEABLE, F_FLUID, STATE_PROPS, S, withProp, SHAPE, SHAPE_IDS } from '../blocks';
import { DIM_INFERO } from '../../core/constants';

type Kind = 'water' | 'lava';
const HORIZ: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

let WATER = -1, LAVA = -1;
const waterState = (level: number) => (WATER < 0 ? (WATER = S('water')) : 0, withProp(WATER, 'level', level));
const lavaState = (level: number) => (LAVA < 0 ? (LAVA = S('lava')) : 0, withProp(LAVA, 'level', level));

function kindOf(s: number): Kind | null {
  const f = FLAGS[s];
  if (f & F_LAVA) return 'lava';
  if (f & (F_WATER | F_WATERLOGGED)) return 'water';
  return null;
}
/** Quantidade 1..8 (8 = fonte ou caindo); 0 = não é deste líquido. */
function amountOf(s: number, k: Kind): number {
  if (kindOf(s) !== k) return 0;
  if (FLAGS[s] & F_WATERLOGGED) return 8;
  const lv = STATE_PROPS[s].level as number;
  if (lv === 0 || lv >= 8) return 8;
  return 8 - lv;
}
const isSource = (s: number, k: Kind) => kindOf(s) === k && (FLAGS[s] & F_WATERLOGGED ? true : (STATE_PROPS[s].level as number) === 0);
const isFalling = (s: number) => (FLAGS[s] & F_FLUID) !== 0 && (STATE_PROPS[s].level as number) >= 8;

interface Rules { tickDelay: number; drop: number; slope: number; infinite: boolean }
function rules(level: Level, k: Kind): Rules {
  if (k === 'water') return { tickDelay: 5, drop: 1, slope: 4, infinite: true };
  const hot = level.world.dim === DIM_INFERO;
  return { tickDelay: hot ? 10 : 30, drop: hot ? 1 : 2, slope: hot ? 4 : 2, infinite: false };
}

/** O líquido pode ocupar esta célula (ar, plantas, líquido do mesmo tipo mais baixo)? */
function canHold(s: number, k: Kind): boolean {
  if (s === 0) return true;
  const f = FLAGS[s];
  if (f & F_FLUID) return kindOf(s) === k || kindOf(s) !== null;
  if (f & F_WATERLOGGED) return false;
  if (SHAPE[s] === SHAPE_IDS.door || BLOCKS[BLOCK_OF[s]].name.endsWith('_sign')) return false;
  if (f & F_SOLID) return false;
  return (f & F_REPLACEABLE) !== 0 || !(f & F_SOLID);
}

/** Estado que o líquido "deveria" ter em (x,y,z) pelas vizinhas (getNewLiquid). */
function newLiquid(L: Level, x: number, y: number, z: number, k: Kind, r: Rules): number {
  let maxAmt = 0, sources = 0;
  for (const [dx, dz] of HORIZ) {
    const n = L.getBlock(x + dx, y, z + dz);
    if (kindOf(n) !== k) continue;
    if (isSource(n, k)) sources++;
    maxAmt = Math.max(maxAmt, amountOf(n, k));
  }
  if (r.infinite && sources >= 2) {
    const below = L.getBlock(x, y - 1, z);
    if (FLAGS[below] & F_SOLID || isSource(below, k)) return k === 'water' ? waterState(0) : lavaState(0);
  }
  const above = L.getBlock(x, y + 1, z);
  if (kindOf(above) === k) return k === 'water' ? waterState(8) : lavaState(8);
  const amt = maxAmt - r.drop;
  if (amt <= 0) return 0;
  return k === 'water' ? waterState(8 - amt) : lavaState(8 - amt);
}

/** Distância até um buraco (bloco abaixo que aceita o líquido), por direção (getSpread/getSlopeDistance). */
function slopeDistance(L: Level, x: number, y: number, z: number, from: number, dist: number, k: Kind, r: Rules, seen: Set<string>): number {
  let best = 1000;
  for (let i = 0; i < 4; i++) {
    if (i === from) continue;
    const [dx, dz] = HORIZ[i];
    const nx = x + dx, nz = z + dz;
    const key = `${nx},${nz}`;
    if (seen.has(key)) continue;
    const n = L.getBlock(nx, y, nz);
    if (!canHold(n, k) || isSource(n, k)) continue;
    if (canHold(L.getBlock(nx, y - 1, nz), k)) return dist;
    if (dist < r.slope) {
      seen.add(key);
      const d = slopeDistance(L, nx, y, nz, i ^ 1, dist + 1, k, r, seen);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Coloca líquido numa célula, tratando lava + água e quebrando plantas (spreadTo). */
function spreadTo(L: Level, x: number, y: number, z: number, state: number, k: Kind, down: boolean): void {
  const cur = L.getBlock(x, y, z);
  const ck = kindOf(cur);
  if (k === 'lava' && ck === 'water' && !(FLAGS[cur] & F_WATERLOGGED)) {
    if (down) { L.setBlock(x, y, z, S('stone')); L.emit('fizz', { x, y, z }); return; }
  }
  if (ck && ck !== k) return;
  if (cur !== 0 && !(FLAGS[cur] & F_FLUID)) {
    // plantas e afins são levadas pela água (com saque)
    if (k === 'lava') { L.setBlock(x, y, z, 0); L.emit('fizz', { x, y, z }); }
    else L.breakBlock(x, y, z, { drop: true, silent: true });
  }
  L.setBlock(x, y, z, state);
}

/** A lava que toca água vira obsidiana (fonte) ou pedregulho (shouldSpreadLiquid). */
function lavaMeetsWater(L: Level, x: number, y: number, z: number, s: number): boolean {
  for (const [dx, dy, dz] of [[0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]]) {
    const n = L.getBlock(x + dx, y + dy, z + dz);
    if (kindOf(n) === 'water') {
      L.setBlock(x, y, z, isSource(s, 'lava') ? S('obsidian') : S('cobblestone'));
      L.emit('fizz', { x, y, z });
      return true;
    }
  }
  return false;
}

function tick(L: Level, x: number, y: number, z: number, state: number): void {
  const k = kindOf(state);
  if (!k) return;
  const r = rules(L, k);
  if (k === 'lava' && lavaMeetsWater(L, x, y, z, state)) return;
  let s = state;
  if (!isSource(state, k)) {
    const ns = newLiquid(L, x, y, z, k, r);
    if (ns === 0) { L.setBlock(x, y, z, 0); return; }
    if (ns !== state) {
      s = ns;
      L.setBlock(x, y, z, ns);
      L.scheduleTick(x, y, z, ns, r.tickDelay);
    }
  }
  spread(L, x, y, z, s, k, r);
}

function spread(L: Level, x: number, y: number, z: number, s: number, k: Kind, r: Rules): void {
  const below = L.getBlock(x, y - 1, z);
  if (y > -64 && canHold(below, k) && !isSource(below, k)) {
    const fall = k === 'water' ? waterState(8) : lavaState(8);
    if (below !== fall) { spreadTo(L, x, y - 1, z, fall, k, true); }
    // fonte com 3+ vizinhas fontes também espalha para os lados
    let n = 0;
    for (const [dx, dz] of HORIZ) if (isSource(L.getBlock(x + dx, y, z + dz), k)) n++;
    if (n < 3) return;
  } else if (!isSource(s, k) && kindOf(below) === k) {
    // sobre líquido do mesmo tipo (um "buraco" já cheio): só fontes espalham para os lados
    return;
  }
  // para os lados
  let amt = isFalling(s) ? 8 : amountOf(s, k);
  amt -= r.drop;
  if (isFalling(s)) amt = 8 - r.drop;
  if (amt <= 0) return;
  const target = k === 'water' ? waterState(8 - amt) : lavaState(8 - amt);
  // direções que levam ao buraco mais próximo
  const dists: number[] = [];
  let min = 1000;
  for (let i = 0; i < 4; i++) {
    const [dx, dz] = HORIZ[i];
    const n = L.getBlock(x + dx, y, z + dz);
    if (!canHold(n, k) || isSource(n, k)) { dists.push(Infinity); continue; }
    const d = canHold(L.getBlock(x + dx, y - 1, z + dz), k) ? 0 : slopeDistance(L, x + dx, y, z + dz, i ^ 1, 1, k, r, new Set([`${x},${z}`]));
    dists.push(d);
    if (d < min) min = d;
  }
  for (let i = 0; i < 4; i++) {
    if (dists[i] === Infinity || dists[i] > min) continue;
    const [dx, dz] = HORIZ[i];
    const n = L.getBlock(x + dx, y, z + dz);
    if (kindOf(n) === k && amountOf(n, k) >= amt) continue;
    spreadTo(L, x + dx, y, z + dz, target, k, false);
  }
}

/** Liga o comportamento dos líquidos ao nível. */
export function installFluids(level: Level): void {
  const schedule = (L: Level, x: number, y: number, z: number, s: number) => {
    const k = kindOf(s);
    if (k) L.scheduleTick(x, y, z, s, rules(L, k).tickDelay);
  };
  level.behavior((n) => n === 'water' || n === 'lava', {
    placed: (L, x, y, z, s) => schedule(L, x, y, z, s),
    neighbor: (L, x, y, z, s) => schedule(L, x, y, z, s),
    tick: (L, x, y, z, s) => tick(L, x, y, z, s),
  });
}

export { kindOf as fluidKind, isSource as isFluidSource, waterState, lavaState };
