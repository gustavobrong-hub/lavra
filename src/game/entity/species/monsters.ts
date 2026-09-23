/**
 * Monstros da superfície e das cavernas (equivalentes do original, visual e nomes próprios):
 * carniçal (morto-vivo corpo a corpo), náufrago (versão aquática), ossudo (arqueiro), tecelã (aranha que
 * escala paredes), pavio (incha e explode), feiticeira (arremessa e bebe poções) e gosma (divide-se ao morrer).
 */
import { Mob, type Drop } from '../mob';
import type { Level } from '../../level';
import type { Living, DamageSource } from '../living';
import type { Player } from '../../player/player';
import {
  Goal, FloatGoal, MeleeAttackGoal, RandomStrollGoal, LookAtPlayerGoal, RandomLookAroundGoal, HurtByTargetGoal,
  NearestAttackableTargetGoal, LeapAtTargetGoal, AvoidEntityGoal, FleeSunGoal, RangedBowAttackGoal,
} from '../ai/goals';
import { MoveControl, rotlerp } from '../ai/controls';
import { ItemStack } from '../../items/stack';
import { Arrow, Throwable, Harpoon } from '../projectiles';
import { explode } from '../../explosion';
import { applyPotion } from '../../items/potions';

export const difficultyId = (L: Level): number => ({ peaceful: 0, easy: 1, normal: 2, hard: 3 })[L.difficulty];
const isPlayer = (e: Living) => e.type === 'player';

export abstract class Monster extends Mob {
  constructor(level: Level) {
    super(level);
    this.category = 'monster';
    this.hostile = true;
    this.xpReward = 5;
  }
  override walkTargetValue(x: number, y: number, z: number): number { return 0.5 - this.host.brightness(x, y, z) / 15; }
}

// ================================================================== carniçal
export class Carnical extends Monster {
  readonly type: string = 'carnical';
  baby = false;
  /** tempo submerso (vira náufrago após 600 + 300 ticks) */
  private underwater = 0;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 20; this.baseSpeed = 0.23; this.attackDamage = 3; this.armorValue = 2; this.followRange = 35;
    this.undead = true;
    this.width = 0.6; this.height = 1.95;
  }
  get label(): string { return 'Carniçal'; }
  override get isBaby(): boolean { return this.baby; }
  setBaby(b: boolean): void {
    this.baby = b;
    this.width = b ? 0.3 : 0.6; this.height = b ? 0.975 : 1.95;
    if (b) { this.baseSpeed *= 1.5; this.xpReward = 12; }
  }
  registerGoals(): void {
    this.goals.add(2, new MeleeAttackGoal(this, 1, false));
    this.goals.add(5, new FleeSunGoal(this, 1));
    this.goals.add(7, new RandomStrollGoal(this, 1));
    this.goals.add(8, new LookAtPlayerGoal(this, 8));
    this.goals.add(8, new RandomLookAroundGoal(this));
    this.targets.add(1, new HurtByTargetGoal(this, true));
    this.targets.add(2, new NearestAttackableTargetGoal(this, isPlayer, true));
    this.targets.add(3, new NearestAttackableTargetGoal(this, (e) => e.type === 'villager' || e.type === 'sentinela', false));
  }
  /** equipamento aleatório ao nascer (mão: 1% espada/pá; capacete raro) */
  equipRandom(): void {
    const d = difficultyId(this.host);
    if (Math.random() < (d === 3 ? 0.05 : 0.01)) this.mainHand = new ItemStack(Math.random() < 1 / 3 ? 'iron_sword' : 'iron_shovel');
    if (Math.random() < 0.15 * (d / 3)) this.helmet = new ItemStack(['leather_helmet', 'golden_helmet', 'chainmail_helmet', 'iron_helmet'][Math.floor(Math.random() * 4)]);
    if (this.mainHand?.id === 'iron_sword') this.attackDamage += 6 - 1; else if (this.mainHand) this.attackDamage += 3.5;
  }
  protected override onAttacked(t: Living): void {
    const d = difficultyId(this.host);
    if (this.fireTicks > 0 && Math.random() < d * 0.3) t.fireTicks = Math.max(t.fireTicks, 40 * d);
  }
  protected override customAi(): void {
    if (this.type !== 'carnical') return;
    if (this.eyeInWater) {
      if (++this.underwater >= 900) this.convertTo('naufrago');
      else if (this.underwater === 600) this.host.emit('sound', { name: 'carnical.convert', x: this.x, y: this.y, z: this.z });
    } else this.underwater = 0;
  }
  /** Converte em outra criatura mantendo posição e equipamento. */
  convertTo(type: string): void {
    this.host.emit('convertMob', { id: this.id, to: type, x: this.x, y: this.y, z: this.z, yaw: this.yaw, baby: this.baby });
    this.removed = true;
  }
  override drops(): Drop[] {
    return [
      { id: 'rotten_flesh', min: 0, max: 2 },
      { id: ['iron_ingot', 'carrot', 'potato'][Math.floor(Math.random() * 3)], min: 1, max: 1, chance: 0.025, looting: 0.01, playerOnly: true },
    ];
  }
  override save(): Record<string, unknown> { return { ...super.save(), baby: this.baby }; }
  override load(d: Record<string, unknown>): void { super.load(d); if (d.baby) this.setBaby(true); }
}

