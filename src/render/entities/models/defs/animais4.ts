/**
 * Grupo ANIMAIS (4/4): lobo-guará (o "lobo" do Lavra) e gato doméstico.
 * Lobo-guará: pelagem laranja-avermelhada, pernas longas e finas de "meias" pretas, crina preta na nuca e no dorso,
 * orelhas grandes com interior claro, focinho preto, garganta e ponta da cauda brancas. Filhote escuro (como na
 * natureza: nasce quase preto e fica ruivo depois). Senta, pede comida inclinando a cabeça, sacode a água, eriça
 * a crina e levanta a cauda quando caça; coleira colorida quando domado.
 * Gato: oito pelagens (malhado, preto, branco de olhos bicolores, laranja, siamês, frajola, cinza, rajado), senta
 * com o rabo no chão, coleira com guizo quando domado; filhote de cabeçona.
 */
import type { ModelDef, Parts, AnimState } from '../boxmodel';
import { head, quadLegs } from '../anim';
import type { Face } from '../skin';
import type { MobModelSpec } from '../../mobvisual';
import type { Wolf, Cat } from '../../../../game/entity/species/tamables';
import { DEG, clamp, ease, blotch, speckle, dk, mix, topShade, clothRgb } from './animais_base';

/**
 * Senta um quadrúpede cujo corpo é a raiz (pivô no quadril): o corpo inclina e desce, as dianteiras (filhas do
 * corpo) voltam à vertical, as traseiras (partes-raiz) deitam para a frente rente ao chão, cabeça e cauda compensam.
 */
function sit(p: Parts, k: number, o: { tilt: number; drop: number; hindDrop: number; hindZ: number; hindLen: number; head: number; tail: number }): void {
  if (k <= 0) return;
  const t = o.tilt * DEG * k;
  p.body.rotation.x -= t;
  p.body.position.y -= o.drop / 16 * k;
  p.legFR.rotation.x += t; p.legFL.rotation.x += t;
  for (const n of ['legBR', 'legBL']) {
    p[n].rotation.x -= 90 * DEG * k;
    p[n].position.y -= o.hindDrop / 16 * k;
    p[n].position.z += o.hindZ / 16 * k;
    p[n].scale.y = 1 - (1 - o.hindLen) * k;
  }
  p.head.rotation.x += o.head * DEG * k;
  p.tail.rotation.x += o.tail * DEG * k;
}

/** Coleira: tira na cor de tingimento com fivela. */
function collarFace(g: Face, id: string): void {
  const c = clothRgb(id || 'red');
  g.noise(c, 0.05);
  g.rect(0, 0, g.w, 1, dk(c, 0.75));
  if (g.name === 'front') g.rect(g.w / 2 - 1, 0, 2, g.h, 0xc9b27a);
}

// ================================================================== lobo-guará
interface ManedPal { coat: number; light: number; dark: number; belly: number; black: number; white: number }
const MANED: ManedPal = { coat: 0xbd5220, light: 0xd4733a, dark: 0x953c14, belly: 0xd08a52, black: 0x33241f, white: 0xe6dfd2 };
const MANED_PUP: ManedPal = { coat: 0x4c3b34, light: 0x5f4a40, dark: 0x382a25, belly: 0x5c4a42, black: 0x2a2123, white: 0xd8d0c4 };
const W_EYE = 0xd89a2c, W_PUPIL = 0x1e1614;

