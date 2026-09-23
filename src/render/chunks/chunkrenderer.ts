/**
 * Renderizador de chunks em WebGL2 puro: um VAO por (seção, camada), buffer de índices de quads
 * compartilhado, culling por frustum e por grafo de visibilidade (cavernas), ordenação por distância.
 */
import { SECTION_COUNT, MIN_Y } from '../../core/constants';
import { colKey } from '../../core/math';
import { GLProgram } from '../gl/program';
import { FrameUBO } from '../gl/frameubo';
import { TERRAIN_FS, TERRAIN_VS } from '../shaders/terrain';
import { WATER_FS } from '../shaders/water';
import type { BlockTextures } from './texarrays';
import { pairBit } from '../../mesh/mesher';

const MAX_QUADS = 98304;
const LAYERS = 4;
export const L_SOLID = 0, L_CUTOUT = 1, L_TRANSLUCENT = 2, L_WATER = 3;

interface GPUSection {
  cx: number; sy: number; cz: number;
  vao: (WebGLVertexArrayObject | null)[];
  buf: (WebGLBuffer | null)[];
  quads: number[];
  vis: number;
  skyLit: boolean;
  bytes: number;
}

export interface Frustum { planes: Float64Array } // 6 × (a,b,c,d) em coordenadas relativas à câmera

const ALL_VIS = (1 << 15) - 1;
const DX = [0, 0, 0, 0, -1, 1], DY = [-1, 1, 0, 0, 0, 0], DZ = [0, 0, -1, 1, 0, 0];

