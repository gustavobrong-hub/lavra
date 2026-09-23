/**
 * Menus de container com a semântica de cliques do original:
 * clique esquerdo pega/solta/troca, direito divide/solta um, shift-clique move rápido,
 * teclas 1–9 trocam com a barra, arrastar distribui (esquerdo: igual; direito: um em cada),
 * duplo clique junta tudo no cursor, Q descarta.
 */
import { ItemStack } from '../items/stack';
import type { Inventory } from './inventory';
import { craftResult, remainderOf, type CraftGrid } from '../crafting/recipes';

export interface SlotSource { get(i: number): ItemStack | null; set(i: number, s: ItemStack | null): void }

export class Slot {
  constructor(
    public readonly src: SlotSource,
    public readonly index: number,
    public readonly opts: {
      mayPlace?: (s: ItemStack) => boolean;
      max?: number;
      result?: boolean;
      /** grupo para shift-clique */
      group?: string;
      onTake?: (s: ItemStack) => void;
      onChange?: () => void;
    } = {},
  ) {}
  get item(): ItemStack | null { return this.src.get(this.index); }
  set item(s: ItemStack | null) { this.src.set(this.index, s && s.count > 0 ? s : null); this.opts.onChange?.(); }
  mayPlace(s: ItemStack): boolean { return !this.opts.result && (this.opts.mayPlace ? this.opts.mayPlace(s) : true); }
  maxFor(s: ItemStack): number { return Math.min(this.opts.max ?? 64, s.maxStack); }
}

export const arraySource = (arr: (ItemStack | null)[]): SlotSource => ({ get: (i) => arr[i] ?? null, set: (i, s) => { arr[i] = s; } });

export type ClickType = 'pickup' | 'quick' | 'swap' | 'clone' | 'throw' | 'pickupAll';

export abstract class Menu {
  readonly slots: Slot[] = [];
  carried: ItemStack | null = null;
  /** itens jogados para fora (Q ou clique fora) */
  dropped: ItemStack[] = [];
  creative = false;
  version = 0;
  private dragSlots: number[] = [];
  private dragButton = -1;

  constructor(public readonly inv: Inventory) {}

  protected add(s: Slot): number { this.slots.push(s); return this.slots.length - 1; }

  /** Adiciona os 36 espaços do jogador (27 mochila + 9 barra) e devolve o índice inicial. */
  protected addPlayerSlots(): number {
    const src: SlotSource = { get: (i) => this.inv.main[i], set: (i, s) => { this.inv.main[i] = s; this.inv.changed(); } };
    const start = this.slots.length;
    for (let i = 9; i < 36; i++) this.add(new Slot(src, i, { group: 'main' }));
    for (let i = 0; i < 9; i++) this.add(new Slot(src, i, { group: 'hotbar' }));
    return start;
  }

  changed(): void { this.version++; }

  /** Regras de shift-clique de cada menu. */
  protected abstract quickMove(index: number): void;

  /** Move a pilha para um intervalo de espaços (preenche iguais, depois vazios). Retorna o que sobrou. */
  protected moveTo(st: ItemStack, from: number, to: number, reverse = false): ItemStack | null {
    const range: number[] = [];
    for (let i = from; i < to; i++) range.push(i);
    if (reverse) range.reverse();
    for (const i of range) {
      const s = this.slots[i];
      const cur = s.item;
      if (cur && cur.canStackWith(st) && s.mayPlace(st)) {
        const n = Math.min(st.count, s.maxFor(cur) - cur.count);
        if (n > 0) { cur.count += n; st.count -= n; s.item = cur; }
        if (st.count <= 0) return null;
      }
    }
    for (const i of range) {
      const s = this.slots[i];
      if (!s.item && s.mayPlace(st)) {
        const n = Math.min(st.count, s.maxFor(st));
        s.item = st.copy(n);
        st.count -= n;
        if (st.count <= 0) return null;
      }
    }
    return st;
  }

