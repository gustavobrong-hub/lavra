/**
 * Sombras do sol/lua em cascatas (mapa de profundidade em TEXTURE_2D_ARRAY com comparação por hardware).
 * Cada cascata cobre uma esfera em volta de uma fatia do frustum; o centro é alinhado à grade de texels
 * no espaço da luz (sem cintilar ao andar). Cascatas distantes são atualizadas com menos frequência:
 * a matriz guarda a posição da câmera de quando foi desenhada e é corrigida pelo deslocamento.
 */
import type { ChunkRenderer } from './chunks/chunkrenderer';
import type { FrameUBO } from './gl/frameubo';

/** extensão do volume na direção da luz (blocos), para pegar montanhas que fazem sombra de longe */
const EXT = 220;
const QUALITY: Record<number, [number, number]> = { 0: [0, 1], 1: [1, 1024], 2: [2, 1536], 3: [3, 2048], 4: [4, 2048] };

interface Cascade {
  radius: number;
  texel: number;
  anchor: [number, number, number];
  light: [number, number, number];
  /** matriz (coluna-maior) relativa à âncora */
  mat: Float64Array;
  valid: boolean;
}

export class ShadowMaps {
  tex: WebGLTexture;
  private fbos: WebGLFramebuffer[] = [];
  count = 0;
  size = 1;
  private cascades: Cascade[] = [];
  private frameNo = 0;
  private readonly out = new Float32Array(16);
  stats = { drawn: 0, cascadesDrawn: 0 };
  /** raio da penumbra em blocos */
  penumbra = 0.055;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.tex = gl.createTexture()!;
    this.configure(0);
  }

  /** (Re)cria o mapa para um nível de qualidade (0 desliga). */
  configure(quality: number): void {
    const [count, size] = QUALITY[Math.max(0, Math.min(4, quality | 0))];
    if (count === this.count && size === this.size && this.fbos.length) return;
    const gl = this.gl;
    for (const f of this.fbos) gl.deleteFramebuffer(f);
    gl.deleteTexture(this.tex);
    this.count = count;
    this.size = size;
    const layers = Math.max(1, count);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, size, size, layers);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.fbos = [];
    for (let i = 0; i < layers; i++) {
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, this.tex, 0, i);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      // mapa vazio = sem sombra
      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.fbos.push(fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    this.cascades = [];
  }

  /**
   * Atualiza as cascatas devidas e escreve matrizes/parâmetros no bloco Frame.
   * cam: posição da câmera no mundo; fwd: direção da vista; L: direção para a luz.
   */
  update(chunks: ChunkRenderer, frame: FrameUBO, cam: [number, number, number], fwd: [number, number, number],
    L: [number, number, number], fovY: number, aspect: number, distance: number, lightOn: boolean): void {
    const n = this.count;
    frame.vec('shadowParams', lightOn ? n : 0, this.size, this.penumbra, EXT);
    if (!n || !lightOn) return;
    const gl = this.gl;
    this.frameNo++;
    // divisões (esquema prático: mistura log/uniforme)
    const near = 1, lambda = 0.8;
    const splits = [0];
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      splits.push(lambda * near * Math.pow(distance / near, f) + (1 - lambda) * (near + (distance - near) * f));
    }
    const tanY = Math.tan(fovY / 2), tanX = tanY * aspect;
    const k2 = tanX * tanX + tanY * tanY;
    // base da luz
    let e1 = cross(L, [0, 0, 1]);
    if (Math.hypot(e1[0], e1[1], e1[2]) < 1e-3) e1 = cross(L, [1, 0, 0]);
    e1 = norm(e1);
    const e2 = cross(L, e1);
    const texels: number[] = [0, 0, 0, 0];
    this.stats.drawn = 0;
    this.stats.cascadesDrawn = 0;
    for (let i = 0; i < n; i++) {
      const a = splits[i], b = splits[i + 1];
      // esfera da fatia [a,b] (raio fixo para uma dada fatia → estável ao girar a câmera)
      const zc = Math.min(b, ((a + b) / 2) * (1 + k2));
      const radius = Math.ceil(Math.sqrt((b - zc) ** 2 + b * b * k2) + 1);
      const texel = (2 * radius) / this.size;
      texels[i] = texel;
      let c = this.cascades[i];
      if (!c || c.radius !== radius) {
        c = { radius, texel, anchor: [0, 0, 0], light: [0, 0, 0], mat: new Float64Array(16), valid: false };
        this.cascades[i] = c;
      }
      const dAng = c.light[0] * L[0] + c.light[1] * L[1] + c.light[2] * L[2];
      const moved = Math.hypot(cam[0] - c.anchor[0], cam[1] - c.anchor[1], cam[2] - c.anchor[2]);
      const due = i === 0 || !c.valid || dAng < 0.99996 || moved > radius * 0.2 || this.frameNo % (i + 1) === 0;
      if (due) {
        // centro relativo à câmera, alinhado aos texels no espaço da luz (coordenadas do mundo)
        const C = [fwd[0] * zc, fwd[1] * zc, fwd[2] * zc];
        const wx = cam[0] + C[0], wy = cam[1] + C[1], wz = cam[2] + C[2];
        const u = wx * e1[0] + wy * e1[1] + wz * e1[2];
        const v = wx * e2[0] + wy * e2[1] + wz * e2[2];
        const du = Math.round(u / texel) * texel - u, dv = Math.round(v / texel) * texel - v;
        for (let k = 0; k < 3; k++) C[k] += e1[k] * du + e2[k] * dv;
        buildMatrix(c.mat, e1, e2, L, C, radius);
        c.anchor = [cam[0], cam[1], cam[2]];
        c.light = [L[0], L[1], L[2]];
        c.valid = true;
        this.render(chunks, i, c, cam, e1, e2, L, C);
      }
      // matriz para a câmera atual: M · T(cam − âncora)
      const dx = cam[0] - c.anchor[0], dy = cam[1] - c.anchor[1], dz = cam[2] - c.anchor[2];
      const m = c.mat, o = this.out;
      for (let r = 0; r < 16; r++) o[r] = m[r];
      o[12] = m[0] * dx + m[4] * dy + m[8] * dz + m[12];
      o[13] = m[1] * dx + m[5] * dy + m[9] * dz + m[13];
      o[14] = m[2] * dx + m[6] * dy + m[10] * dz + m[14];
      o[15] = m[3] * dx + m[7] * dy + m[11] * dz + m[15];
      frame.shadowMat(i, o);
    }
    frame.vec('cascades', texels[0], texels[1], texels[2], texels[3]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private render(chunks: ChunkRenderer, i: number, c: Cascade, cam: [number, number, number],
    e1: number[], e2: number[], L: number[], C: number[]): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[i]);
    gl.viewport(0, 0, this.size, this.size);
    gl.depthMask(true);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.1, 1.0);
    const R = c.radius + 14;
    const m32 = new Float32Array(c.mat);
    const drawn = chunks.drawShadow(m32, cam[0], cam[1], cam[2], (ox, oy, oz) => {
      const px = ox + 8 - C[0], py = oy + 8 - C[1], pz = oz + 8 - C[2];
      const x = px * e1[0] + py * e1[1] + pz * e1[2];
      if (x > R || x < -R) return false;
      const y = px * e2[0] + py * e2[1] + pz * e2[2];
      if (y > R || y < -R) return false;
      const z = px * L[0] + py * L[1] + pz * L[2];
      return z > -R && z < R + EXT;
    });
    gl.disable(gl.POLYGON_OFFSET_FILL);
    this.stats.drawn += drawn;
    this.stats.cascadesDrawn++;
  }

  dispose(): void {
    for (const f of this.fbos) this.gl.deleteFramebuffer(f);
    this.gl.deleteTexture(this.tex);
  }
}

