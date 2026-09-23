/**
 * Pintores do grupo C (parte 2): kit comum de desenho (placas chanfradas, metal, tábuas, sprites,
 * chamas, discos) usado também por fulgor.ts, utility.ts e animated.ts, e os blocos de luz/decoração
 * e oficina pesada: tochas, lanternas, corrente, escada, andaime, fogueira, gaiola, vaso, bolo,
 * toca-discos, farol, cristal de brasa, sino, mesa de encantamento, bigorna, suporte de poções,
 * caldeirão, composteira, rebolo e cortador de pedra.
 * Luz sempre de cima-esquerda; alfa 0 onde não há matéria.
 */
import { Tex, type Painter, type Palette, type RGB, hex, mix, pal, scale } from '../tex';

// ------------------------------------------------------------------ paletas do grupo
export const PAL = {
  stone: pal(0x5d5d61, 0x6c6c70, 0x7a7a7e, 0x87878b, 0x95959a),
  smooth: pal(0x7c7c86, 0x88888f, 0x939399, 0x9e9ea6, 0xaaaab2, 0xb8b8c0),
  dark: pal(0x2c2d33, 0x37383f, 0x42434b, 0x4e4f58, 0x5b5c66),
  iron: pal(0x55565e, 0x6f7079, 0x8a8b94, 0xa6a7af, 0xc3c4cb, 0xe0e1e6),
  darkIron: pal(0x1f2126, 0x2a2d33, 0x363940, 0x44484f, 0x555a62, 0x6b7079),
  gold: pal(0x7a5608, 0xa87a10, 0xd0a21a, 0xe8bf2c, 0xf6d84c, 0xfff0a0),
  brass: pal(0x5e4214, 0x8a6424, 0xb58a38, 0xd4ad55, 0xecd08a),
  copper: pal(0x6e381e, 0x9a522a, 0xbf6b38, 0xd88a55, 0xebb088),
  fulgor: pal(0x0c4d5c, 0x137a8f, 0x1fb2c9, 0x5de4f0, 0xc8fbff),
  fulgorOff: pal(0x0e2a31, 0x143a44, 0x1c4d59, 0x26606e),
  flame: pal(0x7e1c04, 0xc23e0c, 0xec7016, 0xffa228, 0xffd65e, 0xfff6d2),
  soul: pal(0x06334a, 0x0c627e, 0x1a9ebe, 0x46d2ea, 0x9af2fc, 0xe4ffff),
  ember: pal(0x3a0c06, 0x7a1a08, 0xc0360c, 0xf0661a, 0xffa640, 0xffe08a),
  oak: pal(0x6a4a28, 0x7e5a32, 0x93693c, 0xa67a47, 0xb88a52),
  darkWood: pal(0x2a1a0e, 0x352214, 0x40291a, 0x4c3220, 0x5a3c26),
  terracotta: pal(0x6e3222, 0x8a4230, 0xa4543c, 0xb86848, 0xc98058),
};

// ------------------------------------------------------------------ utilidades básicas
export const pick = (p: Palette, v: number): RGB => p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))];
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Material igual num retângulo. */
export function matRect(t: Tex, x0: number, y0: number, w: number, h: number, smooth: number, metal = 0, poro = 0.5, emis = 0): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) t.m(x, y, smooth, metal, poro, emis);
}

/** Apaga (alfa 0) um retângulo. */
export function clearRect(t: Tex, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) t.px(x, y, [0, 0, 0], 0);
}

/** Escurece/clareia os pixels de um retângulo. */
export function shadeRect(t: Tex, x0: number, y0: number, w: number, h: number, k: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) t.shadePx(x, y, k);
}

/** Pixel que brilha no escuro. */
export function glow(t: Tex, x: number, y: number, c: RGB, e: number): void {
  t.px(x, y, c); t.emit(x, y, e);
}

export interface PanelOpts {
  /** força do ruído */ n?: number;
  salt?: number;
  /** força do chanfro (0 = sem) */ bevel?: number;
  /** altura base */ hgt?: number;
  /** listras de escovado: horizontais ou verticais */ streak?: 'h' | 'v';
  /** material [suavidade, metal, porosidade, emissão] */ mat?: [number, number, number, number?];
}

/** Placa chanfrada: ruído suave, realce em cima/esquerda e sombra embaixo/direita. */
export function panel(t: Tex, x0: number, y0: number, w: number, h: number, p: Palette, o: PanelOpts = {}): void {
  const n = o.n ?? 0.3, salt = o.salt ?? 0, bev = o.bevel ?? 0.3, hgt = o.hgt ?? 0.6;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const base = o.streak === 'h' ? t.white(1, y, salt) * 0.55 + t.vnoise(x, y, 4, salt) * 0.45
      : o.streak === 'v' ? t.white(x, 1, salt) * 0.55 + t.vnoise(x, y, 4, salt) * 0.45 : t.fbm(x, y, salt);
    let v = 0.5 + (base - 0.5) * n * 2 + (t.white(x, y, salt + 7) - 0.5) * 0.08;
    let hh = hgt;
    if (bev) {
      if (y === y0 || x === x0) v += bev;
      if (y === y0 + h - 1 || x === x0 + w - 1) { v -= bev; hh -= 0.12; }
    }
    t.px(x, y, pick(p, v)); t.h(x, y, hh);
    if (o.mat) t.m(x, y, o.mat[0], o.mat[1], o.mat[2], o.mat[3] ?? 0);
  }
}

/** Placa de metal escovado (metal=1). */
export function metalPanel(t: Tex, x0: number, y0: number, w: number, h: number, p: Palette = PAL.iron, smooth = 0.65, o: PanelOpts = {}): void {
  panel(t, x0, y0, w, h, p, { n: 0.2, streak: 'h', bevel: 0.34, ...o, mat: [smooth, 1, 0.05] });
}

/** Rebite: ponto de realce com sombra embaixo-direita. */
export function rivet(t: Tex, x: number, y: number, hi: RGB, lo: RGB): void {
  t.px(x, y, hi); t.h(x, y, 0.85);
  t.px(x + 1, y + 1, lo); t.h(x + 1, y + 1, 0.4);
}

export interface BoardOpts { vertical?: boolean; size?: number; salt?: number; seams?: boolean; bevel?: number }

/** Tábuas num retângulo: veio ao longo do comprimento, juntas sombreadas e emendas. */
export function boards(t: Tex, x0: number, y0: number, w: number, h: number, p: Palette, o: BoardOpts = {}): void {
  const size = o.size ?? 4, salt = o.salt ?? 0, len = o.vertical ? h : w, bev = o.bevel ?? 1;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const a = o.vertical ? y - y0 : x - x0;
    const c = o.vertical ? x - x0 : y - y0;
    const b = Math.floor(c / size), k = c % size;
    const tone = 0.85 + t.white(b, 3, salt + 1) * 0.3;
    const grain = Math.sin(a * 0.7 + t.vnoise(x, y, 4, salt + b) * 6 + k * 0.5) * 0.5 + 0.5;
    let v = 0.36 + grain * 0.32 * tone + (t.white(x, y, salt + 2) - 0.5) * 0.14;
    if (k === 0) v += 0.12 * bev;
    if (k === size - 1 || c === (o.vertical ? w : h) - 1) v -= 0.3 * bev;
    const seam = Math.floor(t.white(b, 7, salt + 3) * len);
    const isSeam = (o.seams ?? true) && len > 6 && a === seam && seam > 1 && seam < len - 2;
    if (isSeam) v -= 0.28;
    t.px(x, y, pick(p, v));
    t.h(x, y, k === size - 1 || isSeam ? 0.3 : 0.55 + grain * 0.08);
    t.m(x, y, 0.2, 0, 0.6);
  }
}

export interface Ink { c: RGB; h?: number; m?: [number, number, number, number?] }

