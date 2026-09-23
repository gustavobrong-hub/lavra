/**
 * Criatura com IA (Mob/PathfinderMob do original): seletores de objetivos e de alvo, controles de
 * movimento/olhar/pulo, navegação A*, dano do ambiente (fogo, lava, afogamento, sufocamento, sol para
 * mortos-vivos), empurrão entre entidades, morte com animação de 20 ticks, saques, XP e despawn.
 */
import { Living, type DamageSource } from './living';
import type { Entity } from './entity';
import type { Level } from '../level';
import { GoalSelector } from './ai/goals';
import { MoveControl, LookControl, JumpControl, PathNavigation, rotlerp, wrapDeg } from './ai/controls';
import { BLOCKS, BLOCK_OF, FLAGS, F_SOLID, F_FULL_CUBE_COLLISION, OPAQUE, STATE_PROPS } from '../../world/blocks';
import { ItemStack } from '../items/stack';
import type { Player } from '../player/player';

export type MobCategory = 'monster' | 'creature' | 'ambient' | 'water_creature' | 'water_ambient' | 'misc';

/** Linha de visão entre dois pontos (blocos com colisão de cubo inteiro bloqueiam, como o COLLIDER do original). */
export function lineOfSight(level: Level, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const w = level.world;
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  if (len > 128) return false;
  dx /= len; dy /= len; dz /= len;
  let x = Math.floor(ax), y = Math.floor(ay), z = Math.floor(az);
  const tx = Math.floor(bx), ty = Math.floor(by), tz = Math.floor(bz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
  let mx = dx !== 0 ? (dx > 0 ? x + 1 - ax : ax - x) * tdx : Infinity;
  let my = dy !== 0 ? (dy > 0 ? y + 1 - ay : ay - y) * tdy : Infinity;
  let mz = dz !== 0 ? (dz > 0 ? z + 1 - az : az - z) * tdz : Infinity;
  for (let i = 0; i < 300; i++) {
    if (x === tx && y === ty && z === tz) return true;
    if (mx < my && mx < mz) { if (mx > len) return true; x += sx; mx += tdx; }
    else if (my < mz) { if (my > len) return true; y += sy; my += tdy; }
    else { if (mz > len) return true; z += sz; mz += tdz; }
    const s = w.getBlock(x, y, z);
    if (s !== 0 && FLAGS[s] & F_SOLID && FLAGS[s] & F_FULL_CUBE_COLLISION) return false;
  }
  return true;
}

export interface Drop { id: string; min: number; max: number; chance?: number; looting?: number; cookedId?: string; playerOnly?: boolean }

export abstract class Mob extends Living {
  declare host: Level;
  readonly goals = new GoalSelector();
  readonly targets = new GoalSelector();
  readonly moveCtl: MoveControl;
  readonly lookCtl: LookControl;
  readonly jumpCtl: JumpControl;
  readonly nav: PathNavigation;
  target: Living | null = null;
  /** atributo de velocidade (o "movement_speed" do original) */
  baseSpeed = 0.25;
  attackDamage = 2;
  attackKnockback = 0;
  followRange = 16;
  hostile = false;
  category: MobCategory = 'creature';
  persistent = false;
  noActionTime = 0;
  xpReward = 0;
  /** morto-vivo: queima ao sol, cura fere, Julgamento dá dano extra */
  undead = false;
  /** imune a fogo e lava */
  fireImmune = false;
  /** respira embaixo d'água */
  waterBreather = false;
  /** multiplicador de dano de queda (0 = imune) */
  fallMult = 1;
  /** equipamento visível e que cai (chance baixa) */
  mainHand: ItemStack | null = null;
  helmet: ItemStack | null = null;
  customName: string | null = null;
  /** som ambiente: contador como o original */
  private ambientTime = 0;
  ambientInterval = 80;
  private losCache = new Map<number, boolean>();
  private losTick = -1;
  /** velocidade de giro do corpo quando parado */
  private headStableTicks = 0;
  private lastStableHead = 0;
  /** montaria / passageiro */
  vehicle: Entity | null = null;
  passenger: Living | null = null;
  /** limites de giro da cabeça (graus por tick / inclinação máxima) */
  headYawMax = 10;
  headPitchMax = 40;

  constructor(host: Level) {
    super(host);
    this.moveCtl = this.createMoveControl();
    this.lookCtl = new LookControl(this);
    this.jumpCtl = new JumpControl(this);
    this.nav = new PathNavigation(this);
  }

  protected createMoveControl(): MoveControl { return new MoveControl(this); }

  /** Registra objetivos e alvos (chamado uma vez após a construção). */
  abstract registerGoals(): void;
  /** Saques (tabela simplificada do original). */
  drops(): Drop[] { return []; }
  /** Rótulo em pt-BR (tela de morte, depuração). */
  abstract get label(): string;

  init(): this {
    this.registerGoals();
    this.health = this.maxHealth;
    this.yawHead = this.bodyYaw = this.yaw;
    return this;
  }

  get level(): Level { return this.host; }
  get isBaby(): boolean { return false; }

  // ---------------------------------------------------------------- consultas para os objetivos
  nearestPlayer(r: number): Player | null {
    return this.host.nearestPlayer(this.x, this.y, this.z, r, (p) => !p.dead && p.gameMode !== 'spectator');
  }

  canSee(e: Entity): boolean {
    if (this.losTick !== this.age) { this.losCache.clear(); this.losTick = this.age; }
    const c = this.losCache.get(e.id);
    if (c !== undefined) return c;
    const ok = lineOfSight(this.host, this.x, this.y + this.eyeHeight(), this.z, e.x, e.y + (e as Living).eyeHeight(), e.z);
    this.losCache.set(e.id, ok);
    return ok;
  }

  /** O alvo é atacável (jogador em sobrevivência, vivo). */
  canReach(t: Living): boolean {
    if (t.type === 'player') { const p = t as Player; return p.gameMode === 'survival' && !p.dead; }
    return !t.dead;
  }

  canAttackType(e: Living): boolean { return e.type !== this.type; }

  /** Nota de preferência de posição (animais preferem grama; monstros, escuro). */
  walkTargetValue(x: number, y: number, z: number): number {
    const below = BLOCKS[BLOCK_OF[this.host.getBlock(x, y - 1, z)]].name;
    if (this.category === 'creature') return below === 'grass_block' ? 10 : this.host.brightness(x, y, z) - 0.5;
    if (this.hostile) return 0.5 - this.host.brightness(x, y, z) / 15;
    return 0;
  }

  /** Procura chão perto de (x, y, z): devolve o y dos pés ou null. */
  findGroundNear(x: number, y: number, z: number, dy: number): number | null {
    const w = this.host.world;
    if (!w.isLoaded(x, z)) return null;
    for (let d = 0; d <= dy; d++) for (const s of d === 0 ? [0] : [d, -d]) {
      const yy = y + s;
      const below = w.getBlock(x, yy - 1, z);
      if (!(FLAGS[below] & F_SOLID)) continue;
      const a = w.getBlock(x, yy, z), b = w.getBlock(x, yy + 1, z);
      if (FLAGS[a] & F_SOLID || (this.height > 1 && FLAGS[b] & F_SOLID)) continue;
      return yy;
    }
    return null;
  }

  // ---------------------------------------------------------------- combate
  /** Ataque corpo a corpo (Mob.doHurtTarget). */
  doHurtTarget(t: Living): boolean {
    let dmg = this.attackDamage;
    let kb = this.attackKnockback;
    const sharp = this.mainHand?.enchantLevel('sharpness') ?? 0;
    if (sharp) dmg += 0.5 * sharp + 0.5;
    kb += this.mainHand?.enchantLevel('knockback') ?? 0;
    const fire = this.mainHand?.enchantLevel('fire_aspect') ?? 0;
    if (fire > 0) t.fireTicks = Math.max(t.fireTicks, fire * 80);
    const ok = t.hurt({ type: 'mob', attacker: this }, dmg);
    if (ok) {
      if (kb > 0) {
        const r = this.yaw * Math.PI / 180;
        t.knockback(kb * 0.5, Math.sin(r), -Math.cos(r));
        this.vx *= 0.6; this.vz *= 0.6;
      }
      this.lastHurtMob = t;
      this.onAttacked(t);
    }
    return ok;
  }

  protected onAttacked(_t: Living): void { /* efeitos (veneno da tecelã, fome do carniçal) */ }

  override hurt(src: DamageSource, amount: number): boolean {
    if (this.dead) return false;
    if (this.fireImmune && (src.type === 'fire' || src.type === 'lava' || src.type === 'onFire')) return false;
    if (this.undead && src.type === 'drown') return false;
    const ok = super.hurt(src, amount);
    if (ok) this.host.emit('mobHurt', { id: this.id, mob: this.type, x: this.x, y: this.y + this.height / 2, z: this.z });
    return ok;
  }

  override die(src: DamageSource): void {
    if (this.dead) return;
    super.die(src);
    this.deathTime = 0;
    this.nav.stop();
    const byPlayer = this.lastHurtByPlayerTime > 0;
    const killer = src.attacker && src.attacker.type === 'player' ? src.attacker as Player : null;
    const looting = killer?.inventory.held?.enchantLevel('looting') ?? 0;
    if (this.host.rules.doTileDrops !== false && !this.isBaby) this.dropLoot(byPlayer, looting);
    if (byPlayer && !this.isBaby && this.xpReward > 0) this.host.emit('xp', { x: this.x, y: this.y + 0.5, z: this.z, amount: this.experience() });
    this.host.emit('mobDeath', { id: this.id, mob: this.type, x: this.x, y: this.y, z: this.z, by: killer ? 'player' : src.type });
    if (this.passenger) this.dismount();
  }

  experience(): number {
    let xp = this.xpReward;
    if (this.mainHand) xp += 1 + Math.floor(Math.random() * 3);
    if (this.helmet) xp += 1 + Math.floor(Math.random() * 3);
    return xp;
  }

  protected dropLoot(byPlayer: boolean, looting: number): void {
    const burning = this.fireTicks > 0;
    for (const d of this.drops()) {
      if (d.playerOnly && !byPlayer) continue;
      if (d.chance !== undefined && Math.random() >= d.chance + (d.looting ?? 0) * looting) continue;
      let n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (looting && d.chance === undefined) n += Math.floor(Math.random() * (looting + 1));
      if (n <= 0) continue;
      const id = burning && d.cookedId ? d.cookedId : d.id;
      this.host.spawnItem(this.x, this.y + 0.5, this.z, new ItemStack(id, n));
    }
    // equipamento: 8,5% (+1% por nível de pilhagem) com desgaste aleatório
    for (const eq of [this.mainHand, this.helmet]) {
      if (!eq || !byPlayer) continue;
      if (Math.random() < 0.085 + looting * 0.01) {
        const c = eq.copy();
        if (c.damageable) c.damage = Math.floor(c.maxDamage * (0.2 + Math.random() * 0.7));
        this.host.spawnItem(this.x, this.y + 0.5, this.z, c);
      }
    }
  }

  /** Clique direito do jogador com um item. Retorna true se usou a ação. */
  interact(p: Player, st: ItemStack | null): boolean {
    if (st?.id === 'name_tag' && st.tag?.name) {
      this.customName = st.tag.name;
      this.persistent = true;
      if (p.gameMode !== 'creative') p.inventory.consumeHeld(1);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- montaria
  dismount(): void {
    const p = this.passenger;
    if (!p) return;
    this.passenger = null;
    (p as Living & { vehicle?: Entity | null }).vehicle = null;
    p.setPos(this.x, this.y + this.height, this.z);
  }

  // ---------------------------------------------------------------- tick
  tick(): void {
    this.age++;
    this.savePrev();
    this.prevYawHead = this.yawHead;
    this.prevBodyYaw = this.bodyYaw;
    if (!this.world.isLoaded(Math.floor(this.x), Math.floor(this.z))) return;
    if (this.dead) {
      this.deathTime++;
      this.xxa = this.zza = 0;
      this.jumping = false;
      this.updateFluids();
      super.aiStep();
      if (this.deathTime >= 20) {
        this.removed = true;
        this.host.emit('poof', { x: this.x, y: this.y + this.height / 2, z: this.z, w: this.width, h: this.height });
      }
      return;
    }
    if (this.invulnerableTime > 0) this.invulnerableTime--;
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.lastHurtByPlayerTime > 0) this.lastHurtByPlayerTime--;
    if (this.lastHurtBy && (this.lastHurtBy.dead || this.lastHurtBy.removed || this.age - this.lastHurtTime > 100)) this.lastHurtBy = null;
    this.updateFluids();
    this.baseTick();
    if (this.dead) return;
    // IA (serverAiStep)
    this.noActionTime++;
    this.checkDespawn();
    if (this.removed) return;
    if (!this.passenger || !this.controlledByPassenger()) {
      this.targets.tick();
      this.goals.tick();
      this.nav.tick();
      this.customAi();
      this.moveCtl.tick();
      this.lookCtl.tick();
      this.jumpCtl.tick();
    } else this.customAi();
    this.aiStep();
    this.bodyRotation();
    this.pushEntities();
    this.updateSwing();
    this.tickEffects();
    this.effectDamage();
    this.ambientSound();
  }

  /** Montaria controlada por quem está em cima (cavalo selado). */
  protected controlledByPassenger(): boolean { return false; }

  /** Lógica específica por espécie (a cada tick, antes dos controles aplicarem). */
  protected customAi(): void { /* opcional */ }

  private ambientSound(): void {
    if (Math.random() * 1000 < this.ambientTime++) {
      this.ambientTime = -this.ambientInterval;
      this.host.emit('mobAmbient', { id: this.id, mob: this.type, x: this.x, y: this.y + this.eyeHeight(), z: this.z, baby: this.isBaby });
    }
  }

  /** Dano do ambiente: fogo, lava, afogamento, sufocamento, vazio, sol. */
  protected baseTick(): void {
    const w = this.world;
    const bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
    // fogo e lava
    if (this.inLava) {
      if (!this.fireImmune) { this.hurt({ type: 'lava' }, 4); this.fireTicks = Math.max(this.fireTicks, 300); }
      this.fallDistance *= 0.5;
    }
    const feet = w.getBlock(bx, by, bz);
    const fname = BLOCKS[BLOCK_OF[feet]].name;
    if (fname === 'fire' || fname === 'soul_fire' || (fname === 'campfire' && STATE_PROPS[feet].lit)) {
      if (!this.fireImmune) { this.hurt({ type: 'fire' }, 1); this.fireTicks = Math.max(this.fireTicks, 160); }
    }
    if (this.fireTicks > 0) {
      if (this.inWater || this.host.isRainingAt(bx, Math.floor(this.y + this.height), bz)) this.fireTicks = 0;
      else if (this.fireImmune) this.fireTicks = Math.max(0, this.fireTicks - 4);
      else {
        if (this.fireTicks % 20 === 0) this.hurt({ type: 'onFire' }, 1);
        this.fireTicks--;
      }
    }
    // sol queima mortos-vivos
    if (this.undead && this.sunBurns()) {
      if (this.helmet) {
        this.helmet.damage += Math.floor(Math.random() * 2);
        if (this.helmet.damage >= this.helmet.maxDamage) this.helmet = null;
      } else this.fireTicks = Math.max(this.fireTicks, 160);
    }
    // ar
    if (!this.waterBreather && !this.undead) {
      if (this.eyeInWater && !this.hasEffect('water_breathing')) {
        this.airSupply--;
        if (this.airSupply <= -20) { this.airSupply = 0; this.hurt({ type: 'drown', bypassArmor: true }, 2); }
      } else if (this.airSupply < this.maxAirSupply) this.airSupply = Math.min(this.maxAirSupply, this.airSupply + 4);
    }
    // sufocamento
    const hy = Math.floor(this.y + this.eyeHeight());
    const head = w.getBlock(bx, hy, bz);
    if (!this.noPhysics && OPAQUE[head] && FLAGS[head] & F_FULL_CUBE_COLLISION) this.hurt({ type: 'suffocate', bypassArmor: true }, 1);
    if (this.y < -128) this.hurt({ type: 'void', bypassArmor: true }, 4);
    // cacto
    if (this.age % 10 === 0) {
      const bb = this.bb.inflate(0.01);
      for (let x = Math.floor(bb.minX); x <= Math.floor(bb.maxX); x++) for (let z = Math.floor(bb.minZ); z <= Math.floor(bb.maxZ); z++) for (let y = Math.floor(bb.minY); y <= Math.floor(bb.maxY); y++) {
        if (BLOCKS[BLOCK_OF[w.getBlock(x, y, z)]].name === 'cactus') this.hurt({ type: 'cactus' }, 1);
      }
    }
  }

  /** isSunBurnTick do original. */
  protected sunBurns(): boolean {
    const L = this.host;
    if (!L.isDay()) return false;
    const x = Math.floor(this.x), y = Math.floor(this.y + this.eyeHeight()), z = Math.floor(this.z);
    const br = L.world.getBrightness(x, y, z, L.skyDarken) / 15;
    if (br <= 0.5 || this.inWater || L.isRainingAt(x, y, z)) return false;
    if (Math.random() * 30 >= (br - 0.4) * 2) return false;
    return L.canSeeSky(x, y, z);
  }

  private effectDamage(): void {
    if (this.hasEffect('poison') && this.health > 1 && !this.undead) {
      const lvl = this.effectLevel('poison');
      if (this.age % Math.max(1, 25 >> (lvl - 1)) === 0) this.hurt({ type: 'magic', bypassArmor: true }, 1);
    }
    if (this.hasEffect('wither')) {
      const lvl = this.effectLevel('wither');
      if (this.age % Math.max(1, 40 >> (lvl - 1)) === 0) this.hurt({ type: 'wither', bypassArmor: true }, 1);
    }
    if (this.hasEffect('regeneration')) {
      const lvl = this.effectLevel('regeneration');
      if (this.age % Math.max(1, 50 >> (lvl - 1)) === 0) this.heal(1);
    }
  }

  protected override onLand(fall: number): void {
    if (this.fallMult <= 0 || this.inWater) return;
    const dmg = Math.ceil((fall - 3 - this.effectLevel('jump_boost')) * this.fallMult);
    if (dmg > 0) this.hurt({ type: 'fall' }, dmg);
  }

  /** BodyRotationControl: o corpo segue a direção do movimento; parado, acompanha a cabeça aos poucos. */
  private bodyRotation(): void {
    const dx = this.x - this.prevX, dz = this.z - this.prevZ;
    if (dx * dx + dz * dz > 2.5e-7) {
      this.bodyYaw = rotlerp(this.bodyYaw, this.yaw, 30);
      const d = wrapDeg(this.yawHead - this.bodyYaw);
      if (d > 75) this.yawHead = this.bodyYaw + 75; else if (d < -75) this.yawHead = this.bodyYaw - 75;
      this.headStableTicks = 0;
    } else {
      if (Math.abs(wrapDeg(this.yawHead - this.lastStableHead)) > 15) {
        this.headStableTicks = 0;
        this.lastStableHead = this.yawHead;
        const d = wrapDeg(this.bodyYaw - this.yawHead);
        if (d > 75) this.bodyYaw = this.yawHead + 75; else if (d < -75) this.bodyYaw = this.yawHead - 75;
      } else if (++this.headStableTicks > 10) {
        const k = Math.max(1 - (this.headStableTicks - 10) / 10, 0) * 75;
        const d = wrapDeg(this.bodyYaw - this.yawHead);
        if (d > k) this.bodyYaw = this.yawHead + k; else if (d < -k) this.bodyYaw = this.yawHead - k;
      }
    }
  }

  /** Empurrão entre entidades (pushEntities do original). */
  private pushEntities(): void {
    const list = this.host.entities.inBox(this.bb.inflate(0.2, 0, 0.2), (e) => e !== this && (e as Living).health !== undefined && !(e as Living).dead && e !== this.passenger && e !== this.vehicle);
    for (const o of list) {
      let dx = o.x - this.x, dz = o.z - this.z;
      let d = Math.max(Math.abs(dx), Math.abs(dz));
      if (d < 0.01) continue;
      d = Math.sqrt(d);
      dx /= d; dz /= d;
      const k = Math.min(1, 1 / d) * 0.05;
      dx *= k; dz *= k;
      if (!this.passenger) { this.vx -= dx; this.vz -= dz; }
      if (o.type !== 'player' || !(o as Player).noPhysics) { o.vx += dx; o.vz += dz; }
    }
  }

  /** checkDespawn do original: longe demais some; ocioso a mais de 32 blocos pode sumir. */
  private checkDespawn(): void {
    if (this.host.difficulty === 'peaceful' && this.hostile) { this.removed = true; return; }
    if (this.persistent || this.customName || this.passenger) { this.noActionTime = 0; return; }
    const p = this.host.nearestPlayer(this.x, this.y, this.z, -1);
    if (!p) return;
    const d2 = p.distanceSq(this.x, this.y, this.z);
    if (d2 > 128 * 128) { this.removed = true; return; }
    if (this.noActionTime > 600 && Math.random() * 800 < 1 && d2 > 32 * 32) this.removed = true;
    else if (d2 < 32 * 32) this.noActionTime = 0;
  }

  // ---------------------------------------------------------------- salvar
  save(): Record<string, unknown> {
    return {
      type: this.type, x: this.x, y: this.y, z: this.z, yaw: this.yaw, health: this.health,
      persistent: this.persistent, name: this.customName, fire: this.fireTicks,
      hand: this.mainHand ? [this.mainHand.id, this.mainHand.count, this.mainHand.damage] : undefined,
      helmet: this.helmet ? [this.helmet.id, this.helmet.count, this.helmet.damage] : undefined,
    };
  }

  load(d: Record<string, unknown>): void {
    this.setPos(d.x as number, d.y as number, d.z as number);
    this.yaw = this.bodyYaw = this.yawHead = (d.yaw as number) ?? 0;
    if (typeof d.health === 'number') this.health = d.health;
    this.persistent = !!d.persistent;
    this.customName = (d.name as string) ?? null;
    this.fireTicks = (d.fire as number) ?? 0;
    const h = d.hand as [string, number, number] | undefined;
    if (h) this.mainHand = new ItemStack(h[0], h[1], h[2]);
    const hm = d.helmet as [string, number, number] | undefined;
    if (hm) this.helmet = new ItemStack(hm[0], hm[1], hm[2]);
  }
}
