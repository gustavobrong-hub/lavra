/**
 * Sombras da noite e das profundezas:
 *  - assombro: voador noturno, mistura de arraia e morcego (asas de membrana índigo com veias que brilham);
 *  - vulto: sombra alta de fumaça com membros compridos, olhos violeta e mandíbula que se abre quando encarado;
 *  - espreitador: fera de placas de pedra que se disfarça de bloco e se desdobra em seis patas e boca de ametista.
 */
import type { Mesh, ShaderMaterial } from 'three';
import type { ModelDef, PartDef, CubeDef, Parts, ModelInstance, V3 } from '../boxmodel';
import { DEG } from '../boxmodel';
import { head, biped, flap } from '../anim';
import type { Face, FaceName, Col, SkinPainter } from '../skin';
import type { MobModelSpec } from '../../mobvisual';
import type { Assombro, Vulto, Espreitador } from '../../../../game/entity/species/monsters2';

// ------------------------------------------------------------------ utilitários compartilhados
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v: number): number => { const t = clamp01(v); return t * t * (3 - 2 * t); };
export const frac = (v: number): number => v - Math.floor(v);

/** Ajusta o brilho (uEmissive) do material da parte. Use valores de emissive exclusivos na definição da parte. */
export function setGlow(inst: ModelInstance, part: string, v: number): void {
  const g = inst.parts[part];
  if (!g) return;
  for (const c of g.children) {
    const m = (c as Mesh).isMesh ? (c as Mesh).material as ShaderMaterial : null;
    if (m?.uniforms?.uEmissive && m.uniforms.uEmissive.value > 0) m.uniforms.uEmissive.value = v;
  }
}

/** Esconde/mostra uma lista de partes. */
export function show(p: Parts, names: string[], v: boolean): void {
  for (const n of names) if (p[n]) p[n].visible = v;
}

/** Fumacinha que sobe e encolhe em ciclo (parte translúcida pequena). */
export function puff(p: Parts, name: string, t: number, speed: number, off: number, rise: number, drift: number): void {
  const o = p[name];
  if (!o) return;
  const k = frac(t * speed + off);
  o.position.y += (k * rise) / 16;
  o.position.x += (Math.sin((k + off) * Math.PI * 2) * drift) / 16;
  o.scale.setScalar(Math.max(0.05, Math.min(1, k / 0.15) * (1 - 0.8 * k)));
}

// ================================================================== ASSOMBRO
// Coordenadas da asa (px): U = distância do flanco do corpo até a ponta (0..13), Z = de trás (−5) para a frente (4).
// A asa interna cobre U 0..6 e a externa U 6..13 (a externa gira no "pulso", em U = 6).
const WING_TIP = 15, WRIST = 7;
const wingFront = (u: number): number => (u <= WRIST ? 4 : 4 - (u - WRIST) * 0.55);
const FINGERS = [0, 5, 10.5, WING_TIP];
function wingBack(u: number): number {
  const base = -5 + (u / WING_TIP) * (5 + wingFront(WING_TIP));
  for (let i = 0; i < FINGERS.length - 1; i++) {
    const a = FINGERS[i], b = FINGERS[i + 1];
    if (u >= a && u <= b) return base + 1.3 * Math.sin(Math.PI * (u - a) / (b - a)); // recorte entre os dedos
  }
  return base;
}

function wingPart(side: 'R' | 'L'): PartDef {
  const sg = side === 'L' ? 1 : -1;
  const L = side === 'L';
  const inX = L ? 3 : -10, outX = L ? 10 : -18;
  const mir = (id: string) => (L ? { mirror: true, skinOf: id } : {});
  return {
    name: `wing${side}`, pivot: [3 * sg, 4.5, 0],
    cubes: [
      { id: `mem${side}`, o: [inX, 4.5, -5], s: [7, 0, 9], translucent: true, ...mir('memR') },
      { id: `bone${side}`, o: [inX, 4, 3], s: [7, 1, 1], ...mir('boneR') },
      { id: `knuckle${side}`, o: [L ? 9.5 : -10.5, 3.5, 2.5], s: [1, 2, 2], ...mir('knuckleR') },
    ],
    children: [
      { name: `veins${side}`, pivot: [3 * sg, 4.5, 0], cubes: [{ id: `vein${side}`, o: [inX, 4.5, -5], s: [7, 0, 9], emissive: 0.3, ...mir('veinR') }] },
      {
        name: `wing${side}2`, pivot: [10 * sg, 4.5, 0],
        cubes: [{ id: `memo${side}`, o: [outX, 4.5, -4], s: [8, 0, 8], translucent: true, ...mir('memoR') }],
        children: [{ name: `veins${side}2`, pivot: [10 * sg, 4.5, 0], cubes: [{ id: `veino${side}`, o: [outX, 4.5, -4], s: [8, 0, 8], emissive: 0.3, ...mir('veinoR') }] }],
      },
    ],
  };
}

