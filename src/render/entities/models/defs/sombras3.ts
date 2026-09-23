/**
 * Aldeia:
 *  - aldeão: rosto redondo e simpático (sem narigão), camisa e calça simples. A roupa-base muda com a região
 *    (planície, deserto, savana, taiga, neve, selva, pântano) e cada profissão ganha acessórios próprios
 *    (chapéus, aljava, óculos, avental, colete, poncho, túnica...). Pele = `${estilo}|${profissão}`; o tom de
 *    pele e o cabelo variam de forma determinística com a variante. Acessórios volumosos são partes que a
 *    `pose` mostra ou esconde;
 *  - sentinela: golem protetor de tijolos de barro cozido e pedras de rio, com musgo e flores nos ombros,
 *    olhos âmbar, fitinhas coloridas no pulso e braços compridos que quase tocam o chão.
 */
import type { ModelDef, PartDef, V3 } from '../boxmodel';
import { head, biped } from '../anim';
import type { Face, FaceName, SkinPainter, Col } from '../skin';
import { rgb } from '../skin';
import type { MobModelSpec } from '../../mobvisual';
import type { Villager, Sentinela } from '../../../../game/entity/species/village';

// ================================================================== ALDEÃO
interface Style { shirt: number; shirtD: number; pants: number; pantsD: number; shoes: number; accent: number; sleeve: number; pattern: 'plain' | 'band' | 'stripe' | 'plaid' | 'knit' | 'leaf' | 'patch' }
const STYLES: Record<string, Style> = {
  planicie: { shirt: 0x9db3c7, shirtD: 0x7a90a5, pants: 0x6e5236, pantsD: 0x523c27, shoes: 0x3e2c1e, accent: 0xe8e0cc, sleeve: 8, pattern: 'plain' },
  deserto: { shirt: 0xe2d2a8, shirtD: 0xc4b288, pants: 0xc49f68, pantsD: 0xa2804c, shoes: 0x8a5a32, accent: 0xc2502c, sleeve: 5, pattern: 'band' },
  savana: { shirt: 0xc4733a, shirtD: 0xa05a2a, pants: 0x8c7a52, pantsD: 0x6e5f3e, shoes: 0x5a3e24, accent: 0xf0d27a, sleeve: 4, pattern: 'stripe' },
  taiga: { shirt: 0x9a3a2f, shirtD: 0x6c2822, pants: 0x3e4a3a, pantsD: 0x2c362a, shoes: 0x3a2a1e, accent: 0x2a2220, sleeve: 10, pattern: 'plaid' },
  neve: { shirt: 0x3e5f8e, shirtD: 0x2c476c, pants: 0x4a4a52, pantsD: 0x36363c, shoes: 0x4a3426, accent: 0xeae6de, sleeve: 11, pattern: 'knit' },
  selva: { shirt: 0x5a8e3c, shirtD: 0x44702c, pants: 0xae9866, pantsD: 0x8c784a, shoes: -1, accent: 0xe8d25a, sleeve: 4, pattern: 'leaf' },
  pantano: { shirt: 0x6c6e46, shirtD: 0x535538, pants: 0x5c4a36, pantsD: 0x44372a, shoes: 0x3c4c2c, accent: 0x8a6a3a, sleeve: 9, pattern: 'patch' },
};
const TONES = [0xe3b48e, 0xd09a70, 0xb2744a, 0x8a5634, 0x683e26];
const HAIRS = [0x3a281c, 0x4e321e, 0x2e2420, 0x6e4424, 0x8a8278];

/** Acessórios (partes) de cada profissão; o resto fica escondido. */
const ACC: Record<string, string[]> = {
  fazendeiro: ['hatStraw'], pescador: ['hatFloppy', 'vest'], pastor: ['poncho'], flecheiro: ['hatFeather', 'quiver'],
  cartografo: ['glasses', 'mapRoll'], clerigo: ['robe', 'pendant'], armeiro: ['apron'], ferramenteiro: ['apron'],
  espadeiro: ['apron'], acougueiro: ['apron'], curtidor: ['vest'], bibliotecario: ['glasses', 'book'], pedreiro: ['helmet'],
};
const ALL_ACC = ['hatStraw', 'hatFloppy', 'hatFeather', 'helmet', 'glasses', 'quiver', 'mapRoll', 'book', 'apron', 'vest', 'poncho', 'robe', 'pendant'];

const brim = (name: string, pivot: V3, o: V3, s: V3, rot: V3, skinOf?: string): PartDef => ({ name, pivot, rot, cubes: [{ id: name, o, s, ...(skinOf ? { skinOf } : {}) }] });