/** Desenho ASCII com cor, altura e material por caractere (' ' mantém, '.' apaga). */
export function sprite(t: Tex, rows: string[], map: Record<string, RGB | Ink>, ox = 0, oy = 0): void {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x];
    if (ch === ' ') continue;
    const X = x + ox, Y = y + oy;
    if (ch === '.') { t.px(X, Y, [0, 0, 0], 0); continue; }
    const ink = map[ch];
    if (!ink) continue;
    if (Array.isArray(ink)) { t.px(X, Y, ink); continue; }
    t.px(X, Y, ink.c);
    if (ink.h !== undefined) t.h(X, Y, ink.h);
    if (ink.m) t.m(X, Y, ink.m[0], ink.m[1], ink.m[2], ink.m[3] ?? 0);
  }
}

/** Percorre os pixels de um disco (centro em coordenadas contínuas; centro do pixel = +0,5). */
export function disc(t: Tex, cx: number, cy: number, r: number, fn: (x: number, y: number, d: number, dx: number, dy: number) => void): void {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(15, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(15, Math.ceil(cx + r)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d < r) fn(x, y, d, dx, dy);
    }
  }
  void t;
}

/** Pixel de chama: intensidade 0..1 → cor da paleta e emissão. */
export function flamePx(t: Tex, x: number, y: number, v: number, p: Palette = PAL.flame, a = 255): void {
  t.px(x, y, pick(p, v), a);
  t.h(x, y, 0.5 + v * 0.3);
  t.m(x, y, 0.2, 0, 0, 0.55 + clamp01(v) * 0.45);
}

/**
 * Campo de chama (0..1): línguas subindo, mais fortes embaixo. `phase` (0..1) anima em laço perfeito
 * (ruídos periódicos em y com deslocamento múltiplo de 16). `reach` = altura típica das línguas.
 */
export function flameField(t: Tex, x: number, y: number, phase: number, salt: number, reach = 12): number {
  const up = 15 - y;
  const n1 = t.vnoise(x, y + phase * 16, 4, salt);
  const n2 = t.vnoise(x, y + phase * 32, 8, salt + 1);
  const tongue = t.vnoise(x + Math.sin(phase * Math.PI * 2) * 0.8, 0, 4, salt + 2);
  const base = 1.05 - up / (reach * (0.55 + tongue * 0.7));
  return base + (n1 - 0.5) * 0.75 + (n2 - 0.5) * 0.35;
}

/** Língua de fogo: centro x, altura (px) e meia-largura; `sway` = fase própria do balanço. */
export type Tongue = [number, number, number, number?];

/**
 * Fogo com línguas distintas, periódico em x (repete lado a lado) e no tempo (`phase` 0..1 fecha o laço).
 * Preenche a textura (fundo transparente) usando a paleta dada, com emissão.
 */
export function fireShape(t: Tex, p: Palette, phase: number, salt: number, tongues: Tongue[], a = 255): void {
  t.transparent();
  const TAU = Math.PI * 2;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const up = 15 - y;
    let H = 0, core = 0;
    for (const [c0, h0, w, sw = 0] of tongues) {
      const c = c0 + Math.sin(TAU * (phase + sw)) * 0.9;
      let d = Math.abs(x + 0.5 - c); d = Math.min(d, 16 - d);
      if (d >= w) continue;
      const k = 1 - (d / w) * (d / w);
      const h = h0 * (0.86 + 0.14 * Math.sin(TAU * (2 * phase + sw * 3)));
      if (h * k > H) { H = h * k; core = 1 - d / w; }
    }
    const n = t.vnoise(x, y + phase * 16, 4, salt) - 0.5;
    const n2 = t.vnoise(x, y + phase * 32, 8, salt + 1) - 0.5;
    const v = 1 - up / (H + 1.5) + n * 0.55 + n2 * 0.3;
    const bed = up < 2 ? 0.35 : 0;
    if (v + bed <= 0.14) continue;
    const k = clamp01(Math.min(1, v + bed * 0.5) * 0.68 + core * 0.24 - up * 0.01);
    flamePx(t, x, y, k, p, a);
  }
}

// ------------------------------------------------------------------ móveis (bancadas e mesas de ofício)
/** Tinta de ferro / de madeira para sprites. */
export const IRON_INK = (c: RGB, h = 0.8): Ink => ({ c, h, m: [0.65, 1, 0.08] });
export const WOOD_INK = (c: RGB, h = 0.75): Ink => ({ c, h, m: [0.25, 0, 0.6] });

/** Sombra de painel recuado: escurece a borda de cima/esquerda, clareia a de baixo/direita. */
export function shadeInner(t: Tex, x0: number, y0: number, w: number, h: number): void {
  for (let x = x0; x < x0 + w; x++) { t.shadePx(x, y0, 0.7); t.shadePx(x, y0 + h - 1, 1.08); }
  for (let y = y0 + 1; y < y0 + h - 1; y++) { t.shadePx(x0, y, 0.78); t.shadePx(x0 + w - 1, y, 1.06); }
}

/** Frente/lado de móvel: borda do tampo (y0..2), pernas (x0..1 e x14..15) e painel recuado entre elas. */
export function furniture(t: Tex, top: Palette, body: Palette, salt: number): void {
  boards(t, 2, 3, 12, 13, body, { vertical: true, size: 4, salt });
  shadeInner(t, 2, 3, 12, 13);
  for (const x0 of [0, 14]) panel(t, x0, 3, 2, 13, body, { n: 0.25, bevel: 0.35, streak: 'v', salt: salt + x0, mat: [0.2, 0, 0.6] });
  boards(t, 0, 0, 16, 3, top, { size: 3, salt: salt + 2 });
}

// ------------------------------------------------------------------ alvenaria das fornalhas (também ejetor e liberador)
export const FURN = pal(0x505055, 0x5e5e63, 0x6c6c71, 0x7a7a7f, 0x88888d, 0x97979b);
export const FURN_TOP = pal(0x66666c, 0x737379, 0x808086, 0x8d8d93, 0x9a9aa0, 0xa9a9ae);

/** Pedra talhada em 3 fiadas desencontradas (repete sem emenda nos dois eixos). */
export function masonry(t: Tex, p: Palette = FURN, salt = 0): void {
  t.fill(scale(p[0], 0.72));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.h(x, y, 0.2);
  const courses: [number, number, number][] = [[0, 5, 0], [5, 5, 5], [10, 6, 2]];
  for (const [y0, h, off] of courses) for (let k = 0; k < 2; k++) {
    const tone = t.white(k, y0, salt + 3) * 0.24 - 0.12;
    for (let y = y0; y < y0 + h - 1; y++) for (let dx = 0; dx < 7; dx++) {
      const x = (off + k * 8 + dx) & 15;
      let v = 0.5 + tone + (t.fbm(x, y, salt) - 0.5) * 0.45;
      if (y === y0 || dx === 0) v += 0.2;
      if (y === y0 + h - 2 || dx === 6) v -= 0.22;
      t.px(x, y, pick(p, v)); t.h(x, y, y === y0 + h - 2 || dx === 6 ? 0.5 : 0.62);
    }
  }
  t.material(0.2, 0, 0.4);
}

/** Tampo de laje em 4 placas chanfradas. */
export function slabTop(t: Tex, p: Palette = FURN_TOP, salt = 0): void {
  for (const y0 of [0, 8]) for (const x0 of [0, 8]) panel(t, x0, y0, 8, 8, p, { n: 0.28, bevel: 0.26, salt: salt + x0 + y0, mat: [0.28, 0, 0.35] });
}

// ------------------------------------------------------------------ tochas, lanternas, corrente, escada, andaime
/** Haste de tocha/alavanca nas colunas x7 (lado iluminado) e x8 (sombra), de y0 até o fim. */
export function stick(t: Tex, p: Palette, y0: number, salt = 0): void {
  for (let y = y0; y < 16; y++) {
    const n = t.white(0, y, salt) * 0.22;
    t.px(7, y, pick(p, 0.6 + n)); t.px(8, y, pick(p, 0.22 + n));
    t.h(7, y, 0.62); t.h(8, y, 0.52);
    t.m(7, y, 0.2, 0, 0.6); t.m(8, y, 0.2, 0, 0.6);
  }
  t.shadePx(7, 15, 0.8); t.shadePx(8, 15, 0.8);
}

