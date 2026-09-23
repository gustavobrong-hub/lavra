/**
 * Pintores do grupo C — mecanismos de fulgor: pó, tochas, alavanca, repetidor, comparador, lâmpada,
 * pistões, observador, TNT, alçapão de ferro, trilhos, ejetor/liberador, bloco musical, sensor de luz
 * e alvo. A energia de fulgor é ciano elétrico (emissiva quando acesa).
 */
import { Tex, type Painter, type Palette, type RGB, hex, mix, pal, scale } from '../tex';
import { WOOD_PALS, cobble } from '../styles';
import {
  PAL, boards, clamp01, disc, glow, masonry, metalPanel, panel, pick, rivet, slabTop, sprite, stick,
} from './utility2';

// ------------------------------------------------------------------ pó de fulgor (cinza claro: a cor vem da energia)
function dustPx(t: Tex, x: number, y: number, v: number): void {
  const g = Math.round(150 + clamp01(v) * 105);
  t.px(x, y, [g, g, g]); t.h(x, y, 0.5 + v * 0.15); t.m(x, y, 0.55, 0, 0.2, 0);
}

/** Cintila: grão mais claro com um fio de emissão (quase nada quando o fio está sem energia). */
function sparkle(t: Tex, x: number, y: number): void {
  t.px(x, y, [255, 255, 255]); t.m(x, y, 0.8, 0, 0.1, 0.12);
}

// ------------------------------------------------------------------ tochas de fulgor e alavanca
/** Tocha de fulgor: cristal na ponta (y6..7), presilha de latão (y8) e haste escura (y9..15). */
function fulgorTorch(t: Tex, lit: boolean): void {
  t.transparent();
  stick(t, pal(0x2a2c34, 0x363944, 0x434754, 0x505564, 0x5e6474), 9, 2);
  t.px(7, 8, PAL.brass[3]); t.px(8, 8, PAL.brass[1]); t.m(7, 8, 0.7, 1, 0.1); t.m(8, 8, 0.7, 1, 0.1);
  const C = lit ? PAL.fulgor : PAL.fulgorOff;
  const px: [number, number, number][] = [[7, 6, lit ? 4 : 3], [8, 6, lit ? 3 : 2], [7, 7, lit ? 3 : 2], [8, 7, lit ? 2 : 1]];
  for (const [x, y, i] of px) { t.px(x, y, C[i]); t.h(x, y, 0.8); t.m(x, y, 0.9, 0, 0.05, lit ? (y === 6 ? 1 : 0.85) : 0); }
  if (lit) { t.emit(7, 8, 0.25); t.emit(8, 8, 0.2); } else t.px(7, 6, hex(0x3f7f8c));
}

// ------------------------------------------------------------------ repetidor e comparador (tampo de laje com trilhas)
/** Conduto de fulgor gravado: apagado = verde-azulado escuro; aceso = ciano emissivo. */
function trace(t: Tex, x: number, y: number, on: boolean, bright = false): void {
  const c = on ? (bright ? PAL.fulgor[4] : PAL.fulgor[3]) : (bright ? PAL.fulgorOff[3] : PAL.fulgorOff[2]);
  t.px(x, y, c); t.h(x, y, 0.42); t.m(x, y, 0.7, 0, 0.1, on ? (bright ? 1 : 0.8) : 0);
}

/** Soquete de latão em volta de uma peça 2×2 (onde as tochas do modelo se apoiam). */
function socket(t: Tex, x0: number, y0: number): void {
  for (let i = 0; i < 2; i++) {
    t.px(x0 + i, y0 - 1, PAL.brass[3]); t.px(x0 + i, y0 + 2, PAL.brass[1]);
    t.px(x0 - 1, y0 + i, PAL.brass[3]); t.px(x0 + 2, y0 + i, PAL.brass[1]);
  }
  for (let y = y0 - 1; y <= y0 + 2; y++) for (let x = x0 - 1; x <= x0 + 2; x++) { t.h(x, y, 0.7); t.m(x, y, 0.7, 1, 0.1); }
  for (let y = y0; y < y0 + 2; y++) for (let x = x0; x < x0 + 2; x++) { t.px(x, y, hex(0x2a2b31)); t.h(x, y, 0.3); t.m(x, y, 0.3, 0, 0.3); }
}

/** Laje lisa do tampo (a saída fica em cima, na linha 0; a entrada embaixo). */
function diodeSlab(t: Tex): void {
  panel(t, 0, 0, 16, 16, PAL.smooth, { n: 0.22, bevel: 0.3, salt: 4, mat: [0.4, 0, 0.3] });
  // sulco rente à borda
  for (let i = 1; i < 15; i++) { t.shadePx(i, 1, 0.9); t.shadePx(1, i, 0.9); t.shadePx(i, 14, 1.06); t.shadePx(14, i, 1.06); }
}

/** Seta de saída (ponta para cima) em x6..9, y0..2. */
function outArrow(t: Tex, on: boolean): void {
  trace(t, 7, 0, on, true); trace(t, 8, 0, on, true);
  trace(t, 6, 1, on); trace(t, 7, 1, on, true); trace(t, 8, 1, on, true); trace(t, 9, 1, on);
  trace(t, 5, 2, on); trace(t, 10, 2, on);
}

