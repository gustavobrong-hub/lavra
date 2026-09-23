/**
 * Pintores de peças de madeira das 8 árvores (muda, porta de baixo/de cima, alçapão) e da porta de ferro.
 *
 * Portas são desenhadas numa "tela" de 16×32 (y global 0..15 = metade de cima, 16..31 = metade de baixo),
 * então molduras, travessas e ferragens que cruzam a emenda casam sozinhas. As 3 colunas da esquerda
 * (x0..2) viram a espessura da porta; nos alçapões são as 3 linhas de cima (y0..2).
 * Furos (alfa 0) são simétricos (x → 15−x; nos alçapões também y → 15−y) porque a face de trás
 * usa a textura espelhada: assim o furo da frente coincide com o de trás.
 */
import { Tex, type Painter, type RGB, hex } from '../tex';
import { WOOD_PALS } from '../styles';
import { type Legend, foliage, sprite } from './plants';

// ------------------------------------------------------------------ kit de marcenaria
interface Canvas { t: Tex; gy0: number; p: RGB[]; metal?: boolean }

const shadeIdx = (p: RGB[], v: number): RGB => p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))];

/** Pinta um pixel em coordenadas globais (ignora o que cai fora da metade atual). */
function set(c: Canvas, x: number, gy: number, col: RGB, h = 0.55, s = 0.22, mt = 0, e = 0): void {
  const y = gy - c.gy0;
  if (x < 0 || x > 15 || y < 0 || y > 15) return;
  c.t.px(x, y, col);
  c.t.h(x, y, h);
  c.t.m(x, y, s, mt, mt ? 0.05 : 0.55, e);
}
function shade(c: Canvas, x: number, gy: number, k: number, dh = 0): void {
  const y = gy - c.gy0;
  if (x < 0 || x > 15 || y < 0 || y > 15 || !c.t.alpha(x, y)) return;
  c.t.shadePx(x, y, k);
  if (dh) c.t.h(x, y, c.t.hGet(x, y) + dh);
}

/** Tábuas com veio: 'v' = tábuas verticais de largura `bw`; 'h' = horizontais de altura `bw`. */
function boards(c: Canvas, x0: number, y0: number, w: number, h: number, dir: 'v' | 'h', bw: number, salt = 0, tone = 0): void {
  for (let gy = y0; gy < y0 + h; gy++) for (let x = x0; x < x0 + w; x++) {
    const across = dir === 'v' ? x - x0 : gy - y0, b = Math.floor(across / bw), within = across % bw;
    const u = dir === 'v' ? x : gy, a = dir === 'v' ? gy : x;
    const grain = Math.sin(u * 1.9 + c.t.vnoise(x, gy, 4, salt + b) * 5 + a * 0.13);
    let v = 0.5 + tone + (c.t.white(b, 7, salt) - 0.5) * 0.22 + grain * 0.14 + (c.t.white(x, gy, salt + 1) - 0.5) * 0.08;
    if (within === 0) v += 0.1;
    if (within === bw - 1 && bw > 1) v -= 0.3;
    set(c, x, gy, shadeIdx(c.p, v), within === bw - 1 && bw > 1 ? 0.4 : 0.55 + grain * 0.04, c.metal ? 0.6 : 0.2, c.metal ? 1 : 0);
  }
}

/** Chanfro: em relevo = claro em cima/esquerda e escuro embaixo/direita; rebaixado = o contrário. */
function bevel(c: Canvas, x0: number, y0: number, w: number, h: number, raised = true, k = 1): void {
  const hi = raised ? 1 + 0.16 * k : 1 - 0.2 * k, lo = raised ? 1 - 0.24 * k : 1 + 0.12 * k;
  for (let x = x0; x < x0 + w; x++) { shade(c, x, y0, hi, raised ? 0.1 : -0.1); shade(c, x, y0 + h - 1, lo, raised ? -0.1 : 0.05); }
  for (let gy = y0 + 1; gy < y0 + h - 1; gy++) { shade(c, x0, gy, hi, raised ? 0.08 : -0.08); shade(c, x0 + w - 1, gy, lo, raised ? -0.08 : 0.04); }
}

