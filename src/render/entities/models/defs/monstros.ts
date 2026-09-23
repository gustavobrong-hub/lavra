/**
 * Peixes do Lavra (monstros em monstros2.ts e monstros3.ts).
 * - Lambari: peixinho prateado de cardume, rabo amarelo-alaranjado e mancha escura no pedúnculo.
 * - Tambaqui: peixe grande e redondo, dorso verde-acinzentado, ventre amarelado e os famosos dentes.
 * - Baiacu: três formas (murcho, meio, inflado com espinhos), trocadas pela `pose` conforme `puff`.
 * - Acará: ciclídeo de corpo alto e nadadeiras longas; 4 padrões × cores (variante `padrão|base|listra`).
 * Fora d'água os peixes deitam de lado (90° em Z, rente ao chão) e se debatem mais rápido.
 */
import type * as THREE from 'three';
import type { ModelDef, PartDef, CubeDef, V3, Parts, AnimState } from '../boxmodel';
import type { MobModelSpec } from '../../mobvisual';
import { lerpc, shade, type Col, type Face, type FaceName } from '../skin';
import type { Fish, Baiacu, Acara } from '../../../../game/entity/species/fish';

// ------------------------------------------------------------------ utilitários de pintura
/** Coluna medida a partir da frente numa face lateral (esquerda: frente em x = 0; direita: frente em x = w − 1). */
export const fromFront = (g: Face, f: FaceName, d: number): number => (f === 'right' ? g.w - 1 - d : d);
export const isSide = (f: FaceName): boolean => f === 'left' || f === 'right';

/** Degradê vertical em três paradas (dorso → flanco → ventre) com ruído leve. */
export function grad3(g: Face, a: Col, b: Col, c: Col, amount = 0.05): void {
  for (let y = 0; y < g.h; y++) {
    const t = g.h <= 1 ? 0 : y / (g.h - 1);
    const col = t < 0.5 ? lerpc(a, b, t * 2) : lerpc(b, c, (t - 0.5) * 2);
    for (let x = 0; x < g.w; x++) { const k = 1 + (g.r() * 2 - 1) * amount; g.px(x, y, [col[0] * k, col[1] * k, col[2] * k]); }
  }
}

/** Multiplica o brilho de um texel já pintado. */
export function dim(g: Face, x: number, y: number, k: number): void {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const c = g.get(x, y);
  if (c[3] === 0) return;
  g.px(x, y, [c[0] * k, c[1] * k, c[2] * k]);
}

/** Escamas em quincôncio: texel claro com sombra embaixo (só entre as linhas y0..y1). */
function scales(g: Face, y0 = 0, y1 = g.h, k1 = 1.08, k2 = 0.92): void {
  for (let y = y0, row = 0; y < y1; y += 2, row++) for (let x = row % 2; x < g.w; x += 2) { dim(g, x, y, k1); if (y + 1 < y1) dim(g, x, y + 1, k2); }
}

/**
 * Nadadeira plana (face lateral de um plano YZ): `mask(d, y)` diz se o texel existe (d = distância da
 * base/frente); raios horizontais alternados e ponta com outra cor.
 */
function fin(g: Face, f: FaceName, base: Col, ray: Col, tip: Col, mask: (d: number, y: number) => boolean, tipFrom = 0.7): void {
  for (let y = 0; y < g.h; y++) for (let d = 0; d < g.w; d++) {
    if (!mask(d, y)) continue;
    const t = g.w <= 1 ? 0 : d / (g.w - 1);
    let c: Col = y % 2 === 0 ? base : ray;
    if (t >= tipFrom) c = lerpc(c, tip, 0.65);
    const k = 1 + (g.r() * 2 - 1) * 0.05;
    const cc = shade(c, k);
    g.px(fromFront(g, f, d), y, cc);
  }
}

/** Olho de peixe 2×2 texels (anel claro, pupila e brilho), `d` = coluna a partir da frente. */
function fishEye(g: Face, f: FaceName, d: number, y: number, ring: Col, pupil: Col): void {
  g.px(fromFront(g, f, d), y, ring); g.px(fromFront(g, f, d + 1), y, ring);
  g.px(fromFront(g, f, d), y + 1, pupil); g.px(fromFront(g, f, d + 1), y + 1, shade(ring, 0.75));
  g.px(fromFront(g, f, d + 1), y, [255, 255, 250, 230]);
}

/** Material da primeira malha de uma parte (para variar o brilho por frame). */
export function partMat(part: THREE.Object3D | undefined): THREE.ShaderMaterial | null {
  if (!part) return null;
  for (const c of part.children) if ((c as THREE.Mesh).isMesh) return (c as THREE.Mesh).material as THREE.ShaderMaterial;
  return null;
}

