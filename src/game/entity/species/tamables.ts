/**
 * Domesticáveis: lobo-guará (no lugar do lobo: doma com osso, senta, segue, defende), gato (doma com peixe
 * cru, afugenta pavios) e cavalo (doma montando até ele aceitar, sela, montaria com pulo carregado).
 */
import { Tamable, Animal, BreedGoal, TemptGoal, FollowParentGoal, SitWhenOrderedGoal, FollowOwnerGoal, OwnerHurtByTargetGoal, OwnerHurtTargetGoal } from '../animal';
import { FloatGoal, PanicGoal, RandomStrollGoal, LookAtPlayerGoal, RandomLookAroundGoal, MeleeAttackGoal, LeapAtTargetGoal, HurtByTargetGoal, NearestAttackableTargetGoal, AvoidEntityGoal, Goal } from '../ai/goals';
import type { Drop } from '../mob';
import type { Level } from '../../level';
import type { Player } from '../../player/player';
import type { ItemStack } from '../../items/stack';
import type { Living } from '../living';
import { item } from '../../items/registry';

const MEATS = ['beef', 'cooked_beef', 'porkchop', 'cooked_porkchop', 'chicken', 'cooked_chicken', 'mutton', 'cooked_mutton', 'rabbit', 'cooked_rabbit', 'rotten_flesh'];

// ================================================================== lobo-guará
export class Wolf extends Tamable {
  readonly type = 'wolf';
  readonly foods = MEATS;
  angryAt = 0;
  collar = 'red';
  /** cabeça inclinada pedindo comida */
  begging = false;
  shake = 0;
  constructor(level: Level) { super(level); this.maxHealth = 8; this.baseSpeed = 0.3; this.attackDamage = 4; this.persistent = false; }
  get label(): string { return 'Lobo-guará'; }
  get adultSize(): [number, number] { return [0.6, 0.85]; }
  override canFallInLove(): boolean { return this.tame && super.canFallInLove(); }
  registerGoals(): void {
    this.goals.add(1, new FloatGoal(this));
    this.goals.add(2, new SitWhenOrderedGoal(this));
    this.goals.add(4, new LeapAtTargetGoal(this, 0.4));
    this.goals.add(5, new MeleeAttackGoal(this, 1, true));
    this.goals.add(6, new FollowOwnerGoal(this, 1, 10, 2));
    this.goals.add(7, new BreedGoal(this, 1));
    this.goals.add(8, new RandomStrollGoal(this, 1));
    this.goals.add(9, new BegGoal(this));
    this.goals.add(10, new LookAtPlayerGoal(this, 8));
    this.goals.add(10, new RandomLookAroundGoal(this));
    this.targets.add(1, new OwnerHurtByTargetGoal(this));
    this.targets.add(2, new OwnerHurtTargetGoal(this));
    this.targets.add(3, new HurtByTargetGoal(this, true));
    // selvagem: caça ovelhas e coelhos; sempre caça ossudos
    this.targets.add(5, new NearestAttackableTargetGoal(this, (e) => !this.tame && (e.type === 'sheep' || e.type === 'rabbit'), false));
    this.targets.add(7, new NearestAttackableTargetGoal(this, (e) => e.type === 'ossudo', false));
  }
  protected override onTamed(): void { this.maxHealth = 20; this.health = 20; this.sitting = true; }
  override canReach(t: Living): boolean {
    if (this.tame && (t.id === this.ownerId || (t as Tamable).ownerId === this.ownerId)) return false;
    return super.canReach(t);
  }
  protected override customAi(): void {
    if (this.inWater) this.shake = 20;
    else if (this.shake > 0 && this.onGround) this.shake--;
  }
  override interact(p: Player, st: ItemStack | null): boolean {
    if (this.tame) {
      if (this.ownerId === p.id) {
        const food = item(st?.id ?? '')?.food;
        if (st && MEATS.includes(st.id) && this.health < this.maxHealth && food) {
          this.heal(food.hunger);
          this.useItem(p);
          return true;
        }
        if (st?.id.endsWith('_dye')) { this.collar = st.id.slice(0, -4); this.useItem(p); return true; }
        if (super.interact(p, st)) return true;
        this.sitting = !this.sitting;
        this.jumping = false; this.nav.stop(); this.target = null;
        return true;
      }
      return false;
    }
    if (st?.id === 'bone' && !this.target) {
      this.useItem(p);
      if (Math.random() < 1 / 3) this.tameBy(p);
      else this.host.emit('particle', { kind: 'smoke', x: this.x, y: this.y + this.height, z: this.z, n: 7 });
      return true;
    }
    return super.interact(p, st);
  }
  makeBaby(): Animal { const b = new Wolf(this.host).init(); if (this.tame) { b.ownerId = this.ownerId; b.onTamed(); b.sitting = false; } return b; }
  override save(): Record<string, unknown> { return { ...super.save(), collar: this.collar }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.collar = (d.collar as string) ?? 'red'; if (this.tame) { this.maxHealth = 20; } }
}

