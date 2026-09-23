/**
 * Pintores do grupo C (parte 1): mesas e estações de trabalho — bancada, fornalhas (comum, defumador,
 * alto-forno), baú, barril, atril e as mesas de cartografia, flecheiro, ferraria e tear
 * (a mesa de encantamento fica na parte 2). A parte 2 (utility2.ts) traz o kit comum e os blocos de luz/decoração.
 */
import { Tex, type Painter, hex, mix, pal, scale } from '../tex';
import { WOOD_PALS } from '../styles';
import {
  FURN, IRON_INK, PAL, UTILITY2_PAINTERS, WOOD_INK, boards, clamp01, disc, flamePx, furniture, glow, masonry, matRect,
  metalPanel, panel, pick, rivet, slabTop, sprite,
} from './utility2';

const OAKP = WOOD_PALS.oak.plank;
const BRICK = pal(0x5e2618, 0x7a3624, 0x944430, 0xaa563c, 0xbc6a4c);

/** Boca de fornalha em arco (abertura x4..11, y6..13), forrada de tijolos; acesa = brasas e chamas. */
function furnaceMouth(t: Tex, lit: boolean): void {
  const open = (x: number, y: number) => y >= 6 && y <= 13 && x >= 4 && x <= 11 && !(y === 6 && (x < 6 || x > 9)) && !(y === 7 && (x < 5 || x > 10));
  for (let y = 3; y < 16; y++) for (let x = 1; x < 15; x++) {
    if (open(x, y)) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && open(x + dx, y + dy)) { near = true; break; }
    if (!near || y > 14) continue;
    const joint = (x * 3 + y * 5) % 7 === 0;
    t.px(x, y, joint ? FURN[1] : pick(BRICK, 0.5 + (t.white(x, y, 4) - 0.5) * 0.5 - (x + y) * 0.012)); t.h(x, y, joint ? 0.3 : 0.62);
    t.m(x, y, 0.18, 0, 0.55, lit ? 0.12 : 0);
    if (lit) t.px(x, y, mix(t.get(x, y), hex(0xff8a3a), 0.18));
  }
  for (let x = 3; x <= 12; x++) { t.px(x, 14, pick(FURN, 0.85)); t.px(x, 15, pick(FURN, 0.35)); t.h(x, 14, 0.7); }
  for (let y = 6; y <= 13; y++) for (let x = 4; x <= 11; x++) {
    if (!open(x, y)) continue;
    if (!lit) {
      let c = mix(hex(0x0e0c0b), hex(0x2a2522), clamp01((y - 6) / 10 + (x - 4) / 20));
      if (y === 12 && x % 2 === 0) c = hex(0x3a3a40);
      if (y === 13) c = mix(hex(0x4a4642), hex(0x2e2b29), t.white(x, y, 3));
      t.px(x, y, c); t.h(x, y, 0.1); t.m(x, y, 0.1, 0, 0.8); continue;
    }
    const f = y >= 11 ? 0.55 + t.white(x, y, 6) * 0.45 : t.vnoise(x, y, 4, 7) * 1.1 - (11 - y) * 0.09;
    if (f > 0.25) flamePx(t, x, y, clamp01(f), y >= 11 ? PAL.ember : PAL.flame);
    else { t.px(x, y, hex(0x1a0e0a)); t.h(x, y, 0.1); t.m(x, y, 0.1, 0, 0.8, 0.1); }
  }
  // registro de ferro acima do arco
  metalPanel(t, 6, 2, 4, 2, PAL.darkIron, 0.55, { salt: 3 });
  t.px(7, 2, hex(0x101114)); t.px(8, 2, hex(0x101114));
}

const SMOKE_W = pal(0x241810, 0x2e2016, 0x38281c, 0x443222, 0x503c2a);

/** Base do defumador: madeira escura vertical sobre rodapé de pedra, com cintas de ferro. */
function smokerBody(t: Tex): void {
  boards(t, 0, 0, 16, 12, SMOKE_W, { vertical: true, size: 4, salt: 5 });
  panel(t, 0, 12, 16, 4, FURN, { n: 0.3, bevel: 0.3, salt: 6, mat: [0.2, 0, 0.4] });
  for (const y of [1, 9]) {
    metalPanel(t, 0, y, 16, 2, PAL.darkIron, 0.55, { salt: y });
    for (const x of [1, 6, 11]) rivet(t, x, y, PAL.iron[3], PAL.darkIron[0]);
  }
}

