import { describe, expect, it } from 'vitest';
import '../../src/game/items/registry';
import { initRecipes } from '../../src/game/crafting/data';
import { RECIPES, findRecipe, findSmelting } from '../../src/game/crafting/recipes';
import { CraftingGridMenu } from '../../src/game/inventory/menu';
import { Inventory } from '../../src/game/inventory/inventory';
import { ItemStack } from '../../src/game/items/stack';

initRecipes();
const g3 = (ids: (string | null)[]) => ({ w: 3, h: 3, items: ids.map((i) => (i ? new ItemStack(i) : null)) });

describe('crafting', () => {
  it('há centenas de receitas', () => { expect(RECIPES.length).toBeGreaterThan(300); });
  it('tronco vira 4 tábuas (sem formato)', () => {
    const r = findRecipe({ w: 2, h: 2, items: [null, new ItemStack('oak_log'), null, null] });
    expect(r?.result).toEqual({ id: 'oak_planks', count: 4 });
  });
  it('graveto em qualquer coluna (formato deslocado)', () => {
    const r = findRecipe(g3([null, null, 'birch_planks', null, null, 'oak_planks', null, null, null]));
    expect(r?.result).toEqual({ id: 'stick', count: 4 });
  });
  it('machado espelhado também funciona', () => {
    const a = findRecipe(g3(['iron_ingot', 'iron_ingot', null, 'iron_ingot', 'stick', null, null, 'stick', null]));
    const b = findRecipe(g3([null, 'iron_ingot', 'iron_ingot', null, 'stick', 'iron_ingot', null, 'stick', null]));
    expect(a?.result.id).toBe('iron_axe');
    expect(b?.result.id).toBe('iron_axe');
  });
  it('picareta de pedra aceita ardósia britada', () => {
    const r = findRecipe(g3(['cobbled_deepslate', 'cobblestone', 'cobbled_deepslate', null, 'stick', null, null, 'stick', null]));
    expect(r?.result.id).toBe('stone_pickaxe');
  });
  it('fornalha: minério de ferro vira lingote', () => {
    expect(findSmelting('raw_iron')?.result).toBe('iron_ingot');
    expect(findSmelting('oak_log')?.result).toBe('charcoal');
    expect(findSmelting('beef', 'smoker')?.result).toBe('cooked_beef');
    expect(findSmelting('raw_iron', 'smoker')).toBeNull();
  });
  it('menu 2×2: pegar o resultado consome os ingredientes', () => {
    const inv = new Inventory();
    const m = new CraftingGridMenu(inv, 2, true);
    m.carried = new ItemStack('oak_log', 3);
    m.click(m.gridStart, 0);
    expect(m.slots[m.resultIndex].item?.id).toBe('oak_planks');
    m.click(m.resultIndex, 0);
    expect(m.carried?.id).toBe('oak_planks');
    expect(m.carried?.count).toBe(4);
    expect(m.grid[0]?.count).toBe(2);
  });
  it('shift-clique no resultado fabrica o máximo', () => {
    const inv = new Inventory();
    const m = new CraftingGridMenu(inv, 2, true);
    m.grid[0] = new ItemStack('oak_log', 5);
    m.click(m.gridStart, 0); m.click(m.gridStart, 0); // força recálculo sem mudar nada
    m.click(m.resultIndex, 0, 'quick');
    expect(inv.count('oak_planks')).toBe(20);
    expect(m.grid[0]).toBeNull();
  });
  it('clique direito pega metade; arrastar distribui igualmente', () => {
    const inv = new Inventory();
    inv.main[9] = new ItemStack('stone', 13);
    const m = new CraftingGridMenu(inv, 2, true);
    const idx = m.playerStart; // mochila 9
    m.click(idx, 1);
    expect(m.carried?.count).toBe(7);
    expect(inv.main[9]?.count).toBe(6);
    m.dragStart(0);
    m.dragOver(m.playerStart + 1); m.dragOver(m.playerStart + 2); m.dragOver(m.playerStart + 3);
    m.dragEnd();
    expect(inv.main[10]?.count).toBe(2);
    expect(inv.main[11]?.count).toBe(2);
    expect(inv.main[12]?.count).toBe(2);
    expect(m.carried?.count).toBe(1);
  });
});
