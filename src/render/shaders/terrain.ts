/** Shaders do terreno (camadas sólida, recortada e translúcida; também o passe de sombra). */
import { COMMON_GLSL, COMMON_VS_GLSL, LIGHTING_GLSL } from './common';

export const TERRAIN_VS = /* glsl */ `
${COMMON_VS_GLSL}
layout(location = 0) in uvec3 aData;
uniform vec3 uOrigin;
uniform mat4 uLightViewProj; // só no passe de sombra

out vec3 vRel;
out vec2 vUV;
flat out uint vLayer;
flat out uint vNormal;
flat out uint vFlags;
flat out uint vWave;
out float vAO;
out vec2 vLight;
out vec3 vTint;
out vec3 vWorld;

vec3 wind(vec3 wp, float t, float amp) {
  float s = uMisc.y;
  return vec3(
    sin(t * 1.9 + wp.x * 0.61 + wp.z * 0.33) + 0.5 * sin(t * 3.3 + wp.z * 1.3),
    0.0,
    cos(t * 1.5 + wp.z * 0.57 + wp.x * 0.21) + 0.5 * cos(t * 2.7 + wp.x * 1.1)
  ) * amp * s;
}

void main() {
  uint w0 = aData.x, w1 = aData.y, w2 = aData.z;
  vec3 p = vec3(float(w0 & 511u), float((w0 >> 9u) & 511u), float((w0 >> 18u) & 511u)) * (1.0 / 16.0);
  vNormal = (w0 >> 27u) & 7u;
  uint wave = (w0 >> 30u) & 3u;
  vWave = wave;
  vUV = vec2(float(w1 & 511u), float((w1 >> 9u) & 511u)) * (1.0 / 16.0);
  vLayer = (w1 >> 18u) & 2047u;
  vAO = float((w1 >> 29u) & 3u) / 3.0;
  vLight = vec2(float(w2 & 63u), float((w2 >> 6u) & 63u)) / 60.0;
  vFlags = (w2 >> 12u) & 15u;
  uint t565 = w2 >> 16u;
  vTint = srgbToLinear(vec3(float((t565 >> 11u) & 31u) / 31.0, float((t565 >> 5u) & 63u) / 63.0, float(t565 & 31u) / 31.0));
  vec3 rel = uOrigin + p;
  vec3 wp = rel + uCamPos.xyz;
  vWorld = wp;
  if (wave != 0u) {
    float t = uMisc.x / 20.0;
    if (wave == 1u) {
      rel += wind(wp, t, 0.045) + vec3(0.0, sin(t * 2.3 + wp.x + wp.z) * 0.02 * uMisc.y, 0.0);
    } else {
      float k = wave == 2u ? 1.0 - clamp(vUV.y, 0.0, 1.0) : 2.0 - clamp(vUV.y, 0.0, 1.0);
      rel += wind(wp, t, 0.09) * k;
    }
  }
  vRel = rel;
#ifdef SHADOW_PASS
  gl_Position = uLightViewProj * vec4(rel, 1.0);
#else
  gl_Position = uViewProj * vec4(rel, 1.0);
#endif
}
`;

