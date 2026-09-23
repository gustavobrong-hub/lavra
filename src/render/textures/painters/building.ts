/**
 * Pintores de blocos de construção: alvenarias, quartzo, estante, vidros, grades, feno, esponjas,
 * caminho de terra, ossos e blocos de luz. Também exporta utilitários de desenho usados pelo Ínfero.
 * Luz de cima-esquerda: realce em cima/esquerda, sombra embaixo/direita.
 */
import { Tex, type Painter, type Palette, type RGB, hex, mix, pal, scale } from '../tex';
import { WOOD_PALS, dirt, glass } from '../styles';
import type { Random } from '../../../core/rng';

// ------------------------------------------------------------------ utilitários (exportados)
/** Cor da paleta para um valor 0..1 (fora da faixa satura nas pontas). */
export const pick = (p: Palette, v: number): RGB => p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))];
/** Distância no toro 16×16 — padrões que repetem sem emenda. */
export const wd = (a: number, b: number): number => { const d = Math.abs(a - b) % 16; return Math.min(d, 16 - d); };
/** Deslocamento com sinal no toro (−8..8). */
export const ws = (a: number, b: number): number => { let d = (a - b) % 16; if (d > 8) d -= 16; if (d < -8) d += 16; return d; };

export interface Vor { idx: Int16Array; d1: Float32Array; d2: Float32Array; seeds: [number, number][] }
/** Voronoi periódico: célula mais próxima e distâncias à 1ª e à 2ª semente, por pixel (`sy` estica o eixo y). */
export function voronoi(seeds: [number, number][], sy = 1): Vor {
  const idx = new Int16Array(256), d1 = new Float32Array(256), d2 = new Float32Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let a = 1e9, b = 1e9, ai = 0;
    for (let i = 0; i < seeds.length; i++) {
      const dx = wd(x, seeds[i][0]), dy = wd(y, seeds[i][1]) * sy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < a) { b = a; a = d; ai = i; } else if (d < b) b = d;
    }
    const k = y * 16 + x; idx[k] = ai; d1[k] = a; d2[k] = b;
  }
  return { idx, d1, d2, seeds };
}

/** Sementes em grade g×g com jitter (espalhadas sem aglomerar). */
export function gridSeeds(rnd: Random, g: number, jitter = 0.7): [number, number][] {
  const s = 16 / g, out: [number, number][] = [];
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
    out.push([(i + 0.5 + (rnd.next() - 0.5) * jitter) * s, (j + 0.5 + (rnd.next() - 0.5) * jitter) * s]);
  }
  return out;
}

export interface Brick { x: number; y: number; w: number; h: number; p?: Palette; tone?: number }
export interface BrickOpts { mortar: RGB; noise?: number; vary?: number; salt?: number; hi?: number; lo?: number }
/**
 * Alvenaria: pinta a argamassa e cada tijolo (coordenadas repetem) com chanfro em relevo.
 * Devolve o índice do tijolo por pixel (−1 = argamassa), útil para musgo e rachaduras.
 */
export function brickWall(t: Tex, bricks: Brick[], p: Palette, o: BrickOpts): Int16Array {
  const map = new Int16Array(256).fill(-1);
  const hi = o.hi ?? 0.2, lo = o.lo ?? 0.22;
  t.fill(o.mortar);
  for (let i = 0; i < 256; i++) t.height[i] = 0.15;
  bricks.forEach((b, i) => {
    const bp = b.p ?? p;
    const tone = b.tone ?? (t.rng.next() - 0.5) * (o.vary ?? 0.2);
    for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) {
      const x = (b.x + k) & 15, y = (b.y + j) & 15;
      let v = 0.5 + tone + (t.fbm(x, y, o.salt ?? 7) - 0.5) * (o.noise ?? 0.5);
      if (j === 0) v += hi; else if (k === 0) v += hi * 0.45;
      if (j === b.h - 1) v -= lo; else if (k === b.w - 1) v -= lo * 0.6;
      t.px(x, y, pick(bp, v));
      const edge = j === 0 || k === 0 || j === b.h - 1 || k === b.w - 1;
      t.h(x, y, edge ? 0.5 : 0.62 + (v - 0.5) * 0.12);
      map[y * 16 + x] = i;
    }
  });
  return map;
}

/** Rachadura sinuosa: sulco escuro com a parede de baixo/direita iluminada (ela encara a luz). */
export function crack(t: Tex, x: number, y: number, len: number, dark: RGB, lit: RGB, dir = 1, rnd: Random = t.rng): void {
  const path: [number, number][] = [];
  for (let i = 0; i < len; i++) {
    path.push([x & 15, y & 15]);
    const r = rnd.next();
    if (r < 0.5) y++; else if (r < 0.85) x += dir; else { x += dir; y++; }
  }
  const on = new Set(path.map(([a, b]) => a + b * 16));
  for (const [a, b] of path) {
    for (const [nx, ny] of [[a + 1, b], [a, b + 1]]) if (!on.has((nx & 15) + (ny & 15) * 16)) t.blend(nx, ny, lit, 0.45);
  }
  for (const [a, b] of path) { t.px(a, b, dark); t.h(a, b, 0.08); }
}

