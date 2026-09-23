/**
 * Criaturas do Ínfero:
 *  - fagulha: espírito de brasa flutuante — cabeça de obsidiana rachada com um núcleo de magma que aparece pelas
 *    frestas (olhos, boca e rachaduras são furos na pele), onze bastões de carvão em brasa girando em dois anéis
 *    e um corpo de fumaça;
 *  - brasal: gigante flutuante, um sino/lanterna de cinza clara com rosto triste de olhos fechados e nove
 *    tentáculos; ao atacar abre os olhos e a boca, mostrando o interior incandescente.
 */
import type { ModelDef, PartDef, V3 } from '../boxmodel';
import { head } from '../anim';
import type { Face, SkinPainter } from '../skin';
import type { MobModelSpec } from '../../mobvisual';
import type { Fagulha, Brasal } from '../../../../game/entity/species/infero';
import { setGlow } from './sombras';

// ================================================================== FAGULHA
const RODS: [number, number, number, number, number][] = [
  // [anel, quantidade, raio, base y, altura]
  [1, 6, 6.5, 12.5, 6],
  [2, 5, 5, 4.5, 5],
];
const rodAngle = (ring: number, i: number, n: number): number => (i / n) * Math.PI * 2 + (ring === 2 ? Math.PI / n : 0);

function rodParts(ring: number): PartDef[] {
  const [, n, r, y0, h] = RODS[ring - 1];
  return Array.from({ length: n }, (_, i): PartDef => {
    const a = rodAngle(ring, i, n);
    const cx = Math.round(Math.cos(a) * r * 2) / 2, cz = Math.round(Math.sin(a) * r * 2) / 2;
    const id = `rod${ring}_${i}`;
    return {
      name: id, pivot: [cx, y0 + h / 2, cz],
      cubes: [{ id, o: [cx - 1, y0, cz - 1], s: [2, h, 2], emissive: 0.4, ...(i > 1 ? { skinOf: `rod${ring}_${i % 2}` } : {}) }],
    };
  });
}

const FAGULHA_PARTS: PartDef[] = [
  {
    name: 'head', pivot: [0, 20, 0],
    cubes: [{ o: [-4, 20, -4], s: [8, 8, 8] }],
    // núcleo de magma meio pixel para dentro: aparece pelos furos da obsidiana
    children: [
      { name: 'core', pivot: [0, 20, 0], cubes: [{ id: 'core', o: [-3.5, 20.5, -3.5], s: [7, 7, 7], emissive: 0.61 }] },
      { name: 'flame1', pivot: [0.5, 28, 0.5], cubes: [{ id: 'flame1', o: [-0.5, 27, -0.5], s: [2, 3, 2], emissive: 0.7 }] },
      { name: 'flame2', pivot: [-2, 28, -1.5], cubes: [{ id: 'flame2', o: [-2.5, 27.5, -2], s: [1, 2, 1], emissive: 0.7 }] },
      { name: 'flame3', pivot: [2.5, 28, -2], cubes: [{ id: 'flame3', o: [2, 27.5, -2.5], s: [1, 2, 1], emissive: 0.7, skinOf: 'flame2' }] },
    ],
  },
  { name: 'ring1', pivot: [0, 15.5, 0], cubes: [], children: rodParts(1) },
  { name: 'ring2', pivot: [0, 7, 0], cubes: [], children: rodParts(2) },
  {
    // núcleo opaco de fumaça densa dentro de uma casca translúcida (névoa nas bordas)
    name: 'smoke', pivot: [0, 19, 0],
    cubes: [{ id: 'smoke1', o: [-3, 12, -3], s: [6, 8, 6], translucent: true }, { id: 'smokeCore1', o: [-2, 12.5, -2], s: [4, 7, 4] }],
    children: [{
      name: 'smoke2', pivot: [0, 12, 0],
      cubes: [{ id: 'smoke2', o: [-2, 5, -2], s: [4, 7, 4], translucent: true }, { id: 'smokeCore2', o: [-1, 5.5, -1], s: [2, 6, 2] }],
      children: [{ name: 'smoke3', pivot: [0, 5, 0], cubes: [{ id: 'smoke3', o: [-1, 0, -1], s: [2, 5, 2], translucent: true }] }],
    }],
  },
];

