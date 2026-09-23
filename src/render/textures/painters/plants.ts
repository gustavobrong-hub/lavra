/**
 * Pintores de plantas: gramas, flores, cogumelos, plantas altas, aquáticas e blocos vegetais.
 * Sprites 16×16 desenhados à mão em mapas ASCII ('.' = transparente) e alguns traços procedurais
 * (lâminas de capim e frondes). Plantas tingidas pelo bioma usam só tons de cinza (a cor vem do shader).
 * Luz de cima-esquerda: realce em cima/esquerda, sombra embaixo/direita.
 */
import { Tex, type Painter, type RGB, gray, hex, mix, pal, scale } from '../tex';

// ------------------------------------------------------------------ utilitários (usados também por crops/woodparts)
/** Tinta de um caractere do mapa: cor, altura (relevo), suavidade, emissão, porosidade e metal. */
export interface Ink { c: RGB; h?: number; s?: number; e?: number; p?: number; mt?: number }
export type Legend = Record<string, RGB | Ink>;
export interface SpriteOpts { ox?: number; oy?: number; jit?: number; h?: number; s?: number; p?: number; wrap?: boolean }

const isRGB = (v: RGB | Ink): v is RGB => Array.isArray(v);
const lum = (c: RGB): number => (c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15) / 255;

/** Mistura cor com emissão (atalho para legendas). */
export const glow = (c: number, e: number, s = 0.45): Ink => ({ c: hex(c), e, s, p: 0.2 });

/**
 * Desenha um sprite ASCII: cada caractere indexa a legenda; '.' e ' ' não pintam (o fundo já é transparente).
 * Preenche cor (com variação sutil `jit`), altura (derivada do brilho, se não informada) e material.
 */
export function sprite(t: Tex, rows: string[], lg: Legend, o: SpriteOpts = {}): void {
  const ox = o.ox ?? 0, oy = o.oy ?? 0, jit = o.jit ?? 0.03;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const v = lg[ch];
      if (!v) continue;
      const ink: Ink = isRGB(v) ? { c: v } : v;
      const X = x + ox, Y = y + oy;
      if (!o.wrap && (X < 0 || X > 15 || Y < 0 || Y > 15)) continue;
      t.px(X, Y, scale(ink.c, 1 + (t.white(X, Y, 77) - 0.5) * 2 * jit));
      t.h(X, Y, ink.h ?? o.h ?? 0.42 + lum(ink.c) * 0.4);
      t.m(X, Y, ink.s ?? o.s ?? 0.28, ink.mt ?? 0, ink.p ?? o.p ?? 0.4, ink.e ?? 0);
    }
  }
}

/** Pinta um pixel de planta em coordenadas "globais" (plantas de 2 blocos: y 0..31, `off` = 0 topo / 16 base). */
function put(t: Tex, x: number, y: number, c: RGB, off = 0, h = 0.6): void {
  const yy = y - off;
  if (x < 0 || x > 15 || yy < 0 || yy > 15) return;
  t.px(x, yy, c);
  t.h(x, yy, h);
  t.m(x, yy, 0.3, 0, 0.35, 0);
}

/** Caminho de "tartaruga": parte de (x,y) com ângulo `a` (0 = para cima, + = direita) e curvatura `k` (+ `k2`·s) por px. */
function path(x: number, y: number, a: number, k: number, len: number, k2 = 0): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const step = 0.35;
  for (let s = 0; s <= len; s += step) {
    out.push([Math.round(x), Math.round(y), s / len, a]);
    x += Math.sin(a) * step; y -= Math.cos(a) * step; a += (k + k2 * s) * step;
  }
  return out;
}

/** Lâmina de capim: metade de baixo com 2 px (lado direito na sombra), ponta fina e clara. */
export interface Blade { x: number; a: number; k: number; len: number; k2?: number; tone?: number; wide?: number }

export function blades(t: Tex, list: Blade[], shades: RGB[], base = 15, off = 0): void {
  const n = shades.length;
  for (const b of list) {
    for (const [x, y, f] of path(b.x + 0.5, base + 0.4, b.a, b.k, b.len, b.k2 ?? 0)) {
      const i = Math.max(0, Math.min(n - 1, Math.floor((0.3 + f * 0.72 + (b.tone ?? 0)) * n)));
      put(t, x, y, shades[i], off, 0.45 + f * 0.3);
      if (f < (b.wide ?? 0.5)) put(t, x + 1, y, shades[Math.max(0, i - 2)], off, 0.4);
    }
  }
}

/** Fronde de samambaia: folíolos alternados inclinados para a ponta; a ráquis é desenhada por cima. */
export function frond(t: Tex, x0: number, y0: number, a: number, k: number, len: number, leaf: number, shades: RGB[], off = 0, gap = 2.4): void {
  const n = shades.length;
  const pts = path(x0 + 0.5, y0 + 0.4, a, k, len);
  let next = len * 0.12, side = 1;
  for (const [x, y, f, ang] of pts) {
    if (f * len < next) continue;
    next += gap / 2; side = -side;
    const L = Math.max(1, Math.round(leaf * Math.min(1, (1 - f) * 1.5)));
    const dx0 = Math.sin(ang), dy0 = -Math.cos(ang);
    const nx = Math.cos(ang) * side, ny = Math.sin(ang) * side;
    const dx = (nx + dx0 * 0.8) / 1.28, dy = (ny + dy0 * 0.8) / 1.28;
    const lit = dy < -0.3 || dx < -0.3;
    for (let j = 1; j <= L; j++) {
      const i = Math.min(n - 1, (lit ? 4 : 3) + (j === L ? 1 : 0) + Math.floor(f * 2));
      put(t, Math.round(x + dx * j), Math.round(y + dy * j), shades[i], off, 0.6 + j * 0.03);
    }
  }
  for (const [x, y, f] of pts) put(t, x, y, shades[Math.min(n - 1, 2 + Math.floor(f * 2.5))], off, 0.55);
}

/**
 * Folhagem densa dentro de uma máscara ASCII (`ch`, padrão '#'): tufos com realce em cima-esquerda,
 * bordas de baixo/direita na sombra e alguns furinhos. `gy0` = linha da máscara que vira a linha 0 da textura
 * (plantas de 2 blocos usam máscaras de 32 linhas: 0 no topo, 16 na base).
 */
export function foliage(t: Tex, mask: string[], p: RGB[], o: { gy0?: number; salt?: number; holes?: number; ch?: string; s?: number } = {}): void {
  const ch = o.ch ?? '#', salt = o.salt ?? 5, gy0 = o.gy0 ?? 0, holes = o.holes ?? 0.06, n = p.length;
  const on = (x: number, y: number): boolean => y >= 0 && y < mask.length && x >= 0 && x < 16 && mask[y][x] === ch;
  for (let y = gy0; y < gy0 + 16; y++) for (let x = 0; x < 16; x++) {
    if (!on(x, y)) continue;
    const inner = on(x, y - 1) && on(x, y + 1) && on(x - 1, y) && on(x + 1, y);
    if (inner && t.white(x, y, salt + 2) < holes) continue;
    let v = 0.47;
    if (!on(x, y - 1)) v += 0.24;
    if (!on(x - 1, y)) v += 0.1;
    if (!on(x, y + 1)) v -= 0.2;
    if (!on(x + 1, y)) v -= 0.1;
    const s2 = salt + (y >= 16 ? 11 : 0);
    v += (t.vnoise(x, y, 8, s2) - t.vnoise(x + 1, y + 1, 8, s2)) * 1.2 + (t.white(x, y, salt + 1) - 0.5) * 0.16;
    const i = Math.max(0, Math.min(n - 1, Math.floor(v * n)));
    t.px(x, y - gy0, p[i]);
    t.h(x, y - gy0, 0.35 + v * 0.45);
    t.m(x, y - gy0, o.s ?? 0.32, 0, 0.35, 0);
  }
}

