/**
 * Estilos de pintura reutilizáveis (pedras, terra, madeira, folhas, minérios, tijolos, lã, vidro...).
 * Luz sempre vindo de cima-esquerda: realces no topo/esquerda, sombras embaixo/direita.
 */
import { Tex, type Palette, type RGB, hex, mix, pal, ramp, scale } from './tex';

// ------------------------------------------------------------------ rochas e solos
export function stone(t: Tex, p: Palette = pal(0x5f5f63, 0x6e6e72, 0x7c7c80, 0x88888b, 0x96969a), cracks = 3): void {
  t.noisePal(p, { contrast: 1.15 });
  // fissuras curtas mais escuras
  for (let i = 0; i < cracks; i++) {
    let x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    const len = 2 + t.rng.nextInt(3);
    for (let k = 0; k < len; k++) {
      t.px(x, y, scale(p[0], 0.85));
      t.h(x, y, 0.2);
      x += t.rng.nextInt(3) - 1; y += t.rng.next() < 0.6 ? 1 : 0;
    }
  }
  t.material(0.18, 0, 0.35);
}

export function dirt(t: Tex, p: Palette = pal(0x5a3d26, 0x6b4a2f, 0x7a5636, 0x866142, 0x96704c)): void {
  t.noisePal(p, { contrast: 1.3, salt: 3 });
  // pedrinhas
  for (let i = 0; i < 5; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    t.px(x, y, hex(0x9a8a78)); t.h(x, y, 0.8);
    if (t.rng.next() < 0.5) { t.px(x + 1, y, hex(0x7d6e5e)); t.h(x + 1, y, 0.7); }
  }
  t.material(0.05, 0, 0.9);
}

export function sand(t: Tex, p: Palette = pal(0xc9b57d, 0xd6c28a, 0xdecb95, 0xe6d5a2, 0xeee0b2)): void {
  t.noisePal(p, { contrast: 0.9, salt: 5 });
  t.speckle(scale(p[0], 0.88), 0.05, 31, -0.1);
  t.speckle(mix(p[4], [255, 255, 255], 0.3), 0.04, 32, 0.1);
  t.material(0.08, 0, 0.8);
}

export function gravel(t: Tex, base = pal(0x5e5a58, 0x77716d, 0x8c8682, 0xa29d98, 0xb5b0ab)): void {
  // seixos: pequenas células arredondadas
  t.fill(base[1]);
  const cells: [number, number, RGB][] = [];
  for (let i = 0; i < 26; i++) cells.push([t.rng.nextInt(16), t.rng.nextInt(16), base[1 + t.rng.nextInt(4)]]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let best = 1e9, second = 1e9, c: RGB = base[2];
    for (const [cx, cy, cc] of cells) {
      const dx = Math.min(Math.abs(x - cx), 16 - Math.abs(x - cx)), dy = Math.min(Math.abs(y - cy), 16 - Math.abs(y - cy));
      const d = dx * dx + dy * dy;
      if (d < best) { second = best; best = d; c = cc; } else if (d < second) second = d;
    }
    const edge = Math.sqrt(second) - Math.sqrt(best);
    const col = edge < 0.6 ? scale(base[0], 0.8) : mix(c, [255, 255, 255], (1 - Math.min(1, best / 6)) * 0.12);
    t.px(x, y, col);
    t.h(x, y, edge < 0.6 ? 0.15 : 0.5 + (1 - Math.min(1, best / 6)) * 0.35);
  }
  t.material(0.14, 0, 0.6);
}

