/**
 * Menu de comércio (MerchantMenu do original): 2 espaços de pagamento, 1 de resultado. Escolher uma oferta
 * puxa os itens do inventário para o pagamento; retirar o resultado consome o preço, conta um uso e dá XP.
 * Shift-clique no resultado repete a troca enquanto houver pagamento e espaço.
 */
import { Menu, Slot, type SlotSource } from './menu';
import type { Inventory } from './inventory';
import type { ItemStack } from '../items/stack';
import { priceOf, type Offer } from '../village/trades';

export interface Merchant {
  offers: Offer[];
  onTrade(o: Offer): void;
  tradingPlayer: unknown;
}

export class MerchantMenu extends Menu {
  readonly pay: (ItemStack | null)[] = [null, null];
  readonly out: (ItemStack | null)[] = [null];
  playerStart = 0;
  selected = -1;
  private active: Offer | null = null;

  constructor(inv: Inventory, readonly merchant: Merchant) {
    super(inv);
    const src: SlotSource = { get: (i) => this.pay[i], set: (i, s) => { this.pay[i] = s; } };
    const res: SlotSource = { get: () => this.out[0], set: (_i, s) => { this.out[0] = s; } };
    this.add(new Slot(src, 0, { group: 'pay' }));
    this.add(new Slot(src, 1, { group: 'pay' }));
    this.add(new Slot(res, 0, { result: true, group: 'result' }));
    this.playerStart = this.addPlayerSlots();
    this.onSlotsChanged();
  }

  /** A oferta aceita o pagamento (a, b)? */
  static satisfied(o: Offer, a: ItemStack | null, b: ItemStack | null): boolean {
    if (o.uses >= o.maxUses) return false;
    const need = priceOf(o);
    const okA = !!a && a.id === o.a.id && a.count >= need && sameTag(a, o.a);
    if (!okA) return false;
    if (o.b) return !!b && b.id === o.b.id && b.count >= o.b.count;
    return true;
  }

  protected override onSlotsChanged(): void {
    const [a, b] = this.pay;
    let found: Offer | null = null;
    const offers = this.merchant.offers;
    if (this.selected >= 0 && offers[this.selected] && MerchantMenu.satisfied(offers[this.selected], a, b)) found = offers[this.selected];
    else found = offers.find((o) => MerchantMenu.satisfied(o, a, b) || (!o.b && MerchantMenu.satisfied(o, b, null))) ?? null;
    this.active = found;
    this.out[0] = found ? found.out.copy() : null;
  }

  /** Escolhe a oferta: devolve o pagamento ao inventário e puxa os itens necessários. */
  selectOffer(i: number): void {
    const o = this.merchant.offers[i];
    if (!o) return;
    this.selected = i;
    for (let k = 0; k < 2; k++) {
      const s = this.pay[k];
      if (s) { const left = this.inv.add(s); this.pay[k] = left > 0 ? s.copy(left) : null; }
    }
    const pull = (want: ItemStack, count: number): ItemStack | null => {
      let got = 0;
      const out = want.copy(0);
      for (let j = 0; j < this.inv.main.length && got < count; j++) {
        const s = this.inv.main[j];
        if (!s || s.id !== want.id || !sameTag(s, want)) continue;
        const n = Math.min(s.count, count - got, want.maxStack - got);
        s.count -= n; got += n;
        if (s.count <= 0) this.inv.main[j] = null;
      }
      out.count = got;
      return got > 0 ? out : null;
    };
    if (!this.pay[0]) this.pay[0] = pull(o.a, o.a.maxStack);
    if (o.b && !this.pay[1]) this.pay[1] = pull(o.b, o.b.maxStack);
    this.inv.changed();
    this.refresh();
  }

  /** Retirar o resultado = fazer a troca. */
  protected override consumeCraft(slot: Slot): void {
    const o = this.active;
    if (!o) { slot.item = null; return; }
    const need = priceOf(o);
    const [a, b] = this.pay;
    // pagamento pode estar invertido quando a oferta tem um só item
    if (a && a.id === o.a.id && a.count >= need) { a.count -= need; if (a.count <= 0) this.pay[0] = null; }
    else if (b && b.id === o.a.id && b.count >= need) { b.count -= need; if (b.count <= 0) this.pay[1] = null; }
    if (o.b) { const p1 = this.pay[1]; if (p1 && p1.id === o.b.id) { p1.count -= o.b.count; if (p1.count <= 0) this.pay[1] = null; } }
    this.merchant.onTrade(o);
    this.onSlotsChanged();
  }

  protected override quickMove(index: number): void {
    const s = this.slots[index];
    const it = s.item;
    if (!it) return;
    const pEnd = this.playerStart + 36;
    if (index === 2) {
      // repete a troca enquanto couber
      for (let n = 0; n < 64 && this.active && this.out[0]; n++) {
        const r = this.out[0].copy();
        const left = this.moveTo(r, this.playerStart, pEnd, true);
        if (left) break;
        this.consumeCraft(s);
      }
      this.refresh();
      return;
    }
    if (index < 2) { s.item = this.moveTo(it, this.playerStart, pEnd); this.refresh(); return; }
    s.item = this.moveTo(it, 0, 2);
    this.refresh();
  }

  override close(): void {
    for (let k = 0; k < 2; k++) {
      const s = this.pay[k];
      if (!s) continue;
      const left = this.inv.add(s);
      if (left > 0) this.dropped.push(s.copy(left));
      this.pay[k] = null;
    }
    this.merchant.tradingPlayer = null;
    super.close();
  }
}

function sameTag(a: ItemStack, b: ItemStack): boolean {
  if (!b.tag) return true;
  return JSON.stringify(a.tag ?? null) === JSON.stringify(b.tag);
}