const OBSIDIAN = 0x17121a, OBS_L = 0x33283d, OBS_M = 0x211a27;
const MAGMA = 0xc8641a, MAGMA_L = 0xe89a3a, MAGMA_D = 0x9a3410;

/** Rachadura: caminho em zigue-zague de furos (mostra o núcleo). */
function crack(g: Face, x: number, y: number, dx: number, dy: number, len: number): void {
  for (let i = 0; i < len; i++) {
    g.clear(x, y);
    if (g.r() < 0.5) x += dx; else y += dy;
    if (g.r() < 0.25) { x += g.r() < 0.5 ? 1 : -1; }
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  }
}

function paintFagulha(sk: SkinPainter): void {
  sk.cube('head', (g, f) => {
    g.noise(OBSIDIAN, 0.12);
    // brilho vítreo da obsidiana
    for (let i = 0; i < 5; i++) { const x = g.r() * (g.w - 3), y = g.r() * (g.h - 3); g.line(x, y + 2, x + 2, y, OBS_L); }
    g.spots(OBS_M, 3, 1, 2);
    if (f === 'front') {
      // olhos em fenda, bravos (canto de dentro mais baixo), e boca em zigue-zague — tudo furo
      g.clear(3, 6, 2, 1); g.clear(3, 7, 4, 1); g.clear(4, 8, 3, 1);
      g.clear(11, 6, 2, 1); g.clear(9, 7, 4, 1); g.clear(9, 8, 3, 1);
      g.px(2, 5, OBS_L); g.px(13, 5, OBS_L);
      for (let x = 5; x <= 10; x++) g.clear(x, 11 + ((x & 1) ? 1 : 0));
      g.clear(6, 12); g.clear(9, 12);
      crack(g, 0, 2, 1, 1, 5); crack(g, 15, 13, -1, 1, 4);
    } else if (f === 'top') {
      crack(g, 8, 8, 1, 1, 7); crack(g, 7, 7, -1, -1, 7); crack(g, 8, 7, 1, -1, 5); crack(g, 7, 8, -1, 1, 5);
    } else if (f === 'bottom') {
      g.clear(5, 5, 6, 6); // a fumaça sai pela base
    } else {
      crack(g, Math.floor(g.r() * 8) + 4, 0, 1, 1, 9); crack(g, 0, Math.floor(g.r() * 6) + 8, 1, -1, 6);
    }
  });
  sk.cube('core', (g) => {
    g.noise(MAGMA, 0.1);
    g.spots(MAGMA_L, 4, 1, 2.5);
    g.spots(MAGMA_D, 3, 0.8, 1.6);
    for (let i = 0; i < 6; i++) g.px(g.r() * g.w, g.r() * g.h, 0xf2c060);
  });
  for (const id of ['rod1_0', 'rod1_1', 'rod2_0', 'rod2_1']) sk.cube(id, (g, f) => {
    // carvão preto-acinzentado com fendas de brasa e pontas incandescentes
    g.noise(0x191615, 0.18);
    for (let i = 0; i < g.w * g.h / 8; i++) g.px(g.r() * g.w, g.r() * g.h, 0x2c2826);
    if (f === 'top' || f === 'bottom') { g.fill(0xa8440f); g.px(1, 1, 0xd8822a); g.px(2, 2, 0xd8822a); return; }
    for (let y = 2; y < g.h - 1; y += 4 + Math.floor(g.r() * 3)) { const x = Math.floor(g.r() * 2); g.line(x, y, x + 1 + Math.floor(g.r() * 2), y + 1, 0x8a3410); }
    g.px(g.r() * g.w, g.r() * g.h, 0xc8601a);
    g.rect(0, 0, g.w, 1, 0x9a3c10);
  });
  sk.cube('flame1', (g) => { g.vgrad(0xe0b040, 0xc0501a, 0.08); g.clear(0, 0, 1, 1); g.clear(g.w - 1, 0, 1, 2); });
  sk.cube('flame2', (g) => { g.vgrad(0xd89a38, 0xb8481a, 0.08); g.clear(1, 0, 1, 1); });
  const smoke = (g: Face, a: number) => {
    g.fill([30, 25, 25, a]);
    for (let i = 0; i < g.w * g.h / 5; i++) g.px(g.r() * g.w, g.r() * g.h, [62, 52, 48, a]);
    for (let i = 0; i < g.w * g.h / 12; i++) g.px(g.r() * g.w, g.r() * g.h, [90, 70, 58, a]);
    for (let i = 0; i < g.w * g.h / 40; i++) g.px(g.r() * g.w, g.r() * g.h, [236, 128, 48, 255]); // fagulhas
  };
  const core = (g: Face) => { g.noise(0x2a2322, 0.14); for (let i = 0; i < g.w * g.h / 10; i++) g.px(g.r() * g.w, g.r() * g.h, g.r() < 0.8 ? 0x4a3e38 : 0xd8701e); };
  sk.cube('smokeCore1', core); sk.cube('smokeCore2', core);
  sk.cube('smoke1', (g) => smoke(g, 175));
  sk.cube('smoke2', (g) => smoke(g, 150));
  sk.cube('smoke3', (g) => { smoke(g, 130); g.clear(0, g.h - 1, 1, 1); g.clear(g.w - 1, g.h - 2, 1, 2); });
}

