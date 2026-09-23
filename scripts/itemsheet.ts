/**
 * Folha de contato dos sprites de ITENS (16×16) — para revisar a pixel art dos ícones de uma vez só.
 *
 * Gera `tests/.out/items.png`: cada sprite ampliado 4×, 16 por linha, sobre fundo xadrez (para enxergar a
 * transparência), com o id embaixo (fonte 3×5). A ordem segue `tests/.out/items_needed.txt` (ids sem sprite
 * aparecem como um X magenta) e depois os sprites extras. Também grava `tests/.out/items.txt` com a ordem.
 *
 * Uso (sem dependências novas — o Vite executa o TypeScript):
 *   node scripts/itemsheet.mjs [--only=trecho1,trecho2] [--exact] [--scale=4] [--cols=16] [--nolabels]
 *                              [--view=albedo|emit|height|smooth|metal] [--out=tests/.out/items.png]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { encodePNG } from './texsheet.ts';
import { ITEM_SPRITES } from '../src/render/items/painters';
import { Tex } from '../src/render/textures/tex';

// ------------------------------------------------------------------ fonte 3×5 (a mesma de scripts/texsheet.ts)
const FONT: Record<string, string> = {
  a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110', e: '111100110100111',
  f: '111100110100100', g: '011100101101011', h: '101101111101101', i: '111010010010111', j: '001001001101010',
  k: '101101110101101', l: '100100100100111', m: '101111111101101', n: '110101101101101', o: '010101101101010',
  p: '110101110100100', q: '010101101110011', r: '110101110101101', s: '011100010001110', t: '111010010010010',
  u: '101101101101111', v: '101101101101010', w: '101101111111101', x: '101101010101101', y: '101101010010010',
  z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', _: '000000000000111', '#': '101111101111101',
};

export type ItemView = 'albedo' | 'height' | 'emit' | 'smooth' | 'metal';
export interface ItemSheetOptions { only?: string[]; exact?: boolean; scale?: number; cols?: number; labels?: boolean; view?: ItemView }
export interface ItemSheet { width: number; height: number; rgba: Uint8Array; names: string[]; missing: string[] }

/** Ids esperados (lista do orquestrador) seguidos dos sprites que não estão na lista. */
export function itemIds(): string[] {
  const path = 'tests/.out/items_needed.txt';
  const needed = existsSync(path)
    ? readFileSync(path, 'utf8').split('\n').map((l) => l.split('\t')[0].trim()).filter(Boolean)
    : [];
  const extra = Object.keys(ITEM_SPRITES).filter((k) => !needed.includes(k));
  return [...needed, ...extra];
}

/** Pinta um sprite num Tex novo (null se não houver pintor). */
export function paintItem(id: string): Tex | null {
  const p = ITEM_SPRITES[id];
  if (!p) return null;
  const t = new Tex(id);
  p(t);
  return t;
}

