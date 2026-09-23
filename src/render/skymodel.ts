/**
 * Modelo do céu por hora do dia: direção do sol/lua (ângulo celeste do original), cores de zênite,
 * horizonte, sol e luz ambiente. Aproximação de dispersão atmosférica: transmitância ∝ exp(−massa de ar · β).
 */
import { DAY_TICKS } from '../core/constants';
import { clamp, smoothstep } from '../core/math';

export interface SkyState {
  sunDir: [number, number, number];
  moonDir: [number, number, number];
  day: number; // 0 noite … 1 dia
  sunColor: [number, number, number]; // radiância (HDR, linear)
  zenith: [number, number, number];
  horizon: [number, number, number];
  ambient: [number, number, number];
  fog: [number, number, number];
  moonPhase: number; // 0..1
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

const BETA: [number, number, number] = [0.18, 0.42, 1.0]; // dispersão de Rayleigh relativa (vermelho passa mais)

export function computeSky(dayTime: number, rain: number, thunder: number, moonPhase: number): SkyState {
  const c = celestialAngle(dayTime);
  const ang = c * Math.PI * 2;
  // sol nasce a leste (+X) e se põe a oeste, leve inclinação para o sul
  const sunDir = normalize([-Math.sin(ang), Math.cos(ang), 0.18]);
  const moonDir: [number, number, number] = [-sunDir[0], -sunDir[1], -sunDir[2] * 0.6];
  const moonN = normalize(moonDir);
  const h = sunDir[1];
  const day = smoothstep(-0.18, 0.2, h);
  // massa de ar aproximada
  // massa de ar (Kasten–Young) a partir do ângulo zenital
  const zenDeg = Math.min(90, (Math.acos(clamp(h, -1, 1)) * 180) / Math.PI);
  const airmass = 1 / (Math.cos((zenDeg * Math.PI) / 180) + 0.50572 * Math.pow(96.07995 - zenDeg, -1.6364));
  const trans = BETA.map((b) => Math.exp(-b * Math.min(airmass, 40) * 0.12)) as [number, number, number];
  const sunI = 3.2 * smoothstep(-0.08, 0.08, h);
  const sunColor = trans.map((t) => t * sunI) as [number, number, number];
  // cores base (linear)
  const zenDay: [number, number, number] = [0.09, 0.22, 0.62];
  const horDay: [number, number, number] = [0.42, 0.58, 0.85];
  const zenNight: [number, number, number] = [0.0012, 0.0022, 0.0065];
  const horNight: [number, number, number] = [0.004, 0.0065, 0.013];
  const sunset = smoothstep(0.35, 0.02, Math.abs(h)) * smoothstep(-0.25, -0.02, h + 0.1);
  const horSet: [number, number, number] = [1.0, 0.36, 0.12];
  const zenSet: [number, number, number] = [0.16, 0.14, 0.32];
  const mix3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as [number, number, number];
  let zenith = mix3(zenNight, zenDay, day);
  let horizon = mix3(horNight, horDay, day);
  zenith = mix3(zenith, zenSet, sunset * 0.5);
  horizon = mix3(horizon, horSet, sunset * 0.8);
  // chuva: céu acinzentado e mais escuro
  const grayK = rain * 0.75;
  const gray = (v: [number, number, number], k: number) => {
    const l = v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11;
    return mix3(v, [l, l, l], grayK).map((x) => x * k) as [number, number, number];
  };
  zenith = gray(zenith, 1 - rain * 0.45 - thunder * 0.3);
  horizon = gray(horizon, 1 - rain * 0.4 - thunder * 0.3);
  const sunOut = sunColor.map((x) => x * (1 - rain * 0.8)) as [number, number, number];
  // luz da lua
  const moonH = moonN[1];
  const phaseLight = 0.35 + 0.65 * Math.abs(Math.cos(moonPhase * Math.PI));
  const moonI = smoothstep(-0.05, 0.2, moonH) * (1 - day) * 0.22 * phaseLight * (1 - rain * 0.7);
  const moonColor: [number, number, number] = [0.55 * moonI, 0.65 * moonI, 0.9 * moonI];
  const lightDir = day > 0.02 || moonI < 0.001 ? sunDir : moonN;
  const light = day > 0.02 ? sunOut : moonColor;
  // ambiente do céu (irradiância difusa)
  const ambient = mix3(horizon, zenith, 0.5).map((x, i) => x * 1.35 + light[i] * 0.08 + (1 - day) * [0.012, 0.016, 0.03][i]) as [number, number, number];
  const fog = mix3(horizon, zenith, 0.15);
  return {
    sunDir: lightDir, moonDir: moonN, day, sunColor: light, zenith, horizon, ambient, fog, moonPhase,
    skyDarken: skyDarkenFor(dayTime, rain, thunder), celestial: c,
  };
}

function normalize(v: number[]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