export const FAGULHA: ModelDef = {
  id: 'fagulha',
  parts: FAGULHA_PARTS,
  paint: (sk) => paintFagulha(sk),
  animate(p, s) {
    const e = s.e as Fagulha;
    head(p, s);
    const spin = (e.spin ?? 0) + s.alpha * 0.15;
    const ch = !!e.charged;
    p.ring1.rotation.y += spin;
    p.ring2.rotation.y -= spin * 1.3;
    p.ring1.rotation.x += Math.sin(s.t * 0.07) * 0.06; p.ring1.rotation.z += Math.cos(s.t * 0.05) * 0.06;
    p.ring2.rotation.x += Math.cos(s.t * 0.06) * 0.07;
    // carregada: os bastões se abrem e inclinam para fora como labaredas
    const k = ch ? 1.3 : 1;
    for (const [ring, n, , , ] of RODS) {
      const tilt = ch ? 0.32 : 0.06;
      for (let i = 0; i < n; i++) {
        const r = p[`rod${ring}_${i}`], a = rodAngle(ring, i, n);
        r.position.x *= k; r.position.z *= k;
        r.position.y += Math.sin(s.t * 0.2 + i * 1.7 + ring) * 0.035;
        r.rotation.x += tilt * Math.sin(a);
        r.rotation.z += -tilt * Math.cos(a);
      }
    }
    // fumaça ondulando
    p.smoke.rotation.y += s.t * 0.05;
    p.smoke2.rotation.y -= s.t * 0.09;
    p.smoke2.rotation.z += Math.sin(s.t * 0.1) * 0.08;
    p.smoke3.rotation.z += Math.sin(s.t * 0.1 - 1) * 0.18;
    p.smoke3.rotation.x += Math.cos(s.t * 0.08) * 0.12;
    // chaminhas tremulando
    for (const [n, o] of [['flame1', 0], ['flame2', 2.1], ['flame3', 4.2]] as const) {
      const k = 0.75 + 0.35 * Math.abs(Math.sin(s.t * 0.45 + o)) + (ch ? 0.3 : 0);
      p[n].scale.set(1, k, 1);
      p[n].rotation.z += Math.sin(s.t * 0.3 + o) * 0.12;
    }
  },
};

// ================================================================== BRASAL
// Modelado em ~16 px e ampliado 4,2× (densidade 4 texels/px para não ficar grosseiro de perto).
// Sino/lanterna: base 15×8×15, meio 13×2×13, topo 9×1×9; franja recortada na borda; oito tentáculos em anel e um
// central, cada um com três gomos (o último é uma brasa). O interior incandescente só aparece pelos furos do rosto
// aberto (quando charge > 10 a camada do rosto fechado some).
const TENT: V3[] = [
  ...Array.from({ length: 8 }, (_, i): V3 => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return [Math.round(Math.cos(a) * 5 * 2) / 2, 0, Math.round(Math.sin(a) * 5 * 2) / 2];
  }),
  [0, 1, 0], // central, mais comprido
];

