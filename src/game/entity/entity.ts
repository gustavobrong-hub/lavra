/**
 * Entidade base com a física de movimento do original (Entity.move):
 * colisão AABB resolvida por eixo (Y, depois o eixo de maior deslocamento horizontal),
 * subida de degraus (stepHeight), recuo na beirada ao agachar, queda acumulada e estado em líquidos.
 * Ângulos em graus, convenção do original: yaw 0 = sul (+Z), 90 = oeste (−X); pitch positivo = olhando para baixo.
 */
import { AABB } from '../../core/aabb';
import { MIN_Y, MAX_Y } from '../../core/constants';
import { FLAGS, F_SOLID, F_WATER, F_LAVA, F_WATERLOGGED, FLUID_LEVEL, F_FULL_CUBE_COLLISION, F_CLIMBABLE, BLOCKS, BLOCK_OF } from '../../world/blocks/registry';
import { blockBoxes, type Box } from '../../world/blocks/shapes';
import type { World } from '../../world/world';

let NEXT_ID = 1;
const tmpBoxes: Box[] = [];

export interface EntityHost {
  world: World;
  /** avisos de eventos (som, partículas, dano) */
  emit?(type: string, data: Record<string, unknown>): void;
}

export abstract class Entity {
  readonly id = NEXT_ID++;
  abstract readonly type: string;
  x = 0; y = 0; z = 0;
  prevX = 0; prevY = 0; prevZ = 0;
  vx = 0; vy = 0; vz = 0;
  yaw = 0; pitch = 0;
  prevYaw = 0; prevPitch = 0;
  width = 0.6;
  height = 1.8;
  stepHeight = 0.6;
  onGround = false;
  horizontalCollision = false;
  verticalCollision = false;
  minorHorizontalCollision = false;
  fallDistance = 0;
  noPhysics = false;
  noGravity = false;
  removed = false;
  age = 0;
  inWater = false;
  inLava = false;
  eyeInWater = false;
  eyeInLava = false;
  waterHeight = 0;
  fireTicks = 0;
  invulnerableTicks = 0;
  /** atrito do bloco sob os pés no último tick */
  blockFriction = 0.6;
  /** distância andada (para passos e balanço da câmera) */
  walkDist = 0;
  prevWalkDist = 0;
  /** bloco inválido/carregando: congela a física */
  frozen = false;

  constructor(public host: EntityHost) {}

  get world(): World { return this.host.world; }

  setPos(x: number, y: number, z: number): void {
    this.x = x; this.y = y; this.z = z;
    this.prevX = x; this.prevY = y; this.prevZ = z;
  }

  get bb(): AABB {
    const hw = this.width / 2;
    return new AABB(this.x - hw, this.y, this.z - hw, this.x + hw, this.y + this.height, this.z + hw);
  }

  eyeHeight(): number { return this.height * 0.85; }

  savePrev(): void {
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;
    this.prevYaw = this.yaw; this.prevPitch = this.pitch;
    this.prevWalkDist = this.walkDist;
  }

