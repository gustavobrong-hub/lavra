/**
 * Sprites de comidas (16×16): frutas e raízes, carnes cruas/assadas (mesmo desenho, paletas diferentes),
 * peixes brasileiros (lambari, tambaqui, baiacu, acará), sopas em tigela, doces, mel, mandioca e bolo.
 * Exporta a tigela, a garrafa e o olho de tecelã (reusados em materials.ts e misc.ts).
 */
import { Tex, type Painter, type Palette, type RGB, hex, mix, pal } from '../../textures/tex';
import { type Keys, GOLD, ball, blank, dot, draw, glint, inks, outline, pick, solid } from './tools';

// ------------------------------------------------------------------ utilidades
/** Pinta os pixels de uma região com tom por posição (luz de cima-esquerda) e ruído leve. */
function region(t: Tex, test: (x: number, y: number) => boolean, P: Palette, base = 0.5, k = 0.06, n = 0.12, salt = 0): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!test(x, y)) continue;
    dot(t, x, y, pick(P, base - (x + y - 15) * k + (t.white(x, y, salt) - 0.5) * n));
  }
}
/** Brilho (emissão) em tudo que é opaco + faíscas. */
function sparkle(t: Tex, pts: number[][], e = 0.2): void {
  for (let i = 0; i < 256; i++) if (t.rgba[i * 4 + 3]) t.emit(i & 15, i >> 4, e);
  for (const [x, y] of pts) { t.px(x, y, [255, 252, 220]); t.emit(x, y, 1); }
}

export const BOWL = pal(0x3e2412, 0x5e3a1e, 0x80522c, 0xa26e3c, 0xc08c52);
/** Tigela de madeira vista de lado-cima; `soup` pinta a superfície (ou o fundo, se vazia). */
export function bowl(t: Tex, soup?: Palette, bits?: [number, number, RGB][]): void {
  blank(t, 0.3);
  const rim = (x: number, y: number) => ((x + 0.5 - 8) / 6.4) ** 2 + ((y + 0.5 - 8) / 2.2) ** 2 <= 1;
  const body = (x: number, y: number) => y >= 8 && y <= 13 && ((x + 0.5 - 8) / 6.4) ** 2 + ((y + 0.5 - 8) / 5.4) ** 2 <= 1;
  region(t, body, BOWL, 0.55, 0.07, 0.1, 1);
  for (let x = 0; x < 16; x++) for (let y = 5; y < 11; y++) {
    if (!rim(x, y)) continue;
    const edge = !rim(x, y - 1) || !rim(x, y + 1) || !rim(x - 1, y) || !rim(x + 1, y);
    if (edge) dot(t, x, y, BOWL[y < 8 ? 4 : 3]);
    else dot(t, x, y, soup ? pick(soup, 0.62 - (x - 8) * 0.04 - (y - 7) * 0.12 + (t.white(x, y, 2) - 0.5) * 0.2) : BOWL[y < 7 ? 0 : 1]);
  }
  for (const [x, y, c] of bits ?? []) dot(t, x, y, c);
  outline(t);
}

export const GLASS = pal(0x6f8a9a, 0x9fb8c6, 0xc8dde6, 0xeef8fc);
/** Garrafa de vidro com rolha; `liquid` enche a parte de baixo (nível `level` em linhas). */
export function bottle(t: Tex, liquid?: Palette, level = 5, emit = 0): void {
  blank(t, 0.9);
  const body = (x: number, y: number) => ((x + 0.5 - 8) / 4.6) ** 2 + ((y + 0.5 - 10) / 4.4) ** 2 <= 1;
  for (let y = 5; y < 15; y++) for (let x = 3; x < 13; x++) {
    if (!body(x, y)) continue;
    const wet = liquid && y >= 14 - level;
    const v = 0.55 - (x - 8) * 0.07 - (y - 10) * 0.03;
    dot(t, x, y, wet ? { c: pick(liquid, v + (y === 14 - level ? 0.3 : 0)), s: 0.8, e: emit } : { c: pick(GLASS, v * 0.7), s: 0.95 });
  }
  draw(t, ['.gG.', '.gG.', 'GGGg'], { g: GLASS[1], G: GLASS[2] }, 6, 3);
  draw(t, ['CC', 'cc'], { C: hex(0xb08050), c: hex(0x7a5230) }, 7, 1);
  outline(t);
  glint(t, 5, 8); glint(t, 5, 9, GLASS[3]); glint(t, 7, 3, GLASS[3]);
}

