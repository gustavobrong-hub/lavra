/**
 * Objetivos de IA com prioridade (GoalSelector do original). Cada objetivo trava "canais"
 * (mover, olhar, pular, alvo); um objetivo de prioridade maior interrompe os de menor que usam os mesmos canais.
 * Os estados clássicos — vagar, fugir, perseguir, atacar — são objetivos aqui.
 */
import type { Mob } from '../mob';
import type { Living } from '../living';
import type { Entity } from '../entity';
import { FLAGS, F_WATER, F_WATERLOGGED } from '../../../world/blocks';

export type Flag = 'move' | 'look' | 'jump' | 'target';

export abstract class Goal {
  flags: Flag[] = [];
  abstract canUse(): boolean;
  canContinue(): boolean { return this.canUse(); }
  start(): void { /* opcional */ }
  stop(): void { /* opcional */ }
  tick(): void { /* opcional */ }
  /** não pode ser interrompido por outro de prioridade maior (ex.: pavio explodindo) */
  get interruptable(): boolean { return true; }
  /** nome para depuração (estado atual da IA) */
  get label(): string { return this.constructor.name.replace(/Goal$/, ''); }
}

interface Entry { p: number; g: Goal; running: boolean }

export class GoalSelector {
  readonly entries: Entry[] = [];
  private tickCount = 0;
  add(priority: number, g: Goal): this { this.entries.push({ p: priority, g, running: false }); this.entries.sort((a, b) => a.p - b.p); return this; }
  remove(g: Goal): void {
    const i = this.entries.findIndex((x) => x.g === g);
    if (i < 0) return;
    if (this.entries[i].running) this.entries[i].g.stop();
    this.entries.splice(i, 1);
  }
  stopAll(): void { for (const e of this.entries) if (e.running) { e.running = false; e.g.stop(); } }

  get running(): Goal[] { return this.entries.filter((e) => e.running).map((e) => e.g); }

  tick(): void {
    this.tickCount++;
    for (const e of this.entries) if (e.running && !e.g.canContinue()) { e.running = false; e.g.stop(); }
    if (this.tickCount % 2 === 0) {
      for (const e of this.entries) {
        if (e.running) continue;
        // canais ocupados por um objetivo que não cede?
        let blocked = false;
        for (const o of this.entries) {
          if (!o.running || !o.g.flags.some((f) => e.g.flags.includes(f))) continue;
          if (o.p <= e.p || !o.g.interruptable) { blocked = true; break; }
        }
        if (blocked || !e.g.canUse()) continue;
        for (const o of this.entries) if (o.running && o.p > e.p && o.g.flags.some((f) => e.g.flags.includes(f))) { o.running = false; o.g.stop(); }
        e.running = true;
        e.g.start();
      }
    }
    for (const e of this.entries) if (e.running) e.g.tick();
  }
}

const rnd = Math.random;
const isWater = (m: Mob, x: number, y: number, z: number) => (FLAGS[m.host.getBlock(x, y, z)] & (F_WATER | F_WATERLOGGED)) !== 0;

/** Posição aleatória de chão perto da criatura (DefaultRandomPos). */
export function randomPos(m: Mob, range: number, vr: number, avoidWater = true, from?: [number, number]): [number, number, number] | null {
  let best: [number, number, number] | null = null, bestV = -Infinity;
  for (let i = 0; i < 10; i++) {
    let x: number, z: number;
    if (from) {
      // longe de um ponto: direção oposta
      const dx = m.x - from[0], dz = m.z - from[1];
      const d = Math.hypot(dx, dz) || 1;
      x = Math.floor(m.x + (dx / d) * range * (0.5 + rnd() * 0.5) + (rnd() * 2 - 1) * 3);
      z = Math.floor(m.z + (dz / d) * range * (0.5 + rnd() * 0.5) + (rnd() * 2 - 1) * 3);
    } else {
      x = Math.floor(m.x + (rnd() * 2 - 1) * range);
      z = Math.floor(m.z + (rnd() * 2 - 1) * range);
    }
    const y = m.findGroundNear(x, Math.floor(m.y), z, vr);
    if (y === null) continue;
    if (avoidWater && isWater(m, x, y, z)) continue;
    const v = m.walkTargetValue(x, y, z);
    if (v > bestV) { bestV = v; best = [x, y, z]; }
  }
  return best;
}

