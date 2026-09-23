/**
 * Circuitos de fulgor com a semântica do original: sinal 0–15, energia forte e fraca (blocos sólidos
 * repassam só a forte para fios e qualquer uma para componentes), fio perdendo 1 por bloco (a rede inteira é
 * resolvida de uma vez, do mais forte para o mais fraco), tocha invertida com atraso de 2 ticks e queima,
 * repetidor (1–4 ticks de fulgor, trava lateral, estende pulsos), comparador (compara/subtrai, mede
 * baús), lâmpada (desliga 4 ticks depois), portas/alçapões/portões, pistões (12 blocos, pegajoso puxa,
 * quase-conectividade), observador (pulso de 2+2 ticks em mudanças de estado), TNT, ejetor/liberador,
 * bloco musical, sensor de luz do dia, alvo, botões e placas de pressão.
 */
import type { Level } from '../../game/level';
import { BLOCKS, BLOCK_OF, STATE_PROPS, SHAPE, SHAPE_IDS, FLAGS, F_SOLID, F_FLUID, F_REPLACEABLE, S, withProp } from '../blocks';
import { SET_LIGHT } from '../world';
import { isWire, isConductor, wireSides, wireNeighbors } from './wireconn';

const D6: [number, number, number][] = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const N6 = ['down', 'up', 'north', 'south', 'west', 'east'];
const OPP6 = [1, 0, 3, 2, 5, 4];
const IDX: Record<string, number> = { down: 0, up: 1, north: 2, south: 3, west: 4, east: 5 };
const nameOf = (s: number) => BLOCKS[BLOCK_OF[s]].name;
const P = (s: number) => STATE_PROPS[s];

/** true enquanto a rede de fios calcula sua entrada (fios não se alimentam por blocos). */
let computingWire = false;

// ------------------------------------------------------------------ emissão
/** Sinal fraco que o bloco `s` em (x,y,z) entrega na direção `to` (dele para o receptor). */
function emit(L: Level, x: number, y: number, z: number, s: number, to: number): number {
  if (s === 0) return 0;
  const sh = SHAPE[s];
  const p = P(s);
  if (sh === SHAPE_IDS.dust) {
    if (computingWire) return 0;
    const pw = p.power as number;
    if (!pw || to === 1) return 0;
    if (to === 0) return pw;
    return wireSides((a, b, c) => L.getBlock(a, b, c), x, y, z)[to - 2] > 0 ? pw : 0;
  }
  const n = nameOf(s);
  switch (n) {
    case 'fulgor_block': return 15;
    case 'fulgor_torch': return p.lit && to !== 0 ? 15 : 0;
    case 'fulgor_wall_torch': return p.lit && to !== OPP6[IDX[p.facing as string]] ? 15 : 0;
    case 'lever': return p.powered ? 15 : 0;
    case 'repeater': return p.powered && to === OPP6[IDX[p.facing as string]] ? 15 : 0;
    case 'comparator': return to === OPP6[IDX[p.facing as string]] ? comparatorOut(L, x, y, z) : 0;
    case 'observer': return p.powered && to === OPP6[IDX[p.facing as string]] ? 15 : 0;
    case 'target': case 'daylight_detector': return (p.power as number) ?? 0;
    case 'light_weighted_pressure_plate': case 'heavy_weighted_pressure_plate': return (p.power as number) ?? 0;
    case 'detector_rail': return p.powered ? 15 : 0;
  }
  if (sh === SHAPE_IDS.button || n.endsWith('_pressure_plate')) return p.powered ? 15 : 0;
  return 0;
}

/** Sinal forte (direto): energiza o bloco sólido receptor. */
function emitStrong(L: Level, x: number, y: number, z: number, s: number, to: number): number {
  if (s === 0) return 0;
  const sh = SHAPE[s];
  const p = P(s);
  if (sh === SHAPE_IDS.dust) return emit(L, x, y, z, s, to);
  const n = nameOf(s);
  switch (n) {
    case 'fulgor_torch': case 'fulgor_wall_torch': return p.lit && to === 1 ? 15 : 0;
    case 'repeater': case 'comparator': case 'observer': return emit(L, x, y, z, s, to);
    case 'light_weighted_pressure_plate': case 'heavy_weighted_pressure_plate': return to === 0 ? (p.power as number) : 0;
    case 'detector_rail': return p.powered && to === 0 ? 15 : 0;
  }
  if (sh === SHAPE_IDS.button || n === 'lever') {
    if (!p.powered) return 0;
    const face = p.face as string;
    const att = face === 'floor' ? 0 : face === 'ceiling' ? 1 : OPP6[IDX[p.facing as string]];
    return to === att ? 15 : 0;
  }
  if (n.endsWith('_pressure_plate')) return p.powered && to === 0 ? 15 : 0;
  return 0;
}