/** Poros/vesículas: fundo escuro no lado de cima-esquerda e parede interna clara embaixo-direita. */
export function pits(t: Tex, n: number, dark: RGB, lit: RGB, rMin = 0.6, rMax = 1.4, rnd: Random = t.rng): void {
  for (let i = 0; i < n; i++) {
    const cx = rnd.next() * 16, cy = rnd.next() * 16, r = rMin + rnd.next() * (rMax - rMin);
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > r) continue;
      t.px(x, y, dx + dy > r * 0.7 ? lit : dx + dy > -r * 0.2 ? mix(dark, lit, 0.35) : dark, t.alpha(x, y));
      t.h(x, y, 0.1 + (dx + dy > r * 0.7 ? 0.2 : 0));
    }
  }
}

/** Relevo de uma máscara: realce na borda de cima/esquerda, sombra embaixo/direita e sombra projetada fora dela. */
export function emboss(t: Tex, inside: (x: number, y: number) => boolean, hi: number, lo: number, cast: number): void {
  const k = new Float32Array(256).fill(1);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    if (inside(x, y)) {
      if (!inside(x, y - 1) || !inside(x - 1, y)) k[i] = hi;
      else if (!inside(x, y + 1) || !inside(x + 1, y)) k[i] = lo;
    } else if (inside(x - 1, y - 1) || inside(x - 1, y) || inside(x, y - 1)) k[i] = cast;
  }
  for (let i = 0; i < 256; i++) if (k[i] !== 1) t.shadePx(i & 15, i >> 4, k[i]);
}

// ------------------------------------------------------------------ alvenarias de pedra
const SB: Palette = pal(0x5a5a5f, 0x67676c, 0x747479, 0x818186, 0x8e8e93, 0x9b9ba0);
const SB_MORTAR = hex(0x45454a);
/** Cantaria em fiadas de alturas diferentes (5, 4 e 4 px) com juntas desencontradas. */
const ASHLAR: Brick[] = [
  { x: 1, y: 0, w: 9, h: 5 }, { x: 11, y: 0, w: 5, h: 5 },
  { x: 6, y: 6, w: 7, h: 4 }, { x: 14, y: 6, w: 7, h: 4 },
  { x: 3, y: 11, w: 5, h: 4 }, { x: 9, y: 11, w: 9, h: 4 },
];

function stoneBricks(t: Tex): Int16Array {
  const map = brickWall(t, ASHLAR, SB, { mortar: SB_MORTAR, noise: 0.42, vary: 0.18, salt: 3 });
  // desgaste: lascas miúdas dentro das pedras
  for (let i = 0; i < 6; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    if (map[y * 16 + x] >= 0 && t.hGet(x, y) > 0.55) { t.shadePx(x, y, 0.88); t.h(x, y, 0.5); }
  }
  t.material(0.2, 0, 0.35);
  return map;
}

const MOSS: Palette = pal(0x2b4a1d, 0x365c23, 0x436f2a, 0x528332, 0x62963b, 0x78aa48);
/** Musgo que nasce nas juntas e se espalha em manchas, com volume (realce em cima, sombra embaixo). */
function mossOver(t: Tex, map: Int16Array, amount = 0.8): void {
  const m = new Uint8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    let near = map[i] < 0 ? 0.28 : 0;
    if (!near) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (map[((y + dy) & 15) * 16 + ((x + dx) & 15)] < 0) near = 0.13;
    if (t.fbm(x, y, 41) + near > amount) m[i] = 1;
  }
  const has = (x: number, y: number) => m[(y & 15) * 16 + (x & 15)] === 1;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!has(x, y)) { if (has(x, y - 1)) t.shadePx(x, y, 0.8); continue; }
    let v = 0.45 + (t.fbm(x, y, 43) - 0.5) * 0.6;
    if (!has(x, y - 1)) v += 0.25; else if (!has(x - 1, y)) v += 0.1;
    if (!has(x, y + 1)) v -= 0.22;
    t.px(x, y, pick(MOSS, v));
    t.h(x, y, 0.7);
    t.m(x, y, 0.06, 0, 0.85);
  }
}

/** Lasca no canto de uma pedra: fundo rebaixado com borda clara embaixo/direita. */
function chip(t: Tex, cells: [number, number][]): void {
  for (const [x, y] of cells) { t.px(x, y, mix(SB_MORTAR, SB[1], 0.45)); t.h(x, y, 0.3); }
}

