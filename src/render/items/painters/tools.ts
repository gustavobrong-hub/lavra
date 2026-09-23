/**
 * Sprites de itens (16×16) — ferramentas, armas e utensílios de mão — e o KIT COMUM de desenho
 * usado pelos outros arquivos de sprites de itens (armor, food, materials, misc).
 *
 * Convenções: fundo sempre transparente; o contorno de 1 px é gerado por `outline()` com a cor
 * escurecida do próprio material (mais claro no lado iluminado, mais escuro embaixo/à direita);
 * luz de cima-esquerda; ferramentas na diagonal (cabo embaixo-esquerda, cabeça em cima-direita).
 * Os mapas ASCII trazem só os preenchimentos: '.' e ' ' não pintam nada.
 */
import { Tex, type Painter, type Palette, type RGB, hex, mix, pal, scale } from '../../textures/tex';
import { WOOD_PALS } from '../../textures/styles';

// ================================================================== kit comum
/** Tinta com material opcional (suavidade, metal, emissão). */
export interface Ink { c: RGB; s?: number; m?: number; e?: number }
/** Letra do mapa ASCII → cor ou tinta. */
export type Keys = Record<string, RGB | Ink>;

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const lum = (c: RGB): number => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
/** Tom da paleta (escuro→claro) para v em 0..1. */
export const pick = (p: Palette, v: number): RGB => p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))];
export const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < 16 && y < 16;
export const solid = (t: Tex, x: number, y: number): boolean => inside(x, y) && t.alpha(x, y) > 0;
/** Escurece puxando levemente para o frio (sombras de pixel art). */
export const deepen = (c: RGB, k: number): RGB => [c[0] * k * 0.95, c[1] * k * 0.93, Math.min(255, c[2] * k * 1.04 + 5)];
/** Clareia puxando para o quente. */
export const lighten = (c: RGB, t: number): RGB => mix(c, [255, 250, 232], t);
/** Liga letras a tons de uma paleta: letters[i] → p[i]. */
export function inks(p: Palette, letters: string, s?: number, m?: number, e?: number): Keys {
  const k: Keys = {};
  for (let i = 0; i < letters.length && i < p.length; i++) k[letters[i]] = s === undefined && m === undefined && e === undefined ? p[i] : { c: p[i], s, m, e };
  return k;
}

/** Começa um sprite: tudo transparente, altura neutra e material base. */
export function blank(t: Tex, smooth = 0.3, metal = 0): void {
  t.transparent();
  t.height.fill(0.5);
  t.material(smooth, metal, 0.4, 0);
}

/** Pinta um pixel com tinta (cor + material). Fora do quadro é ignorado (o Tex dá a volta). */
export function dot(t: Tex, x: number, y: number, ink: RGB | Ink, a = 255): void {
  if (!inside(x, y)) return;
  if (Array.isArray(ink)) { t.px(x, y, ink, a); t.h(x, y, 0.6); return; }
  t.px(x, y, ink.c, a);
  t.h(x, y, 0.6);
  if (ink.s !== undefined || ink.m !== undefined || ink.e !== undefined) t.m(x, y, ink.s ?? 0.3, ink.m ?? 0, 0.3, ink.e ?? 0);
}

/** Desenha um mapa ASCII com deslocamento; letras sem tinta, '.' e ' ' não pintam. */
export function draw(t: Tex, rows: string[], keys: Keys, ox = 0, oy = 0): void {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const ink = keys[rows[y][x]];
    if (ink) dot(t, x + ox, y + oy, ink);
  }
}

/** Sprite completo: limpa e desenha o mapa. */
export function sprite(t: Tex, rows: string[], keys: Keys, smooth = 0.3, metal = 0): void {
  blank(t, smooth, metal);
  draw(t, rows, keys);
}

/** Cor de contorno a partir da cor do material: mesmo matiz, luminância limitada (sempre escura). */
export function inkLine(c: RGB, k = 0.45, max = 66): RGB {
  const l = Math.max(1, lum(c));
  return deepen(c, Math.min(l * k, max) / l);
}

/**
 * Contorno automático de 1 px: todo pixel vazio vizinho (4-viz.) de um opaco recebe a cor escurecida do
 * vizinho mais escuro — um pouco mais clara em cima/à esquerda (luz) e mais escura embaixo/à direita.
 * `skip` protege furos que devem continuar vazados.
 */
