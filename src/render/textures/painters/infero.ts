/**
 * Pintores do Ínfero: brasalito, micélios, areia e solo lamuriosos, basaltos, pedra-negra, tijolos,
 * minérios, brasa ancestral, lumita, verruga-brasa, cogulume, cinzas, altar de Ignarca e magma animado.
 * Luz de cima-esquerda: realce em cima/esquerda, sombra embaixo/direita.
 */
import { Tex, type Painter, type Palette, type RGB, hex, mix, pal, scale } from '../tex';
import { polished } from '../styles';
import { Random } from '../../../core/rng';
import { type Brick, brickWall, crack, gridSeeds, pick, pits, voronoi, wd, ws } from './building';

// ------------------------------------------------------------------ brasalito e micélios
const BRAS: Palette = pal(0x3a0e0e, 0x4c1413, 0x5e1b18, 0x70231e, 0x822c24, 0x94372b);
/** Brasalito: rocha vulcânica vermelho-escura, cheia de vesículas e com grãos claros. */
function brasalito(t: Tex): void {
  t.noisePal(BRAS, { contrast: 1.25, salt: 4 });
  t.speckle(hex(0xa84a3a), 0.05, 7, 0.08);
  pits(t, 10, hex(0x220707), BRAS[4], 0.6, 1.3);
  t.material(0.12, 0, 0.8);
}

const EMBER_MY: Palette = pal(0x5e0a10, 0x7a1016, 0x98181c, 0xb42222, 0xcc2e26, 0xe24830);
const ASH_MY: Palette = pal(0x262c36, 0x323a46, 0x3f4856, 0x4e5868, 0x5f6a7a, 0x74808f);
/** Tapete de micélio: fios curtos mais claros e esporos com leve brilho. */
function myceliumTop(t: Tex, p: Palette, thread: RGB, spore: RGB, glow: number): void {
  t.noisePal(p, { contrast: 1.15, salt: 9 });
  t.material(0.1, 0, 0.75);
  for (let i = 0; i < 9; i++) {
    let x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    const dx = t.rng.next() < 0.5 ? 1 : -1;
    for (let k = 0; k < 3; k++) { t.px(x, y, thread); t.h(x, y, 0.7); if (t.rng.next() < 0.5) x += dx; else y++; }
  }
  for (let i = 0; i < 6; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    t.px(x, y, spore); t.h(x, y, 0.75); t.m(x, y, 0.2, 0, 0.6, glow);
  }
}

/** Lateral: brasalito com a franja de micélio por cima e alguns fios escorrendo. */
function myceliumSide(t: Tex, p: Palette): void {
  brasalito(t);
  for (let x = 0; x < 16; x++) {
    const d = 3 + Math.floor(t.vnoise(x, 0, 8, 3) * 3) + (t.white(x, 1, 3) < 0.25 ? 1 : 0);
    const drip = t.white(x, 2, 8) < 0.2 ? 2 : 0;
    for (let y = 0; y < d + drip; y++) {
      const v = y >= d ? 0.22 : 0.45 + (t.white(x, y, 5) - 0.5) * 0.5 + (y === 0 ? 0.2 : 0) - (y === d - 1 ? 0.2 : 0);
      t.px(x, y, pick(p, v)); t.h(x, y, 0.65); t.m(x, y, 0.1, 0, 0.75);
    }
    t.shadePx(x, d + drip, 0.72);
  }
}

// ------------------------------------------------------------------ areia e solo lamuriosos
const LAMENT: Palette = pal(0x3a2e27, 0x463830, 0x534339, 0x604e43, 0x6d5a4e, 0x7a675a);
const LAMENT_SOIL: Palette = pal(0x30251e, 0x3b2e26, 0x47372e, 0x534137, 0x5f4b40, 0x6b5649);
/** Rosto de lamento em baixo relevo: olhos em fenda e boca aberta, caída. */
const FACE = ['#...#', '#...#', '.....', '.###.', '.###.'];
function face(t: Tex, ox: number, oy: number, k: number): void {
  const hole = (x: number, y: number) => y >= 0 && y < 5 && x >= 0 && x < 5 && FACE[y][x] === '#';
  for (let y = -1; y < 7; y++) for (let x = -1; x < 6; x++) {
    if (hole(x, y)) { t.shadePx(ox + x, oy + y, k); t.h(ox + x, oy + y, 0.2); }
    else if (hole(x, y - 1)) t.shadePx(ox + x, oy + y, 1.18); // borda de baixo do buraco pega luz
    else if (((x - 2) / 2.9) ** 2 + ((y - 2.4) / 3.4) ** 2 < 1) t.shadePx(ox + x, oy + y, 0.9); // silhueta da cabeça
  }
}

