/**
 * Sprites de itens diversos (16×16): camas (16 cores), portas em arco e placas (8 madeiras), canoas,
 * carrinhos, baldes, mapas, sela com manta listrada, laço, etiqueta, poções, livros, ovos de criação
 * (gerados de 2 cores por criatura) e ícones dos blocos especiais (suporte de poções, caldeirão, vaso,
 * fogueira, lanternas, corrente, sino, repetidor, comparador, cana, alga e tocha de fulgor).
 */
import { Tex, type Painter, type Palette, type RGB, hex, mix, pal } from '../../textures/tex';
import { WOOD_PALS } from '../../textures/styles';
import { COLORS } from '../../../world/blocks/defs/building';
import { type Keys, BRASS, GOLD, STEEL, ball, blank, dot, draw, glint, inks, outline, pick, solid } from './tools';
import { bottle } from './food';
import { book } from './materials';

const tones = (c: RGB): Palette => [mix(c, [10, 8, 20], 0.55), mix(c, [10, 8, 20], 0.3), c, mix(c, [255, 250, 235], 0.25), mix(c, [255, 250, 235], 0.5)];

// ------------------------------------------------------------------ camas (de lado: cabeceira, travesseiro, coberta)
const BED = [
  '.hh.............', '.hhPPp..........', '.hhPPpWWWWWWWWf.', '.hhSSSwwwwwwwwf.', '.hhwwwwwwwwwwwf.', '.hhvvvvvvvvvvvf.', '.HHHHHHHHHHHHHH.', '.dd..........dd.',
];
function bed(rgb: number): Painter {
  const W = tones(hex(rgb)), O = WOOD_PALS.oak.plank;
  return (t) => {
    blank(t, 0.05);
    draw(t, BED, { h: O[3], H: O[2], d: O[0], f: O[2], P: hex(0xf4f0e8), p: hex(0xc8c2b8), S: hex(0xe8e4dc), W: W[3], w: W[2], v: W[1] }, 0, 4);
    outline(t);
  };
}

// ------------------------------------------------------------------ portas em arco, placas e canoas (por madeira)
const DOOR = [
  '......FFFf......', '.....F4433f.....', '....F333333f....', '....F4gggg2f....', '....F4gGgg2f....', '....F4gggg2f....', '....F322222f....',
  '....F433132f....', '....F43313kf....', '....F433132f....', '....F433132f....', '....F433132f....', '....F222221f....', '....ffffffff....',
];
const SOLID_DOOR = new Set(['spruce', 'dark_oak', 'ash']);
function door(wood: string): Painter {
  const P = WOOD_PALS[wood].plank, lume = wood === 'lume';
  const glass = lume ? pal(0x3a8aa8, 0x8ae6f6) : pal(0x8ab4c4, 0xdaf0f6);
  return (t) => {
    blank(t, 0.22);
    const rows = SOLID_DOOR.has(wood) ? DOOR.map((r, i) => (i >= 3 && i <= 5 ? '....F433132f....' : r)) : DOOR;
    draw(t, rows, { ...inks(P, '01234'), F: P[3], f: P[0], g: { c: glass[0], s: 0.9, e: lume ? 0.7 : 0 }, G: { c: glass[1], s: 0.95, e: lume ? 1 : 0 }, k: { c: STEEL[3], s: 0.8, m: 1 } }, 0, 1);
    outline(t);
  };
}

const SIGN = [
  '..FFFFFFFFFFFF..', '..F3333333333f..', '..F3tttt3ttt3f..', '..F3333333333f..', '..F3ttttt3tt3f..', '..F3333333333f..', '..ffffffffffff..',
  '.......Pp.......', '.......Pp.......', '.......Pp.......', '.......Pp.......', '......PPpp......',
];
const sign = (wood: string): Painter => (t) => {
  const P = WOOD_PALS[wood].plank;
  blank(t, 0.2);
  draw(t, SIGN, { ...inks(P, '01234'), F: P[4], f: P[1], t: P[0], P: P[3], p: P[1] }, 0, 2);
  outline(t);
};

const BOAT = ['.2............2.', '.34iiibiiiibi43.', '.44444444444444.', '..333333333333..', '...2222222222...', '.....111111.....'];
const boat = (wood: string): Painter => (t) => {
  const P = WOOD_PALS[wood].plank;
  blank(t, 0.22);
  draw(t, BOAT, { ...inks(P, '01234'), i: P[0], b: P[3] }, 0, 5);
  draw(t, ['.r', 'rR', 'R.'], { r: hex(0x8a6a3a), R: hex(0xb8965a) }, 12, 3);
  outline(t);
};