/** Energia forte que entra no bloco em (x,y,z) vinda dos vizinhos. */
function strongInto(L: Level, x: number, y: number, z: number): number {
  let m = 0;
  for (let k = 0; k < 6; k++) {
    const [dx, dy, dz] = D6[k];
    const v = emitStrong(L, x + dx, y + dy, z + dz, L.getBlock(x + dx, y + dy, z + dz), OPP6[k]);
    if (v > m) { m = v; if (m >= 15) break; }
  }
  return m;
}

/** Sinal que o receptor em (x,y,z) recebe do vizinho na direção k (Level.getSignal). */
export function signalFromDir(L: Level, x: number, y: number, z: number, k: number): number {
  const [dx, dy, dz] = D6[k];
  const bx = x + dx, by = y + dy, bz = z + dz;
  const b = L.getBlock(bx, by, bz);
  const i = emit(L, bx, by, bz, b, OPP6[k]);
  if (isConductor(b)) return Math.max(i, strongInto(L, bx, by, bz));
  return i;
}

export function hasSignal(L: Level, x: number, y: number, z: number, except = -1): boolean {
  for (let k = 0; k < 6; k++) if (k !== except && signalFromDir(L, x, y, z, k) > 0) return true;
  return false;
}
export function bestSignal(L: Level, x: number, y: number, z: number): number {
  let m = 0;
  for (let k = 0; k < 6; k++) m = Math.max(m, signalFromDir(L, x, y, z, k));
  return m;
}

// ------------------------------------------------------------------ notificação
/** Avisa os 6 vizinhos e, se forem sólidos, os vizinhos deles (energia através de blocos). */
function notifyAround(L: Level, x: number, y: number, z: number): void {
  for (let k = 0; k < 6; k++) {
    const [dx, dy, dz] = D6[k];
    const nx = x + dx, ny = y + dy, nz = z + dz;
    L.notify(nx, ny, nz, x, y, z);
    if (isConductor(L.getBlock(nx, ny, nz))) {
      for (let j = 0; j < 6; j++) {
        if (j === OPP6[k]) continue;
        L.notify(nx + D6[j][0], ny + D6[j][1], nz + D6[j][2], nx, ny, nz);
      }
    }
  }
}

// ------------------------------------------------------------------ fio (rede inteira)
let wireBusy = false;
function updateWire(L: Level, x: number, y: number, z: number): void {
  if (wireBusy) return;
  const get = (a: number, b: number, c: number) => L.getBlock(a, b, c);
  // rede conectada
  const key = (a: number, b: number, c: number) => `${a},${b},${c}`;
  const net = new Map<string, [number, number, number]>();
  const queue: [number, number, number][] = [[x, y, z]];
  net.set(key(x, y, z), [x, y, z]);
  while (queue.length && net.size < 4096) {
    const [a, b, c] = queue.pop()!;
    for (const n of wireNeighbors(get, a, b, c)) {
      const k = key(n[0], n[1], n[2]);
      if (net.has(k)) continue;
      net.set(k, n);
      queue.push(n);
    }
  }
  // entradas externas (fios não se alimentam por blocos)
  computingWire = true;
  const power = new Map<string, number>();
  const buckets: [number, number, number][][] = Array.from({ length: 16 }, () => []);
  for (const [k, p] of net) {
    const v = bestSignal(L, p[0], p[1], p[2]);
    power.set(k, v);
    if (v > 0) buckets[v].push(p);
  }
  computingWire = false;
  // propagação do mais forte ao mais fraco
  for (let lv = 15; lv >= 2; lv--) {
    for (const p of buckets[lv]) {
      if (power.get(key(p[0], p[1], p[2]))! !== lv) continue;
      for (const n of wireNeighbors(get, p[0], p[1], p[2])) {
        const k = key(n[0], n[1], n[2]);
        if ((power.get(k) ?? 0) < lv - 1) { power.set(k, lv - 1); buckets[lv - 1].push(n); }
      }
    }
  }
  // aplica (sem avisos), depois avisa os vizinhos de quem mudou
  wireBusy = true;
  const changed: [number, number, number][] = [];
  for (const [k, p] of net) {
    const s = L.getBlock(p[0], p[1], p[2]);
    const v = power.get(k)!;
    if ((P(s).power as number) !== v) { L.setBlock(p[0], p[1], p[2], withProp(s, 'power', v), SET_LIGHT); changed.push(p); }
  }
  for (const p of changed) notifyAround(L, p[0], p[1], p[2]);
  wireBusy = false;
}

