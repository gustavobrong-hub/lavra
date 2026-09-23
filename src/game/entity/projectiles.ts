/**
 * Projéteis com a física do original: flecha (gravidade 0,05, arrasto 0,99 / 0,6 na água, dano =
 * ⌈velocidade × dano-base⌉ + crítico), arremessáveis (bola de neve, ovo, poção: gravidade 0,03/0,05),
 * bolas de fogo (aceleração constante, arrasto 0,95) e o arpão do náufrago.
 */
import { Entity } from './entity';
import type { Level } from '../level';
import type { Living } from './living';
import { raycastBlocks } from '../raycast';
import { AABB } from '../../core/aabb';
import { ItemStack } from '../items/stack';
import { BLOCKS, BLOCK_OF, FLAGS, F_SOLID, S } from '../../world/blocks';
import { explode } from '../explosion';
import { applyPotion, potionEffects } from '../items/potions';

/** Gaussiana triangular do original (random.triangle(0, spread)). */
const tri = (spread: number) => (Math.random() - Math.random()) * spread;

export abstract class Projectile extends Entity {
  declare host: Level;
  owner: Living | null = null;
  /** saiu da caixa do dono (antes disso não o acerta) */
  private leftOwner = false;
  gravity = 0.03;
  drag = 0.99;
  constructor(host: Level) { super(host); this.width = 0.25; this.height = 0.25; this.stepHeight = 0; }

  /** Lança na direção (dx, dy, dz) com velocidade e imprecisão (shoot do original). */
  shoot(dx: number, dy: number, dz: number, speed: number, inaccuracy: number): void {
    const len = Math.hypot(dx, dy, dz) || 1;
    dx = dx / len + tri(0.0172275 * inaccuracy);
    dy = dy / len + tri(0.0172275 * inaccuracy);
    dz = dz / len + tri(0.0172275 * inaccuracy);
    this.vx = dx * speed; this.vy = dy * speed; this.vz = dz * speed;
    const h = Math.hypot(this.vx, this.vz);
    this.yaw = (Math.atan2(this.vx, this.vz) * 180) / Math.PI;
    this.pitch = (Math.atan2(this.vy, h) * 180) / Math.PI;
    this.prevYaw = this.yaw; this.prevPitch = this.pitch;
  }

  /** Lança a partir de quem atira, somando a velocidade dela (shootFromRotation). */
  shootFrom(shooter: Living, pitch: number, yaw: number, roll: number, speed: number, inaccuracy: number): void {
    const r = Math.PI / 180;
    const dx = -Math.sin(yaw * r) * Math.cos(pitch * r);
    const dy = -Math.sin((pitch + roll) * r);
    const dz = Math.cos(yaw * r) * Math.cos(pitch * r);
    this.shoot(dx, dy, dz, speed, inaccuracy);
    this.vx += shooter.vx; this.vz += shooter.vz;
    if (!shooter.onGround) this.vy += shooter.vy;
  }

  protected abstract onHitEntity(e: Living): void;
  protected abstract onHitBlock(x: number, y: number, z: number, face: number, px: number, py: number, pz: number): void;
  protected canHit(e: Entity): boolean {
    if (e === this || e.removed || (e as Living).health === undefined || (e as Living).dead) return false;
    if (e.type === 'player' && (e as Living & { gameMode?: string }).gameMode === 'spectator') return false;
    if (e === this.owner && !this.leftOwner) return false;
    return true;
  }

  /** Move um passo verificando blocos e entidades no caminho. Retorna true se bateu. */
  protected step(): boolean {
    const ox = this.x, oy = this.y + this.height / 2, oz = this.z;
    const len = Math.hypot(this.vx, this.vy, this.vz);
    let hitT = Infinity;
    let block: ReturnType<typeof raycastBlocks> = null;
    if (len > 1e-6) {
      block = raycastBlocks(this.world, ox, oy, oz, this.vx, this.vy, this.vz, len);
      if (block) hitT = block.dist;
    }
    // entidades no trajeto
    let target: Living | null = null;
    const sweep = this.bb.expandTowards(this.vx, this.vy, this.vz).inflate(1);
    for (const e of this.host.entities.inBox(sweep, (o) => this.canHit(o))) {
      const bb = e.bb.inflate(0.3);
      const h = bb.rayHit(ox, oy, oz, this.vx / (len || 1), this.vy / (len || 1), this.vz / (len || 1), len);
      const inside = bb.contains(ox, oy, oz);
      const t = inside ? 0 : h?.t;
      if (t !== undefined && t < hitT) { hitT = t; target = e as Living; }
    }
    if (this.owner && !this.leftOwner && !this.owner.bb.inflate(1).intersects(this.bb)) this.leftOwner = true;
    if (target) {
      this.onHitEntity(target);
      return true;
    }
    if (block) {
      this.x = block.px; this.y = block.py - this.height / 2; this.z = block.pz;
      this.onHitBlock(block.x, block.y, block.z, block.face, block.px, block.py, block.pz);
      return true;
    }
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
    return false;
  }