function repeaterTex(t: Tex, on: boolean): void {
  diodeSlab(t);
  for (let y = 2; y < 16; y++) { trace(t, 7, y, on, y % 2 === 0); trace(t, 8, y, on, y % 2 === 1); }
  outArrow(t, on);
  // escala de atraso (posições da tocha móvel) dos dois lados
  for (const y of [2, 4, 6, 8]) for (const x of [4, 11]) { t.px(x, y, PAL.smooth[0]); t.h(x, y, 0.35); t.px(x, y + 1, PAL.smooth[5]); }
  socket(t, 7, 12);
}

function comparatorTex(t: Tex, on: boolean): void {
  diodeSlab(t);
  // entrada traseira (embaixo) subindo até a tocha da frente; entradas laterais na linha 7
  for (let y = 4; y < 16; y++) { trace(t, 7, y, on, y % 2 === 0); trace(t, 8, y, on, y % 2 === 1); }
  for (let x = 0; x < 16; x++) if (x < 6 || x > 9) trace(t, x, 7, on, x % 2 === 0);
  for (let x = 4; x < 12; x++) trace(t, x, 14, on, x % 2 === 1);
  for (const x of [4, 11]) { trace(t, x, 13, on); }
  outArrow(t, on);
  socket(t, 7, 2); socket(t, 4, 11); socket(t, 10, 11);
}

// ------------------------------------------------------------------ lâmpada de fulgor
function lampTex(t: Tex, on: boolean): void {
  metalPanel(t, 0, 0, 16, 16, PAL.darkIron, 0.6, { salt: 2 });
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
    const v = t.fbm(x, y, 6), edge = x === 2 || y === 2 ? -1 : x === 13 || y === 13 ? 1 : 0;
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    let c = on ? mix(hex(0x7fe6f2), hex(0xe6feff), clamp01(v * 0.5 + (1 - d / 8) * 0.7)) : mix(hex(0x6f8a90), hex(0xa9bfc3), v);
    if (edge < 0) c = scale(c, 0.78);
    if (edge > 0) c = mix(c, [255, 255, 255], 0.2);
    t.px(x, y, c); t.h(x, y, 0.5); t.m(x, y, 0.82, 0, 0.05, on ? 0.75 + (1 - d / 8) * 0.25 : 0);
  }
  // filamento em espiral com hastes de apoio
  const fil: [number, number][] = [[7, 4], [8, 5], [7, 6], [8, 7], [7, 8], [8, 9], [7, 10]];
  for (const [x, y] of fil) {
    t.px(x, y, on ? hex(0xffffff) : hex(0x5a3e26)); t.h(x, y, 0.7); t.m(x, y, 0.6, on ? 0 : 1, 0.1, on ? 1 : 0);
    if (!on) t.px(x + (x === 7 ? 1 : -1), y, hex(0x8d9ea2));
  }
  for (const y of [11, 12]) for (const x of [6, 9]) { t.px(x, y, PAL.iron[x === 6 ? 3 : 1]); t.m(x, y, 0.6, 1, 0.1, 0); }
  t.px(7, 11, PAL.iron[2]); t.px(8, 11, PAL.iron[2]);
  // reflexo diagonal no vidro e cantoneiras
  if (!on) for (let i = 0; i < 3; i++) t.px(3 + i, 5 - i, hex(0xd4e2e4));
  for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13]]) rivet(t, x, y, PAL.iron[4], PAL.darkIron[0]);
}

const CONTROLS: Record<string, Painter> = {
  fulgor_dust_dot: (t) => {
    t.transparent();
    disc(t, 8, 8, 4.4, (x, y, d) => {
      const n = t.white(x, y, 3);
      if (d > 3.3 && n < 0.45) return;
      dustPx(t, x, y, 0.55 + (1 - d / 4.4) * 0.35 + (n - 0.5) * 0.3);
    });
    for (let i = 0; i < 7; i++) {
      const a = t.rng.next() * Math.PI * 2, r = 4.6 + t.rng.next() * 1.6;
      dustPx(t, Math.floor(8 + Math.cos(a) * r), Math.floor(8 + Math.sin(a) * r), 0.5 + t.rng.next() * 0.3);
    }
    sparkle(t, 7, 6); sparkle(t, 9, 9); sparkle(t, 5, 8);
  },
  fulgor_dust_line: (t) => {
    t.transparent();
    for (let y = 0; y < 16; y++) {
      for (const x of [7, 8]) dustPx(t, x, y, 0.62 + (t.white(x, y, 2) - 0.5) * 0.4);
      for (const x of [6, 9]) if (t.white(x, y, 4) < 0.62) dustPx(t, x, y, 0.45 + t.white(x, y, 5) * 0.3);
      for (const x of [5, 10]) if (t.white(x, y, 6) < 0.14) dustPx(t, x, y, 0.4);
    }
    sparkle(t, 7, 3); sparkle(t, 8, 10); sparkle(t, 7, 14);
  },
  fulgor_torch: (t) => fulgorTorch(t, true),
  fulgor_torch_off: (t) => fulgorTorch(t, false),
  lever: (t) => {
    t.transparent();
    stick(t, PAL.oak, 8, 5);
    // anel de ferro e pegador arredondado de laca vermelha (y6..7, visto também de cima)
    t.px(7, 12, PAL.iron[4]); t.px(8, 12, PAL.iron[1]); t.m(7, 12, 0.6, 1, 0.1); t.m(8, 12, 0.6, 1, 0.1);
    sprite(t, ['ab', 'bc'], { a: { c: hex(0xe0604e), h: 0.9, m: [0.6, 0, 0.1] }, b: { c: hex(0xb03a2e), h: 0.8, m: [0.6, 0, 0.1] }, c: { c: hex(0x6e1c16), h: 0.7, m: [0.6, 0, 0.1] } }, 7, 6);
  },
  repeater: (t) => repeaterTex(t, false),
  repeater_on: (t) => repeaterTex(t, true),
  comparator: (t) => comparatorTex(t, false),
  comparator_on: (t) => comparatorTex(t, true),
  fulgor_lamp: (t) => lampTex(t, false),
  fulgor_lamp_on: (t) => lampTex(t, true),
};