// ------------------------------------------------------------------ comparador
const comparatorMemo = new Map<string, number>();
function comparatorOut(L: Level, x: number, y: number, z: number): number {
  const be = L.world.getChunk(x >> 4, z >> 4)?.blockEntities.get(((y + 64) << 8) | ((z & 15) << 4) | (x & 15)) as { out?: number } | undefined;
  return be?.out ?? comparatorMemo.get(`${x},${y},${z}`) ?? 0;
}
function setComparatorOut(L: Level, x: number, y: number, z: number, v: number): void {
  const c = L.world.getChunk(x >> 4, z >> 4);
  if (!c) return;
  const idx = ((y + 64) << 8) | ((z & 15) << 4) | (x & 15);
  c.blockEntities.set(idx, { type: 'comparator', out: v } as never);
  c.dirty = true;
  comparatorMemo.set(`${x},${y},${z}`, v);
}

/** Sinal analógico de um container/bloco medido pelo comparador. */
function analog(L: Level, x: number, y: number, z: number): number | null {
  const s = L.getBlock(x, y, z);
  const n = nameOf(s);
  if (n === 'composter') return P(s).level as number;
  if (n === 'cauldron') return P(s).level as number;
  if (n === 'cake') return (7 - ((P(s).bites as number) ?? 0)) * 2;
  const c = L.world.getChunk(x >> 4, z >> 4);
  const be = c?.blockEntities.get(((y + 64) << 8) | ((z & 15) << 4) | (x & 15)) as { items?: ({ count: number; maxStack: number } | null)[]; loot?: string } | undefined;
  if (!be) return ['chest', 'trapped_chest', 'barrel', 'furnace', 'smoker', 'blast_furnace', 'dispenser', 'dropper'].includes(n) ? 0 : null;
  if (!be.items) return be.loot ? 0 : null;
  let f = 0, any = false;
  for (const it of be.items) if (it) { f += it.count / it.maxStack; any = true; }
  f /= be.items.length;
  return Math.floor(f * 14) + (any ? 1 : 0);
}

function comparatorCompute(L: Level, x: number, y: number, z: number, s: number): number {
  const F = IDX[P(s).facing as string];
  const [dx, , dz] = D6[F];
  // entrada de trás (com medição de containers, até através de um bloco sólido)
  let back = signalFromDir(L, x, y, z, F);
  const behind = L.getBlock(x + dx, y, z + dz);
  if (isWire(behind)) back = Math.max(back, P(behind).power as number);
  const a = analog(L, x + dx, y, z + dz);
  if (a !== null) back = a;
  else if (isConductor(behind) && back < 15) { const a2 = analog(L, x + 2 * dx, y, z + 2 * dz); if (a2 !== null) back = a2; }
  // laterais: fio, bloco de fulgor ou diodo virado para cá
  let side = 0;
  for (const k of F < 4 ? [4, 5] : [2, 3]) {
    const [sx, , sz] = D6[k];
    const n = L.getBlock(x + sx, y, z + sz);
    const nn = nameOf(n);
    if (nn === 'fulgor_block') side = Math.max(side, 15);
    else if (isWire(n)) side = Math.max(side, P(n).power as number);
    else if (nn === 'repeater' || nn === 'comparator') side = Math.max(side, emit(L, x + sx, y, z + sz, n, OPP6[k]));
  }
  return P(s).mode === 'subtract' ? Math.max(0, back - side) : back >= side ? back : 0;
}

// ------------------------------------------------------------------ repetidor
function repeaterInput(L: Level, x: number, y: number, z: number, s: number): number {
  const F = IDX[P(s).facing as string];
  let v = signalFromDir(L, x, y, z, F);
  const [dx, , dz] = D6[F];
  const b = L.getBlock(x + dx, y, z + dz);
  if (isWire(b)) v = Math.max(v, P(b).power as number);
  return v;
}
function repeaterLocked(L: Level, x: number, y: number, z: number, s: number): boolean {
  const F = IDX[P(s).facing as string];
  for (const k of F < 4 ? [4, 5] : [2, 3]) {
    const [sx, , sz] = D6[k];
    const n = L.getBlock(x + sx, y, z + sz);
    const nn = nameOf(n);
    if ((nn === 'repeater' || nn === 'comparator') && emit(L, x + sx, y, z + sz, n, OPP6[k]) > 0) return true;
  }
  return false;
}
function notifyFront(L: Level, x: number, y: number, z: number, s: number): void {
  const F = IDX[P(s).facing as string];
  const [dx, dy, dz] = D6[OPP6[F]];
  L.notify(x + dx, y + dy, z + dz, x, y, z);
  notifyAround(L, x + dx, y + dy, z + dz);
}

