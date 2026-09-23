/** Registro de todos os planejadores de estruturas da superfície. */
import type { StructureHooks } from './index';

export function createStructureHooks(seed: number): StructureHooks {
  void seed;
  return { planners: [] };
}