export function cobble(t: Tex, base: Palette = pal(0x4c4c50, 0x646468, 0x7a7a7e, 0x8e8e92, 0xa2a2a6), mortar: RGB = hex(0x3a3a3d)): void {
  const cells: [number, number][] = [];
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) cells.push([gx * 4 + 1 + t.rng.nextInt(3), gy * 4 + 1 + t.rng.nextInt(3)]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let best = 1e9, second = 1e9, bc = 0;
    cells.forEach(([cx, cy], i) => {
      const dx = Math.min(Math.abs(x - cx), 16 - Math.abs(x - cx)), dy = Math.min(Math.abs(y - cy), 16 - Math.abs(y - cy));
      const d = Math.sqrt(dx * dx * 1.1 + dy * dy);
      if (d < best) { second = best; best = d; bc = i; } else if (d < second) second = d;
    });
    const edge = second - best;
    if (edge < 0.9) { t.px(x, y, mortar); t.h(x, y, 0.1); continue; }
    const [cx, cy] = cells[bc];
    // realce em cima-esquerda da pedra
    const lx = (x - cx), ly = (y - cy);
    const shade = 0.5 - (lx + ly) * 0.09 + (t.white(x, y, bc) - 0.5) * 0.35;
    const idx = Math.max(0, Math.min(base.length - 1, Math.floor((shade + (bc % 3) * 0.08) * base.length)));
    t.px(x, y, base[idx]);
    t.h(x, y, 0.45 + Math.min(0.45, edge * 0.12));
  }
  t.material(0.16, 0, 0.45);
}

export function bricks(t: Tex, brick: Palette, mortar: RGB, rows = 4, cols = 2, bevel = true): void {
  const bh = 16 / rows, bw = 16 / cols;
  t.fill(mortar);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let c = -1; c <= cols; c++) {
      const x0 = Math.round(c * bw + off), y0 = r * bh;
      const tone = brick[1 + t.rng.nextInt(brick.length - 2)];
      for (let y = y0; y < y0 + bh - 1; y++) for (let x = x0; x < x0 + bw - 1; x++) {
        if (x < 0 || x >= 16 && false) continue;
        let col = mix(tone, brick[Math.floor(t.fbm(x, y, 11) * brick.length)], 0.35);
        if (bevel && y === y0) col = mix(col, brick[brick.length - 1], 0.45);
        if (bevel && (y === y0 + bh - 2 || x === x0 + bw - 2)) col = mix(col, brick[0], 0.4);
        t.px(x, y, col);
        t.h(x, y, 0.6 + t.white(x, y, 3) * 0.1);
      }
    }
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.get(x, y)[0] === mortar[0] && t.get(x, y)[1] === mortar[1]) t.h(x, y, 0.2);
  t.material(0.14, 0, 0.55);
}

// ------------------------------------------------------------------ madeira
export interface WoodPal { plank: Palette; bark: Palette; ring: Palette }
export const WOOD_PALS: Record<string, WoodPal> = {
  oak: { plank: pal(0x7a5a33, 0x8f6c3f, 0xa07a48, 0xae8752, 0xbc955e), bark: pal(0x3f2f1c, 0x4f3b24, 0x5f4a2e, 0x6d5636), ring: pal(0x9c7a46, 0xb08c55, 0xc29d62) },
  spruce: { plank: pal(0x4e3620, 0x5d4128, 0x6b4c2f, 0x785636, 0x85613e), bark: pal(0x2b1d12, 0x3a2717, 0x47311d, 0x523a24), ring: pal(0x6a4a2c, 0x7a5835, 0x8a663e) },
  birch: { plank: pal(0xa99466, 0xbba676, 0xc8b482, 0xd4c18f, 0xdfcd9c), bark: pal(0x2a2a26, 0xcfcac0, 0xe2ded5, 0xf0ede6), ring: pal(0xc3ae7c, 0xd3bf8b, 0xe0cd99) },
  jungle: { plank: pal(0x7a5230, 0x8d603a, 0x9d6c42, 0xab784b, 0xb88454), bark: pal(0x3a2c14, 0x4c3a1b, 0x5a4722, 0x685329), ring: pal(0x9a6a3e, 0xaa7848, 0xb98652) },
  acacia: { plank: pal(0x8f4424, 0xa6512c, 0xb65b31, 0xc46638, 0xd17241), bark: pal(0x4a4640, 0x5c5750, 0x6c675e, 0x7b766b), ring: pal(0xb45a32, 0xc5663a, 0xd37342) },
  dark_oak: { plank: pal(0x2f1d0e, 0x3c2613, 0x472e17, 0x52361b, 0x5d3e20), bark: pal(0x221709, 0x2d1f0d, 0x382711, 0x422f15), ring: pal(0x4b3219, 0x573b1e, 0x634423) },
  lume: { plank: pal(0x2f4a63, 0x395873, 0x436683, 0x4d7392, 0x5881a1), bark: pal(0x1c2733, 0x243343, 0x2e4054, 0x3a4f66), ring: pal(0x4f86a8, 0x62a0c4, 0x7bbcdc) },
  ash: { plank: pal(0x4a4448, 0x575055, 0x645d62, 0x71696e, 0x7d757a), bark: pal(0x2a2528, 0x353034, 0x413b40, 0x4c464b), ring: pal(0x6f676c, 0x7e767b, 0x8d858a) },
};

