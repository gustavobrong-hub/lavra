/**
 * Árvores. Cada construtor recebe a base (x, y, z) já no chão e escreve pelo ChunkWriter —
 * só o que cai dentro do chunk-alvo é aplicado, então a mesma árvore sai idêntica nos dois lados da borda.
 */
import { Random } from '../../../core/rng';
import { S } from '../../blocks';
import type { ChunkWriter } from '../writer';
import type { TreeKind } from '../biomes';

interface Mat { log: number; logX: number; logZ: number; leaves: number }
const mats = new Map<string, Mat>();
function mat(wood: string): Mat {
  let m = mats.get(wood);
  if (!m) {
    m = {
      log: S(`${wood}_log`, { axis: 'y' }),
      logX: S(`${wood}_log`, { axis: 'x' }),
      logZ: S(`${wood}_log`, { axis: 'z' }),
      leaves: S(`${wood}_leaves`, { distance: 1, persistent: false }),
    };
    mats.set(wood, m);
  }
  return m;
}

function blob(w: ChunkWriter, r: Random, cx: number, cy: number, cz: number, radius: number, leaves: number, cornerChance = 0.5): void {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (Math.abs(dx) === radius && Math.abs(dz) === radius && (radius > 0) && r.next() < cornerChance) continue;
      w.leaves(cx + dx, cy, cz + dz, leaves);
    }
  }
}

function sphere(w: ChunkWriter, r: Random, cx: number, cy: number, cz: number, rad: number, leaves: number, squash = 1): void {
  const R = Math.ceil(rad);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const d = (dx * dx + dz * dz) + (dy * dy) * squash * squash;
        if (d <= rad * rad + r.next() * 0.8) w.leaves(cx + dx, cy + dy, cz + dz, leaves);
      }
    }
  }
}

function trunk(w: ChunkWriter, x: number, y: number, z: number, h: number, log: number): void {
  for (let i = 0; i < h; i++) w.log(x, y + i, z, log);
}

function vinesAround(w: ChunkWriter, r: Random, x: number, y: number, z: number, chance: number, maxLen: number): void {
  const vN = S('vine', { south: true }), vS = S('vine', { north: true }), vW = S('vine', { east: true }), vE = S('vine', { west: true });
  const place = (vx: number, vz: number, st: number) => {
    if (r.next() > chance) return;
    const len = 1 + r.nextInt(maxLen);
    for (let i = 0; i < len; i++) w.soft(vx, y - i, vz, st);
  };
  place(x, z - 1, vN); place(x, z + 1, vS); place(x - 1, z, vW); place(x + 1, z, vE);
}

// ------------------------------------------------------------------ espécies
function oakLike(w: ChunkWriter, r: Random, x: number, y: number, z: number, wood: string, minH: number, varH: number, wide = false): void {
  const m = mat(wood);
  const h = minH + r.nextInt(varH + 1);
  const top = y + h;
  for (let dy = -3; dy <= 0; dy++) {
    const rad = dy <= -2 ? (wide ? 3 : 2) : 1;
    blob(w, r, x, top + dy, z, rad, m.leaves, dy === 0 ? 1 : 0.5);
  }
  trunk(w, x, y, z, h, m.log);
}

function fancyOak(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('oak');
  const h = 7 + r.nextInt(6);
  trunk(w, x, y, z, h, m.log);
  const branches = 3 + r.nextInt(3);
  for (let b = 0; b < branches; b++) {
    const by = y + Math.floor(h * (0.45 + r.next() * 0.45));
    const ang = r.next() * Math.PI * 2;
    const len = 2 + r.nextInt(3);
    let ex = x, ez = z, ey = by;
    for (let i = 1; i <= len; i++) {
      ex = x + Math.round(Math.cos(ang) * i);
      ez = z + Math.round(Math.sin(ang) * i);
      ey = by + Math.floor(i / 2);
      const axisX = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang));
      w.log(ex, ey, ez, axisX ? m.logX : m.logZ);
    }
    sphere(w, r, ex, ey + 1, ez, 2.3, m.leaves, 1.4);
  }
  sphere(w, r, x, y + h, z, 2.8, m.leaves, 1.3);
}

