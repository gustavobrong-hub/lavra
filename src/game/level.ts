/**
 * Nível: uma dimensão em jogo — mundo + entidades + ticks agendados + atualizações de vizinhos.
 * Centraliza "quebrar bloco", "soltar item" e eventos (sons, partículas) para a camada de apresentação.
 */
import { BLOCKS, BLOCK_OF, FLAGS, F_GRAVITY, F_REPLACEABLE, F_FLUID, STATE_PROPS, S, SHAPE, SHAPE_IDS, isAir } from '../world/blocks';
import type { World } from '../world/world';
import { SET_DEFAULT } from '../world/world';
import { canSurvive } from '../world/logic/support';
import { TickScheduler } from '../world/logic/scheduler';
import { EntityManager } from './entity/manager';
import { ItemEntity } from './entity/itementity';
import { FallingBlock, type FallingHost } from './entity/fallingblock';
import { ItemStack } from './items/stack';
import { blockDrops, type ToolContext } from './loot/blockdrops';
import type { Entity } from './entity/entity';
import type { Difficulty } from './player/food';
import type { Player } from './player/player';
import { skyDarkenFor } from '../render/skymodel';
import { BIOMES } from '../world/gen/biomes';

export interface LevelEvent { type: string; [k: string]: unknown }
export type BlockBehavior = {
  /** tick agendado */
  tick?(level: Level, x: number, y: number, z: number, state: number): void;
  /** vizinho mudou */
  neighbor?(level: Level, x: number, y: number, z: number, state: number, fx: number, fy: number, fz: number): void;
  /** foi colocado */
  placed?(level: Level, x: number, y: number, z: number, state: number, old: number): void;
  /** foi removido/trocado */
  removed?(level: Level, x: number, y: number, z: number, old: number, now: number): void;
  /** tick aleatório */
  randomTick?(level: Level, x: number, y: number, z: number, state: number): void;
};

export interface GameRules {
  doDaylightCycle: boolean;
  doMobSpawning: boolean;
  keepInventory: boolean;
  naturalRegeneration: boolean;
  randomTickSpeed: number;
  doFireTick: boolean;
  mobGriefing: boolean;
  doWeatherCycle: boolean;
  doTileDrops: boolean;
}

const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];

export class Level implements FallingHost {
  readonly entities = new EntityManager();
  readonly scheduler = new TickScheduler();
  readonly players: Player[] = [];
  gameTime = 0;
  /** hora do dia em ticks (0 = amanhecer, 6000 = meio-dia) */
  dayTime = 0;
  rainLevel = 0;
  thunderLevel = 0;
  /** escurecimento do céu 0..11 (0 = meio-dia), recalculado a cada tick */
  skyDarken = 0;
  difficulty: Difficulty = 'normal';
  readonly rules: GameRules = {
    doDaylightCycle: true, doMobSpawning: true, keepInventory: false, naturalRegeneration: true,
    randomTickSpeed: 3, doFireTick: true, mobGriefing: true, doWeatherCycle: true, doTileDrops: true,
  };
  private readonly listeners: ((e: LevelEvent) => void)[] = [];
  private readonly updates: number[] = [];
  private readonly behaviors = new Map<number, BlockBehavior>();
  private processing = false;
  rng = Math.random;
  /** entidades de bloco que precisam de tick (fornalhas acesas etc.), chave "x,y,z" */
  readonly activeBE = new Set<string>();
  /** tick de entidade de bloco (registrado por quem conhece o tipo) */
  beTicker?: (level: Level, x: number, y: number, z: number) => boolean;

  constructor(readonly world: World) {
    world.onBlockChange((x, y, z, o, n) => this.onChanged(x, y, z, o, n));
  }

  // ------------------------------------------------------------ comportamento por bloco
  /** Registra comportamento para todos os blocos cujo nome passa no filtro. */
  behavior(filter: (name: string) => boolean, b: BlockBehavior): void {
    for (const bt of BLOCKS) if (filter(bt.name)) {
      const cur = this.behaviors.get(bt.id);
      this.behaviors.set(bt.id, cur ? mergeBehavior(cur, b) : b);
    }
  }
  behaviorOf(state: number): BlockBehavior | undefined { return this.behaviors.get(BLOCK_OF[state]); }

  // ------------------------------------------------------------ eventos
  on(l: (e: LevelEvent) => void): void { this.listeners.push(l); }
  emit(type: string, data: Record<string, unknown> = {}): void {
    const e = { type, ...data };
    for (const l of this.listeners) l(e);
  }