/** Grelha de ferro com brasas (ou escuridão) atrás das barras. */
function grill(t: Tex, x0: number, y0: number, w: number, h: number, lit: boolean, vertical: boolean): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const bar = vertical ? (x - x0) % 2 === 0 : (y - y0) % 2 === 0;
    const frame = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
    if (bar || frame) { t.px(x, y, pick(PAL.darkIron, frame ? (x === x0 || y === y0 ? 0.85 : 0.2) : 0.55)); t.h(x, y, 0.7); t.m(x, y, 0.55, 1, 0.1); continue; }
    if (lit) { const e = t.vnoise(x, y, 4, 5) * 0.7 + (y - y0) / h * 0.4; flamePx(t, x, y, clamp01(e), PAL.ember); }
    else { t.px(x, y, mix(hex(0x0c0b0a), hex(0x241f1c), (y - y0) / h)); t.h(x, y, 0.2); t.m(x, y, 0.1, 0, 0.8); }
  }
}

const STATIONS: Record<string, Painter> = {
  crafting_table_top: (t) => {
    boards(t, 0, 0, 16, 16, OAKP, { size: 4, salt: 11 });
    for (let i = 0; i < 16; i++) for (const [x, y] of [[i, 0], [0, i], [i, 15], [15, i]]) t.shadePx(x, y, x === 15 || y === 15 ? 0.6 : 0.82);
    // esquadro de ferro, lápis e riscos de faca
    const I = PAL.iron;
    for (let i = 0; i < 7; i++) {
      t.px(3 + i, 3, I[4]); t.px(3 + i, 4, I[2]); t.px(3, 3 + i, I[4]); t.px(4, 3 + i, I[2]);
      for (const [x, y] of [[3 + i, 3], [3 + i, 4], [3, 3 + i], [4, 3 + i]]) { t.h(x, y, 0.8); t.m(x, y, 0.65, 1, 0.08); }
      if (i % 2 === 1) { t.px(3 + i, 4, I[0]); t.px(4, 3 + i, I[0]); }
    }
    sprite(t, ['   k', '  yo', ' yo ', 'yo  ', 'o   '], { k: hex(0x2a2a2e), y: WOOD_INK(hex(0xe0b83a)), o: WOOD_INK(hex(0xa8801e)) }, 8, 8);
    for (const [x, y] of [[11, 5], [12, 6], [6, 12], [7, 12]]) { t.shadePx(x, y, 0.7); t.h(x, y, 0.3); }
  },
  crafting_table_front: (t) => {
    furniture(t, OAKP, WOOD_PALS.spruce.plank, 12);
    const I = PAL.iron;
    // martelo e serrote pendurados em cavilhas
    sprite(t, [' pp  ', 'hHHHh', 'hHHHh', '  w  ', '  w  ', '  w  ', '  w  ', '  d  '], {
      p: WOOD_INK(hex(0x2a1c10)), H: IRON_INK(I[4]), h: IRON_INK(I[1]), w: WOOD_INK(hex(0xb08650)), d: WOOD_INK(hex(0x7a5630)),
    }, 3, 4);
    sprite(t, ['  p  ', ' www ', ' wkw ', ' www ', 'SSSSs', 'SSSSs', ' SSSs', ' SSSs', '  SSs', '  ts '], {
      p: WOOD_INK(hex(0x2a1c10)), w: WOOD_INK(hex(0xa87a44)), k: WOOD_INK(hex(0x3a2818), 0.4), S: IRON_INK(I[3]), s: IRON_INK(I[5]), t: IRON_INK(I[1]),
    }, 8, 4);
  },
  crafting_table_side: (t) => {
    furniture(t, OAKP, WOOD_PALS.spruce.plank, 13);
    const I = PAL.iron;
    // maço de madeira e formão
    sprite(t, ['  p  ', 'MMMMm', 'MMMMm', 'mmmmm', '  w  ', '  w  ', '  w  ', '  d  '], {
      p: WOOD_INK(hex(0x2a1c10)), M: WOOD_INK(hex(0xc89a60)), m: WOOD_INK(hex(0x8a6236)), w: WOOD_INK(hex(0xb08650)), d: WOOD_INK(hex(0x7a5630)),
    }, 3, 4);
    sprite(t, ['p', 'w', 'w', 'w', 'b', 'S', 'S', 's'], {
      p: WOOD_INK(hex(0x2a1c10)), w: WOOD_INK(hex(0x9a3a2a)), b: IRON_INK(PAL.brass[3]), S: IRON_INK(I[4]), s: IRON_INK(I[1]),
    }, 11, 4);
  },
  furnace_top: (t) => slabTop(t),
  furnace_side: (t) => masonry(t),
  furnace_front: (t) => { masonry(t); furnaceMouth(t, false); },
  furnace_front_on: (t) => { masonry(t); furnaceMouth(t, true); },
  smoker_top: (t) => {
    slabTop(t);
    grill(t, 3, 3, 10, 10, false, false);
    for (let i = 0; i < 10; i++) { const x = 2 + t.rng.nextInt(12), y = 2 + t.rng.nextInt(12); if (x < 3 || x > 12 || y < 3 || y > 12) t.shadePx(x, y, 0.75); }
  },
  smoker_side: smokerBody,
  smoker_front: (t) => { smokerBody(t); grill(t, 3, 3, 10, 8, false, true); },
  smoker_front_on: (t) => { smokerBody(t); grill(t, 3, 3, 10, 8, true, true); },
  blast_furnace_top: (t) => {
    panel(t, 0, 0, 16, 16, PAL.smooth, { n: 0.25, bevel: 0.3, salt: 2, mat: [0.4, 0, 0.3] });
    metalPanel(t, 2, 2, 12, 12, PAL.darkIron, 0.6, { salt: 3 });
    for (const hy of [4, 7, 10]) for (const hx of [4, 7, 10]) for (let y = hy; y < hy + 2; y++) for (let x = hx; x < hx + 2; x++) {
      t.px(x, y, x === hx && y === hy ? hex(0x08090b) : hex(0x17181c)); t.h(x, y, 0.1); t.m(x, y, 0.2, 0, 0.5);
    }
  },
  blast_furnace_side: (t) => blastSide(t),
  blast_furnace_front: (t) => blastFront(t, false),
  blast_furnace_front_on: (t) => blastFront(t, true),
};