function spruce(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('spruce');
  const h = 6 + r.nextInt(4);
  const bare = 1 + r.nextInt(2);
  let rad = r.nextInt(2);
  let maxR = 1;
  for (let i = h; i >= bare; i--) {
    const yy = y + i;
    blob(w, r, x, yy, z, rad, m.leaves, 1);
    if (rad >= maxR) {
      rad = i === h ? 1 : 0;
      maxR = Math.min(maxR + 1, 3);
    } else rad++;
  }
  w.leaves(x, y + h + 1, z, m.leaves);
  trunk(w, x, y, z, h, m.log);
}

function pine(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('spruce');
  const h = 7 + r.nextInt(5);
  const crown = 3 + r.nextInt(2);
  for (let i = 0; i < crown; i++) {
    const rad = i === 0 ? 0 : i < crown - 1 ? 1 : (i % 2 === 0 ? 1 : 2);
    blob(w, r, x, y + h - i, z, Math.min(rad, 2), m.leaves, 1);
  }
  w.leaves(x, y + h + 1, z, m.leaves);
  trunk(w, x, y, z, h, m.log);
}

function megaSpruce(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('spruce');
  const h = 14 + r.nextInt(12);
  const crownBase = y + Math.floor(h * 0.45);
  for (let yy = y + h + 1; yy >= crownBase; yy--) {
    const t = (y + h + 1 - yy) / (y + h + 1 - crownBase);
    const rad = Math.round(0.5 + t * 3.5) - ((y + h - yy) % 3 === 0 ? 1 : 0);
    for (let dx = -rad; dx <= rad + 1; dx++) {
      for (let dz = -rad; dz <= rad + 1; dz++) {
        const ddx = dx <= 0 ? dx : dx - 1, ddz = dz <= 0 ? dz : dz - 1;
        if (ddx * ddx + ddz * ddz <= rad * rad + 1) w.leaves(x + dx, yy, z + dz, m.leaves);
      }
    }
  }
  for (let i = 0; i < h; i++) {
    w.log(x, y + i, z, m.log); w.log(x + 1, y + i, z, m.log);
    w.log(x, y + i, z + 1, m.log); w.log(x + 1, y + i, z + 1, m.log);
  }
}

function jungle(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('jungle');
  const h = 5 + r.nextInt(8);
  const top = y + h;
  for (let dy = -3; dy <= 0; dy++) blob(w, r, x, top + dy, z, dy <= -2 ? 2 : 1, m.leaves, 0.5);
  trunk(w, x, y, z, h, m.log);
  for (let i = 0; i < h - 1; i++) vinesAround(w, r, x, y + i, z, 0.3, 1);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.abs(dx) === 2 || Math.abs(dz) === 2) if (r.next() < 0.25) {
      const vs = dx === -2 ? S('vine', { east: true }) : dx === 2 ? S('vine', { west: true }) : dz === -2 ? S('vine', { south: true }) : S('vine', { north: true });
      const len = 1 + r.nextInt(4);
      for (let i = 1; i <= len; i++) w.soft(x + dx + (dx === -2 ? -1 : dx === 2 ? 1 : 0), top - 3 - i + 1, z + dz + (dz === -2 ? -1 : dz === 2 ? 1 : 0), vs);
    }
  }
}

function megaJungle(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('jungle');
  const h = 14 + r.nextInt(16);
  const top = y + h;
  sphere(w, r, x, top, z, 3.6, m.leaves, 2);
  sphere(w, r, x + 1, top - 1, z + 1, 3.2, m.leaves, 2);
  for (let b = 0; b < 3; b++) {
    const by = y + Math.floor(h * (0.5 + r.next() * 0.35));
    const ang = r.next() * Math.PI * 2;
    const len = 3 + r.nextInt(2);
    const ex = x + Math.round(Math.cos(ang) * len), ez = z + Math.round(Math.sin(ang) * len);
    for (let i = 1; i <= len; i++) {
      const bx = x + Math.round(Math.cos(ang) * i), bz = z + Math.round(Math.sin(ang) * i);
      w.log(bx, by + (i >> 1), bz, Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang)) ? m.logX : m.logZ);
    }
    sphere(w, r, ex, by + (len >> 1) + 1, ez, 2.2, m.leaves, 2);
  }
  for (let i = 0; i < h; i++) {
    w.log(x, y + i, z, m.log); w.log(x + 1, y + i, z, m.log);
    w.log(x, y + i, z + 1, m.log); w.log(x + 1, y + i, z + 1, m.log);
    if (r.next() < 0.5) w.soft(x - 1, y + i, z + r.nextInt(2), S('vine', { east: true }));
    if (r.next() < 0.5) w.soft(x + 2, y + i, z + r.nextInt(2), S('vine', { west: true }));
    if (r.next() < 0.5) w.soft(x + r.nextInt(2), y + i, z - 1, S('vine', { south: true }));
    if (r.next() < 0.5) w.soft(x + r.nextInt(2), y + i, z + 2, S('vine', { north: true }));
  }
}