/** Furo transparente, com a moldura em volta escurecida (profundidade) e o peitoril claro. */
function hole(c: Canvas, x0: number, y0: number, w: number, h: number): void {
  for (let gy = y0; gy < y0 + h; gy++) for (let x = x0; x < x0 + w; x++) {
    const y = gy - c.gy0;
    if (x >= 0 && x <= 15 && y >= 0 && y <= 15) c.t.setAlpha(x, y, 0);
  }
  for (let x = x0 - 1; x <= x0 + w; x++) { shade(c, x, y0 - 1, 0.72, -0.1); shade(c, x, y0 + h, 1.14, 0.05); }
  for (let gy = y0; gy < y0 + h; gy++) { shade(c, x0 - 1, gy, 0.8, -0.05); shade(c, x0 + w, gy, 1.06); }
}

/** Ferro escuro das ferragens. */
const IRON: RGB[] = [0x1e1e22, 0x2e2e33, 0x404046, 0x56565d, 0x74747c, 0x9a9aa2].map(hex);
function iron(c: Canvas, x: number, gy: number, i: number, h = 0.7): void { set(c, x, gy, IRON[i], h, 0.55, 1); }
/** Rebite: ponto claro com sombra embaixo-direita. */
function rivet(c: Canvas, x: number, gy: number, p: RGB[] = IRON): void {
  set(c, x, gy, p[p.length - 1], 0.9, 0.7, 1);
  set(c, x + 1, gy + 1, p[1], 0.45, 0.5, 1);
}
/** Dobradiça/cinta de ferro horizontal saindo da borda esquerda. */
function strap(c: Canvas, x0: number, gy: number, len: number): void {
  for (let x = x0; x < x0 + len; x++) { iron(c, x, gy, x === x0 + len - 1 ? 2 : 3, 0.75); iron(c, x, gy + 1, 1, 0.65); }
  rivet(c, x0 + 1, gy); rivet(c, x0 + len - 3, gy);
}
/** Maçaneta: argola de ferro. */
function handle(c: Canvas, x: number, gy: number): void {
  iron(c, x, gy, 4, 0.85); iron(c, x, gy + 1, 2, 0.8); iron(c, x + 1, gy + 1, 1, 0.6); iron(c, x, gy + 2, 1, 0.6);
}

/** Moldura completa da porta (montantes de 3 px, travessas no topo, na emenda e na base). */
function doorFrame(c: Canvas, salt: number): void {
  boards(c, 0, 0, 3, 32, 'v', 3, salt + 1, 0.05);
  boards(c, 13, 0, 3, 32, 'v', 3, salt + 2, 0.02);
  boards(c, 3, 0, 10, 3, 'h', 3, salt + 3, 0.04);
  boards(c, 3, 14, 10, 4, 'h', 4, salt + 4, 0.03);
  boards(c, 3, 29, 10, 3, 'h', 3, salt + 5, 0);
  bevel(c, 0, 0, 16, 32, true, 0.8);
}

// ------------------------------------------------------------------ portas (cada madeira com um desenho próprio)
type DoorDesign = (c: Canvas) => void;