// ------------------------------------------------------------------ basaltos
const BAS: Palette = pal(0x242429, 0x2e2e34, 0x39393f, 0x44444b, 0x505058, 0x5d5d66);
const PBAS: Palette = pal(0x2c2c32, 0x36363d, 0x414148, 0x4c4c54, 0x585861, 0x66666f);

/** Topo do basalto: a face de uma coluna hexagonal; lado a lado, os blocos formam um campo de colunas. */
function basaltTop(t: Tex): void {
  const r3 = Math.sqrt(3), R = 7.2;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8;
    const n = Math.max((Math.abs(dy) * 2) / r3, Math.abs(dx) + Math.abs(dy) / r3);
    let v = 0.5 + (t.fbm(x, y, 3) - 0.5) * 0.3, h = 0.6;
    if (Math.abs(n - R) < 0.6) { v = 0.02; h = 0.1; } // fenda entre colunas
    else if (n > R) { v = 0.3 + (t.white(x, y, 5) - 0.5) * 0.3; h = 0.45; } // pontas das colunas vizinhas
    else if (n > R - 1.4) v += dx + dy < 0 ? 0.2 : -0.15; // chanfro da borda da coluna
    t.px(x, y, pick(BAS, v)); t.h(x, y, h);
  }
  t.material(0.18, 0, 0.4);
  pits(t, 4, BAS[0], BAS[3], 0.5, 0.9);
}

/** Lateral do basalto: uma coluna com duas faces do prisma (a da esquerda pega luz), estrias e uma junta. */
function basaltSide(t: Tex): void {
  const jy = t.rng.nextInt(16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let v = (x < 8 ? 0.58 : 0.4) + (t.white(x, 0, 11) - 0.5) * 0.18 + (t.vnoise(x, y, 4, 12) - 0.5) * 0.22 + (t.white(x, y, 3) - 0.5) * 0.08, h = 0.6;
    if (x === 1) v += 0.15; else if (x === 8 || x === 15) v -= 0.12; // arestas
    const j = (jy + (x > 9 ? 1 : 0)) & 15;
    if (y === j) { v -= 0.3; h = 0.25; } else if (y === ((j + 1) & 15)) v += 0.1;
    if (x === 0) { v = 0.02; h = 0.1; } // fenda entre colunas
    t.px(x, y, pick(BAS, v)); t.h(x, y, h);
  }
  t.material(0.18, 0, 0.4);
}

// ------------------------------------------------------------------ pedra-negra
const BLK: Palette = pal(0x17141a, 0x1f1b23, 0x28232d, 0x312b37, 0x3b3442, 0x48404f);
const PBLK: Palette = pal(0x1c1920, 0x241f29, 0x2d2733, 0x362f3d, 0x403847, 0x4d4455);
/** Pedra-negra: estratos horizontais irregulares e veios finos mais claros. */
function blackstone(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = t.vnoise(0, y, 8, 2) * 0.45 + t.vnoise(x, y, 4, 3) * 0.35 + (t.white(x, y, 4) - 0.5) * 0.35;
    t.px(x, y, pick(BLK, v + 0.1)); t.h(x, y, 0.35 + v * 0.3);
  }
  for (let i = 0; i < 3; i++) {
    const y = t.rng.nextInt(16), x0 = t.rng.nextInt(16), len = 3 + t.rng.nextInt(4);
    for (let x = x0; x < x0 + len; x++) { t.px(x, y, BLK[5]); t.h(x, y, 0.6); t.shadePx(x, y + 1, 0.8); }
  }
  t.material(0.2, 0, 0.35);
}

function polishedBlackstone(t: Tex): void {
  polished(t, PBLK);
  // reflexo diagonal suave (repete sem emenda)
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) if (Math.abs(((x - y) & 15) - 6) < 1) t.shadePx(x, y, 1.1);
  t.material(0.55, 0, 0.1);
}

