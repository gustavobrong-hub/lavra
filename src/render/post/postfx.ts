/**
 * Efeitos de pós em HDR, com o Three: bloom (cadeia de mips com filtro de 13 amostras e média de
 * Karis no primeiro nível), raios de sol em meia resolução (máscara do céu + borrão radial), visibilidade
 * do disco solar (para o lens flare) e exposição automática com adaptação temporal.
 */
import * as THREE from 'three';
import { POST_VS } from '../shaders/post';

const FS_HEAD = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

const DOWN_FS = FS_HEAD + /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;       // 1/tamanho da fonte
uniform float uFirst;      // 1 = primeiro nível (limiar + Karis)
uniform float uThreshold;
uniform float uKnee;
uniform sampler2D tExposure;
uniform vec4 uExpCurve;
uniform float uAutoExposure;
uniform float uExposure;
float exposureNow() {
  float e = uExposure;
  if (uAutoExposure > 0.5) e *= clamp(pow(uExpCurve.x / max(texture(tExposure, vec2(0.5)).r, 1e-5), uExpCurve.y), uExpCurve.z, uExpCurve.w);
  return e;
}
vec3 prefilter(vec3 c) {
  // limiar no brilho percebido (após a exposição): tochas brilham à noite, o céu comum não
  float ex = exposureNow();
  c *= ex;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  return c * w / ex;
}
vec3 s(vec2 o) { return min(texture(tSrc, vUv + o * uTexel).rgb, vec3(40.0)); }
void main() {
  vec3 a = s(vec2(-2, -2)), b = s(vec2(0, -2)), c = s(vec2(2, -2));
  vec3 d = s(vec2(-1, -1)), e = s(vec2(1, -1));
  vec3 f = s(vec2(-2, 0)), g = s(vec2(0, 0)), h = s(vec2(2, 0));
  vec3 i = s(vec2(-1, 1)), j = s(vec2(1, 1));
  vec3 k = s(vec2(-2, 2)), l = s(vec2(0, 2)), m = s(vec2(2, 2));
  vec3 col;
  if (uFirst > 0.5) {
    // média de Karis por grupo (evita "vaga-lumes" de pixels muito brilhantes)
    vec3 g0 = (d + e + i + j) * 0.25, g1 = (a + b + f + g) * 0.25, g2 = (b + c + g + h) * 0.25;
    vec3 g3 = (f + g + k + l) * 0.25, g4 = (g + h + l + m) * 0.25;
    float w0 = 1.0 / (1.0 + lum(g0)), w1 = 1.0 / (1.0 + lum(g1)), w2 = 1.0 / (1.0 + lum(g2));
    float w3 = 1.0 / (1.0 + lum(g3)), w4 = 1.0 / (1.0 + lum(g4));
    col = (g0 * w0 * 0.5 + (g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) * 0.125) / (w0 * 0.5 + (w1 + w2 + w3 + w4) * 0.125);
    col = prefilter(col);
  } else {
    col = (d + e + i + j) * 0.125 + (a + c + k + m) * 0.03125 + (b + f + h + l) * 0.0625 + g * 0.125;
  }
  outColor = vec4(col, 1.0);
}
`;

const UP_FS = FS_HEAD + /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uRadius;
void main() {
  vec2 o = uTexel * uRadius;
  vec3 c = texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture(tSrc, vUv + vec2(o.x, -o.y)).rgb
    + texture(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture(tSrc, vUv + vec2(o.x, o.y)).rgb;
  c += (texture(tSrc, vUv + vec2(0.0, -o.y)).rgb + texture(tSrc, vUv + vec2(0.0, o.y)).rgb
    + texture(tSrc, vUv + vec2(-o.x, 0.0)).rgb + texture(tSrc, vUv + vec2(o.x, 0.0)).rgb) * 2.0;
  c += texture(tSrc, vUv).rgb * 4.0;
  outColor = vec4(c / 16.0, 1.0);
}
`;