  // ------------------------------------------------------------ colisão com blocos
  /** Caixas de colisão dos blocos que tocam `region`. Chunks não carregados contam como sólidos. */
  collectBoxes(region: AABB, out: AABB[] = []): AABB[] {
    out.length = 0;
    const w = this.world;
    const x0 = Math.floor(region.minX), x1 = Math.floor(region.maxX);
    const y0 = Math.max(MIN_Y, Math.floor(region.minY) - 1), y1 = Math.min(MAX_Y - 1, Math.floor(region.maxY));
    const z0 = Math.floor(region.minZ), z1 = Math.floor(region.maxZ);
    const get = (gx: number, gy: number, gz: number) => w.getBlock(gx, gy, gz);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (!w.isLoaded(x, z)) {
          out.push(new AABB(x, y0, z, x + 1, y1 + 1, z + 1));
          continue;
        }
        for (let y = y0; y <= y1; y++) {
          const s = w.getBlock(x, y, z);
          if (s === 0) continue;
          const fl = FLAGS[s];
          if (!(fl & F_SOLID)) continue;
          if (fl & F_FULL_CUBE_COLLISION) {
            if (y + 1 > region.minY && y < region.maxY) out.push(new AABB(x, y, z, x + 1, y + 1, z + 1));
            continue;
          }
          for (const b of blockBoxes(s, x, y, z, get, false, tmpBoxes)) {
            const bb = new AABB(x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
            if (bb.intersects(region)) out.push(bb);
          }
        }
      }
    }
    return out;
  }

  isFree(box: AABB): boolean {
    return this.collectBoxes(box, this.scratch).every((b) => !b.intersects(box));
  }
  private scratch: AABB[] = [];
  private scratch2: AABB[] = [];

  /** Resolve o deslocamento contra as caixas: Y, depois o maior eixo horizontal (como no original). */
  private collide(box: AABB, dx: number, dy: number, dz: number, boxes: AABB[]): [number, number, number] {
    let b = box.clone();
    if (dy !== 0) {
      for (const c of boxes) dy = c.clipY(b, dy);
      b = b.offset(0, dy, 0);
    }
    const xFirst = Math.abs(dx) >= Math.abs(dz);
    if (xFirst && dx !== 0) { for (const c of boxes) dx = c.clipX(b, dx); b = b.offset(dx, 0, 0); }
    if (dz !== 0) { for (const c of boxes) dz = c.clipZ(b, dz); b = b.offset(0, 0, dz); }
    if (!xFirst && dx !== 0) { for (const c of boxes) dx = c.clipX(b, dx); }
    return [dx, dy, dz];
  }

  /** Movimento com colisão (MoverType.SELF). */
  move(dx: number, dy: number, dz: number, sneakEdge = false): void {
    if (this.noPhysics) {
      this.x += dx; this.y += dy; this.z += dz;
      return;
    }
    if (sneakEdge) [dx, dz] = this.backOffFromEdge(dx, dz);
    const box = this.bb;
    const boxes = this.collectBoxes(box.expandTowards(dx, dy, dz).inflate(1e-7), this.scratch2);
    let [mx, my, mz] = this.collide(box, dx, dy, dz, boxes);
    const collidedH = mx !== dx || mz !== dz;
    const groundedNow = this.onGround || (my !== dy && dy < 0);
    // subir degrau
    if (this.stepHeight > 0 && groundedNow && collidedH) {
      const up = this.collectBoxes(box.expandTowards(dx, this.stepHeight, dz).inflate(1e-7), []);
      let [sx, sy, sz] = this.collide(box, dx, this.stepHeight, dz, up);
      // alternativa: sobe primeiro, depois anda (resolve obstáculos em cima)
      let [ux, uy, uz] = this.collide(box, 0, this.stepHeight, 0, up);
      if (uy < this.stepHeight) {
        const b2 = box.offset(0, uy, 0);
        const [hx, , hz] = this.collide(b2, dx, 0, dz, up);
        if (hx * hx + hz * hz > sx * sx + sz * sz) { sx = hx; sz = hz; sy = uy; }
      }
      void ux; void uz;
      // desce de volta
      const b3 = box.offset(sx, sy, sz);
      let down = -sy + (dy < 0 ? dy : 0);
      for (const c of up) down = c.clipY(b3, down);
      sy += down;
      if (sx * sx + sz * sz > mx * mx + mz * mz + 1e-7) { mx = sx; my = sy; mz = sz; }
    }
    this.x += mx; this.y += my; this.z += mz;
    const hx = Math.abs(mx - dx) > 1e-7, hz = Math.abs(mz - dz) > 1e-7;
    this.horizontalCollision = hx || hz;
    this.verticalCollision = my !== dy;
    const wasOnGround = this.onGround;
    this.onGround = this.verticalCollision && dy < 0;
    if (hx) this.vx = 0;
    if (hz) this.vz = 0;
    // queda
    if (this.onGround) {
      if (this.fallDistance > 0) this.onLand(this.fallDistance);
      this.fallDistance = 0;
    } else if (my < 0) this.fallDistance -= my;
    if (this.verticalCollision) this.onVerticalCollision(dy);
    const moved = Math.hypot(mx, mz);
    if (this.onGround || this.inWater) this.walkDist += moved * 0.6;
    void wasOnGround;
  }

  /** Chamado ao bater verticalmente (chão/teto). Padrão: zera a velocidade vertical. */
  protected onVerticalCollision(dy: number): void {
    const below = this.blockUnder();
    const name = BLOCKS[BLOCK_OF[below]].name;
    if (dy < 0 && name === 'slime_block' && !this.isSneaking()) {
      if (this.vy < 0) this.vy = -this.vy; // quica
      return;
    }
    if (dy < 0 && name.endsWith('_bed') && !this.isSneaking()) {
      if (this.vy < 0) this.vy = -this.vy * 0.66;
      return;
    }
    this.vy = 0;
  }

  isSneaking(): boolean { return false; }

  /** Ao pousar (queda acumulada). Subclasses aplicam dano. */
  protected onLand(_fall: number): void { /* sem efeito na base */ }

  /** Recuo na beirada ao agachar (maybeBackOffFromEdge). */
  protected backOffFromEdge(dx: number, dz: number): [number, number] {
    if (!this.onGround && !(this.fallDistance < this.stepHeight)) return [dx, dz];
    const step = 0.05;
    const base = this.bb;
    const free = (ox: number, oz: number) => this.isFree(base.offset(ox, -this.stepHeight, oz));
    if (!this.onGround) {
      // só se houver chão logo abaixo
      if (this.isFree(base.offset(0, this.fallDistance - this.stepHeight, 0))) return [dx, dz];
    }
    while (dx !== 0 && free(dx, 0)) dx = dx < step && dx >= -step ? 0 : dx > 0 ? dx - step : dx + step;
    while (dz !== 0 && free(0, dz)) dz = dz < step && dz >= -step ? 0 : dz > 0 ? dz - step : dz + step;
    while (dx !== 0 && dz !== 0 && free(dx, dz)) {
      dx = dx < step && dx >= -step ? 0 : dx > 0 ? dx - step : dx + step;
      dz = dz < step && dz >= -step ? 0 : dz > 0 ? dz - step : dz + step;
    }
    return [dx, dz];
  }

  /** Bloco que afeta o movimento (0,5 abaixo dos pés, como o original). */
  blockUnder(): number {
    return this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5000001), Math.floor(this.z));
  }

  // ------------------------------------------------------------ líquidos
  /** Atualiza inWater/inLava e empurra pela correnteza. Retorna true se em água. */
  updateFluids(pushWater = 0.014, pushLava = 0.007): void {
    const b = this.bb.inflate(-0.001);
    const w = this.world;
    let inW = false, inL = false;
    let fx = 0, fy = 0, fz = 0, n = 0;
    let maxH = 0;
    for (let x = Math.floor(b.minX); x <= Math.floor(b.maxX); x++) {
      for (let z = Math.floor(b.minZ); z <= Math.floor(b.maxZ); z++) {
        for (let y = Math.floor(b.minY); y <= Math.floor(b.maxY); y++) {
          const s = w.getBlock(x, y, z);
          const fl = FLAGS[s];
          if (!(fl & (F_WATER | F_LAVA | F_WATERLOGGED))) continue;
          const h = y + fluidHeight(w, x, y, z, s);
          if (h < b.minY) continue;
          if (fl & (F_WATER | F_WATERLOGGED)) inW = true; else inL = true;
          maxH = Math.max(maxH, h - b.minY);
          const [ffx, ffz] = flowVector(w, x, y, z, s);
          fx += ffx; fz += ffz; n++;
        }
      }
    }
    this.inWater = inW;
    this.inLava = inL;
    this.waterHeight = maxH;
    if (n > 0 && (fx !== 0 || fz !== 0)) {
      const len = Math.hypot(fx, fy, fz);
      const k = inW ? pushWater : pushLava;
      this.vx += (fx / len) * k;
      this.vz += (fz / len) * k;
    }
    // olho submerso
    const ey = this.y + this.eyeHeight() - 0.11111111;
    const es = w.getBlock(Math.floor(this.x), Math.floor(ey), Math.floor(this.z));
    const efl = FLAGS[es];
    this.eyeInWater = false; this.eyeInLava = false;
    if (efl & (F_WATER | F_LAVA | F_WATERLOGGED)) {
      const top = Math.floor(ey) + fluidHeight(w, Math.floor(this.x), Math.floor(ey), Math.floor(this.z), es);
      if (ey < top) { if (efl & (F_WATER | F_WATERLOGGED)) this.eyeInWater = true; else this.eyeInLava = true; }
    }
    if (this.inWater) this.fallDistance = 0;
  }

  onClimbable(): boolean {
    const s = this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    if (FLAGS[s] & F_CLIMBABLE) return true;
    // alçapão aberto sobre escada de mão também conta (simplificado)
    return false;
  }

  distanceTo(o: Entity): number { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
  distanceSq(x: number, y: number, z: number): number { return (this.x - x) ** 2 + (this.y - y) ** 2 + (this.z - z) ** 2; }

  /** Vetor de visão a partir de yaw/pitch (graus). */
  lookVec(): [number, number, number] {
    const yr = this.yaw * Math.PI / 180, pr = this.pitch * Math.PI / 180;
    const c = Math.cos(pr);
    return [-Math.sin(yr) * c, -Math.sin(pr), Math.cos(yr) * c];
  }

  abstract tick(): void;
}

