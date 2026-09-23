/**
 * Sprites de materiais (16×16): graveto, carvões, minérios brutos, lingotes (barra trapezoidal própria com
 * selo), pepitas, gemas, pós (montinhos), bolas, tijolos, papel/livro, sementes, itens do Ínfero, partes de
 * criaturas e as 16 tintas (potinho de barro com o pigmento transbordando, cores de COLORS).
 * Exporta `book` (usado por misc.ts no livro encantado e no livro e pena).
 */
import { Tex, type Painter, type Palette, type RGB, hex, mix, pal } from '../../textures/tex';
import { COLORS } from '../../../world/blocks/defs/building';
import { GOLD, ball, blank, clamp01, dot, draw, glint, inks, outline, pick, solid } from './tools';
import { bottle, bowl, melonSlice, spiderEye } from './food';

// ------------------------------------------------------------------ formas reutilizadas
/** Montinho de pó com grãos soltos; `e` = emissão (pós luminosos). */
function pile(t: Tex, P: Palette, e = 0, grains: RGB[] = []): void {
  blank(t, 0.1);
  for (let y = 5; y < 15; y++) for (let x = 1; x < 15; x++) {
    const dx = (x + 0.5 - 8) / 6.2, top = 13.6 - 7.6 * Math.exp(-dx * dx * 2.2) + Math.sin(x * 1.7) * 0.4;
    if (Math.abs(dx) > 1 || y + 0.5 < top) continue;
    const v = 0.72 - dx * 0.35 - (y - top) * 0.07 + (t.white(x, y, 1) - 0.5) * 0.35;
    dot(t, x, y, { c: pick(P, v), s: 0.1, e: e * (0.5 + v * 0.5) });
  }
  grains.forEach((c, i) => { const x = 2 + ((i * 5 + 3) % 12), y = 7 + ((i * 3) % 4); if (solid(t, x, y + 3)) dot(t, x, y + 3, c); });
  for (const [x, y] of [[2, 13], [13, 14], [14, 12]]) dot(t, x, y, { c: P[2], e });
  outline(t);
}

/** Bolota arredondada (gosma, argila, neve, creme de magma). */
function blob(t: Tex, P: Palette, dents: [number, number][] = [], shine = true): void {
  blank(t, 0.5);
  ball(t, 8, 8.4, 5.2, 4.8, P);
  ball(t, 11.2, 11, 2.2, 2, P);
  for (const [x, y] of dents) { dot(t, x, y, P[1]); dot(t, x + 1, y + 1, P[3]); }
  outline(t);
  if (shine) { glint(t, 5, 6); glint(t, 6, 5, P[4]); }
}

/** Lingote: barra trapezoidal vista de cima-frente com selo no tampo. */
const INGOT = [
  '......4444443...', '.....44s44443...', '....444444433...', '...e3333333322..', '...32222222211..', '...22222222111..', '....111111110...',
];
function ingot(P: Palette, stamp: RGB, metal = 1, glow = 0): Painter {
  return (t) => {
    blank(t, 0.75, metal);
    draw(t, INGOT, { ...inks(P, '01234', 0.75, metal), s: { c: stamp, s: 0.5, m: metal, e: glow }, e: { c: mix(P[4], [255, 255, 255], 0.6), s: 0.9, m: metal } }, 0, 4);
    outline(t);
  };
}

/** Pepitas: três pedrinhas arredondadas e brilhantes. */
function nugget(P: Palette, metal = 1): Painter {
  return (t) => {
    blank(t, 0.8, metal);
    ball(t, 6.4, 9.4, 2.8, 2.5, P); ball(t, 10.4, 10.4, 2.3, 2, P); ball(t, 9, 6.4, 2, 1.8, P);
    outline(t);
    glint(t, 5, 8); glint(t, 8, 5); glint(t, 10, 9, P[4]);
  };
}