const VILLAGER_PARTS: PartDef[] = [
  { name: 'legR', pivot: [-2, 11, 0], cubes: [{ o: [-4, 0, -2], s: [4, 11, 4] }] },
  { name: 'legL', pivot: [2, 11, 0], cubes: [{ o: [0, 0, -2], s: [4, 11, 4], mirror: true, skinOf: 'legR' }] },
  {
    name: 'body', pivot: [0, 23, 0], cubes: [{ o: [-4, 11, -2], s: [8, 12, 4] }],
    children: [
      { name: 'vest', pivot: [0, 23, 0], cubes: [{ id: 'vest', o: [-4, 13, -2], s: [8, 10, 4], inflate: 0.35 }] },
      { name: 'apron', pivot: [0, 23, 0], cubes: [{ id: 'apron', o: [-3.5, 5, 2.15], s: [7, 14, 0], skip: ['back'] }] },
      { name: 'poncho', pivot: [0, 23, 0], cubes: [{ id: 'poncho', o: [-8.5, 14, -3], s: [17, 9, 6] }] },
      { name: 'robe', pivot: [0, 23, 0], cubes: [{ id: 'robe', o: [-4, 3, -2], s: [8, 9, 4], inflate: 0.45 }] },
      { name: 'pendant', pivot: [0, 23, 0], cubes: [{ id: 'pendant', o: [-1, 16, 2], s: [2, 2, 1] }] },
      { name: 'mapRoll', pivot: [0, 23, 0], cubes: [{ id: 'mapRoll', o: [-5, 19, -4], s: [10, 2, 2] }] },
      {
        name: 'quiver', pivot: [0, 17, -3.5], rot: [0, 0, -25],
        cubes: [{ id: 'quiver', o: [-1.5, 12, -5], s: [3, 9, 2] }, { id: 'fletch', o: [-1, 21, -4.5], s: [2, 3, 1] }],
      },
    ],
  },
  {
    name: 'head', pivot: [0, 23, 0], cubes: [{ o: [-4, 23, -4], s: [8, 8, 8] }],
    children: [
      { name: 'eyelids', pivot: [0, 23, 0], cubes: [{ id: 'eyelids', o: [-2.5, 26, 4.1], s: [5, 1.5, 0], skip: ['back'] }] },
      { name: 'glasses', pivot: [0, 23, 0], cubes: [{ id: 'glasses', o: [-3, 25.5, 4.15], s: [6, 2.5, 0], skip: ['back'] }] },
      {
        name: 'hatStraw', pivot: [0, 29, 0],
        cubes: [{ id: 'strawCrown', o: [-4.5, 29, -4.5], s: [9, 4, 9] }, { id: 'strawBrim', o: [-7.5, 29, -7.5], s: [15, 1, 15] }],
      },
      {
        name: 'hatFloppy', pivot: [0, 29, 0], cubes: [{ id: 'floppyCrown', o: [-4.5, 29, -4.5], s: [9, 3, 9] }],
        children: [
          brim('floppyF', [0, 29.5, 4.5], [-6, 29, 4.5], [12, 1, 2], [22, 0, 0]),
          brim('floppyB', [0, 29.5, -4.5], [-6, 29, -6.5], [12, 1, 2], [-22, 0, 0], 'floppyF'),
          brim('floppyL', [4.5, 29.5, 0], [4.5, 29, -4.5], [2, 1, 9], [0, 0, -22]),
          brim('floppyR', [-4.5, 29.5, 0], [-6.5, 29, -4.5], [2, 1, 9], [0, 0, 22], 'floppyL'),
        ],
      },
      {
        name: 'hatFeather', pivot: [0, 29, 0],
        cubes: [
          { id: 'capBody', o: [-4.5, 29, -4.5], s: [9, 3, 9] },
          { id: 'capTop', o: [-3, 32, -4], s: [6, 1, 6] },
          { id: 'capVisor', o: [-4, 29, 4.5], s: [8, 1, 2] },
        ],
        children: [{ name: 'feather', pivot: [4.5, 31, -2], rot: [-35, 0, -12], cubes: [{ id: 'feather', o: [4.5, 30, -3], s: [0, 7, 2] }] }],
      },
      {
        name: 'helmet', pivot: [0, 29, 0],
        cubes: [
          { id: 'helmDome', o: [-4.5, 29, -4.5], s: [9, 3, 9] },
          { id: 'helmRidge', o: [-0.5, 32, -4], s: [1, 1, 8] },
          { id: 'helmBrim', o: [-5, 29, -5], s: [10, 1, 11] },
        ],
      },
    ],
  },
  { name: 'armR', pivot: [-5, 21, 0], cubes: [{ o: [-8, 11, -2], s: [4, 12, 4] }] },
  {
    name: 'armL', pivot: [5, 21, 0], cubes: [{ o: [4, 11, -2], s: [4, 12, 4], mirror: true, skinOf: 'armR' }],
    children: [{ name: 'book', pivot: [6, 12, 2], cubes: [{ id: 'book', o: [4.5, 9.5, 1.5], s: [3, 4, 2] }] }],
  },
];

const hashStr = (s: string): number => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const sh = (c: number, k: number): [number, number, number] => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return [Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k)]; };

interface VColors extends Style { skin: number; hair: number; iris: number; hairLen: number; prof: string }

function villagerColors(variant: string): VColors {
  const [style, prof = 'nenhuma'] = variant.split('|');
  const base = { ...(STYLES[style] ?? STYLES.planicie) };
  const h = hashStr(variant);
  const c: VColors = { ...base, skin: TONES[h % TONES.length], hair: HAIRS[(h >>> 4) % HAIRS.length], iris: [0x3a2418, 0x2e3a22, 0x4a2a14][(h >>> 8) % 3], hairLen: (h >>> 11) % 3, prof };
  if (prof === 'clerigo') Object.assign(c, { shirt: 0x5c3a7c, shirtD: 0x44285e, pants: 0x3a2a4a, pantsD: 0x2a1e36, accent: 0xd8b048, sleeve: 11, pattern: 'plain' });
  if (prof === 'tolo') Object.assign(c, { shirt: 0x4f8a3a, shirtD: 0x3a6c2a, pants: 0x356628, pantsD: 0x284e1e, pattern: 'patch' });
  if (prof === 'armeiro' || prof === 'acougueiro') c.sleeve = Math.min(c.sleeve, 5);
  return c;
}

/** Olho simpático 2×3: cílio em cima, íris escura com brilho. */
function vEye(g: Face, x: number, y: number, iris: number): void {
  g.px(x, y, 0x2a1c16); g.px(x + 1, y, 0x2a1c16);
  g.px(x, y + 1, iris); g.px(x + 1, y + 1, 0xfff8ec);
  g.px(x, y + 2, iris); g.px(x + 1, y + 2, sh(iris, 1.35));
}

