/**
 * Mais monstros: assombro (voador noturno que mergulha em quem não dorme há 3 dias), vulto (sombra alta que
 * teleporta, fica furiosa se encarada e carrega blocos) e o espreitador — invenção do Lavra: disfarça-se de
 * bloco de pedra nas cavernas profundas e dá o bote quando alguém passa perto sem se agachar.
 */
import type { Drop } from '../mob';
import type { Level } from '../../level';
import type { Living, DamageSource } from '../living';
import type { Player } from '../../player/player';
import { Monster } from './monsters';
import {
  Goal, FloatGoal, MeleeAttackGoal, RandomStrollGoal, LookAtPlayerGoal, RandomLookAroundGoal, HurtByTargetGoal, NearestAttackableTargetGoal,
} from '../ai/goals';
import { BLOCKS, BLOCK_OF, FLAGS, F_SOLID, F_FLUID, F_FULL_CUBE_COLLISION, OPAQUE } from '../../../world/blocks';
import { lineOfSight } from '../mob';
import { rotlerp } from '../ai/controls';

// ================================================================== assombro (voador noturno)
export class Assombro extends Monster {
  readonly type = 'assombro';
  /** ponto de referência da ronda */
  anchor: [number, number, number] = [0, 0, 0];
  private mode: 'circle' | 'swoop' = 'circle';
  private circleAngle = Math.random() * Math.PI * 2;
  private circleR = 5 + Math.random() * 10;
  private circleH = 20;
  private swoopDelay = 100;
  private tx = 0; private ty = 0; private tz = 0;
  flapAnim = 0;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 20; this.attackDamage = 6; this.baseSpeed = 0.9;
    this.width = 0.9; this.height = 0.5;
    this.undead = true; this.noGravity = true; this.fallMult = 0;
    this.followRange = 64;
  }
  get label(): string { return 'Assombro'; }
  registerGoals(): void {
    this.targets.add(1, new NearestAttackableTargetGoal(this, (e) => e.type === 'player' && (e as Player).gameMode === 'survival', false, 1));
  }
  override init(): this { super.init(); this.anchor = [Math.floor(this.x), Math.floor(this.y) + 5, Math.floor(this.z)]; return this; }
  protected override customAi(): void {
    this.flapAnim += 0.35;
    const t = this.target;
    if (t && t.dead) this.target = null;
    if (this.mode === 'circle') {
      if (t) {
        this.anchor = [Math.floor(t.x), Math.floor(t.y) + this.circleH, Math.floor(t.z)];
        if (--this.swoopDelay <= 0) { this.mode = 'swoop'; this.swoopDelay = 60 + Math.floor(Math.random() * 100); this.host.emit('sound', { name: 'assombro.swoop', x: this.x, y: this.y, z: this.z }); }
      }
      this.circleAngle += 0.03 * (this.id % 2 === 0 ? 1 : -1);
      if (Math.random() < 0.005) this.circleR = 5 + Math.random() * 10;
      if (Math.random() < 0.005) this.circleH = 15 + Math.random() * 10;
      this.tx = this.anchor[0] + Math.cos(this.circleAngle) * this.circleR;
      this.tz = this.anchor[2] + Math.sin(this.circleAngle) * this.circleR;
      this.ty = this.anchor[1] - 4 + Math.sin(this.circleAngle * 2) * 2;
    } else if (t) {
      this.tx = t.x; this.ty = t.y + t.height / 2; this.tz = t.z;
      if (this.bb.inflate(0.2).intersects(t.bb)) {
        this.doHurtTarget(t);
        this.mode = 'circle';
      } else if (this.horizontalCollision || this.hurtTime > 0) this.mode = 'circle';
    } else this.mode = 'circle';
    // voo: acelera em direção ao alvo
    const dx = this.tx - this.x, dy = this.ty - this.y, dz = this.tz - this.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const sp = this.mode === 'swoop' ? 0.08 : 0.05;
    this.vx += (dx / d * sp - this.vx) * 0.1; this.vy += (dy / d * sp - this.vy) * 0.1; this.vz += (dz / d * sp - this.vz) * 0.1;
    const h = Math.hypot(this.vx, this.vz);
    if (h > 1e-3) this.yaw = rotlerp(this.yaw, (Math.atan2(this.vz, this.vx) * 180) / Math.PI - 90, 12);
    this.bodyYaw = this.yaw; this.yawHead = this.yaw;
    this.pitch = -(Math.atan2(this.vy, h) * 180) / Math.PI;
  }
  override travel(): void {
    this.move(this.vx * 4, this.vy * 4, this.vz * 4);
    this.updateLimbs();
  }
  override drops(): Drop[] { return [{ id: 'phantom_membrane', min: 0, max: 1, playerOnly: true }]; }
}

