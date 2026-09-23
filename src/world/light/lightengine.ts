/**
 * Motor de luz incremental da thread principal (algoritmo clássico de BFS de adição + remoção).
 * Opera sobre o World: atravessa bordas de chunks carregados e marca seções para refazer a malha.
 */
import { MAX_Y, MIN_Y, SECTION_COUNT } from '../../core/constants';
import { LIGHT_EMIT, LIGHT_OPACITY } from '../blocks/registry';
import type { Chunk } from '../chunk';
import { FULL_SKY } from '../chunk';
import type { World } from '../world';

const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];

class PosQueue {
  x = new Int32Array(4096);
  y = new Int32Array(4096);
  z = new Int32Array(4096);
  l = new Uint8Array(4096);
  head = 0;
  tail = 0;
  push(x: number, y: number, z: number, l = 0): void {
    if (this.tail >= this.x.length) this.grow();
    const t = this.tail++;
    this.x[t] = x; this.y[t] = y; this.z[t] = z; this.l[t] = l;
  }
  private grow(): void {
    if (this.head > 0) {
      const n = this.tail - this.head;
      this.x.copyWithin(0, this.head, this.tail);
      this.y.copyWithin(0, this.head, this.tail);
      this.z.copyWithin(0, this.head, this.tail);
      this.l.copyWithin(0, this.head, this.tail);
      this.head = 0;
      this.tail = n;
      if (this.tail < this.x.length) return;
    }
    const cap = this.x.length * 2;
    const nx = new Int32Array(cap); nx.set(this.x); this.x = nx;
    const ny = new Int32Array(cap); ny.set(this.y); this.y = ny;
    const nz = new Int32Array(cap); nz.set(this.z); this.z = nz;
    const nl = new Uint8Array(cap); nl.set(this.l); this.l = nl;
  }
  get size(): number { return this.tail - this.head; }
  reset(): void { this.head = this.tail = 0; }
}

export class LightEngine {
  private readonly skyAdd = new PosQueue();
  private readonly skyRem = new PosQueue();
  private readonly blkAdd = new PosQueue();
  private readonly blkRem = new PosQueue();
  private cacheKey = NaN;
  private cacheChunk: Chunk | undefined;
  /** células alteradas na última operação (estatística/debug) */
  changed = 0;

  constructor(private readonly world: World) {}

  private chunk(x: number, z: number): Chunk | undefined {
    const cx = x >> 4, cz = z >> 4;
    const k = cx * 67108864 + cz;
    if (k === this.cacheKey) return this.cacheChunk;
    this.cacheKey = k;
    this.cacheChunk = this.world.getChunk(cx, cz);
    return this.cacheChunk;
  }

  invalidateCache(): void {
    this.cacheKey = NaN;
    this.cacheChunk = undefined;
  }

  /** luz bruta (céu<<4|bloco) ou −1 se descarregado/fora */
  private raw(x: number, y: number, z: number): number {
    if (y >= MAX_Y) return FULL_SKY;
    if (y < MIN_Y) return -1;
    const c = this.chunk(x, z);
    if (!c) return -1;
    const s = c.sections[(y - MIN_Y) >> 4];
    return s ? s.light[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] : FULL_SKY;
  }

  private state(x: number, y: number, z: number): number {
    const c = this.chunk(x, z);
    if (!c) return 0;
    const s = c.sections[(y - MIN_Y) >> 4];
    return s ? s.blocks[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] : 0;
  }

  private write(x: number, y: number, z: number, v: number): void {
    const c = this.chunk(x, z);
    if (!c) return;
    const si = (y - MIN_Y) >> 4;
    if (si < 0 || si >= SECTION_COUNT) return;
    const s = c.sections[si] ?? c.ensureSection(si);
    s.light[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] = v;
    this.changed++;
    this.world.markDirtyAt(x, y, z);
  }

  // ------------------------------------------------------------ atualização por troca de bloco
  onBlockChanged(x: number, y: number, z: number, oldState: number, newState: number): void {
    const oldEmit = LIGHT_EMIT[oldState], newEmit = LIGHT_EMIT[newState];
    const oldOp = LIGHT_OPACITY[oldState], newOp = LIGHT_OPACITY[newState];
    const cur = this.raw(x, y, z);
    if (cur < 0) return;

    // luz de bloco
    const bl = cur & 15;
    if ((oldEmit > 0 || newOp > oldOp) && bl > 0) {
      this.write(x, y, z, cur & 0xf0);
      this.blkRem.push(x, y, z, bl);
    }
    if (newOp < oldOp || newOp === oldOp) {
      for (let d = 0; d < 6; d++) {
        const r = this.raw(x + DX[d], y + DY[d], z + DZ[d]);
        if (r > 0 && (r & 15) > 1) this.blkAdd.push(x + DX[d], y + DY[d], z + DZ[d]);
      }
    }
    this.runBlockRemoval();
    if (newEmit > 0) {
      const r = this.raw(x, y, z);
      if ((r & 15) < newEmit) this.write(x, y, z, (r & 0xf0) | newEmit);
      this.blkAdd.push(x, y, z);
    }
    this.runBlockAdd();

    // luz do céu
    if (newOp !== oldOp) {
      const r = this.raw(x, y, z);
      const sk = r >> 4;
      if (newOp > oldOp) {
        if (sk > 0) {
          this.write(x, y, z, r & 15);
          this.skyRem.push(x, y, z, sk);
          this.runSkyRemoval();
        }
      }
      for (let d = 0; d < 6; d++) {
        const nr = this.raw(x + DX[d], y + DY[d], z + DZ[d]);
        if (nr > 0 && (nr >> 4) > 0) this.skyAdd.push(x + DX[d], y + DY[d], z + DZ[d]);
      }
      this.runSkyAdd();
    }
  }