export function planks(t: Tex, p: Palette): void {
  const boards = 4;
  for (let b = 0; b < boards; b++) {
    const y0 = b * 4;
    const tone = 0.85 + t.rng.next() * 0.3;
    const seam = t.rng.nextInt(16);
    for (let y = y0; y < y0 + 4; y++) for (let x = 0; x < 16; x++) {
      const grain = Math.sin((x * 0.7 + t.vnoise(x, y, 4, b) * 6) + y * 0.4) * 0.5 + 0.5;
      let v = 0.35 + grain * 0.35 * tone + (t.white(x, y, b) - 0.5) * 0.15;
      if (y === y0) v += 0.12; // realce superior
      if (y === y0 + 3) v -= 0.35; // sombra da junta
      if (x === seam) v -= 0.3;
      const i = Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)));
      t.px(x, y, p[i]);
      t.h(x, y, y === y0 + 3 || x === seam ? 0.25 : 0.55 + grain * 0.1);
    }
    // pregos
    if (t.rng.next() < 0.5) { const nx = (seam + 2) & 15; t.px(nx, y0 + 1, scale(p[0], 0.8)); t.h(nx, y0 + 1, 0.3); }
  }
  t.material(0.22, 0, 0.6);
}

export function logSide(t: Tex, bark: Palette, lightStreaks = false): void {
  for (let x = 0; x < 16; x++) {
    const colTone = t.white(x, 0, 5);
    for (let y = 0; y < 16; y++) {
      const v = t.vnoise(x * 3, y, 4, 2) * 0.6 + colTone * 0.3 + (t.white(x, y, 9) - 0.5) * 0.25;
      const i = Math.max(0, Math.min(bark.length - 1, Math.floor(v * bark.length)));
      t.px(x, y, bark[i]);
      t.h(x, y, 0.3 + v * 0.5);
    }
  }
  // sulcos verticais
  for (let k = 0; k < 4; k++) {
    const x = t.rng.nextInt(16);
    const y0 = t.rng.nextInt(16), len = 3 + t.rng.nextInt(6);
    for (let y = y0; y < y0 + len; y++) { t.px(x, y, scale(bark[0], 0.8)); t.h(x, y, 0.1); }
  }
  if (lightStreaks) {
    // bétula: casca clara com manchas escuras horizontais
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.vnoise(x, y * 2, 4, 7);
      t.px(x, y, v > 0.25 ? bark[2 + (t.white(x, y) > 0.6 ? 1 : 0)] : bark[1]);
      t.h(x, y, 0.55);
    }
    for (let k = 0; k < 6; k++) {
      const x = t.rng.nextInt(14), y = t.rng.nextInt(16), w = 1 + t.rng.nextInt(3);
      for (let i = 0; i < w; i++) { t.px(x + i, y, bark[0]); t.h(x + i, y, 0.25); }
    }
  }
  t.material(0.1, 0, 0.7);
}

export function logTop(t: Tex, ring: Palette, bark: Palette): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5;
    const d = Math.sqrt(dx * dx + dy * dy) + t.vnoise(x, y, 4, 3) * 1.2;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 6.6) {
      t.px(x, y, bark[1 + (t.white(x, y) > 0.5 ? 1 : 0)]); t.h(x, y, 0.4);
      continue;
    }
    const r = Math.floor(d) % 3;
    t.px(x, y, ring[r === 0 ? 0 : r === 1 ? 1 : 2]);
    t.h(x, y, r === 0 ? 0.35 : 0.55);
  }
  t.material(0.18, 0, 0.6);
}