/** Desenha só a metade (`gy0` = 0 topo / 16 base) de um mapa ASCII de 32 linhas. */
export function sprite2(t: Tex, rows: string[], lg: Legend, gy0: number, o: SpriteOpts = {}): void {
  sprite(t, rows.slice(gy0, gy0 + 16), lg, o);
}

// ------------------------------------------------------------------ paletas
/** Cinzas para as plantas tingidas pelo bioma (escuro → claro). */
const GR: RGB[] = [0x4c, 0x5e, 0x72, 0x86, 0x9a, 0xae, 0xc2, 0xd6].map(gray);
/** Verdes de caule/folha das plantas sem tingimento. */
const GRN = { a: hex(0x1c3a19), b: hex(0x285222), c: hex(0x356a2b), d: hex(0x448235), e: hex(0x589a40), f: hex(0x72b250), g: hex(0x93c86a) };
const G: Legend = { a: GRN.a, b: GRN.b, c: GRN.c, d: GRN.d, e: GRN.e, f: GRN.f, g: GRN.g };
/** Legenda de cinzas '1'..'8' para sprites tingidos. */
const GL: Legend = Object.fromEntries(GR.map((c, i) => [String(i + 1), c]));

// ------------------------------------------------------------------ gramas e samambaias (tingidas → cinza)
const SHORT_GRASS: Blade[] = [
  { x: 9, a: -0.1, k: -0.01, len: 6, tone: -0.12 }, { x: 5, a: 0.1, k: 0.02, len: 5, tone: -0.12 },
  { x: 2, a: -0.5, k: -0.07, len: 7 }, { x: 4, a: -0.2, k: -0.04, len: 10 }, { x: 12, a: 0.45, k: 0.07, len: 7 },
  { x: 6, a: 0.05, k: -0.02, len: 12 }, { x: 9, a: 0.2, k: 0.03, len: 11 }, { x: 7, a: -0.1, k: 0.05, len: 9, tone: 0.05 },
];

const FERN = [
  '................',
  '.......8........',
  '.......6........',
  '......756.......',
  '.....7.5.6......',
  '......655.......',
  '.....7.5.6......',
  '......655.......',
  '77...7.4.6....67',
  '66.7..645...6.55',
  '..56.6.4.5..55..',
  '.554.6545.5.444.',
  '....45.3..54....',
  '...443.3..333...',
  '......33.3......',
  '......222.......',
];

const TALL_GRASS: Blade[] = [
  { x: 4, a: -0.3, k: -0.02, len: 9, tone: -0.12 },
  { x: 11, a: 0.35, k: 0.03, len: 8, tone: -0.12 },
  { x: 9, a: -0.15, k: -0.012, len: 24, tone: -0.06 },
  { x: 6, a: 0.15, k: 0.018, len: 20, tone: -0.06 },
  { x: 5, a: -0.12, k: -0.02, len: 16 },
  { x: 10, a: 0.1, k: 0.016, len: 16 },
  { x: 9, a: 0.05, k: -0.004, len: 22 },
  { x: 6, a: -0.05, k: -0.006, len: 28, k2: -0.0012 },
  { x: 8, a: 0.02, k: 0.007, len: 27, k2: 0.0012 },
  { x: 7, a: -0.02, k: 0.002, len: 30, tone: 0.04 },
];

function largeFern(t: Tex, off: number): void {
  frond(t, 7, 31, -0.75, -0.035, 11, 2, GR, off);
  frond(t, 8, 31, 0.75, 0.035, 11, 2, GR, off);
  frond(t, 7, 31, -0.2, -0.012, 22, 3, GR, off);
  frond(t, 8, 31, 0.2, 0.012, 21, 3, GR, off);
  frond(t, 7, 31, -0.02, 0.003, 29, 3, GR, off);
}

// ------------------------------------------------------------------ flores
const POPPY: Legend = { ...G, r: hex(0x7a1116), s: hex(0xa81c1c), t: hex(0xd0301f), u: hex(0xe8512f), v: hex(0xf7825a), k: hex(0x24121c), q: hex(0x55653a), m: hex(0x3b2030) };
const POPPY_MAP = [
  '................',
  '................',
  '.....vu.ut......',
  '....vuuttts.....',
  '...vuukkktss....',
  '...uutkqktsr....',
  '....ttkkkssr....',
  '.....ssssrr.....',
  '.......dc.......',
  '.......dc.......',
  '........c.......',
  '...fe...dc..ed..',
  '....ed..dc.eb...',
  '.....edcd.cb....',
  '.......dcb......',
  '.......dc.......',
];

const BUTTERCUP: Legend = { ...G, '1': hex(0x9a6a08), '2': hex(0xd09a10), '3': hex(0xf2c424), '4': hex(0xffe05a), '5': { c: hex(0xfff8c8), s: 0.75 }, o: hex(0xd07a10) };
const BUTTERCUP_MAP = [
  '................',
  '................',
  '................',
  '....4.43........',
  '...45443........',
  '...34o32..4.3...',
  '....322..45432..',
  '.....d...33o2...',
  '.....d....322...',
  '..4.3.d...d.....',
  '..45o2d..d......',
  '...32.dcd.......',
  '....d.dc........',
  '.gf.e.dce.gf....',
  '..fedcdcdef.....',
  '....cbcbcc......',
];

const DAISY: Legend = { ...G, W: hex(0xffffff), w: hex(0xe4e6dc), v: hex(0xbcc0b0), u: hex(0x9a9e8e), Y: hex(0xffe04a), y: hex(0xf0b020), o: hex(0xb87414) };
const DAISY_MAP = [
  '................',
  '................',
  '.......W........',
  '....W..W..w.....',
  '.....WWWww......',
  '...WWWYYowwv....',
  '....wwyoowv.....',
  '.....wvvvv......',
  '....v..v..u.....',
  '.......dc.......',
  '.......dc.......',
  '..fe...dc..ef...',
  '...fed.dc.edc...',
  '....edcdcdcd....',
  '.....cdcdcb.....',
  '......dcdc......',
];

const CORNFLOWER: Legend = { ...G, n: hex(0x1f3480), o: hex(0x2c4fb8), p: hex(0x4574e0), q: hex(0x74a0f5), r: hex(0xa9c6ff), m: hex(0x4a2a7a), l: hex(0x6a3aa0) };
const CORNFLOWER_MAP = [
  '................',
  '................',
  '.....q.q.p......',
  '...q.qpqpp.o....',
  '...rqpmlmpo.....',
  '..qqpmlmlpoo....',
  '...qpmmmpon.....',
  '...p.popon.n....',
  '.....n.dn.......',
  '.......d........',
  '.......dc.......',
  '.......dc.......',
  '....e..dc..e....',
  '.....e.dc.e.....',
  '......edcd......',
  '.......dc.......',
];

