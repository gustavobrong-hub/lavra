/**
 * Aldeão (Villager do original, adaptado): rotina diária por horário (ocioso 10, trabalho 2000, encontro 9000,
 * ocioso 11000, descanso 12000), profissão ao ocupar um bloco de trabalho livre, cama e sino como pontos de
 * referência, fazendeiros colhendo e replantando, partilha de comida, cruzamento (12 pontos de comida e cama
 * livre), comércio com níveis e reposição no bloco de trabalho, abre e fecha portas, foge de carniçais.
 */
import { Mob, type Drop } from '../entity/mob';
import type { Level } from '../level';
import type { Player } from '../player/player';
import type { Living, DamageSource } from '../entity/living';
import { Goal, FloatGoal, PanicGoal, AvoidEntityGoal, LookAtPlayerGoal, RandomLookAroundGoal, randomPos } from '../entity/ai/goals';
import { ItemStack } from '../items/stack';
import { BLOCKS, BLOCK_OF, STATE_PROPS, SHAPE, SHAPE_IDS, withProp, S } from '../../world/blocks';
import { rollOffers, LEVEL_XP, offerToJSON, offerFromJSON, type Offer } from './trades';
import type { Poi } from './poi';
import { AABB } from '../../core/aabb';

export const PROFESSIONS = ['nenhuma', 'fazendeiro', 'pescador', 'pastor', 'flecheiro', 'cartografo', 'clerigo', 'armeiro', 'ferramenteiro', 'espadeiro', 'acougueiro', 'curtidor', 'bibliotecario', 'pedreiro', 'tolo'] as const;
export type Profession = typeof PROFESSIONS[number];
export const VILLAGE_STYLES = ['planicie', 'deserto', 'savana', 'taiga', 'neve', 'selva', 'pantano'] as const;

export type Activity = 'idle' | 'work' | 'meet' | 'rest' | 'play';
/** Horário do original (adulto e filhote). */
export function activityAt(dayTime: number, baby: boolean): Activity {
  const t = ((dayTime % 24000) + 24000) % 24000;
  if (baby) return t < 10 ? 'rest' : t < 3000 ? 'idle' : t < 6000 ? 'play' : t < 10000 ? 'idle' : t < 12000 ? 'play' : 'rest';
  return t < 10 ? 'rest' : t < 2000 ? 'idle' : t < 9000 ? 'work' : t < 11000 ? 'meet' : t < 12000 ? 'idle' : 'rest';
}

const FOOD_VALUE: Record<string, number> = { bread: 4, carrot: 1, potato: 1, beetroot: 1 };
const CROP_ITEM: Record<string, [string, string, number]> = {
  wheat: ['wheat', 'wheat_seeds', 7], carrots: ['carrot', 'carrot', 7], potatoes: ['potato', 'potato', 7], beetroots: ['beetroot', 'beetroot_seeds', 3],
};

export class Villager extends Mob {
  readonly type = 'villager';
  profession: Profession = 'nenhuma';
  style: typeof VILLAGE_STYLES[number] = 'planicie';
  tradeLevel = 1;
  tradeXp = 0;
  offers: Offer[] = [];
  ageTicks = 0;
  /** pontos de comida guardados (pão 4, cenoura/batata/beterraba 1) */
  food = 0;
  /** colheita guardada (itens) */
  readonly stash = new Map<string, number>();
  home: [number, number, number] | null = null;
  job: [number, number, number] | null = null;
  meeting: [number, number, number] | null = null;
  sleeping = false;
  shakeHead = 0;
  tradingPlayer: Player | null = null;
  breedCooldown = 0;
  private restocksToday = 0;
  private lastRestockDay = -1;
  private levelUpTimer = 0;
  private poiTimer = Math.floor(Math.random() * 40);
  private openDoors: [number, number, number][] = [];