/** Minério bruto: torrão irregular com fendas escuras e pintas claras. */
function rawOre(P: Palette, specks: RGB, metal = 0.5): Painter {
  return (t) => {
    blank(t, 0.35, metal);
    ball(t, 7, 9, 4.6, 4, P, 0, 0.2); ball(t, 10.4, 6.8, 3.2, 3, P, 0, 0.2); ball(t, 11, 11, 2.6, 2.2, P, 0, 0.2);
    for (const [x, y] of [[6, 8], [7, 8], [9, 10], [10, 6], [5, 11]]) if (solid(t, x, y)) t.px(x, y, P[0]);
    for (const [x, y] of [[5, 7], [9, 5], [11, 9], [7, 11], [12, 12]]) if (solid(t, x, y)) t.px(x, y, specks);
    outline(t);
  };
}

/** Gema lapidada (coroa + pavilhão), com mesa e facetas. */
const GEM = ['.....4e4433.....', '....44443332....', '...e444333221...', '...4433332211...', '....43322111....', '.....332211.....', '......3211......', '.......21.......'];
const EMERALD_CUT = [
  '......4443......', '.....4e4433.....', '....44333332....', '....43444432....', '....434e4432....', '....43444332....', '....43443322....',
  '....43333321....', '.....322221.....', '......2211......',
];
function gem(rows: string[], P: Palette, oy: number, smooth = 0.95): Painter {
  return (t) => {
    blank(t, smooth);
    draw(t, rows, { ...inks(P, '01234', smooth), e: { c: [255, 255, 255], s: 1 } }, 0, oy);
    outline(t);
  };
}

/** Cristal prismático vertical (face esquerda clara, aresta, face direita escura) com ponta; `lean` inclina. */
function prism(t: Tex, x0: number, base: number, h: number, P: Palette, lean = 0): void {
  for (let i = 0; i < h; i++) {
    const y = base - i, x = x0 + Math.round(i * lean), tip = i >= h - 2;
    if (tip && i === h - 1) { dot(t, x + 1, y, P[4]); continue; }
    dot(t, x, y, P[tip ? 4 : 3]); dot(t, x + 1, y, P[tip ? 3 : 4 - (i % 4 === 1 ? 1 : 0)]); dot(t, x + 2, y, P[tip ? 2 : 1]);
  }
}

/** Caixa em perspectiva (tijolos): tampo, frente e lateral direita. */
const BOX = ['.....444444443..', '....4444444432..', '...33333333321..', '...22222222221..', '...22222222211..', '...2121212211...', '...111111111....'];

const WOODS = pal(0x4a3019, 0x6e4c2a, 0x94703f, 0xb08a52);
const STICK_MAP = [
  '............l...', '...........j....', '..........l.....', '....G....l......', '....jl..j.......', '......lk........',
  '......l.........', '.....j..........', '....l...........', '...l............', '..j.............', '.h..............',
];
const BONE_MAP = [
  '...........OO...', '...........Oo...', '............OOo.', '...........Oooo.', '..........Oo....', '.........Oo.....', '........Oo......',
  '.......Oo.......', '......Oo........', '.....Oo.........', '.OO.Oo..........', '.OoOo...........', '...Oo...........', '...oo...........',
];
const HIDE = ['..33.......22...', '..3433333332....', '...44333332.....', '...43333322.....', '...43333322.....', '...43332322.....', '...43333222.....', '..343332221.....', '..22.....11.....'];
const WHEAT = ['.......43.......', '...43..34..43...', '...34..43..34...', '...43..34..43...', '...34..43..34...', '....3..32..3....', '.....s..s.s.....', '......s.ss......', '......sss.......', '.....bbbbb......', '.....s.s.s......', '....s..s..s.....', '...s...s...s....'];
const PAPER = ['...4444444444...', '...4333333333...', '...4bbbbbbbb3...', '...4333333333...', '...4bbbbbbb33...', '...4333333333...', '...4bbbbbbbb3...', '...43333333322..', '...4bbbbbb3221..', '...433333321....', '...3222222.1....'];

