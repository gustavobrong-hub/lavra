/**
 * Grupo ANIMAIS (2/4): galinha d'angola, tapiti (coelho) e musgarto.
 * Galinha d'angola: corpo redondo cinza-ardósia com pintas brancas, cabeça pelada azul-clara com capacete ósseo e
 * barbelas vermelhas. Tapiti: orelhas longas, patas traseiras grandes, pulo com o corpo inclinado. Musgarto
 * (criatura do Lavra): lagarto-tartaruga de casco baixo de placas, manta de musgo florido, se esconde no casco.
 */
import type { ModelDef } from '../boxmodel';
import { head, quadLegs } from '../anim';
import type { Face } from '../skin';
import type { MobModelSpec } from '../../mobvisual';
import type { Chicken, Rabbit, Musgarto } from '../../../../game/entity/species/animals';
import { C, DEG, clamp, ease, dots, speckle, blotch, dk, mix, topShade } from './animais_base';

// ================================================================== galinha d'angola
const G_PLUM = 0x4a4a52, G_PLUM_D = 0x36363d, G_DOT = 0xeceef4, G_NECK = 0x3b3442, G_SKIN = 0x93c6dc, G_SKIN_L = 0xc4e2ee;
const G_CASQUE = 0xb46f3c, G_WATTLE = 0xc4302a, G_BEAK = 0xd49c6a, G_LEG = 0x6e7280, G_EYE = 0x2a1a16;

/** Plumagem pintada: base ardósia, pintas brancas em grade escalonada. */
function guineaPlumage(g: Face, every = 3): void {
  g.noise(G_PLUM, 0.07);
  speckle(g, G_PLUM_D, 0.08);
  dots(g, G_DOT, every, 0.6);
}