  constructor(level: Level) {
    super(level);
    this.maxHealth = 20; this.baseSpeed = 0.5; this.category = 'misc'; this.persistent = true;
    this.width = 0.6; this.height = 1.95;
    this.nav.canOpenDoors = true;
    this.nav.avoidWater = true;
  }
  get label(): string { return 'Aldeão'; }
  get baby(): boolean { return this.ageTicks < 0; }
  set baby(b: boolean) { this.setBaby(b); }
  override get isBaby(): boolean { return this.ageTicks < 0; }
  setBaby(b: boolean): void {
    this.ageTicks = b ? -24000 : 0;
    this.width = b ? 0.3 : 0.6; this.height = b ? 0.975 : 1.95;
  }
  get activity(): Activity { return activityAt(this.host.dayTime, this.isBaby); }
  /** Pode trocar: adulto, empregado e não é o tolo. */
  get canTrade(): boolean { return !this.isBaby && this.profession !== 'nenhuma' && this.profession !== 'tolo'; }

  registerGoals(): void {
    this.goals.add(0, new FloatGoal(this));
    this.goals.add(1, new TradeGoal(this));
    this.goals.add(1, new AvoidEntityGoal(this, (e) => e.type === 'carnical' || e.type === 'naufrago' || e.type === 'feiticeira' || e.type === 'vulto' && false, 8, 0.6, 0.75));
    this.goals.add(1, new PanicGoal(this, 0.75));
    this.goals.add(2, new SleepGoal(this));
    this.goals.add(3, new WorkGoal(this));
    this.goals.add(4, new VillagerBreedGoal(this));
    this.goals.add(5, new MeetGoal(this));
    this.goals.add(6, new VillageStrollGoal(this));
    this.goals.add(8, new LookAtPlayerGoal(this, 8, 0.05));
    this.goals.add(8, new LookAtPlayerGoal(this, 6, 0.02, (e) => e.type === 'villager'));
    this.goals.add(9, new RandomLookAroundGoal(this));
  }

  // ---------------------------------------------------------------- pontos de interesse
  private poi(p: [number, number, number] | null): Poi | undefined { return p ? this.host.pois.get(p[0], p[1], p[2]) : undefined; }
  private updatePois(): void {
    const P = this.host.pois;
    // cama
    if (this.home && !this.poi(this.home)) this.home = null;
    if (!this.home) {
      const b = P.nearest(this.x, this.y, this.z, 48, (p) => p.type === 'bed' && !p.claimedBy);
      if (b) { b.claimedBy = this.id; this.home = [b.x, b.y, b.z]; }
    }
    // sino
    if (!this.meeting || !this.poi(this.meeting)) {
      const s = P.nearest(this.x, this.y, this.z, 48, (p) => p.type === 'bell');
      this.meeting = s ? [s.x, s.y, s.z] : null;
    }
    if (this.isBaby) return;
    // bloco de trabalho
    const j = this.poi(this.job);
    if (this.job && !j) {
      this.job = null;
      // sem nenhuma troca feita, perde a profissão
      if (this.tradeXp === 0 && this.tradeLevel === 1 && this.profession !== 'tolo') { this.profession = 'nenhuma'; this.offers = []; }
    }
    if (!this.job && this.profession !== 'tolo') {
      const want = this.profession;
      const site = P.nearest(this.x, this.y, this.z, 48, (p) => p.type === 'job' && !p.claimedBy && (want === 'nenhuma' || p.job === want));
      if (site) { site.claimedBy = this.id; this.job = [site.x, site.y, site.z]; }
    }
    // assume a profissão ao chegar perto do bloco de trabalho
    if (this.job && this.profession === 'nenhuma' && this.distanceSq(this.job[0] + 0.5, this.job[1], this.job[2] + 0.5) < 6.25) {
      const pj = this.poi(this.job);
      if (pj?.job) { this.profession = pj.job as Profession; this.host.emit('particle', { kind: 'happy', x: this.x, y: this.y + 2, z: this.z, n: 5 }); }
    }
  }

