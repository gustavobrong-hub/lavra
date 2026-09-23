/**
 * Carniçal: morto-vivo magro de pele cinza-esverdeada, roupas rasgadas de trabalhador rural (camisa de
 * algodão cru e calça remendada), olhos fundos com brilho âmbar. Modelo de referência dos bípedes.
 * O náufrago reusa a malha com pele encharcada (algas, cracas) — variante 'naufrago'.
 */
import type { ModelDef, PartDef } from '../boxmodel';
import { head, biped } from '../anim';
import type { Face } from '../skin';

/** Esqueleto bípede padrão (32 px de altura): cabeça 8³, tronco 8×12×4, braços/pernas 4×12×4. */
export function bipedParts(o: { armW?: number; headSize?: number; legH?: number; slim?: boolean } = {}): PartDef[] {
  const aw = o.armW ?? 4, hs = o.headSize ?? 8, lh = o.legH ?? 12;
  const bodyTop = lh + 12;
  const w = o.slim ? 2 : aw;
  return [
    { name: 'body', pivot: [0, bodyTop, 0], cubes: [{ o: [-4, lh, -2], s: [8, 12, 4] }] },
    { name: 'head', pivot: [0, bodyTop, 0], cubes: [{ o: [-hs / 2, bodyTop, -hs / 2], s: [hs, hs, hs] }] },
    { name: 'armR', pivot: [-5, bodyTop - 2, 0], cubes: [{ o: [-4 - w, lh, -w / 2], s: [w, 12, w] }] },
    { name: 'armL', pivot: [5, bodyTop - 2, 0], cubes: [{ o: [4, lh, -w / 2], s: [w, 12, w], mirror: true, skinOf: 'armR' }] },
    { name: 'legR', pivot: [-2, lh, 0], cubes: [{ o: [-4, 0, -2], s: [4, lh, 4] }] },
    { name: 'legL', pivot: [2, lh, 0], cubes: [{ o: [0, 0, -2], s: [4, lh, 4], mirror: true, skinOf: 'legR' }] },
  ];
}

const SKIN = 0x7f9474, SKIN_D = 0x5e6f56, SKIN_W = 0x6d8a86; // pele; sombra; náufrago
const SHIRT = 0xb8ab8c, SHIRT_D = 0x8f8468, PANTS = 0x4a5a6e, PANTS_D = 0x36424f;

function skinTex(g: Face, wet: boolean): void {
  g.noise(wet ? SKIN_W : SKIN, 0.1);
  // manchas de decomposição
  g.spots(wet ? 0x587470 : SKIN_D, Math.max(1, Math.floor(g.w * g.h / 60)), 0.8, 1.8);
  if (wet) g.spots(0x3f6b4f, Math.floor(g.w * g.h / 90), 0.6, 1.4); // algas
}

export const CARNICAL: ModelDef = {
  id: 'carnical',
  parts: bipedParts(),
  paint(sk, variant) {
    const wet = variant === 'naufrago';
    sk.cube('head', (g, f) => {
      skinTex(g, wet);
      if (f === 'top') { g.noise(wet ? 0x2c3a33 : 0x3a3129, 0.15); for (let i = 0; i < 10; i++) g.px(sk.r() * g.w, sk.r() * g.h, wet ? 0x46725a : 0x51463b); }
      if (f === 'front') {
        // cabelo ralo na testa, olhos fundos com brilho âmbar, boca rasgada
        g.rect(0, 0, g.w, 3, wet ? 0x2c3a33 : 0x3a3129);
        for (let x = 0; x < g.w; x += 3) g.px(x + 1, 3, wet ? 0x2c3a33 : 0x3a3129);
        g.rect(3, 6, 4, 3, 0x202a1d); g.rect(g.w - 7, 6, 4, 3, 0x202a1d);
        g.px(4, 7, 0xe0a33a); g.px(5, 7, 0xffcf6a); g.px(g.w - 6, 7, 0xe0a33a); g.px(g.w - 5, 7, 0xffcf6a);
        g.rect(7, 10, 2, 2, SKIN_D);
        g.rect(4, 12, 8, 2, 0x2b1e1c); for (let x = 5; x < 11; x += 2) g.px(x, 12, 0xc9c2a2);
      }
      if (f === 'left' || f === 'right') { g.rect(0, 0, g.w, 4, wet ? 0x2c3a33 : 0x3a3129); g.rect(f === 'left' ? 5 : 8, 7, 3, 3, SKIN_D); }
      if (f === 'back') g.rect(0, 0, g.w, 9, wet ? 0x2c3a33 : 0x3a3129);
    });
    sk.cube('body', (g, f) => {
      // camisa de algodão cru rasgada, pele aparecendo nos rasgos
      g.noise(wet ? 0x7d8a84 : SHIRT, 0.08);
      g.stripes(wet ? 0x66736d : SHIRT_D, 5, 1, 1);
      for (let i = 0; i < 4; i++) { const x = Math.floor(sk.r() * (g.w - 3)), y = Math.floor(sk.r() * (g.h - 4)); g.rect(x, y, 2 + Math.floor(sk.r() * 2), 2 + Math.floor(sk.r() * 3), wet ? SKIN_W : SKIN); }
      if (f === 'front') { g.line(g.w / 2, 0, g.w / 2, 9, wet ? 0x56625d : SHIRT_D); g.px(g.w / 2 - 1, 3, 0x3b3226); g.px(g.w / 2 - 1, 7, 0x3b3226); }
      if (f === 'bottom' || f === 'top') g.noise(wet ? 0x66736d : SHIRT_D, 0.06);
      // barra puída
      for (let x = 0; x < g.w; x++) if (sk.r() < 0.4) g.px(x, g.h - 1, [0, 0, 0, 0]);
      if (wet) g.spots(0x3f6b4f, 3, 0.8, 1.5);
    });
    sk.cube('armR', (g, f) => {
      skinTex(g, wet);
      // manga rasgada até o cotovelo
      if (f !== 'bottom') { g.rect(0, 0, g.w, f === 'top' ? g.h : 9, wet ? 0x7d8a84 : SHIRT); for (let x = 0; x < g.w; x++) if (sk.r() < 0.5) g.px(x, 9, wet ? 0x7d8a84 : SHIRT); }
      if (f === 'bottom') { g.noise(wet ? SKIN_W : SKIN, 0.1); g.rect(1, 1, g.w - 2, g.h - 2, 0x3e4a38); }
    });
    sk.cube('legR', (g, f) => {
      g.noise(wet ? 0x3e4d5c : PANTS, 0.08);
      if (f === 'front') { g.rect(1, 8, 5, 5, wet ? 0x566450 : 0x6b5a3e); g.box(1, 8, 5, 5, 0x2a2a2a); }
      // pés descalços
      if (f !== 'top') { g.rect(0, g.h - 3, g.w, 3, wet ? SKIN_W : SKIN_D); }
      if (f === 'bottom') g.fill(wet ? 0x4f6a66 : 0x4f5f47);
      g.rect(0, 0, g.w, 1, PANTS_D);
    });
  },
  animate(p, s) {
    head(p, s);
    biped(p, s, { armsUp: true });
  },
};