// ------------------------------------------------------------------ animação comum dos peixes
/**
 * Nado: corpo ondula e o rabo bate em contrafase. Fora d'água: deita de lado (raiz girada 90° em Z e
 * baixada até a meia espessura `half`), rabo e corpo se debatem com mais força (a fase `flop` já corre 3× mais).
 */
function fishAnim(p: Parts, s: AnimState, roots: [string, number][], tails: string[], fins: [string, string][]): void {
  const e = s.e as Fish;
  const wet = e.inWater;
  const ph = e.flop + s.alpha * (wet ? 0.3 : 0.9);
  const sw = Math.sin(ph);
  for (const [name, half] of roots) {
    const r = p[name];
    if (!r) continue;
    if (wet) {
      r.rotation.y += sw * 0.1;
      r.rotation.z += Math.sin(ph * 0.5) * 0.05;
    } else {
      r.rotation.z += Math.PI / 2;
      r.rotation.y += sw * 0.3;
      r.position.y = half / 16;
    }
  }
  for (const t of tails) if (p[t]) p[t].rotation.y -= sw * (wet ? 0.45 : 0.75);
  for (const [r, l] of fins) {
    const k = Math.sin(ph * 2) * (wet ? 0.25 : 0.4);
    if (p[r]) p[r].rotation.y += k;
    if (p[l]) p[l].rotation.y -= k;
  }
}

// ------------------------------------------------------------------ lambari
const LB = {
  back: 0x5a6848, bronze: 0xa89f68, silver: 0xcdd8db, belly: 0xf1f2ec, band: 0xa3c2d4, spot: 0x2a313b,
  fin: 0xf2ad35, finD: 0xd88a28, finTip: 0xe0622a, eye: 0xe3d59c, pupil: 0x161a20,
};

export const LAMBARI: ModelDef = {
  id: 'lambari',
  parts: [{
    name: 'fish', pivot: [0, 2.5, 0],
    cubes: [
      { id: 'lbBody', o: [-1, 1, -2], s: [2, 3, 5] },
      { id: 'lbSnout', o: [-1, 1.5, 3], s: [2, 2, 1] },
      { id: 'lbPed', o: [-0.5, 1.5, -4], s: [1, 2, 2] },
      { id: 'lbDorsal', o: [0, 4, -1], s: [0, 2, 2] },
      { id: 'lbAnal', o: [0, 0, -2], s: [0, 1, 2] },
    ],
    children: [
      { name: 'tail', pivot: [0, 2.5, -4], cubes: [{ id: 'lbTail', o: [0, 0, -7], s: [0, 5, 3] }] },
      { name: 'finR', pivot: [-1, 1.5, 2], rot: [0, 35, 0], cubes: [{ id: 'lbFin', o: [-1, 1, 1], s: [0, 1, 1] }] },
      { name: 'finL', pivot: [1, 1.5, 2], rot: [0, -35, 0], cubes: [{ id: 'lbFinL', o: [1, 1, 1], s: [0, 1, 1], mirror: true, skinOf: 'lbFin' }] },
    ],
  }],
  paint(sk) {
    sk.cube('lbBody', (g, f) => {
      if (isSide(f)) {
        grad3(g, LB.back, LB.silver, LB.belly, 0.04);
        for (let d = 0; d < g.w; d++) {
          const x = fromFront(g, f, d);
          g.px(x, 1, lerpc(LB.bronze, LB.back, 0.25));
          g.px(x, 2, d % 3 === 1 ? 0xe2ecf0 : LB.band); // faixa lateral iridescente
        }
        scales(g, 0, 4);
        // opérculo (curva da guelra) e mancha umeral
        for (const [d, y] of [[3, 1], [3, 2], [2, 3], [2, 4]]) dim(g, fromFront(g, f, d), y, 0.8);
        for (const [d, y] of [[5, 1], [5, 2], [6, 2]]) g.px(fromFront(g, f, d), y, lerpc(LB.spot, LB.silver, 0.3));
        fishEye(g, f, 0, 1, LB.eye, LB.pupil);
      } else if (f === 'top') g.noise(LB.back, 0.07);
      else if (f === 'bottom') g.noise(LB.belly, 0.03);
      else grad3(g, LB.back, LB.silver, LB.belly, 0.03);
    });
    sk.cube('lbSnout', (g, f) => {
      grad3(g, LB.back, LB.silver, LB.belly, 0.03);
      if (f === 'front') { g.rect(1, 2, 2, 1, 0x6b7372); g.px(0, 2, 0xa9b1ad); g.px(3, 2, 0xa9b1ad); }
      if (f === 'top') g.noise(LB.back, 0.06);
      if (f === 'bottom') g.noise(LB.belly, 0.03);
    });
    sk.cube('lbPed', (g, f) => {
      if (f === 'top') { g.noise(LB.back, 0.06); return; }
      if (f === 'bottom') { g.noise(LB.belly, 0.03); return; }
      grad3(g, LB.back, LB.silver, LB.belly, 0.04);
      if (isSide(f)) for (const [d, y] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2]]) g.px(fromFront(g, f, d), y, LB.spot);
      if (f === 'back') g.rect(0, 1, g.w, 2, LB.spot);
    });
    // rabo bifurcado: abre da base para a ponta, com entalhe no meio
    sk.cube('lbTail', (g, f) => {
      const c = (g.h - 1) / 2;
      fin(g, f, LB.fin, LB.finD, LB.finTip, (d, y) => {
        const dy = Math.abs(y - c);
        return dy <= 1.5 + d * 0.75 && !(dy < (d - 3) * 0.8);
      }, 0.75);
      for (let y = 3; y <= 6; y++) g.px(fromFront(g, f, 0), y, LB.spot);
      g.px(fromFront(g, f, 1), 4, LB.spot); g.px(fromFront(g, f, 1), 5, LB.spot);
    });
    sk.cube('lbDorsal', (g, f) => fin(g, f, 0xe8c66a, 0xd6ad52, LB.finTip, (d, y) => d <= y, 0.9));
    sk.cube('lbAnal', (g, f) => fin(g, f, LB.fin, LB.finD, LB.finTip, (d, y) => y === 0 || d >= 1, 0.9));
    sk.cube('lbFin', (g, f) => fin(g, f, 0xd9d8c8, 0xc9c7b2, 0xe0b070, (d, y) => !(d === 1 && y === 1), 0.8));
  },
  animate(p, s) { fishAnim(p, s, [['fish', 1.5]], ['tail'], [['finR', 'finL']]); },
};