function vHead(g: Face, f: FaceName, c: VColors): void {
  g.noise(c.skin, 0.035);
  const H = c.hair, HD = sh(c.hair, 0.75);
  const back = c.hairLen === 0 ? 9 : c.hairLen === 1 ? 12 : 15;
  const HL = sh(c.hair, 1.3);
  const strands = (x0: number, w: number, h: number) => { for (let i = 0; i < (w * h) / 5; i++) { const x = x0 + g.r() * w, y = g.r() * (h - 2); g.px(x, y, g.r() < 0.5 ? HD : HL); g.px(x, y + 1, g.r() < 0.5 ? HD : H); } };
  if (f === 'top') { g.noise(H, 0.08); strands(0, g.w, g.h); return; }
  if (f === 'bottom') { g.noise(sh(c.skin, 0.9), 0.03); return; }
  if (f === 'back') { cloth(g, 0, 0, g.w, back, H, 0.06); strands(0, g.w, back); for (let x = 0; x < g.w; x++) if ((x * 7) % 3 === 0) g.px(x, back, H); return; }
  if (f === 'left' || f === 'right') {
    // cabelo em cima e atrás, orelha no meio
    g.rect(0, 0, g.w, 3, H);
    const bx = f === 'left' ? g.w - 7 : 0; // lado de trás da face
    g.rect(bx, 0, 7, back, H);
    const fx = f === 'left' ? 0 : g.w - 2; g.rect(fx, 3, 2, 3, H); // costeleta
    const ex = f === 'left' ? 7 : 7; g.rect(ex, 7, 2, 4, sh(c.skin, 0.9)); g.px(ex + (f === 'left' ? 1 : 0), 8, sh(c.skin, 0.8));
    return;
  }
  // frente: rosto redondo — franja curva e cantos arredondados
  g.rect(0, 0, g.w, 3, H);
  g.rect(0, 3, 2, 4, H); g.rect(g.w - 2, 3, 2, 4, H); g.px(2, 3, H); g.px(g.w - 3, 3, H);
  for (const x of [4, 5, 9, 12]) g.px(x, 3, H);
  g.px(0, 7, H); g.px(g.w - 1, 7, H);
  vEye(g, 3, 7, c.iris); vEye(g, 11, 7, c.iris);
  g.rect(2, 5, 3, 1, HD); g.rect(11, 5, 3, 1, HD);
  const blush: [number, number, number, number] = [226, 116, 108, 95];
  g.rect(1, 10, 3, 2, blush); g.rect(12, 10, 3, 2, blush);
  g.px(7, 10, sh(c.skin, 0.86)); g.px(8, 10, sh(c.skin, 0.92));
  const lip = sh(c.skin, 0.62);
  g.px(5, 12, lip); g.px(6, 13, lip); g.px(7, 13, lip); g.px(8, 13, lip); g.px(9, 13, lip); g.px(10, 12, lip);
  for (const [x, y, k] of [[0, 15, 0.8], [15, 15, 0.8], [0, 14, 0.9], [15, 14, 0.9], [1, 15, 0.9], [14, 15, 0.9]] as const) g.px(x, y, sh(c.skin, k));
  if (c.prof === 'espadeiro') {
    // tapa-olho no olho direito e a tira atravessando a testa
    g.rect(2, 6, 5, 5, 0x241c18); g.px(3, 7, 0x3a302a); g.line(6, 6, g.w - 1, 2, 0x241c18);
  }
  if (c.prof === 'acougueiro') g.rect(0, 2, g.w, 2, 0xe6e2da);
  if (c.prof === 'armeiro') { g.px(2, 12, [70, 60, 55, 120]); g.px(13, 11, [70, 60, 55, 120]); }
}

/** Camisa com a estampa da região. */
function vShirt(g: Face, f: FaceName, c: VColors): void {
  g.noise(c.shirt, 0.05);
  if (f === 'top' || f === 'bottom') return;
  const D = c.shirtD, A = c.accent;
  switch (c.pattern) {
    case 'band': g.rect(0, g.h - 7, g.w, 2, A); for (let x = 1; x < g.w; x += 3) g.px(x, g.h - 8, D); break;
    case 'stripe': for (let y = 3; y < g.h - 4; y += 5) g.rect(0, y, g.w, 1, A); break;
    case 'plaid':
      for (let x = 1; x < g.w; x += 4) g.rect(x, 0, 1, g.h, D);
      for (let y = 2; y < g.h; y += 4) g.rect(0, y, g.w, 1, D);
      for (let x = 1; x < g.w; x += 4) for (let y = 2; y < g.h; y += 4) g.px(x, y, A);
      break;
    case 'knit':
      for (let x = 0; x < g.w; x++) { g.px(x, 5 + (x % 4 < 2 ? 0 : 1), A); g.px(x, 8 - (x % 4 < 2 ? 0 : 1), A); }
      for (let x = 0; x < g.w; x += 2) g.rect(x, g.h - 4, 1, 2, D);
      break;
    case 'leaf':
      for (let i = 0; i < g.w * g.h / 28; i++) { const x = g.r() * (g.w - 2), y = g.r() * (g.h - 4); g.px(x, y, 0x8cc05a); g.px(x + 1, y + 1, 0x8cc05a); g.px(x + 1, y, D); }
      break;
    case 'patch':
      for (let i = 0; i < 2; i++) {
        const x = Math.floor(g.r() * (g.w - 5)), y = Math.floor(g.r() * (g.h - 9));
        const col = [0x8a6a3a, 0x6a6e78, 0xb08a4a, 0x9a3a2a][Math.floor(g.r() * 4)];
        g.rect(x, y, 4, 4, col); g.box(x, y, 4, 4, sh(col, 0.7)); g.px(x + 1, y, 0xe0d8c0); g.px(x + 3, y + 2, 0xe0d8c0);
      }
      break;
    default: break;
  }
  if (f === 'front') {
    // gola em V com o pescoço e botões
    g.px(7, 0, c.skin); g.px(8, 0, c.skin); g.px(7, 1, c.skin); g.px(8, 1, c.skin); g.px(7, 2, sh(c.shirt, 0.8));
    g.line(7.5, 3, 7.5, g.h - 4, D);
    for (let y = 5; y < g.h - 4; y += 5) g.px(8, y, 0xe8e2d0);
  }
  // cinto
  g.rect(0, g.h - 3, g.w, 2, 0x3a2a1c);
  if (f === 'front') { g.rect(6, g.h - 3, 3, 2, 0xc8a850); g.px(7, g.h - 3, 0x3a2a1c); }
  g.rect(0, g.h - 1, g.w, 1, c.pants);
}

/** Retângulo com leve ruído de tecido. */
function cloth(g: Face, x: number, y: number, w: number, h: number, c: Col, amt = 0.05): void {
  const [r, gg, b] = rgb(c);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = 1 + (g.r() * 2 - 1) * amt; g.px(x + i, y + j, [Math.min(255, r * k), Math.min(255, gg * k), Math.min(255, b * k)]); }
}

