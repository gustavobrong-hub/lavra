/** Trechos GLSL compartilhados (iluminação, neblina, utilidades). */
import { FRAME_GLSL } from '../gl/frameubo';

export const COMMON_GLSL = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp usampler2D;
${FRAME_GLSL}

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

// Curva de brilho do original: f/(4-3f), com um mínimo de ambiente
float lightCurve(float f) { return f / (4.0 - 3.0 * f); }

vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }

// Gradiente do céu (usado pelo céu, pela neblina e pelos reflexos)
vec3 skyGradient(vec3 d) {
  float y = d.y;
  vec3 col = mix(uSkyHorizon.rgb, uSkyZenith.rgb, pow(clamp(y, 0.0, 1.0), 0.55));
  col = mix(col, uSkyHorizon.rgb * 0.35, smoothstep(0.0, -0.3, y));
  float sd = max(dot(d, uSunDir.xyz), 0.0);
  col += uSunColor.rgb * (pow(sd, 12.0) * 0.12 + pow(sd, 180.0) * 0.6) * uSunDir.w;
  return col;
}

// Neblina atmosférica + borda da distância de renderização (cor = céu na mesma direção)
vec3 applyFog(vec3 color, vec3 rel) {
  float dist = length(rel);
  vec3 dir = rel / max(dist, 1e-4);
  if (uFogParams.z > 0.5 || uFogParams.w > 0.5) {
    // debaixo d'água / lava: névoa densa da cor do meio
    float f = 1.0 - exp(-dist * uFogColor.w);
    f = max(f, smoothstep(uFogParams.x, uFogParams.y, dist));
    return mix(color, uFogColor.rgb, clamp(f, 0.0, 1.0));
  }
  float f = 1.0 - exp(-dist * uFogColor.w);
  f = max(f, smoothstep(uFogParams.x, uFogParams.y, dist));
  vec3 fogCol = skyGradient(normalize(vec3(dir.x, max(dir.y, 0.0), dir.z)));
  return mix(color, fogCol, clamp(f, 0.0, 1.0));
}
`;

/** Iluminação de superfície compartilhada por terreno e entidades. */
export const LIGHTING_GLSL = /* glsl */ `
// N: normal no mundo; skyL/blkL em 0..1; ao em 0..1; shadow em 0..1
vec3 surfaceLight(vec3 albedo, vec3 N, float skyL, float blkL, float ao, float shadow, float smoothness, float metal, float porosity, vec3 V, float emission) {
  float skyB = lightCurve(skyL);
  float blkB = lightCurve(blkL);
  // hemisfério: mais luz de cima
  float hemi = 0.6 + 0.4 * (N.y * 0.5 + 0.5);
  vec3 ambient = uSkyAmbient.rgb * skyB * hemi;
  // luz de tocha quente com leve cintilação
  vec3 torch = uBlockLight.rgb * blkB * blkB * (1.0 + uBlockLight.w);
  vec3 minAmb = vec3(0.012, 0.013, 0.018);
  // luz direta do sol/lua (só onde o céu alcança)
  float sunVis = smoothstep(0.6, 0.93, skyL);
  float ndl = max(dot(N, uSunDir.xyz), 0.0);
  vec3 direct = uSunColor.rgb * ndl * shadow * sunVis;
  // especular GGX simplificado
  vec3 H = normalize(uSunDir.xyz + V);
  float rough = clamp(1.0 - smoothness, 0.04, 1.0);
  float a2 = rough * rough * rough * rough;
  float ndh = max(dot(N, H), 0.0);
  float d = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * d * d);
  float F0 = mix(0.04, 1.0, metal);
  float fres = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  vec3 spec = uSunColor.rgb * D * fres * ndl * shadow * sunVis * 0.25;
  vec3 diffuseAlb = albedo * (1.0 - metal);
  vec3 color = diffuseAlb * ((ambient + torch) * ao + direct + minAmb * ao) + spec * mix(vec3(1.0), albedo, metal);
  // reflexo do céu em superfícies lisas/molhadas
  vec3 R = reflect(-V, N);
  float skyRefl = smoothstep(-0.2, 0.5, R.y) * skyB;
  vec3 envCol = mix(uSkyHorizon.rgb, uSkyZenith.rgb, clamp(R.y, 0.0, 1.0));
  float envF = F0 + (1.0 - F0) * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  color += envCol * skyRefl * envF * smoothness * smoothness * mix(vec3(1.0), albedo, metal) * ao;
  color += albedo * emission * 4.0;
  return color;
}
`;
