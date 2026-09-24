/**
 * Modelo do céu por hora do dia: direção do sol/lua (ângulo celeste do original), cores de zênite,
 * horizonte, sol e luz ambiente. Aproximação de dispersão atmosférica: transmitância ∝ exp(−massa de ar · β).
 */
import { DAY_TICKS } from '../core/constants';
import { clamp, smoothstep } from '../core/math';

export interface SkyState {
  /** direção da luz principal (sol de dia, lua à noite) — usada na iluminação e nas sombras */
  sunDir: [number, number, number];
  /** direção real do sol */
  sunPos: [number, number, number];
  moonDir: [number, number, number];
  day: number; // 0 noite … 1 dia
  sunColor: [number, number, number]; // luz direta principal (HDR, linear)
  sunDisc: [number, number, number]; // radiância do disco do sol visto da câmera
  sunExtra: [number, number, number]; // radiância do sol fora da atmosfera
  moonLight: [number, number, number]; // luz da lua fora da atmosfera (para o céu)
  cloudLight: [number, number, number]; // luz que chega às nuvens (sol + lua)
  zenith: [number, number, number];
  horizon: [number, number, number];
  ambient: [number, number, number];
  fog: [number, number, number];
  moonPhase: number; // 0..1
  sunset: number; // 0..1, perto do nascer/pôr do sol
  night: number; // 0..1
  stars: number; // 0..1
  /** escurecimento do céu (0 meio-dia … 11 noite) como no original, para spawn */
  skyDarken: number;
  celestial: number;
}

/** Ângulo celeste do original (0 = meio-dia, 0.5 = meia-noite). */
export function celestialAngle(dayTime: number): number {
  const d = ((dayTime / DAY_TICKS - 0.25) % 1 + 1) % 1;
  const e = 0.5 - Math.cos(d * Math.PI) / 2;
  return (d * 2 + e) / 3;
}

/** Escurecimento do céu (0..11) — mesma fórmula do original. */
export function skyDarkenFor(dayTime: number, rain: number, thunder: number): number {
  const c = celestialAngle(dayTime);
  let f = 1 - (Math.cos(c * Math.PI * 2) * 2 + 0.5);
  f = clamp(f, 0, 1);
  f = 1 - f;
  f *= 1 - (rain * 5) / 16;
  f *= 1 - (thunder * 5) / 16;
  return Math.floor((1 - f) * 11);
}

// Mesmo modelo da LUT do céu (shaders/atmosphere.ts), em km.
const R_GROUND = 6360, R_TOP = 6420, CAM_ALT = 0.35;
const BETA_R = [5.802e-3, 13.558e-3, 33.1e-3];
const BETA_M_EXT = 2.2e-3;
const BETA_O = [1.625e-3, 4.703e-3, 0.2125e-3];
const H_R = 8, H_M = 1.2;
/** irradiância do sol fora da atmosfera (unidades do jogo) */
export const SUN_E = 3.7;
/** luz da lua cheia em relação ao sol (bem acima da real, para dar jogo à noite) */
const MOON_E = 0.08;
/** reforço artístico do brilho do céu */
export const SKY_SCALE = 3.6;

/** Transmitância de uma altitude (km) até o topo da atmosfera numa direção (y para cima). */
export function transmittance(alt: number, d: [number, number, number], out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const py = R_GROUND + alt;
  const b = py * d[1];
  const cG = py * py - R_GROUND * R_GROUND;
  const discG = b * b - cG;
  // a borda do disco solar some aos poucos atrás do horizonte (±0,4°)
  let edge = 1;
  if (discG > 0 && b < 0) {
    const dip = Math.acos(R_GROUND / py);
    const el = Math.asin(clamp(d[1], -1, 1));
    edge = smoothstep(-dip - 0.007, -dip + 0.007, el);
    if (edge <= 0) { out[0] = out[1] = out[2] = 0; return out; }
  }
  const cT = py * py - R_TOP * R_TOP;
  const L = -b + Math.sqrt(Math.max(0, b * b - cT));
  const N = 24;
  let odR = 0, odM = 0, odO = 0, prev = 0;
  for (let i = 0; i < N; i++) {
    const f = (i + 1) / N;
    const t = L * f * f;
    const ds = t - prev;
    const tm = (t + prev) / 2;
    prev = t;
    const qx = d[0] * tm, qy = py + d[1] * tm, qz = d[2] * tm;
    const h = Math.hypot(qx, qy, qz) - R_GROUND;
    odR += Math.exp(-h / H_R) * ds;
    odM += Math.exp(-h / H_M) * ds;
    odO += Math.max(0, 1 - Math.abs(h - 25) / 15) * ds;
  }
  for (let k = 0; k < 3; k++) out[k] = Math.exp(-(BETA_R[k] * odR + BETA_M_EXT * odM + BETA_O[k] * odO)) * edge;
  return out;
}

