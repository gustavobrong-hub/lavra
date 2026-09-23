/**
 * Entidade viva: vida, dano (com armadura e tempo de invulnerabilidade), efeitos de status,
 * e o "travel" do original (terra, água, lava, escadas de mão, voo).
 */
import { Entity, type EntityHost } from './entity';
import { FLAGS, F_CLIMBABLE, BLOCKS, BLOCK_OF } from '../../world/blocks/registry';

export interface StatusEffect { id: string; amplifier: number; duration: number; ambient?: boolean }

export interface DamageSource {
  type: 'generic' | 'fall' | 'drown' | 'fire' | 'lava' | 'onFire' | 'suffocate' | 'void' | 'starve' | 'mob' | 'player' | 'arrow' | 'explosion' | 'magic' | 'cactus' | 'lightning' | 'wither' | 'freeze' | 'thorns' | 'kill';
  attacker?: Entity;
  /** ignora armadura */
  bypassArmor?: boolean;
  /** posição de origem (para knockback) */
  from?: [number, number, number];
}

export const BLOCK_FRICTION = (s: number): number => {
  const d = BLOCKS[BLOCK_OF[s]].def;
  return d.friction ?? 0.6;
};

export abstract class Living extends Entity {
  health = 20;
  maxHealth = 20;
  absorption = 0;
  hurtTime = 0;
  hurtDuration = 10;
  deathTime = 0;
  invulnerableTime = 0;
  lastHurt = 0;
  dead = false;
  readonly effects = new Map<string, StatusEffect>();
  /** entrada de movimento: strafe (+esquerda), forward, jumping */
  xxa = 0;
  zza = 0;
  jumping = false;
  noJumpDelay = 0;
  sprinting = false;
  /** atributos */
  movementSpeed = 0.1;
  flyingSpeed = 0.02;
  jumpPower = 0.42;
  armorValue = 0;
  armorToughness = 0;
  knockbackResistance = 0;
  airSupply = 300;
  maxAirSupply = 300;
  yawHead = 0;
  prevYawHead = 0;
  bodyYaw = 0;
  prevBodyYaw = 0;
  limbSwing = 0;
  limbSwingAmount = 0;
  prevLimbSwingAmount = 0;
  attackAnim = 0;
  prevAttackAnim = 0;
  swinging = false;
  swingTime = 0;

  constructor(host: EntityHost) { super(host); }

  hasEffect(id: string): boolean { return this.effects.has(id); }
  effectLevel(id: string): number { const e = this.effects.get(id); return e ? e.amplifier + 1 : 0; }

  addEffect(e: StatusEffect): void {
    const cur = this.effects.get(e.id);
    if (!cur || e.amplifier > cur.amplifier || (e.amplifier === cur.amplifier && e.duration > cur.duration)) this.effects.set(e.id, { ...e });
  }

  /** Velocidade de movimento efetiva (com corrida e efeitos). */
  getSpeed(): number {
    let s = this.movementSpeed;
    if (this.sprinting) s *= 1.3;
    const sp = this.effectLevel('speed'), sl = this.effectLevel('slowness');
    if (sp) s *= 1 + 0.2 * sp;
    if (sl) s *= Math.max(0, 1 - 0.15 * sl);
    return s;
  }

  getFlyingSpeed(): number { return this.sprinting ? 0.026 : 0.02; }

  /** Pulo (jumpFromGround). */
  jumpFromGround(): void {
    const under = BLOCKS[BLOCK_OF[this.blockUnder()]].def;
    const jf = under.jumpFactor ?? 1;
    this.vy = this.jumpPower * jf + 0.1 * this.effectLevel('jump_boost');
    if (this.sprinting) {
      const f = this.yaw * Math.PI / 180;
      this.vx += -Math.sin(f) * 0.2;
      this.vz += Math.cos(f) * 0.2;
    }
  }

  moveRelative(speed: number, sx: number, sy: number, sz: number): void {
    const len2 = sx * sx + sy * sy + sz * sz;
    if (len2 < 1e-7) return;
    let ix = sx, iy = sy, iz = sz;
    if (len2 > 1) { const l = Math.sqrt(len2); ix /= l; iy /= l; iz /= l; }
    ix *= speed; iy *= speed; iz *= speed;
    const f = Math.sin(this.yaw * Math.PI / 180), c = Math.cos(this.yaw * Math.PI / 180);
    this.vx += ix * c - iz * f;
    this.vy += iy;
    this.vz += iz * c + ix * f;
  }

