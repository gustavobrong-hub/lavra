/**
 * Formato do terreno: altura-alvo a partir do clima + densidade 3D numa grade grossa (4×8×4) interpolada,
 * cavernas (queijo, espaguete, talharim) numa grade 4×4×4 e aquíferos.
 * Colunas da grade ficam em cache para que features em chunks vizinhos leiam exatamente a mesma superfície.
 */
import { MAX_Y, MIN_Y, SEA_LEVEL } from '../../core/constants';
import { clamp, lerp, smoothstep } from '../../core/math';
import { OctaveNoise, Simplex2 } from '../../core/noise';
import { Random, subSeed } from '../../core/rng';
import { Climate, type ClimatePoint, newClimatePoint } from './climate';
import { pickBiome } from './biomes';

export const CELL_XZ = 4;
export const CELL_Y = 8;
export const NY = (MAX_Y - MIN_Y) / CELL_Y + 1; // 49
export const CAVE_Y = 4;
export const NCY = (MAX_Y - MIN_Y) / CAVE_Y + 1; // 97

export interface TerrainParams {
  h: number;
  amp: number;
  mountain: number;
  river: number;
  biome: number;
  ocean: boolean;
  cp: ClimatePoint;
}

function spline(x: number, pts: readonly (readonly [number, number])[]): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const t = (x - x0) / (x1 - x0);
      const s = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return pts[pts.length - 1][1];
}

const CONT: [number, number][] = [
  [-1.3, 26], [-0.8, 32], [-0.455, 40], [-0.3, 47], [-0.19, 53], [-0.14, 58.5], [-0.11, 62.2],
  [-0.06, 64.2], [0.05, 66.5], [0.25, 71], [0.5, 78], [0.8, 86], [1.2, 94],
];

export class TerrainSampler {
  readonly climate: Climate;
  private readonly base3d: OctaveNoise;
  private readonly detail3d: OctaveNoise;
  private readonly jag: Simplex2;
  private readonly cheese: OctaveNoise;
  private readonly spag1: OctaveNoise;
  private readonly spag2: OctaveNoise;
  private readonly spagRad: OctaveNoise;
  private readonly noodle1: OctaveNoise;
  private readonly noodle2: OctaveNoise;
  private readonly entrance: OctaveNoise;
  private readonly aquifer: OctaveNoise;
  private readonly paramCache = new Map<number, TerrainParams>();
  private readonly colCache = new Map<number, Float32Array>();
  private readonly caveCache = new Map<number, Float32Array>();

  constructor(readonly seed: number) {
    const r = (n: string) => new Random(subSeed(seed, n));
    this.climate = new Climate(seed);
    this.base3d = new OctaveNoise(r('base3d'), -7, [1, 1, 1, 1, 0.5]);
    this.detail3d = new OctaveNoise(r('detail3d'), -4, [1, 0.5]);
    this.jag = new Simplex2(r('jagged'));
    this.cheese = new OctaveNoise(r('cheese'), -7, [0.8, 0.6, 0.3]);
    this.spag1 = new OctaveNoise(r('spag1'), -6, [1, 0.3]);
    this.spag2 = new OctaveNoise(r('spag2'), -6, [1, 0.3]);
    this.spagRad = new OctaveNoise(r('spagRad'), -7, [1]);
    this.noodle1 = new OctaveNoise(r('noodle1'), -5, [1]);
    this.noodle2 = new OctaveNoise(r('noodle2'), -5, [1]);
    this.entrance = new OctaveNoise(r('entrance'), -8, [1, 0.5]);
    this.aquifer = new OctaveNoise(r('aquifer'), -6, [1]);
  }

  /** Parâmetros do terreno numa coluna da grade (múltiplos de 4). */
  params(x: number, z: number): TerrainParams {
    const k = (x + 4194304) * 8388608 + (z + 4194304);
    let p = this.paramCache.get(k);
    if (p) return p;
    const cp = this.climate.sample(x, z, newClimatePoint());
    const { c, e, pv } = cp;
    let h = spline(c, CONT);
    const inland = smoothstep(-0.19, 0.15, c);
    const mountain = smoothstep(0.05, -0.7, e) * inland;
    const peak = Math.max(0, pv);
    const jag = 1 - Math.abs(this.jag.noise(x / 90, z / 90));
    h += mountain * (18 + 118 * peak * peak + 34 * peak * jag * jag);
    const hilly = (1 - smoothstep(-0.25, 0.65, e)) * (1 - mountain) * inland;
    h += hilly * pv * 13;
    const river = smoothstep(-0.72, -0.93, pv) * smoothstep(-0.15, -0.06, c) * (1 - mountain * 0.9);
    h = lerp(h, 58.8, river);
    const flat = smoothstep(0.5, 0.72, e) * inland * (1 - river);
    h = lerp(h, 63.6, flat * 0.7);
    const amp = 1.6 + 13 * mountain * (0.4 + 0.6 * peak) + 4 * hilly + 1.2 * inland;
    const biome = pickBiome(cp, h);
    p = { h, amp, mountain, river, biome, ocean: h < SEA_LEVEL - 3 && c < -0.11, cp };
    if (this.paramCache.size > 60000) this.paramCache.clear();
    this.paramCache.set(k, p);
    return p;
  }