// ------------------------------------------------------------------ pistões
const IMMOVABLE = new Set(['obsidian', 'crying_obsidian', 'bedrock', 'piston_head', 'moving_piston', 'end_portal_frame', 'infero_portal', 'spawner', 'chest', 'trapped_chest', 'barrel', 'furnace', 'smoker', 'blast_furnace', 'dispenser', 'dropper', 'enchanting_table', 'beacon', 'lectern', 'bell', 'jukebox', 'brewing_stand']);
function pushReaction(s: number): 'normal' | 'destroy' | 'block' {
  if (s === 0) return 'destroy';
  const n = nameOf(s);
  if (IMMOVABLE.has(n) || BLOCKS[BLOCK_OF[s]].def.hardness < 0) return 'block';
  if ((n === 'piston' || n === 'sticky_piston') && P(s).extended) return 'block';
  if (FLAGS[s] & F_FLUID || FLAGS[s] & F_REPLACEABLE || !(FLAGS[s] & F_SOLID)) return 'destroy';
  if (SHAPE[s] === SHAPE_IDS.door || n.endsWith('_bed')) return 'destroy';
  return 'normal';
}

function pistonShouldExtend(L: Level, x: number, y: number, z: number, F: number): boolean {
  for (let k = 0; k < 6; k++) if (k !== F && signalFromDir(L, x, y, z, k) > 0) return true;
  // quase-conectividade: o bloco de cima também "conta"
  for (let k = 0; k < 6; k++) if (k !== 0 && signalFromDir(L, x, y + 1, z, k) > 0) return true;
  return false;
}

function pistonExtend(L: Level, x: number, y: number, z: number, s: number): boolean {
  const F = IDX[P(s).facing as string];
  const [dx, dy, dz] = D6[F];
  const list: [number, number, number, number][] = [];
  let cx = x + dx, cy = y + dy, cz = z + dz;
  let destroy: [number, number, number] | null = null;
  for (;;) {
    if (cy < -64 || cy >= 320) return false;
    const b = L.getBlock(cx, cy, cz);
    const r = pushReaction(b);
    if (b === 0) break;
    if (r === 'block') return false;
    if (r === 'destroy') { destroy = [cx, cy, cz]; break; }
    list.push([cx, cy, cz, b]);
    if (list.length > 12) return false;
    cx += dx; cy += dy; cz += dz;
  }
  if (destroy) L.breakBlock(destroy[0], destroy[1], destroy[2], { drop: true });
  for (let i = list.length - 1; i >= 0; i--) {
    const [bx, by, bz, b] = list[i];
    L.setBlock(bx + dx, by + dy, bz + dz, b);
  }
  L.setBlock(x, y, z, withProp(s, 'extended', true));
  L.setBlock(x + dx, y + dy, z + dz, S('piston_head', { facing: N6[F], type: nameOf(s) === 'sticky_piston' ? 'sticky' : 'normal' }));
  L.emit('sound', { name: 'piston.out', x, y, z });
  return true;
}

function pistonRetract(L: Level, x: number, y: number, z: number, s: number): void {
  const F = IDX[P(s).facing as string];
  const [dx, dy, dz] = D6[F];
  const hx = x + dx, hy = y + dy, hz = z + dz;
  if (nameOf(L.getBlock(hx, hy, hz)) === 'piston_head') L.setBlock(hx, hy, hz, 0, SET_LIGHT);
  L.setBlock(x, y, z, withProp(s, 'extended', false));
  if (nameOf(s) === 'sticky_piston') {
    const b = L.getBlock(hx + dx, hy + dy, hz + dz);
    if (b !== 0 && pushReaction(b) === 'normal') {
      L.setBlock(hx + dx, hy + dy, hz + dz, 0);
      L.setBlock(hx, hy, hz, b);
    }
  }
  L.notify(hx, hy, hz, x, y, z);
  L.emit('sound', { name: 'piston.in', x, y, z });
}

// ------------------------------------------------------------------ tochas (queima)
const torchHistory = new Map<string, number[]>();
function torchSupportPowered(L: Level, x: number, y: number, z: number, s: number): boolean {
  let k: number;
  if (nameOf(s) === 'fulgor_torch') k = 0;
  else k = OPP6[IDX[P(s).facing as string]];
  return signalFromDir(L, x, y, z, k) > 0;
}

// ------------------------------------------------------------------ instalação
export interface FulgorHooks {
  /** acender TNT (cria a entidade) */
  primeTnt?(x: number, y: number, z: number, fuse: number): void;
  /** ejetor/liberador disparou */
  dispense?(x: number, y: number, z: number, s: number): void;
}