export function outline(t: Tex, k = 0.45, skip?: (x: number, y: number) => boolean, max = 66): void {
  const src = t.rgba.slice();
  const on = (x: number, y: number) => inside(x, y) && src[(y * 16 + x) * 4 + 3] > 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (on(x, y) || skip?.(x, y)) continue;
    let best: RGB | null = null, bl = 1e9, side = 0;
    for (const [dx, dy] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
      if (!on(x + dx, y + dy)) continue;
      const i = ((y + dy) * 16 + x + dx) * 4;
      const c: RGB = [src[i], src[i + 1], src[i + 2]];
      const l = lum(c);
      if (l < bl) { bl = l; best = c; }
      side += dx + dy < 0 ? 1 : -1;
    }
    if (!best) continue;
    const f = side > 0 ? 0.82 : side < 0 ? 1.18 : 1;
    t.px(x, y, inkLine(best, k * f, max * f));
    t.h(x, y, 0.4);
    t.m(x, y, 0.2, 0, 0.5, 0);
  }
}

/** Realce na borda iluminada (vazio acima/à esquerda) e sombra na oposta, só nos pixels opacos. */
export function rim(t: Tex, hi = 1.14, lo = 0.84): void {
  const a = new Uint8Array(256);
  for (let i = 0; i < 256; i++) a[i] = t.rgba[i * 4 + 3];
  const on = (x: number, y: number) => inside(x, y) && a[y * 16 + x] > 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!on(x, y)) continue;
    const lit = !on(x - 1, y) || !on(x, y - 1), dark = !on(x + 1, y) || !on(x, y + 1);
    if (lit && !dark) t.px(x, y, lighten(scale(t.get(x, y), hi), 0.04));
    else if (dark && !lit) t.px(x, y, scale(t.get(x, y), lo));
  }
}

/**
 * Corpo arredondado sombreado (luz de cima-esquerda): elipse de raios rx, ry; `taper` afina o topo
 * (ovos, gotas). A paleta vai do escuro ao claro; devolve nada, pinta direto.
 */
export function ball(t: Tex, cx: number, cy: number, rx: number, ry: number, p: Palette, taper = 0, amb = 0.12): void {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    if (!inside(x, y)) continue;
    const dy = (y + 0.5 - cy) / ry;
    const w = 1 - Math.max(0, -dy) * taper;
    const dx = (x + 0.5 - cx) / (rx * w);
    const d2 = dx * dx + dy * dy;
    if (d2 > 1) continue;
    const nz = Math.sqrt(1 - d2);
    const v = amb + (1 - amb) * clamp01(-dx * 0.5 - dy * 0.55 + nz * 0.62);
    t.px(x, y, pick(p, v));
    t.h(x, y, 0.45 + nz * 0.4);
  }
}

/** Pixel de brilho (reflexo) — só onde já há matéria. */
export function glint(t: Tex, x: number, y: number, c: RGB = [255, 253, 240], e = 0): void {
  if (!solid(t, x, y)) return;
  t.px(x, y, c);
  if (e) t.emit(x, y, e);
}

/** Emissão em todos os pixels opacos que passam no teste. */
export function glowWhere(t: Tex, test: (c: RGB, x: number, y: number) => boolean, e: number): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (solid(t, x, y) && test(t.get(x, y), x, y)) t.emit(x, y, e);
}

// ================================================================== ferramentas: forma × material
/**
 * Letras dos mapas de ferramenta: 1..4 cabeça (escuro→claro), e = fio (brilho; brasa no ígneo),
 * u = sulco/veio, f g G = guarnição (escuro→claro), b = amarração/colar, h j l = cabo (escuro→claro),
 * w W = empunhadura de couro.
 */
interface ToolMat { head: Palette; edge: Ink; groove?: Ink; fit: Palette; stick: Palette; s: number; m: number }

const STICK = pal(0x4a3019, 0x6e4c2a, 0x94703f);
const WRAP = pal(0x55291a, 0x8a4a2e);
const CORD = pal(0x5c4a2c, 0x8f774a, 0xbba271);
const EMBER: Ink = { c: hex(0xff8a2c), s: 0.4, e: 1 };