const ASSOMBRO_PARTS: PartDef[] = [{
  name: 'body', pivot: [0, 4, 0],
  cubes: [
    { o: [-3, 2.5, -5], s: [6, 3, 10] },
    { id: 'rump', o: [-2, 3, -8], s: [4, 2, 3] },
    { id: 'hump', o: [-2, 5.5, -3], s: [4, 1, 6] },
  ],
  children: [
    {
      name: 'head', pivot: [0, 4, 5],
      cubes: [
        { o: [-3.5, 2.5, 5], s: [7, 3, 4] },
        { id: 'lobeR', o: [-3.5, 2.5, 9], s: [1, 1, 3] },
        { id: 'lobeL', o: [2.5, 2.5, 9], s: [1, 1, 3], mirror: true, skinOf: 'lobeR' },
        { id: 'earR', o: [-3.5, 5.5, 5.5], s: [2, 2, 1] },
        { id: 'earL', o: [1.5, 5.5, 5.5], s: [2, 2, 1], mirror: true, skinOf: 'earR' },
      ],
      children: [{
        name: 'eyes', pivot: [0, 4, 5],
        cubes: [
          { id: 'eyeR', o: [-4, 3.5, 8.5], s: [1, 1, 1], emissive: 0.55 },
          { id: 'eyeL', o: [3, 3.5, 8.5], s: [1, 1, 1], emissive: 0.55, mirror: true, skinOf: 'eyeR' },
        ],
      }],
    },
    wingPart('R'), wingPart('L'),
    {
      name: 'tail', pivot: [0, 4, -8], cubes: [{ o: [-0.5, 3.5, -14], s: [1, 1, 6] }],
      children: [{ name: 'tail2', pivot: [0, 4, -14], cubes: [{ o: [-0.5, 3.5, -20], s: [1, 1, 6] }, { id: 'fin', o: [-1.5, 4, -23], s: [3, 0, 3] }] }],
    },
  ],
}];

const A_DORSAL = 0x29273f, A_DORSAL_D = 0x19182a, A_DORSAL_L = 0x3b3860, A_SPOT = 0x6a6798;
const A_BELLY = 0x8c88a8, A_BELLY_D = 0x68647f;
const A_MEM: Col = [50, 42, 98, 222], A_MEM_EDGE: Col = [24, 20, 50, 245], A_MEM_ROOT: Col = [34, 30, 72, 238];
const A_VEIN = 0x5561b2, A_VEIN_HI = 0x8d98e0, A_EYE = 0x3fa656, A_PUPIL = 0x06100a;

/** Texel ↔ coordenadas da asa, para o plano interno/externo e a face de cima/de baixo (pele da asa direita). */
function wingUZ(outer: boolean, f: FaceName, x: number, y: number): [number, number] {
  const u = (outer ? WING_TIP : WRIST) - (x + 0.5) / 2;
  const z = f === 'top' ? (outer ? -4 : -5) + (y + 0.5) / 2 : 4 - (y + 0.5) / 2;
  return [u, z];
}
function wingXY(outer: boolean, f: FaceName, u: number, z: number): [number, number] {
  const x = ((outer ? WING_TIP : WRIST) - u) * 2 - 0.5;
  const y = f === 'top' ? (z - (outer ? -4 : -5)) * 2 - 0.5 : (4 - z) * 2 - 0.5;
  return [x, y];
}
// veias luminosas: do pulso até cada dedo, mais ramos curtos
const VEINS: [number, number, number, number][] = [
  [WRIST, 3.2, 5, wingBack(5) + 0.4], [WRIST, 3.2, 10.5, wingBack(10.5) + 0.4], [WRIST, 3.2, 13, 0.4],
  [6, 0.2, 3.6, -2.4], [8.8, 0.4, 11.4, -0.8], [9.6, 1.8, 12.2, 1.0], [0.6, 2.4, 2.6, -1.2], [1.8, -3.4, 2.6, -1.2],
];

function paintWing(g: Face, f: FaceName, outer: boolean, veinsOnly: boolean): void {
  if (!veinsOnly) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const [u, z] = wingUZ(outer, f, x, y);
      const zb = wingBack(u), zf = wingFront(u);
      if (z < zb || z > zf) continue;
      const c = z - zb < 0.55 ? A_MEM_EDGE : u < 1.2 ? A_MEM_ROOT : A_MEM;
      const k = 1 + (g.r() * 2 - 1) * 0.06 + (u / WING_TIP) * 0.12;
      g.px(x, y, [(c as number[])[0] * k, (c as number[])[1] * k, (c as number[])[2] * k, (c as number[])[3]]);
    }
    // bordo de ataque da asa externa: osso escuro e opaco
    if (outer) for (let u = WRIST; u <= WING_TIP; u += 0.25) { const [x, y] = wingXY(true, f, u, wingFront(u) - 0.2); g.px(x, y, [58, 54, 96, 235]); }
  }
  for (const [u0, z0, u1, z1] of VEINS) {
    const a = wingXY(outer, f, u0, z0), b = wingXY(outer, f, u1, z1);
    g.line(a[0], a[1], b[0], b[1], veinsOnly ? A_VEIN : [0, 0, 0, 0]);
  }
  if (veinsOnly) { const [x, y] = wingXY(outer, f, WRIST, 3.2); g.rect(x - 1, y - 1, 2, 2, A_VEIN_HI); }
}