function vArm(g: Face, f: FaceName, c: VColors): void {
  if (f === 'top') { g.noise(c.shirt, 0.05); return; }
  g.noise(c.skin, 0.035);
  if (f === 'bottom') return;
  const sl = c.sleeve * 2;
  cloth(g, 0, 0, g.w, sl, c.shirt);
  if (c.pattern === 'plaid') { g.rect(1, 0, 1, sl, c.shirtD); g.rect(0, 3, g.w, 1, c.shirtD); }
  if (c.pattern === 'stripe') for (let y = 3; y < sl - 1; y += 5) g.rect(0, y, g.w, 1, c.accent);
  g.rect(0, sl - 1, g.w, 1, c.prof === 'clerigo' ? c.accent : c.shirtD);
  if (c.prof === 'flecheiro') { cloth(g, 0, sl + 2, g.w, 6, 0x6a4228); for (let y = sl + 3; y < sl + 8; y += 2) g.px(g.w / 2, y, 0xd8c8a0); }
  if (c.prof === 'curtidor' || c.prof === 'armeiro') cloth(g, 0, g.h - 6, g.w, 6, c.prof === 'armeiro' ? 0x3a2a22 : 0x7a4a2a);
  else { g.rect(0, g.h - 1, g.w, 1, sh(c.skin, 0.86)); if (f === 'front') { g.px(2, g.h - 2, sh(c.skin, 0.9)); g.px(5, g.h - 2, sh(c.skin, 0.9)); } }
}

function vLeg(g: Face, f: FaceName, c: VColors): void {
  g.noise(c.pants, 0.05);
  if (f === 'top') return;
  const bare = c.shoes < 0;
  const boots = c.prof === 'pescador' ? 9 : 5;
  if (f === 'bottom') { g.noise(bare ? sh(c.skin, 0.8) : sh(c.prof === 'pescador' ? 0x3c4a34 : c.shoes, 0.8), 0.05); return; }
  g.rect(0, g.h - boots - 1, g.w, 1, c.pantsD);
  if (bare) {
    // barra enrolada e pés descalços
    cloth(g, 0, g.h - 9, g.w, 2, sh(c.pants, 1.15)); cloth(g, 0, g.h - 7, g.w, 7, c.skin, 0.03);
    if (f === 'front') for (let x = 0; x < g.w; x += 2) g.px(x, g.h - 1, sh(c.skin, 0.8));
  } else {
    const shoe = c.prof === 'pescador' ? 0x3c4a34 : c.shoes;
    cloth(g, 0, g.h - boots, g.w, boots, shoe, 0.04);
    g.rect(0, g.h - boots, g.w, 1, sh(shoe, 1.25));
    if (f === 'front') g.rect(0, g.h - 1, g.w, 1, sh(shoe, 0.7));
  }
  if ((c.pattern === 'patch' || c.prof === 'tolo') && f === 'front') {
    // remendo no joelho com pontos de costura
    const pc = c.prof === 'tolo' ? 0xb89a3a : sh(c.pants, 1.25);
    cloth(g, 1, 7, 5, 4, pc, 0.05);
    for (const [x, y] of [[1, 7], [3, 7], [5, 7], [1, 10], [3, 10], [5, 10]]) g.px(x, y, 0xe8dcc0);
  }
  if (c.pattern === 'knit') g.rect(0, g.h - boots - 1, g.w, 1, 0xeae6de);
}

function straw(g: Face): void {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.px(x, y, (x + y) % 4 < 2 ? sh(0xe0c270, 1 + (g.r() - 0.5) * 0.1) : sh(0xbf9e4c, 1 + (g.r() - 0.5) * 0.1));
}

