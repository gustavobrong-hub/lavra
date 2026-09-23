/**
 * Vaca do Lavra: zebu (estilo nelore) — pelagem branco-acinzentada, cupim sobre a cernelha, barbela,
 * orelhas caídas e chifres curtos. Modelo de referência dos quadrúpedes.
 */
import type { ModelDef } from '../boxmodel';
import { head, quadLegs, tailWag } from '../anim';
import type { Face } from '../skin';

const COAT = 0xd8d4cb, COAT_D = 0x8f8a82, HOOF = 0x2e2621, MUZZLE = 0x5a4f4a, HORN = 0xd9ccb0;

export const COW: ModelDef = {
  id: 'cow',
  parts: [
    {
      name: 'body', pivot: [0, 16, 0],
      cubes: [
        { o: [-5, 11, -9], s: [10, 10, 18] },
        { id: 'hump', o: [-3, 21, 2], s: [6, 4, 5] },
        { id: 'dewlap', o: [-1, 8, 6], s: [2, 4, 4] },
      ],
    },
    {
      name: 'head', pivot: [0, 19, 9],
      cubes: [
        { o: [-3.5, 15, 9], s: [7, 8, 7] },
        { id: 'muzzle', o: [-2.5, 14, 16], s: [5, 4, 2] },
        { id: 'earR', o: [-6.5, 19, 12], s: [3, 1, 2] },
        { id: 'earL', o: [3.5, 19, 12], s: [3, 1, 2], mirror: true, skinOf: 'earR' },
        { id: 'hornR', o: [-3.5, 23, 11], s: [1, 2, 1] },
        { id: 'hornL', o: [2.5, 23, 11], s: [1, 2, 1], skinOf: 'hornR' },
      ],
    },
    { name: 'legFR', pivot: [-3, 12, 6], cubes: [{ o: [-5, 0, 4], s: [4, 12, 4] }] },
    { name: 'legFL', pivot: [3, 12, 6], cubes: [{ o: [1, 0, 4], s: [4, 12, 4], mirror: true, skinOf: 'legFR' }] },
    { name: 'legBR', pivot: [-3, 12, -6], cubes: [{ o: [-5, 0, -8], s: [4, 12, 4] }] },
    { name: 'legBL', pivot: [3, 12, -6], cubes: [{ o: [1, 0, -8], s: [4, 12, 4], mirror: true, skinOf: 'legBR' }] },
    { name: 'tail', pivot: [0, 20, -9], rot: [12, 0, 0], cubes: [{ o: [-0.5, 10, -9.5], s: [1, 10, 1] }, { id: 'tuft', o: [-1, 8, -10], s: [2, 3, 2] }] },
  ],
  paint(sk) {
    const coat = (g: Face) => g.fur(COAT, 0xbfbab1, 0xeeebe4, 0.5);
    sk.cube('body', (g, f) => {
      coat(g);
      if (f === 'top') g.rect(0, 0, g.w, g.h, 0).noise(0xdcd8cf, 0.06);
      // escurecimento do pescoço/dianteira (nelore)
      if (f === 'left' || f === 'right') {
        const front = f === 'left' ? 0 : g.w - 1;
        for (let x = 0; x < 8; x++) for (let y = 0; y < g.h; y++) {
          const xx = f === 'left' ? front + x : front - x;
          if (sk.r() < (8 - x) / 10) g.px(xx, y, 0xa9a49c);
        }
      }
      if (f === 'front') g.vgrad(0xa9a49c, 0xc9c5bc, 0.08);
      if (f === 'bottom') g.noise(0xc4bfb6, 0.05);
    });
    sk.cube('hump', (g) => g.fur(COAT_D, 0x7b766f, 0xa8a39b, 0.5));
    sk.cube('dewlap', (g) => g.fur(0xc9c5bc, 0xb3aea5, 0xd9d6cf, 0.4));
    sk.cube('head', (g, f) => {
      g.fur(0xb9b4ab, 0x9c978f, 0xd2cec6, 0.45);
      if (f === 'front') {
        // testa clara, olhos dos lados, focinho escuro embaixo
        g.rect(2, 0, g.w - 4, 5, 0xd2cec6).noise(0xcfcac2, 0.04);
        for (const ex of [0, g.w - 3]) { g.rect(ex, 7, 3, 3, 0x1d1a18); g.px(ex + (ex ? 0 : 2), 7, 0x6b5f57); g.px(ex + 1, 8, 0x3b2f2a); }
        g.rect(1, g.h - 4, g.w - 2, 4, 0x8f8a82);
      }
      if (f === 'left' || f === 'right') { const ex = f === 'left' ? 2 : g.w - 5; g.rect(ex, 7, 3, 3, 0x1d1a18); g.px(ex + 1, 7, 0x7d7169); }
      if (f === 'top') g.noise(0xc4bfb6, 0.05);
    });
    sk.cube('muzzle', (g, f) => {
      g.noise(MUZZLE, 0.08);
      if (f === 'front') { g.px(2, 3, 0x1a1412); g.px(3, 3, 0x1a1412); g.px(g.w - 3, 3, 0x1a1412); g.px(g.w - 4, 3, 0x1a1412); g.rect(1, g.h - 2, g.w - 2, 1, 0x40362f); }
    });
    sk.cube('earR', (g, f) => { g.noise(0xb3ada4, 0.06); if (f === 'bottom' || f === 'front') g.rect(1, 0, g.w - 2, g.h, 0xc99d8f); });
    sk.cube('hornR', (g, f) => g.vgrad(f === 'top' ? 0x5a4a3a : 0xb0a386, HORN, 0.05));
    for (const l of ['legFR', 'legBR']) sk.cube(l, (g, f) => {
      g.fur(0xcfcbc2, 0xb7b2a9, 0xe4e0d8, 0.4);
      if (f !== 'top' && f !== 'bottom') { g.rect(0, g.h - 4, g.w, 4, HOOF); g.rect(0, g.h - 5, g.w, 1, 0x5a524b); }
      if (f === 'bottom') g.fill(HOOF);
    });
    sk.cube('tail', (g) => g.noise(0xbdb8af, 0.08));
    sk.cube('tuft', (g) => g.noise(0x2f2a26, 0.15));
  },
  animate(p, s) {
    head(p, s);
    quadLegs(p, s);
    tailWag(p, s, 'tail', 0.12, 0.12);
  },
};