export function installFulgor(level: Level, hooks: FulgorHooks = {}): void {
  const L0 = level;
  // --- fio
  level.behavior((n) => n === 'fulgor_wire', {
    placed: (L, x, y, z) => updateWire(L, x, y, z),
    neighbor: (L, x, y, z) => updateWire(L, x, y, z),
    removed: (L, x, y, z) => {
      const get = (a: number, b: number, c: number) => L.getBlock(a, b, c);
      for (let k = 0; k < 6; k++) { const [dx, dy, dz] = D6[k]; if (isWire(get(x + dx, y + dy, z + dz))) updateWire(L, x + dx, y + dy, z + dz); }
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) for (const dy of [-1, 1]) if (isWire(get(x + dx, y + dy, z + dz))) updateWire(L, x + dx, y + dy, z + dz);
      notifyAround(L, x, y, z);
    },
  });
  // --- fontes simples: avisam em volta ao mudar
  const sourceChanged = (L: Level, x: number, y: number, z: number) => notifyAround(L, x, y, z);
  level.behavior((n) => n === 'lever' || n === 'fulgor_block' || n.endsWith('_button') || n.endsWith('_pressure_plate') || n === 'target' || n === 'daylight_detector', {
    placed: sourceChanged,
    removed: sourceChanged,
  });
  level.stateHooks.push((x, y, z, old, now) => {
    // mudanças de estado (liga/desliga) em alavancas, botões, placas, alvo, sensores → aviso em profundidade
    if (BLOCK_OF[old] === BLOCK_OF[now] && old !== now) {
      const n = nameOf(now);
      if (n === 'lever' || n.endsWith('_button') || n.endsWith('_pressure_plate') || n === 'target' || n === 'daylight_detector' || n === 'fulgor_torch' || n === 'fulgor_wall_torch' || n === 'repeater' || n === 'comparator' || n === 'observer') notifyAround(L0, x, y, z);
    }
    // observadores olhando para (x,y,z)
    for (let k = 0; k < 6; k++) {
      const [dx, dy, dz] = D6[k];
      const ox = x + dx, oy = y + dy, oz = z + dz;
      const o = L0.getBlock(ox, oy, oz);
      if (nameOf(o) !== 'observer') continue;
      // o observador em (ox,oy,oz) olha na direção OPP6[k] (para o bloco que mudou)
      if (IDX[P(o).facing as string] !== OPP6[k] || P(o).powered) continue;
      L0.scheduleTick(ox, oy, oz, o, 2);
    }
  });
  // --- botões voltam sozinhos
  level.behavior((n) => n.endsWith('_button'), {
    tick(L, x, y, z, s) {
      if (!P(s).powered) return;
      L.setBlock(x, y, z, withProp(s, 'powered', false));
      L.emit('sound', { name: 'button.off', x, y, z });
    },
  });
  // --- placas de pressão: conferem ocupação 20 ticks depois
  level.behavior((n) => n.endsWith('_pressure_plate'), {
    tick(L, x, y, z, s) { checkPlate(L, x, y, z, s); },
  });
  // --- alvo e sensor de luz
  level.behavior((n) => n === 'target', {
    tick(L, x, y, z, s) { if ((P(s).power as number) > 0) L.setBlock(x, y, z, withProp(s, 'power', 0)); },
  });
  // --- tocha de fulgor
  level.behavior((n) => n === 'fulgor_torch' || n === 'fulgor_wall_torch', {
    placed: (L, x, y, z, s) => { L.scheduleTick(x, y, z, s, 2); notifyAround(L, x, y, z); },
    removed: (L, x, y, z) => notifyAround(L, x, y, z),
    neighbor(L, x, y, z, s) {
      const off = torchSupportPowered(L, x, y, z, s);
      if (!!P(s).lit === off) L.scheduleTick(x, y, z, s, 2);
    },
    tick(L, x, y, z, s) {
      const powered = torchSupportPowered(L, x, y, z, s);
      const k = `${x},${y},${z}`;
      const hist = (torchHistory.get(k) ?? []).filter((t) => L.gameTime - t < 60);
      if (P(s).lit && powered) {
        hist.push(L.gameTime);
        torchHistory.set(k, hist);
        L.setBlock(x, y, z, withProp(s, 'lit', false));
        if (hist.length >= 8) { L.emit('sound', { name: 'torch.burnout', x, y, z }); L.scheduleTick(x, y, z, withProp(s, 'lit', false), 160); }
      } else if (!P(s).lit && !powered) {
        if (hist.length >= 8) { torchHistory.set(k, hist); return; }
        L.setBlock(x, y, z, withProp(s, 'lit', true));
      }
    },
  });
  // --- repetidor
  level.behavior((n) => n === 'repeater', {
    placed: (L, x, y, z, s) => { if (repeaterInput(L, x, y, z, s) > 0) L.scheduleTick(x, y, z, s, 1); },
    removed: (L, x, y, z) => notifyAround(L, x, y, z),
    neighbor(L, x, y, z, s) {
      const locked = repeaterLocked(L, x, y, z, s);
      if (locked !== !!P(s).locked) { L.setBlock(x, y, z, withProp(s, 'locked', locked), SET_LIGHT); return; }
      if (locked) return;
      const should = repeaterInput(L, x, y, z, s) > 0;
      if (should !== !!P(s).powered) L.scheduleTick(x, y, z, s, (P(s).delay as number) * 2);
    },
    tick(L, x, y, z, s) {
      if (repeaterLocked(L, x, y, z, s)) return;
      const should = repeaterInput(L, x, y, z, s) > 0;
      if (P(s).powered && !should) { L.setBlock(x, y, z, withProp(s, 'powered', false)); notifyFront(L, x, y, z, s); }
      else if (!P(s).powered) {
        const on = withProp(s, 'powered', true);
        L.setBlock(x, y, z, on);
        notifyFront(L, x, y, z, on);
        if (!should) L.scheduleTick(x, y, z, on, (P(s).delay as number) * 2);
      }
    },
  });
  // --- comparador
  level.behavior((n) => n === 'comparator', {
    placed: (L, x, y, z, s) => { L.scheduleTick(x, y, z, s, 2); },
    removed: (L, x, y, z) => { comparatorMemo.delete(`${x},${y},${z}`); notifyAround(L, x, y, z); },
    neighbor(L, x, y, z, s) {
      if (comparatorCompute(L, x, y, z, s) !== comparatorOut(L, x, y, z)) L.scheduleTick(x, y, z, s, 2);
    },
    tick(L, x, y, z, s) {
      const v = comparatorCompute(L, x, y, z, s);
      if (v === comparatorOut(L, x, y, z)) return;
      setComparatorOut(L, x, y, z, v);
      const ns = withProp(s, 'powered', v > 0);
      if (ns !== s) L.setBlock(x, y, z, ns);
      notifyFront(L, x, y, z, ns);
    },
  });
  // --- lâmpadas
  level.behavior((n) => n === 'fulgor_lamp', {
    placed: (L, x, y, z, s) => { if (hasSignal(L, x, y, z)) L.setBlock(x, y, z, withProp(s, 'lit', true)); },
    neighbor(L, x, y, z, s) {
      const on = hasSignal(L, x, y, z);
      if (on && !P(s).lit) L.setBlock(x, y, z, withProp(s, 'lit', true));
      else if (!on && P(s).lit) L.scheduleTick(x, y, z, s, 4);
    },
    tick(L, x, y, z, s) { if (P(s).lit && !hasSignal(L, x, y, z)) L.setBlock(x, y, z, withProp(s, 'lit', false)); },
  });
  // --- portas, alçapões, portões
  level.behavior((n) => SHAPE[S(n)] === SHAPE_IDS.door, {
    neighbor(L, x, y, z, s) {
      const lowerY = P(s).half === 'lower' ? y : y - 1;
      const on = hasSignal(L, x, lowerY, z) || hasSignal(L, x, lowerY + 1, z);
      if (on === !!P(s).powered) return;
      const lo = L.getBlock(x, lowerY, z), hi = L.getBlock(x, lowerY + 1, z);
      if (SHAPE[lo] !== SHAPE_IDS.door) return;
      const changedOpen = !!P(lo).open !== on;
      L.setBlock(x, lowerY, z, withProp(withProp(lo, 'powered', on), 'open', on), SET_LIGHT | 2);
      if (SHAPE[hi] === SHAPE_IDS.door) L.setBlock(x, lowerY + 1, z, withProp(withProp(hi, 'powered', on), 'open', on), SET_LIGHT | 2);
      if (changedOpen) L.emit('sound', { name: on ? 'door.open' : 'door.close', x, y, z });
    },
  });
  level.behavior((n) => { const s = S(n); return SHAPE[s] === SHAPE_IDS.trapdoor || SHAPE[s] === SHAPE_IDS.fencegate; }, {
    neighbor(L, x, y, z, s) {
      const on = hasSignal(L, x, y, z);
      if (on === !!P(s).powered) return;
      L.setBlock(x, y, z, withProp(withProp(s, 'powered', on), 'open', on));
      L.emit('sound', { name: on ? 'trapdoor.open' : 'trapdoor.close', x, y, z });
    },
  });
  // --- pistões
  level.behavior((n) => n === 'piston' || n === 'sticky_piston', {
    placed: (L, x, y, z) => L.notify(x, y, z, x, y, z),
    neighbor(L, x, y, z, s) {
      const F = IDX[P(s).facing as string];
      const should = pistonShouldExtend(L, x, y, z, F);
      if (should && !P(s).extended) pistonExtend(L, x, y, z, s);
      else if (!should && P(s).extended) pistonRetract(L, x, y, z, s);
    },
    removed(L, x, y, z, old) {
      if (!P(old).extended) return;
      const [dx, dy, dz] = D6[IDX[P(old).facing as string]];
      if (nameOf(L.getBlock(x + dx, y + dy, z + dz)) === 'piston_head') L.setBlock(x + dx, y + dy, z + dz, 0);
    },
  });
  level.behavior((n) => n === 'piston_head', {
    removed(L, x, y, z, old) {
      const [dx, dy, dz] = D6[OPP6[IDX[P(old).facing as string]]];
      const b = L.getBlock(x + dx, y + dy, z + dz);
      const bn = nameOf(b);
      if ((bn === 'piston' || bn === 'sticky_piston') && P(b).extended) L.breakBlock(x + dx, y + dy, z + dz, { drop: true });
    },
  });
  // --- observador
  level.behavior((n) => n === 'observer', {
    placed: (L, x, y, z, s) => { if (P(s).powered) L.scheduleTick(x, y, z, s, 2); },
    tick(L, x, y, z, s) {
      const [dx, dy, dz] = D6[OPP6[IDX[P(s).facing as string]]];
      if (P(s).powered) L.setBlock(x, y, z, withProp(s, 'powered', false));
      else { const on = withProp(s, 'powered', true); L.setBlock(x, y, z, on); L.scheduleTick(x, y, z, on, 2); }
      L.notify(x + dx, y + dy, z + dz, x, y, z);
      notifyAround(L, x + dx, y + dy, z + dz);
    },
  });
  // --- TNT
  level.behavior((n) => n === 'tnt', {
    placed(L, x, y, z) { if (hasSignal(L, x, y, z)) { L.setBlock(x, y, z, 0); hooks.primeTnt?.(x, y, z, 80); } },
    neighbor(L, x, y, z) { if (hasSignal(L, x, y, z)) { L.setBlock(x, y, z, 0); hooks.primeTnt?.(x, y, z, 80); } },
  });
  // --- ejetor/liberador (quase-conectividade), bloco musical: borda de subida
  level.behavior((n) => n === 'dispenser' || n === 'dropper', {
    neighbor(L, x, y, z, s) {
      const on = hasSignal(L, x, y, z) || hasSignal(L, x, y + 1, z);
      if (on && !P(s).triggered) { L.setBlock(x, y, z, withProp(s, 'triggered', true), SET_LIGHT); L.scheduleTick(x, y, z, s, 4); }
      else if (!on && P(s).triggered) L.setBlock(x, y, z, withProp(s, 'triggered', false), SET_LIGHT);
    },
    tick(L, x, y, z, s) { hooks.dispense?.(x, y, z, s); },
  });
  level.behavior((n) => n === 'note_block', {
    neighbor(L, x, y, z, s) {
      const on = hasSignal(L, x, y, z);
      if (on === !!P(s).powered) return;
      L.setBlock(x, y, z, withProp(s, 'powered', on), SET_LIGHT);
      if (on) L.emit('note', { x, y, z, below: nameOf(L.getBlock(x, y - 1, z)) });
    },
  });
  // --- trilhos energizados/ativadores ficam ligados com sinal (propagação de trilho no marco dos carrinhos)
  level.behavior((n) => n === 'powered_rail' || n === 'activator_rail', {
    neighbor(L, x, y, z, s) {
      const on = hasSignal(L, x, y, z) || railLinked(L, x, y, z, s);
      if (on !== !!P(s).powered) L.setBlock(x, y, z, withProp(s, 'powered', on));
    },
  });
}

