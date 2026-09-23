import type { BlockDef } from '../types';
import { AGE, DOUBLE_HALF, FACING4, MOISTURE, VINE_E, VINE_N, VINE_S, VINE_UP, VINE_W } from '../props';

const plant = (name: string, label: string, extra: Partial<BlockDef> = {}): BlockDef => ({
  name, label, hardness: 0, shape: 'cross', sound: 'plant', tex: name, waving: 2, replaceable: false,
  flammable: [60, 100], tab: 'nature', ...extra,
});

const doublePlant = (name: string, label: string, extra: Partial<BlockDef> = {}): BlockDef => ({
  name, label, hardness: 0, shape: 'doubleplant', sound: 'plant', props: [DOUBLE_HALF],
  tex: (p) => (p.half === 'upper' ? `${name}_top` : `${name}_bottom`), waving: 2,
  flammable: [60, 100], tab: 'nature', ...extra,
});

export const FLOWERS = [
  ['buttercup', 'Botão-de-ouro'], ['poppy', 'Papoula'], ['cornflower', 'Centáurea'], ['daisy', 'Margarida'],
  ['purple_clover', 'Trevo-roxo'], ['forget_me_not', 'Miosótis'], ['red_tulip', 'Tulipa vermelha'],
  ['orange_tulip', 'Tulipa laranja'], ['white_tulip', 'Tulipa branca'], ['pink_tulip', 'Tulipa rosa'],
  ['lily_of_the_valley', 'Lírio-do-vale'], ['blue_orchid', 'Orquídea-azul'],
] as const;