// ------------------------------------------------------------------ tijolos de barro
const CLAY_BR: Palette = pal(0x6c2a1f, 0x803224, 0x943b2a, 0xa64631, 0xb6533a, 0xc46445);
const CLAY_HD: Palette = pal(0x4c1e18, 0x5c241c, 0x6c2b21, 0x7c3326, 0x8a3c2d, 0x974735);
const MORTAR_BR: Palette = pal(0x8c8274, 0x9e9486, 0xafa597, 0xbeb4a6, 0xcbc2b4);
/** Aparelho flamengo: cada fiada alterna tijolos compridos (4 px) e cabeças (2 px, mais queimadas). */
const FLEMISH: Brick[] = [];
for (let r = 0; r < 4; r++) {
  const o = (r & 1) * 4, y = r * 4;
  FLEMISH.push({ x: 1 + o, y, w: 4, h: 3 }, { x: 6 + o, y, w: 2, h: 3, p: CLAY_HD }, { x: 9 + o, y, w: 4, h: 3 }, { x: 14 + o, y, w: 2, h: 3, p: CLAY_HD });
}

function clayBricks(t: Tex): void {
  const map = brickWall(t, FLEMISH, CLAY_BR, { mortar: MORTAR_BR[3], noise: 0.4, vary: 0.22, salt: 5, hi: 0.18, lo: 0.2 });
  t.material(0.14, 0, 0.6);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (map[y * 16 + x] >= 0) {
      // grãos: poucos pontos queimados e de areia
      const w = t.white(x, y, 21);
      if (w < 0.05) t.shadePx(x, y, 0.8); else if (w > 0.965) t.shadePx(x, y, 1.14);
      continue;
    }
    // argamassa clara; logo abaixo de um tijolo fica na sombra dele
    const under = map[((y - 1) & 15) * 16 + x] >= 0;
    t.px(x, y, pick(MORTAR_BR, 0.62 + (t.white(x, y, 4) - 0.5) * 0.35 - (under ? 0.3 : 0)));
    t.m(x, y, 0.08, 0, 0.8);
  }
}

/** Roseta de quatro pétalas com miolo (máscara 10×10) — flor entalhada na pedra. */
function rosette(u: number, v: number): boolean {
  const px = u + 0.5, py = v + 0.5, dc = Math.hypot(px - 5, py - 5);
  const petal = [[5, 2.5], [5, 7.5], [2.5, 5], [7.5, 5]].some(([cx, cy]) => Math.hypot(px - cx, py - cy) < 2.25);
  return (petal && Math.abs(dc - 1.8) > 0.45) || dc < 1.2;
}

/** Pedra talhada: moldura chanfrada, painel rebaixado e um emblema 10×10 em relevo. */
function chiseled(t: Tex, mask: (u: number, v: number) => boolean): void {
  const em = (x: number, y: number) => x >= 3 && x <= 12 && y >= 3 && y <= 12 && mask(x - 3, y - 3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let v = 0.5 + (t.fbm(x, y, 9) - 0.5) * 0.35, h = 0.7;
    if (x < 2 || y < 2 || x > 13 || y > 13) {
      // moldura: chanfro externo
      if (x === 0 || y === 0) v += 0.26; else if (x === 1 || y === 1) v += 0.06;
      if (x === 15 || y === 15) v -= 0.3; else if (x === 14 || y === 14) v -= 0.04;
    } else if (x === 2 || y === 2) { v -= 0.3; h = 0.4; } // parede do rebaixo na sombra
    else if (x === 13 || y === 13) { v += 0.14; h = 0.45; } // parede do rebaixo iluminada
    else { v -= 0.1; h = 0.35; if (em(x, y)) { v += 0.2; h = 0.62; } }
    t.px(x, y, pick(SB, v));
    t.h(x, y, h);
  }
  emboss(t, em, 1.14, 0.9, 0.82);
  t.material(0.22, 0, 0.3);
}

// ------------------------------------------------------------------ quartzo
const QZ: Palette = pal(0xc4bcb1, 0xd2cbc1, 0xddd7ce, 0xe6e1d9, 0xeeeae3, 0xf5f2ed);
/** Quartzo leitoso: ruído muito suave, veios finos ondulados e chanfro nas bordas. */
function quartz(t: Tex, veins = true): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let v = 0.58 + (t.fbm(x, y, 5) - 0.5) * 0.34;
    if (veins && Math.abs(Math.sin(((x + 2 * y) / 16) * Math.PI + t.vnoise(x, y, 4, 8) * 3)) < 0.09) v -= 0.18;
    if (x === 0 || y === 0) v += 0.2;
    if (x === 15 || y === 15) v -= 0.24;
    t.px(x, y, pick(QZ, v));
    t.h(x, y, x === 15 || y === 15 ? 0.45 : 0.6);
  }
  t.material(0.55, 0, 0.1);
}

