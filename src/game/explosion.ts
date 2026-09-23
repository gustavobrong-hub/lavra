/**
 * Explosões com o algoritmo do original: 1352 raios da borda de um cubo 16³, cada um perde
 * (resistência + 0,3) × 0,3 por passo de 0,3 bloco; entidades a até 2×potência recebem dano
 * ((i² + i)/2 × 7 × 2p + 1, com i = (1 − d/2p) × exposição) e empurrão.
 */
import type { Level } from './level';
import { BLOCKS, BLOCK_OF, FLAGS, F_FLUID, F_SOLID, S, isAir } from '../world/blocks';
import { AABB } from '../core/aabb';
import type { Entity } from './entity/entity';
import type { Living } from './entity/living';
import { lineOfSight } from './entity/mob';

export interface ExplosionOpts {
  /** destrói blocos */
  breakBlocks?: boolean;
  /** coloca fogo (bola de fogo do brasal, cama no Ínfero) */
  fire?: boolean;
  /** quem causou (para crédito e imunidade) */
  source?: Entity | null;
  attacker?: Living | null;
}

function resistanceOf(s: number): number {
  if (FLAGS[s] & F_FLUID) return 100;
  const d = BLOCKS[BLOCK_OF[s]].def;
  if (d.hardness < 0) return 3600000;
  return d.resistance ?? d.hardness;
}

let RAYS: Float32Array | null = null;
function rays(): Float32Array {
  if (RAYS) return RAYS;
  const out: number[] = [];
  for (let j = 0; j < 16; j++) for (let k = 0; k < 16; k++) for (let l = 0; l < 16; l++) {
    if (j !== 0 && j !== 15 && k !== 0 && k !== 15 && l !== 0 && l !== 15) continue;
    let d = (j / 15) * 2 - 1, e = (k / 15) * 2 - 1, f = (l / 15) * 2 - 1;
    const g = Math.hypot(d, e, f);
    d /= g; e /= g; f /= g;
    out.push(d, e, f);
  }
  RAYS = new Float32Array(out);
  return RAYS;
}

/** Fração da caixa visível a partir do centro da explosão (getSeenPercent). */
function seenPercent(level: Level, x: number, y: number, z: number, bb: AABB): number {
  const dx = 1 / ((bb.maxX - bb.minX) * 2 + 1), dy = 1 / ((bb.maxY - bb.minY) * 2 + 1), dz = 1 / ((bb.maxZ - bb.minZ) * 2 + 1);
  const ox = (1 - Math.floor(1 / dx) * dx) / 2, oz = (1 - Math.floor(1 / dz) * dz) / 2;
  let seen = 0, total = 0;
  for (let a = 0; a <= 1; a += dx) for (let b = 0; b <= 1; b += dy) for (let c = 0; c <= 1; c += dz) {
    const px = bb.minX + (bb.maxX - bb.minX) * a + ox, py = bb.minY + (bb.maxY - bb.minY) * b, pz = bb.minZ + (bb.maxZ - bb.minZ) * c + oz;
    if (lineOfSight(level, px, py, pz, x, y, z)) seen++;
    total++;
  }
  return total ? seen / total : 0;
}

export function explode(level: Level, x: number, y: number, z: number, power: number, opts: ExplosionOpts = {}): void {
  const breakBlocks = opts.breakBlocks ?? true;
  const w = level.world;
  const toBreak = new Map<number, [number, number, number]>();
  if (breakBlocks && level.rules.mobGriefing !== false) {
    const R = rays();
    for (let i = 0; i < R.length; i += 3) {
      let h = power * (0.7 + Math.random() * 0.6);
      let px = x, py = y, pz = z;
      while (h > 0) {
        const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
        if (!w.isLoaded(bx, bz)) break;
        const s = w.getBlock(bx, by, bz);
        if (!isAir(s) && s !== 0) h -= (resistanceOf(s) + 0.3) * 0.3;
        if (h > 0 && s !== 0 && !isAir(s) && !(FLAGS[s] & F_FLUID)) toBreak.set(((bx + 1048576) * 2097152 + (bz + 1048576)) * 512 + by + 64, [bx, by, bz]);
        px += R[i] * 0.3; py += R[i + 1] * 0.3; pz += R[i + 2] * 0.3;
        h -= 0.22500001;
      }
    }
  }
  // entidades
  const r2 = power * 2;
  const box = new AABB(x - r2 - 1, y - r2 - 1, z - r2 - 1, x + r2 + 1, y + r2 + 1, z + r2 + 1);
  for (const e of level.entities.inBox(box)) {
    if (e.removed) continue;
    const dist = Math.hypot(e.x - x, e.y - y, e.z - z) / r2;
    if (dist > 1) continue;
    let dx = e.x - x, dy = e.y + ((e as Living).eyeHeight?.() ?? 0) - y, dz = e.z - z;
    if (e.type === 'tnt') dy = e.y - y;
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) continue;
    dx /= len; dy /= len; dz /= len;
    const seen = seenPercent(level, x, y, z, e.bb);
    const impact = (1 - dist) * seen;
    const liv = e as Living;
    let kb = impact;
    if (liv.health !== undefined) {
      const dmg = Math.floor(((impact * impact + impact) / 2) * 7 * r2 + 1);
      liv.hurt({ type: 'explosion', attacker: opts.attacker ?? undefined, from: [x, y, z] }, scaleForDifficulty(level, dmg, opts));
      const bp = (e as { blastProtection?: () => number }).blastProtection?.() ?? 0;
      if (bp > 0) kb *= Math.max(0, 1 - bp * 0.15);
    }
    e.vx += dx * kb; e.vy += dy * kb; e.vz += dz * kb;
    (e as { onExplosion?: (x: number, y: number, z: number) => void }).onExplosion?.(x, y, z);
  }
  // blocos (com saque 1/potência)
  const list = [...toBreak.values()];
  for (const [bx, by, bz] of list) {
    const s = w.getBlock(bx, by, bz);
    const name = BLOCKS[BLOCK_OF[s]].name;
    if (name === 'tnt') {
      level.emit('primeTnt', { x: bx, y: by, z: bz, fuse: 10 + Math.floor(Math.random() * 20) });
      level.setBlock(bx, by, bz, 0);
      continue;
    }
    level.breakBlock(bx, by, bz, { drop: Math.random() < 1 / power, silent: true });
  }
  if (opts.fire) {
    const FIRE = S('fire');
    for (const [bx, by, bz] of list) {
      if (Math.random() * 3 >= 1) continue;
      if (w.getBlock(bx, by, bz) !== 0) continue;
      const below = w.getBlock(bx, by - 1, bz);
      if (FLAGS[below] & F_SOLID) level.setBlock(bx, by, bz, FIRE);
    }
  }
  level.emit('explosion', { x, y, z, power, blocks: list.length });
}

function scaleForDifficulty(level: Level, dmg: number, opts: ExplosionOpts): number {
  // explosões causadas por criaturas escalam como os ataques (o jogador aplica a escala)
  void level; void opts;
  return dmg;
}
