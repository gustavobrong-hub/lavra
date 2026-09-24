/**
 * Mapa das nuvens em blocos: 1024×1024 células (12×12 blocos cada), ruído de valor periódico em três
 * oitavas, equalizado para que "cheia se valor > 1 − cobertura" dê exatamente a fração pedida.
 */

function hash(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 144269504) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x: number, z: number, period: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const m = (v: number) => ((v % period) + period) % period;
  const x0 = m(ix), x1 = m(ix + 1), z0 = m(iz), z1 = m(iz + 1);
  const a = hash(x0, z0, seed), b = hash(x1, z0, seed), c = hash(x0, z1, seed), d = hash(x1, z1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export const CLOUD_MAP_SIZE = 1024;

export function buildCloudMap(seed = 7): Uint8Array {
  const N = CLOUD_MAP_SIZE;
  const raw = new Float32Array(N * N);
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const v = vnoise(x / 9.142857, z / 9.142857, 112, seed) * 0.58
        + vnoise(x / 4, z / 4, 256, seed + 1) * 0.28
        + vnoise(x / 2, z / 2, 512, seed + 2) * 0.14;
      raw[z * N + x] = v;
    }
  }
  // equalização por histograma
  const BINS = 4096;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < raw.length; i++) hist[Math.min(BINS - 1, Math.floor(raw[i] * BINS))]++;
  const cdf = new Float32Array(BINS);
  let acc = 0;
  for (let i = 0; i < BINS; i++) { acc += hist[i]; cdf[i] = acc / raw.length; }
  const out = new Uint8Array(N * N);
  for (let i = 0; i < raw.length; i++) out[i] = Math.round(cdf[Math.min(BINS - 1, Math.floor(raw[i] * BINS))] * 255);
  return out;
}
