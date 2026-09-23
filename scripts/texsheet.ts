/**
 * Folha de contato das texturas de bloco — para revisar a pixel art procedural de uma vez só.
 *
 * Gera `tests/.out/textures.png`: cada textura ampliada 4×, 24 por linha, quadro 0 das animadas,
 * sobre fundo xadrez cinza (para enxergar a transparência), com o nome embaixo (fonte 3×5).
 * Também grava `tests/.out/textures.txt` com a ordem dos nomes.
 *
 * Uso (sem dependências novas — o Vite executa o TypeScript):
 *   node scripts/texsheet.mjs [--only=trecho1,trecho2] [--exact] [--scale=4] [--cols=24]
 *                             [--frames] [--nolabels] [--view=albedo|height|emit|smooth|metal]
 *                             [--out=tests/.out/outra.png]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { TEXTURES } from '../src/world/blocks';
import { paintTexture } from '../src/render/textures/atlas';
import type { Tex } from '../src/render/textures/tex';

// ------------------------------------------------------------------ PNG mínimo (RGBA 8 bits)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  const tb = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)));
  out.set(tb, 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32([tb, data]));
  return out;
}

/** Codifica RGBA (8 bits por canal) em PNG, filtro 0 em todas as linhas. */
export function encodePNG(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const png = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { png.set(p, o); o += p.length; }
  return png;
}

// ------------------------------------------------------------------ fonte 3×5 (minúsculas, dígitos e _)
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

// ------------------------------------------------------------------ folha
export type SheetView = 'albedo' | 'height' | 'emit' | 'smooth' | 'metal';
export interface SheetOptions {
  only?: string[];
  exact?: boolean;
  scale?: number;
  cols?: number;
  frames?: boolean;
  labels?: boolean;
  view?: SheetView;
}
export interface Sheet { width: number; height: number; rgba: Uint8Array; names: string[] }

interface Cell { name: string; tex: Tex }

function collect(o: SheetOptions): Cell[] {
  const cells: Cell[] = [];
  for (const e of TEXTURES) {
    if (o.only && o.only.length) {
      const ok = o.only.some((s) => (o.exact ? e.name === s : e.name.includes(s)));
      if (!ok) continue;
    }
    const n = o.frames ? e.frames : 1;
    for (let f = 0; f < n; f++) cells.push({ name: n > 1 ? `${e.name}#${f}` : e.name, tex: paintTexture(e.name, f, e.frames) });
  }
  return cells;
}

export function buildSheet(o: SheetOptions = {}): Sheet {
  const scale = o.scale ?? 4, cols = o.cols ?? 24, view = o.view ?? 'albedo';
  const labels = o.labels ?? true;
  const cells = collect(o);
  const tile = 16 * scale;
  const charsPerLine = Math.floor((tile + 1) / 4);
  const labelScale = Math.max(1, Math.floor(scale / 4));
  const labelH = labels ? 2 * 6 * labelScale + 2 : 0;
  const pad = 4;
  const cw = tile + pad, ch = tile + labelH + pad;
  const rows = Math.max(1, Math.ceil(cells.length / cols));
  const W = cols * cw + pad, H = rows * ch + pad;
  const img = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { img[i * 4] = 34; img[i * 4 + 1] = 35; img[i * 4 + 2] = 40; img[i * 4 + 3] = 255; }
  const put = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img[i] = r; img[i + 1] = g; img[i + 2] = b;
  };
  cells.forEach((c, idx) => {
    const ox = pad + (idx % cols) * cw, oy = pad + Math.floor(idx / cols) * ch;
    const t = c.tex;
    for (let py = 0; py < tile; py++) for (let px = 0; px < tile; px++) {
      const tx = Math.floor(px / scale), ty = Math.floor(py / scale);
      const k = ty * 16 + tx;
      // xadrez de fundo (4 texels por casa)
      const chk = ((Math.floor(px / (scale * 2)) + Math.floor(py / (scale * 2))) & 1) ? 150 : 110;
      let r = chk, g = chk, b = chk;
      const a = t.rgba[k * 4 + 3] / 255;
      if (view === 'albedo') {
        r = t.rgba[k * 4] * a + chk * (1 - a); g = t.rgba[k * 4 + 1] * a + chk * (1 - a); b = t.rgba[k * 4 + 2] * a + chk * (1 - a);
      } else if (view === 'emit') {
        const e = t.mat[k * 4 + 3] * a;
        r = t.rgba[k * 4] * e; g = t.rgba[k * 4 + 1] * e; b = t.rgba[k * 4 + 2] * e;
      } else {
        const v = view === 'height' ? t.height[k] : view === 'smooth' ? t.mat[k * 4] : t.mat[k * 4 + 1];
        const gv = Math.max(0, Math.min(255, v * 255));
        r = gv * a + chk * (1 - a) * 0.4; g = r; b = gv * a + chk * (1 - a) * 0.6;
      }
      put(ox + px, oy + py, r, g, b);
    }
    if (!labels) return;
    const text = c.name.toLowerCase();
    for (let line = 0; line < 2; line++) {
      const s = text.slice(line * charsPerLine, (line + 1) * charsPerLine);
      for (let ci = 0; ci < s.length; ci++) {
        const glyph = FONT[s[ci]];
        if (!glyph) continue;
        for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
          if (glyph[gy * 3 + gx] !== '1') continue;
          for (let sy = 0; sy < labelScale; sy++) for (let sx = 0; sx < labelScale; sx++) {
            put(ox + (ci * 4 + gx) * labelScale + sx, oy + tile + 2 + (line * 6 + gy) * labelScale + sy, 225, 225, 215);
          }
        }
      }
    }
  });
  return { width: W, height: H, rgba: img, names: cells.map((c) => c.name) };
}

export function main(argv: string[]): string {
  const opt: SheetOptions = {};
  let out = 'tests/.out/textures.png';
  for (const a of argv) {
    const [k, v] = a.replace(/^--/, '').split('=');
    if (k === 'only') opt.only = (v ?? '').split(',').filter(Boolean);
    else if (k === 'exact') opt.exact = true;
    else if (k === 'scale') opt.scale = Math.max(1, parseInt(v, 10) || 4);
    else if (k === 'cols') opt.cols = Math.max(1, parseInt(v, 10) || 24);
    else if (k === 'frames') opt.frames = true;
    else if (k === 'nolabels') opt.labels = false;
    else if (k === 'view') opt.view = v as SheetView;
    else if (k === 'out') out = v;
  }
  const sheet = buildSheet(opt);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePNG(sheet.width, sheet.height, sheet.rgba));
  writeFileSync(out.replace(/\.png$/, '.txt'), sheet.names.map((n, i) => `${i}\t${n}`).join('\n') + '\n');
  return `${out}: ${sheet.names.length} texturas, ${sheet.width}×${sheet.height}px`;
}
