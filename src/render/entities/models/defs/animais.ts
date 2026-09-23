/**
 * Grupo ANIMAIS (1/4): porco caipira (tipo Piau) e ovelha crioula.
 * Porco: pele creme-rosada com manchas cinza-escuras, orelhas caídas sobre os olhos, focinho em disco, rabo
 * enroladinho e sela de couro com baixeiro listrado. Ovelha: cara e patas marrom-escuras, orelhas de lado,
 * velo grosso em partes separadas (a variante de pele é só a cor da lã), pastar abaixando a cabeça.
 */
import type { ModelDef } from '../boxmodel';
import { head, quadLegs } from '../anim';
import type { Face } from '../skin';
import type { MobModelSpec } from '../../mobvisual';
import type { Pig, Sheep } from '../../../../game/entity/species/animals';
import { C, DEG, clamp, blotch, speckle, dk, mix, topShade, bottomShade, clothRgb } from './animais_base';

// ================================================================== porco caipira
const P_SKIN = 0xc98f7f, P_SKIN_L = 0xd9a393, P_SKIN_D = 0xa86e61, P_BELLY = 0xcf8579;
const P_SPOT = 0x5a4745, P_HALO = 0x8a6a63, P_SNOUT = 0xdb8086, P_SNOUT_D = 0xb35e68, P_NOSTRIL = 0x7e3a47;
const P_HOOF = 0x4f4143, P_EYE = 0x2b1d22;
const BL_RED = 0xa53a2c, BL_OCH = 0xd29c3c, BL_DARK = 0x3d2b27, BL_CREAM = 0xe6d5ab;
const LEATHER = 0x7c4627, LEATHER_D = 0x55301b, STITCH = 0xc99a5c;

function pigSkin(g: Face, spots: number): void {
  g.fur(P_SKIN, P_SKIN_D, P_SKIN_L, 0.12);
  for (let i = 0; i < spots; i++) blotch(g, g.r() * g.w, g.r() * g.h, 3 + g.r() * 3.5, P_SPOT, P_HALO);
}

/** Baixeiro de lã listrado (vermelho, ocre e creme) com franja na barra. */
function blanket(g: Face, f: string): void {
  if (f === 'top' || f === 'bottom') {
    g.noise(BL_RED, 0.06);
    for (let x = 1; x < g.w; x += 5) g.rect(x, 0, 1, g.h, BL_OCH);
    return;
  }
  const bands: [number, number][] = [[BL_RED, 3], [BL_OCH, 1], [BL_DARK, 1], [BL_CREAM, 1], [BL_RED, 2]];
  let y = 0;
  while (y < g.h) for (const [c, n] of bands) { g.rect(0, y, g.w, n, c); y += n; if (y >= g.h) break; }
  for (let x = 0; x < g.w; x++) for (let yy = 0; yy < g.h; yy++) if (g.r() < 0.12) g.px(x, yy, dk(g.get(x, yy), 0.85));
  // franja: fios alternados na barra
  for (let x = 0; x < g.w; x += 2) g.clear(x, g.h - 1);
}

