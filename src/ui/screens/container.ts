/**
 * Base das telas de container: desenha os espaços, o item no cursor e as dicas, e traduz o mouse/teclado
 * para os cliques do menu (pegar, dividir, shift-clique, arrastar, duplo clique, 1–9, Q).
 */
import { h, type Screen } from '../ui';
import type { Menu } from '../../game/inventory/menu';
import type { ItemStack } from '../../game/items/stack';
import { iconPos } from '../../render/icons';
import { item } from '../../game/items/registry';
import { ENCHANT_NAMES, romanLevel } from '../../game/items/enchantnames';

export function slotHTML(s: ItemStack | null): string {
  if (!s) return '';
  let dur = '';
  if (s.damageable && s.damage > 0) {
    const f = 1 - s.damage / s.maxDamage;
    const hue = Math.round(f * 120);
    dur = `<i class="dur"><i style="width:${Math.max(1, f * 100)}%;background:hsl(${hue},85%,50%)"></i></i>`;
  }
  const glint = s.tag?.enchants || s.tag?.stored ? ' glint' : '';
  return `<span class="icon${glint}" style="${iconPos(s.id)}"></span>${s.count > 1 ? `<b>${s.count}</b>` : ''}${dur}`;
}

export function tooltipLines(s: ItemStack): string[] {
  const def = item(s.id);
  const out: string[] = [];
  const rarity = def?.rarity ?? (s.tag?.enchants ? 'uncommon' : 'common');
  out.push(`<span class="r-${rarity}">${escapeHtml(s.label)}</span>`);
  for (const [k, v] of Object.entries(s.tag?.enchants ?? s.tag?.stored ?? {})) out.push(`<span class="ench">${ENCHANT_NAMES[k] ?? k} ${romanLevel(v)}</span>`);
  if (def?.food) out.push(`<span class="dim">Fome +${def.food.hunger}, saciedade +${def.food.saturation}</span>`);
  if (def?.attack) out.push(`<span class="dim">${def.attack.damage} de dano, ${def.attack.speed} de velocidade</span>`);
  if (def?.armor) out.push(`<span class="dim">+${def.armor.defense} de armadura${def.armor.toughness ? `, +${def.armor.toughness} de resistência` : ''}</span>`);
  if (s.damageable && s.damage > 0) out.push(`<span class="dim">Durabilidade: ${s.maxDamage - s.damage}/${s.maxDamage}</span>`);
  return out;
}

