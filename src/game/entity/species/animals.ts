/**
 * Animais de fazenda e selvagens: vaca (zebu), porco, ovelha, galinha (d'angola), coelho (tapiti) e o
 * musgarto — invenção do Lavra: um lagarto-tartaruga coberto de musgo que se esconde no casco.
 * Números (vida, velocidade, tamanho, saques) iguais aos equivalentes do original.
 */
import { Animal, BreedGoal, TemptGoal, FollowParentGoal, EatBlockGoal } from '../animal';
import { FloatGoal, PanicGoal, RandomStrollGoal, LookAtPlayerGoal, RandomLookAroundGoal, AvoidEntityGoal, Goal } from '../ai/goals';
import type { Drop } from '../mob';
import type { Level } from '../../level';
import type { Player } from '../../player/player';
import { ItemStack } from '../../items/stack';
import type { DamageSource } from '../living';
import { BLOCKS, BLOCK_OF } from '../../../world/blocks';

/** Objetivos padrão de um animal de pasto. */
function pastureGoals(a: Animal, panic: number, tempt: number, follow: number, foods: readonly string[]): void {
  a.goals.add(0, new FloatGoal(a));
  a.goals.add(1, new PanicGoal(a, panic));
  a.goals.add(2, new BreedGoal(a, 1));
  a.goals.add(3, new TemptGoal(a, tempt, (st) => !!st && foods.includes(st.id)));
  a.goals.add(4, new FollowParentGoal(a, follow));
  a.goals.add(6, new RandomStrollGoal(a, 1));
  a.goals.add(7, new LookAtPlayerGoal(a, 6));
  a.goals.add(8, new RandomLookAroundGoal(a));
}

// ================================================================== vaca
export class Cow extends Animal {
  readonly type = 'cow';
  readonly foods = ['wheat'] as const;
  constructor(level: Level) { super(level); this.maxHealth = 10; this.baseSpeed = 0.2; }
  get label(): string { return 'Vaca'; }
  get adultSize(): [number, number] { return [0.9, 1.4]; }
  registerGoals(): void { pastureGoals(this, 2, 1.25, 1.25, this.foods); }
  override drops(): Drop[] { return [{ id: 'leather', min: 0, max: 2 }, { id: 'beef', min: 1, max: 3, cookedId: 'cooked_beef' }]; }
  makeBaby(): Animal { return new Cow(this.host).init(); }
  override interact(p: Player, st: ItemStack | null): boolean {
    if (st?.id === 'bucket' && !this.isBaby) {
      milk(p, 'milk_bucket');
      this.host.emit('sound', { name: 'cow.milk', x: this.x, y: this.y, z: this.z });
      return true;
    }
    return super.interact(p, st);
  }
}

function milk(p: Player, id: string): void {
  if (p.gameMode === 'creative') { if (!p.inventory.count(id)) p.inventory.add(new ItemStack(id)); return; }
  const held = p.inventory.held!;
  if (held.count === 1) p.inventory.held = new ItemStack(id);
  else { p.inventory.consumeHeld(1); if (p.inventory.add(new ItemStack(id)) > 0) p.host.emit?.('dropStack', { id }); }
}

// ================================================================== porco
export class Pig extends Animal {
  readonly type = 'pig';
  readonly foods = ['carrot', 'potato', 'beetroot'] as const;
  saddled = false;
  constructor(level: Level) { super(level); this.maxHealth = 10; this.baseSpeed = 0.25; }
  get label(): string { return 'Porco'; }
  get adultSize(): [number, number] { return [0.9, 0.9]; }
  registerGoals(): void { pastureGoals(this, 1.25, 1.2, 1.1, this.foods); }
  override drops(): Drop[] {
    const d: Drop[] = [{ id: 'porkchop', min: 1, max: 3, cookedId: 'cooked_porkchop' }];
    if (this.saddled) d.push({ id: 'saddle', min: 1, max: 1 });
    return d;
  }
  makeBaby(): Animal { return new Pig(this.host).init(); }
  override interact(p: Player, st: ItemStack | null): boolean {
    if (st?.id === 'saddle' && !this.saddled && !this.isBaby) {
      this.saddled = true;
      if (p.gameMode !== 'creative') p.inventory.consumeHeld(1);
      this.host.emit('sound', { name: 'saddle', x: this.x, y: this.y, z: this.z });
      return true;
    }
    return super.interact(p, st);
  }
  override save(): Record<string, unknown> { return { ...super.save(), saddled: this.saddled }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.saddled = !!d.saddled; }
}

// ================================================================== ovelha
export const SHEEP_COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];