export const PIG: ModelDef = {
  id: 'pig',
  parts: [
    {
      name: 'body', pivot: [0, 9, 0],
      cubes: [
        { o: [-5, 5, -8], s: [10, 8, 16] },
        { id: 'back', o: [-4, 13, -7], s: [8, 1, 13] },
        { id: 'belly', o: [-4, 4, -6], s: [8, 1, 11] },
      ],
      children: [{
        name: 'saddle', pivot: [0, 9, 0],
        cubes: [
          { id: 'blanket', o: [-5, 9, -4], s: [10, 5, 9], inflate: 0.3 },
          { id: 'seat', o: [-4, 14, -3], s: [8, 1, 7] },
          { id: 'cantle', o: [-3, 15, -3], s: [6, 1, 1] },
          { id: 'pommel', o: [-1, 15, 3], s: [2, 1, 1] },
          { id: 'girth', o: [-5, 4, 1], s: [10, 5, 2], inflate: 0.2 },
          { id: 'buckle', o: [-5.5, 6, 1.5], s: [1, 2, 1] },
        ],
      }],
    },
    {
      name: 'head', pivot: [0, 10, 8],
      cubes: [
        { o: [-4, 6, 8], s: [8, 7, 6] },
        { id: 'snout', o: [-2.5, 6.5, 14], s: [5, 4, 2] },
        { id: 'jowl', o: [-3, 5.5, 9], s: [6, 1, 5] },
      ],
      children: [
        // orelhas presas na borda da testa, caídas para a frente e abertas para fora (cobrem o canto dos olhos)
        { name: 'earR', pivot: [-3, 13, 13.5], rot: [64, 0, -14], cubes: [{ o: [-4.5, 12.5, 13.5], s: [3, 1, 5] }] },
        { name: 'earL', pivot: [3, 13, 13.5], rot: [64, 0, 14], cubes: [{ o: [1.5, 12.5, 13.5], s: [3, 1, 5], mirror: true, skinOf: 'earR' }] },
      ],
    },
    { name: 'legFR', pivot: [-3, 5, 5], cubes: [{ o: [-4.5, 0, 3.5], s: [3, 5, 3] }] },
    { name: 'legFL', pivot: [3, 5, 5], cubes: [{ o: [1.5, 0, 3.5], s: [3, 5, 3], mirror: true, skinOf: 'legFR' }] },
    { name: 'legBR', pivot: [-3, 5, -5], cubes: [{ o: [-4.5, 0, -6.5], s: [3, 5, 3] }] },
    { name: 'legBL', pivot: [3, 5, -5], cubes: [{ o: [1.5, 0, -6.5], s: [3, 5, 3], mirror: true, skinOf: 'legBR' }] },
    {
      // rabinho enrolado: haste + anel
      name: 'tail', pivot: [0, 11.5, -8],
      cubes: [
        { o: [-0.5, 11, -9], s: [1, 1, 1] },
        { id: 'curlT', o: [-1.5, 12, -10], s: [3, 1, 1] },
        { id: 'curlB', o: [-1.5, 10, -10], s: [3, 1, 1], skinOf: 'curlT' },
        { id: 'curlR', o: [-1.5, 11, -10], s: [1, 1, 1] },
        { id: 'curlL', o: [0.5, 11, -10], s: [1, 1, 1], skinOf: 'curlR' },
      ],
    },
  ],
  paint(sk) {
    sk.cube('body', (g, f) => {
      if (f === 'bottom') {
        g.noise(P_BELLY, 0.05);
        for (let i = 0; i < 5; i++) { const y = 5 + i * 5; g.px(6, y, P_SNOUT_D); g.px(g.w - 7, y, P_SNOUT_D); }
        return;
      }
      pigSkin(g, f === 'front' || f === 'back' ? 1 : 3);
      if (f === 'left' || f === 'right') bottomShade(g, 3, 0.86);
      if (f === 'back') g.line(g.w / 2, g.h - 5, g.w / 2, g.h - 1, P_SKIN_D);
    });
    sk.cube('back', (g) => pigSkin(g, 1));
    sk.cubes(['belly', 'jowl'], (g) => g.fur(P_BELLY, P_SKIN_D, P_SKIN_L, 0.08));
    sk.cube('head', (g, f) => {
      g.fur(P_SKIN, P_SKIN_D, P_SKIN_L, 0.1);
      if (f === 'front') {
        blotch(g, 12.5, 3.5, 2.4, P_SPOT, P_HALO); // mancha no olho esquerdo (charme caipira)
        g.line(5, 1, 10, 1, dk(P_SKIN, 0.9));
        for (const ex of [4, 10]) {
          g.line(ex - 1, 1, ex + 2, 1, dk(P_SKIN, 0.7));
          g.rect(ex, 2, 2, 3, P_EYE);
          g.px(ex + (ex < 8 ? 1 : 0), 2, 0xe6d6d2);
        }
      }
      if (f === 'left' || f === 'right') {
        const fx = f === 'left' ? 0 : g.w - 1, d = f === 'left' ? 1 : -1;
        g.line(fx + d * 2, 8, fx + d * 5, 9, P_SKIN_D);
        if (f === 'left') blotch(g, 3, 4, 2, P_SPOT, P_HALO);
      }
      if (f === 'bottom') g.noise(P_BELLY, 0.05);
    });
    sk.cube('snout', (g, f) => {
      if (f === 'front') {
        g.fill(P_SNOUT_D);
        g.ellipse(g.w / 2, g.h / 2, g.w / 2 - 0.2, g.h / 2 - 0.2, P_SNOUT);
        g.line(3, 1, g.w - 4, 1, mix(P_SNOUT, 0xffffff, 0.3));
        g.rect(3, 4, 1, 2, P_NOSTRIL); g.px(2, 4, P_SNOUT_D);
        g.rect(g.w - 4, 4, 1, 2, P_NOSTRIL); g.px(g.w - 3, 4, P_SNOUT_D);
        return;
      }
      g.fur(mix(P_SKIN, P_SNOUT, 0.45), P_SKIN_D, P_SKIN_L, 0.08);
      if (f === 'top') { g.rect(0, g.h - 1, g.w, 1, P_SNOUT); g.line(2, 1, g.w - 3, 1, P_SKIN_D); }
      if (f === 'left') g.line(0, g.h - 2, 3, g.h - 1, P_SNOUT_D);
      if (f === 'right') g.line(g.w - 1, g.h - 2, g.w - 4, g.h - 1, P_SNOUT_D);
      if (f === 'bottom') g.rect(0, 0, g.w, 1, P_SNOUT);
    });
    sk.cube('earR', (g, f) => {
      if (f === 'bottom') { g.noise(0xdb9d98, 0.06); g.line(g.w / 2, 1, g.w / 2, g.h - 3, 0xc7837f); g.line(2, 3, g.w / 2, 6, 0xc7837f); }
      else { g.fur(P_SKIN, P_SKIN_D, P_SKIN_L, 0.1); if (f === 'top') { blotch(g, 5, 3, 2, P_SPOT, P_HALO); g.rim(0.9, 1); } }
      if (f === 'top' || f === 'bottom') { g.clear(0, g.h - 1); g.clear(g.w - 1, g.h - 1); }
    });
    for (const l of ['legFR', 'legBR']) sk.cube(l, (g, f) => {
      g.fur(P_SKIN, P_SKIN_D, P_SKIN_L, 0.1);
      if (l === 'legBR' && (f === 'right' || f === 'back')) blotch(g, 3, 3, 2.4, P_SPOT, P_HALO);
      if (f === 'bottom') { g.fill(P_HOOF); g.line(g.w / 2, 0, g.w / 2, g.h - 1, dk(P_HOOF, 0.6)); return; }
      if (f === 'top') return;
      topShade(g, 3, 0.8);
      g.rect(0, g.h - 2, g.w, 2, P_HOOF);
      g.rect(0, g.h - 3, g.w, 1, dk(P_SKIN, 0.82));
      if (f === 'front') g.rect(g.w / 2 - 0.5, g.h - 2, 1, 2, dk(P_HOOF, 0.6));
    });
    sk.cubes(['tail', 'curlT', 'curlR'], (g) => { g.noise(P_SNOUT_D, 0.06); g.rim(0.85, 1); });
    // sela
    sk.cube('blanket', (g, f) => blanket(g, f));
    sk.cube('seat', (g, f) => {
      g.noise(LEATHER, 0.07);
      if (f === 'top') {
        for (let x = 1; x < g.w - 1; x += 2) { g.px(x, 1, STITCH); g.px(x, g.h - 2, STITCH); }
        for (let y = 1; y < g.h - 1; y += 2) { g.px(1, y, STITCH); g.px(g.w - 2, y, STITCH); }
        g.line(g.w / 2, 3, g.w / 2, g.h - 4, LEATHER_D);
      }
    });
    sk.cubes(['cantle', 'pommel'], (g, f) => { g.noise(LEATHER_D, 0.08); if (f === 'top') g.rim(1.25, 1); });
    sk.cube('girth', (g) => { g.noise(0x6b4a30, 0.06); g.rect(0, 0, g.w, 1, 0x4e3321); g.rect(0, g.h - 1, g.w, 1, 0x4e3321); });
    sk.cube('buckle', (g) => { g.fill(0xc2ae84); g.rect(g.w / 2 - 0.5, 1, 1, g.h - 2, 0x5c4c36); });
  },
  animate(p, s) {
    head(p, s);
    quadLegs(p, s);
    const w = Math.cos(s.swing * C) * s.amount;
    const idle = 1 - s.amount;
    // orelhas balançam com o passo e se sacodem de vez em quando
    const tw = Math.max(0, Math.sin(s.t * 0.13 + 1) - 0.94) * 7;
    p.earR.rotation.x += w * 0.22 + Math.sin(s.t * 1.3) * tw * 0.35;
    p.earL.rotation.x -= w * 0.22;
    p.earR.rotation.z += Math.abs(w) * 0.12; p.earL.rotation.z -= Math.abs(w) * 0.12;
    // rabinho inquieto
    p.tail.rotation.y += Math.sin(s.t * 0.35) * 0.35 + w * 0.3;
    p.tail.rotation.x += Math.cos(s.t * 0.21) * 0.12;
    // fuçando quando parado
    p.head.rotation.x += (Math.max(0, Math.sin(s.t * 0.05)) * 0.14 + Math.sin(s.t * 0.9) * 0.015) * idle;
  },
};