const tmpT: [number, number, number] = [0, 0, 0];

export function computeSky(dayTime: number, rain: number, thunder: number, moonPhase: number): SkyState {
  const c = celestialAngle(dayTime);
  const ang = c * Math.PI * 2;
  // sol nasce a leste (+X) e se põe a oeste, leve inclinação para o sul
  const sunPos = normalize([-Math.sin(ang), Math.cos(ang), 0.18]);
  const moonN = normalize([-sunPos[0], -sunPos[1], -sunPos[2] * 0.6]);
  const h = sunPos[1];
  const day = smoothstep(-0.18, 0.2, h);
  const clear = 1 - rain * 0.82 - thunder * 0.1;
  // sol visto da câmera
  const Ts = transmittance(CAM_ALT, sunPos, [0, 0, 0]);
  const sunLight = Ts.map((t) => t * SUN_E * clear) as [number, number, number];
  // lua: fase muda a intensidade; tom levemente azulado (visão noturna)
  const phaseLight = 0.3 + 0.7 * Math.abs(Math.cos(moonPhase * Math.PI));
  const moonE = SUN_E * MOON_E * phaseLight;
  const moonLight: [number, number, number] = [moonE * 0.78, moonE * 0.9, moonE * 1.12];
  const Tm = transmittance(CAM_ALT, moonN, tmpT);
  const moonDirect = [moonLight[0] * Tm[0], moonLight[1] * Tm[1], moonLight[2] * Tm[2]].map((x) => x * (1 - rain * 0.85)) as [number, number, number];
  // luz principal: sol enquanto ele estiver acima do horizonte, depois a lua
  const useSun = h > -0.03;
  const sunDir = useSun ? sunPos : moonN;
  const light = useSun ? sunLight : moonDirect;
  // nuvens (≈9 km) ainda veem o sol avermelhado alguns minutos depois do pôr; a lua entra à parte no shader
  const Tc = transmittance(9, sunPos, [0, 0, 0]);
  const cloudLight = [0, 1, 2].map((k) => Tc[k] * SUN_E * clear) as [number, number, number];
  const sunDisc = Ts.map((t) => t * SUN_E * 28 * (1 - rain * 0.97)) as [number, number, number];
  // cores legadas (aproximadas) para quem ainda não usa a LUT
  const mix3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as [number, number, number];
  const zenith = mix3([0.0012, 0.0022, 0.0065], [0.09, 0.22, 0.62], day);
  const horizon = mix3([0.004, 0.0065, 0.013], [0.42, 0.58, 0.85], day);
  const ambient = mix3(horizon, zenith, 0.5).map((x) => x * 1.35) as [number, number, number];
  const fog = mix3(horizon, zenith, 0.15);
  const sunset = smoothstep(0.32, 0.0, Math.abs(h + 0.03));
  const stars = clamp((-h - 0.05) * 4, 0, 1) * (1 - rain);
  return {
    sunDir, sunPos, moonDir: moonN, day, sunColor: light, sunDisc, sunExtra: [SUN_E, SUN_E, SUN_E],
    moonLight, cloudLight, zenith, horizon, ambient, fog, moonPhase, sunset, night: 1 - day, stars,
    skyDarken: skyDarkenFor(dayTime, rain, thunder), celestial: c,
  };
}

function normalize(v: number[]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