// ------------------------------------------------------------------ comuns
export class FloatGoal extends Goal {
  constructor(private m: Mob) { super(); this.flags = ['jump']; }
  canUse(): boolean { return (this.m.inWater && this.m.waterHeight > (this.m.eyeHeight() < 0.4 ? 0.2 : 0.4)) || this.m.inLava; }
  override tick(): void { if (rnd() < 0.8) this.m.jumpCtl.jump(); }
  override get label(): string { return 'boiar'; }
}

export class RandomStrollGoal extends Goal {
  private t: [number, number, number] | null = null;
  constructor(protected m: Mob, private speed = 1, private interval = 120, private range = 10, private avoidWater = true) { super(); this.flags = ['move']; }
  override get label(): string { return 'vagar'; }
  canUse(): boolean {
    if (this.m.passenger) return false;
    if (this.m.noActionTime >= 100) return false;
    if (rnd() * this.interval >= 1) return false;
    this.t = randomPos(this.m, this.range, 7, this.avoidWater);
    return !!this.t;
  }
  override start(): void { const t = this.t!; this.m.nav.moveTo(t[0], t[1], t[2], this.speed, 0); }
  override canContinue(): boolean { return !this.m.nav.done && !this.m.passenger; }
  override stop(): void { this.m.nav.stop(); }
}

export class LookAtPlayerGoal extends Goal {
  private target: Entity | null = null;
  private time = 0;
  constructor(private m: Mob, private range = 8, private chance = 0.02, private test?: (e: Entity) => boolean) { super(); this.flags = ['look']; }
  override get label(): string { return 'olhar'; }
  canUse(): boolean {
    if (rnd() >= this.chance) return false;
    if (this.test) this.target = this.m.host.entities.near(this.m.x, this.m.y, this.m.z, this.range, (e) => e !== this.m && this.test!(e))[0] ?? null;
    else this.target = this.m.nearestPlayer(this.range);
    return !!this.target;
  }
  override canContinue(): boolean { return !!this.target && !this.target.removed && this.time > 0 && this.m.distanceTo(this.target) < this.range; }
  override start(): void { this.time = 40 + Math.floor(rnd() * 40); }
  override tick(): void { const t = this.target!; this.m.lookCtl.lookAt(t.x, t.y + (t as Living).eyeHeight(), t.z); this.time--; }
}

export class RandomLookAroundGoal extends Goal {
  private dx = 0; private dz = 0; private time = 0;
  constructor(private m: Mob) { super(); this.flags = ['look']; }
  canUse(): boolean { return rnd() < 0.02; }
  override canContinue(): boolean { return this.time >= 0; }
  override start(): void { const a = rnd() * Math.PI * 2; this.dx = Math.cos(a); this.dz = Math.sin(a); this.time = 20 + Math.floor(rnd() * 20); }
  override tick(): void { this.time--; this.m.lookCtl.lookAt(this.m.x + this.dx, this.m.y + this.m.eyeHeight(), this.m.z + this.dz); }
  override get label(): string { return 'olhar em volta'; }
}

export class PanicGoal extends Goal {
  private t: [number, number, number] | null = null;
  constructor(private m: Mob, private speed = 1.25) { super(); this.flags = ['move']; }
  override get label(): string { return 'fugir'; }
  canUse(): boolean {
    if (!this.m.lastHurtBy && this.m.fireTicks <= 0) return false;
    if (this.m.fireTicks > 0 && this.m.inWater === false) {
      // em chamas: procura água por perto
      const w = this.lookForWater();
      if (w) { this.t = w; return true; }
    }
    this.t = randomPos(this.m, 5, 4, true);
    return !!this.t;
  }
  private lookForWater(): [number, number, number] | null {
    const bx = Math.floor(this.m.x), by = Math.floor(this.m.y), bz = Math.floor(this.m.z);
    for (let r = 1; r <= 5; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = -1; dy <= 1; dy++) {
      if (isWater(this.m, bx + dx, by + dy, bz + dz)) return [bx + dx, by + dy, bz + dz];
    }
    return null;
  }
  override start(): void { const t = this.t!; this.m.nav.moveTo(t[0], t[1], t[2], this.speed, 0); }
  override canContinue(): boolean { return !this.m.nav.done; }
}

