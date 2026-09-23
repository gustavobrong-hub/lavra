import type { BlockDef } from '../types';
import {
  AGE, AXIS, AXIS_H, BITES, CAULDRON_LEVEL, CHEST_TYPE, COMPOSTER_LEVEL, FACING4, HANGING, HAS_BOOK, LIT, BOTTLES,
} from '../props';

const wood = { tool: 'axe' as const, sound: 'wood' as const };
const rock = { tool: 'pickaxe' as const, requiresTool: true, sound: 'stone' as const };

const furnaceLike = (name: string, label: string, prefix: string): BlockDef => ({
  name, label, hardness: 3.5, ...rock, props: [FACING4, LIT], defaults: { facing: 'north' },
  tex: (p) => ({ top: `${prefix}_top`, bottom: `${prefix}_top`, side: `${prefix}_side`, front: p.lit ? `${prefix}_front_on` : `${prefix}_front` }),
  light: (p) => (p.lit ? 13 : 0), tab: 'util',
});

export const UTILITY: BlockDef[] = [
  { name: 'crafting_table', label: 'Bancada de trabalho', hardness: 2.5, ...wood, tex: { top: 'crafting_table_top', bottom: 'oak_planks', north: 'crafting_table_front', south: 'crafting_table_front', west: 'crafting_table_side', east: 'crafting_table_side' }, flammable: [5, 20], tab: 'util' },
  furnaceLike('furnace', 'Fornalha', 'furnace'),
  furnaceLike('smoker', 'Defumador', 'smoker'),
  furnaceLike('blast_furnace', 'Alto-forno', 'blast_furnace'),
  { name: 'chest', label: 'Baú', hardness: 2.5, ...wood, shape: 'chest', layer: 'solid', opaque: false, props: [FACING4, CHEST_TYPE], defaults: { facing: 'south' }, tex: { side: 'chest_side', top: 'chest_top', front: 'chest_front' }, tab: 'util' },
  { name: 'trapped_chest', label: 'Baú com armadilha', hardness: 2.5, ...wood, shape: 'chest', layer: 'solid', opaque: false, props: [FACING4, CHEST_TYPE], defaults: { facing: 'south' }, tex: { side: 'chest_side', top: 'chest_top', front: 'trapped_chest_front' }, tab: 'fulgor' },
  { name: 'barrel', label: 'Barril', hardness: 2.5, ...wood, props: [{ name: 'facing', values: ['up', 'down', 'north', 'south', 'west', 'east'] }, { name: 'open', values: [false, true] }], tex: (p) => {
    const f = p.facing as string;
    const back: Record<string, string> = { north: 'south', south: 'north', west: 'east', east: 'west', up: 'down', down: 'up' };
    const vertical = f === 'up' || f === 'down';
    const o: Record<string, string> = vertical ? { side: 'barrel_side' } : { side: 'barrel_side@90', up: 'barrel_side', down: 'barrel_side' };
    o[f] = p.open ? 'barrel_top_open' : 'barrel_top';
    o[back[f]] = 'barrel_bottom';
    return o;
  }, tab: 'util' },
  { name: 'enchanting_table', label: 'Mesa de encantamento', hardness: 5, ...rock, shape: 'enchanting', layer: 'solid', opaque: false, light: 7, tex: { top: 'enchanting_table_top', side: 'enchanting_table_side', bottom: 'enchanting_table_bottom' }, tab: 'util' },
  { name: 'anvil', label: 'Bigorna', hardness: 5, ...rock, sound: 'metal', shape: 'anvil', layer: 'solid', opaque: false, props: [FACING4], gravity: true, tex: { top: 'anvil_top', side: 'anvil' }, tab: 'util' },
  { name: 'chipped_anvil', label: 'Bigorna lascada', hardness: 5, ...rock, sound: 'metal', shape: 'anvil', layer: 'solid', opaque: false, props: [FACING4], gravity: true, tex: { top: 'chipped_anvil_top', side: 'anvil' }, tab: 'util' },
  { name: 'damaged_anvil', label: 'Bigorna danificada', hardness: 5, ...rock, sound: 'metal', shape: 'anvil', layer: 'solid', opaque: false, props: [FACING4], gravity: true, tex: { top: 'damaged_anvil_top', side: 'anvil' }, tab: 'util' },
  { name: 'brewing_stand', label: 'Suporte de poções', hardness: 0.5, ...rock, sound: 'metal', shape: 'brewing', layer: 'cutout', opaque: false, props: [BOTTLES], light: 1, tex: { side: 'brewing_stand', bottom: 'brewing_stand_base' }, tab: 'util' },
  { name: 'cauldron', label: 'Caldeirão', hardness: 2, ...rock, sound: 'metal', shape: 'cauldron', layer: 'solid', opaque: false, props: [CAULDRON_LEVEL], tex: { side: 'cauldron_side', top: 'cauldron_top', bottom: 'cauldron_bottom', inner: 'cauldron_inner' }, tab: 'util' },
  { name: 'composter', label: 'Composteira', hardness: 0.6, ...wood, shape: 'composter', layer: 'solid', opaque: false, props: [COMPOSTER_LEVEL], tex: { side: 'composter_side', top: 'composter_top', bottom: 'composter_bottom', inner: 'composter_compost' }, tab: 'util' },
  { name: 'lectern', label: 'Atril', hardness: 2.5, ...wood, shape: 'lectern', layer: 'solid', opaque: false, props: [FACING4, HAS_BOOK], tex: { side: 'lectern_sides', top: 'lectern_top', bottom: 'oak_planks', front: 'lectern_front' }, tab: 'util' },
  { name: 'cartography_table', label: 'Mesa de cartografia', hardness: 2.5, ...wood, tex: { top: 'cartography_table_top', side: 'cartography_table_side1', north: 'cartography_table_side2', bottom: 'dark_oak_planks' }, tab: 'util' },
  { name: 'fletching_table', label: 'Mesa de flecheiro', hardness: 2.5, ...wood, tex: { top: 'fletching_table_top', side: 'fletching_table_side', north: 'fletching_table_front', bottom: 'birch_planks' }, tab: 'util' },
  { name: 'smithing_table', label: 'Mesa de ferraria', hardness: 2.5, ...wood, tex: { top: 'smithing_table_top', side: 'smithing_table_side', north: 'smithing_table_front', bottom: 'smithing_table_bottom' }, tab: 'util' },
  { name: 'loom', label: 'Tear', hardness: 2.5, ...wood, props: [FACING4], tex: { top: 'loom_top', side: 'loom_side', bottom: 'loom_bottom', front: 'loom_front' }, tab: 'util' },
  { name: 'grindstone', label: 'Rebolo', hardness: 2, ...rock, shape: 'grindstone', layer: 'solid', opaque: false, props: [FACING4], tex: { side: 'grindstone_side', pivot: 'grindstone_pivot', leg: 'dark_oak_log' }, tab: 'util' },
  { name: 'stonecutter', label: 'Cortador de pedra', hardness: 3.5, ...rock, shape: 'stonecutter', layer: 'cutout', opaque: false, props: [FACING4], tex: { top: 'stonecutter_top', side: 'stonecutter_side', bottom: 'stonecutter_bottom', saw: 'stonecutter_saw' }, tab: 'util' },
  { name: 'bell', label: 'Sino', hardness: 5, ...rock, sound: 'metal', shape: 'bell', layer: 'solid', opaque: false, props: [FACING4], tex: { side: 'bell_side', top: 'bell_top', bottom: 'bell_bottom' }, tab: 'util' },
  { name: 'torch', label: 'Tocha', hardness: 0, sound: 'wood', shape: 'torch', layer: 'cutout', opaque: false, light: 14, tex: 'torch', tab: 'deco' },
  { name: 'wall_torch', label: 'Tocha', hardness: 0, sound: 'wood', shape: 'walltorch', layer: 'cutout', opaque: false, props: [FACING4], light: 14, tex: 'torch', noItem: true, itemOf: 'torch', tab: 'none' },
  { name: 'soul_torch', label: 'Tocha das almas', hardness: 0, sound: 'wood', shape: 'torch', layer: 'cutout', opaque: false, light: 10, tex: 'soul_torch', tab: 'deco' },
  { name: 'soul_wall_torch', label: 'Tocha das almas', hardness: 0, sound: 'wood', shape: 'walltorch', layer: 'cutout', opaque: false, props: [FACING4], light: 10, tex: 'soul_torch', noItem: true, itemOf: 'soul_torch', tab: 'none' },
  { name: 'lantern', label: 'Lanterna', hardness: 3.5, ...rock, sound: 'lantern', shape: 'lantern', layer: 'cutout', opaque: false, props: [HANGING], light: 15, tex: 'lantern', tab: 'deco' },
  { name: 'soul_lantern', label: 'Lanterna das almas', hardness: 3.5, ...rock, sound: 'lantern', shape: 'lantern', layer: 'cutout', opaque: false, props: [HANGING], light: 10, tex: 'soul_lantern', tab: 'deco' },
  { name: 'chain', label: 'Corrente', hardness: 5, ...rock, sound: 'metal', shape: 'chain', layer: 'cutout', opaque: false, props: [AXIS], tex: 'chain', tab: 'deco' },
  { name: 'ladder', label: 'Escada de mão', hardness: 0.4, ...wood, sound: 'ladder', shape: 'ladder', layer: 'cutout', opaque: false, props: [FACING4], tex: 'ladder', climbable: true, tab: 'deco' },
  { name: 'scaffolding', label: 'Andaime', hardness: 0, sound: 'wood', shape: 'scaffold', layer: 'cutout', opaque: false, tex: { top: 'scaffolding_top', side: 'scaffolding_side', bottom: 'scaffolding_bottom' }, climbable: true, tab: 'deco' },
  { name: 'campfire', label: 'Fogueira', hardness: 2, ...wood, shape: 'campfire', layer: 'cutout', opaque: false, props: [FACING4, LIT], defaults: { lit: true }, light: (p) => (p.lit ? 15 : 0), tex: { side: 'campfire_log', lit: 'campfire_log_lit', fire: 'campfire_fire' }, tab: 'deco' },
  { name: 'spawner', label: 'Gerador de monstros', hardness: 5, ...rock, sound: 'metal', layer: 'cutout', opaque: false, tex: 'spawner', tab: 'none' },
  { name: 'flower_pot', label: 'Vaso de flores', hardness: 0, sound: 'stone', shape: 'flowerpot', layer: 'cutout', opaque: false, tex: 'flower_pot', tab: 'deco' },
  { name: 'cake', label: 'Bolo', hardness: 0.5, sound: 'wool', shape: 'cake', layer: 'solid', opaque: false, props: [BITES], tex: { top: 'cake_top', side: 'cake_side', bottom: 'cake_bottom', inner: 'cake_inner' }, tab: 'none' },
  { name: 'jukebox', label: 'Toca-discos', hardness: 2, ...wood, tex: { top: 'jukebox_top', side: 'jukebox_side' }, tab: 'deco' },
  { name: 'beacon', label: 'Farol', hardness: 3, sound: 'glass', layer: 'cutout', opaque: false, light: 15, tex: 'beacon', tab: 'util' },
  { name: 'sea_lantern', label: 'Lanterna do mar', hardness: 0.3, sound: 'glass', light: 15, tex: 'sea_lantern', tab: 'deco' },
  { name: 'glowstone', label: 'Pedra-lume', hardness: 0.3, sound: 'glass', light: 15, tex: 'glowstone', tab: 'deco' },
  { name: 'infero_portal', label: 'Portal do Ínfero', hardness: -1, sound: 'glass', shape: 'portal', layer: 'translucent', opaque: false, props: [AXIS_H], light: 11, tex: 'portal', noItem: true, tab: 'none' },
  { name: 'fire', label: 'Fogo', hardness: 0, sound: 'none', shape: 'fire', layer: 'cutout', opaque: false, props: [AGE(15)], light: 15, tex: { side: 'fire_0', alt: 'fire_1' }, replaceable: true, randomTicks: true, noItem: true, tab: 'none' },
  { name: 'soul_fire', label: 'Fogo das almas', hardness: 0, sound: 'none', shape: 'fire', layer: 'cutout', opaque: false, light: 10, tex: { side: 'soul_fire_0', alt: 'soul_fire_0' }, replaceable: true, noItem: true, tab: 'none' },
  { name: 'honey_block', label: 'Bloco de mel', hardness: 0, sound: 'honey', layer: 'translucent', opaque: false, tex: 'honey_block', speedFactor: 0.4, jumpFactor: 0.5, tab: 'deco' },
  { name: 'slime_block', label: 'Bloco de gosma', hardness: 0, sound: 'slime', layer: 'translucent', opaque: false, tex: 'slime_block', friction: 0.8, tab: 'fulgor' },
  { name: 'bone_block', label: 'Bloco de ossos', hardness: 2, ...rock, sound: 'bone', props: [AXIS], tex: (p) => p.axis === 'y' ? { side: 'bone_block_side', end: 'bone_block_top' } : p.axis === 'x' ? { side: 'bone_block_side@90', west: 'bone_block_top', east: 'bone_block_top' } : { side: 'bone_block_side', west: 'bone_block_side@90', east: 'bone_block_side@90', north: 'bone_block_top', south: 'bone_block_top' }, tab: 'build' },
  { name: 'ember_crystal', label: 'Cristal de brasa', hardness: -1, sound: 'glass', shape: 'crystal', layer: 'cutout', opaque: false, light: 15, tex: 'ember_crystal', noItem: true, tab: 'none' },
];
