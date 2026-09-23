/**
 * Mesher de seção 16³ (roda no worker). Entrada: blocos e luz com borda de 1 (18³) e cores de bioma.
 * - Cubos: greedy meshing com AO e luz suave por vértice (regras do original para mistura de luz).
 * - Fluidos: altura por canto, vetor de fluxo.
 * - Demais formas: construtores de modelo (models.ts).
 * - Grafo de visibilidade para o culling de cavernas.
 */
import {
  FACE_TEX, FLAGS, F_CULL_SAME, F_LAVA, F_LEAVES, F_WATER, FLUID_LEVEL, LIGHT_OPACITY, OCCLUDES, OPAQUE,
  RENDER_LAYER, SHAPE, SHAPE_CUBE, SHAPE_FLUID, SHAPE_NONE, TINT, WAVING, BLOCK_OF, LAYER_WATER,
} from '../world/blocks/registry';
import { FLAG_FLOWING, FLAG_UNDERWATER, QuadBuffer, packW0, packW1, packW2 } from './vertex';
import { buildModel } from './models';
import type { ModelContext } from './modelkit';
import { PAD, pidx, latticeLight } from './padded';
export { PAD, pidx, latticeLight };
import { tintColor } from './tints';


export interface MeshInput {
  blocks: Uint16Array; // 18³
  light: Uint8Array; // 18³
  tints: Uint16Array; // 16×16×3
  sx: number; sy: number; sz: number;
  fancyLeaves: boolean;
}

export interface MeshOutput {
  /** 0 sólido, 1 recortado, 2 translúcido, 3 água */
  layers: Uint32Array[];
  quads: number[];
  vis: number;
  /** alguma célula não opaca recebe luz do céu (para decidir sombras) */
  skyLit: boolean;
}

// ---------------------------------------------------------------- tabelas por direção
const DXS = [0, 0, 0, 0, -1, 1], DYS = [-1, 1, 0, 0, 0, 0], DZS = [0, 0, -1, 1, 0, 0];
/** eixo normal (0=x,1=y,2=z), eixo u, eixo v */
const AX = [1, 1, 2, 2, 0, 0];
const UA = [0, 0, 0, 0, 2, 2];
const VA = [2, 2, 1, 1, 1, 1];
const POSITIVE = [false, true, false, true, false, true];
const FLIP_U = [false, false, true, false, false, true];
const SIDE_FACE = [false, false, true, true, true, true];
/** ordem dos cantos (cu,cv) garantindo CCW visto de fora */
const CORNERS: number[][] = [];
{
  const base = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let d = 0; d < 6; d++) {
    const p = (cu: number, cv: number): number[] => {
      const v = [0, 0, 0];
      v[AX[d]] = POSITIVE[d] ? 1 : 0; v[UA[d]] = cu; v[VA[d]] = cv;
      return v;
    };
    const a = p(0, 0), b = p(1, 0), c = p(1, 1);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const dot = n[0] * DXS[d] + n[1] * DYS[d] + n[2] * DZS[d];
    CORNERS.push((dot > 0 ? base : [[0, 0], [0, 1], [1, 1], [1, 0]]).flat());
  }
}
/** pares de faces → bit (15 pares) */
const PAIR = (() => {
  const t: number[][] = [];
  let k = 0;
  for (let a = 0; a < 6; a++) { t.push([]); for (let b = 0; b < 6; b++) t[a].push(-1); }
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) { t[a][b] = t[b][a] = k++; }
  return t;
})();
export const pairBit = (a: number, b: number): number => 1 << PAIR[a][b];

// ---------------------------------------------------------------- buffers reutilizados
const mTex = new Int32Array(256);
const mSky = new Int32Array(256);
const mBlk = new Int32Array(256);
const mMisc = new Int32Array(256);
const mTint = new Int32Array(256);
const cornerAo = new Int32Array(4);
const cornerSky = new Int32Array(4);
const cornerBlk = new Int32Array(4);
const buffers = [new QuadBuffer(4096), new QuadBuffer(2048), new QuadBuffer(512), new QuadBuffer(1024)];

function faceVisible(b: number, n: number, d: number, fancyLeaves: boolean): boolean {
  if (n === 0) return true;
  if (OPAQUE[n]) return false;
  if (OCCLUDES[n] & (1 << (d ^ 1))) return false;
  if (FLAGS[b] & F_CULL_SAME && BLOCK_OF[n] === BLOCK_OF[b]) return false;
  if (!fancyLeaves && FLAGS[b] & F_LEAVES && FLAGS[n] & F_LEAVES) return false;
  return true;
}

