/**
 * Raycast em voxels (Amanatides–Woo) testando a forma real de cada bloco (laje, escada, tocha…).
 */
import { AABB } from '../core/aabb';
import { FLAGS, F_FLUID, FLUID_LEVEL } from '../world/blocks/registry';
import { blockBoxes, type Box } from '../world/blocks/shapes';
import type { World } from '../world/world';

export interface BlockHit {
  x: number; y: number; z: number;
  face: number; // 0..5 (baixo, cima, norte, sul, oeste, leste)
  px: number; py: number; pz: number; // ponto de impacto
  dist: number;
  state: number;
}

const tmp: Box[] = [];

export function raycastBlocks(
  world: World, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number,
  opts: { fluids?: 'none' | 'source' | 'any' } = {},
): BlockHit | null {
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dx), tDeltaY = Math.abs(1 / dy), tDeltaZ = Math.abs(1 / dz);
  let tMaxX = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tDeltaY : Infinity;
  let tMaxZ = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ : Infinity;
  const fluids = opts.fluids ?? 'none';
  const get = (a: number, b: number, c: number) => world.getBlock(a, b, c);
  for (let i = 0; i < 256; i++) {
    const s = world.getBlock(x, y, z);
    if (s !== 0) {
      const isFluid = (FLAGS[s] & F_FLUID) !== 0;
      if (isFluid) {
        if (fluids === 'any' || (fluids === 'source' && FLUID_LEVEL[s] === 0)) {
          const hit = new AABB(x, y, z, x + 1, y + 0.9, z + 1).rayHit(ox, oy, oz, dx, dy, dz, maxDist);
          if (hit) return mk(x, y, z, hit.face, hit.t, ox, oy, oz, dx, dy, dz, s);
        }
      } else {
        let best: { t: number; face: number } | null = null;
        for (const b of blockBoxes(s, x, y, z, get, true, tmp)) {
          const h = new AABB(x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]).rayHit(ox, oy, oz, dx, dy, dz, maxDist);
          if (h && (!best || h.t < best.t)) best = h;
        }
        if (best) return mk(x, y, z, best.face < 0 ? 1 : best.face, best.t, ox, oy, oz, dx, dy, dz, s);
      }
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDist) break;
      x += stepX; tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDist) break;
      y += stepY; tMaxY += tDeltaY;
    } else {
      if (tMaxZ > maxDist) break;
      z += stepZ; tMaxZ += tDeltaZ;
    }
  }
  return null;
}

function mk(x: number, y: number, z: number, face: number, t: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, state: number): BlockHit {
  return { x, y, z, face, px: ox + dx * t, py: oy + dy * t, pz: oz + dz * t, dist: t, state };
}

export const FACE_DX = [0, 0, 0, 0, -1, 1], FACE_DY = [-1, 1, 0, 0, 0, 0], FACE_DZ = [0, 0, -1, 1, 0, 0];