// ------------------------------------------------------------------ ouro e minérios
const GOLD: Palette = pal(0x7a4e0c, 0xa87014, 0xd09a22, 0xecc03a, 0xffe070, 0xfff6c0);
const QTZ: Palette = pal(0x8e8680, 0xb8b0a8, 0xd8d2ca, 0xece8e2, 0xfaf8f4);

/** Posições espalhadas no toro, com distância mínima entre si (grãos não se amontoam). */
function spread(t: Tex, n: number, minD: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 30; tries++) {
      x = t.rng.nextInt(16); y = t.rng.nextInt(16);
      if (out.every(([ox, oy]) => Math.hypot(wd(x, ox), wd(y, oy)) >= minD)) break;
    }
    out.push([x, y]);
  }
  return out;
}

/** Pepita arredondada (1, 2 ou 4 px): realce em cima-esquerda, sombra embaixo-direita; metal polido. */
function nugget(t: Tex, x: number, y: number, size: number, shadow: RGB): void {
  const cells = ([[0, 0, 5], [1, 0, 3], [0, 1, 3], [1, 1, 1]] as [number, number, number][]).slice(0, size === 3 ? 4 : size);
  const on = (dx: number, dy: number) => cells.some(([cx, cy]) => cx === dx && cy === dy);
  for (const [dx, dy] of cells) if (!on(dx + 1, dy + 1)) { t.px(x + dx + 1, y + dy + 1, shadow); t.h(x + dx + 1, y + dy + 1, 0.25); }
  for (const [dx, dy, c] of cells) { t.px(x + dx, y + dy, GOLD[size === 1 ? 4 : c]); t.h(x + dx, y + dy, 0.85); t.m(x + dx, y + dy, 0.9, 1, 0.02); }
}

/** Cristais de quartzo: prismas curtos na diagonal (face clara, face lateral mais escura e sombra). */
function quartzShards(t: Tex, n: number): void {
  spread(t, n, 5).forEach(([x, y], i) => {
    const up = i % 2 === 0, len = 2 + t.rng.nextInt(2);
    const pts: [number, number][] = [];
    for (let k = 0; k < len; k++) pts.push([x + k, up ? y - k : y + k]);
    for (const [px, py] of pts) { t.px(px + 1, py + 1, scale(BRAS[0], 0.75)); t.h(px + 1, py + 1, 0.2); }
    for (const [px, py] of pts) { t.px(px + 1, py, QTZ[1]); t.h(px + 1, py, 0.7); t.m(px + 1, py, 0.7, 0, 0.05); }
    pts.forEach(([px, py], k) => { t.px(px, py, QTZ[k === len - 1 ? 4 : 3]); t.h(px, py, 0.85); t.m(px, py, 0.8, 0, 0.05); });
  });
}

// ------------------------------------------------------------------ tijolos do Ínfero
const INB: Palette = pal(0x1f0c10, 0x2b1116, 0x38161c, 0x451c22, 0x522329, 0x5f2b31);
const RED_INB: Palette = pal(0x3a0a0a, 0x520f0e, 0x6a1512, 0x821c16, 0x98251b, 0xac3022);
/** Trama de cesto: quadrados 8×8 alternando pares de tijolos deitados e em pé. */
function basket(phase: number): Brick[] {
  const b: Brick[] = [];
  for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
    const x = cx * 8, y = cy * 8;
    if ((cx + cy + phase) & 1) b.push({ x, y, w: 7, h: 3 }, { x, y: y + 4, w: 7, h: 3 });
    else b.push({ x, y, w: 3, h: 7 }, { x: x + 4, y, w: 3, h: 7 });
  }
  return b;
}
function inferoBricks(t: Tex, p: Palette, mortar: RGB, phase: number): void {
  const map = brickWall(t, basket(phase), p, { mortar, noise: 0.45, vary: 0.2, salt: 11, hi: 0.22, lo: 0.24 });
  for (let i = 0; i < 256; i++) if (map[i] >= 0 && t.white(i & 15, i >> 4, 23) < 0.06) t.shadePx(i & 15, i >> 4, 0.8);
  t.material(0.22, 0, 0.35);
}