// ------------------------------------------------------------------ tambaqui
const TB = {
  back: 0x333f2e, flank: 0x68734f, belly: 0xdcc983, throat: 0xd6a458, fin: 0x24282a, finR: 0x383e41, finTip: 0x4d3b32,
  eye: 0xcaa24c, pupil: 0x121416, lip: 0x4b4b43, tooth: 0xece6d4,
};

export const TAMBAQUI: ModelDef = {
  id: 'tambaqui',
  parts: [{
    name: 'fish', pivot: [0, 3.5, 0],
    cubes: [
      { id: 'tbBody', o: [-1.5, 1, -3], s: [3, 5, 5] },
      { id: 'tbHead', o: [-1.5, 1.5, 2], s: [3, 4, 2] },
      { id: 'tbSnout', o: [-1, 2, 4], s: [2, 2, 1] },
      { id: 'tbHump', o: [-1, 6, -2], s: [2, 1, 3] },
      { id: 'tbBelly', o: [-1, 0, -2], s: [2, 1, 3] },
      { id: 'tbRear', o: [-1, 2, -5], s: [2, 3, 2] },
      { id: 'tbPed', o: [-0.5, 2.5, -6], s: [1, 2, 1] },
      { id: 'tbDorsal', o: [0, 6, -3], s: [0, 3, 3] },
      { id: 'tbAdip', o: [0, 5, -5], s: [0, 1, 1] },
      { id: 'tbAnal', o: [0, 0, -5], s: [0, 2, 2] },
    ],
    children: [
      { name: 'tail', pivot: [0, 3.5, -6], cubes: [{ id: 'tbTail', o: [0, 0.5, -9], s: [0, 6, 3] }] },
      { name: 'finR', pivot: [-1.5, 3, 2], rot: [0, 30, 0], cubes: [{ id: 'tbFin', o: [-1.5, 1, 0], s: [0, 2, 2] }] },
      { name: 'finL', pivot: [1.5, 3, 2], rot: [0, -30, 0], cubes: [{ id: 'tbFinL', o: [1.5, 1, 0], s: [0, 2, 2], mirror: true, skinOf: 'tbFin' }] },
    ],
  }],
  paint(sk) {
    const body = (g: Face) => grad3(g, TB.back, TB.flank, TB.belly, 0.05);
    sk.cube('tbBody', (g, f) => {
      if (isSide(f)) {
        body(g);
        // escamas miúdas reticuladas no dorso e no flanco
        for (let y = 0; y < g.h - 3; y += 2) for (let x = 0; x < g.w; x++) if ((x + (y >> 1)) % 3 === 0) { dim(g, x, y, 0.8); dim(g, x, y + 1, 1.06); }
        // papo amarelado perto da cabeça
        for (let d = 0; d < 4; d++) for (let y = g.h - 3; y < g.h; y++) if (g.r() < 0.85 - d * 0.2) g.px(fromFront(g, f, d), y, TB.throat);
      } else if (f === 'top') g.noise(TB.back, 0.08);
      else if (f === 'bottom') g.noise(TB.belly, 0.04);
      else body(g);
    });
    sk.cube('tbHead', (g, f) => {
      grad3(g, shade(TB.back, 0.9), TB.flank, TB.throat, 0.04);
      if (isSide(f)) {
        for (let y = 1; y < g.h - 1; y++) g.px(fromFront(g, f, 3), y, shade(TB.back, 0.7)); // borda do opérculo
        fishEye(g, f, 0, 2, TB.eye, TB.pupil);
      }
      if (f === 'top') g.noise(shade(TB.back, 0.9), 0.06);
      if (f === 'bottom') g.noise(TB.throat, 0.05);
    });
    sk.cube('tbSnout', (g, f) => {
      grad3(g, TB.back, TB.flank, TB.throat, 0.04);
      if (f === 'front') {
        g.rect(0, 1, 4, 1, shade(TB.lip, 1.2)); g.rect(0, 3, 4, 1, shade(TB.lip, 1.45));
        g.px(0, 2, 0x2a2a26); g.px(3, 2, 0x2a2a26);
        g.px(1, 2, TB.tooth); g.px(2, 2, TB.tooth); // dentes molariformes, a marca do tambaqui
      }
    });
    sk.cube('tbHump', (g, f) => (f === 'top' ? g.noise(shade(TB.back, 0.85), 0.07) : g.noise(TB.back, 0.07)));
    sk.cube('tbBelly', (g, f) => g.noise(f === 'bottom' ? TB.belly : shade(TB.belly, 0.97), 0.04));
    sk.cube('tbRear', (g, f) => {
      body(g);
      if (isSide(f)) scales(g, 0, 3, 1.06, 0.85);
      if (f === 'top') g.noise(TB.back, 0.07);
      if (f === 'bottom') g.noise(TB.belly, 0.04);
    });
    sk.cube('tbPed', (g) => grad3(g, TB.back, TB.flank, shade(TB.flank, 1.1), 0.05));
    const dark = (id: string, mask: (d: number, y: number) => boolean) => sk.cube(id, (g, f) => fin(g, f, TB.fin, TB.finR, TB.finTip, mask, 0.8));
    sk.cube('tbTail', (g, f) => {
      const c = (g.h - 1) / 2;
      fin(g, f, TB.fin, TB.finR, TB.finTip, (d, y) => { const dy = Math.abs(y - c); return dy <= 2 + d * 1.1 && !(dy < (d - 3.2) * 1.4); }, 0.7);
    });
    dark('tbDorsal', (d, y) => d <= 1 + y * 0.9 || y >= 4);
    dark('tbAdip', (d, y) => !(d === 1 && y === 0));
    dark('tbAnal', (d, y) => y <= 1 || d <= 3 - y);
    dark('tbFin', (d, y) => !(d >= 3 && y >= 3));
  },
  animate(p, s) { fishAnim(p, s, [['fish', 2]], ['tail'], [['finR', 'finL']]); },
};