export const WOLF: ModelDef = {
  id: 'wolf',
  parts: [
    {
      name: 'body', pivot: [0, 9, -4],
      cubes: [{ o: [-2.5, 8, -5.5], s: [5, 4, 11] }, { id: 'chest', o: [-2, 7, 1.5], s: [4, 1, 4] }],
      children: [
        { name: 'mane', pivot: [0, 12, 2], cubes: [{ o: [-1, 12, -1], s: [2, 1, 6] }] },
        {
          name: 'head', pivot: [0, 11, 5],
          cubes: [
            { o: [-2, 12, 5.5], s: [4, 4, 4] },
            { id: 'neck', o: [-1.5, 9.5, 4], s: [3, 5, 3] },
            { id: 'snout', o: [-1, 12, 9.5], s: [2, 2, 3] },
          ],
          children: [
            { name: 'earR', pivot: [-1.5, 16, 7], rot: [-6, 0, 10], cubes: [{ o: [-2.5, 16, 6.5], s: [2, 4, 1] }] },
            { name: 'earL', pivot: [1.5, 16, 7], rot: [-6, 0, -10], cubes: [{ o: [0.5, 16, 6.5], s: [2, 4, 1], mirror: true, skinOf: 'earR' }] },
            { name: 'collar', pivot: [0, 11, 5.5], cubes: [{ o: [-1.5, 10.5, 4], s: [3, 1, 3], inflate: 0.35 }] },
          ],
        },
        { name: 'legFR', pivot: [-1.5, 9, 3.5], cubes: [{ o: [-2.5, 0, 2.5], s: [2, 9, 2] }] },
        { name: 'legFL', pivot: [1.5, 9, 3.5], cubes: [{ o: [0.5, 0, 2.5], s: [2, 9, 2], mirror: true, skinOf: 'legFR' }] },
        { name: 'tail', pivot: [0, 11.5, -5.5], rot: [32, 0, 0], cubes: [{ o: [-1, 4.5, -6.5], s: [2, 7, 2], inflate: 0.45 }] },
      ],
    },
    {
      name: 'legBR', pivot: [-1.5, 9, -4],
      cubes: [{ o: [-3, 5.5, -5.5], s: [3, 4, 3] }, { id: 'shankB', o: [-2.5, 0, -5], s: [2, 7, 2] }],
    },
    {
      name: 'legBL', pivot: [1.5, 9, -4],
      cubes: [{ o: [0, 5.5, -5.5], s: [3, 4, 3], mirror: true, skinOf: 'legBR' }, { o: [0.5, 0, -5], s: [2, 7, 2], mirror: true, skinOf: 'shankB' }],
    },
  ],
  paint(sk, variant) {
    const [age, collar] = variant.split('|');
    const c = age === 'pup' ? MANED_PUP : MANED;
    const coat = (g: Face) => g.fur(c.coat, c.dark, c.light, 0.25);
    const blackHair = (g: Face) => { g.noise(c.black, 0.08); for (let x = 0; x < g.w; x++) if (g.r() < 0.4) g.rect(x, 0, 1, g.h, g.r() < 0.5 ? dk(c.black, 0.8) : mix(c.black, c.coat, 0.2)); };
    sk.cube('body', (g, f) => {
      coat(g);
      if (f === 'bottom') g.noise(c.belly, 0.06);
      if (f === 'top') { // crina preta descendo pela espinha (y 0 = traseira)
        for (let y = Math.floor(g.h * 0.3); y < g.h; y++) { const hw = 1 + Math.round((y / g.h) * 2 + g.r() * 0.8); g.rect(g.w / 2 - hw, y, hw * 2, 1, c.black); }
      }
      if (f === 'left' || f === 'right') for (let x = 0; x < g.w; x++) { const n = 2 + Math.floor(g.r() * 2); g.rect(x, g.h - n, 1, n, c.belly); }
    });
    sk.cube('chest', (g) => g.fur(c.belly, c.dark, c.light, 0.2));
    sk.cube('mane', (g, f) => { blackHair(g); if (f !== 'top' && f !== 'bottom') for (let x = 0; x < g.w; x++) if (g.r() < 0.5) g.clear(x, 0); });
    sk.cube('neck', (g, f) => {
      coat(g);
      if (f === 'back') blackHair(g);
      if (f === 'front' || f === 'bottom') g.fur(c.white, dk(c.white, 0.88), 0xf4f0ea, 0.3);
      if (f === 'left' || f === 'right') { const fx = f === 'left' ? 0 : g.w - 2; g.rect(fx, 2, 2, g.h - 2, c.white); const bx = f === 'left' ? g.w - 2 : 0; g.rect(bx, 0, 2, g.h, c.black); }
    });
    sk.cube('head', (g, f) => {
      coat(g);
      if (f === 'front') {
        g.rect(0, 5, 2, 3, c.white); g.rect(g.w - 2, 5, 2, 3, c.white);
        for (const ex of [0, g.w - 2]) { g.rect(ex, 2, 2, 2, W_EYE); g.px(ex === 0 ? 1 : g.w - 2, 2, W_PUPIL); g.px(ex === 0 ? 1 : g.w - 2, 3, W_PUPIL); g.rect(ex, 1, 2, 1, c.dark); }
        g.rect(2, 2, 4, 2, mix(c.coat, c.black, 0.35));
      }
      if (f === 'left' || f === 'right') {
        const L = f === 'left', fx = L ? 0 : g.w - 2;
        g.rect(fx, 2, 2, 2, W_EYE); g.px(L ? 0 : g.w - 1, 2, W_PUPIL); g.px(L ? 0 : g.w - 1, 3, W_PUPIL); g.rect(fx, 1, 2, 1, c.dark);
        g.rect(L ? 0 : g.w - 5, 5, 5, 3, c.white);
      }
      if (f === 'bottom') g.noise(c.white, 0.05);
    });
    sk.cube('snout', (g, f) => {
      g.noise(c.black, 0.08);
      if (f === 'top') g.rect(0, 0, g.w, 2, mix(c.black, c.coat, 0.35));
      if (f === 'front') { g.rect(0, 0, g.w, 2, dk(c.black, 0.7)); g.px(1, 1, 0x4a3a3a); g.px(2, 1, 0x4a3a3a); }
      if (f === 'bottom') g.noise(c.white, 0.05);
      if ((f === 'left' || f === 'right')) g.rect(0, g.h - 1, g.w, 1, c.white);
    });
    sk.cube('earR', (g, f) => {
      coat(g);
      if (f === 'front') { g.rect(1, 1, 2, g.h - 1, c.white); g.px(1, 1, dk(c.white, 0.85)); }
      if (f === 'back') g.rect(0, 0, g.w, 2, c.dark);
      if (f === 'front' || f === 'back') { g.clear(0, 0); g.clear(g.w - 1, 0); }
    });
    sk.cube('collar', (g) => collarFace(g, collar));
    sk.cube('legFR', (g, f) => {
      g.noise(c.black, 0.07);
      if (f !== 'bottom' && f !== 'top') { g.vgrad(c.coat, c.black, 0.06); g.rect(0, 0, g.w, 3, c.coat); g.rect(0, 7, g.w, g.h - 7, c.black); speckle(g, dk(c.black, 0.8), 0.05); topShade(g, 2, 0.85); }
      if (f === 'front') g.rect(0, g.h - 1, g.w, 1, dk(c.black, 0.7));
    });
    sk.cube('legBR', (g, f) => { coat(g); if (f !== 'top' && f !== 'bottom') { g.rect(0, g.h - 3, g.w, 3, mix(c.coat, c.black, 0.6)); } });
    sk.cube('shankB', (g, f) => { g.noise(c.black, 0.07); if (f === 'front') g.rect(0, g.h - 1, g.w, 1, dk(c.black, 0.7)); });
    sk.cube('tail', (g, f) => {
      g.fur(c.coat, c.dark, c.light, 0.45);
      if (f === 'bottom') { g.fill(c.white); return; }
      if (f !== 'top') { for (let x = 0; x < g.w; x++) { const n = 4 + Math.floor(g.r() * 2); g.rect(x, g.h - n, 1, n, c.white); } g.rect(0, 0, g.w, 3, dk(c.coat, 0.85)); }
    });
  },
  animate(p, s) {
    const w = s.e as Wolf;
    const sitK = ease(p, 'body', 'sit', w.sitting ? 1 : 0, 0.3, s);
    const beg = ease(p, 'head', 'beg', w.begging ? 1 : 0, 0.25, s);
    const angry = ease(p, 'tail', 'angry', w.target ? 1 : 0, 0.25, s);
    const walk = 1 - sitK;
    head(p, s);
    quadLegs(p, s, undefined, 1.3 * walk);
    // cauda: balança (mais animada quando domado), sobe e crina eriça quando caça
    const wag = w.tame ? 0.35 : 0.14;
    p.tail.rotation.y += Math.sin(s.t * (w.tame ? 0.55 : 0.22)) * wag + Math.cos(s.swing * 0.6662) * 0.3 * s.amount;
    p.tail.rotation.x += angry * 60 * DEG + s.amount * 12 * DEG;
    if (angry > 0) p.mane.scale.set(1 + 0.2 * angry, 1 + 1.8 * angry, 1);
    // pedir comida: cabeça tombada; orelhas atentas que giram de vez em quando
    p.head.rotation.z += 0.42 * beg;
    const tw = Math.max(0, Math.sin(s.t * 0.09 + 0.7) - 0.94) * 8;
    p.earR.rotation.y += Math.sin(s.t * 1.3) * tw * 0.3;
    p.earL.rotation.x -= angry * 0.35; p.earR.rotation.x -= angry * 0.35;
    // sacudir a água: o corpo chacoalha e a cabeça vai no contratempo
    const shk = clamp((w.shake - s.alpha) / 4);
    if (shk > 0) {
      p.body.rotation.z += Math.sin(s.t * 2.4) * 0.28 * shk;
      p.head.rotation.z -= Math.sin(s.t * 2.4 + 0.6) * 0.35 * shk;
      p.tail.rotation.z += Math.sin(s.t * 2.4 + 1.2) * 0.5 * shk;
    }
    sit(p, sitK, { tilt: 40, drop: 4.8, hindDrop: 7.5, hindZ: -1.8, hindLen: 0.7, head: 32, tail: 62 });
    // respiração ofegante quando parado
    p.head.position.y += Math.sin(s.t * 0.5) * 0.08 / 16 * (1 - s.amount);
  },
};

