/**
 * Registro de itens. Todo bloco com item vira um item de bloco; depois vêm ferramentas, armas, armaduras,
 * comidas e materiais, com os números do original (durabilidade, dano, velocidade, fome/saciedade).
 */
import { BLOCKS, type BlockType } from '../../world/blocks';
import { COLORS } from '../../world/blocks/defs/building';
import { WOODS } from '../../world/blocks/defs/wood';
import type { ItemDef } from './types';

export const ITEMS: ItemDef[] = [];
const byId = new Map<string, ItemDef>();

function add(d: Partial<ItemDef> & { id: string; label: string }): ItemDef {
  if (byId.has(d.id)) return byId.get(d.id)!;
  const item: ItemDef = { maxStack: 64, tab: 'misc', ...d };
  ITEMS.push(item);
  byId.set(item.id, item);
  return item;
}

export const item = (id: string): ItemDef | undefined => byId.get(id);
export const itemOrThrow = (id: string): ItemDef => {
  const i = byId.get(id);
  if (!i) throw new Error(`item desconhecido: ${id}`);
  return i;
};

// ------------------------------------------------------------------ materiais de ferramenta (números do original)
export interface TierInfo { id: string; label: string; tier: number; speed: number; durability: number; attackBonus: number; enchant: number }
export const TIERS: TierInfo[] = [
  { id: 'wooden', label: 'de madeira', tier: 0, speed: 2, durability: 59, attackBonus: 0, enchant: 15 },
  { id: 'stone', label: 'de pedra', tier: 1, speed: 4, durability: 131, attackBonus: 1, enchant: 5 },
  { id: 'iron', label: 'de ferro', tier: 2, speed: 6, durability: 250, attackBonus: 2, enchant: 14 },
  { id: 'golden', label: 'de ouro', tier: 0, speed: 12, durability: 32, attackBonus: 0, enchant: 22 },
  { id: 'diamond', label: 'de diamante', tier: 3, speed: 8, durability: 1561, attackBonus: 3, enchant: 10 },
  { id: 'igneous', label: 'ígnea', tier: 4, speed: 9, durability: 2031, attackBonus: 4, enchant: 15 },
];
// dano e velocidade exatos por tipo e material (Java 1.9+)
const SWORD_DMG: Record<string, number> = { wooden: 4, stone: 5, iron: 6, golden: 4, diamond: 7, igneous: 8 };
const AXE: Record<string, [number, number]> = { wooden: [7, 0.8], stone: [9, 0.8], iron: [9, 0.9], golden: [7, 1.0], diamond: [9, 1.0], igneous: [10, 1.0] };
const PICK_DMG: Record<string, number> = { wooden: 2, stone: 3, iron: 4, golden: 2, diamond: 5, igneous: 6 };
const SHOVEL_DMG: Record<string, number> = { wooden: 2.5, stone: 3.5, iron: 4.5, golden: 2.5, diamond: 5.5, igneous: 6.5 };
const HOE_SPEED: Record<string, number> = { wooden: 1, stone: 2, iron: 3, golden: 1, diamond: 4, igneous: 4 };

const TOOL_NAMES: Record<string, [string, 'f' | 'm']> = {
  sword: ['Espada', 'f'], pickaxe: ['Picareta', 'f'], axe: ['Machado', 'm'], shovel: ['Pá', 'f'], hoe: ['Enxada', 'f'],
};
const tierLabel = (t: TierInfo, g: 'f' | 'm') => (t.id === 'igneous' ? (g === 'f' ? 'ígnea' : 'ígneo') : t.label);