// ================================================================== ovelha crioula
const S_FACE = 0x4c3527, S_FACE_L = 0x6d4c37, S_FACE_D = 0x32231a, S_HOOF = 0x2b221d, S_INNER = 0x9b6a5c;
const S_SHORN = 0xa3847b, S_SHORN_D = 0x85675f, S_IRIS = 0xcf9f3a, S_PUPIL = 0x1f1713;

/** Cor da lã: o branco natural é creme; o preto natural é marrom-carvão; tons escuros ganham um pouco de luz. */
function woolColor(id: string): [number, number, number] {
  if (id === 'white' || !id) return [222, 214, 196];
  if (id === 'black') return [60, 47, 41];
  return clothRgb(id);
}

/** Velo crioulo: tufos redondos em grade escalonada (luz no alto, sombra embaixo, frestas escuras) e franja na barra. */
function fleece(g: Face, base: [number, number, number], fringe: boolean): void {
  const lum = 0.3 * base[0] + 0.59 * base[1] + 0.11 * base[2];
  const hi = mix(base, 0xffffff, lum < 90 ? 0.14 : 0.3), lo = dk(base, 0.7), gap = dk(base, 0.6);
  g.noise(gap, 0.06);
  let row = 0;
  for (let y = -1; y < g.h + 2; y += 3, row++) {
    for (let x = (row % 2) * 2 - 1; x < g.w + 2; x += 4) {
      const cx = x + (g.r() - 0.5), cy = y + (g.r() - 0.5) * 0.8;
      g.ellipse(cx, cy, 2, 1.7, dk(base, 0.93 + g.r() * 0.1));
      g.px(cx - 1, cy - 1, hi); g.px(cx, cy - 1, hi);
      g.px(cx + 1, cy + 1, lo); g.px(cx, cy + 1, dk(base, 0.82));
    }
  }
  if (fringe) for (let x = 0; x < g.w; x++) { const n = Math.floor(g.r() * 2.6); for (let k = 0; k < n; k++) g.clear(x, g.h - 1 - k); }
}