// ------------------------------------------------------------------ baiacu
const BC = {
  top: 0x937433, mid: 0xc6a44f, belly: 0xf1e8cf, spot: 0x45351a, eye: 0xa8c04c, pupil: 0x141a12,
  beak: 0xe6dcc2, fin: 0xe3c872, finR: 0xcdae58, finTip: 0xb08a3a, spine: 0xe9d9a6,
};

/** Bola de caixas: miolo (2r − 2)³ + três placas de 2r em X, Y e Z (cantos chanfrados). */
function ball(pfx: string, cy: number, r: number): CubeDef[] {
  const a = r - 1, b = r - 2;
  return [
    { id: `${pfx}A`, o: [-a, cy - a, -a], s: [2 * a, 2 * a, 2 * a] },
    { id: `${pfx}X`, o: [-r, cy - b, -b], s: [2 * r, 2 * b, 2 * b] },
    { id: `${pfx}Y`, o: [-b, cy - r, -b], s: [2 * b, 2 * r, 2 * b] },
    { id: `${pfx}Z`, o: [-b, cy - b, -r], s: [2 * b, 2 * b, 2 * r] },
  ];
}

/** Espinhos do baiacu inflado (bola de raio 5): 2×2 por face (a frente só embaixo) e pontas nos cantos. */
function spines(cy: number): CubeDef[] {
  const out: CubeDef[] = [];
  const seen = new Set<string>();
  // k = eixo + sentido da ponta (Xp = ponta em +X ...); a pele é pintada conforme a direção
  const add = (k: string, o: V3, s: V3) => {
    if (seen.has(k)) out.push({ id: `sp${k}${out.length}`, o, s, skinOf: `sp${k}` });
    else { seen.add(k); out.push({ id: `sp${k}`, o, s }); }
  };
  for (const u of [-2.5, 1.5]) {
    for (const v of [-2.5, 1.5]) {
      const y = cy + (v < 0 ? -2 : 1);
      add('Xp', [4.5, y, u], [2, 1, 1]); add('Xn', [-6.5, y, u], [2, 1, 1]);
      add('Yp', [u, cy + 4.5, v], [1, 2, 1]); add('Yn', [u, cy - 6, v], [1, 1.5, 1]);
      add('Zn', [u, cy + v, -6.5], [1, 1, 2]);
    }
    add('Zp', [u, cy - 2.5, 4.5], [1, 1, 2]);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    if (sy > 0 && sz > 0) continue; // cantos de cima da frente ficam livres para os olhos
    add('C', [sx * 4 - 0.5, cy + sy * 4 - 0.5, sz * 4 - 0.5], [1, 1, 1]);
  }
  return out;
}

