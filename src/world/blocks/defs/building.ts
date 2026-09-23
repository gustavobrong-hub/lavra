import type { BlockDef } from '../types';
import { AXIS, BED_PART, FACING4, HALF, OCCUPIED, SLAB_TYPE } from '../props';

export interface DyeColor { id: string; label: string; rgb: number }
export const COLORS: DyeColor[] = [
  { id: 'white', label: 'branco', rgb: 0xf0f0f0 },
  { id: 'orange', label: 'laranja', rgb: 0xf07613 },
  { id: 'magenta', label: 'magenta', rgb: 0xbd44b3 },
  { id: 'light_blue', label: 'azul-claro', rgb: 0x3aafd9 },
  { id: 'yellow', label: 'amarelo', rgb: 0xf8c627 },
  { id: 'lime', label: 'verde-limão', rgb: 0x70b919 },
  { id: 'pink', label: 'rosa', rgb: 0xed8dac },
  { id: 'gray', label: 'cinza', rgb: 0x3e4447 },
  { id: 'light_gray', label: 'cinza-claro', rgb: 0x8e8e86 },
  { id: 'cyan', label: 'ciano', rgb: 0x158991 },
  { id: 'purple', label: 'roxo', rgb: 0x792aac },
  { id: 'blue', label: 'azul', rgb: 0x35399d },
  { id: 'brown', label: 'marrom', rgb: 0x724728 },
  { id: 'green', label: 'verde', rgb: 0x546d1b },
  { id: 'red', label: 'vermelho', rgb: 0xa12722 },
  { id: 'black', label: 'preto', rgb: 0x141519 },
];

const stoneLike = { tool: 'pickaxe' as const, requiresTool: true, sound: 'stone' as const, resistance: 6 };

/** Materiais que ganham escada, laje e (opcionalmente) muro. */
interface Variant { id: string; label: string; tex: string; top?: string; hardness: number; wall?: boolean; sound?: 'stone' | 'wood' }
export const STONE_VARIANTS: Variant[] = [
  { id: 'stone', label: 'pedra', tex: 'stone', hardness: 1.5 },
  { id: 'cobblestone', label: 'pedregulho', tex: 'cobblestone', hardness: 2, wall: true },
  { id: 'mossy_cobblestone', label: 'pedregulho musgoso', tex: 'mossy_cobblestone', hardness: 2, wall: true },
  { id: 'stone_brick', label: 'tijolos de pedra', tex: 'stone_bricks', hardness: 1.5, wall: true },
  { id: 'mossy_stone_brick', label: 'tijolos de pedra musgosos', tex: 'mossy_stone_bricks', hardness: 1.5, wall: true },
  { id: 'smooth_stone', label: 'pedra lisa', tex: 'smooth_stone', hardness: 2 },
  { id: 'sandstone', label: 'arenito', tex: 'sandstone', top: 'sandstone_top', hardness: 0.8, wall: true },
  { id: 'red_sandstone', label: 'arenito vermelho', tex: 'red_sandstone', top: 'red_sandstone_top', hardness: 0.8, wall: true },
  { id: 'brick', label: 'tijolos', tex: 'bricks', hardness: 2, wall: true },
  { id: 'granite', label: 'granito', tex: 'granite', hardness: 1.5, wall: true },
  { id: 'polished_granite', label: 'granito polido', tex: 'polished_granite', hardness: 1.5 },
  { id: 'diorite', label: 'diorito', tex: 'diorite', hardness: 1.5, wall: true },
  { id: 'polished_diorite', label: 'diorito polido', tex: 'polished_diorite', hardness: 1.5 },
  { id: 'andesite', label: 'andesito', tex: 'andesite', hardness: 1.5, wall: true },
  { id: 'polished_andesite', label: 'andesito polido', tex: 'polished_andesite', hardness: 1.5 },
  { id: 'cobbled_deepslate', label: 'ardósia britada', tex: 'cobbled_deepslate', hardness: 3.5, wall: true },
  { id: 'polished_deepslate', label: 'ardósia polida', tex: 'polished_deepslate', hardness: 3.5, wall: true },
  { id: 'deepslate_brick', label: 'tijolos de ardósia', tex: 'deepslate_bricks', hardness: 3.5, wall: true },
  { id: 'deepslate_tile', label: 'ladrilhos de ardósia', tex: 'deepslate_tiles', hardness: 3.5, wall: true },
  { id: 'mud_brick', label: 'tijolos de lama', tex: 'mud_bricks', hardness: 1.5, wall: true },
  { id: 'quartz', label: 'quartzo', tex: 'quartz_block_side', top: 'quartz_block_top', hardness: 0.8 },
  { id: 'infero_brick', label: 'tijolos do Ínfero', tex: 'infero_bricks', hardness: 2, wall: true },
  { id: 'blackstone', label: 'pedra-negra', tex: 'blackstone', top: 'blackstone_top', hardness: 1.5, wall: true },
];