/** Livro fechado visto de cima: capa com cantoneiras e faixa, lombada à esquerda e folhas à direita/embaixo. */
export function book(t: Tex, cover: Palette, band: RGB, pages: RGB = hex(0xf2e8d0)): void {
  blank(t, 0.3);
  for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) {
    if (y === 13 || x === 13) { if (x > 2 && y > 2) dot(t, x, y, y === 13 && x === 13 ? mix(pages, [0, 0, 0], 0.3) : mix(pages, [0, 0, 0], (x + y) % 2 ? 0.12 : 0)); continue; }
    if (x === 2) { dot(t, x, y, cover[1]); continue; }
    const v = 0.62 - (x - 7) * 0.035 - (y - 7) * 0.035 + (t.white(x, y, 2) - 0.5) * 0.12;
    dot(t, x, y, y === 2 || x === 3 ? cover[4] : x === 12 || y === 12 ? cover[1] : pick(cover, v));
  }
  for (let y = 3; y <= 11; y++) dot(t, 7, y, band);
  for (const [x, y] of [[4, 3], [11, 3], [4, 11], [11, 11]]) dot(t, x, y, GOLD[3]);
  outline(t);
}

/** Semente: carimbo 2×2 ou 2×3 conforme o tipo. */
const SEED: Record<string, string[]> = { grain: ['L.', 'ld', '.d'], round: ['Ll', 'ld'], flat: ['.L.', 'Lld', 'ldd', '.d.'], drop: ['L.', 'ld', 'dd'] };
function seeds(kind: string, P: Palette, pts: number[][]): Painter {
  return (t) => {
    blank(t, 0.35);
    for (const [x, y] of pts) draw(t, SEED[kind], { L: P[3], l: P[2], d: P[1] }, x, y);
    outline(t);
  };
}

/** Coração de Ignarca: pedra escura em forma de coração, rachaduras de brasa e núcleo que pulsa. */
function ignarcaHeart(t: Tex): void {
  blank(t, 0.4);
  const pulse = 0.78 + 0.22 * Math.sin((t.frame / Math.max(1, t.frames)) * Math.PI * 2);
  const S = pal(0x140c0e, 0x241618, 0x362224, 0x4a3032), E = pal(0x8a1e06, 0xd04a10, 0xff8a2a, 0xffc860, 0xfff0c0);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const X = x + 0.5, Y = y + 0.5;
    if (!(Math.hypot(X - 5, Y - 6.2) < 3.1 || Math.hypot(X - 11, Y - 6.2) < 3.1 || (Y >= 6.2 && Math.abs(X - 8) <= (14 - Y) * 0.8))) continue;
    const dx = X - 8, dy = Y - 7.8, r = Math.hypot(dx, dy);
    const crack = r > 1.8 && r < 5.6 && Math.abs(((Math.atan2(dy, dx) / Math.PI * 2.5 + r * 0.12 + 12) % 1) - 0.5) < 0.1;
    if (r < 2 || crack) dot(t, x, y, { c: pick(E, clamp01(1.05 - r * 0.15) * pulse + 0.1), s: 0.5, e: clamp01(1.25 - r * 0.12) * pulse });
    else dot(t, x, y, pick(S, 0.7 - (x + y - 15) * 0.05 + (t.white(x, y, 1) - 0.5) * 0.3));
  }
  outline(t);
  glint(t, 4, 4, S[3]); glint(t, 10, 4, S[3]);
}

/** Tinta: frasquinho atarracado de boca larga, cheio de pigmento em pó (a cor domina o ícone). */
function dyePot(rgb: number): Painter {
  return (t) => {
    blank(t, 0.3);
    const c = hex(rgb), P: Palette = [mix(c, [8, 6, 16], 0.5), mix(c, [8, 6, 16], 0.25), c, mix(c, [255, 250, 235], 0.25), mix(c, [255, 250, 235], 0.5)];
    for (let y = 5; y <= 14; y++) for (let x = 3; x <= 12; x++) {
      const corner = (y === 14 || y === 5) && (x === 3 || x === 12);
      if (corner || (y === 5 && (x === 4 || x === 11))) continue;
      if (y === 5 || y === 6) { dot(t, x, y, { c: pick(GLASSY, y === 5 ? 0.9 : 0.5 - (x - 8) * 0.06), s: 0.9 }); continue; }
      dot(t, x, y, { c: pick(P, 0.62 - (x - 7) * 0.07 - (y - 9) * 0.03 + (t.white(x, y, 1) - 0.5) * 0.3), s: 0.25 });
    }
    for (let y = 7; y <= 12; y++) dot(t, 4, y, { c: mix(P[4], [255, 255, 255], 0.35), s: 0.9 });
    draw(t, ['CCcc', 'cccc'], { C: hex(0xb48454), c: hex(0x7e5634) }, 6, 3);
    outline(t);
  };
}
const GLASSY = pal(0x8aa2b0, 0xb4c8d2, 0xd6e6ec, 0xf2fafc);