// ------------------------------------------------------------------ vegetação (tons neutros para tingir)
export function leaves(t: Tex, p: Palette, holes = 0.16): void {
  t.transparent();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = t.fbm(x, y, 21);
    const w = t.white(x, y, 4);
    if (w < holes && v < 0.62) { t.px(x, y, p[0], 0); continue; }
    // folhas em "tufos": realce acima-esquerda de cada tufo
    const lobe = t.vnoise(x, y, 8, 5);
    const up = t.vnoise(x - 1, y - 1, 8, 5);
    const lit = up > lobe ? -0.15 : 0.12;
    const idx = Math.max(0, Math.min(p.length - 1, Math.floor((v + lit + (w - 0.5) * 0.3) * p.length)));
    t.px(x, y, p[idx]);
    t.h(x, y, 0.3 + lobe * 0.5);
    t.m(x, y, 0.35, 0, 0.3);
  }
}

export function grassTop(t: Tex): void {
  const p = pal(0x7c7c7c, 0x8e8e8e, 0x9e9e9e, 0xadadad, 0xbcbcbc);
  t.noisePal(p, { contrast: 1.1, salt: 44 });
  // "fios" de grama mais claros e escuros
  for (let i = 0; i < 22; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    t.px(x, y, t.rng.next() < 0.5 ? p[4] : p[0]);
    t.h(x, y, t.rng.next() < 0.5 ? 0.75 : 0.3);
  }
  t.material(0.12, 0, 0.7);
}

/** Lateral da grama: terra embaixo, franja de grama em cima (alfa=255 onde recebe a cor do bioma). */
export function grassSide(t: Tex, dirtTex: (t: Tex) => void, fringe: Palette = pal(0x8a8a8a, 0x9c9c9c, 0xacacac, 0xbababa), snowy = false): void {
  dirtTex(t);
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.setAlpha(x, y, 0);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + Math.floor(t.vnoise(x, 0, 8, 12) * 3) + (t.white(x, 1) < 0.3 ? 1 : 0);
    for (let y = 0; y < depth; y++) {
      if (snowy) {
        const c = y === depth - 1 ? hex(0xd9e4ee) : mix(hex(0xf4f8fc), hex(0xdfe8f0), t.white(x, y, 3));
        t.px(x, y, c, 0);
      } else {
        t.px(x, y, fringe[Math.floor(t.white(x, y, 5) * fringe.length)], 255);
      }
      t.h(x, y, 0.6);
    }
    // sombra da franja sobre a terra
    t.shadePx(x, depth, 0.78);
  }
}

// ------------------------------------------------------------------ minérios
export interface OreStyle { base: (t: Tex) => void; gem: Palette; shine?: number; metal?: number; glow?: number; clusters?: number }

export function ore(t: Tex, s: OreStyle): void {
  s.base(t);
  const n = s.clusters ?? 4;
  const placed: [number, number][] = [];
  for (let c = 0; c < n; c++) {
    let cx = 0, cy = 0;
    for (let tries = 0; tries < 20; tries++) {
      cx = 2 + t.rng.nextInt(12); cy = 2 + t.rng.nextInt(12);
      if (placed.every(([px, py]) => Math.abs(px - cx) + Math.abs(py - cy) > 4)) break;
    }
    placed.push([cx, cy]);
    const size = 2 + t.rng.nextInt(3);
    const cells: [number, number][] = [[cx, cy]];
    for (let i = 1; i < size; i++) {
      const [bx, by] = cells[t.rng.nextInt(cells.length)];
      cells.push([bx + t.rng.nextInt(3) - 1, by + t.rng.nextInt(3) - 1]);
    }
    for (const [x, y] of cells) {
      // sombra embaixo-direita, realce em cima-esquerda
      t.px(x + 1, y + 1, scale(s.gem[0], 0.7));
      t.h(x + 1, y + 1, 0.25);
    }
    for (const [x, y] of cells) {
      t.px(x, y, s.gem[1 + t.rng.nextInt(Math.max(1, s.gem.length - 2))]);
      t.h(x, y, 0.85);
      t.m(x, y, s.shine ?? 0.6, s.metal ?? 0, 0.1, s.glow ?? 0);
    }
    const [hx, hy] = cells[0];
    t.px(hx, hy, s.gem[s.gem.length - 1]);
    t.m(hx, hy, Math.min(1, (s.shine ?? 0.6) + 0.2), s.metal ?? 0, 0.05, s.glow ?? 0);
  }
}

