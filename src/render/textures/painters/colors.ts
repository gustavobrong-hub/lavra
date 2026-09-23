/**
 * Blocos das 16 tinturas: lã, vidro colorido, terracota, concreto e concreto em pó.
 * Cada estilo gera uma rampa de tons a partir da cor-base; aqui a base é ajustada por estilo
 * para o branco não estourar, o preto não virar cinza e as 16 cores continuarem distintas.
 */
import { Tex, type Painter, type RGB, hex, mix, scale } from '../tex';
import { concrete, powder, stainedGlass, terracotta, wool } from '../styles';
import { COLORS } from '../../../world/blocks/defs/building';

const WHITE: RGB = [255, 255, 255];
/** Barro cozido: puxa as tinturas para tons terrosos na terracota. */
const CLAY: RGB = hex(0x98603f);

const lum = (c: RGB): number => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
const toHex = (c: RGB): number => c.reduce((h, v) => (h << 8) | Math.max(0, Math.min(255, Math.round(v))), 0);

/** Limita o canal mais forte a `max` (tons claros da rampa sem estourar) e garante luminância mínima `floor`. */
function fit(c: RGB, max: number, floor: number): number {
  const m = Math.max(c[0], c[1], c[2]);
  const o = m > max ? scale(c, max / m) : c;
  const l = lum(o);
  return toHex(l < floor ? [o[0] + floor - l, o[1] + floor - l, o[2] + floor - l] : o);
}

/** Tintura misturada ao barro, mantendo parte da luminância original (preto continua escuro, branco claro). */
function earth(c: RGB): RGB {
  const m = mix(c, CLAY, 0.42);
  return scale(m, (lum(c) + lum(m)) / 2 / lum(m));
}

/** Vidro colorido: estilo base + reflexos (o estilo os cobre com a tinta), moldura em relevo e mais escura nas cores escuras. */
function tintedGlass(t: Tex, c: RGB): void {
  stainedGlass(t, toHex(c));
  const frame = lum(c) < 60 ? mix(c, WHITE, 0.14) : mix(c, WHITE, 0.35);
  for (let i = 0; i < 16; i++) {
    t.px(i, 0, mix(frame, WHITE, 0.12), 235); t.px(0, i, mix(frame, WHITE, 0.12), 235);
    t.px(i, 15, scale(frame, 0.82), 235); t.px(15, i, scale(frame, 0.82), 235);
  }
  for (const [x0, y0, len] of [[3, 3, 3], [4, 3, 2], [10, 9, 4], [11, 9, 2]]) {
    for (let i = 0; i < len; i++) t.px(x0 + i, y0 + i, mix(c, WHITE, 0.6), 170);
  }
}

/** Concreto: estilo liso + poros miúdos (não parece "sem textura" de perto). */
function concreteBlock(t: Tex, base: number): void {
  concrete(t, base);
  t.speckle(scale(hex(base), 0.9), 0.035, 13, -0.08);
}

/** Pó: estilo granulado, com as manchas grandes atenuadas (senão a repetição do bloco aparece). */
function powderBlock(t: Tex, base: number): void {
  powder(t, base);
  const b = hex(base), lb = lum(b);
  // achata mais as manchas escuras que os grãos claros
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.blend(x, y, b, lum(t.get(x, y)) < lb ? 0.55 : 0.3);
}

export const COLOR_PAINTERS: Record<string, Painter> = {};
for (const { id, rgb } of COLORS) {
  const c = hex(rgb);
  COLOR_PAINTERS[`${id}_wool`] = (t) => wool(t, fit(c, 214, 36));
  COLOR_PAINTERS[`${id}_stained_glass`] = (t) => tintedGlass(t, c);
  COLOR_PAINTERS[`${id}_terracotta`] = (t) => terracotta(t, fit(earth(c), 226, 30));
  COLOR_PAINTERS[`${id}_concrete`] = (t) => concreteBlock(t, fit(c, 232, 26));
  COLOR_PAINTERS[`${id}_concrete_powder`] = (t) => powderBlock(t, fit(mix(c, WHITE, 0.14), 216, 50));
}
