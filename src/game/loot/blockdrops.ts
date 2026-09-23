/**
 * O que cada bloco deixa cair ao ser quebrado (tabelas de loot do original, com Fortuna e Toque Sutil)
 * e quanta experiência dá.
 */
import { BLOCKS, BLOCK_OF, STATE_PROPS } from '../../world/blocks/registry';
import { item } from '../items/registry';
import { ItemStack } from '../items/stack';

export type Rng = () => number;

export interface DropResult { items: ItemStack[]; xp: number }

const ri = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
const binom = (rng: Rng, n: number, p: number) => { let k = 0; for (let i = 0; i < n; i++) if (rng() < p) k++; return k; };
/** Fortuna do tipo "multiplicador" (minérios comuns) */
const oreBonus = (rng: Rng, count: number, fortune: number) => {
  if (fortune <= 0) return count;
  const m = Math.max(0, Math.floor(rng() * (fortune + 2)) - 1);
  return count * (m + 1);
};
/** Fortuna do tipo "uniforme" (fulgor, amoras): soma 0..fortuna */
const uniformBonus = (rng: Rng, count: number, fortune: number) => count + (fortune > 0 ? Math.floor(rng() * (fortune + 1)) : 0);

export interface ToolContext {
  /** tipo de ferramenta em mãos (ou null) */
  kind: string | null;
  tier: number;
  silk: boolean;
  fortune: number;
  shears: boolean;
}

/** A ferramenta certa para colher este bloco? */
export function canHarvest(state: number, t: ToolContext): boolean {
  const def = BLOCKS[BLOCK_OF[state]].def;
  if (!def.requiresTool) return true;
  if (def.tool === 'shears') return t.shears;
  if (!t.kind || t.kind !== def.tool) return false;
  return t.tier >= (def.level ?? 0);
}

