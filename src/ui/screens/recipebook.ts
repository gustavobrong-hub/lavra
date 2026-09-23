/**
 * Livro de receitas navegável: categorias, busca, filtro "só as que dá para fazer" e clique para
 * preencher a grade com os ingredientes do inventário (como o original).
 */
import { h } from '../ui';
import { RECIPES, ingredientOptions, type Recipe, type Ingredient, type RecipeCategory } from '../../game/crafting/recipes';
import type { CraftingGridMenu } from '../../game/inventory/menu';
import { iconPos } from '../../render/icons';
import { item } from '../../game/items/registry';
import { ItemStack } from '../../game/items/stack';

const CATS: [RecipeCategory | 'all', string][] = [
  ['all', 'Tudo'], ['building', 'Construção'], ['tools', 'Ferramentas'], ['combat', 'Combate'], ['fulgor', 'Fulgor'],
  ['food', 'Comida'], ['deco', 'Decoração'], ['misc', 'Diversos'],
];

function pattern(r: Recipe): (Ingredient | null)[][] {
  if (r.kind === 'shapeless') {
    const rows: (Ingredient | null)[][] = [];
    for (let i = 0; i < r.ingredients.length; i += 3) rows.push(r.ingredients.slice(i, i + 3));
    return rows;
  }
  return r.pattern.map((row) => [...row].map((ch) => (ch === ' ' ? null : r.key[ch])));
}

export class RecipeBook {
  readonly el: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly search: HTMLInputElement;
  private readonly onlyCraftable: HTMLInputElement;
  private cat: RecipeCategory | 'all' = 'all';
  private visible = false;
  private lastInv = -1;

  constructor(private readonly menu: CraftingGridMenu, private readonly size: 2 | 3) {
    this.search = h('input', 'rb-search');
    this.search.placeholder = 'Buscar…';
    this.search.addEventListener('input', () => this.refresh());
    this.search.addEventListener('keydown', (e) => e.stopPropagation());
    this.onlyCraftable = h('input');
    this.onlyCraftable.type = 'checkbox';
    this.onlyCraftable.addEventListener('change', () => this.refresh());
    const tabs = h('div', 'rb-tabs');
    for (const [c, label] of CATS) {
      const b = h('button', 'rb-tab', label);
      b.addEventListener('click', () => { this.cat = c; tabs.querySelectorAll('.rb-tab').forEach((x) => x.classList.remove('on')); b.classList.add('on'); this.refresh(); });
      if (c === 'all') b.classList.add('on');
      tabs.append(b);
    }
    this.list = h('div', 'rb-list');
    this.el = h('div', 'panel recipe-book',
      h('div', 'panel-title', 'Livro de receitas'), this.search,
      h('label', 'rb-filter', this.onlyCraftable, ' Só o que posso fabricar'), tabs, this.list);
    this.el.style.display = 'none';
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? '' : 'none';
    this.refresh();
  }

  update(): void {
    if (this.visible && this.menu.inv.version !== this.lastInv) this.refresh();
  }

  private fits(r: Recipe): boolean {
    const p = pattern(r);
    return p.length <= this.size && p.every((row) => row.length <= this.size);
  }

  /** Verifica se o inventário tem os ingredientes (contando a grade atual). */
  private craftable(r: Recipe): boolean {
    const pool = new Map<string, number>();
    const addPool = (s: ItemStack | null) => { if (s) pool.set(s.id, (pool.get(s.id) ?? 0) + s.count); };
    this.menu.inv.main.forEach(addPool);
    this.menu.grid.forEach(addPool);
    const needs = pattern(r).flat().filter(Boolean) as Ingredient[];
    for (const ing of needs) {
      const opts = ingredientOptions(ing);
      const got = opts.find((o) => (pool.get(o) ?? 0) > 0);
      if (!got) return false;
      pool.set(got, pool.get(got)! - 1);
    }
    return true;
  }

  private refresh(): void {
    this.lastInv = this.menu.inv.version;
    if (!this.visible) return;
    const q = this.search.value.trim().toLowerCase();
    const seen = new Set<string>();
    const rows: HTMLElement[] = [];
    for (const r of RECIPES) {
      if (!this.fits(r)) continue;
      if (this.cat !== 'all' && r.category !== this.cat) continue;
      const def = item(r.result.id);
      if (!def) continue;
      if (q && !def.label.toLowerCase().includes(q)) continue;
      const key = r.group ? `g:${r.group}:${r.result.id}` : r.id;
      if (seen.has(key)) continue;
      const ok = this.craftable(r);
      if (this.onlyCraftable.checked && !ok) continue;
      seen.add(key);
      const cell = h('div', `rb-item${ok ? '' : ' missing'}`);
      cell.innerHTML = `<span class="icon" style="${iconPos(r.result.id)}"></span>${r.result.count > 1 ? `<b>${r.result.count}</b>` : ''}`;
      cell.title = `${def.label}${ok ? '' : ' (faltam ingredientes)'}`;
      cell.addEventListener('click', (e) => this.place(r, e.shiftKey));
      rows.push(cell);
    }
    this.list.replaceChildren(...rows);
    if (!rows.length) this.list.append(h('div', 'rb-empty', 'Nenhuma receita encontrada.'));
  }

  /** Coloca os ingredientes na grade a partir do inventário (shift: o máximo possível). */
  private place(r: Recipe, max: boolean): void {
    const m = this.menu;
    // devolve o que está na grade
    for (let i = 0; i < m.grid.length; i++) {
      const g = m.grid[i];
      if (g) { m.inv.add(g); m.grid[i] = null; }
    }
    const p = pattern(r);
    const times = max ? 64 : 1;
    for (let t = 0; t < times; t++) {
      let placedAll = true;
      for (let y = 0; y < p.length; y++) for (let x = 0; x < p[y].length; x++) {
        const ing = p[y][x];
        if (!ing) continue;
        const gi = y * this.size + x;
        const cur = m.grid[gi];
        const opts = ingredientOptions(ing);
        const id = cur ? cur.id : opts.find((o) => m.inv.count(o) > 0);
        if (!id || m.inv.count(id) <= 0 || (cur && cur.count >= cur.maxStack)) { placedAll = false; continue; }
        m.inv.remove(id, 1);
        if (cur) cur.count++; else m.grid[gi] = new ItemStack(id, 1);
      }
      if (!placedAll) break;
    }
    m.refresh();
  }
}