// ------------------------------------------------------------------ pistões
const STEEL = pal(0x44454c, 0x575860, 0x6c6d75, 0x82838b, 0x999aa1, 0xb2b3b9);
const COBBLE = pal(0x4c4c50, 0x5f5f63, 0x727276, 0x86868a, 0x9a9a9e);
const SLIME = pal(0x285e1a, 0x377c24, 0x4c9a32, 0x6cba48, 0x9edc76);

/** Face de tábuas com moldura de ferro e placa central rebitada (frente da cabeça do pistão). */
function pistonHead(t: Tex): void {
  boards(t, 0, 0, 16, 16, PAL.oak, { size: 4, salt: 7 });
  for (let i = 0; i < 16; i++) {
    t.px(i, 0, STEEL[5]); t.px(0, i, STEEL[4]); t.px(i, 15, STEEL[0]); t.px(15, i, STEEL[1]);
    for (const [x, y] of [[i, 0], [0, i], [i, 15], [15, i]]) { t.h(x, y, 0.75); t.m(x, y, 0.6, 1, 0.1); }
  }
  metalPanel(t, 4, 4, 8, 8, STEEL, 0.65, { salt: 3 });
  for (const [x, y] of [[5, 5], [9, 5], [5, 9], [9, 9]]) rivet(t, x, y, STEEL[5], STEEL[0]);
}

/** Bossa de ferro redonda com contorno escuro e furo central (fundo e interior do pistão). */
function boss(t: Tex, r: number, hole: number): void {
  disc(t, 8, 8, r, (x, y, d, dx, dy) => {
    const lit = -(dx + dy) / (d + 0.01);
    if (d > r - 0.8) { t.px(x, y, scale(STEEL[0], 0.7)); t.h(x, y, 0.3); t.m(x, y, 0.4, 1, 0.1); return; }
    if (d > hole) {
      const rim = d > hole + 0.9 ? 1 : -1;
      t.px(x, y, pick(STEEL, 0.55 + lit * 0.32 * rim + (t.white(x, y, 4) - 0.5) * 0.1)); t.h(x, y, 0.75); t.m(x, y, 0.65, 1, 0.08);
      return;
    }
    t.px(x, y, mix(hex(0x101014), hex(0x3a3b42), clamp01(0.25 - lit * 0.35))); t.h(x, y, 0.15); t.m(x, y, 0.3, 0, 0.3);
  });
}

// ------------------------------------------------------------------ observador
const OBS = pal(0x2e2f35, 0x393a41, 0x45464e, 0x51525b, 0x5e5f69, 0x6c6d78);

/** Carcaça de pedra escura com parafusos nos cantos. */
function casing(t: Tex, salt: number): void {
  panel(t, 0, 0, 16, 16, OBS, { n: 0.3, bevel: 0.32, salt, mat: [0.3, 0, 0.3] });
  for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13]]) rivet(t, x, y, PAL.iron[3], OBS[0]);
  for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13]]) t.m(x, y, 0.6, 1, 0.1);
}

/** Fenda de ventilação horizontal. */
function slot(t: Tex, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x++) {
    t.px(x, y, scale(OBS[0], 0.6)); t.h(x, y, 0.15);
    t.px(x, y + 1, OBS[4]); t.h(x, y + 1, 0.55);
  }
}

function observerBack(t: Tex, on: boolean): void {
  casing(t, 7);
  slot(t, 6, 9, 3); slot(t, 6, 9, 12);
  disc(t, 8, 8, 3.4, (x, y, d, dx, dy) => {
    if (d > 2.3) {
      const lit = -(dx + dy) / (d + 0.01);
      t.px(x, y, on ? mix(pick(PAL.iron, 0.5 + lit * 0.3), PAL.fulgor[3], 0.25) : pick(PAL.iron, 0.45 + lit * 0.3));
      t.h(x, y, 0.75); t.m(x, y, 0.6, 1, 0.1, on ? 0.25 : 0);
    } else if (on) {
      t.px(x, y, d < 1 ? PAL.fulgor[4] : PAL.fulgor[3]); t.h(x, y, 0.6); t.m(x, y, 0.9, 0, 0.05, d < 1 ? 1 : 0.85);
    } else {
      t.px(x, y, mix(hex(0x10191c), hex(0x24383e), clamp01(0.5 - (dx + dy) * 0.2))); t.h(x, y, 0.55); t.m(x, y, 0.9, 0, 0.05);
    }
  });
  if (!on) t.px(7, 7, hex(0x5a8a94));
}