function vAccessories(sk: SkinPainter, c: VColors): void {
  const p = c.prof;
  // --- chapéu de palha (fazendeiro)
  sk.cube('strawCrown', (g, f) => { straw(g); if (f !== 'top' && f !== 'bottom') g.rect(0, g.h - 3, g.w, 2, 0x9a3a28); });
  sk.cube('strawBrim', (g, f) => {
    straw(g);
    if (f === 'top' || f === 'bottom') for (let i = 0; i < g.w; i++) for (const [x, y] of [[i, 0], [i, g.h - 1], [0, i], [g.w - 1, i]]) if (g.r() < 0.3) g.clear(x, y);
  });
  // --- chapéu mole (pescador)
  const canvas = (g: Face) => { g.noise(0x9a946a, 0.06); for (let x = 1; x < g.w; x += 3) g.px(x, 1, 0xb8b288); };
  sk.cube('floppyCrown', (g, f) => { canvas(g); if (f !== 'top' && f !== 'bottom') g.rect(0, g.h - 2, g.w, 2, 0x5a5638); });
  sk.cube('floppyF', canvas); sk.cube('floppyL', canvas);
  // --- chapéu com pena (flecheiro)
  const felt = (g: Face) => g.noise(0x4a6a3a, 0.07);
  sk.cube('capBody', (g, f) => { felt(g); if (f !== 'top' && f !== 'bottom') g.rect(0, g.h - 2, g.w, 1, 0x6a4a2a); });
  sk.cube('capTop', felt); sk.cube('capVisor', (g) => g.noise(0x3e5a30, 0.06));
  for (const f of ['left', 'right'] as const) sk.face('feather', f, (g) => {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const half = Math.min(g.w / 2, (g.h - y) * 0.45 + 0.3);
      if (Math.abs(x + 0.5 - g.w / 2) <= half) g.px(x, y, y < 3 ? 0x8a2a1e : 0xc8402e);
    }
    g.line(g.w / 2 - 0.5, 2, g.w / 2 - 0.5, g.h - 1, 0xf0e6d4);
  });
  // --- capacete (pedreiro)
  sk.cube('helmDome', (g, f) => { g.noise(0xe0a032, 0.05); if (f === 'top') g.rect(2, 2, 3, 3, 0xf0c060); for (let i = 0; i < 4; i++) g.px(g.r() * g.w, g.r() * g.h, 0x9a7a4a); });
  sk.cube('helmRidge', (g) => g.noise(0xc88a22, 0.05));
  sk.cube('helmBrim', (g) => g.noise(0xd09428, 0.05));
  // --- óculos
  sk.face('glasses', 'front', (g) => {
    const fr = p === 'cartografo' ? 0xb08a3a : 0x4a2e1e;
    g.box(0, 0, 4, 5, fr); g.box(g.w - 4, 0, 4, 5, fr); g.rect(4, 2, g.w - 8, 1, fr);
    g.px(1, 1, [220, 235, 255, 160]); g.px(g.w - 3, 1, [220, 235, 255, 160]);
  });
  // --- aljava, mapa, livro, pingente
  sk.cube('quiver', (g, f) => { g.noise(0x7a4a2a, 0.07); if (f === 'top') g.fill(0x2a1a10); else if (f !== 'bottom') { g.rect(0, 2, g.w, 1, 0x4a2c18); g.rect(0, g.h - 3, g.w, 1, 0x4a2c18); } });
  sk.cube('fletch', (g, f) => { g.fill(0xeee6d6); if (f !== 'bottom') for (let x = 1; x < g.w; x += 2) g.rect(x, 0, 1, g.h, 0xc8402e); });
  sk.cube('mapRoll', (g, f) => {
    g.noise(0xe6d6a6, 0.05);
    if (f === 'left' || f === 'right') { g.box(0, 0, g.w, g.h, 0xb8a47a); g.px(1, 1, 0x9a865c); g.px(2, 2, 0x9a865c); }
    else g.rect(g.w / 2 - 1, 0, 2, g.h, 0xa8302a);
  });
  sk.cube('book', (g, f) => {
    if (f === 'front' || f === 'back') { g.noise(0x8a2a2a, 0.06); g.box(0, 0, g.w, g.h, 0x5a1a1a); g.rect(1, 2, g.w - 2, 1, 0xd8b048); }
    else if (f === 'right') { g.noise(0x6a1e1e, 0.05); g.rect(0, 1, g.w, 1, 0xd8b048); g.rect(0, g.h - 2, g.w, 1, 0xd8b048); }
    else { g.fill(0xeee4c8); for (let y = 1; y < g.h; y += 2) g.rect(0, y, g.w, 1, 0xd8ccac); }
  });
  sk.cube('pendant', (g, f) => { g.noise(0xd8b048, 0.06); if (f === 'front') { g.rect(1, 1, 2, 2, 0x8a4ab0); g.px(1, 1, 0xc08ae0); } });
  // --- avental (armeiro, ferramenteiro, espadeiro, açougueiro)
  sk.face('apron', 'front', (g) => {
    const col = p === 'armeiro' ? 0x3a2a22 : p === 'ferramenteiro' ? 0x7c7c78 : p === 'espadeiro' ? 0x4a3222 : 0xe8e4dc;
    g.noise(col, 0.05);
    g.clear(0, 0, 1, 2); g.clear(g.w - 1, 0, 1, 2);
    if (p === 'armeiro') { for (const [x, y] of [[2, 2], [g.w - 3, 2], [2, g.h - 4], [g.w - 3, g.h - 4]]) g.px(x, y, 0xa89870); g.spots(0x241a16, 3, 1, 2); }
    if (p === 'ferramenteiro') { g.rect(1, 12, 5, 5, 0x5e5e5a); g.rect(8, 12, 5, 5, 0x5e5e5a); g.rect(3, 9, 1, 4, 0x7a4a2a); g.rect(10, 10, 2, 3, 0xa0a4a8); }
    if (p === 'espadeiro') g.box(1, 1, g.w - 2, g.h - 2, 0x8a6a4a);
    if (p === 'acougueiro') { g.spots(0xa3302a, 5, 0.8, 1.8); g.spots(0x7a1e1a, 3, 0.6, 1.2); }
    g.rect(0, g.h - 1, g.w, 1, sh(col, 0.8));
  });
  // --- colete (pescador: tecido com bolsos; curtidor: couro com cordão)
  sk.cube('vest', (g, f) => {
    const col = p === 'curtidor' ? 0x8a5a32 : 0x6e7550;
    g.noise(col, 0.06);
    if (f === 'front') {
      g.clear(g.w / 2 - 2, 0, 4, g.h);
      if (p === 'pescador') { g.rect(1, 8, 4, 4, sh(col, 0.8)); g.rect(g.w - 5, 8, 4, 4, sh(col, 0.8)); g.rect(1, 13, 4, 3, sh(col, 0.8)); g.rect(g.w - 5, 13, 4, 3, sh(col, 0.8)); }
      else for (let y = 2; y < g.h - 2; y += 3) { g.px(g.w / 2 - 3, y, 0xd8c09a); g.px(g.w / 2 + 2, y, 0xd8c09a); }
    }
    if (f === 'top') g.clear(3, 0, g.w - 6, g.h);
    if (f === 'bottom') g.clear(1, 1, g.w - 2, g.h - 2);
  });
  // --- poncho de lã (pastor): listras coloridas e franja
  sk.cube('poncho', (g, f) => {
    g.noise(0xe4d6bb, 0.05);
    if (f === 'top') { g.clear(g.w / 2 - 8, g.h / 2 - 4, 16, 8); return; }
    if (f === 'bottom') { g.clear(2, 1, g.w - 4, g.h - 2); return; }
    const bands = [0xb8402e, 0xe0902a, 0x2e7a7a, 0x6a4a2e];
    for (let i = 0; i < 4; i++) g.rect(0, 3 + i * 3, g.w, 1 + (i % 2), bands[i]);
    for (let x = 0; x < g.w; x += 2) g.clear(x, g.h - 2, 1, 2);
  });
  // --- túnica (clérigo)
  sk.cube('robe', (g, f) => { g.noise(0x5c3a7c, 0.05); if (f !== 'top' && f !== 'bottom') { g.rect(0, g.h - 2, g.w, 1, 0xd8b048); if (f === 'front') g.rect(g.w / 2 - 1, 0, 2, g.h, 0x44285e); } });
  // --- pálpebras (dormindo)
  sk.face('eyelids', 'front', (g) => {
    g.clear(0, 0, g.w, g.h);
    for (const x of [0, g.w - 2]) { g.rect(x, 0, 2, 3, c.skin); g.px(x, 2, 0x2a1c16); g.px(x + 1, 2, 0x2a1c16); }
  });
}

