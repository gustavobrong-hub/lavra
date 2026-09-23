/**
 * Monstros do Lavra (1/2):
 * - Ossudo: arqueiro esquelético de ossos finos, capuz de saco de estopa com as pontas espetadas, manto
 *   esfarrapado, órbitas fundas com brilho de fogo-fátuo e aljava de fibra de buriti com penas de arara.
 * - Tecelã: aranha de 8 patas articuladas (quadril → fêmur → tíbia), abdome com renda de bilro clara sobre
 *   marrom-violáceo e cacho de 8 olhos âmbar; a das cavernas tem metade do tamanho e renda turquesa.
 * - Gosma: cubo gelatinoso translúcido com núcleo escuro, olhos que piscam e bolhas presas dentro.
 */
import type { ModelDef, PartDef, CubeDef, V3 } from '../boxmodel';
import { DEG } from '../boxmodel';
import { head, biped } from '../anim';
import type { MobModelSpec } from '../../mobvisual';
import { lerpc, shade, type Col, type Face } from '../skin';
import { isSide, dim } from './monstros';
import type { Ossudo, Tecela, Gosma } from '../../../../game/entity/species/monsters';

// ------------------------------------------------------------------ utilitários
/** Estopa: trama de fios claros/escuros com fiapos e pintas de sujeira. */
export function burlap(g: Face, base: Col, k = 1): void {
  const b = shade(base, k);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    let t = (x + y) % 2 === 0 ? 1.08 : 0.94;
    if (y % 3 === 2) t *= 0.9;
    if (x % 4 === 1) t *= 1.04;
    t *= 1 + (g.r() * 2 - 1) * 0.06;
    g.px(x, y, [b[0] * t, b[1] * t, b[2] * t]);
  }
  for (let i = 0; i < Math.ceil((g.w * g.h) / 40); i++) g.px(g.r() * g.w, g.r() * g.h, shade(b, 0.7));
}

/** Barra esfarrapada: apaga texels ao acaso nas `n` últimas linhas (mais na última). */
export function ragged(g: Face, n = 2, p = 0.45): void {
  for (let j = 0; j < n; j++) {
    const y = g.h - 1 - j;
    for (let x = 0; x < g.w; x++) if (g.r() < p / (j + 1)) { g.clear(x, y); if (j === 0 && g.r() < 0.4) g.clear(x, y - 1); }
  }
}

/** Osso: marfim envelhecido, bordas um pouco mais escuras (volume de cilindro) e trincas. */
function bone(g: Face, c: Col = 0xdcd3bd): void {
  g.noise(c, 0.05);
  if (g.w >= 4) for (let y = 0; y < g.h; y++) { dim(g, 0, y, 0.88); dim(g, g.w - 1, y, 0.88); }
  if (g.r() < 0.5) { const x = Math.floor(g.r() * g.w), y = Math.floor(g.r() * g.h); g.px(x, y, 0x8f8570); g.px(x, y + 1, 0xa39a82); }
}

// ------------------------------------------------------------------ ossudo
const OS = {
  bone: 0xdcd3bd, boneS: 0xbdb196, boneD: 0x8f8570, socket: 0x110d0b, glow: 0x9ff0d0, sack: 0x9a7d52,
  rope: 0x5b4630, weave: 0xa88a4a, weaveD: 0x7d632e, leather: 0x4a3020, shaft: 0x9a7b4f,
};

const osArm = (side: -1 | 1): PartDef => {
  const R = side < 0, n = R ? 'R' : 'L', x = R ? -6 : 4;
  const m = (id: string, o: V3, s: V3, extra: Partial<CubeDef> = {}): CubeDef =>
    R ? { id: `os${id}R`, o, s, ...extra } : { id: `os${id}L`, o, s, ...extra, mirror: true, skinOf: `os${id}R` };
  return {
    name: `arm${n}`, pivot: [5 * side, 22, 0],
    cubes: [m('Arm', [x, 16, -1], [2, 6, 2]), m('Sleeve', [x, 18.5, -1], [2, 4, 2], { inflate: 0.7 })],
    children: [{
      name: `fore${n}`, pivot: [5 * side, 16, 0],
      cubes: [m('Fore', [x, 11, -1], [2, 5, 2]), m('Hand', [x - 0.5, 9, -1.5], [3, 2, 3])],
      // punho do arco: o ícone é diagonal; 45° no plano + 90° deixam o arco em pé no plano da mira (bojo para o alvo)
      children: R ? [{ name: 'bowHand', pivot: [-5, 10, 0], rot: [0, 45, 90], cubes: [] }] : [],
    }],
  };
};