export const TOOL_MATS: Record<string, ToolMat> = {
  wooden: { head: pal(0x4a2f17, 0x70492a, 0x98683a, 0xbd8a4e, 0xdcac6c), edge: { c: hex(0xecc88e) }, fit: pal(0x3b2414, 0x5e3a20, 0x84562e), stick: STICK, s: 0.22, m: 0 },
  stone: { head: pal(0x3a3a38, 0x595853, 0x7a7870, 0x9b988f, 0xbcb9af), edge: { c: hex(0xd8d5cb) }, fit: CORD, stick: STICK, s: 0.2, m: 0 },
  iron: { head: pal(0x383d45, 0x626a75, 0x929ba7, 0xc2cad3, 0xe6ecf2), edge: { c: hex(0xf6f9fc), s: 0.85, m: 1 }, fit: pal(0x262930, 0x454a53, 0x6b717b), stick: STICK, s: 0.7, m: 1 },
  golden: { head: pal(0x6a4006, 0xa66c0c, 0xd79d1d, 0xf2c741, 0xfde48a), edge: { c: hex(0xfff8d6), s: 0.9, m: 1 }, fit: pal(0x5a2e08, 0x8c5312, 0xb9791e), stick: STICK, s: 0.85, m: 1 },
  diamond: { head: pal(0x0e4a52, 0x197b85, 0x31b1b5, 0x6ddfd9, 0xc2faf3), edge: { c: hex(0xffffff), s: 0.95 }, fit: pal(0x7a5208, 0xbf8e17, 0xebc33f), stick: STICK, s: 0.92, m: 0 },
  igneous: {
    head: pal(0x160f15, 0x271c24, 0x3b2d35, 0x534249, 0x6d585d), edge: EMBER, groove: { c: hex(0xd8501a), e: 0.8 },
    fit: pal(0x3a1608, 0x8e340c, 0xd05a18), stick: pal(0x241f22, 0x3b3439, 0x564d53), s: 0.6, m: 0.8,
  },
};

function toolKeys(M: ToolMat): Keys {
  const hd = (i: number): Ink => ({ c: M.head[i], s: M.s, m: M.m });
  return {
    1: hd(1), 2: hd(2), 3: hd(3), 4: hd(4), e: M.edge, u: M.groove ?? hd(1),
    f: M.fit[0], g: M.fit[1], G: M.fit[2], b: M.fit[1],
    h: M.stick[0], j: M.stick[1], l: M.stick[2], w: WRAP[0], W: WRAP[1],
  };
}

const SHAPES: Record<string, string[]> = {
  sword: [
    '................',
    '.............4e.',
    '............432.',
    '...........432..',
    '..........4u2...',
    '.........4u2....',
    '........4u2.....',
    '...Gg..4u2......',
    '....gG432.......',
    '.....gG.........',
    '.....wgf........',
    '....W..ff.......',
    '...w............',
    '.Gg.............',
    '.gf.............',
    '................',
  ],
  pickaxe: [
    '................',
    '......3444e33...',
    '....3322222232..',
    '...21......1b21.',
    '...........l131.',
    '..........l..31.',
    '.........j...31.',
    '........l....21.',
    '.......l.....21.',
    '......j......21.',
    '.....l.......2..',
    '....W.......21..',
    '...w........1...',
    '..h.............',
    '................',
    '................',
  ],
  axe: [
    '................',
    '......e443......',
    '.....e44332..l..',
    '....e433322bl...',
    '....e4u222bl3...',
    '....e3221bl21...',
    '.....e21.j......',
    '......2.l.......',
    '.......l........',
    '......j.........',
    '.....l..........',
    '....W...........',
    '...w............',
    '..h.............',
    '................',
    '................',
  ],
  shovel: [
    '................',
    '.............43.',
    '...........e432.',
    '..........e432..',
    '.........e4321..',
    '.........4321...',
    '.........b21....',
    '........l.......',
    '.......j........',
    '......l.........',
    '.....l..........',
    '....W...........',
    '...w............',
    '..h.............',
    '................',
    '................',
  ],
  hoe: [
    '................',
    '................',
    '...444333222b...',
    '...4332.....l...',
    '...4321....l....',
    '..43321...l.....',
    '..eeee1..j......',
    '........l.......',
    '.......l........',
    '......j.........',
    '.....l..........',
    '....W...........',
    '...w............',
    '..h.............',
    '................',
    '................',
  ],
};

