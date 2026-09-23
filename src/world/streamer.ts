/**
 * Carregamento contínuo do mundo ao redor do jogador:
 *  1. pede geração das colunas em espiral (mais perto e à frente primeiro);
 *  2. integra a luz das bordas quando a coluna chega (com orçamento de tempo por frame);
 *  3. agenda malhas das seções sujas cujo entorno 3×3 já está carregado;
 *  4. descarrega colunas longe (salvando as modificadas).
 * Nada disso bloqueia o frame: tudo tem limite por quadro.
 */
import { MIN_Y, SECTION_COUNT } from '../core/constants';
import { colKey, colKeyX, colKeyZ } from '../core/math';
import { Chunk, FULL_SKY, Section } from './chunk';
import { World, sectionKey } from './world';
import type { WorkerPool } from '../workers/pool';
import type { GenResult, MeshResult } from '../workers/protocol';
import type { ChunkRenderer } from '../render/chunks/chunkrenderer';
import { pidx } from '../mesh/padded';
import type { SpawnHint } from './gen/overworld';

export interface StreamerHooks {
  /** chamado quando uma coluna nova é gerada (spawns iniciais etc.) */
  onGenerated?(chunk: Chunk, spawns: SpawnHint[]): void;
  /** carrega do save (retorna null se não salvo) */
  loadSaved?(cx: number, cz: number): Promise<Chunk | null>;
  /** salva antes de descarregar */
  save?(chunk: Chunk): void;
  onUnloaded?(chunk: Chunk): void;
  onLoaded?(chunk: Chunk): void;
}

export class WorldStreamer {
  renderDistance = 8;
  fancyLeaves = true;
  private readonly pendingGen = new Map<number, { cancel: () => void }>();
  private readonly arrived: GenResult[] = [];
  private readonly arrivedSaved: Chunk[] = [];
  private readonly meshInFlight = new Set<number>();
  private readonly meshDone: MeshResult[] = [];
  private playerCx = 0;
  private playerCz = 0;
  private dirX = 0;
  private dirZ = 1;
  private lastWantKey = '';
  private wanted: number[] = [];
  /** colunas cuja luz já foi integrada */
  private readonly integrated = new Set<number>();
  stats = { genQueue: 0, meshQueue: 0, meshInFlight: 0, loaded: 0, genMsAvg: 0, meshMsAvg: 0 };
  paused = false;

  constructor(
    readonly world: World,
    private readonly pool: WorkerPool,
    private readonly chunks: ChunkRenderer,
    private readonly hooks: StreamerHooks = {},
  ) {
    chunks.loadedColumn = (cx, cz) => world.getChunk(cx, cz) !== undefined;
  }

  setCenter(x: number, z: number, yaw: number): void {
    this.playerCx = Math.floor(x / 16);
    this.playerCz = Math.floor(z / 16);
    this.dirX = -Math.sin(yaw);
    this.dirZ = -Math.cos(yaw);
  }

  private priority(cx: number, cz: number): number {
    const dx = cx - this.playerCx, dz = cz - this.playerCz;
    const d2 = dx * dx + dz * dz;
    const len = Math.sqrt(d2) || 1;
    const facing = (dx * this.dirX + dz * this.dirZ) / len; // -1..1
    return d2 * (1.25 - 0.45 * facing);
  }