/** Foge de um tipo de entidade (aldeões de carniçais, pavios de gatos, coelhos de lobos). */
export class AvoidEntityGoal extends Goal {
  private from: Entity | null = null;
  constructor(private m: Mob, private test: (e: Entity) => boolean, private dist = 8, private walk = 1, private sprint = 1.2) { super(); this.flags = ['move']; }
  override get label(): string { return 'fugir'; }
  canUse(): boolean {
    const near = this.m.host.entities.near(this.m.x, this.m.y, this.m.z, this.dist, (e: Entity) => e !== this.m && this.test(e) && this.m.canSee(e));
    if (!near.length) return false;
    near.sort((a, b) => this.m.distanceTo(a) - this.m.distanceTo(b));
    const f = near[0];
    this.from = f;
    const p = randomPos(this.m, 16, 7, true, [f.x, f.z]);
    if (!p) return false;
    if (f.distanceSq(p[0], p[1], p[2]) < f.distanceSq(this.m.x, this.m.y, this.m.z)) return false;
    return this.m.nav.moveTo(p[0], p[1], p[2], this.walk, 0);
  }
  override canContinue(): boolean { return !this.m.nav.done; }
  override stop(): void { this.from = null; }
  override tick(): void {
    if (this.from && this.m.distanceTo(this.from) < 7) this.m.nav.setSpeed(this.sprint);
    else this.m.nav.setSpeed(this.walk);
  }
}

/** Procura sombra de dia (mortos-vivos sem capacete). */
export class FleeSunGoal extends Goal {
  private t: [number, number, number] | null = null;
  constructor(private m: Mob, private speed = 1) { super(); this.flags = ['move']; }
  override get label(): string { return 'buscar sombra'; }
  canUse(): boolean {
    if (this.m.target) return false;
    if (!this.m.host.isDay() || this.m.fireTicks <= 0 || this.m.helmet) return false;
    if (!this.m.host.canSeeSky(Math.floor(this.m.x), Math.floor(this.m.y), Math.floor(this.m.z))) return false;
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(this.m.x + rnd() * 20 - 10), z = Math.floor(this.m.z + rnd() * 20 - 10);
      const y = this.m.findGroundNear(x, Math.floor(this.m.y), z, 3);
      if (y !== null && !this.m.host.canSeeSky(x, y, z)) { this.t = [x, y, z]; return true; }
    }
    return false;
  }
  override start(): void { const t = this.t!; this.m.nav.moveTo(t[0], t[1], t[2], this.speed, 0); }
  override canContinue(): boolean { return !this.m.nav.done; }
}