// ------------------------------------------------------------------ TNT
const DYN = pal(0x5e0e0e, 0x821812, 0xa8241a, 0xc63626, 0xde5440);
const PAPER = hex(0xece2c8), INK = hex(0x2a1a14);

/** Ponta de um cartucho (célula 4×4) vista de cima/baixo. */
function stickEnd(t: Tex, x0: number, y0: number, cap: RGB): void {
  sprite(t, ['.ab.', 'accd', 'bccd', '.dd.'], { a: DYN[4], b: DYN[3], c: cap, d: DYN[1] }, x0, y0);
  for (const [x, y] of [[0, 0], [3, 0], [0, 3], [3, 3]]) { t.px(x0 + x, y0 + y, hex(0x2a0808)); t.h(x0 + x, y0 + y, 0.2); }
  t.px(x0 + 2, y0 + 2, scale(cap, 0.85));
}

const MACHINES: Record<string, Painter> = {
  piston_side: (t) => {
    cobble(t, COBBLE);
    boards(t, 0, 0, 16, 4, PAL.oak, { size: 4, salt: 3 });
    // postes de ferro nas bordas (x0..3 é também a haste do braço estendido)
    metalPanel(t, 0, 4, 4, 12, STEEL, 0.6, { streak: 'v', salt: 5 });
    metalPanel(t, 12, 4, 4, 12, STEEL, 0.6, { streak: 'v', salt: 6 });
    for (const [x, y] of [[1, 6], [1, 12], [13, 6], [13, 12]]) rivet(t, x, y, STEEL[5], STEEL[0]);
    for (let x = 4; x < 12; x++) t.shadePx(x, 4, 0.7);
  },
  piston_top: pistonHead,
  piston_top_sticky: (t) => {
    pistonHead(t);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 7.5, d = Math.hypot(dx, dy);
      const edge = 6.4 + (t.vnoise(x, y, 4, 9) - 0.5) * 3;
      const drip = (x === 5 && y > 9) || (x === 10 && y > 11) || (x === 11 && y > 11 && y < 14);
      if (d >= edge && !drip) continue;
      let v = 0.5 + (1 - Math.min(1, d / edge)) * 0.25 + (t.fbm(x, y, 3) - 0.5) * 0.3 - (dx + dy) * 0.02;
      if (d > edge - 1.2 || drip) v -= 0.15;
      const c = pick(SLIME, v);
      t.px(x, y, d > edge - 1 && !drip ? mix(c, t.get(x, y), 0.3) : c); t.h(x, y, 0.8); t.m(x, y, 0.88, 0, 0.05);
    }
    for (const [x, y] of [[5, 4], [6, 4], [4, 5], [9, 6]]) t.px(x, y, hex(0xdcffc6));
  },
  piston_bottom: (t) => {
    cobble(t, COBBLE);
    metalPanel(t, 2, 2, 12, 12, PAL.darkIron, 0.6, { salt: 8 });
    boss(t, 4.4, 1.6);
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) rivet(t, x, y, STEEL[5], PAL.darkIron[0]);
  },
  piston_inner: (t) => {
    cobble(t, pal(0x3c3c40, 0x4c4c50, 0x5c5c60, 0x6c6c70, 0x7c7c80));
    boss(t, 5, 2.4);
    for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) rivet(t, x, y, STEEL[4], scale(STEEL[0], 0.7));
  },
  observer_front: (t) => {
    casing(t, 3);
    panel(t, 3, 3, 10, 10, OBS, { n: 0.2, bevel: -0.3, salt: 5, hgt: 0.45, mat: [0.3, 0, 0.3] });
    disc(t, 8, 8, 3.7, (x, y, d, dx, dy) => {
      const lit = -(dx + dy) / (d + 0.01);
      if (d > 2.8) { t.px(x, y, pick(PAL.brass, 0.5 + lit * 0.35)); t.h(x, y, 0.8); t.m(x, y, 0.7, 1, 0.1); return; }
      let c = mix(hex(0x0c1216), hex(0x223238), clamp01(0.4 - lit * 0.3));
      if (Math.abs(d - 1.9) < 0.45) c = hex(0x1d5560);
      if (d < 0.9) c = hex(0x06090b);
      t.px(x, y, c); t.h(x, y, 0.6); t.m(x, y, 0.92, 0, 0.05);
    });
    glow(t, 6, 6, hex(0xbff6ff), 0.35); glow(t, 7, 6, hex(0x5fd6e6), 0.2);
  },
  observer_side: (t) => {
    casing(t, 4);
    for (const y of [4, 7, 10]) slot(t, 4, 11, y);
  },
  observer_top: (t) => {
    casing(t, 5);
    const B = PAL.brass;
    const arrow = ['   ab   ', '  abbc  ', ' abbbbc ', 'aabbbbcc', '   bc   ', '   bc   ', '   bc   ', '   bc   ', '   bc   '];
    sprite(t, arrow, { a: { c: B[4], h: 0.8, m: [0.7, 1, 0.1] }, b: { c: B[3], h: 0.75, m: [0.7, 1, 0.1] }, c: { c: B[1], h: 0.7, m: [0.7, 1, 0.1] } }, 4, 3);
    for (let y = 3; y < 12; y++) for (let x = 4; x < 12; x++) {
      if (t.hGet(x, y) >= 0.7 && t.hGet(x + 1, y + 1) < 0.7) { t.shadePx(x + 1, y + 1, 0.7); t.h(x + 1, y + 1, 0.4); }
    }
  },
  observer_back: (t) => observerBack(t, false),
  observer_back_on: (t) => observerBack(t, true),
  tnt_side: (t) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = x & 3;
      const v = [0.78, 0.6, 0.42, 0.14][k] + (t.vnoise(x * 4, y, 4, 2) - 0.5) * 0.14 + (t.white(x, y) - 0.5) * 0.06;
      t.px(x, y, pick(DYN, v)); t.h(x, y, [0.7, 0.72, 0.65, 0.4][k]);
    }
    for (const y of [2, 12]) for (let x = 0; x < 16; x++) for (let r = 0; r < 2; r++) {
      t.px(x, y + r, pick(pal(0x5a4428, 0x7a6038, 0x9a7e4e, 0xb49664), ((x + y + r) % 3 === 0 ? 0.8 : 0.45) - r * 0.25 - ((x & 3) === 3 ? 0.2 : 0)));
      t.h(x, y + r, 0.8); t.m(x, y + r, 0.05, 0, 0.9);
    }
    for (let y = 5; y <= 10; y++) for (let x = 1; x <= 14; x++) {
      const edge = y === 5 || y === 10;
      t.px(x, y, edge ? DYN[1] : (x === 1 ? mix(PAPER, [255, 255, 255], 0.3) : x === 14 ? scale(PAPER, 0.85) : PAPER)); t.h(x, y, 0.75); t.m(x, y, 0.1, 0, 0.8);
    }
    sprite(t, ['### #  # ###', ' #  ## #  # ', ' #  # ##  # ', ' #  #  #  # '], { '#': INK }, 2, 6);
  },
  tnt_top: (t) => {
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) stickEnd(t, gx * 4, gy * 4, hex(0xd8c8a0));
    // pavio: nó escuro no meio do feixe e cordão curvando para cima, ponta desfiada clara
    const F = { k: hex(0x1e1e22), e: hex(0x303036), g: hex(0x55555c), f: hex(0xd0c8b4) };
    sprite(t, ['    f', '   g ', '  e  ', ' ke  ', 'kk   '], F, 6, 4);
    for (const [x, y] of [[10, 4], [9, 5], [8, 6], [7, 7], [8, 7], [6, 8], [7, 8]]) t.h(x, y, 0.95);
    t.material(0.1, 0, 0.8);
  },
  tnt_bottom: (t) => {
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) stickEnd(t, gx * 4, gy * 4, hex(0xb8a47c));
    for (let i = 0; i < 16; i++) for (const [x, y] of [[i, 7], [i, 8], [7, i], [8, i]]) {
      t.px(x, y, pick(pal(0x5a4428, 0x7a6038, 0x9a7e4e), (x + y) % 3 === 0 ? 0.9 : 0.4)); t.h(x, y, 0.8);
    }
    t.material(0.1, 0, 0.8);
  },
  iron_trapdoor: (t) => {
    metalPanel(t, 0, 0, 16, 16, PAL.iron, 0.7, { salt: 2 });
    for (let i = 2; i < 14; i++) { t.px(i, 2, PAL.iron[1]); t.px(2, i, PAL.iron[1]); t.px(i, 13, PAL.iron[5]); t.px(13, i, PAL.iron[5]); }
    for (const hy of [3, 7, 11]) for (const hx of [3, 7, 11]) {
      for (let y = hy; y < hy + 2; y++) for (let x = hx; x < hx + 2; x++) t.px(x, y, [0, 0, 0], 0);
      t.px(hx, hy - 1, PAL.iron[0]); t.px(hx + 1, hy - 1, PAL.iron[0]); t.px(hx - 1, hy, PAL.iron[1]); t.px(hx - 1, hy + 1, PAL.iron[1]);
      t.px(hx, hy + 2, PAL.iron[5]); t.px(hx + 1, hy + 2, PAL.iron[5]); t.px(hx + 2, hy, PAL.iron[4]); t.px(hx + 2, hy + 1, PAL.iron[4]);
    }
    for (const [x, y] of [[0, 0], [14, 0], [0, 14], [14, 14]]) rivet(t, x, y, PAL.iron[5], PAL.iron[0]);
    t.material(0.7, 1, 0.05);
  },
};