const DOORS: Record<string, DoorDesign> = {
  /** Carvalho: janela de 4 vidros em cima, dois almofadados embaixo. */
  oak: (c) => {
    boards(c, 3, 3, 10, 11, 'v', 5, 11);
    boards(c, 3, 18, 10, 11, 'v', 5, 12, -0.04);
    doorFrame(c, 10);
    bevel(c, 3, 3, 10, 11, false);
    for (const x of [4, 9]) for (const y of [4, 9]) hole(c, x, y, 3, 3);
    for (const x of [4, 8]) { bevel(c, x, 19, 4, 9, true); }
    strap(c, 0, 5, 4); strap(c, 0, 25, 4);
    handle(c, 11, 16);
  },
  /** Pinheiro: tábuas verticais rústicas com travessas, mão-francesa e janelinha de 4 vidros. */
  spruce: (c) => {
    boards(c, 0, 0, 16, 32, 'v', 4, 21);
    for (const y of [2, 13, 18, 28]) { boards(c, 0, y, 16, 3, 'h', 3, 22 + y, 0.06); bevel(c, 0, y, 16, 3, true); }
    for (let i = 0; i < 8; i++) { const x = 3 + i, y = 27 - Math.round(i * 0.9); boards(c, x, y - 1, 2, 3, 'h', 3, 30, 0.08); }
    for (const x of [5, 9]) for (const y of [6, 9]) hole(c, x, y, 2, 2);
    strap(c, 0, 3, 10); strap(c, 0, 29, 10);
    handle(c, 12, 15);
  },
  /** Bétula: porta de jardim com 6 vidrinhos e parte de baixo em frisos verticais. */
  birch: (c) => {
    boards(c, 3, 3, 10, 11, 'v', 5, 41, 0.04);
    boards(c, 3, 18, 10, 11, 'v', 2, 42);
    doorFrame(c, 40);
    for (const x of [4, 9]) for (const y of [4, 7, 10]) hole(c, x, y, 3, 2);
    bevel(c, 3, 18, 10, 11, false, 0.7);
    strap(c, 0, 4, 3); strap(c, 0, 26, 3);
    handle(c, 11, 16);
  },
  /** Jatobá: três frestas altas em cima e venezianas inclinadas embaixo. */
  jungle: (c) => {
    boards(c, 3, 3, 10, 11, 'v', 2, 51);
    doorFrame(c, 50);
    for (let y = 18; y < 29; y += 2) {
      boards(c, 3, y, 10, 2, 'h', 2, 52 + y, 0.08);
      for (let x = 3; x < 13; x++) shade(c, x, y + 1, 0.7, -0.15);
    }
    hole(c, 5, 4, 1, 8); hole(c, 7, 4, 2, 8); hole(c, 10, 4, 1, 8);
    strap(c, 0, 5, 4); strap(c, 0, 24, 4);
    handle(c, 11, 16);
  },
  /** Acácia: janela em arco com travessa e tábuas em espinha de peixe embaixo. */
  acacia: (c) => {
    boards(c, 3, 3, 10, 11, 'v', 5, 61);
    doorFrame(c, 60);
    for (let gy = 18; gy < 29; gy++) for (let x = 3; x < 13; x++) {
      const k = ((x < 8 ? x : 15 - x) + gy) % 4;
      const v = 0.5 + (k === 0 ? 0.18 : k === 3 ? -0.26 : 0) + (c.t.white(x, gy, 62) - 0.5) * 0.12;
      set(c, x, gy, shadeIdx(c.p, v), k === 3 ? 0.4 : 0.6);
    }
    for (let gy = 18; gy < 29; gy++) { shade(c, 7, gy, 0.85); shade(c, 8, gy, 0.85); }
    hole(c, 7, 4, 2, 1); hole(c, 6, 5, 4, 1); hole(c, 5, 6, 6, 2); hole(c, 5, 9, 6, 3);
    strap(c, 0, 5, 4); strap(c, 0, 25, 4);
    handle(c, 11, 16);
  },
  /** Carvalho-escuro: porta de fortaleza, cintas de ferro, cravos e grade pequena. */
  dark_oak: (c) => {
    boards(c, 0, 0, 16, 32, 'v', 4, 71);
    bevel(c, 0, 0, 16, 32, true, 0.8);
    for (const y of [2, 14, 28]) for (let x = 0; x < 16; x++) { iron(c, x, y, 3, 0.8); iron(c, x, y + 1, 1, 0.6); }
    for (const y of [2, 14, 28]) for (const x of [1, 5, 10, 14]) rivet(c, x, y);
    for (const [x, y] of [[4, 20], [11, 20], [4, 24], [11, 24], [4, 9], [11, 9]]) rivet(c, x, y);
    hole(c, 5, 5, 2, 5); hole(c, 9, 5, 2, 5);
    for (let y = 4; y < 11; y++) { iron(c, 7, y, 3); iron(c, 8, y, 2); }
    for (let x = 4; x < 12; x++) { iron(c, x, 4, 3); iron(c, x, 10, 2); }
    handle(c, 11, 17);
  },
  /** Lume: vigia redonda com aro que brilha e veios luminosos embutidos. */
  lume: (c) => {
    boards(c, 3, 3, 10, 11, 'v', 5, 81);
    boards(c, 3, 18, 10, 11, 'v', 5, 82, -0.04);
    doorFrame(c, 80);
    const GL1 = hex(0x5fd6ea), GL2 = hex(0xbaf6ff);
    hole(c, 5, 6, 6, 4); hole(c, 6, 5, 4, 6);
    for (let gy = 3; gy < 13; gy++) for (let x = 3; x < 13; x++) {
      const d = Math.hypot(x - 7.5, gy - 7.5);
      if (d >= 2.95 && d < 3.9) set(c, x, gy, d < 3.6 ? GL2 : GL1, 0.7, 0.5, 0, d < 3.6 ? 1 : 0.8);
    }
    // veio luminoso: tronco central com ramos, nas duas metades
    for (let gy = 17; gy < 28; gy++) set(c, 7 + ((gy >> 2) & 1), gy, GL1, 0.5, 0.5, 0, 0.85);
    for (const [x, gy] of [[6, 20], [5, 19], [9, 23], [10, 22], [6, 26], [5, 25], [10, 26], [11, 25]]) set(c, x, gy, GL1, 0.5, 0.5, 0, 0.8);
    for (const [x, gy] of [[4, 18], [12, 21], [4, 24], [12, 27]]) set(c, x, gy, GL2, 0.6, 0.5, 0, 1);
    strap(c, 0, 5, 3); strap(c, 0, 26, 3);
    handle(c, 11, 15);
  },
  /** Cinzeiro: janela em cruz e tábuas em espinha, com rachaduras de brasa. */
  ash: (c) => {
    boards(c, 3, 3, 10, 11, 'h', 2, 91);
    doorFrame(c, 90);
    for (let gy = 18; gy < 29; gy++) for (let x = 3; x < 13; x++) {
      const k = (x + (x < 8 ? gy : -gy) + 64) % 4;
      const v = 0.48 + (k === 0 ? 0.16 : k === 3 ? -0.24 : 0) + (c.t.white(x, gy, 92) - 0.5) * 0.12;
      set(c, x, gy, shadeIdx(c.p, v), k === 3 ? 0.4 : 0.6);
    }
    hole(c, 7, 3, 2, 9); hole(c, 4, 6, 3, 2); hole(c, 9, 6, 3, 2);
    for (const [x, gy] of [[5, 21], [6, 22], [6, 23], [10, 25], [11, 26], [9, 20]]) set(c, x, gy, hex(0xe0602a), 0.35, 0.3, 0, 0.55);
    strap(c, 0, 4, 4); strap(c, 0, 26, 4);
    handle(c, 11, 16);
  },
};

