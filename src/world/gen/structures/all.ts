/** Registro de todos os planejadores de estruturas da superfície. */
import type { StructureHooks } from './index';
import { VillagePlanner } from './village';

export function createStructureHooks(seed: number): StructureHooks {
  void seed;
  return { planners: [new VillagePlanner()] };
}