function paintVillager(sk: SkinPainter, variant: string): void {
  const c = villagerColors(variant || 'planicie|nenhuma');
  const p = c.prof;
  sk.cube('head', (g, f) => vHead(g, f, c));
  sk.cube('body', (g, f) => {
    vShirt(g, f, c);
    if (f === 'top' || f === 'bottom') return;
    if (ACC[p]?.includes('apron') && (f === 'front' || f === 'back')) {
      const col = p === 'armeiro' ? 0x3a2a22 : p === 'ferramenteiro' ? 0x7c7c78 : p === 'espadeiro' ? 0x4a3222 : 0xe8e4dc;
      g.rect(2, 0, 2, 9, col); g.rect(g.w - 4, 0, 2, 9, col);
      if (f === 'back') { g.line(2, 0, g.w - 3, 12, col); g.line(g.w - 3, 0, 2, 12, col); }
    }
    if (p === 'fazendeiro' && f === 'front') { g.rect(3, 0, 10, 2, 0xb8302a); g.rect(6, 2, 4, 1, 0xb8302a); g.px(7, 3, 0xb8302a); g.px(5, 0, 0xf0e8d8); g.px(10, 1, 0xf0e8d8); }
    if (p === 'cartografo') g.line(1, 0, g.w - 2, g.h - 4, 0x6a4228);
    if (p === 'clerigo' && f === 'front') { g.line(2, 0, 7, 9, c.accent); g.line(13, 0, 8, 9, c.accent); }
    if (p === 'pedreiro') for (let i = 0; i < 14; i++) g.px(g.r() * g.w, g.r() * g.h, [205, 198, 186, 200]);
  });
  sk.cube('armR', (g, f) => { vArm(g, f, c); if (p === 'pedreiro') for (let i = 0; i < 5; i++) g.px(g.r() * g.w, g.r() * g.h, [205, 198, 186, 200]); });
  sk.cube('legR', (g, f) => { vLeg(g, f, c); if (p === 'pedreiro') for (let i = 0; i < 8; i++) g.px(g.r() * g.w, g.r() * g.h, [205, 198, 186, 200]); });
  vAccessories(sk, c);
}

export const VILLAGER: ModelDef = {
  id: 'villager',
  parts: VILLAGER_PARTS,
  paint: paintVillager,
  animate(p, s) {
    const e = s.e as Villager;
    if (e.sleeping) return;
    head(p, s);
    biped(p, s, { armAmp: 0.9 });
    // recusa: balança a cabeça dizendo "não"
    if (e.shakeHead > 0) p.head.rotation.y += Math.sin(s.t * 1.3) * 0.4;
  },
};

// ================================================================== SENTINELA
// 43 px: pernas de tijolo (13), quadril com cinto trançado, peito largo (14), cabeça de pedra de rio baixa e à
// frente, com testa de tijolo sobre os olhos. Braços: pedra no ombro (com musgo e flores), braço de tijolo,
// antebraço grosso com fitinhas e punho de pedra quase no chão.
function golemArm(side: 'R' | 'L'): PartDef {
  const L = side === 'L', sg = L ? 1 : -1;
  const X = (a: number, w: number): number => (L ? -a - w : a);
  const mir = (id: string) => (L ? { mirror: true, skinOf: id } : {});
  return {
    name: `arm${side}`, pivot: [10 * sg, 30, 0],
    cubes: [
      { id: `stone${side}`, o: [X(-13.5, 7), 27, -4], s: [7, 5, 8], ...mir('stoneR') },
      { id: `upper${side}`, o: [X(-12.5, 5), 17, -2.5], s: [5, 10, 5], ...mir('upperR') },
      { id: `fore${side}`, o: [X(-13, 6), 6, -3], s: [6, 11, 6] }, // pele própria: as fitinhas ficam só no pulso direito
      { id: `fist${side}`, o: [X(-13.5, 7), 1, -3.5], s: [7, 5, 7], ...mir('fistR') },
      { id: `moss${side}`, o: [X(-12.5, 4), 32, -2.5], s: [4, 1, 4], ...mir('mossR') },
      { id: `bloom${side}1`, o: [X(-10, 1), 33, 0], s: [1, 1, 1], ...mir('bloomR1') },
      { id: `bloom${side}2`, o: [X(-12, 1), 33, -2], s: [1, 1, 1], ...mir('bloomR2') },
    ],
    // flor oferecida (só no braço direito): aponta para a frente com o braço baixo; com o braço estendido fica de pé
    children: L ? [] : [{
      name: 'flower', pivot: [-10, 3.5, 3.5],
      cubes: [
        { id: 'stem', o: [-10.5, 3, 3.5], s: [1, 1, 6] },
        { id: 'leafF', o: [-12, 3, 6], s: [2, 1, 1] },
        { id: 'blossom', o: [-11.5, 2, 9.5], s: [3, 3, 1] },
        { id: 'bud', o: [-10.5, 3, 10.5], s: [1, 1, 1] },
      ],
    }],
  };
}

const SENTINELA_PARTS: PartDef[] = [
  { name: 'legR', pivot: [-3, 13, 0], cubes: [{ o: [-5.5, 0, -2.5], s: [5, 13, 5] }] },
  { name: 'legL', pivot: [3, 13, 0], cubes: [{ o: [0.5, 0, -2.5], s: [5, 13, 5], mirror: true, skinOf: 'legR' }] },
  {
    name: 'body', pivot: [0, 13, 0],
    cubes: [
      { id: 'hips', o: [-6, 13, -3.5], s: [12, 5, 7] },
      { id: 'chest', o: [-8, 18, -5], s: [16, 14, 10] },
    ],
    children: [
      {
        name: 'head', pivot: [0, 31, 2],
        cubes: [
          { o: [-4, 30, -1], s: [8, 9, 8] },
          { id: 'brow', o: [-4.5, 35, 6], s: [9, 1, 2] },
          { id: 'cap', o: [-3.5, 39, -0.5], s: [7, 1, 7] },
          { id: 'headBloom', o: [1, 40, 2], s: [1, 1, 1] },
        ],
        children: [{
          name: 'eyesG', pivot: [0, 31, 2],
          cubes: [
            { id: 'eyeGR', o: [-3, 33.5, 6.5], s: [2, 1, 1], emissive: 0.55 },
            { id: 'eyeGL', o: [1, 33.5, 6.5], s: [2, 1, 1], emissive: 0.55, mirror: true, skinOf: 'eyeGR' },
          ],
        }],
      },
      golemArm('R'), golemArm('L'),
    ],
  },
];

