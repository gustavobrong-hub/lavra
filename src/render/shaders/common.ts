/** Trechos GLSL compartilhados (iluminação, céu, neblina, nuvens, sombras, utilidades). */
import { FRAME_GLSL } from '../gl/frameubo';

/** Utilidades sem dependência de uniforms. */
export const UTIL_GLSL = /* glsl */ `
const float PI = 3.14159265;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// Curva de brilho do original: f/(4-3f)
float lightCurve(float f) { return f / (4.0 - 3.0 * f); }

vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }

// ruído de gradiente intercalado (Jimenez), para girar kernels por pixel
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

/**
 * Funções de céu, neblina, nuvens e sombra. Dependem dos nomes do bloco Frame (uSunDir, uClouds…)
 * e dos samplers uSkyLUT, uCloudMap e uShadowMap — declarados por quem inclui.
 */
export const SKY_FUNCS_GLSL = /* glsl */ `
// LUT do céu: u = azimute/2π, v = sqrt(elevação/(π/2))
vec2 skyLUTuv(vec3 d) {
  float el = asin(clamp(d.y, 0.0, 1.0));
  float v = sqrt(el / (PI * 0.5));
  float u = atan(d.z, d.x) * (0.5 / PI);
  return vec2(fract(u), clamp(v, 0.004, 0.996));
}
vec3 skyLUT(vec3 d) { return textureLod(uSkyLUT, skyLUTuv(d), 0.0).rgb; }
// compatibilidade com o código antigo
vec3 skyGradient(vec3 d) { return skyLUT(d); }

// Irradiância difusa do céu para uma normal (mipmaps da LUT: 4×2 → faixa do horizonte e alto do céu)
vec3 skyIrradiance(vec3 N) {
  float u = atan(N.z, N.x) * (0.5 / PI);
  vec3 up = textureLod(uSkyLUT, vec2(u, 0.75), 6.0).rgb;
  vec3 side = textureLod(uSkyLUT, vec2(u, 0.25), 6.0).rgb;
  vec3 avg = textureLod(uSkyLUT, vec2(0.5, 0.5), 8.0).rgb;
  float ny = clamp(N.y, -1.0, 1.0);
  vec3 sky = mix(mix(side, up, 0.35), mix(up, avg, 0.35), max(ny, 0.0));
  vec3 ground = avg * vec3(0.34, 0.31, 0.26);
  return mix(ground, sky, 0.5 + 0.5 * ny) * 1.6;
}

// Cor do "infinito" numa direção: céu acima do horizonte; abaixo, um mar distante refletindo o céu,
// enevoado perto do horizonte (usado pelo céu e pela borda da névoa, para não haver emenda)
vec3 distantColor(vec3 d) {
  if (d.y >= 0.0) return skyLUT(d);
  vec3 m = vec3(d.x, -d.y, d.z);
  float fr = 0.05 + 0.95 * pow(1.0 - min(-d.y * 1.2, 1.0), 6.0);
  vec3 sea = mix(skyIrradiance(vec3(0.0, 1.0, 0.0)) * 0.08, skyLUT(m), fr);
  float haze = exp(-(-d.y) * 14.0);
  return mix(sea, skyLUT(normalize(vec3(d.x, 0.02, d.z))), haze);
}

// Neblina: atmosfera (exponencial) + névoa baixa (exponencial na altura) + borda da distância de renderização
vec3 applyFog(vec3 color, vec3 rel) {
  float dist = length(rel);
  vec3 dir = rel / max(dist, 1e-4);
  if (uFogParams.z > 0.5 || uFogParams.w > 0.5) {
    // debaixo d'água / lava: névoa densa da cor do meio
    float f = 1.0 - exp(-dist * uFogColor.w);
    f = max(f, smoothstep(uFogParams.x, uFogParams.y, dist));
    return mix(color, uFogColor.rgb, clamp(f, 0.0, 1.0));
  }
  // névoa baixa: densidade a·exp(-(y-63)/H), integrada ao longo do raio
  float camY = uCamPos.y;
  const float HF = 16.0;
  float a = uFx.x * exp(-(camY - 63.0) / HF);
  float k = dir.y * dist / HF;
  float hf = abs(k) > 1e-3 ? a * dist * (1.0 - exp(-k)) / k : a * dist;
  float f = 1.0 - exp(-dist * uFogColor.w - max(hf, 0.0));
  float edge = smoothstep(uFogParams.x, uFogParams.y, dist);
  vec3 hd = normalize(vec3(dir.x, max(dir.y, 0.0) * 0.6 + 0.035, dir.z));
  vec3 fogCol = skyLUT(hd);
  // brilho do sol atravessando a névoa (espalhamento para a frente)
  float sd = max(dot(dir, uSunPos.xyz), 0.0);
  fogCol += uSunDisc.rgb * (1.0 / 28.0) * (pow(sd, 8.0) * 0.04 + pow(sd, 60.0) * 0.06) * clamp(hf, 0.0, 1.0);
  return mix(color, mix(fogCol, distantColor(dir), edge), clamp(max(f, edge), 0.0, 1.0));
}