/** Ortográfica da luz (coluna-maior): x,y ∈ [−R,R]; profundidade de z = R+EXT (perto da luz) a z = −R. */
function buildMatrix(out: Float64Array, e1: number[], e2: number[], L: number[], C: number[], R: number): void {
  const zn = R + EXT, zf = R;
  const range = zn + zf;
  // v = B·(p − C); clip.x = v.x/R; clip.y = v.y/R; clip.z = 2·(zn − v.z)/range − 1
  const tx = -(e1[0] * C[0] + e1[1] * C[1] + e1[2] * C[2]);
  const ty = -(e2[0] * C[0] + e2[1] * C[1] + e2[2] * C[2]);
  const tz = -(L[0] * C[0] + L[1] * C[1] + L[2] * C[2]);
  const sx = 1 / R, sy = 1 / R, sz = -2 / range;
  out[0] = e1[0] * sx; out[4] = e1[1] * sx; out[8] = e1[2] * sx; out[12] = tx * sx;
  out[1] = e2[0] * sy; out[5] = e2[1] * sy; out[9] = e2[2] * sy; out[13] = ty * sy;
  out[2] = L[0] * sz; out[6] = L[1] * sz; out[10] = L[2] * sz; out[14] = tz * sz + (2 * zn) / range - 1;
  out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
}

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v: number[]): number[] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