const BRICKS = [0xa95e3a, 0x9a5536, 0xb56c48, 0x8e4c30, 0xa0644a], MORTAR = 0xb8a68a;
const RSTONE = 0x8a8f8b, RSTONE_D = 0x676b68, RSTONE_L = 0xaab0ac, GMOSS = 0x5b8a38, GMOSS_L = 0x80aa4a, CRACK = 0x3a2418;

/** Tijolos de barro cozido em fiadas desencontradas, com argamassa clara. */
function bricks(g: Face, rowH = 4, bw = 8): void {
  g.fill(MORTAR);
  for (let y = 0, row = 0; y < g.h; y += rowH, row++) {
    const off = row % 2 ? Math.floor(bw / 2) : 0;
    for (let x = -off; x < g.w; x += bw) {
      const col = BRICKS[Math.floor(g.r() * BRICKS.length)];
      cloth(g, x, y, bw - 1, rowH - 1, col, 0.07);
      g.px(x + 1, y, sh(col, 1.12));
      if (g.r() < 0.3) g.px(x + 2 + g.r() * (bw - 4), y + rowH - 2, sh(col, 0.8)); // lasquinha
    }
  }
  // encardido de barro subindo da base
  for (let yy = g.h - 5; yy < g.h; yy++) for (let xx = 0; xx < g.w; xx++) if (g.r() < (yy - g.h + 6) / 9) g.px(xx, yy, [96, 70, 50, 110]);
}
/** Pedra de rio arredondada, com brilho em cima e sombra embaixo. */
function riverStone(g: Face, cx: number, cy: number, rx: number, ry: number): void {
  g.ellipse(cx, cy + 0.6, rx, ry, RSTONE_D);
  g.ellipse(cx, cy, rx - 0.4, ry - 0.4, sh(RSTONE, 1 + (g.r() - 0.5) * 0.15));
  g.ellipse(cx - rx * 0.3, cy - ry * 0.35, Math.max(0.8, rx * 0.35), Math.max(0.8, ry * 0.3), RSTONE_L);
}
function pebble(g: Face): void {
  g.noise(RSTONE, 0.06);
  for (let i = 0; i < g.w * g.h / 14; i++) g.px(g.r() * g.w, g.r() * g.h, g.r() < 0.5 ? RSTONE_L : RSTONE_D);
  for (let y = 3; y < g.h; y += 5 + Math.floor(g.r() * 3)) g.line(0, y, g.w - 1, y + (g.r() < 0.5 ? 1 : -1), sh(RSTONE, 0.9));
}
function mossy(g: Face, amount: number): void {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.r() < amount) g.px(x, y, g.r() < 0.6 ? GMOSS : GMOSS_L);
}
/** Rachaduras por nível de dano (1: <75%, 2: <50%, 3: <25% com lascas faltando). */
function cracks(g: Face, n: number): void {
  if (n <= 0) return;
  const count = Math.max(1, Math.round((n * g.w * g.h) / 320));
  for (let i = 0; i < count; i++) {
    let x = g.r() * g.w, y = g.r() * g.h * 0.7;
    const len = 4 + Math.floor(g.r() * (3 + n * 3));
    for (let k = 0; k < len; k++) { g.px(x, y, CRACK); x += g.r() < 0.5 ? 1 : -1; y += g.r() < 0.7 ? 1 : 0; }
  }
  if (n >= 3) for (let i = 0; i < Math.ceil(count / 2); i++) { const x = g.r() * (g.w - 4), y = g.r() * (g.h - 3); g.rect(x, y, 3, 2, 0x4a2c1c); g.px(x, y, 0x241410); }
}

