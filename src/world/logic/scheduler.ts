/** Ticks agendados de blocos (fluidos, fulgor, gravidade), com deduplicação por posição+bloco. */

interface Entry { t: number; seq: number; x: number; y: number; z: number; block: number; priority: number }

export class TickScheduler {
  private heap: Entry[] = [];
  private readonly keys = new Set<string>();
  private seq = 0;

  private static key(x: number, y: number, z: number, block: number): string { return `${x},${y},${z},${block}`; }

  isScheduled(x: number, y: number, z: number, block: number): boolean {
    return this.keys.has(TickScheduler.key(x, y, z, block));
  }

  schedule(now: number, x: number, y: number, z: number, block: number, delay: number, priority = 0): void {
    const k = TickScheduler.key(x, y, z, block);
    if (this.keys.has(k)) return;
    this.keys.add(k);
    this.push({ t: now + Math.max(1, delay), seq: this.seq++, x, y, z, block, priority });
  }

  /** Remove e devolve os ticks vencidos (no máximo `max`). */
  due(now: number, max = 65536): Entry[] {
    const out: Entry[] = [];
    while (this.heap.length && this.heap[0].t <= now && out.length < max) {
      const e = this.pop()!;
      this.keys.delete(TickScheduler.key(e.x, e.y, e.z, e.block));
      out.push(e);
    }
    return out;
  }

  get size(): number { return this.heap.length; }

  /** Para salvar: ticks pendentes dentro de uma coluna. */
  inColumn(cx: number, cz: number): Entry[] {
    return this.heap.filter((e) => e.x >> 4 === cx && e.z >> 4 === cz);
  }

  dropColumn(cx: number, cz: number): void {
    const keep = this.heap.filter((e) => !(e.x >> 4 === cx && e.z >> 4 === cz));
    if (keep.length === this.heap.length) return;
    for (const e of this.heap) if (e.x >> 4 === cx && e.z >> 4 === cz) this.keys.delete(TickScheduler.key(e.x, e.y, e.z, e.block));
    this.heap = [];
    for (const e of keep) this.push(e);
  }

  private less(a: Entry, b: Entry): boolean {
    return a.t < b.t || (a.t === b.t && (a.priority < b.priority || (a.priority === b.priority && a.seq < b.seq)));
  }

  private push(e: Entry): void {
    const h = this.heap;
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }

  private pop(): Entry | undefined {
    const h = this.heap;
    if (!h.length) return undefined;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l], h[m])) m = l;
        if (r < h.length && this.less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}