// ------------------------------------------------------------------ frutas e raízes
const APPLE = pal(0x5a0c14, 0x8a1520, 0xbb2426, 0xdc4230, 0xf07a4e);
const LEAF = pal(0x1f4a14, 0x2f7a1e, 0x4ea82c, 0x86d052);
function apple(t: Tex, P: Palette, leaf: Palette, stem: RGB): void {
  blank(t, 0.6);
  ball(t, 8, 9.2, 5.6, 5.2, P);
  dot(t, 7, 4, P[1]); dot(t, 8, 4, P[0]);
  dot(t, 8, 3, stem); dot(t, 8, 2, stem);
  draw(t, ['.Gg', 'Gg.'], { G: leaf[3], g: leaf[1] }, 9, 1);
  outline(t);
  glint(t, 5, 6); glint(t, 6, 6, P[4]);
}

const CARROT_MAP = [
  '..........G..G..', '..........g.GG..', '..........ggg...', '.........443....', '........4432....', '.......4432.....', '......4r32......',
  '.....4432.......', '....443r........', '....432.........', '...4r2..........', '..432...........', '..32............', '..2.............',
];
const CARROT = pal(0x7a2e08, 0xb44a0c, 0xe06e14, 0xf49a3a, 0xffc070);
const carrot = (P: Palette, L: Palette): Painter => (t) => {
  blank(t, 0.35);
  draw(t, CARROT_MAP, { ...inks(P, '01234'), r: P[1], G: L[3], g: L[1] }, 0, 1);
  outline(t);
};

const POTATO = pal(0x5a3a1a, 0x7e5428, 0xa47438, 0xc4964e, 0xdcb46a);
function potato(t: Tex, P: Palette, spots: RGB, n = 3): void {
  blank(t, 0.2);
  ball(t, 8, 8.8, 5.6, 4.3, P);
  dot(t, 3, 9, P[2]); dot(t, 12, 7, P[1]);
  for (const [x, y] of [[6, 7], [10, 10], [9, 6], [5, 11], [11, 8]].slice(0, n)) { dot(t, x, y, spots); dot(t, x + 1, y, P[3]); }
  outline(t);
}

/** Amora: cacho de drupas redondinhas (textura de bolinhas) com brilho em cima-esquerda. */
function mulberry(t: Tex, cx: number, cy: number, P: Palette): void {
  for (let y = Math.floor(cy - 2.5); y <= cy + 2.5; y++) for (let x = Math.floor(cx - 1.6); x <= cx + 1.6; x++) {
    const dx = (x + 0.5 - cx) / 1.7, dy = (y + 0.5 - cy) / 2.6;
    if (dx * dx + dy * dy > 1) continue;
    dot(t, x, y, pick(P, 0.55 - dx * 0.25 - dy * 0.25 + ((x + y) & 1 ? 0.2 : -0.1)));
  }
}

// ------------------------------------------------------------------ carnes (mesmo mapa cru/assado)
/** Letras: 1..4 carne (escuro→claro), m marmoreio, F f gordura (clara/sombra), O o osso (claro/sombra). */
interface MeatPal { m: Palette; fat: [number, number]; bone: [number, number]; grill?: RGB }
const meatKeys = (P: MeatPal): Keys => ({ ...inks(P.m, '01234'), m: hex(P.fat[1]), F: hex(P.fat[1]), f: hex(P.fat[0]), O: hex(P.bone[1]), o: hex(P.bone[0]) });
/** Marcas de grelha em diagonal sobre a carne (só nos assados). */
function grill(t: Tex, rows: string[], c: RGB, oy = 0): void {
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (/[1-4]/.test(ch) && (x - y - oy + 32) % 5 === 0) t.px(x, y + oy, c); }));
}
function meatMap(rows: string[], P: MeatPal, oy = 0): Painter {
  return (t) => {
    blank(t, P.grill ? 0.35 : 0.5);
    draw(t, rows, meatKeys(P), 0, oy);
    if (P.grill) grill(t, rows, P.grill, oy);
    outline(t);
  };
}