// ================================================================== náufrago
class NaufragoMoveControl extends MoveControl {
  override tick(): void {
    const m = this.mob as Naufrago;
    if (!m.inWater) { super.tick(); return; }
    const t = m.target;
    if (t && t.y > m.y) m.vy += 0.002;
    if (this.op !== 'move' || m.nav.done) { m.movementSpeed = 0; m.zza = 0; if (!t) m.vy -= 0.004; return; }
    this.op = 'wait';
    const dx = this.wantedX - m.x, dy = this.wantedY - m.y, dz = this.wantedZ - m.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const ny = dy / d;
    m.yaw = rotlerp(m.yaw, (Math.atan2(dz, dx) * 180) / Math.PI - 90, 90);
    m.bodyYaw = m.yaw;
    const sp = this.speedModifier * m.baseSpeed;
    m.movementSpeed += (sp - m.movementSpeed) * 0.125;
    m.vx += m.movementSpeed * (dx / d) * 0.005 * 4;
    m.vy += m.movementSpeed * ny * 0.1;
    m.vz += m.movementSpeed * (dz / d) * 0.005 * 4;
    m.zza = m.movementSpeed;
  }
}

export class Naufrago extends Carnical {
  override readonly type = 'naufrago';
  private throwCooldown = 0;
  constructor(level: Level) {
    super(level);
    this.nav.canSwim = true;
    this.waterBreather = true;
  }
  override get label(): string { return 'Náufrago'; }
  protected override createMoveControl(): MoveControl { return new NaufragoMoveControl(this); }
  override registerGoals(): void {
    this.goals.add(1, new HarpoonThrowGoal(this));
    this.goals.add(2, new MeleeAttackGoal(this, 1, false));
    this.goals.add(5, new FleeSunGoal(this, 1));
    this.goals.add(7, new RandomStrollGoal(this, 1, 120, 10, false));
    this.goals.add(8, new LookAtPlayerGoal(this, 8));
    this.targets.add(1, new HurtByTargetGoal(this, true));
    // ataca quem está na água, ou qualquer um à noite
    this.targets.add(2, new NearestAttackableTargetGoal(this, (e) => isPlayer(e) && (e.inWater || !this.host.isDay()), true));
    this.targets.add(3, new NearestAttackableTargetGoal(this, (e) => e.type === 'villager', false));
  }
  override equipRandom(): void {
    if (Math.random() < 0.15) this.mainHand = new ItemStack('harpoon');
    else if (Math.random() < 0.03) this.mainHand = new ItemStack('fishing_rod');
  }
  override travel(sx: number, sy: number, sz: number): void {
    if (this.inWater && this.target) {
      this.moveRelative(0.01, sx, sy, sz);
      this.move(this.vx, this.vy, this.vz);
      this.vx *= 0.9; this.vy *= 0.9; this.vz *= 0.9;
      this.updateLimbs();
    } else super.travel(sx, sy, sz);
  }
  /** só queima fora d'água (como o original) */
  protected override sunBurns(): boolean { return !this.inWater && super.sunBurns(); }
  throwHarpoon(t: Living): void {
    if (this.throwCooldown > 0) return;
    this.throwCooldown = 40;
    const h = new Harpoon(this.host, new ItemStack('harpoon'));
    h.owner = this;
    h.setPos(this.x, this.y + this.eyeHeight() - 0.1, this.z);
    const dx = t.x - this.x, dy = t.y + t.height / 3 - h.y, dz = t.z - this.z;
    const g = Math.hypot(dx, dz);
    h.shoot(dx, dy + g * 0.2, dz, 1.6, 14 - difficultyId(this.host) * 4);
    this.host.entities.add(h);
    this.host.emit('sound', { name: 'harpoon.throw', x: this.x, y: this.y, z: this.z });
    this.swing();
  }
  protected override customAi(): void { if (this.throwCooldown > 0) this.throwCooldown--; }
  override drops(): Drop[] {
    return [{ id: 'rotten_flesh', min: 0, max: 2 }, { id: 'copper_ingot', min: 1, max: 1, chance: 0.11, looting: 0.02, playerOnly: true }];
  }
}