  /** Reclama um ponto específico (usado na geração da vila). */
  claimAt(type: 'bed' | 'job', x: number, y: number, z: number): void {
    const p = this.host.pois.get(x, y, z);
    if (!p || p.claimedBy) return;
    p.claimedBy = this.id;
    if (type === 'bed') this.home = [x, y, z]; else this.job = [x, y, z];
  }

  // ---------------------------------------------------------------- comércio
  ensureOffers(): void {
    if (this.offers.length || !this.canTrade) return;
    this.offers = rollOffers(this.profession, 1, Math.random, []);
  }

  override interact(p: Player, st: ItemStack | null): boolean {
    if (st?.id === 'name_tag' || st?.id.endsWith('_spawn_egg')) return super.interact(p, st);
    if (this.sleeping || this.dead) return false;
    if (!this.canTrade || this.tradingPlayer) {
      this.shakeHead = 40;
      this.host.emit('sound', { name: 'villager.no', x: this.x, y: this.y, z: this.z });
      return true;
    }
    this.ensureOffers();
    this.tradingPlayer = p;
    this.nav.stop();
    this.host.emit('openTrade', { id: this.id });
    return true;
  }

  /** Chamado pela tela ao concluir uma troca. */
  onTrade(o: Offer): void {
    o.uses++;
    this.tradeXp += o.xp;
    this.host.emit('xp', { x: this.x, y: this.y + 0.5, z: this.z, amount: 3 + Math.floor(Math.random() * 4) });
    this.host.emit('sound', { name: 'villager.yes', x: this.x, y: this.y, z: this.z });
    if (this.tradeLevel < 5 && this.tradeXp >= LEVEL_XP[this.tradeLevel + 1]) this.levelUpTimer = 40;
  }

  private levelUp(): void {
    this.tradeLevel++;
    this.offers.push(...rollOffers(this.profession, this.tradeLevel, Math.random, this.offers));
    this.addEffect({ id: 'regeneration', duration: 200, amplifier: 0 });
    this.host.emit('particle', { kind: 'happy', x: this.x, y: this.y + 1, z: this.z, n: 12 });
    this.host.emit('sound', { name: 'villager.levelup', x: this.x, y: this.y, z: this.z });
  }

  /** Repõe os estoques no bloco de trabalho (até 2× por dia). */
  tryRestock(): void {
    const day = Math.floor(this.host.dayTime / 24000);
    if (day !== this.lastRestockDay) { this.lastRestockDay = day; this.restocksToday = 0; }
    if (this.restocksToday >= 2 || !this.offers.some((o) => o.uses > 0)) return;
    for (const o of this.offers) o.uses = 0;
    this.restocksToday++;
    this.host.emit('sound', { name: 'villager.work', x: this.x, y: this.y, z: this.z, prof: this.profession });
  }

  // ---------------------------------------------------------------- comida e colheita
  addStash(id: string, n: number): void {
    this.stash.set(id, (this.stash.get(id) ?? 0) + n);
    if (FOOD_VALUE[id]) this.food += FOOD_VALUE[id] * n;
  }
  takeStash(id: string, n = 1): boolean {
    const c = this.stash.get(id) ?? 0;
    if (c < n) return false;
    this.stash.set(id, c - n);
    if (FOOD_VALUE[id]) this.food = Math.max(0, this.food - FOOD_VALUE[id] * n);
    return true;
  }
  get willing(): boolean { return this.ageTicks === 0 && this.breedCooldown <= 0 && this.food >= 12 && !this.sleeping; }

