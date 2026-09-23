export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (v - a) / (b - a);
export const remap = (v: number, a0: number, a1: number, b0: number, b1: number): number =>
  b0 + ((v - a0) / (a1 - a0)) * (b1 - b0);
export const clampedRemap = (v: number, a0: number, a1: number, b0: number, b1: number): number =>
  b0 + clamp((v - a0) / (a1 - a0), 0, 1) * (b1 - b0);
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const fract = (x: number): number => x - Math.floor(x);
/** Módulo sempre positivo. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;
export const floorDiv = (a: number, b: number): number => Math.floor(a / b);
export const sq = (x: number): number => x * x;
export const DEG = Math.PI / 180;

/** Chave inteira para coordenadas de coluna (cx, cz) em ±2^20. */
export const colKey = (cx: number, cz: number): number => (cx + 1048576) * 2097152 + (cz + 1048576);
export const colKeyX = (k: number): number => Math.floor(k / 2097152) - 1048576;
export const colKeyZ = (k: number): number => (k % 2097152) - 1048576;

/** Interpolação linear em 3D (trilinear) sobre 8 cantos. */
export function lerp3(
  tx: number, ty: number, tz: number,
  c000: number, c100: number, c010: number, c110: number,
  c001: number, c101: number, c011: number, c111: number,
): number {
  const x00 = c000 + (c100 - c000) * tx;
  const x10 = c010 + (c110 - c010) * tx;
  const x01 = c001 + (c101 - c001) * tx;
  const x11 = c011 + (c111 - c011) * tx;
  const y0 = x00 + (x10 - x00) * ty;
  const y1 = x01 + (x11 - x01) * ty;
  return y0 + (y1 - y0) * tz;
}

/** Converte RGB (0–255) em RGB565. */
export const rgb565 = (r: number, g: number, b: number): number =>
  ((clamp(Math.round(r), 0, 255) >> 3) << 11) | ((clamp(Math.round(g), 0, 255) >> 2) << 5) | (clamp(Math.round(b), 0, 255) >> 3);
export const rgb565ToRgb = (c: number): [number, number, number] => [
  ((c >> 11) & 31) * 255 / 31, ((c >> 5) & 63) * 255 / 63, (c & 31) * 255 / 31,
];
export const hexToRgb = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