/** Tocha: haste (y9..15), amarração (y9), brasa (y8) e chama 2×2 (y6..7, vista também de cima). */
function torchTex(t: Tex, wood: Palette, wrap: [number, number], flame: Palette): void {
  t.transparent();
  stick(t, wood, 9, 4);
  t.px(7, 9, hex(wrap[0])); t.px(8, 9, hex(wrap[1]));
  glow(t, 7, 8, pick(flame, 0.3), 0.7); glow(t, 8, 8, pick(flame, 0.1), 0.55);
  flamePx(t, 7, 6, 1, flame); flamePx(t, 8, 6, 0.75, flame);
  flamePx(t, 7, 7, 0.6, flame); flamePx(t, 8, 7, 0.45, flame);
}

/** Lanterna (molde de UV): corpo lateral x0..5,y2..8; topo/fundo x0..5,y9..14; tampinha x0..3,y0..1
 *  (topo dela em x0..3,y10..13); corrente x11..13,y0..5. */
function lanternTex(t: Tex, flame: Palette, glassLo: number, glassHi: number): void {
  t.transparent();
  const I = PAL.darkIron;
  t.material(0.65, 1, 0.1);
  // corpo lateral: moldura de ferro, vidro aceso e chama
  const G0 = hex(glassLo), G1 = hex(glassHi);
  sprite(t, [
    '544332',
    '4ghhg1',
    '4gabg1',
    '3gbcg0',
    '3gcdg0',
    '3eeff0',
    '322110',
  ], {
    0: I[0], 1: I[1], 2: I[2], 3: I[3], 4: I[4], 5: I[5],
    g: G0, h: G1, a: pick(flame, 1), b: pick(flame, 0.75), c: pick(flame, 0.55), d: pick(flame, 0.4),
    e: PAL.brass[3], f: PAL.brass[1],
  }, 0, 2);
  for (let y = 3; y <= 6; y++) for (let x = 1; x <= 4; x++) t.m(x, y, 0.9, 0, 0, x >= 2 && x <= 3 && y >= 4 ? 1 : 0.5);
  t.m(1, 7, 0.6, 1, 0.1, 0.15); t.m(2, 7, 0.6, 1, 0.1, 0.15); t.m(3, 7, 0.6, 1, 0.1, 0.15); t.m(4, 7, 0.6, 1, 0.1, 0.15);
  // tampinha lateral
  sprite(t, ['5443', '3221'], { 1: I[1], 2: I[2], 3: I[3], 4: I[4], 5: I[5] }, 0, 0);
  // topo/fundo do corpo (6×6) com o topo da tampinha (4×4) no canto
  sprite(t, [
    '544443',
    '444321',
    '432121',
    '432121',
    '311121',
    '311110',
  ], { 0: I[0], 1: I[1], 2: I[2], 3: I[3], 4: I[4], 5: I[5] }, 0, 9);
  // corrente de pendurar
  sprite(t, ['.4.', '4.1', '.2.', '.3.', '4.1', '.2.'], { 1: I[1], 2: I[2], 3: I[3], 4: I[4] }, 11, 0);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.h(x, y, t.alpha(x, y) ? 0.6 : 0.5);
}

/** Vara de bambu horizontal (2 linhas) com nós. */
function bambooH(t: Tex, x0: number, x1: number, y: number, salt: number): void {
  for (let x = x0; x < x1; x++) {
    const node = (x + salt * 3) % 6 === 0;
    const n = t.white(x, y, salt) * 0.12;
    t.px(x, y, pick(BAMBOO, node ? 0.35 : 0.72 + n)); t.px(x, y + 1, pick(BAMBOO, node ? 0.05 : 0.32 + n));
    t.h(x, y, node ? 0.75 : 0.65); t.h(x, y + 1, 0.55);
    t.m(x, y, 0.35, 0, 0.4); t.m(x, y + 1, 0.35, 0, 0.4);
  }
}

/** Vara de bambu vertical (2 colunas) com nós. */
function bambooV(t: Tex, x: number, y0: number, y1: number, salt: number): void {
  for (let y = y0; y < y1; y++) {
    const node = (y + salt * 5) % 6 === 0;
    const n = t.white(x, y, salt) * 0.12;
    t.px(x, y, pick(BAMBOO, node ? 0.35 : 0.72 + n)); t.px(x + 1, y, pick(BAMBOO, node ? 0.05 : 0.32 + n));
    t.h(x, y, node ? 0.75 : 0.65); t.h(x + 1, y, 0.55);
    t.m(x, y, 0.35, 0, 0.4); t.m(x + 1, y, 0.35, 0, 0.4);
  }
}

const BAMBOO = pal(0x6e5e26, 0x8e7c34, 0xae9846, 0xc8b25c, 0xdcc97c, 0xebdca2);
const TWINE = pal(0x5a4428, 0x7a6038, 0x9a7e4e);

/** Amarração de barbante 2×2. */
function lash(t: Tex, x: number, y: number): void {
  t.px(x, y, TWINE[2]); t.px(x + 1, y, TWINE[1]); t.px(x, y + 1, TWINE[1]); t.px(x + 1, y + 1, TWINE[0]);
  for (const [a, b] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) { t.h(a, b, 0.8); t.m(a, b, 0.05, 0, 0.9); }
}

const LIGHTS: Record<string, Painter> = {
  torch: (t) => torchTex(t, PAL.oak, [0x8e6e40, 0x62482a], PAL.flame),
  soul_torch: (t) => torchTex(t, pal(0x3a3430, 0x4a423c, 0x5c524a, 0x6e6258, 0x807266), [0x6a7a80, 0x46545a], PAL.soul),
  lantern: (t) => lanternTex(t, PAL.flame, 0xd8a85a, 0xf4d690),
  soul_lantern: (t) => lanternTex(t, PAL.soul, 0x3aa8bc, 0x8ae4ee),
  chain: (t) => {
    t.transparent();
    t.material(0.65, 1, 0.1);
    const I = PAL.iron;
    const map = { a: I[4], b: I[3], c: I[1], d: I[0], e: I[2], f: I[1] };
    const ring = ['.a.', 'b.c', 'b.c', 'b.c', '.d.'], bar = ['.e.', '.e.', '.f.'];
    for (let k = 0; k < 2; k++) {
      sprite(t, ring, map, 0, k * 8); sprite(t, bar, map, 0, k * 8 + 5);
      sprite(t, ring, map, 3, k * 8 + 4); sprite(t, bar, map, 3, k * 8 + 9);
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) t.h(x, y, t.alpha(x, y) ? 0.7 : 0.5);
  },
  ladder: (t) => {
    t.transparent();
    const W = pal(0x563a20, 0x6a4a2a, 0x7e5b34, 0x926c3f, 0xa47c4a);
    for (let y = 0; y < 16; y++) for (const x of [2, 3, 12, 13]) {
      const lit = x === 2 || x === 12;
      const v = (lit ? 0.62 : 0.3) + (t.vnoise(x * 4, y, 4, 3) - 0.5) * 0.3 + (t.white(x, y) - 0.5) * 0.1;
      t.px(x, y, pick(W, v)); t.h(x, y, lit ? 0.7 : 0.6); t.m(x, y, 0.2, 0, 0.6);
    }
    for (const y0 of [1, 5, 9, 13]) {
      for (let x = 4; x < 12; x++) {
        const g = t.white(x, y0, 5) * 0.15;
        t.px(x, y0, pick(W, 0.66 + g)); t.px(x, y0 + 1, pick(W, 0.26 + g));
        t.h(x, y0, 0.85); t.h(x, y0 + 1, 0.7); t.m(x, y0, 0.2, 0, 0.6); t.m(x, y0 + 1, 0.2, 0, 0.6);
      }
      // cavilhas atravessando os montantes
      t.px(2, y0, W[4]); t.px(13, y0 + 1, W[0]); t.px(3, y0 + 1, W[1]); t.px(12, y0, W[3]);
    }
  },
  scaffolding_side: (t) => {
    t.transparent();
    bambooV(t, 0, 2, 16, 1); bambooV(t, 14, 2, 16, 2);
    bambooH(t, 0, 16, 0, 3);
    lash(t, 0, 2); lash(t, 14, 2);
  },
  scaffolding_top: (t) => {
    t.transparent();
    for (const y of [3, 6, 9, 12]) bambooH(t, 2, 14, y, y);
    bambooH(t, 0, 16, 0, 1); bambooH(t, 0, 16, 14, 2);
    bambooV(t, 0, 2, 14, 3); bambooV(t, 14, 2, 14, 4);
    lash(t, 0, 0); lash(t, 14, 0); lash(t, 0, 14); lash(t, 14, 14);
  },
  scaffolding_bottom: (t) => {
    t.transparent();
    for (let i = 2; i < 14; i++) {
      for (const [x, y, lit] of [[i, i, 1], [i + 1, i, 0], [15 - i, i, 1], [14 - i, i, 0]] as [number, number, number][]) {
        if (x < 2 || x > 13) continue;
        t.px(x, y, pick(BAMBOO, lit ? 0.6 : 0.25)); t.h(x, y, 0.6); t.m(x, y, 0.35, 0, 0.4);
      }
    }
    bambooH(t, 0, 16, 0, 5); bambooH(t, 0, 16, 14, 6);
    bambooV(t, 0, 2, 14, 7); bambooV(t, 14, 2, 14, 8);
    lash(t, 7, 7);
  },
};