  // ------------------------------------------------------------ blocos
  getBlock(x: number, y: number, z: number): number { return this.world.getBlock(x, y, z); }
  setBlock(x: number, y: number, z: number, state: number, flags = SET_DEFAULT): boolean {
    return this.world.setBlock(x, y, z, state, flags);
  }

  scheduleTick(x: number, y: number, z: number, state: number, delay: number, priority = 0): void {
    this.scheduler.schedule(this.gameTime, x, y, z, BLOCK_OF[state], delay, priority);
  }

  private onChanged(x: number, y: number, z: number, old: number, now: number): void {
    const bo = this.behaviors.get(BLOCK_OF[old]);
    if (bo?.removed && BLOCK_OF[old] !== BLOCK_OF[now]) bo.removed(this, x, y, z, old, now);
    const bn = this.behaviors.get(BLOCK_OF[now]);
    if (bn?.placed && BLOCK_OF[old] !== BLOCK_OF[now]) bn.placed(this, x, y, z, now, old);
    // o próprio bloco e os 6 vizinhos reagem
    this.updates.push(x, y, z, x, y, z);
    for (let d = 0; d < 6; d++) this.updates.push(x + DX[d], y + DY[d], z + DZ[d], x, y, z);
    if (!this.processing) this.processUpdates();
  }

  /** Processa atualizações de vizinhos (fila, com limite para não travar). */
  processUpdates(limit = 20000): void {
    this.processing = true;
    let n = 0;
    const q = this.updates;
    let head = 0;
    while (head < q.length && n < limit) {
      const x = q[head++], y = q[head++], z = q[head++], fx = q[head++], fy = q[head++], fz = q[head++];
      n++;
      this.neighborChanged(x, y, z, fx, fy, fz);
    }
    q.splice(0, head);
    this.processing = false;
  }

  neighborChanged(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    const s = this.world.getBlock(x, y, z);
    if (s === 0) return;
    const get = (a: number, b: number, c: number) => this.world.getBlock(a, b, c);
    if (!canSurvive(s, x, y, z, get) || !this.pairOk(s, x, y, z)) {
      this.breakBlock(x, y, z, { drop: true });
      return;
    }
    if (FLAGS[s] & F_GRAVITY) this.scheduleTick(x, y, z, s, 2);
    const b = this.behaviors.get(BLOCK_OF[s]);
    b?.neighbor?.(this, x, y, z, s, fx, fy, fz);
  }

  /** Blocos de duas partes (porta, cama, planta alta) precisam da outra metade. */
  private pairOk(s: number, x: number, y: number, z: number): boolean {
    const sh = SHAPE[s];
    const p = STATE_PROPS[s];
    if (sh === SHAPE_IDS.door || sh === SHAPE_IDS.doubleplant || (sh === SHAPE_IDS.kelp && p.half !== undefined)) {
      const other = this.world.getBlock(x, y + (p.half === 'lower' ? 1 : -1), z);
      return BLOCK_OF[other] === BLOCK_OF[s];
    }
    if (sh === SHAPE_IDS.bed) {
      const f = p.facing as string;
      const d = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[f]!;
      const k = p.part === 'foot' ? 1 : -1;
      const other = this.world.getBlock(x + d[0] * k, y, z + d[1] * k);
      return BLOCK_OF[other] === BLOCK_OF[s];
    }
    return true;
  }

  /** Quebra um bloco: solta os itens (se pedido), partículas e som. */
  breakBlock(x: number, y: number, z: number, opts: { drop?: boolean; tool?: ToolContext; by?: Entity; silent?: boolean } = {}): boolean {
    const s = this.world.getBlock(x, y, z);
    if (s === 0) return false;
    const replace = FLAGS[s] & F_FLUID ? s : 0;
    if (replace) return false;
    this.world.setBlock(x, y, z, 0);
    if (!opts.silent) this.emit('blockBreak', { x, y, z, state: s });
    if (opts.drop && this.rules.doTileDrops) {
      const t: ToolContext = opts.tool ?? { kind: null, tier: 0, silk: false, fortune: 0, shears: false };
      const res = blockDrops(s, t, this.rng);
      for (const st of res.items) this.spawnItem(x + 0.5, y + 0.5, z + 0.5, st);
      if (res.xp > 0) this.emit('xp', { x: x + 0.5, y: y + 0.5, z: z + 0.5, amount: res.xp });
    }
    return true;
  }

  /** Solta um item com o "espirro" do original. */
  spawnItem(x: number, y: number, z: number, st: ItemStack, spread = true): ItemEntity {
    const e = new ItemEntity(this, st);
    const r = this.rng;
    if (spread) {
      e.setPos(x - 0.125 + (r() - 0.5) * 0.5, y - 0.125 + (r() - 0.5) * 0.5, z - 0.125 + (r() - 0.5) * 0.5);
      e.vx = r() * 0.2 - 0.1; e.vy = 0.2; e.vz = r() * 0.2 - 0.1;
    } else e.setPos(x, y, z);
    this.entities.add(e);
    return e;
  }