/** Carvão vegetal: toco carbonizado com veios, rachaduras e anéis na ponta. */
function charcoal(t: Tex): void {
  blank(t, 0.25);
  const C = pal(0x141010, 0x221a16, 0x322622, 0x463630, 0x5e4a40);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const px = x + 0.5 - 8, py = y + 0.5 - 8.5, u = (px - py) * Math.SQRT1_2, v = (px + py) * Math.SQRT1_2;
    if (Math.abs(u) > 5.8 || Math.abs(v) > 2.9 - (u < -4.6 ? 0.8 : 0)) continue;
    if (u > 4.4) { dot(t, x, y, pick(C, 0.3 + (Math.floor(Math.abs(v) * 1.6) % 2) * 0.45)); continue; }
    const crack = Math.abs(((u + 10) % 2.6) - 1.3) < 0.3 && v < 1.4;
    dot(t, x, y, pick(C, 0.58 - v * 0.14 + (Math.floor(v * 1.5 + 10) % 2 ? 0.1 : -0.1) - (crack ? 0.35 : 0) + (t.white(x, y, 3) - 0.5) * 0.15));
  }
  outline(t);
}

const P5 = (...h: number[]): Palette => pal(...h);
const IRON = P5(0x3a3f47, 0x6a727d, 0x9ba4af, 0xc9d0d8, 0xecf1f5);
const EMBERP = P5(0x5a1406, 0x9a2e0a, 0xd8561a, 0xf88a2a, 0xffc05a);
const box = (P: Palette): Painter => (t) => {
  blank(t, 0.2); draw(t, BOX, inks(P, '01234'), 0, 5);
  for (const [x, y] of [[5, 9], [9, 8], [7, 10], [11, 9]]) t.px(x, y, P[1]);
  outline(t);
};