function toolSprite(shape: string, mat: string): Painter {
  const M = TOOL_MATS[mat];
  return (t) => {
    sprite(t, SHAPES[shape], toolKeys(M), 0.25, 0);
    // pedra lascada: pintas claras e escuras na cabeça
    if (mat === 'stone') SHAPES[shape].forEach((r, y) => [...r].forEach((ch, x) => {
      if (!/[1-4]/.test(ch)) return;
      const w = t.white(x, y, 5);
      if (w < 0.18) t.px(x, y, M.head[Math.max(1, +ch - 1)]); else if (w > 0.86) t.px(x, y, M.head[Math.min(4, +ch + 1)]);
    }));
    outline(t);
  };
}

const TOOL_FAMILY: Record<string, Painter> = {};
for (const mat of Object.keys(TOOL_MATS)) for (const shape of Object.keys(SHAPES)) TOOL_FAMILY[`${mat}_${shape}`] = toolSprite(shape, mat);

// ================================================================== utensílios e armas avulsas
export const STEEL = pal(0x363b43, 0x5b636e, 0x8a939f, 0xbac3cd, 0xe2e8ee);
export const BRASS = pal(0x5a3c10, 0x8a6424, 0xb88c38, 0xdcb458, 0xf4dc90);
export const GOLD = pal(0x6a4006, 0xa66c0c, 0xd79d1d, 0xf2c741, 0xfde48a);
const FLINT = pal(0x24242b, 0x383842, 0x50505c, 0x70707c, 0x9696a2);
const BAMBOO = pal(0x4f5a1e, 0x7a8a2c, 0xa6b040, 0xcfd06a);
const FEATHER = pal(0x6e1414, 0xa82020, 0xd83a2a);
const VERDIGRIS = pal(0x1d443f, 0x2c6a60, 0x4a9684, 0x84c6ae, 0xcaeedd);
const ASH = pal(0x2b2729, 0x433d3d, 0x5d5553, 0x7a716d, 0x988f8a, 0xb8afa9);
const metal = (p: Palette, s = 0.75): Keys => ({ ...inks(p.slice(1), '1234', s, 1), 0: p[0] });

/** Tesoura de tosquia: duas lâminas paralelas presas por um arco de mola no fim do cabo. */
const SHEARS = [
  '...........43...', '..........43....', '.........42.....', '........42...43.', '.......42...42..', '......42...42...',
  '.....bb...42....', '....W....42.....', '...w....bb......', '..W....W........', '.3....w.........', '.3...W..........', '..33w...........',
];
/** Fuzil de aço em C (em cima) e lasca de sílex (embaixo). */
const STRIKER = ['........344443..', '.......43....32.', '.......3......2.', '.......42....21.', '........2....1..'];
const FLINT_CHIP = ['..44..', '.4443.', '443332', '332232', '.2221.'];
/** Flecha de ponta de sílex com penas de arara. */
const ARROW = [
  '.............4e.', '...........4432.', '............32..', '...........l.2..', '..........l.....', '.........l......', '........j.......',
  '.......l........', '......l.........', '....Rl..........', '...Rlr..........', '..Rlr...........', '..hr............',
];
/** Arpão: ponta de bronze esverdeado com farpas, haste de lume e corda. */
const HARPOON = [
  '.............4e.', '............432.', '..........4432..', '.........3.32...', '..........b.2...', '.........l.1....', '........j.......',
  '.......l........', '......l.........', '.....W..........', '....w...........', '...W............', '..h.............',
];
/** Vara de bambu (nós escuros e empunhadura de corda). */
const ROD = [
  '.............4..', '............3...', '...........n....', '..........4.....', '.........3......', '........n.......',
  '.......4........', '......3.........', '.....n..........', '....W...........', '...w............', '..W.............',
];

