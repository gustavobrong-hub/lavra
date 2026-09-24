/**
 * Bloco de uniforms por frame (std140), compartilhado por todos os shaders de terreno.
 * Também é espelhado como string GLSL (FRAME_GLSL) para os shaders do Three.
 */
import type { Matrix4 } from 'three';

export const FRAME_GLSL = /* glsl */ `
layout(std140) uniform Frame {
  mat4 uViewProj;
  mat4 uView;
  mat4 uProj;
  mat4 uInvViewProj;
  mat4 uPrevViewProj;
  mat4 uShadow[4];
  vec4 uCamPos;
  vec4 uSunDir;
  vec4 uMoonDir;
  vec4 uSunColor;
  vec4 uSkyAmbient;
  vec4 uFogColor;
  vec4 uFogParams;
  vec4 uBlockLight;
  vec4 uWeather;
  vec4 uMisc;
  vec4 uScreen;
  vec4 uCascades;
  vec4 uShadowParams;
  vec4 uCamDelta;
  vec4 uJitter;
  vec4 uSkyZenith;
  vec4 uSkyHorizon;
  vec4 uSunPos;     // xyz direção real do sol, w visibilidade do disco
  vec4 uSunRad;     // rgb radiância do sol fora da atmosfera (céu), w escala do céu
  vec4 uMoonColor;  // rgb luz da lua, w brilho do disco
  vec4 uClouds;     // xy deslocamento das nuvens (blocos), z cobertura, w base relativa à câmera
  vec4 uCloudLight; // rgb cor do sol na altura das nuvens, w escurecimento de chuva
  vec4 uFx;         // x névoa baixa, y fator pôr do sol, z noite, w brilho das estrelas
  vec4 uSunDisc;    // rgb radiância do disco do sol (já atenuada), w ângulo celeste (rad)
};
`;

const OFF = {
  viewProj: 0, view: 16, proj: 32, invViewProj: 48, prevViewProj: 64, shadow: 80,
  camPos: 144, sunDir: 148, moonDir: 152, sunColor: 156, skyAmbient: 160, fogColor: 164, fogParams: 168,
  blockLight: 172, weather: 176, misc: 180, screen: 184, cascades: 188, shadowParams: 192, camDelta: 196,
  jitter: 200, skyZenith: 204, skyHorizon: 208, sunPos: 212, sunRad: 216, moonColor: 220, clouds: 224,
  cloudLight: 228, fx: 232, sunDisc: 236,
} as const;
export const FRAME_FLOATS = 240;
export type Vec4Key = Exclude<keyof typeof OFF, 'viewProj' | 'view' | 'proj' | 'invViewProj' | 'prevViewProj' | 'shadow'>;
export type MatKey = 'viewProj' | 'view' | 'proj' | 'invViewProj' | 'prevViewProj';

export class FrameUBO {
  readonly data = new Float32Array(FRAME_FLOATS);
  readonly buffer: WebGLBuffer;
  static readonly BINDING = 3;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }

  mat(key: MatKey, m: Matrix4): void { this.data.set(m.elements, OFF[key]); }
  shadowMat(i: number, m: ArrayLike<number>): void { this.data.set(m, OFF.shadow + i * 16); }
  vec(key: Vec4Key, x: number, y: number, z: number, w: number): void {
    const o = OFF[key];
    this.data[o] = x; this.data[o + 1] = y; this.data[o + 2] = z; this.data[o + 3] = w;
  }
  get(key: Vec4Key): Float32Array { return this.data.subarray(OFF[key], OFF[key] + 4); }
  shadowData(): Float32Array { return this.data.subarray(OFF.shadow, OFF.shadow + 64); }
  has(key: string): boolean { return key in OFF; }

  upload(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.data);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }

  bind(): void {
    this.gl.bindBufferBase(this.gl.UNIFORM_BUFFER, FrameUBO.BINDING, this.buffer);
  }
}
