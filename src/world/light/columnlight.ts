/**
 * Luz inicial de uma coluna isolada (roda no worker de geração).
 * - Céu: 15 acima do heightmap; desce atenuando pela opacidade (água/folhas −1 por bloco).
 * - BFS horizontal/vertical dentro da coluna para cavernas abertas e saliências.
 * - Blocos emissores (tochas, lava, lumita…) espalham luz de bloco.
 * As bordas com os vizinhos são resolvidas depois, na thread principal.
 */
import { MAX_Y, MIN_Y, SECTION_COUNT } from '../../core/constants';
import { LIGHT_EMIT, LIGHT_OPACITY } from '../blocks/registry';
import { Chunk, FULL_SKY, Section } from '../chunk';

const H = MAX_Y - MIN_Y;

/** Fila compacta de índices (x | z<<4 | yy<<8), yy = y − MIN_Y. */
class Queue {
  data = new Int32Array(1 << 16);
  head = 0;
  tail = 0;
  push(v: number): void {
    if (this.tail >= this.data.length) {
      if (this.head > 0) {
        this.data.copyWithin(0, this.head, this.tail);
        this.tail -= this.head;
        this.head = 0;
      }
      if (this.tail >= this.data.length) {
        const n = new Int32Array(this.data.length * 2);
        n.set(this.data);
        this.data = n;
      }
    }
    this.data[this.tail++] = v;
  }
  get empty(): boolean { return this.head >= this.tail; }
  pop(): number { return this.data[this.head++]; }
  reset(): void { this.head = this.tail = 0; }
}

const q = new Queue();

export function computeHeightmap(chunk: Chunk): void {
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      let h = MIN_Y;
      for (let si = SECTION_COUNT - 1; si >= 0 && h === MIN_Y; si--) {
        const s = chunk.sections[si];
        if (!s || s.count === 0) continue;
        for (let ly = 15; ly >= 0; ly--) {
          const st = s.blocks[(ly << 8) | (z << 4) | x];
          if (st !== 0 && LIGHT_OPACITY[st] > 0) {
            h = MIN_Y + si * 16 + ly + 1;
            break;
          }
        }
      }
      chunk.heightmap[(z << 4) | x] = h;
    }
  }
}

