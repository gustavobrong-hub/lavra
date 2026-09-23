/**
 * Biomas: cores (grama, folhagem, água), superfície, vegetação e clima.
 * A escolha segue a lógica multi-ruído (temperatura × umidade × relevo), com transição suave de cores.
 */
import type { ClimatePoint } from './climate';

export type TreeKind =
  | 'oak' | 'fancy_oak' | 'birch' | 'tall_birch' | 'spruce' | 'mega_spruce' | 'pine' | 'jungle' | 'mega_jungle'
  | 'jungle_bush' | 'acacia' | 'dark_oak' | 'swamp_oak' | 'lume' | 'big_lume' | 'dead';

export type SurfaceKind = 'grass' | 'sand' | 'red_sand' | 'snow' | 'stone' | 'gravel' | 'podzol' | 'mud' | 'lume' | 'coarse' | 'terracotta';

export interface Biome {
  id: number;
  name: string;
  label: string;
  /** temperatura "real" (define neve/chuva): < 0.15 neva */
  temp: number;
  downfall: number;
  grass: number;
  foliage: number;
  water: number;
  waterFog: number;
  surface: SurfaceKind;
  /** fundo de água */
  underwater: 'sand' | 'gravel' | 'dirt' | 'clay' | 'mud';
  ocean?: boolean;
  river?: boolean;
  beach?: boolean;
  mountain?: boolean;
  trees: [TreeKind, number][];
  /** tentativas de árvore por chunk */
  treeDensity: number;
  grassDensity: number;
  flowers: string[];
  flowerDensity: number;
  precipitation: 'rain' | 'snow' | 'none';
  /** sky tint extra (névoa) */
  fog?: number;
  extras?: string[];
}

type BiomeInit = Omit<Biome, 'id' | 'grass'> & { grass: number };

const DEF_WATER = 0x3f76e4;
const DEF_FOG = 0x050533;