const osLeg = (side: -1 | 1): PartDef => {
  const R = side < 0, n = R ? 'R' : 'L';
  const m = (id: string, o: V3, s: V3): CubeDef => (R ? { id: `os${id}R`, o, s } : { id: `os${id}L`, o, s, mirror: true, skinOf: `os${id}R` });
  return {
    name: `leg${n}`, pivot: [2 * side, 12, 0],
    cubes: [m('Leg', [R ? -3 : 1, 1, -1], [2, 11, 2]), m('Foot', [R ? -3.5 : 0.5, 0, -1.5], [3, 1, 4])],
  };
};

export const OSSUDO: ModelDef = {
  id: 'ossudo',
  parts: [
    {
      name: 'body', pivot: [0, 24, 0],
      cubes: [
        { id: 'osSpine', o: [-1, 12, -1], s: [2, 12, 2] },
        { id: 'osRibs', o: [-3.5, 16, -2], s: [7, 7, 4] },
        { id: 'osPelvis', o: [-3, 11, -1.5], s: [6, 2, 3] },
        { id: 'osBelt', o: [-3.5, 12, -2], s: [7, 1, 4] },
        { id: 'osFlapF', o: [-1, 8, 1.6], s: [2, 4, 0] },
        { id: 'osFlapB', o: [-1.5, 8, -1.6], s: [3, 4, 0] },
        { id: 'osMantle', o: [-4, 18, -2.5], s: [8, 6, 5], inflate: 0.5 },
      ],
      children: [{
        // aljava de buriti trançado, atravessada nas costas
        name: 'quiver', pivot: [0, 18, -4.5], rot: [0, 0, -18],
        cubes: [
          { id: 'osQuiver', o: [-1.5, 12, -6.3], s: [3, 10, 3] },
          { id: 'osArrowsA', o: [-1.5, 22, -4.8], s: [3, 4, 0] },
          { id: 'osArrowsB', o: [0, 22, -6.3], s: [0, 4, 3] },
        ],
      }],
    },
    {
      name: 'head', pivot: [0, 24, 0],
      cubes: [
        { id: 'osSkull', o: [-3.5, 26, -3.5], s: [7, 6, 7] },
        { id: 'osJaw', o: [-2.5, 24, -1], s: [5, 2, 4] },
        { id: 'osHood', o: [-3.5, 26, -3.5], s: [7, 6, 7], inflate: 0.6 },
        { id: 'osCowl', o: [-3.5, 24, -3.5], s: [7, 2, 7], inflate: 0.75 },
        { id: 'osEarR', o: [-5, 31, -1], s: [2, 2, 2] },
        { id: 'osEarL', o: [3, 31, -1], s: [2, 2, 2], mirror: true, skinOf: 'osEarR' },
      ],
      // fundo das órbitas: fica 1 px atrás dos furos da caveira e brilha fraco
      children: [{ name: 'eyes', pivot: [0, 24, 0], cubes: [{ id: 'osGlow', o: [-3, 27.5, 1.5], s: [6, 3, 1], emissive: 0.22 }] }],
    },
    osArm(-1), osArm(1), osLeg(-1), osLeg(1),
  ],
  paint(sk) {
    // coluna: vértebras separadas por discos escuros
    sk.cube('osSpine', (g) => { bone(g, OS.boneS); for (let y = 1; y < g.h; y += 3) for (let x = 0; x < g.w; x++) g.px(x, y, OS.boneD); });
    // caixa torácica vazada: costelas de 2 texels com vãos transparentes; esterno na frente, coluna atrás
    sk.cube('osRibs', (g, f) => {
      bone(g);
      if (f === 'top') return;
      if (f === 'bottom') { g.clear(1, 1, g.w - 2, g.h - 2); return; }
      const mid = g.w / 2;
      for (let y = 2; y < g.h; y += 3) for (let x = 0; x < g.w; x++) {
        const keep = (f === 'front' || f === 'back') && Math.abs(x + 0.5 - mid) < 1.2;
        if (!keep) g.clear(x, y);
      }
      for (let y = 1; y < g.h; y += 3) for (let x = 0; x < g.w; x++) dim(g, x, y, 0.84);
      if (f === 'front') for (let y = 0; y < g.h; y++) g.px(Math.floor(mid) - 1, y, OS.boneS);
    });
    sk.cube('osPelvis', (g, f) => { bone(g); if (f === 'front') for (const x of [2, 8]) g.rect(x, 1, 2, 2, 0x5d564a); });
    // corda de sisal torcida
    sk.cube('osBelt', (g) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.px(x, y, (x + y) % 3 === 0 ? shade(OS.rope, 0.7) : (x + y) % 3 === 1 ? OS.rope : shade(OS.rope, 1.3)); });
    for (const id of ['osFlapF', 'osFlapB']) sk.cube(id, (g) => { burlap(g, OS.sack, 0.9); ragged(g, 3, 0.6); });
    // manto de estopa: decote em V mostrando as costelas, remendo e barra esfarrapada
    sk.cube('osMantle', (g, f) => {
      if (f === 'bottom') return;
      burlap(g, OS.sack);
      if (f === 'top') return;
      if (f === 'front') {
        for (let y = 0; y < g.h; y++) {
          const half = 1 + y * 0.55 + (g.r() < 0.35 ? 0.6 : 0);
          for (let x = 0; x < g.w; x++) if (Math.abs(x + 0.5 - g.w / 2) < half) g.clear(x, y);
        }
      }
      if (f === 'back') {
        g.rect(9, 3, 4, 4, shade(OS.sack, 0.8)); g.box(9, 3, 4, 4, 0x4a3a24); // remendo costurado
        for (let i = 0; i < g.w; i++) g.px(i, Math.floor(i * 0.7), OS.rope); // alça da aljava
      }
      ragged(g, 2, 0.5);
    });
    sk.cube('osQuiver', (g, f) => {
      if (f === 'top') { g.fill(0x2a1f14); return; }
      if (f === 'bottom') { g.fill(OS.leather); return; }
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const c = ((x + y) >> 1) % 2 === 0 ? OS.weave : OS.weaveD;
        g.px(x, y, shade(c, 1 + (g.r() * 2 - 1) * 0.07));
      }
      g.rect(0, 0, g.w, 2, OS.leather); g.rect(0, g.h - 2, g.w, 2, OS.leather); g.rect(0, 9, g.w, 1, OS.leather);
    });
    // flechas com penas de arara (vermelha, azul, amarela)
    const feathers = [0xc2412d, 0x2c5f9e, 0xe2b33c];
    for (const id of ['osArrowsA', 'osArrowsB']) sk.cube(id, (g) => {
      [1, 4].forEach((x0, i) => {
        const c = feathers[(i + (g.name === 'back' || g.name === 'right' ? 1 : 0) + (id === 'osArrowsB' ? 2 : 0)) % 3];
        for (let y = 3; y < g.h; y++) g.px(x0, y, OS.shaft);
        for (let y = 0; y < 4; y++) g.px(x0, y, c);
        for (let y = 1; y < 4; y++) { g.px(x0 - 1, y, shade(c, 0.8)); g.px(x0 + 1, y, shade(c, 0.8)); }
        g.px(x0, 0, 0xefe6d2);
      });
    });
    // caveira: órbitas vazadas (o fundo brilhante fica 1 px atrás), nariz, dentes e uma trinca
    sk.cube('osSkull', (g, f) => {
      bone(g);
      if (f !== 'front') return;
      for (const x0 of [2, 9]) {
        g.clear(x0, 3, 3, 3);
        for (let x = x0 - 1; x < x0 + 4; x++) g.px(x, 2, OS.boneS);
        g.px(x0 - 1, 6, OS.boneS); g.px(x0 + 3, 6, OS.boneS);
      }
      g.rect(6, 7, 2, 2, OS.socket); g.px(6, 9, 0x4a4538); g.px(7, 9, 0x4a4538);
      for (let x = 3; x < 11; x++) { const gap = (x - 3) % 3 === 2; g.px(x, 10, gap ? 0x6b6454 : 0xe8e1cd); g.px(x, 11, gap ? 0x4a4538 : OS.bone); }
      g.line(10, 0, 12, 2, OS.boneD);
    });
    sk.cube('osJaw', (g, f) => { bone(g, OS.boneS); if (f === 'front') for (let x = 1; x < g.w - 1; x++) g.px(x, 0, (x - 1) % 3 === 2 ? 0x4a4538 : OS.bone); });
    sk.cube('osGlow', (g, f) => {
      g.fill(OS.socket);
      if (f !== 'front') return;
      for (const x0 of [2, 9]) { const x = x0 + (x0 < 6 ? 1 : 0); g.px(x, 2, OS.glow); g.px(x, 1, lerpc(OS.socket, OS.glow, 0.35)); g.px(x + (x0 < 6 ? -1 : 1), 2, lerpc(OS.socket, OS.glow, 0.2)); }
    });
    // capuz de saco: moldura em volta do rosto, costura atrás, pontas do saco espetadas
    sk.cube('osHood', (g, f) => {
      if (f === 'bottom') return;
      burlap(g, OS.sack);
      if (f === 'front') { g.clear(2, 2, g.w - 4, g.h - 2); for (let y = 2; y < g.h; y++) { if (g.r() < 0.4) g.clear(1, y); if (g.r() < 0.4) g.clear(g.w - 2, y); } }
      if (f === 'back') for (let y = 0; y < g.h; y += 2) g.px(g.w >> 1, y, OS.rope);
      if (isSide(f)) ragged(g, 1, 0.3);
    });
    sk.cube('osCowl', (g, f) => {
      if (f === 'top' || f === 'bottom') return;
      burlap(g, OS.sack, 0.92);
      if (f === 'front') g.clear(3, 0, g.w - 6, g.h);
      ragged(g, 1, 0.5);
    });
    sk.cube('osEarR', (g) => burlap(g, OS.sack, 1.05));
    // braços e pernas de osso fino, com juntas marcadas
    sk.cube('osArmR', (g) => { bone(g); for (let x = 0; x < g.w; x++) g.px(x, g.h - 1, OS.boneS); });
    sk.cube('osSleeveR', (g, f) => { if (f === 'bottom') return; burlap(g, OS.sack); if (f !== 'top') ragged(g, 2, 0.55); });
    sk.cube('osForeR', (g) => { bone(g); g.rect(0, 0, g.w, 1, OS.boneS); g.rect(0, g.h - 1, g.w, 1, OS.boneD); });
    sk.cube('osHandR', (g, f) => { bone(g, OS.boneS); if (f !== 'top') for (let x = 1; x < g.w; x += 2) g.px(x, g.h - 1, 0x5d564a); });
    sk.cube('osLegR', (g) => { bone(g); g.rect(0, 9, g.w, 2, 0xe8e1cd); g.rect(0, 11, g.w, 1, OS.boneD); g.rect(0, g.h - 2, g.w, 1, OS.boneS); });
    sk.cube('osFootR', (g, f) => { bone(g, OS.boneS); if (f === 'top') for (const x of [1, 3]) for (let y = 4; y < g.h; y++) g.px(x, y, OS.boneD); });
  },
  animate(p, s) {
    head(p, s);
    const o = s.e as Ossudo;
    const aim = o.target != null;
    biped(p, s, { armAmp: aim ? 0 : 0.8 });
    p.foreR.rotation.x -= 0.12; p.foreL.rotation.x -= 0.12; // cotovelos relaxados
    if (!aim) return;
    // mira: braço direito estica o arco à frente; o esquerdo abre o cotovelo para fora e puxa a corda até o queixo
    const draw = o.drawing > 0 ? Math.min(1, (o.drawing + s.alpha) / 20) : 0;
    const pitch = s.headPitch * DEG, yaw = -s.headYaw * DEG;
    p.armR.rotation.set(-Math.PI / 2 + pitch, yaw + 0.43, 0); // arco centrado à frente do rosto
    p.foreR.rotation.set(0, 0, 0);
    p.bowHand.rotation.z -= 0.43; // desfaz o giro do braço: arco no plano da mira
    p.armL.rotation.set(-Math.PI / 2 + pitch, yaw + 0.2, 0);
    p.foreL.rotation.set(0, 0, -(1.31 + draw * 0.78)); // da corda em repouso até o queixo
  },
};