export const CHICKEN: ModelDef = {
  id: 'chicken',
  parts: [
    {
      name: 'body', pivot: [0, 6, 0],
      cubes: [
        { o: [-3, 3, -4], s: [6, 4, 8] },
        { id: 'dome', o: [-2.5, 7, -3.5], s: [5, 1, 7] },
        { id: 'crown', o: [-2, 8, -2.5], s: [4, 1, 5] },
        { id: 'keel', o: [-2, 2, -2.5], s: [4, 1, 5] },
        { id: 'rump', o: [-2, 3.5, -6], s: [4, 3, 2] },
      ],
      children: [
        { name: 'wingR', pivot: [-3, 7, 1], cubes: [{ o: [-4, 3, -3.5], s: [1, 4, 6] }] },
        { name: 'wingL', pivot: [3, 7, 1], cubes: [{ o: [3, 3, -3.5], s: [1, 4, 6], mirror: true, skinOf: 'wingR' }] },
      ],
    },
    {
      name: 'head', pivot: [0, 7, 3.5],
      cubes: [
        { o: [-1.5, 10, 3.5], s: [3, 3, 3] },
        { id: 'neck', o: [-1, 6, 3], s: [2, 5, 2] },
        { id: 'beak', o: [-1, 10.5, 6.5], s: [2, 1, 1] },
        { id: 'wattleR', o: [-1.5, 9, 5.5], s: [1, 2, 1] },
        { id: 'wattleL', o: [0.5, 9, 5.5], s: [1, 2, 1], mirror: true, skinOf: 'wattleR' },
      ],
      children: [{ name: 'casque', pivot: [0, 13, 5], rot: [-18, 0, 0], cubes: [{ o: [-0.5, 12.5, 4.5], s: [1, 2, 1] }] }],
    },
    {
      name: 'legR', pivot: [-1.5, 3, 0],
      cubes: [
        { o: [-2, 0, -0.5], s: [1, 3, 1] },
        { id: 'footR', o: [-3, 0.1, -1], s: [3, 0, 3], skip: ['bottom'] },
      ],
    },
    {
      name: 'legL', pivot: [1.5, 3, 0],
      cubes: [
        { o: [1, 0, -0.5], s: [1, 3, 1], mirror: true, skinOf: 'legR' },
        { o: [0, 0.1, -1], s: [3, 0, 3], skip: ['bottom'], mirror: true, skinOf: 'footR' },
      ],
    },
  ],
  paint(sk) {
    sk.cube('body', (g, f) => {
      guineaPlumage(g);
      if (f === 'bottom') g.noise(G_PLUM_D, 0.06);
      if (f === 'front') g.rect(0, 0, g.w, 3, G_NECK);
    });
    sk.cubes(['dome', 'crown', 'rump', 'keel'], (g) => guineaPlumage(g));
    sk.cube('wingR', (g, f) => {
      g.noise(dk(G_PLUM, 0.92), 0.06);
      if (f === 'left' || f === 'right') {
        g.rect(0, 0, g.w, 1, dk(G_PLUM, 0.75));
        // fileiras de pintas (barras das asas) e bordas das rêmiges
        for (let y = 1; y < g.h - 1; y += 2) for (let x = (y % 4 === 1 ? 1 : 2); x < g.w - 1; x += 3) g.px(x, y, G_DOT);
        g.rect(0, g.h - 1, g.w, 1, G_PLUM_D);
        for (let x = 0; x < g.w; x += 2) g.px(x, g.h - 2, dk(G_PLUM, 0.8));
      }
      if (f === 'top') g.noise(G_PLUM_D, 0.05);
    });
    sk.cube('neck', (g, f) => {
      // pescoço: penugem escura embaixo, pele azulada em cima
      g.noise(G_NECK, 0.08);
      if (f !== 'bottom') { g.rect(0, 0, g.w, 2, G_SKIN); for (let x = 0; x < g.w; x += 2) g.px(x, 2, G_SKIN); }
    });
    sk.cube('head', (g, f) => {
      g.noise(G_SKIN, 0.06);
      if (f === 'left' || f === 'right') {
        // bochecha clara, olho escuro com anel, mancha vermelha no canto do bico
        const fx = f === 'left' ? 0 : g.w - 1, d = f === 'left' ? 1 : -1;
        g.rect(f === 'left' ? 0 : g.w - 4, 3, 4, 3, G_SKIN_L);
        g.px(fx + d * 1, 1, G_EYE); g.px(fx + d * 2, 1, G_EYE); g.px(fx + d * 1, 2, G_EYE); g.px(fx + d * 2, 2, dk(G_EYE, 0.8));
        g.px(fx + d * 1, 1, 0x6a5a50);
        g.px(fx, 4, G_WATTLE); g.px(fx, 5, G_WATTLE);
      }
      if (f === 'front') { g.rect(1, 3, g.w - 2, 3, G_SKIN_L); g.px(0, 4, G_WATTLE); g.px(g.w - 1, 4, G_WATTLE); }
      if (f === 'top') g.noise(dk(G_SKIN, 0.9), 0.08);
      if (f === 'back') g.rect(0, 3, g.w, 3, dk(G_SKIN, 0.9));
    });
    sk.cube('casque', (g, f) => { g.vgrad(mix(G_CASQUE, 0xffffff, 0.2), G_CASQUE, 0.06); if (f === 'top') g.noise(dk(G_CASQUE, 0.9), 0.05); });
    sk.cube('beak', (g, f) => { g.noise(G_BEAK, 0.05); if (f === 'front') g.px(0, 1, dk(G_BEAK, 0.7)); if (f === 'bottom') g.fill(dk(G_BEAK, 0.85)); });
    sk.cube('wattleR', (g) => { g.noise(G_WATTLE, 0.08); g.rect(0, 0, g.w, 1, 0x6f9fc0); });
    sk.cube('legR', (g, f) => { g.noise(G_LEG, 0.06); if (f !== 'top' && f !== 'bottom') for (let y = 1; y < g.h; y += 2) g.px(g.r() * g.w, y, dk(G_LEG, 0.8)); });
    sk.cube('footR', (g, f) => {
      // três dedos para a frente e um para trás (recorte por alfa)
      g.clear(0, 0, g.w, g.h);
      if (f !== 'top') return;
      // no topo, a linha 0 é a traseira (z mínimo) e a última é a frente
      g.rect(2, 0, 2, g.h, G_LEG);
      g.line(0, g.h - 1, 2, g.h - 4, G_LEG); g.line(5, g.h - 1, 3, g.h - 4, G_LEG);
      g.px(0, g.h - 1, dk(G_LEG, 0.7)); g.px(2, g.h - 1, dk(G_LEG, 0.7)); g.px(5, g.h - 1, dk(G_LEG, 0.7));
    });
  },
  animate(p, s) {
    const c = s.e as Chicken;
    const idle = 1 - s.amount;
    head(p, s);
    // bica o chão de vez em quando; no passo, a cabeça vai e volta
    const peck = Math.max(0, Math.sin(s.t * 0.07 + 1.3) - 0.9) * 10 * idle;
    p.head.rotation.x += peck * 0.75;
    p.head.position.z += Math.sin(s.swing * C * 2) * 0.6 / 16 * s.amount;
    p.legR.rotation.x += Math.cos(s.swing * C) * 1.4 * s.amount;
    p.legL.rotation.x += Math.cos(s.swing * C + Math.PI) * 1.4 * s.amount;
    // asas: (sen(flap) + 1) × flapSpeed, interpolados
    const fl = c.prevFlap + (c.flap - c.prevFlap) * s.alpha;
    const fs = c.prevFlapSpeed + (c.flapSpeed - c.prevFlapSpeed) * s.alpha;
    const v = (Math.sin(fl) + 1) * fs;
    p.wingL.rotation.z += v;
    p.wingR.rotation.z -= v;
    // respiração
    p.body.position.y += Math.sin(s.t * 0.1) * 0.12 / 16 * idle;
  },
};