// máscara dos raios: só céu, pesada pela proximidade do sol
const RAYMASK_FS = FS_HEAD + /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uSun;        // posição do sol na tela (0..1)
uniform float uAspect;
void main() {
  float acc = 0.0;
  vec3 col = vec3(0.0);
  // 2×2 amostras (a máscara é de meia resolução)
  for (int i = 0; i < 4; i++) {
    vec2 o = (vec2(float(i & 1), float(i >> 1)) - 0.5) / vec2(textureSize(tDepth, 0));
    float dz = texture(tDepth, vUv + o).r;
    if (dz >= 1.0) {
      vec3 c = texture(tColor, vUv + o).rgb;
      // só o que é bem mais claro que o céu comum (sol, bordas iluminadas das nuvens)
      col += min(max(c - vec3(0.9), vec3(0.0)), vec3(12.0));
      acc += 1.0;
    }
  }
  col *= 0.25;
  vec2 dv = (vUv - uSun) * vec2(uAspect, 1.0);
  float fall = exp(-dot(dv, dv) * 7.0);
  outColor = vec4(col * fall, 1.0);
}
`;

const RADIAL_FS = FS_HEAD + /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSun;
uniform float uLength;
uniform float uJitter;
void main() {
  const int N = 32;
  vec2 dir = (uSun - vUv) * uLength / float(N);
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uJitter);
  vec2 p = vUv + dir * j;
  vec3 sum = vec3(0.0);
  float w = 1.0, wsum = 0.0;
  for (int i = 0; i < N; i++) {
    sum += texture(tSrc, p).rgb * w;
    wsum += w;
    w *= 0.965;
    p += dir;
  }
  outColor = vec4(sum / wsum, 1.0);
}
`;

// visibilidade do sol (fração do disco não coberta) e luminância média em log (para exposição)
const LUMA_FS = FS_HEAD + /* glsl */ `
uniform sampler2D tColor;
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  outColor = vec4(log(max(lum(c), 1e-5)), 0.0, 0.0, 1.0);
}
`;

const ADAPT_FS = FS_HEAD + /* glsl */ `
uniform sampler2D tLum;     // mips até 1×1
uniform sampler2D tPrev;    // adaptação anterior (r = luminância média adaptada)
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uSun;
uniform float uSunOn;
uniform vec2 uSunSize;      // meia largura do disco na tela
uniform float uRate;        // 0..1 (fração a adaptar neste quadro)
uniform float uSunLum;
void main() {
  float avgLog = textureLod(tLum, vec2(0.5), 20.0).r;
  float target = exp(avgLog);
  float prev = texture(tPrev, vec2(0.5)).r;
  if (!(prev > 0.0) || prev > 1e4) prev = target;
  float adapted = exp(mix(log(prev), log(target), uRate));
  // visibilidade do sol: 5×5 amostras no disco
  float vis = 0.0;
  if (uSunOn > 0.5) {
    for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
      vec2 uv = uSun + vec2(float(x), float(y)) * 0.5 * uSunSize;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) continue;
      if (texture(tDepth, uv).r < 1.0) continue;
      vis += clamp(lum(texture(tColor, uv).rgb) / max(uSunLum * 0.6, 1e-4), 0.0, 1.0);
    }
    vis /= 25.0;
  }
  outColor = vec4(adapted, vis, 0.0, 1.0);
}
`;

function rt(w: number, h: number, opts: Partial<THREE.RenderTargetOptions> = {}): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, ...opts,
  });
}

function mat(fs: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending = THREE.NoBlending): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: POST_VS, fragmentShader: fs, uniforms,
    depthTest: false, depthWrite: false, blending,
  });
}

export interface SunScreen { uv: [number, number]; on: boolean; facing: number; sizeUV: [number, number]; lum: number }