/** Posição (0 = base, 1 = ponta) de um texel ao longo de um espinho com eixo `ax` e ponta no sentido `sg`. */
function alongSpine(g: Face, f: FaceName, ax: 0 | 1 | 2, sg: number, x: number, y: number): number {
  const u = g.w <= 1 ? 1 : x / (g.w - 1), v = g.h <= 1 ? 1 : y / (g.h - 1);
  let t: number;
  if (ax === 0) t = f === 'left' ? 1 : f === 'right' ? 0 : f === 'back' ? 1 - u : u;
  else if (ax === 1) t = f === 'top' ? 1 : f === 'bottom' ? 0 : 1 - v;
  else t = f === 'front' ? 1 : f === 'back' ? 0 : f === 'left' ? 1 - u : f === 'right' ? u : f === 'top' ? v : 1 - v;
  return sg > 0 ? t : 1 - t;
}

/** Leque arredondado (rabo): abre a partir da base e apara os cantos da ponta. */
const fanMask = (w: number, h: number, base: number, grow: number) => (d: number, y: number): boolean => {
  const c = (h - 1) / 2, dy = Math.abs(y - c);
  return dy <= base + d * grow && !(d >= w - 1 && dy >= c - 0.5);
};

const fishFin = (pfx: string, x: number, y: number, z: number, side: number, s: V3, rot: number): PartDef => ({
  name: `${pfx}${side < 0 ? 'R' : 'L'}`, pivot: [x, y, z], rot: [0, side < 0 ? rot : -rot, 0],
  cubes: [side < 0 ? { id: `${pfx}f`, o: [x, y - 1, z - s[2]], s } : { id: `${pfx}fL`, o: [x, y - 1, z - s[2]], s, mirror: true, skinOf: `${pfx}f` }],
});