/** Cor natural: 81,836% branca, 5% preta, 5% cinza, 5% cinza-clara, 3% marrom, 0,164% rosa. */
export function naturalWool(r = Math.random()): string {
  const i = r * 100000;
  if (i < 5000) return 'black';
  if (i < 10000) return 'gray';
  if (i < 15000) return 'light_gray';
  if (i < 18000) return 'brown';
  if (i < 18164) return 'pink';
  return 'white';
}

export class Sheep extends Animal {
  readonly type = 'sheep';
  readonly foods = ['wheat'] as const;
  color = 'white';
  sheared = false;
  eatAnim = 0;
  private eat!: EatBlockGoal;
  constructor(level: Level) { super(level); this.maxHealth = 8; this.baseSpeed = 0.23; this.color = naturalWool(); }
  get label(): string { return 'Ovelha'; }
  get adultSize(): [number, number] { return [0.9, 1.3]; }
  registerGoals(): void {
    pastureGoals(this, 1.25, 1.1, 1.1, this.foods);
    this.eat = new EatBlockGoal(this, () => {
      this.sheared = false;
      if (this.isBaby) this.ageTicks = Math.min(0, this.ageTicks + 1200);
    });
    this.goals.add(5, this.eat);
  }
  protected override customAi(): void { this.eatAnim = this.eat?.timer ?? 0; }
  override drops(): Drop[] {
    const d: Drop[] = [{ id: 'mutton', min: 1, max: 2, cookedId: 'cooked_mutton' }];
    if (!this.sheared) d.push({ id: `${this.color}_wool`, min: 1, max: 1 });
    return d;
  }
  makeBaby(partner: Animal): Animal {
    const b = new Sheep(this.host).init();
    const o = partner as Sheep;
    // cor do filhote: uma das cores dos pais (a mistura exata de tintas fica para a tinta)
    b.color = Math.random() < 0.5 ? this.color : o.color;
    return b;
  }
  override interact(p: Player, st: ItemStack | null): boolean {
    if (st?.id === 'shears' && !this.sheared && !this.isBaby) {
      this.sheared = true;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const e = this.host.spawnItem(this.x, this.y + 1, this.z, new ItemStack(`${this.color}_wool`));
        e.vy += Math.random() * 0.05; e.vx += (Math.random() - Math.random()) * 0.1; e.vz += (Math.random() - Math.random()) * 0.1;
      }
      if (p.gameMode !== 'creative') { st.damage++; if (st.damage >= st.maxDamage) p.inventory.held = null; p.inventory.changed(); }
      this.host.emit('sound', { name: 'shear', x: this.x, y: this.y, z: this.z });
      return true;
    }
    if (st && st.id.endsWith('_dye') && !this.sheared) {
      const c = st.id.slice(0, -4);
      if (c !== this.color) {
        this.color = c;
        if (p.gameMode !== 'creative') p.inventory.consumeHeld(1);
        return true;
      }
    }
    return super.interact(p, st);
  }
  override save(): Record<string, unknown> { return { ...super.save(), color: this.color, sheared: this.sheared }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.color = (d.color as string) ?? 'white'; this.sheared = !!d.sheared; }
}

// ================================================================== galinha (d'angola)
export class Chicken extends Animal {
  readonly type = 'chicken';
  readonly foods = ['wheat_seeds', 'melon_seeds', 'pumpkin_seeds', 'beetroot_seeds'] as const;
  eggTime = 6000 + Math.floor(Math.random() * 6000);
  flap = 0; prevFlap = 0; flapSpeed = 0; prevFlapSpeed = 0; private flapping = 1;
  constructor(level: Level) { super(level); this.maxHealth = 4; this.baseSpeed = 0.25; this.fallMult = 0; }
  get label(): string { return 'Galinha'; }
  get adultSize(): [number, number] { return [0.4, 0.7]; }
  override eyeHeight(): number { return this.height * 0.92; }
  registerGoals(): void { pastureGoals(this, 1.4, 1, 1.1, this.foods); }
  override drops(): Drop[] { return [{ id: 'feather', min: 0, max: 2 }, { id: 'chicken', min: 1, max: 1, cookedId: 'cooked_chicken' }]; }
  makeBaby(): Animal { return new Chicken(this.host).init(); }
  override tick(): void {
    super.tick();
    if (this.dead) return;
    // bater de asas e queda lenta
    this.prevFlap = this.flap; this.prevFlapSpeed = this.flapSpeed;
    this.flapSpeed += (this.onGround ? -1 : 4) * 0.3;
    this.flapSpeed = Math.max(0, Math.min(1, this.flapSpeed));
    if (!this.onGround && this.flapping < 1) this.flapping = 1;
    this.flapping *= 0.9;
    if (!this.onGround && this.vy < 0) this.vy *= 0.6;
    this.flap += this.flapping * 2;
    if (!this.isBaby && --this.eggTime <= 0) {
      this.host.spawnItem(this.x, this.y, this.z, new ItemStack('egg'));
      this.host.emit('sound', { name: 'chicken.egg', x: this.x, y: this.y, z: this.z });
      this.eggTime = 6000 + Math.floor(Math.random() * 6000);
    }
  }
  override interact(p: Player, st: ItemStack | null): boolean { return super.interact(p, st); }
}

