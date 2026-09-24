/**
 * Passe de atmosfera: céu da LUT, sol quadrado em pixel art com halo, lua com fases, estrelas que giram
 * com o céu e nuvens em blocos (DDA numa camada de células 12×12×4) — também na frente do relevo.
 */
import { COMMON_GLSL } from './common';

export const FULLSCREEN_VS = /* glsl */ `
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 1.0, 1.0);
}
`;

/** Traçado das nuvens (usado pelo céu e pelos reflexos da água). */
export const CLOUD_TRACE_GLSL = /* glsl */ `
vec3 shadeCloud(vec3 n, vec3 rd) {
  vec3 Ls = uSunPos.xyz, Lm = uMoonDir.xyz;
  float ns = dot(n, Ls);
  // nuvens deixam passar luz: a base ainda recebe a luz difundida pelo corpo da nuvem
  float wrap = clamp(ns * 0.5 + 0.5, 0.0, 1.0) * 0.78 + 0.26;
  float mu = max(dot(rd, Ls), 0.0);
  float fwd = pow(mu, 5.0) * 0.45 + pow(mu, 36.0) * 0.9;
  vec3 amb = skyIrradiance(n);
  vec3 c = 0.62 * (amb + uCloudLight.rgb * (wrap * 0.85 + fwd));
  float moonUp = smoothstep(-0.05, 0.25, Lm.y);
  c += 0.62 * uMoonColor.rgb * (clamp(dot(n, Lm) * 0.5 + 0.5, 0.0, 1.0) * 0.78 + 0.26) * moonUp * 0.7;
  return c * (1.0 - uCloudLight.w * 0.5);
}

// cor (pré-multiplicada) e opacidade das nuvens ao longo de um raio saindo da câmera
vec4 traceClouds(vec3 rd, float maxDist, int maxSteps) {
  if (uClouds.z <= 0.0) return vec4(0.0);
  float b = uClouds.w, top = b + CLOUD_H;
  float t0, t1;
  if (abs(rd.y) < 1e-4) {
    if (b > 0.0 || top < 0.0) return vec4(0.0);
    t0 = 0.0; t1 = maxDist;
  } else {
    float ta = b / rd.y, tb = top / rd.y;
    t0 = max(min(ta, tb), 0.0);
    t1 = min(max(ta, tb), maxDist);
  }
  if (t0 >= t1) return vec4(0.0);
  vec2 pc = (rd.xz * t0 + uClouds.xy) / CLOUD_CELL;
  vec2 cell = floor(pc);
  vec2 sgn = vec2(rd.x >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
  vec2 adir = max(abs(rd.xz), vec2(1e-6));
  vec2 tDelta = CLOUD_CELL / adir;
  vec2 fr = pc - cell;
  vec2 tMax = t0 + vec2(sgn.x > 0.0 ? 1.0 - fr.x : fr.x, sgn.y > 0.0 ? 1.0 - fr.y : fr.y) * tDelta;
  bool inside = b <= 0.0 && top >= 0.0;
  vec3 n = inside ? -rd : vec3(0.0, rd.y > 0.0 ? -1.0 : 1.0, 0.0);
  float t = t0, trans = 1.0, firstT = -1.0;
  vec3 col = vec3(0.0), shade = vec3(0.0);
  bool prev = false;
  for (int i = 0; i < 96; i++) {
    if (i >= maxSteps) break;
    float tn = min(min(tMax.x, tMax.y), t1);
    if (cloudFilled(cell)) {
      if (!prev) { shade = shadeCloud(n, rd); if (firstT < 0.0) firstT = t; }
      float a = 1.0 - exp(-(tn - t) * 0.42);
      col += trans * a * shade;
      trans *= 1.0 - a;
      prev = true;
      if (trans < 0.03) break;
    } else prev = false;
    if (tn >= t1) break;
    t = tn;
    if (tMax.x < tMax.y) { cell.x += sgn.x; tMax.x += tDelta.x; n = vec3(-sgn.x, 0.0, 0.0); }
    else { cell.y += sgn.y; tMax.y += tDelta.y; n = vec3(0.0, 0.0, -sgn.y); }
  }
  float alpha = 1.0 - trans;
  if (alpha <= 0.001) return vec4(0.0);
  // perspectiva aérea: nuvens distantes somem no céu
  vec3 haze = skyLUT(normalize(vec3(rd.x, max(rd.y, 0.0), rd.z)));
  float hz = 1.0 - exp(-firstT * 0.0005);
  col = mix(col, haze * alpha, hz);
  float fade = 1.0 - smoothstep(maxDist * 0.5, maxDist, firstT);
  return vec4(col, alpha) * fade;
}
`;

