/**
 * Monstros do Lavra (2/2):
 * - Pavio: criatura-cabaça (porongo) verde-oliva sobre 4 patinhas de rama; rachaduras deixam ver o miolo em
 *   brasa (camada emissiva que acende ao inchar) e do cabo sai um pavio de fibra de caroá com a ponta acesa.
 *   Ao inchar cresce (até +40% na horizontal, +10% na vertical) com tremor e pisca branco; carregado,
 *   ganha uma aura elétrica azulada que tremeluz.
 * - Feiticeira: benzedeira sombria de saia longa de chita escura, xale de franjas com colar de sementes,
 *   chapéu de palha largo com arruda e pena, bolsa de ervas na cintura, rosto marcado e olhos verdes.
 */
import type { ModelDef, PartDef, CubeDef, V3 } from '../boxmodel';
import { DEG } from '../boxmodel';
import { head, biped, quadLegs } from '../anim';
import type { MobModelSpec } from '../../mobvisual';
import { rng, shade, type Col, type Face, type FaceName } from '../skin';
import { fromFront, isSide, dim, partMat } from './monstros';
import type { Pavio, Feiticeira } from '../../../../game/entity/species/monsters';

// ------------------------------------------------------------------ pavio
const PV = {
  gourd: 0x5f6d2d, rib: 0x4c5924, speck: 0x85954a, top: 0x6b7832, stem: 0x5a4128, crackD: 0x2c2410,
  glow: 0x5a220e, glowHot: 0x7a3412, eye: 0xe07a1c, fiber: 0xa38a58, fiberD: 0x6f5a35, vine: 0x4f5c2b, root: 0x5b4a2c,
};