// ------------------------------------------------------------------ brasa ancestral
const ANC: Palette = pal(0x1e1512, 0x2a1d18, 0x36251e, 0x432e25, 0x50382c, 0x5e4334);
const EMB: Palette = pal(0x7a2008, 0xa8360c, 0xd05414, 0xf07a22, 0xffa640, 0xffd080);
/** Distância ao braço mais próximo de uma espiral de Arquimedes com passo `step`. */
function spiralDist(dx: number, dy: number, step: number): number {
  const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  let s = (r - (a / (2 * Math.PI)) * step) % step;
  if (s < 0) s += step;
  return Math.min(s, step - s);
}
/** Grava uma espiral de brasa (sulco quente, mais quente no centro) de raio `R`. */
function emberSpiral(t: Tex, cx: number, cy: number, R: number, step: number, glow: number): void {
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    if (r > R || spiralDist(dx, dy, step) > 0.55) continue;
    const heat = 1 - r / R;
    t.px(x, y, pick(EMB, 0.3 + heat * 0.7)); t.h(x, y, 0.3); t.m(x, y, 0.35, 0, 0.3, glow * (0.5 + heat * 0.5));
  }
}

// ------------------------------------------------------------------ cristais e fungos luminosos
const LUM: Palette = pal(0x3e1806, 0x6a2c08, 0x9c4610, 0xc8661a, 0xeb8e2a, 0xffbe58, 0xffe8b0);
/** Lumita: feixe de prismas âmbar verticais (face iluminada, aresta clara, face na sombra) com fendas escuras. */
function lumita(t: Tex): void {
  const v = voronoi(gridSeeds(t.rng, 3, 0.9), 0.4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = y * 16 + x, [cx] = v.seeds[v.idx[k]];
    if (v.d2[k] - v.d1[k] < 0.7) { t.px(x, y, pick(LUM, 0.08 + t.white(x, y, 4) * 0.12)); t.h(x, y, 0.2); t.m(x, y, 0.3, 0, 0.3, 0.4); continue; }
    const ox = ws(x + 0.5, cx), ridge = Math.abs(ox) < 0.6;
    const val = (ridge ? 0.93 : ox < 0 ? 0.72 : 0.46) + ((v.idx[k] * 29) % 5) / 5 * 0.1 - 0.05 + (t.white(x, y, 5) - 0.5) * 0.08;
    t.px(x, y, pick(LUM, val)); t.h(x, y, ridge ? 0.85 : 0.6); t.m(x, y, 0.85, 0, 0.05, ridge ? 1 : 0.75);
  }
}

const WART: Palette = pal(0x3e080c, 0x5a0c12, 0x761218, 0x921a1e, 0xac2626, 0xc43a30, 0xd85640);
/** Verruga-brasa em bloco: lóbulos carnudos com volume e vincos escuros entre eles. */
function emberWartBlock(t: Tex): void {
  const v = voronoi(gridSeeds(t.rng, 3, 0.8));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = y * 16 + x, [cx, cy] = v.seeds[v.idx[k]], crease = v.d2[k] - v.d1[k] < 0.7;
    const ox = ws(x + 0.5, cx), oy = ws(y + 0.5, cy);
    const val = crease ? 0.08 : 0.66 - v.d1[k] * 0.1 - (ox + oy) * 0.06 + (t.white(x, y, 3) - 0.5) * 0.12;
    t.px(x, y, pick(WART, val)); t.h(x, y, crease ? 0.15 : 0.7 - v.d1[k] * 0.08); t.m(x, y, 0.32, 0, 0.4);
  }
  for (let i = 0; i < 7; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    if (t.hGet(x, y) > 0.3) { t.px(x, y, WART[6]); t.shadePx(x + 1, y + 1, 0.75); t.h(x, y, 0.85); }
  }
}

const SHROOM: Palette = pal(0x8a3a10, 0xb4521a, 0xd86e24, 0xf08e34, 0xffb050, 0xffd688, 0xfff2cc);
/** Cogulume: massa de fungo laranja com bolhas luminosas redondas. */
function shroomlight(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 0.36 + (t.fbm(x, y, 5) - 0.5) * 0.4 + (t.white(x, y, 6) - 0.5) * 0.15;
    t.px(x, y, pick(SHROOM, v)); t.h(x, y, 0.4 + v * 0.3); t.m(x, y, 0.3, 0, 0.4, 0.7);
  }
  for (let i = 0; i < 7; i++) {
    const cx = t.rng.next() * 16, cy = t.rng.next() * 16, r = 1.2 + t.rng.next();
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > r) continue;
      t.px(x, y, pick(SHROOM, 0.55 + (1 - d / r) * 0.5 - (dx + dy > 0 ? 0.1 : 0))); t.h(x, y, 0.75); t.m(x, y, 0.45, 0, 0.2, 1);
    }
  }
}