const CLOVER: Legend = { ...G, p: hex(0x5a2463), q: hex(0x7e3589), r: hex(0xa04aa8), s: hex(0xc070c4), t: hex(0xdc9ee0), x: hex(0xa8d890) };
const CLOVER_MAP = [
  '................',
  '................',
  '.....ts.........',
  '....tsrsr.......',
  '....srsrq.......',
  '....rsrqq..ts...',
  '.....qqqp.tsrs..',
  '......pd..srqq..',
  '.......d..qqqp..',
  '.......d...pd...',
  '..ef...dc..d....',
  '.efxe..dc.d.fe..',
  '..edc.dc.dc.exfe',
  '...cedcddc..edc.',
  '.....dcdc.......',
  '......dcd.......',
];

const FORGET: Legend = { ...G, m: hex(0x5f9be6), n: hex(0x8fc3f7), o: hex(0xc4e2ff), y: hex(0xffd84a), k: hex(0xe08ab8) };
const FORGET_MAP = [
  '................',
  '................',
  '....o......k....',
  '...oym..n.k.....',
  '....m..nym..o...',
  '..n...d.md.oym..',
  '.nym..d..d..m...',
  '..md.o.d.d..d...',
  '....oym.dd.d....',
  '.....mdd.dd.....',
  '......d.dd......',
  '...e..dcd..e....',
  '..fed.dcd.edf...',
  '...edcdcdcde....',
  '.....cdcdc......',
  '......dcd.......',
];

const TULIP_MAP = [
  '................',
  '................',
  '................',
  '.....5.44.3.....',
  '.....544433.....',
  '.....544332.....',
  '.....443332.....',
  '.....433322.....',
  '......3222......',
  '.......dc.......',
  '...f...dc...e...',
  '...fe..dc..ed...',
  '....fe.dc.edc...',
  '....ede.dcdc....',
  '.....edcdcc.....',
  '.......dc.......',
];
const tulip = (...c: number[]): Legend => ({ ...G, 2: hex(c[0]), 3: hex(c[1]), 4: hex(c[2]), 5: hex(c[3]) });

const LILY_VALLEY: Legend = { ...G, W: hex(0xfbfff4), w: hex(0xdfe8d6), v: hex(0xb7c4ac), u: hex(0x8e9c86) };
const LILY_VALLEY_MAP = [
  '................',
  '................',
  '................',
  '.........ddd....',
  '........d.W.d...',
  '........dWWv.d..',
  '.......ddw.u.W..',
  '......W.d...WWv.',
  '.....WWvd...w.u.',
  '.....w.ud.......',
  '...g....d.......',
  '...fe...d...f...',
  '..gfed..dc.fe...',
  '...fedc.dcedd...',
  '....edccdcdc....',
  '......cddc......',
];

const ORCHID: Legend = { ...G, 2: hex(0x2270a8), 3: hex(0x3a98d0), 4: hex(0x6cc0ec), 5: { c: hex(0xb4e6ff), s: 0.5 }, k: hex(0x14406e), l: hex(0x4a4cc0) };
const ORCHID_MAP = [
  '................',
  '................',
  '......5.........',
  '....44543.......',
  '.....3k3........',
  '....3.l.2..5....',
  '......c..44543..',
  '.......c..3k3...',
  '.......c.3.l.2..',
  '........c.c.....',
  '........dc......',
  '........d.......',
  '..gf....d...fg..',
  '...eed.d..eed...',
  '....ddcdcdc.....',
  '......bdc.......',
];

/** Flor-lume: sino pendente que brilha por dentro (a boca é a parte mais clara). */
const LUME_BLOOM: Legend = {
  s: hex(0x1d4f55), t: hex(0x16393e), u: hex(0x236b66), v: hex(0x3a9488),
  1: glow(0x0f6f88, 0.35), 2: glow(0x1aa2c0, 0.6), 3: glow(0x46d8ee, 0.85), 4: glow(0x9ef4ff, 1), W: glow(0xeaffff, 1),
};
const LUME_BLOOM_MAP = [
  '................',
  '......sss.......',
  '.....s...s......',
  '....11...s......',
  '...1221..s......',
  '..123221.s......',
  '..233321.s..ss..',
  '..234332.s.s..s.',
  '.34WW4432s.s..1.',
  '.4.4..4.3ss..232',
  '....W4...s..3W43',
  '....3....s...4..',
  '..3v.....s..v3..',
  '...uvu...suvu...',
  '.....tut.stu....',
  '........tst.....',
];

// ------------------------------------------------------------------ cogumelos
const STEM_INK = { w: hex(0xece2cc), v: hex(0xcdbf9f), u: hex(0xa4957a) };
const BROWN_MUSH: Legend = { ...STEM_INK, e: hex(0xb48c5e), d: hex(0x98724a), c: hex(0x7e5a38), b: hex(0x624428), a: hex(0x44301c) };
const BROWN_MUSH_MAP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....eedd.......',
  '....eedddc......',
  '...edddcccb.....',
  '...dccccbbb.....',
  '....aaaaaa.ed...',
  '......wv..edcb..',
  '......wv..aaaa..',
  '......wv...wv...',
  '......wv...wv...',
  '.....vwvu.vwvu..',
];
const RED_MUSH: Legend = {
  ...STEM_INK, r: hex(0x7a1414), s: hex(0xa81c1c), t: hex(0xcc2a22), u: hex(0xe84a3a),
  W: { c: hex(0xf4f0e6), h: 0.85 }, V: hex(0xcfc6b4), a: hex(0xb89a88), k: STEM_INK.u,
};
const RED_MUSH_MAP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......uut.......',
  '.....uWWtt......',
  '....utVttWs.....',
  '...uWtttsVsr....',
  '...tVtsWWssr....',
  '...rssssrrrr....',
  '....aaaaaaa.....',
  '......wwv.......',
  '......wwv.......',
  '......wwv.......',
  '.....vwwvk......',
];
/** Cogumelo-lume: três chapéus cônicos com lamelas que brilham. */
const LUME_MUSH: Legend = {
  1: glow(0x173f8a, 0.4), 2: glow(0x2a6ad0, 0.7), 3: glow(0x4f9cf5, 0.95), 4: glow(0xa8d8ff, 1), g: glow(0x7fd0ff, 0.9),
  x: glow(0x86b0d4, 0.35, 0.3), y: glow(0x56789c, 0.2, 0.3),
};
const LUME_MUSH_MAP = [
  '................',
  '................',
  '................',
  '.......4........',
  '......432.......',
  '.....43321......',
  '.....2ggg1......',
  '.......x...4....',
  '.......x..432...',
  '.......x.33221..',
  '...4...x..ggg...',
  '..331..x...x....',
  '...g...x...x....',
  '...x...xy..x....',
  '...x...xy..xy...',
  '..yxy.yxyyyxy...',
];

const DEAD_BUSH: Legend = { a: hex(0x3e2a18), b: hex(0x5e4228), c: hex(0x7c5a36), d: hex(0x9a7446), e: hex(0xb8905c) };
const DEAD_BUSH_MAP = [
  '................',
  '................',
  '................',
  '........e.......',
  '........e..e....',
  '....e...d.e.....',
  '.e..e.ed..d.....',
  '.d..d.dd.d....e.',
  '..d..d..d....d..',
  '...d.d..d...d...',
  '....cc..c..c....',
  '.ed..c.c..c..de.',
  '...dc.ccbb.cd...',
  '.....cccbbc.....',
  '.......cb.......',
  '......bbaa......',
];