// ------------------------------------------------------------------ estante
interface Book { x: number; w: number; top: number; c: number; band?: boolean; lean?: boolean }
/** Uma fileira de livros entre duas tábuas; um tombado apoiado no vizinho e um vasinho no meio. */
const BOOKS: Book[] = [
  { x: 0, w: 2, top: 3, c: 0x8c2a26, band: true },
  { x: 2, w: 1, top: 5, c: 0x2e6a3c },
  { x: 3, w: 2, top: 2, c: 0x2d4a86, band: true },
  { x: 9, w: 2, top: 5, c: 0xa8842c, lean: true, band: true },
  { x: 13, w: 1, top: 4, c: 0x5e3a78 },
  { x: 14, w: 2, top: 3, c: 0x2a6e6a, band: true },
];
/** Vasinho de barro com um broto (colunas 5..8, linhas 7..13). */
const VASE = ['..g.', '.gGg', 'g.G.', '.RR.', 'RrrD', 'rrrD', '.rD.'];
const VASE_COL: Record<string, RGB> = { g: hex(0x5a9a3c), G: hex(0x3e7a2c), R: hex(0xcf7a4c), r: hex(0xa85a34), D: hex(0x7a3e22) };

function bookshelf(t: Tex): void {
  const W = WOOD_PALS.oak.plank;
  // fundo da estante: madeira escura, mais sombreada logo abaixo da tábua de cima
  for (let y = 2; y < 14; y++) for (let x = 0; x < 16; x++) {
    const k = y === 2 ? 0.7 : y === 3 ? 0.85 : 1;
    t.px(x, y, scale(mix(hex(0x2a1b0f), hex(0x3a2615), t.vnoise(x * 4, y, 16, 2) * 0.6 + t.white(x, y, 3) * 0.4), k));
    t.h(x, y, 0.1);
    t.m(x, y, 0.15, 0, 0.7);
  }
  // tábuas de cima e de baixo
  for (let x = 0; x < 16; x++) {
    const g = (t.vnoise(x, 0, 4, 7) - 0.5) * 0.3;
    t.px(x, 0, pick(W, 0.85 + g)); t.px(x, 1, pick(W, 0.5 + g));
    t.px(x, 14, pick(W, 0.78 + g)); t.px(x, 15, pick(W, 0.32 + g));
    for (const y of [0, 1, 14, 15]) { t.h(x, y, 0.8); t.m(x, y, 0.2, 0, 0.6); }
  }
  for (const b of BOOKS) {
    const p: Palette = [scale(hex(b.c), 0.62), scale(hex(b.c), 0.8), hex(b.c), mix(hex(b.c), [255, 240, 210], 0.25)];
    for (let y = b.top; y <= 13; y++) {
      const off = b.lean ? Math.floor((13 - y) / 4) : 0;
      for (let k = 0; k < b.w; k++) {
        const x = b.x + off + k;
        let c = b.w === 1 ? p[1] : k === 0 ? p[2] : p[1];
        if (y === b.top) c = p[3];
        else if (b.band && (y === b.top + 1 || y === 12)) c = k === 0 ? hex(0xd4ac50) : hex(0xa47e34);
        t.px(x, y, y === 2 ? scale(c, 0.75) : c);
        t.h(x, y, 0.55 + (k === 0 ? 0.1 : 0));
        t.m(x, y, b.band && (y === b.top + 1 || y === 12) ? 0.5 : 0.12, b.band && (y === b.top + 1 || y === 12) ? 0.6 : 0, 0.6);
      }
    }
  }
  VASE.forEach((row, j) => [...row].forEach((ch, i) => {
    const c = VASE_COL[ch];
    if (!c) return;
    t.px(5 + i, 7 + j, c); t.h(5 + i, 7 + j, 0.6); t.m(5 + i, 7 + j, ch === 'R' ? 0.45 : 0.25, 0, 0.4);
  }));
}

// ------------------------------------------------------------------ vidros e grade
const IRON: Palette = pal(0x33363c, 0x4a4e55, 0x62666e, 0x7c8189, 0x989ea6, 0xbfc4ca);

function ironBars(t: Tex): void {
  t.transparent();
  const put = (x: number, y: number, v: number, h = 0.7) => {
    t.px(x, y, pick(IRON, v + (t.white(x, y, 5) - 0.5) * 0.06)); t.h(x, y, h); t.m(x, y, 0.7, 1, 0.1);
  };
  // travessas finas (atrás das barras)
  for (const y of [3, 12]) for (let x = 0; x < 16; x++) put(x, y, 0.45, 0.55);
  // barras verticais roliças: principais (2 px) no centro e na emenda entre blocos; finas (1 px) entre elas
  for (let y = 0; y < 16; y++) {
    put(7, y, 0.86); put(8, y, 0.4);
    put(15, y, 0.86); put(0, y, 0.4);
    put(4, y, 0.64); put(11, y, 0.64);
  }
  // abraçadeiras onde as barras principais cruzam as travessas
  for (const [x, y] of [[7, 3], [15, 3], [7, 12], [15, 12]]) {
    put(x, y - 1, 0.97, 0.85); put(x + 1, y - 1, 0.7, 0.85); put(x, y, 0.7, 0.85); put(x + 1, y, 0.22, 0.8);
  }
}