/** Bife de picanha na diagonal: capa de gordura na borda de cima-esquerda, marmoreio e entalhe embaixo. */
function steak(P: MeatPal, torn = false): Painter {
  return (t) => {
    blank(t, P.grill ? 0.35 : 0.5);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const px = x + 0.5 - 8, py = y + 0.5 - 8.4, u = px * 0.87 - py * 0.5, v = px * 0.5 + py * 0.87;
      const half = 4.5 * Math.sqrt(Math.max(0, 1 - (u / 6.7) ** 2)) * (1 + 0.1 * Math.sin(u * 1.4 + 1));
      const edge = half - (Math.abs(u) > 4.5 ? 0.6 : 0) - (v > 0 && u > -2 && u < 1 ? 0.7 : 0);
      if (Math.abs(v) > edge || (torn && t.white(x, y, 9) < 0.3 && Math.abs(v) > edge - 1)) continue;
      if (v < -edge + 1.4) { dot(t, x, y, hex(v < -edge + 0.7 ? P.fat[1] : P.fat[0])); continue; }
      const marb = !P.grill && Math.abs(((u * 0.8 + v * 0.5 + 20) % 4.2) - 2.1) < 0.35 && t.white(x, y, 2) < 0.55;
      dot(t, x, y, marb ? mix(P.m[4], hex(P.fat[1]), 0.4) : pick(P.m, 0.72 - (v + half) * 0.09 + (t.white(x, y, 3) - 0.5) * 0.18));
      if (P.grill && (x - y + 32) % 5 === 0) t.px(x, y, P.grill);
    }
    outline(t);
  };
}
/** Costeleta: aro de gordura e osso de costela saindo embaixo-esquerda. */
const CHOP = [
  '.......FFFf.....', '.....FF4443f....', '....F4444333f...', '...F443m3332f...', '...443333322f...', '...4333m3222f...',
  '....33332221f...', '.....322211f....', '....Oo2211f.....', '...Oo...........', '.OOo............', '.oo.............',
];
const RAW_BEEF: MeatPal = { m: pal(0x5a0e14, 0x8c1c20, 0xb8322c, 0xd8564a, 0xf08a7a), fat: [0xd8c4bc, 0xf6ece6], bone: [0, 0] };
const COOKED_BEEF: MeatPal = { m: pal(0x2e1408, 0x4e2410, 0x74381a, 0x985428, 0xbc7a3e), fat: [0xc88a3c, 0xeec070], bone: [0, 0], grill: hex(0x241006) };
const RAW_PORK: MeatPal = { m: pal(0x7a3038, 0xae5058, 0xd47476, 0xeca09c, 0xffc8c0), fat: [0xe2d4cc, 0xfff6f0], bone: [0xc8bca8, 0xece4d6] };
const COOKED_PORK: MeatPal = { m: pal(0x4a2410, 0x74401c, 0x9c5e2c, 0xc07e40, 0xdca060), fat: [0xd8a050, 0xf6d488], bone: [0xb09878, 0xdccab0], grill: hex(0x2e1408) };
const ROTTEN: MeatPal = { m: pal(0x3a3422, 0x5a5230, 0x7a6e3e, 0x948a52, 0xa8a068), fat: [0x8a9a5a, 0xb0b87a], bone: [0, 0] };