// ------------------------------------------------------------------ trilhos (fundo transparente; bitola simétrica x3..4 / x11..12)
const TIE = pal(0x3e2a18, 0x4e3620, 0x5e4228, 0x6e4e30, 0x7e5a38);
const TIE_DARK = pal(0x281c14, 0x33241a, 0x3e2d20, 0x4a3627, 0x56402e);
const RAIL = pal(0x4a4b52, 0x62636b, 0x7c7d85, 0x9a9ba2, 0xbcbdc4, 0xe2e3e8);
const SLEEPERS = [1, 5, 9, 13];

/** Dormentes horizontais (2 linhas cada) de x1 a x14. */
function railBed(t: Tex, tie: Palette): void {
  t.transparent();
  for (const y0 of SLEEPERS) for (let x = 1; x <= 14; x++) for (let r = 0; r < 2; r++) {
    let v = (r === 0 ? 0.62 : 0.3) + t.vnoise(x, y0 + r, 4, y0) * 0.3 - 0.15 + (t.white(x, y0 + r, 2) - 0.5) * 0.15;
    if (x === 1) v += 0.1;
    if (x === 14) v -= 0.15;
    t.px(x, y0 + r, pick(tie, v)); t.h(x, y0 + r, r === 0 ? 0.55 : 0.45); t.m(x, y0 + r, 0.15, 0, 0.7);
  }
}