/** Lobo inclina a cabeça quando o jogador segura osso ou carne. */
class BegGoal extends Goal {
  private p: Player | null = null;
  private time = 0;
  constructor(private w: Wolf) { super(); this.flags = ['look']; }
  canUse(): boolean {
    this.p = this.w.nearestPlayer(8);
    const h = this.p?.inventory.held;
    return !!h && (h.id === 'bone' && !this.w.tame || this.w.tame && MEATS.includes(h.id));
  }
  override canContinue(): boolean { return this.time > 0 && this.canUse(); }
  override start(): void { this.w.begging = true; this.time = 40 + Math.floor(Math.random() * 40); }
  override stop(): void { this.w.begging = false; this.p = null; }
  override tick(): void { const p = this.p!; this.w.lookCtl.lookAt(p.x, p.y + p.eyeHeight(), p.z, 10, this.w.headPitchMax); this.time--; }
}

// ================================================================== gato
export const CAT_VARIANTS = ['malhado', 'preto', 'branco', 'laranja', 'siames', 'frajola', 'cinza', 'rajado'] as const;
export class Cat extends Tamable {
  readonly type = 'cat';
  readonly foods = ['lambari', 'tambaqui'];
  variant: typeof CAT_VARIANTS[number] = CAT_VARIANTS[Math.floor(Math.random() * CAT_VARIANTS.length)];
  collar = 'red';
  constructor(level: Level) { super(level); this.maxHealth = 10; this.baseSpeed = 0.3; this.attackDamage = 3; this.fallMult = 0; this.persistent = false; }
  get label(): string { return 'Gato'; }
  get adultSize(): [number, number] { return [0.6, 0.7]; }
  registerGoals(): void {
    this.goals.add(1, new FloatGoal(this));
    this.goals.add(1, new PanicGoal(this, 1.5));
    this.goals.add(2, new SitWhenOrderedGoal(this));
    this.goals.add(4, new TemptGoal(this, 0.6, (st) => !!st && this.foods.includes(st.id)));
    this.goals.add(5, new AvoidEntityGoal(this, (e) => e.type === 'player' && !this.tame, 16, 0.8, 1.33));
    this.goals.add(6, new FollowOwnerGoal(this, 1, 10, 5));
    this.goals.add(8, new LeapAtTargetGoal(this, 0.3));
    this.goals.add(9, new MeleeAttackGoal(this, 1));
    this.goals.add(10, new BreedGoal(this, 0.8));
    this.goals.add(11, new RandomStrollGoal(this, 0.8, 120, 10));
    this.goals.add(12, new LookAtPlayerGoal(this, 10));
    this.targets.add(1, new NearestAttackableTargetGoal(this, (e) => !this.tame && (e.type === 'rabbit' || e.type === 'chicken'), false));
  }
  override canFallInLove(): boolean { return this.tame && super.canFallInLove(); }
  protected override onTamed(): void { this.sitting = true; }
  override interact(p: Player, st: ItemStack | null): boolean {
    if (this.tame) {
      if (this.ownerId !== p.id) return false;
      if (st && this.foods.includes(st.id) && this.health < this.maxHealth) { this.heal(item(st.id)?.food?.hunger ?? 2); this.useItem(p); return true; }
      if (st?.id.endsWith('_dye')) { this.collar = st.id.slice(0, -4); this.useItem(p); return true; }
      if (super.interact(p, st)) return true;
      this.sitting = !this.sitting;
      this.nav.stop();
      return true;
    }
    if (st && this.foods.includes(st.id) && this.distanceTo(p) < 9) {
      this.useItem(p);
      if (Math.random() < 1 / 3) this.tameBy(p);
      else this.host.emit('particle', { kind: 'smoke', x: this.x, y: this.y + this.height, z: this.z, n: 7 });
      return true;
    }
    return super.interact(p, st);
  }
  override drops(): Drop[] { return [{ id: 'string', min: 0, max: 2 }]; }
  makeBaby(partner: Animal): Animal {
    const b = new Cat(this.host).init();
    b.variant = Math.random() < 0.5 ? this.variant : (partner as Cat).variant;
    if (this.tame) { b.ownerId = this.ownerId; b.sitting = false; }
    return b;
  }
  override save(): Record<string, unknown> { return { ...super.save(), variant: this.variant, collar: this.collar }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.variant = (d.variant as never) ?? 'malhado'; this.collar = (d.collar as string) ?? 'red'; }
}