// ================================================================== gato
interface CatPal {
  base: number; dark: number; light: number; belly: number; eyeL: number; eyeR: number; nose: number;
  stripes?: number; patches?: number[]; points?: number; tux?: number;
}
const CAT_PAL: Record<string, CatPal> = {
  malhado: { base: 0xe0d9ce, dark: 0xc2baae, light: 0xefebe4, belly: 0xeae6e0, eyeL: 0xc4ae2e, eyeR: 0xc4ae2e, nose: 0xd8989a, patches: [0xc8752e, 0x3a3230] },
  preto: { base: 0x362c2a, dark: 0x251e1d, light: 0x4c403d, belly: 0x3c3230, eyeL: 0xc6c032, eyeR: 0xc6c032, nose: 0x3c3234 },
  branco: { base: 0xe2ded7, dark: 0xc6c0b8, light: 0xf2f0ec, belly: 0xeceae6, eyeL: 0x4f8ed6, eyeR: 0xd8a030, nose: 0xe0a0a4 },
  laranja: { base: 0xc6722e, dark: 0xa25820, light: 0xda924e, belly: 0xe4b684, eyeL: 0xd8a030, eyeR: 0xd8a030, nose: 0xd88a86, stripes: 0x9c4e1a },
  siames: { base: 0xdacfb9, dark: 0xc2b49c, light: 0xe8e0d0, belly: 0xe4dccb, eyeL: 0x4a86d8, eyeR: 0x4a86d8, nose: 0x3e2e28, points: 0x4b372c },
  frajola: { base: 0x362c2a, dark: 0x251e1d, light: 0x4c403d, belly: 0xe4e0da, eyeL: 0x98be40, eyeR: 0x98be40, nose: 0xd8989a, tux: 0xe4e0da },
  cinza: { base: 0x787c84, dark: 0x5e626a, light: 0x989ea6, belly: 0xa4a8ae, eyeL: 0xd6942c, eyeR: 0xd6942c, nose: 0x6a6268 },
  rajado: { base: 0x887560, dark: 0x685844, light: 0xa69278, belly: 0xc6b69a, eyeL: 0x96b636, eyeR: 0x96b636, nose: 0xc6887f, stripes: 0x3c3024 },
};
const BELL = 0xd8b440;

