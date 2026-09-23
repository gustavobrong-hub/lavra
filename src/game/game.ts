/**
 * Sessão de jogo: nível (mundo + entidades), jogador, carregamento, renderização e o loop fixo
 * de 20 ticks/s com interpolação de câmera e entidades.
 */
import * as THREE from 'three';
import { DAY_TICKS, MIN_Y, SEA_LEVEL, TICK_MS, DIM_OVERWORLD } from '../core/constants';
import { clamp } from '../core/math';
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
import { Level } from './level';
import { Player, type GameMode } from './player/player';
import { Interaction } from './player/interaction';
import { playerCamera } from './camera';
import { EntityRenderer } from '../render/entities/entityrenderer';
import { BlockOverlay } from '../render/overlay';
import { HandRenderer } from '../render/hand';
import { BasicHud } from '../ui/hudbasic';
import { ItemEntity } from './entity/itementity';
import { ItemStack } from './items/stack';
import { AABB } from '../core/aabb';

export interface GameOptions {
  seed: number;
  dim?: number;
  time?: number;
  spawn?: [number, number, number];
  mode?: GameMode;
}

export class Game {
  readonly world: World;
  readonly level: Level;
  readonly pool: WorkerPool;
  readonly streamer: WorldStreamer;
  readonly pipeline: Pipeline;
  readonly input: Input;
  readonly debug: DebugOverlay;
  readonly player: Player;
  readonly interaction: Interaction;
  readonly entityRenderer = new EntityRenderer();
  readonly overlay = new BlockOverlay();
  readonly hand = new HandRenderer();
  readonly hud: BasicHud;
  readonly opaqueScene = new THREE.Scene();
  readonly transScene = new THREE.Scene();
  dayTime: number;
  rain = 0;
  thunder = 0;
  yaw = 0; // graus (convenção do original)
  pitch = 0;
  thirdPerson: 0 | 1 | 2 = 0;
  private acc = 0;
  private lastT = 0;
  private running = false;
  private frames = 0;
  private fpsT = 0;
  fps = 0;
  private raf = 0;
  /** pausa a simulação (menus) */
  paused = false;
  /** mundo pronto (chunks ao redor do jogador carregados) */
  ready = false;
  private attackPressed = false;
  private usePressed = false;
  private pickPressed = false;