function jungleBush(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const log = mat('jungle').log, leaves = mat('oak').leaves;
  w.log(x, y, z, log);
  for (let dy = 0; dy <= 2; dy++) {
    const rad = 2 - dy;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (Math.abs(dx) + Math.abs(dz) <= rad + (r.next() < 0.3 ? 1 : 0)) w.leaves(x + dx, y + dy, z + dz, leaves);
    }
  }
}

function acacia(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('acacia');
  const h = 5 + r.nextInt(3);
  const lean = h - 1 - r.nextInt(3);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const [dx, dz] = r.pick(dirs);
  let cx = x, cz = z, cy = y;
  for (let i = 0; i < h; i++) {
    if (i >= lean && i < h - 1) { cx += dx; cz += dz; }
    cy = y + i;
    w.log(cx, cy, cz, m.log);
  }
  const canopy = (px: number, py: number, pz: number) => {
    for (let ex = -3; ex <= 3; ex++) for (let ez = -3; ez <= 3; ez++) {
      if (Math.abs(ex) + Math.abs(ez) <= 4 && !(Math.abs(ex) === 3 && Math.abs(ez) === 3)) w.leaves(px + ex, py, pz + ez, m.leaves);
    }
    for (let ex = -1; ex <= 1; ex++) for (let ez = -1; ez <= 1; ez++) w.leaves(px + ex, py + 1, pz + ez, m.leaves);
    w.leaves(px + 2, py + 1, pz, m.leaves); w.leaves(px - 2, py + 1, pz, m.leaves);
    w.leaves(px, py + 1, pz + 2, m.leaves); w.leaves(px, py + 1, pz - 2, m.leaves);
  };
  canopy(cx, cy + 1, cz);
  if (r.next() < 0.6) {
    const [bx, bz] = r.pick(dirs.filter(([a, b]) => a !== dx || b !== dz));
    let px = x, pz = z;
    const start = y + lean - 1 - r.nextInt(2);
    let py = start;
    for (let i = 0; i < 2 + r.nextInt(2); i++) {
      px += bx; pz += bz; py++;
      w.log(px, py, pz, m.log);
    }
    canopy(px, py + 1, pz);
  }
}

function darkOak(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('dark_oak');
  const h = 6 + r.nextInt(4);
  const top = y + h;
  for (let dy = -2; dy <= 1; dy++) {
    const rad = dy === 1 ? 2 : dy === 0 ? 3 : 4;
    for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
      const ddx = dx <= 0 ? -dx : dx - 1, ddz = dz <= 0 ? -dz : dz - 1;
      if (ddx + ddz <= rad + 1 && !(ddx === rad && ddz === rad && r.next() < 0.7)) w.leaves(x + dx, top + dy, z + dz, m.leaves);
    }
  }
  for (let i = 0; i < h; i++) {
    w.log(x, y + i, z, m.log); w.log(x + 1, y + i, z, m.log);
    w.log(x, y + i, z + 1, m.log); w.log(x + 1, y + i, z + 1, m.log);
  }
  // raízes/galhos laterais
  for (let b = 0; b < 2; b++) {
    const bx = x + (r.next() < 0.5 ? -1 : 2), bz = z + r.nextInt(2);
    const bh = 2 + r.nextInt(3);
    for (let i = h - bh; i < h - 1; i++) w.log(bx, y + i, bz, m.log);
  }
}

