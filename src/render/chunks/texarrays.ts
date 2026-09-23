/** Cria os texture arrays de blocos (cor sRGB, normal+altura, material) direto em WebGL2. */
import { MIP_LEVELS, type TextureArrays } from '../textures/atlas';

export interface BlockTextures {
  albedo: WebGLTexture;
  normal: WebGLTexture;
  spec: WebGLTexture;
  meta: WebGLTexture;
  layers: number;
}

export function uploadBlockTextures(gl: WebGL2RenderingContext, data: TextureArrays, anisotropy: number): BlockTextures {
  const make = (levels: Uint8Array[], srgb: boolean): WebGLTexture => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, MIP_LEVELS, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, 16, 16, data.layers);
    for (let l = 0; l < MIP_LEVELS; l++) {
      const s = 16 >> l;
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, l, 0, 0, 0, s, s, data.layers, gl.RGBA, gl.UNSIGNED_BYTE, levels[l]);
    }
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, MIP_LEVELS - 1);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext && anisotropy > 1) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
    return tex;
  };
  const albedo = make(data.albedo, true);
  const normal = make(data.normal, false);
  const spec = make(data.spec, false);
  const meta = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, meta);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, data.layers, 1, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, data.meta);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  return { albedo, normal, spec, meta, layers: data.layers };
}