/** Dois trilhos contínuos (x3..4 e x11..12) com grampos nos dormentes. */
function railLines(t: Tex, p: Palette, smooth = 0.7): void {
  for (let y = 0; y < 16; y++) for (const [x, v] of [[3, 0.76], [4, 0.38], [11, 0.76], [12, 0.38]] as [number, number][]) {
    t.px(x, y, pick(p, v + (t.white(x, y, 7) - 0.5) * 0.1)); t.h(x, y, 0.85); t.m(x, y, smooth, 1, 0.05);
  }
  for (const y0 of SLEEPERS) for (const x of [2, 5, 10, 13]) { t.px(x, y0, p[1]); t.h(x, y0, 0.7); t.m(x, y0, 0.5, 1, 0.1); }
}

// ------------------------------------------------------------------ sensor de luz e alvo
const HAY = pal(0x8a6a20, 0xa6822a, 0xc09a38, 0xd6b04a, 0xe6c464, 0xf0d484);

/** Tampo do sensor: moldura de madeira, 4 vidraças em volta de uma lente central. */
function sensorTop(t: Tex, night: boolean): void {
  panel(t, 0, 0, 16, 16, WOOD_PALS.oak.plank, { n: 0.3, bevel: 0.3, salt: 3, mat: [0.2, 0, 0.6] });
  const lo = hex(night ? 0x2c3a8e : 0xc49a3c), hi = hex(night ? 0x8c9ce6 : 0xf6e6a6);
  for (const y0 of [2, 9]) for (const x0 of [2, 9]) for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 5; x++) {
    const k = clamp01(0.55 - ((x - x0) + (y - y0)) * 0.09 + (t.white(x, y, 5) - 0.5) * 0.15);
    let c = mix(lo, hi, k);
    if ((x - x0) - (y - y0) === 1 && x - x0 < 4) c = mix(c, [255, 255, 255], 0.45);
    t.px(x, y, c); t.h(x, y, 0.45); t.m(x, y, 0.92, 0, 0.02);
  }
  for (let i = 2; i < 14; i++) for (const [x, y] of [[7, i], [8, i], [i, 7], [i, 8]]) {
    t.px(x, y, PAL.brass[x === 7 || y === 7 ? 3 : 1]); t.h(x, y, 0.65); t.m(x, y, 0.65, 1, 0.1);
  }
  disc(t, 8, 8, 2.6, (x, y, d, dx, dy) => {
    let c: RGB = d > 1.8 ? PAL.brass[dx + dy < 0 ? 4 : 1] : hex(night ? 0x1c2458 : 0xfff2c0);
    if (night && d <= 1.8 && dx - 0.6 > -0.2 && Math.hypot(dx - 0.7, dy + 0.3) < 1.2) c = hex(0xe8ecff);
    t.px(x, y, c); t.h(x, y, 0.8); t.m(x, y, 0.9, d > 1.8 ? 1 : 0, 0.05);
  });
  if (night) for (const [x, y] of [[3, 4], [11, 3], [4, 11], [12, 12], [10, 10]]) t.px(x, y, hex(0xf4f6ff));
}

/** Palha: fios ao longo de um eixo com fios escuros soltos. */
function hay(t: Tex, vertical: boolean, salt: number): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const strand = vertical ? t.white(x, 1, salt) : t.white(1, y, salt);
    const v = strand * 0.45 + t.vnoise(x, y, 4, salt) * 0.3 + t.white(x, y, salt + 1) * 0.3;
    t.px(x, y, pick(HAY, v)); t.h(x, y, 0.4 + v * 0.3);
  }
  for (let i = 0; i < 7; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    for (let k = 0; k < 3; k++) t.px(vertical ? x : x + k, vertical ? y + k : y, HAY[0]);
  }
  t.material(0.08, 0, 0.9);
}

/** Anéis do alvo pintados sobre a palha (a palha aparece um pouco por baixo da tinta). */
function targetRings(t: Tex): void {
  disc(t, 8, 8, 6.6, (x, y, d) => {
    const red = d < 1.5 || (d >= 3 && d < 4.5) || d >= 6;
    const paint = red ? hex(0xc42a26) : hex(0xf2eee2);
    t.px(x, y, mix(paint, t.get(x, y), 0.16)); t.h(x, y, 0.55); t.m(x, y, 0.2, 0, 0.6);
  });
}