const ASH: Palette = pal(0x7c7976, 0x8d8a87, 0x9d9a97, 0xadaaa7, 0xbcbab7, 0xcac8c5);

// ------------------------------------------------------------------ altar de Ignarca
const RUNE: Palette = pal(0x7a2206, 0xc04a0e, 0xf07a1c, 0xffae48, 0xffe0a0);
/** Runas próprias (3×5) e a chama de Ignarca (4×6). */
const RUNE_A = ['.#.', '#.#', '.#.', '.#.', '.#.'];
const RUNE_B = ['..#', '.#.', '###', '.#.', '#..'];
const FLAME = ['..#.', '.##.', '.###', '####', '####', '.##.'];
/** Glifo aceso: traço laranja-claro (pontas de cima/esquerda mais quentes) e brilho fraco em volta. */
function glyph(t: Tex, rows: string[], ox: number, oy: number): void {
  const on = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] === '#';
  for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= rows[0].length; x++) {
    const X = ox + x, Y = oy + y;
    if (on(x, y)) { t.px(X, Y, RUNE[on(x - 1, y) || on(x, y - 1) ? 3 : 4]); t.h(X, Y, 0.3); t.m(X, Y, 0.4, 0, 0.2, 1); }
    else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { t.blend(X, Y, RUNE[1], 0.35); t.emit(X, Y, 0.3); }
  }
}

// ------------------------------------------------------------------ magma (animado)
const CRUST: Palette = pal(0x1c0d0a, 0x28130e, 0x341912, 0x422116, 0x50291a);
const HOT: Palette = pal(0x8a1e06, 0xc4400a, 0xf06a14, 0xff9a2c, 0xffc860, 0xfff0b0);
/** Magma (4 quadros): placas de crosta escura; as rachaduras incandescentes pulsam em onda (loop perfeito). */
function magma(t: Tex): void {
  const rnd = new Random(t.seed); // mesma geometria em todos os quadros
  const v = voronoi(gridSeeds(rnd, 3, 0.85));
  const ph = (t.frame / t.frames) * Math.PI * 2;
  const grain = (x: number, y: number, s: number) => t.vnoise(x, y, 16, s); // ruído por pixel, igual em todos os quadros
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = y * 16 + x, gap = v.d2[k] - v.d1[k], cell = v.idx[k];
    const pulse = 0.5 + 0.5 * Math.sin(ph + cell * 2.1 + (x + y) * 0.35);
    if (gap < 1) {
      const heat = 0.5 + pulse * 0.45 - gap * 0.2 + (grain(x, y, 1) - 0.5) * 0.1;
      t.px(x, y, pick(HOT, heat)); t.h(x, y, 0.1); t.m(x, y, 0.45, 0, 0.1, 0.65 + pulse * 0.35);
      continue;
    }
    const [cx, cy] = v.seeds[cell], ox = ws(x + 0.5, cx), oy = ws(y + 0.5, cy);
    let c = pick(CRUST, 0.5 + (t.vnoise(x, y, 8, 3) - 0.5) * 0.35 + (grain(x, y, 2) - 0.5) * 0.2 - (ox + oy) * 0.03);
    const warm = Math.max(0, 2 - gap) * (0.3 + pulse * 0.4); // brasa refletida na borda das placas
    if (warm > 0) c = mix(c, HOT[1], Math.min(0.6, warm * 0.5));
    t.px(x, y, c); t.h(x, y, 0.55 + Math.min(0.3, gap * 0.06)); t.m(x, y, 0.2, 0, 0.35, warm * 0.4);
  }
  // bolsões de lava dentro das placas
  for (let i = 0; i < 3; i++) {
    const x = rnd.nextInt(16), y = rnd.nextInt(16), p = 0.5 + 0.5 * Math.sin(ph + i * 2.4);
    t.px(x, y, pick(HOT, 0.45 + p * 0.5)); t.m(x, y, 0.45, 0, 0.1, 0.6 + p * 0.4);
  }
}