  click(index: number, button: number, type: ClickType = 'pickup'): void {
    if (index < 0) {
      // clique fora da janela: descarta o cursor (direito: um)
      if (this.carried) {
        if (button === 1) { this.dropped.push(this.carried.copy(1)); this.carried.count--; if (this.carried.count <= 0) this.carried = null; }
        else { this.dropped.push(this.carried); this.carried = null; }
      }
      this.changed();
      return;
    }
    const slot = this.slots[index];
    if (!slot) return;
    switch (type) {
      case 'quick': this.quickMove(index); break;
      case 'swap': this.swapHotbar(index, button); break;
      case 'clone':
        if (this.creative && slot.item && !this.carried) this.carried = slot.item.copy(slot.item.maxStack);
        break;
      case 'throw': {
        const it = slot.item;
        if (!it || this.carried) break;
        if (slot.opts.result) { this.takeResult(slot, false, true); break; }
        const n = button === 1 ? it.count : 1;
        this.dropped.push(it.copy(n));
        it.count -= n;
        slot.item = it.count > 0 ? it : null;
        break;
      }
      case 'pickupAll': this.collectAll(index); break;
      default: this.pickup(slot, button);
    }
    this.onSlotsChanged();
    this.changed();
  }

  private pickup(slot: Slot, button: number): void {
    const cur = slot.item;
    const c = this.carried;
    if (slot.opts.result) { this.takeResult(slot, false, false); return; }
    if (!c) {
      if (!cur) return;
      // esquerdo pega tudo; direito pega a metade (arredonda para cima)
      const n = button === 1 ? Math.ceil(cur.count / 2) : cur.count;
      this.carried = cur.copy(n);
      cur.count -= n;
      slot.item = cur.count > 0 ? cur : null;
      slot.opts.onTake?.(this.carried);
      return;
    }
    if (!slot.mayPlace(c)) {
      // só pode pegar (ex.: espaço de armadura com item errado)
      return;
    }
    if (!cur) {
      const n = button === 1 ? 1 : Math.min(c.count, slot.maxFor(c));
      slot.item = c.copy(n);
      c.count -= n;
      if (c.count <= 0) this.carried = null;
      return;
    }
    if (cur.canStackWith(c)) {
      const room = slot.maxFor(cur) - cur.count;
      const n = Math.min(button === 1 ? 1 : c.count, room);
      if (n > 0) { cur.count += n; c.count -= n; slot.item = cur; if (c.count <= 0) this.carried = null; }
      return;
    }
    // troca
    if (c.count <= slot.maxFor(c)) {
      slot.item = c;
      this.carried = cur;
    }
  }

  private swapHotbar(index: number, hot: number): void {
    const slot = this.slots[index];
    if (slot.opts.result) {
      const hotItem = this.inv.main[hot];
      if (hotItem) return;
      const r = slot.item;
      if (!r) return;
      this.inv.main[hot] = r.copy();
      this.consumeCraft(slot);
      this.inv.changed();
      return;
    }
    const a = slot.item, b = this.inv.main[hot];
    if (b && !slot.mayPlace(b)) return;
    slot.item = b;
    this.inv.main[hot] = a;
    this.inv.changed();
  }

