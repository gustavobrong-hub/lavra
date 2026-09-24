/** Pós-processamento base: tonemapping fílmico (AgX-like/ACES), exposição, correção de cor e FXAA. */

export const POST_VS = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const TONEMAP_FS = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform sampler2D tRays;
uniform sampler2D tExposure;     // 1×1: r = luminância média adaptada, g = visibilidade do sol
uniform float uExposure;
uniform float uAutoExposure;
uniform vec4 uExpCurve;          // chave, expoente, mínimo, máximo
uniform float uBloomStrength;
uniform float uRayStrength;
uniform vec2 uSunUV;
uniform float uFlare;
uniform vec3 uFlareColor;
uniform float uAspect;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uWarmth;
uniform vec3 uGrade;
uniform float uTime;
uniform float uUnderwater;
uniform vec3 uUnderwaterColor;
in vec2 vUv;
out vec4 outColor;

// ACES (ajuste de Narkowicz) — curva fílmica
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// lens flare: fantasmas ao longo do eixo sol → centro, anel e um risco horizontal
vec3 lensFlare(vec2 uv) {
  vec2 axis = vec2(0.5) - uSunUV;
  vec3 acc = vec3(0.0);
  const float T[6] = float[6](0.28, 0.55, 0.82, 1.18, 1.52, 1.9);
  const float S[6] = float[6](0.035, 0.018, 0.07, 0.03, 0.11, 0.05);
  const vec3 C[6] = vec3[6](vec3(1.0, 0.62, 0.3), vec3(0.45, 1.0, 0.6), vec3(0.55, 0.62, 1.0), vec3(1.0, 0.45, 0.75), vec3(0.5, 0.75, 1.0), vec3(1.0, 0.8, 0.45));
  for (int i = 0; i < 6; i++) {
    vec2 p = uSunUV + axis * T[i];
    vec2 d = (uv - p) * vec2(uAspect, 1.0);
    float hex = max(abs(d.x) * 0.866 + abs(d.y) * 0.5, abs(d.y));
    float g = smoothstep(S[i], S[i] * 0.72, hex) * 0.35 + exp(-dot(d, d) / (S[i] * S[i])) * 0.12;
    acc += C[i] * g;
  }
  vec2 ds = (uv - uSunUV) * vec2(uAspect, 1.0);
  float rs = length(ds);
  acc += vec3(0.55, 0.7, 1.0) * smoothstep(0.018, 0.0, abs(rs - 0.3)) * 0.05;
  acc += vec3(1.0) * exp(-abs(ds.y) * 160.0) * exp(-abs(ds.x) * 3.0) * 0.35;
  return acc * uFlareColor;
}

void main() {
  vec3 hdr = texture(tColor, vUv).rgb;
  vec4 ex = texture(tExposure, vec2(0.5));
  hdr += texture(tBloom, vUv).rgb * uBloomStrength;
  hdr += texture(tRays, vUv).rgb * uRayStrength;
  if (uFlare > 0.0 && ex.g > 0.001) hdr += lensFlare(vUv) * uFlare * ex.g;
  if (uUnderwater > 0.5) hdr = mix(hdr, uUnderwaterColor, 0.15);
  float expo = uExposure;
  if (uAutoExposure > 0.5) expo *= clamp(pow(uExpCurve.x / max(ex.r, 1e-5), uExpCurve.y), uExpCurve.z, uExpCurve.w);
  vec3 c = aces(hdr * expo * uGrade);
  // gradação: saturação, contraste, lift/gain e um leve contraste de temperatura (sombras frias, luzes quentes)
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContrast + 0.5;
  c = c * uGain + uLift * (1.0 - c);
  c *= mix(vec3(0.97, 0.99, 1.05), vec3(1.05, 1.0, 0.94), smoothstep(0.1, 0.8, l) * uWarmth + (1.0 - uWarmth) * 0.5);
  // vinheta
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * uVignette;
  c = toSRGB(clamp(c, 0.0, 1.0));
  // dithering para evitar faixas
  float n = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) / 255.0;
  outColor = vec4(c, 1.0);
}
`;

export const FXAA_FS = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uInvRes;
in vec2 vUv;
out vec4 outColor;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec3 rgbM = texture(tColor, vUv).rgb;
  vec3 rgbNW = texture(tColor, vUv + vec2(-1.0, -1.0) * uInvRes).rgb;
  vec3 rgbNE = texture(tColor, vUv + vec2(1.0, -1.0) * uInvRes).rgb;
  vec3 rgbSW = texture(tColor, vUv + vec2(-1.0, 1.0) * uInvRes).rgb;
  vec3 rgbSE = texture(tColor, vUv + vec2(1.0, 1.0) * uInvRes).rgb;
  float lM = luma(rgbM), lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * rcp, -8.0, 8.0) * uInvRes;
  vec3 a = 0.5 * (texture(tColor, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(tColor, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture(tColor, vUv + dir * -0.5).rgb + texture(tColor, vUv + dir * 0.5).rgb);
  float lB = luma(b);
  outColor = vec4((lB < lMin || lB > lMax) ? a : b, 1.0);
}
`;