// ------------------------------------------------------------------ plantas altas (mapas de 32 linhas: 0..15 topo, 16..31 base)
const SUNFLOWER: Legend = {
  ...G, 1: hex(0x9a5e08), 2: hex(0xd08a10), 3: hex(0xf0b820), 4: hex(0xffd83a), 5: { c: hex(0xffee88), s: 0.4 },
  k: { c: hex(0x2e1c0c), h: 0.7, p: 0.8 }, m: { c: hex(0x4e3216), h: 0.62, p: 0.8 }, n: hex(0x6e4a1e), o: hex(0x8a6428),
};
const SUNFLOWER_MAP = [
  '.....4.5.4......',
  '...5.4454443.3..',
  '....54onnn433...',
  '..544onmkmn433..',
  '.5554nmkmkm3332.',
  '..44nkmkmkm332..',
  '.444nmkmkmk3322.',
  '..43mmmkmkm322..',
  '..333mmkmm3322..',
  '...3.33333.2.2..',
  '....3.2dc..2....',
  '.......dc.......',
  '.......dc.ef....',
  '.......dcdeff...',
  '.......dc.dde...',
  '.......dc.......',
  '.......dc.......',
  '..gf...dc.......',
  '.gffe..dc.......',
  '.feeed.dc.......',
  '..eeddddc.......',
  '...cdd.dc.......',
  '.......dc..fg...',
  '.......dcdeffg..',
  '.......dcdeeef..',
  '.......dc.ddee..',
  '.......dc..cd...',
  '..gf...dc.......',
  '.ffee..dc.......',
  '..eedddcc.......',
  '......ddc.......',
  '......ddcc......',
];

const LILAC: Legend = { ...G, 1: hex(0x5a3a78), 2: hex(0x7a52a0), 3: hex(0x9a72c0), 4: hex(0xbb98dc), 5: hex(0xdcc4f2), w: hex(0x5c5a34), v: hex(0x44422a) };
const LILAC_MAP = [
  '......5.........',
  '.....544........',
  '.....4534.......',
  '....54343...5...',
  '....45432..544..',
  '.5..543432.4533.',
  '.44.454322.4342.',
  '543.434321.5432.',
  '432.33231.43321.',
  '.21..212...221..',
  '..w...w.....w...',
  '...w..w....w....',
  '.fe.w.w...w.....',
  '.eed.w.w.w..fg..',
  '..dc..www..eef..',
  '.......wv...d...',
  '.......wv.......',
  '...gf..wv..fg...',
  '..gfee.wv.eeff..',
  '..feedcwvcdeef..',
  '...edd.wv.dde...',
  '....c..wv..c....',
  '.gf....wv....fg.',
  'gfee...wv...eeff',
  'feedc..wv..cdeef',
  '.eddw..wv..wdde.',
  '.....w.wv.w.....',
  '......wwvv......',
  '.......wv.......',
  '.......wv.......',
  '......wwvv......',
  '.....wwvvvw.....',
];

const ROSE_LEAF: RGB[] = [0x173a17, 0x1f4c1d, 0x2a6026, 0x377430, 0x46883a, 0x5a9e48].map(hex);
const ROSE_MASK = [
  '................', '................', '.......##.......', '....#######.#...',
  '...##########...', '..############..', '.#############..', '.##############.',
  '.##############.', '###############.', '.###############', '.##############.',
  '###############.', '.###############', '.##############.', '################',
  '.##############.', '###############.', '.##############.', '.#############..',
  '..############..', '..###########...', '...#########....', '....#######.....',
  '.....#####......', '................', '................', '................',
  '................', '................', '................', '................',
];
const ROSE: Legend = { r: hex(0x7c0c1a), s: hex(0xb0182a), t: hex(0xdc2c3c), u: { c: hex(0xff7a78), s: 0.4 }, w: hex(0x4a3a1c), v: hex(0x33280f) };
const ROSE_BLOOM = ['ut.', 'tsr', '.rr'];
const ROSE_STEMS = ['......w.w.......', '.....w..w.......', '......w.w.......', '......w..w......', '.......ww.......', '.......w........', '......ww........', '.....wwvw.......'];

function roseBush(t: Tex, gy0: number): void {
  foliage(t, ROSE_MASK, ROSE_LEAF, { gy0, salt: 9, holes: 0.07 });
  sprite(t, ROSE_STEMS, ROSE, { oy: 24 - gy0 });
  for (const [x, y] of [[3, 4], [9, 3], [7, 8], [11, 9], [2, 11], [9, 13], [4, 17], [11, 17], [7, 20]]) sprite(t, ROSE_BLOOM, ROSE, { ox: x, oy: y - gy0 });
}

const PEONY_LEAF: RGB[] = [0x24481c, 0x2f5c24, 0x3b722b, 0x4c8834, 0x62a03f, 0x80b858].map(hex);
const PEONY_MASK = [
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '..#.........#...', '.###..#...###...', '.####.##.####.#.', '..#####.#####.##',
  '.##############.', '################', '.##############.', '################',
  '.##############.', '###############.', '.##############.', '..############..',
  '.#############..', '..###########...', '...#########....', '....#######.....',
  '.....#####......', '................', '................', '................',
  '................', '................', '................', '................',
];
const PEONY: Legend = { ...G, 1: hex(0x8a2a5a), 2: hex(0xb84a80), 3: hex(0xd870a2), 4: hex(0xf09cc0), 5: { c: hex(0xffd0e4), s: 0.35 }, w: hex(0x3d6a26) };
const PEONY_BLOOM = ['.5445.', '453354', '435534', '324423', '.2332.'];
const PEONY_SMALL = ['.54.', '4534', '3443', '.22.'];
const PEONY_STEMS = [
  '................', '.............43.', '.............32.', '..............w.',
  '..............w.', '..............w.', '..............w.', '...w.......w..w.',
  '...w.......w..w.', '....w.....w...w.',
];
const PEONY_BASE = ['......w.w.......', '.....w..w.......', '......w..w......', '......ww.w......', '.......ww.......', '......www.......', '.....wwww.......'];

function peony(t: Tex, gy0: number): void {
  sprite(t, PEONY_STEMS, PEONY, { oy: -gy0 });
  foliage(t, PEONY_MASK, PEONY_LEAF, { gy0, salt: 4, holes: 0.08 });
  sprite(t, PEONY_BASE, PEONY, { oy: 25 - gy0 });
  sprite(t, PEONY_BLOOM, PEONY, { ox: 1, oy: 3 - gy0 });
  sprite(t, PEONY_BLOOM, PEONY, { ox: 8, oy: 5 - gy0 });
  sprite(t, PEONY_SMALL, PEONY, { ox: 5, oy: 10 - gy0 });
  sprite(t, PEONY_SMALL, PEONY, { ox: 10, oy: 16 - gy0 });
}