export const MATERIAL_SPRITES: Record<string, Painter> = {
  stick: (t) => { blank(t, 0.2); draw(t, STICK_MAP, { h: WOODS[0], j: WOODS[1], l: WOODS[2], k: WOODS[0], G: hex(0x5ea82e) }, 0, 2); outline(t); },
  coal: (t) => { rawOre(P5(0x101012, 0x1c1c20, 0x2a2a30, 0x3c3c44, 0x56565f), hex(0x9aa2b4), 0)(t); t.material(0.6, 0, 0.2); },
  charcoal,
  raw_iron: rawOre(P5(0x6e5040, 0x8e6d57, 0xb08c72, 0xcdab8f, 0xe4c8ac), hex(0xf4e0c8)),
  raw_copper: rawOre(P5(0x6a3418, 0x9a4e26, 0xc06a34, 0xd8864c, 0xeeaa74), hex(0x5fae90)),
  raw_gold: rawOre(P5(0x8a6008, 0xb88a12, 0xdcb02a, 0xf0cc4a, 0xfce488), hex(0xfff6c0), 0.9),
  iron_ingot: ingot(IRON, hex(0x7a828d)),
  copper_ingot: ingot(P5(0x5a2a14, 0x8e4624, 0xbc6636, 0xdc8a52, 0xf2b07e), hex(0x9a522a)),
  gold_ingot: ingot(GOLD, hex(0xb07a10)),
  igneous_ingot: (t) => {
    ingot(P5(0x140e12, 0x261c22, 0x3a2c33, 0x524047, 0x6c585c), hex(0xff8a2c), 0.8, 1)(t);
    for (const x of [4, 7, 10, 12]) { t.px(x, 7, EMBERP[3]); t.emit(x, 7, 0.9); }
  },
  iron_nugget: nugget(IRON),
  gold_nugget: nugget(GOLD),
  diamond: gem(GEM, P5(0x0e4a52, 0x1f8a92, 0x44c4c4, 0x8ceee6, 0xdcfffa), 4),
  emerald: gem(EMERALD_CUT, P5(0x0a4a1e, 0x10742e, 0x1ea244, 0x4cd072, 0xa8f5c0), 3),
  lapis_lazuli: rawOre(P5(0x0f2a78, 0x1b3fa3, 0x2957c9, 0x4677e0, 0x86a8f2), hex(0xe8c860), 0),
  fulgor_dust: (t) => pile(t, P5(0x0c4d5c, 0x137a8f, 0x1fb2c9, 0x5de4f0, 0xc8fbff), 0.6),
  quartz: (t) => { blank(t, 0.9); const Q = P5(0x8a7c7a, 0xbeb0ac, 0xe0d6d2, 0xf6f0ec, 0xffffff); prism(t, 2, 13, 7, Q, 0.15); prism(t, 9, 13, 8, Q, -0.2); prism(t, 5, 13, 11, Q); outline(t); },
  amethyst_shard: (t) => { blank(t, 0.9); const A = P5(0x3e2468, 0x5c3690, 0x7e52b8, 0xa47ad8, 0xd4b8f4); prism(t, 9, 13, 6, A, 0.35); prism(t, 3, 13, 12, A, 0.45); outline(t); },
  ancient_scrap: (t) => {
    rawOre(P5(0x1e1512, 0x2a1d18, 0x36251e, 0x432e25, 0x5e4334), hex(0x6e5444), 0.3)(t);
    for (const [x, y] of [[8, 8], [9, 8], [9, 9], [8, 10], [7, 10], [6, 9], [6, 8], [7, 7], [8, 6], [9, 6], [10, 7]]) { t.px(x, y, EMBERP[(x + y) % 2 ? 3 : 2]); t.emit(x, y, 0.8); }
  },
  flint: (t) => {
    blank(t, 0.6);
    ball(t, 7.8, 8.4, 4, 5.8, P5(0x24242b, 0x383842, 0x50505c, 0x70707c, 0x9696a2), 0.45);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (solid(t, x, y) && Math.floor(Math.hypot(x + 0.5 - 9, y + 0.5 - 14.5)) % 3 === 0) t.shadePx(x, y, 0.72);
    outline(t);
    glint(t, 6, 5);
  },
  feather: (t) => {
    blank(t, 0.15);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const px = x + 0.5 - 8.5, py = y + 0.5 - 7.5, u = (px - py) * Math.SQRT1_2, v = (px + py) * Math.SQRT1_2;
      const w = u < -4 ? 0 : 2.6 * Math.sin(Math.PI * (u + 4) / 10.6);
      if (Math.abs(v) < 0.5 && u > -7 && u < 6.3) { dot(t, x, y, hex(u < -4 ? 0xb8a488 : 0xe8dcc4)); continue; }
      if (Math.abs(v) > w || (u > -1.2 && u < -0.4 && v > 0)) continue;
      dot(t, x, y, pick(P5(0x9a9aa4, 0xc4c4cc, 0xe2e2e8, 0xf6f6fa, 0xffffff), 0.8 - v * 0.14 - (u > 4 ? 0.3 : 0)));
    }
    outline(t);
  },
  string: (t) => {
    blank(t, 0.2);
    const S = P5(0xa8a49a, 0xc8c4ba, 0xe2dfd6, 0xf4f2ea, 0xffffff);
    for (const [cx, cy] of [[7, 7.2], [8.8, 9]]) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x + 0.5 - cx) / 4.6, (y + 0.5 - cy) / 3.8);
      if (Math.abs(d - 1) < 0.17) dot(t, x, y, pick(S, 0.8 - (x + y - 15) * 0.05));
    }
    for (const [x, y] of [[12, 12], [13, 13], [13, 14]]) dot(t, x, y, S[2]);
    outline(t);
  },
  leather: (t) => { blank(t, 0.2); draw(t, HIDE, inks(P5(0x3e2414, 0x5e3820, 0x7e4e2e, 0x9e683e, 0xbc8552), '01234'), 1, 3); outline(t); },
  rabbit_hide: (t) => {
    blank(t, 0.05);
    draw(t, HIDE, inks(P5(0x5e5246, 0x847462, 0xa89680, 0xc6b6a0, 0xe0d4c2), '01234'), 1, 3);
    for (const [x, y] of [[5, 5], [8, 7], [6, 9], [10, 6], [4, 8], [9, 10]]) dot(t, x, y, hex(0xf6f0e6));
    outline(t);
  },
  bone: (t) => { blank(t, 0.3); draw(t, BONE_MAP, { O: hex(0xf2ecdf), o: hex(0xc9bfa9) }, 0, 1); outline(t); },
  bone_meal: (t) => pile(t, P5(0xa8a494, 0xc8c4b2, 0xdedacb, 0xefece0, 0xfbf9f2), 0, [hex(0x9a9688), hex(0xffffff)]),
  gunpowder: (t) => pile(t, P5(0x26262a, 0x3a3a40, 0x505058, 0x6a6a72, 0x86868e), 0, [hex(0x16161a), hex(0xa8a8b0), hex(0x8a3a2a)]),
  slime_ball: (t) => {
    blob(t, P5(0x2a6a1e, 0x3e9a2a, 0x5cc43a, 0x8ae05a, 0xc0f890));
    for (const [x, y] of [[8, 9], [9, 9], [8, 10], [9, 8]]) t.px(x, y, hex(0x2e7a22));
  },
  clay_ball: (t) => blob(t, P5(0x5a6272, 0x76808e, 0x949eaa, 0xb2bac4, 0xcad0d8), [[6, 9], [9, 6], [10, 10]], false),
  brick: box(P5(0x6a2a1a, 0x8e3a24, 0xb04e30, 0xc8683e, 0xdc8658)),
  infero_brick: box(P5(0x240a0c, 0x3a1214, 0x521c1e, 0x6a2628, 0x843434)),
  paper: (t) => { blank(t, 0.15); draw(t, PAPER, { ...inks(P5(0xa8a08c, 0xc8c0aa, 0xe6e0cc, 0xf4f0e2, 0xfffcf2), '01234'), b: hex(0xb8c4d4) }, 0, 2); outline(t); },
  book: (t) => book(t, P5(0x3e1c10, 0x5e2c18, 0x7e3e22, 0x9a5230, 0xb46a3e), hex(0x6a2418)),
  sugar: (t) => pile(t, P5(0xb8bcc8, 0xd4d8e0, 0xe8ecf2, 0xf6f8fc, 0xffffff), 0, [[255, 255, 255], hex(0xc8d0dc)]),
  wheat: (t) => {
    blank(t, 0.2);
    draw(t, WHEAT, { 4: hex(0xf6dc7c), 3: hex(0xdcb444), 2: hex(0xa87e22), s: hex(0xb89a4a), b: hex(0x8a3e1e) }, 0, 1);
    outline(t);
  },
  egg: (t) => {
    blank(t, 0.4);
    ball(t, 8, 9, 4.6, 5.4, P5(0x9a7a5a, 0xc4a482, 0xdcc4a4, 0xeee0c8, 0xfaf4e8), 0.28);
    for (const [x, y] of [[7, 6], [10, 9], [6, 11], [9, 12], [11, 6]]) if (solid(t, x, y)) t.px(x, y, hex(0x9a6a4a));
    outline(t);
    glint(t, 6, 6);
  },
  snowball: (t) => blob(t, P5(0x8a98b0, 0xb4c0d2, 0xd4dce8, 0xeef2f8, 0xffffff)),
  bowl: (t) => bowl(t),
  glass_bottle: (t) => bottle(t),
  wheat_seeds: seeds('grain', P5(0x3a4a14, 0x5e7a22, 0x8aa634, 0xc0d86a), [[3, 9], [7, 6], [10, 9], [6, 11], [11, 4], [3, 4]]),
  beetroot_seeds: seeds('round', P5(0x3e1810, 0x6a2a1a, 0x8e4028, 0xb8603c), [[3, 8], [6, 5], [9, 8], [12, 5], [6, 11], [11, 11]]),
  pumpkin_seeds: seeds('flat', P5(0x8a7a52, 0xbcae82, 0xe2d8b4, 0xf8f2dc), [[2, 7], [7, 3], [11, 7], [6, 10]]),
  melon_seeds: seeds('drop', P5(0x0e0a08, 0x1e1612, 0x3a2e26, 0x6a5a4c), [[3, 7], [7, 4], [11, 6], [6, 10], [10, 11]]),
  lumita_dust: (t) => pile(t, P5(0x6a2c08, 0x9c4610, 0xc8661a, 0xeb8e2a, 0xffbe58), 0.55, [hex(0xffe8b0), hex(0xffe8b0)]),
  ember_rod: (t) => {
    blank(t, 0.4);
    for (let i = 0; i < 11; i++) {
      const x = 2 + i, y = 13 - i, hot = i % 3 !== 0;
      dot(t, x, y, { c: EMBERP[hot ? 4 : 1], e: hot ? 1 : 0.4 }); dot(t, x + 1, y, { c: EMBERP[hot ? 3 : 0], e: hot ? 0.8 : 0.3 });
    }
    outline(t);
    for (const [x, y] of [[14, 1], [12, 1], [1, 12]]) { dot(t, x, y, EMBERP[3]); t.emit(x, y, 1); }
  },
  ember_powder: (t) => pile(t, EMBERP, 0.7),
  shade_pearl: (t) => {
    blank(t, 0.9);
    ball(t, 8, 8.4, 5.2, 5.2, P5(0x120a1c, 0x221234, 0x3a1e56, 0x58307e, 0x8656ae));
    for (let a = 0; a < 7; a++) { const r = 0.6 + a * 0.55, th = a * 1.05; dot(t, Math.floor(8 + Math.cos(th) * r), Math.floor(8.4 + Math.sin(th) * r), hex(0x9a6ad0)); }
    outline(t);
    glint(t, 5, 5);
  },
  ember_eye: (t) => {
    blank(t, 0.8);
    ball(t, 8, 8.4, 5.2, 5.2, EMBERP);
    for (let y = 5; y <= 11; y++) dot(t, 8, y, hex(0x2a0804));
    dot(t, 7, 8, hex(0x2a0804)); dot(t, 9, 8, hex(0x2a0804));
    glowWhereOpaque(t, 0.6);
    outline(t);
    glint(t, 5, 5);
  },
  brasal_tear: (t) => {
    blank(t, 0.9);
    ball(t, 8, 9.4, 4, 4.8, P5(0x9a5a3a, 0xd8986a, 0xf2c8a0, 0xfce6d0, 0xffffff), 0.75);
    dot(t, 7, 4, hex(0xfce6d0));
    for (const [x, y] of [[8, 10], [8, 11], [9, 11], [9, 10]]) { t.px(x, y, EMBERP[3]); t.emit(x, y, 0.9); }
    outline(t);
    glint(t, 6, 8);
  },
  magma_cream: (t) => {
    blob(t, P5(0x2a0a06, 0x4a140a, 0x6a1e0e, 0x8a2c12, 0xa84018));
    for (const [x, y] of [[6, 7], [7, 8], [9, 7], [10, 9], [8, 10], [5, 10], [11, 11]]) { t.px(x, y, EMBERP[(x + y) % 2 ? 4 : 3]); t.emit(x, y, 0.9); }
  },
  ember_wart: (t) => {
    blank(t, 0.3);
    const W = P5(0x3e080c, 0x5a0c12, 0x921a1e, 0xc43a30, 0xe86050);
    draw(t, ['.ss.', 'sSs.', '.ss.'], { s: hex(0x4a1410), S: hex(0x6a2018) }, 6, 11);
    for (const [x, y, r] of [[7, 9.6, 2.6], [4.6, 8.4, 1.8], [11, 8.8, 2.1], [9.6, 5.2, 2.3], [6, 5.6, 1.9]]) ball(t, x, y, r, r * 0.92, W);
    outline(t);
    glint(t, 5, 4, W[4]); glint(t, 9, 4, W[4]); glint(t, 6, 8, W[4]);
  },
  fermented_spider_eye: (t) => spiderEye(t, true),
  glistering_melon: (t) => {
    melonSlice(t);
    for (let x = 0; x < 16; x++) for (const y of [12, 13]) if (solid(t, x, y) && t.get(x, y)[1] > 60) t.px(x, y, GOLD[y === 12 ? 4 : 2]);
    sparkle(t, [[7, 5], [10, 9], [5, 9]]);
  },
  rabbit_foot: (t) => {
    blank(t, 0.05);
    const F = P5(0x6a4a2e, 0x8e6a44, 0xb08c62, 0xcaa880, 0xe2c8a4);
    ball(t, 8, 9.4, 4.2, 5, F, 0.5);
    for (const x of [6, 8, 10]) { dot(t, x, 13, F[1]); dot(t, x, 12, F[2]); }
    for (const x of [5, 7, 9, 11]) dot(t, x, 14, hex(0xe8dcc8));
    for (const [x, y] of [[6, 7], [9, 6], [7, 10]]) dot(t, x, y, F[4]);
    draw(t, ['.G.', 'G.G', 'GgG'], { G: GOLD[3], g: GOLD[1] }, 7, 1);
    outline(t);
  },
  phantom_membrane: (t) => {
    blank(t, 0.5);
    const M = P5(0x4e5866, 0x74808e, 0x9aa6b4, 0xbec8d4, 0xdee6ee);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const a = Math.atan2(y - 1, x - 1), r = Math.hypot(x - 1, y - 1), edge = 12.5 - Math.abs(Math.sin(a * 6)) * 2.6;
      if (r > edge || a < 0.05 || a > 1.52) continue;
      const vein = Math.abs(((a * 6 / Math.PI) % 1) - 0.5) < 0.09;
      dot(t, x, y, vein ? M[1] : pick(M, 0.85 - r * 0.04 + (t.white(x, y, 2) - 0.5) * 0.15));
    }
    outline(t);
  },
  moss_tuft: (t) => {
    blank(t, 0.05);
    const G = P5(0x1e3a14, 0x2e561c, 0x467a28, 0x62a034, 0x8ac44a);
    ball(t, 6, 10, 4, 3.4, G); ball(t, 10.6, 10.4, 3.4, 3, G); ball(t, 8.4, 7.4, 3.2, 2.8, G);
    for (const [x, y] of [[5, 5], [8, 3], [11, 5], [12, 6]]) { dot(t, x, y, G[3]); dot(t, x, y + 1, G[2]); }
    outline(t);
  },
  scale_shell: (t) => {
    blank(t, 0.45);
    const S = P5(0x3a3218, 0x5a4a24, 0x7a6632, 0x9a8444, 0xb8a05a);
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
      const dx = Math.abs(x + 0.5 - 8), dy = Math.abs(y + 0.5 - 8), hx = Math.max(dx * 0.87 + dy * 0.5, dy);
      if (hx > 5.6) continue;
      const moss = x + y < 12 && t.white(x, y, 4) < 0.55;
      dot(t, x, y, moss ? pick(P5(0x2e561c, 0x467a28, 0x62a034), t.white(x, y, 5)) : pick(S, 0.8 - Math.floor(hx) % 2 * 0.25 - (x + y - 16) * 0.03));
    }
    outline(t);
  },
  ignarca_heart: ignarcaHeart,
};
for (const c of COLORS) MATERIAL_SPRITES[`${c.id}_dye`] = dyePot(c.rgb);

function glowWhereOpaque(t: Tex, e: number): void { for (let i = 0; i < 256; i++) if (t.rgba[i * 4 + 3]) t.emit(i & 15, i >> 4, e); }
function sparkle(t: Tex, pts: number[][]): void {
  for (let i = 0; i < 256; i++) if (t.rgba[i * 4 + 3]) t.emit(i & 15, i >> 4, 0.2);
  for (const [x, y] of pts) { t.px(x, y, [255, 252, 220]); t.emit(x, y, 1); }
}