/** Osso com nó na ponta (de x0,y0 descendo para a esquerda, `n` passos). */
function bone(t: Tex, x0: number, y0: number, n: number, b: [number, number]): void {
  for (let i = 0; i < n; i++) { dot(t, x0 - i, y0 + i, hex(b[1])); dot(t, x0 - i + 1, y0 + i, hex(b[0])); }
  const x = x0 - n, y = y0 + n;
  dot(t, x, y, hex(b[1])); dot(t, x + 1, y, hex(b[0])); dot(t, x, y - 1, hex(b[1])); dot(t, x - 1, y, hex(b[1]));
}
/** Aves e caças: corpo e coxas arredondados (formas diferentes para frango, carneiro e coelho). */
function roast(kind: 'chicken' | 'mutton' | 'rabbit', P: Palette, b: [number, number], fatty?: RGB): Painter {
  return (t) => {
    blank(t, 0.4);
    if (kind === 'chicken') {
      ball(t, 7, 9.5, 5.6, 4, P);
      ball(t, 10.8, 5.6, 1.9, 2.2, P); ball(t, 12.6, 8, 1.9, 2, P);
      dot(t, 3, 12, P[1]); dot(t, 2, 11, P[2]);
      bone(t, 13, 2, 1, b); dot(t, 14, 5, hex(b[1])); dot(t, 14, 4, hex(b[1])); dot(t, 15, 5, hex(b[0]));
    } else if (kind === 'mutton') {
      ball(t, 9.6, 6.6, 4.9, 4.4, P);
      ball(t, 6.2, 10, 2.4, 2.2, P);
      bone(t, 4, 11, 2, b);
    } else {
      // coelho limpo visto de cima: corpo, coxas abertas embaixo e patinhas em cima
      ball(t, 4.8, 11.4, 1.8, 2.4, P); ball(t, 11.2, 11.4, 1.8, 2.4, P);
      ball(t, 5.2, 3.8, 1.3, 1.5, P); ball(t, 10.8, 3.8, 1.3, 1.5, P);
      ball(t, 8, 7.6, 3.4, 4.8, P);
      for (const y of [5, 7, 9]) for (const x of [7, 9]) if (solid(t, x, y)) t.px(x, y, P[1]);
      for (const x of [4, 11]) { dot(t, x, 14, hex(b[1])); dot(t, x + 1, 14, hex(b[0])); }
    }
    if (fatty) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (solid(t, x, y) && t.white(x, y, 5) < 0.14 && x + y < 22) t.px(x, y, fatty);
    }
    outline(t);
    for (const [x, y] of kind === 'chicken' ? [[4, 7], [9, 4]] : kind === 'mutton' ? [[7, 4]] : [[6, 4]]) glint(t, x, y, mix(P[4], [255, 255, 255], 0.5));
  };
}
const CHICKEN_RAW = pal(0x9a6a5a, 0xc6968a, 0xe6bcae, 0xf6d8cc, 0xfff0e8);
const CHICKEN_COOKED = pal(0x5a2808, 0x8e4a16, 0xc07226, 0xe29a3e, 0xf8c870);
const MUTTON_RAW = pal(0x5a1418, 0x86242a, 0xae3c3c, 0xcc6058, 0xe48a80);
const MUTTON_COOKED = pal(0x3a1a0c, 0x5e2e14, 0x84481e, 0xa86630, 0xca8a48);
const RABBIT_RAW = pal(0x7a2a2e, 0xa84a48, 0xcc6e66, 0xe6948a, 0xf8bcb2);
const RABBIT_COOKED = pal(0x4a2410, 0x74401c, 0xa0602c, 0xc68444, 0xe4ac66);
const BONE: [number, number] = [0xc8bca8, 0xf0e8da];
const BONE_COOKED: [number, number] = [0xa88e6e, 0xdcc8aa];

// ------------------------------------------------------------------ peixes brasileiros (cabeça à direita)
interface Fish {
  rx: number; ry: number; back: Palette; belly: Palette; tail: [number, number]; eye: number;
  split?: number; stripe?: number; bars?: number; fin?: number; grill?: number; speck?: number;
}
const TAIL = ['T...', 'tT..', '.tt.', 'tT..', 'T...'];
function fish(F: Fish): Painter {
  return (t) => {
    blank(t, 0.65);
    const cx = 8.9, cy = 8, split = F.split ?? 0.15;
    const inBody = (x: number, y: number) => {
      const dx = (x + 0.5 - cx) / F.rx, dy = (y + 0.5 - cy) / F.ry, w = dx < 0 ? 1 + dx * 0.3 : 1;
      return dx * dx + (dy / w) ** 2 <= 1;
    };
    if (F.fin !== undefined) for (let x = Math.round(cx - 2); x <= Math.round(cx + 1); x++) {
      for (let y = 0; y < 16; y++) if (inBody(x, y)) { dot(t, x, y - 1, hex(F.fin)); if (x < cx) dot(t, x, y - 2, hex(F.fin)); break; }
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!inBody(x, y)) continue;
      const dx = (x + 0.5 - cx) / F.rx, dy = (y + 0.5 - cy) / F.ry, belly = dy > split;
      let v = (belly ? 0.75 : 0.55) - dx * 0.12 - dy * 0.3 + (t.white(x, y, 4) - 0.5) * 0.1;
      if (F.bars !== undefined && !belly && Math.abs(x + 0.5 - cx + 1.2) % 3.2 < 0.9 && dx < 0.4) { dot(t, x, y, hex(F.bars)); continue; }
      if (F.speck !== undefined && t.white(x, y, 7) < 0.12) { dot(t, x, y, hex(F.speck)); continue; }
      if (dx > 0.28 && dx < 0.42) v -= 0.25;
      dot(t, x, y, pick(belly ? F.belly : F.back, v));
    }
    if (F.stripe !== undefined) for (let x = Math.round(cx - F.rx * 0.6); x <= Math.round(cx + F.rx * 0.3); x++) dot(t, x, Math.round(cy - 0.5), hex(F.stripe));
    if (F.grill !== undefined) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inBody(x, y) && (x - y + 32) % 4 === 0 && x < cx + F.rx * 0.3) t.px(x, y, hex(F.grill));
    draw(t, TAIL, { T: hex(F.tail[1]), t: hex(F.tail[0]) }, Math.floor(cx - F.rx) - 2, Math.round(cy) - 3);
    outline(t);
    const ex = Math.round(cx + F.rx * 0.55), ey = Math.round(cy - F.ry * 0.35) - 1;
    dot(t, ex, ey, hex(F.eye)); dot(t, ex - 1, ey - 1, [245, 245, 240]);
  };
}