/** Porta de ferro: chapas escovadas com rebites, duas janelas estreitas e cinta central. */
const IRON_DOOR_PAL: RGB[] = [0x55555c, 0x6e6e75, 0x88888f, 0xa2a2a9, 0xbcbcc3, 0xd8d8de].map(hex);
function ironDoor(c: Canvas): void {
  for (let gy = 0; gy < 32; gy++) for (let x = 0; x < 16; x++) {
    const v = 0.55 + (c.t.vnoise(x, gy * 3, 4, 7) - 0.5) * 0.18 + (c.t.white(x, gy, 8) - 0.5) * 0.06;
    set(c, x, gy, shadeIdx(IRON_DOOR_PAL, v), 0.55, 0.72, 1);
  }
  bevel(c, 0, 0, 16, 32, true, 1.2);
  bevel(c, 3, 3, 10, 10, false, 0.9);
  bevel(c, 3, 19, 10, 9, false, 0.9);
  for (let x = 0; x < 16; x++) { set(c, x, 14, IRON_DOOR_PAL[5], 0.8, 0.8, 1); set(c, x, 15, IRON_DOOR_PAL[3], 0.7, 0.75, 1); set(c, x, 16, IRON_DOOR_PAL[2], 0.65, 0.7, 1); set(c, x, 17, IRON_DOOR_PAL[0], 0.45, 0.6, 1); }
  // diagonal em relevo no painel de baixo
  for (let i = 0; i < 9; i++) { shade(c, 3 + i, 27 - i, 1.18, 0.1); shade(c, 4 + i, 27 - i, 0.8, -0.05); }
  hole(c, 4, 4, 2, 8); hole(c, 10, 4, 2, 8);
  const RIV = IRON_DOOR_PAL;
  for (const gy of [1, 30]) for (const x of [1, 5, 10, 14]) rivet(c, x, gy, RIV);
  for (const gy of [5, 10, 21, 26]) { rivet(c, 1, gy, RIV); rivet(c, 13, gy, RIV); }
  for (const x of [2, 7, 12]) rivet(c, x, 15, RIV);
  // alavanca da fechadura
  for (const [x, gy, i] of [[11, 18, 5], [12, 18, 4], [11, 19, 3], [11, 20, 2], [12, 19, 1]] as [number, number, number][]) set(c, x, gy, IRON[i], 0.85, 0.6, 1);
}