// ------------------------------------------------------------------ combate
export class MeleeAttackGoal extends Goal {
  protected ticksUntilAttack = 0;
  private repath = 0;
  private lastTx = 0; private lastTy = 0; private lastTz = 0;
  constructor(protected m: Mob, private speed = 1, private followWithoutSight = false) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'atacar'; }
  canUse(): boolean {
    const t = this.m.target;
    if (!t || t.dead || t.removed || !this.m.canReach(t)) return false;
    return this.m.nav.moveTo(t.x, t.y, t.z, this.speed, 0) || this.inReach(t);
  }
  override canContinue(): boolean {
    const t = this.m.target;
    if (!t || t.dead || t.removed || !this.m.canReach(t)) return false;
    if (!this.followWithoutSight) return !this.m.nav.done || this.inReach(t) || this.m.distanceTo(t) < 16;
    return this.m.distanceTo(t) < this.m.followRange;
  }
  override start(): void { this.ticksUntilAttack = 0; this.repath = 0; }
  override stop(): void { this.m.nav.stop(); }
  protected reachSq(t: Living): number { return (this.m.width * 2) ** 2 + t.width; }
  protected inReach(t: Living): boolean { return this.m.distanceSq(t.x, t.y, t.z) <= this.reachSq(t); }
  override tick(): void {
    const t = this.m.target;
    if (!t) return;
    this.m.lookCtl.lookAt(t.x, t.y + t.eyeHeight(), t.z, 30, 30);
    this.repath = Math.max(this.repath - 1, 0);
    const moved = (t.x - this.lastTx) ** 2 + (t.y - this.lastTy) ** 2 + (t.z - this.lastTz) ** 2 >= 1;
    if ((this.followWithoutSight || this.m.canSee(t)) && this.repath <= 0 && (moved || rnd() < 0.05 || this.m.nav.done)) {
      this.lastTx = t.x; this.lastTy = t.y; this.lastTz = t.z;
      this.repath = 4 + Math.floor(rnd() * 7);
      const d = this.m.distanceTo(t);
      if (d > 32) this.repath += 10; else if (d > 16) this.repath += 5;
      if (!this.m.nav.moveTo(t.x, t.y, t.z, this.speed, 0)) this.repath += 15;
    }
    this.ticksUntilAttack = Math.max(this.ticksUntilAttack - 1, 0);
    if (this.inReach(t) && this.ticksUntilAttack <= 0 && this.m.canSee(t)) {
      this.ticksUntilAttack = 20;
      this.m.swing();
      this.m.doHurtTarget(t);
    }
  }
}

/** Salto no alvo (tecelã, lobo). */
export class LeapAtTargetGoal extends Goal {
  constructor(private m: Mob, private yd = 0.4) { super(); this.flags = ['jump', 'move']; }
  override get label(): string { return 'saltar'; }
  canUse(): boolean {
    const t = this.m.target;
    if (!t || !this.m.onGround) return false;
    const d2 = this.m.distanceSq(t.x, t.y, t.z);
    if (d2 < 4 || d2 > 16) return false;
    return rnd() * 5 < 1;
  }
  override canContinue(): boolean { return !this.m.onGround; }
  override start(): void {
    const t = this.m.target!;
    let dx = t.x - this.m.x, dz = t.z - this.m.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) { dx = dx / d * 0.4 + this.m.vx * 0.2; dz = dz / d * 0.4 + this.m.vz * 0.2; }
    this.m.vx = dx; this.m.vz = dz; this.m.vy = this.yd;
  }
}