const LAMBARI: Fish = { rx: 5.6, ry: 2.3, back: pal(0x3a4636, 0x566852, 0x7a8e74, 0x9aac94), belly: pal(0x8e9aa0, 0xbcc8cc, 0xe2eaee, 0xf8fcfc), tail: [0xc88a14, 0xf2c230], eye: 0x1a1a20, stripe: 0x3a4244 };
const TAMBAQUI: Fish = { rx: 5.4, ry: 4.6, back: pal(0x1c2022, 0x2c3234, 0x40474a, 0x566062), belly: pal(0x6a5e2c, 0x8e8040, 0xb2a256, 0xcebe70), tail: [0x22262a, 0x3a4044], eye: 0x0e0e10, fin: 0x2a2e30, split: 0.05 };
const ACARA: Fish = { rx: 5, ry: 4.3, back: pal(0x16404e, 0x236a7c, 0x3598a8, 0x5cc2cc), belly: pal(0xa85a14, 0xd88a22, 0xf2b840, 0xfad86a), tail: [0x1e5a6a, 0x3ea2b0], eye: 0xc8281a, bars: 0x163240, fin: 0x2e8a9a, split: 0.3 };
const LAMBARI_FRITO: Fish = { ...LAMBARI, back: pal(0x5a2e0c, 0x86481a, 0xae6a28, 0xcc8c3a), belly: pal(0xb07424, 0xd49a3a, 0xecbe58, 0xf8da80), tail: [0x6a3a10, 0x9a5c1c], eye: 0xe8dcc8, stripe: undefined, speck: 0x6a3410 };
const TAMBAQUI_ASSADO: Fish = { ...TAMBAQUI, back: pal(0x2e160a, 0x4a2610, 0x6a3c1a, 0x8a5626), belly: pal(0x8a5a26, 0xb07e38, 0xd0a452, 0xe6c476), tail: [0x3a1c0c, 0x5a3218], fin: 0x3a1c0c, eye: 0xe8dcc8, grill: 0x2a1206 };

/** Baiacu: bola amarelada com pintas, barriga branca e espinhos em volta. */
function baiacu(t: Tex): void {
  blank(t, 0.5);
  const B = pal(0x4e3e14, 0x7e6a24, 0xae9636, 0xd4bc56, 0xeedc86), W = pal(0xb4b0a0, 0xd8d4c4, 0xf2f0e6);
  for (let y = 2; y < 15; y++) for (let x = 2; x < 15; x++) {
    const dx = (x + 0.5 - 8.6) / 5, dy = (y + 0.5 - 8.4) / 5;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      if (d < 1.28 && (x * 3 + y * 5) % 4 === 0 && x > 3) dot(t, x, y, B[1]);
      continue;
    }
    const lit = 0.6 - dx * 0.3 - dy * 0.35;
    dot(t, x, y, dy > 0.25 ? pick(W, lit + 0.3) : (x * 7 + y * 3) % 9 === 0 ? B[1] : pick(B, lit));
  }
  draw(t, ['T.', 'tT', 'T.'], { T: B[3], t: B[1] }, 1, 7);
  outline(t);
  dot(t, 11, 6, hex(0x141414)); dot(t, 10, 5, [250, 250, 245]); dot(t, 14, 9, hex(0x6a3a1a));
}

// ------------------------------------------------------------------ pães, doces e pratos
/** Cilindro visto de cima-frente (torta, bolo, vasos): tampo elíptico e lateral com sombra à direita. */
export function drum(t: Tex, cx: number, top: number, bot: number, rx: number, ry: number,
  topC: (x: number, y: number, rim: boolean) => RGB | null, sideC: (x: number, y: number, k: number) => RGB): void {
  const inTop = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - top) / ry) ** 2 <= 1;
  const inBot = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - bot) / ry) ** 2 <= 1;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (inTop(x, y)) {
      const c = topC(x, y, !inTop(x - 1, y) || !inTop(x + 1, y) || !inTop(x, y - 1) || !inTop(x, y + 1));
      if (c) dot(t, x, y, c);
    } else if (Math.abs(x + 0.5 - cx) <= rx && y + 0.5 > top && (y + 0.5 <= bot || inBot(x, y))) dot(t, x, y, sideC(x, y, (x + 0.5 - cx) / rx));
  }
}