const list: BiomeInit[] = [
  { name: 'ocean', label: 'Oceano', temp: 0.5, downfall: 0.5, grass: 0x8eb971, foliage: 0x71a74d, water: DEF_WATER, waterFog: DEF_FOG, surface: 'sand', underwater: 'gravel', ocean: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['kelp', 'seagrass'] },
  { name: 'deep_ocean', label: 'Oceano profundo', temp: 0.5, downfall: 0.5, grass: 0x8eb971, foliage: 0x71a74d, water: DEF_WATER, waterFog: DEF_FOG, surface: 'sand', underwater: 'gravel', ocean: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['kelp', 'seagrass'] },
  { name: 'warm_ocean', label: 'Oceano quente', temp: 0.5, downfall: 0.5, grass: 0x8eb971, foliage: 0x71a74d, water: 0x43d5ee, waterFog: 0x041f33, surface: 'sand', underwater: 'sand', ocean: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['seagrass'] },
  { name: 'lukewarm_ocean', label: 'Oceano morno', temp: 0.5, downfall: 0.5, grass: 0x8eb971, foliage: 0x71a74d, water: 0x45adf2, waterFog: 0x041633, surface: 'sand', underwater: 'sand', ocean: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['kelp', 'seagrass'] },
  { name: 'cold_ocean', label: 'Oceano frio', temp: 0.5, downfall: 0.5, grass: 0x8eb971, foliage: 0x71a74d, water: 0x3d57d6, waterFog: DEF_FOG, surface: 'sand', underwater: 'gravel', ocean: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['kelp', 'seagrass'] },
  { name: 'frozen_ocean', label: 'Oceano congelado', temp: 0, downfall: 0.5, grass: 0x80b497, foliage: 0x60a17b, water: 0x3938c9, waterFog: DEF_FOG, surface: 'sand', underwater: 'gravel', ocean: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'snow', extras: ['ice'] },
  { name: 'deep_frozen_ocean', label: 'Oceano congelado profundo', temp: 0.5, downfall: 0.5, grass: 0x80b497, foliage: 0x60a17b, water: 0x3938c9, waterFog: DEF_FOG, surface: 'sand', underwater: 'gravel', ocean: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'snow', extras: ['ice'] },
  { name: 'beach', label: 'Praia', temp: 0.8, downfall: 0.4, grass: 0x91bd59, foliage: 0x77ab2f, water: DEF_WATER, waterFog: DEF_FOG, surface: 'sand', underwater: 'sand', beach: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'rain' },
  { name: 'snowy_beach', label: 'Praia nevada', temp: 0.05, downfall: 0.3, grass: 0x83b593, foliage: 0x64a278, water: 0x3d57d6, waterFog: DEF_FOG, surface: 'sand', underwater: 'sand', beach: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'snow' },
  { name: 'stony_shore', label: 'Costa rochosa', temp: 0.2, downfall: 0.3, grass: 0x8ab689, foliage: 0x6da36b, water: DEF_WATER, waterFog: DEF_FOG, surface: 'stone', underwater: 'gravel', beach: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'rain' },
  { name: 'river', label: 'Rio', temp: 0.5, downfall: 0.5, grass: 0x8eb971, foliage: 0x71a74d, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'sand', river: true, trees: [], treeDensity: 0, grassDensity: 1, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['sugar_cane', 'seagrass', 'clay'] },
  { name: 'frozen_river', label: 'Rio congelado', temp: 0, downfall: 0.5, grass: 0x80b497, foliage: 0x60a17b, water: 0x3938c9, waterFog: DEF_FOG, surface: 'snow', underwater: 'gravel', river: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'snow', extras: ['ice'] },
  { name: 'plains', label: 'Planície', temp: 0.8, downfall: 0.4, grass: 0x91bd59, foliage: 0x77ab2f, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['oak', 9], ['fancy_oak', 1]], treeDensity: 0.08, grassDensity: 16, flowers: ['buttercup', 'poppy', 'daisy', 'cornflower', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'forget_me_not'], flowerDensity: 2, precipitation: 'rain', extras: ['pumpkin', 'sugar_cane'] },
  { name: 'sunflower_plains', label: 'Planície de girassóis', temp: 0.8, downfall: 0.4, grass: 0x91bd59, foliage: 0x77ab2f, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['oak', 9], ['fancy_oak', 1]], treeDensity: 0.05, grassDensity: 14, flowers: ['buttercup', 'poppy', 'daisy'], flowerDensity: 2, precipitation: 'rain', extras: ['sunflower', 'sugar_cane'] },
  { name: 'snowy_plains', label: 'Tundra nevada', temp: 0, downfall: 0.5, grass: 0x80b497, foliage: 0x60a17b, water: DEF_WATER, waterFog: DEF_FOG, surface: 'snow', underwater: 'dirt', trees: [['spruce', 1]], treeDensity: 0.1, grassDensity: 1, flowers: [], flowerDensity: 0, precipitation: 'snow' },
  { name: 'forest', label: 'Floresta', temp: 0.7, downfall: 0.8, grass: 0x79c05a, foliage: 0x59ae30, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['oak', 7], ['fancy_oak', 1], ['birch', 2]], treeDensity: 10, grassDensity: 6, flowers: ['buttercup', 'poppy', 'lily_of_the_valley'], flowerDensity: 1, precipitation: 'rain', extras: ['mushrooms', 'lilac', 'rose_bush', 'peony'] },
  { name: 'flower_forest', label: 'Floresta florida', temp: 0.7, downfall: 0.8, grass: 0x79c05a, foliage: 0x59ae30, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['oak', 8], ['birch', 2], ['fancy_oak', 1]], treeDensity: 4, grassDensity: 4, flowers: ['buttercup', 'poppy', 'purple_clover', 'forget_me_not', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'daisy', 'cornflower', 'lily_of_the_valley'], flowerDensity: 18, precipitation: 'rain', extras: ['lilac', 'rose_bush', 'peony'] },
  { name: 'birch_forest', label: 'Bosque de bétulas', temp: 0.6, downfall: 0.6, grass: 0x88bb67, foliage: 0x6ba941, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['birch', 8], ['tall_birch', 2]], treeDensity: 10, grassDensity: 6, flowers: ['buttercup', 'poppy', 'lily_of_the_valley'], flowerDensity: 1, precipitation: 'rain' },
  { name: 'dark_forest', label: 'Floresta escura', temp: 0.7, downfall: 0.8, grass: 0x507a32, foliage: 0x3f6f1e, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['dark_oak', 10], ['oak', 1], ['birch', 1]], treeDensity: 22, grassDensity: 3, flowers: ['poppy'], flowerDensity: 0.3, precipitation: 'rain', extras: ['big_mushrooms', 'mushrooms'] },
  { name: 'taiga', label: 'Taiga', temp: 0.25, downfall: 0.8, grass: 0x86b783, foliage: 0x68a464, water: 0x287082, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['spruce', 2], ['pine', 1]], treeDensity: 10, grassDensity: 7, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['ferns', 'berries', 'mushrooms'] },
  { name: 'snowy_taiga', label: 'Taiga nevada', temp: -0.5, downfall: 0.4, grass: 0x80b497, foliage: 0x60a17b, water: 0x205e83, waterFog: DEF_FOG, surface: 'snow', underwater: 'dirt', trees: [['spruce', 2], ['pine', 1]], treeDensity: 10, grassDensity: 2, flowers: [], flowerDensity: 0, precipitation: 'snow', extras: ['ferns', 'berries'] },
  { name: 'old_growth_taiga', label: 'Taiga antiga', temp: 0.3, downfall: 0.8, grass: 0x86b87f, foliage: 0x68a55f, water: DEF_WATER, waterFog: DEF_FOG, surface: 'podzol', underwater: 'dirt', trees: [['mega_spruce', 3], ['spruce', 3], ['pine', 1]], treeDensity: 10, grassDensity: 7, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['ferns', 'berries', 'mushrooms', 'boulders'] },
  { name: 'desert', label: 'Deserto', temp: 2, downfall: 0, grass: 0xbfb755, foliage: 0xaea42a, water: DEF_WATER, waterFog: DEF_FOG, surface: 'sand', underwater: 'sand', trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'none', extras: ['cactus', 'dead_bush', 'sugar_cane'] },
  { name: 'savanna', label: 'Savana', temp: 2, downfall: 0, grass: 0xbfb755, foliage: 0xaea42a, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['acacia', 8], ['oak', 1]], treeDensity: 1.2, grassDensity: 20, flowers: ['buttercup', 'poppy'], flowerDensity: 0.3, precipitation: 'none', extras: ['tall_grass'] },
  { name: 'savanna_plateau', label: 'Planalto de savana', temp: 2, downfall: 0, grass: 0xbfb755, foliage: 0xaea42a, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['acacia', 8], ['oak', 1]], treeDensity: 1.5, grassDensity: 20, flowers: [], flowerDensity: 0, precipitation: 'none', extras: ['tall_grass'] },
  { name: 'jungle', label: 'Selva', temp: 0.95, downfall: 0.9, grass: 0x59c93c, foliage: 0x30bb0b, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['jungle', 4], ['mega_jungle', 2], ['jungle_bush', 5], ['fancy_oak', 1]], treeDensity: 40, grassDensity: 20, flowers: ['blue_orchid', 'poppy'], flowerDensity: 1, precipitation: 'rain', extras: ['melon', 'vines', 'ferns'] },
  { name: 'sparse_jungle', label: 'Selva esparsa', temp: 0.95, downfall: 0.8, grass: 0x64c73f, foliage: 0x3eb80f, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['jungle', 4], ['jungle_bush', 5], ['fancy_oak', 1]], treeDensity: 3, grassDensity: 16, flowers: ['blue_orchid', 'poppy'], flowerDensity: 1, precipitation: 'rain', extras: ['melon', 'vines'] },
  { name: 'swamp', label: 'Pântano', temp: 0.8, downfall: 0.9, grass: 0x6a7039, foliage: 0x6a7039, water: 0x617b64, waterFog: 0x232317, surface: 'grass', underwater: 'mud', trees: [['swamp_oak', 1]], treeDensity: 2, grassDensity: 5, flowers: ['blue_orchid'], flowerDensity: 0.6, precipitation: 'rain', extras: ['lily_pad', 'mushrooms', 'sugar_cane', 'seagrass', 'clay'] },
  { name: 'meadow', label: 'Prado alto', temp: 0.5, downfall: 0.8, grass: 0x83bb6d, foliage: 0x63a948, water: 0x0e4ecf, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [['birch', 2], ['oak', 1]], treeDensity: 0.1, grassDensity: 22, flowers: ['cornflower', 'daisy', 'purple_clover', 'forget_me_not', 'buttercup'], flowerDensity: 8, precipitation: 'rain' },
  { name: 'grove', label: 'Arvoredo nevado', temp: -0.2, downfall: 0.8, grass: 0x80b497, foliage: 0x60a17b, water: DEF_WATER, waterFog: DEF_FOG, surface: 'snow', underwater: 'dirt', mountain: true, trees: [['pine', 1]], treeDensity: 8, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'snow' },
  { name: 'snowy_slopes', label: 'Encostas nevadas', temp: -0.3, downfall: 0.9, grass: 0x80b497, foliage: 0x60a17b, water: DEF_WATER, waterFog: DEF_FOG, surface: 'snow', underwater: 'dirt', mountain: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'snow' },
  { name: 'jagged_peaks', label: 'Picos serrilhados', temp: -0.7, downfall: 0.9, grass: 0x80b497, foliage: 0x60a17b, water: DEF_WATER, waterFog: DEF_FOG, surface: 'snow', underwater: 'dirt', mountain: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'snow' },
  { name: 'frozen_peaks', label: 'Picos congelados', temp: -0.7, downfall: 0.9, grass: 0x80b497, foliage: 0x60a17b, water: DEF_WATER, waterFog: DEF_FOG, surface: 'snow', underwater: 'dirt', mountain: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'snow', extras: ['packed_ice'] },
  { name: 'stony_peaks', label: 'Picos rochosos', temp: 1, downfall: 0.3, grass: 0x9abe4b, foliage: 0x82ac1e, water: DEF_WATER, waterFog: DEF_FOG, surface: 'stone', underwater: 'gravel', mountain: true, trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'rain' },
  { name: 'windswept_hills', label: 'Colinas ventosas', temp: 0.2, downfall: 0.3, grass: 0x8ab689, foliage: 0x6da36b, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'gravel', mountain: true, trees: [['spruce', 2], ['oak', 1]], treeDensity: 0.5, grassDensity: 4, flowers: [], flowerDensity: 0, precipitation: 'rain', extras: ['emerald'] },
  { name: 'badlands', label: 'Ermos', temp: 2, downfall: 0, grass: 0x90814d, foliage: 0x9e814d, water: DEF_WATER, waterFog: DEF_FOG, surface: 'terracotta', underwater: 'sand', trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'none', extras: ['dead_bush', 'cactus', 'gold'] },
  { name: 'bosque_lume', label: 'Bosque Lume', temp: 0.6, downfall: 0.9, grass: 0x4fa39a, foliage: 0x3f9d8e, water: 0x3a8fd1, waterFog: 0x06203a, surface: 'lume', underwater: 'dirt', trees: [['lume', 5], ['big_lume', 2]], treeDensity: 6, grassDensity: 12, flowers: ['lume_bloom'], flowerDensity: 5, precipitation: 'rain', fog: 0x6e8fd6, extras: ['lume_mushroom', 'ferns'] },
  // Ínfero
  { name: 'infero_wastes', label: 'Ermos do Ínfero', temp: 2, downfall: 0, grass: 0xbfb755, foliage: 0xaea42a, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'none', fog: 0x330808 },
  { name: 'ember_forest', label: 'Floresta de brasa', temp: 2, downfall: 0, grass: 0xbfb755, foliage: 0xaea42a, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'none', fog: 0x4a0b05 },
  { name: 'ash_forest', label: 'Floresta de cinzeiros', temp: 2, downfall: 0, grass: 0xbfb755, foliage: 0xaea42a, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'none', fog: 0x2a2427 },
  { name: 'lament_valley', label: 'Vale dos Lamentos', temp: 2, downfall: 0, grass: 0xbfb755, foliage: 0xaea42a, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'none', fog: 0x1b4745 },
  { name: 'basalt_deltas', label: 'Deltas de basalto', temp: 2, downfall: 0, grass: 0xbfb755, foliage: 0xaea42a, water: DEF_WATER, waterFog: DEF_FOG, surface: 'grass', underwater: 'dirt', trees: [], treeDensity: 0, grassDensity: 0, flowers: [], flowerDensity: 0, precipitation: 'none', fog: 0x685f70 },
];

