/**
 * Pontos de interesse (PoiManager do original): camas (cabeceira), sinos e blocos de trabalho.
 * Registrados ao carregar chunks (varredura rápida por tabela de ids) e ao colocar/quebrar blocos;
 * aldeões "reivindicam" um de cada tipo.
 */
import { BLOCKS, BLOCK_OF, STATE_PROPS } from '../../world/blocks';
import type { Chunk } from '../../world/chunk';
import { MIN_Y } from '../../core/constants';

export const JOB_SITES: Record<string, string> = {
  composter: 'fazendeiro', barrel: 'pescador', loom: 'pastor', fletching_table: 'flecheiro', cartography_table: 'cartografo',
  brewing_stand: 'clerigo', blast_furnace: 'armeiro', smithing_table: 'ferramenteiro', grindstone: 'espadeiro',
  smoker: 'acougueiro', cauldron: 'curtidor', lectern: 'bibliotecario', stonecutter: 'pedreiro',
};

export type PoiType = 'bed' | 'bell' | 'job' | 'sensor';
export interface Poi { type: PoiType; x: number; y: number; z: number; job?: string; claimedBy: number }

let KIND: Uint8Array | null = null; // 0 nada, 1 cama, 2 sino, 3 trabalho, 4 sensor de luz
function kindTable(): Uint8Array {
  if (KIND) return KIND;
  KIND = new Uint8Array(BLOCKS.length);
  for (const b of BLOCKS) {
    if (b.name.endsWith('_bed')) KIND[b.id] = 1;
    else if (b.name === 'bell') KIND[b.id] = 2;
    else if (JOB_SITES[b.name]) KIND[b.id] = 3;
    else if (b.name === 'daylight_detector') KIND[b.id] = 4;
  }
  return KIND;
}

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

export class PoiManager {
  readonly pois = new Map<string, Poi>();
  private readonly byChunk = new Map<string, Set<string>>();

  private add(type: PoiType, x: number, y: number, z: number, job?: string): void {
    const k = key(x, y, z);
    if (this.pois.has(k)) return;
    this.pois.set(k, { type, x, y, z, job, claimedBy: 0 });
    const ck = `${x >> 4},${z >> 4}`;
    let s = this.byChunk.get(ck);
    if (!s) { s = new Set(); this.byChunk.set(ck, s); }
    s.add(k);
  }

  remove(x: number, y: number, z: number): void {
    const k = key(x, y, z);
    if (!this.pois.delete(k)) return;
    this.byChunk.get(`${x >> 4},${z >> 4}`)?.delete(k);
  }

  /** Estado novo num bloco (colocado/quebrado). */
  onBlock(x: number, y: number, z: number, state: number): void {
    const t = kindTable()[BLOCK_OF[state]];
    if (!t) { this.remove(x, y, z); return; }
    const name = BLOCKS[BLOCK_OF[state]].name;
    if (t === 1) { if (STATE_PROPS[state].part === 'head') this.add('bed', x, y, z); }
    else if (t === 2) this.add('bell', x, y, z);
    else if (t === 4) this.add('sensor', x, y, z);
    else this.add('job', x, y, z, JOB_SITES[name]);
  }

  /** Varre um chunk recém-carregado. */
  scanChunk(c: Chunk): void {
    const tab = kindTable();
    for (let sy = 0; sy < c.sections.length; sy++) {
      const s = c.sections[sy];
      if (!s) continue;
      const b = s.blocks;
      for (let i = 0; i < 4096; i++) {
        const st = b[i];
        if (st === 0 || !tab[BLOCK_OF[st]]) continue;
        const x = c.cx * 16 + (i & 15), z = c.cz * 16 + ((i >> 4) & 15), y = MIN_Y + sy * 16 + (i >> 8);
        this.onBlock(x, y, z, st);
      }
    }
  }

  unloadChunk(cx: number, cz: number): void {
    const s = this.byChunk.get(`${cx},${cz}`);
    if (!s) return;
    for (const k of s) this.pois.delete(k);
    this.byChunk.delete(`${cx},${cz}`);
  }

  get(x: number, y: number, z: number): Poi | undefined { return this.pois.get(key(x, y, z)); }

  /** Mais próximo que passa no filtro, dentro do raio. */
  nearest(x: number, y: number, z: number, r: number, f: (p: Poi) => boolean): Poi | null {
    let best: Poi | null = null, bd = r * r;
    const c0x = Math.floor((x - r) / 16), c1x = Math.floor((x + r) / 16), c0z = Math.floor((z - r) / 16), c1z = Math.floor((z + r) / 16);
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const s = this.byChunk.get(`${cx},${cz}`);
      if (!s) continue;
      for (const k of s) {
        const p = this.pois.get(k)!;
        if (!f(p)) continue;
        const d = (p.x + 0.5 - x) ** 2 + (p.y - y) ** 2 + (p.z + 0.5 - z) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
    }
    return best;
  }

  count(x: number, y: number, z: number, r: number, f: (p: Poi) => boolean): number {
    let n = 0;
    for (const p of this.pois.values()) if (f(p) && (p.x - x) ** 2 + (p.z - z) ** 2 <= r * r && Math.abs(p.y - y) < r) n++;
    return n;
  }

  release(id: number): void { for (const p of this.pois.values()) if (p.claimedBy === id) p.claimedBy = 0; }
}