function bread(t: Tex): void {
  blank(t, 0.2);
  const P = pal(0x6a3a14, 0x9a5a22, 0xc4822e, 0xe0a848, 0xf4cc7a);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const px = x + 0.5 - 8, py = y + 0.5 - 8.4, u = (px - py) * Math.SQRT1_2, v = (px + py) * Math.SQRT1_2;
    if ((u / 6.9) ** 2 + (v / 3.5) ** 2 > 1) continue;
    const cut = Math.abs(u) < 5 && v < 0.9 && Math.abs(((u - v * 0.7 + 30) % 3.3) - 1.65) < 0.5;
    dot(t, x, y, cut ? pick(pal(0xd8b070, 0xf2d898), 0.5 - v * 0.3) : pick(P, 0.66 - v * 0.15 + (t.white(x, y, 1) - 0.5) * 0.12));
  }
  outline(t);
}

function cookie(t: Tex): void {
  blank(t, 0.2);
  ball(t, 8, 8, 5.8, 5.4, pal(0x7a4418, 0xa0622a, 0xc4843a, 0xdca454, 0xeec06e), 0, 0.45);
  for (const [x, y] of [[5, 5], [9, 4], [11, 8], [7, 9], [4, 9], [9, 11]]) { dot(t, x, y, hex(0x3a1c0c)); dot(t, x + 1, y, hex(0x5a3018)); }
  outline(t);
}

function pumpkinPie(t: Tex): void {
  blank(t, 0.3);
  const C = pal(0x6a3a14, 0x9a5c22, 0xc88838, 0xe8b058, 0xf8d488), F = pal(0x8a3a08, 0xb85410, 0xe07a1c, 0xf49e38, 0xffc466);
  drum(t, 8, 7.5, 10, 6.6, 3.8, (x, y, rim) => rim ? C[(x + y) % 2 ? 3 : 4] : pick(F, 0.62 - (x - 8) * 0.05 - (y - 7) * 0.1),
    (x, y, k) => pick(C, 0.55 - k * 0.3 - (y > 11 ? 0.2 : 0) + ((x & 1) ? 0.08 : 0)));
  draw(t, ['.W.', 'WWw', '.w.'], { W: hex(0xfff6e6), w: hex(0xe6d8c0) }, 7, 5);
  outline(t);
}

function cake(t: Tex): void {
  blank(t, 0.3);
  const ICE = pal(0xc8bcb4, 0xe6dcd6, 0xf8f2ee, 0xffffff), CHOC = pal(0x3a1e10, 0x5a3018, 0x7a4424, 0x9a5c32);
  drum(t, 8, 6.5, 10.5, 6.6, 3.6, (x, y) => pick(ICE, 0.7 - (x - 8) * 0.04 - (y - 6) * 0.08),
    (x, y, k) => (y < 9 + ((x * 5) % 3) ? pick(ICE, 0.55 - k * 0.3) : y === 11 ? hex(0xf2e2c4) : pick(CHOC, 0.6 - k * 0.3 - (y > 12 ? 0.25 : 0))));
  for (const [x, y] of [[5, 5], [8, 4], [11, 6], [7, 7], [4, 7]]) { dot(t, x, y, hex(0xd4202a)); dot(t, x, y - 1, hex(0xff6a60)); }
  outline(t);
}

/** Olho de tecelã: trio de olhos lustrosos (a tecelã tem vários); fermentado = murcho, com crosta de açúcar. */
export function spiderEye(t: Tex, fermented = false): void {
  blank(t, 0.85);
  const P = fermented ? pal(0x3e2430, 0x62364a, 0x8a4c64, 0xae6c80, 0xcc96a4) : pal(0x2a0612, 0x520c20, 0x861830, 0xb82c44, 0xe45a6a);
  ball(t, 7, 9.2, 4.6, 4.4, P); ball(t, 12, 5.2, 2.3, 2.3, P); ball(t, 12.6, 10.6, 1.8, 1.8, P);
  for (const [x, y, w] of [[6, 9, 2], [12, 5, 1], [12, 10, 1]]) for (let i = 0; i < w; i++) { dot(t, x + i, y, hex(0x100408)); dot(t, x + i, y + 1, hex(0x100408)); }
  if (fermented) for (const [x, y] of [[4, 6], [8, 6], [5, 12], [10, 12], [11, 3], [13, 4]]) { dot(t, x, y, hex(0xf2ead8)); dot(t, x + 1, y, hex(0xc8b89a)); }
  outline(t);
  glint(t, 4, 7); glint(t, 11, 4); glint(t, 12, 9, P[4]);
}