function paintAssombro(sk: SkinPainter): void {
  const dorsal = (g: Face) => { g.noise(A_DORSAL, 0.08); g.spots(A_DORSAL_D, Math.max(1, Math.floor(g.w * g.h / 50)), 0.6, 1.4); };
  const flank = (g: Face) => { g.vgrad(A_DORSAL, A_BELLY_D, 0.06); g.rect(0, 0, g.w, Math.ceil(g.h / 2), A_DORSAL).noise(A_DORSAL, 0.05); };
  sk.cube('body', (g, f) => {
    if (f === 'top') {
      dorsal(g);
      // marcas claras de "ombro" e pontos ao longo da espinha
      g.ellipse(3, g.h - 6, 2, 3, A_DORSAL_L).ellipse(g.w - 3, g.h - 6, 2, 3, A_DORSAL_L);
      g.px(2, g.h - 7, A_SPOT); g.px(g.w - 3, g.h - 7, A_SPOT);
      for (let y = 2; y < g.h - 2; y += 4) { g.px(1, y, A_SPOT); g.px(g.w - 2, y + 2, A_SPOT); }
    } else if (f === 'bottom') { g.noise(A_BELLY, 0.05); g.rim(0.85, 1); }
    else flank(g);
  });
  sk.cube('rump', (g, f) => (f === 'bottom' ? g.noise(A_BELLY, 0.05) : f === 'top' ? dorsal(g) : flank(g)));
  sk.cube('hump', (g, f) => { if (f === 'top') { dorsal(g); for (let y = 2; y < g.h - 1; y += 4) g.px(g.w / 2 - 0.5, y, A_SPOT); } else g.noise(A_DORSAL, 0.06); });
  sk.cube('head', (g, f) => {
    if (f === 'top') { dorsal(g); g.px(3, 4, A_SPOT); g.px(g.w - 4, 4, A_SPOT); g.line(4, 1, g.w - 5, 1, A_DORSAL_L); }
    else if (f === 'bottom') g.noise(A_BELLY, 0.05);
    else if (f === 'front') {
      g.noise(A_DORSAL, 0.06);
      g.rect(0, 4, g.w, 2, A_BELLY_D);
      // boca larga de arraia com presinhas de morcego
      g.rect(2, 3, g.w - 4, 1, 0x100d22); g.rect(3, 4, g.w - 6, 1, 0x1c1733);
      g.px(4, 4, 0xe2def0); g.px(g.w - 5, 4, 0xe2def0);
      g.px(1, 1, A_DORSAL_L); g.px(g.w - 2, 1, A_DORSAL_L);
    } else flank(g);
  });
  sk.cube('lobeR', (g, f) => { g.noise(A_DORSAL, 0.08); if (f === 'bottom' || f === 'left') g.noise(A_BELLY_D, 0.06); if (f === 'front') g.fill(A_DORSAL_L); });
  sk.cube('earR', (g, f) => {
    g.noise(A_DORSAL_D, 0.08);
    if (f === 'front') g.rect(1, 1, 2, 3, 0x4a3f6e);
    // orelha pontuda: corta o canto de dentro (a ponta fica para fora)
    if (f === 'front') { g.clear(2, 0, 2, 1); g.clear(3, 1, 1, 1); }
    if (f === 'back') { g.clear(0, 0, 2, 1); g.clear(0, 1, 1, 1); }
    if (f === 'left') g.clear(0, 0, 2, 1);
  });
  sk.cube('eyeR', (g, f) => { g.fill(A_EYE); if (f === 'front' || f === 'right') g.px(f === 'front' ? 0 : 1, 1, A_PUPIL); });
  sk.cube('boneR', (g, f) => { g.noise(0x1f2046, 0.1); if (f === 'top' || f === 'front') for (let x = 1; x < g.w; x += 4) g.px(x, 0, A_DORSAL_L); });
  sk.cube('knuckleR', (g, f) => { g.noise(0x1f2046, 0.1); if (f === 'front') g.px(0, g.h - 1, 0xd8d2ee); });
  for (const [id, outer] of [['memR', false], ['memoR', true]] as const) {
    sk.face(id, 'top', (g) => paintWing(g, 'top', outer, false));
    sk.face(id, 'bottom', (g) => paintWing(g, 'bottom', outer, false));
  }
  for (const [id, outer] of [['veinR', false], ['veinoR', true]] as const) {
    sk.face(id, 'top', (g) => paintWing(g, 'top', outer, true));
    sk.face(id, 'bottom', (g) => paintWing(g, 'bottom', outer, true));
  }
  for (const id of ['tail', 'tail2']) sk.cube(id, (g) => { g.noise(A_DORSAL, 0.08); for (let y = 2; y < g.h; y += 4) g.rect(0, y, g.w, 1, A_DORSAL_L); });
  for (const f of ['top', 'bottom'] as FaceName[]) sk.face('fin', f, (g) => {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const d = Math.abs(x + 0.5 - g.w / 2) + Math.abs(y + 0.5 - g.h / 2);
      if (d <= g.w / 2) g.px(x, y, d > g.w / 2 - 1.2 ? A_VEIN : A_DORSAL);
    }
  });
}

