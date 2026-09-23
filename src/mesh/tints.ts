import { rgb565 } from '../core/math';
import { BLOCKS, STATE_PROPS, BLOCK_OF } from '../world/blocks/registry';

const BIRCH = rgb565(0x80, 0xa7, 0x55);
const SPRUCE = rgb565(0x61, 0x99, 0x61);
const LUME = rgb565(0xa8, 0xf0, 0xff);

/** Rampa do pó de fulgor (visual próprio: azul-ciano elétrico). */
export const FULGOR_RAMP: number[] = Array.from({ length: 16 }, (_, p) => {
  const t = p / 15;
  const r = 20 + t * 60, g = 70 + t * 170, b = 90 + t * 165;
  return rgb565(r, g, b);
});
export const FULGOR_RGB: [number, number, number][] = Array.from({ length: 16 }, (_, p) => {
  const t = p / 15;
  return [(20 + t * 60) / 255, (70 + t * 170) / 255, (90 + t * 165) / 255];
});

const STEM_RAMP: number[] = Array.from({ length: 8 }, (_, a) => rgb565(a * 32, 255 - a * 8, a * 4));

export function tintColor(kind: number, state: number, tints: Uint16Array, x: number, z: number): number {
  const i = ((z << 4) | x) * 3;
  switch (kind) {
    case 1: return tints[i];
    case 2: return tints[i + 1];
    case 3: return tints[i + 2];
    case 4: return BIRCH;
    case 5: return SPRUCE;
    case 6: return FULGOR_RAMP[(STATE_PROPS[state]?.power as number) ?? 0];
    case 7: {
      const p = STATE_PROPS[state];
      if (p && 'age' in p) return STEM_RAMP[p.age as number];
      return rgb565(0xe0, 0xc7, 0x1c);
    }
    case 8: return LUME;
    default: return 0xffff;
  }
}

export const blockNameFast = (s: number): string => BLOCKS[BLOCK_OF[s]].name;