// ------------------------------------------------------------------ armaduras
export interface ArmorMat { id: string; label: [string, string]; defense: [number, number, number, number]; toughness: number; kb: number; mult: number; enchant: number }
export const ARMOR_MATS: ArmorMat[] = [
  { id: 'leather', label: ['de couro', 'de couro'], defense: [1, 3, 2, 1], toughness: 0, kb: 0, mult: 5, enchant: 15 },
  { id: 'chainmail', label: ['de malha', 'de malha'], defense: [2, 5, 4, 1], toughness: 0, kb: 0, mult: 15, enchant: 12 },
  { id: 'iron', label: ['de ferro', 'de ferro'], defense: [2, 6, 5, 2], toughness: 0, kb: 0, mult: 15, enchant: 9 },
  { id: 'golden', label: ['de ouro', 'de ouro'], defense: [2, 5, 3, 1], toughness: 0, kb: 0, mult: 7, enchant: 25 },
  { id: 'diamond', label: ['de diamante', 'de diamante'], defense: [3, 8, 6, 3], toughness: 2, kb: 0, mult: 33, enchant: 10 },
  { id: 'igneous', label: ['ígneo', 'ígnea'], defense: [3, 8, 6, 3], toughness: 3, kb: 0.1, mult: 37, enchant: 15 },
];
const ARMOR_PIECES: [string, string, 'head' | 'chest' | 'legs' | 'feet', number, 'm' | 'f'][] = [
  ['helmet', 'Capacete', 'head', 11, 'm'], ['chestplate', 'Peitoral', 'chest', 16, 'm'],
  ['leggings', 'Calças', 'legs', 15, 'f'], ['boots', 'Botas', 'feet', 13, 'f'],
];

