/**
 * Comércio dos aldeões: níveis Novato → Mestre (XP 10/70/150/250 como o original), duas ofertas sorteadas
 * de cada nível ao subir, usos limitados com reposição no bloco de trabalho (2× ao dia), XP para o aldeão
 * e para o jogador. Moeda: esmeralda.
 */
import { ItemStack } from '../items/stack';
import { COLORS } from '../../world/blocks/defs/building';

export interface Offer {
  a: ItemStack;
  b?: ItemStack | null;
  out: ItemStack;
  uses: number;
  maxUses: number;
  /** XP para o aldeão */
  xp: number;
  /** multiplicador de preço (demanda) — simplificado */
  price: number;
}

export const LEVEL_NAMES = ['', 'Novato', 'Aprendiz', 'Artesão', 'Especialista', 'Mestre'];
export const LEVEL_XP = [0, 0, 10, 70, 150, 250];
export const PROFESSION_LABEL: Record<string, string> = {
  nenhuma: 'Aldeão', tolo: 'Tolo', fazendeiro: 'Fazendeiro', pescador: 'Pescador', pastor: 'Pastor', flecheiro: 'Flecheiro',
  cartografo: 'Cartógrafo', clerigo: 'Clérigo', armeiro: 'Armeiro', ferramenteiro: 'Ferramenteiro', espadeiro: 'Espadeiro',
  acougueiro: 'Açougueiro', curtidor: 'Curtidor', bibliotecario: 'Bibliotecário', pedreiro: 'Pedreiro',
};

type Gen = (r: () => number) => Offer;
const E = (n: number) => new ItemStack('emerald', n);
const I = (id: string, n = 1, tag?: ItemStack['tag']) => new ItemStack(id, n, 0, tag);
/** compra: o aldeão compra `n` de `id` por esmeraldas */
const buy = (id: string, n: number, em: number, maxUses: number, xp: number): Gen => () => ({ a: I(id, n), out: E(em), uses: 0, maxUses, xp, price: 0.05 });
/** venda: o aldeão vende `n` de `id` por `em` esmeraldas */
const sell = (id: string, n: number, em: number, maxUses: number, xp: number, tag?: ItemStack['tag']): Gen => () => ({ a: E(em), out: I(id, n, tag ? structuredClone(tag) : undefined), uses: 0, maxUses, xp, price: 0.05 });
/** troca com item + esmeralda (ex.: peixe cru → assado) */
const cook = (inId: string, n: number, em: number, outId: string, maxUses: number, xp: number): Gen => () => ({ a: E(em), b: I(inId, n), out: I(outId, n), uses: 0, maxUses, xp, price: 0.05 });
/** item encantado aleatório */
const enchanted = (id: string, base: number, ench: [string, number][], maxUses: number, xp: number): Gen => (r) => {
  const [e, max] = ench[Math.floor(r() * ench.length)];
  const lvl = 1 + Math.floor(r() * max);
  return { a: E(Math.min(64, base + lvl * 3)), out: I(id, 1, { enchants: { [e]: lvl } }), uses: 0, maxUses, xp, price: 0.2 };
};
const anyOf = (...g: Gen[]): Gen => (r) => g[Math.floor(r() * g.length)](r);

const TOOL_E: [string, number][] = [['efficiency', 3], ['unbreaking', 3], ['fortune', 2]];
const WEAP_E: [string, number][] = [['sharpness', 3], ['smite', 3], ['knockback', 2], ['unbreaking', 3]];
const ARM_E: [string, number][] = [['protection', 3], ['unbreaking', 3], ['projectile_protection', 3], ['fire_protection', 3]];