/** Escudo de tábuas com aro de ferro, faixa pintada e umbo no centro. */
function shield(t: Tex): void {
  blank(t, 0.25);
  const R = [[3, 12], [2, 13], [2, 13], [2, 13], [2, 13], [2, 13], [2, 13], [2, 13], [2, 13], [2, 13], [3, 12], [4, 11], [5, 10], [7, 8]];
  const on = (x: number, y: number) => y >= 1 && y <= 14 && x >= R[y - 1][0] && x <= R[y - 1][1];
  const P = WOOD_PALS.oak.plank, band = pal(0x6e2016, 0x9a3322, 0xbf4a2e);
  for (let y = 1; y <= 14; y++) for (let x = R[y - 1][0]; x <= R[y - 1][1]; x++) {
    if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) {
      dot(t, x, y, { c: STEEL[!on(x - 1, y) || !on(x, y - 1) ? 3 : 1], s: 0.6, m: 1 });
    } else if (x === 5 || x === 10) dot(t, x, y, P[0]);
    else {
      const lit = x === 3 || x === 6 || x === 11 ? 1 : 0, v = 0.45 + lit * 0.3 - (x - 3) * 0.03 + (t.white(x, y, 3) - 0.5) * 0.25;
      dot(t, x, y, Math.abs(x - y + 1) <= 1 ? pick(band, v) : pick(P, v));
    }
  }
  draw(t, ['41', '10'], { 4: { c: STEEL[4], s: 0.8, m: 1 }, 1: { c: STEEL[2], s: 0.7, m: 1 }, 0: { c: STEEL[1], s: 0.7, m: 1 } }, 7, 6);
  outline(t);
}

/** Asas de cinza abertas em V: borda de ataque clara, penas em faixas e brasas acesas nas pontas. */
function ashWings(t: Tex): void {
  blank(t, 0.15);
  const W = [[1, 2], [1, 3], [1, 5], [2, 6], [2, 7], [3, 7], [3, 7], [4, 7], [4, 7], [5, 7], [6, 7], [7, 7]];
  const inW = (x: number, y: number) => y >= 1 && y <= 12 && x >= W[y - 1][0] && x <= W[y - 1][1];
  for (let y = 1; y <= 12; y++) for (let x = W[y - 1][0]; x <= W[y - 1][1]; x++) for (let side = 0; side < 2; side++) {
    const X = side ? 15 - x : x, lead = !inW(x, y - 1) || !inW(x + 1, y - 1), tip = !inW(x, y + 1) || !inW(x - 1, y);
    let v = 0.62 - side * 0.14 + (t.white(X, y, 1) - 0.5) * 0.12 - ((x + y) % 3 === 0 ? 0.3 : 0);
    if (lead) v = 0.95 - side * 0.12;
    dot(t, X, y, pick(ASH, v));
    if (tip && !lead && (x + y) % 2 === 0) { t.px(X, y, pick(pal(0xa8300c, 0xe8601c, 0xffa848), 0.3 + t.white(X, y, 3) * 0.7)); t.m(X, y, 0.3, 0, 0.4, 0.9); }
  }
  outline(t);
}

/** Caixa redonda (bússola/relógio): aro de metal, mostrador claro com sombra embaixo-direita. */
function roundCase(t: Tex, rim: Palette, face: Palette): void {
  blank(t, 0.5);
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy);
    if (d > 6.6) continue;
    if (d > 5.2) dot(t, x, y, { c: pick(rim, 0.55 - (dx + dy) * 0.07), s: 0.8, m: 1 });
    else dot(t, x, y, { c: pick(face, 0.8 - (dx + dy) * 0.05 - (d > 4.2 ? 0.25 : 0)), s: 0.9 });
  }
}

const FACE = pal(0x9a8f78, 0xc9bfa5, 0xe6dfcb, 0xf7f3e6);
const WOODK: Keys = { h: STICK[0], j: STICK[1], l: STICK[2], w: WRAP[0], W: WRAP[1] };
const RED: Keys = { R: FEATHER[2], r: FEATHER[1], y: hex(0xffd35a), o: hex(0xff7a22) };
/** Arco recurvo de madeira com empunhadura de couro; a corda (sem contorno) vai por último. */
function bow(t: Tex): void {
  blank(t, 0.25);
  const P = pal(0x4a2c14, 0x6c4424, 0x916034, 0xb57f48);
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
    const dx = x + 0.5 - 9.6, dy = y + 0.5 - 9.6, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) / Math.PI;
    if (a > -0.39 && a < 0.5 || a < -1.11 || Math.abs(d - 6.9) > 0.75) continue;
    const grip = Math.abs(a + 0.75) < 0.09;
    dot(t, x, y, grip ? WRAP[(x + y) & 1] : pick(P, 0.5 + (d - 6.9) * 0.6 + (t.white(x, y) - 0.5) * 0.15));
  }
  dot(t, 13, 2, P[2]); dot(t, 2, 13, P[1]);
  outline(t);
  for (let i = 0; i <= 8; i++) dot(t, 11 - i, 4 + i, hex(0xe6dccb));
}

