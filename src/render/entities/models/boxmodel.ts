/**
 * Modelos de caixas articuladas (estilo "blocos com pivôs"): definição declarativa em pixels (1/16 de bloco),
 * atlas de pele alocado automaticamente por face, geometria com UV por face vista de fora, e hierarquia
 * THREE.Group por parte para animação. Origem = pés da criatura; +Y para cima; frente para +Z.
 */
import * as THREE from 'three';
import { SkinPainter, type FaceName, type FaceRects, type Rect } from './skin';
import { skinMaterial } from '../shared';
import type { Entity } from '../../../game/entity/entity';

export type V3 = [number, number, number];

export interface CubeDef {
  /** canto mínimo (pixels, espaço do modelo) */
  o: V3;
  /** tamanho (pixels) */
  s: V3;
  /** id para pintar (padrão: nome da parte, e `parte#i` para os seguintes) */
  id?: string;
  /** infla a geometria (pixels) sem mudar a pele (roupas, pelos) */
  inflate?: number;
  /** espelha a pele (perna esquerda = direita espelhada) */
  mirror?: boolean;
  /** usa a pele de outro cubo (mesmo tamanho) */
  skinOf?: string;
  /** faces omitidas */
  skip?: FaceName[];
  /** semitransparente (gosma, asas) */
  translucent?: boolean;
  /** emite luz (olhos, chamas) — 0..1 */
  emissive?: number;
}

export interface PartDef {
  name: string;
  /** pivô (pixels, espaço do modelo) */
  pivot: V3;
  /** rotação de repouso (graus) */
  rot?: V3;
  cubes: CubeDef[];
  children?: PartDef[];
}

export interface AnimState {
  e: Entity;
  /** ticks de vida + alpha */
  t: number;
  /** balanço de membros (limbSwing) e intensidade (limbSwingAmount) interpolados */
  swing: number;
  amount: number;
  /** cabeça relativa ao corpo (graus) e inclinação (graus, + = olhando para baixo) */
  headYaw: number;
  headPitch: number;
  /** 0..1 do golpe */
  attack: number;
  alpha: number;
}

export type Parts = Record<string, THREE.Object3D & { userData: { rest: THREE.Euler; base: THREE.Vector3 } }>;

export interface ModelDef {
  id: string;
  parts: PartDef[];
  /** texels por pixel de modelo (padrão 2) */
  density?: number;
  /** pinta a pele; `variant` permite peles alternativas (cores, pelagens) */
  paint(sk: SkinPainter, variant: string): void;
  /** anima as partes; restaure-as a partir de userData.rest (resetParts) */
  animate?(p: Parts, s: AnimState): void;
  /** escala geral (filhotes usam 0,5 automaticamente) */
  scale?: number;
  /** filhote com cabeça maior (fator) */
  babyHead?: number;
}

interface Built { geos: Map<string, { opaque: THREE.BufferGeometry | null; trans: THREE.BufferGeometry | null; emissive: number }>; atlasW: number; atlasH: number; rects: Map<string, FaceRects> }

