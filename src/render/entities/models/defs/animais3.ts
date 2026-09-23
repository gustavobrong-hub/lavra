/**
 * Grupo ANIMAIS (3/4): cavalo crioulo. Compacto e robusto, crina e cola de pelo, cascos, patas com joelho
 * (dobram no passo), pescoço e cabeça bem acima do corpo. Pelagens: branco, creme, alazão, castanho (pontas
 * pretas), preto, tordilho (cinza rodado) e baio (amarelado com crina escura, lista de mula e zebruras).
 * Marcas: meias, pampa, pintas, estrela. Arreio crioulo: baixeiro listrado, carona de couro, pelego e estribos.
 * Empina (standAnim), come feno com a cabeça no chão (eatingHay) e galopa mais amplo com cavaleiro.
 */
import type { ModelDef, PartDef } from '../boxmodel';
import { head, quadLegs } from '../anim';
import type { Face } from '../skin';
import type { MobModelSpec } from '../../mobvisual';
import type { Horse } from '../../../../game/entity/species/tamables';
import { C, DEG, clamp, ease, blotch, speckle, dk, mix, topShade, bottomShade } from './animais_base';

interface Coat {
  base: number; dark: number; light: number; mane: number; maneL: number; muzzle: number; hoof: number;
  /** pontas escuras (canelas) */ points?: number;
  /** tordilho: rodados */ dapple?: boolean;
  /** baio: lista de mula e zebruras */ stripe?: number;
}
const COATS: Record<string, Coat> = {
  branco: { base: 0xd6d1c7, dark: 0xb5afa4, light: 0xe8e4dc, mane: 0xe4dfd4, maneL: 0xf4f1ea, muzzle: 0x8d807e, hoof: 0x9d8d74 },
  creme: { base: 0xd2b682, dark: 0xb39664, light: 0xe2cc9e, mane: 0xe8d8b2, maneL: 0xf6ead0, muzzle: 0xb4867a, hoof: 0xa48c6c },
  alazao: { base: 0x984822, dark: 0x733414, light: 0xb05c2c, mane: 0xa4501e, maneL: 0xc26c2c, muzzle: 0x4a3028, hoof: 0x3e3028 },
  castanho: { base: 0x6c3b20, dark: 0x4f2a16, light: 0x844f2c, mane: 0x34251f, maneL: 0x4a372e, muzzle: 0x34261f, hoof: 0x2e2622, points: 0x36271f },
  preto: { base: 0x3b2d29, dark: 0x2a201d, light: 0x54433d, mane: 0x2e2320, maneL: 0x463631, muzzle: 0x30251f, hoof: 0x2e2622 },
  tordilho: { base: 0x8f8e8b, dark: 0x6a6967, light: 0xc4c3be, mane: 0x68676a, maneL: 0xb4b2ac, muzzle: 0x474142, hoof: 0x4a4440, dapple: true },
  baio: { base: 0xc8984c, dark: 0xa47634, light: 0xdab068, mane: 0x2f251d, maneL: 0x4a3a2b, muzzle: 0x3a2c22, hoof: 0x2e2622, points: 0x3a2c22, stripe: 0x5a3f27 },
};
const WHITE = 0xece8df, WHITE_D = 0xd2cdc3;
const H_EYE = 0x2a1d18;
const SAD_RED = 0x8f2a22, SAD_BLACK = 0x2e2524, SAD_CREAM = 0xdcc9a0, SAD_OCH = 0xc2903a;
const LEATHER = 0x6e3f22, LEATHER_D = 0x4c2a16, TOOL = 0x9a6438, PELEGO = 0xcbb894, IRON = 0x5c5a58;

/** Pelagem base com rodados (tordilho). */
function horseCoat(g: Face, c: Coat, strand = 0.3): void {
  g.fur(c.base, c.dark, c.light, strand);
  if (c.dapple) {
    const n = Math.max(1, Math.round(g.w * g.h / 36));
    for (let i = 0; i < n; i++) {
      const x = g.r() * g.w, y = g.r() * g.h, r = 1 + g.r() * 1.1;
      g.ellipse(x, y, r + 0.8, r + 0.7, mix(c.base, c.dark, 0.55));
      g.ellipse(x, y, r, r * 0.9, mix(c.base, c.light, 0.65));
    }
  }
}

