/**
 * Atmosfera: dispersão simples de Rayleigh + Mie com absorção do ozônio, integrada numa textura
 * "sky-view" (azimute absoluto × elevação, com mais resolução perto do horizonte) a cada quadro.
 * Sol e lua iluminam a mesma textura. Céu, neblina, reflexos e luz ambiente amostram essa LUT,
 * então o pôr do sol tinge tudo de forma coerente.
 */
import { COMMON_GLSL } from './common';

/** Constantes físicas (km) compartilhadas com o modelo em TS (skymodel.ts). */
export const ATMOS_CONST_GLSL = /* glsl */ `
const float R_GROUND = 6360.0;
const float R_TOP = 6420.0;
const float CAM_ALT = 0.35;
const vec3 BETA_R = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float BETA_M_SCAT = 2.0e-3;
const float BETA_M_EXT = 2.2e-3;
const vec3 BETA_O = vec3(1.625e-3, 4.703e-3, 0.2125e-3); // ozônio ×2,5: crepúsculo mais azul-arroxeado
// espalhamento múltiplo aproximado: luz isotrópica de um sol "elevado" (continua após o pôr do sol)
const float MS_K = 1.4;
const float MS_LIFT = 0.15;
const float MS_HORIZON = 0.7;
const float H_R = 8.0;
const float H_M = 1.2;
`;

export const SKYLUT_FS = /* glsl */ `
${COMMON_GLSL}
${ATMOS_CONST_GLSL}
in vec2 vUv;
out vec4 outColor;

// densidades (Rayleigh, Mie, ozônio) a uma altitude h (km)
vec3 densities(float h) {
  return vec3(exp(-h / H_R), exp(-h / H_M), max(0.0, 1.0 - abs(h - 25.0) / 15.0));
}

// distância até sair da atmosfera (ou -1 se bate no chão)
float rayTop(vec3 p, vec3 d) {
  float b = dot(p, d);
  float c = dot(p, p) - R_TOP * R_TOP;
  float disc = b * b - c;
  if (disc < 0.0) return 0.0;
  return -b + sqrt(disc);
}
float rayGround(vec3 p, vec3 d) {
  float b = dot(p, d);
  float c = dot(p, p) - R_GROUND * R_GROUND;
  float disc = b * b - c;
  if (disc < 0.0 || b > 0.0) return -1.0;
  return -b - sqrt(disc);
}

// transmitância de p até o topo na direção d (8 passos)
vec3 transmittanceTo(vec3 p, vec3 d) {
  if (rayGround(p, d) > 0.0) return vec3(0.0);
  float L = rayTop(p, d);
  float ds = L / 8.0;
  vec3 od = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec3 q = p + d * (float(i) + 0.5) * ds;
    od += densities(length(q) - R_GROUND) * ds;
  }
  return exp(-(BETA_R * od.x + BETA_M_EXT * od.y + BETA_O * od.z));
}

float phaseR(float mu) { return 3.0 / (16.0 * PI) * (1.0 + mu * mu); }
float phaseM(float mu, float g) {
  float g2 = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
}

void main() {
  // texel → direção (mesma parametrização de skyLUT() em common)
  float az = vUv.x * 2.0 * PI;
  float v = vUv.y;
  float el = v * v * (PI * 0.5);
  el = max(el, 0.0015);
  vec3 d = vec3(cos(az) * cos(el), sin(el), sin(az) * cos(el));
  vec3 p0 = vec3(0.0, R_GROUND + CAM_ALT, 0.0);
  float L = rayTop(p0, d);
  // "hora dourada": mais aerossol (e halo mais largo) perto do nascer/pôr do sol
  float golden = smoothstep(0.4, 0.02, abs(uSunPos.y + 0.02));
  float mieK = 1.0 + 1.8 * golden;
  float g = mix(mix(0.78, 0.64, golden), 0.68, uWeather.x);
  const int N = 24;
  // passos não uniformes: mais amostras perto da câmera
  vec3 sumSun = vec3(0.0), sumMoon = vec3(0.0), sumMS = vec3(0.0);
  vec3 od = vec3(0.0);
  vec3 Sms = normalize(uSunPos.xyz + vec3(0.0, MS_LIFT, 0.0));
  float muS = dot(d, uSunPos.xyz), muM = dot(d, uMoonDir.xyz);
  float pRs = phaseR(muS), pMs = phaseM(muS, g), pRm = phaseR(muM), pMm = phaseM(muM, g);
  float tPrev = 0.0;
  for (int i = 0; i < N; i++) {
    float f = (float(i) + 1.0) / float(N);
    float t = L * f * f;
    float ds = t - tPrev;
    float tm = (t + tPrev) * 0.5;
    tPrev = t;
    vec3 q = p0 + d * tm;
    float h = length(q) - R_GROUND;
    vec3 den = densities(h);
    od += den * ds;
    vec3 Tv = exp(-(BETA_R * od.x + BETA_M_EXT * mieK * od.y + BETA_O * od.z));
    vec3 scR = BETA_R * den.x, scM = vec3(BETA_M_SCAT * mieK * den.y);
    if (uSunPos.w > 0.0) {
      vec3 Ts = transmittanceTo(q, uSunPos.xyz);
      sumSun += Tv * Ts * (scR * pRs + scM * pMs) * ds;
      sumMS += Tv * transmittanceTo(q, Sms) * (scR + scM) * ds;
    }
    if (uMoonColor.w > 0.0) {
      vec3 Tm = transmittanceTo(q, uMoonDir.xyz);
      sumMoon += Tv * Tm * (scR * pRm + scM * pMm) * ds;
    }
  }
  // dispersão múltipla aproximada: um tanto isotrópico proporcional à luz que chega
  float kms = MS_K * (1.0 - MS_HORIZON * (1.0 - v)) / (4.0 * PI);
  vec3 col = (sumSun + sumMS * kms) * uSunRad.rgb + sumMoon * (1.0 + kms * 4.0) * uMoonColor.rgb;
  col *= uSunRad.w;
  // horizonte um pouco mais contido (o espalhamento múltiplo satura perto dele) e mais saturação
  col *= mix(0.8, 1.0, smoothstep(0.0, 0.32, v));
  float lc = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(lc), col, 1.22), vec3(0.0));
  // brilho do céu noturno (sem lua ainda há um azul muito escuro)
  col += vec3(0.0011, 0.0016, 0.0034) * (0.35 + 0.65 * v);
  // chuva: céu acinzentado e mais escuro
  float rain = uWeather.x;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l) * vec3(0.92, 0.96, 1.05), rain * 0.85) * (1.0 - rain * 0.55 - uWeather.y * 0.25);
  outColor = vec4(col, 1.0);
}
`;
