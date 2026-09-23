/**
 * Minérios com a distribuição por altura da versão moderna (contagens, tamanhos e faixas).
 * Veios em forma de "charuto" como o OreFeature do original.
 */
import { Random, hash3, hashToFloat } from '../../../core/rng';
import { S } from '../../blocks';
import type { ChunkWriter } from '../writer';

type Dist = { kind: 'uniform' | 'triangle'; min: number; max: number };
interface OreRule {
  name: string;
  count: number;
  size: number;
  dist: Dist;
  /** chance de descartar blocos expostos ao ar (0–1) */
  airDiscard?: number;
  /** só em biomas de montanha */
  mountainOnly?: boolean;
  /** probabilidade de a regra rodar no chunk */
  rarity?: number;
}

const U = (min: number, max: number): Dist => ({ kind: 'uniform', min, max });
const T = (min: number, max: number): Dist => ({ kind: 'triangle', min, max });

export const ORE_RULES: OreRule[] = [
  { name: 'dirt', count: 7, size: 33, dist: U(0, 160) },
  { name: 'gravel', count: 14, size: 33, dist: U(-64, 320) },
  { name: 'granite', count: 6, size: 64, dist: U(64, 128) },
  { name: 'granite', count: 2, size: 64, dist: U(0, 60) },
  { name: 'diorite', count: 6, size: 64, dist: U(64, 128) },
  { name: 'diorite', count: 2, size: 64, dist: U(0, 60) },
  { name: 'andesite', count: 6, size: 64, dist: U(64, 128) },
  { name: 'andesite', count: 2, size: 64, dist: U(0, 60) },
  { name: 'tuff', count: 2, size: 64, dist: U(-64, 0) },
  { name: 'coal', count: 30, size: 17, dist: U(136, 320) },
  { name: 'coal', count: 20, size: 17, dist: T(0, 192), airDiscard: 0.5 },
  { name: 'iron', count: 90, size: 9, dist: T(80, 384) },
  { name: 'iron', count: 10, size: 9, dist: T(-24, 56) },
  { name: 'iron', count: 10, size: 4, dist: U(-64, 72) },
  { name: 'copper', count: 16, size: 10, dist: T(-16, 112) },
  { name: 'gold', count: 4, size: 9, dist: T(-64, 32), airDiscard: 0.5 },
  { name: 'gold', count: 1, size: 9, dist: U(-64, -48), airDiscard: 0.5, rarity: 0.5 },
  { name: 'fulgor', count: 4, size: 8, dist: U(-64, 15) },
  { name: 'fulgor', count: 8, size: 8, dist: T(-96, -32) },
  { name: 'lapis', count: 2, size: 7, dist: T(-32, 32) },
  { name: 'lapis', count: 4, size: 7, dist: U(-64, 64), airDiscard: 1 },
  { name: 'diamond', count: 7, size: 4, dist: T(-144, 16), airDiscard: 0.5 },
  { name: 'diamond', count: 1, size: 12, dist: T(-144, 16), airDiscard: 0.7, rarity: 1 / 9 },
  { name: 'diamond', count: 4, size: 8, dist: T(-144, 16), airDiscard: 1 },
  { name: 'emerald', count: 100, size: 3, dist: T(-16, 480), mountainOnly: true },
];

const STONE = () => S('stone');
let table: Map<string, { stone: number; deep: number }> | null = null;
function ores(): Map<string, { stone: number; deep: number }> {
  if (table) return table;
  table = new Map();
  for (const o of ['coal', 'iron', 'copper', 'gold', 'lapis', 'diamond', 'emerald']) {
    table.set(o, { stone: S(`${o}_ore`), deep: S(`deepslate_${o}_ore`) });
  }
  table.set('fulgor', { stone: S('fulgor_ore'), deep: S('deepslate_fulgor_ore') });
  for (const o of ['dirt', 'gravel', 'granite', 'diorite', 'andesite', 'tuff']) table.set(o, { stone: S(o), deep: S(o) });
  return table;
}

