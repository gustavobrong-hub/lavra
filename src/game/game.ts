/**
 * Sessão de jogo: mundo, carregamento, renderização e o loop fixo de 20 ticks/s com interpolação.
 * (Marco 1: câmera livre; o jogador com física entra no marco 3.)
 */
import { DAY_TICKS, MIN_Y, SEA_LEVEL, TICK_MS, DIM_OVERWORLD } from '../core/constants';
import { clamp, DEG } from '../core/math';
import { World } from '../world/world';
import { WorldStreamer } from '../world/streamer';
import { WorkerPool } from '../workers/pool';
import { Pipeline } from '../render/pipeline';
import { Input } from '../input/input';
import { DebugOverlay } from '../ui/debug';
import { BIOMES } from '../world/gen/biomes';
import { TerrainSampler } from '../world/gen/terrain';
import { blockNameOf } from '../world/blocks';
import type { Settings } from '../settings';

export interface GameOptions {
  seed: number;
  dim?: number;
  time?: number;
  spawn?: [number, number, number];
}

export class Game {
  readonly world: World;
  readonly pool: WorkerPool;
  readonly streamer: WorldStreamer;
  readonly pipeline: Pipeline;
  readonly input: Input;
  readonly debug: DebugOverlay;
  dayTime: number;
  ticks = 0;
  rain = 0;
  thunder = 0;
  // câmera livre (marco 1)
  x = 0; y = 100; z = 0;
  prevX = 0; prevY = 100; prevZ = 0;
  yaw = 0; pitch = 0;
  vx = 0; vy = 0; vz = 0;
  private acc = 0;
  private lastT = 0;
  private running = false;
  private frames = 0;
  private fpsT = 0;
  fps = 0;
  private raf = 0;

