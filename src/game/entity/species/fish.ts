/**
 * Peixes (AbstractFish do original): nadam em 3D com leve empuxo, se debatem fora d'água e perdem ar.
 * Lambari anda em cardume, tambaqui é o peixe grande, baiacu infla e envenena, acará tem muitas cores.
 */
import { Mob, type Drop } from '../mob';
import { Goal, PanicGoal } from '../ai/goals';
import { MoveControl, rotlerp } from '../ai/controls';
import type { Level } from '../../level';
import type { Player } from '../../player/player';
import { FLAGS, F_WATER, F_WATERLOGGED } from '../../../world/blocks';

const wet = (s: number) => (FLAGS[s] & (F_WATER | F_WATERLOGGED)) !== 0;

class FishMoveControl extends MoveControl {
  override tick(): void {
    const f = this.mob as Fish;
    if (f.eyeInWater) f.vy += 0.005;
    if (this.op === 'move' && !f.nav.done) {
      this.op = 'wait';
      const target = this.speedModifier * f.baseSpeed;
      f.movementSpeed += (target - f.movementSpeed) * 0.125;
      const dx = this.wantedX - f.x, dy = this.wantedY - f.y, dz = this.wantedZ - f.z;
      if (dy !== 0) { const h = Math.hypot(dx, dy, dz); f.vy += f.movementSpeed * (dy / h) * 0.1; }
      if (dx !== 0 || dz !== 0) { f.yaw = rotlerp(f.yaw, (Math.atan2(dz, dx) * 180) / Math.PI - 90, 90); f.bodyYaw = f.yaw; }
      f.zza = f.movementSpeed;
    } else { f.movementSpeed = 0; f.zza = 0; this.op = 'wait'; }
  }
}

export abstract class Fish extends Mob {
  /** fase do rabo (animação) */
  flop = 0;
  constructor(level: Level) {
    super(level);
    this.category = 'water_ambient';
    this.maxHealth = 3;
    this.baseSpeed = 0.7;
    this.waterBreather = true;
    this.nav.aquatic = true;
    this.nav.maxNodes = 200;
    this.stepHeight = 0;
  }
  protected override createMoveControl(): MoveControl { return new FishMoveControl(this); }
  registerGoals(): void {
    this.goals.add(0, new PanicGoal(this, 1.25));
    this.goals.add(4, new SwimGoal(this));
  }
  override travel(sx: number, sy: number, sz: number): void {
    if (this.inWater) {
      this.moveRelative(0.01, sx, sy, sz);
      this.move(this.vx, this.vy, this.vz);
      this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.9;
      if (!this.target) this.vy -= 0.005;
      this.updateLimbs();
    } else super.travel(sx, sy, sz);
  }
  override aiStep(): void {
    // se debate fora d'água
    if (!this.inWater && this.onGround && this.verticalCollision) {
      this.vx += (Math.random() * 2 - 1) * 0.05; this.vy += 0.4; this.vz += (Math.random() * 2 - 1) * 0.05;
      this.onGround = false;
      this.host.emit('sound', { name: 'fish.flop', x: this.x, y: this.y, z: this.z });
    }
    super.aiStep();
  }
  protected override baseTick(): void {
    super.baseTick();
    if (!this.inWater) {
      this.airSupply--;
      if (this.airSupply <= -20) { this.airSupply = 0; this.hurt({ type: 'drown', bypassArmor: true }, 2); }
    } else this.airSupply = 300;
  }
  override walkTargetValue(x: number, y: number, z: number): number { return wet(this.host.getBlock(x, y, z)) ? 10 : -10; }
  override tick(): void {
    super.tick();
    this.flop += this.inWater ? 0.3 + Math.hypot(this.vx, this.vz) * 3 : 0.9;
  }
}

/** Nado aleatório: um ponto de água a até 10 blocos (RandomSwimmingGoal). */
class SwimGoal extends Goal {
  private t: [number, number, number] | null = null;
  constructor(private f: Fish, private interval = 40) { super(); this.flags = ['move']; }
  override get label(): string { return 'nadar'; }
  canUse(): boolean {
    if (!this.f.inWater || Math.random() * this.interval >= 1) return false;
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(this.f.x + Math.random() * 20 - 10), y = Math.floor(this.f.y + Math.random() * 14 - 7), z = Math.floor(this.f.z + Math.random() * 20 - 10);
      if (wet(this.f.host.getBlock(x, y, z))) { this.t = [x, y, z]; return true; }
    }
    return false;
  }
  override start(): void { const t = this.t!; this.f.nav.moveTo(t[0], t[1], t[2], 1, 0); }
  override canContinue(): boolean { return !this.f.nav.done && this.f.inWater; }
}