function sampleY(r: Random, d: Dist): number {
  if (d.kind === 'uniform') return r.range(d.min, d.max);
  return r.triangle(d.min, d.max);
}

/** Coloca os minérios originados no chunk (scx, scz) dentro do chunk-alvo do writer. */
export function placeOres(w: ChunkWriter, seed: number, scx: number, scz: number, mountain: boolean, isAirAt: (x: number, y: number, z: number) => boolean): void {
  const O = ores();
  const stone = STONE(), deepslate = S('deepslate', { axis: 'y' }), tuff = S('tuff');
  const granite = S('granite'), diorite = S('diorite'), andesite = S('andesite');
  ORE_RULES.forEach((rule, ri) => {
    const rr = Random.fromHash(seed, scx, scz, ri * 7919 + 13);
    if (rule.rarity !== undefined && rr.next() > rule.rarity) return;
    if (rule.mountainOnly && !mountain) return;
    const mat = O.get(rule.name)!;
    const salt = (seed ^ Math.imul(ri + 1, 0x9e3779b1)) | 0;
    for (let c = 0; c < rule.count; c++) {
      const ox = scx * 16 + rr.nextInt(16), oz = scz * 16 + rr.nextInt(16);
      const oy = sampleY(rr, rule.dist);
      if (oy < -64 || oy > 319) continue;
      const reach = Math.ceil(rule.size / 8) + 3;
      if (!w.touches(ox - reach, oz - reach, ox + reach, oz + reach)) continue;
      vein(w, Random.fromHash(seed, ox, oy, oz, ri), ox, oy, oz, rule.size, (x, y, z) => {
        const cur = w.get(x, y, z);
        if (cur !== stone && cur !== deepslate && cur !== tuff && cur !== granite && cur !== diorite && cur !== andesite) return;
        if (cur === mat.stone) return;
        if (rule.airDiscard && hashToFloat(hash3(salt, x, y, z)) < rule.airDiscard && isAirAt(x, y, z)) return;
        w.set(x, y, z, cur === deepslate || cur === tuff ? mat.deep : mat.stone);
      });
    }
  });
}

/** Veio: segmento de reta com esferas de raio variável ao longo dele. */
function vein(w: ChunkWriter, r: Random, x: number, y: number, z: number, size: number, put: (x: number, y: number, z: number) => void): void {
  const ang = r.next() * Math.PI;
  const len = size / 8;
  const x0 = x + Math.sin(ang) * len, x1 = x - Math.sin(ang) * len;
  const z0 = z + Math.cos(ang) * len, z1 = z - Math.cos(ang) * len;
  const y0 = y + r.nextInt(3) - 2, y1 = y + r.nextInt(3) - 2;
  const seen = new Set<number>();
  for (let i = 0; i < size; i++) {
    const t = i / size;
    const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t, cz = z0 + (z1 - z0) * t;
    const rad = ((Math.sin(Math.PI * t) + 1) * (r.next() * size / 16) + 1) / 2;
    const minX = Math.floor(cx - rad), maxX = Math.floor(cx + rad);
    const minY = Math.floor(cy - rad), maxY = Math.floor(cy + rad);
    const minZ = Math.floor(cz - rad), maxZ = Math.floor(cz + rad);
    if (!w.touches(minX, minZ, maxX, maxZ)) continue;
    for (let bx = minX; bx <= maxX; bx++) {
      const dx = (bx + 0.5 - cx) / rad;
      if (dx * dx >= 1) continue;
      for (let by = minY; by <= maxY; by++) {
        const dy = (by + 0.5 - cy) / rad;
        if (dx * dx + dy * dy >= 1) continue;
        for (let bz = minZ; bz <= maxZ; bz++) {
          const dz = (bz + 0.5 - cz) / rad;
          if (dx * dx + dy * dy + dz * dz >= 1) continue;
          const k = ((bx & 1023) << 20) | (((by + 64) & 1023) << 10) | (bz & 1023);
          if (seen.has(k)) continue;
          seen.add(k);
          put(bx, by, bz);
        }
      }
    }
  }
}