  // ------------------------------------------------------------ integração de bordas
  /** Troca luz entre `c` e os vizinhos carregados (chamado quando `c` chega). */
  integrateChunk(c: Chunk): void {
    const nbs: [number, number, number][] = [[-1, 0, 1], [1, 0, 2], [0, -1, 4], [0, 1, 8]];
    const topOf = (ch: Chunk): number => {
      let top = 0;
      for (let si = SECTION_COUNT - 1; si >= 0; si--) if (ch.sections[si]) { top = si + 1; break; }
      return MIN_Y + top * 16;
    };
    const ctop = topOf(c);
    for (const [dx, dz, bit] of nbs) {
      const n = this.world.getChunk(c.cx + dx, c.cz + dz);
      if (!n) continue;
      const top = Math.max(ctop, topOf(n));
      for (let i = 0; i < 16; i++) {
        // coordenadas de mundo das células de cada lado da borda
        let ax: number, az: number, bx: number, bz: number;
        if (dx !== 0) {
          ax = c.cx * 16 + (dx < 0 ? 0 : 15); bx = ax + dx; az = bz = c.cz * 16 + i;
        } else {
          az = c.cz * 16 + (dz < 0 ? 0 : 15); bz = az + dz; ax = bx = c.cx * 16 + i;
        }
        for (let y = MIN_Y; y < top; y++) {
          const la = c.getLight(ax & 15, y, az & 15);
          const lb = n.getLight(bx & 15, y, bz & 15);
          if ((la >> 4) > (lb >> 4) + 1) this.skyAdd.push(ax, y, az);
          else if ((lb >> 4) > (la >> 4) + 1) this.skyAdd.push(bx, y, bz);
          if ((la & 15) > (lb & 15) + 1) this.blkAdd.push(ax, y, az);
          else if ((lb & 15) > (la & 15) + 1) this.blkAdd.push(bx, y, bz);
        }
      }
      c.lightBorders |= bit;
      n.lightBorders |= bit === 1 ? 2 : bit === 2 ? 1 : bit === 4 ? 8 : 4;
    }
    this.invalidateCache();
    this.runSkyAdd();
    this.runBlockAdd();
  }

  // ------------------------------------------------------------ BFS
  private runSkyAdd(): void {
    const q = this.skyAdd;
    while (q.head < q.tail) {
      const h = q.head++;
      const x = q.x[h], y = q.y[h], z = q.z[h];
      const r = this.raw(x, y, z);
      if (r < 0) continue;
      const l = r >> 4;
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < MIN_Y || ny >= MAX_Y) continue;
        const nr = this.raw(nx, ny, nz);
        if (nr < 0) continue;
        const op = LIGHT_OPACITY[this.state(nx, ny, nz)];
        if (op >= 15) continue;
        const nl = d === 0 && l === 15 && op === 0 ? 15 : l - Math.max(1, op);
        if (nl <= 0 || (nr >> 4) >= nl) continue;
        this.write(nx, ny, nz, (nl << 4) | (nr & 15));
        q.push(nx, ny, nz);
      }
    }
    q.reset();
  }

  private runSkyRemoval(): void {
    const q = this.skyRem;
    while (q.head < q.tail) {
      const h = q.head++;
      const x = q.x[h], y = q.y[h], z = q.z[h], l = q.l[h];
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < MIN_Y || ny >= MAX_Y) continue;
        const nr = this.raw(nx, ny, nz);
        if (nr <= 0) continue;
        const nl = nr >> 4;
        if (nl === 0) continue;
        if (nl < l || (d === 0 && l === 15 && nl === 15)) {
          this.write(nx, ny, nz, nr & 15);
          q.push(nx, ny, nz, nl);
        } else {
          this.skyAdd.push(nx, ny, nz);
        }
      }
    }
    q.reset();
  }

  private runBlockAdd(): void {
    const q = this.blkAdd;
    while (q.head < q.tail) {
      const h = q.head++;
      const x = q.x[h], y = q.y[h], z = q.z[h];
      const r = this.raw(x, y, z);
      if (r < 0) continue;
      const l = r & 15;
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < MIN_Y || ny >= MAX_Y) continue;
        const nr = this.raw(nx, ny, nz);
        if (nr < 0) continue;
        const op = LIGHT_OPACITY[this.state(nx, ny, nz)];
        if (op >= 15) continue;
        const nl = l - Math.max(1, op);
        if (nl <= 0 || (nr & 15) >= nl) continue;
        this.write(nx, ny, nz, (nr & 0xf0) | nl);
        q.push(nx, ny, nz);
      }
    }
    q.reset();
  }

  private runBlockRemoval(): void {
    const q = this.blkRem;
    while (q.head < q.tail) {
      const h = q.head++;
      const x = q.x[h], y = q.y[h], z = q.z[h], l = q.l[h];
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (ny < MIN_Y || ny >= MAX_Y) continue;
        const nr = this.raw(nx, ny, nz);
        if (nr <= 0) continue;
        const nl = nr & 15;
        if (nl === 0) continue;
        if (nl < l) {
          this.write(nx, ny, nz, nr & 0xf0);
          q.push(nx, ny, nz, nl);
          // fontes de luz encontradas no caminho voltam a emitir
          const e = LIGHT_EMIT[this.state(nx, ny, nz)];
          if (e > 0) {
            this.write(nx, ny, nz, (nr & 0xf0) | e);
            this.blkAdd.push(nx, ny, nz);
          }
        } else {
          this.blkAdd.push(nx, ny, nz);
        }
      }
    }
    q.reset();
  }
}