/** Trilho energizado: recebe energia de outro trilho igual energizado por sinal a até 8 blocos. */
function railLinked(L: Level, x: number, y: number, z: number, s: number): boolean {
  const shape = P(s).shape as string;
  const axis: [number, number] = shape.includes('east') || shape.includes('west') ? [1, 0] : [0, 1];
  for (const sign of [-1, 1]) {
    for (let i = 1; i <= 8; i++) {
      let found = false;
      for (const dy of [0, 1, -1]) {
        const b = L.getBlock(x + axis[0] * i * sign, y + dy, z + axis[1] * i * sign);
        if (BLOCK_OF[b] !== BLOCK_OF[s]) continue;
        found = true;
        if (hasSignal(L, x + axis[0] * i * sign, y + dy, z + axis[1] * i * sign)) return true;
        break;
      }
      if (!found) break;
    }
  }
  return false;
}

// ------------------------------------------------------------------ placas de pressão (chamado pelo jogo)
function plateCount(L: Level, x: number, y: number, z: number, s: number): number {
  const n = nameOf(s);
  const box = { minX: x + 0.0625, minY: y, minZ: z + 0.0625, maxX: x + 0.9375, maxY: y + 0.25, maxZ: z + 0.9375 };
  let c = 0;
  for (const e of L.entities.near(x + 0.5, y, z + 0.5, 2)) {
    if (e.removed) continue;
    const b = e.bb;
    if (b.maxX <= box.minX || b.minX >= box.maxX || b.maxZ <= box.minZ || b.minZ >= box.maxZ || b.minY > box.maxY || b.maxY < box.minY) continue;
    const living = (e as { health?: number }).health !== undefined;
    if (n === 'stone_pressure_plate' && !living) continue;
    if ((e as { gameMode?: string }).gameMode === 'spectator') continue;
    c++;
  }
  return c;
}

