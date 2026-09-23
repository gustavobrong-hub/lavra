/**
 * Shaders de entidades/objetos do Three (itens, blocos caindo, criaturas, mão).
 * Usam os mesmos nomes de uniform do bloco Frame (como uniforms comuns), então reaproveitam
 * a mesma iluminação e neblina do terreno.
 */
import { LIGHTING_GLSL } from './common';

/** Mesmos nomes do UBO, como uniforms soltos (atualizados pelo pipeline a cada frame). */
export const FRAME_UNIFORMS_GLSL = /* glsl */ `
uniform vec4 uCamPos;
uniform vec4 uSunDir;
uniform vec4 uMoonDir;
uniform vec4 uSunColor;
uniform vec4 uSkyAmbient;
uniform vec4 uFogColor;
uniform vec4 uFogParams;
uniform vec4 uBlockLight;
uniform vec4 uWeather;
uniform vec4 uMisc;
uniform vec4 uSkyZenith;
uniform vec4 uSkyHorizon;
const float PI = 3.14159265;
float lightCurve(float f) { return f / (4.0 - 3.0 * f); }
vec3 skyGradient(vec3 d) {
  vec3 col = mix(uSkyHorizon.rgb, uSkyZenith.rgb, pow(clamp(d.y, 0.0, 1.0), 0.55));
  col = mix(col, uSkyHorizon.rgb * 0.35, smoothstep(0.0, -0.3, d.y));
  float sd = max(dot(d, uSunDir.xyz), 0.0);
  col += uSunColor.rgb * (pow(sd, 12.0) * 0.12 + pow(sd, 180.0) * 0.6) * uSunDir.w;
  return col;
}
vec3 applyFog(vec3 color, vec3 rel) {
  float dist = length(rel);
  vec3 dir = rel / max(dist, 1e-4);
  float f = 1.0 - exp(-dist * uFogColor.w);
  f = max(f, smoothstep(uFogParams.x, uFogParams.y, dist));
  vec3 fogCol = (uFogParams.z > 0.5 || uFogParams.w > 0.5) ? uFogColor.rgb : skyGradient(normalize(vec3(dir.x, max(dir.y, 0.0), dir.z)));
  return mix(color, fogCol, clamp(f, 0.0, 1.0));
}
${LIGHTING_GLSL}
`;

export const ENTITY_VS = /* glsl */ `
in float layer;
out vec3 vRel;
out vec3 vN;
out vec2 vUv;
flat out float vLayer;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vRel = wp.xyz; // a cena é relativa à câmera
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vLayer = layer;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ENTITY_FS = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
${FRAME_UNIFORMS_GLSL}
uniform vec2 uLight;       // céu, bloco (0..1)
uniform vec4 uOverlay;     // rgb, força (vermelho do dano, branco da explosão)
uniform vec3 uTint;
uniform float uAlpha;
uniform float uEmissive;
#ifdef BLOCK_ARRAY
uniform sampler2DArray uBlocks;
#else
uniform sampler2D uMap;
#endif
in vec3 vRel;
in vec3 vN;
in vec2 vUv;
flat in float vLayer;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;
void main() {
#ifdef BLOCK_ARRAY
  vec4 albedo = texture(uBlocks, vec3(vUv, vLayer));
#else
  vec4 albedo = texture(uMap, vUv);
#endif
  if (albedo.a < 0.5) discard;
  albedo.rgb *= uTint;
  vec3 N = normalize(vN);
  vec3 V = normalize(-vRel);
  vec3 color = surfaceLight(albedo.rgb, N, uLight.x, uLight.y, 1.0, 1.0, 0.25, 0.0, 0.5, V, uEmissive);
  color = mix(color, uOverlay.rgb * max(0.2, lightCurve(max(uLight.x, uLight.y))), uOverlay.a);
  color = applyFog(color, vRel);
  outColor = vec4(color, uAlpha);
  outNormal = vec4(N * 0.5 + 0.5, 0.25);
}
`;