function swampOak(w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  const m = mat('oak');
  const h = 5 + r.nextInt(4);
  const top = y + h;
  for (let dy = -3; dy <= 0; dy++) blob(w, r, x, top + dy, z, dy <= -2 ? 3 : 2, m.leaves, 0.6);
  trunk(w, x, y, z, h, m.log);
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    if ((Math.abs(dx) === 3 || Math.abs(dz) === 3) && r.next() < 0.3) {
      const vs = dx === -3 ? S('vine', { east: true }) : dx === 3 ? S('vine', { west: true }) : dz === -3 ? S('vine', { south: true }) : S('vine', { north: true });
      const ox = dx === -3 ? -1 : dx === 3 ? 1 : 0, oz = dz === -3 ? -1 : dz === 3 ? 1 : 0;
      const len = 2 + r.nextInt(4);
      for (let i = 0; i < len; i++) w.soft(x + dx + ox, top - 3 - i, z + dz + oz, vs);
    }
  }
}

/** Árvore inventada do Bosque Lume: tronco esguio com "andares" de folhas luminosas. */
function lume(w: ChunkWriter, r: Random, x: number, y: number, z: number, big: boolean): void {
  const m = mat('lume');
  const h = big ? 12 + r.nextInt(6) : 7 + r.nextInt(4);
  const tiers = big ? 3 : 2;
  for (let t = 0; t < tiers; t++) {
    const ty = y + h - t * (big ? 4 : 3);
    const rad = 1.8 + t * (big ? 1.3 : 1.1);
    const R = Math.ceil(rad);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d <= rad + r.next() * 0.4) {
        w.leaves(x + dx, ty, z + dz, m.leaves);
        if (d <= rad - 1.2) w.leaves(x + dx, ty + 1, z + dz, m.leaves);
        if (d > rad - 1 && r.next() < 0.18) {
          const len = 1 + r.nextInt(3);
          for (let i = 1; i <= len; i++) w.leaves(x + dx, ty - i, z + dz, m.leaves);
        }
      }
    }
  }
  w.leaves(x, y + h + 2, z, m.leaves);
  if (big) {
    for (let i = 0; i < h + 1; i++) {
      w.log(x, y + i, z, m.log);
      if (i < h - 5) { w.log(x + 1, y + i, z, m.log); w.log(x, y + i, z + 1, m.log); w.log(x + 1, y + i, z + 1, m.log); }
    }
  } else trunk(w, x, y, z, h + 1, m.log);
}

export function growTree(kind: TreeKind, w: ChunkWriter, r: Random, x: number, y: number, z: number): void {
  switch (kind) {
    case 'oak': return oakLike(w, r, x, y, z, 'oak', 4, 2);
    case 'fancy_oak': return fancyOak(w, r, x, y, z);
    case 'birch': return oakLike(w, r, x, y, z, 'birch', 5, 2);
    case 'tall_birch': return oakLike(w, r, x, y, z, 'birch', 9, 5);
    case 'spruce': return spruce(w, r, x, y, z);
    case 'pine': return pine(w, r, x, y, z);
    case 'mega_spruce': return megaSpruce(w, r, x, y, z);
    case 'jungle': return jungle(w, r, x, y, z);
    case 'mega_jungle': return megaJungle(w, r, x, y, z);
    case 'jungle_bush': return jungleBush(w, r, x, y, z);
    case 'acacia': return acacia(w, r, x, y, z);
    case 'dark_oak': return darkOak(w, r, x, y, z);
    case 'swamp_oak': return swampOak(w, r, x, y, z);
    case 'lume': return lume(w, r, x, y, z, false);
    case 'big_lume': return lume(w, r, x, y, z, true);
    case 'dead': return trunk(w, x, y, z, 3 + r.nextInt(3), mat('oak').log);
  }
}

/** Raio horizontal máximo de cada espécie (para saber que chunks de origem visitar). */
export const TREE_REACH = 8;

/** Árvore adequada para uma muda (usada no crescimento das mudas). */
export function saplingTree(wood: string, r: Random, big: boolean): TreeKind {
  switch (wood) {
    case 'oak': return r.next() < 0.1 ? 'fancy_oak' : 'oak';
    case 'birch': return 'birch';
    case 'spruce': return big ? 'mega_spruce' : 'spruce';
    case 'jungle': return big ? 'mega_jungle' : 'jungle';
    case 'acacia': return 'acacia';
    case 'dark_oak': return 'dark_oak';
    case 'lume': return big ? 'big_lume' : 'lume';
    default: return 'oak';
  }
}
