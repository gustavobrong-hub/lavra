/**
 * Animações comuns (quadrúpede, bípede, voo, nado) no estilo do original: pernas em cosseno do
 * balanço de membros (×0,6662), cabeça seguindo yaw/pitch relativos, respiração dos braços.
 */
import type { Parts, AnimState } from './boxmodel';
import { DEG } from './boxmodel';

const C = 0.6662;

export function head(p: Parts, s: AnimState, name = 'head', k = 1): void {
  const h = p[name];
  if (!h) return;
  h.rotation.x += s.headPitch * DEG * k;
  h.rotation.y += -s.headYaw * DEG * k;
}

/** Quatro pernas: FR/BL em fase, FL/BR em contrafase. */
export function quadLegs(p: Parts, s: AnimState, names = ['legFR', 'legFL', 'legBR', 'legBL'], amp = 1.4): void {
  const a = Math.cos(s.swing * C) * amp * s.amount;
  const b = Math.cos(s.swing * C + Math.PI) * amp * s.amount;
  if (p[names[0]]) p[names[0]].rotation.x += a;
  if (p[names[1]]) p[names[1]].rotation.x += b;
  if (p[names[2]]) p[names[2]].rotation.x += b;
  if (p[names[3]]) p[names[3]].rotation.x += a;
}

/** Bípede: pernas e braços alternados; `armsUp` levanta os braços para frente (carniçal). */
export function biped(p: Parts, s: AnimState, o: { armsUp?: boolean; armAmp?: number; legAmp?: number } = {}): void {
  const la = o.legAmp ?? 1.4, aa = o.armAmp ?? 1;
  if (p.legR) p.legR.rotation.x += Math.cos(s.swing * C) * la * s.amount;
  if (p.legL) p.legL.rotation.x += Math.cos(s.swing * C + Math.PI) * la * s.amount;
  const breathe = Math.cos(s.t * 0.09) * 0.05 + 0.05;
  const bob = Math.sin(s.t * 0.067) * 0.05;
  if (o.armsUp) {
    // braços estendidos à frente; golpe = movimento para baixo
    const atk = Math.sin(s.attack * Math.PI);
    const atk2 = Math.sin((1 - (1 - s.attack) * (1 - s.attack)) * Math.PI);
    for (const [n, sgn] of [['armR', 1], ['armL', -1]] as const) {
      const a = p[n];
      if (!a) continue;
      a.rotation.x += -Math.PI / 2.25 + atk * 1.2 - atk2 * 0.4 + bob;
      a.rotation.y += sgn * -(0.1 - atk * 0.6);
      a.rotation.z += sgn * breathe;
    }
    return;
  }
  if (p.armR) { p.armR.rotation.x += Math.cos(s.swing * C + Math.PI) * 2 * s.amount * 0.5 * aa; p.armR.rotation.z += -breathe; p.armR.rotation.x += bob; }
  if (p.armL) { p.armL.rotation.x += Math.cos(s.swing * C) * 2 * s.amount * 0.5 * aa; p.armL.rotation.z += breathe; p.armL.rotation.x -= bob; }
  // golpe com o braço direito
  if (s.attack > 0 && p.armR) {
    const f = 1 - s.attack;
    const g = Math.sin((1 - f * f * f * f) * Math.PI);
    p.armR.rotation.x -= g * 1.2 + Math.sin(s.attack * Math.PI) * 0.5;
    p.armR.rotation.y += Math.sin(Math.sqrt(s.attack) * Math.PI * 2) * 0.2;
  }
}

/** Cauda balançando (cachorro, gato, cavalo). */
export function tailWag(p: Parts, s: AnimState, name = 'tail', speed = 0.3, amp = 0.2): void {
  const t = p[name];
  if (!t) return;
  t.rotation.y += Math.sin(s.t * speed) * amp + Math.cos(s.swing * C) * 0.4 * s.amount;
}

/** Asas batendo em torno de Z (galinha, assombro). */
export function flap(p: Parts, l: string, r: string, phase: number, amp: number): void {
  if (p[l]) p[l].rotation.z += Math.sin(phase) * amp;
  if (p[r]) p[r].rotation.z -= Math.sin(phase) * amp;
}

/** Nadadeira/rabo de peixe. */
export function fishTail(p: Parts, s: AnimState, name = 'tail', speed = 0.6, amp = 0.45): void {
  if (p[name]) p[name].rotation.y += Math.sin(s.t * speed) * amp * (1 + s.amount);
}