  // ---------------------------------------------------------------- portas
  private handleDoors(): void {
    const L = this.host;
    const p = this.nav.path;
    if (p) {
      for (let i = 0; i < Math.min(2, p.length); i++) {
        const [x, y, z] = p[i];
        for (const yy of [y, y + 1]) {
          const s = L.getBlock(x, yy, z);
          if (SHAPE[s] !== SHAPE_IDS.door || BLOCKS[BLOCK_OF[s]].name === 'iron_door' || STATE_PROPS[s].open) continue;
          if (this.distanceSq(x + 0.5, yy, z + 0.5) > 4) continue;
          const lowerY = STATE_PROPS[s].half === 'lower' ? yy : yy - 1;
          const lo = L.getBlock(x, lowerY, z), hi = L.getBlock(x, lowerY + 1, z);
          L.setBlock(x, lowerY, z, withProp(lo, 'open', true));
          if (SHAPE[hi] === SHAPE_IDS.door) L.setBlock(x, lowerY + 1, z, withProp(hi, 'open', true));
          L.emit('sound', { name: 'door.open', x, y: lowerY, z });
          if (!this.openDoors.some((d) => d[0] === x && d[1] === lowerY && d[2] === z)) this.openDoors.push([x, lowerY, z]);
        }
      }
    }
    // fecha as portas que ficaram para trás
    for (let i = this.openDoors.length - 1; i >= 0; i--) {
      const [x, y, z] = this.openDoors[i];
      if (this.distanceSq(x + 0.5, y, z + 0.5) < 6.25) continue;
      const busy = L.entities.inBox(new AABB(x, y, z, x + 1, y + 2, z + 1), (e) => e !== this && (e as Living).health !== undefined).length > 0;
      if (busy) continue;
      const lo = L.getBlock(x, y, z), hi = L.getBlock(x, y + 1, z);
      if (SHAPE[lo] === SHAPE_IDS.door && STATE_PROPS[lo].open) {
        L.setBlock(x, y, z, withProp(lo, 'open', false));
        if (SHAPE[hi] === SHAPE_IDS.door) L.setBlock(x, y + 1, z, withProp(hi, 'open', false));
        L.emit('sound', { name: 'door.close', x, y, z });
      }
      this.openDoors.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- tick
  protected override customAi(): void {
    if (this.ageTicks < 0 && ++this.ageTicks === 0) this.setBaby(false);
    if (this.breedCooldown > 0) this.breedCooldown--;
    if (this.shakeHead > 0) this.shakeHead--;
    if (this.levelUpTimer > 0 && --this.levelUpTimer === 0) this.levelUp();
    if (this.tradingPlayer && (this.tradingPlayer.dead || this.distanceTo(this.tradingPlayer) > 8)) this.tradingPlayer = null;
    if (--this.poiTimer <= 0) { this.poiTimer = 40 + Math.floor(Math.random() * 40); this.updatePois(); }
    this.handleDoors();
    if (this.sleeping) {
      this.nav.stop();
      this.vx = this.vz = 0;
      if (this.activity !== 'rest' || this.lastHurtBy) this.wake();
    }
  }

  sleepInBed(): void {
    if (!this.home) return;
    const [x, y, z] = this.home;
    const s = this.host.getBlock(x, y, z);
    if (!BLOCKS[BLOCK_OF[s]].name.endsWith('_bed') || STATE_PROPS[s].occupied) return;
    this.sleeping = true;
    this.host.setBlock(x, y, z, withProp(s, 'occupied', true));
    this.setPos(x + 0.5, y + 0.5625, z + 0.5);
    const f = STATE_PROPS[s].facing as string;
    this.yaw = this.bodyYaw = this.yawHead = { south: 0, west: 90, north: 180, east: 270 }[f] ?? 0;
  }

  wake(): void {
    if (!this.sleeping) return;
    this.sleeping = false;
    if (this.home) {
      const [x, y, z] = this.home;
      const s = this.host.getBlock(x, y, z);
      if (BLOCKS[BLOCK_OF[s]].name.endsWith('_bed')) this.host.setBlock(x, y, z, withProp(s, 'occupied', false));
      // levanta ao lado da cama
      const g = this.findGroundNear(x, y, z + 1, 2) ?? this.findGroundNear(x + 1, y, z, 2);
      this.setPos(x + 0.5, (g ?? y + 1), z + 1.5);
    }
  }

  override aiStep(): void {
    if (this.sleeping) { this.xxa = this.zza = 0; this.jumping = false; this.vx = this.vz = 0; return; }
    super.aiStep();
  }

  override hurt(src: DamageSource, amount: number): boolean {
    const ok = super.hurt(src, amount);
    if (ok && src.attacker?.type === 'player') {
      // a sentinela defende os aldeões
      for (const e of this.host.entities.near(this.x, this.y, this.z, 16, (o) => o.type === 'sentinela')) {
        const g = e as Mob & { playerMade?: boolean };
        if (!g.playerMade) g.target = src.attacker as Living;
      }
      this.host.emit('sound', { name: 'villager.hurt', x: this.x, y: this.y, z: this.z });
    }
    if (ok && this.sleeping) this.wake();
    return ok;
  }

  override die(src: DamageSource): void {
    super.die(src);
    this.host.pois.release(this.id);
    if (this.sleeping) this.wake();
  }

  override drops(): Drop[] { return []; }

  override save(): Record<string, unknown> {
    return {
      ...super.save(), profession: this.profession, style: this.style, level: this.tradeLevel, xp: this.tradeXp, age: this.ageTicks,
      food: this.food, offers: this.offers.map(offerToJSON), home: this.home, job: this.job,
    };
  }
  override load(d: Record<string, unknown>): void {
    super.load(d);
    this.profession = (d.profession as Profession) ?? 'nenhuma'; this.style = (d.style as never) ?? 'planicie';
    this.tradeLevel = (d.level as number) ?? 1; this.tradeXp = (d.xp as number) ?? 0;
    this.setBaby(((d.age as number) ?? 0) < 0); this.ageTicks = (d.age as number) ?? 0;
    this.food = (d.food as number) ?? 0;
    this.offers = ((d.offers as Record<string, unknown>[]) ?? []).map(offerFromJSON);
    this.home = (d.home as [number, number, number]) ?? null;
    this.job = (d.job as [number, number, number]) ?? null;
    // reivindica de novo ao carregar
    if (this.home) this.claimAt('bed', ...this.home);
    if (this.job) this.claimAt('job', ...this.job);
  }
}

// ================================================================== objetivos
class TradeGoal extends Goal {
  constructor(private v: Villager) { super(); this.flags = ['move', 'look', 'jump']; }
  override get label(): string { return 'negociar'; }
  canUse(): boolean { return !!this.v.tradingPlayer; }
  override start(): void { this.v.nav.stop(); }
  override tick(): void { const p = this.v.tradingPlayer!; this.v.lookCtl.lookAt(p.x, p.y + p.eyeHeight(), p.z, 30, 30); }
}

/** Vai para casa ao anoitecer e dorme na cama. */
class SleepGoal extends Goal {
  private repath = 0;
  constructor(private v: Villager) { super(); this.flags = ['move', 'look', 'jump']; }
  override get label(): string { return 'dormir'; }
  canUse(): boolean { return this.v.activity === 'rest' && !!this.v.home && !this.v.lastHurtBy; }
  override canContinue(): boolean { return this.canUse(); }
  override stop(): void { this.v.nav.stop(); }
  override tick(): void {
    const v = this.v;
    if (v.sleeping) return;
    const [x, y, z] = v.home!;
    if (v.distanceSq(x + 0.5, y, z + 0.5) < 2.5) { v.sleepInBed(); return; }
    if (--this.repath <= 0) { this.repath = 40; v.nav.moveTo(x, y, z, 0.5, 1); }
  }
}

/** Trabalho: vai ao bloco de trabalho, repõe estoque; fazendeiro colhe e replanta. */
class WorkGoal extends Goal {
  private repath = 0;
  private farmTarget: [number, number, number] | null = null;
  private farmCooldown = 0;
  constructor(private v: Villager) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'trabalhar'; }
  canUse(): boolean { return this.v.activity === 'work' && !!this.v.job && this.v.profession !== 'nenhuma' && !this.v.tradingPlayer; }
  override stop(): void { this.v.nav.stop(); this.farmTarget = null; }
  override tick(): void {
    const v = this.v;
    const [jx, jy, jz] = v.job!;
    if (v.profession === 'fazendeiro' && this.farm()) return;
    const d2 = v.distanceSq(jx + 0.5, jy, jz + 0.5);
    if (d2 < 4) {
      v.lookCtl.lookAt(jx + 0.5, jy + 0.5, jz + 0.5, 30, 30);
      if (Math.random() < 0.01) v.tryRestock();
      return;
    }
    if (--this.repath <= 0) { this.repath = 30 + Math.floor(Math.random() * 20); v.nav.moveTo(jx, jy, jz, 0.5, 1); }
  }
  /** Colhe plantas maduras e planta em terra arada vazia perto do bloco de trabalho. */
  private farm(): boolean {
    const v = this.v, L = v.host;
    if (this.farmCooldown > 0) { this.farmCooldown--; return !!this.farmTarget; }
    if (!this.farmTarget) {
      this.farmCooldown = 20;
      const [jx, jy, jz] = v.job!;
      const cands: [number, number, number][] = [];
      for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) for (let dy = -2; dy <= 2; dy++) {
        const x = jx + dx, y = jy + dy, z = jz + dz;
        const s = L.getBlock(x, y, z);
        const n = BLOCKS[BLOCK_OF[s]].name;
        const c = CROP_ITEM[n];
        if (c && (STATE_PROPS[s].age as number) >= c[2]) cands.push([x, y, z]);
        else if (n === 'farmland' && L.getBlock(x, y + 1, z) === 0 && this.hasSeed()) cands.push([x, y + 1, z]);
      }
      if (!cands.length) return false;
      this.farmTarget = cands[Math.floor(Math.random() * cands.length)];
      v.nav.moveTo(this.farmTarget[0], this.farmTarget[1], this.farmTarget[2], 0.5, 1);
    }
    const [x, y, z] = this.farmTarget;
    if (v.distanceSq(x + 0.5, y, z + 0.5) < 3) {
      const s = L.getBlock(x, y, z);
      const n = BLOCKS[BLOCK_OF[s]].name;
      const c = CROP_ITEM[n];
      if (c && (STATE_PROPS[s].age as number) >= c[2]) {
        // colhe e replanta na hora
        const amount = n === 'wheat' ? 1 : 1 + Math.floor(Math.random() * 3);
        v.addStash(c[0], amount);
        v.addStash(c[1], 1 + Math.floor(Math.random() * 2));
        L.emit('blockBreak', { x, y, z, state: s });
        L.setBlock(x, y, z, S(n));
        v.takeStash(c[1], 1);
        // 3 trigos viram pão
        if ((v.stash.get('wheat') ?? 0) >= 3) { v.takeStash('wheat', 3); v.addStash('bread', 1); }
      } else if (s === 0 && BLOCKS[BLOCK_OF[L.getBlock(x, y - 1, z)]].name === 'farmland') {
        const seed = this.pickSeed();
        if (seed) { v.takeStash(seed[0], 1); L.setBlock(x, y, z, S(seed[1])); L.emit('sound', { name: 'plant', x, y, z }); }
      }
      v.swing();
      this.farmTarget = null;
      this.farmCooldown = 10;
    } else if (v.nav.done) this.farmTarget = null;
    return true;
  }
  private hasSeed(): boolean { return !!this.pickSeed(); }
  private pickSeed(): [string, string] | null {
    const v = this.v;
    for (const [item, block] of [['wheat_seeds', 'wheat'], ['carrot', 'carrots'], ['potato', 'potatoes'], ['beetroot_seeds', 'beetroots']] as [string, string][]) {
      if ((v.stash.get(item) ?? 0) > 0) return [item, block];
    }
    // começa com algumas sementes
    if (v.stash.size === 0) { v.addStash('wheat_seeds', 4); return ['wheat_seeds', 'wheat']; }
    return null;
  }
}

