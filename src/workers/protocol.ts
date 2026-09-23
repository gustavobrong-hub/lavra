/** Mensagens entre a thread principal e os workers de geração/malha. */
import type { SpawnHint } from '../world/gen/overworld';

export interface GenRequest {
  type: 'gen';
  id: number;
  dim: number;
  seed: number;
  cx: number;
  cz: number;
}

export interface GenResult {
  type: 'gen';
  id: number;
  cx: number;
  cz: number;
  dim: number;
  /** por seção: [blocos, luz] ou null (vazia) */
  blocks: (Uint16Array | null)[];
  light: (Uint8Array | null)[];
  heightmap: Int16Array;
  biomes: Uint8Array;
  tints: Uint16Array;
  spawns: SpawnHint[];
  blockEntities: [number, Record<string, unknown>][];
  ms: number;
}

export interface MeshRequest {
  type: 'mesh';
  id: number;
  sx: number;
  sy: number;
  sz: number;
  blocks: Uint16Array;
  light: Uint8Array;
  tints: Uint16Array;
  fancyLeaves: boolean;
}

export interface MeshResult {
  type: 'mesh';
  id: number;
  sx: number;
  sy: number;
  sz: number;
  layers: Uint32Array[];
  quads: number[];
  vis: number;
  skyLit: boolean;
  ms: number;
}

export type WorkerRequest = GenRequest | MeshRequest;
export type WorkerResult = GenResult | MeshResult | { type: 'error'; id: number; message: string };
