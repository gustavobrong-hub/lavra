/**
 * Inventário do Criativo: abas por categoria, busca, catálogo rolável, barra rápida e lixeira.
 * Clique pega 1 (shift: pilha cheia), clique com o mesmo item soma, botão do meio pega a pilha.
 */
import { h } from '../ui';
import { ContainerScreen } from './container';
import { Menu, Slot, type SlotSource } from '../../game/inventory/menu';
import type { Inventory } from '../../game/inventory/inventory';
import { ITEMS } from '../../game/items/registry';
import type { ItemTab } from '../../game/items/types';
import { ItemStack } from '../../game/items/stack';
import { iconPos } from '../../render/icons';

const TABS: [ItemTab | 'search', string, string][] = [
  ['build', 'Construção', 'stone_bricks'], ['nature', 'Natureza', 'grass_block'], ['deco', 'Decoração', 'lantern'],
  ['fulgor', 'Fulgor', 'fulgor_dust'], ['util', 'Utilidades', 'crafting_table'], ['tools', 'Ferramentas', 'iron_pickaxe'],
  ['combat', 'Combate', 'iron_sword'], ['food', 'Comida', 'bread'], ['materials', 'Materiais', 'iron_ingot'],
  ['misc', 'Diversos', 'cow_spawn_egg'], ['search', 'Busca', 'compass'],
];
const COLS = 9, ROWS = 5;

class CreativeMenu extends Menu {
  catalog: string[] = [];
  scroll = 0;
  hotStart = 0;
  trash = 0;
  constructor(inv: Inventory) {
    super(inv);
    this.creative = true;
    const cat: SlotSource = { get: (i) => { const id = this.catalog[this.scroll * COLS + i]; return id ? new ItemStack(id, 1) : null; }, set: () => undefined };
    for (let i = 0; i < COLS * ROWS; i++) this.add(new Slot(cat, i, { group: 'catalog' }));
    const hot: SlotSource = { get: (i) => this.inv.main[i], set: (i, s) => { this.inv.main[i] = s; this.inv.changed(); } };
    this.hotStart = this.slots.length;
    for (let i = 0; i < 9; i++) this.add(new Slot(hot, i, { group: 'hotbar' }));
    this.trash = this.add(new Slot({ get: () => null, set: () => undefined }, 0, { group: 'trash' }));
  }

  override click(index: number, button: number, type: 'pickup' | 'quick' | 'swap' | 'clone' | 'throw' | 'pickupAll' = 'pickup'): void {
    const s = this.slots[index];
    if (s && s.opts.group === 'catalog') {
      const it = s.item;
      if (!it) { if (button === 0) this.carried = null; else if (this.carried) { this.carried.count--; if (this.carried.count <= 0) this.carried = null; } this.changed(); return; }
      if (type === 'swap') { this.inv.main[button] = it.copy(it.maxStack); this.inv.changed(); this.changed(); return; }
      if (type === 'clone' || type === 'quick') {
        if (type === 'quick') { this.inv.add(it.copy(it.maxStack)); } else this.carried = it.copy(it.maxStack);
        this.changed(); return;
      }
      if (type === 'throw') { this.dropped.push(it.copy(button === 1 ? it.maxStack : 1)); this.changed(); return; }
      const c = this.carried;
      if (c && c.sameKind(it)) { if (button === 0) c.count = Math.min(c.maxStack, c.count + 1); else { c.count--; if (c.count <= 0) this.carried = null; } }
      else if (c) { if (button === 0) this.carried = null; else { c.count--; if (c.count <= 0) this.carried = null; } }
      else this.carried = it.copy(1);
      this.changed();
      return;
    }
    if (s && s.opts.group === 'trash') {
      if (type === 'quick') this.inv.clear(); else this.carried = null;
      this.changed();
      return;
    }
    super.click(index, button, type);
  }

  protected override quickMove(index: number): void {
    const s = this.slots[index];
    if (s.opts.group === 'hotbar') s.item = null;
  }
}

export class CreativeScreen extends ContainerScreen {
  private readonly cm: CreativeMenu;
  private readonly search: HTMLInputElement;
  private readonly tabsEl: HTMLDivElement;
  private tab: ItemTab | 'search' = 'build';
  private readonly scrollbar: HTMLDivElement;

  constructor(inv: Inventory) {
    const menu = new CreativeMenu(inv);
    super(menu, '', 'creative');
    this.cm = menu;
    this.tabsEl = h('div', 'cr-tabs');
    for (const [id, label, icon] of TABS) {
      const b = h('button', 'cr-tab');
      b.innerHTML = `<span class="icon" style="${iconPos(icon)}"></span>`;
      b.title = label;
      b.dataset.tab = id;
      b.addEventListener('click', () => this.setTab(id));
      this.tabsEl.append(b);
    }
    this.search = h('input', 'cr-search');
    this.search.placeholder = 'Buscar itens…';
    this.search.addEventListener('input', () => this.setTab('search'));
    this.search.addEventListener('keydown', (e) => e.stopPropagation());
    this.scrollbar = h('div', 'cr-scroll', h('div', 'cr-thumb'));
    const grid = this.grid(0, COLS, COLS * ROWS);
    grid.addEventListener('wheel', (e) => { this.scrollBy(Math.sign(e.deltaY)); e.preventDefault(); }, { passive: false });
    const hot = this.grid(menu.hotStart, 9, 9, 'hot');
    const trash = this.slot(menu.trash, 'trash');
    trash.title = 'Destruir item (shift: esvaziar inventário)';
    this.panel.append(this.tabsEl, h('div', 'cr-head', h('div', 'cr-name', ''), this.search), h('div', 'cr-body', grid, this.scrollbar), h('div', 'cr-foot', hot, trash));
    this.setTab('build');
  }

  private setTab(t: ItemTab | 'search'): void {
    this.tab = t;
    const q = this.search.value.trim().toLowerCase();
    this.cm.catalog = ITEMS.filter((i) => (t === 'search' ? (!q || i.label.toLowerCase().includes(q) || i.id.includes(q)) && i.tab !== 'none' : i.tab === t)).map((i) => i.id);
    this.cm.scroll = 0;
    this.tabsEl.querySelectorAll('.cr-tab').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === t));
    const label = TABS.find((x) => x[0] === t)?.[1] ?? '';
    (this.panel.querySelector('.cr-name') as HTMLElement).textContent = label;
    this.cm.changed();
    this.render(true);
  }

  private scrollBy(d: number): void {
    const rows = Math.ceil(this.cm.catalog.length / COLS);
    this.cm.scroll = Math.max(0, Math.min(Math.max(0, rows - ROWS), this.cm.scroll + d));
    this.cm.changed();
    this.render(true);
  }

  protected override renderExtra(): void {
    const rows = Math.ceil(this.cm.catalog.length / COLS);
    const max = Math.max(1, rows - ROWS);
    const thumb = this.scrollbar.firstElementChild as HTMLElement;
    thumb.style.top = `${(this.cm.scroll / max) * 80}%`;
    thumb.style.display = rows > ROWS ? '' : 'none';
  }

  override onKey(e: KeyboardEvent): boolean {
    if (document.activeElement === this.search) return false;
    return super.onKey(e);
  }
}