// ================================================================== cavalo
export const HORSE_COATS = ['branco', 'creme', 'alazao', 'castanho', 'preto', 'tordilho', 'baio'] as const;
export const HORSE_MARKS = ['nenhuma', 'meias', 'pampa', 'pintas', 'estrela'] as const;

export class Horse extends Tamable {
  readonly type = 'horse';
  readonly foods = ['golden_apple', 'golden_carrot'];
  coat: typeof HORSE_COATS[number] = HORSE_COATS[Math.floor(Math.random() * HORSE_COATS.length)];
  marks: typeof HORSE_MARKS[number] = HORSE_MARKS[Math.floor(Math.random() * HORSE_MARKS.length)];
  saddled = false;
  temper = 0;
  jumpStrength = 0.7;
  /** 0..1 enquanto empina (animação) */
  standAnim = 0;
  private standTicks = 0;
  /** entrada do cavaleiro (tick atual) */
  riderInput = { forward: 0, strafe: 0, jump: 0 };
  private isJumpingRide = false;
  gallop = 0;
  eatingHay = 0;
  constructor(level: Level) {
    super(level);
    const r = Math.random;
    this.maxHealth = 15 + Math.floor(r() * 8) + Math.floor(r() * 9);
    this.baseSpeed = (0.45 + r() * 0.3 + r() * 0.3 + r() * 0.3) * 0.25;
    this.jumpStrength = 0.4 + r() * 0.2 + r() * 0.2 + r() * 0.2;
    this.persistent = false;
  }
  get label(): string { return 'Cavalo'; }
  get adultSize(): [number, number] { return [1.3965, 1.6]; }
  override canFallInLove(): boolean { return this.tame && super.canFallInLove(); }
  registerGoals(): void {
    this.goals.add(0, new FloatGoal(this));
    this.goals.add(1, new PanicGoal(this, 1.2));
    this.goals.add(1, new RunAroundGoal(this));
    this.goals.add(2, new BreedGoal(this, 1));
    this.goals.add(4, new FollowParentGoal(this, 1));
    this.goals.add(6, new RandomStrollGoal(this, 0.7));
    this.goals.add(7, new LookAtPlayerGoal(this, 6));
    this.goals.add(8, new RandomLookAroundGoal(this));
    this.goals.add(3, new TemptGoal(this, 1.25, (st) => !!st && ['golden_carrot', 'golden_apple', 'apple', 'wheat', 'sugar'].includes(st.id)));
  }
  protected override controlledByPassenger(): boolean { return this.saddled && this.tame && this.passenger?.type === 'player'; }
  override interact(p: Player, st: ItemStack | null): boolean {
    if (this.isBaby) return super.interact(p, st);
    if (p.isSneaking() && this.tame) return false; // futuramente: inventário do cavalo
    // comida: cura e acalma
    const heal: Record<string, [number, number]> = { wheat: [2, 3], sugar: [1, 3], apple: [3, 3], hay_block: [20, 0], golden_carrot: [4, 5], golden_apple: [10, 10] };
    if (st && heal[st.id] && !(this.tame && this.foods.includes(st.id) && this.canFallInLove())) {
      const [h, t] = heal[st.id];
      if (this.health < this.maxHealth || !this.tame) {
        this.heal(h);
        if (!this.tame) this.temper = Math.min(100, this.temper + t);
        this.useItem(p);
        this.eatingHay = 30;
        return true;
      }
    }
    if (st?.id === 'saddle' && this.tame && !this.saddled) {
      this.saddled = true;
      this.useItem(p);
      this.host.emit('sound', { name: 'saddle', x: this.x, y: this.y, z: this.z });
      return true;
    }
    if (super.interact(p, st)) return true;
    // montar (mão vazia ou item sem uso)
    if (!this.passenger) {
      this.mount(p);
      return true;
    }
    return false;
  }
  mount(p: Player): void {
    this.passenger = p;
    (p as Player & { vehicle: unknown }).vehicle = this;
    p.yaw = this.yaw;
    this.nav.stop();
  }
  /** Empina (ao ser domado/derrubar o cavaleiro/ser ferido). */
  makeMad(): void { this.standTicks = 20; }
  protected override customAi(): void {
    if (this.standTicks > 0) this.standTicks--;
    this.standAnim += ((this.standTicks > 0 ? 1 : 0) - this.standAnim) * 0.3;
    if (this.eatingHay > 0) this.eatingHay--;
    // domar: montado e ainda bravo
    const p = this.passenger;
    if (p && !this.tame && Math.random() * 50 < 1) {
      if (Math.random() * 100 < this.temper) this.tameBy(p as Player);
      else {
        this.temper = Math.min(100, this.temper + 5);
        this.dismount();
        this.makeMad();
        this.host.emit('sound', { name: 'horse.angry', x: this.x, y: this.y, z: this.z });
      }
    }
    if (this.controlledByPassenger()) this.rideTravel();
  }
  protected override onTamed(): void { this.sitting = false; this.host.emit('sound', { name: 'horse.tame', x: this.x, y: this.y, z: this.z }); }

