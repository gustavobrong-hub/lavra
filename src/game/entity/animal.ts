/**
 * Animais (AgeableMob/Animal/TamableAnimal do original): idade (filhote −24000 → adulto), cruzamento com
 * comida (600 ticks "apaixonado", 6000 ticks de espera), seguir quem segura comida, filhotes seguem os pais,
 * e domesticação com dono, sentar e seguir.
 */
import { Mob, type Drop } from './mob';
import type { Level } from '../level';
import type { Living } from './living';
import type { Player } from '../player/player';
import type { ItemStack } from '../items/stack';
import { Goal } from './ai/goals';

export abstract class Animal extends Mob {
  /** idade: < 0 filhote (cresce até 0); > 0 espera para cruzar de novo */
  ageTicks = 0;
  inLove = 0;
  loveCause: Player | null = null;
  /** comidas de cruzamento */
  abstract readonly foods: readonly string[];

  constructor(host: Level) {
    super(host);
    this.category = 'creature';
    this.persistent = true;
    this.xpReward = 0;
  }

  override get isBaby(): boolean { return this.ageTicks < 0; }
  setBaby(b: boolean): void { this.ageTicks = b ? -24000 : 0; this.refreshSize(); }
  /** tamanho adulto (largura, altura) — filhotes têm metade */
  abstract get adultSize(): [number, number];
  refreshSize(): void {
    const [w, h] = this.adultSize;
    const k = this.isBaby ? 0.5 : 1;
    this.width = w * k; this.height = h * k;
  }
  override init(): this { super.init(); this.refreshSize(); return this; }

  isFood(st: ItemStack | null): boolean { return !!st && this.foods.includes(st.id); }
  canFallInLove(): boolean { return this.ageTicks === 0 && this.inLove <= 0; }
  canMate(o: Animal): boolean { return o !== this && o.type === this.type && this.inLove > 0 && o.inLove > 0 && !o.dead; }

  /** Cria o filhote (subclasses podem misturar cores/atributos). */
  abstract makeBaby(partner: Animal): Animal;

  override tick(): void {
    super.tick();
    if (this.dead || this.removed) return;
    if (this.ageTicks < 0) { this.ageTicks++; if (this.ageTicks === 0) this.refreshSize(); }
    else if (this.ageTicks > 0) this.ageTicks--;
    if (this.inLove > 0) {
      this.inLove--;
      if (this.inLove % 10 === 0) this.host.emit('particle', { kind: 'heart', x: this.x, y: this.y + this.height + 0.2, z: this.z });
    }
  }

  override hurt(src: import('./living').DamageSource, amount: number): boolean {
    this.inLove = 0;
    return super.hurt(src, amount);
  }

  /** Interação com item na mão (clique direito). Retorna true se consumiu a ação. */
  override interact(p: Player, st: ItemStack | null): boolean {
    if (this.isFood(st)) {
      if (this.isBaby) {
        // alimentar filhote acelera 10% do que falta
        this.ageTicks += Math.floor(-this.ageTicks * 0.1);
        this.useItem(p);
        this.host.emit('particle', { kind: 'happy', x: this.x, y: this.y + this.height, z: this.z });
        return true;
      }
      if (this.canFallInLove()) {
        this.useItem(p);
        this.inLove = 600;
        this.loveCause = p;
        this.host.emit('mobEat', { id: this.id, mob: this.type, x: this.x, y: this.y, z: this.z });
        return true;
      }
    }
    return super.interact(p, st);
  }

  protected useItem(p: Player): void {
    if (p.gameMode !== 'creative') p.inventory.consumeHeld(1);
  }

  /** Nasce o filhote entre os dois pais; XP 1–7 para quem alimentou. */
  breedWith(o: Animal): void {
    const baby = this.makeBaby(o);
    baby.setBaby(true);
    baby.setPos(this.x, this.y, this.z);
    baby.yaw = baby.bodyYaw = baby.yawHead = this.yaw;
    this.host.entities.add(baby);
    this.ageTicks = 6000; o.ageTicks = 6000;
    this.inLove = 0; o.inLove = 0;
    const cause = this.loveCause ?? o.loveCause;
    if (cause) this.host.emit('xp', { x: this.x, y: this.y + 0.5, z: this.z, amount: 1 + Math.floor(Math.random() * 7) });
    this.host.emit('particle', { kind: 'heart', x: this.x, y: this.y + this.height, z: this.z, n: 7 });
  }

