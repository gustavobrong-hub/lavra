/** Lista de entidades de uma dimensão, com consultas espaciais simples (grade por chunk). */
import type { AABB } from '../../core/aabb';
import type { Entity } from './entity';

export class EntityManager {
  readonly list: Entity[] = [];
  readonly byId = new Map<number, Entity>();
  private readonly grid = new Map<number, Set<Entity>>();
  private readonly cellOf = new Map<number, number>();
  onAdded?: (e: Entity) => void;
  onRemoved?: (e: Entity) => void;

  private static cell(x: number, z: number): number {
    return (Math.floor(x / 16) + 32768) * 65536 + (Math.floor(z / 16) + 32768);
  }

  add(e: Entity): Entity {
    if (this.byId.has(e.id)) return e;
    this.list.push(e);
    this.byId.set(e.id, e);
    this.index(e);
    this.onAdded?.(e);
    return e;
  }

  remove(e: Entity): void {
    if (!this.byId.has(e.id)) return;
    this.byId.delete(e.id);
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
    const c = this.cellOf.get(e.id);
    if (c !== undefined) this.grid.get(c)?.delete(e);
    this.cellOf.delete(e.id);
    this.onRemoved?.(e);
  }

  private index(e: Entity): void {
    const c = EntityManager.cell(e.x, e.z);
    const old = this.cellOf.get(e.id);
    if (old === c) return;
    if (old !== undefined) this.grid.get(old)?.delete(e);
    let set = this.grid.get(c);
    if (!set) { set = new Set(); this.grid.set(c, set); }
    set.add(e);
    this.cellOf.set(e.id, c);
  }

  /** Atualiza todas; remove as marcadas como removidas. */
  tick(filter?: (e: Entity) => boolean): void {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.removed) continue;
      if (filter && !filter(e)) continue;
      e.tick();
      this.index(e);
    }
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].removed) this.remove(this.list[i]);
  }

  /** Entidades cuja caixa toca `box`. */
  inBox(box: AABB, filter?: (e: Entity) => boolean): Entity[] {
    const out: Entity[] = [];
    const cx0 = Math.floor(box.minX / 16) - 1, cx1 = Math.floor(box.maxX / 16) + 1;
    const cz0 = Math.floor(box.minZ / 16) - 1, cz1 = Math.floor(box.maxZ / 16) + 1;
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const set = this.grid.get((cx + 32768) * 65536 + (cz + 32768));
      if (!set) continue;
      for (const e of set) if (!e.removed && e.bb.intersects(box) && (!filter || filter(e))) out.push(e);
    }
    return out;
  }

  near(x: number, y: number, z: number, r: number, filter?: (e: Entity) => boolean): Entity[] {
    const out: Entity[] = [];
    const r2 = r * r;
    const cx0 = Math.floor((x - r) / 16), cx1 = Math.floor((x + r) / 16);
    const cz0 = Math.floor((z - r) / 16), cz1 = Math.floor((z + r) / 16);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const set = this.grid.get((cx + 32768) * 65536 + (cz + 32768));
      if (!set) continue;
      for (const e of set) if (!e.removed && e.distanceSq(x, y, z) <= r2 && (!filter || filter(e))) out.push(e);
    }
    return out;
  }

  count(type: string): number {
    let n = 0;
    for (const e of this.list) if (e.type === type && !e.removed) n++;
    return n;
  }

  clear(): void {
    for (const e of [...this.list]) this.remove(e);
  }
}
