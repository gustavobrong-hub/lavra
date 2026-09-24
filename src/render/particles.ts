/**
 * Partículas: billboards instanciados num único draw, sprites em pixel art gerados em código,
 * a mesma luz (céu da LUT, sol, tochas) e névoa do terreno. Partículas "aditivas" saem com alfa 0
 * no blend pré-multiplicado, então tudo usa o mesmo material.
 */
import * as THREE from 'three';
import { SHARED, blockArrayTexture } from './entities/shared';
import { FRAME_UNIFORMS_GLSL } from './shaders/entity';
import type { World } from '../world/world';
import { FACE_TEX, FLAGS, F_SOLID, F_FLUID } from '../world/blocks/registry';

export const MAX_PARTICLES = 8192;

// ---------------------------------------------------------------- sprites (8×8, atlas 8×4)
export const SP = {
  SMOKE: 0, FLAME: 8, SPARK: 12, GLOW: 13, LEAF: 14, RAIN: 16, SNOW: 17, DROP: 18, BUBBLE: 19,
  HEART: 20, STAR: 21, CRIT: 22, DUST: 23, EMBER: 24, CLOUD: 25, BLOCK: 1000,
} as const;

function buildSprites(): THREE.DataTexture {
  const W = 64, H = 32;
  const px = new Uint8Array(W * H * 4);
  const set = (s: number, x: number, y: number, r: number, g: number, b: number, a = 255) => {
    if (x < 0 || y < 0 || x > 7 || y > 7) return;
    const cx = (s % 8) * 8 + x, cy = Math.floor(s / 8) * 8 + y;
    const i = (cy * W + cx) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const h = (x: number, y: number, k: number) => {
    let v = (x * 374761393 + y * 668265263 + k * 144269504) | 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  // fumaça: 8 quadros do maior ao menor, borda irregular e sombreado
  for (let f = 0; f < 8; f++) {
    const r = 3.9 - f * 0.42;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const dx = x - 3.5, dy = y - 3.5;
      const d = Math.hypot(dx, dy) + (h(x, y, f) - 0.5) * 0.9;
      if (d > r) continue;
      const v = 200 + Math.round(55 * (1 - (dx + dy + 7) / 14)) - Math.round(h(x, y, 9) * 20);
      set(SP.SMOKE + f, x, y, v, v, v, 255);
    }
  }
  // chama: gota amarela → laranja → vermelha (4 quadros)
  for (let f = 0; f < 4; f++) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const w = (y / 7) * 3.2 - f * 0.25;
      const dx = Math.abs(x - 3.5);
      if (dx > w || y < 1 + f) continue;
      const core = dx < w * 0.45 && y > 4;
      if (core) set(SP.FLAME + f, x, y, 255, 244, 170);
      else if (dx < w * 0.8) set(SP.FLAME + f, x, y, 255, 160, 40);
      else set(SP.FLAME + f, x, y, 220, 70, 20);
    }
  }
  // faísca, brilho (vaga-lume), poeira, brasa
  for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4]]) set(SP.SPARK, x, y, 255, 250, 220);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const d = Math.hypot(x - 3.5, y - 3.5);
    if (d < 1.1) set(SP.GLOW, x, y, 255, 255, 230);
    else if (d < 2.3) set(SP.GLOW, x, y, 255, 255, 200, 150);
    else if (d < 3.4) set(SP.GLOW, x, y, 255, 255, 180, 60);
  }
  set(SP.DUST, 3, 3, 255, 255, 255); set(SP.DUST, 4, 4, 255, 255, 255, 180);
  for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4]]) set(SP.EMBER, x, y, 255, 170, 60);
  set(SP.EMBER, 3, 2, 255, 230, 140);
  // folhas (brancas: recebem a cor do bioma)
  const leaf = [[3, 0], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [3, 5], [3, 6]];
  for (const [x, y] of leaf) { const v = 200 + Math.round(h(x, y, 3) * 55); set(SP.LEAF, x, y, v, v, v); set(SP.LEAF + 1, 7 - y, x + 1, v, v, v); }
  // chuva (traço), neve, gota, bolha
  for (let y = 0; y < 8; y++) set(SP.RAIN, 3, y, 190, 210, 255, 150 + y * 12);
  for (const [x, y] of [[3, 2], [2, 3], [3, 3], [4, 3], [3, 4], [1, 1], [5, 5], [5, 1], [1, 5]]) set(SP.SNOW, x, y, 255, 255, 255, x === 3 || y === 3 ? 255 : 150);
  for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4], [3, 2]]) set(SP.DROP, x, y, 200, 220, 255, 220);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const d = Math.hypot(x - 3.5, y - 3.5);
    if (d > 1.6 && d < 2.8) set(SP.BUBBLE, x, y, 220, 240, 255, 220);
    if (x === 2 && y === 2) set(SP.BUBBLE, x, y, 255, 255, 255);
  }
  // coração, estrela verde (feliz), crítico
  const heart = ['.XX.XX..', 'XXXXXXX.', 'XXXXXXX.', '.XXXXX..', '..XXX...', '...X....'];
  heart.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') set(SP.HEART, x, y + 1, x === 1 && y === 1 ? 255 : 230, x === 1 && y === 1 ? 160 : 40, x === 1 && y === 1 ? 160 : 50); }));
  for (const [x, y] of [[3, 1], [3, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [3, 4], [2, 5], [4, 5]]) set(SP.STAR, x, y, 90, 230, 90);
  for (const [x, y] of [[3, 0], [3, 1], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [3, 4], [3, 5], [3, 6]]) set(SP.CRIT, x, y, 255, 255, 255);
  // nuvenzinha (pulo, pouso)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (Math.hypot(x - 3.5, (y - 3.5) * 1.4) < 3.2 - h(x, y, 5)) set(SP.CLOUD, x, y, 240, 240, 240, 230);
  const t = new THREE.DataTexture(px, W, H);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- material
const VS = /* glsl */ `
in vec3 aOffset;
in vec4 aParams;   // tamanho, rotação, sprite, flags
in vec4 aColor;    // rgb, alfa
in vec4 aExtra;    // luz céu, luz bloco, sub-u, sub-v
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vUv;
out vec4 vColor;
out vec4 vExtra;
out vec3 vRel;
flat out float vSprite;
flat out float vFlags;
void main() {
  float size = aParams.x, rot = aParams.y;
  vSprite = aParams.z; vFlags = aParams.w;
  vec2 c = position.xy;
  float cs = cos(rot), sn = sin(rot);
  vec2 rc = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  vec3 right = uRight, up = uUp;
  int fl = int(vFlags + 0.5);
  if ((fl & 8) != 0) {
    // chuva: billboard vertical esticado
    up = vec3(0.0, 1.0, 0.0);
    vec3 toCam = -aOffset;
    right = normalize(cross(up, toCam + vec3(1e-4, 0.0, 0.0)));
    rc = c * vec2(1.0, 7.0);
  }
  vec3 p = aOffset + (right * rc.x + up * rc.y) * size * 2.0;
  vRel = p;
  vUv = uv;
  vColor = aColor;
  vExtra = aExtra;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FS = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
${FRAME_UNIFORMS_GLSL}
uniform sampler2D uSprites;
uniform sampler2DArray uBlocks;
in vec2 vUv;
in vec4 vColor;
in vec4 vExtra;
in vec3 vRel;
flat in float vSprite;
flat in float vFlags;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;
void main() {
  int fl = int(vFlags + 0.5);
  vec4 tex;
  if (vSprite >= 1000.0) {
    // detrito: quadradinho 4×4 da textura do bloco
    vec2 uv = (vExtra.zw * 12.0 + vUv * 4.0) / 16.0;
    tex = texture(uBlocks, vec3(uv, vSprite - 1000.0));
  } else {
    vec2 cell = vec2(mod(vSprite, 8.0), floor(vSprite / 8.0));
    tex = texture(uSprites, (cell + vec2(vUv.x, 1.0 - vUv.y)) / vec2(8.0, 4.0));
  }
  if (tex.a < 0.1) discard;
  vec3 col = tex.rgb * vColor.rgb;
  float a = tex.a * vColor.a;
  vec3 lit;
  if ((fl & 1) != 0) lit = col * 3.0;
  else {
    float skyB = lightCurve(vExtra.x), blkB = lightCurve(vExtra.y);
    vec3 amb = skyIrradiance(vec3(0.0, 1.0, 0.0)) * skyB;
    vec3 sun = uSunColor.rgb * smoothstep(0.6, 0.93, vExtra.x) * 0.6;
    vec3 torch = uBlockLight.rgb * blkB * blkB;
    lit = col * (amb + sun + torch + vec3(0.012, 0.013, 0.018));
  }
  lit = applyFog(lit, vRel);
  outColor = (fl & 2) != 0 ? vec4(lit * a, 0.0) : vec4(lit * a, a);
  outNormal = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// flags
export const PF = { EMISSIVE: 1, ADDITIVE: 2, COLLIDE: 4, STRETCH: 8, ANIM: 16, FADE: 32, WANDER: 64, SHRINK: 128, SPLASH: 256, GROW: 512 } as const;

export interface Spawn {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  life: number; size: number; sprite: number;
  r?: number; g?: number; b?: number; a?: number;
  flags?: number; grav?: number; drag?: number; spin?: number; sub?: [number, number];
}

export class Particles {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly mat: THREE.ShaderMaterial;
  count = 0;
  // estado (SoA)
  private readonly px = new Float64Array(MAX_PARTICLES);
  private readonly py = new Float64Array(MAX_PARTICLES);
  private readonly pz = new Float64Array(MAX_PARTICLES);
  private readonly vx = new Float32Array(MAX_PARTICLES);
  private readonly vy = new Float32Array(MAX_PARTICLES);
  private readonly vz = new Float32Array(MAX_PARTICLES);
  private readonly age = new Float32Array(MAX_PARTICLES);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly size = new Float32Array(MAX_PARTICLES);
  private readonly sprite = new Uint16Array(MAX_PARTICLES);
  private readonly col = new Float32Array(MAX_PARTICLES * 4);
  private readonly flags = new Uint16Array(MAX_PARTICLES);
  private readonly grav = new Float32Array(MAX_PARTICLES);
  private readonly drag = new Float32Array(MAX_PARTICLES);
  private readonly rot = new Float32Array(MAX_PARTICLES);
  private readonly spin = new Float32Array(MAX_PARTICLES);
  private readonly sub = new Float32Array(MAX_PARTICLES * 2);
  private readonly light = new Uint8Array(MAX_PARTICLES);
  private readonly seed = new Float32Array(MAX_PARTICLES);
  // atributos de instância
  private readonly aOffset: THREE.InstancedBufferAttribute;
  private readonly aParams: THREE.InstancedBufferAttribute;
  private readonly aColor: THREE.InstancedBufferAttribute;
  private readonly aExtra: THREE.InstancedBufferAttribute;
  private readonly order = new Uint16Array(MAX_PARTICLES);
  private readonly buckets = new Uint32Array(257);
  private readonly keys = new Uint16Array(MAX_PARTICLES);
  private lightCursor = 0;
  /** respingo de chuva quando uma gota bate no chão */
  onSplash?: (x: number, y: number, z: number) => void;

  constructor(private readonly world: World) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.aOffset = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aParams = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aExtra = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aOffset', this.aOffset);
    this.geo.setAttribute('aParams', this.aParams);
    this.geo.setAttribute('aColor', this.aColor);
    this.geo.setAttribute('aExtra', this.aExtra);
    this.geo.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: {
        ...SHARED,
        uSprites: { value: buildSprites() },
        uBlocks: { value: blockArrayTexture() },
        uRight: { value: new THREE.Vector3(1, 0, 0) },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  spawn(s: Spawn): void {
    if (this.count >= MAX_PARTICLES) return;
    const i = this.count++;
    this.px[i] = s.x; this.py[i] = s.y; this.pz[i] = s.z;
    this.vx[i] = s.vx ?? 0; this.vy[i] = s.vy ?? 0; this.vz[i] = s.vz ?? 0;
    this.age[i] = 0; this.life[i] = s.life; this.size[i] = s.size; this.sprite[i] = s.sprite;
    const c = i * 4;
    this.col[c] = s.r ?? 1; this.col[c + 1] = s.g ?? 1; this.col[c + 2] = s.b ?? 1; this.col[c + 3] = s.a ?? 1;
    this.flags[i] = s.flags ?? 0; this.grav[i] = s.grav ?? 0; this.drag[i] = s.drag ?? 1;
    this.rot[i] = s.spin ? Math.random() * Math.PI * 2 : 0; this.spin[i] = s.spin ?? 0;
    this.sub[i * 2] = s.sub?.[0] ?? 0; this.sub[i * 2 + 1] = s.sub?.[1] ?? 0;
    this.seed[i] = Math.random() * 100;
    this.light[i] = this.world.getLightRaw(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z));
  }

  /** Detritos de um bloco quebrado (textura da lateral do estado). */
  blockDebris(state: number, x: number, y: number, z: number, tint?: [number, number, number]): void {
    const layer = FACE_TEX[state * 6 + 2] & 0xfff;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
      if (Math.random() < 0.55) continue;
      const ox = (i + 0.5) / 4, oy = (j + 0.5) / 4, oz = (k + 0.5) / 4;
      this.spawn({
        x: x + ox, y: y + oy, z: z + oz,
        vx: (ox - 0.5) * 3 + (Math.random() - 0.5), vy: (oy - 0.5) * 3 + 1.5 + Math.random() * 1.5, vz: (oz - 0.5) * 3 + (Math.random() - 0.5),
        life: 0.5 + Math.random() * 0.7, size: 0.06 + Math.random() * 0.05, sprite: SP.BLOCK + layer,
        r: tint?.[0] ?? 1, g: tint?.[1] ?? 1, b: tint?.[2] ?? 1,
        flags: PF.COLLIDE, grav: 22, drag: 0.6, sub: [Math.random(), Math.random()],
      });
    }
  }

  private kill(i: number): void {
    const j = --this.count;
    if (i === j) return;
    this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.pz[i] = this.pz[j];
    this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.size[i] = this.size[j]; this.sprite[i] = this.sprite[j];
    for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.col[j * 4 + k];
    this.flags[i] = this.flags[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
    this.rot[i] = this.rot[j]; this.spin[i] = this.spin[j];
    this.sub[i * 2] = this.sub[j * 2]; this.sub[i * 2 + 1] = this.sub[j * 2 + 1];
    this.light[i] = this.light[j]; this.seed[i] = this.seed[j];
  }

  private solidAt(x: number, y: number, z: number): boolean {
    const s = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return s !== 0 && (FLAGS[s] & (F_SOLID | F_FLUID)) !== 0;
  }

  /** Simula e prepara os atributos para desenhar. `camera` é a do Three (na origem). */
  update(dt: number, camX: number, camY: number, camZ: number, camera: THREE.Camera, wind: number, time: number): void {
    dt = Math.min(dt, 0.1);
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.kill(i); i--; continue; }
      const fl = this.flags[i];
      this.vy[i] -= this.grav[i] * dt;
      const dk = Math.pow(this.drag[i], dt);
      this.vx[i] *= dk; this.vy[i] *= dk; this.vz[i] *= dk;
      if (fl & PF.WANDER) {
        const s = this.seed[i];
        this.vx[i] += Math.sin(time * 1.3 + s) * dt * 1.2;
        this.vy[i] += Math.sin(time * 1.7 + s * 2.1) * dt * 0.8;
        this.vz[i] += Math.cos(time * 1.1 + s * 1.3) * dt * 1.2;
      }
      let nx = this.px[i] + this.vx[i] * dt, ny = this.py[i] + this.vy[i] * dt, nz = this.pz[i] + this.vz[i] * dt;
      if (fl & PF.COLLIDE && this.solidAt(nx, ny, nz)) {
        if (fl & PF.SPLASH) {
          this.onSplash?.(nx, Math.floor(ny) + 1.02, nz);
          this.kill(i); i--; continue;
        }
        if (!this.solidAt(this.px[i], ny, this.pz[i])) { nx = this.px[i]; nz = this.pz[i]; this.vx[i] = this.vz[i] = 0; }
        else { ny = this.py[i]; this.vy[i] = 0; this.vx[i] *= 0.5; this.vz[i] *= 0.5; nx = this.px[i]; nz = this.pz[i]; }
      }
      this.px[i] = nx; this.py[i] = ny; this.pz[i] = nz;
      this.rot[i] += this.spin[i] * dt;
    }
    // luz: algumas por quadro
    const n = this.count;
    for (let k = 0; k < Math.min(n, 256); k++) {
      const i = (this.lightCursor + k) % n;
      this.light[i] = this.world.getLightRaw(Math.floor(this.px[i]), Math.floor(this.py[i]), Math.floor(this.pz[i]));
    }
    if (n) this.lightCursor = (this.lightCursor + 256) % n;
    // ordem de trás para frente (contagem por baldes de distância)
    const b = this.buckets;
    b.fill(0);
    for (let i = 0; i < n; i++) {
      const dx = this.px[i] - camX, dy = this.py[i] - camY, dz = this.pz[i] - camZ;
      const key = 255 - Math.min(255, Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz) * 2));
      this.keys[i] = key;
      b[key + 1]++;
    }
    for (let k = 0; k < 256; k++) b[k + 1] += b[k];
    for (let i = 0; i < n; i++) this.order[b[this.keys[i]]++] = i;
    // atributos
    const off = this.aOffset.array as Float32Array, par = this.aParams.array as Float32Array;
    const col = this.aColor.array as Float32Array, ext = this.aExtra.array as Float32Array;
    for (let o = 0; o < n; o++) {
      const i = this.order[o];
      const t = this.age[i] / this.life[i];
      const fl = this.flags[i];
      off[o * 3] = this.px[i] - camX; off[o * 3 + 1] = this.py[i] - camY; off[o * 3 + 2] = this.pz[i] - camZ;
      let size = this.size[i];
      if (fl & PF.SHRINK) size *= 1 - t * 0.7;
      if (fl & PF.GROW) size *= 0.6 + t * 0.9;
      let sprite = this.sprite[i];
      if (fl & PF.ANIM) sprite += sprite === SP.SMOKE ? Math.min(7, Math.floor(t * 8)) : Math.min(3, Math.floor(t * 4));
      par[o * 4] = size; par[o * 4 + 1] = this.rot[i]; par[o * 4 + 2] = sprite; par[o * 4 + 3] = fl & 0xff;
      let a = this.col[i * 4 + 3];
      if (fl & PF.FADE) a *= t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.55) / 0.45);
      if (fl & PF.WANDER) a *= 0.55 + 0.45 * Math.sin(time * 3 + this.seed[i] * 7);
      col[o * 4] = this.col[i * 4]; col[o * 4 + 1] = this.col[i * 4 + 1]; col[o * 4 + 2] = this.col[i * 4 + 2]; col[o * 4 + 3] = a;
      const L = this.light[i];
      ext[o * 4] = (L >> 4) / 15; ext[o * 4 + 1] = (L & 15) / 15; ext[o * 4 + 2] = this.sub[i * 2]; ext[o * 4 + 3] = this.sub[i * 2 + 1];
    }
    for (const at of [this.aOffset, this.aParams, this.aColor, this.aExtra]) {
      at.clearUpdateRanges();
      at.addUpdateRange(0, n * at.itemSize);
      at.needsUpdate = true;
    }
    this.geo.instanceCount = n;
    // eixos da câmera (a cena é relativa à câmera)
    const e = camera.matrixWorld.elements;
    (this.mat.uniforms.uRight.value as THREE.Vector3).set(e[0], e[1], e[2]);
    (this.mat.uniforms.uUp.value as THREE.Vector3).set(e[4], e[5], e[6]);
    void wind;
  }

  clear(): void { this.count = 0; this.geo.instanceCount = 0; }
}
