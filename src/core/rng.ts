/**
 * Geradores pseudoaleatórios determinísticos (mesma seed → mesmo mundo em qualquer navegador).
 * Tudo em inteiros de 32 bits via Math.imul para ser rápido e reprodutível.
 */

/** Finalizador do MurmurHash3 — espalha bem os bits. */
export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash2(seed: number, x: number, z: number): number {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d);
  h = fmix32(h ^ Math.imul(z | 0, 0x165667b1));
  return h;
}

export function hash3(seed: number, x: number, y: number, z: number): number {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d);
  h = fmix32(h ^ Math.imul(y | 0, 0x9e3779b1));
  h = fmix32(h ^ Math.imul(z | 0, 0x165667b1));
  return h;
}

/** Converte um hash inteiro em float [0,1). */
export const hashToFloat = (h: number): number => (h >>> 8) / 16777216;

/** Converte o texto da seed em um par de inteiros de 32 bits. Números inteiros viram a própria seed. */
export function seedFromString(text: string): number {
  const t = text.trim();
  if (t === '') return (Math.random() * 0xffffffff) >>> 0;
  if (/^-?\d+$/.test(t)) {
    // números: mistura os 64 bits de forma estável
    const big = BigInt.asUintN(64, BigInt(t));
    const lo = Number(big & 0xffffffffn) >>> 0;
    const hi = Number((big >> 32n) & 0xffffffffn) >>> 0;
    return fmix32(lo ^ Math.imul(hi, 0x9e3779b1)) || 1;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h) || 1;
}

/** Deriva uma sub-seed nomeada (cada ruído/feature tem a sua). */
export function subSeed(seed: number, name: string | number): number {
  let h = seed >>> 0;
  const s = String(name);
  for (let i = 0; i < s.length; i++) h = fmix32(h ^ Math.imul(s.charCodeAt(i) + 1, 0x9e3779b1));
  return fmix32(h ^ 0x5bd1e995);
}

/** sfc32 — pequeno, rápido e de boa qualidade. */
export class Random {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = seed >>> 0;
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  static fromHash(...parts: number[]): Random {
    let h = 0x1234567;
    for (const p of parts) h = fmix32(h ^ Math.imul(p | 0, 0x9e3779b1));
    return new Random(h);
  }

  nextU32(): number {
    const a = this.a, b = this.b, c = this.c, d = this.d;
    const t = (((a + b) | 0) + d) | 0;
    this.d = (d + 1) | 0;
    this.a = b ^ (b >>> 9);
    this.b = (c + (c << 3)) | 0;
    let cc = (c << 21) | (c >>> 11);
    cc = (cc + t) | 0;
    this.c = cc;
    return t >>> 0;
  }

  /** [0,1) */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** inteiro em [0, n) */
  nextInt(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** inteiro em [a, b] */
  range(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  float(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  gaussian(): number {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Distribuição triangular como a dos minérios modernos. */
  triangle(min: number, max: number): number {
    const mid = (min + max) / 2;
    const half = (max - min) / 2;
    return Math.round(mid + (this.next() - this.next()) * half);
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}