export const TRADES: Record<string, Gen[][]> = {
  fazendeiro: [[],
    [buy('wheat', 20, 1, 16, 2), buy('potato', 26, 1, 16, 2), buy('carrot', 22, 1, 16, 2), buy('beetroot', 15, 1, 16, 2), sell('bread', 6, 1, 16, 1)],
    [buy('pumpkin', 6, 1, 12, 10), sell('pumpkin_pie', 4, 1, 12, 5), sell('apple', 4, 1, 16, 5)],
    [sell('cookie', 18, 3, 12, 10), buy('melon', 4, 1, 12, 20)],
    [sell('cake', 1, 1, 12, 15), buy('cassava', 18, 1, 12, 15)],
    [sell('golden_carrot', 3, 3, 12, 30), sell('glistering_melon', 3, 4, 12, 30)]],
  pescador: [[],
    [buy('string', 20, 1, 16, 2), buy('coal', 10, 1, 16, 2), cook('lambari', 6, 1, 'cooked_lambari', 16, 1)],
    [buy('lambari', 15, 1, 16, 10), cook('tambaqui', 6, 1, 'cooked_tambaqui', 16, 5), sell('campfire', 1, 2, 12, 5)],
    [buy('tambaqui', 13, 1, 16, 20), sell('fishing_rod', 1, 3, 3, 10)],
    [buy('acara', 6, 1, 12, 30)],
    [buy('baiacu', 4, 1, 12, 30), sell('oak_boat', 1, 1, 12, 30)]],
  pastor: [[],
    [buy('white_wool', 18, 1, 16, 2), buy('brown_wool', 18, 1, 16, 2), buy('black_wool', 18, 1, 16, 2), sell('shears', 1, 2, 12, 1)],
    [buy('white_dye', 12, 1, 16, 10), buy('gray_dye', 12, 1, 16, 10), (r) => sell(`${COLORS[Math.floor(r() * 16)].id}_wool`, 1, 1, 16, 5)(r), (r) => sell(`${COLORS[Math.floor(r() * 16)].id}_carpet`, 4, 1, 16, 5)(r)],
    [buy('yellow_dye', 12, 1, 16, 20), buy('red_dye', 12, 1, 16, 20), (r) => sell(`${COLORS[Math.floor(r() * 16)].id}_bed`, 1, 3, 12, 10)(r)],
    [buy('brown_dye', 12, 1, 16, 30), buy('blue_dye', 12, 1, 16, 30)],
    [sell('loom', 1, 2, 12, 30), sell('white_bed', 1, 3, 12, 30)]],
  flecheiro: [[],
    [buy('stick', 32, 1, 16, 2), sell('arrow', 16, 1, 12, 1), cook('gravel', 10, 1, 'flint', 12, 1)],
    [buy('flint', 26, 1, 12, 10), sell('bow', 1, 2, 12, 5)],
    [buy('string', 14, 1, 16, 20), sell('bow', 1, 3, 12, 10)],
    [buy('feather', 24, 1, 16, 30), enchanted('bow', 2, [['power', 3], ['punch', 2], ['unbreaking', 3]], 3, 15)],
    [(r) => ({ a: E(2), b: I('arrow', 5), out: I('tipped_arrow', 5, { potion: ['swiftness', 'slowness', 'poison', 'healing', 'harming', 'fire_resistance', 'night_vision'][Math.floor(r() * 7)] }), uses: 0, maxUses: 12, xp: 30, price: 0.05 })]],
  cartografo: [[],
    [buy('paper', 24, 1, 16, 2), sell('map', 1, 7, 12, 1)],
    [buy('glass_pane', 11, 1, 16, 10), sell('compass', 1, 8, 12, 5)],
    [buy('compass', 1, 1, 12, 20), sell('clock', 1, 8, 12, 10)],
    [sell('white_carpet', 8, 1, 12, 15), sell('lantern', 3, 2, 12, 15)],
    [sell('name_tag', 1, 16, 12, 30), sell('cartography_table', 1, 2, 12, 30)]],
  clerigo: [[],
    [buy('rotten_flesh', 32, 1, 16, 2), sell('fulgor_dust', 2, 1, 12, 1)],
    [buy('gold_ingot', 3, 1, 12, 10), sell('lapis_lazuli', 1, 1, 12, 5)],
    [buy('rabbit_foot', 2, 1, 12, 20), sell('lumita', 1, 4, 12, 10)],
    [buy('scale_shell', 4, 1, 12, 30), buy('glass_bottle', 9, 1, 12, 30), sell('shade_pearl', 1, 5, 12, 15)],
    [buy('ember_wart', 22, 1, 12, 30), sell('experience_bottle', 1, 3, 12, 30)]],
  armeiro: [[],
    [buy('coal', 15, 1, 16, 2), sell('iron_leggings', 1, 7, 12, 1), sell('iron_boots', 1, 4, 12, 1), sell('iron_helmet', 1, 5, 12, 1), sell('iron_chestplate', 1, 9, 12, 1)],
    [buy('iron_ingot', 4, 1, 12, 10), sell('bell', 1, 36, 12, 5), sell('chainmail_boots', 1, 1, 12, 5), sell('chainmail_leggings', 1, 3, 12, 5)],
    [buy('lava_bucket', 1, 1, 12, 20), buy('diamond', 1, 1, 12, 20), sell('chainmail_helmet', 1, 1, 12, 10), sell('chainmail_chestplate', 1, 4, 12, 10), sell('shield', 1, 5, 12, 10)],
    [enchanted('diamond_leggings', 14, ARM_E, 3, 15), enchanted('diamond_boots', 8, ARM_E, 3, 15)],
    [enchanted('diamond_helmet', 8, ARM_E, 3, 30), enchanted('diamond_chestplate', 16, ARM_E, 3, 30)]],
  ferramenteiro: [[],
    [buy('coal', 15, 1, 16, 2), sell('stone_axe', 1, 1, 12, 1), sell('stone_shovel', 1, 1, 12, 1), sell('stone_pickaxe', 1, 1, 12, 1), sell('stone_hoe', 1, 1, 12, 1)],
    [buy('iron_ingot', 4, 1, 12, 10), sell('bell', 1, 36, 12, 5)],
    [buy('flint', 30, 1, 12, 20), enchanted('iron_axe', 1, TOOL_E, 3, 10), enchanted('iron_shovel', 2, TOOL_E, 3, 10), enchanted('iron_pickaxe', 1, TOOL_E, 3, 10), sell('diamond_hoe', 1, 4, 3, 10)],
    [buy('diamond', 1, 1, 12, 30), enchanted('diamond_axe', 12, TOOL_E, 3, 15), enchanted('diamond_shovel', 5, TOOL_E, 3, 15)],
    [enchanted('diamond_pickaxe', 13, TOOL_E, 3, 30)]],
  espadeiro: [[],
    [buy('coal', 15, 1, 16, 2), sell('iron_axe', 1, 3, 12, 1), enchanted('iron_sword', 2, WEAP_E, 3, 1)],
    [buy('iron_ingot', 4, 1, 12, 10), sell('bell', 1, 36, 12, 5)],
    [buy('flint', 24, 1, 12, 20)],
    [buy('diamond', 1, 1, 12, 30), enchanted('diamond_axe', 12, WEAP_E, 3, 15)],
    [enchanted('diamond_sword', 8, WEAP_E, 3, 30)]],
  acougueiro: [[],
    [buy('chicken', 14, 1, 16, 2), buy('porkchop', 7, 1, 16, 2), buy('rabbit', 4, 1, 16, 2), sell('rabbit_stew', 1, 1, 12, 1)],
    [buy('coal', 15, 1, 16, 2), sell('cooked_porkchop', 5, 1, 16, 5), sell('cooked_chicken', 8, 1, 16, 5)],
    [buy('mutton', 7, 1, 16, 20), buy('beef', 10, 1, 16, 20)],
    [buy('dried_kelp', 10, 1, 12, 30)],
    [buy('sweet_berries', 10, 1, 12, 30)]],
  curtidor: [[],
    [buy('leather', 6, 1, 16, 2), sell('leather_leggings', 1, 3, 12, 1), sell('leather_chestplate', 1, 7, 12, 1)],
    [buy('flint', 26, 1, 12, 10), sell('leather_helmet', 1, 5, 12, 5), sell('leather_boots', 1, 4, 12, 5)],
    [buy('rabbit_hide', 9, 1, 12, 20), sell('leather_chestplate', 1, 7, 12, 10)],
    [buy('scale_shell', 4, 1, 12, 30), sell('lead', 2, 3, 12, 15)],
    [sell('saddle', 1, 6, 12, 30), sell('leather_helmet', 1, 5, 12, 30)]],
  bibliotecario: [[],
    [buy('paper', 24, 1, 16, 2), sell('bookshelf', 1, 9, 12, 1), enchantedBook(1)],
    [buy('book', 4, 1, 12, 10), sell('lantern', 1, 1, 12, 5), enchantedBook(5)],
    [buy('fulgor_dust', 5, 1, 12, 20), sell('glass', 4, 1, 12, 10), enchantedBook(10)],
    [buy('writable_book', 2, 1, 12, 30), sell('compass', 1, 5, 12, 15), sell('clock', 1, 5, 12, 15), enchantedBook(15)],
    [sell('name_tag', 1, 20, 12, 30)]],
  pedreiro: [[],
    [buy('clay_ball', 10, 1, 16, 2), sell('bricks', 10, 1, 16, 1)],
    [buy('stone', 20, 1, 16, 10), sell('chiseled_stone_bricks', 4, 1, 16, 5)],
    [buy('granite', 16, 1, 16, 20), buy('andesite', 16, 1, 16, 20), buy('diorite', 16, 1, 16, 20), sell('polished_andesite', 4, 1, 16, 10)],
    [buy('quartz', 12, 1, 12, 30), (r) => sell(`${COLORS[Math.floor(r() * 16)].id}_terracotta`, 1, 1, 12, 15)(r)],
    [sell('quartz_block', 1, 1, 12, 30), sell('quartz_pillar', 1, 1, 12, 30)]],
};