export function meshSection(inp: MeshInput): MeshOutput {
  const { blocks, light, tints, fancyLeaves } = inp;
  for (const b of buffers) b.reset();
  let skyLit = false;

  // ------------------------------------------------------------ cubos com greedy meshing
  for (let d = 0; d < 6; d++) {
    const ax = AX[d], ua = UA[d], va = VA[d];
    const ddx = DXS[d], ddy = DYS[d], ddz = DZS[d];
    const pOff = ddx + ddz * PAD + ddy * PAD * PAD;
    const uStep = ua === 0 ? 1 : ua === 1 ? PAD * PAD : PAD;
    const vStep = va === 0 ? 1 : va === 1 ? PAD * PAD : PAD;
    for (let s = 0; s < 16; s++) {
      let any = false;
      for (let v = 0; v < 16; v++) {
        for (let u = 0; u < 16; u++) {
          const m = (v << 4) | u;
          mTex[m] = 0;
          let cx: number, cy: number, cz: number;
          if (ax === 0) { cx = s; cy = v; cz = u; } else if (ax === 1) { cx = u; cy = s; cz = v; } else { cx = u; cy = v; cz = s; }
          const pi = pidx(cx, cy, cz);
          const b = blocks[pi];
          if (SHAPE[b] !== SHAPE_CUBE) continue;
          const oi = pi + pOff;
          const n = blocks[oi];
          if (!faceVisible(b, n, d, fancyLeaves)) continue;
          // luz e AO dos 4 cantos (ordem canônica (0,0),(1,0),(1,1),(0,1))
          const oL = light[oi];
          const oLight = oL === 0 ? light[pi] : oL;
          for (let k = 0; k < 4; k++) {
            const cu = k === 1 || k === 2 ? 1 : -1;
            const cv = k >= 2 ? 1 : -1;
            const s1 = oi + cu * uStep, s2 = oi + cv * vStep, cc = s1 + cv * vStep;
            const o1 = OPAQUE[blocks[s1]], o2 = OPAQUE[blocks[s2]], oc = OPAQUE[blocks[cc]];
            let l1 = light[s1], l2 = light[s2];
            let lc = o1 && o2 ? l1 : light[cc];
            if (l1 === 0) l1 = oLight;
            if (l2 === 0) l2 = oLight;
            if (lc === 0) lc = oLight;
            cornerSky[k] = (oLight >> 4) + (l1 >> 4) + (l2 >> 4) + (lc >> 4);
            cornerBlk[k] = (oLight & 15) + (l1 & 15) + (l2 & 15) + (lc & 15);
            cornerAo[k] = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);
          }
          mTex[m] = FACE_TEX[b * 6 + d] + 1;
          mSky[m] = cornerSky[0] | (cornerSky[1] << 6) | (cornerSky[2] << 12) | (cornerSky[3] << 18);
          mBlk[m] = cornerBlk[0] | (cornerBlk[1] << 6) | (cornerBlk[2] << 12) | (cornerBlk[3] << 18);
          const under = FLAGS[n] & F_WATER ? FLAG_UNDERWATER : 0;
          mMisc[m] = cornerAo[0] | (cornerAo[1] << 2) | (cornerAo[2] << 4) | (cornerAo[3] << 6) | (under << 8) | (WAVING[b] << 12) | (RENDER_LAYER[b] << 14);
          mTint[m] = TINT[b] ? tintColor(TINT[b], b, tints, cx, cz) : 0xffff;
          if (oLight >> 4 > 0) skyLit = true;
          any = true;
        }
      }
      if (!any) continue;
      // varredura gulosa
      for (let v = 0; v < 16; v++) {
        for (let u = 0; u < 16;) {
          const m = (v << 4) | u;
          const t = mTex[m];
          if (!t) { u++; continue; }
          const sk = mSky[m], bl = mBlk[m], mi = mMisc[m], ti = mTint[m];
          let w = 1;
          while (u + w < 16) {
            const q = m + w;
            if (mTex[q] !== t || mSky[q] !== sk || mBlk[q] !== bl || mMisc[q] !== mi || mTint[q] !== ti) break;
            w++;
          }
          let h = 1;
          outer: while (v + h < 16) {
            const row = ((v + h) << 4) | u;
            for (let k = 0; k < w; k++) {
              const q = row + k;
              if (mTex[q] !== t || mSky[q] !== sk || mBlk[q] !== bl || mMisc[q] !== mi || mTint[q] !== ti) break outer;
            }
            h++;
          }
          emitGreedy(d, s, u, v, w, h, t - 1, sk, bl, mi, ti);
          for (let hh = 0; hh < h; hh++) for (let k = 0; k < w; k++) mTex[((v + hh) << 4) | (u + k)] = 0;
          u += w;
        }
      }
    }
  }

  // ------------------------------------------------------------ fluidos e modelos
  const ctx: ModelContext = { blocks, light, tints, out: buffers, sx: inp.sx, sy: inp.sy, sz: inp.sz };
  for (let y = 0; y < 16; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const pi = pidx(x, y, z);
        const b = blocks[pi];
        const sh = SHAPE[b];
        if (sh === SHAPE_NONE || sh === SHAPE_CUBE) continue;
        if (sh === SHAPE_FLUID) meshFluid(ctx, x, y, z, b);
        else buildModel(ctx, x, y, z, b, sh);
        if (!skyLit && (light[pi] >> 4) > 0) skyLit = true;
      }
    }
  }

  const vis = computeVisibility(blocks);
  return {
    layers: buffers.map((b) => b.slice()),
    quads: buffers.map((b) => b.quads),
    vis,
    skyLit,
  };
}