  protected updateRotation(): void {
    const h = Math.hypot(this.vx, this.vz);
    const ty = (Math.atan2(this.vx, this.vz) * 180) / Math.PI, tp = (Math.atan2(this.vy, h) * 180) / Math.PI;
    const lerp = (a: number, b: number) => { while (b - a < -180) a -= 360; while (b - a >= 180) a += 360; return a + (b - a) * 0.2; };
    this.pitch = lerp(this.prevPitch, tp);
    this.yaw = lerp(this.prevYaw, ty);
  }
}

// ================================================================== flecha
export class Arrow extends Projectile {
  readonly type = 'arrow';
  baseDamage = 2;
  crit = false;
  punch = 0;
  flame = false;
  /** 0 não pode pegar, 1 pode, 2 só criativo */
  pickup: 0 | 1 | 2 = 0;
  inGround = false;
  private groundTime = 0;
  private stuck: [number, number, number, number] | null = null;
  shake = 0;
  /** efeito da flecha com poção */
  potion?: string;
  constructor(host: Level) { super(host); this.width = 0.5; this.height = 0.5; this.gravity = 0.05; }

  tick(): void {
    this.age++;
    this.savePrev();
    if (this.shake > 0) this.shake--;
    if (this.inGround) {
      // cai se o bloco sumir
      const st = this.stuck!;
      if (this.world.getBlock(st[0], st[1], st[2]) !== st[3]) {
        this.inGround = false;
        this.vx *= Math.random() * 0.2; this.vy *= Math.random() * 0.2; this.vz *= Math.random() * 0.2;
      } else {
        if (++this.groundTime >= 1200) this.removed = true;
        return;
      }
    }
    this.updateFluids();
    if (this.fireTicks > 0 && this.inWater) this.fireTicks = 0;
    if (this.step()) { if (!this.removed) this.updateRotation(); return; }
    this.updateRotation();
    const drag = this.inWater ? 0.6 : 0.99;
    this.vx *= drag; this.vy *= drag; this.vz *= drag;
    this.vy -= this.gravity;
    if (this.crit) this.host.emit('particle', { kind: 'crit', x: this.x, y: this.y + 0.25, z: this.z });
    if (this.y < -128) this.removed = true;
  }

  protected onHitEntity(e: Living): void {
    const speed = Math.hypot(this.vx, this.vy, this.vz);
    let dmg = Math.ceil(Math.max(0, speed * this.baseDamage));
    if (this.crit) dmg += Math.floor(Math.random() * (Math.floor(dmg / 2) + 2));
    if (this.flame && e.type !== 'vulto') e.fireTicks = Math.max(e.fireTicks, 100);
    // vulto desvia de flechas (teleporta)
    if (e.type === 'vulto') { (e as Living & { teleportRandom?: () => void }).teleportRandom?.(); return; }
    const from: [number, number, number] = [this.x - this.vx, this.y - this.vy, this.z - this.vz];
    if (e.hurt({ type: 'arrow', attacker: this.owner ?? undefined, from }, dmg)) {
      if (this.punch > 0) {
        const h = Math.hypot(this.vx, this.vz) || 1;
        const k = this.punch * 0.6;
        e.vx += (this.vx / h) * k; e.vy += 0.1; e.vz += (this.vz / h) * k;
      }
      if (this.potion) for (const ef of potionEffects(this.potion)) e.addEffect({ ...ef, duration: Math.max(1, Math.floor(ef.duration / 8)) });
      this.host.emit('sound', { name: 'arrow.hit', x: this.x, y: this.y, z: this.z });
      if (e.type === 'player') (e as Living & { arrowsStuck?: number }).arrowsStuck = ((e as Living & { arrowsStuck?: number }).arrowsStuck ?? 0) + 1;
      this.removed = true;
    } else {
      // ricocheteia
      this.vx *= -0.1; this.vy *= -0.1; this.vz *= -0.1;
      this.yaw += 180; this.prevYaw += 180;
    }
  }

