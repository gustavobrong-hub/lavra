/** Acesso ao volume com borda de 1 bloco (18³) usado pelo mesher. */
import { LIGHT_OPACITY } from '../world/blocks/registry';

export const PAD = 18;
export const pidx = (x: number, y: number, z: number): number => ((y + 1) * PAD + (z + 1)) * PAD + (x + 1);

/**
 * Luz suave num canto da grade (cx,cy,cz em blocos): média das 8 células que o compartilham,
 * ignorando opacas. Retorna céu | bloco<<6 já na escala 0..60.
 */
export function latticeLight(blocks: Uint16Array, light: Uint8Array, cx: number, cy: number, cz: number): number {
  let sky = 0, blk = 0, n = 0;
  for (let dy = -1; dy <= 0; dy++) for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
    const xx = cx + dx, yy = cy + dy, zz = cz + dz;
    if (xx < -1 || xx > 16 || yy < -1 || yy > 16 || zz < -1 || zz > 16) continue;
    const i = pidx(xx, yy, zz);
    if (LIGHT_OPACITY[blocks[i]] >= 15) continue;
    const l = light[i];
    sky += l >> 4; blk += l & 15; n++;
  }
  if (n === 0) return 0;
  return Math.round((sky * 4) / n) | (Math.round((blk * 4) / n) << 6);
}