export const PLANTS: BlockDef[] = [
  plant('short_grass', 'Grama', { tint: 'grass', replaceable: true }),
  plant('fern', 'Samambaia', { tint: 'grass', replaceable: true }),
  plant('dead_bush', 'Arbusto seco', { replaceable: true, waving: 0 }),
  ...FLOWERS.map(([id, label]) => plant(id, label)),
  plant('lume_bloom', 'Flor-lume', { light: 10 }),
  plant('brown_mushroom', 'Cogumelo marrom', { shape: 'mushroom', light: 1, waving: 0, randomTicks: true, flammable: undefined }),
  plant('red_mushroom', 'Cogumelo vermelho', { shape: 'mushroom', waving: 0, randomTicks: true, flammable: undefined }),
  plant('lume_mushroom', 'Cogumelo-lume', { shape: 'mushroom', light: 12, waving: 0, flammable: undefined }),
  doublePlant('tall_grass', 'Capim alto', { tint: 'grass', replaceable: true }),
  doublePlant('large_fern', 'Samambaia grande', { tint: 'grass', replaceable: true }),
  doublePlant('sunflower', 'Girassol'),
  doublePlant('lilac', 'Lilás'),
  doublePlant('rose_bush', 'Roseira'),
  doublePlant('peony', 'Peônia'),
  {
    name: 'cactus', label: 'Cacto', hardness: 0.4, sound: 'wool', shape: 'cactus', layer: 'cutout', opaque: false,
    props: [AGE(15)], tex: { side: 'cactus_side', top: 'cactus_top', bottom: 'cactus_bottom' }, randomTicks: true, tab: 'nature',
  },
  {
    name: 'sugar_cane', label: 'Cana-de-açúcar', hardness: 0, shape: 'cross', sound: 'plant', props: [AGE(15)],
    tex: 'sugar_cane', tint: 'grass', randomTicks: true, waving: 0, tab: 'nature',
  },
  { name: 'pumpkin', label: 'Abóbora', hardness: 1, tool: 'axe', sound: 'wood', tex: { side: 'pumpkin_side', top: 'pumpkin_top', bottom: 'pumpkin_top' }, tab: 'nature' },
  { name: 'carved_pumpkin', label: 'Abóbora esculpida', hardness: 1, tool: 'axe', sound: 'wood', props: [FACING4], defaults: { facing: 'south' }, tex: { side: 'pumpkin_side', top: 'pumpkin_top', bottom: 'pumpkin_top', front: 'carved_pumpkin' }, tab: 'nature' },
  { name: 'jack_o_lantern', label: 'Abóbora iluminada', hardness: 1, tool: 'axe', sound: 'wood', light: 15, props: [FACING4], defaults: { facing: 'south' }, tex: { side: 'pumpkin_side', top: 'pumpkin_top', bottom: 'pumpkin_top', front: 'jack_o_lantern' }, tab: 'deco' },
  { name: 'melon', label: 'Melancia', hardness: 1, tool: 'axe', sound: 'wood', tex: { side: 'melon_side', top: 'melon_top', bottom: 'melon_top' }, tab: 'nature' },
  { name: 'brown_mushroom_block', label: 'Bloco de cogumelo marrom', hardness: 0.2, tool: 'axe', sound: 'wood', tex: 'brown_mushroom_block', tab: 'nature' },
  { name: 'red_mushroom_block', label: 'Bloco de cogumelo vermelho', hardness: 0.2, tool: 'axe', sound: 'wood', tex: 'red_mushroom_block', tab: 'nature' },
  { name: 'mushroom_stem', label: 'Talo de cogumelo', hardness: 0.2, tool: 'axe', sound: 'wood', tex: 'mushroom_stem', tab: 'nature' },
  {
    name: 'vine', label: 'Vinha', hardness: 0.2, tool: 'shears', sound: 'plant', shape: 'vine', layer: 'cutout', opaque: false,
    props: [VINE_N, VINE_S, VINE_W, VINE_E, VINE_UP], tex: 'vine', tint: 'foliage', climbable: true, replaceable: true,
    randomTicks: true, waving: 1, flammable: [15, 100], tab: 'nature',
  },
  { name: 'lily_pad', label: 'Vitória-régia', hardness: 0, sound: 'plant', shape: 'lilypad', layer: 'cutout', opaque: false, tex: 'lily_pad', tint: 'grass', tab: 'nature' },
  { name: 'sweet_berry_bush', label: 'Arbusto de amoras', hardness: 0, sound: 'plant', shape: 'bush', props: [AGE(3)], tex: (p) => `sweet_berry_bush_${p.age}`, randomTicks: true, waving: 2, speedFactor: 0.8, flammable: [60, 100], tab: 'nature' },
  { name: 'kelp', label: 'Alga', hardness: 0, sound: 'plant', shape: 'kelp', props: [AGE(25)], tex: 'kelp', randomTicks: true, waving: 2, tab: 'nature' },
  { name: 'kelp_plant', label: 'Alga', hardness: 0, sound: 'plant', shape: 'kelp', tex: 'kelp_plant', waving: 2, noItem: true, itemOf: 'kelp', tab: 'none' },
  { name: 'seagrass', label: 'Capim-marinho', hardness: 0, sound: 'plant', shape: 'kelp', tex: 'seagrass', waving: 2, replaceable: true, tab: 'nature' },
  { name: 'tall_seagrass', label: 'Capim-marinho alto', hardness: 0, sound: 'plant', shape: 'kelp', props: [DOUBLE_HALF], tex: (p) => (p.half === 'upper' ? 'tall_seagrass_top' : 'tall_seagrass_bottom'), waving: 2, replaceable: true, noItem: true, itemOf: 'seagrass', tab: 'none' },
  { name: 'cobweb', label: 'Teia', hardness: 4, tool: 'sword', sound: 'wool', shape: 'cobweb', layer: 'cutout', opaque: false, solid: false, tex: 'cobweb', tab: 'deco' },
  // plantações
  { name: 'farmland', label: 'Terra arada', hardness: 0.6, tool: 'shovel', sound: 'gravel', shape: 'farmland', layer: 'solid', opaque: false, props: [MOISTURE], tex: (p) => ({ top: (p.moisture as number) >= 7 ? 'farmland_moist' : 'farmland', side: 'dirt', bottom: 'dirt' }), randomTicks: true, tab: 'nature' },
  { name: 'wheat', label: 'Trigo', hardness: 0, sound: 'crop', shape: 'crop', props: [AGE(7)], tex: (p) => `wheat_stage${p.age}`, randomTicks: true, waving: 2, noItem: true, tab: 'none' },
  { name: 'carrots', label: 'Cenouras', hardness: 0, sound: 'crop', shape: 'crop', props: [AGE(7)], tex: (p) => `carrots_stage${Math.floor((p.age as number) / 2)}`, randomTicks: true, waving: 2, noItem: true, tab: 'none' },
  { name: 'potatoes', label: 'Batatas', hardness: 0, sound: 'crop', shape: 'crop', props: [AGE(7)], tex: (p) => `potatoes_stage${Math.floor((p.age as number) / 2)}`, randomTicks: true, waving: 2, noItem: true, tab: 'none' },
  { name: 'beetroots', label: 'Beterrabas', hardness: 0, sound: 'crop', shape: 'crop', props: [AGE(3)], tex: (p) => `beetroots_stage${p.age}`, randomTicks: true, waving: 2, noItem: true, tab: 'none' },
  { name: 'pumpkin_stem', label: 'Caule de abóbora', hardness: 0, sound: 'crop', shape: 'stem', props: [AGE(7)], tex: 'stem', tint: 'stem', randomTicks: true, noItem: true, tab: 'none' },
  { name: 'melon_stem', label: 'Caule de melancia', hardness: 0, sound: 'crop', shape: 'stem', props: [AGE(7)], tex: 'stem', tint: 'stem', randomTicks: true, noItem: true, tab: 'none' },
  { name: 'attached_pumpkin_stem', label: 'Caule de abóbora', hardness: 0, sound: 'crop', shape: 'stem', props: [FACING4], tex: 'attached_stem', tint: 'stem', noItem: true, tab: 'none' },
  { name: 'attached_melon_stem', label: 'Caule de melancia', hardness: 0, sound: 'crop', shape: 'stem', props: [FACING4], tex: 'attached_stem', tint: 'stem', noItem: true, tab: 'none' },
];