export const ASSOMBRO: ModelDef = {
  id: 'assombro',
  parts: ASSOMBRO_PARTS,
  paint: (sk) => paintAssombro(sk),
  animate(p, s) {
    const e = s.e as Assombro;
    const ph = (e.flapAnim ?? 0) + s.alpha * 0.35;
    const pitch = Math.max(-50, Math.min(50, s.headPitch));
    // o corpo inteiro inclina com o voo e sobe/desce com a batida
    p.body.rotation.x += pitch * DEG;
    p.body.position.y += (Math.cos(ph) * 0.7) / 16;
    // asas: batida em Z, a ponta atrasada (onda de arraia) e um leve diedro de repouso
    flap(p, 'wingL', 'wingR', ph, 0.55);
    flap(p, 'wingL2', 'wingR2', ph - 0.9, 0.5);
    p.wingL.rotation.z += 0.1; p.wingR.rotation.z -= 0.1;
    // cauda chicoteando
    p.tail.rotation.x += Math.sin(ph - 1.2) * 0.12 - pitch * DEG * 0.35;
    p.tail2.rotation.x += Math.sin(ph - 2.1) * 0.2;
    p.tail.rotation.y += Math.sin(s.t * 0.11) * 0.15;
    p.tail2.rotation.y += Math.sin(s.t * 0.11 - 0.8) * 0.28;
    p.head.rotation.x += Math.sin(ph - 0.5) * 0.05;
  },
};

// ================================================================== VULTO
// Tronco curvado para a frente (LEAN graus); cabeça e braços compensam para ficarem na vertical.
const LEAN = 8;
const V_SMOKE = 0x17141f, V_SMOKE_D = 0x0d0b13, V_SMOKE_L = 0x2a2439, V_VIOLET = 0x3f2d66, V_VIOLET_L = 0x6a4fa8;
const V_EYE = 0x8a4dd4, V_EYE_HI = 0xb68cf0, V_CLAW = 0x6a5c8c, V_TOOTH = 0xcfc7de;

function vArm(side: 'R' | 'L'): PartDef {
  const L = side === 'L', sg = L ? 1 : -1;
  const x0 = L ? 3.5 : -5.5;
  const mir = (id: string) => (L ? { mirror: true, skinOf: id } : {});
  const claw = (id: string, o: [number, number, number]) => ({ id, o, s: [1, 3, 1] as [number, number, number], ...(L ? { mirror: true, skinOf: 'clawR1' } : id === 'clawR1' ? {} : { skinOf: 'clawR1' }) });
  return {
    name: `arm${side}`, pivot: [4.5 * sg, 32, 0], rot: [-LEAN, 0, 0],
    cubes: [
      { id: `arm${side}`, o: [x0, 20, -1], s: [2, 12, 2], ...mir('armR') },
      { id: `shoulder${side}`, o: [L ? 3 : -6, 30, -1.5], s: [3, 3, 3], ...mir('shoulderR') },
    ],
    children: [{
      name: `fore${side}`, pivot: [4.5 * sg, 20, 0],
      cubes: [
        { id: `fore${side}`, o: [x0, 10, -1], s: [2, 10, 2], ...mir('foreR') },
        { id: `palm${side}`, o: [L ? 3 : -6, 8, -1.5], s: [3, 2, 3], ...mir('palmR') },
        claw(`claw${side}1`, [L ? 5 : -6, 5, 0.5]),
        claw(`claw${side}2`, [L ? 3 : -4, 5, 0.5]),
        claw(`claw${side}3`, [L ? 4 : -5, 5.5, -1.5]),
      ],
      // bloco carregado: parte vazia entre as mãos (o sistema desenha o bloco aqui)
      children: L ? [] : [{ name: 'carry', pivot: [0, 9, 0], cubes: [] }],
    }],
  };
}

const VULTO_PARTS: PartDef[] = [
  { name: 'legR', pivot: [-1.5, 19, 0], cubes: [{ o: [-2.5, 0, -1], s: [2, 19, 2] }] },
  { name: 'legL', pivot: [1.5, 19, 0], cubes: [{ o: [0.5, 0, -1], s: [2, 19, 2], mirror: true, skinOf: 'legR' }] },
  {
    name: 'body', pivot: [0, 19, 0], rot: [LEAN, 0, 0],
    cubes: [
      { o: [-3.5, 25, -2], s: [7, 8, 4] },
      { id: 'waist', o: [-2.5, 19, -1.5], s: [5, 6, 3] },
      { id: 'hips', o: [-3, 17, -1.5], s: [6, 2, 3] },
      { id: 'skirt', o: [-3, 12, -2], s: [6, 9, 4], skip: ['top', 'bottom'] },
      { id: 'neck', o: [-1.5, 33, -1.5], s: [3, 2, 3] },
    ],
    children: [
      {
        name: 'head', pivot: [0, 35, 0], rot: [-LEAN, 0, 0],
        cubes: [
          { o: [-3, 37, -3], s: [6, 6, 6] },
          { id: 'crest', o: [-2.5, 43, -3.5], s: [5, 2, 5] },
          { id: 'crest2', o: [-1.5, 45, -4.5], s: [3, 2, 3] },
          { id: 'crest3', o: [-0.5, 47, -5.5], s: [1, 1, 2] },
          { id: 'fangU1', o: [-2, 36, 1.5], s: [1, 1, 1] },
          { id: 'fangU2', o: [1, 36, 1.5], s: [1, 1, 1], skinOf: 'fangU1' },
        ],
        children: [
          {
            name: 'jaw', pivot: [0, 37, -3],
            cubes: [
              { o: [-3, 35, -3], s: [6, 2, 6] },
              { id: 'fangD1', o: [-1.5, 37, 1.5], s: [1, 1, 1], skinOf: 'fangU1' },
              { id: 'fangD2', o: [0.5, 37, 1.5], s: [1, 1, 1], skinOf: 'fangU1' },
            ],
            children: [{ name: 'maw', pivot: [0, 37, -3], cubes: [{ id: 'maw', o: [-2.5, 37.1, -2.5], s: [5, 0, 4], emissive: 0.45, skip: ['bottom'] }] }],
          },
          {
            name: 'eyes', pivot: [0, 35, 0],
            cubes: [
              { id: 'eyeVR', o: [-2.5, 39.5, 2.5], s: [2, 1, 1], emissive: 0.6 },
              { id: 'eyeVL', o: [0.5, 39.5, 2.5], s: [2, 1, 1], emissive: 0.6, mirror: true, skinOf: 'eyeVR' },
            ],
          },
          { name: 'wisp3', pivot: [0, 46, -4], cubes: [{ id: 'wisp3', o: [-1, 45, -5], s: [2, 2, 2], translucent: true, skinOf: 'wisp1' }] },
        ],
      },
      vArm('R'), vArm('L'),
      { name: 'wisp1', pivot: [-4.5, 33, -1], cubes: [{ id: 'wisp1', o: [-5.5, 32, -2], s: [2, 2, 2], translucent: true }] },
      { name: 'wisp2', pivot: [4.5, 33, 0], cubes: [{ id: 'wisp2', o: [3.5, 32, -1], s: [2, 2, 2], translucent: true, skinOf: 'wisp1' }] },
    ],
  },
];

