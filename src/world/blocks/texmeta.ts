/**
 * Metadados das texturas de bloco (só dados — os "pintores" ficam em render/textures).
 * As camadas do texture array são atribuídas na ordem em que os blocos referenciam as texturas.
 */
export type MaterialKind =
  | 'stone' | 'dirt' | 'sand' | 'wood' | 'plant' | 'leaves' | 'metal' | 'gem' | 'glass' | 'ice'
  | 'wool' | 'snow' | 'water' | 'lava' | 'emissive' | 'ore' | 'brick' | 'default';

export interface TexMeta {
  frames?: number;
  /** ticks por quadro */
  frameTime?: number;
  /** 0..1 emissão uniforme (além da máscara que o pintor gera) */
  emissive?: number;
  randomRotate?: boolean;
  /** textura sólida em que o alfa indica onde aplicar a cor do bioma (ex.: lateral da grama) */
  tintMask?: boolean;
  material?: MaterialKind;
}

export const TEX_META: Record<string, TexMeta> = {
  lava_still: { frames: 16, frameTime: 3, emissive: 1, material: 'lava' },
  lava_flow: { frames: 16, frameTime: 2, emissive: 1, material: 'lava' },
  water_still: { frames: 1, material: 'water' },
  water_flow: { frames: 1, material: 'water' },
  fire_0: { frames: 16, frameTime: 1, emissive: 1, material: 'emissive' },
  fire_1: { frames: 16, frameTime: 1, emissive: 1, material: 'emissive' },
  soul_fire_0: { frames: 16, frameTime: 1, emissive: 1, material: 'emissive' },
  portal: { frames: 16, frameTime: 2, emissive: 1, material: 'emissive' },
  magma: { frames: 4, frameTime: 8, emissive: 0.6, material: 'lava' },
  grass_side: { tintMask: true, material: 'dirt' },
  grass_top: { randomRotate: true, material: 'plant' },
  dirt: { randomRotate: true, material: 'dirt' },
  sand: { randomRotate: true, material: 'sand' },
  red_sand: { randomRotate: true, material: 'sand' },
  gravel: { randomRotate: true, material: 'sand' },
  stone: { material: 'stone' },
  deepslate: { material: 'stone' },
  snow: { randomRotate: true, material: 'snow' },
  glowstone: { material: 'emissive' },
  lumita: { material: 'emissive' },
  fulgor_lamp_on: { material: 'emissive' },
  jack_o_lantern: { material: 'plant' },
  sea_lantern: { material: 'emissive' },
  torch: { material: 'emissive' },
  lantern: { material: 'metal' },
  shroomlight: { material: 'emissive' },
};

export function texMeta(name: string): TexMeta {
  return TEX_META[name] ?? {};
}
