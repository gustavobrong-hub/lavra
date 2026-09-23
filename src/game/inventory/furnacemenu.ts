/** Menu da fornalha (entrada, combustível, saída) com as regras de shift-clique do original. */
import { Menu, Slot, type SlotSource } from './menu';
import type { Inventory } from './inventory';
import type { FurnaceBE } from '../blockentity/blockentities';
import { fuelTime } from '../blockentity/blockentities';
import { findSmelting } from '../crafting/recipes';
import type { ItemStack } from '../items/stack';

export class FurnaceMenu extends Menu {
  playerStart = 0;
  onTakeOutput?: (xp: number, stack: ItemStack) => void;

  constructor(inv: Inventory, readonly be: FurnaceBE, onChange: () => void) {
    super(inv);
    const src: SlotSource = { get: (i) => be.items[i], set: (i, s) => { be.items[i] = s; onChange(); } };
    this.add(new Slot(src, 0, { group: 'input' }));
    this.add(new Slot(src, 1, { group: 'fuel', mayPlace: (s) => fuelTime(s.id) > 0 || s.id === 'bucket' }));
    this.add(new Slot(src, 2, { group: 'output', result: true }));
    this.playerStart = this.addPlayerSlots();
  }

  /** Retirar da saída dá a XP acumulada. */
  protected override takeResult(slot: Slot, _toInv: boolean, drop: boolean): void {
    const r = slot.item;
    if (!r) return;
    if (drop) { this.dropped.push(r.copy()); slot.item = null; this.giveXp(r); return; }
    const c = this.carried;
    if (!c) { this.carried = r.copy(); slot.item = null; this.giveXp(r); return; }
    if (c.canStackWith(r) && c.count + r.count <= c.maxStack) { c.count += r.count; slot.item = null; this.giveXp(r); }
  }

  private giveXp(st: ItemStack): void {
    const xp = this.be.xp;
    this.be.xp = 0;
    // parte fracionária vira chance (como o original)
    let n = Math.floor(xp);
    if (Math.random() < xp - n) n++;
    this.onTakeOutput?.(n, st);
  }

  protected override quickMove(index: number): void {
    const s = this.slots[index];
    const it = s.item;
    if (!it) return;
    const pEnd = this.playerStart + 36;
    if (index === 2) {
      const copy = it.copy();
      const left = this.moveTo(copy, this.playerStart, pEnd, true);
      if (!left) { s.item = null; this.giveXp(it); } else { it.count = left.count; s.item = it; }
      return;
    }
    if (index < 3) { s.item = this.moveTo(it, this.playerStart, pEnd); return; }
    if (findSmelting(it.id, this.be.kind)) { s.item = this.moveTo(it, 0, 1); return; }
    if (fuelTime(it.id) > 0) { s.item = this.moveTo(it, 1, 2); return; }
    if (s.opts.group === 'main') s.item = this.moveTo(it, this.playerStart + 27, pEnd);
    else s.item = this.moveTo(it, this.playerStart, this.playerStart + 27);
  }
}
