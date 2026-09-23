/**
 * Saques de baús gerados (tabelas no estilo do original: n sorteios com pesos, quantidades e encantamentos),
 * preenchidos na primeira abertura, em posições aleatórias dos 27 espaços.
 */
import { ItemStack } from '../items/stack';
import { ENCHANTS } from '../items/enchantnames';

interface Entry { id: string; w: number; min?: number; max?: number; ench?: boolean }
interface Table { rolls: [number, number]; entries: Entry[]; extra?: Table[] }

const e = (id: string, w: number, min = 1, max = 1, ench = false): Entry => ({ id, w, min, max, ench });

const VILA_BASE: Entry[] = [e('bread', 15, 1, 4), e('apple', 10, 1, 5), e('wheat', 8, 2, 7), e('wheat_seeds', 6, 2, 6), e('emerald', 3, 1, 2), e('iron_nugget', 4, 1, 5), e('paper', 5, 1, 6), e('stick', 5, 1, 8)];
const TABLES: Record<string, Table> = {
  vila_planicie: { rolls: [3, 8], entries: [...VILA_BASE, e('white_dye', 3, 1, 2), e('oak_sapling', 5, 1, 2), e('poppy', 3, 1, 2)] },
  vila_deserto: { rolls: [3, 8], entries: [...VILA_BASE, e('cactus', 8, 1, 4), e('dead_bush', 4, 1, 3), e('green_dye', 3, 1, 2)] },
  vila_savana: { rolls: [3, 8], entries: [...VILA_BASE, e('acacia_sapling', 6, 1, 2), e('saddle', 2), e('leather', 4, 1, 3)] },
  vila_taiga: { rolls: [3, 8], entries: [...VILA_BASE, e('spruce_sapling', 6, 1, 5), e('sweet_berries', 8, 1, 7), e('iron_shovel', 2), e('iron_pickaxe', 1)] },
  vila_neve: { rolls: [3, 8], entries: [...VILA_BASE, e('snowball', 8, 1, 7), e('potato', 6, 1, 7), e('beetroot_seeds', 5, 1, 5), e('blue_ice', 1, 1, 2)] },
  vila_selva: { rolls: [3, 8], entries: [...VILA_BASE, e('jungle_sapling', 6, 1, 3), e('cassava', 8, 2, 6), e('melon_seeds', 4, 1, 4)] },
  vila_pantano: { rolls: [3, 8], entries: [...VILA_BASE, e('dark_oak_sapling', 5, 1, 3), e('brown_mushroom', 5, 1, 3), e('mud', 5, 2, 6)] },
  oficina_armeiro: { rolls: [1, 5], entries: [e('iron_ingot', 2, 1, 3), e('bread', 4, 1, 4), e('iron_helmet', 1), e('emerald', 1)] },
  oficina_ferramenteiro: { rolls: [3, 5], entries: [e('diamond', 1), e('iron_ingot', 5, 1, 5), e('gold_ingot', 1, 1, 3), e('bread', 15, 1, 3), e('iron_pickaxe', 1), e('coal', 1, 1, 3), e('stick', 20, 1, 3), e('iron_shovel', 5)] },
  oficina_espadeiro: { rolls: [3, 8], entries: [e('diamond', 3, 1, 3), e('iron_ingot', 10, 1, 5), e('gold_ingot', 5, 1, 3), e('bread', 15, 1, 3), e('apple', 15, 1, 3), e('iron_pickaxe', 5), e('iron_sword', 5), e('iron_chestplate', 5), e('iron_helmet', 5), e('iron_leggings', 5), e('iron_boots', 5), e('obsidian', 5, 3, 7), e('oak_sapling', 5, 3, 7), e('saddle', 3)] },
  oficina_pedreiro: { rolls: [1, 5], entries: [e('clay_ball', 1, 1, 3), e('flower_pot', 1), e('stone', 2), e('stone_bricks', 2), e('bread', 4, 1, 4), e('yellow_dye', 1), e('smooth_stone', 1), e('emerald', 1)] },
  oficina_curtidor: { rolls: [1, 5], entries: [e('leather', 1, 1, 3), e('leather_chestplate', 2), e('leather_boots', 2), e('leather_helmet', 2), e('bread', 5, 1, 4), e('leather_leggings', 2), e('saddle', 1), e('emerald', 1, 1, 4)] },
  oficina_acougueiro: { rolls: [1, 5], entries: [e('emerald', 1), e('porkchop', 6, 1, 3), e('wheat', 6, 1, 3), e('beef', 6, 1, 3), e('mutton', 6, 1, 3), e('coal', 3, 1, 3)] },
  oficina_cartografo: { rolls: [1, 5], entries: [e('map', 10), e('paper', 15, 1, 5), e('compass', 5), e('bread', 15, 1, 4), e('stick', 5, 1, 2)] },
  oficina_flecheiro: { rolls: [1, 5], entries: [e('arrow', 10, 1, 8), e('feather', 6, 1, 4), e('flint', 6, 1, 6), e('bow', 2), e('bread', 8, 1, 3)] },
  oficina_pastor: { rolls: [1, 5], entries: [e('white_wool', 6, 1, 8), e('black_wool', 3, 1, 3), e('gray_wool', 2, 1, 3), e('brown_wool', 2, 1, 3), e('light_gray_wool', 2, 1, 3), e('emerald', 1), e('shears', 1), e('wheat', 6, 1, 6)] },
  oficina_pescador: { rolls: [1, 5], entries: [e('emerald', 1), e('lambari', 2, 1, 3), e('tambaqui', 1, 1, 3), e('oak_boat', 1), e('water_bucket', 1), e('fishing_rod', 1)] },
  oficina_clerigo: { rolls: [1, 5], entries: [e('fulgor_dust', 3, 1, 4), e('bread', 7, 1, 4), e('rotten_flesh', 7, 1, 4), e('lapis_lazuli', 1, 1, 4), e('gold_ingot', 1, 1, 4), e('glass_bottle', 3, 1, 3)] },
  oficina_bibliotecario: { rolls: [1, 5], entries: [e('book', 4, 1, 3), e('paper', 5, 2, 7), e('enchanted_book', 2, 1, 1, true), e('writable_book', 1)] },
  oficina_fazendeiro: { rolls: [1, 5], entries: [e('wheat', 8, 2, 8), e('bone_meal', 5, 1, 4), e('wheat_seeds', 5, 2, 6), e('carrot', 4, 1, 4), e('bread', 5, 1, 3)] },
  // ---- estruturas (marco 11)
  masmorra: { rolls: [1, 3], entries: [e('saddle', 20), e('golden_apple', 15), e('enchanted_book', 10, 1, 1, true), e('iron_ingot', 10, 1, 4), e('bread', 20), e('wheat', 20, 1, 4), e('bucket', 10), e('fulgor_dust', 15, 1, 4), e('coal', 15, 1, 4), e('bone', 10, 1, 8), e('gunpowder', 10, 1, 8), e('rotten_flesh', 10, 1, 8), e('string', 10, 1, 8), e('name_tag', 20), e('gold_ingot', 5, 1, 4)] },
  templo_deserto: { rolls: [2, 4], entries: [e('diamond', 5, 1, 3), e('iron_ingot', 15, 1, 5), e('gold_ingot', 15, 2, 7), e('emerald', 15, 1, 3), e('bone', 25, 4, 6), e('spider_eye', 25, 1, 3), e('rotten_flesh', 25, 3, 7), e('saddle', 20), e('golden_apple', 20), e('enchanted_book', 20, 1, 1, true)] },
  templo_selva: { rolls: [2, 6], entries: [e('diamond', 3, 1, 3), e('iron_ingot', 10, 1, 5), e('gold_ingot', 15, 2, 7), e('emerald', 2, 1, 3), e('bone', 20, 4, 6), e('rotten_flesh', 16, 3, 7), e('saddle', 3), e('enchanted_book', 1, 1, 1, true)] },
  mina: { rolls: [3, 5], entries: [e('golden_apple', 20), e('enchanted_book', 10, 1, 1, true), e('iron_pickaxe', 5), e('iron_ingot', 10, 1, 5), e('gold_ingot', 5, 1, 3), e('fulgor_dust', 5, 4, 9), e('lapis_lazuli', 5, 4, 9), e('diamond', 3, 1, 2), e('coal', 10, 3, 8), e('bread', 15, 1, 3), e('melon_seeds', 10, 2, 4), e('pumpkin_seeds', 10, 2, 4), e('beetroot_seeds', 10, 2, 4), e('rail', 20, 4, 8), e('powered_rail', 5, 1, 4), e('torch', 15, 1, 16)] },
  naufragio_mapa: { rolls: [3, 3], entries: [e('map', 1), e('compass', 1), e('clock', 1), e('paper', 20, 1, 10), e('feather', 10, 1, 5), e('book', 5, 1, 5)] },
  naufragio_tesouro: { rolls: [3, 6], entries: [e('iron_ingot', 90, 1, 5), e('gold_ingot', 10, 1, 5), e('emerald', 40, 1, 5), e('diamond', 5), e('experience_bottle', 5), e('iron_nugget', 50, 1, 10), e('gold_nugget', 10, 1, 10), e('lapis_lazuli', 20, 1, 10)] },
  naufragio_mantimentos: { rolls: [3, 10], entries: [e('paper', 8, 1, 12), e('potato', 7, 2, 6), e('poisonous_potato', 7, 2, 6), e('carrot', 7, 4, 8), e('wheat', 7, 8, 21), e('coal', 6, 2, 8), e('rotten_flesh', 5, 5, 24), e('pumpkin', 2, 1, 3), e('bamboo', 2, 1, 3), e('gunpowder', 3, 1, 5), e('tnt', 1, 1, 2), e('leather_helmet', 3, 1, 1, true), e('leather_chestplate', 3, 1, 1, true)] },
  ruina: { rolls: [2, 5], entries: [e('coal', 10, 1, 4), e('stone_axe', 2), e('rotten_flesh', 5), e('emerald', 1), e('wheat', 10, 2, 3), e('gold_nugget', 5, 1, 5), e('iron_nugget', 5, 1, 5), e('enchanted_book', 1, 1, 1, true), e('golden_helmet', 2, 1, 1, true)] },
};