function tentacleParts(): PartDef[] {
  return TENT.map(([x, long, z], i): PartDef => {
    const lo = long ? 4 : 3;
    return {
      name: `t${i}`, pivot: [x, 5, z],
      cubes: [{ id: `t${i}`, o: [x - 1, 3, z - 1], s: [2, 2, 2], ...(i ? { skinOf: 't0' } : {}) }],
      children: [{
        name: `t${i}b`, pivot: [x, 3, z],
        cubes: [{ id: `t${i}b`, o: [x - 0.5, 3 - lo, z - 0.5], s: [1, lo, 1], ...(i && !long ? { skinOf: 't0b' } : {}) }],
        children: [{ name: `t${i}c`, pivot: [x, 3 - lo, z], cubes: [{ id: `t${i}c`, o: [x - 0.5, 1 - lo, z - 0.5], s: [1, 2, 1], emissive: 0.5, ...(i ? { skinOf: 't0c' } : {}) }] }],
      }],
    };
  });
}

const BRASAL_PARTS: PartDef[] = [{
  name: 'bell', pivot: [0, 10, 0],
  cubes: [
    { id: 'bellBase', o: [-7.5, 5, -7.5], s: [15, 8, 15] },
    { id: 'bellMid', o: [-6.5, 13, -6.5], s: [13, 2, 13] },
    { id: 'bellTop', o: [-4.5, 15, -4.5], s: [9, 1, 9] },
    { id: 'frillF', o: [-7.5, 4, 7.5], s: [15, 1, 0] },
    { id: 'frillB', o: [-7.5, 4, -7.5], s: [15, 1, 0], skinOf: 'frillF' },
    { id: 'frillR', o: [-7.5, 4, -7.5], s: [0, 1, 15] },
    { id: 'frillL', o: [7.5, 4, -7.5], s: [0, 1, 15], skinOf: 'frillR' },
  ],
  children: [
    { name: 'inner', pivot: [0, 10, 0], cubes: [{ id: 'inner', o: [-6.5, 5.5, -6.5], s: [13, 7, 13], emissive: 0.82 }] },
    // rosto fechado: uma camada logo à frente do rosto aberto (que tem furos); some quando o brasal ataca
    { name: 'faceShut', pivot: [0, 10, 0], cubes: [{ id: 'faceShut', o: [-7.5, 5, 7.6], s: [15, 8, 0], skip: ['back'] }] },
    ...tentacleParts(),
  ],
}];

const ASH = 0xc9c2b6, ASH_D = 0x9e968a, ASH_L = 0xe0dbd2, SOOT = 0x57514a, SOOT_D = 0x37332f, EMBER = 0xe8802f;

/** Cinza clara com fuligem e costelas verticais de lanterna. */
function ashTex(g: Face, ribs: boolean): void {
  g.noise(ASH, 0.05);
  g.spots(ASH_D, Math.max(1, Math.floor(g.w * g.h / 260)), 1, 3);
  for (let i = 0; i < g.w * g.h / 30; i++) g.px(g.r() * g.w, g.r() * g.h, g.r() < 0.5 ? ASH_L : ASH_D);
  if (ribs) for (let x = 3; x < g.w; x += 10) for (let y = 0; y < g.h; y++) { g.px(x, y, ASH_D); g.px(x + 1, y, ASH_L); }
}