  override onClimbable(): boolean {
    const s = this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    return (FLAGS[s] & F_CLIMBABLE) !== 0;
  }

  /** O jogador agachado segura na escada de mão. */
  suppressSlidingDownLadder(): boolean { return false; }
  isFlying(): boolean { return false; }

  /** Um tick de física (aiStep + travel do original). */
  aiStep(): void {
    if (this.noJumpDelay > 0) this.noJumpDelay--;
    if (Math.abs(this.vx) < 0.003) this.vx = 0;
    if (Math.abs(this.vy) < 0.003) this.vy = 0;
    if (Math.abs(this.vz) < 0.003) this.vz = 0;
    // pulo e natação
    if (this.jumping) {
      const fluidH = this.waterHeight;
      const inWaterDeep = this.inWater && fluidH > 0;
      const threshold = this.eyeHeight() < 0.4 ? 0 : 0.4;
      if (!inWaterDeep || (this.onGround && !(fluidH > threshold))) {
        if (!this.inLava || (this.onGround && !(fluidH > threshold))) {
          if ((this.onGround || (inWaterDeep && fluidH <= threshold)) && this.noJumpDelay === 0) {
            this.jumpFromGround();
            this.onJump();
            this.noJumpDelay = 10;
          }
        } else this.vy += 0.04;
      } else this.vy += 0.04;
    } else this.noJumpDelay = 0;
    this.xxa *= 0.98;
    this.zza *= 0.98;
    this.travel(this.xxa, 0, this.zza);
  }

  protected onJump(): void { /* exaustão no jogador */ }