const FACE_ORDER: FaceName[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** Dimensões da face (w, h) em pixels de modelo. */
function faceSize(f: FaceName, s: V3): [number, number] {
  switch (f) {
    case 'front': case 'back': return [s[0], s[1]];
    case 'left': case 'right': return [s[2], s[1]];
    default: return [s[0], s[2]];
  }
}

/** Empacotamento em prateleiras (shelf) com 1 texel de margem. */
class Packer {
  x = 0; y = 0; row = 0; readonly w: number; maxY = 0;
  constructor(w: number) { this.w = w; }
  alloc(w: number, h: number): Rect {
    if (w === 0 || h === 0) return { x: 0, y: 0, w: 0, h: 0 };
    if (this.x + w + 2 > this.w) { this.x = 0; this.y += this.row; this.row = 0; }
    const r = { x: this.x + 1, y: this.y + 1, w, h };
    this.x += w + 2;
    this.row = Math.max(this.row, h + 2);
    this.maxY = Math.max(this.maxY, this.y + this.row);
    return r;
  }
}

function forEachCube(parts: PartDef[], fn: (p: PartDef, c: CubeDef, id: string) => void): void {
  for (const p of parts) {
    p.cubes.forEach((c, i) => fn(p, c, c.id ?? (i === 0 ? p.name : `${p.name}#${i}`)));
    if (p.children) forEachCube(p.children, fn);
  }
}

function build(def: ModelDef): Built {
  const d = def.density ?? 2;
  // atlas: largura suficiente para o maior cubo
  let area = 0, maxW = 0;
  forEachCube(def.parts, (_p, c) => {
    if (c.skinOf) return;
    for (const f of FACE_ORDER) { const [w, h] = faceSize(f, c.s); area += (w * d + 2) * (h * d + 2); maxW = Math.max(maxW, w * d + 2); }
  });
  let W = 64;
  while (W < maxW || W * W < area * 1.4) W *= 2;
  const packer = new Packer(W);
  const rects = new Map<string, FaceRects>();
  forEachCube(def.parts, (_p, c, id) => {
    if (c.skinOf) return;
    const fr = {} as FaceRects;
    for (const f of FACE_ORDER) {
      const [w, h] = faceSize(f, c.s);
      fr[f] = packer.alloc(Math.round(w * d), Math.round(h * d));
    }
    rects.set(id, fr);
  });
  let H = 16;
  while (H < packer.maxY) H *= 2;
  // geometria por parte
  const geos = new Map<string, { opaque: THREE.BufferGeometry | null; trans: THREE.BufferGeometry | null; emissive: number }>();
  const walk = (p: PartDef) => {
    const op: number[][] = [[], [], []], tr: number[][] = [[], [], []];
    let emissive = 0;
    p.cubes.forEach((c, i) => {
      const id = c.skinOf ?? c.id ?? (i === 0 ? p.name : `${p.name}#${i}`);
      const fr = rects.get(id);
      if (!fr) throw new Error(`pele de ${id} não encontrada`);
      const dst = c.translucent ? tr : op;
      emissive = Math.max(emissive, c.emissive ?? 0);
      cubeGeometry(c, p.pivot, fr, W, H, dst[0], dst[1], dst[2]);
    });
    const mk = (a: number[][]) => {
      if (!a[0].length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a[0], 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(a[1], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(a[2], 2));
      const n = a[0].length / 3;
      const idx: number[] = [];
      for (let q = 0; q < n; q += 4) idx.push(q, q + 2, q + 1, q, q + 3, q + 2); // anti-horário visto de fora
      g.setIndex(idx);
      g.computeBoundingSphere();
      return g;
    };
    geos.set(p.name, { opaque: mk(op), trans: mk(tr), emissive });
    p.children?.forEach(walk);
  };
  def.parts.forEach(walk);
  return { geos, atlasW: W, atlasH: H, rects };
}

/** Quad por face, UV "vista de fora", em unidades de bloco relativas ao pivô. */
function cubeGeometry(c: CubeDef, pivot: V3, fr: FaceRects, W: number, H: number, pos: number[], nor: number[], uv: number[]): void {
  const inf = c.inflate ?? 0;
  const x0 = (c.o[0] - inf - pivot[0]) / 16, y0 = (c.o[1] - inf - pivot[1]) / 16, z0 = (c.o[2] - inf - pivot[2]) / 16;
  const x1 = (c.o[0] + c.s[0] + inf - pivot[0]) / 16, y1 = (c.o[1] + c.s[1] + inf - pivot[1]) / 16, z1 = (c.o[2] + c.s[2] + inf - pivot[2]) / 16;
  const skip = new Set(c.skip ?? []);
  // cada face: 4 cantos na ordem (u0,v0) (u1,v0) (u1,v1) (u0,v1) = topo-esq, topo-dir, base-dir, base-esq vistos de fora
  const faces: [FaceName, V3, V3[]][] = [
    ['front', [0, 0, 1], [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]]],
    ['back', [0, 0, -1], [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]]],
    ['left', [1, 0, 0], [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]]],
    ['right', [-1, 0, 0], [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]]],
    ['top', [0, 1, 0], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]],
    ['bottom', [0, -1, 0], [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]]],
  ];
  for (const [f, n, corners] of faces) {
    if (skip.has(f)) continue;
    // espelhado: as faces laterais trocam de pele (a externa continua externa)
    const r = c.mirror && (f === 'left' || f === 'right') ? fr[f === 'left' ? 'right' : 'left'] : fr[f];
    if (!r.w || !r.h) continue;
    let u0 = r.x / W, u1 = (r.x + r.w) / W;
    const v0 = 1 - r.y / H, v1 = 1 - (r.y + r.h) / H;
    if (c.mirror) [u0, u1] = [u1, u0];
    const us = [u0, u1, u1, u0], vs = [v0, v0, v1, v1];
    // espelhado: troca também a ordem dos cantos para manter a orientação correta das faces laterais
    for (let k = 0; k < 4; k++) {
      const p = corners[k];
      pos.push(p[0], p[1], p[2]);
      nor.push(n[0], n[1], n[2]);
      uv.push(us[k], vs[k]);
    }
  }
}