function tintedGlass(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x === 0 || y === 0 || x === 15 || y === 15) {
      t.px(x, y, hex(x === 0 || y === 0 ? 0x6c5c80 : 0x3e344c), 240); t.m(x, y, 0.9, 0, 0);
      continue;
    }
    const v = t.fbm(x, y, 6);
    t.px(x, y, mix(hex(0x1e1826), hex(0x3a2e4a), v), 190 + Math.round(v * 30));
    t.m(x, y, 0.96, 0, 0);
  }
  for (const [x0, y0, len] of [[3, 3, 3], [4, 3, 2], [10, 9, 4], [11, 9, 2]]) for (let i = 0; i < len; i++) t.px(x0 + i, y0 + i, hex(0x8e7ca6), 215);
}

// ------------------------------------------------------------------ feno, esponjas, caminho e ossos
const STRAW: Palette = pal(0x7a5816, 0x96711e, 0xb08a2a, 0xc7a23a, 0xdabb50, 0xebd272);
const TWINE: Palette = pal(0x5a1812, 0x7a2218, 0x9a2e20, 0xb8402a);

/** Palha em fios verticais de comprimentos variados (a ponta de cima clareia, a de baixo escurece). */
function straw(t: Tex): void {
  for (let x = 0; x < 16; x++) {
    let y = t.rng.nextInt(16), done = 0;
    while (done < 16) {
      const len = 3 + t.rng.nextInt(6), tone = 0.35 + t.rng.next() * 0.45;
      for (let k = 0; k < len && done < 16; k++, done++) {
        const v = tone + (k === 0 ? 0.14 : 0) - (k === len - 1 ? 0.22 : 0);
        t.px(x, y + k, pick(STRAW, v)); t.h(x, y + k, 0.4 + v * 0.35);
      }
      y += len;
    }
  }
  t.material(0.1, 0, 0.8);
}

const SPONGE: Palette = pal(0x8a7418, 0xa68c22, 0xc0a52e, 0xd4bb3e, 0xe4cf56, 0xf2e27e);
const WET: Palette = pal(0x4e4a16, 0x625c1c, 0x777022, 0x8a822a, 0x9c9434, 0xb0a844);
/** Esponja: massa porosa com furos de vários tamanhos; molhada fica escura, lisa e com gotas. */
function sponge(t: Tex, p: Palette, wet: boolean): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 0.5 + (t.fbm(x, y, 2) - 0.5) * 0.55 + (t.white(x, y, 3) - 0.5) * 0.2;
    t.px(x, y, pick(p, v)); t.h(x, y, 0.45 + v * 0.3);
  }
  t.material(wet ? 0.55 : 0.06, 0, wet ? 0.2 : 0.9);
  pits(t, 24, wet ? hex(0x2a3628) : scale(p[0], 0.7), p[wet ? 3 : 5], 0.6, 1.7);
  if (wet) for (let i = 0; i < 5; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    if (t.hGet(x, y) > 0.35) { t.px(x, y, hex(0xc4d4a8)); t.m(x, y, 0.95, 0, 0); t.h(x, y, 0.75); }
  }
}

const PATH: Palette = pal(0x735a3a, 0x846844, 0x94764e, 0xa38458, 0xb09262, 0xbda06e);
function pathTop(t: Tex): void {
  t.noisePal(PATH, { contrast: 0.8, salt: 12 });
  // pedrinhas com sombra embaixo-direita
  for (let i = 0; i < 7; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16), c = mix(hex(0x9c9484), hex(0xc4bcaa), t.rng.next());
    t.px(x + 1, y + 1, scale(PATH[0], 0.82)); t.h(x + 1, y + 1, 0.3);
    t.px(x, y, c); t.h(x, y, 0.8);
    if (t.rng.next() < 0.4) { t.px(x + 1, y, scale(c, 0.86)); t.h(x + 1, y, 0.75); }
  }
  t.material(0.12, 0, 0.7);
}

const BONE: Palette = pal(0x938a70, 0xaaa086, 0xbeb59b, 0xcfc7ae, 0xdfd8c2, 0xece6d4);
/**
 * Lateral do bloco de ossos: quatro ossos em pé, finos no meio e com as pontas (epífises) alargadas,
 * encaixados ponta com ponta em alturas desencontradas.
 */