/** Lateral do alto-forno: pedra lisa em duas fiadas com cinta de ferro rebitada no meio. */
function blastSide(t: Tex): void {
  for (const [y0, h] of [[0, 6], [10, 6]]) for (const x0 of [0, 8]) panel(t, x0, y0, 8, h, PAL.smooth, { n: 0.25, bevel: 0.26, salt: x0 + y0, mat: [0.4, 0, 0.3] });
  metalPanel(t, 0, 6, 16, 4, PAL.darkIron, 0.6, { salt: 4 });
  for (const x of [1, 5, 9, 13]) rivet(t, x, 7, PAL.iron[3], PAL.darkIron[0]);
}

/** Frente do alto-forno: moldura de ferro, grade vertical e câmara (acesa = brilho intenso). */
function blastFront(t: Tex, lit: boolean): void {
  blastSide(t);
  metalPanel(t, 2, 3, 12, 11, PAL.darkIron, 0.6, { salt: 7 });
  for (let y = 5; y <= 11; y++) for (let x = 4; x <= 11; x++) {
    const bar = x === 4 || x === 6 || x === 9 || x === 11 || y === 8;
    if (bar) { t.px(x, y, pick(PAL.iron, x === 4 || x === 9 ? 0.45 : 0.25)); t.h(x, y, 0.7); t.m(x, y, 0.6, 1, 0.1, 0); if (lit) t.px(x, y, mix(t.get(x, y), hex(0xff9a40), 0.2)); continue; }
    if (lit) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8.5); flamePx(t, x, y, clamp01(1.1 - d * 0.14 + (t.white(x, y, 2) - 0.5) * 0.2)); }
    else { t.px(x, y, mix(hex(0x0c0c0e), hex(0x26262a), (y - 5) / 8)); t.h(x, y, 0.15); t.m(x, y, 0.1, 0, 0.8); }
  }
  for (const [x, y] of [[2, 3], [12, 3], [2, 12], [12, 12]]) rivet(t, x, y, PAL.iron[4], PAL.darkIron[0]);
}

// ------------------------------------------------------------------ baú e barril
const CHEST = pal(0x5a3a1c, 0x6e4824, 0x84582e, 0x986a38, 0xab7c44);
const BAND = pal(0x2e3036, 0x3e4148, 0x50545c, 0x666a73, 0x7e838c, 0x9aa0a8);
const BARREL = pal(0x4a3220, 0x5a3e28, 0x6a4a30, 0x7a5638, 0x8a6242);

/** Lateral do baú (altura 14: linhas 2..15): tampa y2..6, corpo y7..15, cantoneiras de ferro. */
function chestSide(t: Tex): void {
  t.transparent();
  boards(t, 0, 2, 16, 5, CHEST, { size: 5, salt: 1 });
  boards(t, 0, 7, 16, 8, CHEST, { size: 4, salt: 2 });
  for (let x = 0; x < 16; x++) { t.px(x, 15, pick(CHEST, 0.1)); t.h(x, 15, 0.4); }
  for (let x = 0; x < 16; x++) { t.shadePx(x, 6, 0.7); t.shadePx(x, 7, 1.1); }
  for (const x0 of [0, 14]) {
    panel(t, x0, 2, 2, 14, BAND, { n: 0.2, bevel: 0.35, streak: 'v', salt: x0, mat: [0.6, 1, 0.08] });
    for (const y of [3, 9, 13]) rivet(t, x0 === 0 ? 0 : 14, y, BAND[5], BAND[0]);
  }
}

