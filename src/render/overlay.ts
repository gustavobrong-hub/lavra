/** Contorno do bloco mirado e rachaduras de quebra (10 estágios gerados proceduralmente). */
import * as THREE from 'three';
import { blockBoxes } from '../world/blocks/shapes';
import type { World } from '../world/world';
import { Random } from '../core/rng';

const LINE_VS = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LINE_FS = /* glsl */ `
precision highp float;
uniform vec4 uColor;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;
void main() { outColor = uColor; outNormal = vec4(0.5, 0.5, 0.5, 0.0); }
`;
const CRACK_VS = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const CRACK_FS = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uCracks;
uniform float uStage;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;
void main() {
  vec4 c = texture(uCracks, vec3(vUv, uStage));
  if (c.a < 0.1) discard;
  outColor = vec4(c.rgb, 1.0);
  outNormal = vec4(0.5, 0.5, 0.5, 0.0);
}
`;

/** Rachaduras crescendo do centro para as bordas. */
function crackTexture(): THREE.DataArrayTexture {
  const data = new Uint8Array(16 * 16 * 4 * 10);
  const r = new Random(4242);
  // caminhos aleatórios compartilhados: cada estágio desenha mais passos
  const walks: [number, number][][] = [];
  for (let w = 0; w < 9; w++) {
    let x = 8 + r.range(-2, 2), y = 8 + r.range(-2, 2);
    const path: [number, number][] = [];
    const dir = r.next() * Math.PI * 2;
    for (let i = 0; i < 14; i++) {
      path.push([x & 15, y & 15]);
      const a = dir + (r.next() - 0.5) * 1.6;
      x += Math.round(Math.cos(a)); y += Math.round(Math.sin(a));
    }
    walks.push(path);
  }
  for (let s = 0; s < 10; s++) {
    const base = s * 256 * 4;
    for (let i = 0; i < 256; i++) { data[base + i * 4] = 128; data[base + i * 4 + 1] = 128; data[base + i * 4 + 2] = 128; data[base + i * 4 + 3] = 0; }
    const nWalks = 2 + Math.floor(s * 0.8);
    const len = 3 + s * 1.2;
    for (let w = 0; w < Math.min(nWalks, walks.length); w++) {
      for (let i = 0; i < Math.min(len, walks[w].length); i++) {
        const [x, y] = walks[w][i];
        const o = base + (y * 16 + x) * 4;
        const v = 40 + (i % 3) * 12;
        data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
        // realce claro ao lado da fenda (dá profundidade)
        const o2 = base + (((y + 1) & 15) * 16 + x) * 4;
        if (data[o2 + 3] === 0) { data[o2] = 150; data[o2 + 1] = 150; data[o2 + 2] = 150; data[o2 + 3] = 255; }
      }
    }
  }
  const t = new THREE.DataArrayTexture(data, 16, 16, 10);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export class BlockOverlay {
  readonly group = new THREE.Group();
  private readonly lines: THREE.LineSegments;
  private readonly crack: THREE.Mesh;
  private readonly crackMat: THREE.ShaderMaterial;
  private key = '';

  constructor() {
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: LINE_VS, fragmentShader: LINE_FS,
      uniforms: { uColor: { value: new THREE.Vector4(0, 0, 0, 0.55) } }, transparent: true, depthWrite: false,
    }));
    this.lines.frustumCulled = false;
    this.crackMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: CRACK_VS, fragmentShader: CRACK_FS,
      uniforms: { uCracks: { value: crackTexture() }, uStage: { value: 0 } },
      blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcColorFactor,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, transparent: true,
    });
    this.crack = new THREE.Mesh(new THREE.BufferGeometry(), this.crackMat);
    this.crack.frustumCulled = false;
    this.group.add(this.lines, this.crack);
  }

  /** Atualiza para o bloco (x,y,z) no mundo; posição relativa à câmera. */
  update(world: World, target: { x: number; y: number; z: number; state: number } | null, crackStage: number, camX: number, camY: number, camZ: number): void {
    if (!target) { this.group.visible = false; this.key = ''; return; }
    this.group.visible = true;
    const k = `${target.x},${target.y},${target.z},${target.state}`;
    if (k !== this.key) {
      this.key = k;
      const boxes = blockBoxes(target.state, target.x, target.y, target.z, (a, b, c) => world.getBlock(a, b, c), true);
      const e = 0.002;
      const lp: number[] = [];
      const cp: number[] = [], cu: number[] = [], ci: number[] = [];
      for (const [x0, y0, z0, x1, y1, z1] of boxes) {
        const a = [x0 - e, y0 - e, z0 - e], b = [x1 + e, y1 + e, z1 + e];
        const c = (i: number) => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]];
        for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) lp.push(...c(i), ...c(j));
        // faces da rachadura (UV em espaço de bloco)
        const faces: [number[], number[]][] = [
          [[a[0], a[1], a[2], b[0], a[1], a[2], b[0], a[1], b[2], a[0], a[1], b[2]], [x0, z0, x1, z0, x1, z1, x0, z1]],
          [[a[0], b[1], a[2], a[0], b[1], b[2], b[0], b[1], b[2], b[0], b[1], a[2]], [x0, z0, x0, z1, x1, z1, x1, z0]],
          [[b[0], a[1], a[2], a[0], a[1], a[2], a[0], b[1], a[2], b[0], b[1], a[2]], [1 - x1, 1 - y0, 1 - x0, 1 - y0, 1 - x0, 1 - y1, 1 - x1, 1 - y1]],
          [[a[0], a[1], b[2], b[0], a[1], b[2], b[0], b[1], b[2], a[0], b[1], b[2]], [x0, 1 - y0, x1, 1 - y0, x1, 1 - y1, x0, 1 - y1]],
          [[a[0], a[1], a[2], a[0], a[1], b[2], a[0], b[1], b[2], a[0], b[1], a[2]], [z0, 1 - y0, z1, 1 - y0, z1, 1 - y1, z0, 1 - y1]],
          [[b[0], a[1], b[2], b[0], a[1], a[2], b[0], b[1], a[2], b[0], b[1], b[2]], [1 - z1, 1 - y0, 1 - z0, 1 - y0, 1 - z0, 1 - y1, 1 - z1, 1 - y1]],
        ];
        for (const [p, u] of faces) {
          const base = cp.length / 3;
          cp.push(...p); cu.push(...u);
          ci.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
      this.lines.geometry.dispose();
      this.lines.geometry = new THREE.BufferGeometry();
      this.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      this.crack.geometry.dispose();
      this.crack.geometry = new THREE.BufferGeometry();
      this.crack.geometry.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
      this.crack.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2));
      this.crack.geometry.setIndex(ci);
    }
    this.group.position.set(target.x - camX, target.y - camY, target.z - camZ);
    this.crack.visible = crackStage >= 0;
    this.crackMat.uniforms.uStage.value = Math.max(0, crackStage);
  }
}