const DEVICES: Record<string, Painter> = {
  rail: (t) => { railBed(t, TIE); railLines(t, RAIL); },
  rail_corner: (t) => {
    // curva ligando a borda de baixo à da direita: arcos centrados no canto (16,16), dormentes retos radiais
    t.transparent();
    for (let k = 0; k < 4; k++) {
      const phi = (k + 0.5) * (Math.PI / 8), c = Math.cos(phi), sn = Math.sin(phi);
      const P = (r: number): [number, number] => [Math.floor(16 - r * c), Math.floor(16 - r * sn)];
      const [ax, ay] = P(2.8), [bx, by] = P(14.6);
      const [ox, oy] = phi < Math.PI / 4 ? [0, 1] : [1, 0];
      segment(t, ax + ox, ay + oy, bx + ox, by + oy, TIE[1]);
      segment(t, ax, ay, bx, by, TIE[3]);
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (t.alpha(x, y)) { t.blend(x, y, pick(TIE, t.white(x, y, 2)), 0.25); t.h(x, y, 0.5); t.m(x, y, 0.15, 0, 0.7); }
      const d = Math.hypot(16 - (x + 0.5), 16 - (y + 0.5));
      const outer = d >= 11.5 && d < 13.5, inner = d >= 3.5 && d < 5.5;
      if (outer || inner) {
        const lit = outer ? d >= 12.5 : d >= 4.5;
        t.px(x, y, pick(RAIL, (lit ? 0.76 : 0.38) + (t.white(x, y, 7) - 0.5) * 0.1)); t.h(x, y, 0.85); t.m(x, y, 0.7, 1, 0.05);
      }
    }
  },
  powered_rail: (t) => poweredRail(t, false),
  powered_rail_on: (t) => poweredRail(t, true),
  detector_rail: (t) => detectorRail(t, false),
  detector_rail_on: (t) => detectorRail(t, true),
  activator_rail: (t) => activatorRail(t, false),
  activator_rail_on: (t) => activatorRail(t, true),
  dispenser_front: (t) => {
    masonry(t);
    metalPanel(t, 4, 4, 8, 8, PAL.darkIron, 0.6, { salt: 3 });
    nozzle(t, 3.1);
    for (const [x, y] of [[4, 4], [10, 4], [4, 10], [10, 10]]) rivet(t, x, y, PAL.iron[3], PAL.darkIron[0]);
  },
  dispenser_front_vertical: (t) => {
    slabTop(t);
    metalPanel(t, 3, 3, 10, 10, PAL.darkIron, 0.6, { salt: 4 });
    nozzle(t, 3.6);
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) rivet(t, x, y, PAL.iron[3], PAL.darkIron[0]);
  },
  dropper_front: (t) => {
    masonry(t);
    metalPanel(t, 3, 5, 10, 6, PAL.darkIron, 0.6, { salt: 5 });
    for (let x = 4; x < 12; x++) {
      t.px(x, 7, hex(0x0e0f12)); t.px(x, 8, hex(0x1c1d22)); t.px(x, 9, PAL.darkIron[5]);
      t.h(x, 7, 0.1); t.h(x, 8, 0.15); t.m(x, 7, 0.3, 0, 0.3); t.m(x, 8, 0.3, 0, 0.3);
    }
    for (const x of [3, 11]) rivet(t, x, 5, PAL.iron[3], PAL.darkIron[0]);
  },
  dropper_front_vertical: (t) => {
    slabTop(t);
    for (let k = 0; k < 5; k++) {
      const a = 3 + k, b = 12 - k;
      for (let i = a; i <= b; i++) for (const [x, y] of [[i, a], [a, i], [i, b], [b, i]]) {
        const lit = x === b || y === b;
        t.px(x, y, k === 4 ? hex(0x0c0d10) : pick(PAL.darkIron, 0.75 - k * 0.17 + (lit ? 0.15 : -0.05)));
        t.h(x, y, 0.6 - k * 0.12); t.m(x, y, 0.55, k < 4 ? 1 : 0, 0.1);
      }
    }
  },
  note_block: (t) => {
    const W = pal(0x4a2618, 0x5c301e, 0x6e3a24, 0x80462c, 0x925234);
    boards(t, 0, 0, 16, 16, W, { size: 4, salt: 9 });
    for (let i = 0; i < 16; i++) for (let k = 0; k < 2; k++) {
      for (const [x, y] of [[i, k], [k, i], [i, 15 - k], [15 - k, i]]) t.shadePx(x, y, 0.72);
    }
    for (let i = 0; i < 16; i++) { t.px(i, 0, W[4]); t.px(0, i, W[4]); t.px(i, 15, scale(W[0], 0.7)); t.px(15, i, scale(W[0], 0.7)); }
    const notes = ['   ######', '   ######', '   #    #', '   #    #', '   #    #', ' ###  ###', '#### ####', ' ##   ## '];
    const bone = hex(0xe6d6b0);
    for (let y = 0; y < notes.length; y++) for (let x = 0; x < notes[y].length; x++) {
      if (notes[y][x] !== '#') continue;
      const X = x + 3, Y = y + 4;
      if (notes[y + 1]?.[x + 1] !== '#') { t.px(X + 1, Y + 1, scale(W[0], 0.6)); t.h(X + 1, Y + 1, 0.3); }
    }
    sprite(t, notes, { '#': { c: bone, h: 0.7, m: [0.45, 0, 0.3] } }, 3, 4);
  },
  daylight_detector_top: (t) => sensorTop(t, false),
  daylight_detector_inverted_top: (t) => sensorTop(t, true),
  daylight_detector_side: (t) => {
    boards(t, 0, 0, 16, 10, WOOD_PALS.oak.plank, { size: 5, salt: 2 });
    boards(t, 0, 11, 16, 5, WOOD_PALS.oak.plank, { size: 5, salt: 4 });
    for (let x = 0; x < 16; x++) { t.px(x, 10, PAL.brass[x % 4 === 0 ? 4 : 3]); t.h(x, 10, 0.75); t.m(x, 10, 0.65, 1, 0.1); }
  },
  target_side: (t) => {
    hay(t, false, 3);
    for (const y of [1, 14]) for (let x = 0; x < 16; x++) { t.px(x, y, pick(pal(0x6a2a1a, 0x8a3a24, 0xa84a2e), x % 3 === 0 ? 0.9 : 0.4)); t.h(x, y, 0.75); }
    targetRings(t);
  },
  target_top: (t) => { hay(t, true, 5); targetRings(t); },
};

