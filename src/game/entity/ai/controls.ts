/**
 * Controles de criatura (como no original): MoveControl (vira e anda até um ponto, pula degraus),
 * LookControl (gira a cabeça com limite por tick), JumpControl e PathNavigation (segue o caminho A*).
 */
import type { Mob } from '../mob';
import { Pathfinder, type PathNode } from './pathfinder';

export function wrapDeg(a: number): number { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; }
export function rotlerp(from: number, to: number, max: number): number {
  let d = wrapDeg(to - from);
  if (d > max) d = max;
  if (d < -max) d = -max;
  return from + d;
}

export class MoveControl {
  wantedX = 0; wantedY = 0; wantedZ = 0;
  speedModifier = 0;
  op: 'wait' | 'move' | 'strafe' = 'wait';
  strafeF = 0; strafeR = 0;
  constructor(protected readonly mob: Mob) {}

  setWanted(x: number, y: number, z: number, speed: number): void {
    this.wantedX = x; this.wantedY = y; this.wantedZ = z;
    this.speedModifier = speed;
    this.op = 'move';
  }
  strafe(forward: number, right: number): void { this.op = 'strafe'; this.strafeF = forward; this.strafeR = right; }
  get hasWanted(): boolean { return this.op === 'move'; }

  tick(): void {
    const m = this.mob;
    if (this.op === 'strafe') {
      const sp = m.baseSpeed * this.speedModifier;
      m.movementSpeed = sp;
      m.zza = this.strafeF * sp;
      m.xxa = this.strafeR * sp;
      this.op = 'wait';
      return;
    }
    if (this.op !== 'move') { m.zza = 0; m.xxa = 0; return; }
    this.op = 'wait';
    const dx = this.wantedX - m.x, dz = this.wantedZ - m.z, dy = this.wantedY - m.y;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 2.5e-7) { m.zza = 0; return; }
    const target = (Math.atan2(dz, dx) * 180) / Math.PI - 90;
    m.yaw = rotlerp(m.yaw, target, 90);
    const sp = m.baseSpeed * this.speedModifier;
    m.movementSpeed = sp;
    m.zza = sp;
    m.xxa = 0;
    // pula se o alvo está acima do degrau e perto
    if ((dy > m.stepHeight && dx * dx + dz * dz < Math.max(1, m.width)) || (m.horizontalCollision && m.onGround)) m.jumpCtl.jump();
  }
}

/** Movimento para criaturas que voam ou nadam: segue direto em 3D. */
export class FlyingMoveControl extends MoveControl {
  override tick(): void {
    const m = this.mob;
    if (this.op !== 'move') { m.vx *= 0.9; m.vy *= 0.9; m.vz *= 0.9; return; }
    this.op = 'wait';
    const dx = this.wantedX - m.x, dy = this.wantedY - m.y, dz = this.wantedZ - m.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.1) return;
    const sp = m.baseSpeed * this.speedModifier * 0.25;
    m.vx += (dx / d) * sp * 0.25; m.vy += (dy / d) * sp * 0.25; m.vz += (dz / d) * sp * 0.25;
    m.yaw = rotlerp(m.yaw, (Math.atan2(dz, dx) * 180) / Math.PI - 90, 10);
  }
}

export class LookControl {
  x = 0; y = 0; z = 0;
  active = false;
  yawMax = 10;
  pitchMax = 40;
  constructor(private readonly mob: Mob) {}
  lookAt(x: number, y: number, z: number, yawMax = 10, pitchMax = 40): void {
    this.x = x; this.y = y; this.z = z; this.active = true; this.yawMax = yawMax; this.pitchMax = pitchMax;
  }
  tick(): void {
    const m = this.mob;
    if (this.active) {
      this.active = false;
      const dx = this.x - m.x, dy = this.y - (m.y + m.eyeHeight()), dz = this.z - m.z;
      const hd = Math.hypot(dx, dz);
      const yaw = (Math.atan2(dz, dx) * 180) / Math.PI - 90;
      const pitch = -(Math.atan2(dy, hd) * 180) / Math.PI;
      m.yawHead = rotlerp(m.yawHead, yaw, this.yawMax);
      m.pitch = rotlerp(m.pitch, pitch, this.pitchMax);
    } else {
      m.yawHead = rotlerp(m.yawHead, m.bodyYaw, 10);
      m.pitch = rotlerp(m.pitch, 0, 10);
    }
    // cabeça não gira mais que 75° em relação ao corpo
    const diff = wrapDeg(m.yawHead - m.bodyYaw);
    if (diff > 75) m.yawHead = m.bodyYaw + 75;
    if (diff < -75) m.yawHead = m.bodyYaw - 75;
  }
}

