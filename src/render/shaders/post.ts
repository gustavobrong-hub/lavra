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
uniform float uExposure;
uniform float uBloomStrength;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
uniform vec3 uLift;
uniform vec3 uGain;
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

void main() {
  vec3 hdr = texture(tColor, vUv).rgb;
  hdr += texture(tBloom, vUv).rgb * uBloomStrength;
  if (uUnderwater > 0.5) hdr = mix(hdr, uUnderwaterColor, 0.15);
  vec3 c = aces(hdr * uExposure);
  // gradação
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContrast + 0.5;
  c = c * uGain + uLift * (1.0 - c);
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