  private collectAll(index: number): void {
    const c = this.carried;
    if (!c) return;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.slots.length && c.count < c.maxStack; i++) {
        const s = this.slots[i];
        const it = s.item;
        if (!it || s.opts.result || !it.canStackWith(c)) continue;
        // primeiro pilhas incompletas, depois cheias
        if (pass === 0 && it.count === it.maxStack) continue;
        const n = Math.min(it.count, c.maxStack - c.count);
        it.count -= n; c.count += n;
        s.item = it.count > 0 ? it : null;
      }
    }
    void index;
  }

  /** Pega do espaço de resultado (crafting/fornalha). */
  protected takeResult(slot: Slot, toInventory: boolean, drop: boolean): void {
    const r = slot.item;
    if (!r) return;
    if (drop) { this.dropped.push(r.copy()); this.consumeCraft(slot); return; }
    if (toInventory) return;
    const c = this.carried;
    if (!c) { this.carried = r.copy(); this.consumeCraft(slot); return; }
    if (c.canStackWith(r) && c.count + r.count <= c.maxStack) { c.count += r.count; this.consumeCraft(slot); }
  }

  /** Consome os ingredientes ao retirar o resultado (sobrescrito pelos menus de crafting). */
  protected consumeCraft(slot: Slot): void { slot.item = null; slot.opts.onTake?.(slot.item as never); }

  /** Chamado depois de qualquer mudança (recalcula o crafting). */
  protected onSlotsChanged(): void { /* por menu */ }

  // ------------------------------------------------------------ arrastar
  dragStart(button: number): void { this.dragSlots = []; this.dragButton = button; }
  dragOver(index: number): void {
    const c = this.carried;
    if (this.dragButton < 0 || !c || this.dragSlots.includes(index)) return;
    const s = this.slots[index];
    if (!s || s.opts.result || !s.mayPlace(c)) return;
    const cur = s.item;
    if (cur && !cur.canStackWith(c)) return;
    if (this.dragSlots.length >= c.count && this.dragButton === 0) return;
    this.dragSlots.push(index);
  }
  dragEnd(): void {
    const c = this.carried;
    const list = this.dragSlots;
    const button = this.dragButton;
    this.dragButton = -1;
    this.dragSlots = [];
    if (!c || list.length === 0) return;
    if (list.length === 1) { this.click(list[0], button); return; }
    const each = button === 1 ? 1 : button === 2 && this.creative ? c.maxStack : Math.floor(c.count / list.length);
    for (const i of list) {
      const s = this.slots[i];
      const cur = s.item;
      const base = cur ? cur.count : 0;
      const max = s.maxFor(c);
      const n = Math.min(each, max - base, button === 2 && this.creative ? max : c.count);
      if (n <= 0) continue;
      s.item = cur ? (cur.count += n, cur) : c.copy(n);
      if (!(button === 2 && this.creative)) c.count -= n;
    }
    if (c.count <= 0) this.carried = null;
    this.onSlotsChanged();
    this.changed();
  }
  get dragging(): number[] { return this.dragSlots; }

  /** Fecha: devolve o cursor e grades temporárias ao inventário (ou ao chão). */
  close(): void {
    if (this.carried) {
      const left = this.inv.add(this.carried);
      if (left > 0) this.dropped.push(this.carried.copy(left));
      this.carried = null;
    }
  }
}

// ------------------------------------------------------------ crafting (2×2 e 3×3)
export class CraftingGridMenu extends Menu {
  readonly grid: (ItemStack | null)[];
  readonly result: (ItemStack | null)[] = [null];
  resultIndex = 0;
  gridStart = 0;
  playerStart = 0;
  onCraft?: (s: ItemStack) => void;

  constructor(inv: Inventory, readonly size: 2 | 3, withArmor = false) {
    super(inv);
    this.grid = new Array(size * size).fill(null);
    this.resultIndex = this.add(new Slot(arraySource(this.result), 0, { result: true }));
    const gs = arraySource(this.grid);
    this.gridStart = this.slots.length;
    for (let i = 0; i < size * size; i++) this.add(new Slot(gs, i, { group: 'grid' }));
    if (withArmor) this.addArmorSlots();
    this.playerStart = this.addPlayerSlots();
    if (withArmor) this.addOffhand();
  }

  armorStart = -1;
  offhandIndex = -1;
  private addArmorSlots(): void {
    const inv = this.inv;
    const src: SlotSource = { get: (i) => inv.armor[i], set: (i, s) => { inv.armor[i] = s; inv.changed(); } };
    this.armorStart = this.slots.length;
    // ordem visual: cabeça, peito, pernas, pés (índices 3,2,1,0)
    const slotName = ['feet', 'legs', 'chest', 'head'];
    for (const i of [3, 2, 1, 0]) this.add(new Slot(src, i, { max: 1, group: 'armor', mayPlace: (s) => s.def.armor?.slot === slotName[i] || (i === 3 && (s.id === 'carved_pumpkin')) }));
  }
  private addOffhand(): void {
    const inv = this.inv;
    this.offhandIndex = this.add(new Slot({ get: () => inv.offhand, set: (_i, s) => { inv.offhand = s; inv.changed(); } }, 0, { group: 'offhand' }));
  }