class HarpoonThrowGoal extends Goal {
  private cd = 0;
  constructor(private m: Naufrago) { super(); this.flags = ['move', 'look']; }
  canUse(): boolean {
    const t = this.m.target;
    return this.m.mainHand?.id === 'harpoon' && !!t && this.m.distanceTo(t) > 3 && this.m.distanceTo(t) < 12;
  }
  override tick(): void {
    const t = this.m.target!;
    this.m.lookCtl.lookAt(t.x, t.y + t.eyeHeight(), t.z, 30, 30);
    if (++this.cd >= 40 && this.m.canSee(t)) { this.cd = 0; this.m.throwHarpoon(t); }
  }
}

// ================================================================== ossudo (arqueiro)
export class Ossudo extends Monster {
  readonly type = 'ossudo';
  private bowGoal!: RangedBowAttackGoal;
  private meleeGoal!: MeleeAttackGoal;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 20; this.baseSpeed = 0.25; this.attackDamage = 2;
    this.undead = true;
    this.width = 0.6; this.height = 1.99;
    this.mainHand = new ItemStack('bow');
  }
  get label(): string { return 'Ossudo'; }
  registerGoals(): void {
    const interval = this.host.difficulty === 'hard' ? 20 : 40;
    this.bowGoal = new RangedBowAttackGoal(this, 1, interval, 15);
    this.meleeGoal = new MeleeAttackGoal(this, 1.2, false);
    this.goals.add(2, new FleeSunGoal(this, 1));
    this.goals.add(3, new AvoidEntityGoal(this, (e) => e.type === 'wolf', 6, 1, 1.2));
    this.goals.add(4, this.bowGoal);
    this.goals.add(4, new MeleeWhenNoBow(this, this.meleeGoal));
    this.goals.add(5, new RandomStrollGoal(this, 1));
    this.goals.add(6, new LookAtPlayerGoal(this, 8));
    this.goals.add(6, new RandomLookAroundGoal(this));
    this.targets.add(1, new HurtByTargetGoal(this));
    this.targets.add(2, new NearestAttackableTargetGoal(this, isPlayer, true));
    this.targets.add(3, new NearestAttackableTargetGoal(this, (e) => e.type === 'sentinela', true));
  }
  get drawing(): number { return this.bowGoal?.drawing ?? 0; }
  shootArrow(t: Living, power: number): void {
    const a = new Arrow(this.host);
    a.owner = this;
    a.setPos(this.x, this.y + this.eyeHeight() - 0.1, this.z);
    const d = difficultyId(this.host);
    a.baseDamage = power * 2 + (Math.random() - Math.random()) * 0.57425 + d * 0.11;
    const dx = t.x - this.x, dy = t.y + t.height / 3 - a.y, dz = t.z - this.z;
    const g = Math.hypot(dx, dz);
    a.shoot(dx, dy + g * 0.2, dz, 1.6, 14 - d * 4);
    const power2 = this.mainHand?.enchantLevel('power') ?? 0;
    if (power2) a.baseDamage += power2 * 0.5 + 0.5;
    a.punch = this.mainHand?.enchantLevel('punch') ?? 0;
    if (this.mainHand?.enchantLevel('flame')) a.flame = true;
    this.host.entities.add(a);
    this.host.emit('sound', { name: 'bow.shoot', x: this.x, y: this.y, z: this.z });
  }
  override drops(): Drop[] { return [{ id: 'bone', min: 0, max: 2 }, { id: 'arrow', min: 0, max: 2 }]; }
}