function emitGreedy(d: number, s: number, u: number, v: number, w: number, h: number, tex: number,
  sky: number, blk: number, misc: number, tint: number): void {
  const layerId = (misc >> 14) & 3;
  const buf = buffers[layerId];
  const ax = AX[d], ua = UA[d], va = VA[d];
  const plane = (s + (POSITIVE[d] ? 1 : 0)) * 16;
  const texLayer = tex & 0xfff, rot = (tex >> 12) & 3;
  const W = w * 16, H = h * 16;
  const flags = (misc >> 8) & 15;
  const wave = (misc >> 12) & 3;
  const order = CORNERS[d];
  const vw0 = [0, 0, 0, 0], vw1 = [0, 0, 0, 0], vw2 = [0, 0, 0, 0];
  const aos = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const cu = order[i * 2], cv = order[i * 2 + 1];
    // índice canônico do canto
    const k = cu === 0 ? (cv === 0 ? 0 : 3) : (cv === 0 ? 1 : 2);
    const p = [0, 0, 0];
    p[ax] = plane; p[ua] = (u + cu * w) * 16; p[va] = (v + cv * h) * 16;
    let tu: number, tv: number;
    if (SIDE_FACE[d]) {
      tu = FLIP_U[d] ? (1 - cu) * W : cu * W;
      tv = (1 - cv) * H;
    } else {
      tu = cu * W;
      tv = cv * H;
    }
    let ru = tu, rv = tv;
    if (rot === 1) { ru = tv; rv = W - tu; } else if (rot === 2) { ru = W - tu; rv = H - tv; } else if (rot === 3) { ru = H - tv; rv = tu; }
    const ao = (misc >> (k * 2)) & 3;
    aos[i] = ao;
    vw0[i] = packW0(p[0], p[1], p[2], d, wave);
    vw1[i] = packW1(ru, rv, texLayer, ao);
    vw2[i] = packW2((sky >> (k * 6)) & 63, (blk >> (k * 6)) & 63, flags, tint);
  }
  // gira a diagonal quando o canto 0/2 é mais escuro (evita anisotropia do AO)
  const l = (i: number) => aos[i] * 64 + ((vw2[i] & 63) + ((vw2[i] >> 6) & 63));
  if (l(0) + l(2) < l(1) + l(3)) {
    buf.push(vw0[1], vw1[1], vw2[1], vw0[2], vw1[2], vw2[2], vw0[3], vw1[3], vw2[3], vw0[0], vw1[0], vw2[0]);
  } else {
    buf.push(vw0[0], vw1[0], vw2[0], vw0[1], vw1[1], vw2[1], vw0[2], vw1[2], vw2[2], vw0[3], vw1[3], vw2[3]);
  }
}