/** Rachaduras determinísticas por face (mesmo desenho na casca e na camada que brilha). */
function crackSet(w: number, h: number, seed: number, n: number): Set<number> {
  const r = rng(seed * 7919 + w * 131 + h);
  const out = new Set<number>();
  for (let k = 0; k < n; k++) {
    let x = Math.floor(r() * w), y = Math.floor(r() * h * 0.6);
    const len = 4 + Math.floor(r() * (h * 0.8));
    for (let i = 0; i < len; i++) {
      if (x >= 0 && y >= 0 && x < w && y < h) out.add(y * w + x);
      y += 1;
      const t = r();
      if (t < 0.3) x -= 1; else if (t < 0.6) x += 1;
      if (r() < 0.12) { const bx = x + (r() < 0.5 ? -1 : 1); if (bx >= 0 && bx < w && y < h) out.add(y * w + bx); }
    }
  }
  return out;
}
const FACES: FaceName[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** Cubo da casca e sua cópia inflada (camada das rachaduras que brilham). */
function shell(id: string, o: V3, s: V3): [CubeDef, CubeDef] {
  return [{ id, o, s }, { id: `${id}Cr`, o, s, inflate: 0.12 }];
}
const SHELL_BODY: [string, V3, V3][] = [['pvBulb', [-4.5, 4, -4.5], [9, 10, 9]], ['pvBelt', [-5, 6, -5], [10, 6, 10]], ['pvWaist', [-3, 14, -3], [6, 3, 6]]];
const SHELL_HEAD: [string, V3, V3][] = [['pvTop', [-3.5, 17, -3.5], [7, 6, 7]], ['pvTopBelt', [-4, 18, -4], [8, 4, 8]]];

/** Patinha de rama; `skin`: 0 = pele própria, 1 = cópia da dianteira direita, 2 = cópia espelhada. */
const pvLeg = (name: string, x: number, z: number, skin: 0 | 1 | 2): PartDef => ({
  name, pivot: [x + 1.5, 4, z + 1.5],
  cubes: [skin === 0 ? { id: 'legFRc', o: [x, 0, z], s: [3, 4, 3] } : { id: `${name}c`, o: [x, 0, z], s: [3, 4, 3], skinOf: 'legFRc', mirror: skin === 2 }],
});

export const PAVIO: ModelDef = {
  id: 'pavio',
  parts: [
    {
      name: 'body', pivot: [0, 4, 0],
      cubes: SHELL_BODY.map(([id, o, s]) => shell(id, o, s)[0]),
      children: [
        { name: 'cracks', pivot: [0, 4, 0], cubes: SHELL_BODY.map(([id, o, s], i) => ({ ...shell(id, o, s)[1], emissive: i === 0 ? 0.08 : undefined })) },
        {
          // a cabaça de cima é a "cabeça": gira para olhar
          name: 'head', pivot: [0, 17, 0],
          cubes: [...SHELL_HEAD.map(([id, o, s]) => shell(id, o, s)[0]), { id: 'pvStem', o: [-1.5, 23, -1.5], s: [3, 2, 3] }],
          children: [
            { name: 'headCracks', pivot: [0, 17, 0], cubes: SHELL_HEAD.map(([id, o, s], i) => ({ ...shell(id, o, s)[1], emissive: i === 0 ? 0.08 : undefined })) },
            {
              name: 'fuse', pivot: [0, 25, 0],
              cubes: [{ id: 'pvFz1', o: [-0.5, 25, -0.5], s: [1, 2, 1] }, { id: 'pvFz2', o: [-0.5, 27, -1.2], s: [1, 1.5, 1] }],
              children: [{ name: 'ember', pivot: [0, 28.5, -0.7], cubes: [{ id: 'pvEmber', o: [-0.5, 28.5, -1.2], s: [1, 1, 1], emissive: 0.9 }] }],
            },
          ],
        },
        // aura elétrica (carregado): dois quadros que se alternam
        ...[1, 2].map((k): PartDef => {
          const d = k === 1 ? 1.2 : 1.5;
          return {
            name: `aura${k}`, pivot: [0, 4, 0],
            cubes: [
              { id: `pvAura${k}a`, o: [-5 - d, 4 - d, -5 - d], s: [10 + 2 * d, 10 + 2 * d, 10 + 2 * d], translucent: true, skip: ['top'] },
              { id: `pvAura${k}b`, o: [-4 - d, 14 + d, -4 - d], s: [8 + 2 * d, 11 - d, 8 + 2 * d], translucent: true, skip: ['bottom'] },
            ],
          };
        }),
      ],
    },
    pvLeg('legFR', -4, 1, 0), pvLeg('legFL', 1, 1, 2), pvLeg('legBR', -4, -4, 1), pvLeg('legBL', 1, -4, 2),
  ],
  paint(sk) {
    /** Olhos: duas frestas amendoadas e inclinadas (bravas) na cabaça de cima, com uma fenda torta embaixo. */
    const eyes = (g: Face, c: Col, mouth: Col) => {
      for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3], [4, 3], [5, 3], [4, 4], [5, 4]]) { g.px(x, y, c); g.px(g.w - 1 - x, y, c); }
      for (const [x, y] of [[5, 6], [6, 7], [7, 6], [8, 7], [9, 6], [10, 7]]) g.px(x, y, mouth);
    };
    [...SHELL_BODY, ...SHELL_HEAD].forEach(([id], ci) => {
      const base = id === 'pvTop' || id === 'pvTopBelt' ? PV.top : id === 'pvWaist' ? shade(PV.gourd, 0.9) : PV.gourd;
      const cracks = (g: Face, f: FaceName) => (id === 'pvTopBelt' && f === 'front' ? new Set<number>() : crackSet(g.w, g.h, ci * 6 + FACES.indexOf(f), f === 'top' || f === 'bottom' ? 1 : 2));
      // casca: nervuras verticais, pintinhas claras e a borda escura de cada rachadura
      sk.cube(id, (g, f) => {
        g.noise(f === 'bottom' ? shade(base, 0.8) : base, 0.05);
        if (isSide(f) || f === 'front' || f === 'back') for (let x = 1; x < g.w; x += 4) for (let y = 0; y < g.h; y++) dim(g, x, y, 0.86);
        for (let i = 0; i < (g.w * g.h) / 18; i++) g.px(g.r() * g.w, g.r() * g.h, PV.speck);
        for (const k of cracks(g, f)) { const x = k % g.w, y = Math.floor(k / g.w); g.px(x, y, PV.crackD); dim(g, x + 1, y, 0.8); }
        if (id === 'pvTopBelt' && f === 'front') eyes(g, PV.crackD, PV.crackD);
      });
      // camada inflada: só as rachaduras (e os olhos), que brilham conforme o inchaço
      sk.cube(`${id}Cr`, (g, f) => {
        for (const k of cracks(g, f)) g.px(k % g.w, Math.floor(k / g.w), (k * 7) % 3 === 0 ? PV.glowHot : PV.glow);
        if (id === 'pvTopBelt' && f === 'front') eyes(g, PV.eye, PV.glowHot);
      });
    });
    // cabo lenhoso com o furo do pavio
    sk.cube('pvStem', (g, f) => {
      g.noise(PV.stem, 0.08);
      for (let x = 0; x < g.w; x += 2) for (let y = 0; y < g.h; y++) dim(g, x, y, 0.85);
      if (f === 'top') g.rect(2, 2, 2, 2, 0x1e140c);
    });
    // fibra de caroá torcida (listras diagonais)
    for (const id of ['pvFz1', 'pvFz2']) sk.cube(id, (g) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.px(x, y, (x + y) % 2 === 0 ? PV.fiber : PV.fiberD); });
    sk.cube('pvEmber', (g) => { g.fill(0xff8a2a); g.px(0, 0, 0xffe08a); g.px(1, 1, 0xffc04a); });
    // patinhas de rama com raízes nos dedos
    sk.cube('legFRc', (g, f) => {
      g.fur(PV.vine, shade(PV.vine, 0.75), shade(PV.vine, 1.2), 0.3);
      if (f === 'bottom') { g.noise(PV.root, 0.1); return; }
      if (f !== 'top') { for (let x = 0; x < g.w; x++) g.px(x, g.h - 1, x % 2 ? PV.root : shade(PV.root, 0.7)); g.rect(0, 0, g.w, 1, shade(PV.vine, 0.7)); }
    });
    // aura elétrica: névoa azul quase invisível com raios em zigue-zague
    for (const id of ['pvAura1a', 'pvAura1b', 'pvAura2a', 'pvAura2b']) sk.cube(id, (g) => {
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.px(x, y, [90, 150, 255, 6]);
      for (let k = 0; k < Math.max(1, Math.floor(g.w / 7)); k++) {
        let x = Math.floor(g.r() * g.w);
        for (let y = Math.floor(g.r() * 6); y < g.h; y++) {
          g.clear(x, y); g.px(x, y, [205, 232, 255, 235]);
          if (g.r() < 0.5) { x += g.r() < 0.5 ? -1 : 1; g.clear(x, y); g.px(x, y, [140, 195, 255, 190]); }
          if (g.r() < 0.05) break;
        }
      }
    });
  },
  animate(p, s) {
    p.head.rotation.y += -s.headYaw * DEG;
    p.head.rotation.x += s.headPitch * DEG * 0.3;
    quadLegs(p, s, ['legFR', 'legFL', 'legBR', 'legBL'], 1.1);
    p.body.rotation.z += Math.sin(s.swing * 0.6662) * 0.06 * s.amount; // gingado de cabaça
    p.fuse.rotation.z += Math.sin(s.t * 0.13) * 0.12;
    p.fuse.rotation.x += Math.cos(s.t * 0.1) * 0.1;
  },
};