  protected onHitBlock(x: number, y: number, z: number): void {
    this.inGround = true;
    this.stuck = [x, y, z, this.world.getBlock(x, y, z)];
    this.shake = 7;
    this.crit = false;
    this.vx = this.vy = this.vz = 0;
    this.host.emit('sound', { name: 'arrow.land', x: this.x, y: this.y, z: this.z });
    // alvo de fulgor e botões de madeira reagem a flechas (tratado pelo nível)
    this.host.emit('projectileHitBlock', { x, y, z, kind: 'arrow', px: this.x, py: this.y, pz: this.z });
  }
}

// ================================================================== arremessáveis
export class Throwable extends Projectile {
  readonly type = 'throwable';
  constructor(host: Level, public item: ItemStack) {
    super(host);
    this.gravity = item.id === 'splash_potion' ? 0.05 : 0.03;
  }
  tick(): void {
    this.age++;
    this.savePrev();
    this.updateFluids();
    if (this.step()) { this.impact(); return; }
    const drag = this.inWater ? 0.8 : 0.99;
    this.vx *= drag; this.vy *= drag; this.vz *= drag;
    this.vy -= this.gravity;
    if (this.y < -128) this.removed = true;
  }
  private hitEntity: Living | null = null;
  protected onHitEntity(e: Living): void {
    this.hitEntity = e;
    if (this.item.id === 'snowball') e.hurt({ type: 'generic', attacker: this.owner ?? undefined, from: [this.x, this.y, this.z] }, e.type === 'fagulha' ? 3 : 0);
    else if (this.item.id === 'egg') e.hurt({ type: 'generic', attacker: this.owner ?? undefined, from: [this.x, this.y, this.z] }, 0);
  }
  protected onHitBlock(): void { /* impacto trata tudo */ }
  private impact(): void {
    const L = this.host;
    const id = this.item.id;
    if (id === 'egg' && Math.random() * 8 < 1) {
      const n = Math.random() * 32 < 1 ? 4 : 1;
      for (let i = 0; i < n; i++) L.emit('spawnMob', { mob: 'chicken', x: this.x, y: this.y, z: this.z, baby: true });
    }
    if (id === 'splash_potion') {
      const pot = this.item.tag?.potion as string | undefined;
      if (pot) {
        for (const e of L.entities.inBox(this.bb.inflate(4, 2, 4), (o) => (o as Living).health !== undefined && !(o as Living).dead)) {
          const d2 = e.distanceSq(this.x, this.y, this.z);
          if (d2 >= 16) continue;
          const k = e === this.hitEntity ? 1 : 1 - Math.sqrt(d2) / 4;
          applyPotion(e as Living, pot, k, this.owner);
        }
      }
      L.emit('splash', { x: this.x, y: this.y, z: this.z, color: this.item.tag?.color ?? 0x3355ff });
    }
    if (id === 'shade_pearl' && this.owner && !this.owner.dead) {
      // pérola do vulto: teleporta quem jogou (5 de dano de queda)
      const o = this.owner;
      o.setPos(this.x, this.y, this.z);
      o.fallDistance = 0;
      o.hurt({ type: 'fall' }, 5);
      L.emit('teleport', { x: this.x, y: this.y, z: this.z, x2: this.x, y2: this.y, z2: this.z, h: o.height });
    }
    if (id === 'experience_bottle') L.emit('xp', { x: this.x, y: this.y, z: this.z, amount: 3 + Math.floor(Math.random() * 5) + Math.floor(Math.random() * 5) });
    L.emit('particle', { kind: id === 'egg' ? 'egg' : id === 'snowball' ? 'snow' : id === 'shade_pearl' ? 'portal' : 'splash', x: this.x, y: this.y, z: this.z, n: 8 });
    this.removed = true;
  }
}