/** Marcas brancas: pampa (manchas grandes) e pintas (pintinhas). */
function horseMarks(g: Face, marks: string, big: number, small: number): void {
  if (marks === 'pampa') for (let i = 0; i < big; i++) blotch(g, g.r() * g.w, g.r() * g.h, 4 + g.r() * 5, WHITE);
  if (marks === 'pintas') {
    const n = Math.round(g.w * g.h / 30 * small);
    for (let i = 0; i < n; i++) { const x = g.r() * g.w, y = g.r() * g.h; g.rect(x, y, 2, 2, WHITE); g.px(x + 1, y + 1, WHITE_D); }
  }
}

/** Pelo de crina/cola: fios verticais claros e escuros, pontas desfiadas. */
function hair(g: Face, c: Coat, fray: boolean): void {
  g.noise(c.mane, 0.06);
  for (let x = 0; x < g.w; x++) if (g.r() < 0.45) g.rect(x, 0, 1, g.h, g.r() < 0.5 ? c.maneL : dk(c.mane, 0.78));
  if (fray) for (let x = 0; x < g.w; x++) { const n = Math.floor(g.r() * 3); for (let k = 0; k < n; k++) g.clear(x, g.h - 1 - k); }
}

/** Baixeiro de lã tecida (listras vermelho, preto, creme, ocre) com franja. */
function horseBlanket(g: Face, f: string): void {
  if (f === 'top' || f === 'bottom') { g.noise(SAD_RED, 0.06); return; }
  const bands: [number, number][] = [[SAD_BLACK, 1], [SAD_RED, 2], [SAD_CREAM, 1], [SAD_RED, 2], [SAD_OCH, 1], [SAD_RED, 2], [SAD_BLACK, 1], [SAD_CREAM, 1]];
  let y = 0;
  while (y < g.h) for (const [c, n] of bands) { g.rect(0, y, g.w, n, c); y += n; if (y >= g.h) break; }
  for (let x = 0; x < g.w; x += 4) for (let yy = 0; yy < g.h; yy++) if (g.r() < 0.3) g.px(x, yy, dk(g.get(x, yy), 0.85));
  for (let x = 0; x < g.w; x += 2) g.clear(x, g.h - 1);
}

// Esqueleto: o corpo é a raiz (pivô no quadril, para empinar); pernas com joelho; pescoço+cabeça num grupo.
const LEG_LOW = (name: string, x: number, z: number, skin?: string): PartDef => ({
  name, pivot: [x, 6, z],
  cubes: [{ o: [x - 1.5, 0, z - 1.5], s: [3, 6, 3], ...(skin ? { mirror: true, skinOf: skin } : {}) }],
});