// ------------------------------------------------------------------ carrinhos (a carga aparece por cima da borda)
const CART = [
  '.44444444444443.', '.32222222222221.', '.32r22222222r21.', '.32222222222221.', '.21111111111110.', '..WWW......WWW..', '..WaW......WaW..', '..WWW......WWW..',
];
const CARGO: Record<string, [string[], Keys, number]> = {
  chest: [['.oooooooo.', '.oOOOOOOo.', '.ooookooo.', '.oOOOOOOo.'], { o: hex(0x6a4424), O: hex(0x9a6a38), k: GOLD[3] }, 2],
  tnt: [['.....f....', '....fF....', '.RRRRRRRR.', '.RwwwwwwR.', '.RRRRRRRR.'], { R: hex(0xc0281e), w: hex(0xf0e8dc), f: hex(0x4a3a2a), F: hex(0xffb040) }, 1],
  furnace: [['.ssssssss.', '.sSSSSSSs.', '.sSffffSs.', '.sSfFFfSs.'], { s: hex(0x5a5a60), S: hex(0x7c7c84), f: hex(0x2a2226), F: hex(0xff9a2a) }, 2],
};
function minecart(cargo?: string): Painter {
  return (t) => {
    blank(t, 0.6, 1);
    if (cargo) { const [rows, keys, y] = CARGO[cargo]; draw(t, rows, keys, 3, y); }
    draw(t, CART, { ...inks(STEEL, '01234', 0.6, 1), r: STEEL[4], W: hex(0x2c2e34), a: STEEL[3] }, 0, 6);
    outline(t);
    if (cargo === 'furnace') { t.emit(7, 5, 1); t.emit(8, 5, 1); }
    if (cargo === 'tnt') t.emit(5, 2, 1);
  };
}

// ------------------------------------------------------------------ baldes
const BUCKET = [
  '....44444444....', '...4iiiiiiii3...', '....33333333....', '....43333332....', '....21111111....', '....43333332....', '.....433332.....', '.....433332.....',
  '.....211111.....', '......4332......',
];
function bucket(inside: Palette, e = 0): Painter {
  return (t) => {
    blank(t, 0.65, 1);
    for (const [x, y] of [[3, 4], [3, 3], [4, 2], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 2], [12, 3], [12, 4]]) dot(t, x, y, STEEL[2]);
    draw(t, BUCKET, { ...inks(STEEL, '01234', 0.65, 1), i: inside[2] }, 0, 4);
    for (let x = 4; x <= 11; x++) dot(t, x, 5, { c: pick(inside, 0.75 - (x - 4) * 0.08), s: 0.9, e });
    outline(t);
  };
}

// ------------------------------------------------------------------ mapas, sela, laço e etiqueta
const PARCH = pal(0x9a8058, 0xbfa478, 0xd8c496, 0xeadcb4, 0xf6ecd0);
function parchment(t: Tex): void {
  blank(t, 0.1);
  for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) {
    if ((x === 2 || x === 13) && (y === 2 || y === 13)) continue;
    dot(t, x, y, pick(PARCH, 0.7 - (x + y - 15) * 0.03 + (t.white(x, y, 1) - 0.5) * 0.25 - (x === 13 || y === 13 ? 0.3 : 0)));
  }
}
const MAP_ART = [
  '..........', '.ggg...bb.', '.gGgg.bbb.', '..ggb.bbg.', '.b.bbbbgg.', '.bbbbmmgg.', 'bbbgmMmg..', 'bbggmmgX..', '.bggggg...', '..........',
];

const SADDLE = [
  '..44.........4..', '..443.......43..', '..443333333334..', '..333222222221..', '...2x22x22x221..', '.RRBBRRBBRRBBRR.',
  '.rrrrrrrrrrrrrr.', '......s.........', '.....sSs........', '.....S.S........', '.....SSS........',
];
const TAG = ['......44444444..', '.....4333333332.', '....43o33333332.', '...43333xxxx332.', '....43333333332.', '.....3222222221.', '......22222222..'];

