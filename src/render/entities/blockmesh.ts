/** Geometrias de bloco para o Three (itens de bloco, blocos caindo, bloco na mão). */
import * as THREE from 'three';
import { FACE_TEX, SHAPE, SHAPE_IDS, TINT, BLOCKS, BLOCK_OF } from '../../world/blocks/registry';

const cache = new Map<number, THREE.BufferGeometry>();

// cantos CCW por face (down, up, north, south, west, east), cubo unitário centrado em (0,0.5,0)
const FACES: { n: [number, number, number]; v: number[] }[] = [
  { n: [0, -1, 0], v: [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1] },
  { n: [0, 1, 0], v: [0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0] },
  { n: [0, 0, -1], v: [1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0] },
  { n: [0, 0, 1], v: [0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1] },
  { n: [-1, 0, 0], v: [0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0] },
  { n: [1, 0, 0], v: [1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1] },
];
const UVS = [0, 1, 1, 1, 1, 0, 0, 0];

/** Cubo com as texturas de cada face do estado (ou planos cruzados para plantas). */
export function blockGeometry(state: number): THREE.BufferGeometry {
  let g = cache.get(state);
  if (g) return g;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], layer: number[] = [], idx: number[] = [];
  const sh = SHAPE[state];
  const plant = sh === SHAPE_IDS.cross || sh === SHAPE_IDS.sapling || sh === SHAPE_IDS.mushroom || sh === SHAPE_IDS.doubleplant
    || sh === SHAPE_IDS.crop || sh === SHAPE_IDS.kelp || sh === SHAPE_IDS.torch || sh === SHAPE_IDS.bush || sh === SHAPE_IDS.dust
    || sh === SHAPE_IDS.rail || sh === SHAPE_IDS.ladder || sh === SHAPE_IDS.vine || sh === SHAPE_IDS.lever || sh === SHAPE_IDS.cobweb;
  if (plant) {
    const L = FACE_TEX[state * 6 + 2] & 0xfff;
    const quads = [[0, 0, 0, 1, 0, 1], [0, 0, 1, 1, 0, 0]];
    for (const [x0, , z0, x1, , z1] of quads) {
      for (const flip of [false, true]) {
        const b = pos.length / 3;
        const pts = [x0, 0, z0, x1, 0, z1, x1, 1, z1, x0, 1, z0];
        const order = flip ? [3, 2, 1, 0] : [0, 1, 2, 3];
        for (const o of order) { pos.push(pts[o * 3] - 0.5, pts[o * 3 + 1], pts[o * 3 + 2] - 0.5); nor.push(0, 1, 0); uv.push(UVS[o * 2], UVS[o * 2 + 1]); layer.push(L); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
  } else {
    // alturas especiais (laje, tapete, placas)
    let h = 1;
    const name = BLOCKS[BLOCK_OF[state]].name;
    if (sh === SHAPE_IDS.slab) h = 0.5;
    else if (sh === SHAPE_IDS.carpet || sh === SHAPE_IDS.plate) h = 1 / 16;
    else if (sh === SHAPE_IDS.snowlayer) h = 2 / 16;
    else if (sh === SHAPE_IDS.farmland || sh === SHAPE_IDS.path) h = 15 / 16;
    else if (sh === SHAPE_IDS.bed) h = 9 / 16;
    void name;
    FACES.forEach((f, fi) => {
      const L = FACE_TEX[state * 6 + fi] & 0xfff;
      const b = pos.length / 3;
      for (let i = 0; i < 4; i++) {
        pos.push(f.v[i * 3] - 0.5, f.v[i * 3 + 1] * h, f.v[i * 3 + 2] - 0.5);
        nor.push(...f.n);
        const vv = fi >= 2 ? 1 - (1 - UVS[i * 2 + 1]) * h : UVS[i * 2 + 1];
        uv.push(UVS[i * 2], fi >= 2 ? vv : UVS[i * 2 + 1]);
        layer.push(L);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('layer', new THREE.Float32BufferAttribute(layer, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  cache.set(state, g);
  return g;
}

/** Cor de tingimento padrão para exibir blocos fora do mundo (grama/folhas no item). */
export function itemTint(state: number): THREE.Color {
  switch (TINT[state]) {
    case 1: return new THREE.Color(0x7fb24a).convertSRGBToLinear();
    case 2: return new THREE.Color(0x59ae30).convertSRGBToLinear();
    case 3: return new THREE.Color(0x3f76e4).convertSRGBToLinear();
    case 4: return new THREE.Color(0x80a755).convertSRGBToLinear();
    case 5: return new THREE.Color(0x619961).convertSRGBToLinear();
    case 6: return new THREE.Color(0x5fd9ea).convertSRGBToLinear();
    default: return new THREE.Color(1, 1, 1);
  }
}
