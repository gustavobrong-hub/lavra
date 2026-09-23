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
import { Hud } from '../ui/hud';
import { UIManager } from '../ui/ui';
import { buildIconAtlas, installIcons } from '../render/icons';
import { itemSpriteFactory } from '../render/items/extrude';
import { initRecipes } from './crafting/data';
import { installBlockEntities, getBE, setBE, type ContainerBE, type FurnaceBE } from './blockentity/blockentities';
import { CraftingGridMenu, ChestMenu } from './inventory/menu';
import { FurnaceMenu } from './inventory/furnacemenu';
import { InventoryScreen, CraftingScreen, FurnaceScreen, ChestScreen } from '../ui/screens/screens';
import { CreativeScreen } from '../ui/screens/creative';
import type { ContainerScreen } from '../ui/screens/container';
import { BLOCKS, BLOCK_OF, STATE_PROPS } from '../world/blocks';
import { ItemEntity } from './entity/itementity';
import { ItemStack } from './items/stack';
import { AABB } from '../core/aabb';
import { survivalTick, giveXp, spawnXp, useDuration, canStartUsing, finishUsing, respawnPos } from './player/survival';
import { XpOrb } from './entity/xporb';
import { DeathScreen } from '../ui/screens/death';
import { NaturalSpawner } from './spawning';
import { spawnMob, createMob } from './entity/registry';
import { registerMobVisuals } from '../render/entities/mobvisual';
import { registerProjectileVisuals } from '../render/entities/projvisual';
import { MOB_SPECS, loadGroupSpecs } from '../render/entities/models/specs';
import { pickEntity, playerAttack, attackStrength, type EntityHit } from './player/combat';
import type { Mob } from './entity/mob';
import type { Horse } from './entity/species/tamables';
import { throwItem, releaseBow, useSpawnEgg, holdDuration, hasArrows, THROWABLES, useBucket, useHoe, useBoneMeal } from './player/useitems';
import { installFluids } from '../world/logic/fluids';
import { installGrowth, randomTicks, harvestBerries } from '../world/logic/growth';
import { installFulgorGame, primeTnt } from './fulgorgame';
import type { BlockHit } from './raycast';
import { Arrow } from './entity/projectiles';
import { MerchantMenu } from './inventory/merchantmenu';
import { MerchantScreen } from '../ui/screens/merchant';
import type { Villager } from './village/villager';
import { installGolemBuilding } from './village/golem';
import { rollChest } from './loot/chestloot';