export const BIOMES: Biome[] = list.map((b, i) => ({ ...b, id: i }) as Biome);
const byName = new Map(BIOMES.map((b) => [b.name, b]));
export const biome = (name: string): Biome => {
  const b = byName.get(name);
  if (!b) throw new Error(`bioma desconhecido ${name}`);
  return b;
};
export const BIOME_ID = Object.fromEntries(BIOMES.map((b) => [b.name, b.id])) as Record<string, number>;

const B = BIOME_ID;

/** Índices de temperatura e umidade (limiares da geração moderna). */
const tIdx = (t: number): number => (t < -0.45 ? 0 : t < -0.15 ? 1 : t < 0.2 ? 2 : t < 0.55 ? 3 : 4);
const hIdx = (h: number): number => (h < -0.35 ? 0 : h < -0.1 ? 1 : h < 0.1 ? 2 : h < 0.3 ? 3 : 4);

const MIDDLE: number[][] = [
  // umidade:  0              1               2                 3                 4
  [B.snowy_plains, B.snowy_plains, B.snowy_plains, B.snowy_taiga, B.snowy_taiga], // congelado
  [B.plains, B.plains, B.forest, B.taiga, B.old_growth_taiga], // frio
  [B.flower_forest, B.plains, B.forest, B.birch_forest, B.dark_forest], // temperado
  [B.savanna, B.savanna, B.forest, B.sparse_jungle, B.jungle], // morno
  [B.desert, B.desert, B.desert, B.desert, B.desert], // quente
];