// ------------------------------------------------------------------ tecelã
const TC = {
  normal: { body: 0x3b2633, dark: 0x25171f, light: 0x573a49, lace: 0xeadcc4, laceD: 0xbfae94, leg: 0x2f1f29, band: 0xcdbd9f, fang: 0x5a2426, eye: 0xffb347, eyeD: 0xc4661c },
  cave: { body: 0x1e2a3e, dark: 0x121a28, light: 0x2e4260, lace: 0x62e3d4, laceD: 0x34aaa1, leg: 0x19243a, band: 0x4cc7bc, fang: 0x24465a, eye: 0xffae45, eyeD: 0xc25a18 },
};
// por par de patas (da frente para trás): fêmur, tíbia, posição no tórax e abertura
const TC_UP = [7, 6.5, 6.5, 7], TC_LO = [13, 12.5, 12.5, 13], TC_Z = [3, 1, -1, -3], TC_YAW = [42, 16, -14, -40];

/** Pata: quadril (só giro em Y) → fêmur erguido 40° → tíbia dobrada para o chão. */
const tcLeg = (side: -1 | 1, i: number): PartDef => {
  const R = side < 0, s = R ? 'R' : 'L', n = `leg${s}${i}`;
  const up = TC_UP[i], lo = TC_LO[i], z = TC_Z[i], x0 = 3 * side, kx = x0 + up * side;
  const cube = (id: string, o: V3, sz: V3): CubeDef => (R ? { id: `tc${id}R${i}`, o, s: sz } : { id: `tc${id}L${i}`, o, s: sz, mirror: true, skinOf: `tc${id}R${i}` });
  return {
    name: `hip${s}${i}`, pivot: [x0, 7, z], rot: [0, R ? TC_YAW[i] : -TC_YAW[i], 0], cubes: [],
    children: [{
      name: n, pivot: [x0, 7, z], rot: [0, 0, R ? -40 : 40],
      cubes: [cube('Up', [R ? kx : x0, 6, z - 1], [up, 2, 2])],
      children: [{ name: `${n}b`, pivot: [kx, 7, z], rot: [0, 0, R ? 100 : -100], cubes: [cube('Lo', [R ? kx - lo : kx, 6.25, z - 0.75], [lo, 1.5, 1.5])] }],
    }],
  };
};