  /** Um passo por frame (budgetMs para trabalho síncrono). */
  update(budgetMs = 6): void {
    const t0 = performance.now();
    const R = this.renderDistance;
    const loadR = R + 2; // vizinho diagonal de uma coluna na borda (R+0,5+√2) precisa estar carregado
    const W = this.world;

    // 1) lista de colunas desejadas (recalcula quando o jogador muda de chunk)
    const wantKey = `${this.playerCx},${this.playerCz},${R}`;
    if (wantKey !== this.lastWantKey) {
      this.lastWantKey = wantKey;
      const list: [number, number][] = [];
      for (let dz = -loadR; dz <= loadR; dz++) for (let dx = -loadR; dx <= loadR; dx++) {
        if (dx * dx + dz * dz > (loadR + 0.5) * (loadR + 0.5)) continue;
        list.push([colKey(this.playerCx + dx, this.playerCz + dz), this.priority(this.playerCx + dx, this.playerCz + dz)]);
      }
      list.sort((a, b) => a[1] - b[1]);
      this.wanted = list.map((l) => l[0]);
      // reprioriza/cancela pedidos pendentes fora do raio
      this.pool.reprioritize((req) => {
        if (req.type !== 'gen') return this.priority((req as { sx: number }).sx, (req as { sz: number }).sz) * 0.5 - 1000;
        const g = req as { cx: number; cz: number };
        const dx = g.cx - this.playerCx, dz = g.cz - this.playerCz;
        if (dx * dx + dz * dz > (loadR + 2) * (loadR + 2)) {
          this.pendingGen.delete(colKey(g.cx, g.cz));
          return null;
        }
        return this.priority(g.cx, g.cz);
      });
      // descarrega colunas distantes
      const unloadR2 = (R + 3) * (R + 3);
      for (const [k, c] of W.chunks) {
        const dx = c.cx - this.playerCx, dz = c.cz - this.playerCz;
        if (dx * dx + dz * dz > unloadR2) this.unload(k, c);
      }
    }

    // 2) pede geração do que falta (limita a fila)
    if (!this.paused) {
      const maxQueue = this.pool.size * 3;
      for (const k of this.wanted) {
        if (this.pendingGen.size >= maxQueue) break;
        if (W.chunks.has(k) || this.pendingGen.has(k)) continue;
        const cx = colKeyX(k), cz = colKeyZ(k);
        this.request(cx, cz, k);
      }
    }

    // 3) integra colunas que chegaram (luz das bordas)
    while ((this.arrived.length || this.arrivedSaved.length) && performance.now() - t0 < budgetMs) {
      let chunk: Chunk;
      let spawns: SpawnHint[] = [];
      if (this.arrivedSaved.length) chunk = this.arrivedSaved.shift()!;
      else {
        const res = this.arrived.shift()!;
        const built = this.buildChunk(res);
        chunk = built;
        spawns = res.spawns;
        chunk.fresh = true;
      }
      const k = colKey(chunk.cx, chunk.cz);
      this.pendingGen.delete(k);
      const dx = chunk.cx - this.playerCx, dz = chunk.cz - this.playerCz;
      if (dx * dx + dz * dz > (loadR + 2) * (loadR + 2)) continue;
      if (W.chunks.has(k)) continue;
      W.addChunk(chunk);
      this.integrated.add(k);
      // marca todas as seções desta coluna e as bordas dos vizinhos
      for (let sy = 0; sy < SECTION_COUNT; sy++) {
        W.markSectionDirty(chunk.cx, sy, chunk.cz);
        for (let ddx = -1; ddx <= 1; ddx++) for (let ddz = -1; ddz <= 1; ddz++) if (ddx || ddz) {
          if (W.getChunk(chunk.cx + ddx, chunk.cz + ddz)) W.markSectionDirty(chunk.cx + ddx, sy, chunk.cz + ddz);
        }
      }
      this.hooks.onLoaded?.(chunk);
      if (chunk.fresh && spawns.length) this.hooks.onGenerated?.(chunk, spawns);
    }

    // 4) aplica malhas prontas
    let uploads = 0;
    while (this.meshDone.length && (uploads < 24 || performance.now() - t0 < budgetMs)) {
      const m = this.meshDone.shift()!;
      this.meshInFlight.delete(sectionKey(m.sx, m.sy, m.sz));
      if (!W.getChunk(m.sx, m.sz)) continue;
      this.chunks.setSection(m.sx, m.sy, m.sz, m.layers, m.quads, m.vis, m.skyLit);
      uploads++;
    }

    // 5) agenda novas malhas (seções sujas com vizinhança carregada), mais perto primeiro
    if (W.dirtySections.size && performance.now() - t0 < budgetMs * 1.5) {
      const cand: [number, number][] = [];
      for (const key of W.dirtySections) {
        if (this.meshInFlight.has(key)) continue;
        const sy = key & 31, col = Math.floor(key / 32);
        const cx = colKeyX(col), cz = colKeyZ(col);
        const dx = cx - this.playerCx, dz = cz - this.playerCz;
        if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) { W.dirtySections.delete(key); continue; }
        cand.push([key, dx * dx + dz * dz + Math.abs(sy - 8) * 0.05]);
      }
      cand.sort((a, b) => a[1] - b[1]);
      const maxInFlight = this.pool.size * 4;
      for (const [key] of cand) {
        if (this.meshInFlight.size >= maxInFlight || performance.now() - t0 > budgetMs * 1.5) break;
        const sy = key & 31, col = Math.floor(key / 32);
        const cx = colKeyX(col), cz = colKeyZ(col);
        if (!this.neighborsLoaded(cx, cz)) continue;
        W.dirtySections.delete(key);
        const chunk = W.getChunk(cx, cz)!;
        const sec = chunk.sections[sy];
        if (!sec || sec.count === 0) {
          // seção vazia: remove malha antiga (se havia) e segue
          if (this.chunks.has(cx, sy, cz)) this.chunks.removeSection(cx, sy, cz);
          continue;
        }
        this.submitMesh(cx, sy, cz, chunk);
      }
    }
    this.stats.genQueue = this.pendingGen.size;
    this.stats.meshQueue = W.dirtySections.size;
    this.stats.meshInFlight = this.meshInFlight.size;
    this.stats.loaded = W.chunks.size;
    this.stats.genMsAvg = this.pool.genCount ? this.pool.genMs / this.pool.genCount : 0;
    this.stats.meshMsAvg = this.pool.meshCount ? this.pool.meshMs / this.pool.meshCount : 0;
  }

  private request(cx: number, cz: number, k: number): void {
    const load = this.hooks.loadSaved;
    if (load) {
      const token = { cancel: () => undefined };
      this.pendingGen.set(k, token);
      load(cx, cz).then((c) => {
        if (!this.pendingGen.has(k)) return;
        if (c) { c.fresh = false; this.arrivedSaved.push(c); } else this.generate(cx, cz, k);
      }).catch(() => this.generate(cx, cz, k));
    } else this.generate(cx, cz, k);
  }

  private generate(cx: number, cz: number, k: number): void {
    const job = this.pool.submit({ type: 'gen', dim: this.world.dim, seed: this.world.seed, cx, cz }, this.priority(cx, cz));
    this.pendingGen.set(k, job);
    job.promise.then((res) => { if (this.pendingGen.has(k)) this.arrived.push(res); }).catch(() => this.pendingGen.delete(k));
  }

  private buildChunk(res: GenResult): Chunk {
    const c = new Chunk(res.cx, res.cz);
    for (let i = 0; i < SECTION_COUNT; i++) {
      const b = res.blocks[i];
      if (b) c.sections[i] = new Section(b, res.light[i]!);
    }
    c.heightmap.set(res.heightmap);
    c.biomes.set(res.biomes);
    c.tints.set(res.tints);
    for (const [idx, be] of res.blockEntities) c.blockEntities.set(idx, be as never);
    return c;
  }

  private neighborsLoaded(cx: number, cz: number): boolean {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!this.world.getChunk(cx + dx, cz + dz)) return false;
    return true;
  }

  /** Copia a seção com borda de 1 bloco (18³) a partir das 27 seções vizinhas. */
  private submitMesh(cx: number, sy: number, cz: number, chunk: Chunk): void {
    const blocks = new Uint16Array(18 * 18 * 18);
    const light = new Uint8Array(18 * 18 * 18);
    const W = this.world;
    for (let dcz = -1; dcz <= 1; dcz++) for (let dcx = -1; dcx <= 1; dcx++) {
      const nc = W.getChunk(cx + dcx, cz + dcz)!;
      const xs = dcx < 0 ? 15 : 0, xe = dcx > 0 ? 0 : 15;
      const zs = dcz < 0 ? 15 : 0, ze = dcz > 0 ? 0 : 15;
      for (let dsy = -1; dsy <= 1; dsy++) {
        const ssy = sy + dsy;
        const ys = dsy < 0 ? 15 : 0, ye = dsy > 0 ? 0 : 15;
        let sec: Section | null = null;
        let above = false;
        if (ssy < 0) sec = null;
        else if (ssy >= SECTION_COUNT) above = true;
        else sec = nc.sections[ssy];
        for (let ly = ys; ly <= ye; ly++) {
          const py = ly + dsy * 16;
          for (let lz = zs; lz <= ze; lz++) {
            const pz = lz + dcz * 16;
            const base = pidx(xs + dcx * 16, py, pz);
            if (!sec) {
              const v = above || ssy >= 0 ? FULL_SKY : 0;
              for (let lx = xs; lx <= xe; lx++) light[base + (lx - xs)] = v;
              continue;
            }
            const sb = (ly << 8) | (lz << 4);
            for (let lx = xs; lx <= xe; lx++) {
              blocks[base + (lx - xs)] = sec.blocks[sb | lx];
              light[base + (lx - xs)] = sec.light[sb | lx];
            }
          }
        }
      }
    }
    const tints = chunk.tints.slice();
    const key = sectionKey(cx, sy, cz);
    this.meshInFlight.add(key);
    const dx = cx - this.playerCx, dz = cz - this.playerCz;
    const job = this.pool.submit(
      { type: 'mesh', sx: cx, sy, sz: cz, blocks, light, tints, fancyLeaves: this.fancyLeaves },
      (dx * dx + dz * dz) * 0.5 - 1000,
      [blocks.buffer, light.buffer, tints.buffer],
    );
    job.promise.then((res) => this.meshDone.push(res)).catch(() => { this.meshInFlight.delete(key); W.dirtySections.add(key); });
  }

  private unload(k: number, c: Chunk): void {
    if (c.dirty) this.hooks.save?.(c);
    this.world.removeChunk(c.cx, c.cz);
    this.chunks.removeColumn(c.cx, c.cz);
    this.integrated.delete(k);
    this.hooks.onUnloaded?.(c);
  }

  /** Força refazer todas as malhas carregadas (ex.: mudou "folhas detalhadas"). */
  remeshAll(): void {
    for (const c of this.world.chunks.values()) for (let sy = 0; sy < SECTION_COUNT; sy++) this.world.markSectionDirty(c.cx, sy, c.cz);
  }

  /** Quantas colunas ao redor (raio r) estão prontas com malha. */
  readyAround(r: number): number {
    let n = 0;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const c = this.world.getChunk(this.playerCx + dx, this.playerCz + dz);
      if (c) n++;
    }
    return n;
  }

  /** descarrega tudo (troca de mundo/dimensão) */
  clear(): void {
    for (const [k, c] of [...this.world.chunks]) this.unload(k, c);
    for (const p of this.pendingGen.values()) p.cancel();
    this.pendingGen.clear();
    this.arrived.length = 0;
    this.arrivedSaved.length = 0;
    this.meshDone.length = 0;
    this.meshInFlight.clear();
    this.lastWantKey = '';
  }
}

export { MIN_Y };