// ------------------------------------------------------------------ fogueira, gaiola, vaso, bolo, toca-discos, farol, cristal, sino
const BARK = pal(0x2a1c10, 0x382616, 0x46311c, 0x543c23, 0x63482b, 0x72552f);
const CHAR = pal(0x161010, 0x221815, 0x2e211b, 0x3a2b22);
const FROST = pal(0xc8bcc0, 0xdcd2d6, 0xebe4e6, 0xf6f2f3, 0xffffff);
const CHOC = pal(0x2c160e, 0x3a1e12, 0x4a2818, 0x5a3320, 0x6a3e28);
const BERRY = pal(0x6a0c1c, 0xa81c32, 0xd83a50, 0xff8e9e);
const WALNUT = pal(0x2e1c12, 0x3c2518, 0x4a2e1e, 0x5a3824, 0x6a432c);

/** Casca em faixas horizontais (troncos deitados), com fissuras. */
function barkH(t: Tex, salt: number): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = t.white(1, y, salt) * 0.45 + t.vnoise(x, y, 4, salt) * 0.4 + (t.white(x, y, salt + 1) - 0.5) * 0.3;
    t.px(x, y, pick(BARK, v)); t.h(x, y, 0.35 + v * 0.4);
  }
  for (let i = 0; i < 6; i++) {
    const y = t.rng.nextInt(16), x0 = t.rng.nextInt(16), len = 2 + t.rng.nextInt(4);
    for (let x = x0; x < x0 + len; x++) { t.px(x, y, scale(BARK[0], 0.8)); t.h(x, y, 0.15); }
    t.px(x0 + len, y - 1, BARK[5]);
  }
  t.material(0.1, 0, 0.75);
}

/** Moranguinho 2×2 (realce em cima-esquerda). */
function berry(t: Tex, x: number, y: number): void {
  t.px(x, y, BERRY[3]); t.px(x + 1, y, BERRY[2]); t.px(x, y + 1, BERRY[2]); t.px(x + 1, y + 1, BERRY[0]);
  for (const [a, b] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) { t.h(a, b, 0.85); t.m(a, b, 0.6, 0, 0.1); }
}

