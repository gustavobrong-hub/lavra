/**
 * Estruturas geradas (vilas, ruínas, masmorras, templos, minas, naufrágios).
 * Cada tipo registra um "planejador" que, para uma região, decide se há estrutura e devolve peças com caixas.
 * O chunk-alvo coloca só as peças que o interceptam.
 */
import type { ChunkWriter } from '../writer';
import type { OverworldGenerator, SpawnHint } from '../overworld';

export interface StructurePiece {
  minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number;
  place(w: ChunkWriter, spawns: SpawnHint[]): void;
}

export interface StructurePlanner {
  name: string;
  /** peças de todas as estruturas cujo início está perto do chunk (cx, cz) */
  piecesNear(gen: OverworldGenerator, cx: number, cz: number): StructurePiece[];
  /** impede árvores dentro da estrutura (vilas) */
  blocksTrees?(gen: OverworldGenerator, x: number, z: number): boolean;
}

export interface StructureHooks {
  planners: StructurePlanner[];
}

export function placeStructures(hooks: StructureHooks, w: ChunkWriter, gen: OverworldGenerator, spawns: SpawnHint[]): void {
  const cx = w.chunk.cx, cz = w.chunk.cz;
  for (const planner of hooks.planners) {
    for (const piece of planner.piecesNear(gen, cx, cz)) {
      if (w.touches(piece.minX, piece.minZ, piece.maxX, piece.maxZ)) piece.place(w, spawns);
    }
  }
}