export class JumpControl {
  private wants = false;
  constructor(private readonly mob: Mob) {}
  jump(): void { this.wants = true; }
  tick(): void { this.mob.jumping = this.wants; this.wants = false; }
}

export class PathNavigation {
  path: PathNode[] | null = null;
  private idx = 0;
  private speed = 1;
  private stuckTicks = 0;
  private lastProgress = 0;
  private recompute = 0;
  private target: [number, number, number] | null = null;
  private readonly finder: Pathfinder;
  maxFall = 3;
  canOpenDoors = false;
  avoidWater = false;
  canSwim = true;
  aquatic = false;
  flying = false;
  maxNodes = 400;
  onDoor?: (x: number, y: number, z: number) => void;

  constructor(private readonly mob: Mob) {
    this.finder = new Pathfinder(mob.world);
  }

  get done(): boolean { return !this.path || this.idx >= this.path.length; }
  stop(): void { this.path = null; this.target = null; }
  setSpeed(s: number): void { this.speed = s; }
  /** nó final do caminho atual */
  get end(): PathNode | null { return this.path ? this.path[this.path.length - 1] : null; }

  moveTo(x: number, y: number, z: number, speed: number, reach = 1): boolean {
    const m = this.mob;
    const sx = Math.floor(m.x), sy = Math.floor(m.y + 0.5), sz = Math.floor(m.z);
    const p = this.finder.find(sx, sy, sz, Math.floor(x), Math.floor(y), Math.floor(z), {
      width: m.width, height: m.height, maxFall: this.maxFall, canSwim: this.canSwim, canOpenDoors: this.canOpenDoors,
      avoidWater: this.avoidWater, aquatic: this.aquatic, flying: this.flying, maxNodes: this.maxNodes,
    }, reach);
    this.path = p;
    this.idx = 0;
    this.speed = speed;
    this.stuckTicks = 0;
    this.target = [x, y, z];
    return !!p && p.length > 0;
  }

  /** Recalcula o caminho periodicamente se o alvo se move. */
  moveToEntity(x: number, y: number, z: number, speed: number): boolean {
    if (this.recompute-- > 0 && this.path && this.target && Math.hypot(this.target[0] - x, this.target[2] - z) < 2) {
      this.speed = speed;
      return true;
    }
    this.recompute = 4 + Math.floor(Math.random() * 7);
    return this.moveTo(x, y, z, speed);
  }

  tick(): void {
    const p = this.path;
    if (!p || this.idx >= p.length) return;
    const m = this.mob;
    const n = p[this.idx];
    const cx = n[0] + 0.5, cz = n[2] + 0.5;
    const hd = Math.hypot(cx - m.x, cz - m.z);
    // mesma tolerância do original: largura > 0,75 → metade da largura; senão 0,75 − metade
    const tol = m.width > 0.75 ? m.width / 2 : 0.75 - m.width / 2;
    const reached = hd < tol && Math.abs(n[1] - m.y) < 1.1;
    if (reached) {
      this.idx++;
      if (this.idx >= p.length) { this.path = null; return; }
    }
    const t = p[Math.min(this.idx, p.length - 1)];
    this.onDoor?.(t[0], t[1], t[2]);
    this.onDoor?.(t[0], t[1] + 1, t[2]);
    m.moveCtl.setWanted(t[0] + 0.5, t[1], t[2] + 0.5, this.speed);
    // desiste se travado
    const prog = this.idx * 100 - hd;
    if (Math.abs(prog - this.lastProgress) < 0.05) this.stuckTicks++;
    else { this.stuckTicks = 0; this.lastProgress = prog; }
    if (this.stuckTicks > 60) this.stop();
  }
}