const DECOR: Record<string, Painter> = {
  campfire_log: (t) => barkH(t, 3),
  campfire_log_lit: (t) => {
    // pedaços de carvão (células) com frestas incandescentes entre eles
    const cells: [number, number][] = [];
    for (let i = 0; i < 11; i++) cells.push([t.rng.next() * 16, t.rng.next() * 16]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let d1 = 99, d2 = 99, id = 0;
      cells.forEach(([cx, cy], i) => {
        const dx = Math.min(Math.abs(x + 0.5 - cx), 16 - Math.abs(x + 0.5 - cx)), dy = Math.min(Math.abs(y + 0.5 - cy), 16 - Math.abs(y + 0.5 - cy));
        const d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
      });
      const edge = d2 - d1;
      if (edge < 0.9) {
        const e = clamp01(1 - edge / 0.9) * (0.7 + t.vnoise(x, y, 4, 3) * 0.3);
        t.px(x, y, pick(PAL.ember, 0.3 + e * 0.65)); t.h(x, y, 0.2); t.m(x, y, 0.3, 0, 0.2, 0.5 + e * 0.5);
        continue;
      }
      const [cx, cy] = cells[id];
      const lit = clamp01(0.5 - ((x + 0.5 - cx) + (y + 0.5 - cy)) * 0.12 + (t.white(x, y, 5) - 0.5) * 0.3 + (id % 3) * 0.08);
      t.px(x, y, t.white(x, y, 11) < 0.05 ? hex(0x8a8580) : pick(CHAR, lit)); t.h(x, y, 0.45 + Math.min(0.3, edge * 0.1)); t.m(x, y, 0.1, 0, 0.8);
    }
  },
  campfire_fire: (t) => fireShape(t, PAL.flame, 0, 21, [[2.5, 9, 3], [7.5, 14, 3.6], [12.5, 10, 3], [5, 6, 2], [10.2, 7, 2]]),
  spawner: (t) => {
    t.transparent();
    const S = pal(0x15171c, 0x1e2128, 0x282c34, 0x343a44, 0x444b57, 0x5a6270);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x < 2 || x > 13 || y < 2 || y > 13;
      const bar = x === 5 || x === 10 || y === 5 || y === 10;
      const gusset = (x === 2 || x === 13) && (y === 2 || y === 13);
      if (!frame && !bar && !gusset) continue;
      let v = 0.45 + (t.fbm(x, y, 3) - 0.5) * 0.3;
      if (frame) {
        if (x === 0 || y === 0) v += 0.3;
        if (x === 15 || y === 15) v -= 0.3;
        if ((x === 14 && y > 1 && y < 14) || (y === 14 && x > 1 && x < 14)) v += 0.18;
        if ((x === 1 && y > 1 && y < 14) || (y === 1 && x > 1 && x < 14)) v -= 0.18;
      }
      if (bar && (x === 5 || x === 10) && (y === 5 || y === 10)) v += 0.35;
      t.px(x, y, pick(S, v)); t.h(x, y, frame ? 0.7 : 0.6); t.m(x, y, 0.6, 1, 0.1);
    }
  },
  flower_pot: (t) => {
    t.transparent();
    const T = PAL.terracotta, S = pal(0x24160c, 0x322012, 0x422c1a, 0x523822);
    // vista de cima (x5..10, y5..10): borda e terra
    for (let y = 5; y <= 10; y++) for (let x = 5; x <= 10; x++) {
      const rim = x === 5 || x === 10 || y === 5 || y === 10;
      if (rim) { t.px(x, y, T[x === 5 || y === 5 ? 4 : y === 10 ? 3 : 2]); t.h(x, y, 0.8); t.m(x, y, 0.15, 0, 0.6); continue; }
      t.px(x, y, x === 6 || y === 6 ? S[0] : S[1 + Math.floor(t.white(x, y, 3) * 3)]); t.h(x, y, 0.4); t.m(x, y, 0.05, 0, 0.9);
    }
    // lateral (x5..10, y10..15): aba, sombra da aba e bojo com pontinhos em relevo
    for (let y = 11; y <= 15; y++) for (let x = 5; x <= 10; x++) {
      let v = 0.55 + (x === 5 ? 0.22 : x === 10 ? -0.25 : 0) + (t.white(x, y, 5) - 0.5) * 0.12;
      if (y === 11) v -= 0.08;
      if (y === 12) v -= 0.32;
      if (y === 15) v -= 0.18;
      t.px(x, y, pick(T, v)); t.h(x, y, y === 12 ? 0.45 : 0.6); t.m(x, y, 0.15, 0, 0.6);
    }
    t.px(6, 14, T[4]); t.px(8, 14, T[4]); t.px(7, 13, T[3]); t.px(9, 13, T[3]);
  },
  cake_top: (t) => {
    t.transparent();
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      let v = 0.62 + (t.fbm(x, y, 4) - 0.5) * 0.35;
      if (x === 1 || y === 1) v += 0.25;
      if (x === 14 || y === 14) v -= 0.3;
      t.px(x, y, pick(FROST, v)); t.h(x, y, x === 14 || y === 14 ? 0.5 : 0.62); t.m(x, y, 0.35, 0, 0.3);
    }
    for (const [x, y] of [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]]) berry(t, x, y);
    for (let i = 0; i < 7; i++) { const x = 2 + t.rng.nextInt(12), y = 2 + t.rng.nextInt(12); if (t.get(x, y)[0] > 200) t.px(x, y, CHOC[3]); }
  },
  cake_side: (t) => {
    t.transparent();
    for (let y = 8; y < 16; y++) for (let x = 1; x < 15; x++) {
      const drip = 10 + Math.floor(t.white(x, 0, 6) * 3.2) - (x === 1 || x === 14 ? 1 : 0);
      const edge = x === 1 ? 0.18 : x === 14 ? -0.22 : 0;
      if (y < drip) {
        t.px(x, y, pick(FROST, (y === 8 ? 0.95 : 0.65) + edge)); t.h(x, y, 0.7); t.m(x, y, 0.35, 0, 0.3);
      } else {
        let v = 0.5 + (t.fbm(x, y, 7) - 0.5) * 0.4 + edge;
        if (y === 15) v -= 0.3;
        t.px(x, y, pick(CHOC, v)); t.h(x, y, 0.5); t.m(x, y, 0.08, 0, 0.8);
        if (y === 13) { t.px(x, y, hex(x === 14 ? 0xc8b89c : 0xecdcc0)); t.h(x, y, 0.55); }
      }
    }
  },
  cake_inner: (t) => {
    t.transparent();
    for (let y = 8; y < 16; y++) for (let x = 1; x < 15; x++) {
      let c: RGB;
      if (y === 8) c = FROST[4];
      else if (y === 9) c = FROST[2];
      else if (y === 12) c = pick(BERRY, 0.3 + t.white(x, y, 2) * 0.5);
      else if (y === 13) c = hex(0xf0e2c8);
      else c = t.white(x, y, 3) < 0.18 ? CHOC[1] : pick(CHOC, 0.55 + (t.fbm(x, y, 8) - 0.5) * 0.4 - (y === 15 ? 0.3 : 0));
      t.px(x, y, c); t.h(x, y, y <= 9 || y === 13 ? 0.62 : 0.5); t.m(x, y, y <= 9 ? 0.35 : 0.08, 0, y <= 9 ? 0.3 : 0.8);
    }
  },
  cake_bottom: (t) => {
    t.transparent();
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      let v = 0.4 + (t.fbm(x, y, 9) - 0.5) * 0.4;
      if (x === 1 || y === 1) v += 0.15;
      if (x === 14 || y === 14) v -= 0.2;
      t.px(x, y, t.white(x, y, 4) < 0.1 ? CHOC[0] : pick(CHOC, v)); t.h(x, y, 0.5); t.m(x, y, 0.08, 0, 0.8);
    }
  },
  jukebox_side: (t) => {
    panel(t, 0, 0, 16, 16, WALNUT, { n: 0.25, bevel: 0.3, mat: [0.3, 0, 0.5] });
    panel(t, 2, 2, 12, 12, WALNUT, { n: 0.2, bevel: -0.25, hgt: 0.5, salt: 3, mat: [0.3, 0, 0.5] });
    // grade do alto-falante: tela escura com treliça de latão
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
      const lattice = (x + y) % 3 === 0 || (x - y + 15) % 3 === 0;
      t.px(x, y, lattice ? PAL.brass[(x + y) % 2 ? 2 : 1] : hex(0x1e140e)); t.h(x, y, lattice ? 0.55 : 0.3);
      t.m(x, y, lattice ? 0.6 : 0.05, lattice ? 1 : 0, lattice ? 0.1 : 0.9);
    }
    for (const [x, y] of [[0, 0], [14, 0], [0, 14], [14, 14]]) {
      t.px(x, y, PAL.brass[4]); t.px(x + 1, y, PAL.brass[3]); t.px(x, y + 1, PAL.brass[3]); t.px(x + 1, y + 1, PAL.brass[1]);
      matRect(t, x, y, 2, 2, 0.7, 1, 0.1);
    }
  },
  jukebox_top: (t) => {
    panel(t, 0, 0, 16, 16, WALNUT, { n: 0.25, bevel: 0.3, mat: [0.3, 0, 0.5] });
    disc(t, 8, 8, 6, (x, y, d) => {
      const lab = d < 2.1;
      const groove = Math.floor(d * 1.6) % 2 === 0;
      t.px(x, y, lab ? (d < 0.9 ? PAL.gold[4] : hex(d < 1.5 ? 0xb8302c : 0x8a2020)) : hex(groove ? 0x1a1a1e : 0x26262c));
      if (!lab && x + y === 9 + Math.round(d)) t.px(x, y, hex(0x4a4a54));
      t.h(x, y, lab ? 0.6 : 0.5); t.m(x, y, lab ? 0.4 : 0.75, 0, 0.1);
    });
    for (const [x, y, c] of [[13, 2, 4], [12, 3, 3], [12, 4, 3], [11, 5, 2], [10, 6, 1]] as [number, number, number][]) {
      t.px(x, y, PAL.brass[c]); t.h(x, y, 0.8); t.m(x, y, 0.7, 1, 0.1);
    }
  },
};

