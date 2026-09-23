import type { BlockDef } from '../types';
import { AXIS, LIT } from '../props';

const rock = { tool: 'pickaxe' as const, requiresTool: true, sound: 'stone' as const };

/** Blocos do Ínfero, a segunda dimensão. */
export const INFERO: BlockDef[] = [
  { name: 'brasalito', label: 'Brasalito', hardness: 0.4, ...rock, sound: 'netherrack', tex: 'brasalito', randomTicks: false, tab: 'nature' },
  { name: 'ember_nylium', label: 'Micélio-brasa', hardness: 0.4, ...rock, sound: 'netherrack', tex: { top: 'ember_nylium_top', side: 'ember_nylium_side', bottom: 'brasalito' }, tab: 'nature' },
  { name: 'ash_nylium', label: 'Micélio-cinza', hardness: 0.4, ...rock, sound: 'netherrack', tex: { top: 'ash_nylium_top', side: 'ash_nylium_side', bottom: 'brasalito' }, tab: 'nature' },
  { name: 'lament_sand', label: 'Areia lamuriosa', hardness: 0.5, tool: 'shovel', sound: 'soul', tex: 'lament_sand', speedFactor: 0.4, tab: 'nature' },
  { name: 'lament_soil', label: 'Solo lamurioso', hardness: 0.5, tool: 'shovel', sound: 'soul', tex: 'lament_soil', tab: 'nature' },
  { name: 'basalt', label: 'Basalto', hardness: 1.25, ...rock, sound: 'basalt', props: [AXIS], tex: (p) => p.axis === 'y' ? { side: 'basalt_side', end: 'basalt_top' } : p.axis === 'x' ? { side: 'basalt_side@90', west: 'basalt_top', east: 'basalt_top' } : { side: 'basalt_side', west: 'basalt_side@90', east: 'basalt_side@90', north: 'basalt_top', south: 'basalt_top' }, tab: 'nature' },
  { name: 'polished_basalt', label: 'Basalto polido', hardness: 1.25, ...rock, sound: 'basalt', props: [AXIS], tex: (p) => p.axis === 'y' ? { side: 'polished_basalt_side', end: 'polished_basalt_top' } : { side: 'polished_basalt_side@90', end: 'polished_basalt_top' }, tab: 'build' },
  { name: 'blackstone', label: 'Pedra-negra', hardness: 1.5, ...rock, tex: { side: 'blackstone', top: 'blackstone_top', bottom: 'blackstone_top' }, tab: 'build' },
  { name: 'polished_blackstone', label: 'Pedra-negra polida', hardness: 2, ...rock, tex: 'polished_blackstone', tab: 'build' },
  { name: 'gilded_blackstone', label: 'Pedra-negra dourada', hardness: 1.5, ...rock, tex: 'gilded_blackstone', tab: 'build' },
  { name: 'magma_block', label: 'Bloco de magma', hardness: 0.5, ...rock, light: 3, tex: 'magma', tab: 'nature' },
  { name: 'infero_bricks', label: 'Tijolos do Ínfero', hardness: 2, ...rock, tex: 'infero_bricks', tab: 'build' },
  { name: 'cracked_infero_bricks', label: 'Tijolos do Ínfero rachados', hardness: 2, ...rock, tex: 'cracked_infero_bricks', tab: 'build' },
  { name: 'red_infero_bricks', label: 'Tijolos rubros do Ínfero', hardness: 2, ...rock, tex: 'red_infero_bricks', tab: 'build' },
  { name: 'infero_brick_fence', label: 'Cerca de tijolos do Ínfero', hardness: 2, ...rock, shape: 'fence', layer: 'solid', opaque: false, tex: 'infero_bricks', tab: 'deco' },
  { name: 'infero_quartz_ore', label: 'Minério de quartzo do Ínfero', hardness: 3, ...rock, tex: 'infero_quartz_ore', tab: 'nature' },
  { name: 'infero_gold_ore', label: 'Minério de ouro do Ínfero', hardness: 3, ...rock, tex: 'infero_gold_ore', tab: 'nature' },
  { name: 'ancient_ember', label: 'Brasa ancestral', hardness: 30, ...rock, level: 3, resistance: 1200, tex: { side: 'ancient_ember_side', top: 'ancient_ember_top' }, tab: 'nature' },
  { name: 'lumita', label: 'Lumita', hardness: 0.3, sound: 'glass', light: 15, tex: 'lumita', tab: 'nature' },
  { name: 'ember_wart_block', label: 'Bloco de verruga-brasa', hardness: 1, tool: 'hoe', sound: 'wool', tex: 'ember_wart_block', tab: 'nature' },
  { name: 'ember_wart', label: 'Verruga-brasa', hardness: 0, sound: 'crop', shape: 'crop', props: [{ name: 'age', values: [0, 1, 2, 3] }], tex: (p) => `ember_wart_stage${Math.min(2, Math.floor((p.age as number) * 2 / 3))}`, randomTicks: true, noItem: true, tab: 'none' },
  { name: 'ember_fungus', label: 'Fungo-brasa', hardness: 0, sound: 'plant', shape: 'cross', tex: 'ember_fungus', tab: 'nature' },
  { name: 'ember_roots', label: 'Raízes-brasa', hardness: 0, sound: 'plant', shape: 'cross', tex: 'ember_roots', replaceable: true, tab: 'nature' },
  { name: 'shroomlight', label: 'Cogulume', hardness: 1, tool: 'hoe', sound: 'wool', light: 15, tex: 'shroomlight', tab: 'nature' },
  { name: 'lament_lantern_block', label: 'Fogo-fátuo', hardness: 0.3, sound: 'glass', light: 12, props: [LIT], tex: 'sea_lantern', noItem: true, tab: 'none' },
  { name: 'ash_block', label: 'Bloco de cinzas', hardness: 0.5, tool: 'shovel', sound: 'ash', gravity: true, tex: 'ash_block', tab: 'nature' },
  { name: 'ignarca_altar', label: 'Altar de Ignarca', hardness: -1, resistance: 3600000, sound: 'stone', light: 7, tex: { top: 'ignarca_altar_top', side: 'ignarca_altar_side', bottom: 'polished_blackstone' }, noItem: true, tab: 'none' },
];
