/// <reference lib="webworker" />
/**
 * Worker de geração de terreno e montagem de malha. Mantém um gerador por (dimensão, seed)
 * com caches de ruído, e responde a pedidos com buffers transferíveis.
 */
import '../world/blocks';
import { meshSection } from '../mesh/mesher';
import { OverworldGenerator } from '../world/gen/overworld';
import { InferoGenerator } from '../world/gen/infero';
import { DIM_INFERO } from '../core/constants';
import { createStructureHooks } from '../world/gen/structures/all';
import type { GenResult, MeshResult, WorkerRequest, WorkerResult } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const gens = new Map<string, OverworldGenerator | InferoGenerator>();

function generator(dim: number, seed: number): OverworldGenerator | InferoGenerator {
  const k = `${dim}:${seed}`;
  let g = gens.get(k);
  if (!g) {
    if (dim === DIM_INFERO) g = new InferoGenerator(seed);
    else {
      const og = new OverworldGenerator(seed);
      og.hooks = createStructureHooks(seed);
      g = og;
    }
    gens.set(k, g);
  }
  return g;
}

scope.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    if (req.type === 'gen') {
      const t0 = performance.now();
      const { chunk, spawns } = generator(req.dim, req.seed).generate(req.cx, req.cz);
      const blocks: (Uint16Array | null)[] = [];
      const light: (Uint8Array | null)[] = [];
      const transfer: Transferable[] = [];
      for (const s of chunk.sections) {
        if (s) {
          blocks.push(s.blocks); light.push(s.light);
          transfer.push(s.blocks.buffer, s.light.buffer);
        } else { blocks.push(null); light.push(null); }
      }
      const res: GenResult = {
        type: 'gen', id: req.id, cx: req.cx, cz: req.cz, dim: req.dim, blocks, light,
        heightmap: chunk.heightmap, biomes: chunk.biomes, tints: chunk.tints, spawns,
        blockEntities: [...chunk.blockEntities.entries()] as [number, Record<string, unknown>][],
        ms: performance.now() - t0,
      };
      transfer.push(chunk.heightmap.buffer, chunk.biomes.buffer, chunk.tints.buffer);
      scope.postMessage(res, transfer);
    } else if (req.type === 'mesh') {
      const t0 = performance.now();
      const out = meshSection(req);
      const res: MeshResult = {
        type: 'mesh', id: req.id, sx: req.sx, sy: req.sy, sz: req.sz,
        layers: out.layers, quads: out.quads, vis: out.vis, skyLit: out.skyLit, ms: performance.now() - t0,
      };
      scope.postMessage(res, out.layers.map((l) => l.buffer));
    }
  } catch (e) {
    const msg: WorkerResult = { type: 'error', id: req.id, message: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) };
    scope.postMessage(msg);
  }
};