// ================================================================== vulto (teleporta)
const CARRYABLE = new Set(['grass_block', 'dirt', 'coarse_dirt', 'sand', 'red_sand', 'gravel', 'clay', 'pumpkin', 'melon', 'cactus', 'buttercup', 'poppy', 'daisy', 'brown_mushroom', 'red_mushroom', 'tnt', 'mycelium', 'podzol', 'moss_block']);

export class Vulto extends Monster {
  readonly type = 'vulto';
  carried = 0;
  /** tremendo de raiva (render) */
  creepy = false;
  private stareTicks = 0;
  private aggroTime = 0;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 40; this.baseSpeed = 0.3; this.attackDamage = 7; this.followRange = 64;
    this.width = 0.6; this.height = 2.9; this.stepHeight = 1;
  }
  get label(): string { return 'Vulto'; }
  override eyeHeight(): number { return 2.55; }
  registerGoals(): void {
    this.goals.add(0, new FloatGoal(this));
    this.goals.add(1, new StareBackGoal(this));
    this.goals.add(2, new MeleeAttackGoal(this, 1, false));
    this.goals.add(7, new RandomStrollGoal(this, 1));
    this.goals.add(8, new LookAtPlayerGoal(this, 8));
    this.goals.add(8, new RandomLookAroundGoal(this));
    this.goals.add(10, new CarryBlockGoal(this));
    this.targets.add(1, new LookForStaringPlayer(this));
    this.targets.add(2, new HurtByTargetGoal(this));
  }
  /** O jogador está olhando nos olhos? (isLookingAtMe do original) */
  isLookedAtBy(p: Player): boolean {
    const helmet = p.inventory.armor[3];
    if (helmet?.id === 'carved_pumpkin') return false;
    const [lx, ly, lz] = p.lookVec();
    let vx = this.x - p.x, vy = this.y + this.eyeHeight() - (p.y + p.eyeHeight()), vz = this.z - p.z;
    const d = Math.hypot(vx, vy, vz);
    vx /= d; vy /= d; vz /= d;
    const dot = lx * vx + ly * vy + lz * vz;
    return dot > 1 - 0.025 / d && lineOfSight(this.host, p.x, p.y + p.eyeHeight(), p.z, this.x, this.y + this.eyeHeight(), this.z);
  }
  setStareTarget(p: Player): void { this.target = p; this.creepy = true; this.aggroTime = 0; this.host.emit('sound', { name: 'vulto.stare', x: this.x, y: this.y, z: this.z }); }
  /** Teleporte aleatório (até 32 blocos), procurando chão firme sem líquido. */
  teleportRandom(): boolean {
    for (let i = 0; i < 64; i++) {
      const x = this.x + (Math.random() - 0.5) * 64, y = this.y + Math.floor(Math.random() * 64) - 32, z = this.z + (Math.random() - 0.5) * 64;
      if (this.teleportTo(x, y, z)) return true;
    }
    return false;
  }
  teleportTowards(e: Living): boolean {
    let dx = this.x - e.x, dy = this.y + this.height / 2 - e.y - e.eyeHeight(), dz = this.z - e.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    dx /= d; dy /= d; dz /= d;
    return this.teleportTo(this.x + (Math.random() - 0.5) * 8 - dx * 16, this.y + Math.floor(Math.random() * 16) - 8 - dy * 16, this.z + (Math.random() - 0.5) * 8 - dz * 16);
  }
  private teleportTo(x: number, y: number, z: number): boolean {
    const w = this.world;
    const bx = Math.floor(x), bz = Math.floor(z);
    if (!w.isLoaded(bx, bz)) return false;
    let by = Math.floor(y);
    while (by > -64 && !(FLAGS[w.getBlock(bx, by - 1, bz)] & F_SOLID)) by--;
    if (by <= -64) return false;
    const below = w.getBlock(bx, by - 1, bz);
    if (FLAGS[below] & F_FLUID) return false;
    for (let dy = 0; dy < 3; dy++) {
      const s = w.getBlock(bx, by + dy, bz);
      if (FLAGS[s] & (F_SOLID | F_FLUID)) return false;
    }
    const ox = this.x, oy = this.y, oz = this.z;
    this.setPos(bx + 0.5, by, bz + 0.5);
    this.nav.stop();
    this.host.emit('teleport', { x: ox, y: oy, z: oz, x2: this.x, y2: this.y, z2: this.z, h: this.height });
    return true;
  }
  protected override customAi(): void {
    // água e chuva ferem
    const bx = Math.floor(this.x), bz = Math.floor(this.z);
    if (this.inWater || this.host.isRainingAt(bx, Math.floor(this.y + this.eyeHeight()), bz)) {
      this.hurt({ type: 'drown', bypassArmor: true }, 1);
      if (Math.random() < 0.3) this.teleportRandom();
    }
    // de dia, sob o sol e sem alvo, teleporta à toa
    if (this.host.isDay() && this.age % 20 === 0 && !this.target) {
      const br = this.host.brightness(bx, Math.floor(this.y + this.eyeHeight()), bz) / 15;
      if (br > 0.5 && this.host.canSeeSky(bx, Math.floor(this.y + this.eyeHeight()), bz) && Math.random() * 30 < (br - 0.4) * 2) this.teleportRandom();
    }
    if (this.target) {
      // perseguindo: teleporta para perto se estiver longe
      const t = this.target;
      if (this.distanceSq(t.x, t.y, t.z) > 256 && ++this.aggroTime > 30 && Math.random() < 0.1) { this.teleportTowards(t); this.aggroTime = 0; }
    } else this.creepy = false;
    if (this.stareTicks > 0) this.stareTicks--;
  }
  override hurt(src: DamageSource, amount: number): boolean {
    if (src.type === 'arrow' || src.type === 'fire' && src.attacker?.type === 'fagulha') {
      // projéteis: some antes de ser atingido
      for (let i = 0; i < 64; i++) if (this.teleportRandom()) return false;
      return false;
    }
    const ok = super.hurt(src, amount);
    if (ok && !this.dead && src.type !== 'drown' && Math.random() < 0.1 * 0) this.teleportRandom();
    if (ok && src.type === 'drown') this.teleportRandom();
    return ok;
  }
  override drops(): Drop[] {
    const d: Drop[] = [{ id: 'shade_pearl', min: 0, max: 1 }];
    if (this.carried) d.push({ id: BLOCKS[BLOCK_OF[this.carried]].def.itemOf ?? BLOCKS[BLOCK_OF[this.carried]].name, min: 1, max: 1 });
    return d;
  }
  override save(): Record<string, unknown> { return { ...super.save(), carried: this.carried ? BLOCKS[BLOCK_OF[this.carried]].name : null }; }
}