// ================================================================== coelho (tapiti)
export const RABBIT_VARIANTS = ['brown', 'white', 'black', 'splotched', 'gold', 'salt'] as const;
export class Rabbit extends Animal {
  readonly type = 'rabbit';
  readonly foods = ['carrot', 'golden_carrot', 'buttercup'] as const;
  variant: typeof RABBIT_VARIANTS[number] = 'brown';
  jumpTicks = 0; jumpDuration = 0;
  private jumpDelay = 0;
  constructor(level: Level) { super(level); this.maxHealth = 3; this.baseSpeed = 0.3; this.jumpPower = 0.5; }
  get label(): string { return 'Coelho'; }
  get adultSize(): [number, number] { return [0.4, 0.5]; }
  registerGoals(): void {
    this.goals.add(1, new FloatGoal(this));
    this.goals.add(1, new PanicGoal(this, 2.2));
    this.goals.add(2, new BreedGoal(this, 0.8));
    this.goals.add(3, new TemptGoal(this, 1, (st) => !!st && this.foods.includes(st.id as never)));
    this.goals.add(4, new AvoidEntityGoal(this, (e) => e.type === 'player' && !(e as Player).isSneaking() && (e as Player).gameMode === 'survival', 8, 2.2, 2.2));
    this.goals.add(4, new AvoidEntityGoal(this, (e) => e.type === 'wolf', 10, 2.2, 2.2));
    this.goals.add(4, new AvoidEntityGoal(this, (e) => (e as Animal).hostile === true, 4, 2.2, 2.2));
    this.goals.add(5, new RaidGardenGoal(this));
    this.goals.add(6, new RandomStrollGoal(this, 0.6));
    this.goals.add(11, new LookAtPlayerGoal(this, 10));
  }
  /** pulinhos: só anda pulando */
  protected override customAi(): void {
    if (this.jumpDelay > 0) this.jumpDelay--;
    if (this.onGround) {
      if (this.jumpTicks > 0) { this.jumpTicks = 0; this.jumpDelay = this.moveCtl.hasWanted ? 4 : 10; }
      if (this.jumpDelay === 0 && this.moveCtl.hasWanted) {
        this.jumpCtl.jump();
        this.jumpTicks = 1;
        this.jumpDuration = 10;
      } else if (!this.moveCtl.hasWanted) { this.zza = 0; }
    } else if (this.jumpTicks > 0) this.jumpTicks++;
    if (!this.onGround || this.jumpTicks === 0) return;
  }
  override drops(): Drop[] {
    return [{ id: 'rabbit_hide', min: 0, max: 1 }, { id: 'rabbit', min: 0, max: 1, cookedId: 'cooked_rabbit' }, { id: 'rabbit_foot', min: 1, max: 1, chance: 0.1, looting: 0.03, playerOnly: true }];
  }
  makeBaby(partner: Animal): Animal {
    const b = new Rabbit(this.host).init();
    b.variant = Math.random() < 0.05 ? this.variant : Math.random() < 0.5 ? this.variant : (partner as Rabbit).variant;
    return b;
  }
  override interact(p: Player, st: ItemStack | null): boolean { return super.interact(p, st); }
  override save(): Record<string, unknown> { return { ...super.save(), variant: this.variant }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.variant = (d.variant as never) ?? 'brown'; }
}