  /** Densidade do terreno (sem cavernas) nos 49 níveis de uma coluna da grade (x,z múltiplos de 4). */
  column(gx: number, gz: number): Float32Array {
    const k = (gx + 4194304) * 8388608 + (gz + 4194304);
    let col = this.colCache.get(k);
    if (col) return col;
    col = new Float32Array(NY);
    const p = this.params(gx, gz);
    const top = p.h + p.amp * 1.3 + 8;
    const bottom = p.h - p.amp * 1.3 - 8;
    for (let i = 0; i < NY; i++) {
      const y = MIN_Y + i * CELL_Y;
      let d: number;
      if (y > top) d = -(y - top) - 1;
      else if (y < bottom) d = bottom - y + 1;
      else {
        const n = this.base3d.sample(gx, y * 1.35, gz) * 1.25 + this.detail3d.sample(gx, y, gz) * 0.18;
        d = (p.h - y) + n * p.amp * 2.2;
      }
      if (y < MIN_Y + 8) d += (MIN_Y + 8 - y) * 4;
      col[i] = d;
    }
    if (this.colCache.size > 20000) this.colCache.clear();
    this.colCache.set(k, col);
    return col;
  }

  /** Densidade interpolada em um ponto (usada por features e por consultas de altura). */
  density(x: number, y: number, z: number): number {
    const gx = Math.floor(x / CELL_XZ) * CELL_XZ, gz = Math.floor(z / CELL_XZ) * CELL_XZ;
    const tx = (x - gx) / CELL_XZ, tz = (z - gz) / CELL_XZ;
    const iy = Math.floor((y - MIN_Y) / CELL_Y);
    const ty = (y - MIN_Y - iy * CELL_Y) / CELL_Y;
    const i0 = clamp(iy, 0, NY - 1), i1 = clamp(iy + 1, 0, NY - 1);
    const c00 = this.column(gx, gz), c10 = this.column(gx + 4, gz), c01 = this.column(gx, gz + 4), c11 = this.column(gx + 4, gz + 4);
    const a = lerp(lerp(c00[i0], c10[i0], tx), lerp(c01[i0], c11[i0], tx), tz);
    const b = lerp(lerp(c00[i1], c10[i1], tx), lerp(c01[i1], c11[i1], tx), tz);
    return lerp(a, b, ty);
  }

  /** Maior y sólido (densidade > 0) da coluna, ignorando cavernas. */
  surfaceY(x: number, z: number): number {
    const gx = Math.floor(x / CELL_XZ) * CELL_XZ, gz = Math.floor(z / CELL_XZ) * CELL_XZ;
    const p = Math.max(this.params(gx, gz).h, this.params(gx + 4, gz).h, this.params(gx, gz + 4).h, this.params(gx + 4, gz + 4).h);
    const amp = Math.max(this.params(gx, gz).amp, this.params(gx + 4, gz + 4).amp);
    let y = Math.min(MAX_Y - 1, Math.ceil(p + amp * 1.3 + 10));
    while (y > MIN_Y && this.density(x, y, z) <= 0) y--;
    return y;
  }

  /** Densidade de caverna (<0 = escavar) em grade 4×4×4. */
  caveColumn(gx: number, gz: number, surfaceTop: number): Float32Array {
    const k = (gx + 4194304) * 8388608 + (gz + 4194304);
    let col = this.caveCache.get(k);
    if (col) return col;
    col = new Float32Array(NCY).fill(1);
    const ent = this.entrance.sample(gx, 0, gz);
    const radius = 0.075 + 0.05 * this.spagRad.sample(gx, 0, gz);
    for (let i = 0; i < NCY; i++) {
      const y = MIN_Y + i * CAVE_Y;
      if (y > surfaceTop + 6 || y < MIN_Y + 5) continue;
      const depth = surfaceTop - y;
      // queijo: grandes salões, mais comuns em profundidade
      const ch = this.cheese.sample(gx, y * 1.6, gz);
      const cheeseBias = 0.12 * smoothstep(32, -40, y);
      let d = 0.52 - cheeseBias - ch;
      // espaguete: túneis longos
      const s1 = this.spag1.sample(gx, y * 1.25, gz), s2 = this.spag2.sample(gx, y * 1.25, gz);
      const sp = Math.sqrt(s1 * s1 + s2 * s2) - radius;
      d = Math.min(d, sp * 6);
      // talharim: túneis finos e profundos
      if (y < 60) {
        const n1 = this.noodle1.sample(gx, y, gz), n2 = this.noodle2.sample(gx, y, gz);
        const nd = Math.sqrt(n1 * n1 + n2 * n2) - 0.045;
        d = Math.min(d, nd * 7 + smoothstep(40, 60, y));
      }
      // perto da superfície só escava onde há "entrada"
      if (depth < 10) {
        const allow = smoothstep(0.08, 0.35, ent);
        d += (1 - allow) * (10 - depth) * 0.2;
      }
      col[i] = d;
    }
    if (this.caveCache.size > 20000) this.caveCache.clear();
    this.caveCache.set(k, col);
    return col;
  }

  /** Nível d'água local do aquífero (ou −999 para seco). */
  aquiferLevel(x: number, y: number, z: number): number {
    if (y < -54) return -999;
    const rx = Math.floor(x / 48), ry = Math.floor((y + 64) / 32), rz = Math.floor(z / 48);
    const n = this.aquifer.sample(rx * 48, ry * 32, rz * 48);
    if (n > 0.25) return MIN_Y + ry * 32 + 10 + Math.floor((n - 0.25) * 30);
    return -999;
  }
}