/** Rosto no bloco da base (60×32 texels): triste de olhos fechados, ou aberto (olhos e boca furados). */
function brasalFace(g: Face, open: boolean): void {
  ashTex(g, false);
  const eyes: [number, number][] = [[17, 14], [43, 14]];
  // sobrancelhas tristes: a ponta de dentro mais alta
  for (const [ex, ey] of eyes) {
    const inner = ex < 30 ? 1 : -1;
    for (let k = 0; k < 2; k++) g.line(ex - inner * 7, ey - 5 + k, ex + inner * 5, ey - 9 + k, SOOT);
  }
  // trilhas de lágrimas de fuligem com uma gota de brasa
  for (const [ex, ey] of eyes) {
    const tx = ex + (ex < 30 ? -4 : 4);
    for (let y = ey + 2; y < g.h - 3; y++) { g.px(tx, y, SOOT); if (y % 3) g.px(tx + (ex < 30 ? -1 : 1), y, 0x8a8278); }
    g.rect(tx - 1, g.h - 4, 3, 2, EMBER); g.px(tx, g.h - 2, 0xffc070);
  }
  if (!open) {
    // olhos fechados caídos, com cílios
    for (const [ex, ey] of eyes) {
      const d = ex < 30 ? 1 : -1;
      for (let x = -6; x <= 6; x++) { const y = ey + 2 - Math.round((x * x) / 18) + (x * d < -3 ? 1 : 0); g.px(ex + x, y, SOOT_D); g.px(ex + x, y + 1, SOOT_D); }
      for (const lx of [-4, 0, 4]) { const y = ey + 4 - Math.round((lx * lx) / 18); g.px(ex + lx, y, SOOT); g.px(ex + lx + (lx < 0 ? -1 : lx > 0 ? 1 : 0), y + 1, SOOT); }
    }
    // boquinha triste
    for (let x = -5; x <= 5; x++) { const y = 26 - Math.round(3 - (x * x) / 9); g.px(30 + x, y, SOOT_D); g.px(30 + x, y + 1, SOOT_D); }
    return;
  }
  // aberto: furos (o interior incandescente aparece) com borda chamuscada
  const hole = (cx: number, cy: number, rx: number, ry: number) => {
    g.ellipse(cx, cy, rx + 1.5, ry + 1.5, SOOT_D);
    g.ellipse(cx, cy, rx + 0.6, ry + 0.6, 0x2a2420);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g.clear(x, y);
    }
  };
  for (const [ex, ey] of eyes) hole(ex, ey + 1, 4.5, 3.2);
  // boca de choro: arco (mais alta no meio); a parte de cima do vão é sombra, o fogo aparece embaixo, no fundo
  for (let x = -10; x <= 10; x++) {
    const top = 20 + Math.round((x * x) / 14);
    for (let y = top - 2; y <= 29; y++) {
      if (Math.abs(x) <= 9 && y >= top && y <= 27) {
        if (y < top + 2 && y < 25) g.px(30 + x, y, y === top ? 0x1e1512 : 0x3a1a0e); else g.clear(30 + x, y);
      } else if (Math.abs(x) <= 10) g.px(30 + x, y, y < top - 1 || y > 28 || Math.abs(x) === 10 ? SOOT : SOOT_D);
    }
  }
}

