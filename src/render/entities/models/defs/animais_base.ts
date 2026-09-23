/**
 * Utilidades do grupo ANIMAIS: cores de tingimento (lã, coleiras), suavização de poses por instância
 * (estado guardado no userData das partes) e pincéis extras de pixel art (manchas irregulares, pintas).
 */
import type { Parts, AnimState } from '../boxmodel';
import { DEG } from '../boxmodel';
import { shade, lerpc, type Col, type Face } from '../skin';
import { COLORS } from '../../../../world/blocks/defs/building';

export { DEG };
export const clamp = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);
export const C = 0.6662;

/** RGB de uma cor de tingimento pelo id (white, orange, ... black). */
export function dyeRgb(id: string): number {
  return COLORS.find((c) => c.id === id)?.rgb ?? 0xf0f0f0;
}

/** Cor de tinta "de pano": clareia os tons quase pretos (nada de preto puro na pele). */
export function clothRgb(id: string): [number, number, number] {
  const c = dyeRgb(id);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  if (l >= 42) return [r, g, b];
  const k = 42 - l;
  return [r + k * 0.9, g + k * 0.9, b + k * 1.05];
}

/**
 * Valor suavizado por instância: aproxima `target` com taxa `rate` (por tick). Guarda o estado no userData
 * da parte `part` (as partes são da instância; resetParts não apaga chaves extras).
 */
export function ease(p: Parts, part: string, key: string, target: number, rate: number, s: AnimState): number {
  const o = p[part];
  if (!o) return target;
  const u = o.userData as unknown as Record<string, number | undefined>;
  const lastT = u[key + '_t'];
  let v = u[key];
  if (v === undefined || lastT === undefined || s.t < lastT || s.t - lastT > 60) v = target;
  else v += (target - v) * (1 - Math.exp(-rate * (s.t - lastT)));
  u[key] = v;
  u[key + '_t'] = s.t;
  return v;
}

/** Mancha irregular: aglomerado de elipses, com halo opcional (pele de porco, malhas). */
export function blotch(g: Face, cx: number, cy: number, r: number, c: Col, halo?: Col): void {
  const n = 3 + Math.floor(g.r() * 3);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([cx + (g.r() * 2 - 1) * r * 0.7, cy + (g.r() * 2 - 1) * r * 0.5, r * (0.45 + g.r() * 0.4)]);
  if (halo) for (const [x, y, rr] of pts) g.ellipse(x, y, rr + 1.2, rr * 0.85 + 1.2, halo);
  for (const [x, y, rr] of pts) g.ellipse(x, y, rr, rr * 0.85, c);
}

/** Pontos soltos (pintas, sal e pimenta, poeira). */
export function speckle(g: Face, c: Col, density: number): void {
  const n = Math.round(g.w * g.h * density);
  for (let i = 0; i < n; i++) g.px(g.r() * g.w, g.r() * g.h, c);
}

/** Pintas em grade escalonada com jitter (galinha d'angola, cavalo pintado). */
export function dots(g: Face, c: Col, every: number, jitter = 1, ring?: Col): void {
  let row = 0;
  for (let y = 1 + Math.floor(g.r() * 2); y < g.h; y += every, row++) {
    for (let x = (row % 2 ? Math.floor(every / 2) : 0) + 1; x < g.w; x += every) {
      const xx = x + Math.round((g.r() * 2 - 1) * jitter), yy = y + Math.round((g.r() * 2 - 1) * jitter * 0.6);
      if (ring) { g.px(xx - 1, yy, ring); g.px(xx + 1, yy, ring); g.px(xx, yy + 1, ring); }
      g.px(xx, yy, c);
    }
  }
}

/** Degradê horizontal (esquerda → direita da face) multiplicando a cor atual. */
export function hshade(g: Face, k0: number, k1: number): void {
  for (let x = 0; x < g.w; x++) {
    const k = k0 + (k1 - k0) * (g.w <= 1 ? 0 : x / (g.w - 1));
    for (let y = 0; y < g.h; y++) { const [r, gg, b, a] = g.get(x, y); if (a) g.px(x, y, [r * k, gg * k, b * k]); }
  }
}

/** Escurece as linhas de baixo (sombra de contato, ex.: onde a perna encosta no corpo). */
export function bottomShade(g: Face, rows: number, k: number): void {
  for (let j = 0; j < rows; j++) {
    const kk = 1 - (1 - k) * (1 - j / rows);
    const y = g.h - 1 - j;
    for (let x = 0; x < g.w; x++) { const [r, gg, b, a] = g.get(x, y); if (a) g.px(x, y, [r * kk, gg * kk, b * kk]); }
  }
}

/** Escurece as linhas de cima (sombra sob o corpo, na raiz das pernas). */
export function topShade(g: Face, rows: number, k: number): void {
  for (let j = 0; j < rows; j++) {
    const kk = 1 - (1 - k) * (1 - j / rows);
    for (let x = 0; x < g.w; x++) { const [r, gg, b, a] = g.get(x, j); if (a) g.px(x, j, [r * kk, gg * kk, b * kk]); }
  }
}

/** Pelagem com leve degradê vertical e fios (base → barriga mais clara ou escura). */
export function coat(g: Face, top: Col, bottom: Col, strand = 0.3, amount = 0.05): void {
  g.vgrad(top, bottom, amount);
  const n = Math.floor(g.w * g.h * strand / 3);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(g.r() * g.w), y = Math.floor(g.r() * g.h);
    const base = lerpc(top, bottom, g.h <= 1 ? 0 : y / (g.h - 1));
    const c = shade(base, g.r() < 0.5 ? 0.86 : 1.1);
    const len = 1 + Math.floor(g.r() * 2);
    for (let k = 0; k < len; k++) g.px(x, y + k, c);
  }
}

/** Mistura cor com peso (atalho). */
export const mix = (a: Col, b: Col, t: number): [number, number, number] => lerpc(a, b, t);
export const dk = (c: Col, k: number): [number, number, number] => shade(c, k);