/** Placa de fechadura (x6..9, y5..10), por baixo do fecho 3D; `trap` troca o buraco por um cristal ciano. */
function lockPlate(t: Tex, trap: boolean): void {
  metalPanel(t, 6, 5, 4, 6, BAND, 0.65, { salt: 5 });
  if (trap) {
    glow(t, 7, 9, PAL.fulgor[4], 0.45); glow(t, 8, 9, PAL.fulgor[3], 0.35); glow(t, 7, 10, PAL.fulgor[2], 0.3); glow(t, 8, 10, PAL.fulgor[1], 0.25);
    for (const [x, y] of [[7, 9], [8, 9], [7, 10], [8, 10]]) t.m(x, y, 0.9, 0, 0.05, 0.4);
  } else {
    t.px(7, 9, hex(0x0c0c0e)); t.px(8, 9, hex(0x0c0c0e)); t.px(7, 10, hex(0x1a1a1e)); t.px(8, 10, BAND[2]);
    for (const [x, y] of [[7, 9], [8, 9], [7, 10]]) t.h(x, y, 0.2);
  }
}

/** Anel de topo do barril: pontas das aduelas (2 px) segmentadas. */
function barrelRim(t: Tex): void {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x >= 2 && x <= 13 && y >= 2 && y <= 13) continue;
    const along = y < 2 || y > 13 ? x : y;
    let v = 0.62 + (t.white(x, y, 3) - 0.5) * 0.2 - (along % 4 === 3 ? 0.35 : 0);
    if (x === 0 || y === 0) v += 0.15;
    if (x === 15 || y === 15) v -= 0.25;
    t.px(x, y, pick(BARREL, v)); t.h(x, y, 0.7); t.m(x, y, 0.2, 0, 0.6);
  }
  for (let i = 1; i < 15; i++) for (const [x, y] of [[i, 2], [2, i]]) if (x >= 2 && y >= 2) { t.shadePx(x, y, 0.7); t.h(x, y, 0.4); }
}

function barrelLid(t: Tex): void {
  barrelRim(t);
  boards(t, 2, 2, 12, 12, BARREL, { size: 4, salt: 6, seams: false });
  for (let i = 2; i < 14; i++) { t.shadePx(i, 2, 0.72); t.shadePx(2, i, 0.78); }
}

const STORAGE: Record<string, Painter> = {
  chest_side: chestSide,
  chest_front: (t) => { chestSide(t); lockPlate(t, false); },
  trapped_chest_front: (t) => {
    chestSide(t);
    for (let y = 3; y <= 5; y++) for (let x = 2; x <= 13; x++) {
      const red = ((x + y) & 3) < 2;
      t.px(x, y, red ? mix(hex(0xb02a22), t.get(x, y), 0.2) : mix(hex(0x2a1a12), t.get(x, y), 0.3)); t.m(x, y, 0.3, 0, 0.4);
    }
    lockPlate(t, true);
  },
  chest_top: (t) => {
    boards(t, 0, 0, 16, 16, CHEST, { size: 4, salt: 3 });
    for (let i = 0; i < 16; i++) for (const [x, y] of [[i, 0], [0, i], [i, 15], [15, i]]) t.shadePx(x, y, x === 15 || y === 15 ? 0.6 : 0.85);
    // cantoneiras em L nos cantos da área usada (x1..14, y1..14)
    for (const [cx, cy, sx, sy] of [[1, 1, 1, 1], [14, 1, -1, 1], [1, 14, 1, -1], [14, 14, -1, -1]]) {
      for (let i = 0; i < 4; i++) for (const [x, y] of [[cx + sx * i, cy], [cx, cy + sy * i]]) {
        const lit = (sx > 0 && x === cx) || (sy > 0 && y === cy);
        t.px(x, y, BAND[lit ? 4 : 2]); t.h(x, y, 0.8); t.m(x, y, 0.6, 1, 0.08);
      }
      t.px(cx + sx, cy + sy, BAND[5]); t.h(cx + sx, cy + sy, 0.85); t.m(cx + sx, cy + sy, 0.6, 1, 0.08);
    }
  },
  barrel_side: (t) => {
    boards(t, 0, 0, 16, 16, BARREL, { vertical: true, size: 4, salt: 4, seams: false });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.shadePx(x, y, 0.86 + Math.cos(((y - 7.5) / 8) * Math.PI / 2) * 0.2);
    for (const y of [2, 12]) {
      metalPanel(t, 0, y, 16, 2, BAND, 0.55, { salt: y });
      for (const x of [2, 6, 10, 14]) rivet(t, x, y, BAND[5], BAND[0]);
    }
  },
  barrel_top: (t) => {
    barrelLid(t);
    // argola de ferro no meio da tampa
    for (let i = 6; i <= 9; i++) for (const [x, y] of [[i, 6], [6, i], [i, 9], [9, i]]) {
      t.px(x, y, BAND[x === 6 || y === 6 ? 5 : 2]); t.h(x, y, 0.85); t.m(x, y, 0.6, 1, 0.08);
    }
  },
  barrel_top_open: (t) => {
    barrelRim(t);
    for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) {
      const k = clamp01(((x - 2) + (y - 2)) / 22);
      const stave = (x - 2) % 3 === 0 && y > 3;
      let c = mix(hex(0x0e0906), hex(0x3a2818), k * k);
      if (stave) c = scale(c, 0.7);
      t.px(x, y, c); t.h(x, y, 0.05 + k * 0.2); t.m(x, y, 0.1, 0, 0.8);
    }
  },
  barrel_bottom: (t) => {
    barrelLid(t);
    // marca a fogo (ramo de trigo) no meio
    sprite(t, ['  k  ', ' k k ', '  k  ', ' kkk ', '  k  ', '  k  '], { k: { c: hex(0x2a1a0e), h: 0.35 } }, 5, 5);
  },
};