/** Alvo: jogador que encara nos olhos (e fica irritado mesmo depois). */
class LookForStaringPlayer extends Goal {
  private pending: Player | null = null;
  private delay = 0;
  constructor(private v: Vulto) { super(); this.flags = ['target']; }
  canUse(): boolean {
    const p = this.v.host.nearestPlayer(this.v.x, this.v.y, this.v.z, 64, (pl) => !pl.dead && pl.gameMode === 'survival' && this.v.isLookedAtBy(pl));
    this.pending = p;
    return !!p;
  }
  override start(): void { this.delay = 5; }
  override canContinue(): boolean {
    if (this.pending) {
      if (!this.v.isLookedAtBy(this.pending)) { this.pending = null; return false; }
      this.v.lookCtl.lookAt(this.pending.x, this.pending.y + this.pending.eyeHeight(), this.pending.z, 30, 30);
      if (--this.delay <= 0) { this.v.setStareTarget(this.pending); this.pending = null; }
      return true;
    }
    const t = this.v.target;
    return !!t && !t.dead && this.v.canReach(t) && this.v.distanceTo(t) < 64;
  }
  override stop(): void { if (!this.pending) this.v.target = null; this.pending = null; }
  override tick(): void {
    const t = this.v.target as Player | null;
    if (!t || this.pending) return;
    // olhando de novo: teleporta para perto
    if (this.v.isLookedAtBy(t) && this.v.distanceSq(t.x, t.y, t.z) < 16 && Math.random() < 0.02) this.v.teleportRandom();
  }
}