  travel(sx: number, sy: number, sz: number): void {
    const gravity = this.vy <= 0 && this.hasEffect('slow_falling') ? 0.01 : 0.08;
    const falling = this.vy <= 0;
    if (this.hasEffect('slow_falling') && falling) this.fallDistance = 0;
    if (this.inWater && !this.isFlying()) {
      const y0 = this.y;
      let slow = this.sprinting ? 0.9 : 0.8;
      let speed = 0.02;
      const ds = this.depthStrider();
      if (ds > 0) {
        const k = Math.min(ds, 3) / 3 * (this.onGround ? 1 : 0.5);
        slow += (0.546 - slow) * k;
        speed += (this.getSpeed() - speed) * k;
      }
      if (this.hasEffect('dolphins_grace')) slow = 0.96;
      this.moveRelative(speed, sx, sy, sz);
      this.move(this.vx, this.vy, this.vz);
      if (this.horizontalCollision && this.onClimbable()) this.vy = 0.2;
      this.vx *= slow; this.vy *= 0.8; this.vz *= slow;
      if (!this.noGravity && !this.sprinting) {
        if (falling && Math.abs(this.vy - 0.005) >= 0.003 && Math.abs(this.vy - gravity / 16) < 0.003) this.vy = -0.003;
        else this.vy -= gravity / 16;
      }
      if (this.horizontalCollision && this.isFree(this.bb.offset(this.vx, this.vy + 0.6 - this.y + y0, this.vz))) this.vy = 0.3;
    } else if (this.inLava && !this.isFlying()) {
      const y0 = this.y;
      this.moveRelative(0.02, sx, sy, sz);
      this.move(this.vx, this.vy, this.vz);
      if (this.waterHeight <= (this.eyeHeight() < 0.4 ? 0 : 0.4)) {
        this.vx *= 0.5; this.vy *= 0.8; this.vz *= 0.5;
        if (!this.noGravity) this.vy -= gravity / 16;
      } else { this.vx *= 0.5; this.vy *= 0.5; this.vz *= 0.5; }
      if (!this.noGravity) this.vy -= gravity / 4;
      if (this.horizontalCollision && this.isFree(this.bb.offset(this.vx, this.vy + 0.6 - this.y + y0, this.vz))) this.vy = 0.3;
    } else {
      const under = this.blockUnder();
      const f2 = BLOCK_FRICTION(under);
      const f3 = this.onGround ? f2 * 0.91 : 0.91;
      const speed = this.onGround ? this.getSpeed() * (0.21600002 / (f2 * f2 * f2)) : this.getFlyingSpeed();
      this.moveRelative(speed, sx, sy, sz);
      // escada de mão
      if (this.onClimbable()) {
        this.fallDistance = 0;
        this.vx = Math.max(-0.15, Math.min(0.15, this.vx));
        this.vz = Math.max(-0.15, Math.min(0.15, this.vz));
        this.vy = Math.max(this.vy, -0.15);
        if (this.vy < 0 && this.suppressSlidingDownLadder()) this.vy = 0;
      }
      this.move(this.vx, this.vy, this.vz, this.shouldBackOffEdges());
      let vy = this.vy;
      if ((this.horizontalCollision || this.jumping) && this.onClimbable()) vy = 0.2;
      const lev = this.effectLevel('levitation');
      if (lev) vy += (0.05 * lev - vy) * 0.2;
      else if (!this.world.isLoaded(Math.floor(this.x), Math.floor(this.z))) vy = this.y > -64 ? -0.1 : 0;
      else if (!this.noGravity) vy -= gravity;
      // velocidade vinda de blocos lentos (areia lamuriosa, mel)
      const sf = BLOCKS[BLOCK_OF[this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z))]].def.speedFactor
        ?? (this.onGround ? BLOCKS[BLOCK_OF[under]].def.speedFactor ?? 1 : 1);
      this.vx *= f3 * sf; this.vz *= f3 * sf;
      this.vy = vy * 0.98;
      this.blockFriction = f2;
    }
    this.updateLimbs();
  }

  protected shouldBackOffEdges(): boolean { return false; }
  depthStrider(): number { return 0; }

  protected updateLimbs(): void {
    this.prevLimbSwingAmount = this.limbSwingAmount;
    const dx = this.x - this.prevX, dz = this.z - this.prevZ;
    let d = Math.sqrt(dx * dx + dz * dz) * 4;
    if (d > 1) d = 1;
    this.limbSwingAmount += (d - this.limbSwingAmount) * 0.4;
    this.limbSwing += this.limbSwingAmount;
  }

  swing(): void {
    if (!this.swinging || this.swingTime >= 3 || this.swingTime < 0) { this.swingTime = -1; this.swinging = true; }
  }

  updateSwing(): void {
    this.prevAttackAnim = this.attackAnim;
    const dur = 6;
    if (this.swinging) {
      this.swingTime++;
      if (this.swingTime >= dur) { this.swingTime = 0; this.swinging = false; }
    } else this.swingTime = 0;
    this.attackAnim = this.swingTime / dur;
  }

  tickEffects(): void {
    for (const [id, e] of this.effects) {
      e.duration--;
      if (e.duration <= 0) this.effects.delete(id);
    }
  }

  heal(n: number): void { this.health = Math.min(this.maxHealth, this.health + n); }

  /** Reduz o dano pela armadura (fórmula do original) — veja também encantamentos. */
  applyArmor(amount: number, src: DamageSource): number {
    if (src.bypassArmor) return amount;
    const a = this.armorValue, t = this.armorToughness;
    const f = Math.min(20, Math.max(a / 5, a - amount / (2 + t / 4)));
    return amount * (1 - f / 25);
  }

  /** Aplica dano. Retorna true se causou dano. */
  hurt(src: DamageSource, amount: number): boolean {
    if (this.dead) return false;
    if (this.invulnerableTime > 10 && amount <= this.lastHurt) return false;
    let dmg = amount;
    const res = this.effectLevel('resistance');
    if (res && src.type !== 'void' && src.type !== 'kill') dmg *= Math.max(0, 1 - 0.2 * res);
    dmg = this.applyArmor(dmg, src);
    if (this.invulnerableTime > 10) { dmg -= this.lastHurt; this.lastHurt = amount; }
    else { this.lastHurt = amount; this.invulnerableTime = 20; this.hurtTime = this.hurtDuration; }
    if (dmg <= 0) return false;
    const abs = Math.min(this.absorption, dmg);
    this.absorption -= abs;
    dmg -= abs;
    this.health -= dmg;
    this.onHurt(src, dmg);
    if (this.health <= 0) { this.health = 0; this.die(src); }
    return true;
  }

  protected onHurt(_src: DamageSource, _dmg: number): void { /* som, partículas */ }

  die(_src: DamageSource): void { this.dead = true; }

  knockback(strength: number, dx: number, dz: number): void {
    strength *= 1 - this.knockbackResistance;
    if (strength <= 0) return;
    const len = Math.hypot(dx, dz) || 1;
    this.vx = this.vx / 2 - (dx / len) * strength;
    this.vz = this.vz / 2 - (dz / len) * strength;
    if (this.onGround) this.vy = Math.min(0.4, this.vy / 2 + strength);
  }
}