// ------------------------------------------------------------------ registro
const INB_MORTAR = hex(0x12070a);
export const INFERO_PAINTERS: Record<string, Painter> = {
  brasalito,
  ember_nylium_top: (t) => myceliumTop(t, EMBER_MY, hex(0xdc4636), hex(0xffa050), 0.35),
  ember_nylium_side: (t) => myceliumSide(t, EMBER_MY),
  ash_nylium_top: (t) => myceliumTop(t, ASH_MY, hex(0x8a98a8), hex(0x9fd4e0), 0.25),
  ash_nylium_side: (t) => myceliumSide(t, ASH_MY),
  lament_sand: (t) => {
    t.noisePal(LAMENT, { contrast: 0.75, salt: 6 });
    t.speckle(hex(0x86735f), 0.035, 5, 0.05);
    t.speckle(hex(0x30261f), 0.03, 6, -0.05);
    face(t, 2, 2, 0.56); face(t, 9, 9, 0.6);
    t.material(0.06, 0, 0.85);
  },
  lament_soil: (t) => {
    t.noisePal(LAMENT_SOIL, { contrast: 0.95, salt: 8 });
    // torrões com sombra embaixo
    for (let i = 0; i < 6; i++) {
      const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
      t.shadePx(x, y + 1, 0.7); t.shadePx(x + 1, y + 1, 0.7);
      t.px(x, y, LAMENT_SOIL[5]); t.px(x + 1, y, LAMENT_SOIL[4]); t.h(x, y, 0.75); t.h(x + 1, y, 0.7);
    }
    // raízes finas e pálidas
    for (let i = 0; i < 3; i++) {
      let x = t.rng.nextInt(16), y = t.rng.nextInt(16);
      for (let k = 0; k < 5; k++) { t.px(x, y, hex(0x86765f)); t.h(x, y, 0.6); if (t.rng.next() < 0.5) x += t.rng.next() < 0.5 ? 1 : -1; else y++; }
    }
    face(t, 6, 5, 0.6);
    t.material(0.05, 0, 0.9);
  },
  basalt_top: basaltTop,
  basalt_side: basaltSide,
  polished_basalt_top: (t) => {
    polished(t, PBAS);
    // sulco hexagonal (lembra a seção da coluna) e miolo levemente saliente
    const r3 = Math.sqrt(3);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8, n = Math.max((Math.abs(dy) * 2) / r3, Math.abs(dx) + Math.abs(dy) / r3);
      if (Math.abs(n - 5.4) < 0.5) { t.shadePx(x, y, dx + dy < 0 ? 0.72 : 0.86); t.h(x, y, 0.35); }
      else if (n < 1.8) t.shadePx(x, y, 1.12);
    }
    t.material(0.45, 0, 0.2);
  },
  polished_basalt_side: (t) => {
    // coluna polida: faixas lisas, dois sulcos verticais e chanfro nas laterais
    const prof = [0.26, 0.08, 0, 0, -0.22, 0.1, 0, 0, 0, 0, -0.22, 0.1, 0, 0, -0.06, -0.28];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      t.px(x, y, pick(PBAS, 0.5 + prof[x] + (t.vnoise(x, y, 4, 5) - 0.5) * 0.15 + (t.white(x, y) - 0.5) * 0.06));
      t.h(x, y, prof[x] < -0.1 ? 0.4 : 0.6);
    }
    t.material(0.45, 0, 0.2);
  },
  blackstone,
  blackstone_top: (t) => {
    // topo: grão fino, sem estratos, com pontos cristalinos
    t.noisePal(BLK, { contrast: 1.2, salt: 13, bias: 0.08 });
    t.speckle(hex(0x514a5c), 0.04, 14, 0.1);
    t.material(0.2, 0, 0.35);
  },
  polished_blackstone: polishedBlackstone,
  gilded_blackstone: (t) => {
    blackstone(t);
    for (const [x, y] of spread(t, 7, 4)) nugget(t, x, y, 1 + t.rng.nextInt(3), scale(BLK[0], 0.8));
  },
  infero_bricks: (t) => inferoBricks(t, INB, INB_MORTAR, 0),
  cracked_infero_bricks: (t) => {
    inferoBricks(t, INB, INB_MORTAR, 0);
    const dark = hex(0x0a0304), lit = INB[5];
    crack(t, 2, 0, 6, dark, lit, 1); crack(t, 13, 8, 6, dark, lit, -1); crack(t, 9, 2, 4, dark, lit, 1);
    for (const [x, y] of [[6, 6], [5, 6], [6, 5], [14, 14], [13, 14]]) { t.px(x, y, mix(INB[0], INB_MORTAR, 0.5)); t.h(x, y, 0.3); }
  },
  red_infero_bricks: (t) => inferoBricks(t, RED_INB, hex(0x220505), 1),
  infero_quartz_ore: (t) => { brasalito(t); quartzShards(t, 5); },
  infero_gold_ore: (t) => {
    brasalito(t);
    for (const [x, y] of spread(t, 8, 4)) nugget(t, x, y, 1 + t.rng.nextInt(3), scale(BRAS[0], 0.75));
  },
  ancient_ember_top: (t) => {
    // rocha antiga com anéis concêntricos e uma espiral de brasa no centro
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let v = 0.45 + (t.fbm(x, y, 3) - 0.5) * 0.4 + Math.sin(Math.hypot(x + 0.5 - 8, y + 0.5 - 8) * 1.6) * 0.06;
      if (x === 0 || y === 0) v += 0.2;
      if (x === 15 || y === 15) v -= 0.22;
      t.px(x, y, pick(ANC, v)); t.h(x, y, 0.55);
    }
    t.material(0.22, 0, 0.4);
    emberSpiral(t, 8, 8, 6.5, 3.1, 0.6);
  },
  ancient_ember_side: (t) => {
    // camadas horizontais de rocha antiga, duas espirais fósseis em brasa e fagulhas
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = 0.3 + t.vnoise(0, y, 4, 6) * 0.35 + (t.vnoise(x, y, 8, 7) - 0.5) * 0.25 + (t.white(x, y, 8) - 0.5) * 0.15;
      t.px(x, y, pick(ANC, v)); t.h(x, y, 0.5);
    }
    for (const y of [5, 11]) for (let x = 0; x < 16; x++) if (t.white(x, y, 9) < 0.7) { t.shadePx(x, y, 0.7); t.h(x, y, 0.3); }
    t.material(0.22, 0, 0.4);
    emberSpiral(t, 4.5, 4.5, 3.6, 1.9, 0.5);
    emberSpiral(t, 12, 12.5, 3.2, 1.8, 0.5);
    for (let i = 0; i < 5; i++) { const x = t.rng.nextInt(16), y = t.rng.nextInt(16); t.px(x, y, EMB[4]); t.emit(x, y, 0.6); }
  },
  lumita,
  ember_wart_block: emberWartBlock,
  shroomlight,
  ash_block: (t) => {
    t.noisePal(ASH, { contrast: 1.0, salt: 3 });
    t.speckle(hex(0x45413f), 0.05, 4, -0.1);
    t.speckle(hex(0xdcdad6), 0.04, 5, 0.05);
    for (let i = 0; i < 3; i++) { const x = t.rng.nextInt(16), y = t.rng.nextInt(16); t.px(x, y, hex(0x33302e)); t.px(x + 1, y, hex(0x4a4644)); t.h(x, y, 0.3); }
    t.px(t.rng.nextInt(16), t.rng.nextInt(16), hex(0x8e5e46));
    t.material(0.04, 0, 0.95);
  },
  ignarca_altar_side: (t) => {
    polishedBlackstone(t);
    // faixa rebaixada onde as runas estão gravadas
    for (let y = 3; y <= 12; y++) for (let x = 1; x < 15; x++) { t.shadePx(x, y, y === 3 ? 0.6 : y === 12 ? 1.25 : 0.82); t.h(x, y, 0.38); }
    glyph(t, RUNE_A, 2, 5); glyph(t, FLAME, 6, 5); glyph(t, RUNE_B, 11, 5);
    for (const x of [2, 13]) for (const y of [1, 14]) { t.px(x, y, RUNE[2]); t.emit(x, y, 0.8); }
  },
  ignarca_altar_top: (t) => {
    polishedBlackstone(t);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.abs(Math.hypot(x + 0.5 - 8, y + 0.5 - 8) - 6);
      if (d < 0.5) { t.px(x, y, RUNE[2]); t.h(x, y, 0.3); t.m(x, y, 0.4, 0, 0.2, 0.9); }
      else if (d < 1.2) { t.blend(x, y, RUNE[1], 0.25); t.emit(x, y, 0.25); }
    }
    for (const [x, y] of [[7, 3], [8, 3], [12, 7], [12, 8], [7, 12], [8, 12], [3, 7], [3, 8]]) { t.px(x, y, RUNE[3]); t.emit(x, y, 1); }
    glyph(t, FLAME, 6, 5);
  },
  magma,
};
