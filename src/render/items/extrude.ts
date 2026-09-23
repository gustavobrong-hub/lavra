/**
 * Item "extrudado": o sprite 16×16 vira um objeto 3D fino (frente, verso e as bordas de cada pixel),
 * como os itens na mão e no chão do jogo de referência.
 */
import * as THREE from 'three';
import { ENTITY_FS, ENTITY_VS } from '../shaders/entity';
import { SHARED } from '../entities/shared';
import type { IconAtlas } from '../icons';

const geoCache = new Map<string, THREE.BufferGeometry>();

export function extrudedGeometry(id: string, rgba: Uint8ClampedArray, layer: number): THREE.BufferGeometry {
  const key = `${id}:${layer}`;
  let g = geoCache.get(key);
  if (g) return g;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], lay: number[] = [], idx: number[] = [];
  const d = 1 / 32; // meia espessura
  const quad = (p: number[], n: [number, number, number], u: number[]) => {
    const b = pos.length / 3;
    pos.push(...p);
    for (let i = 0; i < 4; i++) { nor.push(...n); lay.push(layer); }
    uv.push(...u);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  // frente e verso (x: 0..1 → -0.5..0.5, y: 0..1)
  quad([-0.5, 0, d, 0.5, 0, d, 0.5, 1, d, -0.5, 1, d], [0, 0, 1], [0, 1, 1, 1, 1, 0, 0, 0]);
  quad([0.5, 0, -d, -0.5, 0, -d, -0.5, 1, -d, 0.5, 1, -d], [0, 0, -1], [1, 1, 0, 1, 0, 0, 1, 0]);
  const solid = (x: number, y: number) => x >= 0 && x < 16 && y >= 0 && y < 16 && rgba[(y * 16 + x) * 4 + 3] > 127;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!solid(x, y)) continue;
    const x0 = x / 16 - 0.5, x1 = (x + 1) / 16 - 0.5, y0 = 1 - (y + 1) / 16, y1 = 1 - y / 16;
    const u0 = x / 16, u1 = (x + 0.999) / 16, v0 = y / 16, v1 = (y + 0.999) / 16;
    const pu = [u0, v1, u1, v1, u1, v0, u0, v0];
    if (!solid(x - 1, y)) quad([x0, y0, -d, x0, y0, d, x0, y1, d, x0, y1, -d], [-1, 0, 0], pu);
    if (!solid(x + 1, y)) quad([x1, y0, d, x1, y0, -d, x1, y1, -d, x1, y1, d], [1, 0, 0], pu);
    if (!solid(x, y - 1)) quad([x0, y1, d, x1, y1, d, x1, y1, -d, x0, y1, -d], [0, 1, 0], pu);
    if (!solid(x, y + 1)) quad([x0, y0, -d, x1, y0, -d, x1, y0, d, x0, y0, d], [0, -1, 0], pu);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('layer', new THREE.Float32BufferAttribute(lay, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  geoCache.set(key, g);
  return g;
}

export function spriteMaterial(atlas: IconAtlas): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: ENTITY_VS,
    fragmentShader: ENTITY_FS,
    defines: { BLOCK_ARRAY: 1 },
    uniforms: {
      ...SHARED,
      uBlocks: { value: atlas.spriteArray },
      uLight: { value: new THREE.Vector2(1, 0) },
      uOverlay: { value: new THREE.Vector4(1, 0, 0, 0) },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uAlpha: { value: 1 },
      uEmissive: { value: 0 },
    },
    side: THREE.FrontSide,
  });
}

/** Fábrica: objeto 3D para um item com sprite (centralizado, 1 bloco de lado). */
export function itemSpriteFactory(atlas: IconAtlas): (id: string) => THREE.Object3D {
  return (id: string) => {
    const rgba = atlas.sprites.get(id);
    const layer = atlas.spriteLayer.get(id) ?? 0;
    const m = spriteMaterial(atlas);
    const geo = rgba ? extrudedGeometry(id, rgba, layer) : new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = -0.5;
    const g = new THREE.Group();
    g.add(mesh);
    mesh.position.y = 0;
    g.position.y = 0;
    return g;
  };
}