  // ------------------------------------------------------------ gravidade
  landFallingBlock(e: FallingBlock, x: number, y: number, z: number): void {
    const cur = this.world.getBlock(x, y, z);
    const name = BLOCKS[BLOCK_OF[e.state]].name;
    if (name.endsWith('_concrete_powder') && FLAGS[cur] & F_FLUID) {
      this.world.setBlock(x, y, z, S(name.replace('_powder', '')));
      return;
    }
    if (isAir(cur) || FLAGS[cur] & F_REPLACEABLE) {
      this.world.setBlock(x, y, z, e.state);
      this.emit('blockLand', { x, y, z, state: e.state });
    } else {
      const id = BLOCKS[BLOCK_OF[e.state]].def.itemOf ?? name;
      this.spawnItem(x + 0.5, y + 0.5, z + 0.5, new ItemStack(id, 1));
    }
  }

  private gravityTick(x: number, y: number, z: number, s: number): void {
    const below = this.world.getBlock(x, y - 1, z);
    if (y <= -64) return;
    if (!(isAir(below) || FLAGS[below] & (F_FLUID | F_REPLACEABLE) || BLOCKS[BLOCK_OF[below]].name === 'fire')) return;
    this.world.setBlock(x, y, z, 0);
    const fb = new FallingBlock(this, s);
    fb.setPos(x + 0.5, y, z + 0.5);
    this.entities.add(fb);
  }

  // ------------------------------------------------------------ tempo, céu e jogadores
  updateSky(): void { this.skyDarken = skyDarkenFor(this.dayTime, this.rainLevel, this.thunderLevel); }
  isDay(): boolean { return this.skyDarken < 4; }
  canSeeSky(x: number, y: number, z: number): boolean { return y >= this.world.heightAt(x, z); }
  /** Chuva caindo neste bloco (céu aberto, bioma com chuva, não neve). */
  isRainingAt(x: number, y: number, z: number): boolean {
    if (this.rainLevel < 0.2 || !this.canSeeSky(x, y, z)) return false;
    const c = this.world.getChunk(x >> 4, z >> 4);
    if (!c) return false;
    const b = BIOMES[c.biomes[((z & 15) << 4) | (x & 15)]];
    if (b.precipitation !== 'rain') return false;
    // temperatura cai com a altitude acima de y=80 (0,00125 por bloco): lá em cima neva
    return b.temp - Math.max(0, y - 80) * 0.00125 >= 0.15;
  }
  /** Luz combinada no bloco (como getMaxLocalRawBrightness). */
  brightness(x: number, y: number, z: number): number { return this.world.getBrightness(x, y, z, this.skyDarken); }

  nearestPlayer(x: number, y: number, z: number, r: number, filter?: (p: Player) => boolean): Player | null {
    let best: Player | null = null, bd = r * r;
    for (const p of this.players) {
      if (p.removed || (filter && !filter(p))) continue;
      const d = p.distanceSq(x, y, z);
      if (d <= bd || r < 0) { bd = d; best = p; if (r < 0) r = Math.sqrt(d); }
    }
    return best;
  }

  // ------------------------------------------------------------ tick
  tickBlocks(): void {
    if (this.beTicker) for (const k of [...this.activeBE]) {
      const [x, y, z] = k.split(',').map(Number);
      if (!this.world.isLoaded(x, z)) continue;
      if (!this.beTicker(this, x, y, z)) this.activeBE.delete(k);
    }
    for (const e of this.scheduler.due(this.gameTime, 4096)) {
      const s = this.world.getBlock(e.x, e.y, e.z);
      if (BLOCK_OF[s] !== e.block) continue;
      if (FLAGS[s] & F_GRAVITY) { this.gravityTick(e.x, e.y, e.z, s); continue; }
      this.behaviors.get(e.block)?.tick?.(this, e.x, e.y, e.z, s);
    }
    this.processUpdates();
  }
}

function mergeBehavior(a: BlockBehavior, b: BlockBehavior): BlockBehavior {
  const out: BlockBehavior = { ...a };
  for (const k of Object.keys(b) as (keyof BlockBehavior)[]) {
    const fa = a[k] as ((...args: unknown[]) => void) | undefined, fb = b[k] as (...args: unknown[]) => void;
    (out as Record<string, unknown>)[k] = fa ? (...args: unknown[]) => { fa(...args); fb(...args); } : fb;
  }
  return out;
}
