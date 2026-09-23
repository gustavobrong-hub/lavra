/**
 * Escritor de blocos em coordenadas de mundo, restrito a um chunk-alvo.
 * Features de chunks vizinhos usam este escritor: só o que cai dentro do alvo é aplicado.
 */
import { MAX_Y, MIN_Y } from '../../core/constants';
import { FLAGS, F_LEAVES, F_REPLACEABLE, OPAQUE } from '../blocks/registry';
import type { Chunk } from '../chunk';

export class ChunkWriter {
  readonly x0: number;
  readonly z0: number;

  constructor(readonly chunk: Chunk) {
    this.x0 = chunk.cx * 16;
    this.z0 = chunk.cz * 16;
  }

  inside(x: number, y: number, z: number): boolean {
    return x >= this.x0 && x < this.x0 + 16 && z >= this.z0 && z < this.z0 + 16 && y >= MIN_Y && y < MAX_Y;
  }

  /** true se a caixa [x0,x1]×[z0,z1] toca o chunk */
  touches(x0: number, z0: number, x1: number, z1: number): boolean {
    return x1 >= this.x0 && x0 < this.x0 + 16 && z1 >= this.z0 && z0 < this.z0 + 16;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inside(x, y, z)) return -1;
    return this.chunk.getBlock(x - this.x0, y, z - this.z0);
  }

  set(x: number, y: number, z: number, state: number): void {
    if (!this.inside(x, y, z)) return;
    this.chunk.setBlockRaw(x - this.x0, y, z - this.z0, state);
  }

  /** Só escreve sobre ar/substituíveis (grama alta, neve fina, água se allowWater). */
  soft(x: number, y: number, z: number, state: number, allowWater = false): void {
    if (!this.inside(x, y, z)) return;
    const cur = this.chunk.getBlock(x - this.x0, y, z - this.z0);
    if (cur === 0 || (FLAGS[cur] & F_REPLACEABLE && (allowWater || !(FLAGS[cur] & 4)))) {
      this.chunk.setBlockRaw(x - this.x0, y, z - this.z0, state);
    }
  }

  /** Folhas: não substituem blocos sólidos opacos nem troncos. */
  leaves(x: number, y: number, z: number, state: number): void {
    if (!this.inside(x, y, z)) return;
    const cur = this.chunk.getBlock(x - this.x0, y, z - this.z0);
    if (cur === 0 || (FLAGS[cur] & F_REPLACEABLE && !(FLAGS[cur] & 4)) || (FLAGS[cur] & F_LEAVES)) {
      this.chunk.setBlockRaw(x - this.x0, y, z - this.z0, state);
    }
  }

  /** Troncos: substituem tudo que não é opaco (folhas, plantas, ar). */
  log(x: number, y: number, z: number, state: number): void {
    if (!this.inside(x, y, z)) return;
    const cur = this.chunk.getBlock(x - this.x0, y, z - this.z0);
    if (!OPAQUE[cur] || (FLAGS[cur] & F_LEAVES)) this.chunk.setBlockRaw(x - this.x0, y, z - this.z0, state);
  }
}