import { ENCHANTS } from '../items/enchantnames';
/** Livro encantado com custo pelo nível (2 + 3×nível..., como o original, com livro). */
function enchantedBook(xp: number): Gen {
  return (r) => {
    const pool = ENCHANTS.filter((e) => !e.treasure || e.id === 'mending');
    const e = pool[Math.floor(r() * pool.length)];
    const lvl = 1 + Math.floor(r() * e.max);
    let cost = 2 + Math.floor(r() * (5 + lvl * 10)) + 3 * lvl;
    if (e.treasure) cost *= 2;
    return { a: E(Math.min(64, cost)), b: I('book'), out: I('enchanted_book', 1, { stored: { [e.id]: lvl } }), uses: 0, maxUses: 12, xp, price: 0.2 };
  };
}

/** Sorteia 2 ofertas novas de um nível (sem repetir as já existentes). */
export function rollOffers(profession: string, level: number, r: () => number, existing: Offer[]): Offer[] {
  const pool = TRADES[profession]?.[level];
  if (!pool?.length) return [];
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const out: Offer[] = [];
  for (const i of idx) {
    if (out.length >= 2) break;
    const o = pool[i](r);
    if (existing.some((x) => x.out.id === o.out.id && x.a.id === o.a.id)) continue;
    out.push(o);
  }
  return out;
}

/** Preço efetivo do primeiro item (demanda simplificada: sobe com usos recentes). */
export function priceOf(o: Offer): number {
  const extra = Math.floor(o.a.count * o.price * Math.max(0, o.uses - o.maxUses / 2) / 2);
  return Math.max(1, Math.min(o.a.maxStack, o.a.count + extra));
}

export function offerToJSON(o: Offer): unknown {
  return { a: o.a.toJSON(), b: o.b?.toJSON() ?? null, out: o.out.toJSON(), uses: o.uses, maxUses: o.maxUses, xp: o.xp, price: o.price };
}
export function offerFromJSON(d: Record<string, unknown>): Offer {
  return {
    a: ItemStack.fromJSON(d.a as never)!, b: d.b ? ItemStack.fromJSON(d.b as never) : null, out: ItemStack.fromJSON(d.out as never)!,
    uses: d.uses as number, maxUses: d.maxUses as number, xp: d.xp as number, price: d.price as number,
  };
}