export const TECELA: ModelDef = {
  id: 'tecela',
  parts: [
    {
      name: 'thorax', pivot: [0, 7, 0],
      cubes: [{ id: 'tcThorax', o: [-3.5, 4.5, -3], s: [7, 5, 7] }],
      children: [
        {
          name: 'head', pivot: [0, 7, 4],
          cubes: [
            { id: 'tcHead', o: [-3, 5, 4], s: [6, 5, 4] },
            { id: 'tcFangR', o: [-2, 3, 7], s: [1.5, 3, 1.5] },
            { id: 'tcFangL', o: [0.5, 3, 7], s: [1.5, 3, 1.5], mirror: true, skinOf: 'tcFangR' },
          ],
          // cacho de 8 olhos: 2 grandes na frente, 2 pequenos acima, 2 nas laterais e 2 no alto
          children: [{
            name: 'eyes', pivot: [0, 7, 4],
            cubes: [
              { id: 'tcEyeR', o: [-2.5, 6.5, 7.6], s: [2, 2, 1], emissive: 0.6 },
              { id: 'tcEyeL', o: [0.5, 6.5, 7.6], s: [2, 2, 1], mirror: true, skinOf: 'tcEyeR' },
              { id: 'tcEye2R', o: [-1.6, 8.9, 7.4], s: [1, 1, 1] },
              { id: 'tcEye2L', o: [0.6, 8.9, 7.4], s: [1, 1, 1], mirror: true, skinOf: 'tcEye2R' },
              { id: 'tcEye3R', o: [-3.4, 7.5, 5.8], s: [1, 1, 1], skinOf: 'tcEye2R' },
              { id: 'tcEye3L', o: [2.4, 7.5, 5.8], s: [1, 1, 1], mirror: true, skinOf: 'tcEye2R' },
              { id: 'tcEye4R', o: [-2.2, 9.6, 5], s: [1, 1, 1], skinOf: 'tcEye2R' },
              { id: 'tcEye4L', o: [1.2, 9.6, 5], s: [1, 1, 1], mirror: true, skinOf: 'tcEye2R' },
            ],
          }],
        },
        {
          // abdome grande e arredondado (miolo + placas em X, Y e Z), levemente empinado
          name: 'abdomen', pivot: [0, 8, -3], rot: [9, 0, 0],
          cubes: [
            { id: 'tcAbA', o: [-5, 4, -14], s: [10, 9, 11] },
            { id: 'tcAbX', o: [-6, 5, -13], s: [12, 7, 9] },
            { id: 'tcAbY', o: [-4, 3, -13], s: [8, 11, 9] },
            { id: 'tcAbZ', o: [-4, 5, -15], s: [8, 7, 13] },
            { id: 'tcSpin', o: [-1, 7, -16], s: [2, 2, 1] },
          ],
        },
      ],
    },
    ...[0, 1, 2, 3].flatMap((i) => [tcLeg(-1, i), tcLeg(1, i)]),
  ],
  paint(sk, variant) {
    const c = variant === 'cave' ? TC.cave : TC.normal;
    const hair = (g: Face, base: Col, d = 0.35) => g.fur(base, c.dark, c.light, d);
    const P = 10, H = P / 2, m = (a: number) => ((a % P) + P) % P;
    /** Renda de bilro: rede de losangos com picôs (nós em cruz) nos cruzamentos e pontinho no miolo. */
    const laceNet = (g: Face) => {
      const ox = H - Math.floor(g.w / 2), oy = H - Math.floor(g.h / 2);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const u = x + ox, v = y + oy;
        const knot = (m(u) === 0 && m(v) === 0) || (m(u) === H && m(v) === H);
        const flower = (m(u) === H && m(v) === 0) || (m(u) === 0 && m(v) === H);
        if (knot) g.px(x, y, c.lace);
        else if ((m(u + v) === 0 || m(u - v) === 0) && (u + v) % 2 === 0) g.px(x, y, c.laceD); // fio pontilhado
        else if (flower) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.px(x + dx, y + dy, dx || dy ? c.laceD : c.lace);
      }
    };
    /** Barrado de bicos (festão) perto da base da face. */
    const scallop = (g: Face, y0: number) => {
      for (let x = 0; x < g.w; x++) {
        const y = y0 - Math.round(Math.abs(Math.sin((x * Math.PI) / 5)) * 2);
        g.px(x, y, c.lace);
        if (x % 5 === 2) g.px(x, y0 + 2, c.laceD);
      }
    };
    for (const id of ['tcAbA', 'tcAbX', 'tcAbY', 'tcAbZ']) sk.cube(id, (g, f) => {
      hair(g, c.body, 0.3);
      if (f === 'bottom') { hair(g, c.dark, 0.2); return; }
      laceNet(g);
      if (isSide(f) || f === 'back') scallop(g, g.h - 3);
      if (f === 'top' && id === 'tcAbY') {
        // rosácea central do bordado
        const cx = g.w / 2, cy = g.h / 2;
        g.ellipse(cx, cy, 4.2, 4.2, c.body);
        g.ellipse(cx, cy, 3.4, 3.4, c.lace); g.ellipse(cx, cy, 2.4, 2.4, c.body); g.rect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2, c.lace);
        for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.px(cx + Math.cos(a) * 5.4 - 0.5, cy + Math.sin(a) * 5.4 - 0.5, c.lace); }
      }
    });
    sk.cube('tcSpin', (g) => hair(g, c.dark, 0.2));
    sk.cube('tcThorax', (g, f) => {
      hair(g, c.body);
      if (f === 'top') { const cx = Math.floor(g.w / 2); for (let k = 0; k < 4; k++) { g.px(cx - 1 - k, 3 + k, c.lace); g.px(cx + k, 3 + k, c.lace); g.px(cx - 1 - k, 10 - k, c.laceD); g.px(cx + k, 10 - k, c.laceD); } }
    });
    sk.cube('tcHead', (g, f) => {
      hair(g, shade(c.body, 1.1));
      if (f === 'front') { g.rect(1, 2, g.w - 2, 6, c.dark); g.rect(3, 8, g.w - 6, 2, shade(c.fang, 0.8)); }
      if (f === 'top') for (let x = 2; x < g.w - 2; x += 3) g.px(x, 1, c.lace);
    });
    sk.cube('tcFangR', (g) => { g.vgrad(c.fang, shade(c.fang, 0.45), 0.06); for (let x = 0; x < g.w; x++) g.px(x, g.h - 1, 0x140c0e); g.px(1, 1, lerpc(c.fang, 0xffffff, 0.35)); });
    sk.cube('tcEyeR', (g, f) => {
      g.fill(c.eye);
      if (f !== 'front') return;
      g.box(0, 0, 4, 4, c.eyeD); g.rect(1, 1, 2, 2, 0x2a1206); g.px(1, 1, 0xfff3c6);
    });
    sk.cube('tcEye2R', (g, f) => { g.fill(c.eye); if (f === 'front' || f === 'right' || f === 'top') { g.px(1, 1, 0x2a1206); g.px(0, 0, 0xfff0c0); } });
    for (let i = 0; i < 4; i++) {
      // fêmur: pelos, anel claro no joelho (ponta de fora = x baixo na frente/topo/fundo, x alto atrás)
      sk.cube(`tcUpR${i}`, (g, f) => {
        hair(g, c.leg, 0.45);
        if (f === 'right') { g.fill(c.band); return; }
        const xs = f === 'back' ? [g.w - 1, g.w - 2] : [0, 1];
        if (f !== 'left') for (const x of xs) for (let y = 0; y < g.h; y++) g.px(x, y, c.band);
      });
      // tíbia: anel no meio, ponta escura com garrinha (ponta = x baixo na frente/topo/fundo)
      sk.cube(`tcLoR${i}`, (g, f) => {
        hair(g, c.leg, 0.45);
        if (isSide(f)) return;
        const tip = (x: number) => (f === 'back' ? g.w - 1 - x : x);
        const mid = Math.floor(g.w / 2);
        for (let y = 0; y < g.h; y++) { g.px(tip(mid), y, c.band); g.px(tip(mid + 1), y, c.band); g.px(tip(0), y, 0x140c0e); g.px(tip(1), y, c.dark); }
      });
    }
  },
  animate(p, s) {
    head(p, s, 'head', 0.8);
    // marcha alternada em dois grupos (R0, L1, R2, L3) × (L0, R1, L2, R3): a pata avança erguida e volta no chão
    const ph = s.swing * 0.6662 * 1.3, amt = s.amount;
    for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
      const sd = side < 0 ? 'R' : 'L', sg = side < 0 ? 1 : -1;
      const phase = ph + ((i + (side < 0 ? 0 : 1)) % 2) * Math.PI;
      const swing = Math.sin(phase) * 0.32 * amt + Math.sin(s.t * 0.05 + i * 1.7 + side) * 0.02;
      const lift = Math.max(0, Math.cos(phase)) * 0.4 * amt;
      p[`hip${sd}${i}`].rotation.y += sg * swing;
      p[`leg${sd}${i}`].rotation.z -= sg * lift;
      p[`leg${sd}${i}b`].rotation.z += sg * lift * 0.6;
    }
    p.thorax.position.y += (Math.abs(Math.sin(ph)) * 0.35 * amt + Math.sin(s.t * 0.07) * 0.1) / 16;
    p.abdomen.rotation.x += Math.sin(s.t * 0.08) * 0.03;
    p.abdomen.rotation.y += Math.sin(s.t * 0.045) * 0.04 + Math.sin(ph) * 0.06 * amt;
    // bote: ergue as patas da frente e a cabeça
    if (s.attack > 0) {
      const k = Math.sin(s.attack * Math.PI);
      p.legR0.rotation.z -= k * 0.7; p.legL0.rotation.z += k * 0.7;
      p.legR1.rotation.z -= k * 0.3; p.legL1.rotation.z += k * 0.3;
      p.head.rotation.x -= k * 0.35;
    }
  },
};