/** Baú gerado com tabela de saque: sorteia os itens na primeira abertura. */
function fillLoot(be: ContainerBE & { loot?: string }): void {
  if (be.loot) { be.items = rollChest(be.loot); delete be.loot; }
  if (!be.items) be.items = new Array(27).fill(null);
}

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
  readonly hud: Hud;
  readonly ui: UIManager;
  readonly opaqueScene = new THREE.Scene();
  readonly transScene = new THREE.Scene();
  get dayTime(): number { return this.level.dayTime; }
  set dayTime(v: number) { this.level.dayTime = v; }
  get rain(): number { return this.level.rainLevel; }
  set rain(v: number) { this.level.rainLevel = v; }
  get thunder(): number { return this.level.thunderLevel; }
  set thunder(v: number) { this.level.thunderLevel = v; }
  readonly spawner: NaturalSpawner;
  /** entidade sob a mira (tem prioridade sobre o bloco se estiver mais perto) */
  entityTarget: EntityHit | null = null;
  private jumpCharge = 0;
  /** esconde a mão em primeira pessoa (galeria, capturas) */
  hideHand = false;
  private fulgor!: { tick(): void };
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
  worldSpawn: [number, number, number] = [0, 100, 0];
  private usingSlot = -1;
  private deathShown = false;
  onMainMenu?: () => void;
  private attackPressed = false;
  private usePressed = false;
  private pickPressed = false;

  constructor(readonly canvas: HTMLCanvasElement, readonly uiRoot: HTMLElement, readonly settings: Settings, readonly opts: GameOptions) {
    this.world = new World(opts.dim ?? DIM_OVERWORLD, opts.seed);
    this.level = new Level(this.world);
    const cores = navigator.hardwareConcurrency || 4;
    this.pool = new WorkerPool(Math.max(2, Math.min(6, cores - 1)));
    this.pipeline = new Pipeline(canvas, settings.graphics);
    this.streamer = new WorldStreamer(this.world, this.pool, this.pipeline.chunks, {
      onLoaded: (c) => this.level?.pois.scanChunk(c),
      onUnloaded: (c) => this.level?.pois.unloadChunk(c.cx, c.cz),
      onGenerated: (_c, spawns) => this.spawner?.onGenerated(spawns),
    });
    this.streamer.renderDistance = settings.graphics.renderDistance;
    this.streamer.fancyLeaves = settings.graphics.fancyLeaves;
    this.input = new Input(canvas);
    this.level.dayTime = opts.time ?? 0;
    this.player = new Player(this.level);
    this.player.setGameMode(opts.mode ?? 'survival');
    const sp = opts.spawn ?? this.findSpawn();
    this.player.setPos(sp[0], sp[1], sp[2]);
    this.level.entities.add(this.player);
    this.level.players.push(this.player);
    this.spawner = new NaturalSpawner(this.level);
    registerMobVisuals(this.entityRenderer, MOB_SPECS);
    registerProjectileVisuals(this.entityRenderer);
    void loadGroupSpecs().then(() => { registerMobVisuals(this.entityRenderer, MOB_SPECS); this.entityRenderer.reset(); });
    this.interaction = new Interaction(this.level, this.player);
    this.opaqueScene.add(this.entityRenderer.group);
    this.transScene.add(this.overlay.group);
    initRecipes();
    installBlockEntities(this.level);
    installGolemBuilding(this.level);
    installFluids(this.level);
    installGrowth(this.level);
    this.fulgor = installFulgorGame(this.level);
    const icons = buildIconAtlas(this.pipeline.textureData);
    installIcons(icons);
    const sprite = itemSpriteFactory(icons);
    this.entityRenderer.itemSprite = sprite;
    this.hand.itemSprite = sprite;
    this.hud = new Hud(uiRoot);
    this.ui = new UIManager(uiRoot);
    this.ui.closeKey = settings.controls.keys.inventory;
    this.ui.onChange = (s) => {
      this.input.enabled = !s;
      if (s) this.input.exitLock();
      else if (!this.paused) this.input.requestLock();
    };
    this.interaction.onOpenBlock = (x, y, z, st) => this.openBlock(x, y, z, st);
    this.debug = new DebugOverlay(uiRoot, { lines: () => this.debugLines(), right: () => this.debugRight() });
    this.level.on((e) => {
      if (e.type === 'xp') spawnXp(this.level, e.x as number, e.y as number, e.z as number, e.amount as number);
      else if (e.type === 'spawnMob') {
        const m = spawnMob(this.level, e.mob as string, e.x as number, e.y as number, e.z as number, { baby: !!e.baby, size: e.size as number | undefined, yaw: e.yaw as number | undefined, reason: 'breed' });
        if (m && e.style) (m as unknown as { style: string }).style = e.style as string;
      }
      else if (e.type === 'openTrade') {
        const v = this.level.entities.byId.get(e.id as number) as Villager | undefined;
        if (v) {
          const menu = new MerchantMenu(this.player.inventory, v);
          const scr = new MerchantScreen(menu, v);
          scr.onClosed = () => { v.tradingPlayer = null; };
          this.openScreen(scr);
        }
      } else if (e.type === 'convertMob') {
        const old = this.level.entities.byId.get(e.id as number) as Mob | undefined;
        const m = createMob(this.level, e.to as string, e.x as number, e.y as number, e.z as number, { yaw: e.yaw as number, baby: !!e.baby, reason: 'convert' });
        if (m) { if (old) { m.mainHand = old.mainHand; m.helmet = old.helmet; m.customName = old.customName; m.persistent = old.persistent; } this.level.entities.add(m); }
      }
    });
    this.interaction.onUseItem = (st, hit) => this.useItem(st, hit);
    this.player.shieldDamage = (amount) => {
      const p = this.player;
      if (amount < 3 || p.gameMode === 'creative') return;
      const inMain = p.inventory.held?.id === 'shield';
      const sh = inMain ? p.inventory.held : p.inventory.offhand;
      if (!sh) return;
      sh.damage += 1 + Math.floor(amount);
      if (sh.damage >= sh.maxDamage) {
        if (inMain) p.inventory.held = null; else p.inventory.offhand = null;
        this.level.emit('toolBreak', { item: 'shield' });
        p.usingItem = false; p.blocking = false;
      }
      p.inventory.changed();
    };
    this.worldSpawn = [this.player.x, this.player.y, this.player.z];
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
      hand: this.thirdPerson === 0 && !this.hideHand ? { scene: this.hand.scene, camera: this.hand.camera } : undefined,
    });
    this.hud.update(p, dt / 1000);
    this.hud.attackIndicator(p.gameMode === 'survival' ? attackStrength(p, alpha) : 1, !!this.entityTarget && p.gameMode === 'survival');
    this.hud.setSleep(p.sleeping ? Math.min(1, (p.sleepTimer + alpha) / 100) : 0);
    this.ui.update(dt / 1000);
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
      else if (b === K.inventory) this.openInventory();
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
    p.difficulty = this.level.difficulty;
    if (p.vehicle) {
      // montado: a entrada vai para a montaria; agachar desmonta; pulo carregado (segurar e soltar)
      const v = p.vehicle as Horse;
      if (inp.isDown(K.sneak)) { v.dismount(); p.vehicle = null; }
      else if (v.riderInput) {
        v.riderInput.forward = fwd * 0.98; v.riderInput.strafe = str * 0.98;
        if (inp.isDown(K.jump)) this.jumpCharge++;
        else if (this.jumpCharge > 0) {
          const c = this.jumpCharge;
          v.riderInput.jump = c < 10 ? c * 0.1 : Math.min(1, 0.8 + 2 / (c - 9) * 0.1);
          this.jumpCharge = 0;
        }
      }
      p.applyInput({ forward: 0, strafe: 0, jump: false, sneak: false, sprintKey: false });
    } else p.applyInput({ forward: fwd, strafe: str, jump: inp.isDown(K.jump), sneak: inp.isDown(K.sneak), sprintKey: inp.isDown(K.sprint) });
    p.tick();
    if (p.gameMode === 'survival') survivalTick(p, this.level);
    this.tickUsing();
    if (p.dead) { this.onDeath(); return; }
    if (p.sleeping) this.tickSleep();
    // mira: entidade mais perto que o bloco tem prioridade
    const eyeY = p.y + p.eyeHeight();
    this.interaction.updateTarget(p.x, eyeY, p.z);
    const eh = p.gameMode !== 'spectator' ? pickEntity(this.level, p, p.gameMode === 'creative' ? 6 : 3) : null;
    const bd = this.interaction.target ? this.interaction.target.dist : Infinity;
    this.entityTarget = eh && eh.dist < bd ? eh : null;
    let useConsumed = false;
    if (this.entityTarget) {
      this.interaction.target = null;
      if (this.attackPressed && p.gameMode !== 'spectator') playerAttack(this.level, p, this.entityTarget.e);
      if (this.usePressed) {
        const m = this.entityTarget.e as Mob;
        if (typeof m.interact === 'function' && m.interact(p, p.inventory.held)) { p.swing(); useConsumed = true; }
      }
    } else if (this.attackPressed && !this.interaction.target) {
      // golpe no ar: zera a recarga (como o original)
      p.swing();
      p.attackStrengthTicker = 0;
    }
    this.interaction.tick({
      attack: inp.isDown(K.attack) && !this.entityTarget, attackPressed: this.attackPressed && !this.entityTarget,
      use: inp.isDown(K.use) && !useConsumed && !this.entityTarget, usePressed: this.usePressed && !useConsumed,
      pickPressed: this.pickPressed,
    });
    // mundo
    this.level.gameTime++;
    if (this.level.rules.doDaylightCycle) this.dayTime++;
    this.level.updateSky();
    this.level.tickBlocks();
    randomTicks(this.level, Math.floor(p.x) >> 4, Math.floor(p.z) >> 4, 8, this.level.rules.randomTickSpeed);
    this.fulgor.tick();
    this.spawner.tick();
    this.level.entities.tick((e) => e !== p);
    this.pickupItems();
    if (p.gameMode === 'survival') p.food.tick(p, this.level.difficulty, this.level.rules.naturalRegeneration);
    const inv = p.inventory.armorValue();
    p.armorValue = inv.armor; p.armorToughness = inv.toughness; p.knockbackResistance = inv.kb;
    this.input.endTick();
  }

  // ------------------------------------------------------------ usar itens (comer/beber)
  /** Clique direito com item (depois de tentar usar o bloco mirado). */
  private useItem(st: ItemStack | null, hit: BlockHit | null): boolean {
    const p = this.player;
    if (p.usingItem) return false;
    const usable = (s: ItemStack | null) => !!s && (!!holdDuration(s.id) || !!useDuration(s.id) || THROWABLES.has(s.id) || s.id.endsWith('_spawn_egg')
      || s.id.endsWith('bucket') || s.id.endsWith('_hoe') || s.id === 'bone_meal');
    if (!usable(st)) {
      // mão principal sem uso: escudo (ou comida) na mão secundária
      const off = p.inventory.offhand;
      if (off && (off.id === 'shield' || useDuration(off.id))) return this.startUsing(off, true);
      return false;
    }
    const s = st!;
    if (THROWABLES.has(s.id)) return throwItem(this.level, p, s);
    if (s.id === 'bucket' || s.id === 'water_bucket' || s.id === 'lava_bucket') return useBucket(this.level, p, s);
    if (s.id.endsWith('_hoe')) return useHoe(this.level, p, s, hit);
    if (s.id === 'bone_meal') return useBoneMeal(this.level, p, hit);
    if (s.id.endsWith('_spawn_egg')) return useSpawnEgg(this.level, p, s, hit);
    if (s.id === 'bow' && !hasArrows(p)) return false;
    return this.startUsing(s, false);
  }

  private usingOffhand = false;
  private startUsing(st: ItemStack | null, offhand: boolean): boolean {
    const p = this.player;
    if (!st || p.usingItem) return false;
    const hold = holdDuration(st.id);
    if (!hold && (!useDuration(st.id) || !canStartUsing(p, st))) return false;
    p.usingItem = true;
    p.usingItemTicks = 0;
    this.usingOffhand = offhand;
    this.usingSlot = p.inventory.selected;
    return true;
  }

  private tickUsing(): void {
    const p = this.player;
    if (!p.usingItem) { p.blocking = false; return; }
    const st = this.usingOffhand ? p.inventory.offhand : p.inventory.held;
    const released = !this.input.isDown(this.settings.controls.keys.use);
    if (!st || p.inventory.selected !== this.usingSlot) { p.usingItem = false; p.usingItemTicks = 0; p.blocking = false; return; }
    if (holdDuration(st.id)) {
      if (released) {
        if (st.id === 'bow') releaseBow(this.level, p, st, p.usingItemTicks);
        p.usingItem = false; p.usingItemTicks = 0; p.blocking = false;
        return;
      }
      p.usingItemTicks++;
      p.blocking = st.id === 'shield' && p.usingItemTicks >= 5;
      return;
    }
    if (released) { p.usingItem = false; p.usingItemTicks = 0; return; }
    p.usingItemTicks++;
    if (p.usingItemTicks % 4 === 0 && p.usingItemTicks > 0) this.level.emit('eating', { x: p.x, y: p.y + p.eyeHeight(), z: p.z, item: st.id });
    if (p.usingItemTicks >= useDuration(st.id)) {
      const rem = finishUsing(p, st);
      if (p.gameMode !== 'creative') {
        if (this.usingOffhand) { st.count--; if (st.count <= 0) p.inventory.offhand = null; p.inventory.changed(); }
        else p.inventory.consumeHeld();
        if (rem) {
          if (!this.usingOffhand && !p.inventory.held) p.inventory.held = rem;
          else if (this.usingOffhand && !p.inventory.offhand) { p.inventory.offhand = rem; p.inventory.changed(); }
          else if (p.inventory.add(rem) > 0) this.throwStack(rem);
        }
      }
      p.usingItem = false; p.usingItemTicks = 0;
    }
  }

  // ------------------------------------------------------------ cama
  private useBed(x: number, y: number, z: number, st: number): boolean {
    const p = this.player;
    const props = STATE_PROPS[st];
    let hx = x, hz = z;
    if (props.part === 'foot') {
      const d = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[props.facing as string]!;
      hx += d[0]; hz += d[1];
    }
    if (props.occupied) { this.hud.action('Esta cama está ocupada'); return true; }
    if (Math.hypot(p.x - (hx + 0.5), p.z - (hz + 0.5)) > 3.5 || Math.abs(p.y - y) > 2.5) { this.hud.action('Você está longe demais para dormir'); return true; }
    const was = p.spawnPoint;
    p.spawnPoint = [hx, y, hz];
    if (!was || was[0] !== hx || was[1] !== y || was[2] !== hz) this.hud.message('Ponto de renascimento definido');
    const t = this.dayTime % 24000;
    if (!(t >= 12542 && t <= 23459) && this.thunder < 0.5) { this.hud.action('Você só pode dormir à noite ou durante tempestades'); return true; }
    const monsters = this.level.entities.near(hx + 0.5, y, hz + 0.5, 10, (e) => (e as { hostile?: boolean }).hostile === true && Math.abs(e.y - y) < 5);
    if (monsters.length) { this.hud.action('Você não pode descansar agora; há monstros por perto'); return true; }
    p.sleeping = true;
    p.sleepTimer = 0;
    p.setPos(hx + 0.5, y + 0.5625, hz + 0.5);
    p.vx = p.vy = p.vz = 0;
    return true;
  }

  private tickSleep(): void {
    const p = this.player;
    p.sleepTimer++;
    if (this.input.isDown(this.settings.controls.keys.sneak) && p.sleepTimer > 10) { this.wakeUp(); return; }
    if (p.sleepTimer >= 100) {
      this.dayTime += 24000 - (this.dayTime % 24000);
      this.rain = 0; this.thunder = 0;
      this.spawner.timeSinceRest = 0;
      this.wakeUp();
    }
  }
  wakeUp(): void {
    const p = this.player;
    p.sleeping = false;
    p.sleepTimer = 0;
    p.noPhysics = false;
    if (p.spawnPoint) { const [x, y, z] = p.spawnPoint; p.setPos(x + 0.5, y + 0.6, z + 0.5); }
  }

  // ------------------------------------------------------------ morte e renascimento
  private onDeath(): void {
    if (this.deathShown) return;
    this.deathShown = true;
    const p = this.player;
    p.usingItem = false;
    if (!this.level.rules.keepInventory) {
      const inv = p.inventory;
      for (const list of [inv.main, inv.armor]) for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s) { const e = this.level.spawnItem(p.x, p.y + 1, p.z, s); e.vx *= 3; e.vz *= 3; list[i] = null; }
      }
      if (inv.offhand) { this.level.spawnItem(p.x, p.y + 1, p.z, inv.offhand); inv.offhand = null; }
      inv.changed();
      const xp = Math.min(p.xpLevel * 7, 100);
      if (xp > 0) spawnXp(this.level, p.x, p.y + 0.5, p.z, xp);
      p.xpLevel = 0; p.xpProgress = 0; p.xpTotal = 0;
    }
    this.level.emit('playerDeath', {});
    this.spawner.timeSinceRest = 0;
    if (p.vehicle) { (p.vehicle as Mob).dismount(); p.vehicle = null; }
    this.ui.open(new DeathScreen(p.lastDamageType, null, p.score, () => this.respawn(), () => this.onMainMenu?.()));
  }

  respawn(): void {
    const p = this.player;
    this.ui.closeAll();
    const [x, y, z] = respawnPos(p, this.level, this.worldSpawn);
    p.setPos(x, y, z);
    p.vx = p.vy = p.vz = 0;
    p.health = p.maxHealth; p.dead = false; p.fallDistance = 0; p.fireTicks = 0; p.airSupply = p.maxAirSupply;
    p.food.foodLevel = 20; p.food.saturation = 5; p.food.exhaustion = 0;
    p.effects.clear();
    p.score = 0;
    this.deathShown = false;
    this.input.requestLock();
  }

  /** Recolhe itens próximos (caixa do jogador ampliada 1 × 0,5 × 1, como o original). */
  private pickupItems(): void {
    const p = this.player;
    const box = p.bb.inflate(1, 0.5, 1);
    for (const e of this.level.entities.near(p.x, p.y, p.z, 8, (x) => x instanceof XpOrb)) {
      const o = e as XpOrb;
      o.target = p;
      if (o.bb.intersects(box) && p.age % 2 === 0 && !p.dead) {
        giveXp(p, o.value);
        o.removed = true;
        this.level.emit('xpPickup', { x: o.x, y: o.y, z: o.z });
      }
    }
    for (const e of this.level.entities.inBox(p.bb.inflate(0.3), (x) => x instanceof Arrow && x.inGround && x.pickup > 0)) {
      const a = e as Arrow;
      if (p.dead) break;
      if (a.pickup === 2) { a.removed = true; continue; }
      if (p.inventory.add(new ItemStack(a.potion ? 'tipped_arrow' : 'arrow', 1, 0, a.potion ? { potion: a.potion } : undefined)) === 0) {
        a.removed = true;
        this.level.emit('pickup', { x: a.x, y: a.y, z: a.z });
      }
    }
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

  /** Abre a tela de container e liga os itens descartados ao mundo. */
  private openScreen(s: ContainerScreen): void {
    s.onDropped = (items) => { for (const it of items) this.throwStack(it); };
    this.ui.open(s);
  }

  openInventory(): void {
    if (this.ui.isOpen) return;
    const p = this.player;
    if (p.gameMode === 'creative') { this.openScreen(new CreativeScreen(p.inventory)); return; }
    this.openScreen(new InventoryScreen(new CraftingGridMenu(p.inventory, 2, true)));
  }

  private openBlock(x: number, y: number, z: number, st: number): boolean {
    const name = BLOCKS[BLOCK_OF[st]].name;
    const p = this.player;
    if (name.endsWith('_bed')) return this.useBed(x, y, z, st);
    if (name === 'sweet_berry_bush') return harvestBerries(this.level, x, y, z, st);
    if (name === 'tnt' && (p.inventory.held?.id === 'flint_and_steel' || p.inventory.held?.id === 'fire_charge')) {
      this.level.setBlock(x, y, z, 0);
      primeTnt(this.level, x, y, z, 80, p);
      if (p.gameMode !== 'creative') p.inventory.damageHeld(1);
      return true;
    }
    if (name === 'dispenser' || name === 'dropper') {
      let be = getBE<ContainerBE>(this.level, x, y, z);
      if (!be) { be = { type: 'chest', items: new Array(9).fill(null) }; setBE(this.level, x, y, z, be); }
      const menu = new ChestMenu(p.inventory, be.items, 1, () => { const c = this.world.getChunk(x >> 4, z >> 4); if (c) c.dirty = true; });
      this.openScreen(new ChestScreen(menu, name === 'dispenser' ? 'Ejetor' : 'Liberador'));
      return true;
    }
    if (name === 'crafting_table') { this.openScreen(new CraftingScreen(new CraftingGridMenu(p.inventory, 3))); return true; }
    if (name === 'furnace' || name === 'smoker' || name === 'blast_furnace') {
      const be = getBE<FurnaceBE>(this.level, x, y, z);
      if (!be) return false;
      this.level.activeBE.add(`${x},${y},${z}`);
      const menu = new FurnaceMenu(p.inventory, be, () => { const c = this.world.getChunk(x >> 4, z >> 4); if (c) c.dirty = true; });
      menu.onTakeOutput = (xp) => { if (xp > 0) this.level.emit('xp', { x: p.x, y: p.y, z: p.z, amount: xp }); };
      const title = name === 'furnace' ? 'Fornalha' : name === 'smoker' ? 'Defumador' : 'Alto-forno';
      this.openScreen(new FurnaceScreen(menu, title));
      return true;
    }
    if (name === 'chest' || name === 'trapped_chest' || name === 'barrel') {
      let be = getBE<ContainerBE>(this.level, x, y, z);
      if (!be) {
        // baú/barril gerado sem dados: cria vazio
        be = { type: name === 'barrel' ? 'barrel' : 'chest', items: new Array(27).fill(null) };
        setBE(this.level, x, y, z, be);
      }
      fillLoot(be);
      let items = be.items, rows = 3, title = name === 'barrel' ? 'Barril' : 'Baú';
      const props = STATE_PROPS[st];
      if (props.type && props.type !== 'single') {
        // baú duplo: esquerda + direita
        const f = props.facing as string;
        const right = { north: [1, 0], south: [-1, 0], west: [0, -1], east: [0, 1] }[f]!;
        const k = props.type === 'left' ? 1 : -1;
        const ox = x + right[0] * k, oz = z + right[1] * k;
        const other = getBE<ContainerBE>(this.level, ox, y, oz);
        if (other) fillLoot(other);
        if (other) {
          const leftItems = props.type === 'left' ? be.items : other.items;
          const rightItems = props.type === 'left' ? other.items : be.items;
          items = new Proxy([] as (ItemStack | null)[], {
            get: (_t, key) => {
              if (key === 'length') return 54;
              const i = Number(key);
              if (Number.isInteger(i)) return i < 27 ? leftItems[i] : rightItems[i - 27];
              return undefined;
            },
            set: (_t, key, v) => { const i = Number(key); if (i < 27) leftItems[i] = v; else rightItems[i - 27] = v; return true; },
          });
          rows = 6; title = 'Baú grande';
        }
      }
      const menu = new ChestMenu(p.inventory, items, rows, () => { const c = this.world.getChunk(x >> 4, z >> 4); if (c) c.dirty = true; });
      this.openScreen(new ChestScreen(menu, title));
      this.level.emit('sound', { name: 'chest.open', x, y, z });
      return true;
    }
    return false;
  }

  /** Joga uma pilha à frente do jogador (itens descartados de telas). */
  throwStack(st: ItemStack): void {
    const p = this.player;
    const e = new ItemEntity(this.level, st);
    const [dx, dy, dz] = p.lookVec();
    e.setPos(p.x, p.y + p.eyeHeight() - 0.3, p.z);
    e.vx = dx * 0.3; e.vy = dy * 0.3 + 0.1; e.vz = dz * 0.3;
    e.pickupDelay = 40;
    this.level.entities.add(e);
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
