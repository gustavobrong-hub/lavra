/** Orbe de experiência: dividido nos mesmos valores do original, atraído pelo jogador a até 8 blocos. */
import { Entity, type EntityHost } from './entity';
import { BLOCK_FRICTION } from './living';

const SPLITS = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
export function splitXp(total: number): number[] {
  const out: number[] = [];
  while (total > 0) {
    const v = SPLITS.find((s) => s <= total) ?? 1;
    out.push(v);
    total -= v;
  }
  return out;
}

/** XP necessária para passar do nível `lvl` ao próximo (fórmula do original). */
export function xpNeeded(lvl: number): number {
  return lvl >= 30 ? 112 + (lvl - 30) * 9 : lvl >= 15 ? 37 + (lvl - 15) * 5 : 7 + lvl * 2;
}

/** Nível e progresso a partir da XP total. */
export function levelFromTotal(total: number): { level: number; progress: number } {
  let level = 0;
  while (total >= xpNeeded(level)) { total -= xpNeeded(level); level++; }
  return { level, progress: total / xpNeeded(level) };
}

export class XpOrb extends Entity {
  readonly type = 'xp_orb';
  target: Entity | null = null;

  constructor(host: EntityHost, public value: number) {
    super(host);
    this.width = 0.5;
    this.height = 0.5;
    this.stepHeight = 0;
  }

  tick(): void {
    this.age++;
    this.savePrev();
    this.updateFluids();
    if (this.inWater) { this.vx *= 0.99; this.vz *= 0.99; this.vy += 5e-4; } else this.vy -= 0.03;
    const t = this.target;
    if (t && !t.removed) {
      const dx = t.x - this.x, dy = t.y + (t as Entity & { eyeHeight(): number }).eyeHeight() / 2 - this.y, dz = t.z - this.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 64) {
        const d = Math.sqrt(d2);
        const f = 1 - d / 8;
        this.vx += (dx / d) * f * f * 0.1;
        this.vy += (dy / d) * f * f * 0.1;
        this.vz += (dz / d) * f * f * 0.1;
      }
    }
    this.move(this.vx, this.vy, this.vz);
    let fr = 0.98;
    if (this.onGround) fr = BLOCK_FRICTION(this.blockUnder()) * 0.98;
    this.vx *= fr; this.vy *= 0.98; this.vz *= fr;
    if (this.onGround) this.vy *= -0.9;
    if (this.age >= 6000) this.removed = true;
  }
}