/** Sem arco: corpo a corpo. */
class MeleeWhenNoBow extends Goal {
  constructor(private m: Mob, private g: MeleeAttackGoal) { super(); this.flags = ['move', 'look']; }
  canUse(): boolean { return this.m.mainHand?.id !== 'bow' && this.g.canUse(); }
  override canContinue(): boolean { return this.m.mainHand?.id !== 'bow' && this.g.canContinue(); }
  override start(): void { this.g.start(); }
  override stop(): void { this.g.stop(); }
  override tick(): void { this.g.tick(); }
}

// ================================================================== tecelã (aranha)
export class Tecela extends Monster {
  readonly type = 'tecela';
  /** tecelã das cavernas (menor, venenosa) */
  cave = false;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 16; this.baseSpeed = 0.3; this.attackDamage = 2;
    this.width = 1.4; this.height = 0.9;
  }
  get label(): string { return this.cave ? 'Tecelã das cavernas' : 'Tecelã'; }
  makeCave(): void { this.cave = true; this.maxHealth = 12; this.health = 12; this.width = 0.7; this.height = 0.5; }
  override eyeHeight(): number { return 0.65 * (this.cave ? 0.55 : 1); }
  registerGoals(): void {
    this.goals.add(1, new FloatGoal(this));
    this.goals.add(3, new LeapAtTargetGoal(this, 0.4));
    this.goals.add(4, new SpiderAttackGoal(this));
    this.goals.add(5, new RandomStrollGoal(this, 0.8));
    this.goals.add(6, new LookAtPlayerGoal(this, 8));
    this.goals.add(6, new RandomLookAroundGoal(this));
    this.targets.add(1, new HurtByTargetGoal(this));
    this.targets.add(2, new SpiderTargetGoal(this));
    this.targets.add(3, new NearestAttackableTargetGoal(this, (e) => e.type === 'sentinela', true));
  }
  /** escala paredes: encostado em algo conta como escada */
  override onClimbable(): boolean { return this.horizontalCollision || super.onClimbable(); }
  override addEffect(e: import('../living').StatusEffect): void { if (e.id !== 'poison') super.addEffect(e); }
  protected override onAttacked(t: Living): void {
    if (!this.cave) return;
    const d = difficultyId(this.host);
    const secs = d === 2 ? 7 : d === 3 ? 15 : 0;
    if (secs > 0) t.addEffect({ id: 'poison', duration: secs * 20, amplifier: 0 });
  }
  /** brilho do olho para o render */
  get lightFactor(): number { return this.host.brightness(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z)) / 15; }
  override drops(): Drop[] { return [{ id: 'string', min: 0, max: 2 }, { id: 'spider_eye', min: 1, max: 1, chance: 1 / 3, looting: 0.1, playerOnly: true }]; }
  override save(): Record<string, unknown> { return { ...super.save(), cave: this.cave }; }
  override load(d: Record<string, unknown>): void { super.load(d); if (d.cave) this.makeCave(); }
}