// ------------------------------------------------------------------ ovos de criação: 2 cores por criatura
const EGG_COLORS: Record<string, [number, number]> = {
  cow: [0xe2ded6, 0x6a625a], pig: [0xeaa2a4, 0xb46a76], sheep: [0xf0ece4, 0xd4b49c], chicken: [0xf4f2ec, 0xd8322a],
  horse: [0x8e5c34, 0x2e1c10], wolf: [0xbab6ae, 0x54504c], cat: [0xe2a452, 0x8a4c16], rabbit: [0xcaa67c, 0xf6f0e6],
  lambari: [0xc2ced4, 0xf2c230], tambaqui: [0x3a4244, 0xc8b060], baiacu: [0xd6be58, 0x5a4418], musgarto: [0x5a8a32, 0x6e4a22],
  villager: [0x7e5438, 0xdca87c], sentinela: [0xc4c8cc, 0x4a8a2a], carnical: [0x6c8c5a, 0x264a5c], ossudo: [0xd2cec6, 0x4a4846],
  tecela: [0x2e2420, 0xc01e1e], pavio: [0x3c3c36, 0xf08a24], feiticeira: [0x4a2a5c, 0x62a83c], gosma: [0x6ac43a, 0x2e6a1c],
  assombro: [0x3a4a6c, 0xa8e2ea], naufrago: [0x3a8c8a, 0x1a3450], vulto: [0x1e1428, 0x9a52dc], espreitador: [0x7a7a7e, 0xe8c040],
  fagulha: [0xf2a420, 0x7a2a0a], brasal: [0xf2e8de, 0xe0561a],
};
function spawnEgg(base: number, spot: number): Painter {
  return (t) => {
    blank(t, 0.45);
    ball(t, 8, 8.8, 4.8, 5.8, tones(hex(base)), 0.28);
    // pintas redondas espalhadas numa grade com sorteio (determinístico pelo id)
    const S = tones(hex(spot));
    for (const [px, py] of [[5.6, 6.4], [9.6, 4.8], [8, 9.4], [11.2, 9.6], [5.4, 11.4], [9.4, 13], [11.6, 6.4]]) {
      const cx = px + (t.rng.next() - 0.5) * 1.6, cy = py + (t.rng.next() - 0.5) * 1.6, r = 0.8 + t.rng.next() * 0.9;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (solid(t, x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r) t.px(x, y, pick(S, 0.62 - (x + y - 16) * 0.035));
      }
    }
    outline(t);
    glint(t, 6, 5, mix(hex(base), [255, 255, 255], 0.7));
  };
}

// ------------------------------------------------------------------ blocos especiais (ícones)
const DARK_IRON = pal(0x1c1e24, 0x2a2d34, 0x3a3e46, 0x4e535c, 0x676d78);
const TERRA = pal(0x5a2a18, 0x7e3c22, 0xa4542e, 0xc06a3c, 0xd8885a);
const FLAME = pal(0xa02a08, 0xe0561a, 0xffa030, 0xffe070, 0xfffbe0);
const SOUL = pal(0x0a4a64, 0x1a8aae, 0x46d2ea, 0x9af2fc, 0xeaffff);
const FULGOR = pal(0x0c4d5c, 0x137a8f, 0x1fb2c9, 0x5de4f0, 0xc8fbff);
const LANTERN = ['.......rr.......', '......r..r......', '.....mmmmmm.....', '....mMMMMMMm....', '....bggggggb....', '....bgg12ggb....', '....bg1232gb....',
  '....bg1332gb....', '....bgg11ggb....', '....bggggggb....', '....mmmmmmmm....', '.....mmmmmm.....'];
function lantern(F: Palette, glass: RGB): Painter {
  return (t) => {
    blank(t, 0.6, 1);
    draw(t, LANTERN, { r: STEEL[2], m: DARK_IRON[3], M: DARK_IRON[4], b: DARK_IRON[2], g: { c: glass, s: 0.9, e: 0.35 }, 1: { c: F[2], e: 1 }, 2: { c: F[3], e: 1 }, 3: { c: F[4], e: 1 } }, 0, 1);
    outline(t);
  };
}
const BREWING = ['.......kk.......', '.......rR.......', '...aaaarRaaaa...', '...n...rR...n...', '..LLL..rR..BBB..', '..LlL..rR..BbB..', '..LLL..rR..BBB..',
  '.......rR.......', '.......rR.......', '....ssssssss....', '...SSSSSSSSSS...'];
const CAULDRON = ['..444444444444..', '.4iiiiiiiiiiii3.', '..333333333333..', '.43333333333332.', '.43333333333332.', '.43222222222221.', '.32222222222221.',
  '..222222222211..', '...1111111111...', '..11........11..'];