export class ChunkRenderer {
  private readonly sections = new Map<number, GPUSection>();
  private readonly indexBuffer: WebGLBuffer;
  readonly progSolid: GLProgram;
  readonly progCutout: GLProgram;
  readonly progTranslucent: GLProgram;
  readonly progWater: GLProgram;
  readonly progShadow: GLProgram;
  /** estatísticas do último frame */
  stats = { drawn: 0, quads: 0, visited: 0, gpuBytes: 0, sections: 0 };
  /** lista visível (chaves) na ordem da BFS (perto → longe) */
  private visible: GPUSection[] = [];
  private stamp = new Uint32Array(0);
  private stampId = 1;
  private gridR = 0;
  private queue = new Int32Array(0);
  private dirs = new Uint8Array(0);
  private from = new Int8Array(0);
  /** colunas carregadas (para decidir por onde a BFS anda) */
  loadedColumn: (cx: number, cz: number) => boolean = () => true;
  /** seção sabidamente só de ar ainda sem malha */
  isEmptySection: (cx: number, sy: number, cz: number) => boolean = () => false;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly tex: BlockTextures) {
    // índices de quads compartilhados
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4, i = q * 6;
      idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2;
      idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
    }
    this.indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    this.progSolid = new GLProgram(gl, 'terreno', TERRAIN_VS, TERRAIN_FS);
    this.progCutout = new GLProgram(gl, 'terreno-recortado', TERRAIN_VS, TERRAIN_FS, { CUTOUT: true });
    this.progTranslucent = new GLProgram(gl, 'terreno-translucido', TERRAIN_VS, TERRAIN_FS, { TRANSLUCENT: true, CUTOUT: true });
    this.progWater = new GLProgram(gl, 'agua', TERRAIN_VS, WATER_FS);
    this.progShadow = new GLProgram(gl, 'sombra', TERRAIN_VS, TERRAIN_FS, { SHADOW_PASS: true });
    for (const p of [this.progSolid, this.progCutout, this.progTranslucent, this.progWater, this.progShadow]) {
      p.bindBlock('Frame', FrameUBO.BINDING);
      p.sampler('uAlbedo', 0);
      p.sampler('uNormalMap', 1);
      p.sampler('uSpec', 2);
      p.sampler('uMeta', 3);
    }
    this.progWater.sampler('uSceneColor', 4);
    this.progWater.sampler('uSceneDepth', 5);
  }

  static key(cx: number, sy: number, cz: number): number { return colKey(cx, cz) * 32 + sy; }

  has(cx: number, sy: number, cz: number): boolean { return this.sections.has(ChunkRenderer.key(cx, sy, cz)); }

  /** Sobe (ou substitui) a malha de uma seção. */
  setSection(cx: number, sy: number, cz: number, layers: Uint32Array[], quads: number[], vis: number, skyLit: boolean): void {
    const gl = this.gl;
    const key = ChunkRenderer.key(cx, sy, cz);
    let s = this.sections.get(key);
    if (!s) {
      s = { cx, sy, cz, vao: [null, null, null, null], buf: [null, null, null, null], quads: [0, 0, 0, 0], vis, skyLit, bytes: 0 };
      this.sections.set(key, s);
    }
    s.vis = vis;
    s.skyLit = skyLit;
    this.stats.gpuBytes -= s.bytes;
    s.bytes = 0;
    for (let l = 0; l < LAYERS; l++) {
      const q = Math.min(quads[l], MAX_QUADS);
      s.quads[l] = q;
      if (q === 0) {
        if (s.buf[l]) { gl.deleteBuffer(s.buf[l]); gl.deleteVertexArray(s.vao[l]); s.buf[l] = null; s.vao[l] = null; }
        continue;
      }
      if (!s.vao[l]) {
        const vao = gl.createVertexArray()!;
        const buf = gl.createBuffer()!;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribIPointer(0, 3, gl.UNSIGNED_INT, 12, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bindVertexArray(null);
        s.vao[l] = vao;
        s.buf[l] = buf;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, s.buf[l]);
      gl.bufferData(gl.ARRAY_BUFFER, layers[l].subarray(0, q * 12), gl.STATIC_DRAW);
      s.bytes += q * 48;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.stats.gpuBytes += s.bytes;
  }

  removeSection(cx: number, sy: number, cz: number): void {
    const key = ChunkRenderer.key(cx, sy, cz);
    const s = this.sections.get(key);
    if (!s) return;
    for (let l = 0; l < LAYERS; l++) {
      if (s.buf[l]) this.gl.deleteBuffer(s.buf[l]);
      if (s.vao[l]) this.gl.deleteVertexArray(s.vao[l]);
    }
    this.stats.gpuBytes -= s.bytes;
    this.sections.delete(key);
  }

  removeColumn(cx: number, cz: number): void {
    for (let sy = 0; sy < SECTION_COUNT; sy++) this.removeSection(cx, sy, cz);
  }

  get sectionCount(): number { return this.sections.size; }

  // ------------------------------------------------------------ visibilidade
  /**
   * BFS a partir da seção da câmera atravessando só faces conectadas (culling de cavernas),
   * testando o frustum. `cam` é a posição da câmera no mundo (double).
   */
  computeVisible(camX: number, camY: number, camZ: number, radius: number, frustum: Frustum, caveCulling: boolean): void {
    const R = radius + 1;
    if (R !== this.gridR) {
      this.gridR = R;
      const n = (2 * R + 1) * (2 * R + 1) * SECTION_COUNT;
      this.stamp = new Uint32Array(n);
      this.queue = new Int32Array(n * 4);
      this.dirs = new Uint8Array(n);
      this.from = new Int8Array(n);
    }
    const stamp = this.stampId = (this.stampId + 1) >>> 0 || 1;
    const W = 2 * R + 1;
    const ccx = Math.floor(camX / 16), ccz = Math.floor(camZ / 16);
    let csy = Math.floor((camY - MIN_Y) / 16);
    csy = Math.max(0, Math.min(SECTION_COUNT - 1, csy));
    const gridIndex = (dx: number, sy: number, dz: number) => ((dz + R) * W + (dx + R)) * SECTION_COUNT + sy;
    const q = this.queue;
    let head = 0, tail = 0;
    const startI = gridIndex(0, csy, 0);
    this.stamp[startI] = stamp;
    this.dirs[startI] = 0;
    this.from[startI] = -1;
    q[tail++] = 0; q[tail++] = csy; q[tail++] = 0;
    const vis = this.visible;
    vis.length = 0;
    let visited = 0;
    const planes = frustum.planes;
    const r2 = (radius + 0.5) * (radius + 0.5);
    while (head < tail) {
      const dx = q[head++], sy = q[head++], dz = q[head++];
      const gi = gridIndex(dx, sy, dz);
      visited++;
      const cx = ccx + dx, cz = ccz + dz;
      const s = this.sections.get(ChunkRenderer.key(cx, sy, cz));
      if (s) vis.push(s);
      const secVis = s ? s.vis : ALL_VIS;
      const came = this.from[gi];
      const dirMask = this.dirs[gi];
      for (let f = 0; f < 6; f++) {
        // não volta na direção oposta a qualquer direção já tomada
        if (dirMask & (1 << (f ^ 1))) continue;
        if (caveCulling && came >= 0 && !(secVis & pairBit(came, f))) continue;
        const nx = dx + DX[f], ny = sy + DY[f], nz = dz + DZ[f];
        if (ny < 0 || ny >= SECTION_COUNT || nx < -radius || nx > radius || nz < -radius || nz > radius) continue;
        if (nx * nx + nz * nz > r2) continue;
        const ni = gridIndex(nx, ny, nz);
        if (this.stamp[ni] === stamp) continue;
        this.stamp[ni] = stamp;
        if (!this.loadedColumn(ccx + nx, ccz + nz)) continue;
        // frustum (AABB da seção relativa à câmera)
        const minX = (ccx + nx) * 16 - camX, minY = MIN_Y + ny * 16 - camY, minZ = (ccz + nz) * 16 - camZ;
        if (!aabbInFrustum(planes, minX, minY, minZ, minX + 16, minY + 16, minZ + 16)) continue;
        this.dirs[ni] = dirMask | (1 << f);
        this.from[ni] = f ^ 1;
        q[tail++] = nx; q[tail++] = ny; q[tail++] = nz;
      }
    }
    this.stats.visited = visited;
  }

  // ------------------------------------------------------------ desenho
  private bindTextures(): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex.albedo);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex.normal);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex.spec);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.meta);
  }

  /** Camadas opacas (sólida + recortada). O framebuffer de destino já deve estar ligado. */
  drawOpaque(camX: number, camY: number, camZ: number): void {
    const gl = this.gl;
    this.stats.drawn = 0;
    this.stats.quads = 0;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    this.bindTextures();
    this.drawLayer(this.progSolid, L_SOLID, camX, camY, camZ, false);
    this.drawLayer(this.progCutout, L_CUTOUT, camX, camY, camZ, false);
  }

  drawWater(camX: number, camY: number, camZ: number, sceneColor: WebGLTexture, sceneDepth: WebGLTexture, near: number, far: number, ssr: boolean): void {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    this.bindTextures();
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, sceneColor);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, sceneDepth);
    this.progWater.use();
    gl.uniform2f(this.progWater.loc('uNearFar'), near, far);
    gl.uniform1f(this.progWater.loc('uSSR'), ssr ? 1 : 0);
    this.drawLayer(this.progWater, L_WATER, camX, camY, camZ, false);
    gl.enable(gl.CULL_FACE);
  }

  drawTranslucent(camX: number, camY: number, camZ: number): void {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    this.bindTextures();
    this.drawLayer(this.progTranslucent, L_TRANSLUCENT, camX, camY, camZ, true);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  private drawLayer(p: GLProgram, layer: number, camX: number, camY: number, camZ: number, backToFront: boolean): void {
    const gl = this.gl;
    p.use();
    const loc = p.loc('uOrigin');
    const list = this.visible;
    const n = list.length;
    for (let k = 0; k < n; k++) {
      const s = list[backToFront ? n - 1 - k : k];
      const q = s.quads[layer];
      if (!q) continue;
      gl.uniform3f(loc, s.cx * 16 - camX, MIN_Y + s.sy * 16 - camY, s.cz * 16 - camZ);
      gl.bindVertexArray(s.vao[layer]);
      gl.drawElements(gl.TRIANGLES, q * 6, gl.UNSIGNED_INT, 0);
      this.stats.drawn++;
      this.stats.quads += q;
    }
    gl.bindVertexArray(null);
  }

  /** Passe de sombra: desenha seções dentro do volume da cascata. */
  drawShadow(lightViewProj: Float32Array, camX: number, camY: number, camZ: number, inVolume: (minX: number, minY: number, minZ: number) => boolean): number {
    const gl = this.gl;
    const p = this.progShadow;
    p.use();
    gl.uniformMatrix4fv(p.loc('uLightViewProj'), false, lightViewProj);
    this.bindTextures();
    const loc = p.loc('uOrigin');
    let count = 0;
    for (const s of this.sections.values()) {
      if (!s.skyLit) continue;
      const ox = s.cx * 16 - camX, oy = MIN_Y + s.sy * 16 - camY, oz = s.cz * 16 - camZ;
      if (!inVolume(ox, oy, oz)) continue;
      gl.uniform3f(loc, ox, oy, oz);
      for (const layer of [L_SOLID, L_CUTOUT]) {
        const q = s.quads[layer];
        if (!q) continue;
        gl.bindVertexArray(s.vao[layer]);
        gl.drawElements(gl.TRIANGLES, q * 6, gl.UNSIGNED_INT, 0);
        count++;
      }
    }
    gl.bindVertexArray(null);
    return count;
  }

  dispose(): void {
    for (const s of [...this.sections.values()]) this.removeSection(s.cx, s.sy, s.cz);
    this.gl.deleteBuffer(this.indexBuffer);
  }
}

export function aabbInFrustum(p: Float64Array, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
  for (let i = 0; i < 24; i += 4) {
    const a = p[i], b = p[i + 1], c = p[i + 2], d = p[i + 3];
    const x = a >= 0 ? maxX : minX, y = b >= 0 ? maxY : minY, z = c >= 0 ? maxZ : minZ;
    if (a * x + b * y + c * z + d < 0) return false;
  }
  return true;
}