// ------------------------------------------------------------------ alçapões (furos simétricos nos dois eixos; y0..2 é a borda)
type Trap = (c: Canvas) => void;
function trapFrame(c: Canvas, salt: number, inner: 'v' | 'h' = 'v', bw = 5): void {
  boards(c, 3, 3, 10, 10, inner, bw, salt + 9);
  boards(c, 0, 0, 16, 3, 'h', 3, salt + 1, 0.05);
  boards(c, 0, 13, 16, 3, 'h', 3, salt + 2, 0);
  boards(c, 0, 3, 3, 10, 'v', 3, salt + 3, 0.04);
  boards(c, 13, 3, 3, 10, 'v', 3, salt + 4, 0.02);
  bevel(c, 0, 0, 16, 16, true, 0.9);
  bevel(c, 3, 3, 10, 10, false, 0.8);
}

const TRAPS: Record<string, Trap> = {
  oak: (c) => { trapFrame(c, 110); for (const x of [4, 9]) for (const y of [4, 9]) hole(c, x, y, 3, 3); },
  spruce: (c) => {
    boards(c, 0, 0, 16, 16, 'v', 4, 120);
    for (const y of [0, 13]) { boards(c, 0, y, 16, 3, 'h', 3, 121 + y, 0.06); bevel(c, 0, y, 16, 3, true); }
    bevel(c, 0, 0, 16, 16, true, 0.8);
    hole(c, 4, 7, 2, 2); hole(c, 10, 7, 2, 2);
    strap(c, 0, 4, 12); strap(c, 0, 10, 12);
  },
  birch: (c) => { trapFrame(c, 130); for (const x of [3, 7, 11]) for (const y of [3, 7, 11]) hole(c, x, y, 2, 2); },
  jungle: (c) => {
    trapFrame(c, 140, 'h', 2);
    for (const [x, y] of [[7, 4], [4, 7], [7, 7], [10, 7], [7, 10]]) hole(c, x, y, 2, 2);
  },
  acacia: (c) => {
    trapFrame(c, 150, 'h', 3);
    for (const y of [4, 6, 9, 11]) hole(c, 3, y, 10, 1);
  },
  dark_oak: (c) => {
    boards(c, 0, 0, 16, 16, 'v', 4, 160);
    bevel(c, 0, 0, 16, 16, true, 0.8);
    for (const [x, y] of [[0, 0], [13, 0], [0, 13], [13, 13]]) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) iron(c, x + i, y + j, i + j === 0 ? 4 : 2, 0.75);
    for (let x = 3; x < 13; x++) { iron(c, x, 1, 3); iron(c, x, 14, 2); }
    for (const x of [5, 9]) for (const y of [5, 9]) hole(c, x, y, 2, 2);
    for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14], [7, 1], [7, 14]]) rivet(c, x, y);
  },
  lume: (c) => {
    trapFrame(c, 170);
    const GL1 = hex(0x5fd6ea), GL2 = hex(0xbaf6ff);
    hole(c, 5, 6, 6, 4); hole(c, 6, 5, 4, 6);
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d >= 2.95 && d < 3.9) set(c, x, y, d < 3.6 ? GL2 : GL1, 0.7, 0.5, 0, d < 3.6 ? 1 : 0.8);
    }
    for (const [x, y] of [[3, 3], [4, 4], [12, 3], [11, 4], [3, 12], [4, 11], [12, 12], [11, 11]]) set(c, x, y, GL1, 0.5, 0.5, 0, 0.8);
  },
  ash: (c) => {
    trapFrame(c, 180, 'h', 2);
    for (const x of [4, 6, 9, 11]) hole(c, x, 3, 1, 10);
    for (const [x, y] of [[1, 6], [14, 9]]) set(c, x, y, hex(0xe0602a), 0.35, 0.3, 0, 0.5);
  },
};