const SHINY: Record<string, Painter> = {
  beacon: (t) => {
    // casca de vidro claro com moldura e um núcleo de cristal brilhante no meio
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.fbm(x, y, 2);
      let c = mix(hex(0x8ccfdc), hex(0xc4ecf3), v);
      if (x === 0 || y === 0) c = hex(0xeafcff);
      else if (x === 15 || y === 15) c = hex(0x5f9fb0);
      else if (x === 1 || y === 1) c = hex(0x6fb2c2);
      else if (x === 14 || y === 14) c = hex(0xb0e4ee);
      t.px(x, y, c); t.h(x, y, x === 0 || y === 0 || x === 15 || y === 15 ? 0.7 : 0.5); t.m(x, y, 0.95, 0, 0);
    }
    for (const [x0, y0, len] of [[2, 4, 3], [3, 3, 2], [10, 12, 3]] as [number, number, number][]) {
      for (let i = 0; i < len; i++) t.px(x0 + i, y0 - i, hex(0xf2feff));
    }
    // núcleo: losango de cristal com brilho radial
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
      const d = Math.abs(x + 0.5 - 8) + Math.abs(y + 0.5 - 8);
      if (d > 5.6) {
        if (d < 7) { t.px(x, y, mix(t.get(x, y), hex(0x7fe9f5), 0.45)); t.emit(x, y, 0.25); }
        continue;
      }
      const lit = x + y < 15;
      const c = d < 1.6 ? hex(0xffffff) : d < 3.2 ? hex(lit ? 0xd8fdff : 0xa6f3fb) : d < 4.6 ? hex(lit ? 0x7fe9f5 : 0x45cfe3) : hex(lit ? 0x3fb8cc : 0x238ea3);
      t.px(x, y, c); t.h(x, y, 0.8 - d * 0.05); t.m(x, y, 0.95, 0, 0, d < 3.2 ? 1 : d < 4.6 ? 0.85 : 0.6);
    }
  },
  ember_crystal: (t) => {
    t.transparent();
    const E = PAL.ember;
    sprite(t, [
      '................',
      '.......w........',
      '......awc.......',
      '......awcd......',
      '.....aawcd......',
      '.....abwcd...a..',
      '.....abwcdd.abc.',
      '..a..abwcdd.bcd.',
      '.abc.abwcdd.bcd.',
      '.bcd.abwcd..cd..',
      '.bcd.abwcd......',
      '..cd..bwcd......',
      '..d...bwc.......',
      '.......wc.......',
      '.......c........',
      '................',
    ], {
      w: { c: E[5], h: 0.95, m: [0.9, 0, 0.05, 1] },
      a: { c: E[4], h: 0.85, m: [0.9, 0, 0.05, 0.9] },
      b: { c: E[3], h: 0.75, m: [0.9, 0, 0.05, 0.8] },
      c: { c: E[2], h: 0.65, m: [0.9, 0, 0.05, 0.65] },
      d: { c: E[1], h: 0.5, m: [0.9, 0, 0.05, 0.5] },
    });
  },
  bell_side: (t) => {
    t.transparent();
    const G = PAL.gold;
    // corpo (x5..10, y3..9) e aba (x4..11, y10..11) — regiões usadas pelo modelo
    for (let y = 3; y <= 9; y++) for (let x = 5; x <= 10; x++) {
      let v = 0.55 + [0.32, 0.16, 0.04, -0.04, -0.16, -0.32][x - 5] + (y === 3 ? 0.12 : 0) + (t.white(x, y, 2) - 0.5) * 0.06;
      if (y === 7) v -= 0.28;
      if (y === 6) v += 0.08;
      t.px(x, y, pick(G, v)); t.h(x, y, y === 7 ? 0.45 : 0.62);
    }
    for (let x = 4; x <= 11; x++) {
      const k = x === 4 ? 0.2 : x === 11 ? -0.25 : 0;
      t.px(x, 10, pick(G, 0.78 + k)); t.px(x, 11, pick(G, 0.3 + k));
      t.h(x, 10, 0.75); t.h(x, 11, 0.6);
    }
    // alça (só enfeite, fora das regiões do modelo)
    t.px(7, 1, G[3]); t.px(8, 1, G[2]); t.px(6, 2, G[3]); t.px(9, 2, G[1]); t.px(7, 2, G[1]); t.px(8, 2, G[1]);
    t.material(0.8, 1, 0.05);
  },
  bell_top: (t) => {
    t.transparent();
    const G = PAL.gold;
    for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      const ring = x === 4 || x === 11 || y === 4 || y === 11;
      if (ring) { t.px(x, y, G[x === 4 || y === 4 ? 4 : 1]); t.h(x, y, 0.55); continue; }
      const d = Math.hypot(x + 0.5 - 7, y + 0.5 - 7);
      t.px(x, y, pick(G, 0.95 - d * 0.14)); t.h(x, y, 0.85 - d * 0.06);
    }
    t.px(7, 7, G[1]); t.px(8, 7, G[2]); t.px(7, 8, G[2]); t.px(8, 8, G[0]);
    t.px(7, 6, G[5]);
    t.material(0.8, 1, 0.05);
  },
  bell_bottom: (t) => {
    t.transparent();
    const G = PAL.gold;
    for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      const ring = x === 4 || x === 11 || y === 4 || y === 11;
      if (ring) { t.px(x, y, G[x === 11 || y === 11 ? 4 : 2]); t.h(x, y, 0.7); t.m(x, y, 0.8, 1, 0.05); continue; }
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      t.px(x, y, mix(hex(0x120c02), hex(0x4a3408), clamp01(d / 4.5) * (x + y > 15 ? 1 : 0.55))); t.h(x, y, 0.2 + d * 0.05); t.m(x, y, 0.5, 1, 0.1);
    }
    // badalo
    t.px(7, 7, PAL.iron[4]); t.px(8, 7, PAL.iron[2]); t.px(7, 8, PAL.iron[2]); t.px(8, 8, PAL.iron[0]);
    for (const [a, b] of [[7, 7], [8, 7], [7, 8], [8, 8]]) t.h(a, b, 0.6);
  },
};

// ------------------------------------------------------------------ mesa de encantamento (pedra-negra, runas, diamantes, pano vermelho)
const BLACK = pal(0x18141e, 0x201a28, 0x2a2233, 0x352b40, 0x40354e, 0x4e4260);
const CLOTH = pal(0x4e0a12, 0x6e121c, 0x8e1c26, 0xac2830, 0xc83c46);
const DIAM = pal(0x1a7f86, 0x2fb7bd, 0x5fe0dc, 0x9ff6ef, 0xe4fffc);
const RUNE = pal(0x4a3aa0, 0x6a5acd, 0x9a8cff, 0xcfc6ff);

const ENCHANT: Record<string, Painter> = {
  enchanting_table_top: (t) => {
    panel(t, 0, 0, 16, 16, BLACK, { n: 0.3, bevel: 0.3, salt: 2, mat: [0.55, 0, 0.2] });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.abs(x + 0.5 - 8) + Math.abs(y + 0.5 - 8);
      if (d > 6.5) continue;
      if (d > 5.5) { t.px(x, y, PAL.gold[x + y < 16 ? 4 : 2]); t.h(x, y, 0.7); t.m(x, y, 0.7, 1, 0.08); continue; }
      t.px(x, y, pick(CLOTH, 0.55 + (t.fbm(x, y, 3) - 0.5) * 0.4 - (x + y - 15) * 0.02)); t.h(x, y, 0.6); t.m(x, y, 0.03, 0, 0.9);
    }
    sprite(t, ['  a  ', '  a  ', 'aabaa', '  a  ', '  a  '], { a: IRON_INK(PAL.gold[4], 0.7), b: IRON_INK(PAL.gold[5], 0.75) }, 6, 6);
    for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13]]) {
      t.px(x, y, DIAM[4]); t.px(x + 1, y, DIAM[2]); t.px(x, y + 1, DIAM[2]); t.px(x + 1, y + 1, DIAM[0]);
      matRect(t, x, y, 2, 2, 0.95, 0, 0.02, 0.15);
    }
  },
  enchanting_table_side: (t) => {
    t.transparent();
    panel(t, 0, 4, 16, 12, BLACK, { n: 0.3, bevel: 0.3, salt: 4, mat: [0.55, 0, 0.2] });
    // pano pendendo da borda, com barra dourada e borla
    const drape = ['cccccccccc', 'cccccccccc', 'gcccccccg ', ' gccccccg ', '  gggggg  ', '    tt    '];
    sprite(t, drape, { c: { c: CLOTH[2], h: 0.65, m: [0.03, 0, 0.9] }, g: IRON_INK(PAL.gold[3], 0.7), t: IRON_INK(PAL.gold[4], 0.7) }, 3, 4);
    for (let x = 3; x < 13; x++) { t.px(x, 4, CLOTH[4]); t.px(x, 5, pick(CLOTH, 0.5 + t.white(x, 5, 2) * 0.3)); }
    // runas brilhantes
    const glyphs = [['# #', ' # ', '###', ' # '], ['## ', '# #', ' ##', '  #'], [' # ', '###', '# #', '# #']];
    glyphs.forEach((g, i) => sprite(t, g, { '#': { c: RUNE[2 + (i % 2)], h: 0.4, m: [0.6, 0, 0.1, 0.55] } }, 2 + i * 5 - (i === 2 ? 1 : 0), 10));
    for (const x of [0, 14]) { t.px(x, 6, DIAM[4]); t.px(x + 1, 6, DIAM[2]); t.px(x, 7, DIAM[2]); t.px(x + 1, 7, DIAM[0]); matRect(t, x, 6, 2, 2, 0.95, 0, 0.02, 0.15); }
  },
  enchanting_table_bottom: (t) => {
    panel(t, 0, 0, 16, 16, BLACK, { n: 0.3, bevel: 0.3, salt: 6, mat: [0.5, 0, 0.2] });
    disc(t, 8, 8, 5.5, (x, y, d) => { if (d > 4.6) t.px(x, y, mix(t.get(x, y), RUNE[0], 0.35)); });
  },
};