// ------------------------------------------------------------------ feiticeira
const FC = {
  skin: 0x8a6248, skinD: 0x6e4a35, line: 0x553626, eye: 0x4fc26a, hair: 0xb9b4a9, hairD: 0x8c877d,
  straw: 0xc9a45c, strawD: 0x9a7736, band: 0x3a2430, herb: 0x5b8c64, herbD: 0x3d6648, feather: 0x1d2130, featherL: 0x3a5a8c,
  blouse: 0x2b2531, shawl: 0x4b1a27, shawlD: 0x321019, mustard: 0x8c6c28, seed: 0xa8241c,
  skirt: 0x1e1729, flowerR: 0x7e2432, flowerY: 0x9c7a2c, leaf: 0x28584a, pouch: 0x6b4a2a, rope: 0x8a7050, shoe: 0x3a2a1e,
};

const fcSide = <T extends CubeDef>(R: boolean, id: string, o: V3, s: V3, extra: Partial<T> = {}): CubeDef =>
  R ? { id: `fc${id}R`, o, s, ...extra } : { id: `fc${id}L`, o, s, ...extra, mirror: true, skinOf: `fc${id}R` };

const fcArm = (side: -1 | 1): PartDef => {
  const R = side < 0, n = R ? 'R' : 'L', x = R ? -7 : 4;
  return {
    name: `arm${n}`, pivot: [5.5 * side, 22, 0],
    cubes: [fcSide(R, 'Arm', [x, 16, -1.5], [3, 7, 3])],
    children: [{
      name: `fore${n}`, pivot: [5.5 * side, 16, 0],
      cubes: [fcSide(R, 'Fore', [x, 10, -1.5], [3, 6, 3])],
      // punho da garrafa: orienta o frasco (ícone em pé) para o gargalo descer até a boca na pose de beber
      children: R ? [{ name: 'drinkHand', pivot: [-5.5, 11, 0], rot: [30, -112.4, 0], cubes: [] }] : [],
    }],
  };
};