/** Encontro no sino (fim da tarde); partilha comida com vizinhos. */
class MeetGoal extends Goal {
  private repath = 0;
  constructor(private v: Villager) { super(); this.flags = ['move']; }
  override get label(): string { return 'encontro'; }
  canUse(): boolean { return this.v.activity === 'meet' && !!this.v.meeting && !this.v.tradingPlayer; }
  override stop(): void { this.v.nav.stop(); }
  override tick(): void {
    const v = this.v;
    const [x, y, z] = v.meeting!;
    if (--this.repath > 0) return;
    this.repath = 60 + Math.floor(Math.random() * 60);
    if (v.distanceSq(x + 0.5, y, z + 0.5) > 36) v.nav.moveTo(x + Math.floor(Math.random() * 7) - 3, y, z + Math.floor(Math.random() * 7) - 3, 0.5, 1);
    // partilha: quem tem muita comida dá metade a um vizinho com pouca
    if (v.food > 24) {
      const other = v.host.entities.near(v.x, v.y, v.z, 5, (e) => e.type === 'villager' && e !== v && (e as Villager).food < 12)[0] as Villager | undefined;
      if (other) {
        const give = Math.floor(v.food / 2);
        v.food -= give; other.food += give;
        v.host.emit('sound', { name: 'villager.share', x: v.x, y: v.y, z: v.z });
      }
    }
  }
}

