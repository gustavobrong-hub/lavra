/**
 * Todas as receitas de crafting e fundição. Seguem as do original (formatos e quantidades);
 * as poucas próprias (por falta de itens equivalentes) estão marcadas com "receita própria".
 */
import { COLORS, STONE_VARIANTS } from '../../world/blocks/defs/building';
import { WOODS } from '../../world/blocks/defs/wood';
import { FLOWERS } from '../../world/blocks/defs/plants';
import { item } from '../items/registry';
import { defineGroup, shaped, shapeless, smelt } from './recipes';

let done = false;
export function initRecipes(): void {
  if (done) return;
  done = true;
  const has = (id: string) => !!item(id);

  // ------------------------------------------------------------ grupos
  defineGroup('planks', WOODS.map((w) => `${w.id}_planks`));
  defineGroup('logs', WOODS.flatMap((w) => [`${w.id}_log`, `${w.id}_wood`, `stripped_${w.id}_log`]));
  defineGroup('burnable_logs', WOODS.filter((w) => w.flammable).flatMap((w) => [`${w.id}_log`, `${w.id}_wood`, `stripped_${w.id}_log`]));
  defineGroup('wool', COLORS.map((c) => `${c.id}_wool`));
  defineGroup('wooden_slabs', WOODS.map((w) => `${w.id}_slab`));
  defineGroup('stone_tool_materials', ['cobblestone', 'cobbled_deepslate', 'blackstone']);
  defineGroup('coals', ['coal', 'charcoal']);
  defineGroup('sand', ['sand', 'red_sand']);
  defineGroup('fulgor_sources', ['fulgor_dust']);
  for (const w of WOODS) defineGroup(`${w.id}_logs`, [`${w.id}_log`, `${w.id}_wood`, `stripped_${w.id}_log`]);

  // ------------------------------------------------------------ madeira
  for (const w of WOODS) {
    const P = `${w.id}_planks`;
    shapeless(`${P}`, [`#${w.id}_logs`], P, 4, 'building', 'planks');
    shaped(`${w.id}_wood`, ['LL', 'LL'], { L: `${w.id}_log` }, `${w.id}_wood`, 3, 'building');
    shaped(`${w.id}_stairs`, ['P  ', 'PP ', 'PPP'], { P }, `${w.id}_stairs`, 4, 'building', 'wooden_stairs');
    shaped(`${w.id}_slab`, ['PPP'], { P }, `${w.id}_slab`, 6, 'building', 'wooden_slab');
    shaped(`${w.id}_fence`, ['PSP', 'PSP'], { P, S: 'stick' }, `${w.id}_fence`, 3, 'deco', 'wooden_fence');
    shaped(`${w.id}_fence_gate`, ['SPS', 'SPS'], { P, S: 'stick' }, `${w.id}_fence_gate`, 1, 'fulgor', 'wooden_fence_gate');
    shaped(`${w.id}_door`, ['PP', 'PP', 'PP'], { P }, `${w.id}_door`, 3, 'fulgor', 'wooden_door');
    shaped(`${w.id}_trapdoor`, ['PPP', 'PPP'], { P }, `${w.id}_trapdoor`, 2, 'fulgor', 'wooden_trapdoor');
    shaped(`${w.id}_sign`, ['PPP', 'PPP', ' S '], { P, S: 'stick' }, `${w.id}_sign`, 3, 'deco', 'wooden_sign');
    shapeless(`${w.id}_button`, [P], `${w.id}_button`, 1, 'fulgor', 'wooden_button');
    shaped(`${w.id}_pressure_plate`, ['PP'], { P }, `${w.id}_pressure_plate`, 1, 'fulgor', 'wooden_pressure_plate');
    if (has(`${w.id}_boat`)) shaped(`${w.id}_boat`, ['P P', 'PPP'], { P }, `${w.id}_boat`, 1, 'misc', 'boat');
  }
  shaped('stick', ['P', 'P'], { P: '#planks' }, 'stick', 4, 'misc');
  shaped('crafting_table', ['PP', 'PP'], { P: '#planks' }, 'crafting_table', 1, 'misc');
  shaped('chest', ['PPP', 'P P', 'PPP'], { P: '#planks' }, 'chest', 1, 'misc');
  shaped('barrel', ['PSP', 'P P', 'PSP'], { P: '#planks', S: '#wooden_slabs' }, 'barrel', 1, 'misc');
  shaped('bookshelf', ['PPP', 'BBB', 'PPP'], { P: '#planks', B: 'book' }, 'bookshelf', 1, 'building');
  shaped('ladder', ['S S', 'SSS', 'S S'], { S: 'stick' }, 'ladder', 3, 'deco');
  shaped('bowl', ['P P', ' P '], { P: '#planks' }, 'bowl', 4, 'misc');
  shaped('composter', ['S S', 'S S', 'SSS'], { S: '#wooden_slabs' }, 'composter', 1, 'misc');
  shaped('lectern', ['SSS', ' B ', ' S '], { S: '#wooden_slabs', B: 'bookshelf' }, 'lectern', 1, 'fulgor');
  shaped('cartography_table', ['pp', 'PP', 'PP'], { p: 'paper', P: '#planks' }, 'cartography_table', 1, 'misc');
  shaped('fletching_table', ['FF', 'PP', 'PP'], { F: 'flint', P: '#planks' }, 'fletching_table', 1, 'misc');
  shaped('smithing_table', ['II', 'PP', 'PP'], { I: 'iron_ingot', P: '#planks' }, 'smithing_table', 1, 'misc');
  shaped('loom', ['SS', 'PP'], { S: 'string', P: '#planks' }, 'loom', 1, 'misc');
  shaped('note_block', ['PPP', 'PRP', 'PPP'], { P: '#planks', R: 'fulgor_dust' }, 'note_block', 1, 'fulgor');
  shaped('jukebox', ['PPP', 'PDP', 'PPP'], { P: '#planks', D: 'diamond' }, 'jukebox', 1, 'misc');
  shaped('campfire', [' S ', 'SCS', 'LLL'], { S: 'stick', C: '#coals', L: '#logs' }, 'campfire', 1, 'misc');
  shaped('scaffolding', ['SSS', 'S S', 'S S'], { S: 'stick' }, 'scaffolding', 6, 'misc'); // receita própria (sem bambu)

  // ------------------------------------------------------------ pedra e construção
  shaped('furnace', ['CCC', 'C C', 'CCC'], { C: '#stone_tool_materials' }, 'furnace', 1, 'misc');
  shaped('smoker', [' L ', 'LFL', ' L '], { L: '#logs', F: 'furnace' }, 'smoker', 1, 'misc');
  shaped('blast_furnace', ['III', 'IFI', 'SSS'], { I: 'iron_ingot', F: 'furnace', S: 'smooth_stone' }, 'blast_furnace', 1, 'misc');
  shaped('stone_bricks', ['SS', 'SS'], { S: 'stone' }, 'stone_bricks', 4, 'building');
  shapeless('mossy_stone_bricks', ['stone_bricks', ['vine', 'moss_block']], 'mossy_stone_bricks', 1, 'building');
  shapeless('mossy_cobblestone', ['cobblestone', ['vine', 'moss_block']], 'mossy_cobblestone', 1, 'building');
  shaped('chiseled_stone_bricks', ['S', 'S'], { S: 'stone_brick_slab' }, 'chiseled_stone_bricks', 1, 'building');
  shaped('sandstone', ['SS', 'SS'], { S: 'sand' }, 'sandstone', 1, 'building');
  shaped('red_sandstone', ['SS', 'SS'], { S: 'red_sand' }, 'red_sandstone', 1, 'building');
  shaped('cut_sandstone', ['SS', 'SS'], { S: 'sandstone' }, 'cut_sandstone', 4, 'building');
  shaped('cut_red_sandstone', ['SS', 'SS'], { S: 'red_sandstone' }, 'cut_red_sandstone', 4, 'building');
  shaped('chiseled_sandstone', ['S', 'S'], { S: 'sandstone_slab' }, 'chiseled_sandstone', 1, 'building');
  for (const r of ['granite', 'diorite', 'andesite']) shaped(`polished_${r}`, ['SS', 'SS'], { S: r }, `polished_${r}`, 4, 'building');
  shapeless('granite', ['diorite', 'quartz'], 'granite', 1, 'building');
  shaped('diorite', ['CQ', 'QC'], { C: 'cobblestone', Q: 'quartz' }, 'diorite', 2, 'building');
  shapeless('andesite', ['diorite', 'cobblestone'], 'andesite', 2, 'building');
  shaped('polished_deepslate', ['SS', 'SS'], { S: 'cobbled_deepslate' }, 'polished_deepslate', 4, 'building');
  shaped('deepslate_bricks', ['SS', 'SS'], { S: 'polished_deepslate' }, 'deepslate_bricks', 4, 'building');
  shaped('deepslate_tiles', ['SS', 'SS'], { S: 'deepslate_bricks' }, 'deepslate_tiles', 4, 'building');
  shaped('bricks', ['BB', 'BB'], { B: 'brick' }, 'bricks', 1, 'building');
  shaped('infero_bricks', ['BB', 'BB'], { B: 'infero_brick' }, 'infero_bricks', 1, 'building');
  shaped('infero_brick_fence', ['BbB', 'BbB'], { B: 'infero_bricks', b: 'infero_brick' }, 'infero_brick_fence', 6, 'deco');
  shaped('red_infero_bricks', ['WB', 'BW'], { W: 'ember_wart', B: 'infero_brick' }, 'red_infero_bricks', 1, 'building');
  shaped('quartz_block', ['QQ', 'QQ'], { Q: 'quartz' }, 'quartz_block', 1, 'building');
  shaped('quartz_pillar', ['Q', 'Q'], { Q: 'quartz_block' }, 'quartz_pillar', 2, 'building');
  shaped('polished_blackstone', ['SS', 'SS'], { S: 'blackstone' }, 'polished_blackstone', 4, 'building');
  shaped('polished_basalt', ['SS', 'SS'], { S: 'basalt' }, 'polished_basalt', 4, 'building');
  shapeless('packed_mud', ['mud', 'wheat'], 'packed_mud', 1, 'building');
  shaped('mud_bricks', ['SS', 'SS'], { S: 'packed_mud' }, 'mud_bricks', 4, 'building');
  shaped('coarse_dirt', ['DG', 'GD'], { D: 'dirt', G: 'gravel' }, 'coarse_dirt', 4, 'building');
  shaped('clay', ['CC', 'CC'], { C: 'clay_ball' }, 'clay', 1, 'building');
  shaped('snow_block', ['SS', 'SS'], { S: 'snowball' }, 'snow_block', 1, 'building');
  shaped('snow', ['SSS'], { S: 'snow_block' }, 'snow', 6, 'building');
  shaped('glowstone', ['GG', 'GG'], { G: 'lumita_dust' }, 'glowstone', 1, 'building');
  shaped('sea_lantern', ['GLG', 'LLL', 'GLG'], { G: 'glass', L: 'lumita_dust' }, 'sea_lantern', 1, 'building'); // receita própria
  shaped('glass_pane', ['GGG', 'GGG'], { G: 'glass' }, 'glass_pane', 16, 'deco');
  shaped('tinted_glass', [' A ', 'AGA', ' A '], { A: 'amethyst_shard', G: 'glass' }, 'tinted_glass', 2, 'building');
  shaped('amethyst_block', ['AA', 'AA'], { A: 'amethyst_shard' }, 'amethyst_block', 1, 'building');
  shaped('flower_pot', ['B B', ' B '], { B: 'brick' }, 'flower_pot', 1, 'deco');
  shaped('slime_block', ['SSS', 'SSS', 'SSS'], { S: 'slime_ball' }, 'slime_block', 1, 'fulgor');
  shapeless('slime_ball_from_block', ['slime_block'], 'slime_ball', 9, 'misc');
  shaped('honey_block', ['HH', 'HH'], { H: 'honey_bottle' }, 'honey_block', 1, 'deco');
  shaped('hay_block', ['WWW', 'WWW', 'WWW'], { W: 'wheat' }, 'hay_block', 1, 'building');
  shapeless('wheat_from_hay', ['hay_block'], 'wheat', 9, 'misc');
  shaped('bone_block', ['BBB', 'BBB', 'BBB'], { B: 'bone_meal' }, 'bone_block', 1, 'building');
  shapeless('bone_meal_from_block', ['bone_block'], 'bone_meal', 9, 'misc');
  shapeless('bone_meal', ['bone'], 'bone_meal', 3, 'misc');
  shaped('melon', ['MMM', 'MMM', 'MMM'], { M: 'melon_slice' }, 'melon', 1, 'building');
  shapeless('melon_seeds', ['melon_slice'], 'melon_seeds', 1, 'misc');
  shapeless('pumpkin_seeds', ['pumpkin'], 'pumpkin_seeds', 4, 'misc');
  shapeless('jack_o_lantern', ['carved_pumpkin', 'torch'], 'jack_o_lantern', 1, 'building');
  // escadas, lajes e muros de pedra
  for (const v of STONE_VARIANTS) {
    const full = v.id === 'stone_brick' ? 'stone_bricks' : v.id === 'mossy_stone_brick' ? 'mossy_stone_bricks' : v.id === 'brick' ? 'bricks'
      : v.id === 'deepslate_brick' ? 'deepslate_bricks' : v.id === 'deepslate_tile' ? 'deepslate_tiles' : v.id === 'mud_brick' ? 'mud_bricks'
        : v.id === 'quartz' ? 'quartz_block' : v.id === 'infero_brick' ? 'infero_bricks' : v.id;
    if (!has(full)) continue;
    shaped(`${v.id}_stairs`, ['S  ', 'SS ', 'SSS'], { S: full }, `${v.id}_stairs`, 4, 'building');
    shaped(`${v.id}_slab`, ['SSS'], { S: full }, `${v.id}_slab`, 6, 'building');
    if (v.wall) shaped(`${v.id}_wall`, ['SSS', 'SSS'], { S: full }, `${v.id}_wall`, 6, 'deco');
  }

  // ------------------------------------------------------------ cores
  const DYE_OF: Record<string, [string, number]> = {
    buttercup: ['yellow', 1], poppy: ['red', 1], cornflower: ['blue', 1], daisy: ['light_gray', 1], purple_clover: ['magenta', 1],
    forget_me_not: ['light_blue', 1], red_tulip: ['red', 1], orange_tulip: ['orange', 1], white_tulip: ['light_gray', 1],
    pink_tulip: ['pink', 1], lily_of_the_valley: ['white', 1], blue_orchid: ['light_blue', 1], lume_bloom: ['cyan', 1],
    sunflower: ['yellow', 2], lilac: ['magenta', 2], rose_bush: ['red', 2], peony: ['pink', 2], beetroot: ['red', 1],
    bone_meal: ['white', 1], lapis_lazuli: ['blue', 1], brown_mushroom: ['brown', 1], coal: ['black', 1], charcoal: ['black', 1],
  };
  void FLOWERS;
  for (const [src, [c, n]] of Object.entries(DYE_OF)) shapeless(`${c}_dye_from_${src}`, [src], `${c}_dye`, n, 'misc', `${c}_dye`);
  const mixes: [string, string[], number][] = [
    ['orange', ['red_dye', 'yellow_dye'], 2], ['lime', ['green_dye', 'white_dye'], 2], ['pink', ['red_dye', 'white_dye'], 2],
    ['gray', ['black_dye', 'white_dye'], 2], ['light_gray', ['gray_dye', 'white_dye'], 2], ['cyan', ['blue_dye', 'green_dye'], 2],
    ['purple', ['red_dye', 'blue_dye'], 2], ['magenta', ['purple_dye', 'pink_dye'], 2], ['light_blue', ['blue_dye', 'white_dye'], 2],
  ];
  for (const [c, ings, n] of mixes) shapeless(`${c}_dye_mix`, ings, `${c}_dye`, n, 'misc', `${c}_dye`);
  for (const c of COLORS) {
    const dye = `${c.id}_dye`;
    shapeless(`${c.id}_wool`, [dye, '#wool'], `${c.id}_wool`, 1, 'building', 'wool');
    shaped(`${c.id}_carpet`, ['WW'], { W: `${c.id}_wool` }, `${c.id}_carpet`, 3, 'deco', 'carpet');
    shaped(`${c.id}_bed`, ['WWW', 'PPP'], { W: `${c.id}_wool`, P: '#planks' }, `${c.id}_bed`, 1, 'deco', 'bed');
    shaped(`${c.id}_stained_glass`, ['GGG', 'GDG', 'GGG'], { G: 'glass', D: dye }, `${c.id}_stained_glass`, 8, 'building', 'stained_glass');
    shaped(`${c.id}_stained_glass_pane`, ['GGG', 'GGG'], { G: `${c.id}_stained_glass` }, `${c.id}_stained_glass_pane`, 16, 'deco', 'stained_glass_pane');
    shaped(`${c.id}_terracotta`, ['TTT', 'TDT', 'TTT'], { T: 'terracotta', D: dye }, `${c.id}_terracotta`, 8, 'building', 'dyed_terracotta');
    shapeless(`${c.id}_concrete_powder`, [dye, 'sand', 'sand', 'sand', 'sand', 'gravel', 'gravel', 'gravel', 'gravel'], `${c.id}_concrete_powder`, 8, 'building', 'concrete_powder');
  }
  shaped('white_wool_from_string', ['SS', 'SS'], { S: 'string' }, 'white_wool', 1, 'building');

  // ------------------------------------------------------------ minérios e blocos de armazenamento
  const storage: [string, string][] = [
    ['coal', 'coal_block'], ['iron_ingot', 'iron_block'], ['gold_ingot', 'gold_block'], ['diamond', 'diamond_block'],
    ['emerald', 'emerald_block'], ['lapis_lazuli', 'lapis_block'], ['fulgor_dust', 'fulgor_block'], ['copper_ingot', 'copper_block'],
    ['raw_iron', 'raw_iron_block'], ['raw_copper', 'raw_copper_block'], ['raw_gold', 'raw_gold_block'],
  ];
  for (const [i, b] of storage) {
    shaped(b, ['III', 'III', 'III'], { I: i }, b, 1, 'building');
    shapeless(`${i}_from_${b}`, [b], i, 9, 'misc');
  }
  shaped('iron_ingot_from_nuggets', ['NNN', 'NNN', 'NNN'], { N: 'iron_nugget' }, 'iron_ingot', 1, 'misc');
  shaped('gold_ingot_from_nuggets', ['NNN', 'NNN', 'NNN'], { N: 'gold_nugget' }, 'gold_ingot', 1, 'misc');
  shapeless('iron_nugget', ['iron_ingot'], 'iron_nugget', 9, 'misc');
  shapeless('gold_nugget', ['gold_ingot'], 'gold_nugget', 9, 'misc');
  shapeless('igneous_ingot', ['ancient_scrap', 'ancient_scrap', 'ancient_scrap', 'ancient_scrap', 'gold_ingot', 'gold_ingot', 'gold_ingot', 'gold_ingot'], 'igneous_ingot', 1, 'misc');

  // ------------------------------------------------------------ ferramentas, armas e armaduras
  const mats: [string, string][] = [['wooden', '#planks'], ['stone', '#stone_tool_materials'], ['iron', 'iron_ingot'], ['golden', 'gold_ingot'], ['diamond', 'diamond']];
  for (const [t, M] of mats) {
    shaped(`${t}_pickaxe`, ['MMM', ' S ', ' S '], { M, S: 'stick' }, `${t}_pickaxe`, 1, 'tools');
    shaped(`${t}_axe`, ['MM', 'MS', ' S'], { M, S: 'stick' }, `${t}_axe`, 1, 'tools');
    shaped(`${t}_shovel`, ['M', 'S', 'S'], { M, S: 'stick' }, `${t}_shovel`, 1, 'tools');
    shaped(`${t}_hoe`, ['MM', ' S', ' S'], { M, S: 'stick' }, `${t}_hoe`, 1, 'tools');
    shaped(`${t}_sword`, ['M', 'M', 'S'], { M, S: 'stick' }, `${t}_sword`, 1, 'combat');
  }
  // ferramentas ígneas: diamante + lingote ígneo (no original é na mesa de ferraria)
  for (const k of ['pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'helmet', 'chestplate', 'leggings', 'boots']) {
    shapeless(`igneous_${k}`, [`diamond_${k}`, 'igneous_ingot'], `igneous_${k}`, 1, k === 'sword' || ['helmet', 'chestplate', 'leggings', 'boots'].includes(k) ? 'combat' : 'tools');
  }
  for (const [t, M] of [['leather', 'leather'], ['iron', 'iron_ingot'], ['golden', 'gold_ingot'], ['diamond', 'diamond']] as const) {
    shaped(`${t}_helmet`, ['MMM', 'M M'], { M }, `${t}_helmet`, 1, 'combat');
    shaped(`${t}_chestplate`, ['M M', 'MMM', 'MMM'], { M }, `${t}_chestplate`, 1, 'combat');
    shaped(`${t}_leggings`, ['MMM', 'M M', 'M M'], { M }, `${t}_leggings`, 1, 'combat');
    shaped(`${t}_boots`, ['M M', 'M M'], { M }, `${t}_boots`, 1, 'combat');
  }
  shaped('shield', ['PIP', 'PPP', ' P '], { P: '#planks', I: 'iron_ingot' }, 'shield', 1, 'combat');
  shaped('bow', [' TS', 'T S', ' TS'], { T: 'stick', S: 'string' }, 'bow', 1, 'combat');
  shaped('arrow', ['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' }, 'arrow', 4, 'combat');
  shaped('fishing_rod', ['  T', ' TS', 'T S'], { T: 'stick', S: 'string' }, 'fishing_rod', 1, 'tools');
  shaped('shears', [' I', 'I '], { I: 'iron_ingot' }, 'shears', 1, 'tools');
  shapeless('flint_and_steel', ['iron_ingot', 'flint'], 'flint_and_steel', 1, 'tools');
  shaped('bucket', ['I I', ' I '], { I: 'iron_ingot' }, 'bucket', 1, 'tools');
  shaped('compass', [' I ', 'IRI', ' I '], { I: 'iron_ingot', R: 'fulgor_dust' }, 'compass', 1, 'tools');
  shaped('clock', [' G ', 'GRG', ' G '], { G: 'gold_ingot', R: 'fulgor_dust' }, 'clock', 1, 'tools');
  shaped('map', ['PPP', 'PCP', 'PPP'], { P: 'paper', C: 'compass' }, 'map', 1, 'tools');
  shaped('lead', ['SS ', 'SB ', '  S'], { S: 'string', B: 'slime_ball' }, 'lead', 2, 'tools');
  shaped('glass_bottle', ['G G', ' G '], { G: 'glass' }, 'glass_bottle', 3, 'misc');
  shaped('paper', ['CCC'], { C: 'sugar_cane' }, 'paper', 3, 'misc');
  shapeless('book', ['paper', 'paper', 'paper', 'leather'], 'book', 1, 'misc');
  shapeless('writable_book', ['book', 'feather', 'black_dye'], 'writable_book', 1, 'misc');
  shaped('leather', ['HH', 'HH'], { H: 'rabbit_hide' }, 'leather', 1, 'misc');
  shapeless('sugar', ['sugar_cane'], 'sugar', 1, 'food');
  shapeless('ember_powder', ['ember_rod'], 'ember_powder', 2, 'misc');
  shapeless('ember_eye', ['shade_pearl', 'ember_powder'], 'ember_eye', 1, 'misc');
  shapeless('magma_cream', ['ember_powder', 'slime_ball'], 'magma_cream', 1, 'misc');
  shapeless('fermented_spider_eye', ['spider_eye', 'brown_mushroom', 'sugar'], 'fermented_spider_eye', 1, 'misc');
  shaped('glistering_melon', ['NNN', 'NMN', 'NNN'], { N: 'gold_nugget', M: 'melon_slice' }, 'glistering_melon', 1, 'misc');
  shaped('magma_block', ['MM', 'MM'], { M: 'magma_cream' }, 'magma_block', 1, 'building');

  // ------------------------------------------------------------ fulgor
  shaped('fulgor_torch', ['R', 'S'], { R: 'fulgor_dust', S: 'stick' }, 'fulgor_torch', 1, 'fulgor');
  shaped('torch', ['C', 'S'], { C: '#coals', S: 'stick' }, 'torch', 4, 'deco');
  shaped('soul_torch', ['C', 'S', 'L'], { C: '#coals', S: 'stick', L: ['lament_sand', 'lament_soil'] }, 'soul_torch', 4, 'deco');
  shaped('repeater', ['TRT', 'SSS'], { T: 'fulgor_torch', R: 'fulgor_dust', S: 'stone' }, 'repeater', 1, 'fulgor');
  shaped('comparator', [' T ', 'TQT', 'SSS'], { T: 'fulgor_torch', Q: 'quartz', S: 'stone' }, 'comparator', 1, 'fulgor');
  shaped('lever', ['S', 'C'], { S: 'stick', C: 'cobblestone' }, 'lever', 1, 'fulgor');
  shapeless('stone_button', ['stone'], 'stone_button', 1, 'fulgor');
  shaped('stone_pressure_plate', ['SS'], { S: 'stone' }, 'stone_pressure_plate', 1, 'fulgor');
  shaped('light_weighted_pressure_plate', ['GG'], { G: 'gold_ingot' }, 'light_weighted_pressure_plate', 1, 'fulgor');
  shaped('heavy_weighted_pressure_plate', ['II'], { I: 'iron_ingot' }, 'heavy_weighted_pressure_plate', 1, 'fulgor');
  shaped('piston', ['PPP', 'CIC', 'CRC'], { P: '#planks', C: 'cobblestone', I: 'iron_ingot', R: 'fulgor_dust' }, 'piston', 1, 'fulgor');
  shapeless('sticky_piston', ['slime_ball', 'piston'], 'sticky_piston', 1, 'fulgor');
  shaped('observer', ['CCC', 'RRQ', 'CCC'], { C: 'cobblestone', R: 'fulgor_dust', Q: 'quartz' }, 'observer', 1, 'fulgor');
  shaped('dispenser', ['CCC', 'CBC', 'CRC'], { C: 'cobblestone', B: 'bow', R: 'fulgor_dust' }, 'dispenser', 1, 'fulgor');
  shaped('dropper', ['CCC', 'C C', 'CRC'], { C: 'cobblestone', R: 'fulgor_dust' }, 'dropper', 1, 'fulgor');
  shaped('fulgor_lamp', [' R ', 'RGR', ' R '], { R: 'fulgor_dust', G: 'glowstone' }, 'fulgor_lamp', 1, 'fulgor');
  shaped('daylight_detector', ['GGG', 'QQQ', 'SSS'], { G: 'glass', Q: 'quartz', S: '#wooden_slabs' }, 'daylight_detector', 1, 'fulgor');
  shaped('target', [' R ', 'RHR', ' R '], { R: 'fulgor_dust', H: 'hay_block' }, 'target', 1, 'fulgor');
  shaped('tnt', ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: '#sand' }, 'tnt', 1, 'fulgor');
  shaped('iron_door', ['II', 'II', 'II'], { I: 'iron_ingot' }, 'iron_door', 3, 'fulgor');
  shaped('iron_trapdoor', ['II', 'II'], { I: 'iron_ingot' }, 'iron_trapdoor', 1, 'fulgor');
  shaped('iron_bars', ['III', 'III'], { I: 'iron_ingot' }, 'iron_bars', 16, 'deco');
  shaped('rail', ['I I', 'ISI', 'I I'], { I: 'iron_ingot', S: 'stick' }, 'rail', 16, 'fulgor');
  shaped('powered_rail', ['G G', 'GSG', 'GRG'], { G: 'gold_ingot', S: 'stick', R: 'fulgor_dust' }, 'powered_rail', 6, 'fulgor');
  shaped('detector_rail', ['I I', 'IPI', 'IRI'], { I: 'iron_ingot', P: 'stone_pressure_plate', R: 'fulgor_dust' }, 'detector_rail', 6, 'fulgor');
  shaped('activator_rail', ['ISI', 'ITI', 'ISI'], { I: 'iron_ingot', S: 'stick', T: 'fulgor_torch' }, 'activator_rail', 6, 'fulgor');
  shaped('minecart', ['I I', 'III'], { I: 'iron_ingot' }, 'minecart', 1, 'misc');
  shapeless('chest_minecart', ['chest', 'minecart'], 'chest_minecart', 1, 'misc');
  shapeless('furnace_minecart', ['furnace', 'minecart'], 'furnace_minecart', 1, 'misc');
  shapeless('tnt_minecart', ['tnt', 'minecart'], 'tnt_minecart', 1, 'misc');

  // ------------------------------------------------------------ utilidades
  shaped('anvil', ['BBB', ' I ', 'III'], { B: 'iron_block', I: 'iron_ingot' }, 'anvil', 1, 'misc');
  shaped('enchanting_table', [' B ', 'DOD', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' }, 'enchanting_table', 1, 'misc');
  shaped('brewing_stand', [' E ', 'CCC'], { E: 'ember_rod', C: '#stone_tool_materials' }, 'brewing_stand', 1, 'misc');
  shaped('cauldron', ['I I', 'I I', 'III'], { I: 'iron_ingot' }, 'cauldron', 1, 'misc');
  shaped('grindstone', ['SPS', 'W W'], { S: 'stick', P: 'stone_slab', W: '#planks' }, 'grindstone', 1, 'misc');
  shaped('stonecutter', [' I ', 'SSS'], { I: 'iron_ingot', S: 'stone' }, 'stonecutter', 1, 'misc');
  shaped('lantern', ['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'torch' }, 'lantern', 1, 'deco');
  shaped('soul_lantern', ['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'soul_torch' }, 'soul_lantern', 1, 'deco');
  shaped('chain', ['N', 'I', 'N'], { N: 'iron_nugget', I: 'iron_ingot' }, 'chain', 1, 'deco');
  shaped('beacon', ['GGG', 'GHG', 'OOO'], { G: 'glass', H: 'ignarca_heart', O: 'obsidian' }, 'beacon', 1, 'misc'); // receita própria (coração do chefe)

  // ------------------------------------------------------------ comida
  shaped('bread', ['WWW'], { W: 'wheat' }, 'bread', 1, 'food');
  shaped('cookie', ['WSW'], { W: 'wheat', S: 'sugar' }, 'cookie', 8, 'food'); // receita própria (sem cacau)
  shaped('cake', ['MMM', 'SES', 'WWW'], { M: 'milk_bucket', S: 'sugar', E: 'egg', W: 'wheat' }, 'cake', 1, 'food');
  shapeless('pumpkin_pie', ['pumpkin', 'sugar', 'egg'], 'pumpkin_pie', 1, 'food');
  shapeless('mushroom_stew', ['bowl', 'brown_mushroom', 'red_mushroom'], 'mushroom_stew', 1, 'food');
  shapeless('beetroot_soup', ['bowl', 'beetroot', 'beetroot', 'beetroot', 'beetroot', 'beetroot', 'beetroot'], 'beetroot_soup', 1, 'food');
  shapeless('rabbit_stew', ['bowl', 'cooked_rabbit', 'carrot', 'baked_potato', ['brown_mushroom', 'red_mushroom']], 'rabbit_stew', 1, 'food');
  shaped('golden_apple', ['GGG', 'GAG', 'GGG'], { G: 'gold_ingot', A: 'apple' }, 'golden_apple', 1, 'food');
  shaped('golden_carrot', ['NNN', 'NCN', 'NNN'], { N: 'gold_nugget', C: 'carrot' }, 'golden_carrot', 1, 'food');

  // ------------------------------------------------------------ fundição (xp e tipos de forno)
  const ore = (ids: string[], out: string, xp: number) => smelt(ids, out, xp, ['furnace', 'blast']);
  ore(['raw_iron', 'iron_ore', 'deepslate_iron_ore'], 'iron_ingot', 0.7);
  ore(['raw_gold', 'gold_ore', 'deepslate_gold_ore', 'infero_gold_ore'], 'gold_ingot', 1);
  ore(['raw_copper', 'copper_ore', 'deepslate_copper_ore'], 'copper_ingot', 0.7);
  ore(['coal_ore', 'deepslate_coal_ore'], 'coal', 0.1);
  ore(['diamond_ore', 'deepslate_diamond_ore'], 'diamond', 1);
  ore(['emerald_ore', 'deepslate_emerald_ore'], 'emerald', 1);
  ore(['lapis_ore', 'deepslate_lapis_ore'], 'lapis_lazuli', 0.2);
  ore(['fulgor_ore', 'deepslate_fulgor_ore'], 'fulgor_dust', 0.7);
  ore(['infero_quartz_ore'], 'quartz', 0.2);
  ore(['ancient_ember'], 'ancient_scrap', 2);
  const tools = ['pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'helmet', 'chestplate', 'leggings', 'boots'];
  ore(tools.map((k) => `iron_${k}`).concat(['chainmail_helmet', 'chainmail_chestplate', 'chainmail_leggings', 'chainmail_boots']), 'iron_nugget', 0.1);
  ore(tools.map((k) => `golden_${k}`), 'gold_nugget', 0.1);
  const food = (i: string, o: string, xp: number) => smelt(i, o, xp, ['furnace', 'smoker']);
  food('beef', 'cooked_beef', 0.35); food('porkchop', 'cooked_porkchop', 0.35); food('chicken', 'cooked_chicken', 0.35);
  food('mutton', 'cooked_mutton', 0.35); food('rabbit', 'cooked_rabbit', 0.35); food('lambari', 'cooked_lambari', 0.35);
  food('tambaqui', 'cooked_tambaqui', 0.35); food('potato', 'baked_potato', 0.35); food('kelp', 'dried_kelp', 0.1);
  smelt('#sand', 'glass', 0.1);
  smelt('cobblestone', 'stone', 0.1);
  smelt('stone', 'smooth_stone', 0.1);
  smelt('cobbled_deepslate', 'deepslate', 0.1);
  smelt('stone_bricks', 'cracked_stone_bricks', 0.1);
  smelt('infero_bricks', 'cracked_infero_bricks', 0.1);
  smelt('sandstone', 'smooth_sandstone', 0.1);
  smelt('clay_ball', 'brick', 0.3);
  smelt('clay', 'terracotta', 0.35);
  smelt('brasalito', 'infero_brick', 0.1);
  smelt('#burnable_logs', 'charcoal', 0.15);
  smelt('cactus', 'green_dye', 1);
  smelt('wet_sponge', 'sponge', 0.15);
  smelt('basalt', 'polished_basalt', 0.1);
  smelt('quartz_block', 'quartz_block', 0.1);
}