  get craftGrid(): CraftGrid { return { w: this.size, h: this.size, items: this.grid }; }

  protected override onSlotsChanged(): void {
    const r = craftResult(this.craftGrid);
    this.result[0] = r ? r.stack : null;
  }

  protected override consumeCraft(slot: Slot): void {
    const made = this.result[0];
    for (let i = 0; i < this.grid.length; i++) {
      const g = this.grid[i];
      if (!g) continue;
      const rem = remainderOf(g.id);
      g.count--;
      if (g.count <= 0) this.grid[i] = rem ? new ItemStack(rem) : null;
      else if (rem) { const left = this.inv.add(new ItemStack(rem)); if (left) this.dropped.push(new ItemStack(rem, left)); }
    }
    if (made) this.onCraft?.(made);
    void slot;
    this.onSlotsChanged();
  }

  protected override quickMove(index: number): void {
    const s = this.slots[index];
    const it = s.item;
    if (!it) return;
    const pEnd = this.playerStart + 36;
    if (index === this.resultIndex) {
      // fabrica o máximo possível
      for (let n = 0; n < 64; n++) {
        const r = this.result[0];
        if (!r) break;
        const copy = r.copy();
        const left = this.moveTo(copy, this.playerStart, pEnd, true);
        if (left) break;
        this.consumeCraft(s);
        if (!this.result[0] || !this.result[0].sameKind(r)) break;
      }
      return;
    }
    if (index >= this.gridStart && index < this.gridStart + this.grid.length) {
      s.item = this.moveTo(it, this.playerStart, pEnd);
      return;
    }
    if (s.opts.group === 'armor' || s.opts.group === 'offhand') {
      s.item = this.moveTo(it, this.playerStart, pEnd);
      return;
    }
    // do inventário: armadura primeiro, depois alterna mochila ↔ barra
    if (it.def.armor && this.armorStart >= 0) {
      const target = this.armorStart + [3, 2, 1, 0].indexOf(['feet', 'legs', 'chest', 'head'].indexOf(it.def.armor.slot));
      const ts = this.slots[target];
      if (!ts.item) { ts.item = it.copy(1); it.count--; s.item = it.count > 0 ? it : null; return; }
    }
    if (it.id === 'shield' && this.offhandIndex >= 0 && !this.slots[this.offhandIndex].item) {
      this.slots[this.offhandIndex].item = it; s.item = null; return;
    }
    if (s.opts.group === 'main') s.item = this.moveTo(it, this.playerStart + 27, pEnd);
    else s.item = this.moveTo(it, this.playerStart, this.playerStart + 27);
  }

  override close(): void {
    for (let i = 0; i < this.grid.length; i++) {
      const g = this.grid[i];
      if (!g) continue;
      const left = this.inv.add(g);
      if (left > 0) this.dropped.push(g.copy(left));
      this.grid[i] = null;
    }
    this.result[0] = null;
    super.close();
  }
}

/** Baú (27 ou 54 espaços) e outros containers simples. */
export class ChestMenu extends Menu {
  readonly containerSlots: number;
  playerStart = 0;
  constructor(inv: Inventory, readonly items: (ItemStack | null)[], rows = 3, readonly onChange?: () => void) {
    super(inv);
    this.containerSlots = rows * 9;
    const src: SlotSource = { get: (i) => items[i] ?? null, set: (i, s) => { items[i] = s; onChange?.(); } };
    for (let i = 0; i < this.containerSlots; i++) this.add(new Slot(src, i, { group: 'container' }));
    this.playerStart = this.addPlayerSlots();
  }
  protected override quickMove(index: number): void {
    const s = this.slots[index];
    const it = s.item;
    if (!it) return;
    if (index < this.containerSlots) s.item = this.moveTo(it, this.playerStart, this.playerStart + 36, true);
    else s.item = this.moveTo(it, 0, this.containerSlots);
  }
}
