/**
 * Criaturas do Ínfero: fagulha (paira, rajadas de 3 bolas de fogo pequenas, ferida por água) e
 * brasal (gigante flutuante que cospe bolas de fogo explosivas — dá para rebatê-las).
 */
import type { Drop } from '../mob';
import type { Level } from '../../level';
import type { Living, DamageSource } from '../living';
import { Monster } from './monsters';
import { Goal, RandomStrollGoal, LookAtPlayerGoal, RandomLookAroundGoal, HurtByTargetGoal, NearestAttackableTargetGoal } from '../ai/goals';
import { Fireball } from '../projectiles';
import { rotlerp } from '../ai/controls';

const isPlayer = (e: Living) => e.type === 'player';

// ================================================================== fagulha
export class Fagulha extends Monster {
  readonly type = 'fagulha';
  /** chamas acesas (carregando ataque) — visual */
  charged = false;
  private allowedHeightOffset = 0.5;
  private nextHeightOffsetChange = 0;
  spin = 0;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 20; this.attackDamage = 6; this.baseSpeed = 0.23; this.followRange = 48;
    this.fireImmune = true; this.xpReward = 10; this.fallMult = 0;
    this.width = 0.6; this.height = 1.8;
  }
  get label(): string { return 'Fagulha'; }
  registerGoals(): void {
    this.goals.add(4, new BlazeAttackGoal(this));
    this.goals.add(7, new RandomStrollGoal(this, 1, 120, 10, true));
    this.goals.add(8, new LookAtPlayerGoal(this, 8));
    this.goals.add(8, new RandomLookAroundGoal(this));
    this.targets.add(1, new HurtByTargetGoal(this, true));
    this.targets.add(2, new NearestAttackableTargetGoal(this, isPlayer, true));
  }
  protected override customAi(): void {
    this.spin += 0.15;
    if (this.inWater || this.host.isRainingAt(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z))) this.hurt({ type: 'drown', bypassArmor: true }, 1);
    if (--this.nextHeightOffsetChange <= 0) { this.nextHeightOffsetChange = 100; this.allowedHeightOffset = 0.5 + (Math.random() - Math.random()) * 3; }
    const t = this.target;
    if (t && t.y + t.eyeHeight() > this.y + this.eyeHeight() + this.allowedHeightOffset && this.canReach(t)) {
      this.vy += (0.3 - this.vy) * 0.3;
    }
    if (Math.random() < 0.08) this.host.emit('particle', { kind: 'smoke', x: this.x + (Math.random() - 0.5) * this.width, y: this.y + Math.random() * this.height, z: this.z + (Math.random() - 0.5) * this.width });
  }
  override aiStep(): void {
    if (!this.onGround && this.vy < 0) this.vy *= 0.6;
    super.aiStep();
  }
  override drops(): Drop[] { return [{ id: 'ember_rod', min: 0, max: 1, playerOnly: true }]; }
}

class BlazeAttackGoal extends Goal {
  private step = 0;
  private time = 0;
  private lastSeen = 0;
  constructor(private b: Fagulha) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'rajada'; }
  canUse(): boolean { const t = this.b.target; return !!t && !t.dead && this.b.canReach(t); }
  override start(): void { this.step = 0; }
  override stop(): void { this.b.charged = false; this.lastSeen = 0; }
  override tick(): void {
    const t = this.b.target!;
    this.time--;
    const see = this.b.canSee(t);
    this.lastSeen = see ? 0 : this.lastSeen + 1;
    const d2 = this.b.distanceSq(t.x, t.y, t.z);
    if (d2 < 4) {
      if (!see) return;
      if (this.time <= 0) { this.time = 20; this.b.doHurtTarget(t); }
      this.b.moveCtl.setWanted(t.x, t.y, t.z, 1);
    } else if (d2 < this.b.followRange * this.b.followRange && see) {
      const dx = t.x - this.b.x, dy = t.y + t.height / 2 - (this.b.y + this.b.height / 2), dz = t.z - this.b.z;
      if (this.time <= 0) {
        this.step++;
        if (this.step === 1) { this.time = 60; this.b.charged = true; }
        else if (this.step <= 4) this.time = 6;
        else { this.time = 100; this.step = 0; this.b.charged = false; }
        if (this.step > 1) {
          const spread = Math.sqrt(Math.sqrt(d2)) * 0.5;
          const f = new Fireball(this.b.host, false);
          f.owner = this.b;
          f.setPos(this.b.x, this.b.y + this.b.height / 2 + 0.5, this.b.z);
          f.aim(dx, dy, dz, spread * 0.4);
          this.b.host.entities.add(f);
          this.b.host.emit('sound', { name: 'fagulha.shoot', x: this.b.x, y: this.b.y, z: this.b.z });
        }
      }
      this.b.lookCtl.lookAt(t.x, t.y + t.eyeHeight(), t.z, 10, 10);
    } else if (this.lastSeen < 5) this.b.moveCtl.setWanted(t.x, t.y, t.z, 1);
  }
}