export function blockDrops(state: number, t: ToolContext, rng: Rng): DropResult {
  const b = BLOCKS[BLOCK_OF[state]];
  const name = b.name;
  const p = STATE_PROPS[state] ?? {};
  const out: ItemStack[] = [];
  let xp = 0;
  const give = (id: string, n = 1) => { if (n > 0 && item(id)) out.push(new ItemStack(id, n)); };
  const self = () => give(b.def.itemOf ?? name, 1);
  if (!canHarvest(state, t)) return { items: out, xp };
  if (b.def.noItem && !b.def.itemOf && !special.has(name)) return { items: out, xp };

  // --- Toque Sutil: blocos que normalmente viram outra coisa caem inteiros
  if (t.silk && silkable(name)) { self(); return { items: out, xp }; }

  switch (true) {
    case name === 'stone': give('cobblestone'); break;
    case name === 'deepslate': give('cobbled_deepslate'); break;
    case name === 'grass_block' || name === 'podzol' || name === 'mycelium' || name === 'lume_moss' || name === 'dirt_path' || name === 'farmland': give('dirt'); break;
    case name === 'coal_ore' || name === 'deepslate_coal_ore': give('coal', oreBonus(rng, 1, t.fortune)); xp = ri(rng, 0, 2); break;
    case name === 'iron_ore' || name === 'deepslate_iron_ore': give('raw_iron', oreBonus(rng, 1, t.fortune)); break;
    case name === 'copper_ore' || name === 'deepslate_copper_ore': give('raw_copper', oreBonus(rng, ri(rng, 2, 5), t.fortune)); break;
    case name === 'gold_ore' || name === 'deepslate_gold_ore': give('raw_gold', oreBonus(rng, 1, t.fortune)); break;
    case name === 'fulgor_ore' || name === 'deepslate_fulgor_ore': give('fulgor_dust', uniformBonus(rng, ri(rng, 4, 5), t.fortune)); xp = ri(rng, 1, 5); break;
    case name === 'lapis_ore' || name === 'deepslate_lapis_ore': give('lapis_lazuli', oreBonus(rng, ri(rng, 4, 9), t.fortune)); xp = ri(rng, 2, 5); break;
    case name === 'diamond_ore' || name === 'deepslate_diamond_ore': give('diamond', oreBonus(rng, 1, t.fortune)); xp = ri(rng, 3, 7); break;
    case name === 'emerald_ore' || name === 'deepslate_emerald_ore': give('emerald', oreBonus(rng, 1, t.fortune)); xp = ri(rng, 3, 7); break;
    case name === 'infero_quartz_ore': give('quartz', oreBonus(rng, 1, t.fortune)); xp = ri(rng, 2, 5); break;
    case name === 'infero_gold_ore': give('gold_nugget', oreBonus(rng, ri(rng, 2, 6), t.fortune)); xp = ri(rng, 0, 1); break;
    case name === 'gravel': {
      const ch = [0.1, 0.14285715, 0.25, 1][Math.min(3, t.fortune)];
      if (rng() < ch) give('flint'); else self();
      break;
    }
    case name === 'glass' || name === 'glass_pane' || name.endsWith('_stained_glass') || name.endsWith('_stained_glass_pane') || name === 'ice' || name === 'packed_ice' || name === 'blue_ice':
      break;
    case name.endsWith('_leaves'): {
      if (t.shears) { self(); break; }
      const wood = name.replace('_leaves', '');
      const sapChance = [wood === 'jungle' ? 0.025 : 0.05, 0.0625, 0.083333336, 0.1][Math.min(3, t.fortune)];
      if (item(`${wood}_sapling`) && rng() < sapChance) give(`${wood}_sapling`);
      if (rng() < [0.02, 0.022222223, 0.025, 0.033333335][Math.min(3, t.fortune)]) give('stick', ri(rng, 1, 2));
      if ((wood === 'oak' || wood === 'dark_oak') && rng() < [0.005, 0.0055555557, 0.00625, 0.008333334][Math.min(3, t.fortune)]) give('apple');
      break;
    }
    case name === 'short_grass' || name === 'fern' || name === 'tall_grass' || name === 'large_fern': {
      if (t.shears) { if (name === 'short_grass' || name === 'fern') self(); else give(name === 'tall_grass' ? 'short_grass' : 'fern', 2); break; }
      if (name === 'tall_grass' || name === 'large_fern') { if (p.half === 'lower' && rng() < 0.125) give('wheat_seeds'); break; }
      if (rng() < 0.125) give('wheat_seeds', 1 + (t.fortune > 0 ? Math.floor(rng() * (t.fortune * 2 + 1)) : 0));
      break;
    }
    case name === 'dead_bush': if (t.shears) self(); else give('stick', ri(rng, 0, 2)); break;
    case name === 'vine' || name === 'seagrass' || name === 'tall_seagrass': if (t.shears) give(name === 'vine' ? 'vine' : 'seagrass'); break;
    case name === 'cobweb': if (t.shears) self(); else if (t.kind === 'sword') give('string'); else give('string'); break;
    case name === 'wheat': {
      if (p.age === 7) { give('wheat'); give('wheat_seeds', 1 + binom(rng, 3 + t.fortune, 0.5714286)); } else give('wheat_seeds');
      break;
    }
    case name === 'carrots': give('carrot', p.age === 7 ? 1 + binom(rng, 3 + t.fortune, 0.5714286) : 1); break;
    case name === 'potatoes': {
      give('potato', p.age === 7 ? 1 + binom(rng, 3 + t.fortune, 0.5714286) : 1);
      if (p.age === 7 && rng() < 0.02) give('poisonous_potato');
      break;
    }
    case name === 'beetroots': {
      if (p.age === 3) { give('beetroot'); give('beetroot_seeds', 1 + binom(rng, 3 + t.fortune, 0.5714286)); } else give('beetroot_seeds');
      break;
    }
    case name === 'ember_wart': give('ember_wart', p.age === 3 ? uniformBonus(rng, ri(rng, 2, 4), t.fortune) : 1); break;
    case name === 'pumpkin_stem' || name === 'attached_pumpkin_stem': { const a = (p.age as number) ?? 7; const n = binom(rng, 3, (a + 1) / 15); give('pumpkin_seeds', n); break; }
    case name === 'melon_stem' || name === 'attached_melon_stem': { const a = (p.age as number) ?? 7; const n = binom(rng, 3, (a + 1) / 15); give('melon_seeds', n); break; }
    case name === 'melon': give('melon_slice', Math.min(9, uniformBonus(rng, ri(rng, 3, 7), t.fortune))); break;
    case name === 'sweet_berry_bush': { const a = p.age as number; if (a === 2) give('sweet_berries', ri(rng, 1, 2)); else if (a === 3) give('sweet_berries', ri(rng, 2, 3)); break; }
    case name === 'snow': give('snowball', p.layers as number); break;
    case name === 'snow_block': give('snowball', 4); break;
    case name === 'clay': give('clay_ball', 4); break;
    case name === 'glowstone' || name === 'lumita': give('lumita_dust', Math.min(4, uniformBonus(rng, ri(rng, 2, 4), t.fortune))); break;
    case name === 'bookshelf': give('book', 3); break;
    case name === 'brown_mushroom_block': give('brown_mushroom', Math.max(0, ri(rng, -7, 2))); break;
    case name === 'red_mushroom_block': give('red_mushroom', Math.max(0, ri(rng, -7, 2))); break;
    case name === 'campfire': give('charcoal', 2); break;
    case name.endsWith('_bed'): if (p.part === 'head') self(); break;
    case b.shape === 'door': if (p.half === 'lower') give(name); break;
    case b.shape === 'doubleplant': if (p.half === 'lower') self(); break;
    case b.shape === 'slab': give(name, p.type === 'double' ? 2 : 1); break;
    case name === 'spawner': xp = ri(rng, 15, 43); break;
    case name === 'fire' || name === 'soul_fire' || name === 'infero_portal' || name === 'piston_head' || name === 'moving_piston' || name === 'cake' || name === 'ember_crystal' || name === 'ignarca_altar' || name === 'bedrock':
      break;
    case name === 'kelp_plant': give('kelp'); break;
    case name === 'fulgor_wire': give('fulgor_dust'); break;
    case name === 'infero_portal': break;
    case name === 'turtle_egg': break;
    default:
      if (b.def.itemOf) give(b.def.itemOf);
      else if (item(name)) self();
  }
  return { items: out, xp };
}

const special = new Set(['wheat', 'carrots', 'potatoes', 'beetroots', 'ember_wart', 'pumpkin_stem', 'melon_stem', 'attached_pumpkin_stem', 'attached_melon_stem', 'fulgor_wire', 'kelp_plant']);

function silkable(name: string): boolean {
  return name === 'stone' || name === 'deepslate' || name.endsWith('_ore') || name === 'grass_block' || name === 'podzol' || name === 'mycelium'
    || name === 'lume_moss' || name.includes('glass') || name.includes('ice') || name.endsWith('_leaves') || name === 'gravel'
    || name === 'glowstone' || name === 'lumita' || name === 'bookshelf' || name === 'clay' || name === 'snow_block' || name.endsWith('mushroom_block')
    || name === 'melon' || name === 'cobweb' || name === 'campfire' || name === 'dirt_path';
}
