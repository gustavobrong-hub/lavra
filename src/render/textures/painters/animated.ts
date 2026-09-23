/**
 * Pintores animados do grupo C (16 quadros, laço perfeito): fogo comum (duas variações), fogo das almas
 * e portal do Ínfero. Todo movimento usa a fase t.frame/t.frames com funções periódicas (período 1) e
 * ruídos periódicos deslocados em múltiplos de 16 px, então o quadro 16 coincide com o quadro 0.
 */
import { Tex, type Painter, pal } from '../tex';
import { PAL, clamp01, fireShape, flamePx, pick, type Tongue } from './utility2';

const TAU = Math.PI * 2;

/** Faíscas que sobem e reaparecem embaixo (uma volta completa por laço). */
function sparks(t: Tex, list: [number, number, number][], hot: number): void {
  const f = t.frame / t.frames;
  for (const [x0, y0, sway] of list) {
    const y = Math.floor((((y0 - f * 16) % 16) + 16) % 16);
    const x = Math.round(x0 + Math.sin(TAU * (f + sway)) * 1.2);
    if (y > 11) continue;
    if (t.alpha(x, y) === 0) flamePx(t, x, y, hot);
  }
}

function fire(t: Tex, p: typeof PAL.flame, salt: number, tongues: Tongue[], sp: [number, number, number][]): void {
  fireShape(t, p, t.frame / t.frames, salt, tongues);
  sparks(t, sp, 0.85);
}

const PORTAL = pal(0x2a0606, 0x4a0c08, 0x701808, 0x9a2a0c, 0xc44814, 0xe87424, 0xffa844, 0xffd488);

export const ANIMATED_PAINTERS: Record<string, Painter> = {
  fire_0: (t) => fire(t, PAL.flame, 31, [[2, 12, 2.4, 0], [6.5, 15, 2.8, 0.33], [10.8, 10, 2.4, 0.66], [14, 13, 2.2, 0.15]], [[5, 4, 0.1], [12, 12, 0.6]]),
  fire_1: (t) => fire(t, PAL.flame, 47, [[1, 10, 2.2, 0.5], [4.6, 14, 2.6, 0.8], [8.6, 11, 2.4, 0.1], [12.6, 15, 2.8, 0.45]], [[3, 9, 0.3], [10, 1, 0.8]]),
  soul_fire_0: (t) => fire(t, PAL.soul, 53, [[1.5, 11, 2.2, 0.2], [5.5, 14, 2.4, 0.55], [9.5, 12, 2.2, 0.9], [13, 15, 2.6, 0.35]], [[7, 6, 0.4], [14, 13, 0.1]]),
  portal: (t) => {
    const f = t.frame / t.frames;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      // redemoinho: deformação periódica que gira com o tempo (repete lado a lado e no tempo)
      const wx = x + Math.sin(TAU * (y / 16 + f)) * 2.6 + Math.sin(TAU * ((x + y) / 16 - f)) * 1.2;
      const wy = y + Math.cos(TAU * (x / 16 - f)) * 2.6 + Math.cos(TAU * ((x - y) / 16 + f)) * 1.2;
      const a = t.vnoise(wx, wy, 4, 1);
      const b = t.vnoise(wx + f * 16, wy - f * 16, 8, 2);
      const ridge = 1 - Math.abs(a * 2 - 1);
      const v = clamp01(Math.pow(ridge, 2.6) * 0.95 + b * 0.28);
      t.px(x, y, pick(PORTAL, v), Math.round(150 + v * 80));
      t.h(x, y, 0.5);
      t.m(x, y, 0.6, 0, 0, 0.5 + v * 0.5);
    }
  },
};
