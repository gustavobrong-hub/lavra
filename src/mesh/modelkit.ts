/**
 * Utilitários de modelos: caixas estilo JSON (com UV automático), planos de duas faces, rotações,
 * luz suave por vértice (canto da grade) e descarte de faces encostadas em blocos opacos.
 */
import { OCCLUDES, OPAQUE } from '../world/blocks/registry';
import { latticeLight, pidx } from './padded';
import type { QuadBuffer } from './vertex';
import { N_DERIV, N_PLANT, packW0, packW1, packW2 } from './vertex';

export interface ModelContext {
  blocks: Uint16Array;
  light: Uint8Array;
  tints: Uint16Array;
  out: QuadBuffer[];
  sx: number; sy: number; sz: number;
}

export const L_SOLID = 0, L_CUTOUT = 1, L_TRANSLUCENT = 2;

/** direção após girar r×90° no sentido horário (visto de cima): norte→leste→sul→oeste */
const ROT_H = [2, 5, 3, 4]; // norte, leste, sul, oeste (ordinais)
export function rotDir(d: number, r: number): number {
  if (d < 2 || r === 0) return d;
  const i = ROT_H.indexOf(d);
  return ROT_H[(i + r) & 3];
}
export const FACING_ROT: Record<string, number> = { north: 0, east: 1, south: 2, west: 3 };

export interface BoxOpts {
  rot?: number;
  layer?: number;
  cull?: boolean;
  tint?: number;
  wave?: number;
  flags?: number;
  /** uv por face (u0,v0,u1,v1 em texels); null = automático */
  uv?: (face: number) => [number, number, number, number] | null;
}

const P = new Float64Array(12);
const UVB = new Float64Array(8);

/** Emite um quad (4 pontos em 1/16 de bloco, relativos ao bloco) com luz suave por vértice. */
export function quad(
  ctx: ModelContext, bx: number, by: number, bz: number, layer: number,
  pts: ArrayLike<number>, uvs: ArrayLike<number>, tex: number, normal: number,
  tint = 0xffff, wave = 0, flags = 0, ao = 3,
): void {
  const buf = ctx.out[layer];
  const w: number[] = [];
  for (let i = 0; i < 4; i++) {
    const px = pts[i * 3], py = pts[i * 3 + 1], pz = pts[i * 3 + 2];
    const lc = latticeLight(ctx.blocks, ctx.light, bx + Math.round(px / 16), by + Math.round(py / 16), bz + Math.round(pz / 16));
    const X = Math.max(0, Math.round(bx * 16 + px)), Y = Math.max(0, Math.round(by * 16 + py)), Z = Math.max(0, Math.round(bz * 16 + pz));
    const u = Math.max(0, Math.round(uvs[i * 2])), v = Math.max(0, Math.round(uvs[i * 2 + 1]));
    w.push(packW0(X, Y, Z, normal, wave), packW1(u, v, tex & 0x7ff, ao), packW2(lc & 63, (lc >> 6) & 63, flags, tint));
  }
  buf.push(w[0], w[1], w[2], w[3], w[4], w[5], w[6], w[7], w[8], w[9], w[10], w[11]);
}

/** Plano de duas faces (plantas, vinhas, escadas de mão). */
export function plane(ctx: ModelContext, bx: number, by: number, bz: number, layer: number,
  pts: ArrayLike<number>, uvs: ArrayLike<number>, tex: number, tint = 0xffff, wave = 0, flags = 0, normal = N_PLANT): void {
  quad(ctx, bx, by, bz, layer, pts, uvs, tex, normal, tint, wave, flags);
  const rp = [pts[9], pts[10], pts[11], pts[6], pts[7], pts[8], pts[3], pts[4], pts[5], pts[0], pts[1], pts[2]];
  const ru = [uvs[6], uvs[7], uvs[4], uvs[5], uvs[2], uvs[3], uvs[0], uvs[1]];
  quad(ctx, bx, by, bz, layer, rp, ru, tex, normal, tint, wave, flags);
}

function rotPoint(x: number, z: number, r: number): [number, number] {
  switch (r & 3) {
    case 1: return [16 - z, x];
    case 2: return [16 - x, 16 - z];
    case 3: return [z, 16 - x];
    default: return [x, z];
  }
}

function neighborCovers(ctx: ModelContext, bx: number, by: number, bz: number, d: number): boolean {
  const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];
  const n = ctx.blocks[pidx(bx + DX[d], by + DY[d], bz + DZ[d])];
  return OPAQUE[n] === 1 || (OCCLUDES[n] & (1 << (d ^ 1))) !== 0;
}