/** Cruzamento: dois adultos dispostos e uma cama livre por perto → filhote. */
class VillagerBreedGoal extends Goal {
  private partner: Villager | null = null;
  private time = 0;
  constructor(private v: Villager) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'namorar'; }
  canUse(): boolean {
    const v = this.v;
    if (!v.willing || v.activity === 'rest' || v.activity === 'work' || Math.random() > 0.02) return false;
    if (!v.host.pois.nearest(v.x, v.y, v.z, 48, (p) => p.type === 'bed' && !p.claimedBy)) return false;
    const list = v.host.entities.near(v.x, v.y, v.z, 16, (e) => e !== v && e.type === 'villager' && (e as Villager).willing) as Villager[];
    this.partner = list[0] ?? null;
    return !!this.partner;
  }
  override canContinue(): boolean { const p = this.partner; return !!p && !p.dead && p.willing && this.time < 300; }
  override start(): void { this.time = 0; }
  override stop(): void { this.partner = null; }
  override tick(): void {
    const v = this.v, p = this.partner!;
    v.lookCtl.lookAt(p.x, p.y + p.eyeHeight(), p.z, 10, 30);
    if (v.distanceTo(p) > 2) { if (this.time % 20 === 0) v.nav.moveTo(p.x, p.y, p.z, 0.5, 1); }
    else if (++this.time % 20 === 0) v.host.emit('particle', { kind: 'heart', x: v.x, y: v.y + 2, z: v.z });
    if (this.time >= 100 && v.id < p.id) {
      v.food -= 12; p.food -= 12;
      v.breedCooldown = p.breedCooldown = 6000;
      v.host.emit('spawnMob', { mob: 'villager', x: v.x, y: v.y, z: v.z, baby: true, style: v.style });
      this.time = 300;
    }
  }
}

/** Passeio sem sair muito da vila (perto do sino/casa). */
class VillageStrollGoal extends Goal {
  private t: [number, number, number] | null = null;
  constructor(private v: Villager) { super(); this.flags = ['move']; }
  override get label(): string { return 'passear'; }
  canUse(): boolean {
    const v = this.v;
    if (v.sleeping || v.tradingPlayer || Math.random() * (v.activity === 'play' ? 20 : 120) >= 1) return false;
    const anchor = v.meeting ?? v.home;
    this.t = randomPos(v, 10, 7, true);
    if (this.t && anchor && (this.t[0] - anchor[0]) ** 2 + (this.t[2] - anchor[2]) ** 2 > 48 * 48) return false;
    return !!this.t;
  }
  override start(): void { const t = this.t!; this.v.nav.moveTo(t[0], t[1], t[2], this.v.activity === 'play' ? 0.7 : 0.5, 0); }
  override canContinue(): boolean { return !this.v.nav.done; }
}

export type { Poi };