  constructor(readonly canvas: HTMLCanvasElement, readonly uiRoot: HTMLElement, readonly settings: Settings, readonly opts: GameOptions) {
    this.world = new World(opts.dim ?? DIM_OVERWORLD, opts.seed);
    const cores = navigator.hardwareConcurrency || 4;
    this.pool = new WorkerPool(Math.max(2, Math.min(6, cores - 1)));
    this.pipeline = new Pipeline(canvas, settings.graphics);
    this.streamer = new WorldStreamer(this.world, this.pool, this.pipeline.chunks);
    this.streamer.renderDistance = settings.graphics.renderDistance;
    this.streamer.fancyLeaves = settings.graphics.fancyLeaves;
    this.input = new Input(canvas);
    this.dayTime = opts.time ?? 0;
    const sp = opts.spawn ?? this.findSpawn();
    [this.x, this.y, this.z] = sp;
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;
    this.debug = new DebugOverlay(uiRoot, {
      lines: () => this.debugLines(),
      right: () => this.debugRight(),
    });
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  /** Procura terra firme perto da origem, como o original. */
  findSpawn(): [number, number, number] {
    const ts = new TerrainSampler(this.world.seed);
    for (let r = 0; r < 2048; r += 16) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
        const p = ts.params(Math.floor(x / 4) * 4, Math.floor(z / 4) * 4);
        const b = BIOMES[p.biome];
        if (b.ocean || b.river || b.mountain) continue;
        const y = ts.surfaceY(x, z);
        if (y >= SEA_LEVEL && y < 110) return [x + 0.5, y + 1.02, z + 0.5];
      }
    }
    return [0.5, 100, 0.5];
  }

  onResize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.pipeline.resize(w, h);
  }

  start(): void {
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame(t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame(now: number): void {
    const dt = Math.min(250, now - this.lastT);
    this.lastT = now;
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK_MS && n < 10) {
      this.tick();
      this.acc -= TICK_MS;
      n++;
    }
    if (n === 10) this.acc = 0;
    const alpha = this.acc / TICK_MS;
    // olhar com o mouse (por frame, como o original)
    const [mx, my] = this.input.takeMouse();
    const s = this.settings.controls.sensitivity * 0.6 + 0.2;
    const k = s * s * s * 8 * 0.15 * DEG;
    this.yaw -= mx * k;
    this.pitch = clamp(this.pitch - my * k * (this.settings.controls.invertY ? -1 : 1), -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);

    const cx = this.prevX + (this.x - this.prevX) * alpha;
    const cy = this.prevY + (this.y - this.prevY) * alpha;
    const cz = this.prevZ + (this.z - this.prevZ) * alpha;
    this.streamer.setCenter(cx, cz, this.yaw);
    this.streamer.update(5);
    this.pipeline.render({
      camX: cx, camY: cy, camZ: cz, yaw: this.yaw, pitch: this.pitch, fov: this.settings.graphics.fov,
      dayTime: this.dayTime + alpha, ticks: this.ticks + alpha, rain: this.rain, thunder: this.thunder,
      moonPhase: (Math.floor(this.dayTime / DAY_TICKS) % 8) / 8, underwater: false, underLava: false, wind: 0,
    }, this.settings.graphics.renderDistance);
    this.frames++;
    if (now - this.fpsT > 500) {
      this.fps = (this.frames * 1000) / (now - this.fpsT);
      this.frames = 0;
      this.fpsT = now;
    }
    this.debug.update(now);
  }

  private tick(): void {
    this.ticks++;
    this.dayTime++;
    for (const b of this.input.takePressed()) {
      if (b === this.settings.controls.keys.debug) this.debug.toggle();
    }
    this.input.takeReleased();
    // voo livre (velocidade de voo do criativo ~10,9 m/s, correndo ~21,6)
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;
    const K = this.settings.controls.keys;
    let f = 0, st = 0, up = 0;
    if (this.input.isDown(K.forward)) f += 1;
    if (this.input.isDown(K.back)) f -= 1;
    if (this.input.isDown(K.left)) st -= 1;
    if (this.input.isDown(K.right)) st += 1;
    if (this.input.isDown(K.jump)) up += 1;
    if (this.input.isDown(K.sneak)) up -= 1;
    const sprint = this.input.isDown(K.sprint) ? 2 : 1;
    const accel = 0.05 * sprint;
    const len = Math.hypot(f, st) || 1;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    this.vx += ((-sin * f + cos * st) / len) * accel;
    this.vz += ((-cos * f - sin * st) / len) * accel;
    this.vy += up * 0.15;
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
    this.vx *= 0.91; this.vz *= 0.91; this.vy *= 0.6;
    this.y = clamp(this.y, MIN_Y, 400);
  }

  private debugLines(): string[] {
    const st = this.streamer.stats;
    const bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
    const c = this.world.getChunk(bx >> 4, bz >> 4);
    const biome = c ? BIOMES[c.biomes[((bz & 15) << 4) | (bx & 15)]] : null;
    const facing = ['sul (+Z)', 'oeste (−X)', 'norte (−Z)', 'leste (+X)'][((Math.round(-this.yaw / (Math.PI / 2)) % 4) + 4) % 4];
    const cr = this.pipeline.chunks.stats;
    const light = this.world.getLightRaw(bx, by, bz);
    const hour = Math.floor(((this.dayTime / 1000 + 6) % 24));
    return [
      `Lavra 0.1 — ${this.fps.toFixed(0)} FPS (${this.pipeline.stats.frameMs.toFixed(1)} ms CPU de render)`,
      `XYZ: ${this.x.toFixed(3)} / ${this.y.toFixed(3)} / ${this.z.toFixed(3)}`,
      `Bloco: ${bx} ${by} ${bz}  Chunk: ${bx >> 4} ${(by - MIN_Y) >> 4} ${bz >> 4} [${bx & 15} ${by & 15} ${bz & 15}]`,
      `Olhando para: ${facing} (${((-this.yaw / DEG) % 360).toFixed(1)} / ${(-this.pitch / DEG).toFixed(1)})`,
      `Bioma: ${biome ? `${biome.label} (${biome.name})` : '—'}`,
      `Luz: céu ${light >> 4}, bloco ${light & 15}`,
      `Dia ${Math.floor(this.dayTime / DAY_TICKS)}, ${String(hour).padStart(2, '0')}h — tempo ${this.dayTime % DAY_TICKS}`,
      `Chunks: ${st.loaded} carregados, geração ${st.genQueue} na fila (${st.genMsAvg.toFixed(1)} ms/chunk)`,
      `Malhas: ${st.meshQueue} sujas, ${st.meshInFlight} em curso (${st.meshMsAvg.toFixed(2)} ms/seção)`,
      `Seções: ${cr.drawn} desenhadas / ${this.pipeline.chunks.sectionCount} na GPU, ${(cr.quads / 1000).toFixed(0)}k quads, ${cr.visited} visitadas`,
      `Seed: ${this.world.seed}`,
    ];
  }

  private debugRight(): string[] {
    const caps = this.pipeline.caps;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const blockHere = blockNameOf(this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 1), Math.floor(this.z)));
    return [
      `Renderizador: WebGL2${caps.webgpu ? ' (WebGPU disponível)' : ''}`,
      `GPU: ${caps.gpu}`,
      `Memória GPU (chunks): ${(this.pipeline.chunks.stats.gpuBytes / 1048576).toFixed(1)} MB`,
      mem ? `Heap JS: ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '',
      `Workers: ${this.pool.size} (${this.pool.running} ativos, ${this.pool.pending} na fila)`,
      `Distância: ${this.settings.graphics.renderDistance} chunks, preset ${this.settings.graphics.preset}`,
      `Draw calls: ${this.pipeline.stats.drawCalls}`,
      `Bloco abaixo: ${blockHere}`,
    ].filter(Boolean);
  }
}