/** Fumaça escura com reflexos violeta. */
function smokeTex(g: Face, dark = false): void {
  g.noise(dark ? V_SMOKE_D : V_SMOKE, 0.14);
  const n = Math.max(1, Math.floor(g.w * g.h / 18));
  for (let i = 0; i < n; i++) {
    const x = Math.floor(g.r() * g.w), y = Math.floor(g.r() * g.h), len = 1 + Math.floor(g.r() * 3);
    const c = g.r() < 0.7 ? V_VIOLET : V_SMOKE_L;
    for (let k = 0; k < len; k++) g.px(x + k, y - k, c); // redemoinhos diagonais
  }
  for (let i = 0; i < n / 4; i++) g.px(g.r() * g.w, g.r() * g.h, V_VIOLET_L);
}

function paintVulto(sk: SkinPainter): void {
  sk.cube('legR', (g, f) => {
    smokeTex(g);
    if (f === 'bottom') { g.fill(V_SMOKE_D); return; }
    // pés se desfazendo em fumaça
    for (let x = 0; x < g.w; x++) for (let y = g.h - 7; y < g.h; y++) if (g.r() < (y - (g.h - 8)) / 12) g.px(x, y, g.r() < 0.5 ? V_SMOKE_L : [0, 0, 0, 0]);
  });
  sk.cube('body', (g, f) => { smokeTex(g); if (f === 'front') for (let y = 3; y < g.h - 3; y += 5) { const x = 1 + Math.floor(g.r() * 4); g.line(x, y, x + 3 + g.r() * 4, y + 1, V_VIOLET); } });
  sk.cube('waist', (g) => smokeTex(g, true));
  sk.cube('hips', (g) => smokeTex(g, true));
  sk.cube('neck', (g) => smokeTex(g, true));
  sk.cube('skirt', (g) => {
    smokeTex(g);
    // barra esfarrapada
    for (let x = 0; x < g.w; x++) { const k = Math.floor(g.r() * 9) + (x % 3 === 0 ? 3 : 0); g.clear(x, g.h - k, 1, k); }
    for (let i = 0; i < 3; i++) g.clear(Math.floor(g.r() * g.w), Math.floor(g.h * 0.4 + g.r() * g.h * 0.4), 1, 2);
  });
  sk.cube('head', (g, f) => {
    smokeTex(g);
    if (f === 'front') { g.noise(V_SMOKE, 0.06); g.rect(0, 4, g.w, 4, V_SMOKE_L); g.rect(1, 5, 4, 2, V_VIOLET); g.rect(g.w - 5, 5, 4, 2, V_VIOLET); }
    if (f === 'bottom') { g.noise(0x241836, 0.1); g.rect(2, 2, g.w - 4, g.h - 5, 0x160f22); }
  });
  for (const id of ['crest', 'crest2', 'crest3']) sk.cube(id, (g, f) => {
    smokeTex(g);
    if (f !== 'top' && f !== 'bottom') { g.clear(0, 0, 1, 1); g.clear(g.w - 1, 0, 1, 1); for (let x = 0; x < g.w; x += 2) g.px(x, 0, V_SMOKE_L); }
  });
  sk.cube('jaw', (g, f) => { smokeTex(g, f === 'bottom'); if (f === 'top') { g.noise(0x241836, 0.1); g.rect(2, 1, g.w - 4, g.h - 3, 0x120c1c); } });
  sk.face('maw', 'top', (g) => {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const d = Math.hypot((x + 0.5 - g.w / 2) / (g.w / 2), (y + 0.5 - g.h * 0.55) / (g.h * 0.55));
      if (d < 1) g.px(x, y, d < 0.45 ? 0xb88cf0 : d < 0.75 ? 0x7a52c0 : 0x3e2670);
    }
  });
  sk.cube('fangU1', (g) => g.vgrad(V_TOOTH, 0xa99fc0, 0.04));
  sk.cube('eyeVR', (g, f) => { g.fill(V_EYE); if (f === 'front') g.rect(1, 0, 2, 2, V_EYE_HI); });
  sk.cube('armR', (g) => smokeTex(g));
  sk.cube('shoulderR', (g, f) => { smokeTex(g); if (f === 'top') g.rect(1, 1, g.w - 2, g.h - 2, V_SMOKE_L); });
  sk.cube('foreR', (g) => smokeTex(g));
  sk.cube('palmR', (g) => smokeTex(g, true));
  sk.cube('clawR1', (g, f) => { if (f === 'bottom') { g.fill(V_CLAW); return; } g.vgrad(0x16121f, 0x2e2644, 0.05); g.rect(0, g.h - 2, g.w, 2, V_CLAW); g.px(0, g.h - 1, 0x9a8cc0); });
  sk.cube('wisp1', (g) => {
    g.fill([58, 48, 86, 105]);
    for (let i = 0; i < 3; i++) g.px(1 + g.r() * (g.w - 2), 1 + g.r() * (g.h - 2), [96, 80, 140, 90]);
    g.clear(0, 0, 1, 1); g.clear(g.w - 1, g.h - 1, 1, 1);
  });
}