function boneSide(t: Tex): void {
  const joints = [1, 9, 5, 13];
  for (let i = 0; i < 256; i++) { t.px(i & 15, i >> 4, scale(BONE[0], 0.68 + t.white(i & 15, i >> 4, 7) * 0.08)); t.height[i] = 0.15; }
  for (let s = 0; s < 4; s++) for (let y = 0; y < 16; y++) {
    const dj = ws(y, joints[s]), a = Math.abs(dj);
    // largura do osso nesta linha: ponta larga (4 px), ombro (4 px arredondado) e haste fina (2 px)
    const cols = a <= 1 || a === 2 ? [0, 1, 2, 3] : [1, 2];
    for (const k of cols) {
      const x = s * 4 + k;
      let v = a <= 2 ? [0.62, 0.76, 0.6, 0.4][k] : k === 1 ? 0.72 : 0.5;
      if (a === 2 && (k === 0 || k === 3)) v -= 0.18; // ombro arredondado
      if (dj === 0) v = 0.2; // encaixe entre as duas pontas
      else if (dj === -1) v -= 0.12; // fim do osso de cima, na sombra
      else if (dj === 1) v += 0.12; // começo do osso de baixo, iluminado
      v += (t.vnoise(x, y, 8, 4) - 0.5) * 0.12 + (t.white(x, y, 2) - 0.5) * 0.06;
      t.px(x, y, pick(BONE, v)); t.h(x, y, dj === 0 ? 0.35 : a <= 2 ? 0.7 : 0.6);
    }
  }
  t.material(0.3, 0, 0.3);
}

/** Topo do bloco de ossos: cortes das hastes (anel de osso com tutano) — dois grandes e oito pequenos. */
function boneTop(t: Tex): void {
  t.fill(hex(0x5c5444));
  for (let i = 0; i < 256; i++) t.height[i] = 0.2;
  const cells: [number, number, number][] = [[0, 0, 8], [8, 8, 8]];
  for (const [qx, qy] of [[8, 0], [0, 8]]) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) cells.push([qx + i * 4, qy + j * 4, 4]);
  for (const [x0, y0, s] of cells) {
    const c = s / 2, R = c - 0.2, r = s === 8 ? 1.6 : 0.8;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const ox = x + 0.5 - c, oy = y + 0.5 - c, d = Math.hypot(ox, oy);
      if (d >= R) continue;
      let v: number, h: number;
      if (d < r) { v = ox + oy > 0 ? 0.24 : 0.08; h = 0.25; } // tutano: fundo, parede de baixo-direita iluminada
      else { v = 0.62 - ((ox + oy) / R) * 0.2 + (t.white(x0 + x, y0 + y, 4) - 0.5) * 0.1; h = 0.65; if (s === 8 && d < r + 0.9) v -= 0.12; }
      t.px(x0 + x, y0 + y, pick(BONE, v)); t.h(x0 + x, y0 + y, h);
    }
  }
  t.material(0.3, 0, 0.3);
}

// ------------------------------------------------------------------ mel, gosma e blocos de luz
const HONEY: Palette = pal(0x94500a, 0xb0640e, 0xca7c16, 0xdd9422, 0xeeae36, 0xf9cc5c);
function honeyBlock(t: Tex): void {
  // favo translúcido: paredes de cera claras e mel mais escuro no meio de cada alvéolo
  const v = voronoi([[4, 2], [12, 2], [0, 10], [8, 10]]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = y * 16 + x, wall = v.d2[k] - v.d1[k] < 0.9;
    let val = wall ? 0.8 : 0.62 - v.d1[k] * 0.07 + (t.fbm(x, y, 4) - 0.5) * 0.2, a = wall ? 222 : 200;
    if (x === 0 || y === 0) { val += 0.2; a = 235; } else if (x === 15 || y === 15) { val -= 0.25; a = 235; }
    t.px(x, y, pick(HONEY, val), a);
    t.h(x, y, wall ? 0.6 : 0.45);
    t.m(x, y, 0.88, 0, 0);
  }
  for (let i = 0; i < 5; i++) { const x = 1 + t.rng.nextInt(14), y = 1 + t.rng.nextInt(14); t.px(x, y, hex(0xffe6a4), 230); }
}

const GEL: Palette = pal(0x4e9a3c, 0x62b04c, 0x78c460, 0x90d676, 0xaae68e);
const GEL_CORE: Palette = pal(0x2f6a26, 0x3c7e30, 0x4a923a, 0x5ca646, 0x72bc58);
function slimeBlock(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ring = Math.min(x, y, 15 - x, 15 - y);
    const core = x >= 4 && x <= 11 && y >= 4 && y <= 11 && !((x === 4 || x === 11) && (y === 4 || y === 11));
    const n = (t.fbm(x, y, 7) - 0.5) * 0.25;
    if (ring === 0) t.px(x, y, GEL[x === 0 || y === 0 ? 3 : 1], 205);
    else if (core) {
      const lit = x === 4 || y === 4 ? 0.3 : x === 11 || y === 11 ? -0.28 : 0;
      t.px(x, y, pick(GEL_CORE, 0.5 + lit + n), 232); t.h(x, y, 0.7);
    } else t.px(x, y, pick(GEL, (ring === 1 && (x === 1 || y === 1) ? 0.85 : 0.45) + n), ring === 1 && (x === 1 || y === 1) ? 185 : 165);
    t.m(x, y, 0.86, 0, 0.05);
  }
  for (const [x, y] of [[2, 3], [13, 6], [3, 12], [9, 13]]) t.px(x, y, GEL[4], 195);
  t.px(5, 5, GEL_CORE[4], 240);
}