// ------------------------------------------------------------------ gosma
const GS = { jelly: [46, 150, 124] as const, edge: [110, 205, 175] as const, core: 0x0a2a23, coreD: 0x061c17, eye: 0x0b211d, mint: 0xaaf0d8, bub: 0xd6fff0 };

export const GOSMA: ModelDef = {
  id: 'gosma',
  parts: [{
    name: 'jelly', pivot: [0, 0, 0],
    cubes: [{ id: 'gsShell', o: [-4, 0, -4], s: [8, 8, 8], translucent: true }],
    children: [{
      name: 'core', pivot: [0, 4, 0],
      cubes: [
        { id: 'gsCore', o: [-2.5, 1.5, -2.5], s: [5, 5, 5] },
        { id: 'gsBub', o: [2.5, 5.5, -3], s: [1, 1, 1] },
        { id: 'gsBub2', o: [-3.5, 2, 1.5], s: [1, 1, 1], skinOf: 'gsBub' },
        { id: 'gsBub3', o: [1, 6.5, 2.5], s: [1, 1, 1], skinOf: 'gsBub' },
      ],
      children: [{
        name: 'eyes', pivot: [0, 4.5, 3],
        cubes: [
          { id: 'gsEyeR', o: [-2.5, 3.5, 2.5], s: [2, 2, 1] },
          { id: 'gsEyeL', o: [0.5, 3.5, 2.5], s: [2, 2, 1], mirror: true, skinOf: 'gsEyeR' },
        ],
      }],
    }],
  }],
  paint(sk) {
    const J = GS.jelly, E = GS.edge;
    // casca translúcida: miolo mais transparente, borda mais densa e clara, brilho no alto
    sk.cube('gsShell', (g, f) => {
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const edge = x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1;
        const k = 1 + (g.r() * 2 - 1) * 0.04;
        g.px(x, y, edge ? [E[0], E[1], E[2], 150] : [J[0] * k, J[1] * k, J[2] * k, f === 'bottom' ? 150 : 105]);
      }
      if (f === 'top' || f === 'front' || isSide(f)) { g.clear(2, 2, 3, 1); g.px(2, 2, [245, 255, 250, 230]); g.px(3, 2, [230, 255, 245, 200]); g.px(4, 2, [215, 250, 238, 170]); g.clear(2, 3); g.px(2, 3, [230, 255, 245, 190]); }
    });
    sk.cube('gsCore', (g, f) => {
      g.noise(GS.core, 0.08);
      for (let i = 0; i < 5; i++) g.px(g.r() * g.w, g.r() * g.h, GS.coreD);
      if (f === 'front') { g.px(3, 7, GS.mint); g.px(4, 8, GS.mint); g.px(5, 8, GS.mint); g.px(6, 7, GS.mint); } // sorrisinho
    });
    sk.cube('gsBub', (g) => { g.fill(GS.bub); g.px(0, 0, 0xffffff); });
    sk.cube('gsEyeR', (g, f) => { g.fill(GS.mint); if (f === 'front') { g.rect(1, 1, 2, 2, GS.eye); g.px(1, 1, 0xf2fff9); } });
  },
  animate(p, s) {
    const t = s.t + (s.e.id % 37) * 7;
    p.core.rotation.y += Math.sin(t * 0.07) * 0.06;
    p.core.position.y += (Math.sin(t * 0.11) * 0.18) / 16;
    if (t % 97 < 3) p.eyes.scale.y = 0.2; // pisca
  },
};

// ------------------------------------------------------------------ specs
export const SPECS_MONSTROS2: Record<string, MobModelSpec> = {
  // o arco vai no punho direito; o deslocamento leva a empunhadura do ícone (sprite ancorado pela base) até a mão
  ossudo: { def: OSSUDO, hand: 'bowHand', handOffset: [2, 0, 6.8] },
  tecela: {
    def: TECELA,
    variant: (e) => ((e as Tecela).cave ? 'cave' : ''),
    pose(inst, e) { if ((e as Tecela).cave) inst.body.scale.multiplyScalar(0.5); },
  },
  gosma: {
    def: GOSMA,
    // modelo de tamanho 1 esticado/achatado pelo squish (g = 1/(f+1))
    pose(inst, e, s) {
      const gm = e as Gosma;
      const size = gm.size || 1;
      const f = (gm.prevSquish + (gm.squish - gm.prevSquish) * s.alpha) / (size * 0.5 + 1);
      const g = 1 / (f + 1), k = inst.body.scale.x;
      inst.body.scale.set(k * g * size, (k * size) / g, k * g * size);
    },
  },
};