export const TOOL_SPRITES: Record<string, Painter> = {
  ...TOOL_FAMILY,
  shears: (t) => { sprite(t, [], {}); draw(t, SHEARS, { ...metal(STEEL), b: STEEL[1], ...WOODK }, 0, 1); outline(t); },
  flint_and_steel: (t) => {
    sprite(t, [], {});
    draw(t, STRIKER, metal(STEEL), 0, 1);
    draw(t, FLINT_CHIP, inks(FLINT, '01234', 0.7), 1, 8);
    outline(t);
    for (const [x, y, c, e] of [[8, 6, 0xfff2b0, 1], [7, 7, 0xff9a2a, 0.9], [9, 7, 0xffc040, 0.8], [8, 8, 0xff7a1a, 0.6]] as const) { dot(t, x, y, hex(c)); t.emit(x, y, e); }
  },
  fishing_rod: (t) => {
    sprite(t, [], {});
    draw(t, ROD, { ...inks(BAMBOO, '1234', 0.3), n: BAMBOO[0], ...WOODK }, 0, 2);
    draw(t, ['r', 'R', 'W'], { r: FEATHER[1], R: FEATHER[2], W: hex(0xf2efe6) }, 14, 9);
    outline(t);
    for (let y = 3; y <= 8; y++) dot(t, 14, y, hex(0xd8d4ca));
    dot(t, 14, 12, STEEL[3]); dot(t, 13, 13, STEEL[2]);
  },
  bow,
  arrow: (t) => { sprite(t, [], {}); draw(t, ARROW, { ...inks(FLINT, '01234', 0.6), e: FLINT[4], ...WOODK, ...RED }, 0, 1); outline(t); },
  tipped_arrow: (t) => {
    sprite(t, [], {});
    const P = pal(0x7a1a3a, 0xb02a50, 0xe0507a, 0xff8aa8, 0xffd0dc);
    draw(t, ARROW, { ...inks(P, '01234', 0.9), e: P[4], ...WOODK, ...RED }, 0, 1);
    outline(t);
    dot(t, 14, 3, P[2]); t.emit(13, 1, 0.3);
  },
  shield,
  harpoon: (t) => {
    sprite(t, [], {});
    const L = WOOD_PALS.lume.plank;
    draw(t, HARPOON, { ...inks(VERDIGRIS, '01234', 0.7, 0.9), e: { c: hex(0xeafff4), s: 0.9, m: 1 }, b: BRASS[2], h: L[0], j: L[1], l: L[3], W: CORD[2], w: CORD[1] }, 0, 1);
    outline(t);
  },
  ash_wings: ashWings,
  compass: (t) => {
    roundCase(t, BRASS, FACE);
    draw(t, ['.......R', '......Rr', '....SRr.', '...SWr..', '..WWw...', '.Ww.....', 'w.......'],
      { R: hex(0xe8392c), r: hex(0x9e1c18), S: hex(0xff8a70), W: hex(0xeceef4), w: hex(0x8e909e) }, 4, 4);
    for (const [x, y] of [[7, 3], [8, 3], [12, 7], [12, 8], [7, 12], [8, 12], [3, 7], [3, 8]]) dot(t, x, y, FACE[1]);
    outline(t);
  },
  clock: (t) => {
    roundCase(t, GOLD, pal(0x10183a, 0x1a2552, 0x24346c, 0x304684));
    for (const [x, y] of [[7, 3], [8, 3], [12, 7], [12, 8], [7, 12], [8, 12], [3, 7], [3, 8]]) dot(t, x, y, GOLD[2]);
    draw(t, ['.D...', '..D.d', '...d.', '..Dd.'], { D: GOLD[4], d: GOLD[3] }, 4, 5);
    dot(t, 10, 10, hex(0xf6f0c8)); dot(t, 5, 10, hex(0xb0c0f0)); t.emit(10, 10, 0.3);
    dot(t, 7, 0, GOLD[3]); dot(t, 8, 0, GOLD[2]);
    outline(t);
  },
};
