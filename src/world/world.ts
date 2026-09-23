/**
 * Mundo (uma dimensão) na thread principal: mapa de chunks, leitura/escrita de blocos e luz,
 * heightmap, marcação de seções sujas para refazer malha e ganchos de atualização de vizinhos.
 */
import { MAX_Y, MIN_Y, SECTION_COUNT } from '../core/constants';
import { colKey } from '../core/math';
import { LIGHT_OPACITY } from './blocks/registry';
import { Chunk, FULL_SKY } from './chunk';
import { LightEngine } from './light/lightengine';

export type BlockChangeListener = (x: number, y: number, z: number, oldState: number, newState: number) => void;

/** chave de seção: coluna * 32 + índice da seção */
export const sectionKey = (cx: number, sy: number, cz: number): number => colKey(cx, cz) * 32 + sy;

export const SET_LIGHT = 1;
export const SET_NOTIFY = 2;
export const SET_DEFAULT = SET_LIGHT | SET_NOTIFY;

export class World {
  readonly chunks = new Map<number, Chunk>();
  readonly light: LightEngine;
  /** seções que precisam de nova malha */
  readonly dirtySections = new Set<number>();
  private readonly listeners: BlockChangeListener[] = [];
  private lastKey = NaN;
  private lastChunk: Chunk | undefined;

  constructor(public readonly dim: number, public readonly seed: number) {
    this.light = new LightEngine(this);
  }

  onBlockChange(l: BlockChangeListener): void {
    this.listeners.push(l);
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    const k = colKey(cx, cz);
    if (k === this.lastKey) return this.lastChunk;
    const c = this.chunks.get(k);
    this.lastKey = k;
    this.lastChunk = c;
    return c;
  }

  isLoaded(x: number, z: number): boolean {
    return this.getChunk(x >> 4, z >> 4) !== undefined;
  }

  addChunk(c: Chunk): void {
    this.chunks.set(colKey(c.cx, c.cz), c);
    this.lastKey = NaN;
    this.light.invalidateCache();
    this.light.integrateChunk(c);
  }

  removeChunk(cx: number, cz: number): Chunk | undefined {
    const k = colKey(cx, cz);
    const c = this.chunks.get(k);
    if (c) {
      this.chunks.delete(k);
      this.lastKey = NaN;
      this.light.invalidateCache();
      for (let sy = 0; sy < SECTION_COUNT; sy++) this.dirtySections.delete(sectionKey(cx, sy, cz));
    }
    return c;
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < MIN_Y || y >= MAX_Y) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return 0;
    const s = c.sections[(y - MIN_Y) >> 4];
    return s ? s.blocks[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] : 0;
  }

  /** luz bruta (céu<<4 | bloco); fora do mundo: céu cheio acima, escuro abaixo */
  getLightRaw(x: number, y: number, z: number): number {
    if (y >= MAX_Y) return FULL_SKY;
    if (y < MIN_Y) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return FULL_SKY;
    const s = c.sections[(y - MIN_Y) >> 4];
    return s ? s.light[((y & 15) << 8) | ((z & 15) << 4) | (x & 15)] : FULL_SKY;
  }

  getSkyLight(x: number, y: number, z: number): number { return this.getLightRaw(x, y, z) >> 4; }
  getBlockLight(x: number, y: number, z: number): number { return this.getLightRaw(x, y, z) & 15; }

  /** Luz combinada como o original: max(bloco, céu − escurecimento do céu). */
  getBrightness(x: number, y: number, z: number, skyDarken: number): number {
    const r = this.getLightRaw(x, y, z);
    return Math.max(r & 15, (r >> 4) - skyDarken);
  }

  heightAt(x: number, z: number): number {
    const c = this.getChunk(x >> 4, z >> 4);
    return c ? c.heightmap[((z & 15) << 4) | (x & 15)] : MIN_Y;
  }

  /** Coloca um bloco. Atualiza heightmap, luz, malhas e avisa os ouvintes. */
  setBlock(x: number, y: number, z: number, state: number, flags = SET_DEFAULT): boolean {
    if (y < MIN_Y || y >= MAX_Y) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return false;
    const lx = x & 15, lz = z & 15;
    const old = c.setBlockRaw(lx, y, lz, state);
    if (old === state) return false;
    c.dirty = true;
    // heightmap
    const hi = (lz << 4) | lx;
    const h = c.heightmap[hi];
    if (LIGHT_OPACITY[state] > 0 && y >= h) c.heightmap[hi] = y + 1;
    else if (LIGHT_OPACITY[state] === 0 && y + 1 === h) {
      let ny = y - 1;
      while (ny >= MIN_Y && LIGHT_OPACITY[c.getBlock(lx, ny, lz)] === 0) ny--;
      c.heightmap[hi] = ny + 1;
    }
    this.markDirtyAt(x, y, z);
    if (flags & SET_LIGHT) this.light.onBlockChanged(x, y, z, old, state);
    if (flags & SET_NOTIFY) for (const l of this.listeners) l(x, y, z, old, state);
    return true;
  }

  /** Marca a seção de (x,y,z) e as vizinhas cuja borda de 1 bloco inclui a célula. */
  markDirtyAt(x: number, y: number, z: number): void {
    const cx = x >> 4, cz = z >> 4, sy = (y - MIN_Y) >> 4;
    const lx = x & 15, ly = (y - MIN_Y) & 15, lz = z & 15;
    const x0 = lx === 0 ? -1 : 0, x1 = lx === 15 ? 1 : 0;
    const y0 = ly === 0 ? -1 : 0, y1 = ly === 15 ? 1 : 0;
    const z0 = lz === 0 ? -1 : 0, z1 = lz === 15 ? 1 : 0;
    for (let dx = x0; dx <= x1; dx++) {
      for (let dz = z0; dz <= z1; dz++) {
        for (let dy = y0; dy <= y1; dy++) {
          const s = sy + dy;
          if (s < 0 || s >= SECTION_COUNT) continue;
          this.dirtySections.add(sectionKey(cx + dx, s, cz + dz));
        }
      }
    }
  }

  markSectionDirty(cx: number, sy: number, cz: number): void {
    if (sy >= 0 && sy < SECTION_COUNT) this.dirtySections.add(sectionKey(cx, sy, cz));
  }
}