  override drops(): Drop[] { return []; }

  override experience(): number { return 1 + Math.floor(Math.random() * 3); }

  override save(): Record<string, unknown> { return { ...super.save(), age: this.ageTicks }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.ageTicks = (d.age as number) ?? 0; this.refreshSize(); }
}

/** Animal que pode ser domesticado (lobo-guará, gato, cavalo). */
export abstract class Tamable extends Animal {
  ownerId = 0;
  sitting = false;
  get tame(): boolean { return this.ownerId !== 0; }
  owner(): Player | null { return this.host.players.find((p) => p.id === this.ownerId) ?? null; }
  tameBy(p: Player): void {
    this.ownerId = p.id;
    this.persistent = true;
    this.nav.stop();
    this.target = null;
    this.host.emit('particle', { kind: 'heart', x: this.x, y: this.y + this.height, z: this.z, n: 7 });
    this.onTamed();
  }
  protected onTamed(): void { /* vida/atributos */ }
  override save(): Record<string, unknown> { return { ...super.save(), owner: this.ownerId ? 1 : 0, sitting: this.sitting }; }
  override load(d: Record<string, unknown>): void {
    super.load(d);
    // o dono é sempre o jogador local (id muda entre sessões)
    if (d.owner) { const p = this.host.players[0]; if (p) this.ownerId = p.id; }
    this.sitting = !!d.sitting;
  }
}

// ================================================================== objetivos de animais
export class BreedGoal extends Goal {
  private partner: Animal | null = null;
  private loveTime = 0;
  constructor(private a: Animal, private speed = 1) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'cruzar'; }
  canUse(): boolean {
    if (this.a.inLove <= 0) return false;
    const list = this.a.host.entities.near(this.a.x, this.a.y, this.a.z, 8, (e) => e !== this.a && e.type === this.a.type) as Animal[];
    let best: Animal | null = null, bd = Infinity;
    for (const o of list) if (this.a.canMate(o)) { const d = this.a.distanceTo(o); if (d < bd) { bd = d; best = o; } }
    this.partner = best;
    return !!best;
  }
  override canContinue(): boolean { const p = this.partner; return !!p && !p.dead && p.inLove > 0 && this.loveTime < 60; }
  override start(): void { this.loveTime = 0; }
  override stop(): void { this.partner = null; this.loveTime = 0; }
  override tick(): void {
    const p = this.partner!;
    this.a.lookCtl.lookAt(p.x, p.y + p.eyeHeight(), p.z, 10, this.a.headPitchMax);
    this.a.nav.moveTo(p.x, p.y, p.z, this.speed);
    this.loveTime++;
    if (this.loveTime >= 60 && this.a.distanceTo(p) < 3) this.a.breedWith(p);
  }
}

export class TemptGoal extends Goal {
  private player: Player | null = null;
  private calm = 0;
  constructor(private m: Mob, private speed: number, private isTempting: (st: ItemStack | null) => boolean) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'seguir comida'; }
  canUse(): boolean {
    if (this.calm > 0) { this.calm--; return false; }
    this.player = this.m.host.nearestPlayer(this.m.x, this.m.y, this.m.z, 10, (p) => !p.dead && p.gameMode !== 'spectator' && (this.isTempting(p.inventory.held) || this.isTempting(p.inventory.offhand)));
    return !!this.player;
  }
  override canContinue(): boolean { return this.canUse(); }
  override stop(): void { this.player = null; this.m.nav.stop(); this.calm = 100; }
  override tick(): void {
    const p = this.player!;
    this.m.lookCtl.lookAt(p.x, p.y + p.eyeHeight(), p.z, this.m.headYawMax + 20, this.m.headPitchMax);
    if (this.m.distanceSq(p.x, p.y, p.z) < 6.25) this.m.nav.stop();
    else this.m.nav.moveTo(p.x, p.y, p.z, this.speed);
  }
}

