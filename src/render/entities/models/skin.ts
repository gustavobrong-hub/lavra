/**
 * Kit de pintura de peles (pixel art procedural) para os modelos de caixas.
 * Cada face de cada cubo vira uma "tela" local (x para a direita e y para baixo, vista de fora).
 * Densidade padrão: 2 texels por pixel de modelo — detalhe acima do original, mantendo o estilo.
 */
export type Col = number | [number, number, number] | [number, number, number, number];

export function rgb(c: Col): [number, number, number, number] {
  if (typeof c === 'number') return [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
  return [c[0], c[1], c[2], c.length > 3 ? (c as number[])[3] : 255];
}
export function shade(c: Col, k: number): [number, number, number] {
  const [r, g, b] = rgb(c);
  return [Math.max(0, Math.min(255, r * k)), Math.max(0, Math.min(255, g * k)), Math.max(0, Math.min(255, b * k))];
}
export function lerpc(a: Col, b: Col, t: number): [number, number, number] {
  const x = rgb(a), y = rgb(b);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

/** Gerador determinístico simples (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FaceName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/** Tela de uma face: coordenadas locais em texels. */
export class Face {
  constructor(readonly img: ImageData, readonly x0: number, readonly y0: number, readonly w: number, readonly h: number, readonly name: FaceName, readonly r: () => number) {}

  px(x: number, y: number, c: Col): void {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = rgb(c);
    const i = ((this.y0 + y) * this.img.width + this.x0 + x) * 4;
    const d = this.img.data;
    if (a >= 255) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
    if (a <= 0) { d[i + 3] = 0; return; }
    const t = a / 255;
    if (d[i + 3] === 0) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; return; }
    d[i] = d[i] + (r - d[i]) * t; d[i + 1] = d[i + 1] + (g - d[i + 1]) * t; d[i + 2] = d[i + 2] + (b - d[i + 2]) * t;
  }
  get(x: number, y: number): [number, number, number, number] {
    x = Math.max(0, Math.min(this.w - 1, Math.floor(x))); y = Math.max(0, Math.min(this.h - 1, Math.floor(y)));
    const i = ((this.y0 + y) * this.img.width + this.x0 + x) * 4;
    const d = this.img.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }
  /** Apaga (transparente). */
  clear(x: number, y: number, w = 1, h = 1): void { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, [0, 0, 0, 0]); }
  fill(c: Col): this { return this.rect(0, 0, this.w, this.h, c); }
  rect(x: number, y: number, w: number, h: number, c: Col): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  /** Contorno de retângulo. */
  box(x: number, y: number, w: number, h: number, c: Col): this {
    for (let i = 0; i < w; i++) { this.px(x + i, y, c); this.px(x + i, y + h - 1, c); }
    for (let j = 0; j < h; j++) { this.px(x, y + j, c); this.px(x + w - 1, y + j, c); }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Col): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Col): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, c);
    }
    return this;
  }
  /** Ruído de cor: base com variação de brilho (pelos, pele, pedra). */
  noise(base: Col, amount = 0.12, grain = 1): this {
    const b = rgb(base);
    for (let y = 0; y < this.h; y += grain) for (let x = 0; x < this.w; x += grain) {
      const k = 1 + (this.r() * 2 - 1) * amount;
      for (let j = 0; j < grain; j++) for (let i = 0; i < grain; i++) this.px(x + i, y + j, [b[0] * k, b[1] * k, b[2] * k]);
    }
    return this;
  }
  /** Degradê vertical (topo → base) com ruído. */
  vgrad(top: Col, bottom: Col, amount = 0.08): this {
    for (let y = 0; y < this.h; y++) {
      const c = lerpc(top, bottom, this.h <= 1 ? 0 : y / (this.h - 1));
      for (let x = 0; x < this.w; x++) { const k = 1 + (this.r() * 2 - 1) * amount; this.px(x, y, [c[0] * k, c[1] * k, c[2] * k]); }
    }
    return this;
  }
  /** Pelagem: fios verticais curtos mais claros/escuros. */
  fur(base: Col, dark: Col, light: Col, density = 0.35): this {
    this.noise(base, 0.06);
    const n = Math.floor(this.w * this.h * density / 3);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(this.r() * this.w), y = Math.floor(this.r() * this.h);
      const c = this.r() < 0.5 ? dark : light;
      const len = 1 + Math.floor(this.r() * 2);
      for (let k = 0; k < len; k++) this.px(x, y + k, c);
    }
    return this;
  }
  /** Manchas arredondadas (vaca, gato malhado, cavalo pampa). */
  spots(c: Col, n: number, rmin: number, rmax: number): this {
    for (let i = 0; i < n; i++) {
      const cx = this.r() * this.w, cy = this.r() * this.h, rr = rmin + this.r() * (rmax - rmin);
      this.ellipse(cx, cy, rr * (0.8 + this.r() * 0.5), rr * (0.7 + this.r() * 0.4), c);
    }
    return this;
  }
  /** Listras horizontais irregulares (gato rajado, peixes). */
  stripes(c: Col, every: number, thick = 1, wobble = 1): this {
    for (let y0 = Math.floor(this.r() * every); y0 < this.h; y0 += every) {
      for (let x = 0; x < this.w; x++) {
        const off = Math.round(Math.sin(x * 0.7 + y0) * wobble);
        for (let t = 0; t < thick; t++) this.px(x, y0 + off + t, c);
      }
    }
    return this;
  }
  /** Escurece a borda (sombra de contorno sutil). */
  rim(k = 0.8, width = 1): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (x >= width && y >= width && x < this.w - width && y < this.h - width) continue;
      const [r, g, b, a] = this.get(x, y);
      if (a === 0) continue;
      this.px(x, y, [r * k, g * k, b * k]);
    }
    return this;
  }
  /** Multiplica o brilho (usar em faces inferiores/laterais). */
  tone(k: number): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const [r, g, b, a] = this.get(x, y);
      if (a === 0) continue;
      this.px(x, y, [r * k, g * k, b * k]);
    }
    return this;
  }
  /** Olho: esclera, íris e brilho (tamanho em texels). */
  eye(x: number, y: number, w: number, h: number, iris: Col, sclera: Col = 0xf4f1e8, pupil: Col = 0x101010): this {
    this.rect(x, y, w, h, sclera);
    const iw = Math.max(1, Math.ceil(w / 2)), ih = h;
    const ix = x + Math.floor((w - iw) / 2) + (w > 2 ? 0 : 0);
    this.rect(ix, y, iw, ih, iris);
    if (w >= 3 && h >= 2) this.px(ix + Math.floor(iw / 2), y + Math.floor(h / 2), pupil);
    this.px(ix, y, [255, 255, 255, 200]);
    return this;
  }
}