class SpiderAttackGoal extends MeleeAttackGoal {
  constructor(m: Tecela) { super(m, 1, true); }
  override canUse(): boolean { return super.canUse() && !this.m.passenger; }
  override canContinue(): boolean {
    // de dia pode desistir (1% por tick)
    if (this.m.host.brightness(Math.floor(this.m.x), Math.floor(this.m.y + 0.5), Math.floor(this.m.z)) / 15 >= 0.5 && Math.random() < 0.01) { this.m.target = null; return false; }
    return super.canContinue();
  }
  protected override reachSq(t: Living): number { return 4 + t.width; }
}

class SpiderTargetGoal extends NearestAttackableTargetGoal {
  constructor(m: Tecela) { super(m, isPlayer, true); }
  override canUse(): boolean {
    const br = this.m.host.brightness(Math.floor(this.m.x), Math.floor(this.m.y + 0.5), Math.floor(this.m.z)) / 15;
    return br < 0.5 && super.canUse();
  }
}

// ================================================================== pavio (explode)
export class Pavio extends Monster {
  readonly type = 'pavio';
  swell = 0;
  prevSwell = 0;
  swellDir = -1;
  ignited = false;
  charged = false;
  readonly maxSwell = 30;
  readonly radius = 3;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 20; this.baseSpeed = 0.25;
    this.width = 0.6; this.height = 1.7;
  }
  get label(): string { return 'Pavio'; }
  registerGoals(): void {
    this.goals.add(1, new FloatGoal(this));
    this.goals.add(2, new SwellGoal(this));
    this.goals.add(3, new AvoidEntityGoal(this, (e) => e.type === 'cat', 6, 1, 1.2));
    this.goals.add(4, new MeleeAttackGoal(this, 1, false));
    this.goals.add(5, new RandomStrollGoal(this, 0.8));
    this.goals.add(6, new LookAtPlayerGoal(this, 8));
    this.goals.add(6, new RandomLookAroundGoal(this));
    this.targets.add(1, new NearestAttackableTargetGoal(this, isPlayer, true));
    this.targets.add(2, new HurtByTargetGoal(this));
  }
  /** não ataca corpo a corpo: só se aproxima */
  override doHurtTarget(): boolean { return true; }
  override tick(): void {
    if (!this.dead && !this.removed) {
      this.prevSwell = this.swell;
      if (this.ignited) this.swellDir = 1;
      if (this.swellDir > 0 && this.swell === 0) this.host.emit('sound', { name: 'pavio.fuse', x: this.x, y: this.y, z: this.z });
      this.swell = Math.max(0, this.swell + this.swellDir);
      if (this.swell >= this.maxSwell) { this.swell = this.maxSwell; this.boom(); return; }
    }
    super.tick();
  }
  private boom(): void {
    this.dead = true;
    this.removed = true;
    explode(this.host, this.x, this.y, this.z, this.radius * (this.charged ? 2 : 1), { attacker: this, source: this });
  }
  override interact(p: Player, st: ItemStack | null): boolean {
    if (st?.id === 'flint_and_steel') {
      this.ignited = true;
      this.host.emit('sound', { name: 'flint', x: this.x, y: this.y, z: this.z });
      if (p.gameMode !== 'creative') { st.damage++; p.inventory.changed(); }
      return true;
    }
    return super.interact(p, st);
  }
  /** raio: vira pavio carregado */
  onLightning(): void { this.charged = true; }
  override drops(): Drop[] { return [{ id: 'gunpowder', min: 0, max: 2 }]; }
  override save(): Record<string, unknown> { return { ...super.save(), charged: this.charged }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.charged = !!d.charged; }
}

class SwellGoal extends Goal {
  constructor(private p: Pavio) { super(); this.flags = ['move']; }
  override get label(): string { return 'inchar'; }
  canUse(): boolean { const t = this.p.target; return this.p.swellDir > 0 || (!!t && this.p.distanceSq(t.x, t.y, t.z) < 9); }
  override get interruptable(): boolean { return false; }
  override start(): void { this.p.nav.stop(); }
  override stop(): void { this.p.swellDir = -1; }
  override tick(): void {
    const t = this.p.target;
    if (!t) this.p.swellDir = -1;
    else if (this.p.distanceSq(t.x, t.y, t.z) > 49) this.p.swellDir = -1;
    else if (!this.p.canSee(t)) this.p.swellDir = -1;
    else this.p.swellDir = 1;
  }
}

