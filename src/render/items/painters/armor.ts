/**
 * Sprites de armaduras (16×16): 4 formas (capacete, peitoral, calças, botas) × 6 materiais.
 * Identidade própria: capacete com nasal e protetores de face, peitoral com ombreiras e quilha central,
 * calças com cinto e joelheiras, botas de cano com sola. Malha tem furinhos vazados de verdade; o diamante
 * leva guarnição dourada e o ígneo tem as costuras em brasa (emissivas).
 * Letras: 1..4 tons do material (escuro→claro), B b faixa/guarnição (claro/escuro), x rebite, k fivela.
 */
import type { Painter, Palette } from '../../textures/tex';
import { hex, pal } from '../../textures/tex';
import { type Ink, type Keys, GOLD, BRASS, blank, draw, outline } from './tools';

const SHAPES: Record<string, string[]> = {
  helmet: [
    '................',
    '................',
    '......4433......',
    '....44443332....',
    '...4443333221...',
    '...4433333221...',
    '...BBBbbbbbbb...',
    '...43..32..21...',
    '...43..32..21...',
    '...32..21..21...',
    '...32......11...',
    '....2......1....',
    '................',
    '................',
    '................',
    '................',
  ],
  chestplate: [
    '................',
    '..4443....3321..',
    '.44443....33221.',
    '.4443BbbbbB3221.',
    '.44x14444331x21.',
    '.44314433321221.',
    '.33214333321211.',
    '....34342321....',
    '....x434232x....',
    '....34342321....',
    '....33342221....',
    '....33242211....',
    '....BBBbbbbb....',
    '.....322111.....',
    '................',
    '................',
  ],
  leggings: [
    '................',
    '................',
    '...BBBBkkbbbb...',
    '...4443333221...',
    '...4433333211...',
    '...4432..3221...',
    '...4432..3221...',
    '...4x32..3x21...',
    '...4432..3221...',
    '...4432..3221...',
    '...4332..2221...',
    '...4332..2211...',
    '...3321..2211...',
    '................',
    '................',
    '................',
  ],
  boots: [
    '................',
    '................',
    '................',
    '..BBBbb..BBbbb..',
    '..44332..33221..',
    '...432....321...',
    '...432....321...',
    '...432....321...',
    '...x32....x21...',
    '...432....321...',
    '..4432....3221..',
    '.44332....32221.',
    '.SSSSS....SSSSS.',
    '................',
    '................',
    '................',
  ],
};

interface ArmorMat { p: Palette; trim: [Ink, Ink]; stud: Ink; s: number; m: number; mesh?: boolean }
const ink = (c: number, s = 0.3, m = 0, e = 0): Ink => ({ c: hex(c), s, m, e });

const MATS: Record<string, ArmorMat> = {
  leather: { p: pal(0x3e2414, 0x5e3820, 0x7e4e2e, 0x9e683e, 0xbc8552), trim: [ink(0x6a3a1e), ink(0x4a2814)], stud: ink(0xd8b27a, 0.6, 1), s: 0.2, m: 0 },
  chainmail: { p: pal(0x33373e, 0x565c66, 0x7f8792, 0xa9b1bb, 0xd0d7de), trim: [ink(0x7a5638, 0.2), ink(0x57391f, 0.2)], stud: ink(0xe0e6ec, 0.8, 1), s: 0.6, m: 1, mesh: true },
  iron: { p: pal(0x3a4048, 0x68707b, 0x98a1ac, 0xc6ced7, 0xeaf0f5), trim: [ink(0x8f98a3, 0.7, 1), ink(0x5a616b, 0.7, 1)], stud: ink(0xffffff, 0.9, 1), s: 0.72, m: 1 },
  golden: { p: GOLD, trim: [ink(0xc98a18, 0.85, 1), ink(0x94600e, 0.85, 1)], stud: ink(0xfff6cc, 0.9, 1), s: 0.85, m: 1 },
  diamond: { p: pal(0x0e4a52, 0x197b85, 0x31b1b5, 0x6ddfd9, 0xc2faf3), trim: [{ c: GOLD[3], s: 0.85, m: 1 }, { c: GOLD[1], s: 0.85, m: 1 }], stud: { c: BRASS[4], s: 0.9, m: 1 }, s: 0.92, m: 0 },
  igneous: { p: pal(0x160f15, 0x271c24, 0x3b2d35, 0x534249, 0x6d585d), trim: [ink(0xff8a2c, 0.4, 0, 1), ink(0xc8461a, 0.4, 0, 0.8)], stud: ink(0xffc060, 0.4, 0, 1), s: 0.6, m: 0.8 },
};

function armorKeys(M: ArmorMat): Keys {
  const k: Keys = { B: M.trim[0], b: M.trim[1], x: M.stud, k: { c: BRASS[3], s: 0.8, m: 1 }, S: { c: M.p[1], s: 0.3 } };
  for (let i = 1; i <= 4; i++) k[i] = { c: M.p[i], s: M.s, m: M.m };
  return k;
}

/** Furinhos da malha: grade alternada, só no miolo (a silhueta continua inteira). */
function meshHoles(rows: string[]): Set<number> {
  const holes = new Set<number>();
  const fill = (x: number, y: number) => y >= 0 && y < 16 && x >= 0 && x < 16 && /[1-4]/.test(rows[y][x] ?? '.');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!fill(x, y) || y % 2 || (x + y / 2) % 2) continue;
    if (fill(x - 1, y) && fill(x + 1, y) && fill(x, y - 1) && fill(x, y + 1)) holes.add(y * 16 + x);
  }
  return holes;
}

function armorSprite(shape: string, mat: string): Painter {
  const M = MATS[mat], rows = SHAPES[shape];
  const holes = M.mesh ? meshHoles(rows) : new Set<number>();
  return (t) => {
    blank(t, M.s, M.m);
    draw(t, rows, armorKeys(M));
    for (const i of holes) t.px(i & 15, i >> 4, [0, 0, 0], 0);
    outline(t, 0.45, (x, y) => holes.has(y * 16 + x));
    // brilho no canto iluminado das peças de metal polido
    const fill = (x: number, y: number) => y >= 0 && x >= 0 && /[1-4BbxkS]/.test(rows[y]?.[x] ?? '.');
    if (M.m > 0 && !M.mesh) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (rows[y][x] === '4' && !fill(x, y - 1) && !fill(x - 1, y)) t.px(x, y, mat === 'igneous' ? M.p[4] : [255, 252, 238]);
    }
  };
}

export const ARMOR_SPRITES: Record<string, Painter> = {};
for (const mat of Object.keys(MATS)) for (const shape of Object.keys(SHAPES)) ARMOR_SPRITES[`${mat}_${shape}`] = armorSprite(shape, mat);