export const TERRAIN_FS = /* glsl */ `
${COMMON_GLSL}
${LIGHTING_GLSL}
uniform sampler2DArray uAlbedo;
uniform sampler2DArray uNormalMap;
uniform sampler2DArray uSpec;
uniform usampler2D uMeta;

in vec3 vRel;
in vec2 vUV;
flat in uint vLayer;
flat in uint vNormal;
flat in uint vFlags;
flat in uint vWave;
in float vAO;
in vec2 vLight;
in vec3 vTint;
in vec3 vWorld;

#ifdef SHADOW_PASS
out vec4 outColor;
#else
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;
#endif

const vec3 NORMALS[6] = vec3[6](vec3(0,-1,0), vec3(0,1,0), vec3(0,0,-1), vec3(0,0,1), vec3(-1,0,0), vec3(1,0,0));

// base TBN a partir das derivadas (funciona com qualquer orientação de UV)
mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
  vec3 dp1 = dFdx(p), dp2 = dFdy(p);
  vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-12);
  return mat3(T * invmax, B * invmax, N);
}

void main() {
  uvec4 meta = texelFetch(uMeta, ivec2(int(vLayer), 0), 0);
  uint frames = max(meta.x, 1u);
  uint mflags = meta.z;
  float layer = float(vLayer);
  if (frames > 1u) layer += float((uint(uMisc.x) / max(meta.y, 1u)) % frames);
  vec2 uv = vUV;
  vec2 duvx = dFdx(uv), duvy = dFdy(uv);
  // rotação aleatória por bloco (quebra a repetição)
  if ((mflags & 2u) != 0u && vNormal < 6u) {
    vec3 cell = floor(vWorld - NORMALS[vNormal] * 0.01);
    float r = floor(hash13(cell) * 4.0);
    vec2 f = fract(uv) - 0.5, base = floor(uv);
    if (r == 1.0) f = vec2(-f.y, f.x); else if (r == 2.0) f = -f; else if (r == 3.0) f = vec2(f.y, -f.x);
    uv = base + f + 0.5;
  }
  vec4 albedo = textureGrad(uAlbedo, vec3(uv, layer), duvx, duvy);
#if defined(CUTOUT) || defined(SHADOW_PASS)
  if ((mflags & 4u) != 0u && albedo.a < 0.5) discard;
#endif
#ifdef SHADOW_PASS
  outColor = vec4(1.0);
  return;
#else
  vec3 tint = vTint;
  if ((mflags & 1u) != 0u) albedo.rgb *= mix(vec3(1.0), tint, albedo.a);
  else albedo.rgb *= tint;
  vec3 N;
  if (vNormal < 6u) N = NORMALS[vNormal];
  else if (vNormal == 6u) N = vec3(0.0, 1.0, 0.0);
  else N = normalize(cross(dFdx(vRel), dFdy(vRel)));
  vec3 V = normalize(-vRel);
  if (vNormal == 7u && dot(N, V) < 0.0) N = -N;
  vec4 nm = textureGrad(uNormalMap, vec3(uv, layer), duvx, duvy);
  vec4 sp = textureGrad(uSpec, vec3(uv, layer), duvx, duvy);
  vec3 Nmap = N;
  if (vNormal != 6u) {
    mat3 tbn = cotangentFrame(N, vRel, uv);
    vec3 tn = nm.xyz * 2.0 - 1.0;
    Nmap = normalize(tbn * tn);
    if (dot(Nmap, N) < 0.2) Nmap = N;
  }
  float smoothness = sp.r, metal = sp.g, porosity = sp.b;
  float emission = max(sp.a, float(meta.w) / 255.0);
  if ((vFlags & 4u) != 0u) emission = max(emission, 0.0);
  // superfície molhada pela chuva (só exposta ao céu e virada para cima)
  float wet = uWeather.z * smoothstep(0.85, 0.97, vLight.x) * smoothstep(0.3, 0.9, N.y);
  if (wet > 0.0) {
    float puddle = smoothstep(0.55, 0.75, hash12(floor(vWorld.xz * 0.5)) * 0.4 + nm.a * 0.6) * wet;
    albedo.rgb *= mix(1.0, 0.55, wet * porosity);
    smoothness = mix(smoothness, 0.93, max(wet * 0.6, puddle));
    Nmap = normalize(mix(Nmap, N, puddle));
  }
  float ao = mix(1.0, 0.28 + 0.72 * vAO, uMisc.z);
  float foliage = vWave != 0u ? 1.0 : 0.0;
  vec3 color = surfaceLight(albedo.rgb, Nmap, N, vRel, vLight.x, vLight.y, ao, smoothness, metal, porosity, V, emission * uMisc.w, foliage);
  if ((vFlags & 1u) != 0u) {
    // cáusticas simples no fundo d'água
    float t = uMisc.x / 20.0;
    vec2 c = vWorld.xz * 1.3;
    float cz = abs(sin(c.x + t * 1.1 + sin(c.y * 1.7 + t)) * sin(c.y * 1.2 - t * 0.9 + sin(c.x * 1.4 - t * 0.7)));
    color *= 0.75 + pow(cz, 3.0) * 1.2 * lightCurve(vLight.x);
  }
  color = applyFog(color, vRel);
#ifdef TRANSLUCENT
  // vidro perto de tochas/lanternas: a luz de dentro "acende" a janela vista de fora
  float glow = pow(vLight.y, 3.0) * (1.0 - vLight.x * 0.6);
  color += vec3(1.0, 0.6, 0.28) * glow * 0.55 * (1.0 - albedo.a * 0.5);
  outColor = vec4(color * albedo.a + vec3(1.0, 0.6, 0.28) * glow * 0.35 * (1.0 - albedo.a), albedo.a);
#else
  outColor = vec4(color, 1.0);
#endif
  outNormal = vec4(Nmap * 0.5 + 0.5, smoothness);
#endif
}
`;
