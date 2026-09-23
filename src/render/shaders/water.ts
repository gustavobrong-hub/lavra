/** Água: ondas procedurais, fresnel, reflexo do céu/SSR, refração da cena por trás, absorção e espuma. */
import { COMMON_GLSL } from './common';

export const WATER_FS = /* glsl */ `
${COMMON_GLSL}
uniform sampler2D uSceneColor;   // cena opaca (antes da água)
uniform sampler2D uSceneDepth;   // profundidade opaca
uniform vec2 uNearFar;
uniform float uSSR;              // 1 = reflexos em espaço de tela

in vec3 vRel;
in vec2 vUV;
flat in uint vLayer;
flat in uint vNormal;
flat in uint vFlags;
in float vAO;
in vec2 vLight;
in vec3 vTint;
in vec3 vWorld;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;

float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNearFar.x * uNearFar.y) / (uNearFar.y + uNearFar.x - z * (uNearFar.y - uNearFar.x));
}

// altura das ondas (soma de senoides direcionais + ruído)
float waveH(vec2 p, float t) {
  float h = 0.0;
  h += sin(dot(p, vec2(0.8, 0.6)) * 1.3 + t * 1.6) * 0.035;
  h += sin(dot(p, vec2(-0.5, 0.9)) * 2.1 + t * 2.1) * 0.022;
  h += sin(dot(p, vec2(0.95, -0.3)) * 3.7 + t * 2.9) * 0.012;
  h += sin(dot(p, vec2(-0.2, -1.0)) * 5.3 + t * 3.7) * 0.007;
  return h;
}

vec3 waveNormal(vec2 p, float t, vec2 flow) {
  p -= flow * t * 1.2;
  float e = 0.05;
  float h = waveH(p, t);
  float hx = waveH(p + vec2(e, 0.0), t), hz = waveH(p + vec2(0.0, e), t);
  return normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
}

vec3 skyColor(vec3 d) {
  vec3 c = skyGradient(d);
  float sun = pow(max(dot(d, uSunDir.xyz), 0.0), 900.0) * 40.0 * uSunDir.w;
  return c + uSunColor.rgb * sun;
}

vec3 viewToScreen(vec3 rel) {
  vec4 c = uViewProj * vec4(rel, 1.0);
  return c.xyz / c.w * 0.5 + 0.5;
}

void main() {
  float t = uMisc.x / 20.0;
  vec2 flow = (vUV - 16.0) / 12.5; // codificado pelo mesher (256 = parado)
  if ((vFlags & 2u) == 0u) flow = vec2(0.0);
  vec3 V = normalize(-vRel);
  bool top = vNormal == 1u;
  bool underside = vNormal == 0u;
  vec3 N = top ? waveNormal(vWorld.xz, t, flow) : (underside ? vec3(0, -1, 0) : vec3(0.0, 0.0, 0.0));
  if (!top && !underside) {
    vec3 fn = normalize(cross(dFdx(vRel), dFdy(vRel)));
    N = dot(fn, V) < 0.0 ? -fn : fn;
  }
  vec3 waterCol = vTint;
  vec2 suv = gl_FragCoord.xy * uScreen.zw;
  float sceneZ = linearDepth(texture(uSceneDepth, suv).r);
  float surfZ = linearDepth(gl_FragCoord.z);
  float depth = max(sceneZ - surfZ, 0.0);
  // refração: desloca a amostra pela normal
  vec2 off = N.xz * 0.035 * clamp(depth, 0.0, 1.0);
  vec2 ruv = suv + off;
  float rz = linearDepth(texture(uSceneDepth, ruv).r);
  if (rz < surfZ) ruv = suv; // não refrata objetos na frente
  vec3 refr = texture(uSceneColor, ruv).rgb;
  float rdepth = max(linearDepth(texture(uSceneDepth, ruv).r) - surfZ, 0.0);
  // absorção (Beer-Lambert) com a cor do bioma
  vec3 absorb = exp(-rdepth * (vec3(1.0) - waterCol) * 0.55 - rdepth * 0.04);
  vec3 skyLit = uSkyAmbient.rgb * lightCurve(vLight.x) + uBlockLight.rgb * lightCurve(vLight.y) * 0.6;
  vec3 deepCol = waterCol * 0.12 * (skyLit + 0.02);
  vec3 under = mix(deepCol, refr, absorb);
  // reflexo
  vec3 R = reflect(-V, N);
  if (R.y < 0.0) R.y = -R.y * 0.3;
  vec3 refl = skyColor(R) * lightCurve(vLight.x) + uBlockLight.rgb * lightCurve(vLight.y) * 0.2;
  float hit = 0.0;
  if (uSSR > 0.5 && top) {
    // raymarch em espaço de tela sobre a cena opaca
    vec3 p = vRel;
    vec3 stepV = R * 0.5;
    for (int i = 0; i < 40; i++) {
      p += stepV;
      stepV *= 1.07;
      vec3 sp = viewToScreen(p);
      if (sp.x < 0.0 || sp.x > 1.0 || sp.y < 0.0 || sp.y > 1.0 || sp.z > 1.0) break;
      float sz = linearDepth(texture(uSceneDepth, sp.xy).r);
      float pz = linearDepth(sp.z);
      if (pz > sz && pz - sz < 3.0 + float(i) * 0.3) {
        float edge = smoothstep(0.0, 0.08, min(min(sp.x, 1.0 - sp.x), min(sp.y, 1.0 - sp.y)));
        refl = mix(refl, texture(uSceneColor, sp.xy).rgb, edge);
        hit = edge;
        break;
      }
    }
  }
  float F0 = 0.02;
  float fres = F0 + (1.0 - F0) * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  if (underside) fres = 0.1;
  vec3 color = mix(under, refl, clamp(fres, 0.0, 1.0));
  // brilho especular do sol
  vec3 H = normalize(uSunDir.xyz + V);
  float spec = pow(max(dot(N, H), 0.0), 380.0) * 3.5 * smoothstep(0.85, 0.95, vLight.x);
  color += uSunColor.rgb * spec * (1.0 - hit * 0.5);
  // espuma nas bordas rasas e em água corrente
  float foam = (1.0 - smoothstep(0.0, 0.35, depth)) * 0.55;
  foam += (vFlags & 2u) != 0u ? smoothstep(0.4, 1.0, length(flow)) * 0.15 : 0.0;
  float fn = hash12(floor(vWorld.xz * 8.0) + floor(t * 2.0));
  foam *= smoothstep(0.35, 0.8, fn + sin(t * 3.0 + vWorld.x * 2.0) * 0.2);
  color = mix(color, (skyLit + 0.05) * 0.9, clamp(foam, 0.0, 0.8));
  color = applyFog(color, vRel);
  outColor = vec4(color, 1.0);
  outNormal = vec4(N * 0.5 + 0.5, 0.95);
}
`;