// ================================================================== feiticeira
export class Feiticeira extends Monster {
  readonly type = 'feiticeira';
  drinking = 0;
  private drinkPotion: string | null = null;
  private attackTimer = 0;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 26; this.baseSpeed = 0.25;
    this.width = 0.6; this.height = 1.95;
  }
  get label(): string { return 'Feiticeira'; }
  registerGoals(): void {
    this.goals.add(1, new FloatGoal(this));
    this.goals.add(2, new WitchAttackGoal(this));
    this.goals.add(2, new RandomStrollGoal(this, 1));
    this.goals.add(3, new LookAtPlayerGoal(this, 8));
    this.goals.add(3, new RandomLookAroundGoal(this));
    this.targets.add(1, new HurtByTargetGoal(this));
    this.targets.add(2, new NearestAttackableTargetGoal(this, isPlayer, true));
  }
  override hurt(src: DamageSource, amount: number): boolean {
    if (src.attacker === this) amount = 0;
    if (src.type === 'magic') amount *= 0.15;
    return super.hurt(src, amount);
  }
  protected override customAi(): void {
    if (this.attackTimer > 0) this.attackTimer--;
    if (this.drinking > 0) {
      if (--this.drinking === 0 && this.drinkPotion) {
        applyPotion(this, this.drinkPotion, 1);
        this.mainHand = null;
        this.movementSpeed = this.baseSpeed;
      }
      return;
    }
    let pot: string | null = null;
    const r = Math.random();
    const bx = Math.floor(this.x), by = Math.floor(this.y + this.eyeHeight()), bz = Math.floor(this.z);
    if (r < 0.15 && this.eyeInWater && !this.hasEffect('water_breathing')) pot = 'water_breathing';
    else if (r < 0.15 && (this.fireTicks > 0) && !this.hasEffect('fire_resistance')) pot = 'fire_resistance';
    else if (r < 0.05 && this.health < this.maxHealth) pot = 'healing';
    else if (r < 0.5 && this.target && !this.hasEffect('speed') && this.distanceSq(this.target.x, this.target.y, this.target.z) > 121) pot = 'swiftness';
    void bx; void by; void bz;
    if (pot) {
      this.drinkPotion = pot;
      this.drinking = 32;
      this.mainHand = new ItemStack('potion', 1, 0, { potion: pot });
      this.host.emit('sound', { name: 'feiticeira.drink', x: this.x, y: this.y, z: this.z });
    }
  }
  throwPotion(t: Living): void {
    if (this.drinking > 0 || this.attackTimer > 0) return;
    this.attackTimer = 60;
    const dx = t.x + t.vx - this.x, dz = t.z + t.vz - this.z;
    const dy = t.y + t.eyeHeight() - 1.1 - this.y;
    const g = Math.hypot(dx, dz);
    let pot = 'harming';
    if (g >= 8 && !t.hasEffect('slowness')) pot = 'slowness';
    else if (t.health >= 8 && !t.hasEffect('poison')) pot = 'poison';
    else if (g <= 3 && !t.hasEffect('weakness') && Math.random() < 0.25) pot = 'weakness';
    const p = new Throwable(this.host, new ItemStack('splash_potion', 1, 0, { potion: pot }));
    p.owner = this;
    p.setPos(this.x, this.y + this.eyeHeight() - 0.1, this.z);
    p.shoot(dx, dy + g * 0.2, dz, 0.75, 8);
    this.host.entities.add(p);
    this.host.emit('sound', { name: 'feiticeira.throw', x: this.x, y: this.y, z: this.z });
    this.swing();
  }
  override drops(): Drop[] {
    const pool = ['glass_bottle', 'lumita_dust', 'gunpowder', 'fulgor_dust', 'spider_eye', 'sugar', 'stick', 'stick'];
    const n = 1 + Math.floor(Math.random() * 3);
    const out: Drop[] = [];
    for (let i = 0; i < n; i++) out.push({ id: pool[Math.floor(Math.random() * pool.length)], min: 0, max: 2 });
    return out;
  }
}