function paintBrasal(sk: SkinPainter): void {
  sk.face('faceShut', 'front', (g) => brasalFace(g, false));
  sk.cube('bellBase', (g, f) => {
    if (f === 'front') { brasalFace(g, true); return; }
    if (f === 'bottom') {
      // barriga do sino: cinza mais escura com raios
      g.noise(0x8e877c, 0.06);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.line(g.w / 2, g.h / 2, g.w / 2 + Math.cos(a) * g.w / 2, g.h / 2 + Math.sin(a) * g.h / 2, 0x6f685e); }
      g.ellipse(g.w / 2, g.h / 2, 6, 6, SOOT); g.ellipse(g.w / 2, g.h / 2, 3, 3, 0x7a3a18);
      return;
    }
    if (f === 'top') { g.noise(ASH_D, 0.05); return; }
    ashTex(g, true);
    // fuligem subindo da borda de baixo e rachaduras com brilho de brasa
    for (let x = 0; x < g.w; x++) for (let y = g.h - 6; y < g.h; y++) if (g.r() < (y - (g.h - 7)) / 8) g.px(x, y, g.r() < 0.5 ? ASH_D : SOOT);
    for (let i = 0; i < 2; i++) { let x = 4 + g.r() * (g.w - 8), y = g.h - 2; for (let k = 0; k < 8; k++) { g.px(x, y, k < 2 ? EMBER : SOOT_D); x += g.r() < 0.5 ? 1 : -1; y -= 1; } }
  });
  sk.cube('bellMid', (g, f) => { if (f === 'bottom') g.noise(ASH_D, 0.05); else ashTex(g, f !== 'top'); });
  sk.cube('bellTop', (g, f) => {
    ashTex(g, false);
    if (f === 'top') { g.ellipse(g.w / 2, g.h / 2, g.w / 2 - 3, g.h / 2 - 3, ASH_D); g.ellipse(g.w / 2, g.h / 2, 4, 4, SOOT); g.ellipse(g.w / 2, g.h / 2, 2, 2, 0x8a3c16); }
  });
  // franja: bordas recortadas em gomos
  for (const id of ['frillF', 'frillR']) for (const f of ['front', 'back', 'left', 'right'] as const) {
    if ((id === 'frillF') !== (f === 'front' || f === 'back')) continue;
    sk.face(id, f, (g) => {
      g.noise(ASH_D, 0.06);
      for (let x = 0; x < g.w; x++) { const k = x % 6; const cut = k === 0 || k === 5 ? 3 : k === 1 || k === 4 ? 1 : 0; if (cut) g.clear(x, g.h - cut, 1, cut); }
    });
  }
  sk.cube('inner', (g) => {
    g.vgrad(0x9a3410, 0xd88a2a, 0.1);
    g.spots(0xe8a640, 5, 2, 5);
    for (let i = 0; i < 20; i++) g.px(g.r() * g.w, g.r() * g.h, 0xf0c060);
  });
  sk.cube('t0', (g, f) => { g.noise(ASH, 0.06); if (f !== 'top' && f !== 'bottom') { g.rect(0, g.h - 3, g.w, 3, ASH_D); g.rect(0, 3, g.w, 1, ASH_D); } });
  for (const id of ['t0b', 't8b']) sk.cube(id, (g, f) => { g.vgrad(ASH, SOOT, 0.06); if (f === 'top') g.fill(ASH_D); for (let y = 3; y < g.h; y += 5) g.rect(0, y, g.w, 1, ASH_D); });
  sk.cube('t0c', (g) => { g.vgrad(0x7a3010, 0xc0601a, 0.1); g.px(1, g.h - 2, 0xe0902a); g.px(2, g.h - 1, 0xe0a040); });
}

export const BRASAL: ModelDef = {
  id: 'brasal',
  parts: BRASAL_PARTS,
  density: 4,
  scale: 4.2,
  paint: paintBrasal,
  animate(p, s) {
    const e = s.e as Brasal;
    const ph = (e.tentacle ?? 0) + s.alpha * 0.1;
    // o sino pulsa como água-viva; carregando, contrai
    const c = e.charge > 0 ? Math.min(1, e.charge / 20) : 0;
    const pulse = Math.sin(s.t * 0.08) * 0.018 - c * 0.03;
    p.bell.scale.set(1 + pulse, 1 - pulse * 0.8, 1 + pulse);
    for (let i = 0; i < TENT.length; i++) {
      const a = p[`t${i}`], b = p[`t${i}b`], tip = p[`t${i}c`];
      a.rotation.x += Math.sin(ph + i * 0.9) * 0.16 + 0.04;
      a.rotation.z += Math.cos(ph * 0.8 + i * 1.3) * 0.12;
      b.rotation.x += Math.sin(ph + i * 0.9 - 0.9) * 0.3;
      b.rotation.z += Math.cos(ph * 0.8 + i * 1.3 - 0.9) * 0.2;
      tip.rotation.x += Math.sin(ph + i * 0.9 - 1.8) * 0.3;
    }
  },
};

export const SPECS_SOMBRAS2: Record<string, MobModelSpec> = {
  fagulha: {
    def: FAGULHA,
    pose(inst, e, s) {
      const f = e as Fagulha;
      // flutua subindo e descendo; carregada, o núcleo e as brasas brilham mais
      inst.body.position.y += Math.sin(s.t * 0.1) * 0.07;
      setGlow(inst, 'core', f.charged ? 1.0 : 0.61);
      setGlow(inst, 'rod1_0', f.charged ? 0.75 : 0.4);
    },
  },
  brasal: {
    def: BRASAL,
    pose(inst, e, s) {
      inst.body.position.y += Math.sin(s.t * 0.05) * 0.12;
      const open = (e as Brasal).charge > 10;
      inst.parts.faceShut.visible = !open;
      inst.parts.inner.visible = open;
      setGlow(inst, 't0c', (e as Brasal).charge > 0 ? 0.9 : 0.5);
    },
  },
};