// ================================================================== bolas de fogo
export class Fireball extends Projectile {
  readonly type = 'fireball';
  ax = 0; ay = 0; az = 0;
  /** potência de explosão (0 = bola pequena que só incendeia) */
  power = 0;
  life = 0;
  constructor(host: Level, public big: boolean) {
    super(host);
    this.width = this.height = big ? 1 : 0.3125;
    this.noGravity = true;
    if (big) this.power = 1;
  }
  /** Direciona com aceleração normalizada (AbstractHurtingProjectile). */
  aim(dx: number, dy: number, dz: number, spread = 0): void {
    dx += tri(spread); dy += tri(spread); dz += tri(spread);
    const d = Math.hypot(dx, dy, dz) || 1;
    this.ax = (dx / d) * 0.1; this.ay = (dy / d) * 0.1; this.az = (dz / d) * 0.1;
  }
  tick(): void {
    this.age++;
    this.savePrev();
    if (++this.life > 200 || this.y < -128) { this.removed = true; return; }
    this.updateFluids();
    if (this.step()) return;
    const drag = this.inWater ? 0.8 : 0.95;
    this.vx = (this.vx + this.ax) * drag; this.vy = (this.vy + this.ay) * drag; this.vz = (this.vz + this.az) * drag;
    this.host.emit('particle', { kind: 'flame', x: this.x, y: this.y + this.height / 2, z: this.z });
  }
  /** Rebater: quem acerta a bola de fogo a devolve na direção que olha. */
  deflect(by: Living): void {
    const [dx, dy, dz] = by.lookVec();
    this.vx = dx; this.vy = dy; this.vz = dz;
    this.ax = dx * 0.1; this.ay = dy * 0.1; this.az = dz * 0.1;
    this.owner = by;
    this.life = 0;
  }
  protected onHitEntity(e: Living): void {
    if (this.big) { this.boom(); return; }
    if (e.fireTicks <= 0 && !(e as Living & { fireImmune?: boolean }).fireImmune) {
      if (e.hurt({ type: 'fire', attacker: this.owner ?? undefined, from: [this.x, this.y, this.z] }, 5)) e.fireTicks = Math.max(e.fireTicks, 100);
    }
    this.removed = true;
  }
  protected onHitBlock(x: number, y: number, z: number, face: number): void {
    if (this.big) { this.boom(); return; }
    const L = this.host;
    if (L.rules.mobGriefing !== false) {
      const D = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][face] ?? [0, 1, 0];
      const fx = x + D[0], fy = y + D[1], fz = z + D[2];
      if (L.getBlock(fx, fy, fz) === 0 && FLAGS[L.getBlock(fx, fy - 1, fz)] & F_SOLID) L.setBlock(fx, fy, fz, S('fire'));
    }
    this.removed = true;
  }
  private boom(): void {
    explode(this.host, this.x, this.y, this.z, this.power, { fire: this.host.rules.mobGriefing !== false, attacker: this.owner });
    this.removed = true;
  }
}

// ================================================================== arpão (náufrago e jogador)
export class Harpoon extends Projectile {
  readonly type = 'harpoon';
  item: ItemStack;
  private dealt = false;
  inGround = false;
  private groundTime = 0;
  constructor(host: Level, st: ItemStack) { super(host); this.item = st; this.width = this.height = 0.5; this.gravity = 0.05; }
  tick(): void {
    this.age++;
    this.savePrev();
    if (this.inGround) { if (++this.groundTime > 1200) this.removed = true; return; }
    this.updateFluids();
    if (this.step()) { this.updateRotation(); return; }
    this.updateRotation();
    const drag = this.inWater ? 0.99 : 0.99;
    this.vx *= drag; this.vy *= drag; this.vz *= drag;
    this.vy -= this.gravity;
    if (this.y < -128) this.removed = true;
  }
  protected onHitEntity(e: Living): void {
    if (this.dealt) return;
    this.dealt = true;
    e.hurt({ type: 'arrow', attacker: this.owner ?? undefined, from: [this.x - this.vx, this.y, this.z - this.vz] }, 8);
    this.vx *= -0.01; this.vy *= -0.1; this.vz *= -0.01;
  }
  protected onHitBlock(): void {
    this.inGround = true;
    this.vx = this.vy = this.vz = 0;
    this.host.emit('sound', { name: 'harpoon.land', x: this.x, y: this.y, z: this.z });
  }
}

export function blockNameAt(level: Level, x: number, y: number, z: number): string { return BLOCKS[BLOCK_OF[level.getBlock(x, y, z)]].name; }
export { AABB };