// ================================================================== tapiti (coelho)
interface RabbitPal { base: number; dark: number; light: number; belly: number; eye: number; tail: number; patch?: number; salt?: boolean }
const RABBIT_PAL: Record<string, RabbitPal> = {
  brown: { base: 0x7b583c, dark: 0x54402b, light: 0x9f7955, belly: 0xcdbb9e, eye: 0x2a1c16, tail: 0xe2d8c6 },
  white: { base: 0xdcd6cc, dark: 0xbdb5aa, light: 0xeeeae4, belly: 0xe8e4de, eye: 0xb3303e, tail: 0xf0ece6 },
  black: { base: 0x40332e, dark: 0x2c231f, light: 0x574740, belly: 0x4e403a, eye: 0x5a3420, tail: 0x625550 },
  splotched: { base: 0xdcd6cc, dark: 0xbdb5aa, light: 0xeeeae4, belly: 0xe8e4de, eye: 0x2a1c16, tail: 0xf0ece6, patch: 0x40332e },
  gold: { base: 0xc99a52, dark: 0xa27638, light: 0xdcb676, belly: 0xeadab0, eye: 0x2a1c16, tail: 0xf0e4ca },
  salt: { base: 0x7a6c60, dark: 0x4c4239, light: 0x9a8c80, belly: 0xc4b9ac, eye: 0x2a1c16, tail: 0xdcd4c8, salt: true },
};
const R_PINK = 0xd99a98, R_NOSE = 0xc9787c;

function rabbitFur(g: Face, pal: RabbitPal): void {
  g.fur(pal.base, pal.dark, pal.light, 0.35);
  if (pal.salt) { speckle(g, 0xe4ded4, 0.14); speckle(g, 0x3a322c, 0.08); }
}