// ------------------------------------------------------------------ mudas (copa com folhagem + tronco com o caráter de cada árvore)
interface SaplingDesign { mask: string[]; leaf: number[]; trunk: string[]; bark?: Legend; glow?: number; salt: number }
const bark = (id: string): Legend => { const b = WOOD_PALS[id].bark; return { a: b[0], b: b[1], c: b[2], d: b[3] }; };

const SAPLINGS: Record<string, SaplingDesign> = {
  oak: {
    salt: 3, leaf: [0x245a1c, 0x2e6e22, 0x3a842a, 0x4a9834, 0x5eac40, 0x7cc05a],
    mask: ['................', '................', '.....###.##.....', '...#########....', '..###########...', '..############..',
      '.#############..', '..###########...', '...####.####....', '.....#...#......'],
    trunk: ['', '', '', '', '', '', '', '', '.......d........', '.......dc.......', '......dc.b......', '.......dc.......',
      '.......dc.......', '.......db.......', '.......db.......', '......cdbb......'],
  },
  spruce: {
    salt: 5, leaf: [0x17331f, 0x1e4228, 0x265232, 0x30643c, 0x3c7848, 0x4c8c58],
    mask: ['.......#........', '......###.......', '.....#####......', '......###.......', '....#######.....', '...#########....',
      '.....#####......', '...#########....', '..###########...', '.#############..', '....#######.....'],
    trunk: ['', '', '', '', '', '', '', '', '', '', '', '.......cb.......', '.......cb.......', '.......cb.......', '.......ca.......', '......bcba......'],
  },
  birch: {
    salt: 7, leaf: [0x3e6e1e, 0x4c8226, 0x5e9630, 0x74aa3c, 0x8cbe4c, 0xa8d266],
    mask: ['................', '......##........', '.....####.#.....', '....#######.....', '...########.....', '....########....',
      '...#########....', '....#######.....', '.....#####......', '................'],
    trunk: ['', '', '', '', '', '', '', '', '.......w........', '.......wv.......', '.......kv.......', '.......wv.......',
      '.......wk.......', '.......wv.......', '.......kv.......', '......vwwv......'],
    bark: { w: hex(0xe2ded5), v: hex(0xb8b3a8), k: hex(0x2a2a26) },
  },
  jungle: {
    salt: 9, leaf: [0x1a4a18, 0x22601e, 0x2c7626, 0x3a8e30, 0x4ea63e, 0x6cbc54],
    mask: ['......###.......', '.....#####......', '.##..#####..##..', '####..###..####.', '#####..#..######', '.#####.#.######.',
      '..###.....####..', '...#.......##...', '................', '................'],
    trunk: ['', '', '', '', '', '.......d........', '.......d........', '.......dc.......', '.......dc.......', '.......dc.......',
      '.......dc.......', '......d.c.......', '.......dc.......', '.......dc.......', '.......db.......', '......cdbb......'],
  },
  acacia: {
    salt: 11, leaf: [0x3a5a1a, 0x4a6e20, 0x5c8228, 0x6e9630, 0x84aa3c, 0x9ebe50],
    mask: ['................', '................', '................', '...##..###......', '..###########...', '.#############..',
      '..###.####.##...', '................'],
    trunk: ['', '', '', '', '', '', '', '.......c........', '.......cb.......', '........cb......', '.........cb.....',
      '........cb......', '.......cb.......', '.......cb.......', '.......cb.......', '......bccb......'],
  },
  dark_oak: {
    salt: 13, leaf: [0x122a16, 0x18361c, 0x204624, 0x2a582c, 0x366c36, 0x448044],
    mask: ['................', '................', '.....#####......', '...#########....', '..###########...', '.#############..',
      '.#############..', '.#############..', '..###########...', '...#########....', '.....#####......'],
    trunk: ['', '', '', '', '', '', '', '', '', '', '.......cb.......', '......dcb.......', '......dcba......', '......dcba......',
      '......dcba......', '.....ddcbaa.....'],
  },
  lume: {
    salt: 15, leaf: [0x1f5c74, 0x2a6f8a, 0x3b93b3, 0x57b8d6, 0x86dcef, 0xc4f6ff], glow: 0.55,
    mask: ['................', '................', '......###.......', '....#######.....', '...#########....', '..###########...',
      '..###########...', '..#.#######.#...', '..#.#.###.#.#...', '....#.....#.....'],
    trunk: ['', '', '', '', '', '', '', '', '', '.......d........', '.......dc.......', '.......dc.......',
      '.......dc.......', '.......db.......', '.......db.......', '......cdbb......'],
  },
  ash: {
    salt: 17, leaf: [0x4a3636, 0x5e4442, 0x74524e, 0x8a5f58, 0xa06e64, 0xb88476],
    mask: ['................', '................', '..##.....##.....', '.####...####....', '.#####.#####....', '..###...###.....',
      '.....###........', '....#####.......', '.....###........', '................'],
    trunk: ['', '', '', '', '', '...c......c.....', '....c....c......', '.....c..c.......', '......cc........', '.......cb.......',
      '......cb........', '.......cb.......', '........cb......', '.......cb.......', '.......cb.......', '......bccb......'],
  },
};

