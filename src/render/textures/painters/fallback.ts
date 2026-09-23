import { fmix32 } from '../../../core/rng';
import { Tex, ramp } from '../tex';

/** Textura provisória para nomes sem pintor: ruído numa cor derivada do nome (nunca fica rosa-choque). */
export function fallbackPainter(t: Tex): void {
  let h = 7;
  for (let i = 0; i < t.name.length; i++) h = fmix32(h ^ t.name.charCodeAt(i));
  const r = 80 + (h & 127), g = 80 + ((h >> 8) & 127), b = 80 + ((h >> 16) & 127);
  t.noisePal(ramp([r, g, b], 5, 0.25));
}
