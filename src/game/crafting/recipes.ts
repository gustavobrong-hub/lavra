/**
 * Motor de receitas: com formato (espelhável, desloca dentro da grade) e sem formato (multiconjunto),
 * ingredientes por item ou por grupo (qualquer tábua, qualquer lã, qualquer tronco...).
 */
import { ItemStack } from '../items/stack';
import { item } from '../items/registry';

/** Ingrediente: id de item, '#grupo' ou lista de alternativas. */
export type Ingredient = string | string[];

export interface ShapedRecipe {
  kind: 'shaped';
  id: string;
  pattern: string[]; // até 3×3
  key: Record<string, Ingredient>;
  result: { id: string; count: number };
  group?: string;
  category: RecipeCategory;
}

export interface ShapelessRecipe {
  kind: 'shapeless';
  id: string;
  ingredients: Ingredient[];
  result: { id: string; count: number };
  group?: string;
  category: RecipeCategory;
}

export type Recipe = ShapedRecipe | ShapelessRecipe;
export type RecipeCategory = 'building' | 'tools' | 'combat' | 'fulgor' | 'food' | 'deco' | 'misc';

export interface SmeltingRecipe { input: Ingredient; result: string; count: number; xp: number; time: number; kinds: ('furnace' | 'smoker' | 'blast')[] }

const GROUPS = new Map<string, Set<string>>();
export function defineGroup(name: string, ids: string[]): void {
  let g = GROUPS.get(name);
  if (!g) { g = new Set(); GROUPS.set(name, g); }
  for (const i of ids) g.add(i);
}
export function groupItems(name: string): string[] { return [...(GROUPS.get(name) ?? [])]; }

export function matchesIngredient(ing: Ingredient, id: string): boolean {
  if (Array.isArray(ing)) return ing.some((i) => matchesIngredient(i, id));
  if (ing.startsWith('#')) return GROUPS.get(ing.slice(1))?.has(id) ?? false;
  return ing === id;
}

/** Itens possíveis para um ingrediente (para exibir no livro de receitas). */
export function ingredientOptions(ing: Ingredient): string[] {
  if (Array.isArray(ing)) return ing.flatMap(ingredientOptions);
  if (ing.startsWith('#')) return groupItems(ing.slice(1));
  return [ing];
}

export const RECIPES: Recipe[] = [];
export const SMELTING: SmeltingRecipe[] = [];

export function shaped(id: string, pattern: string[], key: Record<string, Ingredient>, result: string, count = 1, category: RecipeCategory = 'misc', group?: string): void {
  if (!item(result)) return;
  RECIPES.push({ kind: 'shaped', id, pattern, key, result: { id: result, count }, category, group });
}
export function shapeless(id: string, ingredients: Ingredient[], result: string, count = 1, category: RecipeCategory = 'misc', group?: string): void {
  if (!item(result)) return;
  RECIPES.push({ kind: 'shapeless', id, ingredients, result: { id: result, count }, category, group });
}
export function smelt(input: Ingredient, result: string, xp: number, kinds: SmeltingRecipe['kinds'] = ['furnace'], count = 1): void {
  if (!item(result)) return;
  SMELTING.push({ input, result, count, xp, time: 200, kinds });
}

/** Grade de crafting: w×h com ids (ou null). */
export interface CraftGrid { w: number; h: number; items: (ItemStack | null)[] }

function trimmed(g: CraftGrid): { w: number; h: number; cells: (string | null)[] } | null {
  let minX = g.w, minY = g.h, maxX = -1, maxY = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.items[y * g.w + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const cells: (string | null)[] = [];
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) cells.push(g.items[y * g.w + x]?.id ?? null);
  return { w, h, cells };
}

function matchShaped(r: ShapedRecipe, t: { w: number; h: number; cells: (string | null)[] }, mirror: boolean): boolean {
  const ph = r.pattern.length, pw = Math.max(...r.pattern.map((l) => l.length));
  if (pw !== t.w || ph !== t.h) return false;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const ch = r.pattern[y][mirror ? pw - 1 - x : x] ?? ' ';
    const id = t.cells[y * t.w + x];
    if (ch === ' ') { if (id) return false; continue; }
    if (!id || !matchesIngredient(r.key[ch], id)) return false;
  }
  return true;
}

function matchShapeless(r: ShapelessRecipe, g: CraftGrid): boolean {
  const ids = g.items.filter(Boolean).map((s) => s!.id);
  if (ids.length !== r.ingredients.length) return false;
  const used = new Array(ids.length).fill(false);
  // casamento guloso com retrocesso simples (ingredientes mais restritos primeiro)
  const order = [...r.ingredients].sort((a, b) => ingredientOptions(a).length - ingredientOptions(b).length);
  const tryMatch = (i: number): boolean => {
    if (i === order.length) return true;
    for (let j = 0; j < ids.length; j++) {
      if (used[j] || !matchesIngredient(order[i], ids[j])) continue;
      used[j] = true;
      if (tryMatch(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return tryMatch(0);
}

/** Encontra a receita para a grade (respeitando o tamanho: 2×2 no inventário, 3×3 na bancada). */
export function findRecipe(g: CraftGrid): Recipe | null {
  const t = trimmed(g);
  if (!t) return null;
  for (const r of RECIPES) {
    if (r.kind === 'shaped') {
      if (matchShaped(r, t, false) || matchShaped(r, t, true)) return r;
    } else if (matchShapeless(r, g)) return r;
  }
  return null;
}

/** Resultado especial: consertar ferramentas combinando duas iguais (receita de reparo do original). */
export function repairResult(g: CraftGrid): ItemStack | null {
  const st = g.items.filter(Boolean) as ItemStack[];
  if (st.length !== 2 || st[0].id !== st[1].id || !st[0].damageable || st[0].count !== 1 || st[1].count !== 1) return null;
  const max = st[0].maxDamage;
  const remain = (max - st[0].damage) + (max - st[1].damage) + Math.floor(max * 5 / 100);
  const out = new ItemStack(st[0].id, 1, Math.max(0, max - remain));
  return out;
}

export function craftResult(g: CraftGrid): { stack: ItemStack; recipe: Recipe | null } | null {
  const r = findRecipe(g);
  if (r) return { stack: new ItemStack(r.result.id, r.result.count), recipe: r };
  const rep = repairResult(g);
  return rep ? { stack: rep, recipe: null } : null;
}

export function findSmelting(id: string, kind: 'furnace' | 'smoker' | 'blast' = 'furnace'): SmeltingRecipe | null {
  return SMELTING.find((r) => r.kinds.includes(kind) && matchesIngredient(r.input, id)) ?? null;
}

/** Sobras ao consumir ingredientes (baldes, garrafas). */
export function remainderOf(id: string): string | null {
  if (id === 'water_bucket' || id === 'lava_bucket' || id === 'milk_bucket') return 'bucket';
  if (id === 'honey_bottle') return 'glass_bottle';
  return null;
}