const GLOW: Palette = pal(0x5e3c12, 0x8e601a, 0xbc8a24, 0xe0b034, 0xf6d256, 0xfff0a0);
/** Pedra-lume: cristais dourados facetados (metade clara, metade sombreada) presos numa matriz escura. */
function glowstone(t: Tex): void {
  const v = voronoi(gridSeeds(t.rng, 3, 0.9));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = y * 16 + x, [cx, cy] = v.seeds[v.idx[k]];
    if (v.d2[k] - v.d1[k] < 0.8) {
      t.px(x, y, mix(GLOW[0], GLOW[1], t.white(x, y, 3) * 0.5)); t.h(x, y, 0.2); t.m(x, y, 0.3, 0, 0.3, 0.35);
      continue;
    }
    const ox = ws(x + 0.5, cx), oy = ws(y + 0.5, cy);
    const lit = Math.abs(ox + oy) < 0.7 ? 0.28 : ox + oy < 0 ? 0.18 : -0.1;
    const val = 0.52 + lit + ((v.idx[k] * 37) % 7) / 7 * 0.14 + (t.white(x, y, 5) - 0.5) * 0.1;
    t.px(x, y, pick(GLOW, val)); t.h(x, y, 0.5 + Math.max(0, 1 - v.d1[k] / 5) * 0.4);
    t.m(x, y, 0.7, 0, 0.1, 0.75 + Math.min(1, val) * 0.25);
  }
  v.seeds.forEach(([cx, cy], i) => { if (i % 2 === 0) { const x = Math.floor(cx - 0.5), y = Math.floor(cy - 0.5); t.px(x, y, GLOW[5]); t.emit(x, y, 1); } });
}

const SEA_STONE: Palette = pal(0x2c4f4c, 0x3a625e, 0x4a7672, 0x5c8a84, 0x719e97);
const SEA_GLASS: Palette = pal(0x7fa6b4, 0x96bac6, 0xafcdd6, 0xc8e0e6, 0xdff0f3);
const SEA_CORE: Palette = pal(0x7fb8d2, 0x9ccfe6, 0xbde3f4, 0xdcf3fc, 0xf6fdff);
/** Lanterna do mar: caixa de vidro com cantos de pedra-marinha e um núcleo azul-branco brilhante. */
function seaLantern(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ring = Math.min(x, y, 15 - x, 15 - y);
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy);
    const edgeLit = x === 0 || y === 0 ? 0.28 : x === 15 || y === 15 ? -0.3 : 0;
    if ((x < 3 || x > 12) && (y < 3 || y > 12)) {
      const inner = (x === 2 || x === 13) || (y === 2 || y === 13);
      t.px(x, y, pick(SEA_STONE, 0.5 + edgeLit - (inner ? 0.15 : 0) + (t.white(x, y, 4) - 0.5) * 0.25));
      t.h(x, y, 0.8); t.m(x, y, 0.35, 0, 0.3, 0.1);
    } else if (ring <= 1) {
      t.px(x, y, pick(SEA_GLASS, (ring === 0 ? 0.7 : 0.45) + edgeLit)); t.h(x, y, 0.65); t.m(x, y, 0.9, 0, 0, 0.5);
    } else {
      const glow = Math.max(0, 1 - d / 6.4) + (Math.abs(dx) + Math.abs(dy) < 2.8 ? 0.35 : 0);
      t.px(x, y, pick(SEA_CORE, glow * 0.95 + (t.vnoise(x, y, 4, 2) - 0.5) * 0.15)); t.h(x, y, 0.5);
      t.m(x, y, 0.85, 0, 0, 0.55 + Math.min(1, glow) * 0.45);
    }
  }
}