/** Fica parado encarando de volta quando o jogador olha perto. */
class StareBackGoal extends Goal {
  constructor(private v: Vulto) { super(); this.flags = ['move', 'jump']; }
  canUse(): boolean {
    const t = this.v.target as Player | null;
    if (!t || t.type !== 'player') return false;
    return this.v.distanceSq(t.x, t.y, t.z) <= 16 && this.v.isLookedAtBy(t);
  }
  override start(): void { this.v.nav.stop(); }
  override tick(): void { const t = this.v.target!; this.v.lookCtl.lookAt(t.x, t.y + t.eyeHeight(), t.z, 30, 30); }
}

/** Pega e larga blocos (grama, terra, areia, flores...). */
class CarryBlockGoal extends Goal {
  constructor(private v: Vulto) { super(); this.flags = []; }
  canUse(): boolean { return this.v.host.rules.mobGriefing && Math.random() < (this.v.carried ? 0.05 : 0.05) / 20; }
  override canContinue(): boolean { return false; }
  override start(): void {
    const L = this.v.host;
    const x = Math.floor(this.v.x - 2 + Math.random() * 4), y = Math.floor(this.v.y + Math.random() * 3), z = Math.floor(this.v.z - 2 + Math.random() * 4);
    if (!this.v.carried) {
      const s = L.getBlock(x, y, z);
      if (!CARRYABLE.has(BLOCKS[BLOCK_OF[s]].name)) return;
      if (!lineOfSight(L, this.v.x, this.v.y + this.v.eyeHeight(), this.v.z, x + 0.5, y + 0.5, z + 0.5) && L.getBlock(x, y + 1, z) !== 0) return;
      this.v.carried = s;
      L.setBlock(x, y, z, 0);
    } else {
      const here = L.getBlock(x, y, z), below = L.getBlock(x, y - 1, z);
      if (here !== 0 || !(FLAGS[below] & F_FULL_CUBE_COLLISION) || !OPAQUE[below]) return;
      L.setBlock(x, y, z, this.v.carried);
      this.v.carried = 0;
    }
  }
}

// ================================================================== espreitador (invenção)
/**
 * Espreitador: pedra viva das profundezas. Disfarçado, é um bloco igual ao chão ao redor (render troca
 * o modelo pelo bloco). Quem passa a menos de 4 blocos sem se agachar — ou bate nele — desperta a criatura,
 * que se desdobra em 15 ticks e ataca com botes. Sem alvo por 10 s, volta a se disfarçar num canto.
 */
