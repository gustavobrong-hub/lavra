/**
 * A* na grade de voxels (inspirado no WalkNodeEvaluator do original): nós são posições dos pés,
 * vizinhos em 8 direções com subida de 1 bloco, descida de até `maxFall`, custo extra para água
 * e perigo, portas de madeira atravessáveis para quem sabe abri-las, cercas bloqueiam.
 * Heap binário e chaves numéricas: ~0,3 ms para 400 nós.
 */
import { BLOCKS, BLOCK_OF, FLAGS, F_SOLID, F_WATER, F_LAVA, F_WATERLOGGED, F_FULL_CUBE_COLLISION, SHAPE, SHAPE_IDS, STATE_PROPS } from '../../../world/blocks';
import { blockBoxes, type Box } from '../../../world/blocks/shapes';
import type { World } from '../../../world/world';

export interface PathOptions {
  width: number;
  height: number;
  maxFall: number;
  canSwim: boolean;
  canOpenDoors: boolean;
  avoidWater: boolean;
  /** criaturas que só andam na água (peixes) */
  aquatic?: boolean;
  /** criaturas voadoras (ignoram chão) */
  flying?: boolean;
  /** evita a luz do sol? (não usado no custo) */
  maxNodes: number;
}

export type PathNode = [number, number, number];

export const enum Kind { Blocked = 0, Open = 1, Water = 3, Danger = 4, DoorOpenable = 5 }

const DANGER = new Set(['fire', 'soul_fire', 'cactus', 'sweet_berry_bush', 'magma_block', 'cobweb', 'powder_snow']);
let dangerIds: Uint8Array | null = null;
function isDanger(s: number): boolean {
  if (!dangerIds) {
    dangerIds = new Uint8Array(BLOCKS.length);
    for (const b of BLOCKS) if (DANGER.has(b.name) || b.name === 'campfire') dangerIds[b.id] = 1;
  }
  return dangerIds[BLOCK_OF[s]] === 1;
}
const tmpBoxes: Box[] = [];

/** Classifica uma célula para o corpo da criatura. */
export function cellKind(w: World, x: number, y: number, z: number, canOpenDoors: boolean): Kind {
  const s = w.getBlock(x, y, z);
  if (s === 0) return Kind.Open;
  const fl = FLAGS[s];
  if (fl & F_LAVA) return Kind.Danger;
  if (isDanger(s)) return Kind.Danger;
  if (fl & (F_WATER | F_WATERLOGGED)) {
    if (fl & F_SOLID && fl & F_FULL_CUBE_COLLISION) return Kind.Blocked;
    return Kind.Water;
  }
  if (!(fl & F_SOLID)) return Kind.Open;
  if (fl & F_FULL_CUBE_COLLISION) return Kind.Blocked;
  const sh = SHAPE[s];
  if (sh === SHAPE_IDS.door) {
    if (STATE_PROPS[s].open) return Kind.Open;
    return canOpenDoors && BLOCKS[BLOCK_OF[s]].name !== 'iron_door' ? Kind.DoorOpenable : Kind.Blocked;
  }
  if (sh === SHAPE_IDS.fencegate && STATE_PROPS[s].open) return Kind.Open;
  if (sh === SHAPE_IDS.trapdoor && STATE_PROPS[s].open) return Kind.Open;
  // formas baixas (tapete, placa de pressão) contam como abertas
  let top = 0;
  for (const b of blockBoxes(s, x, y, z, (a, bb, c) => w.getBlock(a, bb, c), false, tmpBoxes)) top = Math.max(top, b[4]);
  if (top <= 0.1) return Kind.Open;
  return Kind.Blocked;
}

/** Topo firme para ficar em pé (0 se não dá). */
function floorHeight(w: World, x: number, y: number, z: number): number {
  const s = w.getBlock(x, y - 1, z);
  const fl = FLAGS[s];
  if (!(fl & F_SOLID)) return 0;
  if (fl & F_FULL_CUBE_COLLISION) return 1;
  const sh = SHAPE[s];
  if (sh === SHAPE_IDS.fence || sh === SHAPE_IDS.wall || sh === SHAPE_IDS.fencegate) return 0; // não pisa em cerca
  let top = 0;
  for (const b of blockBoxes(s, x, y - 1, z, (a, bb, c) => w.getBlock(a, bb, c), false, tmpBoxes)) top = Math.max(top, b[4]);
  return top;
}