function sapling(t: Tex, id: string): void {
  const d = SAPLINGS[id];
  const lg: Legend = d.bark ?? bark(id);
  sprite(t, d.trunk.map((r) => r || '................'), lg, { s: 0.15, p: 0.7 });
  foliage(t, d.mask, d.leaf.map(hex), { salt: d.salt, holes: 0.04, s: 0.35 });
  if (d.glow) {
    // folhas-lume brilham; algumas gotas de luz mais claras
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (y < d.mask.length && d.mask[y][x] === '#' && t.alpha(x, y)) t.emit(x, y, d.glow + t.white(x, y, 3) * 0.3);
    }
    for (const [x, y] of [[5, 4], [9, 6], [3, 8], [11, 8], [7, 3]]) if (t.alpha(x, y)) { t.px(x, y, hex(0xeaffff)); t.emit(x, y, 1); }
  }
}

// ------------------------------------------------------------------ registro
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'lume', 'ash'];
const canvas = (t: Tex, gy0: number, p: RGB[], metal = false): Canvas => ({ t, gy0, p, metal });

export const WOODPART_PAINTERS: Record<string, Painter> = {
  iron_door_top: (t) => ironDoor(canvas(t, 0, IRON_DOOR_PAL, true)),
  iron_door_bottom: (t) => ironDoor(canvas(t, 16, IRON_DOOR_PAL, true)),
};
for (const id of WOODS) {
  const p = WOOD_PALS[id].plank;
  WOODPART_PAINTERS[`${id}_sapling`] = (t) => sapling(t, id);
  WOODPART_PAINTERS[`${id}_door_top`] = (t) => DOORS[id](canvas(t, 0, p));
  WOODPART_PAINTERS[`${id}_door_bottom`] = (t) => DOORS[id](canvas(t, 16, p));
  WOODPART_PAINTERS[`${id}_trapdoor`] = (t) => TRAPS[id](canvas(t, 0, p));
}
