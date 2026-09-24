/**
 * Uniforms compartilhados pelos materiais do Three (espelho do bloco Frame) e fábricas de materiais.
 */
import * as THREE from 'three';
import { ENTITY_FS, ENTITY_VS } from '../shaders/entity';
import type { FrameUBO } from '../gl/frameubo';
import type { TextureArrays } from '../textures/atlas';

const v4 = () => ({ value: new THREE.Vector4() });
const VEC_UNIFORMS = {
  uCamPos: v4(), uSunDir: v4(), uMoonDir: v4(), uSunColor: v4(), uSkyAmbient: v4(), uFogColor: v4(), uFogParams: v4(),
  uBlockLight: v4(), uWeather: v4(), uMisc: v4(), uSkyZenith: v4(), uSkyHorizon: v4(),
  uSunPos: v4(), uSunDisc: v4(), uClouds: v4(), uFx: v4(), uCascades: v4(), uShadowParams: v4(),
};
/** Texturas do pipeline (LUT do céu, mapa de nuvens, sombras) embrulhadas para o Three. */
export const SHARED_TEX = {
  uSkyLUT: { value: new THREE.ExternalTexture(null) as THREE.Texture },
  uCloudMap: { value: new THREE.ExternalTexture(null) as THREE.Texture },
  uShadowMap: { value: new THREE.ExternalTexture(null) as THREE.Texture },
};
export const SHARED = {
  ...VEC_UNIFORMS,
  ...SHARED_TEX,
  uShadow: { value: new Float32Array(64) },
};

/** Aponta as texturas compartilhadas para os objetos GL do pipeline. */
export function setSharedTextures(sky: WebGLTexture, clouds: WebGLTexture, shadow: WebGLTexture): void {
  (SHARED_TEX.uSkyLUT.value as THREE.ExternalTexture).sourceTexture = sky;
  (SHARED_TEX.uCloudMap.value as THREE.ExternalTexture).sourceTexture = clouds;
  (SHARED_TEX.uShadowMap.value as THREE.ExternalTexture).sourceTexture = shadow;
}

/** Copia os valores do UBO para os uniforms compartilhados (uma vez por frame). */
export function syncShared(f: FrameUBO): void {
  for (const k of Object.keys(VEC_UNIFORMS) as (keyof typeof VEC_UNIFORMS)[]) {
    const key = k.slice(1, 2).toLowerCase() + k.slice(2);
    const a = f.get(key as never);
    VEC_UNIFORMS[k].value.set(a[0], a[1], a[2], a[3]);
  }
  SHARED.uShadow.value.set(f.shadowData());
}

let blockTex: THREE.DataArrayTexture | null = null;
export function blockArrayTexture(data?: TextureArrays): THREE.DataArrayTexture {
  if (blockTex) return blockTex;
  if (!data) throw new Error('texturas de bloco ainda não carregadas');
  const t = new THREE.DataArrayTexture(data.albedo[0], 16, 16, data.layers);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  blockTex = t;
  return t;
}

export interface EntityUniforms {
  uLight: { value: THREE.Vector2 };
  uOverlay: { value: THREE.Vector4 };
  uTint: { value: THREE.Color };
  uAlpha: { value: number };
  uEmissive: { value: number };
  [k: string]: { value: unknown };
}

/** Material para geometria texturizada com o atlas de blocos (atributo `layer`). */
export function blockMaterial(opts: { transparent?: boolean } = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: ENTITY_VS,
    fragmentShader: ENTITY_FS,
    defines: { BLOCK_ARRAY: 1 },
    uniforms: {
      ...SHARED,
      uBlocks: { value: blockArrayTexture() },
      uLight: { value: new THREE.Vector2(1, 0) },
      uOverlay: { value: new THREE.Vector4(1, 0, 0, 0) },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uAlpha: { value: 1 },
      uEmissive: { value: 0 },
    },
    transparent: opts.transparent ?? false,
  });
  return m;
}

/** Material para modelos com textura 2D (criaturas, itens planos). */
export function skinMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: ENTITY_VS,
    fragmentShader: ENTITY_FS,
    uniforms: {
      ...SHARED,
      uMap: { value: map },
      uLight: { value: new THREE.Vector2(1, 0) },
      uOverlay: { value: new THREE.Vector4(1, 0, 0, 0) },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uAlpha: { value: 1 },
      uEmissive: { value: 0 },
    },
  });
}