export const SHEEP: ModelDef = {
  id: 'sheep',
  parts: [
    {
      name: 'body', pivot: [0, 12, 0],
      cubes: [{ o: [-4, 9, -8], s: [8, 7, 16] }],
      children: [{
        name: 'wool', pivot: [0, 12, 0],
        cubes: [
          { id: 'woolBody', o: [-6, 7, -9], s: [12, 11, 18] },
          { id: 'woolTop', o: [-5, 18, -7], s: [10, 1, 13] },
          { id: 'woolRump', o: [-5, 8, -10], s: [10, 9, 1] },
          { id: 'woolChest', o: [-5, 8, 9], s: [10, 8, 1] },
        ],
      }],
    },
    {
      name: 'head', pivot: [0, 16, 9],
      cubes: [
        { o: [-3, 15, 8], s: [6, 5, 6] },
        { id: 'muzzle', o: [-2, 13.5, 14], s: [4, 4, 3] },
        { id: 'neck', o: [-2, 12, 5], s: [4, 5, 4] },
      ],
      children: [
        { name: 'earR', pivot: [-3, 18.5, 11], rot: [0, 0, 18], cubes: [{ o: [-6, 18, 10.5], s: [3, 1, 2] }] },
        { name: 'earL', pivot: [3, 18.5, 11], rot: [0, 0, -18], cubes: [{ o: [3, 18, 10.5], s: [3, 1, 2], mirror: true, skinOf: 'earR' }] },
        { name: 'forelock', pivot: [0, 20, 11], cubes: [{ o: [-2, 19.5, 9], s: [4, 2, 4] }] },
      ],
    },
    {
      name: 'legFR', pivot: [-2.5, 9, 5.5], cubes: [{ o: [-4, 0, 4], s: [3, 9, 3] }],
      children: [{ name: 'woolFR', pivot: [-2.5, 9, 5.5], cubes: [{ id: 'cuffF', o: [-4.5, 5, 3.5], s: [4, 3, 4] }] }],
    },
    {
      name: 'legFL', pivot: [2.5, 9, 5.5], cubes: [{ o: [1, 0, 4], s: [3, 9, 3], mirror: true, skinOf: 'legFR' }],
      children: [{ name: 'woolFL', pivot: [2.5, 9, 5.5], cubes: [{ o: [0.5, 5, 3.5], s: [4, 3, 4], mirror: true, skinOf: 'cuffF' }] }],
    },
    {
      name: 'legBR', pivot: [-2.5, 9, -5.5], cubes: [{ o: [-4, 0, -7], s: [3, 9, 3] }],
      children: [{ name: 'woolBR', pivot: [-2.5, 9, -5.5], cubes: [{ id: 'cuffB', o: [-4.5, 5, -7.5], s: [4, 3, 4] }] }],
    },
    {
      name: 'legBL', pivot: [2.5, 9, -5.5], cubes: [{ o: [1, 0, -7], s: [3, 9, 3], mirror: true, skinOf: 'legBR' }],
      children: [{ name: 'woolBL', pivot: [2.5, 9, -5.5], cubes: [{ o: [0.5, 5, -7.5], s: [4, 3, 4], mirror: true, skinOf: 'cuffB' }] }],
    },
    {
      name: 'tail', pivot: [0, 15, -8.5], rot: [8, 0, 0], cubes: [{ o: [-1, 11, -9], s: [2, 4, 1] }],
      children: [{ name: 'woolTail', pivot: [0, 15, -8.5], cubes: [{ o: [-1.5, 9.5, -11], s: [3, 6, 2] }] }],
    },
  ],
  paint(sk, variant) {
    const wool = woolColor(variant);
    sk.cubes(['woolBody', 'woolRump', 'woolChest', 'cuffF', 'cuffB', 'woolTail'], (g, f) => fleece(g, wool, f !== 'top' && f !== 'bottom'));
    sk.cubes(['woolTop', 'forelock'], (g) => fleece(g, wool, false));
    sk.cube('body', (g, f) => {
      // tosada: pele rosada-acinzentada com pelinho curto e marcas da tesoura
      g.noise(S_SHORN, 0.05);
      speckle(g, S_SHORN_D, 0.1);
      speckle(g, mix(S_SHORN, 0xffffff, 0.25), 0.05);
      if (f === 'left' || f === 'right' || f === 'top') for (let y = 3; y < g.h; y += 4) for (let x = 0; x < g.w; x++) if (g.r() < 0.45) g.px(x, y, S_SHORN_D);
    });
    sk.cube('head', (g, f) => {
      g.fur(S_FACE, S_FACE_D, S_FACE_L, 0.25);
      if (f === 'left' || f === 'right') {
        // olho de pupila horizontal encostado na quina da frente (continua na face frontal)
        const ex = f === 'left' ? 0 : g.w - 4;
        g.rect(ex, 3, 4, 1, S_FACE_D);
        g.rect(ex, 4, 4, 3, S_IRIS);
        g.rect(ex, 5, 4, 1, S_PUPIL);
        g.px(f === 'left' ? ex + 1 : ex + 2, 4, 0xf3dfa4);
      }
      if (f === 'front') {
        g.rect(2, 2, g.w - 4, 1, S_FACE_L);
        for (const x of [0, g.w - 1]) { g.px(x, 3, S_FACE_D); g.rect(x, 4, 1, 3, S_IRIS); g.px(x, 5, S_PUPIL); }
      }
    });
    sk.cube('muzzle', (g, f) => {
      g.fur(S_FACE, S_FACE_D, S_FACE_L, 0.2);
      if (f === 'front') {
        g.rect(1, 0, g.w - 2, g.h - 1, S_FACE_L);
        g.px(1, 2, S_FACE_D); g.px(g.w - 2, 2, S_FACE_D);
        g.line(2, g.h - 2, g.w - 3, g.h - 2, dk(S_FACE_L, 0.72));
      }
      if (f === 'bottom') g.noise(S_FACE_L, 0.06);
    });
    sk.cube('earR', (g, f) => {
      g.fur(S_FACE, S_FACE_D, S_FACE_L, 0.2);
      if (f === 'front' || f === 'bottom') g.rect(0, 0, g.w - 1, g.h, S_INNER);
    });
    for (const l of ['legFR', 'legBR']) sk.cube(l, (g, f) => {
      g.fur(S_FACE, S_FACE_D, S_FACE_L, 0.25);
      if (f === 'bottom') { g.fill(S_HOOF); g.line(g.w / 2, 0, g.w / 2, g.h - 1, dk(S_HOOF, 0.6)); return; }
      if (f === 'top') return;
      g.rect(0, 9, g.w, 1, S_FACE_L);
      g.rect(0, g.h - 3, g.w, 3, S_HOOF);
      if (f === 'front') g.rect(g.w / 2 - 0.5, g.h - 3, 1, 3, dk(S_HOOF, 0.55));
    });
    sk.cubes(['tail', 'neck'], (g) => g.fur(S_FACE, S_FACE_D, S_FACE_L, 0.25));
  },
  animate(p, s) {
    const sh = s.e as Sheep;
    // pastar: eatAnim 40 → 0; desce a cabeça em 4 ticks, mastiga, e sobe nos 4 últimos
    const ea = sh.eatAnim > 0 ? Math.max(0, sh.eatAnim - s.alpha) : 0;
    const e = ea <= 0 ? 0 : clamp(ea > 36 ? (40 - ea) / 4 : ea < 4 ? ea / 4 : 1);
    head(p, s, 'head', 1 - e);
    if (e > 0) {
      const chew = ea > 4 && ea < 36 ? Math.sin(ea * 1.3) * 0.09 : 0;
      p.head.rotation.x += (64 * DEG + chew) * e;
      p.head.position.y -= 7.5 / 16 * e;
      p.head.position.z += 1.5 / 16 * e;
    }
    quadLegs(p, s);
    const tw = Math.max(0, Math.sin(s.t * 0.09 + 2) - 0.95) * 8;
    p.earR.rotation.z += Math.sin(s.t * 1.4) * tw * 0.3 + e * 0.35;
    p.earL.rotation.z -= e * 0.35 - Math.sin(s.t * 0.07) * 0.05;
    p.tail.rotation.y += Math.sin(s.t * 0.25) * 0.15 + Math.cos(s.swing * C) * 0.3 * s.amount;
    const br = Math.sin(s.t * 0.08) * 0.012;
    p.wool.scale.set(1 + br, 1 + br * 1.4, 1);
  },
};

export const SPECS_ANIMAIS: Record<string, MobModelSpec> = {
  pig: {
    def: PIG, babyHead: 1.35,
    pose(inst, e) { inst.parts.saddle.visible = !!(e as Pig).saddled && !e.isBaby; },
  },
  sheep: {
    def: SHEEP, babyHead: 1.45,
    variant: (e) => (e as Sheep).color,
    pose(inst, e) {
      const on = !(e as Sheep).sheared;
      for (const n of ['wool', 'woolFR', 'woolFL', 'woolBR', 'woolBL', 'woolTail']) inst.parts[n].visible = on;
    },
  },
};