export const HORSE: ModelDef = {
  id: 'horse',
  parts: [{
    name: 'body', pivot: [0, 13, -7],
    cubes: [
      { o: [-5, 11, -10], s: [10, 10, 20] },
      { id: 'croup', o: [-4.5, 21, -9.5], s: [9, 1, 5] },
      { id: 'withers', o: [-2, 21, 6], s: [4, 1, 3] },
      { id: 'chest', o: [-4, 12, 10], s: [8, 8, 1] },
    ],
    children: [
      {
        name: 'saddle', pivot: [0, 13, -7],
        cubes: [
          { id: 'blanket', o: [-5, 15, -5], s: [10, 6, 12], inflate: 0.35 },
          { id: 'skirt', o: [-5, 16, -4], s: [10, 5, 10], inflate: 0.7 },
          { id: 'pelego', o: [-4.5, 21, -4], s: [9, 2, 9] },
          { id: 'cinch', o: [-5, 11, 2], s: [10, 5, 2], inflate: 0.25 },
          { id: 'strapR', o: [-6, 12, 1], s: [1, 4, 1] },
          { id: 'strapL', o: [5, 12, 1], s: [1, 4, 1], skinOf: 'strapR' },
          { id: 'stirrupR', o: [-6.5, 10, 0.5], s: [1, 2, 2] },
          { id: 'stirrupL', o: [5.5, 10, 0.5], s: [1, 2, 2], skinOf: 'stirrupR' },
        ],
      },
      {
        // pescoço + cabeça (gira inteiro com o olhar); o crânio tem pivô próprio na nuca
        name: 'head', pivot: [0, 20, 8], rot: [30, 0, 0],
        cubes: [
          { id: 'neck', o: [-2, 17, 5], s: [4, 12, 6] },
          { id: 'mane', o: [-1, 19, 4], s: [2, 11, 2] },
        ],
        children: [{
          name: 'skull', pivot: [0, 28, 8], rot: [20, 0, 0],
          cubes: [
            { o: [-2.5, 25, 6], s: [5, 5, 7] },
            { id: 'muzzle', o: [-2, 25, 13], s: [4, 4, 4] },
            { id: 'forelock', o: [-1.5, 30, 8], s: [3, 1, 2] },
          ],
          children: [
            { name: 'earR', pivot: [-1.5, 30, 7.5], rot: [0, 0, 8], cubes: [{ o: [-2.5, 30, 7], s: [2, 3, 1] }] },
            { name: 'earL', pivot: [1.5, 30, 7.5], rot: [0, 0, -8], cubes: [{ o: [0.5, 30, 7], s: [2, 3, 1], mirror: true, skinOf: 'earR' }] },
          ],
        }],
      },
      { name: 'legFR', pivot: [-3, 13, 7], cubes: [{ o: [-5, 6, 5], s: [4, 7, 4] }], children: [LEG_LOW('legFRlow', -3, 7)] },
      { name: 'legFL', pivot: [3, 13, 7], cubes: [{ o: [1, 6, 5], s: [4, 7, 4], mirror: true, skinOf: 'legFR' }], children: [LEG_LOW('legFLlow', 3, 7, 'legFRlow')] },
      { name: 'legBR', pivot: [-3, 13, -7], cubes: [{ o: [-5, 6, -9], s: [4, 7, 4] }], children: [LEG_LOW('legBRlow', -3, -7)] },
      { name: 'legBL', pivot: [3, 13, -7], cubes: [{ o: [1, 6, -9], s: [4, 7, 4], mirror: true, skinOf: 'legBR' }], children: [LEG_LOW('legBLlow', 3, -7, 'legBRlow')] },
      {
        name: 'tail', pivot: [0, 20, -10], rot: [25, 0, 0],
        cubes: [{ id: 'dock', o: [-1, 15, -11], s: [2, 5, 2] }],
        children: [{
          name: 'tailHair', pivot: [0, 16, -10], cubes: [{ o: [-1.5, 10, -11.5], s: [3, 6, 3] }],
          children: [{ name: 'tailEnd', pivot: [0, 10, -10], rot: [-12, 0, 0], cubes: [{ o: [-2, 4, -12], s: [4, 6, 3] }] }],
        }],
      },
    ],
  }],
  paint(sk, variant) {
    const [coatId, marks = 'nenhuma'] = variant.split('|');
    const c = COATS[coatId] ?? COATS.castanho;
    const stripe = (g: Face) => { if (c.stripe) g.rect(g.w / 2 - 1, 0, 2, g.h, c.stripe); };
    sk.cube('body', (g, f) => {
      horseCoat(g, c);
      if (f === 'top') stripe(g);
      if (f === 'bottom') g.noise(mix(c.base, c.dark, 0.3), 0.05);
      if (f === 'left' || f === 'right') bottomShade(g, 2, 0.88);
      horseMarks(g, marks, f === 'left' || f === 'right' ? 2 : 1, 1);
    });
    sk.cubes(['croup', 'withers', 'chest'], (g, f) => { horseCoat(g, c); if (f === 'top') stripe(g); horseMarks(g, marks, 1, 1); });
    sk.cube('neck', (g, f) => { horseCoat(g, c); if (f === 'back') stripe(g); horseMarks(g, marks, 1, 0.5); });
    sk.cube('mane', (g) => hair(g, c, false));
    sk.cube('forelock', (g, f) => hair(g, c, f !== 'top' && f !== 'bottom'));
    sk.cube('skull', (g, f) => {
      horseCoat(g, c, 0.2);
      if (f === 'left' || f === 'right') {
        const L = f === 'left', ex = L ? 8 : g.w - 11;
        g.rect(ex - 1, 2, 5, 1, c.dark);
        g.rect(ex, 3, 3, 2, H_EYE);
        g.px(L ? ex : ex + 2, 3, 0x9a8a80);
        g.line(L ? 9 : g.w - 10, g.h - 1, L ? 13 : g.w - 14, g.h - 5, dk(c.base, 0.8));
      }
      if (f === 'top') {
        // quina dos olhos (o crânio fica inclinado: o topo aparece de frente)
        for (const x of [0, g.w - 1]) { g.px(x, 4, H_EYE); g.px(x, 5, H_EYE); g.px(x === 0 ? 1 : g.w - 2, 4, c.dark); }
        if (marks === 'estrela') { g.rect(4, 9, 2, 1, WHITE); g.rect(3, 10, 4, 2, WHITE); g.rect(4, 12, 2, 1, WHITE); }
      }
      if (f === 'bottom') g.noise(c.dark, 0.05);
    });
    sk.cube('muzzle', (g, f) => {
      if (f === 'front') {
        g.vgrad(mix(c.base, c.muzzle, 0.45), c.muzzle, 0.05);
        g.rect(0, 2, 1, 2, dk(c.muzzle, 0.55)); g.rect(g.w - 1, 2, 1, 2, dk(c.muzzle, 0.55));
        g.px(1, 3, dk(c.muzzle, 0.75)); g.px(g.w - 2, 3, dk(c.muzzle, 0.75));
        g.rect(2, g.h - 2, g.w - 4, 1, dk(c.muzzle, 0.7));
        return;
      }
      if (f === 'top') { horseCoat(g, c, 0.2); return; }
      g.vgrad(c.base, mix(c.base, c.muzzle, 0.75), 0.05);
      if (f === 'left') g.line(0, g.h - 2, 4, g.h - 2, dk(c.muzzle, 0.55));
      if (f === 'right') g.line(g.w - 1, g.h - 2, g.w - 5, g.h - 2, dk(c.muzzle, 0.55));
    });
    sk.cube('earR', (g, f) => {
      horseCoat(g, c, 0.2);
      if (f === 'front') g.rect(1, 1, g.w - 2, g.h - 1, dk(c.dark, 0.75));
      g.rect(0, 0, g.w, 1, c.dark);
    });
    sk.cubes(['legFR', 'legBR'], (g, f) => { horseCoat(g, c); if (f !== 'top' && f !== 'bottom') topShade(g, 3, 0.85); horseMarks(g, marks, 1, 0.6); });
    sk.cubes(['legFRlow', 'legBRlow'], (g, f) => {
      const sock = marks === 'meias';
      const base = sock ? WHITE : c.points ?? c.base;
      if (sock) g.noise(WHITE, 0.04);
      else if (c.points) g.fur(c.points, dk(c.points, 0.8), mix(c.points, 0xffffff, 0.12), 0.3);
      else horseCoat(g, c);
      if (!sock && marks === 'pampa' && g.r() < 0.5) g.noise(WHITE, 0.04);
      if (f === 'bottom') { g.fill(c.hoof); g.rect(1, 1, g.w - 2, g.h - 2, dk(c.hoof, 0.7)); return; }
      if (f === 'top') return;
      if (c.stripe && !sock) for (let y = 1; y < g.h - 6; y += 3) g.rect(0, y, g.w, 1, c.stripe);
      g.rect(0, g.h - 6, g.w, 2, dk(base, 0.82));
      g.rect(0, g.h - 4, g.w, 4, c.hoof);
      g.rect(0, g.h - 4, g.w, 1, mix(c.hoof, 0xffffff, 0.18));
    });
    sk.cube('dock', (g) => hair(g, c, false));
    sk.cube('tailHair', (g) => hair(g, c, false));
    sk.cube('tailEnd', (g, f) => hair(g, c, f !== 'top' && f !== 'bottom'));
    // arreio crioulo
    sk.cube('blanket', (g, f) => horseBlanket(g, f));
    sk.cube('skirt', (g, f) => {
      g.noise(LEATHER, 0.06);
      if (f === 'top' || f === 'bottom') return;
      g.box(1, 1, g.w - 2, g.h - 2, TOOL);
      for (let i = 0; i < 3; i++) { const x = 3 + g.r() * (g.w - 6), y = 3 + g.r() * (g.h - 6); g.px(x, y, TOOL); g.px(x + 1, y, TOOL); g.px(x, y + 1, TOOL); g.px(x + 1, y + 1, LEATHER_D); }
      g.rect(0, g.h - 1, g.w, 1, LEATHER_D);
    });
    sk.cube('pelego', (g, f) => {
      // pelego: lã crua de ovelha, cachos fofos
      g.noise(dk(PELEGO, 0.72), 0.05);
      for (let i = 0; i < g.w * g.h / 4; i++) {
        const x = g.r() * g.w, y = g.r() * g.h, r = 1 + g.r() * 1.2;
        g.ellipse(x, y, r, r * 0.85, dk(PELEGO, 0.88 + g.r() * 0.16));
        g.px(x - 0.5, y - 0.6, mix(PELEGO, 0xffffff, 0.35));
        g.px(x + 0.6, y + 0.6, dk(PELEGO, 0.7));
      }
      if (f !== 'top' && f !== 'bottom') for (let x = 0; x < g.w; x++) if (g.r() < 0.5) g.clear(x, g.h - 1);
    });
    sk.cube('cinch', (g) => { g.noise(0x8a6a44, 0.05); for (let x = 0; x < g.w; x += 2) g.rect(x, 0, 1, g.h, 0x6e5234); });
    sk.cube('strapR', (g) => g.noise(LEATHER_D, 0.06));
    sk.cube('stirrupR', (g, f) => { g.noise(IRON, 0.08); if (f === 'left' || f === 'right') g.clear(1, 1, g.w - 2, g.h - 2); });
  },
  animate(p, s) {
    const h = s.e as Horse;
    const stand = clamp(ease(p, 'body', 'stand', h.standAnim, 0.8, s)); // standAnim só muda por tick: suaviza entre frames
    const eat = ease(p, 'body', 'eat', h.eatingHay > 0 ? 1 : 0, 0.3, s);
    const ridden = h.passenger != null;
    const amp = ridden ? 1.3 : 1;
    const amt = s.amount * (1 - stand);
    head(p, s, 'head', (1 - eat) * (1 - stand * 0.5));
    // passo/galope: pares diagonais; joelhos dobram na fase em que a pata avança
    const ph = s.swing * C;
    const la = Math.cos(ph) * 1.1 * amp * amt, lb = -la;
    p.legFR.rotation.x += la; p.legBL.rotation.x += la;
    p.legFL.rotation.x += lb; p.legBR.rotation.x += lb;
    const ka = Math.max(0, Math.sin(ph)) * amt * amp, kb = Math.max(0, -Math.sin(ph)) * amt * amp;
    p.legFRlow.rotation.x += ka * 1.2; p.legFLlow.rotation.x += kb * 1.2;
    p.legBLlow.rotation.x += ka * 0.6; p.legBRlow.rotation.x += kb * 0.6;
    p.head.rotation.x += Math.sin(ph * 2) * 0.05 * amt;
    if (ridden) { p.body.rotation.x += Math.sin(ph * 2) * 0.05 * amt; p.body.position.y += Math.abs(Math.sin(ph)) * 0.9 / 16 * amt; }
    // empinar: gira no quadril; traseiras de pé; dianteiras dobradas pedalando
    if (stand > 0) {
      const a = 45 * DEG * stand, paw = Math.sin(s.t * 0.7) * 0.35 * stand;
      p.body.rotation.x -= a;
      p.legBR.rotation.x += a; p.legBL.rotation.x += a;
      p.legFR.rotation.x += -a + paw; p.legFL.rotation.x += -a - paw;
      p.legFRlow.rotation.x += 1.4 * stand; p.legFLlow.rotation.x += 1.4 * stand;
      p.head.rotation.x += 22 * DEG * stand;
      p.tail.rotation.x += 35 * DEG * stand;
    }
    // comer feno: pescoço desce até o chão, cara na vertical, mastigando
    if (eat > 0) {
      p.head.rotation.x += 100 * DEG * eat;
      p.head.position.y -= 3 / 16 * eat;
      p.skull.rotation.x += (-55 * DEG + Math.sin(s.t * 0.9) * 0.08) * eat;
    }
    // ócio: rabo espanta mosca, orelhas giram
    const swish = Math.max(0, Math.sin(s.t * 0.05 + 2)) ** 3;
    p.tail.rotation.z += Math.sin(s.t * 0.4) * 0.35 * swish;
    p.tail.rotation.x += Math.max(0, Math.cos(ph)) * 0.25 * amt * amp;
    p.tailHair.rotation.x += Math.sin(s.t * 0.4 - 0.8) * 0.1 * swish + 0.15 * amt * amp;
    p.tailEnd.rotation.z += Math.sin(s.t * 0.4 - 1.4) * 0.3 * swish;
    const tw = Math.max(0, Math.sin(s.t * 0.08 + 1) - 0.94) * 8;
    p.earR.rotation.y += Math.sin(s.t * 1.2) * tw * 0.3;
    p.earL.rotation.x += Math.sin(s.t * 0.03) * 0.12;
    // potro: pernas compridas (o corpo sobe para os cascos tocarem o chão)
    if (h.isBaby) {
      for (const l of ['legFR', 'legFL', 'legBR', 'legBL']) p[l].scale.y = 1.3;
      p.body.position.y += 3.9 / 16;
    }
  },
};

export const SPECS_ANIMAIS3: Record<string, MobModelSpec> = {
  horse: {
    def: HORSE, babyHead: 1,
    variant: (e) => `${(e as Horse).coat}|${(e as Horse).marks}`,
    pose(inst, e) {
      inst.parts.saddle.visible = !!(e as Horse).saddled && !e.isBaby;
      if (e.isBaby) inst.parts.skull.scale.setScalar(1.35);
    },
  },
};