function driedKelp(t: Tex): void {
  blank(t, 0.2);
  const K = pal(0x18260f, 0x243a16, 0x34521e, 0x4a6a28, 0x628636);
  for (let i = 0; i < 3; i++) for (let y = i === 1 ? 1 : 2; y <= (i === 1 ? 14 : 13); y++) {
    const c = 4.2 + i * 3.7 + Math.sin(y * 0.85 + i * 2.1) * 0.8;
    for (let x = Math.floor(c - 1.5); x <= c + 1.5; x++) {
      const e = x + 0.5 - c;
      if (Math.abs(e) > 1.25) continue;
      dot(t, x, y, pick(K, 0.62 - e * 0.22 - i * 0.06 + ((y + i * 2) % 3 === 0 ? -0.28 : 0) + (t.white(x, y, i) - 0.5) * 0.15));
    }
  }
  for (let x = 0; x < 16; x++) if (solid(t, x, 8)) dot(t, x, 8, (x & 1) ? hex(0xb89c62) : hex(0xd8bc80));
  outline(t);
}

function cassava(t: Tex): void {
  blank(t, 0.25);
  const B = pal(0x3a2210, 0x5a3a1e, 0x7a542c, 0x98703e, 0xb08a52);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const px = x + 0.5 - 8.2, py = y + 0.5 - 7.8, u = (px - py) * Math.SQRT1_2, v = (px + py) * Math.SQRT1_2;
    if (u < -8.2 || u > 5.4) continue;
    const w = u > 1.5 ? 2.9 : 2.9 * Math.max(0, 1 - ((u - 1.5) / 9.9) ** 2) ** 0.8;
    if (Math.abs(v) > w) continue;
    if (u > 3.7) { dot(t, x, y, Math.abs(v) > w - 1 ? hex(0xc86e7a) : Math.abs(v) < 0.7 ? hex(0xdcd0b4) : hex(0xf8f2e4)); continue; }
    const ring = [-4.6, -1.8, 1.2].some((r) => Math.abs(u - r + v * 0.2) < 0.45);
    dot(t, x, y, pick(B, 0.66 - v * 0.17 - (ring ? 0.32 : 0) + (t.white(x, y, 3) - 0.5) * 0.2));
  }
  outline(t);
}

function beetroot(t: Tex): void {
  blank(t, 0.4);
  ball(t, 8, 9.6, 4.4, 4, pal(0x3a0818, 0x5e0e2a, 0x8a1a3e, 0xb02e54, 0xd05a78));
  dot(t, 8, 14, hex(0x5e0e2a));
  draw(t, ['.GG....GG.', 'GgGr..rgGG', '.G..rr..G.', '....rr....', '....rr....'], { G: LEAF[3], g: LEAF[1], r: hex(0xa8203e) }, 3, 1);
  outline(t);
  glint(t, 6, 7);
}

export function melonSlice(t: Tex): void {
  blank(t, 0.5);
  const R = pal(0x8a1420, 0xc02030, 0xe63a44, 0xf8646a, 0xff9a9a);
  for (let y = 2; y <= 13; y++) for (let x = 1; x < 15; x++) {
    const hw = y <= 11 ? (y - 1) * 0.55 : y === 12 ? 5 : 4, dx = Math.abs(x + 0.5 - 8);
    if (dx > hw) continue;
    if (y === 13) dot(t, x, y, (x & 1) ? hex(0x2e6a1e) : hex(0x4a8e2c));
    else if (y === 12) dot(t, x, y, hex(0xdcf0b4));
    else dot(t, x, y, pick(R, 0.7 - (x - 8) * 0.06 - y * 0.02 + (y === 11 ? 0.25 : 0)));
  }
  for (const [x, y] of [[8, 5], [6, 8], [10, 8], [8, 9], [5, 10], [11, 10]]) { dot(t, x, y, hex(0x24140e)); }
  outline(t);
}

function sweetBerries(t: Tex): void {
  blank(t, 0.55);
  const B = pal(0x1a0a1e, 0x341238, 0x561e58, 0x7e2e7a, 0xb45aa8);
  draw(t, ['tt.......GG', '.tTttt..GgG', '....tTTtg..'], { t: hex(0x5a3a1e), T: hex(0x7a5230), G: LEAF[3], g: LEAF[1] }, 2, 2);
  mulberry(t, 4.6, 7.6, B); mulberry(t, 11.4, 7.8, B); mulberry(t, 8, 10.6, B);
  outline(t);
  glint(t, 4, 6, B[4]); glint(t, 7, 9, B[4]); glint(t, 11, 6, B[4]);
}

