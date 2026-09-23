/**
 * Kit de pintura de texturas 16×16 em pixel art procedural.
 * Cada textura produz: cor (RGBA), altura (para o normal map) e material por pixel
 * (suavidade, metalicidade, porosidade, emissão) — base do PBR.
 */
import { Random, fmix32 } from '../../core/rng';

export type RGB = [number, number, number];
export const SIZE = 16;

export const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
export const gray = (v: number): RGB => [v, v, v];

/** Paleta: do mais escuro ao mais claro. */
export type Palette = RGB[];
export const pal = (...hs: number[]): Palette => hs.map(hex);
/** Gera paleta a partir de uma cor base (tons mais escuros e mais claros). */
export function ramp(base: number | RGB, n = 5, spread = 0.35): Palette {
  const b = typeof base === 'number' ? hex(base) : base;
  const out: Palette = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1; // -1..1
    const k = 1 + t * spread;
    // escurece puxando para o azul/roxo e clareia puxando para o amarelo (luz quente)
    const c: RGB = [b[0] * k + (t > 0 ? t * 10 : t * 4), b[1] * k + (t > 0 ? t * 8 : 0), b[2] * k + (t > 0 ? 0 : -t * 6)];
    out.push(c);
  }
  return out;
}

export class Tex {
  readonly rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
  readonly height = new Float32Array(SIZE * SIZE).fill(0.5);
  /** suavidade, metal, porosidade, emissão (0..1) por pixel */
  readonly mat = new Float32Array(SIZE * SIZE * 4);
  readonly rng: Random;
  readonly seed: number;

  constructor(readonly name: string, readonly frame = 0, readonly frames = 1) {
    let h = 0x2545f491;
    for (let i = 0; i < name.length; i++) h = fmix32(h ^ name.charCodeAt(i));
    this.seed = h;
    this.rng = new Random(h ^ (frame * 0x9e3779b1));
    this.material(0.12, 0, 0.5, 0);
  }