function paintSentinela(sk: SkinPainter, variant: string): void {
  const n = Number(variant.replace('cracks', '')) || 0;
  sk.cube('chest', (g, f) => {
    if (f === 'bottom') { g.noise(0x7a4a30, 0.06); return; }
    bricks(g);
    if (f === 'top') { mossy(g, 0.25); g.spots(GMOSS, 4, 1.5, 3); cracks(g, n); return; }
    if (f === 'front' || f === 'back') {
      riverStone(g, 7, 8, 4, 3); riverStone(g, 23, 12, 5, 3.5); riverStone(g, 12, 19, 3.5, 2.5); riverStone(g, 27, 23, 3, 2.5); riverStone(g, 4, 24, 2.5, 2);
    } else { riverStone(g, 8, 10, 3.5, 3); riverStone(g, 14, 21, 3, 2.5); }
    // musgo escorrendo da beirada de cima
    for (let x = 0; x < g.w; x++) { const d = Math.floor(g.r() * 3) + (g.r() < 0.2 ? 3 : 0); for (let y = 0; y < d; y++) g.px(x, y, g.r() < 0.6 ? GMOSS : GMOSS_L); }
    cracks(g, n);
  });
  sk.cube('hips', (g, f) => {
    bricks(g);
    // cinto trançado de palha
    if (f !== 'top' && f !== 'bottom') { for (let y = 0; y < 4; y++) for (let x = 0; x < g.w; x++) g.px(x, y, (x + y) % 4 < 2 ? 0xd4b468 : 0xa8883c); g.rect(0, 4, g.w, 1, 0x7a5a2a); }
    cracks(g, n);
  });
  sk.cube('legR', (g, f) => {
    if (f === 'top') { g.noise(0x8a5a3a, 0.05); return; }
    if (f === 'bottom') { pebble(g); return; }
    bricks(g);
    cloth(g, 0, g.h - 6, g.w, 6, RSTONE, 0.06); g.rect(0, g.h - 6, g.w, 1, RSTONE_L);
    if (f === 'front') for (const x of [2, 5, 8]) g.rect(x, g.h - 3, 1, 3, RSTONE_D);
    cracks(g, n);
  });
  sk.cube('head', (g, f) => {
    pebble(g);
    if (f === 'top') { mossy(g, 0.35); return; }
    if (f === 'front') {
      // boca: uma fresta torta; líquen nas bochechas
      g.line(4, 14, 7, 15, 0x3e3a36); g.line(8, 15, 11, 14, 0x3e3a36);
      g.spots(0x9aa86a, 2, 0.8, 1.4);
    }
    cracks(g, Math.max(0, n - 1));
  });
  sk.cube('brow', (g) => bricks(g, 2, 6));
  sk.cube('cap', (g, f) => { g.noise(GMOSS, 0.1); mossy(g, 0.3); if (f === 'top') { g.px(3, 3, 0xf2c230); g.px(9, 6, 0xf4efe6); g.px(11, 2, 0xe7729e); } });
  sk.cube('headBloom', (g, f) => g.fill(f === 'top' ? 0xf8e070 : 0xf2c230));
  sk.cube('eyeGR', (g, f) => { g.fill(0xc07818); if (f === 'front') { g.px(1, 0, 0xe0a040); g.px(2, 0, 0xe0a040); } });
  sk.cube('stoneR', (g, f) => {
    pebble(g); g.rim(0.82, 1);
    if (f === 'top') { mossy(g, 0.55); g.spots(GMOSS, 2, 1.5, 2.5); } else for (let x = 0; x < g.w; x++) if (g.r() < 0.5) g.px(x, 0, GMOSS);
    cracks(g, Math.max(0, n - 1));
  });
  sk.cube('upperR', (g, f) => { bricks(g); if (f === 'top') mossy(g, 0.2); cracks(g, n); });
  sk.cube('foreR', (g, f) => {
    bricks(g);
    if (f !== 'top' && f !== 'bottom') {
      // fitinhas amarradas no pulso direito (vermelha, amarela e verde), pontas soltas na frente
      g.rect(0, g.h - 7, g.w, 1, 0xc8302c); g.rect(0, g.h - 5, g.w, 1, 0xf0c830); g.rect(0, g.h - 3, g.w, 1, 0x3a9a4a);
      if (f === 'front') { g.rect(4, g.h - 7, 1, 4, 0xc8302c); g.rect(6, g.h - 5, 1, 4, 0xf0c830); g.px(5, g.h - 3, 0x3a9a4a); }
    }
    cracks(g, n);
  });
  sk.cube('foreL', (g) => { bricks(g); cracks(g, n); });
  sk.cube('fistR', (g, f) => {
    pebble(g);
    if (f === 'front') for (const x of [3, 6, 9]) g.rect(x, 3, 1, g.h - 3, RSTONE_D);
    if (f === 'bottom') g.noise(RSTONE_D, 0.05);
    cracks(g, Math.max(0, n - 1));
  });
  sk.cube('mossR', (g) => { g.noise(GMOSS, 0.1); mossy(g, 0.35); });
  sk.cube('bloomR1', (g, f) => g.fill(f === 'top' ? 0xf8e070 : 0xf2c230));
  sk.cube('bloomR2', (g, f) => g.fill(f === 'top' ? 0xf4a0c0 : 0xe7729e));
  sk.cube('stem', (g) => g.noise(0x4a8a30, 0.06));
  sk.cube('leafF', (g) => g.noise(0x5aa03a, 0.06));
  sk.cube('blossom', (g, f) => { g.noise(0xd8302a, 0.06); if (f === 'front') { g.rect(2, 2, 2, 2, 0xf2c230); g.px(0, 0, 0xa82420); g.px(5, 5, 0xa82420); } });
  sk.cube('bud', (g) => g.fill(0xf2c230));
}

const C_SW = 0.6662;
export const SENTINELA: ModelDef = {
  id: 'sentinela',
  parts: SENTINELA_PARTS,
  paint: paintSentinela,
  animate(p, s) {
    const e = s.e as Sentinela;
    head(p, s);
    const w = Math.cos(s.swing * C_SW) * s.amount;
    const offering = e.offerFlower > 0;
    p.legR.rotation.x += w * 0.6;
    p.legL.rotation.x -= w * 0.6;
    if (!offering) p.armR.rotation.x -= w * 0.4;
    p.armL.rotation.x += w * 0.4;
    p.body.rotation.z += w * 0.035;
    const idle = Math.sin(s.t * 0.05) * 0.035;
    p.armR.rotation.z -= idle; p.armL.rotation.z += idle;
    // golpe: os dois braços sobem juntos e descem com força
    const at = e.attackTimer > 0 ? Math.max(0, e.attackTimer - s.alpha) / 10 : 0;
    if (at > 0) { const k = Math.sin(at * Math.PI); p.armR.rotation.x -= 2.1 * k; p.armL.rotation.x -= 2.1 * k; p.body.rotation.x -= 0.1 * k; }
    // oferecendo a flor: braço direito estendido, flor de pé, cabeça inclinada olhando para ela
    if (offering) { p.armR.rotation.x -= 1.0; p.flower.rotation.x -= 0.45; p.head.rotation.x += 0.2; }
  },
};

export const SPECS_SOMBRAS3: Record<string, MobModelSpec> = {
  villager: {
    def: VILLAGER,
    variant: (e) => `${(e as Villager).style}|${(e as Villager).profession}`,
    babyHead: 1.4,
    handOffset: [-2, -10, 1],
    pose(inst, e) {
      const v = e as Villager;
      const acc = ACC[v.profession] ?? [];
      for (const n of ALL_ACC) inst.parts[n].visible = acc.includes(n);
      inst.parts.eyelids.visible = v.sleeping;
      // dormindo: deitado de costas, centrado na posição (cabeça para trás, −Z do modelo)
      if (v.sleeping) {
        const k = inst.body.scale.x;
        inst.body.rotation.x = -Math.PI / 2;
        inst.body.position.y += (4 / 16) * k;
        inst.body.position.z += (15.5 / 16) * k;
      } else inst.body.rotation.x = 0;
    },
  },
  sentinela: {
    def: SENTINELA,
    variant: (e) => { const r = e.health / e.maxHealth; return `cracks${r < 0.25 ? 3 : r < 0.5 ? 2 : r < 0.75 ? 1 : 0}`; },
    pose(inst, e) { inst.parts.flower.visible = (e as Sentinela).offerFlower > 0; },
  },
};
