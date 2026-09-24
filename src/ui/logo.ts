/**
 * Logotipo "LAVRA" desenhado em código: cada pixel da fonte vira um blocão com face de terra/pedra,
 * grama no topo das letras, lateral em profundidade e sombra. Nada de imagem externa.
 */

const FONT: Record<string, string[]> = {
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  V: ['X...X', 'X...X', 'X...X', '.X.X.', '.X.X.', '.X.X.', '..X..'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
};

function hash(x: number, y: number, k: number): number {
  let v = (x * 374761393 + y * 668265263 + k * 144269504) | 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

const rgb = (r: number, g: number, b: number) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

export function drawLogo(text = 'LAVRA', px = 16): HTMLCanvasElement {
  const letters = [...text].map((c) => FONT[c] ?? FONT.A);
  const cols = letters.length * 6 - 1;
  const depth = Math.round(px * 0.55);
  const W = cols * px + depth + px, H = 7 * px + depth + px;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const filled = (lx: number, ly: number): boolean => {
    const li = Math.floor(lx / 6), cx = lx % 6;
    if (li < 0 || li >= letters.length || cx > 4 || ly < 0 || ly > 6) return false;
    return letters[li][ly][cx] === 'X';
  };
  const ox = px / 2, oy = px / 2;
  // sombra projetada
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < 7; y++) for (let x = 0; x < cols; x++) if (filled(x, y)) g.fillRect(ox + x * px + depth + 4, oy + y * px + depth + 6, px, px);
  // profundidade (lateral e base), em camadas de trás para frente
  for (let d = depth; d > 0; d--) {
    for (let y = 0; y < 7; y++) for (let x = 0; x < cols; x++) {
      if (!filled(x, y)) continue;
      const top = !filled(x, y - 1);
      const k = 0.42 + 0.18 * (1 - d / depth);
      const base = top ? [70, 110, 42] : [96, 70, 48];
      g.fillStyle = rgb(base[0] * k, base[1] * k, base[2] * k);
      g.fillRect(ox + x * px + d, oy + y * px + d, px, px);
    }
  }
  // faces: terra com textura em pixel e grama no topo de cada coluna
  const sub = px / 4;
  for (let y = 0; y < 7; y++) for (let x = 0; x < cols; x++) {
    if (!filled(x, y)) continue;
    const top = !filled(x, y - 1);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const n = hash(x * 4 + i, y * 4 + j, 1);
      let c: number[];
      if (top && j === 0) c = [120 + n * 30, 180 + n * 40, 70 + n * 20];
      else if (top && j === 1 && hash(x * 4 + i, 7, 2) < 0.55) c = [96 + n * 26, 150 + n * 34, 58 + n * 18];
      else if (y >= 5 && n < 0.35) c = [128 + n * 40, 128 + n * 40, 132 + n * 40];
      else c = [134 + n * 36, 96 + n * 26, 62 + n * 18];
      if (n > 0.93) c = c.map((v) => v * 0.72);
      g.fillStyle = rgb(c[0], c[1], c[2]);
      g.fillRect(ox + x * px + i * sub, oy + y * px + j * sub, Math.ceil(sub), Math.ceil(sub));
    }
    // brilho na borda superior-esquerda e sombra na inferior-direita de cada bloco
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(ox + x * px, oy + y * px, px, Math.max(1, px / 16));
    g.fillRect(ox + x * px, oy + y * px, Math.max(1, px / 16), px);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(ox + x * px, oy + y * px + px - Math.max(1, px / 16), px, Math.max(1, px / 16));
  }
  return cv;
}