/** Cardume: segue o líder (FollowFlockLeaderGoal). */
class SchoolGoal extends Goal {
  private delay = 0;
  constructor(private f: Lambari) { super(); this.flags = ['move']; }
  canUse(): boolean {
    if (this.f.leader && !this.f.leader.dead && !this.f.leader.removed) return true;
    if (Math.random() * 200 >= 1) return false;
    const others = this.f.host.entities.near(this.f.x, this.f.y, this.f.z, 8, (e) => e.type === 'lambari' && e !== this.f) as Lambari[];
    const leader = others.find((o) => !o.leader && o.followers < 8);
    if (!leader) return false;
    this.f.leader = leader;
    leader.followers++;
    return true;
  }
  override canContinue(): boolean { const l = this.f.leader; return !!l && !l.dead && !l.removed && this.f.distanceTo(l) < 11; }
  override stop(): void { if (this.f.leader) this.f.leader.followers--; this.f.leader = null; }
  override tick(): void {
    if (--this.delay > 0) return;
    this.delay = 10;
    const l = this.f.leader!;
    const ox = ((this.f.id * 37) % 5) - 2, oz = ((this.f.id * 17) % 5) - 2;
    this.f.nav.moveTo(l.x + ox, l.y, l.z + oz, 1, 0);
  }
}

export class Lambari extends Fish {
  readonly type = 'lambari';
  leader: Lambari | null = null;
  followers = 0;
  get label(): string { return 'Lambari'; }
  constructor(level: Level) { super(level); this.width = 0.5; this.height = 0.3; }
  override registerGoals(): void { super.registerGoals(); this.goals.add(5, new SchoolGoal(this)); }
  override drops(): Drop[] { return [{ id: 'lambari', min: 1, max: 1, cookedId: 'cooked_lambari' }, { id: 'bone_meal', min: 1, max: 1, chance: 0.05 }]; }
  override experience(): number { return 1 + Math.floor(Math.random() * 3); }
}

export class Tambaqui extends Fish {
  readonly type = 'tambaqui';
  get label(): string { return 'Tambaqui'; }
  constructor(level: Level) { super(level); this.width = 0.7; this.height = 0.4; }
  override drops(): Drop[] { return [{ id: 'tambaqui', min: 1, max: 1, cookedId: 'cooked_tambaqui' }, { id: 'bone_meal', min: 1, max: 1, chance: 0.05 }]; }
  override experience(): number { return 1 + Math.floor(Math.random() * 3); }
}

export class Baiacu extends Fish {
  readonly type = 'baiacu';
  /** 0 murcho, 1 meio, 2 inflado */
  puff = 0;
  private inflateCounter = 0;
  private deflateTimer = 0;
  get label(): string { return 'Baiacu'; }
  constructor(level: Level) { super(level); this.setPuff(0); }
  setPuff(p: number): void {
    this.puff = p;
    const s = p === 0 ? 0.5 : p === 1 ? 0.7 : 1;
    this.width = 0.7 * s; this.height = 0.7 * s;
  }
  protected override customAi(): void {
    const near = this.host.entities.near(this.x, this.y, this.z, 2.5, (e) =>
      e !== this && (e.type === 'player' ? (e as Player).gameMode === 'survival' : (e as Mob).category === 'monster' || e.type === 'naufrago')).length > 0;
    if (near) {
      this.deflateTimer = 0;
      if (this.puff < 2 && ++this.inflateCounter >= (this.puff === 0 ? 1 : 40)) {
        this.setPuff(this.puff + 1); this.inflateCounter = 0;
        this.host.emit('sound', { name: 'baiacu.puff', x: this.x, y: this.y, z: this.z });
      }
    } else if (this.puff > 0 && ++this.deflateTimer > 60) {
      this.setPuff(this.puff - 1); this.deflateTimer = 0; this.inflateCounter = 0;
    }
    // espinhos: quem encosta leva dano e veneno
    if (this.puff > 0) {
      for (const e of this.host.entities.inBox(this.bb.inflate(0.3), (o) => o !== this && (o as Mob).health !== undefined)) {
        const l = e as Mob;
        if (l.type === 'player' && (l as unknown as Player).gameMode !== 'survival') continue;
        if (l.type === 'baiacu' || l.dead) continue;
        if (l.hurt({ type: 'mob', attacker: this }, 1 + this.puff)) l.addEffect({ id: 'poison', duration: 60 * this.puff, amplifier: 0 });
      }
    }
  }
  override drops(): Drop[] { return [{ id: 'baiacu', min: 1, max: 1 }, { id: 'bone_meal', min: 1, max: 1, chance: 0.05 }]; }
  override experience(): number { return 1 + Math.floor(Math.random() * 3); }
  override save(): Record<string, unknown> { return { ...super.save(), puff: this.puff }; }
}

export const ACARA_COLORS = [0xe8b52a, 0x3aafd9, 0xed8dac, 0x70b919, 0xf07613, 0xbd44b3, 0xf0f0f0, 0xa12722];
export class Acara extends Fish {
  readonly type = 'acara';
  pattern = Math.floor(Math.random() * 4);
  base = ACARA_COLORS[Math.floor(Math.random() * ACARA_COLORS.length)];
  stripe = ACARA_COLORS[Math.floor(Math.random() * ACARA_COLORS.length)];
  get label(): string { return 'Acará'; }
  constructor(level: Level) { super(level); this.width = 0.5; this.height = 0.4; }
  override drops(): Drop[] { return [{ id: 'acara', min: 1, max: 1 }, { id: 'bone_meal', min: 1, max: 1, chance: 0.05 }]; }
  override experience(): number { return 1 + Math.floor(Math.random() * 3); }
  override save(): Record<string, unknown> { return { ...super.save(), pattern: this.pattern, base: this.base, stripe: this.stripe }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.pattern = (d.pattern as number) ?? 0; this.base = (d.base as number) ?? this.base; this.stripe = (d.stripe as number) ?? this.stripe; }
}