export class FollowParentGoal extends Goal {
  private parent: Animal | null = null;
  private delay = 0;
  constructor(private a: Animal, private speed = 1.1) { super(); this.flags = ['move']; }
  override get label(): string { return 'seguir mãe'; }
  canUse(): boolean {
    if (!this.a.isBaby) return false;
    const list = this.a.host.entities.near(this.a.x, this.a.y, this.a.z, 8, (e) => e.type === this.a.type && !(e as Animal).isBaby) as Animal[];
    let best: Animal | null = null, bd = Infinity;
    for (const o of list) { const d = this.a.distanceSq(o.x, o.y, o.z); if (d < bd) { bd = d; best = o; } }
    if (!best || bd < 9) return false;
    this.parent = best;
    return true;
  }
  override canContinue(): boolean {
    const p = this.parent;
    if (!this.a.isBaby || !p || p.dead) return false;
    const d = this.a.distanceSq(p.x, p.y, p.z);
    return d >= 9 && d <= 256;
  }
  override start(): void { this.delay = 0; }
  override stop(): void { this.parent = null; }
  override tick(): void { if (--this.delay <= 0) { this.delay = 10; const p = this.parent!; this.a.nav.moveTo(p.x, p.y, p.z, this.speed); } }
}

/** Sentado por ordem do dono. */
export class SitWhenOrderedGoal extends Goal {
  constructor(private t: Tamable) { super(); this.flags = ['jump', 'move']; }
  override get label(): string { return 'sentado'; }
  canUse(): boolean {
    if (!this.t.tame || this.t.inWater || !this.t.onGround) return false;
    const o = this.t.owner();
    if (!o) return true;
    if (this.t.distanceSq(o.x, o.y, o.z) < 144 && o.lastHurtBy && o.age - o.lastHurtTime < 20) return false;
    return this.t.sitting;
  }
  override start(): void { this.t.nav.stop(); }
}

/** Segue o dono; teleporta se ficar longe (> 12 blocos). */
export class FollowOwnerGoal extends Goal {
  private delay = 0;
  constructor(private t: Tamable, private speed = 1, private start_ = 10, private stop_ = 2) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'seguir dono'; }
  canUse(): boolean {
    const o = this.t.owner();
    if (!o || o.dead || this.t.sitting || o.gameMode === 'spectator') return false;
    return this.t.distanceSq(o.x, o.y, o.z) >= this.start_ * this.start_;
  }
  override canContinue(): boolean {
    const o = this.t.owner();
    if (!o || this.t.sitting) return false;
    return this.t.distanceSq(o.x, o.y, o.z) > this.stop_ * this.stop_ && !this.t.nav.done || this.t.distanceSq(o.x, o.y, o.z) >= this.start_ * this.start_;
  }
  override start(): void { this.delay = 0; }
  override stop(): void { this.t.nav.stop(); }
  override tick(): void {
    const o = this.t.owner()!;
    this.t.lookCtl.lookAt(o.x, o.y + o.eyeHeight(), o.z, 10, this.t.headPitchMax);
    if (--this.delay > 0) return;
    this.delay = 10;
    if (this.t.distanceSq(o.x, o.y, o.z) >= 144) this.teleportToOwner(o);
    else this.t.nav.moveTo(o.x, o.y, o.z, this.speed);
  }
  private teleportToOwner(o: Player): void {
    const bx = Math.floor(o.x), by = Math.floor(o.y), bz = Math.floor(o.z);
    for (let i = 0; i < 10; i++) {
      const x = bx + Math.floor(Math.random() * 7) - 3, z = bz + Math.floor(Math.random() * 7) - 3;
      if (Math.abs(x - bx) < 2 && Math.abs(z - bz) < 2) continue;
      const y = this.t.findGroundNear(x, by, z, 1);
      if (y === null) continue;
      this.t.setPos(x + 0.5, y, z + 0.5);
      this.t.nav.stop();
      return;
    }
  }
}

