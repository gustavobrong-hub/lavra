/**
 * Água: ondas procedurais, fresnel, reflexo em espaço de tela (com refino) e céu/nuvens analíticos
 * quando o raio escapa, trilha de brilho do sol (GGX) sombreada, refração com absorção e espuma.
 */
import { COMMON_GLSL } from './common';
import { CLOUD_TRACE_GLSL } from './sky';

export const WATER_FS = /* glsl */ `
${COMMON_GLSL}
${CLOUD_TRACE_GLSL}
uniform sampler2D uSceneColor;   // cena opaca + céu (antes da água)
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

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

// altura das ondas: senoides direcionais + ruído em duas escalas (quebra a repetição)
float waveH(vec2 p, float t) {
  float h = 0.0;
  h += sin(dot(p, vec2(0.8, 0.6)) * 1.1 + t * 1.3) * 0.030;
  h += sin(dot(p, vec2(-0.5, 0.9)) * 1.9 + t * 1.9) * 0.020;
  h += sin(dot(p, vec2(0.95, -0.3)) * 3.3 + t * 2.6) * 0.010;
  h += sin(dot(p, vec2(-0.2, -1.0)) * 5.1 + t * 3.4) * 0.006;
  h += (vnoise(p * 1.7 + vec2(t * 0.35, t * 0.2)) - 0.5) * 0.05;
  h += (vnoise(p * 4.3 - vec2(t * 0.5, -t * 0.4)) - 0.5) * 0.02;
  return h;
}

vec3 waveNormal(vec2 p, float t, vec2 flow, float amp) {
  p -= flow * t * 1.2;
  float e = 0.06;
  float h = waveH(p, t);
  float hx = waveH(p + vec2(e, 0.0), t), hz = waveH(p + vec2(0.0, e), t);
  return normalize(vec3(-(hx - h) / e * amp, 1.0, -(hz - h) / e * amp));
}

// ondulação fina (cintilância do sol): gradiente de ruído de alta frequência
vec2 ripple(vec2 p, float t) {
  vec2 q = p * 7.0 + vec2(t * 0.9, -t * 0.7);
  float e = 0.05;
  float h = vnoise(q), hx = vnoise(q + vec2(e, 0.0)), hz = vnoise(q + vec2(0.0, e));
  vec2 q2 = p * 13.0 - vec2(t * 1.3, t * 1.1);
  float g = vnoise(q2), gx = vnoise(q2 + vec2(e, 0.0)), gz = vnoise(q2 + vec2(0.0, e));
  return vec2(hx - h, hz - h) / e * 0.02 + vec2(gx - g, gz - g) / e * 0.012;
}

vec3 toScreen(vec3 rel) {
  vec4 c = uViewProj * vec4(rel, 1.0);
  return c.xyz / c.w * 0.5 + 0.5;
}

// céu refletido: LUT + nuvens + sol (o disco entra pelo especular)
vec3 reflectedSky(vec3 R) {
  vec3 d = normalize(vec3(R.x, max(R.y, 0.004), R.z));
  vec3 c = skyLUT(d);
  vec4 cl = traceClouds(d, 900.0, 40);
  return c * (1.0 - cl.a) + cl.rgb;
}

void main() {
  // topo e face de baixo da superfície ocupam o mesmo lugar: cada uma só vale do seu lado
  if (vNormal <= 1u && !gl_FrontFacing) discard;
  float t = uMisc.x / 20.0;
  vec2 flow = (vUV - 16.0) / 12.5; // codificado pelo mesher (256 = parado)
  if ((vFlags & 2u) == 0u) flow = vec2(0.0);
  vec3 V = normalize(-vRel);
  float dist = length(vRel);
  bool top = vNormal == 1u;
  bool underside = vNormal == 0u;
  // ondas mais calmas ao longe (evita serrilhado) e em água parada
  float amp = mix(0.38, 0.18, smoothstep(24.0, 120.0, dist));
  vec3 N = top ? waveNormal(vWorld.xz, t, flow, amp) : (underside ? vec3(0, -1, 0) : vec3(0.0));
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
  vec2 off = N.xz * 0.04 * clamp(depth, 0.0, 1.0);
  vec2 ruv = suv + off;
  float rz = linearDepth(texture(uSceneDepth, ruv).r);
  if (rz < surfZ) ruv = suv;
  vec3 refr = texture(uSceneColor, ruv).rgb;
  float rdepth = max(linearDepth(texture(uSceneDepth, ruv).r) - surfZ, 0.0);
  // absorção (Beer-Lambert) com a cor do bioma
  vec3 absorb = exp(-rdepth * ((vec3(1.0) - waterCol) * 0.6 + 0.05));
  float skyB = lightCurve(vLight.x);
  vec3 amb = skyIrradiance(vec3(0.0, 1.0, 0.0)) * skyB + uBlockLight.rgb * lightCurve(vLight.y) * 0.6;
  // sombra na superfície (árvores, margens) e das nuvens
  float sh = shadowFactor(vRel, vec3(0.0, 1.0, 0.0), 1.0);
  float vis = (sh >= 0.0 ? sh : smoothstep(0.6, 0.93, vLight.x)) * cloudShadow(vRel) * smoothstep(0.5, 0.9, vLight.x);
  vec3 scatter = waterCol * 0.1 * (amb + uSunColor.rgb * max(uSunDir.y, 0.0) * vis * 0.4);
  vec3 under = mix(scatter, refr, absorb);
  // reflexo
  vec3 R = reflect(-V, N);
  if (R.y < 0.0) R.y = -R.y * 0.3;
  vec3 refl = reflectedSky(R) * mix(0.25, 1.0, skyB) + uBlockLight.rgb * lightCurve(vLight.y) * 0.15;
  float hit = 0.0;
  if (uSSR > 0.5 && top) {
    // raymarch em espaço de tela sobre a cena opaca, com refino binário
    vec3 p = vRel + N * 0.02;
    vec3 stepV = R * (0.25 + dist * 0.01);
    vec3 lastP = p;
    for (int i = 0; i < 48; i++) {
      lastP = p;
      p += stepV;
      stepV *= 1.08;
      vec3 sp = toScreen(p);
      if (sp.x < 0.0 || sp.x > 1.0 || sp.y < 0.0 || sp.y > 1.0 || sp.z > 1.0) break;
      float sz = linearDepth(texture(uSceneDepth, sp.xy).r);
      float pz = linearDepth(sp.z);
      if (pz > sz && sz < uNearFar.y * 0.99) {
        if (pz - sz > 2.0 + length(stepV) * 1.5) break; // passou por trás de algo
        vec3 a = lastP, b = p;
        for (int k = 0; k < 5; k++) {
          vec3 m = (a + b) * 0.5;
          vec3 ms = toScreen(m);
          if (linearDepth(ms.z) > linearDepth(texture(uSceneDepth, ms.xy).r)) b = m; else a = m;
        }
        vec3 hs = toScreen(b);
        float edge = smoothstep(0.0, 0.1, min(min(hs.x, 1.0 - hs.x), min(hs.y, 1.0 - hs.y)));
        refl = mix(refl, texture(uSceneColor, hs.xy).rgb, edge);
        hit = edge;
        break;
      }
    }
  }
  float F0 = 0.07;
  float ndv = max(dot(N, V), 0.0);
  float fres = F0 + (1.0 - F0) * pow(1.0 - ndv, 3.5);
  if (underside) fres = 0.1;
  vec3 color = mix(under, refl, clamp(fres, 0.0, 1.0));
  // trilha do sol: lobo largo (trilha contínua) + lobo fino sobre a ondulação (cintilância)
  vec3 L = uSunDir.xyz;
  vec3 H = normalize(L + V);
  vec3 Ns = N;
  if (top) { vec2 rp = ripple(vWorld.xz, t) * mix(1.0, 0.5, smoothstep(30.0, 150.0, dist)); Ns = normalize(N + vec3(-rp.x, 0.0, -rp.y)); }
  float ndl = max(dot(N, L), 0.0);
  float Fh = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float geo = ndl / max(4.0 * max(ndv, 0.08) * max(ndl, 0.08), 0.05);
  float ndh = max(dot(N, H), 0.0);
  float a2 = 0.014;
  float dd = ndh * ndh * (a2 - 1.0) + 1.0;
  float Dpath = a2 / (PI * dd * dd);
  float ndhs = max(dot(Ns, H), 0.0);
  float b2 = 0.0008;
  float ds2 = ndhs * ndhs * (b2 - 1.0) + 1.0;
  float Dspark = b2 / (PI * ds2 * ds2);
  float spec = min((Dpath * 0.55 + Dspark * 0.45 * smoothstep(0.975, 0.998, ndh)) * Fh * geo, 400.0);
  color += uSunColor.rgb * spec * vis * (1.0 - hit * 0.7);
  // espuma nas bordas rasas e em água corrente
  float foam = (1.0 - smoothstep(0.0, 0.3, depth)) * 0.45;
  foam += (vFlags & 2u) != 0u ? smoothstep(0.4, 1.0, length(flow)) * 0.12 : 0.0;
  float fn = hash12(floor(vWorld.xz * 8.0) + floor(t * 2.0));
  foam *= smoothstep(0.35, 0.8, fn + sin(t * 3.0 + vWorld.x * 2.0) * 0.2);
  color = mix(color, (amb + uSunColor.rgb * vis * max(L.y, 0.0)) * 0.8, clamp(foam, 0.0, 0.7));
  color = applyFog(color, vRel);
  outColor = vec4(color, 1.0);
  outNormal = vec4(N * 0.5 + 0.5, 0.95);
}
`;