/** Alvo: a entidade aceita mais próxima (jogador, na maioria). */
export class NearestAttackableTargetGoal extends Goal {
  private unseen = 0;
  constructor(protected m: Mob, private accept: (e: Living) => boolean, private mustSee = true, private chance = 10) { super(); this.flags = ['target']; }
  override get label(): string { return 'mirar'; }
  canUse(): boolean {
    if (this.chance > 0 && rnd() * this.chance >= 1) return false;
    const range = this.m.followRange;
    const list = this.m.host.entities.near(this.m.x, this.m.y, this.m.z, range, (e: Entity) => e !== this.m && (e as Living).health !== undefined && this.accept(e as Living)) as Living[];
    let best: Living | null = null, bd = Infinity;
    for (const e of list) {
      if (e.dead || !this.m.canReach(e)) continue;
      // jogador agachado é notado a 80% da distância
      let r = range;
      if (e.type === 'player' && e.isSneaking()) r *= 0.8;
      if (e.hasEffect('invisibility')) r *= 0.07;
      const d = this.m.distanceTo(e);
      if (d > r) continue;
      if (this.mustSee && !this.m.canSee(e)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return false;
    this.m.target = best;
    return true;
  }
  override start(): void { this.unseen = 0; }
  override canContinue(): boolean {
    const t = this.m.target;
    if (!t || t.dead || t.removed || !this.m.canReach(t) || this.m.distanceTo(t) > this.m.followRange) return false;
    if (this.mustSee) {
      if (this.m.canSee(t)) this.unseen = 0;
      else if (++this.unseen > 60) return false;
    }
    return true;
  }
  override stop(): void { this.m.target = null; }
}

/** Revida quem bateu (e chama os iguais, se pedido). */
export class HurtByTargetGoal extends Goal {
  private stamp = -1;
  constructor(private m: Mob, private callForHelp = false, private except: string[] = []) { super(); this.flags = ['target']; }
  override get label(): string { return 'revidar'; }
  canUse(): boolean {
    const a = this.m.lastHurtBy;
    if (!a || a.dead || a.removed || this.m.lastHurtTime === this.stamp) return false;
    if (this.except.includes(a.type)) return false;
    if (a.type === 'player' && (a as Living & { gameMode?: string }).gameMode !== 'survival') return false;
    return true;
  }
  override start(): void {
    const a = this.m.lastHurtBy!;
    this.m.target = a;
    this.stamp = this.m.lastHurtTime;
    if (this.callForHelp) {
      for (const e of this.m.host.entities.near(this.m.x, this.m.y, this.m.z, 10, (o: Entity) => o.type === this.m.type && o !== this.m)) {
        const o = e as Mob;
        if (!o.target && !o.dead) { o.target = a; }
      }
    }
  }
  override canContinue(): boolean { const t = this.m.target; return !!t && !t.dead && !t.removed && this.m.canReach(t) && this.m.distanceTo(t) < this.m.followRange; }
  override stop(): void { this.m.target = null; }
}

/** Ataque à distância com arco (RangedBowAttackGoal): mantém distância, anda de lado, puxa por 20 ticks. */
export class RangedBowAttackGoal extends Goal {
  private seeTime = 0;
  private strafeTime = -1;
  private strafeCw = false;
  private strafeBack = false;
  private attackTime = -1;
  drawing = 0;
  constructor(private m: Mob & { shootArrow(t: Living, power: number): void }, private speed = 1, private interval = 20, private radius = 15) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'atirar'; }
  canUse(): boolean { const t = this.m.target; return !!t && !t.dead && this.m.mainHand?.id === 'bow'; }
  override canContinue(): boolean { return (this.canUse() || !this.m.nav.done) && !!this.m.target && this.m.mainHand?.id === 'bow'; }
  override stop(): void { this.seeTime = 0; this.attackTime = -1; this.drawing = 0; this.m.nav.stop(); }
  override tick(): void {
    const t = this.m.target;
    if (!t) return;
    const d2 = this.m.distanceSq(t.x, t.y, t.z);
    const see = this.m.canSee(t);
    if (see !== this.seeTime > 0) this.seeTime = 0;
    if (see) this.seeTime++; else this.seeTime--;
    if (d2 <= this.radius * this.radius && this.seeTime >= 20) { this.m.nav.stop(); this.strafeTime++; }
    else { this.m.nav.moveTo(t.x, t.y, t.z, this.speed); this.strafeTime = -1; }
    if (this.strafeTime >= 20) {
      if (rnd() < 0.3) this.strafeCw = !this.strafeCw;
      if (rnd() < 0.3) this.strafeBack = !this.strafeBack;
      this.strafeTime = 0;
    }
    if (this.strafeTime > -1) {
      if (d2 > this.radius * this.radius * 0.75) this.strafeBack = false;
      else if (d2 < this.radius * this.radius * 0.25) this.strafeBack = true;
      this.m.moveCtl.strafe(this.strafeBack ? -0.5 : 0.5, this.strafeCw ? 0.5 : -0.5);
      this.m.lookCtl.lookAt(t.x, t.y + t.eyeHeight(), t.z, 30, 30);
      this.m.yaw = this.m.yawHead;
    } else this.m.lookCtl.lookAt(t.x, t.y + t.eyeHeight(), t.z, 30, 30);
    if (this.drawing > 0) {
      if (!see && this.seeTime < -60) this.drawing = 0;
      else if (see) {
        this.drawing++;
        if (this.drawing >= 20) {
          this.drawing = 0;
          this.m.shootArrow(t, 1);
          this.attackTime = this.interval;
        }
      }
    } else if (--this.attackTime <= 0 && this.seeTime >= -60) this.drawing = 1;
  }
}