// ------------------------------------------------------------------ aquáticas
const SEA: RGB[] = [0x1f5a1c, 0x2a7224, 0x378a2c, 0x46a236, 0x5cb842, 0x7cc858, 0x9ed872, 0xbfe68e].map(hex);
const SEAGRASS: Blade[] = [
  { x: 11, a: -0.1, k: -0.03, len: 6, tone: -0.1 }, { x: 5, a: 0.25, k: 0.03, len: 7, tone: -0.1 },
  { x: 4, a: -0.3, k: -0.02, len: 9 }, { x: 10, a: 0.35, k: 0.02, len: 9 }, { x: 8, a: 0.1, k: 0.02, len: 11 },
  { x: 6, a: -0.1, k: 0.012, len: 13 }, { x: 7, a: 0.02, k: -0.02, len: 14, tone: 0.04 },
];
const TALL_SEAGRASS: Blade[] = [
  { x: 4, a: -0.4, k: 0.02, len: 8, tone: -0.1 }, { x: 11, a: 0.4, k: -0.02, len: 8, tone: -0.1 },
  { x: 8, a: -0.05, k: 0.02, len: 22, tone: -0.06 }, { x: 6, a: -0.25, k: 0.02, len: 18 }, { x: 10, a: 0.3, k: -0.018, len: 17 },
  { x: 9, a: 0.12, k: -0.014, len: 26 }, { x: 5, a: -0.1, k: 0.012, len: 28 }, { x: 7, a: 0.05, k: -0.01, len: 30, tone: 0.04 },
  { x: 10, a: 0.02, k: 0.016, len: 29 }, { x: 4, a: -0.2, k: 0.018, len: 25, tone: -0.04 },
];

/** Alga (laminária): talo contínuo com lâminas e vesículas de ar; `kelp_plant` repete na vertical. */
const KELP: Legend = { a: hex(0x2e3a12), b: hex(0x3f5016), c: hex(0x56691e), d: hex(0x6f8528), e: hex(0x8a9e36), f: hex(0xa6b64a), o: { c: hex(0xc0ac4c), s: 0.55 }, p: hex(0x8e7c30) };
const KELP_PLANT_MAP = [
  '.......db....fe.', '.......db...fed.', '.......db..fed..', '.......db.eec...',
  '.fe....dbodc....', '.efe...db.......', '..dfe..db.......', '...cee.db.......',
  '....cdddb.......', '.....cddb.......', '......odb.....fe', '.......db....fed',
  '.......db...eec.', '.......db..ddc..', '.......db.cc....', '.......dbob.....',
];
const KELP_TOP_MAP = [
  '........f.......', '.......fe.......', '.......efd......', '.......ddc......',
  '.......db.......', '.fe....db.......', '.efe...db.......', '..dfe..db.......',
  '...cee.db.......', '....cdddb.......', '.....cddb.......', '......odb.......',
  '.......db...ef..', '.......db..ded..', '.......db.cc....', '.......dbo......',
];

// ------------------------------------------------------------------ cana, vinha, vitória-régia, teia (tingidas → cinza)
/** Cana-de-açúcar: três colmos com gomos em alturas diferentes (repete na vertical). */
const SUGAR_CANE = [
  '..64...64.6.64..', '..64...64..586..', '7.64...64...43..', '.686...64...64..',
  '..43...64...64..', '..64...64.7.64..', '..64...866..64..', '..64...43...64..',
  '..64...64...64.7', '..64...64...866.', '..64.6.64...43..', '..865..64...64..',
  '..43...64...64..', '..64.6.64...64..', '..64..586...64..', '..64...43...64..',
];

/** Vinha: dois ramos sinuosos (caminhos periódicos) com folhas de três lóbulos; repete nos dois sentidos. */
const VINE_PATHS = [[3, 3, 4, 4, 5, 5, 5, 4, 4, 3, 3, 2, 2, 2, 3, 3], [11, 12, 12, 12, 11, 11, 10, 10, 10, 11, 11, 12, 12, 12, 11, 11]];
const VINE_R = ['.77.', '3676', '.55.'];
const VINE_L = ['.77.', '6763', '.55.'];
const VINE_LEAVES: [boolean, number, number][] = [[true, 4, 1], [false, 1, 6], [true, 2, 11], [false, 8, 3], [true, 11, 8], [false, 8, 13], [true, 12, 0], [false, 0, 13]];
function vine(t: Tex): void {
  for (const xs of VINE_PATHS) for (let y = 0; y < 16; y++) { t.px(xs[y], y, GR[2]); t.h(xs[y], y, 0.5); t.m(xs[y], y, 0.3, 0, 0.4, 0); }
  for (const [right, x, y] of VINE_LEAVES) sprite(t, right ? VINE_R : VINE_L, GL, { ox: x, oy: y, wrap: true, s: 0.35 });
}

/** Vitória-régia: disco com borda levantada, nervuras radiais e uma fenda. */
function lilyPad(t: Tex): void {
  const sa = -0.55; // direção da fenda (para a direita, um pouco acima)
  const ux = Math.cos(sa), uy = Math.sin(sa);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
    if (d > 7.7) continue;
    const along = dx * ux + dy * uy, across = Math.abs(-dx * uy + dy * ux);
    if (along > 0.8 && across < 0.35 + along * 0.13) continue;
    const lit = (-dx - dy) / (d + 0.001) * 0.7071; // -1..1 (cima-esquerda = +)
    let v: number, h: number;
    if (d > 6.9) { v = 5.2 + lit * 1.6; h = 0.85; } // topo da borda
    else if (d > 6.1) { v = 3.4 - lit * 0.9; h = 0.6; } // parede interna da borda
    else {
      const ang = Math.atan2(dy, dx);
      const vein = Math.abs(Math.sin(ang * 5.5)) < 0.16 || Math.abs(d - 3.8) < 0.45;
      v = 4.6 + lit * 0.5 + (t.fbm(x, y, 3) - 0.5) * 1.1 - (vein ? 1.1 : 0) + (d < 1.2 ? 0.8 : 0);
      h = vein ? 0.4 : 0.5;
    }
    const i = Math.max(0, Math.min(7, Math.round(v)));
    t.px(x, y, GR[i]); t.h(x, y, h); t.m(x, y, 0.45, 0, 0.2, 0);
  }
}

/** Teia: 8 raios do centro às bordas e dois anéis de raio constante cedendo para o centro (um fio partido). */
function cobweb(t: Tex): void {
  const cx = 7.5, cy = 7.5;
  const ends: [number, number][] = [[0, 0], [8, 0], [15, 1], [15, 8], [15, 15], [7, 15], [0, 14], [0, 7]];
  const dir = ends.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy); return [dx / l, dy / l]; });
  const at = (i: number, r: number, k = 1): [number, number] => [Math.round(cx + dir[i][0] * r * k), Math.round(cy + dir[i][1] * r * k)];
  const SPOKE = hex(0xe8e8ec), RING = hex(0xcbccd3);
  ends.forEach(([x, y], i) => { const [sx, sy] = at(i, 1); const [ex, ey] = i === 5 ? at(i, 5.4) : [x, y]; t.line(sx, sy, ex, ey, SPOKE); });
  for (const [r, skip] of [[3.3, 6], [6.3, 2]] as [number, number][]) {
    for (let i = 0; i < 8; i++) {
      if (i === skip) continue;
      const [x0, y0] = at(i, r), [x1, y1] = at((i + 1) % 8, r);
      // meio do vão puxado para o centro (fio cedendo)
      const mdx = (dir[i][0] + dir[(i + 1) % 8][0]) / 2, mdy = (dir[i][1] + dir[(i + 1) % 8][1]) / 2, ml = Math.hypot(mdx, mdy);
      const mx = Math.round(cx + (mdx / ml) * r * 0.8), my = Math.round(cy + (mdy / ml) * r * 0.8);
      t.line(x0, y0, mx, my, RING); t.line(mx, my, x1, y1, RING);
    }
  }
  t.px(7, 7, hex(0xf6f6f8)); t.px(8, 8, hex(0xd6d7dc));
  for (const [x, y] of [[4, 4], [12, 7], [10, 11], [3, 10]]) if (t.alpha(x, y)) t.px(x, y, hex(0xffffff));
  for (let i = 0; i < 256; i++) if (t.rgba[i * 4 + 3]) { t.h(i & 15, i >> 4, 0.62); t.m(i & 15, i >> 4, 0.4, 0, 0.1, 0); }
}