/**
 * Caixa [x0..x1]×[y0..y1]×[z0..z1] em 1/16. `tex[f]` por face (ordem down, up, north, south, west, east);
 * −1 omite a face. Faces na borda do bloco são descartadas se o vizinho as cobre (cull).
 */
export function box(ctx: ModelContext, bx: number, by: number, bz: number,
  x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  tex: ArrayLike<number>, o: BoxOpts = {}): void {
  const r = o.rot ?? 0;
  const layer = o.layer ?? L_SOLID;
  const cull = o.cull ?? true;
  const tint = o.tint ?? 0xffff;
  for (let f = 0; f < 6; f++) {
    const t = tex[f];
    if (t < 0) continue;
    const rf = rotDir(f, r);
    const onEdge = (f === 0 && y0 <= 0) || (f === 1 && y1 >= 16) || (f === 2 && z0 <= 0) || (f === 3 && z1 >= 16) || (f === 4 && x0 <= 0) || (f === 5 && x1 >= 16);
    if (cull && onEdge && neighborCovers(ctx, bx, by, bz, rf)) continue;
    // cantos (CCW vistos de fora) e UV automático
    let uv = o.uv?.(f) ?? null;
    switch (f) {
      case 0: set(P, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1); uv ??= [x0, 16 - z1, x1, 16 - z0];
        setUV(uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]); break;
      case 1: set(P, x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0); uv ??= [x0, z0, x1, z1];
        setUV(uv[0], uv[1], uv[0], uv[3], uv[2], uv[3], uv[2], uv[1]); break;
      case 2: set(P, x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0); uv ??= [16 - x1, 16 - y1, 16 - x0, 16 - y0];
        setUV(uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]); break;
      case 3: set(P, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1); uv ??= [x0, 16 - y1, x1, 16 - y0];
        setUV(uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]); break;
      case 4: set(P, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0); uv ??= [z0, 16 - y1, z1, 16 - y0];
        setUV(uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]); break;
      default: set(P, x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1); uv ??= [16 - z1, 16 - y1, 16 - z0, 16 - y0];
        setUV(uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]); break;
    }
    if (r) for (let i = 0; i < 4; i++) {
      const [nx, nz] = rotPoint(P[i * 3], P[i * 3 + 2], r);
      P[i * 3] = nx; P[i * 3 + 2] = nz;
    }
    quad(ctx, bx, by, bz, layer, P, UVB, t, rf, tint, o.wave ?? 0, o.flags ?? 0);
  }
}

function set(a: Float64Array, ...v: number[]): void { for (let i = 0; i < 12; i++) a[i] = v[i]; }
function setUV(...v: number[]): void { for (let i = 0; i < 8; i++) UVB[i] = v[i]; }

/** Transforma os 4 pontos de um quad: rotação em torno de um eixo passando por (ox,oy,oz). */
export function rotatePts(pts: number[], axis: 'x' | 'y' | 'z', angle: number, ox: number, oy: number, oz: number): number[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  const out = pts.slice();
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i] - ox, y = pts[i + 1] - oy, z = pts[i + 2] - oz;
    if (axis === 'x') { out[i + 1] = y * c - z * s + oy; out[i + 2] = y * s + z * c + oz; }
    else if (axis === 'y') { out[i] = x * c + z * s + ox; out[i + 2] = -x * s + z * c + oz; }
    else { out[i] = x * c - y * s + ox; out[i + 1] = x * s + y * c + oy; }
  }
  return out;
}

/** Caixa com transformação arbitrária (normais por derivada no shader). */
export function freeBox(ctx: ModelContext, bx: number, by: number, bz: number,
  x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  tex: ArrayLike<number>, uvs: ([number, number, number, number] | null)[], xf: (p: number[]) => number[], layer = L_CUTOUT): void {
  const faces: number[][] = [
    [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1],
    [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0],
    [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0],
    [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1],
    [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0],
    [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1],
  ];
  for (let f = 0; f < 6; f++) {
    if (tex[f] < 0) continue;
    const uv = uvs[f] ?? [0, 0, 16, 16];
    const u = f === 1 ? [uv[0], uv[1], uv[0], uv[3], uv[2], uv[3], uv[2], uv[1]] : [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]];
    quad(ctx, bx, by, bz, layer, xf(faces[f]), u, tex[f], N_DERIV);
  }
}