const POT = ['....44444444....', '...4dddddddd3...', '....33333333....', '....43333332....', '.....433332.....', '.....433332.....', '.....433332.....', '......2211......'];
const FIRE = ['.......o........', '......oo..o.....', '......oyo.oo....', '.....oyyooyo....', '....oyyYyyyo....', '....oyYWYyyo....', '...ooyYWWYyoo...', '...oyyYYYYyyo...'];
const CHAIN = ['.......ll.......', '......l..l......', '......l..l......', '.......LL.......', '.......LL.......', '.......ll.......', '......l..l......',
  '......l..l......', '.......LL.......', '.......LL.......', '.......ll.......', '......l..l......', '......l..l......', '.......ll.......'];
/** Laje de fulgor (repetidor/comparador) com tochinhas de cristal: [x, topo]. */
function diode(torches: [number, number][]): Painter {
  return (t) => {
    blank(t, 0.4);
    for (let y = 7; y <= 12; y++) for (let x = 2; x <= 13; x++) dot(t, x, y, pick(pal(0x6a6a72, 0x80808a, 0x9a9aa2, 0xb2b2ba, 0xc6c6ce), y >= 11 ? 0.3 - (y - 11) * 0.2 : 0.75 - (x - 2) * 0.02 - (y - 7) * 0.05));
    for (let x = 3; x <= 12; x++) { dot(t, x, 9, { c: FULGOR[1], e: 0.5 }); }
    for (const [x, y] of torches) { for (let i = 1; i <= 3; i++) dot(t, x, y + i, DARK_IRON[3]); dot(t, x, y, { c: FULGOR[4], e: 1 }); }
    outline(t);
  };
}

const POTION = pal(0x6a1030, 0xa01e44, 0xd83a5e, 0xf07088, 0xffb0c0);
const XP = pal(0x3a6a0a, 0x6aa014, 0xa4d42a, 0xd8f45a, 0xf8ffb0);
const LEATHER = pal(0x3e2210, 0x5e361a, 0x7e4c26, 0x9e6636, 0xbc824a);
const ROPE = pal(0x6a5230, 0x9a7c4a, 0xc4a46c, 0xe0c48c);

