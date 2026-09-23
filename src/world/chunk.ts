import { MIN_Y, SECTION_COUNT } from '../core/constants';

export const FULL_SKY = 0xf0;

export class Section {
  readonly blocks: Uint16Array;
  readonly light: Uint8Array;
  /** blocos que não são ar */
  count = 0;

  constructor(blocks?: Uint16Array, light?: Uint8Array) {
    this.blocks = blocks ?? new Uint16Array(4096);
    this.light = light ?? new Uint8Array(4096).fill(FULL_SKY);
    if (blocks) this.recount();
  }

  recount(): void {
    let c = 0;
    const b = this.blocks;
    for (let i = 0; i < 4096; i++) if (b[i] !== 0) c++;
    this.count = c;
  }
}

export interface BlockEntityData {
  type: string;
  [k: string]: unknown;
}

/** Coluna 16×16×384. Coordenadas locais x,z ∈ [0,16), y em coordenadas do mundo. */
export class Chunk {
  readonly sections: (Section | null)[] = new Array(SECTION_COUNT).fill(null);
  /** y do mundo da primeira célula acima do bloco mais alto que atenua a luz do céu */
  readonly heightmap = new Int16Array(256).fill(MIN_Y);
  readonly biomes = new Uint8Array(256);
  /** RGB565: [grama, folhagem, água] por coluna */
  readonly tints = new Uint16Array(768);
  readonly blockEntities = new Map<number, BlockEntityData>();
  /** modificado desde o último salvamento */
  dirty = false;
  /** gerado nesta sessão (ainda não salvo nenhuma vez) */
  fresh = true;
  /** luz das bordas já integrada com vizinhos */
  lightMerged = false;
  /** bits de vizinhos (4 direções) com quem a luz já foi trocada */
  lightBorders = 0;
  /** tick do mundo em que foi carregado (para sementes de spawn etc.) */
  loadedAt = 0;
  /** tempo acumulado de jogadores por perto (dificuldade regional) */
  inhabited = 0;

  constructor(public readonly cx: number, public readonly cz: number) {}

  static index(x: number, y: number, z: number): number {
    return ((y & 15) << 8) | (z << 4) | x;
  }

  getSection(y: number): Section | null {
    return this.sections[(y - MIN_Y) >> 4] ?? null;
  }

  ensureSection(sy: number): Section {
    let s = this.sections[sy];
    if (!s) {
      s = new Section();
      this.sections[sy] = s;
    }
    return s;
  }

  getBlock(x: number, y: number, z: number): number {
    const si = (y - MIN_Y) >> 4;
    if (si < 0 || si >= SECTION_COUNT) return 0;
    const s = this.sections[si];
    return s ? s.blocks[((y & 15) << 8) | (z << 4) | x] : 0;
  }

  /** Define o bloco e devolve o anterior. Não mexe na luz. */
  setBlockRaw(x: number, y: number, z: number, state: number): number {
    const si = (y - MIN_Y) >> 4;
    if (si < 0 || si >= SECTION_COUNT) return 0;
    let s = this.sections[si];
    if (!s) {
      if (state === 0) return 0;
      s = this.ensureSection(si);
    }
    const i = ((y & 15) << 8) | (z << 4) | x;
    const old = s.blocks[i];
    if (old === state) return old;
    s.blocks[i] = state;
    if (old === 0) s.count++;
    else if (state === 0) s.count--;
    return old;
  }

  getLight(x: number, y: number, z: number): number {
    const si = (y - MIN_Y) >> 4;
    if (si >= SECTION_COUNT) return FULL_SKY;
    if (si < 0) return 0;
    const s = this.sections[si];
    return s ? s.light[((y & 15) << 8) | (z << 4) | x] : FULL_SKY;
  }

  setLight(x: number, y: number, z: number, v: number): void {
    const si = (y - MIN_Y) >> 4;
    if (si < 0 || si >= SECTION_COUNT) return;
    const s = this.sections[si] ?? this.ensureSection(si);
    s.light[((y & 15) << 8) | (z << 4) | x] = v;
  }

  biomeAt(x: number, z: number): number {
    return this.biomes[(z << 4) | x];
  }
}
