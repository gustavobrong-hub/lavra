/**
 * Ruídos determinísticos: Perlin "melhorado" 3D (como o ImprovedNoise do original), oitavas,
 * NormalNoise (duas oitavas somadas, distribuição mais normal) e Simplex 2D rápido.
 */
import { Random } from './rng';

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

function grad(h: number, x: number, y: number, z: number): number {
  switch (h & 15) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    case 3: return -x - y;
    case 4: return x + z;
    case 5: return -x + z;
    case 6: return x - z;
    case 7: return -x - z;
    case 8: return y + z;
    case 9: return -y + z;
    case 10: return y - z;
    case 11: return -y - z;
    case 12: return x + y;
    case 13: return -y + z;
    case 14: return -x + y;
    default: return -y - z;
  }
}

export class Perlin {
  readonly p = new Uint8Array(512);
  readonly xo: number;
  readonly yo: number;
  readonly zo: number;

  constructor(rng: Random) {
    this.xo = rng.next() * 256;
    this.yo = rng.next() * 256;
    this.zo = rng.next() * 256;
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }

  noise(x: number, y: number, z: number): number {
    x += this.xo; y += this.yo; z += this.zo;
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const xf = x - X, yf = y - Y, zf = z - Z;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const p = this.p;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const a = p[xi] + yi, aa = p[a] + zi, ab = p[a + 1] + zi;
    const b = p[xi + 1] + yi, ba = p[b] + zi, bb = p[b + 1] + zi;
    const x1 = xf - 1, y1 = yf - 1, z1 = zf - 1;
    const g000 = grad(p[aa], xf, yf, zf), g100 = grad(p[ba], x1, yf, zf);
    const g010 = grad(p[ab], xf, y1, zf), g110 = grad(p[bb], x1, y1, zf);
    const g001 = grad(p[aa + 1], xf, yf, z1), g101 = grad(p[ba + 1], x1, yf, z1);
    const g011 = grad(p[ab + 1], xf, y1, z1), g111 = grad(p[bb + 1], x1, y1, z1);
    const x00 = g000 + u * (g100 - g000);
    const x10 = g010 + u * (g110 - g010);
    const x01 = g001 + u * (g101 - g001);
    const x11 = g011 + u * (g111 - g011);
    const y0 = x00 + v * (x10 - x00);
    const y1v = x01 + v * (x11 - x01);
    return y0 + w * (y1v - y0);
  }
}

/** Soma de oitavas no estilo do original: firstOctave define a frequência mais baixa (2^firstOctave). */
export class OctaveNoise {
  private readonly octaves: (Perlin | null)[] = [];
  private readonly amps: number[];
  private readonly lowestFreqInput: number;
  private readonly lowestFreqValue: number;

  constructor(rng: Random, firstOctave: number, amplitudes: number[]) {
    this.amps = amplitudes;
    for (let i = 0; i < amplitudes.length; i++) {
      const p = new Perlin(rng);
      this.octaves.push(amplitudes[i] !== 0 ? p : null);
    }
    this.lowestFreqInput = Math.pow(2, firstOctave);
    const n = amplitudes.length;
    this.lowestFreqValue = Math.pow(2, n - 1) / (Math.pow(2, n) - 1);
  }

  sample(x: number, y: number, z: number): number {
    let v = 0;
    let fin = this.lowestFreqInput;
    let fval = this.lowestFreqValue;
    for (let i = 0; i < this.octaves.length; i++) {
      const o = this.octaves[i];
      if (o) v += this.amps[i] * o.noise(x * fin, y * fin, z * fin) * fval;
      fin *= 2;
      fval /= 2;
    }
    return v;
  }

  /** Valor máximo teórico (para normalizações). */
  maxValue(): number {
    let v = 0, fval = this.lowestFreqValue;
    for (const a of this.amps) { v += Math.abs(a) * fval; fval /= 2; }
    return v;
  }
}

/** Duas oitavas deslocadas somadas — distribuição próxima da normal em [-1,1]. */
export class NormalNoise {
  private readonly a: OctaveNoise;
  private readonly b: OctaveNoise;
  private readonly factor: number;

  constructor(rng: Random, firstOctave: number, amplitudes: number[]) {
    this.a = new OctaveNoise(rng, firstOctave, amplitudes);
    this.b = new OctaveNoise(rng, firstOctave, amplitudes);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < amplitudes.length; i++) if (amplitudes[i] !== 0) { lo = Math.min(lo, i); hi = Math.max(hi, i); }
    const span = hi - lo;
    const expectedDeviation = 0.1 * (1 + 1 / (span + 1));
    this.factor = (1 / 6) / expectedDeviation;
  }

  sample(x: number, y: number, z: number): number {
    const k = 1.0181268882175227;
    return (this.a.sample(x, y, z) + this.b.sample(x * k, y * k, z * k)) * this.factor;
  }
}

// ---------------------------------------------------------------- Simplex 2D
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD2 = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1]);

export class Simplex2 {
  private readonly perm = new Uint8Array(512);

  constructor(rng: Random) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** Retorna aproximadamente [-1, 1]. */
  noise(xin: number, yin: number): number {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = (perm[ii + perm[jj]] & 7) << 1;
      t0 *= t0;
      n += t0 * t0 * (GRAD2[g] * x0 + GRAD2[g + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = (perm[ii + i1 + perm[jj + j1]] & 7) << 1;
      t1 *= t1;
      n += t1 * t1 * (GRAD2[g] * x1 + GRAD2[g + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = (perm[ii + 1 + perm[jj + 1]] & 7) << 1;
      t2 *= t2;
      n += t2 * t2 * (GRAD2[g] * x2 + GRAD2[g + 1] * y2);
    }
    return 70 * n;
  }

  /** fBm de n oitavas. */
  fbm(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