export class PostFX {
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private bloomMips: THREE.WebGLRenderTarget[] = [];
  private rayA!: THREE.WebGLRenderTarget;
  private rayB!: THREE.WebGLRenderTarget;
  private lum!: THREE.WebGLRenderTarget;
  private adapt: THREE.WebGLRenderTarget[] = [];
  private adaptIdx = 0;
  private readonly down = mat(DOWN_FS, {
    tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uThreshold: { value: 1 }, uKnee: { value: 0.5 },
    tExposure: { value: null }, uExpCurve: { value: new THREE.Vector4() }, uAutoExposure: { value: 0 }, uExposure: { value: 1 },
  });
  private readonly up = mat(UP_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } }, THREE.AdditiveBlending);
  private readonly rayMask = mat(RAYMASK_FS, { tColor: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } });
  private readonly radial = mat(RADIAL_FS, { tSrc: { value: null }, uSun: { value: new THREE.Vector2() }, uLength: { value: 0.9 }, uJitter: { value: 0 } });
  private readonly luma = mat(LUMA_FS, { tColor: { value: null } });
  private readonly adaptMat = mat(ADAPT_FS, {
    tLum: { value: null }, tPrev: { value: null }, tColor: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2() },
    uSunOn: { value: 0 }, uSunSize: { value: new THREE.Vector2() }, uRate: { value: 0.05 }, uSunLum: { value: 1 },
  });
  private w = 0;
  private h = 0;
  private frameNo = 0;

  constructor(private readonly r: THREE.WebGLRenderer) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo, this.down);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    // "blending" aditivo do Three usa SRC_ALPHA; nossos alvos escrevem alfa 1
    this.up.blending = THREE.CustomBlending;
    this.up.blendSrc = THREE.OneFactor;
    this.up.blendDst = THREE.OneFactor;
    this.up.blendEquation = THREE.AddEquation;
    for (let i = 0; i < 2; i++) this.adapt.push(rt(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }));
  }

  resize(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    for (const m of this.bloomMips) m.dispose();
    this.bloomMips = [];
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 6 && bw >= 2 && bh >= 2; i++) {
      this.bloomMips.push(rt(bw, bh));
      bw >>= 1; bh >>= 1;
    }
    this.rayA?.dispose(); this.rayB?.dispose(); this.lum?.dispose();
    this.rayA = rt(w >> 1, h >> 1);
    this.rayB = rt(w >> 1, h >> 1);
    this.lum = rt(64, 32, { minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
  }

  private pass(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = m;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  /** Bloom: devolve a textura de meia resolução com o brilho acumulado. */
  bloom(src: THREE.Texture, threshold: number, knee: number, exposure: { tex: THREE.Texture; curve: THREE.Vector4; auto: boolean; manual: number }): THREE.Texture {
    const mips = this.bloomMips;
    const du = this.down.uniforms;
    du.tExposure.value = exposure.tex;
    du.uExpCurve.value.copy(exposure.curve);
    du.uAutoExposure.value = exposure.auto ? 1 : 0;
    du.uExposure.value = exposure.manual;
    let prevTex = src, pw = this.w, ph = this.h;
    for (let i = 0; i < mips.length; i++) {
      const u = this.down.uniforms;
      u.tSrc.value = prevTex;
      u.uTexel.value.set(1 / pw, 1 / ph);
      u.uFirst.value = i === 0 ? 1 : 0;
      u.uThreshold.value = threshold;
      u.uKnee.value = knee;
      this.pass(this.down, mips[i]);
      prevTex = mips[i].texture; pw = mips[i].width; ph = mips[i].height;
    }
    for (let i = mips.length - 2; i >= 0; i--) {
      const u = this.up.uniforms;
      u.tSrc.value = mips[i + 1].texture;
      u.uTexel.value.set(1 / mips[i + 1].width, 1 / mips[i + 1].height);
      u.uRadius.value = 1;
      this.pass(this.up, mips[i]);
    }
    return mips[0].texture;
  }

  /** Raios de sol: devolve a textura (meia resolução) ou null se o sol não está à vista. */
  godRays(color: THREE.Texture, depth: THREE.Texture, sun: SunScreen): THREE.Texture | null {
    if (!sun.on || sun.facing <= 0) return null;
    const m = this.rayMask.uniforms;
    m.tColor.value = color;
    m.tDepth.value = depth;
    m.uSun.value.set(sun.uv[0], sun.uv[1]);
    m.uAspect.value = this.w / this.h;
    this.pass(this.rayMask, this.rayA);
    const r = this.radial.uniforms;
    r.uSun.value.set(sun.uv[0], sun.uv[1]);
    r.tSrc.value = this.rayA.texture;
    r.uLength.value = 0.95;
    r.uJitter.value = (this.frameNo * 0.618) % 1;
    this.pass(this.radial, this.rayB);
    r.tSrc.value = this.rayB.texture;
    r.uLength.value = 0.3;
    this.pass(this.radial, this.rayA);
    return this.rayA.texture;
  }

  /** Leitura (lenta) da adaptação atual: [luminância média, visibilidade do sol] — para testes. */
  debugRead(): [number, number] {
    const buf = new Uint16Array(4);
    this.r.readRenderTargetPixels(this.adapt[this.adaptIdx], 0, 0, 1, 1, buf);
    return [THREE.DataUtils.fromHalfFloat(buf[0]), THREE.DataUtils.fromHalfFloat(buf[1])];
  }

  /** Exposição automática e visibilidade do sol; devolve a textura 1×1 (r = luminância adaptada, g = sol visível). */
  exposure(color: THREE.Texture, depth: THREE.Texture, sun: SunScreen, dt: number, speed: number): THREE.Texture {
    this.frameNo++;
    this.luma.uniforms.tColor.value = color;
    this.pass(this.luma, this.lum);
    const prev = this.adapt[this.adaptIdx];
    this.adaptIdx ^= 1;
    const next = this.adapt[this.adaptIdx];
    const u = this.adaptMat.uniforms;
    u.tLum.value = this.lum.texture;
    u.tPrev.value = prev.texture;
    u.tColor.value = color;
    u.tDepth.value = depth;
    u.uSun.value.set(sun.uv[0], sun.uv[1]);
    u.uSunOn.value = sun.on && sun.facing > 0 ? 1 : 0;
    u.uSunSize.value.set(sun.sizeUV[0], sun.sizeUV[1]);
    u.uRate.value = 1 - Math.exp(-dt * speed);
    u.uSunLum.value = sun.lum;
    this.pass(this.adaptMat, next);
    return next.texture;
  }
}
