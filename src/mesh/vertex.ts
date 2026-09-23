/**
 * Formato compacto do vértice (3×uint32 = 12 bytes):
 *  w0: x(9) | y(9)<<9 | z(9)<<18 | normal(3)<<27 | balanço(2)<<30      — posição em 1/16 de bloco
 *  w1: u(9) | v(9)<<9 | camada(11)<<18 | ao(2)<<29 | extra(1)<<31      — uv em 1/16 de textura
 *  w2: céu(6) | bloco(6)<<6 | flags(4)<<12 | cor RGB565<<16             — luz = soma de 4 amostras (0..60)
 */
export const FLAG_UNDERWATER = 1;
export const FLAG_FLOWING = 2;
export const FLAG_EMISSIVE = 4;
export const FLAG_NO_SHADE = 8;

export const N_DOWN = 0, N_UP = 1, N_NORTH = 2, N_SOUTH = 3, N_WEST = 4, N_EAST = 5, N_PLANT = 6, N_DERIV = 7;

export class QuadBuffer {
  data: Uint32Array;
  quads = 0;

  constructor(initialQuads = 1024) {
    this.data = new Uint32Array(initialQuads * 12);
  }

  reset(): void { this.quads = 0; }

  private ensure(): void {
    if ((this.quads + 1) * 12 > this.data.length) {
      const n = new Uint32Array(this.data.length * 2);
      n.set(this.data);
      this.data = n;
    }
  }

  /** Acrescenta um quad com 4 vértices já empacotados. */
  push(a0: number, a1: number, a2: number, b0: number, b1: number, b2: number,
    c0: number, c1: number, c2: number, d0: number, d1: number, d2: number): void {
    this.ensure();
    const o = this.quads * 12;
    const d = this.data;
    d[o] = a0; d[o + 1] = a1; d[o + 2] = a2;
    d[o + 3] = b0; d[o + 4] = b1; d[o + 5] = b2;
    d[o + 6] = c0; d[o + 7] = c1; d[o + 8] = c2;
    d[o + 9] = d0; d[o + 10] = d1; d[o + 11] = d2;
    this.quads++;
  }

  /** Cópia exata (para transferir ao thread principal). */
  slice(): Uint32Array {
    return this.data.slice(0, this.quads * 12);
  }
}

export const packW0 = (x: number, y: number, z: number, normal: number, wave: number): number =>
  ((x & 511) | ((y & 511) << 9) | ((z & 511) << 18) | ((normal & 7) << 27) | ((wave & 3) << 30)) >>> 0;

export const packW1 = (u: number, v: number, layer: number, ao: number, extra = 0): number =>
  ((u & 511) | ((v & 511) << 9) | ((layer & 2047) << 18) | ((ao & 3) << 29) | ((extra & 1) << 31)) >>> 0;

export const packW2 = (sky: number, blk: number, flags: number, tint: number): number =>
  ((sky & 63) | ((blk & 63) << 6) | ((flags & 15) << 12) | ((tint & 65535) << 16)) >>> 0;
