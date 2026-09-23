/** Pilha de itens (id, quantidade, desgaste e dados extras como encantamentos, nome, poção). */
import { item, itemOrThrow } from './registry';
import type { ItemDef } from './types';

export interface ItemTag {
  name?: string;
  enchants?: Record<string, number>;
  /** encantamentos guardados (livro encantado) */
  stored?: Record<string, number>;
  potion?: string;
  color?: number;
  repairCost?: number;
  /** id do mapa */
  map?: number;
  /** texto do livro/placa */
  pages?: string[];
  [k: string]: unknown;
}

export class ItemStack {
  constructor(public id: string, public count = 1, public damage = 0, public tag?: ItemTag) {}

  get def(): ItemDef { return itemOrThrow(this.id); }
  get maxStack(): number { return item(this.id)?.maxStack ?? 64; }
  get maxDamage(): number { return item(this.id)?.maxDamage ?? 0; }
  get damageable(): boolean { return this.maxDamage > 0; }

  copy(count = this.count): ItemStack {
    return new ItemStack(this.id, count, this.damage, this.tag ? structuredClone(this.tag) : undefined);
  }

  /** Mesma "espécie" de item (pode empilhar). */
  sameKind(o: ItemStack | null | undefined): boolean {
    if (!o) return false;
    if (o.id !== this.id || o.damage !== this.damage) return false;
    return JSON.stringify(this.tag ?? null) === JSON.stringify(o.tag ?? null);
  }

  canStackWith(o: ItemStack | null | undefined): boolean {
    return !!o && this.maxStack > 1 && this.sameKind(o);
  }

  enchantLevel(id: string): number { return this.tag?.enchants?.[id] ?? 0; }
  get label(): string { return this.tag?.name ?? item(this.id)?.label ?? this.id; }

  toJSON(): object { return { id: this.id, n: this.count, d: this.damage || undefined, t: this.tag }; }
  static fromJSON(o: { id: string; n: number; d?: number; t?: ItemTag } | null): ItemStack | null {
    if (!o || !item(o.id)) return null;
    return new ItemStack(o.id, o.n, o.d ?? 0, o.t);
  }
}

export const stack = (id: string, count = 1): ItemStack => new ItemStack(id, count);