// ------------------------------------------------------------------ cacto
const CACTUS: RGB[] = [0x1c4520, 0x245a28, 0x2e6f30, 0x3a8438, 0x4a9a44, 0x5eae52, 0x78c066].map(hex);
/** Perfil das costelas (sulcos em x2, x7, x12; cristas nas bordas x0/x15 e em x5, x10). */
const CACTUS_COL = [0.72, 0.52, 0.18, 0.5, 0.8, 0.7, 0.48, 0.16, 0.5, 0.8, 0.7, 0.46, 0.16, 0.5, 0.8, 0.74];

function cactusSide(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = CACTUS_COL[x] + (t.vnoise(x, y, 8, 2) - 0.5) * 0.18 + (t.white(x, y, 4) - 0.5) * 0.08;
    const i = Math.max(0, Math.min(6, Math.floor(v * 7)));
    t.px(x, y, CACTUS[i]);
    t.h(x, y, 0.25 + CACTUS_COL[x] * 0.6);
    t.m(x, y, 0.38, 0, 0.25, 0);
  }
  // aréolas com espinhos claros nas cristas (alternadas na vertical; repetem sem emenda)
  const spines: [number, number][] = [[0, 2], [0, 10], [15, 6], [15, 14], [5, 1], [5, 9], [10, 5], [10, 13]];
  for (const [x, y] of spines) {
    t.px(x, y, hex(0xf0e6b4)); t.h(x, y, 0.95); t.m(x, y, 0.3, 0, 0.3, 0);
    t.px(x, y + 1, hex(0x9c9a62)); t.h(x, y + 1, 0.7);
    const sx = x === 15 ? 14 : x + (x === 0 ? 1 : (y & 1 ? 1 : -1));
    t.px(sx, y - 1, hex(0xd8d09a)); t.h(sx, y - 1, 0.85);
  }
}

/** Topo/base do cacto: costelas convergindo numa estrela; borda de 1 px transparente (o corpo é recuado). */
function cactusEnd(t: Tex, top: boolean): void {
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
    const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const ridge = Math.pow(Math.abs(Math.cos(a * 4)), 1.5);
    let v = 0.3 + ridge * 0.45 + (-dx - dy) * 0.018 + (t.white(x, y, 3) - 0.5) * 0.1;
    if (x === 1 || y === 1) v += 0.08;
    if (x === 14 || y === 14) v -= 0.1;
    if (!top) v -= 0.12;
    t.px(x, y, CACTUS[Math.max(0, Math.min(6, Math.floor(v * 7)))]);
    t.h(x, y, 0.3 + ridge * 0.4 - r * 0.01);
    t.m(x, y, 0.35, 0, 0.3, 0);
  }
  if (top) {
    // florzinha rosada no centro, com aréolas claras em volta
    sprite(t, ['.p.', 'pyq', '.q.'], { p: hex(0xf28ab8), q: hex(0xc85a90), y: { c: hex(0xffe27a), h: 0.9 } }, { ox: 6, oy: 6, h: 0.8 });
    for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) { t.px(x, y, hex(0xeae0b0)); t.h(x, y, 0.8); }
  } else {
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) if (Math.hypot(x - 7.5, y - 7.5) < 1.9) { t.px(x, y, mix(hex(0x6a5a34), hex(0x8a7a48), t.white(x, y))); t.h(x, y, 0.3); }
  }
}

// ------------------------------------------------------------------ abóbora e melancia
const PUMPKIN: RGB[] = [0x6e2c06, 0x9a4608, 0xbc5c0c, 0xd87414, 0xec8c20, 0xf8a838].map(hex);
/** Gomos com larguras diferentes (sulcos em x0, x5, x10); luz vinda da esquerda. */
const PUMPKIN_COL = [0.02, 0.9, 0.78, 0.62, 0.44, 0.02, 0.88, 0.76, 0.6, 0.42, 0.02, 0.9, 0.8, 0.68, 0.55, 0.4];

function pumpkinSide(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let v = PUMPKIN_COL[x] * 0.8 + 0.12 + (t.vnoise(x * 2, y, 8, 5) - 0.5) * 0.14 + (t.white(x, y, 6) - 0.5) * 0.06;
    t.px(x, y, PUMPKIN[Math.max(0, Math.min(5, Math.floor(v * 6)))]);
    t.h(x, y, 0.3 + PUMPKIN_COL[x] * 0.45);
    t.m(x, y, 0.4, 0, 0.2, 0);
  }
}

function pumpkinTop(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const rib = Math.cos(a * 8); // 8 gomos; sulcos entre eles
    let v = 0.58 + rib * 0.12 + (-dx - dy) * 0.02 - r * 0.01 + (t.white(x, y, 2) - 0.5) * 0.08;
    const groove = rib < -0.82 && r > 2;
    if (groove) v -= 0.34 - r * 0.012;
    t.px(x, y, PUMPKIN[Math.max(0, Math.min(5, Math.floor(v * 6)))]);
    t.h(x, y, groove ? 0.3 : 0.5 + rib * 0.1);
    t.m(x, y, 0.4, 0, 0.2, 0);
  }
  // talo lenhoso
  sprite(t, ['.gf.', 'gfed', 'fedc', '.dc.'], { g: hex(0x9a8a4a), f: hex(0x7a6a34), e: hex(0x5e5226), d: hex(0x4a3f1c), c: hex(0x342c12) }, { ox: 6, oy: 6, h: 0.9, s: 0.2 });
}

/** Rosto esculpido próprio: olhos em meia-lua, narizinho e sorriso com dois dentes. */
const FACE = [
  '................', '................', '................',
  '...###....###...', '..#####..#####..', '..#####..#####..', '..#####..#####..',
  '................', '.......##.......', '................', '.#............#.',
  '.##..........##.', '..###.####.###..', '...##########...', '.....######.....',
  '................',
];

function carved(t: Tex, lit: boolean): void {
  pumpkinSide(t);
  const hole = (x: number, y: number) => x >= 0 && x < 16 && y >= 0 && y < 16 && FACE[y][x] === '#';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!hole(x, y)) {
      // borda do corte: casca levemente mais escura em volta do buraco
      if (hole(x + 1, y) || hole(x - 1, y) || hole(x, y + 1) || hole(x, y - 1)) t.shadePx(x, y, 0.86);
      continue;
    }
    const bottom = !hole(x, y + 1), right = !hole(x + 1, y), top = !hole(x, y - 1);
    let c: RGB, e = 0;
    if (lit) {
      c = top ? hex(0xffb838) : bottom ? hex(0xffe070) : right ? hex(0xffe890) : hex(0xfff8d0);
      e = top ? 0.85 : 1;
    } else {
      // parede do corte (polpa clara) só embaixo; o resto é o interior escuro
      c = bottom ? hex(0x6a3a14) : top ? hex(0x140803) : right ? hex(0x281006) : hex(0x220e05);
    }
    t.px(x, y, c); t.h(x, y, 0.1); t.m(x, y, lit ? 0.3 : 0.1, 0, 0.5, e);
  }
}