const C_SWING = 0.6662;
export const VULTO: ModelDef = {
  id: 'vulto',
  parts: VULTO_PARTS,
  paint: (sk) => paintVulto(sk),
  animate(p, s) {
    const e = s.e as Vulto;
    head(p, s);
    if (e.carried) {
      // braços à frente segurando o bloco; só as pernas andam
      p.legR.rotation.x += Math.cos(s.swing * C_SWING) * 0.9 * s.amount;
      p.legL.rotation.x += Math.cos(s.swing * C_SWING + Math.PI) * 0.9 * s.amount;
      const bob = Math.sin(s.t * 0.08) * 0.03;
      for (const a of ['R', 'L']) { p[`arm${a}`].rotation.x += 0.3 + bob; p[`fore${a}`].rotation.x += -1.75; }
      p.armR.rotation.z += 0.04; p.armL.rotation.z -= 0.04;
      // o bloco fica nivelado
      p.carry.rotation.x = -(p.body.rotation.x + p.armR.rotation.x + p.foreR.rotation.x);
    } else {
      biped(p, s, { armAmp: 0.45, legAmp: 0.9 });
      const sw = Math.cos(s.swing * C_SWING - 0.7) * 0.3 * s.amount;
      p.foreR.rotation.x += -0.1 - sw; p.foreL.rotation.x += -0.1 + sw;
    }
    if (e.creepy) {
      // mandíbula escancarada tremendo, cabeça vibrando
      p.jaw.rotation.x += 0.55 + Math.sin(s.t * 2.7) * 0.08;
      p.head.position.x += Math.sin(s.t * 3.1) * 0.02;
      p.head.position.y += Math.cos(s.t * 3.7) * 0.015;
    } else p.maw.visible = false;
    puff(p, 'wisp1', s.t, 0.03, 0, 9, 1);
    puff(p, 'wisp2', s.t, 0.03, 0.5, 9, 1);
    puff(p, 'wisp3', s.t, 0.04, 0.25, 7, 0.6);
  },
};

// ================================================================== ESPREITADOR
// Fechado é um cubo de 16 px (casco de placas de pedra). Ao se revelar (unfold 0→1) sobe 3 px sobre seis patas,
// a tampa (maxilar de cima) levanta pela dobradiça de trás mostrando presas de ametista, as placas laterais se
// abrem, as de cima se arrepiam como escamas e dois olhinhos sobem em pedúnculos. Tudo que aparece fica escondido
// dentro do casco quando fechado.
const LEG_POS: [string, number, number][] = [['FR', -6, 5], ['MR', -6, 0], ['BR', -6, -5], ['FL', 6, 5], ['ML', 6, 0], ['BL', 6, -5]];

/** Presas de ametista: em cima apontam para baixo (escondidas na base), embaixo para cima (escondidas na tampa). */
function crystalTeeth(upper: boolean): CubeDef[] {
  const list: [number, number, number][] = upper
    ? [[-6, 6, 2], [-4, 6, 3], [-1.5, 6, 2], [0.5, 6, 2], [3, 6, 3], [5, 6, 2], [-6.5, 3, 2], [5.5, 3, 2]]
    : [[-5, 5.5, 2], [-2.5, 5.5, 2], [1.5, 5.5, 2], [4, 5.5, 2]];
  let first2 = '', first3 = '';
  return list.map(([x, z, h], i) => {
    const id = `${upper ? 'tU' : 'tD'}${i}`;
    let skin: Partial<CubeDef> = {};
    if (h === 2) { if (first2) skin = { skinOf: first2 }; else first2 = id; }
    else { if (first3) skin = { skinOf: first3 }; else first3 = id; }
    // as dos cantos (x ±6) ficam de lado, para aparecerem na boca vista de perfil
    return { id, o: [x, upper ? 7 - h : 7, z] as V3, s: [1, h, 1] as V3, emissive: 0.25, ...skin };
  });
}

