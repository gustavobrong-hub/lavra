/**
 * Parâmetros climáticos multi-ruído (como a geração moderna): temperatura, umidade,
 * continentalidade, erosão e estranheza (→ picos e vales). Amostrados em "quartos" (x/4).
 */
import { NormalNoise } from '../../core/noise';
import { Random, subSeed } from '../../core/rng';

export interface ClimatePoint {
  t: number; // temperatura
  h: number; // umidade/vegetação
  c: number; // continentalidade
  e: number; // erosão
  w: number; // estranheza
  pv: number; // picos e vales = 1 - |3|w| - 2|
}

export const peaksValleys = (w: number): number => 1 - Math.abs(3 * Math.abs(w) - 2);

export class Climate {
  private readonly temperature: NormalNoise;
  private readonly humidity: NormalNoise;
  private readonly continental: NormalNoise;
  private readonly erosion: NormalNoise;
  private readonly weirdness: NormalNoise;
  private readonly shift: NormalNoise;

  constructor(seed: number) {
    const r = (n: string) => new Random(subSeed(seed, n));
    this.temperature = new NormalNoise(r('temperature'), -10, [1.5, 0, 1, 0, 0, 0]);
    this.humidity = new NormalNoise(r('vegetation'), -8, [1, 1, 0, 0, 0, 0]);
    this.continental = new NormalNoise(r('continentalness'), -9, [1, 1, 2, 2, 2, 1, 1, 1, 1]);
    this.erosion = new NormalNoise(r('erosion'), -9, [1, 1, 0, 1, 1]);
    this.weirdness = new NormalNoise(r('ridge'), -7, [1, 2, 1, 0, 0, 0]);
    this.shift = new NormalNoise(r('offset'), -3, [1, 1, 1, 0]);
  }

  /** Amostra em coordenadas de bloco. */
  sample(x: number, z: number, out: ClimatePoint): ClimatePoint {
    const qx = x / 4, qz = z / 4;
    // deslocamento de domínio (formas mais orgânicas)
    const sx = qx + this.shift.sample(qx, 0, qz) * 4;
    const sz = qz + this.shift.sample(qz, qx, 0) * 4;
    out.t = this.temperature.sample(sx, 0, sz);
    out.h = this.humidity.sample(sx, 0, sz);
    // leve viés para terra firme perto da origem (o jogador nasce em terra)
    out.c = this.continental.sample(sx, 0, sz) + 0.12;
    out.e = this.erosion.sample(sx, 0, sz);
    out.w = this.weirdness.sample(sx, 0, sz);
    out.pv = peaksValleys(out.w);
    return out;
  }
}

export const newClimatePoint = (): ClimatePoint => ({ t: 0, h: 0, c: 0, e: 0, w: 0, pv: 0 });