function poweredRail(t: Tex, on: boolean): void {
  railBed(t, TIE_DARK);
  for (let y = 0; y < 16; y++) for (const x of [7, 8]) {
    const C = on ? PAL.fulgor : PAL.fulgorOff;
    t.px(x, y, C[x === 7 ? (on ? 4 : 3) : 2]); t.h(x, y, 0.6); t.m(x, y, 0.7, 0, 0.1, on ? (x === 7 ? 1 : 0.8) : 0);
  }
  for (const y0 of SLEEPERS) { t.px(6, y0, PAL.brass[3]); t.px(9, y0, PAL.brass[1]); t.m(6, y0, 0.6, 1, 0.1); t.m(9, y0, 0.6, 1, 0.1); }
  railLines(t, PAL.gold, 0.85);
}

function detectorRail(t: Tex, on: boolean): void {
  railBed(t, TIE);
  metalPanel(t, 5, 5, 6, 6, pal(0x3a3c42, 0x4a4c53, 0x5c5e66, 0x70727a, 0x86888f), 0.55, { salt: 6 });
  for (const [x, y, i] of [[7, 7, 4], [8, 7, 3], [7, 8, 3], [8, 8, 2]] as [number, number, number][]) {
    t.px(x, y, on ? PAL.fulgor[i] : PAL.fulgorOff[i - 1]); t.h(x, y, 0.7); t.m(x, y, 0.9, 0, 0.05, on ? 1 : 0);
  }
  if (on) for (let i = 6; i < 10; i++) for (const [x, y] of [[i, 6], [6, i], [i, 9], [9, i]]) {
    if (x >= 7 && x <= 8 && y >= 7 && y <= 8) continue;
    t.px(x, y, mix(t.get(x, y), PAL.fulgor[3], 0.5)); t.emit(x, y, 0.35);
  }
  railLines(t, RAIL);
}

function activatorRail(t: Tex, on: boolean): void {
  railBed(t, TIE_DARK);
  for (const y0 of SLEEPERS) for (let x = 5; x <= 10; x++) {
    const c = on ? PAL.fulgor[x === 5 ? 4 : x === 10 ? 2 : 3] : PAL.copper[x === 5 ? 4 : x === 10 ? 1 : 2];
    t.px(x, y0, c); t.h(x, y0, 0.65); t.m(x, y0, 0.65, on ? 0 : 1, 0.1, on ? 0.9 : 0);
    t.px(x, y0 + 1, on ? PAL.fulgor[1] : PAL.copper[0]); t.m(x, y0 + 1, 0.5, on ? 0 : 1, 0.1, on ? 0.5 : 0);
  }
  railLines(t, RAIL);
}

/** Segmento de reta recortado nas bordas (sem dar a volta na textura). */
function segment(t: Tex, x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (x >= 0 && x < 16 && y >= 0 && y < 16) t.px(x, y, c);
  }
}

/** Bocal redondo: anel de ferro com furo escuro (parede de dentro iluminada embaixo-direita). */
function nozzle(t: Tex, r: number): void {
  disc(t, 8, 8, r, (x, y, d, dx, dy) => {
    const lit = -(dx + dy) / (d + 0.01);
    if (d > r - 1.1) { t.px(x, y, pick(PAL.iron, 0.5 + lit * 0.35)); t.h(x, y, 0.8); t.m(x, y, 0.65, 1, 0.08); return; }
    t.px(x, y, mix(hex(0x0c0d10), hex(0x3a3c44), clamp01(-lit * 0.6 * (d / r)))); t.h(x, y, 0.1); t.m(x, y, 0.3, 0, 0.3);
  });
}

// ------------------------------------------------------------------ registro
export const FULGOR_PAINTERS: Record<string, Painter> = {
  ...CONTROLS,
  ...MACHINES,
  ...DEVICES,
};