// ---------------------------------------------------------------- nuvens em blocos
const float CLOUD_CELL = 12.0;
const float CLOUD_H = 4.0;
// valor (0..1) do mapa de nuvens de uma célula; cheia se > 1 - cobertura
float cloudValue(vec2 cell) {
  return texelFetch(uCloudMap, ivec2(mod(cell, 1024.0)), 0).r;
}
bool cloudFilled(vec2 cell) { return cloudValue(cell) > 1.0 - uClouds.z; }

// Sombra das nuvens na luz direta (bordas suavizadas ~1 bloco)
float cloudShadow(vec3 rel) {
  vec3 L = uSunDir.xyz;
  if (L.y < 0.03 || uClouds.z <= 0.0) return 1.0;
  float t = (uClouds.w + CLOUD_H * 0.5 - rel.y) / L.y;
  if (t < 0.0) return 1.0;
  vec2 pc = (rel.xz + L.xz * t + uClouds.xy) / CLOUD_CELL - 0.5;
  vec2 c = floor(pc);
  vec2 f = clamp((fract(pc) - 0.5) / 0.12 + 0.5, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  float thr = 1.0 - uClouds.z;
  float a = step(thr, cloudValue(c)), b = step(thr, cloudValue(c + vec2(1.0, 0.0)));
  float cc = step(thr, cloudValue(c + vec2(0.0, 1.0))), d = step(thr, cloudValue(c + vec2(1.0, 1.0)));
  float cov = mix(mix(a, b, f.x), mix(cc, d, f.x), f.y);
  // nuvens além da distância em que são desenhadas não fazem sombra (sol baixo)
  cov *= 1.0 - smoothstep(450.0, 850.0, t);
  return 1.0 - cov * 0.62 * smoothstep(0.03, 0.15, L.y);
}

// ---------------------------------------------------------------- sombras (cascatas, PCF suave)
const vec2 VOGEL[12] = vec2[12](
  vec2(0.2041, 0.0), vec2(-0.3232, 0.2956), vec2(0.0506, -0.5751), vec2(0.4038, 0.5147),
  vec2(-0.7383, -0.1227), vec2(0.6933, -0.4239), vec2(-0.2211, 0.8352), vec2(-0.4586, -0.7876),
  vec2(0.9072, 0.2584), vec2(-0.9171, 0.4012), vec2(0.3528, -0.9398), vec2(0.4506, 0.8843)
);

// Retorna a visibilidade da luz (0..1) ou -1 fora do alcance das sombras.
float shadowFactor(vec3 rel, vec3 Ng, float ndl) {
  int nc = int(uShadowParams.x + 0.5);
  if (nc == 0) return -1.0;
  float size = uShadowParams.y;
  float a = ign(gl_FragCoord.xy) * 6.2831853;
  mat2 rot = mat2(cos(a), sin(a), -sin(a), cos(a));
  for (int c = 0; c < 4; c++) {
    if (c >= nc) break;
    float texel = uCascades[c];
    vec3 p = rel + Ng * texel * (1.2 + 2.5 * (1.0 - clamp(ndl, 0.0, 1.0)));
    vec3 s = (uShadow[c] * vec4(p, 1.0)).xyz * 0.5 + 0.5;
    float margin = 4.0 / size;
    if (s.x < margin || s.y < margin || s.x > 1.0 - margin || s.y > 1.0 - margin || s.z > 0.999) continue;
    float radius = max(uShadowParams.z / texel, 1.0) / size;
    float bias = texel * 0.6 / (texel * size + uShadowParams.w);
    float sum = 0.0;
    for (int i = 0; i < 12; i++) {
      vec2 o = rot * VOGEL[i] * radius;
      sum += texture(uShadowMap, vec4(s.xy + o, float(c), s.z - bias));
    }
    float sh = sum / 12.0;
    if (c == nc - 1) {
      float e = max(abs(s.x - 0.5), abs(s.y - 0.5)) * 2.0;
      sh = mix(sh, -1.0, smoothstep(0.8, 0.98, e));
    }
    return sh;
  }
  return -1.0;
}
`;

/** Cabeçalho para shaders de vértice (sem funções que só existem no fragmento). */
export const COMMON_VS_GLSL = /* glsl */ `
precision highp float;
precision highp int;
${FRAME_GLSL}
${UTIL_GLSL}
`;

export const COMMON_GLSL = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp usampler2D;
precision highp sampler2DArrayShadow;
${FRAME_GLSL}
uniform sampler2D uSkyLUT;
uniform sampler2D uCloudMap;
uniform sampler2DArrayShadow uShadowMap;
${UTIL_GLSL}
${SKY_FUNCS_GLSL}
`;

/** Iluminação de superfície compartilhada por terreno e entidades. */
export const LIGHTING_GLSL = /* glsl */ `
// N: normal (com mapa); Ng: normal geométrica; skyL/blkL em 0..1; ao em 0..1;
// foliage: 1 para folhas/plantas (luz atravessando). rel: posição relativa à câmera.
vec3 surfaceLight(vec3 albedo, vec3 N, vec3 Ng, vec3 rel, float skyL, float blkL, float ao, float smoothness, float metal, float porosity, vec3 V, float emission, float foliage) {
  float skyB = lightCurve(skyL);
  float blkB = lightCurve(blkL);
  vec3 L = uSunDir.xyz;
  // ambiente do céu (direcional, da LUT) e tocha quente com leve cintilação
  vec3 ambient = skyIrradiance(N) * skyB;
  vec3 torch = uBlockLight.rgb * blkB * blkB * (1.0 + uBlockLight.w);
  vec3 minAmb = vec3(0.010, 0.011, 0.016);
  float ndlRaw = dot(Ng, L);
  float ndl = foliage > 0.5 ? 0.35 + 0.65 * abs(dot(N, L)) : max(dot(N, L), 0.0);
  // sombra: mapa de sombras quando disponível; senão, aproximação pela luz do céu
  float vis = 0.0;
  if (ndl > 0.0 && skyL > 0.05) {
    float sh = shadowFactor(rel, Ng, foliage > 0.5 ? 1.0 : ndlRaw);
    vis = sh >= 0.0 ? sh * smoothstep(0.2, 0.5, skyL) : smoothstep(0.6, 0.93, skyL);
    vis *= cloudShadow(rel);
  }
  vec3 sun = uSunColor.rgb * vis;
  vec3 direct = sun * ndl;
  // folhas contra a luz: brilho translúcido
  if (foliage > 0.5) direct += sun * pow(max(dot(-V, L), 0.0), 3.0) * 0.9 * albedo * 1.5;
  // especular GGX
  vec3 H = normalize(L + V);
  float rough = clamp(1.0 - smoothness, 0.04, 1.0);
  float a2 = rough * rough * rough * rough;
  float ndh = max(dot(N, H), 0.0);
  float d = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * d * d);
  float F0 = mix(0.04, 1.0, metal);
  float fres = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  vec3 spec = sun * D * fres * max(dot(N, L), 0.0) * 0.25;
  vec3 diffuseAlb = albedo * (1.0 - metal * 0.85);
  vec3 color = diffuseAlb * ((ambient + torch + minAmb) * ao + direct) + spec * mix(vec3(1.0), albedo, metal);
  // metais refletem também a luz das tochas
  color += albedo * metal * torch * ao * 0.6;
  // reflexo do céu em superfícies lisas/molhadas
  vec3 R = reflect(-V, N);
  float skyRefl = smoothstep(-0.2, 0.5, R.y) * skyB;
  vec3 envCol = skyLUT(normalize(vec3(R.x, max(R.y, 0.0), R.z)));
  float envF = F0 + (1.0 - F0) * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  color += envCol * skyRefl * envF * smoothness * smoothness * mix(vec3(1.0), albedo, metal) * ao;
  color += albedo * emission * 4.0;
  return color;
}
`;