function checkPlate(L: Level, x: number, y: number, z: number, s: number): void {
  const n = nameOf(s);
  const c = plateCount(L, x, y, z, s);
  if (n === 'light_weighted_pressure_plate' || n === 'heavy_weighted_pressure_plate') {
    const pw = n.startsWith('light') ? Math.min(c, 15) : Math.min(Math.ceil(c / 10), 15);
    if (pw !== P(s).power) L.setBlock(x, y, z, withProp(s, 'power', pw));
    if (pw > 0) L.scheduleTick(x, y, z, s, 10);
    return;
  }
  const on = c > 0;
  if (on !== !!P(s).powered) {
    L.setBlock(x, y, z, withProp(s, 'powered', on));
    L.emit('sound', { name: on ? 'plate.on' : 'plate.off', x, y, z });
  }
  if (on) L.scheduleTick(x, y, z, s, 20);
}

/** Chamado a cada tick pelo jogo: entidades sobre placas de pressão as ativam. */
export function tickPlates(L: Level): void {
  for (const e of L.entities.list) {
    if (e.removed) continue;
    const x = Math.floor(e.x), y = Math.floor(e.y + 0.01), z = Math.floor(e.z);
    const s = L.getBlock(x, y, z);
    if (!nameOf(s).endsWith('_pressure_plate')) continue;
    const n = nameOf(s);
    const pressed = n.includes('weighted') ? (P(s).power as number) > 0 : !!P(s).powered;
    if (!pressed) checkPlate(L, x, y, z, s);
  }
}

