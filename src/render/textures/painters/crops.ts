/**
 * Pintores de plantações em estágios (sprites com fundo transparente, de broto a maduro):
 * trigo, cenoura, batata, beterraba, arbusto de amoras e verruga-brasa do Ínfero.
 * Os estágios são gerados pelo mesmo desenho parametrizado, para a progressão ficar coerente.
 */
import { Tex, type Painter, type RGB, hex, mix } from '../tex';
import { type Blade, type Legend, blades, foliage, frond, glow, sprite } from './plants';

/** Verdes vivos de horta (escuro → claro). */
const CG: RGB[] = [0x1f4a14, 0x2c6419, 0x3a7e1f, 0x4c9a28, 0x62b232, 0x80c84a, 0xa2dc6a].map(hex);
/** Palha e espigas douradas (escuro → claro). */
const GOLD: RGB[] = [0x7a5a18, 0x9c7824, 0xbc9632, 0xd6b046, 0xe8c862, 0xf6e08e].map(hex);

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
function dot(t: Tex, x: number, y: number, c: RGB, h = 0.6, s = 0.28, e = 0): void {
  if (x < 0 || x > 15 || y < 0 || y > 15) return;
  t.px(x, y, c); t.h(x, y, h); t.m(x, y, s, 0, 0.4, e);
}
/** Cor de caule/folha conforme o amadurecimento (0 = verde, 1 = palha dourada). */
const stalkColor = (i: number, ripe: number): RGB => mix(CG[clamp(i, 0, 6)], GOLD[clamp(i - 1, 0, 5)], ripe);

// ------------------------------------------------------------------ trigo
const WHEAT_H = [2, 4, 6, 8, 10, 12, 13, 14];
const WHEAT_EAR = [0, 0, 0, 0, 2, 3, 4, 4];
const WHEAT_RIPE = [0, 0, 0.05, 0.1, 0.2, 0.42, 0.72, 1];
const WHEAT_X = [1, 3, 5, 7, 9, 11, 13, 15, 2, 6, 10, 14];

/** Brotos de trigo (estágios 0..3): leques de lâminas que crescem a cada estágio. */
function wheatShoots(t: Tex, s: number): void {
  const L = [2.6, 4.6, 6.8, 9.5][s];
  const list: Blade[] = [];
  [1, 4, 7, 10, 13].forEach((x, i) => {
    const j = (t.white(i, 2, 5) - 0.5) * 0.3;
    list.push({ x, a: -0.35 + j, k: -0.03, len: L * 0.75, tone: -0.08 });
    list.push({ x: x + 1, a: 0.3 + j, k: 0.03, len: L * 0.8, tone: -0.05 });
    list.push({ x, a: 0.02 + j, k: 0.01, len: L });
  });
  blades(t, list, CG);
}

function wheat(t: Tex, s: number): void {
  if (s < 4) { wheatShoots(t, s); return; }
  const H = WHEAT_H[s], ear = WHEAT_EAR[s], ripe = WHEAT_RIPE[s];
  const n = s < 2 ? 6 : s < 4 ? 8 : 12;
  for (let k = 0; k < n; k++) {
    const back = k >= 8; // hastes de trás, mais baixas e escuras
    const x0 = WHEAT_X[k];
    const h = Math.max(1, H - (back ? 2 : 0) - Math.floor(t.white(k, 3, 1) * (s < 2 ? 2 : 3)));
    const lean = t.white(k, 5, 2) < 0.5 ? -1 : 1;
    const top = 16 - h;
    for (let y = 15; y >= top; y--) {
      const f = (15 - y) / Math.max(1, h);
      const x = x0 + (f > 0.6 && h > 6 ? lean : 0);
      dot(t, x, y, stalkColor((back ? 1 : 2) + Math.round(f * 2), ripe), 0.5 + f * 0.2);
      // folhas estreitas saindo da haste (somem quando amadurece)
      if (s >= 1 && ripe < 0.8 && !back && (y === 13 || (y === 10 && h > 7)) && (k + y) % 2 === 0) {
        dot(t, x + lean, y - 1, stalkColor(4, ripe * 0.6), 0.6);
        if (s >= 3) dot(t, x + 2 * lean, y - 2, stalkColor(5, ripe * 0.6), 0.62);
      }
    }
    if (s <= 1) { dot(t, x0 - 1, top, stalkColor(4, 0), 0.6); dot(t, x0 + 1, top, stalkColor(5, 0), 0.6); }
    if (ear && !back) {
      const ex = x0 + (h > 6 ? lean : 0);
      const cEar = (i: number): RGB => mix(CG[clamp(i + 1, 0, 6)], GOLD[clamp(i, 0, 5)], Math.min(1, ripe * 1.15));
      for (let i = 0; i < ear; i++) {
        const y = top + i;
        dot(t, ex, y, cEar(4 - (i & 1)), 0.75, 0.35);
        dot(t, ex + (i & 1 ? 1 : -1), y, cEar(2 + (i & 1)), 0.7, 0.35);
      }
      if (s >= 6) dot(t, ex, top - 1, cEar(5), 0.8); // aristas
    }
  }
}