// ------------------------------------------------------------------ oficina pesada: bigorna, poções, caldeirão, composteira, rebolo, cortador
const ANV = pal(0x2e3036, 0x393c42, 0x45494f, 0x52575e, 0x60666e, 0x737a84);
const COMP = pal(0x4a3220, 0x5c3f28, 0x6e4c30, 0x80593a, 0x926844);
const SOIL = pal(0x1e140c, 0x2a1c10, 0x362416, 0x432e1c, 0x523a24);

/** Topo da bigorna: face polida em x3..12 (o resto não é amostrado); `dmg` 0..2 = cada vez mais rachada. */
function anvilTop(t: Tex, dmg: number): void {
  t.transparent();
  for (let y = 0; y < 16; y++) for (let x = 3; x <= 12; x++) {
    let v = 0.46 + (t.white(1, y, 2) - 0.5) * 0.12 + (t.vnoise(x, y, 4, 3) - 0.5) * 0.15;
    const worn = x >= 5 && x <= 10 && y >= 2 && y <= 13;
    if (worn) v += 0.18;
    if (x === 3 || y === 0) v = 0.92;
    if (x === 12 || y === 15) v = 0.1;
    t.px(x, y, pick(ANV, v)); t.h(x, y, x === 12 || y === 15 ? 0.4 : 0.65); t.m(x, y, worn ? 0.72 : 0.55, 1, 0.08);
  }
  // furo quadrado e furinho redondo
  t.px(6, 12, ANV[0]); t.px(7, 12, scale(ANV[0], 0.7)); t.px(6, 13, scale(ANV[0], 0.7)); t.px(7, 13, ANV[2]);
  t.px(10, 12, scale(ANV[0], 0.7)); t.px(11, 13, ANV[4]);
  for (const [x, y] of [[6, 12], [7, 12], [6, 13], [10, 12]]) t.h(x, y, 0.1);
  const crack = (pts: [number, number][]) => { for (const [x, y] of pts) { t.px(x, y, scale(ANV[0], 0.75)); t.h(x, y, 0.1); t.px(x + 1, y + 1, ANV[4]); } };
  const chip = (x: number, y: number) => { t.px(x, y, ANV[1]); t.h(x, y, 0.3); };
  if (dmg >= 1) {
    chip(3, 5); chip(3, 6); chip(12, 9); chip(11, 9);
    crack([[11, 9], [10, 10], [9, 10]]);
  }
  if (dmg >= 2) {
    chip(3, 11); chip(4, 11); chip(8, 15); chip(9, 15); chip(12, 3);
    crack([[4, 3], [5, 4], [6, 4], [7, 5], [8, 6], [8, 7], [9, 8]]);
    crack([[6, 9], [5, 10], [5, 11]]);
    for (let i = 0; i < 9; i++) { const x = 4 + t.rng.nextInt(8), y = 1 + t.rng.nextInt(14); t.px(x, y, mix(t.get(x, y), hex(0x7a4424), 0.55)); t.m(x, y, 0.2, 0.4, 0.6); }
  }
}