/** Altura do líquido dentro do bloco (0..1). */
export function fluidHeight(w: World, x: number, y: number, z: number, s: number): number {
  const above = w.getBlock(x, y + 1, z);
  const fl = FLAGS[s];
  const WET = F_WATER | F_WATERLOGGED;
  if ((fl & WET && FLAGS[above] & WET) || (fl & F_LAVA && FLAGS[above] & F_LAVA)) return 1;
  if (fl & F_WATERLOGGED) return 8 / 9;
  const lv = FLUID_LEVEL[s];
  if (lv === 255) return 0;
  return lv >= 8 ? 8 / 9 : (8 - lv) / 9;
}

/** Direção da correnteza (aproximação do FlowingFluid.getFlow). */
export function flowVector(w: World, x: number, y: number, z: number, s: number): [number, number] {
  const fl = FLAGS[s] & (F_WATER | F_LAVA);
  const own = fluidHeight(w, x, y, z, s);
  let fx = 0, fz = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = w.getBlock(x + dx, y, z + dz);
    let nh: number;
    if (FLAGS[n] & fl) nh = fluidHeight(w, x + dx, y, z + dz, n);
    else if (FLAGS[n] & F_SOLID) continue;
    else {
      const below = w.getBlock(x + dx, y - 1, z + dz);
      if (!(FLAGS[below] & fl)) continue;
      nh = fluidHeight(w, x + dx, y - 1, z + dz, below) - 1;
    }
    const diff = own - nh;
    fx += dx * diff; fz += dz * diff;
  }
  return [fx, fz];
}