class WitchAttackGoal extends Goal {
  private seen = 0;
  constructor(private w: Feiticeira) { super(); this.flags = ['move', 'look']; }
  override get label(): string { return 'enfeitiçar'; }
  canUse(): boolean { const t = this.w.target; return !!t && !t.dead; }
  override stop(): void { this.seen = 0; this.w.nav.stop(); }
  override tick(): void {
    const t = this.w.target!;
    const d2 = this.w.distanceSq(t.x, t.y, t.z);
    const see = this.w.canSee(t);
    this.seen = see ? this.seen + 1 : 0;
    if (d2 <= 100 && this.seen >= 5) this.w.nav.stop();
    else this.w.nav.moveTo(t.x, t.y, t.z, 1);
    this.w.lookCtl.lookAt(t.x, t.y + t.eyeHeight(), t.z, 30, 30);
    if (see && d2 <= 100) this.w.throwPotion(t);
  }
}

// ================================================================== gosma
class SlimeMoveControl extends MoveControl {
  private jumpDelay = 0;
  aggressive = false;
  yRotTarget = 0;
  override tick(): void {
    const s = this.mob as Gosma;
    s.yaw = rotlerp(s.yaw, this.yRotTarget, 90);
    s.yawHead = s.yaw; s.bodyYaw = s.yaw;
    if (this.op !== 'move') { s.zza = 0; return; }
    this.op = 'wait';
    if (s.onGround) {
      s.movementSpeed = this.speedModifier * s.baseSpeed;
      if (this.jumpDelay-- <= 0) {
        this.jumpDelay = 10 + Math.floor(Math.random() * 20);
        if (this.aggressive) this.jumpDelay = Math.floor(this.jumpDelay / 3);
        s.jumpCtl.jump();
        s.host.emit('sound', { name: 'gosma.jump', x: s.x, y: s.y, z: s.z, size: s.size });
      } else { s.xxa = 0; s.zza = 0; s.movementSpeed = 0; }
    } else { s.movementSpeed = this.speedModifier * s.baseSpeed; s.zza = s.movementSpeed; }
  }
}