export const RABBIT: ModelDef = {
  id: 'rabbit',
  parts: [{
    name: 'body', pivot: [0, 3, -2],
    cubes: [
      { o: [-2.5, 2, -4], s: [5, 4, 7] },
      { id: 'hunch', o: [-2, 6, -3.5], s: [4, 1, 5] },
    ],
    children: [
      {
        name: 'head', pivot: [0, 5.5, 2.5],
        cubes: [{ o: [-2, 4, 2.5], s: [4, 4, 4] }],
        children: [
          { name: 'nose', pivot: [0, 5, 6.5], cubes: [{ o: [-1, 4.5, 6.5], s: [2, 2, 1] }] },
          { name: 'earR', pivot: [-1, 8, 4], rot: [-14, 0, 10], cubes: [{ o: [-2, 8, 3.5], s: [2, 5, 1] }] },
          { name: 'earL', pivot: [1, 8, 4], rot: [-14, 0, -10], cubes: [{ o: [0, 8, 3.5], s: [2, 5, 1], mirror: true, skinOf: 'earR' }] },
        ],
      },
      { name: 'legFR', pivot: [-1.5, 3, 2], cubes: [{ o: [-2, 0, 1.5], s: [1, 3, 1] }] },
      { name: 'legFL', pivot: [1.5, 3, 2], cubes: [{ o: [1, 0, 1.5], s: [1, 3, 1], mirror: true, skinOf: 'legFR' }] },
      {
        name: 'legBR', pivot: [-2, 4, -2],
        cubes: [{ o: [-3, 1, -4], s: [2, 4, 4] }, { id: 'footBR', o: [-3, 0, -4], s: [2, 1, 5] }],
      },
      {
        name: 'legBL', pivot: [2, 4, -2],
        cubes: [{ o: [1, 1, -4], s: [2, 4, 4], mirror: true, skinOf: 'legBR' }, { o: [1, 0, -4], s: [2, 1, 5], mirror: true, skinOf: 'footBR' }],
      },
      { name: 'tail', pivot: [0, 4.5, -4], cubes: [{ o: [-1, 3.5, -5.5], s: [2, 2, 2] }] },
    ],
  }],
  paint(sk, variant) {
    const pal = RABBIT_PAL[variant] ?? RABBIT_PAL.brown;
    sk.cube('body', (g, f) => {
      rabbitFur(g, pal);
      if (f === 'bottom') g.noise(pal.belly, 0.05);
      if (f === 'left' || f === 'right') for (let x = 0; x < g.w; x++) if (g.r() < 0.7) g.px(x, g.h - 1, pal.belly);
      if (pal.patch && f !== 'bottom') blotch(g, g.r() * g.w, g.r() * g.h, 2.5 + g.r() * 1.5, pal.patch);
    });
    sk.cube('hunch', (g) => { rabbitFur(g, pal); if (pal.patch) blotch(g, g.w / 2, g.h / 2, 2.5, pal.patch); });
    sk.cube('head', (g, f) => {
      rabbitFur(g, pal);
      if (f === 'left' || f === 'right') {
        // olho grande encostado na quina da frente (aparece também de frente)
        const ex = f === 'left' ? 0 : g.w - 2;
        if (pal.patch) g.ellipse(ex + 1, 3, 2.6, 2.4, pal.patch);
        g.rect(f === 'left' ? 0 : g.w - 3, 1, 3, 5, pal.light);
        g.rect(ex, 2, 2, 3, pal.eye);
        g.px(f === 'left' ? ex + 1 : ex, 2, 0xf4ece6);
      }
      if (f === 'front') {
        g.rect(2, 5, 4, 3, pal.belly);
        if (pal.patch) g.rect(3, 2, 2, 3, pal.patch);
        for (const x of [0, g.w - 1]) { g.px(x, 1, pal.light); g.rect(x, 2, 1, 3, pal.eye); }
      }
      if (f === 'bottom') g.noise(pal.belly, 0.05);
    });
    sk.cube('nose', (g, f) => {
      g.noise(pal.belly, 0.05);
      if (f === 'front') { g.rect(1, 0, 2, 1, R_NOSE); g.px(1.5, 1, dk(pal.dark, 0.8)); g.px(1, 2, dk(pal.dark, 0.8)); g.px(2, 2, dk(pal.dark, 0.8)); }
      if (f === 'left' || f === 'right') { g.px(0, 1, 0xf6f2ec); g.px(g.w - 1, 1, 0xf6f2ec); g.px(1, 2, 0xf6f2ec); }
      if (f === 'top') g.rect(0, g.h - 1, g.w, 1, R_NOSE);
    });
    sk.cube('earR', (g, f) => {
      rabbitFur(g, pal);
      if (f === 'front') { g.rect(1, 1, 2, g.h - 2, R_PINK); g.px(1, 1, dk(R_PINK, 0.9)); }
      if (pal.patch && f !== 'front') g.rect(0, 0, g.w, g.h, pal.patch);
      if (!pal.patch && variant !== 'white' && f !== 'front') g.rect(0, 0, g.w, 2, pal.dark);
      g.clear(0, 0); g.clear(g.w - 1, 0);
    });
    sk.cubes(['legFR', 'legBR'], (g, f) => {
      rabbitFur(g, pal);
      if (f !== 'top') topShade(g, 2, 0.85);
      if (f === 'front') g.rect(0, g.h - 2, g.w, 2, pal.light);
    });
    sk.cube('footBR', (g, f) => { rabbitFur(g, pal); if (f === 'bottom') g.noise(pal.belly, 0.05); if (f === 'front') g.fill(pal.light); });
    sk.cube('tail', (g) => { g.fur(pal.tail, dk(pal.tail, 0.88), mix(pal.tail, 0xffffff, 0.3), 0.4); });
  },
  animate(p, s) {
    const r = s.e as Rabbit;
    head(p, s);
    const jumping = r.jumpTicks > 0;
    const j = jumping ? clamp((r.jumpTicks - 1 + s.alpha) / 10) : 0;
    const air = jumping ? Math.sin(j * Math.PI) : 0;
    // impulso: focinho sobe; aterrissagem: focinho desce; traseiras esticam para trás, dianteiras para a frente
    p.body.rotation.x += jumping ? -Math.sin(j * Math.PI * 2) * 0.24 - air * 0.1 : 0;
    p.legBR.rotation.x += air * 1.15; p.legBL.rotation.x += air * 1.15;
    p.legFR.rotation.x -= air * 0.85; p.legFL.rotation.x -= air * 0.85;
    p.earR.rotation.x -= air * 0.45; p.earL.rotation.x -= air * 0.45;
    if (!jumping) quadLegs(p, s, undefined, 0.8);
    // orelhas tremem e giram de vez em quando; nariz fungando
    const tw = Math.max(0, Math.sin(s.t * 0.11 + 0.5) - 0.94) * 8;
    p.earL.rotation.z += Math.sin(s.t * 1.7) * tw * 0.25;
    p.earR.rotation.y += Math.sin(s.t * 0.04) * 0.25;
    p.nose.position.y += (Math.sin(s.t * 1.9) > 0.3 ? 0.2 : 0) / 16;
    p.tail.rotation.x += Math.sin(s.t * 0.3) * 0.08;
  },
};