/** Projétil acertou um alvo: força 1..15 pela distância ao centro da face. */
export function hitTarget(L: Level, x: number, y: number, z: number, px: number, py: number, pz: number, arrow: boolean): void {
  const s = L.getBlock(x, y, z);
  if (nameOf(s) !== 'target') return;
  const fx = Math.abs(px - (x + 0.5)), fy = Math.abs(py - (y + 0.5)), fz = Math.abs(pz - (z + 0.5));
  const d = Math.max(fx, fy, fz) === fx ? Math.max(fy, fz) : Math.max(fy, fz) === fy ? Math.max(fx, fz) : Math.max(fx, fy);
  const pw = Math.max(1, Math.ceil(15 * Math.max(0, Math.min(1, (0.5 - d) / 0.5))));
  L.setBlock(x, y, z, withProp(s, 'power', pw));
  L.scheduleTick(x, y, z, s, arrow ? 20 : 8);
}

/** Sensor de luz do dia (a cada 20 ticks). */
export function updateDaylight(L: Level, x: number, y: number, z: number, celestial: number): void {
  const s = L.getBlock(x, y, z);
  if (nameOf(s) !== 'daylight_detector') return;
  let i = (L.world.getLightRaw(x, y, z) >> 4) - L.skyDarken;
  let f = celestial * Math.PI * 2;
  if (P(s).inverted) i = 15 - i;
  else if (i > 0) {
    const g = f < Math.PI ? 0 : Math.PI * 2;
    f += (g - f) * 0.2;
    i = Math.round(i * Math.cos(f));
  }
  i = Math.max(0, Math.min(15, i));
  if (i !== P(s).power) L.setBlock(x, y, z, withProp(s, 'power', i));
}