  constructor(readonly canvas: HTMLCanvasElement, readonly uiRoot: HTMLElement, readonly settings: Settings, readonly opts: GameOptions) {
    this.world = new World(opts.dim ?? DIM_OVERWORLD, opts.seed);
    this.level = new Level(this.world);
    const cores = navigator.hardwareConcurrency || 4;
    this.pool = new WorkerPool(Math.max(2, Math.min(6, cores - 1)));
    this.pipeline = new Pipeline(canvas, settings.graphics);
    this.streamer = new WorldStreamer(this.world, this.pool, this.pipeline.chunks);
    this.streamer.renderDistance = settings.graphics.renderDistance;
    this.streamer.fancyLeaves = settings.graphics.fancyLeaves;
    this.input = new Input(canvas);
    this.dayTime = opts.time ?? 0;
    this.player = new Player(this.level);
    this.player.setGameMode(opts.mode ?? 'survival');
    const sp = opts.spawn ?? this.findSpawn();
    this.player.setPos(sp[0], sp[1], sp[2]);
    this.level.entities.add(this.player);
    this.interaction = new Interaction(this.level, this.player);
    this.opaqueScene.add(this.entityRenderer.group);
    this.transScene.add(this.overlay.group);
    this.hud = new BasicHud(uiRoot);
    this.debug = new DebugOverlay(uiRoot, { lines: () => this.debugLines(), right: () => this.debugRight() });
    this.level.on((e) => {
      if (e.type === 'xp') { /* orbes de experiência — marco de sobrevivência */ }
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

  /** O jogador fica congelado até o chão ao redor carregar. */
  private checkReady(): void {
    if (this.ready) return;
    const p = this.player;
    const cx = Math.floor(p.x / 16), cz = Math.floor(p.z / 16);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!this.world.getChunk(cx + dx, cz + dz)) return;
    // ajusta a altura se o ponto de nascimento ficou dentro do chão
    let y = Math.floor(p.y);
    while (y < 318 && !p.isFree(new AABB(p.x - 0.3, y, p.z - 0.3, p.x + 0.3, y + 1.8, p.z + 0.3))) y++;
    if (y !== Math.floor(p.y)) p.setPos(p.x, y, p.z);
    this.ready = true;
  }

  private frame(now: number): void {
    const dt = Math.min(250, now - this.lastT);
    this.lastT = now;
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK_MS && n < 10) {
      if (!this.paused) this.tick();
      this.acc -= TICK_MS;
      n++;
    }
    if (n === 10) this.acc = 0;
    const alpha = this.paused ? 1 : this.acc / TICK_MS;
    // olhar com o mouse (por frame, como o original: graus = contagem × (s·0,6+0,2)³ × 8 × 0,15)
    const [mx, my] = this.input.takeMouse();
    if (!this.paused) {
      const s = this.settings.controls.sensitivity * 0.6 + 0.2;
      const k = s * s * s * 8 * 0.15;
      this.yaw += mx * k;
      this.pitch = clamp(this.pitch + my * k * (this.settings.controls.invertY ? -1 : 1), -90, 90);
      this.player.yaw = this.yaw;
      this.player.pitch = this.pitch;
    }
    const p = this.player;
    const cam = playerCamera(p, this.world, alpha, this.settings.graphics.fov, this.settings.graphics.viewBobbing, this.thirdPerson, this.yaw, this.pitch);
    this.streamer.setCenter(cam.x, cam.z, cam.yaw);
    this.streamer.update(5);
    // entidades e sobreposições
    this.entityRenderer.sync(this.level.entities.list, alpha, cam.x, cam.y, cam.z, this.world, this.thirdPerson === 0 ? p : undefined);
    const t = this.interaction.target;
    this.overlay.update(this.world, t && !this.paused ? t : null, this.interaction.crackStage, cam.x, cam.y, cam.z);
    const eyeLight = this.world.getLightRaw(Math.floor(p.x), Math.floor(p.y + p.eyeHeight()), Math.floor(p.z));
    const swing = p.prevAttackAnim + (p.attackAnim - p.prevAttackAnim) * alpha;
    this.hand.update(p.inventory.held, swing, cam.bobPhase, cam.bobAmount, this.yaw, this.pitch, window.innerWidth / window.innerHeight,
      [(eyeLight >> 4) / 15, (eyeLight & 15) / 15], dt / 1000);
    const underwater = p.eyeInWater;
    this.pipeline.render({
      camX: cam.x, camY: cam.y, camZ: cam.z, yaw: cam.yaw, pitch: cam.pitch, roll: cam.roll, fov: cam.fov,
      dayTime: this.dayTime + alpha, ticks: this.level.gameTime + alpha, rain: this.rain, thunder: this.thunder,
      moonPhase: (Math.floor(this.dayTime / DAY_TICKS) % 8) / 8, underwater, underLava: p.eyeInLava, wind: 0,
    }, this.settings.graphics.renderDistance, {
      opaque: this.opaqueScene,
      translucent: this.transScene,
      hand: this.thirdPerson === 0 ? { scene: this.hand.scene, camera: this.hand.camera } : undefined,
    });
    this.hud.update(p, dt / 1000);
    this.frames++;
    if (now - this.fpsT > 500) {
      this.fps = (this.frames * 1000) / (now - this.fpsT);
      this.frames = 0;
      this.fpsT = now;
    }
    this.debug.update(now);
  }

  private tick(): void {
    this.checkReady();
    const K = this.settings.controls.keys;
    const inp = this.input;
    this.attackPressed = false; this.usePressed = false; this.pickPressed = false;
    for (const b of inp.takePressed()) {
      if (b === K.debug) this.debug.toggle();
      else if (b === K.perspective) this.thirdPerson = ((this.thirdPerson + 1) % 3) as 0 | 1 | 2;
      else if (b === K.attack) this.attackPressed = true;
      else if (b === K.use) this.usePressed = true;
      else if (b === K.pickBlock) this.pickPressed = true;
      else if (b === K.drop) this.dropHeld(inp.isDown('ControlLeft') || inp.isDown('MetaLeft'));
      else if (b.startsWith('Digit')) {
        const n = parseInt(b.slice(5), 10);
        if (n >= 1 && n <= 9) { this.player.inventory.selected = n - 1; this.player.inventory.changed(); }
      }
    }
    inp.takeReleased();
    const wheel = inp.takeWheel();
    if (wheel) {
      const inv = this.player.inventory;
      inv.selected = (((inv.selected + wheel) % 9) + 9) % 9;
      inv.changed();
    }
    const p = this.player;
    if (!this.ready) return;
    const fwd = (inp.isDown(K.forward) ? 1 : 0) - (inp.isDown(K.back) ? 1 : 0);
    const str = (inp.isDown(K.left) ? 1 : 0) - (inp.isDown(K.right) ? 1 : 0);
    p.applyInput({ forward: fwd, strafe: str, jump: inp.isDown(K.jump), sneak: inp.isDown(K.sneak), sprintKey: inp.isDown(K.sprint) });
    p.tick();
    // mira e interação
    const eyeY = p.y + p.eyeHeight();
    this.interaction.updateTarget(p.x, eyeY, p.z);
    this.interaction.tick({
      attack: inp.isDown(K.attack), attackPressed: this.attackPressed,
      use: inp.isDown(K.use), usePressed: this.usePressed, pickPressed: this.pickPressed,
    });
    // mundo
    this.level.gameTime++;
    if (this.level.rules.doDaylightCycle) this.dayTime++;
    this.level.tickBlocks();
    this.level.entities.tick((e) => e !== p);
    this.pickupItems();
    if (p.gameMode === 'survival') p.food.tick(p, this.level.difficulty, this.level.rules.naturalRegeneration);
  }

  /** Recolhe itens próximos (caixa do jogador ampliada 1 × 0,5 × 1, como o original). */
  private pickupItems(): void {
    const p = this.player;
    const box = p.bb.inflate(1, 0.5, 1);
    for (const e of this.level.entities.inBox(box, (x) => x instanceof ItemEntity)) {
      const it = e as ItemEntity;
      if (it.pickupDelay > 0 || p.dead) continue;
      const left = p.inventory.add(it.stack);
      if (left < it.stack.count) {
        this.level.emit('pickup', { x: it.x, y: it.y, z: it.z });
        if (left === 0) it.removed = true;
        else it.stack.count = left;
      }
    }
  }

  dropHeld(all: boolean): void {
    const p = this.player;
    const held = p.inventory.held;
    if (!held) return;
    const n = all ? held.count : 1;
    const st = held.copy(n);
    p.inventory.consumeHeld(n);
    const e = new ItemEntity(this.level, st);
    const [dx, dy, dz] = p.lookVec();
    e.setPos(p.x, p.y + p.eyeHeight() - 0.3, p.z);
    const r = Math.random;
    e.vx = dx * 0.3 + (r() - 0.5) * 0.04; e.vy = dy * 0.3 + 0.1; e.vz = dz * 0.3 + (r() - 0.5) * 0.04;
    e.pickupDelay = 40;
    this.level.entities.add(e);
    p.swing();
  }

  give(id: string, count = 1): void {
    const left = this.player.inventory.add(new ItemStack(id, count));
    if (left > 0) this.level.spawnItem(this.player.x, this.player.y + 1, this.player.z, new ItemStack(id, left));
  }

  private debugLines(): string[] {
    const st = this.streamer.stats;
    const p = this.player;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const c = this.world.getChunk(bx >> 4, bz >> 4);
    const biome = c ? BIOMES[c.biomes[((bz & 15) << 4) | (bx & 15)]] : null;
    const facing = ['sul (+Z)', 'oeste (−X)', 'norte (−Z)', 'leste (+X)'][Math.floor(((this.yaw % 360) + 360 + 45) / 90) & 3];
    const cr = this.pipeline.chunks.stats;
    const light = this.world.getLightRaw(bx, by, bz);
    const hour = Math.floor(((this.dayTime / 1000 + 6) % 24));
    const t = this.interaction.target;
    return [
      `Lavra 0.1 — ${this.fps.toFixed(0)} FPS (${this.pipeline.stats.frameMs.toFixed(1)} ms CPU de render)`,
      `XYZ: ${p.x.toFixed(3)} / ${p.y.toFixed(5)} / ${p.z.toFixed(3)}`,
      `Bloco: ${bx} ${by} ${bz}  Chunk: ${bx >> 4} ${(by - MIN_Y) >> 4} ${bz >> 4} [${bx & 15} ${by & 15} ${bz & 15}]`,
      `Olhando para: ${facing} (${(((this.yaw % 360) + 540) % 360 - 180).toFixed(1)} / ${this.pitch.toFixed(1)})`,
      `Bioma: ${biome ? `${biome.label} (${biome.name})` : '—'}`,
      `Luz: céu ${light >> 4}, bloco ${light & 15}`,
      `Dia ${Math.floor(this.dayTime / DAY_TICKS)}, ${String(hour).padStart(2, '0')}h — tempo ${this.dayTime % DAY_TICKS}`,
      `Modo: ${p.gameMode}${p.flying ? ' (voando)' : ''} — vida ${p.health.toFixed(1)}, fome ${p.food.foodLevel}, saciedade ${p.food.saturation.toFixed(1)}`,
      t ? `Mirando: ${blockNameOf(t.state)} em ${t.x} ${t.y} ${t.z}` : 'Mirando: —',
      `Chunks: ${st.loaded} carregados, geração ${st.genQueue} na fila (${st.genMsAvg.toFixed(1)} ms/chunk)`,
      `Malhas: ${st.meshQueue} sujas, ${st.meshInFlight} em curso (${st.meshMsAvg.toFixed(2)} ms/seção)`,
      `Seções: ${cr.drawn} desenhadas / ${this.pipeline.chunks.sectionCount} na GPU, ${(cr.quads / 1000).toFixed(0)}k quads`,
      `Entidades: ${this.level.entities.list.length} (${this.entityRenderer.count} visíveis)`,
      `Seed: ${this.world.seed}`,
    ];
  }

  private debugRight(): string[] {
    const caps = this.pipeline.caps;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return [
      `Renderizador: WebGL2${caps.webgpu ? ' (WebGPU disponível)' : ''}`,
      `GPU: ${caps.gpu}`,
      `Memória GPU (chunks): ${(this.pipeline.chunks.stats.gpuBytes / 1048576).toFixed(1)} MB`,
      mem ? `Heap JS: ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '',
      `Workers: ${this.pool.size} (${this.pool.running} ativos, ${this.pool.pending} na fila)`,
      `Distância: ${this.settings.graphics.renderDistance} chunks, preset ${this.settings.graphics.preset}`,
      `Draw calls: ${this.pipeline.stats.drawCalls}`,
    ].filter(Boolean);
  }
}