// ================================================================== musgarto (criatura do Lavra)
const M_SHELL = 0x6a5838, M_SHELL_D = 0x3d3222, M_SHELL_L = 0x8e7852, M_LICHEN = 0x9ca47c, M_PLAST = 0xa8966a;
const M_MOSS = 0x4a7428, M_MOSS_D = 0x30521a, M_MOSS_L = 0x6f9c36;
const M_SKIN = 0x6a6e36, M_SKIN_D = 0x474a24, M_SKIN_L = 0xaea96e, M_EYE = 0xe2aa22, M_PUPIL = 0x241810, M_CLAW = 0xd6caa0;
const FLOWERS = [0xf4f0e2, 0xe890b4, 0xb89ae4, 0xf2d24c];

/** Placas do casco: escudos com juntas escuras, borda iluminada, anel de crescimento e líquen. */
function scutes(g: Face, cw: number, ch: number): void {
  g.noise(M_SHELL, 0.08);
  for (let y = 0, row = 0; y < g.h; y += ch, row++) {
    const off = (row % 2) * Math.floor(cw / 2);
    for (let x = -off; x < g.w; x += cw) {
      g.box(x, y, cw, ch, M_SHELL_D);
      g.line(x + 1, y + 1, x + cw - 2, y + 1, M_SHELL_L);
      if (cw > 5 && ch > 4) g.box(x + 2, y + 2, cw - 4, ch - 4, dk(M_SHELL, 0.86));
    }
  }
  speckle(g, M_LICHEN, 0.025);
}