const HEAVY: Record<string, Painter> = {
  anvil: (t) => {
    // bandas na altura das partes do modelo: tampo (y0..5), pescoço (y6..10), cintura (y11), base (y12..15)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const nz = (t.white(1, y, 3) - 0.5) * 0.18 + (t.vnoise(x, y, 4, 2) - 0.5) * 0.2;
      let v: number, h = 0.6;
      if (y <= 5) v = y === 0 ? 0.92 : y === 5 ? 0.12 : 0.55 + nz + (y === 1 ? 0.1 : 0);
      else if (y <= 10) { v = y === 6 ? 0.06 : 0.3 + nz; h = 0.4; }
      else if (y === 11) v = 0.64;
      else v = y === 12 ? 0.84 : y === 15 ? 0.1 : 0.5 + nz;
      if (y === 5 || y === 15) h = 0.35;
      t.px(x, y, pick(ANV, v)); t.h(x, y, h);
    }
    for (let i = 0; i < 5; i++) { const x = t.rng.nextInt(15), y = 2 + t.rng.nextInt(3); t.px(x, y, ANV[4]); t.px(x + 1, y, ANV[3]); }
    t.material(0.55, 1, 0.1);
  },
  anvil_top: (t) => anvilTop(t, 0),
  chipped_anvil_top: (t) => anvilTop(t, 1),
  damaged_anvil_top: (t) => anvilTop(t, 2),
  brewing_stand: (t) => {
    t.transparent();
    const I = PAL.iron, B = PAL.brass;
    // haste central (x7..8, y2..15 no modelo) com pomo de latão
    for (let y = 3; y < 16; y++) {
      const n = t.white(0, y, 4) * 0.15;
      t.px(7, y, pick(I, 0.62 + n)); t.px(8, y, pick(I, 0.22 + n)); t.h(7, y, 0.7); t.h(8, y, 0.6);
    }
    sprite(t, ['.43.', '4432', '3210'], { 4: B[4], 3: B[3], 2: B[2], 1: B[1], 0: B[0] }, 6, 0);
    t.px(6, 14, I[3]); t.px(9, 14, I[1]); t.px(6, 15, I[2]); t.px(9, 15, I[0]);
    // braços com ganchos (enfeite fora da região do modelo)
    t.line(6, 5, 3, 8, I[3]); t.line(9, 5, 12, 8, I[2]); t.px(2, 9, I[3]); t.px(13, 9, I[1]); t.px(2, 10, I[2]); t.px(13, 10, I[1]);
    t.material(0.6, 1, 0.1);
  },
  brewing_stand_base: (t) => {
    const B = pal(0x27252b, 0x322f37, 0x3d3a43, 0x49454f, 0x56515d, 0x645e6b);
    panel(t, 0, 0, 16, 16, B, { n: 0.35, bevel: 0, mat: [0.45, 0, 0.2] });
    t.speckle(B[5], 0.05, 7); t.speckle(B[0], 0.05, 8);
    for (let x = 0; x < 16; x++) { t.px(x, 14, pick(B, 0.85)); t.px(x, 15, pick(B, 0.12)); t.h(x, 15, 0.4); }
  },
  cauldron_side: (t) => {
    t.transparent();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (y >= 13 && x >= 4 && x <= 11) continue;
      const nz = (t.fbm(x, y, 3) - 0.5) * 0.3;
      let v = 0.45 + nz, h = 0.6;
      if (y === 0) v = 0.92; else if (y === 1) v = 0.62; else if (y === 2) { v = 0.12; h = 0.4; }
      else if (y === 12) { v = 0.15; h = 0.4; }
      else if (y >= 13) { v = (y === 13 ? 0.6 : y === 14 ? 0.45 : 0.18) + (x === 0 || x === 12 ? 0.2 : x === 3 || x === 15 ? -0.2 : 0); }
      else if (y === 7) v += 0.12;
      t.px(x, y, pick(ANV, v)); t.h(x, y, h);
    }
    for (const [x, y] of [[2, 4], [13, 4], [2, 10], [13, 10], [7, 4], [7, 10]]) rivet(t, x, y, ANV[5], ANV[0]);
    t.material(0.58, 1, 0.1);
  },
  cauldron_top: (t) => {
    t.transparent();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (x >= 2 && x <= 13 && y >= 2 && y <= 13) continue;
      let v = 0.55 + (t.white(x, y, 2) - 0.5) * 0.15;
      if (x === 0 || y === 0) v = 0.9;
      if (x === 15 || y === 15) v = 0.2;
      if ((x === 13 || y === 13) && x > 0 && y > 0) v = 0.72;
      if ((x === 2 || y === 2) && x < 15 && y < 15) v = 0.3;
      t.px(x, y, pick(ANV, v)); t.h(x, y, 0.7);
    }
    t.material(0.5, 1, 0.1);
  },
  cauldron_inner: (t) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      const v = 0.32 + (t.fbm(x, y, 5) - 0.5) * 0.3 - (d < 4 ? 0.12 : 0);
      t.px(x, y, pick(ANV, v)); t.h(x, y, 0.5);
    }
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) rivet(t, x, y, ANV[4], ANV[0]);
    t.material(0.45, 1, 0.1);
  },
  cauldron_bottom: (t) => {
    panel(t, 0, 0, 16, 16, ANV, { n: 0.3, bevel: 0.3, mat: [0.45, 1, 0.1] });
    disc(t, 8, 8, 5.5, (x, y, d) => { if (d > 4.6) { t.px(x, y, ANV[x + y < 16 ? 1 : 4]); t.h(x, y, 0.35); } });
  },
  composter_side: (t) => {
    boards(t, 0, 0, 16, 16, COMP, { vertical: true, size: 4, salt: 3, seams: false });
    boards(t, 0, 0, 16, 2, COMP, { size: 2, salt: 5 });
    boards(t, 0, 11, 16, 3, COMP, { size: 3, salt: 6 });
    panel(t, 0, 14, 16, 2, pal(0x3a2616, 0x4a3220, 0x5a3e28), { n: 0.2, bevel: 0.3, mat: [0.2, 0, 0.6] });
    for (const x of [1, 5, 9, 13]) { t.px(x, 1, hex(0x2a2a2e)); t.px(x + 1, 12, hex(0x2a2a2e)); }
  },
  composter_top: (t) => {
    t.transparent();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (x >= 2 && x <= 13 && y >= 2 && y <= 13) continue;
      const ring = Math.floor(Math.hypot((x % 4) - 1.5, (y % 4) - 1.5)) % 2;
      let v = 0.55 + ring * 0.12 + (t.white(x, y, 3) - 0.5) * 0.15;
      if (x === 0 || y === 0) v += 0.2;
      if (x === 15 || y === 15) v -= 0.3;
      if ((x === 2 || y === 2) && x < 15 && y < 15) v -= 0.22;
      t.px(x, y, pick(COMP, v)); t.h(x, y, 0.65); t.m(x, y, 0.2, 0, 0.6);
    }
  },
  composter_bottom: (t) => {
    boards(t, 0, 0, 16, 16, COMP, { size: 4, salt: 8 });
    disc(t, 8, 8, 5, (x, y, d) => t.px(x, y, mix(t.get(x, y), SOIL[1], 0.55 * (1 - d / 5))));
  },
  composter_compost: (t) => {
    t.noisePal(SOIL, { contrast: 1.3, salt: 4 });
    for (let i = 0; i < 14; i++) {
      const x = t.rng.nextInt(16), y = t.rng.nextInt(16), k = t.rng.nextInt(4);
      if (k === 0) { t.px(x, y, hex(0x4e6e26)); t.px(x + 1, y, hex(0x6a8a32)); }
      else if (k === 1) { t.px(x, y, hex(0x7a5a34)); t.px(x + 1, y + 1, hex(0x6a4a2a)); }
      else if (k === 2) t.px(x, y, hex(0xd8d0bc));
      else t.px(x, y, hex(0x3a5a1e));
      t.h(x, y, 0.7);
    }
    t.material(0.12, 0, 0.9);
  },
  grindstone_side: (t) => {
    const G = pal(0x6e685e, 0x7e776b, 0x8e8679, 0x9e9587, 0xaea596, 0xbeb5a6);
    t.noisePal(G, { contrast: 0.9, salt: 3 });
    t.speckle(G[5], 0.06, 4); t.speckle(G[0], 0.06, 5);
    // face do rebolo (x2..13, y0..11): disco mais claro com sulco externo, anel e cubo central
    disc(t, 8, 6, 6, (x, y, d, dx, dy) => {
      if (d > 5.2) { t.px(x, y, G[0]); t.h(x, y, 0.3); return; }
      const lit = -(dx + dy) / (d + 0.01);
      let v = 0.62 + lit * 0.1 * (d / 5) + (t.white(x, y, 9) - 0.5) * 0.25;
      if (Math.abs(d - 3.2) < 0.45) v -= 0.3;
      if (d > 4.4 && lit > 0.3) v += 0.25;
      if (d > 4.4 && lit < -0.3) v -= 0.2;
      t.px(x, y, pick(G, v)); t.h(x, y, 0.62);
    });
    disc(t, 8, 6, 1.9, (x, y) => { t.px(x, y, PAL.darkWood[2]); t.h(x, y, 0.5); });
    t.px(7, 5, PAL.iron[4]); t.px(8, 5, PAL.iron[2]); t.px(7, 6, PAL.iron[2]); t.px(8, 6, PAL.iron[0]);
    t.material(0.22, 0, 0.55);
    matRect(t, 7, 5, 2, 2, 0.6, 1, 0.1);
  },
  grindstone_pivot: (t) => {
    boards(t, 0, 0, 16, 16, PAL.darkWood, { vertical: true, size: 8, salt: 2 });
    disc(t, 8, 8, 4.2, (x, y, d, dx, dy) => {
      if (d > 2.2) { t.px(x, y, pick(PAL.iron, 0.55 - (dx + dy) * 0.1)); t.h(x, y, 0.75); t.m(x, y, 0.6, 1, 0.1); }
      else { t.px(x, y, d < 1.2 ? hex(0x15161a) : PAL.iron[0]); t.h(x, y, 0.2); t.m(x, y, 0.4, 1, 0.1); }
    });
  },
  stonecutter_top: (t) => {
    panel(t, 0, 0, 16, 16, PAL.smooth, { n: 0.25, bevel: 0.3, mat: [0.35, 0, 0.3] });
    metalPanel(t, 3, 2, 10, 12, PAL.iron, 0.7, { salt: 4 });
    for (let y = 1; y < 15; y++) {
      t.px(7, y, hex(0x16171b)); t.px(8, y, hex(0x202127)); t.h(7, y, 0.1); t.h(8, y, 0.1);
      if (y >= 4 && y <= 11) { const tooth = y % 2 === 0; t.px(tooth ? 7 : 8, y, PAL.iron[tooth ? 5 : 4]); t.h(tooth ? 7 : 8, y, 0.5); t.m(tooth ? 7 : 8, y, 0.85, 1, 0.05); }
    }
    for (const [x, y] of [[4, 3], [11, 3], [4, 12], [11, 12]]) rivet(t, x, y, PAL.iron[5], PAL.iron[0]);
  },
  stonecutter_side: (t) => {
    t.transparent();
    panel(t, 0, 9, 16, 7, PAL.smooth, { n: 0.25, bevel: 0.3, salt: 2, mat: [0.35, 0, 0.3] });
    metalPanel(t, 0, 7, 16, 2, PAL.iron, 0.65, { salt: 3 });
    for (let x = 5; x <= 10; x++) { t.px(x, 12, hex(0x2a2b30)); t.px(x, 13, PAL.smooth[1]); t.h(x, 12, 0.2); }
    for (const x of [1, 13]) rivet(t, x, 11, PAL.iron[4], PAL.iron[0]);
  },
  stonecutter_bottom: (t) => {
    panel(t, 0, 0, 16, 16, PAL.smooth, { n: 0.3, bevel: 0.3, salt: 6, mat: [0.3, 0, 0.35] });
    panel(t, 4, 4, 8, 8, PAL.smooth, { n: 0.2, bevel: -0.25, salt: 7, hgt: 0.5, mat: [0.3, 0, 0.35] });
  },
  stonecutter_saw: (t) => {
    t.transparent();
    disc(t, 8, 8, 7.6, (x, y, d, dx, dy) => {
      const ang = Math.atan2(dy, dx);
      const tooth = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0;
      if (d > 6.4 && !tooth) return;
      const lit = -(dx + dy) / (d + 0.001);
      let v = 0.55 + lit * 0.25 + (d > 6.4 ? 0.25 : 0);
      if (Math.abs(d - 4) < 0.5) v -= 0.25;
      if (d < 1.9) v = d < 0.8 ? 0.95 : 0.08;
      t.px(x, y, pick(PAL.iron, v)); t.h(x, y, d < 1.9 ? 0.8 : 0.6); t.m(x, y, 0.85, 1, 0.05);
    });
  },
};

// ------------------------------------------------------------------ registro
export const UTILITY2_PAINTERS: Record<string, Painter> = {
  ...LIGHTS,
  ...DECOR,
  ...SHINY,
  ...HEAVY,
  ...ENCHANT,
};