/** Ataca quem feriu o dono. */
export class OwnerHurtByTargetGoal extends Goal {
  private stamp = -1;
  constructor(private t: Tamable) { super(); this.flags = ['target']; }
  canUse(): boolean {
    if (!this.t.tame || this.t.sitting) return false;
    const o = this.t.owner();
    const a = o?.lastHurtBy;
    if (!o || !a || a.dead || o.lastHurtTime === this.stamp || a === this.t) return false;
    if ((a as Tamable).ownerId === this.t.ownerId) return false;
    return true;
  }
  override start(): void { const o = this.t.owner()!; this.t.target = o.lastHurtBy; this.stamp = o.lastHurtTime; }
  override canContinue(): boolean { const x = this.t.target; return !!x && !x.dead && !x.removed && this.t.distanceTo(x) < 24; }
  override stop(): void { this.t.target = null; }
}

/** Ataca o que o dono atacou. */
export class OwnerHurtTargetGoal extends Goal {
  private last: Living | null = null;
  constructor(private t: Tamable) { super(); this.flags = ['target']; }
  canUse(): boolean {
    if (!this.t.tame || this.t.sitting) return false;
    const o = this.t.owner();
    const a = o?.lastHurtMob;
    if (!o || !a || a.dead || a === this.last || a === this.t) return false;
    if ((a as Tamable).ownerId === this.t.ownerId || a.type === 'pavio') return false;
    return true;
  }
  override start(): void { const o = this.t.owner()!; this.t.target = o.lastHurtMob; this.last = o.lastHurtMob; }
  override canContinue(): boolean { const x = this.t.target; return !!x && !x.dead && !x.removed && this.t.distanceTo(x) < 24; }
  override stop(): void { this.t.target = null; }
}

/** Come o bloco sob os pés (ovelha: grama → terra) — recupera a lã. */
export class EatBlockGoal extends Goal {
  timer = 0;
  constructor(private a: Animal, private onEat: () => void) { super(); this.flags = ['move', 'look', 'jump']; }
  override get label(): string { return 'pastar'; }
  canUse(): boolean {
    if (Math.random() * (this.a.isBaby ? 50 : 1000) >= 1) return false;
    const bx = Math.floor(this.a.x), by = Math.floor(this.a.y), bz = Math.floor(this.a.z);
    const here = this.a.host.world.getBlock(bx, by, bz), below = this.a.host.world.getBlock(bx, by - 1, bz);
    return isGrassPlant(here) || isGrassBlock(below);
  }
  override start(): void { this.timer = 40; this.a.nav.stop(); this.a.host.emit('entityEvent', { id: this.a.id, event: 'eatGrass' }); }
  override stop(): void { this.timer = 0; }
  override canContinue(): boolean { return this.timer > 0; }
  override tick(): void {
    this.timer = Math.max(0, this.timer - 1);
    if (this.timer !== 4) return;
    const L = this.a.host;
    const bx = Math.floor(this.a.x), by = Math.floor(this.a.y), bz = Math.floor(this.a.z);
    const here = L.world.getBlock(bx, by, bz);
    if (isGrassPlant(here)) {
      if (L.rules.mobGriefing) L.breakBlock(bx, by, bz, { drop: false });
      this.onEat();
    } else if (isGrassBlock(L.world.getBlock(bx, by - 1, bz))) {
      if (L.rules.mobGriefing) { L.emit('blockBreak', { x: bx, y: by - 1, z: bz, state: L.world.getBlock(bx, by - 1, bz) }); L.setBlock(bx, by - 1, bz, DIRT()); }
      this.onEat();
    }
  }
}

import { BLOCKS, BLOCK_OF, S } from '../../world/blocks';
let dirtState = -1;
const DIRT = () => (dirtState < 0 ? (dirtState = S('dirt')) : dirtState);
function isGrassPlant(s: number): boolean { const n = BLOCKS[BLOCK_OF[s]].name; return n === 'short_grass'; }
function isGrassBlock(s: number): boolean { return BLOCKS[BLOCK_OF[s]].name === 'grass_block'; }
