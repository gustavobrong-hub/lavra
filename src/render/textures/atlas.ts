/**
 * Monta os dados dos texture arrays de blocos: cor (sRGB), normal+altura e material (PBR),
 * com mipmaps feitos à mão (preservando a cobertura do alfa em texturas recortadas).
 */
import { TEXTURES, textureCount } from '../../world/blocks/registry';
import { texMeta } from '../../world/blocks/texmeta';
import { SIZE, Tex } from './tex';
import { PAINTERS } from './painters';
import { fallbackPainter } from './painters/fallback';

export const MIP_LEVELS = 5; // 16, 8, 4, 2, 1

export interface TextureArrays {
  layers: number;
  /** por nível de mip: RGBA8 com todas as camadas */
  albedo: Uint8Array[];
  normal: Uint8Array[];
  spec: Uint8Array[];
  /** metadados por camada: [quadros, ticks/quadro, flags, emissão] */
  meta: Uint8Array;
  missing: string[];
}

export const META_TINT_MASK = 1;
export const META_RANDOM_ROT = 2;
export const META_CUTOUT = 4;
export const META_ANIMATED = 8;
export const META_WATER = 16;
export const META_LAVA = 32;

const srgbToLin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const linToSrgb = (v: number) => { const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, c)) * 255); };
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) LIN[i] = srgbToLin(i);

export function paintTexture(name: string, frame: number, frames: number): Tex {
  const t = new Tex(name, frame, frames);
  const p = PAINTERS[name];
  if (p) p(t); else fallbackPainter(t);
  return t;
}

export function buildTextureArrays(): TextureArrays {
  const layers = Math.max(1, textureCount());
  const albedo: Uint8Array[] = [], normal: Uint8Array[] = [], spec: Uint8Array[] = [];
  for (let l = 0; l < MIP_LEVELS; l++) {
    const s = SIZE >> l;
    albedo.push(new Uint8Array(s * s * 4 * layers));
    normal.push(new Uint8Array(s * s * 4 * layers));
    spec.push(new Uint8Array(s * s * 4 * layers));
  }
  const meta = new Uint8Array(layers * 4);
  const missing: string[] = [];
  for (const e of TEXTURES) {
    const m = texMeta(e.name);
    if (!PAINTERS[e.name]) missing.push(e.name);
    for (let f = 0; f < e.frames; f++) {
      const layer = e.layer + f;
      const t = paintTexture(e.name, f, e.frames);
      let cutout = false;
      for (let i = 3; i < t.rgba.length; i += 4) if (t.rgba[i] < 250) { cutout = true; break; }
      writeLayer(t, layer, albedo, normal, spec, cutout && !m.tintMask);
      let flags = 0;
      if (m.tintMask) flags |= META_TINT_MASK;
      if (m.randomRotate) flags |= META_RANDOM_ROT;
      if (cutout && !m.tintMask) flags |= META_CUTOUT;
      if (e.frames > 1) flags |= META_ANIMATED;
      if (m.material === 'water') flags |= META_WATER;
      if (m.material === 'lava') flags |= META_LAVA;
      meta[layer * 4] = e.frames;
      meta[layer * 4 + 1] = m.frameTime ?? 1;
      meta[layer * 4 + 2] = flags;
      meta[layer * 4 + 3] = Math.round((m.emissive ?? 0) * 255);
    }
  }
  return { layers, albedo, normal, spec, meta, missing };
}

function writeLayer(t: Tex, layer: number, albedo: Uint8Array[], normal: Uint8Array[], spec: Uint8Array[], cutout: boolean): void {
  const S = SIZE;
  // ---- nível 0
  const a0 = albedo[0], n0 = normal[0], s0 = spec[0];
  const base = layer * S * S * 4;
  a0.set(t.rgba, base);
  // normal a partir da altura (Sobel periódico)
  const H = (x: number, y: number) => t.height[((y + S) % S) * S + ((x + S) % S)];
  const strength = 2.2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = -dy * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    const i = base + (y * S + x) * 4;
    n0[i] = Math.round((nx * 0.5 + 0.5) * 255);
    n0[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    n0[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    n0[i + 3] = Math.round(Math.max(0, Math.min(1, H(x, y))) * 255);
    const k = (y * S + x) * 4;
    s0[i] = Math.round(t.mat[k] * 255);
    s0[i + 1] = Math.round(t.mat[k + 1] * 255);
    s0[i + 2] = Math.round(t.mat[k + 2] * 255);
    s0[i + 3] = Math.round(t.mat[k + 3] * 255);
  }
  // ---- mips
  const coverage0 = cutout ? coverage(a0, base, S, 0.5) : 0;
  for (let l = 1; l < MIP_LEVELS; l++) {
    const ps = S >> (l - 1), s = S >> l;
    const pb = layer * ps * ps * 4, b = layer * s * s * 4;
    const pa = albedo[l - 1], ca = albedo[l];
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let r = 0, g = 0, bl = 0, a = 0, wsum = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const i = pb + ((y * 2 + dy) * ps + (x * 2 + dx)) * 4;
        const w = cutout ? pa[i + 3] / 255 : 1;
        r += LIN[pa[i]] * w; g += LIN[pa[i + 1]] * w; bl += LIN[pa[i + 2]] * w; a += pa[i + 3]; wsum += w;
      }
      const o = b + (y * s + x) * 4;
      const inv = wsum > 0 ? 1 / wsum : 0;
      ca[o] = linToSrgb(r * inv); ca[o + 1] = linToSrgb(g * inv); ca[o + 2] = linToSrgb(bl * inv); ca[o + 3] = Math.round(a / 4);
    }
    if (cutout) preserveCoverage(ca, b, s, coverage0);
    for (const arr of [normal, spec]) {
      const pp = arr[l - 1], cc = arr[l];
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const o = b + (y * s + x) * 4;
        for (let c = 0; c < 4; c++) {
          let sum = 0;
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) sum += pp[pb + ((y * 2 + dy) * ps + (x * 2 + dx)) * 4 + c];
          cc[o + c] = Math.round(sum / 4);
        }
      }
    }
  }
}

function coverage(a: Uint8Array, base: number, s: number, ref: number, scaleK = 1): number {
  let n = 0;
  for (let i = 0; i < s * s; i++) if ((a[base + i * 4 + 3] / 255) * scaleK >= ref) n++;
  return n / (s * s);
}

/** Ajusta o alfa do mip para manter a mesma fração de pixels visíveis (folhas não "somem" de longe). */
function preserveCoverage(a: Uint8Array, base: number, s: number, target: number): void {
  let lo = 0.5, hi = 8;
  for (let it = 0; it < 12; it++) {
    const mid = (lo + hi) / 2;
    if (coverage(a, base, s, 0.5, mid) < target) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  for (let i = 0; i < s * s; i++) a[base + i * 4 + 3] = Math.min(255, Math.round(a[base + i * 4 + 3] * k));
}