// ------------------------------------------------------------------ cenoura (folhagem plumosa)
const CARROT_H = [4, 6, 9, 11];
const CARROT: Legend = { 1: hex(0xa8420c), 2: hex(0xd8661a), 3: hex(0xf08a2c), 4: hex(0xffae52), k: hex(0x5a8a2a) };

function carrots(t: Tex, s: number): void {
  const L = CARROT_H[s];
  for (const [x, dir] of [[3, -1], [8, 1], [13, -1]] as [number, number][]) {
    frond(t, x, 15, -0.45 * dir, 0, L * 0.7, s >= 2 ? 1.6 : 1, CG);
    frond(t, x, 15, 0.1 * dir, 0, L, s >= 2 ? 2 : 1.2, CG);
    if (s >= 1) frond(t, x, 15, 0.5 * dir, 0.02 * dir, L * 0.75, s >= 2 ? 1.6 : 1, CG);
    if (s === 3) sprite(t, ['k.k', '342', '321', '.1.'], CARROT, { ox: x - 1, oy: 12, s: 0.35 });
  }
}

// ------------------------------------------------------------------ batata e beterraba (folhas largas)
/** Folíolo oval (3×2) com realce em cima-esquerda. */
function leaflet(t: Tex, x: number, y: number, p: RGB[], vein?: RGB): void {
  dot(t, x, y, p[5]); dot(t, x + 1, y, p[4]); dot(t, x + 2, y, p[3], 0.55);
  dot(t, x, y + 1, p[4]); dot(t, x + 1, y + 1, vein ?? p[3]); dot(t, x + 2, y + 1, p[2], 0.5);
}

/** Planta de folhas largas: haste central com folíolos alternados do topo para baixo. */
function leafy(t: Tex, x: number, h: number, n: number, p: RGB[], stem: RGB, vein?: RGB): void {
  const top = 16 - h;
  for (let y = 15; y >= top; y--) dot(t, x, y, stem, 0.5);
  for (let j = 0; j < n; j++) {
    const y = top + j * 2, right = j % 2 === 1;
    if (j === 0) leaflet(t, x - 1, y - 1, p, vein);
    else leaflet(t, right ? x + 1 : x - 3, y - 1, p, vein);
  }
}

const POTATO: Legend = { a: hex(0x6e5230), b: hex(0x9a7646), c: hex(0xbc9a62), d: hex(0xd4b67e), w: hex(0xf2f0ea), y: hex(0xf4c84a), p: hex(0xb89ad8) };

function potatoes(t: Tex, s: number): void {
  const H = [3, 6, 9, 11][s], N = [1, 2, 4, 5][s];
  for (const x of [3, 8, 13]) {
    leafy(t, x, H - (x === 8 ? 0 : 1), N, CG, CG[2]);
    if (s === 3) {
      // flores (brancas e lilás) no alto e a batata aparecendo no chão
      sprite(t, ['.w.', 'wyw', '.w.'], POTATO, { ox: x - 1, oy: 16 - H - 3 });
      sprite(t, ['.cd.', 'abcb'], POTATO, { ox: x - 2, oy: 14, s: 0.2 });
    }
  }
  if (s === 3) sprite(t, ['.p.', 'pyp'], POTATO, { ox: 9, oy: 6 });
}

const BEET_LEAF: RGB[] = [0x163d16, 0x1f5020, 0x2a6428, 0x377a32, 0x46903c, 0x5aa44a, 0x78b862].map(hex);
const BEET: Legend = { 1: hex(0x4e0a24), 2: hex(0x7a1236), 3: hex(0xa01e4a), 4: hex(0xc83a66), 5: hex(0xe8688a), r: hex(0x9a1a3a) };