function variantBlocks(v: Variant): BlockDef[] {
  const tex = v.top ? { side: v.tex, top: v.top, bottom: v.top } : v.tex;
  const out: BlockDef[] = [
    { name: `${v.id}_stairs`, label: `Escada de ${v.label}`, hardness: v.hardness, ...stoneLike, shape: 'stairs', layer: 'solid', opaque: false, props: [FACING4, HALF], tex, tab: 'build' },
    { name: `${v.id}_slab`, label: `Laje de ${v.label}`, hardness: v.hardness, ...stoneLike, shape: 'slab', layer: 'solid', opaque: false, props: [SLAB_TYPE], tex, tab: 'build' },
  ];
  if (v.wall) out.push({ name: `${v.id}_wall`, label: `Muro de ${v.label}`, hardness: v.hardness, ...stoneLike, shape: 'wall', layer: 'solid', opaque: false, tex: v.tex, tab: 'deco' });
  return out;
}

export const BUILDING: BlockDef[] = [
  { name: 'stone_bricks', label: 'Tijolos de pedra', hardness: 1.5, ...stoneLike, tex: 'stone_bricks', tab: 'build' },
  { name: 'mossy_stone_bricks', label: 'Tijolos de pedra musgosos', hardness: 1.5, ...stoneLike, tex: 'mossy_stone_bricks', tab: 'build' },
  { name: 'cracked_stone_bricks', label: 'Tijolos de pedra rachados', hardness: 1.5, ...stoneLike, tex: 'cracked_stone_bricks', tab: 'build' },
  { name: 'chiseled_stone_bricks', label: 'Tijolos de pedra talhados', hardness: 1.5, ...stoneLike, tex: 'chiseled_stone_bricks', tab: 'build' },
  { name: 'bricks', label: 'Tijolos', hardness: 2, ...stoneLike, tex: 'bricks', tab: 'build' },
  { name: 'quartz_block', label: 'Bloco de quartzo', hardness: 0.8, ...stoneLike, tex: { side: 'quartz_block_side', top: 'quartz_block_top' }, tab: 'build' },
  { name: 'quartz_pillar', label: 'Pilar de quartzo', hardness: 0.8, ...stoneLike, props: [AXIS], tex: (p) => p.axis === 'y' ? { side: 'quartz_pillar', end: 'quartz_pillar_top' } : p.axis === 'x' ? { side: 'quartz_pillar@90', west: 'quartz_pillar_top', east: 'quartz_pillar_top' } : { side: 'quartz_pillar', west: 'quartz_pillar@90', east: 'quartz_pillar@90', up: 'quartz_pillar', north: 'quartz_pillar_top', south: 'quartz_pillar_top' }, tab: 'build' },
  { name: 'bookshelf', label: 'Estante de livros', hardness: 1.5, tool: 'axe', sound: 'wood', tex: { side: 'bookshelf', top: 'oak_planks' }, flammable: [30, 20], tab: 'build' },
  { name: 'glass', label: 'Vidro', hardness: 0.3, sound: 'glass', layer: 'cutout', opaque: false, cullSame: true, tex: 'glass', tab: 'build' },
  { name: 'glass_pane', label: 'Painel de vidro', hardness: 0.3, sound: 'glass', shape: 'pane', layer: 'cutout', opaque: false, cullSame: true, tex: { side: 'glass', top: 'glass_pane_top' }, tab: 'deco' },
  { name: 'iron_bars', label: 'Barras de ferro', hardness: 5, ...stoneLike, sound: 'metal', shape: 'pane', layer: 'cutout', opaque: false, tex: { side: 'iron_bars', top: 'iron_bars' }, tab: 'deco' },
  { name: 'tinted_glass', label: 'Vidro fumê', hardness: 0.3, sound: 'glass', layer: 'translucent', opaque: false, cullSame: true, opacity: 15, tex: 'tinted_glass', tab: 'build' },
  { name: 'hay_block', label: 'Fardo de feno', hardness: 0.5, tool: 'hoe', sound: 'grass', props: [AXIS], tex: (p) => p.axis === 'y' ? { side: 'hay_block_side', end: 'hay_block_top' } : p.axis === 'x' ? { side: 'hay_block_side@90', west: 'hay_block_top', east: 'hay_block_top' } : { side: 'hay_block_side', west: 'hay_block_side@90', east: 'hay_block_side@90', north: 'hay_block_top', south: 'hay_block_top' }, flammable: [60, 20], tab: 'build' },
  { name: 'sponge', label: 'Esponja', hardness: 0.6, tool: 'hoe', sound: 'grass', tex: 'sponge', tab: 'build' },
  { name: 'wet_sponge', label: 'Esponja molhada', hardness: 0.6, tool: 'hoe', sound: 'grass', tex: 'wet_sponge', tab: 'build' },
  { name: 'dirt_path', label: 'Caminho de terra', hardness: 0.65, tool: 'shovel', sound: 'grass', shape: 'path', layer: 'solid', opaque: false, tex: { top: 'dirt_path_top', side: 'dirt_path_side', bottom: 'dirt' }, tab: 'nature' },
  ...STONE_VARIANTS.flatMap(variantBlocks),
  // cores
  ...COLORS.map((c): BlockDef => ({ name: `${c.id}_wool`, label: `Lã ${c.label}`, hardness: 0.8, tool: 'shears', sound: 'wool', tex: `${c.id}_wool`, flammable: [30, 60], tab: 'build', data: { color: c.id } })),
  ...COLORS.map((c): BlockDef => ({ name: `${c.id}_carpet`, label: `Tapete ${c.label}`, hardness: 0.1, sound: 'wool', shape: 'carpet', layer: 'solid', opaque: false, tex: `${c.id}_wool`, flammable: [60, 20], tab: 'deco', data: { color: c.id } })),
  ...COLORS.map((c): BlockDef => ({ name: `${c.id}_stained_glass`, label: `Vidro ${c.label}`, hardness: 0.3, sound: 'glass', layer: 'translucent', opaque: false, cullSame: true, tex: `${c.id}_stained_glass`, tab: 'build', data: { color: c.id } })),
  ...COLORS.map((c): BlockDef => ({ name: `${c.id}_stained_glass_pane`, label: `Painel de vidro ${c.label}`, hardness: 0.3, sound: 'glass', shape: 'pane', layer: 'translucent', opaque: false, cullSame: true, tex: { side: `${c.id}_stained_glass`, top: `${c.id}_stained_glass` }, tab: 'deco', data: { color: c.id } })),
  ...COLORS.map((c): BlockDef => ({ name: `${c.id}_terracotta`, label: `Terracota ${c.label}`, hardness: 1.25, ...stoneLike, resistance: 4.2, tex: `${c.id}_terracotta`, tab: 'build', data: { color: c.id } })),
  ...COLORS.map((c): BlockDef => ({ name: `${c.id}_concrete`, label: `Concreto ${c.label}`, hardness: 1.8, ...stoneLike, tex: `${c.id}_concrete`, tab: 'build', data: { color: c.id } })),
  ...COLORS.map((c): BlockDef => ({ name: `${c.id}_concrete_powder`, label: `Concreto em pó ${c.label}`, hardness: 0.5, tool: 'shovel', sound: 'sand', gravity: true, tex: `${c.id}_concrete_powder`, tab: 'build', data: { color: c.id } })),
  ...COLORS.map((c): BlockDef => ({ name: `${c.id}_bed`, label: `Cama ${c.label}`, hardness: 0.2, sound: 'wood', shape: 'bed', layer: 'solid', opaque: false, props: [FACING4, BED_PART, OCCUPIED], tex: { side: `${c.id}_wool`, bottom: 'oak_planks' }, tab: 'deco', data: { color: c.id } })),
];