// ------------------------------------------------------------------ tecidos, vidros, metais
export function wool(t: Tex, color: number): void {
  const p = ramp(color, 5, 0.22);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    // ponto de tricô: "v" alternado
    const stitch = ((x + (y >> 1)) & 3) < 2 ? 0.1 : -0.08;
    const v = 0.5 + stitch + (t.fbm(x, y, 8) - 0.5) * 0.45;
    t.px(x, y, p[Math.max(0, Math.min(4, Math.floor(v * 5)))]);
    t.h(x, y, 0.45 + stitch);
  }
  t.material(0.02, 0, 0.95);
}

export function glass(t: Tex, color: RGB = [220, 235, 240], alpha = 38, frame: RGB = [200, 222, 230]): void {
  t.transparent();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    if (edge) { t.px(x, y, frame, 235); t.m(x, y, 0.9, 0, 0); continue; }
    t.px(x, y, color, alpha);
    t.m(x, y, 0.97, 0, 0);
  }
  // reflexos diagonais
  for (const [x0, y0, len] of [[3, 3, 3], [4, 3, 2], [10, 9, 4], [11, 9, 2]] as [number, number, number][]) {
    for (let i = 0; i < len; i++) t.px(x0 + i, y0 + i, [255, 255, 255], 150);
  }
  t.px(1, 1, [255, 255, 255], 200);
}

export function metalBlock(t: Tex, p: Palette, metal = 1, smooth = 0.75): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 0.55 + (t.vnoise(x, y * 4, 4, 1) - 0.5) * 0.25 + (t.white(x, y) - 0.5) * 0.08;
    let c = p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))];
    if (x === 0 || y === 0) c = p[p.length - 1];
    if (x === 15 || y === 15) c = p[0];
    t.px(x, y, c);
    t.h(x, y, x === 0 || y === 0 || x === 15 || y === 15 ? 0.3 : 0.55);
    t.m(x, y, smooth - (x === 15 || y === 15 ? 0.2 : 0), metal, 0);
  }
  // rebites
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { t.px(x, y, p[p.length - 1]); t.px(x + 1, y + 1, p[0]); t.h(x, y, 0.8); }
}

export function gemBlock(t: Tex, p: Palette, glow = 0): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    // facetas em losango
    const fx = ((x + y) >> 2) & 1, fy = ((x - y + 16) >> 2) & 1;
    let v = 0.35 + fx * 0.25 + fy * 0.15 + (t.white(x, y) - 0.5) * 0.12;
    if (x === 0 || y === 0) v += 0.3;
    if (x === 15 || y === 15) v -= 0.3;
    t.px(x, y, p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))]);
    t.h(x, y, 0.4 + fx * 0.2);
    t.m(x, y, 0.9, 0.05, 0, glow);
  }
}

/** Pedra lisa/polida: ruído suave + borda em relevo. */
export function polished(t: Tex, p: Palette): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let v = 0.5 + (t.fbm(x, y, 2) - 0.5) * 0.4;
    if (x === 0 || y === 0) v += 0.28;
    if (x === 15 || y === 15) v -= 0.3;
    t.px(x, y, p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))]);
    t.h(x, y, x === 15 || y === 15 ? 0.3 : 0.6);
  }
  t.material(0.42, 0, 0.2);
}

export function concrete(t: Tex, color: number): void {
  const p = ramp(color, 5, 0.08);
  t.noisePal(p, { contrast: 0.5 });
  t.material(0.3, 0, 0.15);
}

export function powder(t: Tex, color: number): void {
  const p = ramp(color, 5, 0.25);
  t.noisePal(p, { contrast: 1.4, salt: 8 });
  t.speckle(mix(p[4], [255, 255, 255], 0.3), 0.08, 3);
  t.material(0.05, 0, 0.9);
}

export function terracotta(t: Tex, color: number): void {
  const p = ramp(color, 5, 0.12);
  t.noisePal(p, { contrast: 0.7, salt: 4 });
  t.speckle(scale(p[0], 0.9), 0.06, 9);
  t.material(0.15, 0, 0.5);
}

export function stainedGlass(t: Tex, color: number): void {
  const c = hex(color);
  glass(t, mix(c, [255, 255, 255], 0.15), 120, mix(c, [255, 255, 255], 0.35));
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
    const a = t.alpha(x, y);
    if (a < 200) t.px(x, y, mix(c, [255, 255, 255], 0.1 + t.white(x, y) * 0.08), 125);
  }
}