export function buildItemSheet(o: ItemSheetOptions = {}): ItemSheet {
  const scale = o.scale ?? 4, cols = o.cols ?? 16, view = o.view ?? 'albedo', labels = o.labels ?? true;
  let ids = itemIds();
  if (o.only && o.only.length) ids = ids.filter((id) => o.only!.some((s) => (o.exact ? id === s : id.includes(s))));
  const tile = 16 * scale;
  const charsPerLine = Math.floor((tile + 1) / 4);
  const labelScale = Math.max(1, Math.floor(scale / 4));
  const labelH = labels ? 2 * 6 * labelScale + 2 : 0;
  const pad = 4, cw = tile + pad, ch = tile + labelH + pad;
  const rows = Math.max(1, Math.ceil(ids.length / cols));
  const W = cols * cw + pad, H = rows * ch + pad;
  const img = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { img[i * 4] = 34; img[i * 4 + 1] = 35; img[i * 4 + 2] = 40; img[i * 4 + 3] = 255; }
  const put = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img[i] = r; img[i + 1] = g; img[i + 2] = b;
  };
  const missing: string[] = [];
  ids.forEach((id, idx) => {
    const ox = pad + (idx % cols) * cw, oy = pad + Math.floor(idx / cols) * ch;
    const t = paintItem(id);
    if (!t) missing.push(id);
    for (let py = 0; py < tile; py++) for (let px = 0; px < tile; px++) {
      const chk = ((Math.floor(px / (scale * 2)) + Math.floor(py / (scale * 2))) & 1) ? 150 : 110;
      if (!t) {
        const onX = Math.abs(px - py) < scale || Math.abs(px + py - tile) < scale;
        put(ox + px, oy + py, onX ? 255 : chk, onX ? 0 : chk, onX ? 255 : chk);
        continue;
      }
      const k = Math.floor(py / scale) * 16 + Math.floor(px / scale);
      const a = t.rgba[k * 4 + 3] / 255;
      let r = chk, g = chk, b = chk;
      if (view === 'albedo') {
        r = t.rgba[k * 4] * a + chk * (1 - a); g = t.rgba[k * 4 + 1] * a + chk * (1 - a); b = t.rgba[k * 4 + 2] * a + chk * (1 - a);
      } else if (view === 'emit') {
        const e = t.mat[k * 4 + 3] * a;
        r = t.rgba[k * 4] * e + 20 * (1 - e); g = t.rgba[k * 4 + 1] * e + 20 * (1 - e); b = t.rgba[k * 4 + 2] * e + 24 * (1 - e);
      } else {
        const v = view === 'height' ? t.height[k] : view === 'smooth' ? t.mat[k * 4] : t.mat[k * 4 + 1];
        const gv = Math.max(0, Math.min(255, v * 255));
        r = gv * a + chk * (1 - a) * 0.4; g = r; b = gv * a + chk * (1 - a) * 0.6;
      }
      put(ox + px, oy + py, r, g, b);
    }
    if (!labels) return;
    const text = id.toLowerCase();
    for (let line = 0; line < 2; line++) {
      const s = text.slice(line * charsPerLine, (line + 1) * charsPerLine);
      for (let ci = 0; ci < s.length; ci++) {
        const glyph = FONT[s[ci]];
        if (!glyph) continue;
        for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
          if (glyph[gy * 3 + gx] !== '1') continue;
          for (let sy = 0; sy < labelScale; sy++) for (let sx = 0; sx < labelScale; sx++) {
            put(ox + (ci * 4 + gx) * labelScale + sx, oy + tile + 2 + (line * 6 + gy) * labelScale + sy, t ? 225 : 255, t ? 225 : 90, t ? 215 : 255);
          }
        }
      }
    }
  });
  return { width: W, height: H, rgba: img, names: ids, missing };
}

export function main(argv: string[]): string {
  const opt: ItemSheetOptions = {};
  let out = 'tests/.out/items.png';
  for (const a of argv) {
    const [k, v] = a.replace(/^--/, '').split('=');
    if (k === 'only') opt.only = (v ?? '').split(',').filter(Boolean);
    else if (k === 'exact') opt.exact = true;
    else if (k === 'scale') opt.scale = Math.max(1, parseInt(v, 10) || 4);
    else if (k === 'cols') opt.cols = Math.max(1, parseInt(v, 10) || 16);
    else if (k === 'nolabels') opt.labels = false;
    else if (k === 'view') opt.view = v as ItemView;
    else if (k === 'out') out = v;
  }
  const sheet = buildItemSheet(opt);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePNG(sheet.width, sheet.height, sheet.rgba));
  writeFileSync(out.replace(/\.png$/, '.txt'), sheet.names.map((n, i) => `${i}\t${n}`).join('\n') + '\n');
  const miss = sheet.missing.length ? ` — SEM SPRITE (${sheet.missing.length}): ${sheet.missing.join(', ')}` : '';
  return `${out}: ${sheet.names.length} itens, ${sheet.width}×${sheet.height}px${miss}`;
}