// ------------------------------------------------------------------ atril e mesas de ofício
const PARCH = pal(0xb09264, 0xc4a87a, 0xd6be92, 0xe4d0a8, 0xf0e0bc);
const DOAK = WOOD_PALS.dark_oak.plank;
const BIRCH = WOOD_PALS.birch.plank;
const BIRCH_D = pal(0x7e6a46, 0x907c54, 0xa28e62, 0xb3a070, 0xc2af7e);
const FEATHER = { w: hex(0xf2f0e8), g: hex(0xc4c2ba), r: hex(0xb03030) };

/** Lateral do atril: borda do tampo (y1..3), coluna (x4..11, y4..13) e base (y14..15); a frente ganha um painel em arco. */
function lecternSide(t: Tex, front: boolean): void {
  t.transparent();
  boards(t, 0, 1, 16, 3, PAL.oak, { size: 3, salt: 2 });
  boards(t, 4, 4, 8, 10, PAL.oak, { vertical: true, size: 4, salt: 3 });
  for (let x = 4; x < 12; x++) { t.shadePx(x, 4, 0.65); t.px(x, 13, pick(PAL.oak, 0.85)); }
  boards(t, 0, 14, 16, 2, PAL.oak, { size: 2, salt: 4 });
  if (front) {
    const arch = (x: number, y: number) => x >= 6 && x <= 9 && y >= 6 && y <= 11 && !(y === 6 && (x === 6 || x === 9));
    for (let y = 5; y <= 12; y++) for (let x = 5; x <= 10; x++) {
      if (arch(x, y)) { t.px(x, y, pick(PAL.darkWood, 0.35 + (y - 6) * 0.08 + (x - 6) * 0.05)); t.h(x, y, 0.35); continue; }
      const rim = arch(x + 1, y) || arch(x - 1, y) || arch(x, y + 1) || arch(x, y - 1) || arch(x + 1, y + 1) || arch(x - 1, y + 1);
      if (rim) { t.px(x, y, pick(PAL.oak, x > 8 || y > 11 ? 0.95 : 0.75)); t.h(x, y, 0.75); }
    }
    t.px(8, 9, PAL.brass[4]); t.m(8, 9, 0.7, 1, 0.1);
  }
}

/** Rolo de mapa visto de ponta (3×3). */
function scroll(t: Tex, x: number, y: number): void {
  sprite(t, [' ab', 'acb', 'bbd'], { a: WOOD_INK(PARCH[4]), b: WOOD_INK(PARCH[2]), c: WOOD_INK(hex(0x8a6a3e), 0.5), d: WOOD_INK(PARCH[0]) }, x, y);
}

/** Flecha vertical (3×10): ponta de sílex, haste e penas. */
function arrow(t: Tex, x: number, y: number): void {
  sprite(t, [' a ', 'abc', ' s ', ' s ', ' s ', ' s ', ' s ', 'fsg', 'fsg', 'f g'], {
    a: IRON_INK(hex(0x8a8a92)), b: IRON_INK(hex(0x5a5a62)), c: IRON_INK(hex(0x3a3a40)), s: WOOD_INK(hex(0x9a7444)),
    f: WOOD_INK(FEATHER.w), g: WOOD_INK(FEATHER.g),
  }, x, y);
  for (const [px, py] of [[x, y + 7], [x + 2, y + 7]]) t.m(px, py, 0.05, 0, 0.9);
}