const OFF = 1048576;
const key = (x: number, y: number, z: number): number => ((x + OFF) * 2097152 + (z + OFF)) * 512 + (y + 64);

/** Heap binário mínimo por f. */
class Heap {
  private k: number[] = [];
  private f: number[] = [];
  get size(): number { return this.k.length; }
  push(key: number, f: number): void {
    const a = this.k, b = this.f;
    let i = a.length;
    a.push(key); b.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (b[p] <= f) break;
      a[i] = a[p]; b[i] = b[p];
      i = p;
    }
    a[i] = key; b[i] = f;
  }
  pop(): number {
    const a = this.k, b = this.f;
    const top = a[0];
    const lk = a.pop()!, lf = b.pop()!;
    const n = a.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && b[c + 1] < b[c]) c++;
        if (b[c] >= lf) break;
        a[i] = a[c]; b[i] = b[c];
        i = c;
      }
      a[i] = lk; b[i] = lf;
    }
    return top;
  }
}

const NEIGHBORS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Pathfinder {
  /** estatística para o benchmark/depuração */
  static lastNodes = 0;
  constructor(private readonly world: World) {}

  /** Custo de estar numa posição de pés (Infinity = impossível). */
  standCost(x: number, y: number, z: number, o: PathOptions): number {
    const w = this.world;
    const H = Math.max(1, Math.ceil(o.height - 0.01));
    const W = o.width > 1 ? Math.ceil(o.width) - 1 : 0;
    let cost = 0;
    let water = false;
    for (let dx = 0; dx <= W; dx++) for (let dz = 0; dz <= W; dz++) for (let dy = 0; dy < H; dy++) {
      const k = cellKind(w, x + dx, y + dy, z + dz, o.canOpenDoors);
      if (k === Kind.Blocked || k === Kind.Danger) return Infinity;
      if (k === Kind.Water) water = true;
      else if (k === Kind.DoorOpenable) cost += 1;
    }
    if (o.aquatic) return water ? cost : Infinity;
    if (o.flying) return cost;
    if (water) {
      if (!o.canSwim) return Infinity;
      return cost + (o.avoidWater ? 8 : 1);
    }
    if (floorHeight(w, x, y, z) <= 0) {
      // bloco de baixo pode ser água (nadar na superfície)
      const below = w.getBlock(x, y - 1, z);
      if (FLAGS[below] & (F_WATER | F_WATERLOGGED) && o.canSwim) return cost + (o.avoidWater ? 8 : 1);
      return Infinity;
    }
    // perigo logo abaixo (magma, fogueira) ou ao lado custa mais
    if (isDanger(w.getBlock(x, y - 1, z))) cost += 8;
    return cost;
  }

  find(sx: number, sy: number, sz: number, tx: number, ty: number, tz: number, o: PathOptions, reach = 1): PathNode[] | null {
    const w = this.world;
    if (!w.isLoaded(tx, tz)) return null;
    const open = new Heap();
    const g = new Map<number, number>();
    const parent = new Map<number, number>();
    const pos = new Map<number, number>(); // chave → índice em coords
    const coords: number[] = [];
    const h = (x: number, y: number, z: number) => Math.hypot(x - tx, (y - ty) * 1.2, z - tz);
    const sk = key(sx, sy, sz);
    g.set(sk, 0);
    pos.set(sk, 0);
    coords.push(sx, sy, sz);
    open.push(sk, h(sx, sy, sz));
    let bestK = sk, bestD = h(sx, sy, sz);
    let visited = 0;
    const closed = new Set<number>();
    const walker = !o.flying && !o.aquatic;
    const headroom = Math.max(1, Math.ceil(o.height - 0.01));
    while (open.size && visited < o.maxNodes) {
      const ck = open.pop();
      if (closed.has(ck)) continue;
      closed.add(ck);
      visited++;
      const ci = pos.get(ck)!;
      const cx = coords[ci], cy = coords[ci + 1], cz = coords[ci + 2];
      const cg = g.get(ck)!;
      const d = h(cx, cy, cz);
      if (d < bestD) { bestD = d; bestK = ck; }
      if (Math.abs(cx - tx) <= reach && Math.abs(cz - tz) <= reach && Math.abs(cy - ty) <= Math.max(1, reach)) { bestK = ck; bestD = 0; break; }
      for (const [dx, dz] of NEIGHBORS) {
        const nx = cx + dx, nz = cz + dz;
        if (!w.isLoaded(nx, nz)) continue;
        const diag = dx !== 0 && dz !== 0;
        if (diag) {
          // não corta cantos: as duas células laterais precisam estar livres na altura do corpo
          let ok = true;
          for (let yy = 0; yy < headroom && ok; yy++) {
            if (cellKind(w, cx + dx, cy + yy, cz, o.canOpenDoors) === Kind.Blocked) ok = false;
            else if (cellKind(w, cx, cy + yy, cz + dz, o.canOpenDoors) === Kind.Blocked) ok = false;
          }
          if (!ok) continue;
        }
        const tryY = (ny: number): boolean => {
          let c = this.standCost(nx, ny, nz, o);
          if (c === Infinity) return false;
          if (walker) {
            if (ny > cy) {
              // subir: precisa de espaço acima da cabeça no nó atual
              if (cellKind(w, cx, cy + headroom, cz, o.canOpenDoors) === Kind.Blocked) return false;
            } else if (ny < cy) {
              for (let yy = cy + headroom - 1; yy > ny + headroom - 1; yy--) if (cellKind(w, nx, yy, nz, o.canOpenDoors) === Kind.Blocked) return false;
              c += (cy - ny) * 0.5;
            }
          }
          const nk = key(nx, ny, nz);
          if (closed.has(nk)) return true;
          const ng = cg + (diag ? 1.414 : 1) + c + (ny > cy ? 0.5 : 0);
          if (ng < (g.get(nk) ?? Infinity)) {
            g.set(nk, ng);
            parent.set(nk, ck);
            if (!pos.has(nk)) { pos.set(nk, coords.length); coords.push(nx, ny, nz); }
            open.push(nk, ng + h(nx, ny, nz));
          }
          return true;
        };
        if (walker) {
          // mesmo nível, depois degrau acima, depois queda
          if (tryY(cy)) continue;
          if (tryY(cy + 1)) continue;
          for (let f = 1; f <= o.maxFall; f++) {
            // a queda só vale se a célula acima estiver livre (senão é parede)
            if (cellKind(w, nx, cy - f + headroom, nz, o.canOpenDoors) === Kind.Blocked && f === 1) break;
            if (tryY(cy - f)) break;
          }
        } else {
          tryY(cy); tryY(cy + 1); tryY(cy - 1);
        }
      }
      if (!walker) {
        // voadores e nadadores também sobem e descem na vertical
        for (const dy of [1, -1]) {
          const ny = cy + dy;
          const c = this.standCost(cx, ny, cz, o);
          if (c === Infinity) continue;
          const nk = key(cx, ny, cz);
          if (closed.has(nk)) continue;
          const ng = cg + 1 + c;
          if (ng < (g.get(nk) ?? Infinity)) {
            g.set(nk, ng); parent.set(nk, ck);
            if (!pos.has(nk)) { pos.set(nk, coords.length); coords.push(cx, ny, cz); }
            open.push(nk, ng + h(cx, ny, cz));
          }
        }
      }
    }
    Pathfinder.lastNodes = visited;
    if (bestK === sk) return null;
    const path: PathNode[] = [];
    let k: number | undefined = bestK;
    while (k !== undefined && k !== sk) {
      const i = pos.get(k)!;
      path.push([coords[i], coords[i + 1], coords[i + 2]]);
      k = parent.get(k);
    }
    path.reverse();
    return path;
  }
}