const HONEY = pal(0x7a3e06, 0xb8660c, 0xe0921a, 0xf4b83a, 0xffd870);

export const FOOD_SPRITES: Record<string, Painter> = {
  apple: (t) => apple(t, APPLE, LEAF, hex(0x5a3a1e)),
  golden_apple: (t) => { apple(t, GOLD, pal(0x5a5a14, 0x8a8a20, 0xc8c040, 0xf0e070), hex(0x8a6a20)); sparkle(t, [[4, 6], [10, 5], [11, 11]]); },
  bread,
  beef: steak(RAW_BEEF),
  cooked_beef: steak(COOKED_BEEF),
  porkchop: meatMap(CHOP, RAW_PORK, 2),
  cooked_porkchop: meatMap(CHOP, COOKED_PORK, 2),
  chicken: roast('chicken', CHICKEN_RAW, BONE),
  cooked_chicken: roast('chicken', CHICKEN_COOKED, BONE_COOKED),
  mutton: roast('mutton', MUTTON_RAW, BONE, hex(0xecdcd0)),
  cooked_mutton: roast('mutton', MUTTON_COOKED, BONE_COOKED, hex(0xe8b060)),
  rabbit: roast('rabbit', RABBIT_RAW, BONE),
  cooked_rabbit: roast('rabbit', RABBIT_COOKED, BONE_COOKED),
  rabbit_stew: (t) => bowl(t, pal(0x5a3010, 0x8a4c1a, 0xb06a28, 0xcc8a3c, 0xe4ac5a),
    [[5, 6, hex(0xf08a24)], [9, 6, hex(0xe8cc70)], [7, 7, hex(0x6a3418)], [11, 7, hex(0xf08a24)], [6, 8, hex(0x4a8a2a)], [10, 8, hex(0xe8cc70)]]),
  lambari: fish(LAMBARI),
  cooked_lambari: fish(LAMBARI_FRITO),
  tambaqui: fish(TAMBAQUI),
  cooked_tambaqui: fish(TAMBAQUI_ASSADO),
  baiacu,
  acara: fish(ACARA),
  carrot: carrot(CARROT, LEAF),
  golden_carrot: (t) => { carrot(GOLD, pal(0x5a5a14, 0x8a8a20, 0xc8c040, 0xf0e070))(t); sparkle(t, [[9, 5], [5, 9], [12, 2]]); },
  potato: (t) => potato(t, POTATO, hex(0x4a3014)),
  baked_potato: (t) => {
    potato(t, pal(0x3e2210, 0x60361a, 0x86502a, 0xa8703c, 0xc8904e), hex(0x2e1a0c), 1);
    draw(t, ['.YY.', 'YyyY', '.yB.'], { Y: hex(0xfff0b8), y: hex(0xf0d890), B: hex(0xffe25a) }, 6, 6);
  },
  poisonous_potato: (t) => potato(t, pal(0x3e4a1a, 0x5e6a28, 0x80883a, 0xa0a452, 0xbcc070), hex(0x6a2a6a), 5),
  beetroot,
  beetroot_soup: (t) => bowl(t, pal(0x5a0a22, 0x8a1434, 0xb42848, 0xd44a64, 0xec7a8e), [[6, 6, hex(0xf6e0e0)], [7, 6, hex(0xe8b4bc)], [10, 7, hex(0xf6e0e0)]]),
  mushroom_stew: (t) => bowl(t, pal(0x4a2a14, 0x6e4220, 0x94602e, 0xb07c42, 0xc89a5a),
    [[5, 6, hex(0xe8dcc0)], [6, 6, hex(0xc8b490)], [9, 6, hex(0xb0302a)], [10, 7, hex(0xe8dcc0)], [7, 8, hex(0xc8b490)]]),
  melon_slice: melonSlice,
  sweet_berries: sweetBerries,
  cookie,
  pumpkin_pie: pumpkinPie,
  rotten_flesh: (t) => {
    steak(ROTTEN, true)(t);
    for (const [x, y] of [[5, 8], [9, 6], [8, 10], [11, 9]]) if (solid(t, x, y) && solid(t, x + 1, y)) { t.px(x, y, hex(0x2a2616)); t.px(x + 1, y, hex(0x6a4a3a)); }
  },
  spider_eye: (t) => spiderEye(t),
  dried_kelp: driedKelp,
  honey_bottle: (t) => { bottle(t, HONEY, 6); dot(t, 6, 5, HONEY[3]); },
  cassava,
  cake,
};