const LOOM_WOVE = [hex(0xa8302c), hex(0xe8dcc0), hex(0x3a5a9a), hex(0xe8dcc0)];

const CRAFTS: Record<string, Painter> = {
  lectern_sides: (t) => lecternSide(t, false),
  lectern_front: (t) => lecternSide(t, true),
  lectern_top: (t) => {
    panel(t, 0, 0, 16, 16, PAL.oak, { n: 0.25, bevel: 0.3, salt: 5, mat: [0.25, 0, 0.6] });
    // tampo de leitura forrado de couro e aparador do livro embaixo
    panel(t, 2, 2, 12, 9, pal(0x3a1a12, 0x4a2418, 0x5a2e1e, 0x6a3824), { n: 0.3, bevel: -0.25, salt: 6, hgt: 0.5, mat: [0.3, 0, 0.5] });
    for (let x = 2; x < 14; x++) { t.px(x, 12, pick(PAL.oak, 0.9)); t.px(x, 13, pick(PAL.oak, 0.2)); t.h(x, 12, 0.85); t.h(x, 13, 0.7); }
    for (const [x, y] of [[3, 3], [12, 3], [3, 9], [12, 9]]) { t.px(x, y, PAL.brass[3]); t.m(x, y, 0.7, 1, 0.1); }
  },
  cartography_table_top: (t) => {
    panel(t, 0, 0, 16, 16, DOAK, { n: 0.3, bevel: 0.3, salt: 2, mat: [0.25, 0, 0.6] });
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
      const water = x + y * 0.8 + (t.vnoise(x, y, 4, 3) - 0.5) * 4 > 18.5;
      const shore = !water && x + 1 + y * 0.8 + (t.vnoise(x + 1, y, 4, 3) - 0.5) * 4 > 18.5;
      let c = pick(PARCH, 0.55 + (t.fbm(x, y, 5) - 0.5) * 0.5 - (x === 2 || y === 2 ? 0.2 : 0));
      if (water) c = mix(hex(0x3e76a8), hex(0x5a90c0), t.white(x, y, 2));
      else if (shore) c = hex(0x8ab4d0);
      else if (Math.hypot(x - 5, y - 9.5) < 2.2) c = mix(hex(0x6a8a3a), hex(0x86a24a), t.white(x, y, 3));
      t.px(x, y, c); t.h(x, y, 0.55); t.m(x, y, 0.1, 0, 0.8);
    }
    for (const [x, y] of [[4, 11], [6, 9], [8, 8], [10, 6], [11, 4]]) t.px(x, y, hex(0xa0302a));
    for (const [x, y] of [[9, 3], [10, 4], [11, 3]]) t.px(x, y, hex(0x6a4a2a));
    sprite(t, [' r ', 'kkk', ' k '], { r: hex(0xb02a24), k: hex(0x3a2a1a) }, 3, 3);
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { t.px(x, y, PAL.brass[4]); t.m(x, y, 0.7, 1, 0.1); }
  },
  cartography_table_side1: (t) => {
    furniture(t, DOAK, DOAK, 21);
    panel(t, 3, 4, 10, 5, pal(0x4a2e16, 0x56361c, 0x624022, 0x6e4a28), { n: 0.25, bevel: 0.3, salt: 3, mat: [0.25, 0, 0.6] });
    t.px(7, 6, PAL.brass[4]); t.px(8, 6, PAL.brass[2]); t.m(7, 6, 0.7, 1, 0.1); t.m(8, 6, 0.7, 1, 0.1);
    for (let x = 2; x < 14; x++) { t.px(x, 14, pick(DOAK, 0.9)); t.h(x, 14, 0.7); }
    scroll(t, 3, 11); scroll(t, 7, 11); scroll(t, 10, 10);
  },
  cartography_table_side2: (t) => {
    furniture(t, DOAK, DOAK, 22);
    // mapa pendurado com litoral e um X
    panel(t, 4, 4, 8, 9, PARCH, { n: 0.35, bevel: 0.25, salt: 4, mat: [0.1, 0, 0.8] });
    for (const [x, y] of [[5, 9], [6, 9], [7, 8], [8, 8], [9, 7], [10, 7]]) t.px(x, y, hex(0x4a82b4));
    t.px(6, 6, hex(0xa0302a)); t.px(8, 6, hex(0xa0302a)); t.px(7, 7, hex(0xa0302a)); t.px(6, 8, hex(0xa0302a)); t.px(8, 8, mix(hex(0xa0302a), hex(0x4a82b4), 0.5));
    for (const x of [5, 10]) { t.px(x, 4, PAL.brass[4]); t.m(x, 4, 0.7, 1, 0.1); }
  },
  fletching_table_top: (t) => {
    boards(t, 0, 0, 16, 16, BIRCH, { size: 4, salt: 7 });
    for (let i = 0; i < 16; i++) for (const [x, y] of [[i, 0], [0, i], [i, 15], [15, i]]) t.shadePx(x, y, x === 15 || y === 15 ? 0.62 : 0.84);
    // flecha na diagonal e uma pena solta
    for (let i = 0; i < 8; i++) { t.px(4 + i, 11 - i, hex(0x8a6a3a)); t.px(5 + i, 11 - i, hex(0x5e4424)); t.h(4 + i, 11 - i, 0.75); }
    sprite(t, [' ab', 'abc', 'bc '], { a: IRON_INK(hex(0x9a9aa2)), b: IRON_INK(hex(0x5a5a62)), c: IRON_INK(hex(0x34343a)) }, 11, 2);
    sprite(t, ['w  ', 'ww ', 'rwg', ' gg'], { w: WOOD_INK(FEATHER.w), g: WOOD_INK(FEATHER.g), r: WOOD_INK(FEATHER.r) }, 2, 11);
    sprite(t, ['  ww', ' wwg', 'wgg ', 'g   '], { w: WOOD_INK(FEATHER.w, 0.65), g: WOOD_INK(FEATHER.g, 0.6) }, 9, 10);
  },
  fletching_table_front: (t) => {
    furniture(t, BIRCH_D, BIRCH, 23);
    arrow(t, 3, 4); arrow(t, 7, 4); arrow(t, 11, 4);
  },
  fletching_table_side: (t) => {
    furniture(t, BIRCH_D, BIRCH, 24);
    // maço de penas amarrado com fio vermelho
    sprite(t, ['  r  ', ' wrw ', 'wgwgw', 'wgwgw', 'w w w', 'g g g', 'g   g'], {
      r: WOOD_INK(FEATHER.r), w: WOOD_INK(FEATHER.w), g: WOOD_INK(FEATHER.g),
    }, 5, 4);
    sprite(t, ['sss', 'rrr', 'sss'], { s: WOOD_INK(hex(0x8a6a3a)), r: WOOD_INK(hex(0xd8d0c0)) }, 11, 11);
  },
  smithing_table_top: (t) => {
    metalPanel(t, 0, 0, 16, 16, PAL.darkIron, 0.6, { salt: 2 });
    metalPanel(t, 2, 2, 12, 12, BAND, 0.7, { salt: 3 });
    for (const [x, y] of [[0, 0], [14, 0], [0, 14], [14, 14]]) rivet(t, x, y, BAND[5], PAL.darkIron[0]);
    // martelo de ferreiro na diagonal e um lingote dourado
    sprite(t, ['     HHh', '     Hhh', '    w   ', '   w    ', '  w     ', ' d      '], {
      H: IRON_INK(PAL.iron[5], 0.85), h: IRON_INK(PAL.iron[2], 0.85), w: WOOD_INK(hex(0x9a6e3e), 0.8), d: WOOD_INK(hex(0x6a4624), 0.8),
    }, 3, 3);
    sprite(t, [' aaaa ', 'bbbbbc'], { a: IRON_INK(PAL.gold[5], 0.8), b: IRON_INK(PAL.gold[3], 0.75), c: IRON_INK(PAL.gold[1], 0.7) }, 7, 11);
    for (let i = 0; i < 6; i++) { const x = 3 + t.rng.nextInt(10), y = 3 + t.rng.nextInt(10); if (t.hGet(x, y) < 0.8) t.px(x, y, BAND[4]); }
  },
  smithing_table_front: (t) => {
    furniture(t, BAND, PAL.darkWood, 25);
    matRect(t, 0, 0, 16, 3, 0.6, 1, 0.08);
    panel(t, 3, 5, 10, 5, PAL.darkWood, { n: 0.3, bevel: 0.3, salt: 6, mat: [0.25, 0, 0.6] });
    metalPanel(t, 3, 7, 10, 1, BAND, 0.6, { bevel: 0, salt: 7 });
    sprite(t, [' aa ', 'a  b', ' bb '], { a: IRON_INK(PAL.iron[4]), b: IRON_INK(PAL.iron[1]) }, 6, 8);
  },
  smithing_table_side: (t) => {
    furniture(t, BAND, PAL.darkWood, 26);
    matRect(t, 0, 0, 16, 3, 0.6, 1, 0.08);
    // ferradura pendurada num prego
    sprite(t, ['  n  ', 'aa bb', 'a   b', 'a   b', 'a   b', 'ab bb'], { n: IRON_INK(PAL.iron[3]), a: IRON_INK(PAL.iron[4]), b: IRON_INK(PAL.iron[1]) }, 5, 5);
  },
  smithing_table_bottom: (t) => {
    boards(t, 0, 0, 16, 16, PAL.darkWood, { size: 4, salt: 9 });
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) {
      for (let i = 0; i < 3; i++) for (const [px, py] of [[x + sx * i, y], [x, y + sy * i]]) { t.px(px, py, BAND[3]); t.m(px, py, 0.6, 1, 0.08); }
    }
  },
  loom_top: (t) => {
    t.fill(hex(0x241a12));
    boards(t, 0, 0, 16, 3, PAL.oak, { size: 3, salt: 2 }); boards(t, 0, 13, 16, 3, PAL.oak, { size: 3, salt: 3 });
    panel(t, 0, 3, 2, 10, PAL.oak, { streak: 'v', salt: 4, mat: [0.2, 0, 0.6] }); panel(t, 14, 3, 2, 10, PAL.oak, { streak: 'v', salt: 5, mat: [0.2, 0, 0.6] });
    // rolo de tecido listrado atravessando
    for (let y = 5; y <= 10; y++) for (let x = 2; x < 14; x++) {
      const c = LOOM_WOVE[Math.floor((y - 5) / 1.5) % 4];
      const k = y === 5 ? 1.15 : y === 10 ? 0.7 : (x + y) % 2 ? 0.93 : 1;
      t.px(x, y, scale(c, k)); t.h(x, y, 0.65); t.m(x, y, 0.02, 0, 0.95);
    }
  },
  loom_front: (t) => {
    t.fill(hex(0x241a12));
    boards(t, 0, 0, 16, 3, PAL.oak, { size: 3, salt: 6 }); boards(t, 0, 13, 16, 3, PAL.oak, { size: 3, salt: 7 });
    panel(t, 1, 3, 2, 10, PAL.oak, { streak: 'v', salt: 8, mat: [0.2, 0, 0.6] }); panel(t, 13, 3, 2, 10, PAL.oak, { streak: 'v', salt: 9, mat: [0.2, 0, 0.6] });
    for (let y = 3; y < 9; y++) for (let x = 4; x < 12; x += 2) { t.px(x, y, hex(0xe0d4b8)); t.h(x, y, 0.6); t.m(x, y, 0.02, 0, 0.95); }
    for (let y = 9; y < 13; y++) for (let x = 3; x < 13; x++) {
      const zig = (x + Math.abs(y - 10.5) * 2) % 4 < 2;
      t.px(x, y, scale(zig ? LOOM_WOVE[0] : LOOM_WOVE[y % 2 ? 1 : 2], (x + y) % 2 ? 0.92 : 1)); t.h(x, y, 0.62); t.m(x, y, 0.02, 0, 0.95);
    }
    sprite(t, ['dSSSSSSd'], { d: WOOD_INK(hex(0x5a3e22)), S: WOOD_INK(hex(0xc89a5a)) }, 4, 8);
  },
  loom_side: (t) => {
    boards(t, 0, 0, 16, 16, PAL.oak, { size: 4, salt: 10 });
    for (let i = 0; i < 16; i++) for (const [x, y] of [[i, 0], [0, i], [i, 15], [15, i]]) t.shadePx(x, y, x === 15 || y === 15 ? 0.6 : 0.8);
    // novelo de lã vermelha num pino
    disc(t, 8, 9, 3.4, (x, y, d, dx, dy) => {
      const strand = (x * 2 + y) % 3 === 0;
      t.px(x, y, scale(hex(0xb83a30), 0.75 + (-(dx + dy) / 4) * 0.35 + (strand ? -0.12 : 0.05))); t.h(x, y, 0.8 - d * 0.08); t.m(x, y, 0.02, 0, 0.95);
    });
    t.px(8, 4, hex(0x5a3e22)); t.px(8, 5, hex(0x7a5630));
  },
  loom_bottom: (t) => {
    boards(t, 0, 0, 16, 16, PAL.oak, { size: 4, salt: 12 });
    for (let i = 0; i < 16; i++) for (const [x, y] of [[i, 0], [0, i], [i, 15], [15, i]]) t.shadePx(x, y, 0.7);
  },
};

export const UTILITY_PAINTERS: Record<string, Painter> = {
  ...UTILITY2_PAINTERS,
  ...STATIONS,
  ...STORAGE,
  ...CRAFTS,
};