/** Pele pintada (canvas → textura). */
function paintSkin(def: ModelDef, b: Built, variant: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = b.atlasW; canvas.height = b.atlasH;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(b.atlasW, b.atlasH);
  let seed = 0x9e3779b1;
  for (const ch of def.id + variant) seed = Math.imul(seed ^ ch.charCodeAt(0), 0x85ebca6b);
  const sk = new SkinPainter(img, b.rects, def.density ?? 2, seed);
  def.paint(sk, variant);
  // margem: replica as bordas de cada face na moldura (evita costuras)
  for (const fr of b.rects.values()) for (const f of FACE_ORDER) extendEdges(img, fr[f]);
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

function extendEdges(img: ImageData, r: Rect): void {
  if (!r.w || !r.h) return;
  const W = img.width, d = img.data;
  const cp = (sx: number, sy: number, dx: number, dy: number) => {
    if (dx < 0 || dy < 0 || dx >= W || dy >= img.height) return;
    const s = (sy * W + sx) * 4, t = (dy * W + dx) * 4;
    d[t] = d[s]; d[t + 1] = d[s + 1]; d[t + 2] = d[s + 2]; d[t + 3] = d[s + 3];
  };
  for (let x = 0; x < r.w; x++) { cp(r.x + x, r.y, r.x + x, r.y - 1); cp(r.x + x, r.y + r.h - 1, r.x + x, r.y + r.h); }
  for (let y = -1; y <= r.h; y++) { const yy = Math.max(0, Math.min(r.h - 1, y)); cp(r.x, r.y + yy, r.x - 1, r.y + y); cp(r.x + r.w - 1, r.y + yy, r.x + r.w, r.y + y); }
}

// ------------------------------------------------------------------ instâncias
const builtCache = new Map<string, Built>();
const skinCache = new Map<string, THREE.Texture>();

export interface ModelInstance {
  root: THREE.Group;
  /** grupo interno (rotação do corpo, animação de morte, escala) */
  body: THREE.Group;
  parts: Parts;
  mats: THREE.ShaderMaterial[];
  setVariant(v: string): void;
}

export function instantiate(def: ModelDef, variant = ''): ModelInstance {
  let b = builtCache.get(def.id);
  if (!b) { b = build(def); builtCache.set(def.id, b); }
  const key = `${def.id}|${variant}`;
  let tex = skinCache.get(key);
  if (!tex) { tex = paintSkin(def, b, variant); skinCache.set(key, tex); }
  const matO = skinMaterial(tex);
  const matT = skinMaterial(tex);
  matT.defines = { ...(matT.defines ?? {}), TRANSLUCENT: 1 };
  matT.transparent = true;
  matT.depthWrite = false;
  const mats = [matO, matT];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const parts: Parts = {};
  const emissiveMats = new Map<number, THREE.ShaderMaterial>();
  const walk = (p: PartDef, parent: THREE.Object3D, parentPivot: V3) => {
    const g = new THREE.Group() as unknown as Parts[string];
    g.name = p.name;
    g.position.set((p.pivot[0] - parentPivot[0]) / 16, (p.pivot[1] - parentPivot[1]) / 16, (p.pivot[2] - parentPivot[2]) / 16);
    const r = p.rot ?? [0, 0, 0];
    g.rotation.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180, 'ZYX');
    g.userData = { rest: g.rotation.clone(), base: g.position.clone() };
    const geo = b!.geos.get(p.name)!;
    if (geo.opaque) {
      let m = matO;
      if (geo.emissive > 0) {
        let em = emissiveMats.get(geo.emissive);
        if (!em) { em = skinMaterial(tex!); em.uniforms.uEmissive.value = geo.emissive; emissiveMats.set(geo.emissive, em); mats.push(em); }
        m = em;
      }
      g.add(new THREE.Mesh(geo.opaque, m));
    }
    if (geo.trans) { const mesh = new THREE.Mesh(geo.trans, matT); mesh.renderOrder = 2; g.add(mesh); }
    parent.add(g);
    parts[p.name] = g;
    p.children?.forEach((c) => walk(c, g, p.pivot));
  };
  def.parts.forEach((p) => walk(p, body, [0, 0, 0]));
  if (def.scale) body.scale.setScalar(def.scale);
  return {
    root, body, parts, mats,
    setVariant(v: string) {
      const k = `${def.id}|${v}`;
      let t = skinCache.get(k);
      if (!t) { t = paintSkin(def, b!, v); skinCache.set(k, t); }
      for (const m of mats) if (m.uniforms.uMap) m.uniforms.uMap.value = t;
    },
  };
}

/** Restaura rotações/posições de repouso antes de animar. */
export function resetParts(p: Parts): void {
  for (const k in p) { const o = p[k]; o.rotation.copy(o.userData.rest); o.position.copy(o.userData.base); o.visible = true; }
}

/** Pele como imagem (para folhas de contato/testes). */
export function skinCanvas(def: ModelDef, variant = ''): HTMLCanvasElement {
  let b = builtCache.get(def.id);
  if (!b) { b = build(def); builtCache.set(def.id, b); }
  const tex = paintSkin(def, b, variant);
  return tex.image as HTMLCanvasElement;
}

export const DEG = Math.PI / 180;