export const MISC_SPRITES: Record<string, Painter> = {
  minecart: minecart(),
  chest_minecart: minecart('chest'),
  tnt_minecart: minecart('tnt'),
  furnace_minecart: minecart('furnace'),
  bucket: bucket(DARK_IRON),
  water_bucket: bucket(pal(0x143c8a, 0x1f5ab8, 0x3a7ee0, 0x6aa8f4, 0xb0d8ff)),
  lava_bucket: bucket(FLAME, 1),
  milk_bucket: bucket(pal(0xc8c4bc, 0xe2ded6, 0xf4f2ec, 0xfefcf8, 0xffffff)),
  map: (t) => {
    parchment(t);
    for (let i = 3; i <= 12; i++) for (const k of [5, 9]) { if (solid(t, i, k)) t.px(i, k, PARCH[2]); if (solid(t, k, i)) t.px(k, i, PARCH[2]); }
    draw(t, ['..R..', '..r..', 'rrOrr', '..r..', '..r..'], { r: hex(0x7a5030), R: hex(0xc8321e), O: hex(0xf4e2b0) }, 8, 8);
    outline(t);
  },
  filled_map: (t) => {
    parchment(t);
    draw(t, MAP_ART, { g: hex(0x6a9a3a), G: hex(0x4a7a2a), b: hex(0x4a86c8), m: hex(0x8a6a4a), M: hex(0xf2eee6), X: hex(0xc8201a) }, 3, 3);
    outline(t);
  },
  saddle: (t) => {
    blank(t, 0.25);
    draw(t, SADDLE, { ...inks(LEATHER, '01234'), x: LEATHER[4], R: hex(0xb42a26), r: hex(0x7e1a18), B: hex(0xf0c040), s: LEATHER[1], S: STEEL[3] }, 0, 3);
    outline(t);
    glint(t, 3, 5, LEATHER[4]);
  },
  lead: (t) => {
    blank(t, 0.1);
    for (const [cx, cy, rx, ry] of [[7, 6.6, 4.6, 3.4], [7.4, 7.4, 4.8, 3.6], [11, 11.4, 2.4, 2.4]]) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (Math.abs(Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) - 1) < 0.19) dot(t, x, y, ROPE[(x + y) % 2 ? 3 : 1 + (x > cx ? 0 : 1)]);
    }
    draw(t, ['kK', 'Kk'], { k: ROPE[0], K: ROPE[2] }, 9, 9);
    outline(t);
  },
  name_tag: (t) => {
    blank(t, 0.2);
    draw(t, TAG, { ...inks(PARCH, '01234'), o: hex(0x4a3a2a), x: hex(0x5a4a3a) }, 0, 4);
    outline(t);
    for (const [x, y] of [[5, 5], [4, 4], [3, 3], [2, 3], [1, 4], [1, 5], [2, 6]]) dot(t, x, y, hex(0xc8322a));
  },
  potion: (t) => { bottle(t, POTION, 6, 0.15); dot(t, 9, 11, POTION[4]); },
  splash_potion: (t) => {
    blank(t, 0.9);
    ball(t, 8, 9.6, 4.8, 4.6, pal(0x6f8a9a, 0x9fb8c6, 0xc8dde6, 0xeef8fc));
    for (let y = 9; y < 15; y++) for (let x = 3; x < 13; x++) if (solid(t, x, y)) dot(t, x, y, { c: pick(POTION, 0.7 - (x - 8) * 0.07 - (y - 10) * 0.05 + (y === 9 ? 0.3 : 0)), s: 0.8, e: 0.15 });
    draw(t, ['.gg.', 'wccw', '.cc.'], { g: hex(0xc8dde6), w: STEEL[3], c: hex(0x8a5a32) }, 6, 2);
    dot(t, 7, 4, hex(0xc8dde6)); dot(t, 8, 4, hex(0x9fb8c6));
    outline(t);
    for (const [x, y] of [[2, 3], [13, 4], [14, 7], [1, 7]]) dot(t, x, y, POTION[3]);
    glint(t, 5, 7);
  },
  experience_bottle: (t) => {
    bottle(t, XP, 7, 0.8);
    for (const [x, y] of [[6, 10], [9, 12], [10, 9]]) { t.px(x, y, XP[4]); t.emit(x, y, 1); }
  },
  enchanted_book: (t) => {
    book(t, pal(0x3e1c10, 0x5e2c18, 0x7e3e22, 0x9a5230, 0xb46a3e), hex(0x6a2418));
    for (let i = 0; i < 256; i++) {
      const x = i & 15, y = i >> 4;
      if (!t.rgba[i * 4 + 3]) continue;
      const band = (x + y) % 6 < 2;
      t.px(x, y, mix(t.get(x, y), [176, 96, 255], band ? 0.5 : 0.18));
      t.emit(x, y, band ? 0.45 : 0.15);
    }
    for (const [x, y] of [[4, 4], [10, 6], [6, 10]]) { t.px(x, y, [236, 210, 255]); t.emit(x, y, 1); }
  },
  writable_book: (t) => {
    book(t, pal(0x3e1c10, 0x5e2c18, 0x7e3e22, 0x9a5230, 0xb46a3e), hex(0x6a2418));
    for (let i = 0; i < 9; i++) { dot(t, 5 + i, 12 - i, hex(0xf6f4ee)); if (i > 2) dot(t, 6 + i, 12 - i, hex(0xd4d0c8)); }
    dot(t, 4, 13, hex(0x1a1a24)); dot(t, 5, 13, hex(0x3a3a4a));
  },
  brewing_stand: (t) => {
    blank(t, 0.5);
    draw(t, BREWING, { k: BRASS[3], r: DARK_IRON[3], R: DARK_IRON[1], a: DARK_IRON[3], n: hex(0xc8dde6), L: hex(0xd83a5e), l: hex(0xff9ab0), B: hex(0x3a7ee0), b: hex(0x9ad0ff), s: hex(0x9a9aa2), S: hex(0x6e6e76) }, 0, 2);
    outline(t);
  },
  cauldron: (t) => { blank(t, 0.4, 0.8); draw(t, CAULDRON, { ...inks(DARK_IRON, '01234', 0.4, 0.8), i: hex(0x121318) }, 0, 3); outline(t); glint(t, 3, 6, DARK_IRON[4]); },
  flower_pot: (t) => { blank(t, 0.2); draw(t, POT, { ...inks(TERRA, '01234'), d: hex(0x3e2a1a) }, 0, 5); outline(t); },
  campfire: (t) => {
    blank(t, 0.3);
    draw(t, FIRE, { o: { c: FLAME[1], e: 0.8 }, y: { c: FLAME[2], e: 1 }, Y: { c: FLAME[3], e: 1 }, W: { c: FLAME[4], e: 1 } }, 0, 2);
    const L = WOOD_PALS.oak.bark;
    for (let i = 0; i < 11; i++) { dot(t, 2 + i, 13 - Math.floor(i * 0.4), L[i % 3 === 0 ? 1 : 2]); dot(t, 2 + i, 12 - Math.floor(i * 0.4), L[3]); }
    for (let i = 0; i < 11; i++) { dot(t, 13 - i, 13 - Math.floor(i * 0.4), L[i % 3 === 0 ? 0 : 1]); dot(t, 13 - i, 12 - Math.floor(i * 0.4), L[2]); }
    for (const [x, y] of [[2, 12], [13, 12]]) dot(t, x, y, hex(0xc8a060));
    outline(t);
  },
  lantern: lantern(FLAME, hex(0xf4d690)),
  soul_lantern: lantern(SOUL, hex(0x8ae4ee)),
  chain: (t) => { blank(t, 0.6, 1); draw(t, CHAIN, { l: STEEL[3], L: STEEL[2] }, 0, 1); outline(t); },
  bell: (t) => {
    blank(t, 0.85, 1);
    const W = [2, 2.8, 3.1, 3.3, 3.5, 3.9, 4.5, 5.3, 5.9];
    W.forEach((w, i) => { for (let x = 1; x < 15; x++) { const dx = x + 0.5 - 8; if (Math.abs(dx) <= w) dot(t, x, 3 + i, { c: pick(GOLD, 0.62 - dx / w * 0.4 + (i === 7 ? 0.25 : 0)), s: 0.85, m: 1 }); } });
    draw(t, ['.hh.', 'h..h'], { h: DARK_IRON[3] }, 6, 1);
    dot(t, 7, 12, DARK_IRON[3]); dot(t, 8, 12, DARK_IRON[2]);
    outline(t);
    glint(t, 6, 5);
  },
  repeater: diode([[5, 4], [10, 5]]),
  comparator: diode([[4, 3], [11, 3], [7, 6]]),
  sugar_cane: (t) => {
    blank(t, 0.3);
    const C = pal(0x3a661c, 0x56882a, 0x76aa3a, 0x9ccc58, 0xc8e888);
    for (const [x, top] of [[4, 3], [8, 1], [12, 4]]) for (let y = top; y <= 14; y++) { dot(t, x, y, C[(y - top) % 4 === 0 ? 4 : 2]); dot(t, x + 1, y, C[(y - top) % 4 === 0 ? 2 : 1]); }
    for (const [x, y, d] of [[3, 6, -1], [10, 4, 1], [7, 9, -1], [14, 8, 1]]) { dot(t, x, y, C[3]); dot(t, x + d, y - 1, C[3]); }
    outline(t);
  },
  kelp: (t) => {
    blank(t, 0.4);
    const K = pal(0x1a3a14, 0x2a5a1c, 0x3e7a26, 0x5a9a34, 0x86be4a);
    for (let y = 1; y <= 14; y++) {
      const x = Math.round(7.5 + Math.sin(y * 0.7) * 1.2);
      dot(t, x, y, K[3]); dot(t, x + 1, y, K[2]);
      if (y % 3 === 0) { const d = y % 6 ? 1 : -1; dot(t, x + (d > 0 ? 2 : -1), y, K[3]); dot(t, x + (d > 0 ? 3 : -2), y - 1, K[2]); }
      if (y % 5 === 2) dot(t, x + (y % 2 ? -1 : 2), y + 1, hex(0xc8d86a));
    }
    outline(t);
  },
  fulgor_torch: (t) => {
    blank(t, 0.5);
    for (let y = 7; y <= 14; y++) { dot(t, 7, y, pal(0x363944, 0x505564)[1]); dot(t, 8, y, hex(0x363944)); }
    dot(t, 7, 6, BRASS[3]); dot(t, 8, 6, BRASS[1]);
    draw(t, ['.ab.', 'abbc', 'bbcc', '.cc.'], { a: { c: FULGOR[4], e: 1 }, b: { c: FULGOR[3], e: 1 }, c: { c: FULGOR[2], e: 0.9 } }, 6, 2);
    outline(t);
  },
};
for (const c of COLORS) MISC_SPRITES[`${c.id}_bed`] = bed(c.rgb);
for (const w of Object.keys(WOOD_PALS)) {
  MISC_SPRITES[`${w}_door`] = door(w);
  MISC_SPRITES[`${w}_sign`] = sign(w);
  if (w !== 'ash') MISC_SPRITES[`${w}_boat`] = boat(w);
}
for (const [id, [a, b]] of Object.entries(EGG_COLORS)) MISC_SPRITES[`${id}_spawn_egg`] = spawnEgg(a, b);