// ---------------------------------------------------------------- fluidos
function meshFluid(ctx: ModelContext, x: number, y: number, z: number, b: number): void {
  const { blocks, light, tints } = ctx;
  const water = (FLAGS[b] & F_WATER) !== 0;
  const mask = water ? F_WATER : F_LAVA;
  const same = (s: number) => (FLAGS[s] & mask) !== 0;
  const buf = ctx.out[water ? LAYER_WATER : 0];
  const texTop = FACE_TEX[b * 6 + 1] & 0xfff, texSide = FACE_TEX[b * 6 + 2] & 0xfff;
  const tint = water ? tintColor(3, b, tints, x, z) : 0xffff;

  const ownH = (xx: number, zz: number): number => {
    const s = blocks[pidx(xx, y, zz)];
    if (same(s)) {
      if (same(blocks[pidx(xx, y + 1, zz)])) return 1;
      const lv = FLUID_LEVEL[s];
      return lv >= 8 ? 8 / 9 : (8 - lv) / 9;
    }
    return OPAQUE[s] || (FLAGS[s] & 1 && !(FLAGS[s] & 2)) ? -2 : -1;
  };
  const cornerH = (cx: number, cz: number): number => {
    let sum = 0, wsum = 0;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const xx = x - 1 + cx + i, zz = z - 1 + cz + j;
      if (same(blocks[pidx(xx, y + 1, zz)])) return 1;
      const hh = ownH(xx, zz);
      if (hh === -2) continue;
      if (hh === -1) { wsum += 1; continue; }
      const wgt = hh >= 0.8 ? 10 : 1;
      sum += hh * wgt;
      wsum += wgt;
    }
    return wsum > 0 ? sum / wsum : 8 / 9;
  };
  const above = blocks[pidx(x, y + 1, z)];
  const fullTop = same(above);
  const h00 = fullTop ? 1 : cornerH(0, 0), h10 = fullTop ? 1 : cornerH(1, 0);
  const h11 = fullTop ? 1 : cornerH(1, 1), h01 = fullTop ? 1 : cornerH(0, 1);
  const L = (cx: number, cy: number, cz: number) => latticeLight(blocks, light, x + cx, y + cy, z + cz);

  const X = x * 16, Y = y * 16, Z = z * 16;
  const hh = (h: number) => Math.round(Y + h * 16);
  // topo
  if (!fullTop) {
    const fx = (h00 + h01) - (h10 + h11), fz = (h00 + h10) - (h01 + h11);
    const flowing = Math.abs(fx) + Math.abs(fz) > 0.01;
    const fu = 256 + Math.round(Math.max(-1, Math.min(1, fx * 2)) * 200), fv = 256 + Math.round(Math.max(-1, Math.min(1, fz * 2)) * 200);
    const flags = flowing ? FLAG_FLOWING : 0;
    const v = (px: number, py: number, pz: number, lc: number) => [packW0(px, py, pz, 1, 0), packW1(fu, fv, texTop, 3), packW2(lc & 63, (lc >> 6) & 63, flags, tint)];
    const a = v(X, hh(h00), Z, L(0, 1, 0)), bb = v(X, hh(h01), Z + 16, L(0, 1, 1)), c = v(X + 16, hh(h11), Z + 16, L(1, 1, 1)), dd = v(X + 16, hh(h10), Z, L(1, 1, 0));
    buf.push(a[0], a[1], a[2], bb[0], bb[1], bb[2], c[0], c[1], c[2], dd[0], dd[1], dd[2]);
    // face de baixo da superfície (vista de dentro d'água)
    if (water) buf.push(a[0] & ~(7 << 27) | (0 << 27), a[1], a[2], dd[0] & ~(7 << 27), dd[1], dd[2], c[0] & ~(7 << 27), c[1], c[2], bb[0] & ~(7 << 27), bb[1], bb[2]);
  }
  // laterais
  const sides: [number, number, number, number, number, number][] = [
    // dir, nx, nz, (canto a) cx, cz, ...
    [2, 0, -1, 0, 0, 0], [3, 0, 1, 0, 0, 0], [4, -1, 0, 0, 0, 0], [5, 1, 0, 0, 0, 0],
  ];
  for (const [d, nx, nz] of sides) {
    const n = blocks[pidx(x + nx, y, z + nz)];
    if (same(n) || OPAQUE[n] || (OCCLUDES[n] & (1 << (d ^ 1)))) continue;
    let p0: number[], p1: number[], ha: number, hb: number;
    // p0/p1 = cantos inferiores na ordem CCW vista de fora
    if (d === 2) { p0 = [X + 16, Z]; p1 = [X, Z]; ha = h10; hb = h00; }
    else if (d === 3) { p0 = [X, Z + 16]; p1 = [X + 16, Z + 16]; ha = h01; hb = h11; }
    else if (d === 4) { p0 = [X, Z]; p1 = [X, Z + 16]; ha = h00; hb = h01; }
    else { p0 = [X + 16, Z + 16]; p1 = [X + 16, Z]; ha = h11; hb = h10; }
    const la = L(p0[0] > X ? 1 : 0, 0, p0[1] > Z ? 1 : 0), lb = L(p1[0] > X ? 1 : 0, 0, p1[1] > Z ? 1 : 0);
    const lat = L(p0[0] > X ? 1 : 0, 1, p0[1] > Z ? 1 : 0), lbt = L(p1[0] > X ? 1 : 0, 1, p1[1] > Z ? 1 : 0);
    const under = FLAGS[n] & F_WATER ? FLAG_UNDERWATER : 0;
    const mk = (px: number, py: number, pz: number, tu: number, tv: number, lc: number) =>
      [packW0(px, py, pz, d, 0), packW1(tu, tv, texSide, 3), packW2(lc & 63, (lc >> 6) & 63, FLAG_FLOWING | under, tint)];
    const A = mk(p0[0], Y, p0[1], 0, 16, la), B = mk(p1[0], Y, p1[1], 16, 16, lb);
    const C = mk(p1[0], hh(hb), p1[1], 16, 16 - Math.round(hb * 16), lbt), D = mk(p0[0], hh(ha), p0[1], 0, 16 - Math.round(ha * 16), lat);
    buf.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2], D[0], D[1], D[2]);
  }
  // fundo
  const below = blocks[pidx(x, y - 1, z)];
  if (!same(below) && !OPAQUE[below] && !(OCCLUDES[below] & 2)) {
    const lc = L(0, 0, 0);
    const mk = (px: number, pz: number) => [packW0(px, Y, pz, 0, 0), packW1(0, 0, texTop, 3), packW2(lc & 63, (lc >> 6) & 63, 0, tint)];
    const A = mk(X, Z), B = mk(X + 16, Z), C = mk(X + 16, Z + 16), D = mk(X, Z + 16);
    buf.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2], D[0], D[1], D[2]);
  }
}

