/**
 * Escavadores clássicos: túneis sinuosos e ravinas. Cada um nasce num chunk de origem (raio de 8 chunks)
 * e é totalmente determinístico, então cada chunk escava só a parte que lhe cabe.
 */
import { LAVA_LEVEL, MIN_Y } from '../../core/constants';
import { Random } from '../../core/rng';
import { S, isWater, isLava } from '../blocks';
import type { ChunkWriter } from './writer';

const RANGE = 8;

let BLOCKS_OK: Set<number> | null = null;
function carvable(): Set<number> {
  if (BLOCKS_OK) return BLOCKS_OK;
  BLOCKS_OK = new Set([
    'stone', 'granite', 'diorite', 'andesite', 'tuff', 'dirt', 'coarse_dirt', 'grass_block', 'podzol', 'gravel', 'sand',
    'sandstone', 'red_sand', 'terracotta', 'lume_moss', 'mud', 'clay', 'calcite', 'snow_block', 'packed_ice',
    'coal_ore', 'iron_ore', 'copper_ore', 'gold_ore', 'lapis_ore', 'diamond_ore', 'emerald_ore', 'fulgor_ore',
    'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_copper_ore', 'deepslate_gold_ore', 'deepslate_lapis_ore',
    'deepslate_diamond_ore', 'deepslate_emerald_ore', 'deepslate_fulgor_ore',
  ].map((n) => S(n)));
  BLOCKS_OK.add(S('deepslate', { axis: 'y' }));
  BLOCKS_OK.add(S('grass_block', { snowy: true }));
  return BLOCKS_OK;
}

export function carveChunk(w: ChunkWriter, seed: number, surfaceY: (x: number, z: number) => number): void {
  const cx = w.chunk.cx, cz = w.chunk.cz;
  for (let sz = cz - RANGE; sz <= cz + RANGE; sz++) {
    for (let sx = cx - RANGE; sx <= cx + RANGE; sx++) {
      const r = Random.fromHash(seed, sx, sz, 0xca7e);
      if (r.next() < 0.12) {
        const systems = 1 + r.nextInt(2);
        for (let i = 0; i < systems; i++) {
          const x = sx * 16 + r.nextInt(16), z = sz * 16 + r.nextInt(16);
          const y = r.next() < 0.7 ? r.range(-56, 40) : r.range(40, 120);
          tunnel(w, Random.fromHash(seed, x, y, z, 1), x + 0.5, y + 0.5, z + 0.5, 1.5 + r.next() * 2.4, r.next() * Math.PI * 2, (r.next() - 0.5) / 4, 70 + r.nextInt(50), 1, surfaceY, 0);
        }
      }
      const rr = Random.fromHash(seed, sx, sz, 0x4a71e);
      if (rr.next() < 0.018) {
        const x = sx * 16 + rr.nextInt(16), z = sz * 16 + rr.nextInt(16);
        const y = rr.range(10, 67);
        tunnel(w, Random.fromHash(seed, x, y, z, 2), x + 0.5, y + 0.5, z + 0.5, 1.8 + rr.next() * 1.8, rr.next() * Math.PI * 2, (rr.next() - 0.5) / 8, 90 + rr.nextInt(40), 3.2, surfaceY, 1);
      }
    }
  }
}

function tunnel(
  w: ChunkWriter, r: Random, x: number, y: number, z: number, width: number, yaw: number, pitch: number,
  steps: number, vertScale: number, surfaceY: (x: number, z: number) => number, depth: number,
): void {
  let dYaw = 0, dPitch = 0;
  const branchAt = depth === 0 && vertScale < 2 && r.next() < 0.35 ? Math.floor(steps * (0.25 + r.next() * 0.5)) : -1;
  const ravine = vertScale > 2;
  for (let i = 0; i < steps; i++) {
    const rad = 1.5 + Math.sin((i / steps) * Math.PI) * width;
    const rv = rad * vertScale;
    const cp = Math.cos(pitch);
    x += Math.cos(yaw) * cp;
    y += Math.sin(pitch);
    z += Math.sin(yaw) * cp;
    pitch *= ravine ? 0.7 : 0.92;
    pitch += dPitch * 0.1;
    yaw += dYaw * 0.1;
    dPitch = dPitch * (ravine ? 0.8 : 0.9) + (r.next() - r.next()) * r.next() * 2;
    dYaw = dYaw * 0.75 + (r.next() - r.next()) * r.next() * 4;
    if (i === branchAt) {
      tunnel(w, Random.fromHash(Math.floor(x), Math.floor(y), Math.floor(z), 9), x, y, z, width * 0.7, yaw - Math.PI / 2, pitch / 3, steps - i, 1, surfaceY, 1);
      tunnel(w, Random.fromHash(Math.floor(x), Math.floor(y), Math.floor(z), 10), x, y, z, width * 0.7, yaw + Math.PI / 2, pitch / 3, steps - i, 1, surfaceY, 1);
      return;
    }
    if (r.next() < 0.25 && !ravine) continue; // pula alguns passos (irregularidade)
    const reach = rad + 2;
    if (!w.touches(Math.floor(x - reach), Math.floor(z - reach), Math.floor(x + reach), Math.floor(z + reach))) continue;
    carveEllipsoid(w, x, y, z, rad, rv, ravine);
  }
}

function carveEllipsoid(w: ChunkWriter, cx: number, cy: number, cz: number, rh: number, rv: number, ravine: boolean): void {
  const ok = carvable();
  const lava = S('lava');
  const minX = Math.max(w.x0, Math.floor(cx - rh)), maxX = Math.min(w.x0 + 15, Math.floor(cx + rh));
  const minZ = Math.max(w.z0, Math.floor(cz - rh)), maxZ = Math.min(w.z0 + 15, Math.floor(cz + rh));
  const minY = Math.max(MIN_Y + 1, Math.floor(cy - rv)), maxY = Math.min(300, Math.floor(cy + rv));
  for (let x = minX; x <= maxX; x++) {
    const dx = (x + 0.5 - cx) / rh;
    for (let z = minZ; z <= maxZ; z++) {
      const dz = (z + 0.5 - cz) / rh;
      if (dx * dx + dz * dz >= 1) continue;
      for (let y = maxY; y >= minY; y--) {
        const dy = (y + 0.5 - cy) / rv;
        // ravinas têm paredes mais retas e fundo mais estreito
        const shape = ravine ? (dx * dx + dz * dz) * (1 + Math.max(0, -dy) * 0.6) + dy * dy / 6 : dx * dx + dy * dy + dz * dz;
        if (shape >= 1 || dy <= -0.7) continue;
        const cur = w.get(x, y, z);
        if (!ok.has(cur)) continue;
        const above = w.get(x, y + 1, z);
        if (isWater(above) || isLava(above)) continue;
        w.set(x, y, z, y < LAVA_LEVEL ? lava : 0);
      }
    }
  }
}