const MELON: RGB[] = [0x2a5418, 0x36681e, 0x467e26, 0x6a9c34, 0x82b242, 0x9cc654].map(hex);

function melonSide(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const wob = (t.vnoise(0, y, 4, 7) - 0.5) * 1.6 + (t.white(3, y, 2) - 0.5) * 0.8;
    const ph = ((x + wob) / 8) * Math.PI * 2;
    const stripe = Math.cos(ph) > 0.15 + (t.white(x, y, 5) - 0.5) * 0.3;
    let v = stripe ? 0.16 + (t.vnoise(x, y, 8, 3) - 0.5) * 0.22 : 0.64 + Math.sin(ph) * 0.1;
    v += (t.white(x, y, 9) - 0.5) * 0.1;
    t.px(x, y, MELON[Math.max(0, Math.min(5, Math.floor(v * 6)))]);
    t.h(x, y, stripe ? 0.45 : 0.55);
    t.m(x, y, 0.5, 0, 0.15, 0);
  }
  t.speckle(hex(0xb4d676), 0.035, 21, 0.05);
}

function melonTop(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const stripe = Math.cos(a * 6 + r * 0.35) > 0.3;
    let v = (stripe ? 0.2 : 0.64) + (-dx - dy) * 0.012 + (t.white(x, y, 5) - 0.5) * 0.12;
    if (r < 2.2) v = 0.5 + (t.white(x, y, 8) - 0.5) * 0.2;
    t.px(x, y, MELON[Math.max(0, Math.min(5, Math.floor(v * 6)))]);
    t.h(x, y, stripe ? 0.45 : 0.55);
    t.m(x, y, 0.5, 0, 0.15, 0);
  }
  sprite(t, ['.e.', 'edc', '.c.'], { e: hex(0x9a8a52), d: hex(0x6e5e32), c: hex(0x4a3e20) }, { ox: 6, oy: 6, h: 0.8 });
}

// ------------------------------------------------------------------ blocos de cogumelo
/** Pintas arredondadas que repetem sem emenda (desenhadas com coordenadas "dando a volta"). */
function spots(t: Tex, list: [number, number, number][], c: RGB, shade: RGB, hi: RGB): void {
  for (const [cx, cy, r] of list) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx + 0.25, dy + 0.25);
      if (d > r) continue;
      const x = cx + dx, y = cy + dy;
      const edge = d > r - 0.8;
      const col = edge && dx + dy > 0 ? shade : !edge && dx + dy < -1 ? hi : c;
      t.px(x, y, col); t.h(x, y, edge ? 0.62 : 0.72); t.m(x, y, 0.2, 0, 0.5, 0);
    }
  }
}

function brownMushroomBlock(t: Tex): void {
  t.noisePal(pal(0x6a4a2c, 0x7a5634, 0x8a643e, 0x9a7248, 0xa98052, 0xb88e5e), { contrast: 0.9, salt: 12 });
  t.material(0.12, 0, 0.7);
  spots(t, [[3, 3, 1.5], [11, 2, 1.2], [7, 8, 1.7], [13, 11, 1.4], [2, 12, 1.3], [9, 14, 1.1]], hex(0xbc9a6c), hex(0x9c7a50), hex(0xd4b488));
}

function redMushroomBlock(t: Tex): void {
  t.noisePal(pal(0x8a1616, 0x9e1c1a, 0xb2221e, 0xc42a22, 0xd43628), { contrast: 0.8, salt: 13 });
  t.material(0.25, 0, 0.5);
  spots(t, [[3, 4, 2.2], [12, 2, 1.8], [8, 10, 2.4], [1, 13, 1.6], [14, 12, 1.5], [7, 1, 1.1]], hex(0xeee6d8), hex(0xc4b8a4), hex(0xffffff));
}

function mushroomStem(t: Tex): void {
  const P = pal(0xb8aa8e, 0xcabda2, 0xd8ccb2, 0xe4dac4, 0xefe7d6);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    // fibras verticais: tom próprio por coluna, variação suave ao longo dela
    let v = 0.52 + (t.white(x, 0, 4) - 0.5) * 0.45 + (t.vnoise(x, y, 4, 5) - 0.5) * 0.3 + (t.white(x, y, 6) - 0.5) * 0.08;
    if (t.white(x, 1, 7) < 0.2 && t.vnoise(x, y, 2, 8) > 0.5) v -= 0.3; // estria escura
    t.px(x, y, P[Math.max(0, Math.min(4, Math.floor(v * 5)))]);
    t.h(x, y, 0.4 + v * 0.25);
  }
  t.material(0.15, 0, 0.6);
}

// ------------------------------------------------------------------ terra arada
/** Sulcos horizontais (crista clara em cima, fundo escuro); a molhada é mais escura e brilha no fundo dos sulcos. */
function farmland(t: Tex, moist: boolean): void {
  const P = moist ? pal(0x1e120a, 0x28190d, 0x332112, 0x3f2a17, 0x4c341d, 0x5b3f24) : pal(0x3e2a1a, 0x4e3522, 0x5e412a, 0x6e4e33, 0x7e5b3d, 0x916c4a);
  // dois camalhões por bloco (período 8): crista larga e arredondada, sulco estreito e escuro
  const PROF = [0.66, 0.78, 0.74, 0.62, 0.48, 0.28, 0.12, 0.34];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const wob = Math.round((t.vnoise(x, y, 4, 3) - 0.5) * 1.6);
    const row = (y + wob + 16) & 7;
    const v = PROF[row] * 0.62 + (t.fbm(x, y, 7) - 0.5) * 0.55 + (t.white(x, y, 8) - 0.5) * 0.22;
    t.px(x, y, P[Math.max(0, Math.min(5, Math.floor(v * 6)))]);
    t.h(x, y, 0.15 + PROF[row] * 0.7 + (t.white(x, y, 8) - 0.5) * 0.1);
    t.m(x, y, moist ? (row === 6 ? 0.72 : 0.44) : 0.06, 0, moist ? 0.25 : 0.9, 0);
  }
  // torrões nas cristas (claro em cima, sombra embaixo) e pedrinhas no fundo dos sulcos
  for (let i = 0; i < 12; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(2) * 8 + t.rng.nextInt(3);
    t.px(x, y, P[5]); t.h(x, y, 0.9);
    t.px(x, y + 1, P[1]);
  }
  for (let i = 0; i < 4; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(2) * 8 + 6;
    t.px(x, y, moist ? hex(0x5e5046) : hex(0x8a7d70)); t.h(x, y, 0.4);
    if (moist) t.m(x, y, 0.9, 0, 0, 0);
  }
}

// ------------------------------------------------------------------ caules de abóbora/melancia (tingidos → cinza)
/** Caule em pé: aparece de baixo para cima conforme cresce. */
const STEM_MAP = [
  '.......7........', '......76........', '.......6..7.....', '.......6.76.....',
  '..67...66.......', '...66..6........', '.....6.6........', '......66........',
  '.......65.......', '.......6.67.....', '.......6...76...', '......56........',
  '...76.5.6.......', '.....66.6.......', '.......6........', '.......65.......',
];
/** Caule preso: nasce embaixo à direita (centro do bloco) e se curva até o fruto à esquerda. */
const ATTACHED_STEM_MAP = [
  '................', '................', '................', '................',
  '................', '................', '................', '................',
  '....777..78.....', '..66...6677.....', '66.......66.....', '...........66...',
  '.............6..', '.............6..', '..............5.', '..............55',
];