/** Coelho come cenouras da plantação. */
class RaidGardenGoal extends Goal {
  private t: [number, number, number] | null = null;
  private cooldown = 0;
  constructor(private r: Rabbit) { super(); this.flags = ['move']; }
  override get label(): string { return 'roubar cenoura'; }
  canUse(): boolean {
    if (--this.cooldown > 0 || !this.r.host.rules.mobGriefing) return false;
    this.cooldown = 40;
    const bx = Math.floor(this.r.x), by = Math.floor(this.r.y), bz = Math.floor(this.r.z);
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) for (let dy = -1; dy <= 1; dy++) {
      const s = this.r.host.getBlock(bx + dx, by + dy, bz + dz);
      if (BLOCKS[BLOCK_OF[s]].name === 'carrots') { this.t = [bx + dx, by + dy, bz + dz]; return true; }
    }
    return false;
  }
  override start(): void { const t = this.t!; this.r.nav.moveTo(t[0], t[1], t[2], 0.7, 0); }
  override canContinue(): boolean { return !this.r.nav.done; }
  override stop(): void {
    const t = this.t;
    if (t && this.r.distanceSq(t[0] + 0.5, t[1], t[2] + 0.5) < 2) {
      const s = this.r.host.getBlock(t[0], t[1], t[2]);
      if (BLOCKS[BLOCK_OF[s]].name === 'carrots') this.r.host.setBlock(t[0], t[1], t[2], 0);
    }
    this.t = null;
  }
}

// ================================================================== musgarto (invenção)
/**
 * Musgarto: lagarto-tartaruga lento das matas úmidas. As costas crescem musgo que pode ser tosado (tufos de
 * musgo); o musgo volta ao pastar ou tomar chuva. Quando assustado, recolhe-se no casco por alguns segundos
 * e recebe só 20% do dano. Cruza com amoras.
 */
export class Musgarto extends Animal {
  readonly type = 'musgarto';
  readonly foods = ['sweet_berries'] as const;
  sheared = false;
  hiding = 0;
  private regrow = 0;
  constructor(level: Level) { super(level); this.maxHealth = 12; this.baseSpeed = 0.16; this.armorValue = 2; }
  get label(): string { return 'Musgarto'; }
  get adultSize(): [number, number] { return [0.8, 0.6]; }
  registerGoals(): void {
    this.goals.add(0, new FloatGoal(this));
    this.goals.add(1, new HideInShellGoal(this));
    this.goals.add(2, new BreedGoal(this, 1));
    this.goals.add(3, new TemptGoal(this, 1.2, (st) => st?.id === 'sweet_berries'));
    this.goals.add(4, new FollowParentGoal(this, 1.1));
    this.goals.add(5, new EatBlockGoal(this, () => { this.sheared = false; }));
    this.goals.add(6, new RandomStrollGoal(this, 1));
    this.goals.add(7, new LookAtPlayerGoal(this, 6));
    this.goals.add(8, new RandomLookAroundGoal(this));
  }
  protected override customAi(): void {
    if (this.hiding > 0) { this.hiding--; this.nav.stop(); }
    if (this.sheared && ++this.regrow > 20 && this.host.isRainingAt(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z)) && Math.random() < 0.002) {
      this.sheared = false; this.regrow = 0;
    }
  }
  override hurt(src: DamageSource, amount: number): boolean {
    if (this.hiding > 0 && src.type !== 'void' && src.type !== 'kill') amount *= 0.2;
    const ok = super.hurt(src, amount);
    if (ok && !this.dead) this.hiding = 80 + Math.floor(Math.random() * 40);
    return ok;
  }
  override drops(): Drop[] {
    const d: Drop[] = [{ id: 'scale_shell', min: 0, max: 1 }];
    if (!this.sheared) d.push({ id: 'moss_tuft', min: 1, max: 2 });
    return d;
  }
  makeBaby(): Animal { return new Musgarto(this.host).init(); }
  override interact(p: Player, st: ItemStack | null): boolean {
    if (st?.id === 'shears' && !this.sheared && !this.isBaby && this.hiding <= 0) {
      this.sheared = true;
      this.regrow = 0;
      const n = 1 + Math.floor(Math.random() * 2);
      this.host.spawnItem(this.x, this.y + 0.7, this.z, new ItemStack('moss_tuft', n));
      if (p.gameMode !== 'creative') { st.damage++; if (st.damage >= st.maxDamage) p.inventory.held = null; p.inventory.changed(); }
      this.host.emit('sound', { name: 'shear', x: this.x, y: this.y, z: this.z });
      this.hiding = 40;
      return true;
    }
    return super.interact(p, st);
  }
  override save(): Record<string, unknown> { return { ...super.save(), sheared: this.sheared }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.sheared = !!d.sheared; }
}

class HideInShellGoal extends Goal {
  constructor(private m: Musgarto) { super(); this.flags = ['move', 'look', 'jump']; }
  override get label(): string { return 'no casco'; }
  canUse(): boolean {
    if (this.m.hiding > 0) return true;
    // jogador correndo por perto assusta
    const p = this.m.nearestPlayer(3);
    if (p && p.sprinting && Math.random() < 0.1) { this.m.hiding = 60; return true; }
    return false;
  }
  override canContinue(): boolean { return this.m.hiding > 0; }
  override start(): void { this.m.nav.stop(); }
}