export const BAIACU: ModelDef = {
  id: 'baiacu',
  parts: [
    { // murcho: alongado, olhos saltados no alto da cabeça
      name: 'p0', pivot: [0, 3, 0],
      cubes: [
        { id: 'b0', o: [-2, 1, -3], s: [4, 4, 5] },
        { id: 'b0h', o: [-1.5, 1.5, 2], s: [3, 3, 1] },
        { id: 'b0m', o: [-0.5, 2, 3], s: [1, 1, 1] },
        { id: 'b0p', o: [-1, 2, -5], s: [2, 2, 2] },
        { id: 'b0d', o: [0, 4, -5], s: [0, 1, 1] },
        { id: 'b0a', o: [0, 1, -5], s: [0, 1, 1] },
        { id: 'e0R', o: [-2.5, 3.5, 0.5], s: [1, 1, 1] },
        { id: 'e0L', o: [1.5, 3.5, 0.5], s: [1, 1, 1], mirror: true, skinOf: 'e0R' },
      ],
      children: [
        { name: 't0', pivot: [0, 3, -5], cubes: [{ id: 'bt0', o: [0, 1, -7], s: [0, 4, 2] }] },
        fishFin('p0', -2, 3.5, 0, -1, [0, 2, 1.5], 40), fishFin('p0', 2, 3.5, 0, 1, [0, 2, 1.5], 40),
      ],
    },
    { // meio inflado: bola lisa com pintinhas claras
      name: 'p1', pivot: [0, 4, 0],
      cubes: [
        ...ball('b1', 4, 4),
        { id: 'b1m', o: [-1, 2.5, 4], s: [2, 1, 1] },
        { id: 'b1d', o: [0, 6, -5], s: [0, 2, 2] },
        { id: 'b1a', o: [0, 0, -5], s: [0, 2, 2] },
        { id: 'e1R', o: [-3.5, 4.5, 2.5], s: [2, 2, 2] },
        { id: 'e1L', o: [1.5, 4.5, 2.5], s: [2, 2, 2], mirror: true, skinOf: 'e1R' },
      ],
      children: [
        { name: 't1', pivot: [0, 4, -4], cubes: [{ id: 'bt1', o: [0, 2, -7], s: [0, 4, 3] }] },
        fishFin('p1', -4, 5, 0, -1, [0, 2, 2], 40), fishFin('p1', 4, 5, 0, 1, [0, 2, 2], 40),
      ],
    },
    { // inflado: bola espinhosa com rabinho e nadadeiras miúdas
      name: 'p2', pivot: [0, 6, 0],
      cubes: [
        ...ball('b2', 6, 5),
        { id: 'b2m', o: [-1, 4.5, 5], s: [2, 1, 1] },
        { id: 'b2d', o: [0, 9, -6], s: [0, 2, 2] },
        { id: 'b2a', o: [0, 1, -6], s: [0, 2, 2] },
        { id: 'e2R', o: [-4.5, 7.5, 3.5], s: [2, 2, 2] },
        { id: 'e2L', o: [2.5, 7.5, 3.5], s: [2, 2, 2], mirror: true, skinOf: 'e2R' },
        ...spines(6),
      ],
      children: [
        { name: 't2', pivot: [0, 6, -5], cubes: [{ id: 'bt2', o: [0, 3.5, -8], s: [0, 5, 3] }] },
        fishFin('p2', -5, 7, 0, -1, [0, 2, 2], 45), fishFin('p2', 5, 7, 0, 1, [0, 2, 2], 45),
      ],
    },
  ],
  paint(sk) {
    const blotches = (g: Face, y1: number) => {
      const n = Math.max(1, Math.round((g.w * y1) / 16));
      for (let i = 0; i < n; i++) { const r = 0.7 + g.r() * 0.9; g.ellipse(g.r() * g.w, g.r() * y1, r, r * 0.8, BC.spot); }
    };
    /** Pele: dorso marrom-amarelado com pintas escuras, ventre claro; `dots` = pintinhas claras (meio inflado). */
    const skin = (g: Face, f: FaceName, dots: boolean, stretch: boolean) => {
      if (f === 'bottom') {
        g.noise(BC.belly, 0.03);
        if (stretch) for (let y = 1; y < g.h; y += 3) for (let x = 0; x < g.w; x++) if ((x + y) % 4 !== 0) dim(g, x, y, 0.94);
        return;
      }
      if (f === 'top') { g.noise(BC.top, 0.08); blotches(g, g.h); }
      else { grad3(g, BC.top, BC.mid, BC.belly, 0.05); blotches(g, Math.ceil(g.h * 0.5)); }
      if (dots) for (let y = 1; y < g.h; y += 3) for (let x = (y % 2) + 1; x < g.w; x += 3) g.px(x, y, BC.spine);
    };
    // murcho: faixas transversais escuras no dorso
    sk.cube('b0', (g, f) => {
      skin(g, f, false, false);
      if (f === 'top') { g.noise(BC.top, 0.06); for (const y of [1, 4, 7]) g.rect(0, y, g.w, 2, BC.spot); }
      if (isSide(f)) { for (const d of [2, 5, 8]) for (let y = 0; y < 3; y++) g.px(fromFront(g, f, d), y, BC.spot); g.px(fromFront(g, f, 1), 4, shade(BC.mid, 0.7)); }
    });
    sk.cube('b0h', (g, f) => { skin(g, f, false, false); if (f === 'front') g.rect(1, 0, g.w - 2, 1, BC.top); });
    sk.cube('b0p', (g, f) => skin(g, f, false, false));
    for (const id of ['b1A', 'b1X', 'b1Y', 'b1Z']) sk.cube(id, (g, f) => skin(g, f, true, false));
    for (const id of ['b2A', 'b2X', 'b2Y', 'b2Z']) sk.cube(id, (g, f) => skin(g, f, false, true));
    // bico de placas (dentes fundidos)
    for (const id of ['b0m', 'b1m', 'b2m']) sk.cube(id, (g, f) => {
      g.noise(BC.beak, 0.04);
      if (f === 'front') { for (let x = 0; x < g.w; x++) g.px(x, g.h - 1, shade(BC.beak, 0.78)); g.px(g.w >> 1, 0, 0x5a4a3a); if (g.w > 2) g.px((g.w >> 1) - 1, 0, 0x5a4a3a); }
    });
    // olhos saltados
    sk.cube('e0R', (g, f) => { g.fill(BC.eye); if (f === 'front' || f === 'right' || f === 'top') g.px(0, 1, BC.pupil); if (f === 'bottom') g.fill(BC.mid); });
    for (const id of ['e1R', 'e2R']) sk.cube(id, (g, f) => {
      g.fill(BC.eye); g.rim(0.78);
      if (f === 'bottom' || f === 'back' || f === 'left') { g.noise(BC.mid, 0.05); return; }
      g.rect(1, 1, 2, 2, BC.pupil); g.px(1, 1, [250, 250, 240]);
    });
    // espinhos: base na cor da pele (ventre claro embaixo), clareando e com a ponta escura e afiada
    for (const k of ['Xp', 'Xn', 'Yp', 'Yn', 'Zp', 'Zn'] as const) sk.cube(`sp${k}`, (g, f) => {
      const ax = k[0] === 'X' ? 0 : k[0] === 'Y' ? 1 : 2, sg = k[1] === 'p' ? 1 : -1;
      const base = k === 'Yn' ? BC.belly : k === 'Yp' ? BC.top : BC.mid;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const t = alongSpine(g, f, ax, sg, x, y);
        g.px(x, y, t >= 0.8 ? 0x5e4520 : lerpc(base, BC.spine, t));
      }
    });
    sk.cube('spC', (g) => { g.noise(BC.spine, 0.04); g.rim(0.85); });
    // nadadeiras claras
    const pale = (id: string, mask: (d: number, y: number) => boolean) => sk.cube(id, (g, f) => fin(g, f, BC.fin, BC.finR, BC.finTip, mask, 0.75));
    pale('bt0', fanMask(4, 8, 1.5, 1));
    pale('bt1', fanMask(6, 8, 1.5, 0.9));
    pale('bt2', fanMask(6, 10, 1.5, 1.2));
    for (const id of ['b0d', 'b0a']) pale(id, () => true);
    for (const id of ['b1d', 'b2d']) pale(id, (d, y) => d - y < 2); // presa embaixo
    for (const id of ['b1a', 'b2a']) pale(id, (d, y) => d + y < 6); // presa em cima
    for (const id of ['p0f', 'p1f', 'p2f']) pale(id, (d, y) => !(d >= 2 && y >= 3));
  },
  animate(p, s) {
    fishAnim(p, s, [['p0', 2], ['p1', 4.5], ['p2', 6.5]], ['t0', 't1', 't2'], [['p0R', 'p0L'], ['p1R', 'p1L'], ['p2R', 'p2L']]);
  },
};