/** Musgo: tufos claros e escuros, florzinhas miúdas; franja irregular na barra das laterais. */
function mossFace(g: Face, fringe: boolean, flowers: number): void {
  g.noise(M_MOSS, 0.1);
  for (let i = 0; i < g.w * g.h / 5; i++) {
    const x = g.r() * g.w, y = g.r() * g.h, c = g.r() < 0.55 ? M_MOSS_L : M_MOSS_D;
    g.px(x, y, c); if (g.r() < 0.5) g.px(x, y + 1, c);
  }
  for (let i = 0; i < flowers; i++) {
    const x = 1 + Math.floor(g.r() * (g.w - 2)), y = 1 + Math.floor(g.r() * Math.max(1, g.h - 3));
    const c = FLOWERS[Math.floor(g.r() * FLOWERS.length)];
    g.px(x - 1, y, c); g.px(x + 1, y, c); g.px(x, y - 1, c); g.px(x, y + 1, c); g.px(x, y, 0xf2c83a);
  }
  if (fringe) for (let x = 0; x < g.w; x++) { const n = Math.floor(g.r() * 3.2); for (let k = 0; k < n; k++) g.clear(x, g.h - 1 - k); }
}

export const MUSGARTO: ModelDef = {
  id: 'musgarto',
  parts: [{
    name: 'body', pivot: [0, 4, 0],
    cubes: [
      { id: 'shellBase', o: [-6, 3, -7], s: [12, 3, 14] },
      { id: 'shellMid', o: [-5, 6, -6], s: [10, 2, 12] },
      { id: 'shellTop', o: [-4, 8, -5], s: [8, 1, 10] },
      { id: 'plastron', o: [-5, 2, -6], s: [10, 1, 12] },
    ],
    children: [
      {
        name: 'moss', pivot: [0, 4, 0],
        cubes: [
          { id: 'mossRim', o: [-6, 5, -7], s: [12, 1, 14], inflate: 0.3 },
          { id: 'mossMid', o: [-5, 6, -6], s: [10, 2, 12], inflate: 0.45 },
          { id: 'mossTop', o: [-4, 8, -5], s: [8, 1, 10], inflate: 0.45 },
          { id: 'fernA', o: [-3.5, 9.4, -2], s: [3, 3, 0] },
          { id: 'fernB', o: [-2, 9.4, -3.5], s: [0, 3, 3] },
          { id: 'fernC', o: [0.5, 9.4, 2], s: [3, 3, 0], skinOf: 'fernA' },
          { id: 'fernD', o: [2, 9.4, 0.5], s: [0, 3, 3], skinOf: 'fernB' },
          { id: 'bloom1', o: [-1, 10.4, -1.5], s: [1, 1, 1] },
          { id: 'bloom2', o: [2, 10.4, 2], s: [1, 1, 1] },
        ],
      },
      {
        name: 'head', pivot: [0, 5, 6],
        cubes: [
          { o: [-2, 3, 8], s: [4, 3, 4] },
          { id: 'snout', o: [-1.5, 3, 12], s: [3, 2, 2] },
          { id: 'neck', o: [-1.5, 3, 5], s: [3, 3, 3] },
        ],
        children: [{ name: 'tongue', pivot: [0, 3.6, 13], cubes: [{ o: [-0.5, 3.6, 13], s: [1, 0, 3] }] }],
      },
      { name: 'legFR', pivot: [-5, 4, 4.5], cubes: [{ o: [-7, 0, 3], s: [3, 4, 3] }] },
      { name: 'legFL', pivot: [5, 4, 4.5], cubes: [{ o: [4, 0, 3], s: [3, 4, 3], mirror: true, skinOf: 'legFR' }] },
      { name: 'legBR', pivot: [-5, 4, -4.5], cubes: [{ o: [-7, 0, -6], s: [3, 4, 3] }] },
      { name: 'legBL', pivot: [5, 4, -4.5], cubes: [{ o: [4, 0, -6], s: [3, 4, 3], mirror: true, skinOf: 'legBR' }] },
      {
        name: 'tail', pivot: [0, 4, -7], rot: [-6, 0, 0], cubes: [{ o: [-1.5, 2.5, -12], s: [3, 3, 5] }],
        children: [{ name: 'tailTip', pivot: [0, 3.5, -12], cubes: [{ o: [-1, 2.5, -17], s: [2, 2, 5] }] }],
      },
    ],
  }],
  paint(sk) {
    sk.cube('shellBase', (g, f) => {
      if (f === 'top' || f === 'bottom') { scutes(g, 6, 6); return; }
      scutes(g, 5, g.h);
      g.rect(0, g.h - 1, g.w, 1, M_SHELL_D);
    });
    sk.cube('shellMid', (g, f) => scutes(g, f === 'top' ? 7 : 6, f === 'top' ? 6 : g.h));
    sk.cube('shellTop', (g, f) => scutes(g, f === 'top' ? 7 : 5, f === 'top' ? 8 : g.h));
    sk.cube('plastron', (g) => { g.noise(M_PLAST, 0.06); g.line(g.w / 2, 0, g.w / 2, g.h - 1, dk(M_PLAST, 0.75)); for (let y = 5; y < g.h; y += 6) g.line(0, y, g.w - 1, y, dk(M_PLAST, 0.8)); });
    // manta de musgo
    sk.cube('mossRim', (g, f) => mossFace(g, f !== 'top' && f !== 'bottom', 0));
    sk.cube('mossMid', (g, f) => mossFace(g, f !== 'top' && f !== 'bottom', f === 'top' ? 5 : 1));
    sk.cube('mossTop', (g, f) => mossFace(g, false, f === 'top' ? 4 : 0));
    // samambaia: folíolos em escada, recortados por alfa
    sk.cubes(['fernA', 'fernB'], (g) => {
      g.clear(0, 0, g.w, g.h);
      const mid = g.w / 2 - 0.5;
      for (let y = 0; y < g.h; y++) {
        const half = Math.max(0, Math.floor((y / g.h) * (g.w / 2)) + (y % 2));
        g.rect(mid - half, y, half * 2 + 1, 1, y % 2 ? M_MOSS_L : 0x5c8a2e);
      }
      g.rect(mid, 0, 1, g.h, M_MOSS_D);
    });
    sk.cubes(['bloom1', 'bloom2'], (g, f, id) => {
      g.noise(M_MOSS_D, 0.1);
      if (f === 'top') { const c = id === 'bloom1' ? 0xf4f0e2 : 0xe890b4; g.fill(c); g.px(0, 0, 0xf2c83a); g.clear(1, 1); }
    });
    // cabeça de lagarto
    sk.cube('head', (g, f) => {
      g.noise(M_SKIN, 0.08);
      speckle(g, M_SKIN_D, 0.18);
      if (f === 'left' || f === 'right') {
        const ex = f === 'left' ? 3 : g.w - 6;
        g.rect(ex - 1, 0, 5, 1, M_SKIN_D);
        g.rect(ex, 1, 3, 2, M_EYE);
        g.rect(ex + 1, 1, 1, 2, M_PUPIL);
        g.px(f === 'left' ? ex : ex + 2, 1, 0xfff0b8);
        g.rect(0, g.h - 1, g.w, 1, M_SKIN_L);
      }
      if (f === 'top') { for (let y = 1; y < g.h; y += 2) g.px(g.w / 2 - 0.5, y, M_SKIN_D); }
      if (f === 'bottom') g.noise(M_SKIN_L, 0.06);
    });
    sk.cube('snout', (g, f) => {
      g.noise(M_SKIN, 0.08);
      if (f === 'front') { g.px(1, 1, M_PUPIL); g.px(g.w - 2, 1, M_PUPIL); g.rect(0, g.h - 1, g.w, 1, dk(M_SKIN, 0.6)); }
      if (f === 'left' || f === 'right') g.rect(0, g.h - 1, g.w, 1, dk(M_SKIN, 0.6));
      if (f === 'bottom') g.noise(M_SKIN_L, 0.06);
    });
    sk.cube('neck', (g, f) => { g.noise(M_SKIN, 0.08); speckle(g, M_SKIN_D, 0.15); if (f === 'bottom' || f === 'front') g.noise(M_SKIN_L, 0.06); });
    sk.cube('tongue', (g) => { g.fill(0xc8506a); g.clear(g.w / 2 - 0.5, g.h - 1); g.clear(0, 0, g.w, 1); });
    for (const l of ['legFR', 'legBR']) sk.cube(l, (g, f) => {
      g.noise(M_SKIN, 0.08);
      speckle(g, M_SKIN_D, 0.2);
      if (f === 'front') { g.rect(0, g.h - 1, g.w, 1, M_SKIN_D); for (let x = 0; x < g.w; x += 2) g.px(x, g.h - 1, M_CLAW); }
      if (f === 'bottom') g.noise(M_SKIN_D, 0.06);
    });
    sk.cubes(['tail', 'tailTip'], (g, f) => {
      g.noise(M_SKIN, 0.08);
      speckle(g, M_SKIN_D, 0.15);
      if (f !== 'front' && f !== 'back') for (let x = 1; x < g.w; x += 4) g.rect(x, 0, 2, g.h, dk(M_SKIN, 0.78));
      if (f === 'bottom') g.noise(M_SKIN_L, 0.06);
    });
  },
  animate(p, s) {
    const m = s.e as Musgarto;
    const hide = ease(p, 'body', 'hide', m.hiding > 0 ? 1 : 0, 0.3, s);
    const out = 1 - hide;
    head(p, s, 'head', out);
    // passo lento de lagarto: patas giram para a frente/trás e para os lados; corpo e rabo gingam
    quadLegs(p, s, undefined, 0.9 * out);
    const a = Math.cos(s.swing * C) * s.amount * out;
    p.legFR.rotation.y += a * 0.35; p.legBL.rotation.y += a * 0.35;
    p.legFL.rotation.y -= a * 0.35; p.legBR.rotation.y -= a * 0.35;
    p.body.rotation.y += Math.sin(s.swing * C) * 0.06 * s.amount * out;
    p.tail.rotation.y += (Math.sin(s.swing * C + 1.2) * 0.3 * s.amount + Math.sin(s.t * 0.045) * 0.12) * out;
    p.tailTip.rotation.y += (Math.sin(s.swing * C + 0.2) * 0.35 * s.amount + Math.sin(s.t * 0.045 - 0.8) * 0.2) * out;
    const br = Math.sin(s.t * 0.06) * 0.01;
    p.body.scale.set(1 + br, 1 + br * 1.5, 1 + br);
    // língua bifurcada: sai por um instante a cada ~5 s
    const tc = s.t % 97;
    const flick = tc < 9 ? Math.sin(tc / 9 * Math.PI) : 0;
    p.tongue.scale.set(1, 1, Math.max(0.01, flick));
    p.tongue.visible = flick > 0.05 && out > 0.9;
    // no casco: abaixa até o chão e recolhe cabeça, patas e rabo
    if (hide > 0) {
      p.body.position.y -= 3 / 16 * hide;
      p.head.position.z -= 6 / 16 * hide;
      for (const [n, sx] of [['legFR', 1], ['legFL', -1], ['legBR', 1], ['legBL', -1]] as const) {
        p[n].position.y += 3.5 / 16 * hide;
        p[n].position.x += sx * 1.6 / 16 * hide;
      }
      p.tail.position.z += 2 / 16 * hide;
      p.tail.scale.set(1 - 0.35 * hide, 1 - 0.35 * hide, 1 - 0.65 * hide);
    }
  },
};

export const SPECS_ANIMAIS2: Record<string, MobModelSpec> = {
  chicken: { def: CHICKEN, babyHead: 1.5 },
  rabbit: { def: RABBIT, babyHead: 1.4, variant: (e) => (e as Rabbit).variant },
  musgarto: {
    def: MUSGARTO, babyHead: 1.35,
    pose(inst, e) { inst.parts.moss.visible = !(e as Musgarto).sheared; },
  },
};