// ------------------------------------------------------------------ Ínfero
const EMBER: Legend = {
  1: hex(0x4a0c10), 2: hex(0x7a141a), 3: hex(0xa82022), 4: hex(0xd0382a), 5: hex(0xf06a3a),
  g: glow(0xffb040, 0.9), r: hex(0x9a1c20), s: hex(0x6a3a2a), t: hex(0x8a5238),
};
/** Fungo-brasa: chapéu largo e irregular com brasas acesas e fiapos pendentes. */
const EMBER_FUNGUS_MAP = [
  '................',
  '................',
  '................',
  '.......54.......',
  '.....5443g3.....',
  '...54g4333432...',
  '..5443343g3322..',
  '.44333g332332.2.',
  '.2322222232221..',
  '.r.1.12st21.1.r.',
  '.r....1st....r..',
  '..r....st...r...',
  '.......st.......',
  '.......st.......',
  '......sst.......',
  '.....sstt.......',
];
const EMBER_ROOTS: RGB[] = [0x3a0a0e, 0x5a1016, 0x7a181e, 0x9a2226, 0xb8302e, 0xd4463a, 0xe8664a, 0xf48a5e].map(hex);
const EMBER_ROOT_BLADES: Blade[] = [
  { x: 3, a: -0.6, k: 0.09, len: 8, tone: -0.1 }, { x: 12, a: 0.6, k: -0.09, len: 8, tone: -0.1 },
  { x: 5, a: -0.2, k: 0.1, len: 11 }, { x: 10, a: 0.25, k: -0.11, len: 11 },
  { x: 7, a: 0.1, k: -0.07, len: 13, tone: 0.05 }, { x: 8, a: -0.3, k: 0.06, len: 9 },
];

function emberRoots(t: Tex): void {
  blades(t, EMBER_ROOT_BLADES, EMBER_ROOTS);
  // pontas enroladas levemente incandescentes
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!t.alpha(x, y)) continue;
    if (!t.alpha(x, y - 1) && y < 9) { t.px(x, y, hex(0xff9a58)); t.m(x, y, 0.35, 0, 0.3, 0.55); }
  }
}

// ------------------------------------------------------------------ registro
export const PLANT_PAINTERS: Record<string, Painter> = {
  short_grass: (t) => blades(t, SHORT_GRASS, GR),
  fern: (t) => sprite(t, FERN, GL),
  tall_grass_top: (t) => blades(t, TALL_GRASS, GR, 31, 0),
  tall_grass_bottom: (t) => blades(t, TALL_GRASS, GR, 31, 16),
  large_fern_top: (t) => largeFern(t, 0),
  large_fern_bottom: (t) => largeFern(t, 16),
  poppy: (t) => sprite(t, POPPY_MAP, POPPY),
  buttercup: (t) => sprite(t, BUTTERCUP_MAP, BUTTERCUP),
  cornflower: (t) => sprite(t, CORNFLOWER_MAP, CORNFLOWER),
  daisy: (t) => sprite(t, DAISY_MAP, DAISY),
  purple_clover: (t) => sprite(t, CLOVER_MAP, CLOVER),
  forget_me_not: (t) => sprite(t, FORGET_MAP, FORGET),
  red_tulip: (t) => sprite(t, TULIP_MAP, tulip(0x9c1622, 0xc82632, 0xe44648, 0xf5806e)),
  orange_tulip: (t) => sprite(t, TULIP_MAP, tulip(0xc0520c, 0xe8741a, 0xf7962e, 0xffc068)),
  white_tulip: (t) => sprite(t, TULIP_MAP, tulip(0xbdbdb4, 0xd8d8d0, 0xeeeee8, 0xffffff)),
  pink_tulip: (t) => sprite(t, TULIP_MAP, tulip(0xbc4a7e, 0xdc6c9c, 0xf094bc, 0xffc4dc)),
  lily_of_the_valley: (t) => sprite(t, LILY_VALLEY_MAP, LILY_VALLEY),
  blue_orchid: (t) => sprite(t, ORCHID_MAP, ORCHID),
  lume_bloom: (t) => sprite(t, LUME_BLOOM_MAP, LUME_BLOOM),
  brown_mushroom: (t) => sprite(t, BROWN_MUSH_MAP, BROWN_MUSH),
  red_mushroom: (t) => sprite(t, RED_MUSH_MAP, RED_MUSH),
  lume_mushroom: (t) => sprite(t, LUME_MUSH_MAP, LUME_MUSH),
  dead_bush: (t) => sprite(t, DEAD_BUSH_MAP, DEAD_BUSH, { s: 0.12, p: 0.7 }),
  sunflower_top: (t) => sprite2(t, SUNFLOWER_MAP, SUNFLOWER, 0),
  sunflower_bottom: (t) => sprite2(t, SUNFLOWER_MAP, SUNFLOWER, 16),
  lilac_top: (t) => sprite2(t, LILAC_MAP, LILAC, 0),
  lilac_bottom: (t) => sprite2(t, LILAC_MAP, LILAC, 16),
  rose_bush_top: (t) => roseBush(t, 0),
  rose_bush_bottom: (t) => roseBush(t, 16),
  peony_top: (t) => peony(t, 0),
  peony_bottom: (t) => peony(t, 16),
  seagrass: (t) => blades(t, SEAGRASS, SEA),
  tall_seagrass_top: (t) => blades(t, TALL_SEAGRASS, SEA, 31, 0),
  tall_seagrass_bottom: (t) => blades(t, TALL_SEAGRASS, SEA, 31, 16),
  kelp: (t) => sprite(t, KELP_TOP_MAP, KELP, { s: 0.45, p: 0.2 }),
  kelp_plant: (t) => sprite(t, KELP_PLANT_MAP, KELP, { s: 0.45, p: 0.2 }),
  sugar_cane: (t) => sprite(t, SUGAR_CANE, GL, { s: 0.35 }),
  vine,
  lily_pad: lilyPad,
  cobweb,
  cactus_side: cactusSide,
  cactus_top: (t) => cactusEnd(t, true),
  cactus_bottom: (t) => cactusEnd(t, false),
  pumpkin_side: pumpkinSide,
  pumpkin_top: pumpkinTop,
  carved_pumpkin: (t) => carved(t, false),
  jack_o_lantern: (t) => carved(t, true),
  melon_side: melonSide,
  melon_top: melonTop,
  brown_mushroom_block: brownMushroomBlock,
  red_mushroom_block: redMushroomBlock,
  mushroom_stem: mushroomStem,
  farmland: (t) => farmland(t, false),
  farmland_moist: (t) => farmland(t, true),
  stem: (t) => sprite(t, STEM_MAP, GL, { s: 0.3 }),
  attached_stem: (t) => sprite(t, ATTACHED_STEM_MAP, GL, { s: 0.3 }),
  ember_fungus: (t) => sprite(t, EMBER_FUNGUS_MAP, EMBER, { s: 0.35 }),
  ember_roots: emberRoots,
};