function beetroots(t: Tex, s: number): void {
  const H = [3, 6, 8, 10][s], N = [1, 2, 3, 4][s];
  for (const x of [3, 8, 13]) {
    leafy(t, x, H - (x === 8 ? 0 : 1), N, BEET_LEAF, hex(0x8a1c3a), s >= 2 ? hex(0xa8304e) : undefined);
    if (s === 3) sprite(t, ['.45.', '4332', '3221', '.11.'], BEET, { ox: x - 2, oy: 12, s: 0.4 });
  }
}

// ------------------------------------------------------------------ arbusto de amoras
const BERRY_LEAF: RGB[] = [0x1d4a1f, 0x255e27, 0x2f7330, 0x3c883a, 0x4d9c47, 0x64b058].map(hex);
const BUSH_MASKS: string[][] = [
  ['................', '................', '................', '................', '................', '................',
    '................', '................', '................', '.....#..#.......', '....###.##......', '...#########....',
    '..###########...', '...#########....', '....#######.....', '......###.......'],
  ['................', '................', '................', '................', '................', '......#.#.......',
    '....#.####......', '...#########....', '..###########...', '.#############..', '.#############..', '..############..',
    '..###########...', '...#########....', '....#######.....', '......###.......'],
  ['................', '................', '.....#..##......', '...#.#####.#....', '..###########...', '.#############..',
    '.##############.', '################', '################', '.##############.', '.##############.', '################',
    '.##############.', '..############..', '...##########...', '.....######.....'],
];
const BERRIES: [number, number][] = [[3, 5], [10, 4], [6, 8], [12, 8], [2, 11], [8, 11], [12, 12], [5, 13]];

function berryBush(t: Tex, s: number): void {
  foliage(t, BUSH_MASKS[Math.min(2, s)], BERRY_LEAF, { salt: 6, holes: 0.08 });
  sprite(t, ['.ww.', 'w..w'], { w: hex(0x4a3a22) }, { ox: 6, oy: 14 });
  if (s < 2) return;
  const lg: Legend = s === 2
    ? { h: hex(0xd0ec9e), b: hex(0x94c860), d: hex(0x5e9a3a) }
    : { h: { c: hex(0xffa4a4), s: 0.7 }, b: { c: hex(0xd8243c), s: 0.6 }, d: hex(0x8a1024) };
  for (const [x, y] of BERRIES) sprite(t, ['hb', 'bd'], lg, { ox: x, oy: y });
}

// ------------------------------------------------------------------ verruga-brasa (Ínfero)
const WART: Legend = { 1: hex(0x4a0a14), 2: hex(0x781424), 3: hex(0xa4202e), 4: hex(0xcc3a3a), 5: hex(0xf06a50), g: glow(0xffa060, 0.55, 0.4) };
const WART_MAPS: string[][] = [
  ['................', '................', '................', '................', '................', '................',
    '................', '................', '................', '................', '................', '................',
    '................', '..4...5....4....', '..32..43..432...', '..21.321..221...'],
  ['................', '................', '................', '................', '................', '................',
    '................', '................', '................', '...5.......5....', '..443...5.443...', '..32...443.32...',
    '...2...32..2....', '..32...2...32...', '..21..321..21...', '.221..221.221...'],
  ['................', '................', '................', '................', '....g......g....', '...454....454...',
    '..4443.g.4443...', '..3432.54.3432..', '...32.4443.32...', '...2..3432..2...', '..32...32..32...', '..2...32...2....',
    '..32..2...32....', '...2..32...2....', '..21.321..21....', '.221.221.221....'],
];

// ------------------------------------------------------------------ registro
export const CROP_PAINTERS: Record<string, Painter> = {};
for (let s = 0; s < 8; s++) CROP_PAINTERS[`wheat_stage${s}`] = (t) => wheat(t, s);
for (let s = 0; s < 4; s++) {
  CROP_PAINTERS[`carrots_stage${s}`] = (t) => carrots(t, s);
  CROP_PAINTERS[`potatoes_stage${s}`] = (t) => potatoes(t, s);
  CROP_PAINTERS[`beetroots_stage${s}`] = (t) => beetroots(t, s);
  CROP_PAINTERS[`sweet_berry_bush_${s}`] = (t) => berryBush(t, s);
}
for (let s = 0; s < 3; s++) CROP_PAINTERS[`ember_wart_stage${s}`] = (t) => sprite(t, WART_MAPS[s], WART, { s: 0.4 });