export class Gosma extends Monster {
  readonly type = 'gosma';
  size = 1;
  squish = 0; prevSquish = 0; private targetSquish = 0; private wasOnGround = false;
  constructor(level: Level) { super(level); this.setSize(1 << Math.floor(Math.random() * 3)); }
  get label(): string { return 'Gosma'; }
  setSize(n: number): void {
    this.size = n;
    this.width = this.height = 0.52 * n;
    this.maxHealth = n * n; this.health = this.maxHealth;
    this.baseSpeed = 0.2 + 0.1 * n;
    this.attackDamage = n;
    this.xpReward = n;
    this.jumpPower = 0.42 + 0.1 * Math.max(0, n - 1) * 0.3;
  }
  protected override createMoveControl(): MoveControl { return new SlimeMoveControl(this); }
  registerGoals(): void {
    this.goals.add(1, new SlimeFloatGoal(this));
    this.goals.add(2, new SlimeAttackGoal(this));
    this.goals.add(3, new SlimeRandomDirGoal(this));
    this.goals.add(5, new SlimeKeepOnJumping(this));
    this.targets.add(1, new NearestAttackableTargetGoal(this, (e) => isPlayer(e) && Math.abs(e.y - this.y) <= 4, true));
    this.targets.add(3, new NearestAttackableTargetGoal(this, (e) => e.type === 'sentinela', true));
  }
  get slimeMove(): SlimeMoveControl { return this.moveCtl as SlimeMoveControl; }
  override tick(): void {
    this.prevSquish = this.squish;
    this.squish += (this.targetSquish - this.squish) * 0.5;
    super.tick();
    if (this.dead) return;
    if (this.onGround && !this.wasOnGround) {
      this.targetSquish = -0.5;
      this.host.emit('particle', { kind: 'slime', x: this.x, y: this.y, z: this.z, n: this.size * 8 });
      this.host.emit('sound', { name: 'gosma.land', x: this.x, y: this.y, z: this.z, size: this.size });
    } else if (!this.onGround && this.wasOnGround) this.targetSquish = 1;
    this.targetSquish *= 0.6;
    this.wasOnGround = this.onGround;
    // dano por contato (tamanho > 1)
    if (this.size > 1) {
      for (const e of this.host.entities.inBox(this.bb, (o) => o.type === 'player' || o.type === 'sentinela')) {
        const l = e as Living;
        if (l.dead || !this.canReach(l)) continue;
        if (this.distanceSq(l.x, l.y, l.z) < 0.6 * this.size * 0.6 * this.size && this.canSee(l) && l.hurt({ type: 'mob', attacker: this }, this.attackDamage)) {
          this.host.emit('sound', { name: 'gosma.attack', x: this.x, y: this.y, z: this.z });
        }
      }
    }
  }
  override jumpFromGround(): void {
    this.vy = 0.42;
    if (this.size > 1) this.vy += 0.1 * 0;
  }
  override die(src: DamageSource): void {
    super.die(src);
    // divide em 2–4 menores
    if (this.size > 1) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const k = (i % 2 - 0.5) * this.size / 4, l = (Math.floor(i / 2) - 0.5) * this.size / 4;
        this.host.emit('spawnMob', { mob: 'gosma', x: this.x + k, y: this.y + 0.5, z: this.z + l, size: this.size / 2, yaw: Math.random() * 360 });
      }
    }
  }
  override drops(): Drop[] { return this.size === 1 ? [{ id: 'slime_ball', min: 0, max: 2 }] : []; }
  override save(): Record<string, unknown> { return { ...super.save(), size: this.size }; }
  override load(d: Record<string, unknown>): void { this.setSize((d.size as number) ?? 1); super.load(d); }
}

class SlimeAttackGoal extends Goal {
  private growTired = 0;
  constructor(private s: Gosma) { super(); this.flags = ['look']; }
  canUse(): boolean { const t = this.s.target; return !!t && !t.dead && this.s.canReach(t); }
  override start(): void { this.growTired = 300; }
  override canContinue(): boolean { return this.canUse() && --this.growTired > 0; }
  override tick(): void {
    const t = this.s.target!;
    this.s.lookCtl.lookAt(t.x, t.y + t.eyeHeight(), t.z, 10, 10);
    this.s.slimeMove.yRotTarget = this.s.yawHead;
    this.s.slimeMove.aggressive = true;
    this.s.moveCtl.setWanted(t.x, t.y, t.z, 1);
    this.s.moveCtl.op = 'move';
  }
  override stop(): void { this.s.slimeMove.aggressive = false; }
}
class SlimeRandomDirGoal extends Goal {
  private next = 0;
  constructor(private s: Gosma) { super(); this.flags = ['look']; }
  canUse(): boolean { return !this.s.target && (this.s.onGround || this.s.inWater || this.s.inLava); }
  override tick(): void {
    if (--this.next <= 0) { this.next = 40 + Math.floor(Math.random() * 60); this.s.slimeMove.yRotTarget = Math.random() * 360; }
  }
}
class SlimeKeepOnJumping extends Goal {
  constructor(private s: Gosma) { super(); this.flags = ['jump', 'move']; }
  canUse(): boolean { return !this.s.passenger; }
  override tick(): void {
    const r = this.s.slimeMove.yRotTarget * Math.PI / 180;
    this.s.moveCtl.setWanted(this.s.x - Math.sin(r) * 2, this.s.y, this.s.z + Math.cos(r) * 2, 1);
  }
}
class SlimeFloatGoal extends Goal {
  constructor(private s: Gosma) { super(); this.flags = ['jump', 'move']; }
  canUse(): boolean { return this.s.inWater || this.s.inLava; }
  override tick(): void { if (Math.random() < 0.8) this.s.jumpCtl.jump(); this.s.moveCtl.setWanted(this.s.x, this.s.y, this.s.z, 1.2); }
}