export function computeColumnLight(chunk: Chunk): void {
  computeHeightmap(chunk);
  // aloca as seções abaixo do topo mais alto (onde a luz pode não ser 15)
  let maxH = MIN_Y, minH = MAX_Y;
  for (let i = 0; i < 256; i++) {
    const h = chunk.heightmap[i];
    if (h > maxH) maxH = h;
    if (h < minH) minH = h;
  }
  const topSection = Math.min(SECTION_COUNT - 1, (maxH - MIN_Y) >> 4);
  for (let si = 0; si <= topSection; si++) chunk.ensureSection(si).light.fill(0);
  for (let si = topSection + 1; si < SECTION_COUNT; si++) chunk.sections[si]?.light.fill(FULL_SKY);

  const secs = chunk.sections;
  const getS = (yy: number): Section => secs[yy >> 4] as Section;

  // 1) céu descendo pelas colunas
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      const h = chunk.heightmap[(z << 4) | x];
      const top = (topSection + 1) * 16; // yy exclusivo
      let yy = top - 1;
      // acima do heightmap: 15
      for (; yy >= h - MIN_Y; yy--) {
        const s = getS(yy);
        const i = ((yy & 15) << 8) | (z << 4) | x;
        s.light[i] = FULL_SKY;
      }
      // atenuação abaixo
      let l = 15;
      for (; yy >= 0 && l > 0; yy--) {
        const s = getS(yy);
        const i = ((yy & 15) << 8) | (z << 4) | x;
        const op = LIGHT_OPACITY[s.blocks[i]];
        if (op >= 15) { l = 0; break; }
        l -= Math.max(1, op);
        if (l <= 0) { l = 0; break; }
        s.light[i] = l << 4;
      }
    }
  }

  // 2) BFS do céu dentro da coluna: semeia células com luz > vizinhos transparentes
  q.reset();
  const yStart = Math.max(0, minH - MIN_Y - 16);
  const yEnd = Math.min((topSection + 1) * 16 - 1, maxH - MIN_Y + 1);
  for (let yy = yStart; yy <= yEnd; yy++) {
    const s = getS(yy);
    const base = (yy & 15) << 8;
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const i = base | (z << 4) | x;
        const l = s.light[i] >> 4;
        if (l <= 1) continue;
        // algum vizinho horizontal/abaixo mais escuro e transparente?
        if (
          (x > 0 && needs(s, i - 1, l)) || (x < 15 && needs(s, i + 1, l)) ||
          (z > 0 && needs(s, i - 16, l)) || (z < 15 && needs(s, i + 16, l)) ||
          (yy > 0 && needsAt(secs, yy - 1, z, x, l))
        ) q.push(x | (z << 4) | (yy << 8));
      }
    }
  }
  bfs(chunk, true, (topSection + 1) * 16);

  // 3) luz de blocos
  q.reset();
  for (let si = 0; si < SECTION_COUNT; si++) {
    const s = secs[si];
    if (!s || s.count === 0) continue;
    for (let i = 0; i < 4096; i++) {
      const e = LIGHT_EMIT[s.blocks[i]];
      if (e > 0) {
        s.light[i] = (s.light[i] & 0xf0) | e;
        const x = i & 15, z = (i >> 4) & 15, ly = i >> 8;
        q.push(x | (z << 4) | ((si * 16 + ly) << 8));
      }
    }
  }
  bfs(chunk, false, H);

  // libera seções vazias com luz uniforme de céu
  for (let si = 0; si < SECTION_COUNT; si++) {
    const s = secs[si];
    if (!s || s.count !== 0) continue;
    let uniform = true;
    for (let i = 0; i < 4096; i++) if (s.light[i] !== FULL_SKY) { uniform = false; break; }
    if (uniform) secs[si] = null;
  }
}

function needs(s: Section, i: number, l: number): boolean {
  return LIGHT_OPACITY[s.blocks[i]] < 15 && (s.light[i] >> 4) < l - 1;
}
function needsAt(secs: (Section | null)[], yy: number, z: number, x: number, l: number): boolean {
  const s = secs[yy >> 4];
  if (!s) return false;
  const i = ((yy & 15) << 8) | (z << 4) | x;
  return LIGHT_OPACITY[s.blocks[i]] < 15 && (s.light[i] >> 4) < l - 1;
}

const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];

function bfs(chunk: Chunk, sky: boolean, yLimit: number): void {
  const secs = chunk.sections;
  while (!q.empty) {
    const v = q.pop();
    const x = v & 15, z = (v >> 4) & 15, yy = v >> 8;
    const s = secs[yy >> 4];
    if (!s) continue;
    const i = ((yy & 15) << 8) | (z << 4) | x;
    const l = sky ? s.light[i] >> 4 : s.light[i] & 15;
    if (l <= 1 && !(sky && l === 15)) continue;
    for (let d = 0; d < 6; d++) {
      const nx = x + DX[d], ny = yy + DY[d], nz = z + DZ[d];
      if (nx < 0 || nx > 15 || nz < 0 || nz > 15 || ny < 0 || ny >= yLimit) continue;
      const ns = secs[ny >> 4];
      if (!ns) continue;
      const ni = ((ny & 15) << 8) | (nz << 4) | nx;
      const op = LIGHT_OPACITY[ns.blocks[ni]];
      if (op >= 15) continue;
      let nl = l - Math.max(1, op);
      if (sky && d === 0 && l === 15 && op === 0) nl = 15;
      if (nl <= 0) continue;
      const cur = ns.light[ni];
      if (sky) {
        if ((cur >> 4) >= nl) continue;
        ns.light[ni] = (nl << 4) | (cur & 15);
      } else {
        if ((cur & 15) >= nl) continue;
        ns.light[ni] = (cur & 0xf0) | nl;
      }
      q.push(nx | (nz << 4) | (ny << 8));
    }
  }
}
