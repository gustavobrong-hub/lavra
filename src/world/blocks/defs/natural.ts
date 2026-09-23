import type { BlockDef } from '../types';
import { AXIS, LAYERS, LEVEL16, LIT, SNOWY } from '../props';

const stone = (name: string, label: string, hardness: number, tex: string, extra: Partial<BlockDef> = {}): BlockDef => ({
  name, label, hardness, resistance: 6, tool: 'pickaxe', requiresTool: true, sound: 'stone', tex, tab: 'build', ...extra,
});

const ore = (name: string, label: string, deep: boolean, level: number, extra: Partial<BlockDef> = {}): BlockDef => ({
  name, label, hardness: deep ? 4.5 : 3, resistance: 3, tool: 'pickaxe', requiresTool: true, level,
  sound: 'stone', tex: name, tab: 'nature', ...extra,
});

export const NATURAL: BlockDef[] = [
  { name: 'air', label: 'Ar', hardness: 0, shape: 'none', layer: 'none', noItem: true, tab: 'none' },
  { name: 'cave_air', label: 'Ar de caverna', hardness: 0, shape: 'none', layer: 'none', noItem: true, tab: 'none' },
  stone('stone', 'Pedra', 1.5, 'stone'),
  stone('granite', 'Granito', 1.5, 'granite'),
  stone('polished_granite', 'Granito polido', 1.5, 'polished_granite'),
  stone('diorite', 'Diorito', 1.5, 'diorite'),
  stone('polished_diorite', 'Diorito polido', 1.5, 'polished_diorite'),
  stone('andesite', 'Andesito', 1.5, 'andesite'),
  stone('polished_andesite', 'Andesito polido', 1.5, 'polished_andesite'),
  stone('deepslate', 'Ardósia profunda', 3, 'deepslate', { props: [AXIS], tex: (p) => p.axis === 'y' ? { side: 'deepslate', end: 'deepslate_top' } : p.axis === 'x' ? { side: 'deepslate@90', west: 'deepslate_top', east: 'deepslate_top', up: 'deepslate@90', down: 'deepslate@90' } : { side: 'deepslate', north: 'deepslate_top', south: 'deepslate_top', west: 'deepslate@90', east: 'deepslate@90' } }),
  stone('cobbled_deepslate', 'Ardósia britada', 3.5, 'cobbled_deepslate'),
  stone('polished_deepslate', 'Ardósia polida', 3.5, 'polished_deepslate'),
  stone('deepslate_bricks', 'Tijolos de ardósia', 3.5, 'deepslate_bricks'),
  stone('deepslate_tiles', 'Ladrilhos de ardósia', 3.5, 'deepslate_tiles'),
  stone('tuff', 'Tufo', 1.5, 'tuff'),
  stone('calcite', 'Calcita', 0.75, 'calcite'),
  stone('cobblestone', 'Pedregulho', 2, 'cobblestone'),
  stone('mossy_cobblestone', 'Pedregulho musgoso', 2, 'mossy_cobblestone'),
  stone('smooth_stone', 'Pedra lisa', 2, 'smooth_stone'),
  stone('obsidian', 'Obsidiana', 50, 'obsidian', { level: 3, resistance: 1200 }),
  stone('crying_obsidian', 'Obsidiana chorosa', 50, 'crying_obsidian', { level: 3, resistance: 1200, light: 10 }),
  { name: 'bedrock', label: 'Rocha-mãe', hardness: -1, resistance: 3600000, sound: 'stone', tex: 'bedrock', tab: 'build' },

  // terra e afins
  {
    name: 'grass_block', label: 'Bloco de grama', hardness: 0.6, tool: 'shovel', sound: 'grass', props: [SNOWY], randomTicks: true,
    tex: (p) => p.snowy ? { top: 'grass_top', bottom: 'dirt', side: 'grass_side_snowy' } : { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
    tint: 'grass', tab: 'nature',
  },
  { name: 'dirt', label: 'Terra', hardness: 0.5, tool: 'shovel', sound: 'gravel', tex: 'dirt', tab: 'nature' },
  { name: 'coarse_dirt', label: 'Terra grossa', hardness: 0.5, tool: 'shovel', sound: 'gravel', tex: 'coarse_dirt', tab: 'nature' },
  { name: 'rooted_dirt', label: 'Terra enraizada', hardness: 0.5, tool: 'shovel', sound: 'gravel', tex: 'rooted_dirt', tab: 'nature' },
  { name: 'podzol', label: 'Podzol', hardness: 0.5, tool: 'shovel', sound: 'gravel', props: [SNOWY], tex: (p) => ({ top: 'podzol_top', bottom: 'dirt', side: p.snowy ? 'grass_side_snowy' : 'podzol_side' }), tab: 'nature' },
  { name: 'mycelium', label: 'Micélio', hardness: 0.6, tool: 'shovel', sound: 'grass', props: [SNOWY], randomTicks: true, tex: (p) => ({ top: 'mycelium_top', bottom: 'dirt', side: p.snowy ? 'grass_side_snowy' : 'mycelium_side' }), tab: 'nature' },
  { name: 'lume_moss', label: 'Musgo-lume', hardness: 0.6, tool: 'shovel', sound: 'grass', props: [SNOWY], randomTicks: true, light: 3, tex: { top: 'lume_moss_top', bottom: 'dirt', side: 'lume_moss_side' }, tab: 'nature' },
  { name: 'mud', label: 'Lama', hardness: 0.5, tool: 'shovel', sound: 'mud', tex: 'mud', speedFactor: 0.8, tab: 'nature' },
  { name: 'packed_mud', label: 'Lama compactada', hardness: 1, tool: 'pickaxe', sound: 'mud', tex: 'packed_mud', tab: 'build' },
  { name: 'mud_bricks', label: 'Tijolos de lama', hardness: 1.5, tool: 'pickaxe', requiresTool: true, sound: 'stone', tex: 'mud_bricks', tab: 'build' },
  { name: 'clay', label: 'Argila', hardness: 0.6, tool: 'shovel', sound: 'gravel', tex: 'clay', tab: 'nature' },
  { name: 'moss_block', label: 'Bloco de musgo', hardness: 0.1, tool: 'hoe', sound: 'grass', tex: 'moss_block', tab: 'nature' },
  { name: 'gravel', label: 'Cascalho', hardness: 0.6, tool: 'shovel', sound: 'gravel', gravity: true, tex: 'gravel', tab: 'nature' },
  { name: 'sand', label: 'Areia', hardness: 0.5, tool: 'shovel', sound: 'sand', gravity: true, tex: 'sand', tab: 'nature' },
  { name: 'red_sand', label: 'Areia vermelha', hardness: 0.5, tool: 'shovel', sound: 'sand', gravity: true, tex: 'red_sand', tab: 'nature' },
  stone('sandstone', 'Arenito', 0.8, 'sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone' } }),
  stone('chiseled_sandstone', 'Arenito talhado', 0.8, 'chiseled_sandstone', { tex: { top: 'sandstone_top', side: 'chiseled_sandstone' } }),
  stone('cut_sandstone', 'Arenito cortado', 0.8, 'cut_sandstone', { tex: { top: 'sandstone_top', side: 'cut_sandstone' } }),
  stone('smooth_sandstone', 'Arenito liso', 2, 'sandstone_top'),
  stone('red_sandstone', 'Arenito vermelho', 0.8, 'red_sandstone', { tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone' } }),
  stone('cut_red_sandstone', 'Arenito vermelho cortado', 0.8, 'cut_red_sandstone', { tex: { top: 'red_sandstone_top', side: 'cut_red_sandstone' } }),
  stone('terracotta', 'Terracota', 1.25, 'terracotta', { resistance: 4.2 }),

  // gelo e neve
  { name: 'ice', label: 'Gelo', hardness: 0.5, tool: 'pickaxe', sound: 'glass', tex: 'ice', layer: 'translucent', opaque: false, opacity: 1, friction: 0.98, cullSame: true, randomTicks: true, tab: 'nature' },
  { name: 'packed_ice', label: 'Gelo compactado', hardness: 0.5, tool: 'pickaxe', sound: 'glass', tex: 'packed_ice', friction: 0.98, tab: 'nature' },
  { name: 'blue_ice', label: 'Gelo azul', hardness: 2.8, tool: 'pickaxe', sound: 'glass', tex: 'blue_ice', friction: 0.989, tab: 'nature' },
  { name: 'snow', label: 'Neve', hardness: 0.1, tool: 'shovel', requiresTool: true, sound: 'snow', shape: 'snowlayer', layer: 'solid', opaque: false, props: [LAYERS], tex: 'snow', replaceable: true, randomTicks: true, tab: 'nature' },
  { name: 'snow_block', label: 'Bloco de neve', hardness: 0.2, tool: 'shovel', requiresTool: true, sound: 'snow', tex: 'snow', tab: 'nature' },

  // fluidos
  { name: 'water', label: 'Água', hardness: 100, shape: 'fluid', layer: 'water', props: [LEVEL16], fluid: 'water', opacity: 1, tex: { side: 'water_flow', top: 'water_still' }, tint: 'water', replaceable: true, noItem: true, sound: 'water', tab: 'none' },
  { name: 'lava', label: 'Lava', hardness: 100, shape: 'fluid', layer: 'solid', props: [LEVEL16], fluid: 'lava', light: 15, opacity: 1, tex: { side: 'lava_flow', top: 'lava_still' }, replaceable: true, noItem: true, randomTicks: true, sound: 'lava', tab: 'none' },

  // minérios
  ore('coal_ore', 'Minério de carvão', false, 0),
  ore('deepslate_coal_ore', 'Minério de carvão em ardósia', true, 0),
  ore('iron_ore', 'Minério de ferro', false, 1),
  ore('deepslate_iron_ore', 'Minério de ferro em ardósia', true, 1),
  ore('copper_ore', 'Minério de cobre', false, 1),
  ore('deepslate_copper_ore', 'Minério de cobre em ardósia', true, 1),
  ore('gold_ore', 'Minério de ouro', false, 2),
  ore('deepslate_gold_ore', 'Minério de ouro em ardósia', true, 2),
  ore('fulgor_ore', 'Minério de fulgor', false, 2, { props: [LIT], light: (p) => (p.lit ? 9 : 0), randomTicks: true, tex: (p) => (p.lit ? 'fulgor_ore_lit' : 'fulgor_ore') }),
  ore('deepslate_fulgor_ore', 'Minério de fulgor em ardósia', true, 2, { props: [LIT], light: (p) => (p.lit ? 9 : 0), randomTicks: true, tex: (p) => (p.lit ? 'deepslate_fulgor_ore_lit' : 'deepslate_fulgor_ore') }),
  ore('lapis_ore', 'Minério de lápis-lazúli', false, 1),
  ore('deepslate_lapis_ore', 'Minério de lápis-lazúli em ardósia', true, 1),
  ore('diamond_ore', 'Minério de diamante', false, 2),
  ore('deepslate_diamond_ore', 'Minério de diamante em ardósia', true, 2),
  ore('emerald_ore', 'Minério de esmeralda', false, 2),
  ore('deepslate_emerald_ore', 'Minério de esmeralda em ardósia', true, 2),

  // blocos de minério
  stone('coal_block', 'Bloco de carvão', 5, 'coal_block', { flammable: [5, 5] }),
  stone('raw_iron_block', 'Bloco de ferro bruto', 5, 'raw_iron_block', { level: 1 }),
  stone('raw_copper_block', 'Bloco de cobre bruto', 5, 'raw_copper_block', { level: 1 }),
  stone('raw_gold_block', 'Bloco de ouro bruto', 5, 'raw_gold_block', { level: 2 }),
  stone('iron_block', 'Bloco de ferro', 5, 'iron_block', { level: 1, sound: 'metal' }),
  stone('copper_block', 'Bloco de cobre', 3, 'copper_block', { level: 1, sound: 'metal' }),
  stone('gold_block', 'Bloco de ouro', 3, 'gold_block', { level: 2, sound: 'metal' }),
  stone('diamond_block', 'Bloco de diamante', 5, 'diamond_block', { level: 2, sound: 'metal' }),
  stone('emerald_block', 'Bloco de esmeralda', 5, 'emerald_block', { level: 2, sound: 'metal' }),
  stone('lapis_block', 'Bloco de lápis-lazúli', 3, 'lapis_block', { level: 1 }),
  stone('fulgor_block', 'Bloco de fulgor', 5, 'fulgor_block', { sound: 'metal', tab: 'fulgor' }),
  stone('amethyst_block', 'Bloco de ametista', 1.5, 'amethyst_block', { sound: 'amethyst' }),
];