export const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export abstract class ContainerScreen implements Screen {
  readonly el: HTMLDivElement;
  readonly panel: HTMLDivElement;
  readonly pauses = false;
  readonly freesMouse = true;
  protected readonly slotEls = new Map<number, HTMLDivElement>();
  private readonly cursor: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private hovered = -1;
  private lastVersion = -1;
  private lastInvVersion = -1;
  private mouseDown = -1;
  private dragStarted = false;
  private downSlot = -1;
  private lastClick = { slot: -1, t: 0 };
  onClosed?: () => void;
  onDropped?: (items: ItemStack[]) => void;

  constructor(readonly menu: Menu, title: string, cls = '') {
    this.panel = h('div', `panel container ${cls}`);
    if (title) this.panel.append(h('div', 'panel-title', title));
    this.el = h('div', 'screen dim', this.panel);
    this.cursor = h('div', 'slot cursor');
    this.tip = h('div', 'tooltip');
    this.el.append(this.cursor, this.tip);
    this.el.addEventListener('mousemove', (e) => this.onMove(e));
    this.el.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mouseup', this.upHandler);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private upHandler = (e: MouseEvent) => this.onUp(e);

  /** Cria o elemento de um espaço ligado ao índice do menu. */
  protected slot(index: number, extra = ''): HTMLDivElement {
    const d = h('div', `slot ${extra}`);
    d.dataset.i = String(index);
    this.slotEls.set(index, d);
    return d;
  }

  /** Grade de espaços consecutivos. */
  protected grid(start: number, cols: number, count: number, extra = ''): HTMLDivElement {
    const g = h('div', 'grid');
    g.style.gridTemplateColumns = `repeat(${cols}, var(--slot))`;
    for (let i = 0; i < count; i++) g.append(this.slot(start + i, extra));
    return g;
  }

  protected playerGrids(start: number): HTMLDivElement {
    return h('div', 'player-inv', this.grid(start, 9, 27), h('div', 'gap'), this.grid(start + 27, 9, 9, 'hot'));
  }

  private slotAt(e: MouseEvent): number {
    const t = (e.target as HTMLElement).closest('.slot') as HTMLElement | null;
    if (!t || t === this.cursor || !t.dataset.i) return -2;
    return parseInt(t.dataset.i, 10);
  }

  private onMove(e: MouseEvent): void {
    this.cursor.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
    const i = this.slotAt(e);
    this.hovered = i >= 0 ? i : -1;
    if (this.mouseDown >= 0 && i >= 0 && this.menu.carried) {
      if (!this.dragStarted && i !== this.downSlot) {
        this.dragStarted = true;
        this.menu.dragStart(this.mouseDown === 2 ? 2 : this.mouseDown);
        if (this.downSlot >= 0) this.menu.dragOver(this.downSlot);
      }
      if (this.dragStarted) this.menu.dragOver(i);
      this.render(true);
    }
    this.updateTip(e);
  }

  private onDown(e: MouseEvent): void {
    const i = this.slotAt(e);
    const inPanel = (e.target as HTMLElement).closest('.panel');
    if (i === -2 && inPanel) return; // clique na moldura
    if (i === -2) { this.menu.click(-1, e.button); this.flushDropped(); this.render(true); return; }
    const shift = e.shiftKey;
    const now = performance.now();
    if (e.button === 0 && !shift && this.lastClick.slot === i && now - this.lastClick.t < 280 && this.menu.carried) {
      this.menu.click(i, 0, 'pickupAll');
      this.lastClick = { slot: -1, t: 0 };
      this.render(true);
      return;
    }
    this.lastClick = { slot: i, t: now };
    if (shift && e.button === 0) { this.menu.click(i, 0, 'quick'); this.render(true); return; }
    if (e.button === 1) { this.menu.click(i, 2, 'clone'); this.render(true); return; }
    this.mouseDown = e.button;
    this.downSlot = i;
    this.dragStarted = false;
    if (!this.menu.carried) {
      this.menu.click(i, e.button);
      this.mouseDown = -1;
      this.flushDropped();
    }
    this.render(true);
  }

  private onUp(e: MouseEvent): void {
    if (this.mouseDown < 0) return;
    if (this.dragStarted) this.menu.dragEnd();
    else if (this.downSlot >= 0 && this.slotAt(e) === this.downSlot) this.menu.click(this.downSlot, this.mouseDown);
    this.mouseDown = -1;
    this.dragStarted = false;
    this.downSlot = -1;
    this.flushDropped();
    this.render(true);
  }

  onKey(e: KeyboardEvent): boolean {
    if (e.code.startsWith('Digit') && this.hovered >= 0) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= 9) { this.menu.click(this.hovered, n - 1, 'swap'); this.render(true); return true; }
    }
    if (e.code === 'KeyQ' && this.hovered >= 0) {
      this.menu.click(this.hovered, e.ctrlKey || e.metaKey ? 1 : 0, 'throw');
      this.flushDropped();
      this.render(true);
      return true;
    }
    return false;
  }

  private flushDropped(): void {
    if (this.menu.dropped.length) {
      this.onDropped?.(this.menu.dropped.splice(0));
    }
  }

  private updateTip(e: MouseEvent): void {
    const s = this.hovered >= 0 && !this.menu.carried ? this.menu.slots[this.hovered]?.item : null;
    if (!s) { this.tip.style.display = 'none'; return; }
    this.tip.innerHTML = tooltipLines(s).join('<br>');
    this.tip.style.display = 'block';
    const x = Math.min(window.innerWidth - this.tip.offsetWidth - 8, e.clientX + 16);
    this.tip.style.transform = `translate(${x}px, ${Math.max(8, e.clientY - 30)}px)`;
  }

  /** Atualiza o conteúdo dos espaços (só quando algo mudou). */
  render(force = false): void {
    const inv = this.menu.inv;
    if (!force && this.menu.version === this.lastVersion && inv.version === this.lastInvVersion) return;
    this.lastVersion = this.menu.version;
    this.lastInvVersion = inv.version;
    const drag = new Set(this.menu.dragging);
    for (const [i, el] of this.slotEls) {
      const s = this.menu.slots[i]?.item ?? null;
      const html = slotHTML(s);
      if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
      el.classList.toggle('drag', drag.has(i));
    }
    this.cursor.innerHTML = slotHTML(this.menu.carried);
    this.cursor.style.display = this.menu.carried ? 'grid' : 'none';
    this.renderExtra();
  }

  protected renderExtra(): void { /* barras de progresso etc. */ }

  update(): void { this.render(); }

  onOpen(): void { this.render(true); }

  onClose(): void {
    window.removeEventListener('mouseup', this.upHandler);
    this.menu.close();
    this.flushDropped();
    this.onClosed?.();
  }
}