// ------------------------------------------------------------------ registro
export const BUILDING_PAINTERS: Record<string, Painter> = {
  stone_bricks: (t) => { stoneBricks(t); },
  mossy_stone_bricks: (t) => mossOver(t, stoneBricks(t)),
  cracked_stone_bricks: (t) => {
    stoneBricks(t);
    const dark = scale(SB_MORTAR, 0.8), lit = SB[5];
    chip(t, [[9, 4], [8, 4], [9, 3]]);
    chip(t, [[3, 11], [4, 11], [3, 12]]);
    crack(t, 4, 0, 7, dark, lit, 1);
    crack(t, 15, 6, 5, dark, lit, -1);
    crack(t, 11, 11, 5, dark, lit, 1);
  },
  chiseled_stone_bricks: (t) => chiseled(t, rosette),
  bricks: clayBricks,
  quartz_block_side: (t) => quartz(t),
  quartz_block_top: (t) => {
    quartz(t);
    // sulco quadrado rente à borda (ladrilho emoldurado)
    for (let i = 2; i <= 13; i++) {
      t.shadePx(i, 2, 0.88); t.shadePx(2, i, 0.88); t.shadePx(i, 13, 0.93); t.shadePx(13, i, 0.93);
      t.h(i, 2, 0.4); t.h(2, i, 0.4); t.h(i, 13, 0.4); t.h(13, i, 0.4);
    }
  },
  quartz_pillar: (t) => {
    // caneluras verticais: sulco a cada 4 px com a parede da direita iluminada
    const prof = [0.26, 0.1, 0.02, -0.2, 0.12, 0.04, 0, -0.2, 0.12, 0.04, 0, -0.2, 0.12, 0.04, -0.06, -0.28];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = 0.56 + prof[x] + (t.vnoise(x, y, 8, 3) - 0.5) * 0.12 + (t.white(x, y) - 0.5) * 0.05;
      t.px(x, y, pick(QZ, v));
      t.h(x, y, prof[x] < -0.1 ? 0.4 : 0.6);
    }
    t.material(0.55, 0, 0.1);
  },
  quartz_pillar_top: (t) => {
    quartz(t, false);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy);
      if (Math.abs(d - 5.6) < 0.55) { t.shadePx(x, y, dx + dy < 0 ? 0.84 : 0.93); t.h(x, y, 0.4); }
      else if (d < 2.3) {
        t.shadePx(x, y, d > 1.3 ? (dx + dy < 0 ? 1.05 : 0.9) : 0.97);
        t.h(x, y, 0.7);
      }
    }
  },
  bookshelf,
  glass: (t) => glass(t),
  glass_pane_top: (t) => {
    // só a borda estreita do painel (colunas 7..8 — é a região que o modelo usa no topo)
    t.transparent();
    for (let y = 0; y < 16; y++) {
      const w = t.white(7, y, 3) * 12;
      t.px(7, y, [212 + w, 232 + w * 0.5, 240], 235); t.px(8, y, [176 + w, 204 + w * 0.5, 216], 235);
      t.m(7, y, 0.92, 0, 0); t.m(8, y, 0.92, 0, 0);
    }
    t.px(7, 3, [250, 255, 255], 245); t.px(7, 11, [250, 255, 255], 245);
  },
  iron_bars: ironBars,
  tinted_glass: tintedGlass,
  hay_block_side: (t) => {
    straw(t);
    // duas amarras vermelhas de corda torcida em volta do fardo
    for (const by of [2, 12]) for (let x = 0; x < 16; x++) {
      for (let r = 0; r < 2; r++) {
        const twist = (x + r) % 3 === 0;
        t.px(x, by + r, TWINE[(r === 0 ? 3 : 2) - (twist ? 2 : 0)]); t.h(x, by + r, 0.85 - r * 0.1); t.m(x, by + r, 0.1, 0, 0.7);
      }
      t.shadePx(x, by + 2, 0.76);
    }
  },
  hay_block_top: (t) => {
    // pontas cortadas da palha: miúdas, em várias direções, com buracos escuros entre elas
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = 0.45 + (t.fbm(x, y, 3) - 0.5) * 0.5 + (t.white(x, y, 4) - 0.5) * 0.35;
      t.px(x, y, pick(STRAW, v)); t.h(x, y, 0.4 + v * 0.3);
    }
    for (let i = 0; i < 26; i++) {
      const x = t.rng.nextInt(16), y = t.rng.nextInt(16), [dx, dy] = [[1, 0], [0, 1], [1, 1], [1, -1]][t.rng.nextInt(4)];
      t.px(x, y, STRAW[5]); t.px(x + dx, y + dy, STRAW[3]); t.h(x, y, 0.75);
    }
    for (let i = 0; i < 12; i++) { const x = t.rng.nextInt(16), y = t.rng.nextInt(16); t.px(x, y, STRAW[0]); t.h(x, y, 0.2); }
    for (let i = 0; i < 16; i++) { t.shadePx(i, 0, 1.08); t.shadePx(0, i, 1.08); t.shadePx(i, 15, 0.84); t.shadePx(15, i, 0.84); }
    t.material(0.1, 0, 0.8);
  },
  sponge: (t) => sponge(t, SPONGE, false),
  wet_sponge: (t) => sponge(t, WET, true),
  dirt_path_top: pathTop,
  dirt_path_side: (t) => {
    // terra embaixo; em cima a camada batida (a linha 0 fica escondida: o bloco tem 15 px de altura)
    dirt(t);
    for (let x = 0; x < 16; x++) {
      const d = 3 + (t.white(x, 0, 2) < 0.35 ? 1 : 0);
      for (let y = 0; y < d; y++) {
        t.px(x, y, pick(PATH, (y === 1 ? 0.85 : 0.5) + (t.white(x, y, 6) - 0.5) * 0.4)); t.h(x, y, 0.6); t.m(x, y, 0.12, 0, 0.7);
      }
      t.shadePx(x, d, 0.8);
    }
  },
  bone_block_side: boneSide,
  bone_block_top: boneTop,
  honey_block: honeyBlock,
  slime_block: slimeBlock,
  glowstone,
  sea_lantern: seaLantern,
};