/** Escolhe o bioma de superfície para um ponto climático. `height` é a altura aproximada do terreno. */
export function pickBiome(p: ClimatePoint, height: number): number {
  const { t, h, c, e, w, pv } = p;
  const ti = tIdx(t), hi = hIdx(h);
  if (c < -0.455) {
    return ti === 0 ? B.deep_frozen_ocean : ti === 1 ? B.cold_ocean : ti === 4 ? B.lukewarm_ocean : B.deep_ocean;
  }
  if (c < -0.19 || (c < -0.11 && height < 60)) {
    return ti === 0 ? B.frozen_ocean : ti === 1 ? B.cold_ocean : ti === 3 ? B.lukewarm_ocean : ti === 4 ? B.warm_ocean : B.ocean;
  }
  // rios nos vales
  if (pv < -0.85 && c < 0.55 && height < 66) return ti === 0 ? B.frozen_river : B.river;
  // costa
  if (c < -0.11 && height < 68) {
    if (e < -0.375) return B.stony_shore;
    return ti === 0 ? B.snowy_beach : B.beach;
  }
  // montanhas
  if (height > 150 || (pv > 0.7 && e < -0.375 && height > 120)) {
    if (ti <= 2) return w > 0 ? B.jagged_peaks : B.frozen_peaks;
    return B.stony_peaks;
  }
  if (height > 110 || (pv > 0.3 && e < -0.2225 && height > 95)) {
    if (ti <= 1) return hi >= 3 ? B.grove : B.snowy_slopes;
    if (ti === 2) return hi >= 3 ? B.grove : B.meadow;
    if (ti === 3) return B.savanna_plateau;
    return B.badlands;
  }
  if (e > 0.45 && e < 0.55 && pv > 0.2 && ti <= 2) return B.windswept_hills;
  // bioma raro inventado
  if (Math.abs(w) > 0.78 && hi >= 3 && ti >= 2 && ti <= 3 && e > -0.2) return B.bosque_lume;
  // pântano em áreas muito planas e úmidas
  if (e > 0.55 && hi >= 2 && ti >= 2 && ti <= 3 && height < 70) return B.swamp;
  let b = MIDDLE[ti][hi];
  if (b === B.plains && w > 0.35 && ti === 2) b = B.sunflower_plains;
  if (b === B.desert && e < -0.4 && pv > 0) b = B.badlands;
  return b;
}