export interface FaceRects { front: Rect; back: Rect; left: Rect; right: Rect; top: Rect; bottom: Rect }
export interface Rect { x: number; y: number; w: number; h: number }

/** Pintor de pele: acesso às faces dos cubos pelo id. */
export class SkinPainter {
  readonly r: () => number;
  constructor(readonly img: ImageData, private readonly rects: Map<string, FaceRects>, readonly density: number, seed: number) {
    this.r = rng(seed);
  }
  has(id: string): boolean { return this.rects.has(id); }
  face(id: string, f: FaceName, fn: (g: Face) => void): this {
    const r = this.rects.get(id);
    if (!r) throw new Error(`cubo desconhecido na pele: ${id}`);
    const rc = r[f];
    if (rc.w > 0 && rc.h > 0) fn(new Face(this.img, rc.x, rc.y, rc.w, rc.h, f, this.r));
    return this;
  }
  /** Pinta todas as faces de um cubo (o callback recebe o nome da face). */
  cube(id: string, fn: (g: Face, f: FaceName) => void): this {
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom'] as FaceName[]) this.face(id, f, (g) => fn(g, f));
    return this;
  }
  /** Pinta vários cubos iguais. */
  cubes(ids: string[], fn: (g: Face, f: FaceName, id: string) => void): this {
    for (const id of ids) this.cube(id, (g, f) => fn(g, f, id));
    return this;
  }
  /** Todos os ids que começam com o prefixo. */
  ids(prefix: string): string[] { return [...this.rects.keys()].filter((k) => k === prefix || k.startsWith(prefix)); }
  /** Faces laterais recebem sombreado padrão: topo claro, base escura. */
  static sideTone(f: FaceName): number {
    return f === 'top' ? 1.08 : f === 'bottom' ? 0.62 : f === 'front' || f === 'back' ? 0.95 : 0.86;
  }
}