// ------------------------------------------------------------------ acará
/** Variante `padrão|base|listra` → cores (listra igual à base vira um tom mais escuro para o padrão aparecer). */
function acaraColors(variant: string): { pattern: number; base: Col; stripe: Col } {
  const [pt, b, st] = variant.split('|').map((v) => parseInt(v, 10));
  const base = Number.isFinite(b) ? b : 0x3aafd9;
  const stripe = Number.isFinite(st) ? st : 0xf0f0f0;
  return { pattern: Number.isFinite(pt) ? ((pt % 4) + 4) % 4 : 0, base, stripe: stripe === base ? shade(base, 0.55) : stripe };
}

export const ACARA: ModelDef = {
  id: 'acara',
  parts: [{
    name: 'fish', pivot: [0, 3.5, 0],
    cubes: [
      { id: 'acBody', o: [-1, 1, -2], s: [2, 5, 5] },
      { id: 'acHead', o: [-1, 1.5, 3], s: [2, 3, 1] },
      { id: 'acLip', o: [-0.5, 2, 4], s: [1, 1, 1] },
      { id: 'acCrown', o: [-1, 6, -1], s: [2, 1, 3] },
      { id: 'acChin', o: [-1, 0, -1], s: [2, 1, 3] },
      { id: 'acPed', o: [-0.5, 2.5, -3], s: [1, 2, 1] },
      { id: 'acDorsal', o: [0, 6, -5], s: [0, 3, 6] },
      { id: 'acAnal', o: [0, -1, -5], s: [0, 3, 5] },
    ],
    children: [
      { name: 'tail', pivot: [0, 3.5, -3], cubes: [{ id: 'acTail', o: [0, 0, -6], s: [0, 7, 3] }] },
      { name: 'finR', pivot: [-1, 3.5, 2], rot: [0, 30, 0], cubes: [{ id: 'acFin', o: [-1, 2.5, 0], s: [0, 2, 2] }] },
      { name: 'finL', pivot: [1, 3.5, 2], rot: [0, -30, 0], cubes: [{ id: 'acFinL', o: [1, 2.5, 0], s: [0, 2, 2], mirror: true, skinOf: 'acFin' }] },
    ],
  }],
  paint(sk, variant) {
    const { pattern, base, stripe } = acaraColors(variant);
    const top = shade(base, 0.78), belly = lerpc(base, 0xffffff, 0.4), finC = lerpc(base, 0xffffff, 0.12);
    /** Padrão no flanco: `d0` desloca o desenho para continuar do corpo no pedúnculo. */
    const pat = (g: Face, f: FaceName, d0: number) => {
      for (let y = 0; y < g.h; y++) for (let d = 0; d < g.w; d++) {
        const x = fromFront(g, f, d), dd = d + d0;
        if (pattern === 0 && (dd % 5 === 3 || dd % 5 === 4)) g.px(x, y, stripe);
        else if (pattern === 1 && y > 0 && (dd + 2 * (y % 2)) % 4 === 1 && y % 2 === 1) g.px(x, y, stripe);
        else if (pattern === 2 && Math.abs(y - g.h * 0.5) < g.h * 0.14) g.px(x, y, stripe);
        else if (pattern === 3) { const c = g.get(x, y); g.px(x, y, lerpc([c[0], c[1], c[2]], stripe, Math.min(1, dd / 12))); }
      }
    };
    const flank = (g: Face) => grad3(g, top, base, belly, 0.05);
    sk.cube('acBody', (g, f) => {
      flank(g);
      if (isSide(f)) { scales(g, 1, g.h - 2, 1.07, 0.93); pat(g, f, 0); }
      if (f === 'top') g.noise(top, 0.06);
      if (f === 'bottom') g.noise(belly, 0.04);
    });
    sk.cube('acHead', (g, f) => {
      flank(g);
      if (isSide(f)) { if (pattern === 0) for (let y = 0; y < g.h; y++) g.px(fromFront(g, f, 1), y, stripe); fishEye(g, f, 0, 1, 0xd8452a, 0x1a1210); }
      if (f === 'front') { g.rect(1, 0, 2, 2, top); }
    });
    sk.cube('acLip', (g, f) => { g.noise(shade(belly, 0.9), 0.05); if (f === 'front') g.rect(0, 1, 2, 1, shade(base, 0.45)); });
    sk.cube('acCrown', (g, f) => { g.noise(top, 0.06); if (isSide(f) && pattern === 0) for (let d = 0; d < g.w; d++) if ((d + 3) % 5 >= 3) g.px(fromFront(g, f, d), 1, stripe); });
    sk.cube('acChin', (g) => g.noise(belly, 0.05));
    sk.cube('acPed', (g, f) => { flank(g); if (isSide(f)) pat(g, f, 10); });
    // nadadeiras longas: cor da base com raios; a borda livre (não a presa ao corpo) leva a cor da listra
    type Att = 'top' | 'bottom' | 'front';
    const edge = (g: Face, f: FaceName, att: Att, mask: (d: number, y: number) => boolean) => {
      const m = (d: number, y: number): boolean => {
        if ((att === 'bottom' && y >= g.h) || (att === 'top' && y < 0) || (att === 'front' && d < 0)) return true;
        return d >= 0 && y >= 0 && d < g.w && y < g.h && mask(d, y);
      };
      fin(g, f, finC, shade(finC, 0.84), finC, m, 1);
      for (let y = 0; y < g.h; y++) for (let d = 0; d < g.w; d++) {
        if (m(d, y) && (!m(d, y - 1) || !m(d + 1, y) || !m(d, y + 1) || !m(d - 1, y))) g.px(fromFront(g, f, d), y, stripe);
      }
    };
    sk.cube('acDorsal', (g, f) => edge(g, f, 'bottom', (d, y) => y >= g.h - 1 - d * 0.75 && d <= g.w - 1 - (g.h - 1 - y) * 0.3));
    sk.cube('acAnal', (g, f) => edge(g, f, 'top', (d, y) => y <= d * 0.75 && d <= g.w - 1 - y * 0.3));
    sk.cube('acTail', (g, f) => {
      const c = (g.h - 1) / 2;
      edge(g, f, 'front', (d, y) => { const dy = Math.abs(y - c); return dy <= 2 + d * 1.8 && !(d >= 4 && dy < 3); });
    });
    sk.cube('acFin', (g, f) => fin(g, f, lerpc(finC, 0xffffff, 0.3), finC, finC, (d, y) => !(d >= 3 && y >= 2), 1));
  },
  animate(p, s) { fishAnim(p, s, [['fish', 1.5]], ['tail'], [['finR', 'finL']]); },
};

// ------------------------------------------------------------------ specs
export const SPECS_MONSTROS: Record<string, MobModelSpec> = {
  lambari: { def: LAMBARI },
  tambaqui: { def: TAMBAQUI },
  baiacu: {
    def: BAIACU,
    // só a forma do estado atual aparece (murcho / meio / inflado)
    pose(inst, e) {
      const n = Math.max(0, Math.min(2, Math.round((e as Baiacu).puff) || 0));
      inst.parts.p0.visible = n === 0;
      inst.parts.p1.visible = n === 1;
      inst.parts.p2.visible = n === 2;
    },
  },
  acara: { def: ACARA, variant: (e) => { const a = e as Acara; return `${a.pattern}|${a.base}|${a.stripe}`; } },
};