// ---------------------------------------------------------------- visibilidade
const visited = new Uint8Array(4096);
const stack = new Int16Array(4096);

function computeVisibility(blocks: Uint16Array): number {
  visited.fill(0);
  let bits = 0;
  for (let i = 0; i < 4096; i++) {
    if (visited[i]) continue;
    const x0 = i & 15, z0 = (i >> 4) & 15, y0 = i >> 8;
    if (OPAQUE[blocks[pidx(x0, y0, z0)]]) { visited[i] = 1; continue; }
    let sp = 0, faces = 0;
    stack[sp++] = i;
    visited[i] = 1;
    while (sp > 0) {
      const c = stack[--sp];
      const x = c & 15, z = (c >> 4) & 15, y = c >> 8;
      if (x === 0) faces |= 1 << 4; else if (x === 15) faces |= 1 << 5;
      if (y === 0) faces |= 1; else if (y === 15) faces |= 2;
      if (z === 0) faces |= 1 << 2; else if (z === 15) faces |= 1 << 3;
      // vizinhos
      if (x > 0) push(c - 1, x - 1, y, z);
      if (x < 15) push(c + 1, x + 1, y, z);
      if (z > 0) push(c - 16, x, y, z - 1);
      if (z < 15) push(c + 16, x, y, z + 1);
      if (y > 0) push(c - 256, x, y - 1, z);
      if (y < 15) push(c + 256, x, y + 1, z);
    }
    for (let a = 0; a < 6; a++) {
      if (!(faces & (1 << a))) continue;
      for (let b = a + 1; b < 6; b++) if (faces & (1 << b)) bits |= pairBit(a, b);
    }
    // eslint-disable-next-line no-inner-declarations
    function push(ci: number, x: number, y: number, z: number): void {
      if (visited[ci]) return;
      visited[ci] = 1;
      if (OPAQUE[blocks[pidx(x, y, z)]]) return;
      stack[sp++] = ci;
    }
  }
  return bits;
}