// ================================================================== brasal (gigante flutuante)
export class Brasal extends Monster {
  readonly type = 'brasal';
  /** −40..20: carregando o tiro (abre a boca a partir de 10) */
  charge = 0;
  private wx = 0; private wy = 0; private wz = 0; private floatDelay = 0;
  tentacle = 0;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 10; this.fireImmune = true; this.noGravity = true; this.fallMult = 0;
    this.width = 4; this.height = 4; this.followRange = 100;
    this.baseSpeed = 0.1;
  }
  get label(): string { return 'Brasal'; }
  override eyeHeight(): number { return 2.6; }
  registerGoals(): void {
    this.targets.add(1, new NearestAttackableTargetGoal(this, (e) => isPlayer(e) && Math.abs(e.y - this.y) <= 4 + 60, true, 1));
  }
  get mouthOpen(): boolean { return this.charge > 10; }
  protected override customAi(): void {
    this.tentacle += 0.1;
    // flutua a esmo (RandomFloatAroundGoal)
    const dx = this.wx - this.x, dy = this.wy - this.y, dz = this.wz - this.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (--this.floatDelay <= 0 || d2 < 1 || d2 > 3600) {
      this.floatDelay = 40 + Math.floor(Math.random() * 60);
      this.wx = this.x + (Math.random() * 2 - 1) * 16; this.wy = this.y + (Math.random() * 2 - 1) * 16; this.wz = this.z + (Math.random() * 2 - 1) * 16;
    } else if (this.age % 5 === 0) {
      const d = Math.sqrt(d2);
      if (this.pathClear(dx / d, dy / d, dz / d, Math.ceil(d))) { this.vx += dx / d * 0.1; this.vy += dy / d * 0.1; this.vz += dz / d * 0.1; }
      else this.floatDelay = 0;
    }
    const t = this.target;
    if (t && !t.dead && this.distanceSq(t.x, t.y, t.z) < 4096 && this.canSee(t)) {
      this.yaw = (-Math.atan2(t.x - this.x, t.z - this.z) * 180) / Math.PI;
      this.charge++;
      if (this.charge === 10) this.host.emit('sound', { name: 'brasal.warn', x: this.x, y: this.y, z: this.z });
      if (this.charge === 20) {
        const f = new Fireball(this.host, true);
        f.owner = this;
        const r = this.yaw * Math.PI / 180;
        const ox = -Math.sin(r) * 4, oz = Math.cos(r) * 4;
        f.setPos(this.x + ox, this.y + this.height / 2 + 0.5, this.z + oz);
        f.aim(t.x - f.x, t.y + t.height / 2 - f.y, t.z - f.z);
        this.host.entities.add(f);
        this.host.emit('sound', { name: 'brasal.shoot', x: this.x, y: this.y, z: this.z });
        this.charge = -40;
      }
    } else {
      if (this.charge > 0) this.charge--;
      const h = Math.hypot(this.vx, this.vz);
      if (h > 1e-3) this.yaw = rotlerp(this.yaw, (-Math.atan2(this.vx, this.vz) * 180) / Math.PI, 10);
    }
    this.bodyYaw = this.yaw; this.yawHead = this.yaw;
  }
  private pathClear(nx: number, ny: number, nz: number, steps: number): boolean {
    let bb = this.bb;
    for (let i = 1; i < steps; i++) {
      bb = bb.offset(nx, ny, nz);
      if (!this.isFree(bb)) return false;
    }
    return true;
  }
  override travel(): void {
    this.move(this.vx, this.vy, this.vz);
    this.vx *= 0.91; this.vy *= 0.91; this.vz *= 0.91;
    this.updateLimbs();
  }
  override hurt(src: DamageSource, amount: number): boolean {
    // a própria bola de fogo rebatida mata na hora (como o original: 1000)
    if (src.type === 'explosion' && src.attacker?.type === 'player') amount = 1000;
    return super.hurt(src, amount);
  }
  override drops(): Drop[] { return [{ id: 'brasal_tear', min: 0, max: 1 }, { id: 'gunpowder', min: 0, max: 2 }]; }
}