const ESPREITADOR_PARTS: PartDef[] = [{
  name: 'body', pivot: [0, 0, 0],
  cubes: [{ id: 'base', o: [-8, 0, -8], s: [16, 7, 16] }],
  children: [
    ...LEG_POS.map(([n, x, z]): PartDef => ({
      name: `leg${n}`, pivot: [x, 3.5, z],
      cubes: [{ id: `leg${n}`, o: [x - 1.5, 0.5, z - 1.5], s: [3, 3, 3], ...(n === 'FR' ? {} : { skinOf: 'legFR' }) }],
    })),
    { name: 'teethD', pivot: [0, 7, 0], cubes: crystalTeeth(false) },
    { name: 'mawE', pivot: [0, 7, 0], cubes: [{ id: 'mawE', o: [-5.5, 7.1, -6], s: [11, 0, 11], emissive: 0.3, skip: ['bottom'] }] },
    {
      name: 'lid', pivot: [0, 7, -8],
      cubes: [{ id: 'lid', o: [-7, 7, -8], s: [14, 8, 16] }],
      children: [
        { name: 'plateR', pivot: [-8, 15, 0], cubes: [{ id: 'plateR', o: [-8, 7, -8], s: [1, 8, 16] }] },
        { name: 'plateL', pivot: [8, 15, 0], cubes: [{ id: 'plateL', o: [7, 7, -8], s: [1, 8, 16], mirror: true, skinOf: 'plateR' }] },
        { name: 'topA', pivot: [0, 15, 8], cubes: [{ id: 'topA', o: [-8, 15, 2], s: [16, 1, 6] }] },
        { name: 'topB', pivot: [0, 15, 2], cubes: [{ id: 'topB', o: [-8, 15, -3], s: [16, 1, 5] }] },
        { name: 'topC', pivot: [0, 15, -3], cubes: [{ id: 'topC', o: [-8, 15, -8], s: [16, 1, 5], skinOf: 'topB' }] },
        { name: 'teethU', pivot: [0, 7, 0], cubes: crystalTeeth(true) },
        ...(['R', 'L'] as const).map((sd): PartDef => {
          const x = sd === 'R' ? -5 : 5;
          return {
            name: `stalk${sd}`, pivot: [x, 11, 5],
            cubes: [{ id: `stalk${sd}`, o: [x - 0.5, 9, 4.5], s: [1, 4, 1], ...(sd === 'L' ? { skinOf: 'stalkR' } : {}) }],
            children: [{ name: `eye${sd}`, pivot: [x, 11, 5], cubes: [{ id: `eyeE${sd}`, o: [x - 1, 13, 4], s: [2, 2, 2], emissive: 0.55, ...(sd === 'L' ? { mirror: true, skinOf: 'eyeER' } : {}) }] }],
          };
        }),
      ],
    },
  ],
}];

const E_STONE = 0x8b8b87, E_STONE_D = 0x6b6b67, E_STONE_L = 0xa6a6a1, E_MOSS = 0x5a7934, E_MOSS_L = 0x7d9c47;
const E_IRON = 0xc79b72, E_FLESH = 0x3b3544, E_MOUTH = 0x221a2b, E_AME = 0x7d4fc0, E_AME_L = 0xb893f0, E_AME_D = 0x4a2d7c;

/** Pedra do casco: ruído, pintas, rachadinhas, minério raro; `seam` escurece a borda (junta entre placas). */
function stoneTex(g: Face, seam = true): void {
  g.noise(E_STONE, 0.07);
  g.spots(E_STONE_D, Math.max(1, Math.floor(g.w * g.h / 90)), 0.6, 1.3);
  for (let i = 0; i < g.w * g.h / 40; i++) g.px(g.r() * g.w, g.r() * g.h, g.r() < 0.5 ? E_STONE_L : E_STONE_D);
  if (g.r() < 0.5) { const x = g.r() * g.w, y = g.r() * g.h; g.line(x, y, x + 2 + g.r() * 3, y + 1 + g.r() * 2, E_STONE_D); }
  if (g.w * g.h > 60 && g.r() < 0.35) { const x = 1 + g.r() * (g.w - 3), y = 1 + g.r() * (g.h - 3); g.px(x, y, E_IRON); g.px(x + 1, y + 1, 0x9d6c48); }
  if (seam) g.rim(0.9, 1);
}
/** Carne de rocha escura com drusas de ametista (aparece quando as placas se abrem). */
function fleshTex(g: Face): void {
  g.noise(E_FLESH, 0.1);
  const n = Math.max(1, Math.floor(g.w * g.h / 45));
  for (let i = 0; i < n; i++) {
    const x = Math.floor(g.r() * (g.w - 2)), y = Math.floor(g.r() * (g.h - 2));
    g.px(x, y + 1, E_AME_D); g.px(x + 1, y, E_AME); g.px(x + 1, y + 1, E_AME_L); g.px(x + 2, y + 1, E_AME_D);
  }
}
function mossTop(g: Face, amount: number): void {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.r() < amount) g.px(x, y, g.r() < 0.6 ? E_MOSS : E_MOSS_L);
}

