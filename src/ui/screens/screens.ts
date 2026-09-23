/** Telas de container: inventário (2×2), bancada (3×3), fornalha, baú. */
import { h } from '../ui';
import { ContainerScreen } from './container';
import type { CraftingGridMenu, ChestMenu } from '../../game/inventory/menu';
import type { FurnaceMenu } from '../../game/inventory/furnacemenu';
import { RecipeBook } from './recipebook';

export class InventoryScreen extends ContainerScreen {
  private book?: RecipeBook;
  constructor(readonly cm: CraftingGridMenu) {
    super(cm, '', 'inventory');
    const armor = h('div', 'armor-col');
    for (let i = 0; i < 4; i++) armor.append(this.slot(cm.armorStart + i, `armor a${i}`));
    const preview = h('div', 'player-preview', h('div', 'figure'));
    const off = this.slot(cm.offhandIndex, 'offhand');
    const craft = h('div', 'craft small',
      h('div', 'craft-title', 'Fabricação'),
      h('div', 'craft-row', this.grid(cm.gridStart, 2, 4), h('div', 'arrow'), this.slot(cm.resultIndex, 'result')));
    const bookBtn = h('button', 'book-btn', '📖');
    bookBtn.title = 'Livro de receitas';
    bookBtn.addEventListener('click', () => this.toggleBook());
    const top = h('div', 'inv-top', armor, preview, h('div', 'inv-right', off, craft, bookBtn));
    this.panel.append(top, this.playerGrids(cm.playerStart));
  }
  toggleBook(): void {
    if (!this.book) { this.book = new RecipeBook(this.cm, 2); this.el.append(this.book.el); }
    this.book.toggle();
  }
  override onKey(e: KeyboardEvent): boolean {
    if (e.code === 'KeyE') { return false; }
    return super.onKey(e);
  }
  override update(): void { super.update(); this.book?.update(); }
}

export class CraftingScreen extends ContainerScreen {
  private book: RecipeBook;
  constructor(readonly cm: CraftingGridMenu) {
    super(cm, 'Bancada de trabalho', 'crafting');
    this.panel.append(
      h('div', 'craft big', this.grid(cm.gridStart, 3, 9), h('div', 'arrow'), this.slot(cm.resultIndex, 'result')),
      this.playerGrids(cm.playerStart),
    );
    this.book = new RecipeBook(cm, 3);
    this.el.append(this.book.el);
    const bookBtn = h('button', 'book-btn', '📖');
    bookBtn.title = 'Livro de receitas';
    bookBtn.addEventListener('click', () => this.book.toggle());
    this.panel.append(bookBtn);
  }
  override update(): void { super.update(); this.book.update(); }
}

export class FurnaceScreen extends ContainerScreen {
  private readonly flame: HTMLDivElement;
  private readonly arrow: HTMLDivElement;
  constructor(readonly fm: FurnaceMenu, title: string) {
    super(fm, title, 'furnace');
    this.flame = h('div', 'flame');
    this.arrow = h('div', 'progress');
    this.panel.append(
      h('div', 'furnace-row',
        h('div', 'furnace-in', this.slot(0), this.flame, this.slot(1, 'fuel')),
        h('div', 'progress-wrap', this.arrow),
        this.slot(2, 'result')),
      this.playerGrids(fm.playerStart),
    );
  }
  protected override renderExtra(): void {
    const be = this.fm.be;
    const f = be.litDuration > 0 ? be.litTime / be.litDuration : 0;
    this.flame.style.setProperty('--f', String(f));
    this.arrow.style.setProperty('--p', String(be.cookTotal ? be.cook / be.cookTotal : 0));
  }
  override update(): void { this.render(true); }
}

export class ChestScreen extends ContainerScreen {
  constructor(readonly chm: ChestMenu, title: string) {
    super(chm, title, 'chest');
    this.panel.append(this.grid(0, 9, chm.containerSlots), h('div', 'gap big'), this.playerGrids(chm.playerStart));
  }
}
