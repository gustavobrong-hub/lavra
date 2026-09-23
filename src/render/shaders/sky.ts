/** Céu: gradiente atmosférico, disco do sol com halo, lua com fases e estrelas (versão base). */
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

export const SKY_FS = /* glsl */ `
${COMMON_GLSL}
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;

vec3 starField(vec3 d) {
  vec3 p = d * 220.0;
  vec3 c = floor(p);
  float h = hash13(c);
  if (h < 0.9975) return vec3(0.0);
  vec3 f = fract(p) - 0.5;
  float s = smoothstep(0.35, 0.0, length(f));
  float tw = 0.7 + 0.3 * sin(uMisc.x * 0.1 + h * 900.0);
  return vec3(0.8, 0.85, 1.0) * s * tw * (h - 0.9975) * 900.0;
}

void main() {
  vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec4 wp = uInvViewProj * ndc;
  vec3 d = normalize(wp.xyz / wp.w);
  float y = d.y;
  vec3 col = skyGradient(d);
  float sd = dot(d, uSunDir.xyz);
  float day = uSunDir.w;
  col += uSunColor.rgb * smoothstep(0.99955, 0.99975, sd) * 30.0;
  // lua
  float md = dot(d, uMoonDir.xyz);
  float moon = smoothstep(0.99935, 0.9996, md);
  if (moon > 0.0) {
    // fase: sombra deslocada
    vec3 side = normalize(cross(uMoonDir.xyz, vec3(0.0, 0.0, 1.0)));
    float phase = uMoonDir.w; // 0..1
    float k = cos(phase * 2.0 * PI);
    vec3 lp = d - uMoonDir.xyz;
    float lit = smoothstep(-0.004, 0.004, dot(lp, side) * sign(0.5 - phase) + k * 0.018);
    float crater = 0.8 + 0.2 * hash13(floor(d * 900.0));
    col += vec3(0.85, 0.9, 1.0) * moon * mix(0.04, 1.6, lit) * crater;
  }
  col += pow(max(md, 0.0), 60.0) * vec3(0.05, 0.06, 0.09) * (1.0 - day);
  // estrelas à noite
  float night = clamp(1.0 - day * 1.6, 0.0, 1.0) * (1.0 - uWeather.x);
  if (y > -0.05) col += starField(d) * night;
  outColor = vec4(col, 1.0);
  outNormal = vec4(0.5, 0.5, 0.5, 0.0);
}
`;