export const FEITICEIRA: ModelDef = {
  id: 'feiticeira',
  parts: [
    {
      name: 'body', pivot: [0, 24, 0],
      cubes: [
        { id: 'fcTorso', o: [-4, 13, -2.5], s: [8, 11, 5] },
        { id: 'fcShawl', o: [-4.5, 18, -3], s: [9, 6, 6], inflate: 0.4 },
        { id: 'fcShawlBack', o: [-4.5, 11, -3.5], s: [9, 8, 0] },
        { id: 'fcBraidR', o: [-4, 17, 3.5], s: [1.5, 7, 1.5] },
        { id: 'fcBraidL', o: [2.5, 17, 3.5], s: [1.5, 7, 1.5], mirror: true, skinOf: 'fcBraidR' },
        { id: 'fcPouch', o: [0, 9.5, 3], s: [3, 3.5, 1.5] },
        { id: 'fcPouchHerbs', o: [1.5, 13, 3], s: [0, 2.5, 1.5] },
      ],
      children: [{
        name: 'skirt', pivot: [0, 14, 0],
        cubes: [{ id: 'fcSkirt', o: [-4.5, 4, -3], s: [9, 10, 6] }, { id: 'fcHem', o: [-5, 1, -3.5], s: [10, 4, 7] }],
      }],
    },
    {
      name: 'head', pivot: [0, 24, 0],
      cubes: [
        { id: 'fcHead', o: [-4, 24, -4], s: [8, 8, 8] },
        { id: 'fcBrim', o: [-7, 30, -7], s: [14, 1, 14] },
        { id: 'fcCrown', o: [-4.5, 30, -4.5], s: [9, 4, 9] },
        { id: 'fcCrownTop', o: [-3.5, 34, -3.5], s: [7, 1, 7] },
        { id: 'fcHerbA', o: [4.6, 31, -2], s: [0, 3, 3] },
        { id: 'fcHerbB', o: [3.2, 31, -0.5], s: [3, 3, 0] },
      ],
      children: [{ name: 'feather', pivot: [4.6, 31.5, -2.5], rot: [-35, 0, -12], cubes: [{ id: 'fcFeather', o: [4.6, 31.5, -3.5], s: [0, 7, 2] }] }],
    },
    fcArm(-1), fcArm(1),
    { name: 'legR', pivot: [-2, 7, 0], cubes: [fcSide(true, 'Leg', [-3.5, 0, -1.5], [3, 7, 3])] },
    { name: 'legL', pivot: [2, 7, 0], cubes: [fcSide(false, 'Leg', [0.5, 0, -1.5], [3, 7, 3])] },
  ],
  paint(sk) {
    const hairTex = (g: Face) => { g.noise(FC.hair, 0.07); for (let x = 0; x < g.w; x += 3) for (let y = 0; y < g.h; y++) if (g.r() < 0.6) g.px(x, y, FC.hairD); };
    // rosto curtido: rugas, cicatriz, pinta, olhos verdes fundos; cabelo grisalho repartido emoldurando
    sk.cube('fcHead', (g, f) => {
      g.noise(FC.skin, 0.05);
      if (f === 'top' || f === 'back') { hairTex(g); return; }
      if (f === 'bottom') { g.noise(FC.skinD, 0.05); return; }
      if (isSide(f)) {
        for (let y = 0; y < g.h; y++) for (let d = 0; d < g.w; d++) if (d >= 8 || y < 6) g.px(fromFront(g, f, d), y, (d + y) % 3 ? FC.hair : FC.hairD);
        g.rect(fromFront(g, f, f === 'left' ? 5 : 6), 8, 2, 3, FC.skinD); g.px(fromFront(g, f, 6), 11, 0xd8b04a); // orelha e argola
        return;
      }
      const L = FC.line;
      for (let x = 0; x < g.w; x++) if (x < 7 || x > 8) g.px(x, 4, FC.hair);
      for (let y = 5; y < g.h; y++) for (const x of y < 7 ? [0, 1, 2, 3, 12, 13, 14, 15] : [0, 1, 14, 15]) g.px(x, y, (x + y) % 3 ? FC.hair : FC.hairD);
      for (let x = 5; x < 11; x += 2) g.px(x, 5, L); // ruga da testa
      for (const [x0, dx] of [[3, 1], [12, -1]]) { for (let i = 0; i < 3; i++) g.px(x0 + i * dx, 6, 0x4a4540); g.px(x0 + 3 * dx, 7, 0x4a4540); } // sobrancelhas franzidas
      for (const x0 of [4, 9]) { g.px(x0, 8, 0x8fe29c); g.px(x0 + 1, 8, 0x10261a); g.px(x0 + 2, 8, FC.eye); for (let i = 0; i < 3; i++) g.px(x0 + i, 9, L); } // olhos verdes e olheiras
      for (const [x, y] of [[2, 8], [3, 9], [13, 8], [12, 9]]) g.px(x, y, L); // pés de galinha
      g.rect(7, 8, 2, 3, shade(FC.skin, 1.12)); g.px(7, 11, L); g.px(8, 11, L); // nariz
      for (const [x, y] of [[5, 11], [5, 12], [10, 11], [10, 12]]) g.px(x, y, L); // vincos
      g.rect(6, 13, 4, 1, 0x3a2020); g.px(5, 14, L); g.px(10, 14, L); // boca fina, cantos caídos
      g.line(2, 10, 4, 12, 0xa87a66); g.px(11, 12, 0x3a2418); // cicatriz e pinta
    });
    // tranças grisalhas com fita vermelha na ponta
    sk.cube('fcBraidR', (g) => {
      // trança: mechas alternadas em zigue-zague, fita vermelha perto da ponta
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const left = y % 4 < 2; g.px(x, y, (left ? x < 2 : x > 0) ? shade(FC.hair, 0.95) : FC.hairD); }
      for (let x = 0; x < g.w; x++) { g.px(x, g.h - 3, FC.flowerR); g.px(x, g.h - 4, FC.flowerR); }
    });
    // chapéu de palha trançada, aba desfiada, fita escura com ervas
    const weave = (g: Face, base: Col) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const k = ((x >> 1) + (y >> 1)) % 2 ? 1.08 : 0.9; g.px(x, y, shade(base, k * (1 + (g.r() * 2 - 1) * 0.05))); } };
    sk.cube('fcBrim', (g, f) => {
      if (f === 'top' || f === 'bottom') {
        const c = (g.w - 1) / 2;
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
          const ring = Math.max(Math.abs(x - c), Math.abs(y - c));
          const k = (Math.floor(ring) + ((x + y) >> 2)) % 2 ? 1.06 : 0.9;
          g.px(x, y, shade(f === 'top' ? FC.straw : FC.strawD, k * (1 + (g.r() * 2 - 1) * 0.05)));
        }
        for (let i = 0; i < g.w; i++) for (const [x, y] of [[i, 0], [i, g.h - 1], [0, i], [g.w - 1, i]]) if (g.r() < 0.35) g.clear(x, y);
      } else { weave(g, FC.strawD); for (let x = 0; x < g.w; x++) if (g.r() < 0.3) g.clear(x, 1); } // beirada desfiada
    });
    sk.cube('fcCrown', (g, f) => { weave(g, FC.straw); if (f !== 'top' && f !== 'bottom') { g.rect(0, 4, g.w, 2, FC.band); for (let x = 0; x < g.w; x += 3) g.px(x, 5, FC.mustard); } });
    sk.cube('fcCrownTop', (g) => weave(g, shade(FC.straw, 1.05)));
    // ramos de arruda (verde-azulado, folhinhas recortadas)
    for (const id of ['fcHerbA', 'fcHerbB', 'fcPouchHerbs']) sk.cube(id, (g) => {
      for (const x0 of [1, g.w - 2]) for (let y = 1; y < g.h; y++) { g.px(x0, y, FC.herbD); if (y % 2 === 0) { g.px(x0 - 1, y - 1, FC.herb); g.px(x0 + 1, y - 1, FC.herb); } }
      g.px(1, 0, FC.herb); g.px(g.w - 2, 0, FC.herb);
    });
    // pena escura com brilho azulado
    sk.cube('fcFeather', (g) => {
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        if (y < 3 && (x === 0 || x === g.w - 1)) continue;
        g.px(x, y, x === 1 ? 0xcfc8b8 : y % 4 === 1 && x > 1 ? FC.featherL : FC.feather);
      }
    });
    // blusa escura com cinto de corda; colar de sementes de olho-de-cabra no decote
    sk.cube('fcTorso', (g, f) => {
      g.noise(FC.blouse, 0.06);
      for (let x = 0; x < g.w; x++) { g.px(x, g.h - 4, FC.rope); g.px(x, g.h - 3, shade(FC.rope, 0.8)); }
      if (f === 'front') for (let i = 0; i < 9; i++) { const x = 4 + i, y = 2 + Math.round(4 - Math.abs(i - 4) * 0.9); g.px(x, y, i % 2 ? FC.seed : 0x1a0f0f); }
    });
    // xale de lã cor de vinho com barra mostarda e franjas; aberto em V na frente
    const shawlTex = (g: Face) => { g.noise(FC.shawl, 0.05); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) g.px(x, y, FC.shawlD); };
    const fringe = (g: Face, rows: number) => { for (let j = 0; j < rows; j++) for (let x = 0; x < g.w; x++) if ((x + j) % 2) g.clear(x, g.h - 1 - j); else g.px(x, g.h - 1 - j, shade(FC.shawl, 1.2)); };
    sk.cube('fcShawl', (g, f) => {
      if (f === 'bottom') return;
      shawlTex(g);
      if (f === 'top') return;
      for (let x = 0; x < g.w; x++) g.px(x, g.h - 4, FC.mustard);
      fringe(g, 2);
      if (f === 'front') for (let y = 0; y < g.h - 3; y++) for (let x = 0; x < g.w; x++) if (Math.abs(x + 0.5 - g.w / 2) < 1 + (g.h - 3 - y) * 0.55) g.clear(x, y);
    });
    sk.cube('fcShawlBack', (g) => {
      for (let y = 0; y < g.h; y++) {
        const half = (g.h - y) * 0.56 + 0.3;
        for (let x = 0; x < g.w; x++) {
          const dx = Math.abs(x + 0.5 - g.w / 2);
          if (dx > half) continue;
          g.px(x, y, dx > half - 1 ? ((x + y) % 2 ? shade(FC.shawl, 1.2) : FC.mustard) : (x + y) % 4 === 0 ? FC.shawlD : FC.shawl);
        }
      }
    });
    // saia de chita escura: florzinhas vermelhas e mostarda com folhinhas; barra em babado
    const chita = (g: Face) => {
      g.noise(FC.skirt, 0.05);
      for (let y = 2; y < g.h; y += 6) for (let x = ((y / 6) % 2) * 3 + 1; x < g.w; x += 6) {
        g.px(x, y, FC.flowerY);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.px(x + dx, y + dy, FC.flowerR);
        g.px(x + 2, y + 2, FC.leaf); g.px(x - 2, y + 2, FC.leaf);
      }
    };
    sk.cube('fcSkirt', (g, f) => { if (f === 'top' || f === 'bottom') g.noise(shade(FC.skirt, 0.7), 0.05); else chita(g); });
    sk.cube('fcHem', (g, f) => {
      if (f === 'top' || f === 'bottom') { g.noise(0x140f1e, 0.05); return; }
      chita(g);
      for (let x = 0; x < g.w; x += 2) for (let y = 0; y < g.h; y++) dim(g, x, y, 0.82);
      for (let x = 0; x < g.w; x++) { g.px(x, 0, FC.flowerR); g.px(x, g.h - 1, shade(FC.skirt, 0.6)); }
    });
    // bolsa de couro com aba costurada e botão de osso
    sk.cube('fcPouch', (g, f) => {
      g.noise(FC.pouch, 0.08);
      if (f === 'front') { g.rect(0, 0, g.w, 2, shade(FC.pouch, 0.75)); g.px(g.w >> 1, 2, 0xe0d6c0); for (let x = 0; x < g.w; x += 2) g.px(x, g.h - 1, shade(FC.pouch, 1.3)); }
    });
    // braços: manga escura, punho com pulseira de sementes, mão ossuda
    sk.cube('fcArmR', (g) => g.noise(FC.blouse, 0.06));
    sk.cube('fcForeR', (g, f) => {
      g.noise(FC.skin, 0.05);
      if (f !== 'bottom') { g.rect(0, 0, g.w, f === 'top' ? g.h : 5, FC.blouse); for (let x = 0; x < g.w; x++) g.px(x, 5, x % 2 ? FC.seed : 0x1a0f0f); }
      if (f === 'front' || f === 'bottom') for (let x = 1; x < g.w; x += 2) g.px(x, g.h - 1, FC.line);
    });
    sk.cube('fcLegR', (g, f) => { g.noise(0x241c28, 0.05); if (f !== 'top') { g.rect(0, g.h - 2, g.w, 2, FC.shoe); g.rect(0, g.h - 1, g.w, 1, 0x7a6a50); } if (f === 'bottom') g.fill(0x7a6a50); });
  },
  animate(p, s) {
    head(p, s);
    biped(p, s, { legAmp: 0.6, armAmp: 0.6 });
    p.foreR.rotation.x -= 0.15; p.foreL.rotation.x -= 0.3; // cotovelos dobrados
    p.skirt.rotation.x += Math.cos(s.swing * 0.6662) * 0.06 * s.amount;
    p.feather.rotation.z += Math.sin(s.t * 0.09) * 0.05;
    // bebendo: o braço direito leva a garrafa à boca e a cabeça inclina para trás
    if ((s.e as Feiticeira).drinking > 0) {
      p.armR.rotation.set(-1.86, 0.59, 0); // cotovelo à frente, na altura do ombro
      p.foreR.rotation.set(-0.98, 0, 0); // mão logo acima e à frente da boca
      p.head.rotation.x = p.head.userData.rest.x - 0.45;
    }
  },
};