function pickEntry(t: Table, r: () => number): Entry {
  let total = 0;
  for (const x of t.entries) total += x.w;
  let k = r() * total;
  for (const x of t.entries) { k -= x.w; if (k <= 0) return x; }
  return t.entries[t.entries.length - 1];
}

function enchantRandom(st: ItemStack, r: () => number): void {
  const pool = ENCHANTS.filter((x) => !x.treasure || x.id === 'mending');
  const en = pool[Math.floor(r() * pool.length)];
  const lvl = 1 + Math.floor(r() * en.max);
  if (st.id === 'enchanted_book') st.tag = { ...(st.tag ?? {}), stored: { [en.id]: lvl } };
  else st.tag = { ...(st.tag ?? {}), enchants: { [en.id]: lvl } };
}

/** Gera os 27 espaços de um baú a partir da tabela (null nos vazios). */
export function rollChest(table: string, r: () => number = Math.random): (ItemStack | null)[] {
  const out: (ItemStack | null)[] = new Array(27).fill(null);
  const t = TABLES[table] ?? TABLES.ruina;
  const n = t.rolls[0] + Math.floor(r() * (t.rolls[1] - t.rolls[0] + 1));
  for (let i = 0; i < n; i++) {
    const en = pickEntry(t, r);
    const count = (en.min ?? 1) + Math.floor(r() * ((en.max ?? 1) - (en.min ?? 1) + 1));
    const st = new ItemStack(en.id, count);
    if (en.ench) enchantRandom(st, r);
    // espalha em posições livres (como o original, que divide pilhas)
    const free = out.map((s, j) => (s ? -1 : j)).filter((j) => j >= 0);
    if (!free.length) break;
    out[free[Math.floor(r() * free.length)]] = st;
  }
  return out;
}

export const LOOT_TABLES = Object.keys(TABLES);
