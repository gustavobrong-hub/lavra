/**
 * Shaders de entidades/objetos do Three (itens, blocos caindo, criaturas, mão).
 * Usam os mesmos nomes de uniform do bloco Frame (como uniforms comuns), então reaproveitam
 * a mesma iluminação e neblina do terreno.
 */
import { LIGHTING_GLSL, SKY_FUNCS_GLSL, UTIL_GLSL } from './common';

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
uniform vec4 uSunPos;
uniform vec4 uSunDisc;
uniform vec4 uClouds;
uniform vec4 uFx;
uniform vec4 uCascades;
uniform vec4 uShadowParams;
uniform mat4 uShadow[4];
uniform sampler2D uSkyLUT;
uniform sampler2D uCloudMap;
uniform highp sampler2DArrayShadow uShadowMap;
${UTIL_GLSL}
${SKY_FUNCS_GLSL}
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
#ifdef TRANSLUCENT
  if (albedo.a < 0.02) discard;
#else
  if (albedo.a < 0.5) discard;
#endif
  albedo.rgb *= uTint;
  // vermelho de dano / clarão: tinge o material antes da luz (respeita a escuridão)
  albedo.rgb = mix(albedo.rgb, uOverlay.rgb, uOverlay.a);
  vec3 N = normalize(vN);
  vec3 V = normalize(-vRel);
  vec3 color = surfaceLight(albedo.rgb, N, N, vRel, uLight.x, uLight.y, 1.0, 0.25, 0.0, 0.5, V, uEmissive, 0.0);
  color = applyFog(color, vRel);
#ifdef TRANSLUCENT
  outColor = vec4(color, albedo.a * uAlpha);
#else
  outColor = vec4(color, uAlpha);
#endif
  outNormal = vec4(N * 0.5 + 0.5, 0.25);
}
`;