export const SKY_FS = /* glsl */ `
${COMMON_GLSL}
${CLOUD_TRACE_GLSL}
uniform sampler2D uSceneDepth;
uniform float uCloudDist;
in vec2 vUv;
out vec4 outColor;

// base (e1 ao longo da órbita, e2 no eixo de rotação) para desenhar quadrados no céu
vec2 squareCoords(vec3 d, vec3 C) {
  vec3 e1 = normalize(cross(C, vec3(0.0, 0.0, 1.0)));
  vec3 e2 = cross(e1, C);
  return vec2(dot(d, e1), dot(d, e2)) / max(dot(d, C), 1e-4);
}

vec3 sunDisc(vec3 d) {
  vec3 S = uSunPos.xyz;
  float cs = dot(d, S);
  if (cs < 0.97) return vec3(0.0);
  vec2 q = squareCoords(d, S);
  const float SIZE = 0.045;
  vec2 a = abs(q) / SIZE;
  float m = max(a.x, a.y);
  // halo quadrado curto em volta do disco
  vec3 halo = uSunDisc.rgb * (0.02 * exp(-(m - 1.0) * 4.0) + 0.004 * exp(-(m - 1.0) * 0.8));
  if (m > 1.0) return halo;
  // textura 8×8: centro claro, anéis levemente mais quentes/escuros
  vec2 px = floor((q / SIZE * 0.5 + 0.5) * 8.0);
  float ring = max(abs(px.x - 3.5), abs(px.y - 3.5));
  float k = ring > 3.0 ? 0.72 : (ring > 2.0 ? 0.88 : 1.0);
  k *= 0.94 + 0.06 * hash12(px + 11.0);
  vec3 tintEdge = mix(vec3(1.0), vec3(1.0, 0.82, 0.55), step(3.0, ring) * 0.6);
  return uSunDisc.rgb * k * tintEdge;
}

vec3 moonDisc(vec3 d) {
  vec3 M = uMoonDir.xyz;
  float cs = dot(d, M);
  if (cs < 0.9 || uMoonColor.w <= 0.0) return vec3(0.0);
  vec2 q = squareCoords(d, M);
  const float SIZE = 0.032;
  vec2 a = abs(q) / SIZE;
  float m = max(a.x, a.y);
  float lum = uMoonColor.w;
  vec3 tint = vec3(0.86, 0.92, 1.05);
  // halo largo e azulado
  float r = length(q) / SIZE;
  vec3 halo = tint * lum * (0.05 * exp(-max(r - 1.0, 0.0) * 1.6) + 0.012 * exp(-max(r - 1.0, 0.0) * 0.25));
  if (m > 1.0) return halo;
  vec2 px = floor((q / SIZE * 0.5 + 0.5) * 12.0);
  // mares escuros (manchas) e crateras em pixel art
  float mar = step(0.62, hash12(floor(px / 3.0) + 4.0)) * 0.22 + step(0.9, hash12(px + 9.0)) * 0.15;
  float base = (0.9 - mar) * (0.95 + 0.05 * hash12(px));
  // fase: 0 cheia … 0,5 nova; o terminador anda em degraus de pixel
  float ph = uMoonDir.w;
  float k = cos(ph * 2.0 * PI);
  float x = (px.x + 0.5) / 6.0 - 1.0;
  float s = ph < 0.5 ? 1.0 : -1.0;
  float lit = step(-k, s * x);
  float edge = max(abs(px.x - 5.5), abs(px.y - 5.5)) > 4.5 ? 0.85 : 1.0;
  return tint * lum * base * edge * mix(0.045, 1.0, lit) * 2.2 + halo * 0.5;
}

vec3 starField(vec3 d) {
  // gira com o céu (o sol percorre o plano XY; o eixo é Z)
  float ang = uSunDisc.w;
  float c = cos(ang), s = sin(ang);
  vec3 r = vec3(c * d.x - s * d.y, s * d.x + c * d.y, d.z);
  const float SCALE = 160.0;
  vec3 p = r * SCALE;
  vec3 cell = floor(p);
  float h = hash13(cell);
  if (h > 0.03) return vec3(0.0);
  vec3 j = hash33(cell + 17.0);
  vec3 f = p - (cell + 0.2 + 0.6 * j);
  f -= r * dot(f, r);
  // tamanho ~1 pixel (tela), estrelas mais brilhantes um pouco maiores
  float pixA = 2.0 / (uProj[1][1] * uScreen.y) * SCALE;
  float mag = pow(hash13(cell + 3.0), 7.0);
  float size = pixA * (0.55 + mag * 0.9);
  float dd = max(max(abs(f.x), abs(f.y)), abs(f.z));
  float star = 1.0 - smoothstep(size * 0.6, size, dd);
  float tw = 0.75 + 0.25 * sin(uCamPos.w * (2.0 + j.y * 4.0) + h * 900.0);
  vec3 col = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.86, 0.62), j.x);
  col = mix(col, vec3(1.0), 0.4);
  return col * star * tw * (0.08 + mag * 2.2);
}

// faixa da via láctea: bem sutil
vec3 milkyWay(vec3 d) {
  float ang = uSunDisc.w;
  float c = cos(ang), s = sin(ang);
  vec3 r = vec3(c * d.x - s * d.y, s * d.x + c * d.y, d.z);
  vec3 axis = normalize(vec3(0.3, 0.2, 1.0));
  float band = exp(-pow(dot(r, axis), 2.0) * 22.0);
  vec3 q = r * 9.0;
  float n = hash13(floor(q)) * 0.5 + hash13(floor(q * 2.3)) * 0.3 + hash13(floor(q * 5.1)) * 0.2;
  return vec3(0.55, 0.6, 0.85) * band * (0.25 + n) * 0.0045;
}

void main() {
  vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec4 wp = uInvViewProj * ndc;
  vec3 d = normalize(wp.xyz / wp.w);
  float depth = texture(uSceneDepth, vUv).r;
  bool sky = depth >= 1.0;
  float maxD = uCloudDist;
  if (!sky) {
    vec4 gp = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    maxD = min(maxD, length(gp.xyz / gp.w));
  }
  vec4 cl = traceClouds(d, maxD, 80);
  if (!sky) { outColor = cl; return; }
  // acima do horizonte, o céu; abaixo (além do alcance de renderização), o mar distante
  vec3 col = distantColor(d);
  float stars = uFx.w;
  if (stars > 0.0 && d.y > -0.05) col += (starField(d) + milkyWay(d)) * stars * smoothstep(-0.05, 0.1, d.y);
  col += sunDisc(d) + moonDisc(d);
  outColor = vec4(col * (1.0 - cl.a) + cl.rgb, 1.0);
}
`;