// ------------------------------------------------------------------ specs
export const SPECS_MONSTROS3: Record<string, MobModelSpec> = {
  pavio: {
    def: PAVIO,
    pose(inst, e, s) {
      const pv = e as Pavio;
      const f = (pv.prevSwell + (pv.swell - pv.prevSwell) * s.alpha) / 28;
      const fc = Math.max(0, Math.min(1, f));
      // incha (até +40% na horizontal, +10% na vertical) com tremor
      const trem = 1 + Math.sin(s.t * 2.9) * fc * 0.025, g = fc * fc;
      inst.parts.body.scale.set((1 + g * 0.4) * trem, (1 + g * 0.1) / trem, (1 + g * 0.4) * trem);
      if (fc > 0) inst.parts.fuse.rotation.z += Math.sin(s.t * 1.7) * 0.2 * fc;
      // rachaduras e olhos acendem; a brasa do pavio tremula
      const cm = partMat(inst.parts.cracks);
      if (cm) cm.uniforms.uEmissive.value = 0.08 + fc * 1.5 + (fc > 0 ? Math.sin(s.t * 1.3) * 0.12 * fc : 0);
      const em = partMat(inst.parts.ember);
      if (em) em.uniforms.uEmissive.value = 0.9 + fc * 1.1 + Math.sin(s.t * 2.3) * 0.12;
      // clarão branco intermitente
      if (f > 0 && Math.floor(f * 10) % 2 === 0) {
        const a = Math.min(1, Math.max(0.5, f));
        for (const mt of inst.mats) mt.uniforms.uOverlay.value.set(1, 1, 1, a);
      }
      // carregado: aura elétrica em dois quadros alternados
      const fr = Math.floor(s.t / 2) % 2 === 0;
      inst.parts.aura1.visible = pv.charged && fr;
      inst.parts.aura2.visible = pv.charged && !fr;
      const mt = inst.mats.find((m) => m.defines?.TRANSLUCENT);
      if (mt) mt.uniforms.uEmissive.value = pv.charged ? 0.45 : 0;
    },
  },
  // a garrafa (item da mão) fica no punho `drinkHand`; o deslocamento centra o bojo do frasco na mão
  feiticeira: {
    def: FEITICEIRA, hand: 'drinkHand', handOffset: [0, 0, 3.3],
  },
};