function paintEspreitador(sk: SkinPainter): void {
  sk.cube('base', (g, f) => {
    if (f === 'top') { g.noise(E_MOUTH, 0.1); g.rim(0.7, 2); return; }
    stoneTex(g, false);
    if (f !== 'bottom') for (let x = 0; x < g.w; x++) if (g.r() < 0.55) g.px(x, 0, E_STONE_D);
  });
  sk.cube('lid', (g, f) => {
    if (f === 'front' || f === 'back') { stoneTex(g, false); return; }
    if (f === 'bottom') { g.noise(E_MOUTH, 0.1); for (let y = 2; y < g.h; y += 4) g.line(2, y, g.w - 3, y, 0x2e2438); return; }
    fleshTex(g);
  });
  sk.cube('plateR', (g, f) => { if (f === 'left') { g.noise(0x55525a, 0.08); return; } stoneTex(g, f === 'right'); if (f === 'right') mossTop(g, 0.04); });
  for (const id of ['topA', 'topB']) sk.cube(id, (g, f) => {
    if (f === 'bottom') { g.noise(0x4a4552, 0.08); return; }
    stoneTex(g, f === 'top');
    if (f === 'top') { mossTop(g, 0.1); g.spots(E_MOSS, 2, 1, 2.2); }
    if (f === 'left' || f === 'right' || f === 'front' || f === 'back') for (let x = 0; x < g.w; x++) if (g.r() < 0.25) g.px(x, 0, E_MOSS_L);
  });
  sk.face('mawE', 'top', (g) => {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const d = Math.hypot((x + 0.5 - g.w / 2) / (g.w / 2), (y + 0.5 - g.h / 2) / (g.h / 2));
      if (d < 1) g.px(x, y, d < 0.35 ? 0x8d5fd4 : d < 0.7 ? 0x5a3a91 : 0x31224a);
    }
    for (let i = 0; i < 10; i++) g.px(2 + g.r() * (g.w - 4), 2 + g.r() * (g.h - 4), E_AME_L);
  });
  for (const id of ['tU0', 'tU1', 'tD0']) sk.cube(id, (g, f) => {
    const up = id.startsWith('tU');
    g.vgrad(up ? E_AME_D : E_AME_L, up ? E_AME_L : E_AME_D, 0.04);
    if (f === 'front' || f === 'right') g.rect(0, 0, 1, g.h, E_AME_L);
    const tip = up ? g.h - 1 : 0;
    if (f === 'front') g.clear(1, tip, 1, 1); else if (f === 'back') g.clear(0, tip, 1, 1); else if (f === 'left') g.clear(0, tip, 2, 1);
    else if ((f === 'bottom' && up) || (f === 'top' && !up)) g.clear(1, 0, 1, 2);
  });
  sk.cube('legFR', (g, f) => {
    g.noise(0x5d5c5a, 0.1); g.spots(0x4a4947, 2, 0.6, 1.2);
    if (f === 'bottom') g.fill(0x3a3937);
    else if (f !== 'top') { g.rect(0, g.h - 2, g.w, 2, 0x444341); if (f === 'front') { g.px(0, g.h - 1, 0xb9b3a8); g.px(2, g.h - 1, 0xb9b3a8); g.px(4, g.h - 1, 0xb9b3a8); } }
  });
  sk.cube('stalkR', (g) => g.noise(0x5e5b62, 0.1));
  sk.cube('eyeER', (g, f) => {
    g.fill(0xb87a1c);
    if (f === 'top' || f === 'bottom') { g.fill(0x7a4c12); return; }
    g.rect(1, 1, 2, 2, 0x160c04); g.px(1, 1, 0xf0d8a0); g.rim(0.75, 1);
  });
}

export const ESPREITADOR: ModelDef = {
  id: 'espreitador',
  parts: ESPREITADOR_PARTS,
  paint: (sk) => paintEspreitador(sk),
  animate(p, s) {
    const e = s.e as Espreitador;
    const u = clamp01(e.prevUnfold + (e.unfold - e.prevUnfold) * s.alpha);
    const lift = smooth(u / 0.55), open = smooth((u - 0.2) / 0.8);
    const walk = Math.cos(s.swing * C_SWING * 1.4) * s.amount;
    p.body.position.y += (3 * lift + Math.abs(walk) * 0.4 * lift) / 16;
    for (const [n] of LEG_POS) {
      const leg = p[`leg${n}`];
      leg.visible = lift > 0.01;
      leg.position.y -= (3.5 * lift) / 16;
      leg.rotation.z += (n.endsWith('L') ? 0.35 : -0.35) * lift;
      // trípode: FL, MR, BL juntas; FR, ML, BR em contrafase
      leg.rotation.x += (n === 'FL' || n === 'MR' || n === 'BL' ? walk : -walk) * 0.7;
    }
    const chomp = s.attack > 0 ? Math.sin(s.attack * Math.PI) : 0;
    const lidA = (0.34 + Math.sin(s.t * 0.12) * 0.05) * open + chomp * 0.45;
    p.lid.rotation.x -= lidA;
    p.plateL.rotation.z += 0.18 * open; p.plateR.rotation.z -= 0.18 * open;
    const fl = Math.sin(s.t * 0.2) * 0.04 * open;
    p.topA.rotation.x += 0.1 * open + fl; p.topB.rotation.x += 0.16 * open - fl; p.topC.rotation.x += 0.22 * open + fl;
    show(p, ['teethU', 'teethD', 'mawE', 'stalkR', 'stalkL'], open > 0.01);
    for (const st of ['stalkR', 'stalkL']) {
      p[st].position.y += (3.5 * open) / 16;
      p[st].rotation.y += -s.headYaw * DEG * 0.8;
      p[st].rotation.x += lidA + s.headPitch * DEG * 0.5 + Math.sin(s.t * 0.15 + (st === 'stalkR' ? 0 : 1.5)) * 0.1;
    }
  },
};

export const SPECS_SOMBRAS: Record<string, MobModelSpec> = {
  assombro: { def: ASSOMBRO },
  vulto: { def: VULTO, carryBlock: (e) => (e as Vulto).carried },
  espreitador: { def: ESPREITADOR, disguise: (e) => ((e as Espreitador).disguised ? (e as Espreitador).mimic : 0) },
};