let inited = false;
export function initItems(): void {
  if (inited) return;
  inited = true;
  // ---------------- itens de bloco
  for (const b of BLOCKS) blockItem(b);

  // ---------------- ferramentas e armas
  for (const t of TIERS) {
    for (const kind of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'] as const) {
      const [name, g] = TOOL_NAMES[kind];
      const id = `${t.id}_${kind}`;
      let attack: { damage: number; speed: number };
      if (kind === 'sword') attack = { damage: SWORD_DMG[t.id], speed: 1.6 };
      else if (kind === 'axe') attack = { damage: AXE[t.id][0], speed: AXE[t.id][1] };
      else if (kind === 'pickaxe') attack = { damage: PICK_DMG[t.id], speed: 1.2 };
      else if (kind === 'shovel') attack = { damage: SHOVEL_DMG[t.id], speed: 1.0 };
      else attack = { damage: 1, speed: HOE_SPEED[t.id] };
      add({
        id, label: `${name} ${tierLabel(t, g)}`, maxStack: 1, maxDamage: t.durability,
        tool: kind === 'sword' ? { kind: 'sword', tier: t.tier, speed: 1.5 } : { kind, tier: t.tier, speed: t.speed },
        attack, enchantability: t.enchant, tab: kind === 'sword' ? 'combat' : 'tools',
        fuel: t.id === 'wooden' ? 200 : undefined, rarity: t.id === 'igneous' ? 'rare' : undefined,
      });
    }
  }
  add({ id: 'shears', label: 'Tesoura', maxStack: 1, maxDamage: 238, tool: { kind: 'shears', tier: 0, speed: 1.5 }, tab: 'tools' });
  add({ id: 'flint_and_steel', label: 'Isqueiro', maxStack: 1, maxDamage: 64, tab: 'tools' });
  add({ id: 'fishing_rod', label: 'Vara de pesca', maxStack: 1, maxDamage: 64, enchantability: 1, tab: 'tools', fuel: 300 });
  add({ id: 'bow', label: 'Arco', maxStack: 1, maxDamage: 384, enchantability: 1, tab: 'combat', fuel: 300 });
  add({ id: 'arrow', label: 'Flecha', tab: 'combat' });
  add({ id: 'shield', label: 'Escudo', maxStack: 1, maxDamage: 336, tab: 'combat', fuel: 300 });
  add({ id: 'harpoon', label: 'Arpão', maxStack: 1, maxDamage: 250, attack: { damage: 9, speed: 1.1 }, enchantability: 1, tab: 'combat', rarity: 'rare' });
  add({ id: 'ash_wings', label: 'Asas de Cinza', maxStack: 1, maxDamage: 432, tab: 'combat', rarity: 'epic' });
  add({ id: 'compass', label: 'Bússola', tab: 'tools' });
  add({ id: 'clock', label: 'Relógio', tab: 'tools' });
  add({ id: 'map', label: 'Mapa vazio', tab: 'tools' });
  add({ id: 'filled_map', label: 'Mapa', maxStack: 1, tab: 'none' });
  add({ id: 'bucket', label: 'Balde', maxStack: 16, tab: 'tools' });
  add({ id: 'water_bucket', label: 'Balde de água', maxStack: 1, tab: 'tools' });
  add({ id: 'lava_bucket', label: 'Balde de lava', maxStack: 1, tab: 'tools', fuel: 20000 });
  add({ id: 'milk_bucket', label: 'Balde de leite', maxStack: 1, tab: 'food' });
  add({ id: 'saddle', label: 'Sela', maxStack: 1, tab: 'tools' });
  add({ id: 'lead', label: 'Laço', tab: 'tools' });
  add({ id: 'name_tag', label: 'Etiqueta', tab: 'tools' });

  // ---------------- armaduras
  for (const m of ARMOR_MATS) {
    ARMOR_PIECES.forEach(([piece, name, slot, base, g], i) => {
      add({
        id: `${m.id}_${piece}`, label: `${name} ${g === 'f' ? m.label[1] : m.label[0]}`, maxStack: 1, maxDamage: base * m.mult,
        armor: { slot, defense: m.defense[i], toughness: m.toughness, knockback: m.kb, material: m.id }, enchantability: m.enchant, tab: 'combat',
        rarity: m.id === 'igneous' ? 'rare' : undefined,
      });
    });
  }

  // ---------------- comidas (fome, saciedade)
  const food = (id: string, label: string, hunger: number, saturation: number, extra: Partial<ItemDef> = {}, f: Partial<ItemDef['food']> = {}) =>
    add({ id, label, tab: 'food', food: { hunger, saturation, ...f }, ...extra });
  food('apple', 'Maçã', 4, 2.4);
  food('golden_apple', 'Maçã dourada', 4, 9.6, { rarity: 'rare' }, { alwaysEdible: true, effects: [['regeneration', 100, 1, 1], ['absorption', 2400, 0, 1]] });
  food('bread', 'Pão', 5, 6);
  food('beef', 'Carne crua', 3, 1.8);
  food('cooked_beef', 'Bife', 8, 12.8);
  food('porkchop', 'Costeleta crua', 3, 1.8);
  food('cooked_porkchop', 'Costeleta assada', 8, 12.8);
  food('chicken', 'Frango cru', 2, 1.2, {}, { effects: [['hunger', 600, 0, 0.3]] });
  food('cooked_chicken', 'Frango assado', 6, 7.2);
  food('mutton', 'Carneiro cru', 2, 1.2);
  food('cooked_mutton', 'Carneiro assado', 6, 9.6);
  food('rabbit', 'Coelho cru', 3, 1.8);
  food('cooked_rabbit', 'Coelho assado', 5, 6);
  food('rabbit_stew', 'Ensopado de coelho', 10, 12, { maxStack: 1 }, { remainder: 'bowl' });
  food('lambari', 'Lambari cru', 2, 0.4);
  food('cooked_lambari', 'Lambari frito', 5, 6);
  food('tambaqui', 'Tambaqui cru', 2, 0.4);
  food('cooked_tambaqui', 'Tambaqui assado', 6, 9.6);
  food('baiacu', 'Baiacu', 1, 0.2, {}, { effects: [['poison', 1200, 1, 1], ['nausea', 300, 0, 1], ['hunger', 300, 2, 1]] });
  food('acara', 'Acará', 1, 0.2);
  food('carrot', 'Cenoura', 3, 3.6, { block: 'carrots' });
  food('golden_carrot', 'Cenoura dourada', 6, 14.4);
  food('potato', 'Batata', 1, 0.6, { block: 'potatoes' });
  food('baked_potato', 'Batata assada', 5, 6);
  food('poisonous_potato', 'Batata venenosa', 2, 1.2, {}, { effects: [['poison', 100, 0, 0.6]] });
  food('beetroot', 'Beterraba', 1, 1.2);
  food('beetroot_soup', 'Sopa de beterraba', 6, 7.2, { maxStack: 1 }, { remainder: 'bowl' });
  food('mushroom_stew', 'Sopa de cogumelos', 6, 7.2, { maxStack: 1 }, { remainder: 'bowl' });
  food('melon_slice', 'Fatia de melancia', 2, 1.2);
  food('sweet_berries', 'Amoras', 2, 0.4, { block: 'sweet_berry_bush' });
  food('cookie', 'Biscoito', 2, 0.4);
  food('pumpkin_pie', 'Torta de abóbora', 8, 4.8);
  food('rotten_flesh', 'Carne podre', 4, 0.8, {}, { effects: [['hunger', 600, 0, 0.8]] });
  food('spider_eye', 'Olho de tecelã', 2, 3.2, {}, { effects: [['poison', 100, 0, 1]] });
  food('dried_kelp', 'Alga seca', 1, 0.6, {}, { fast: true });
  food('honey_bottle', 'Garrafa de mel', 6, 1.2, { maxStack: 16 }, { remainder: 'glass_bottle' });
  food('cassava', 'Mandioca', 2, 1.2);
  add({ id: 'cake', label: 'Bolo', maxStack: 1, block: 'cake', tab: 'food' });

  // ---------------- materiais
  const mat = (id: string, label: string, extra: Partial<ItemDef> = {}) => add({ id, label, tab: 'materials', ...extra });
  mat('stick', 'Graveto', { fuel: 100 });
  mat('coal', 'Carvão', { fuel: 1600 });
  mat('charcoal', 'Carvão vegetal', { fuel: 1600 });
  mat('raw_iron', 'Ferro bruto'); mat('raw_copper', 'Cobre bruto'); mat('raw_gold', 'Ouro bruto');
  mat('iron_ingot', 'Lingote de ferro'); mat('copper_ingot', 'Lingote de cobre'); mat('gold_ingot', 'Lingote de ouro');
  mat('iron_nugget', 'Pepita de ferro'); mat('gold_nugget', 'Pepita de ouro');
  mat('diamond', 'Diamante'); mat('emerald', 'Esmeralda'); mat('lapis_lazuli', 'Lápis-lazúli');
  mat('fulgor_dust', 'Pó de fulgor', { block: 'fulgor_wire', tab: 'fulgor' });
  mat('quartz', 'Quartzo do Ínfero'); mat('amethyst_shard', 'Fragmento de ametista');
  mat('ancient_scrap', 'Sucata ancestral'); mat('igneous_ingot', 'Lingote ígneo', { rarity: 'rare' });
  mat('flint', 'Sílex'); mat('feather', 'Pena'); mat('string', 'Linha'); mat('leather', 'Couro'); mat('rabbit_hide', 'Pele de coelho');
  mat('bone', 'Osso'); mat('bone_meal', 'Farinha de osso'); mat('gunpowder', 'Pólvora'); mat('slime_ball', 'Bola de gosma');
  mat('clay_ball', 'Bola de argila'); mat('brick', 'Tijolo'); mat('infero_brick', 'Tijolo do Ínfero'); mat('paper', 'Papel');
  mat('book', 'Livro'); mat('sugar', 'Açúcar'); mat('wheat', 'Trigo'); mat('egg', 'Ovo', { maxStack: 16 });
  mat('snowball', 'Bola de neve', { maxStack: 16 }); mat('bowl', 'Tigela', { fuel: 100 }); mat('glass_bottle', 'Garrafa de vidro');
  mat('wheat_seeds', 'Sementes de trigo', { block: 'wheat', tab: 'nature' });
  mat('beetroot_seeds', 'Sementes de beterraba', { block: 'beetroots', tab: 'nature' });
  mat('pumpkin_seeds', 'Sementes de abóbora', { block: 'pumpkin_stem', tab: 'nature' });
  mat('melon_seeds', 'Sementes de melancia', { block: 'melon_stem', tab: 'nature' });
  mat('lumita_dust', 'Pó de lumita');
  mat('ember_rod', 'Bastão de fagulha', { fuel: 2400 }); mat('ember_powder', 'Pó de fagulha');
  mat('shade_pearl', 'Pérola do vulto', { maxStack: 16 }); mat('ember_eye', 'Olho de brasa');
  mat('brasal_tear', 'Lágrima de brasal'); mat('magma_cream', 'Creme de magma');
  mat('ember_wart', 'Verruga-brasa', { block: 'ember_wart' });
  mat('fermented_spider_eye', 'Olho de tecelã fermentado'); mat('glistering_melon', 'Melancia reluzente');
  mat('rabbit_foot', 'Pé de coelho'); mat('phantom_membrane', 'Membrana de assombro'); mat('moss_tuft', 'Tufo de musgo');
  mat('scale_shell', 'Escama de musgarto');
  mat('ignarca_heart', 'Coração de Ignarca', { rarity: 'epic', maxStack: 1 });
  add({ id: 'experience_bottle', label: 'Frasco de experiência', tab: 'misc', rarity: 'uncommon' });
  add({ id: 'enchanted_book', label: 'Livro encantado', maxStack: 1, tab: 'misc', rarity: 'uncommon' });
  add({ id: 'writable_book', label: 'Livro e pena', maxStack: 1, tab: 'misc' });
  add({ id: 'potion', label: 'Poção', maxStack: 1, tab: 'food' });
  add({ id: 'splash_potion', label: 'Poção arremessável', maxStack: 1, tab: 'combat' });
  add({ id: 'tipped_arrow', label: 'Flecha com poção', tab: 'combat' });

  // ---------------- tintas (16)
  for (const c of COLORS) add({ id: `${c.id}_dye`, label: `Tinta ${c.labelF}`, tab: 'materials', color: c.rgb });

  // ---------------- veículos, placas e afins
  for (const w of WOODS) {
    if (w.id !== 'ash') add({ id: `${w.id}_boat`, label: `Barco de ${w.label}`, maxStack: 1, tab: 'tools', fuel: 1200 });
    add({ id: `${w.id}_sign`, label: `Placa de ${w.label}`, maxStack: 16, block: `${w.id}_sign`, tab: 'deco', fuel: 200 });
    add({ id: `${w.id}_door`, label: `Porta de ${w.label}`, block: `${w.id}_door`, tab: 'fulgor', fuel: 200 });
  }
  add({ id: 'minecart', label: 'Carrinho', maxStack: 1, tab: 'tools' });
  add({ id: 'chest_minecart', label: 'Carrinho com baú', maxStack: 1, tab: 'tools' });
  add({ id: 'tnt_minecart', label: 'Carrinho com TNT', maxStack: 1, tab: 'tools' });
  add({ id: 'furnace_minecart', label: 'Carrinho com fornalha', maxStack: 1, tab: 'tools' });

  // ---------------- ovos de criação (criativo)
  for (const [id, label] of [
    ['cow', 'vaca'], ['pig', 'porco'], ['sheep', 'ovelha'], ['chicken', 'galinha'], ['horse', 'cavalo'], ['wolf', 'lobo'],
    ['cat', 'gato'], ['rabbit', 'coelho'], ['lambari', 'lambari'], ['tambaqui', 'tambaqui'], ['baiacu', 'baiacu'], ['musgarto', 'musgarto'],
    ['villager', 'aldeão'], ['sentinela', 'sentinela'], ['carnical', 'carniçal'], ['ossudo', 'ossudo'], ['tecela', 'tecelã'],
    ['pavio', 'pavio'], ['feiticeira', 'feiticeira'], ['gosma', 'gosma'], ['assombro', 'assombro'], ['naufrago', 'náufrago'],
    ['vulto', 'vulto'], ['espreitador', 'espreitador'], ['fagulha', 'fagulha'], ['brasal', 'brasal'],
  ] as const) add({ id: `${id}_spawn_egg`, label: `Ovo de ${label}`, tab: 'misc', data: { entity: id } });
}

function blockItem(b: BlockType): void {
  const def = b.def;
  if (def.noItem) return;
  // itens especiais cobrem alguns blocos (portas, placas)
  if (b.shape === 'door' || b.shape === 'wallsign' || b.shape === 'sign') return;
  const fuel = def.flammable && (def.sound === 'wood') ? (b.shape === 'slab' ? 150 : 300) : def.name.endsWith('_wool') ? 100 : def.name.endsWith('_carpet') ? 67 : def.name === 'coal_block' ? 16000 : def.name.endsWith('_sapling') ? 100 : undefined;
  add({
    id: def.name, label: def.label, block: def.name, tab: (def.tab ?? 'build') as ItemDef['tab'], fuel,
    maxStack: b.shape === 'bed' ? 1 : def.name.endsWith('_sign') ? 16 : 64,
  });
}

initItems();

export function isBlockItem(id: string): boolean { return !!byId.get(id)?.block; }