/** Pelo do gato com listras (rajado/laranja) verticais nos flancos e transversais no dorso, e manchas (malhado). */
function catFur(g: Face, c: CatPal, f: string, flank: boolean): void {
  g.fur(c.base, c.dark, c.light, 0.3);
  if (c.stripes && f !== 'bottom') {
    if (flank && (f === 'left' || f === 'right')) for (let x = 1 + Math.floor(g.r() * 2); x < g.w; x += 4) for (let y = 0; y < g.h * 0.75; y++) g.px(x + Math.round(Math.sin(y * 0.9 + x) * 0.6), y, c.stripes);
    else g.stripes(c.stripes, 4, 1, 1);
  }
  if (c.patches && f !== 'bottom') for (const pc of c.patches) if (g.r() < 0.8) blotch(g, g.r() * g.w, g.r() * g.h, 2 + g.r() * 3, pc);
}

export const CAT: ModelDef = {
  id: 'cat',
  parts: [
    {
      name: 'body', pivot: [0, 5, -6],
      cubes: [{ o: [-2, 5, -6], s: [4, 4, 11] }],
      children: [
        {
          name: 'head', pivot: [0, 8, 5],
          cubes: [
            { o: [-2.5, 7, 4.5], s: [5, 4, 4] },
            { id: 'muzzle', o: [-1.5, 7, 8.5], s: [3, 2, 1] },
          ],
          children: [
            { name: 'earR', pivot: [-1.5, 11, 6.5], cubes: [{ o: [-2.5, 11, 6], s: [2, 1, 1] }, { id: 'earRtip', o: [-2.5, 12, 6], s: [1, 1, 1] }] },
            { name: 'earL', pivot: [1.5, 11, 6.5], cubes: [{ o: [0.5, 11, 6], s: [2, 1, 1], mirror: true, skinOf: 'earR' }, { o: [1.5, 12, 6], s: [1, 1, 1], mirror: true, skinOf: 'earRtip' }] },
            { name: 'collar', pivot: [0, 7, 5], cubes: [{ o: [-2, 6.5, 4], s: [4, 1, 2], inflate: 0.3 }, { id: 'bell', o: [-0.5, 5.5, 5.5], s: [1, 1, 1] }] },
          ],
        },
        { name: 'legFR', pivot: [-1, 6, 3.5], cubes: [{ o: [-2, 0, 2.5], s: [2, 6, 2] }] },
        { name: 'legFL', pivot: [1, 6, 3.5], cubes: [{ o: [0, 0, 2.5], s: [2, 6, 2], mirror: true, skinOf: 'legFR' }] },
        {
          name: 'tail', pivot: [0, 8.5, -6], rot: [42, 0, 0], cubes: [{ o: [-0.5, 2.5, -6.5], s: [1, 6, 1], inflate: 0.2 }],
          children: [{ name: 'tailTip', pivot: [0, 2.5, -6], rot: [42, 0, 0], cubes: [{ o: [-0.5, -3.5, -6.5], s: [1, 6, 1], inflate: 0.2 }] }],
        },
      ],
    },
    { name: 'legBR', pivot: [-1, 6, -4], cubes: [{ o: [-2, 3, -5.5], s: [2, 4, 3] }, { id: 'pawB', o: [-2, 0, -5], s: [2, 3, 2] }] },
    { name: 'legBL', pivot: [1, 6, -4], cubes: [{ o: [0, 3, -5.5], s: [2, 4, 3], mirror: true, skinOf: 'legBR' }, { o: [0, 0, -5], s: [2, 3, 2], mirror: true, skinOf: 'pawB' }] },
  ],
  paint(sk, variant) {
    const [vid, collar] = variant.split('|');
    const c = CAT_PAL[vid] ?? CAT_PAL.malhado;
    const pts = c.points, light = c.tux ?? c.belly;
    sk.cube('body', (g, f) => {
      catFur(g, c, f, true);
      if (f === 'bottom') g.noise(light, 0.05);
      if (c.tux) {
        if (f === 'front') g.noise(c.tux, 0.04);
        if (f === 'left' || f === 'right') for (let x = 0; x < g.w; x++) {
          const front = f === 'left' ? x : g.w - 1 - x, n = 2 + Math.floor(g.r() * 2) + (front < 6 ? 3 - Math.floor(front / 2) : 0);
          g.rect(x, g.h - n, 1, n, c.tux);
        }
      }
      if (pts && f === 'top') g.noise(mix(c.base, pts, 0.18), 0.05);
    });
    sk.cube('head', (g, f) => {
      catFur(g, c, f === 'front' ? 'top' : f, false);
      if (f === 'front') {
        if (pts) { g.ellipse(g.w / 2, g.h * 0.72, 3.4, 2.8, mix(c.base, pts, 0.55)); g.ellipse(g.w / 2, g.h * 0.8, 2.2, 1.8, pts); }
        if (c.tux) { g.rect(g.w / 2 - 1, 0, 2, g.h, c.tux); g.rect(2, 5, g.w - 4, 3, c.tux); }
        if (c.stripes) { g.px(3, 0, c.stripes); g.px(4, 1, c.stripes); g.px(5, 1, c.stripes); g.px(6, 0, c.stripes); g.px(4.5, 0, c.stripes); }
        g.rect(1, 1, 3, 1, dk(c.base, 0.8)); g.rect(6, 1, 3, 1, dk(c.base, 0.8));
        for (const [ex, col] of [[1, c.eyeR], [6, c.eyeL]] as const) {
          g.rect(ex, 2, 3, 2, col);
          g.rect(ex + 1, 2, 1, 2, 0x161012);
          g.px(ex, 2, mix(col, 0xffffff, 0.55));
        }
      }
      if (f === 'left' || f === 'right') {
        const fx = f === 'left' ? 0 : g.w - 3;
        g.rect(fx, g.h - 3, 3, 3, pts ?? light);
        if (c.stripes) for (let y = 1; y < g.h - 3; y += 2) g.line(f === 'left' ? 3 : g.w - 4, y, f === 'left' ? 6 : g.w - 7, y + 1, c.stripes);
      }
      if (f === 'bottom') g.noise(pts ?? light, 0.05);
    });
    sk.cube('muzzle', (g, f) => {
      g.noise(pts ?? light, 0.05);
      if (f === 'front') {
        g.rect(2, 0, 2, 1, c.nose); g.px(2, 1, dk(c.nose, 0.85)); g.px(3, 1, dk(c.nose, 0.85));
        const m = dk(pts ?? light, 0.55);
        g.px(1, 2, m); g.px(4, 2, m); g.px(2, 3, m); g.px(3, 3, m);
        g.px(0, 1, 0xf6f2ea); g.px(g.w - 1, 1, 0xf6f2ea); g.px(0, 2, 0xf6f2ea); g.px(g.w - 1, 2, 0xf6f2ea);
      }
    });
    sk.cubes(['earR', 'earRtip'], (g, f, id) => {
      g.fur(pts ?? c.base, c.dark, c.light, 0.2);
      if (c.patches && id === 'earR') g.noise(c.patches[1], 0.06);
      if (f === 'front') { if (id === 'earR') g.rect(1, 0, 2, g.h, 0xd49a98); else g.px(1, 1, 0xd49a98); }
    });
    sk.cubes(['legFR', 'legBR', 'pawB'], (g, f) => {
      catFur(g, c, f, false);
      if (pts && f !== 'top') g.vgrad(mix(c.base, pts, 0.5), pts, 0.05);
      if (c.tux && f !== 'top') g.rect(0, Math.floor(g.h * 0.45), g.w, g.h, c.tux);
      if (f === 'bottom') { g.fill(pts || (c.base < 0x404040 && !c.tux) ? 0x3a3032 : 0xd09090); }
    });
    sk.cubes(['tail', 'tailTip'], (g, f) => {
      g.fur(pts ?? c.base, c.dark, c.light, 0.3);
      if (c.stripes && f !== 'top' && f !== 'bottom') for (let y = 1; y < g.h; y += 3) g.rect(0, y, g.w, 1, c.stripes);
      if (c.patches) g.noise(c.patches[0], 0.06);
    });
    sk.cube('collar', (g) => collarFace(g, collar));
    sk.cube('bell', (g, f) => { g.fill(BELL); g.px(0, 0, mix(BELL, 0xffffff, 0.5)); if (f === 'bottom' || f === 'front') g.px(1, 1, dk(BELL, 0.45)); });
  },
  animate(p, s) {
    const ct = s.e as Cat;
    const sitK = ease(p, 'body', 'sit', ct.sitting ? 1 : 0, 0.3, s);
    const walk = 1 - sitK;
    head(p, s);
    quadLegs(p, s, undefined, 1.2 * walk);
    // cauda: balanço lento e pontinha inquieta; erguida ao andar
    p.tail.rotation.z += Math.sin(s.t * 0.08) * 0.18 * walk;
    p.tail.rotation.x += s.amount * 85 * DEG;
    p.tailTip.rotation.x += Math.sin(s.t * 0.13) * 0.25 - s.amount * 20 * DEG;
    p.tailTip.rotation.z += Math.sin(s.t * 0.21 + 1) * 0.2;
    const tw = Math.max(0, Math.sin(s.t * 0.1 + 2.2) - 0.94) * 8;
    p.earL.rotation.y -= Math.sin(s.t * 1.5) * tw * 0.35;
    // sentado: rabo deitado no chão, enrolando de lado
    sit(p, sitK, { tilt: 35, drop: 5.2, hindDrop: 4.5, hindZ: -0.8, hindLen: 0.8, head: 30, tail: 55 });
    if (sitK > 0) { p.tailTip.rotation.x -= 60 * DEG * sitK; p.tail.rotation.y += 50 * DEG * sitK; }
  },
};

export const SPECS_ANIMAIS4: Record<string, MobModelSpec> = {
  wolf: {
    def: WOLF, babyHead: 1.45,
    variant: (e) => `${e.isBaby ? 'pup' : 'adult'}|${(e as Wolf).tame ? (e as Wolf).collar : ''}`,
    pose(inst, e) { inst.parts.collar.visible = (e as Wolf).tame; },
  },
  cat: {
    def: CAT, babyHead: 1.6,
    variant: (e) => `${(e as Cat).variant}|${(e as Cat).tame ? (e as Cat).collar : ''}`,
    pose(inst, e) { inst.parts.collar.visible = (e as Cat).tame; },
  },
};