  /** Montaria: o cavalo segue a direção do cavaleiro (AbstractHorse.travel). */
  private rideTravel(): void {
    const p = this.passenger as Player;
    const inp = this.riderInput;
    this.yaw = p.yaw; this.bodyYaw = this.yaw; this.yawHead = this.yaw;
    let f = inp.strafe * 0.5, g = inp.forward;
    if (g <= 0) { g *= 0.25; this.gallop = 0; }
    if (inp.jump > 0 && !this.isJumpingRide && this.onGround) {
      this.vy = this.jumpStrength * inp.jump;
      this.isJumpingRide = true;
      if (g > 0) {
        const r = this.yaw * Math.PI / 180;
        this.vx += -0.4 * Math.sin(r) * inp.jump; this.vz += 0.4 * Math.cos(r) * inp.jump;
      }
      inp.jump = 0;
      this.host.emit('sound', { name: 'horse.jump', x: this.x, y: this.y, z: this.z });
    }
    if (this.onGround) this.isJumpingRide = false;
    this.movementSpeed = this.baseSpeed;
    this.flyingSpeed = this.baseSpeed * 0.1;
    this.xxa = f; this.zza = g;
    if (g > 0) this.gallop++;
  }
  override getFlyingSpeed(): number { return this.passenger ? this.baseSpeed * 0.1 : 0.02; }
  override hurt(src: import('../living').DamageSource, amount: number): boolean {
    const ok = super.hurt(src, amount);
    if (ok && !this.dead && Math.random() < 0.3) this.makeMad();
    return ok;
  }
  protected override onLand(fall: number): void {
    // cavalos amortecem 3 blocos a mais (como o original: dano = (queda − 3) × 1 − 3... simplificado)
    const dmg = Math.ceil((fall * 0.5 - 3));
    if (dmg > 0) {
      this.hurt({ type: 'fall' }, dmg);
      if (this.passenger) this.passenger.hurt({ type: 'fall' }, dmg);
    }
  }
  override drops(): Drop[] {
    const d: Drop[] = [{ id: 'leather', min: 0, max: 2 }];
    if (this.saddled) d.push({ id: 'saddle', min: 1, max: 1 });
    return d;
  }
  makeBaby(partner: Animal): Animal {
    const o = partner as Horse;
    const b = new Horse(this.host).init();
    const r = Math.random;
    // atributos: média dos pais e de um valor aleatório (como o original)
    b.maxHealth = Math.round((this.maxHealth + o.maxHealth + (15 + Math.floor(r() * 8) + Math.floor(r() * 9))) / 3);
    b.baseSpeed = (this.baseSpeed + o.baseSpeed + (0.45 + r() * 0.3 + r() * 0.3 + r() * 0.3) * 0.25) / 3;
    b.jumpStrength = (this.jumpStrength + o.jumpStrength + (0.4 + r() * 0.2 + r() * 0.2 + r() * 0.2)) / 3;
    b.health = b.maxHealth;
    b.coat = r() < 0.5 ? this.coat : o.coat;
    b.marks = r() < 0.5 ? this.marks : o.marks;
    return b;
  }
  override save(): Record<string, unknown> {
    return { ...super.save(), coat: this.coat, marks: this.marks, saddled: this.saddled, temper: this.temper, maxHealth: this.maxHealth, speed: this.baseSpeed, jump: this.jumpStrength };
  }
  override load(d: Record<string, unknown>): void {
    this.maxHealth = (d.maxHealth as number) ?? this.maxHealth;
    super.load(d);
    this.coat = (d.coat as never) ?? this.coat; this.marks = (d.marks as never) ?? this.marks;
    this.saddled = !!d.saddled; this.temper = (d.temper as number) ?? 0;
    this.baseSpeed = (d.speed as number) ?? this.baseSpeed; this.jumpStrength = (d.jump as number) ?? this.jumpStrength;
  }
}

/** Cavalo não domado com alguém em cima: corre em círculos tentando derrubar. */
class RunAroundGoal extends Goal {
  constructor(private h: Horse) { super(); this.flags = ['move']; }
  canUse(): boolean { return !this.h.tame && !!this.h.passenger; }
  override start(): void {
    const x = Math.floor(this.h.x + Math.random() * 10 - 5), z = Math.floor(this.h.z + Math.random() * 10 - 5);
    const y = this.h.findGroundNear(x, Math.floor(this.h.y), z, 4);
    if (y !== null) this.h.nav.moveTo(x, y, z, 1.2, 0);
  }
  override canContinue(): boolean { return !this.h.tame && !!this.h.passenger && !this.h.nav.done; }
}