export class Espreitador extends Monster {
  readonly type = 'espreitador';
  disguised = true;
  /** estado do bloco imitado (para o render) */
  mimic = 0;
  /** 0..1 desdobrando */
  unfold = 0; prevUnfold = 0;
  private idle = 0;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 24; this.baseSpeed = 0.28; this.attackDamage = 6; this.xpReward = 8; this.armorValue = 6;
    this.width = 0.98; this.height = 0.98;
    this.knockbackResistance = 0.6;
  }
  get label(): string { return 'Espreitador'; }
  registerGoals(): void {
    this.goals.add(1, new FloatGoal(this));
    this.goals.add(2, new LurkerLunge(this));
    this.goals.add(3, new MeleeAttackGoal(this, 1.2, true));
    this.goals.add(6, new RandomStrollGoal(this, 0.7, 240, 6));
    this.targets.add(1, new HurtByTargetGoal(this));
    this.targets.add(2, new NearestAttackableTargetGoal(this, (e) => e.type === 'player' && (!this.disguised || this.distanceTo(e) < 4 && !e.isSneaking()), false, 2));
  }
  override init(): this { super.init(); this.pickMimic(); return this; }
  pickMimic(): void {
    const s = this.host.getBlock(Math.floor(this.x), Math.floor(this.y) - 1, Math.floor(this.z));
    const n = BLOCKS[BLOCK_OF[s]].name;
    this.mimic = OPAQUE[s] && FLAGS[s] & F_FULL_CUBE_COLLISION && !['grass_block', 'dirt'].includes(n) ? s : this.host.world.getBlock(0, -64, 0) || s;
    if (!this.mimic) this.mimic = s;
  }
  override tick(): void {
    this.prevUnfold = this.unfold;
    super.tick();
    if (this.dead) return;
    this.unfold += ((this.disguised ? 0 : 1) - this.unfold) * 0.15;
    if (this.disguised) {
      this.vx = 0; this.vz = 0; this.xxa = 0; this.zza = 0;
      // alinha na grade como um bloco
      this.x += (Math.floor(this.x) + 0.5 - this.x) * 0.5;
      this.z += (Math.floor(this.z) + 0.5 - this.z) * 0.5;
      this.yaw = this.bodyYaw = this.yawHead = 0;
      if (this.target) this.reveal();
    } else if (!this.target) {
      if (++this.idle > 200 && this.onGround) { this.disguised = true; this.idle = 0; this.pickMimic(); this.nav.stop(); }
    } else this.idle = 0;
  }
  reveal(): void {
    if (!this.disguised) return;
    this.disguised = false;
    this.host.emit('sound', { name: 'espreitador.reveal', x: this.x, y: this.y, z: this.z });
    this.host.emit('particle', { kind: 'block', state: this.mimic, x: this.x, y: this.y + 0.5, z: this.z, n: 20 });
  }
  override hurt(src: DamageSource, amount: number): boolean {
    this.reveal();
    // disfarçado, pedra: picareta dói mais
    return super.hurt(src, amount);
  }
  override drops(): Drop[] {
    return [{ id: 'flint', min: 1, max: 2 }, { id: 'raw_iron', min: 1, max: 1, chance: 0.25, looting: 0.05 }, { id: 'amethyst_shard', min: 0, max: 2 }];
  }
  override save(): Record<string, unknown> { return { ...super.save(), disguised: this.disguised, mimic: BLOCKS[BLOCK_OF[this.mimic]].name }; }
}

/** Bote: salto rápido quando o alvo está a 2–5 blocos. */
class LurkerLunge extends Goal {
  private cd = 0;
  constructor(private m: Espreitador) { super(); this.flags = ['jump']; }
  canUse(): boolean {
    if (--this.cd > 0) return false;
    const t = this.m.target;
    if (!t || this.m.disguised || !this.m.onGround || this.m.unfold < 0.8) return false;
    const d = this.m.distanceTo(t);
    return d > 2 && d < 5 && this.m.canSee(t);
  }
  override canContinue(): boolean { return false; }
  override start(): void {
    const t = this.m.target!;
    const dx = t.x - this.m.x, dz = t.z - this.m.z, d = Math.hypot(dx, dz) || 1;
    this.m.vx = dx / d * 0.7; this.m.vz = dz / d * 0.7; this.m.vy = 0.45;
    this.cd = 60;
    this.m.host.emit('sound', { name: 'espreitador.lunge', x: this.m.x, y: this.m.y, z: this.m.z });
  }
}