  // ------------------------------------------------------------ acesso básico
  px(x: number, y: number, c: RGB, a = 255): void {
    x &= 15; y &= 15;
    const i = (y * SIZE + x) * 4;
    this.rgba[i] = c[0]; this.rgba[i + 1] = c[1]; this.rgba[i + 2] = c[2]; this.rgba[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    const i = ((y & 15) * SIZE + (x & 15)) * 4;
    return [this.rgba[i], this.rgba[i + 1], this.rgba[i + 2]];
  }
  alpha(x: number, y: number): number { return this.rgba[((y & 15) * SIZE + (x & 15)) * 4 + 3]; }
  setAlpha(x: number, y: number, a: number): void { this.rgba[((y & 15) * SIZE + (x & 15)) * 4 + 3] = a; }
  h(x: number, y: number, v: number): void { this.height[(y & 15) * SIZE + (x & 15)] = v; }
  hGet(x: number, y: number): number { return this.height[(y & 15) * SIZE + (x & 15)]; }
  /** material de um pixel */
  m(x: number, y: number, smooth: number, metal = 0, porosity = 0.5, emission = 0): void {
    const i = ((y & 15) * SIZE + (x & 15)) * 4;
    this.mat[i] = smooth; this.mat[i + 1] = metal; this.mat[i + 2] = porosity; this.mat[i + 3] = emission;
  }
  /** material para a textura inteira */
  material(smooth: number, metal = 0, porosity = 0.5, emission = 0): void {
    for (let i = 0; i < SIZE * SIZE; i++) {
      this.mat[i * 4] = smooth; this.mat[i * 4 + 1] = metal; this.mat[i * 4 + 2] = porosity; this.mat[i * 4 + 3] = emission;
    }
  }
  emit(x: number, y: number, e: number): void { this.mat[((y & 15) * SIZE + (x & 15)) * 4 + 3] = e; }
  fill(c: RGB, a = 255): void { for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) this.px(x, y, c, a); }
  clear(): void { this.rgba.fill(0); }
  rect(x0: number, y0: number, w: number, hh: number, c: RGB, a = 255): void {
    for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, c, a);
  }
  /** Mistura por cima com opacidade (0..1). */
  blend(x: number, y: number, c: RGB, t: number): void {
    const cur = this.get(x, y);
    this.px(x, y, mix(cur, c, t), this.alpha(x, y));
  }
  shadePx(x: number, y: number, k: number): void {
    const c = this.get(x, y);
    this.px(x, y, scale(c, k), this.alpha(x, y));
  }

  // ------------------------------------------------------------ ruídos periódicos (texturas repetem sem emenda)
  /** ruído de valor periódico com período `p` (divisor de 16) */
  vnoise(x: number, y: number, p: number, salt = 0): number {
    const cell = SIZE / p;
    const fx = x / cell, fy = y / cell;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const r = (ix: number, iy: number) => {
      const h = fmix32(this.seed ^ fmix32(((ix % p + p) % p) * 73856093 ^ ((iy % p + p) % p) * 19349663 ^ salt * 83492791));
      return (h >>> 8) / 16777216;
    };
    const a = r(x0, y0), b = r(x0 + 1, y0), c = r(x0, y0 + 1), d = r(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  /** ruído branco determinístico por pixel */
  white(x: number, y: number, salt = 0): number {
    return (fmix32(this.seed ^ fmix32((x & 15) * 374761393 + (y & 15) * 668265263 + salt * 2246822519 + this.frame * 3266489917)) >>> 8) / 16777216;
  }
  /** fBm periódico 0..1 */
  fbm(x: number, y: number, salt = 0): number {
    return this.vnoise(x, y, 2, salt) * 0.45 + this.vnoise(x, y, 4, salt + 1) * 0.3 + this.vnoise(x, y, 8, salt + 2) * 0.17 + this.white(x, y, salt + 3) * 0.08;
  }

  // ------------------------------------------------------------ primitivas de estilo
  /** Preenche com uma paleta usando ruído (valor 0..1 → índice) com leve pontilhado. */
  noisePal(p: Palette, opts: { contrast?: number; bias?: number; salt?: number; heightScale?: number } = {}): void {
    const contrast = opts.contrast ?? 1, bias = opts.bias ?? 0, salt = opts.salt ?? 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      let v = this.fbm(x, y, salt);
      v = (v - 0.5) * contrast + 0.5 + bias + (this.white(x, y, salt + 9) - 0.5) * 0.12;
      const i = Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)));
      this.px(x, y, p[i]);
      this.h(x, y, 0.35 + v * 0.3 * (opts.heightScale ?? 1));
    }
  }
  /** Pontinhos de uma cor. */
  speckle(c: RGB, density: number, salt = 17, heightDelta = 0): void {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (this.white(x, y, salt) < density) { this.px(x, y, c, this.alpha(x, y)); if (heightDelta) this.h(x, y, this.hGet(x, y) + heightDelta); }
    }
  }
  /** Linha de pixels (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, hdelta = 0): void {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (hdelta) this.h(x0, y0, this.hGet(x0, y0) + hdelta);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Desenha um mapa ASCII 16×16: cada caractere indexa a paleta; '.' = transparente, ' ' = mantém. */
  ascii(rows: string[], map: Record<string, RGB | null>, ox = 0, oy = 0): void {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ' ') continue;
        if (ch === '.') { this.px(x + ox, y + oy, [0, 0, 0], 0); continue; }
        const c = map[ch];
        if (c === undefined) continue;
        if (c === null) this.px(x + ox, y + oy, [0, 0, 0], 0);
        else this.px(x + ox, y + oy, c);
      }
    }
  }
  /** Contorno escuro nas bordas do bloco (para tijolos/tábuas). */
  border(c: RGB, sides: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean } = { top: true, bottom: true, left: true, right: true }): void {
    for (let i = 0; i < SIZE; i++) {
      if (sides.top) this.px(i, 0, c);
      if (sides.bottom) this.px(i, 15, c);
      if (sides.left) this.px(0, i, c);
      if (sides.right) this.px(15, i, c);
    }
  }
  /** Copia outra textura (camada base). */
  copyFrom(o: Tex): void {
    this.rgba.set(o.rgba); this.height.set(o.height); this.mat.set(o.mat);
  }
  /** Transparente em tudo. */
  transparent(): void {
    this.rgba.fill(0);
  }
}

export type Painter = (t: Tex) => void;
