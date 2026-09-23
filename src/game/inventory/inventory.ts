/**
 * Inventário do jogador: 36 espaços (0–8 barra rápida, 9–35 mochila), 4 de armadura e 1 da mão secundária.
 * Regras de adicionar iguais às do original: completa pilhas existentes (barra primeiro) e depois ocupa vazios.
 */
import { ItemStack } from '../items/stack';

export type Slot = ItemStack | null;

export class Inventory {
  readonly main: Slot[] = new Array(36).fill(null);
  /** 0 pés, 1 pernas, 2 peito, 3 cabeça (ordem do original) */
  readonly armor: Slot[] = new Array(4).fill(null);
  offhand: Slot = null;
  selected = 0;
  /** incrementa a cada mudança (para a interface redesenhar) */
  version = 0;

  get held(): Slot { return this.main[this.selected]; }
  set held(s: Slot) { this.main[this.selected] = s; this.changed(); }

  changed(): void { this.version++; }

  /** Adiciona; retorna o que sobrou (0 se coube tudo). */
  add(st: ItemStack): number {
    let left = st.count;
    const max = st.maxStack;
    const order = [...Array(36).keys()];
    // completa pilhas existentes: mão secundária? não — barra e mochila
    for (const i of order) {
      const s = this.main[i];
      if (left > 0 && s && s.canStackWith(st) && s.count < max) {
        const n = Math.min(left, max - s.count);
        s.count += n;
        left -= n;
      }
    }
    for (const i of order) {
      if (left <= 0) break;
      if (!this.main[i]) {
        const n = Math.min(left, max);
        this.main[i] = st.copy(n);
        left -= n;
      }
    }
    if (left !== st.count) this.changed();
    return left;
  }

  /** Quantidade total de um item. */
  count(id: string): number {
    let n = 0;
    for (const s of this.main) if (s?.id === id) n += s.count;
    if (this.offhand?.id === id) n += this.offhand.count;
    return n;
  }

  /** Remove `n` unidades (retorna quantas removeu). */
  remove(id: string, n: number): number {
    let removed = 0;
    for (let i = 0; i < 36 && removed < n; i++) {
      const s = this.main[i];
      if (s?.id !== id) continue;
      const k = Math.min(n - removed, s.count);
      s.count -= k;
      removed += k;
      if (s.count <= 0) this.main[i] = null;
    }
    if (removed) this.changed();
    return removed;
  }

  findSlot(id: string): number {
    return this.main.findIndex((s) => s?.id === id);
  }

  /** Consome 1 do item em mãos. */
  consumeHeld(n = 1): void {
    const s = this.held;
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.main[this.selected] = null;
    this.changed();
  }

  /** Desgasta o item em mãos; retorna true se quebrou. */
  damageHeld(amount: number, unbreaking = 0, rnd = Math.random): boolean {
    const s = this.held;
    if (!s || !s.damageable) return false;
    for (let i = 0; i < amount; i++) {
      // Inquebrável: chance 1/(nível+1) de gastar
      if (unbreaking > 0 && rnd() >= 1 / (unbreaking + 1)) continue;
      s.damage++;
    }
    this.changed();
    if (s.damage >= s.maxDamage) { this.main[this.selected] = null; return true; }
    return false;
  }

  armorValue(): { armor: number; toughness: number; kb: number } {
    let armor = 0, toughness = 0, kb = 0;
    for (const s of this.armor) {
      const a = s?.def.armor;
      if (!a) continue;
      armor += a.defense; toughness += a.toughness; kb += a.knockback;
    }
    return { armor, toughness, kb };
  }

  clear(): void {
    this.main.fill(null);
    this.armor.fill(null);
    this.offhand = null;
    this.changed();
  }

  toJSON(): object {
    return {
      main: this.main.map((s) => s?.toJSON() ?? null),
      armor: this.armor.map((s) => s?.toJSON() ?? null),
      offhand: this.offhand?.toJSON() ?? null,
      selected: this.selected,
    };
  }

  load(o: { main?: unknown[]; armor?: unknown[]; offhand?: unknown; selected?: number }): void {
    this.clear();
    (o.main ?? []).forEach((s, i) => { if (i < 36) this.main[i] = ItemStack.fromJSON(s as never); });
    (o.armor ?? []).forEach((s, i) => { if (i < 4) this.armor[i] = ItemStack.fromJSON(s as never); });
    this.offhand = ItemStack.fromJSON((o.offhand ?? null) as never);
    this.selected = o.selected ?? 0;
    this.changed();
  }
}
