/**
 * Ponto de entrada do registro: registra todas as definições numa ordem fixa
 * (a ordem define os stateIds, que vão para o save — só acrescente no final de cada grupo com cuidado).
 */
import { NATURAL } from './defs/natural';
import { WOOD_BLOCKS } from './defs/wood';
import { BUILDING } from './defs/building';
import { PLANTS } from './defs/plants';
import { FULGOR } from './defs/fulgor';
import { UTILITY } from './defs/utility';
import { INFERO } from './defs/infero';
import {
  registerBlock, setOccludes, BLOCKS, S, F_FULL_CUBE_COLLISION, FLAGS, LIGHT_OPACITY, OPAQUE, STATE_PROPS,
  texLayer, freezeTextures, F_WATERLOGGED,
} from './registry';
import type { Props } from './types';

let registered = false;

const SIDE_BITS: Record<string, number> = { down: 1, up: 2, north: 4, south: 8, west: 16, east: 32 };

export function initBlocks(): void {
  if (registered) return;
  registered = true;
  for (const group of [NATURAL, WOOD_BLOCKS, BUILDING, PLANTS, FULGOR, UTILITY, INFERO]) {
    for (const def of group) registerBlock(def);
  }
  // faces que lajes e escadas cobrem por completo (para descartar faces vizinhas)
  for (const b of BLOCKS) {
    const each = (fn: (s: number, p: Props) => void) => {
      for (let i = 0; i < b.stateCount; i++) fn(b.baseState + i, STATE_PROPS[b.baseState + i]);
    };
    if (b.shape === 'slab') {
      setOccludes(b.name, (p: Props) => (p.type === 'double' ? 63 : p.type === 'top' ? SIDE_BITS.up : SIDE_BITS.down));
      each((s, p) => {
        LIGHT_OPACITY[s] = 15;
        if (p.type === 'double') { FLAGS[s] |= F_FULL_CUBE_COLLISION; OPAQUE[s] = 1; }
      });
    } else if (b.shape === 'stairs') {
      setOccludes(b.name, (p: Props) => (p.half === 'top' ? SIDE_BITS.up : SIDE_BITS.down) | SIDE_BITS[String(p.facing)]);
      each((s) => { LIGHT_OPACITY[s] = 15; });
    } else if (b.shape === 'farmland' || b.shape === 'path') {
      setOccludes(b.name, () => SIDE_BITS.down);
      each((s) => { LIGHT_OPACITY[s] = 15; });
    } else if (b.shape === 'snowlayer') {
      setOccludes(b.name, (p: Props) => SIDE_BITS.down | ((p.layers as number) === 8 ? 63 : 0));
      each((s, p) => { if (p.layers === 8) { LIGHT_OPACITY[s] = 15; OPAQUE[s] = 1; FLAGS[s] |= F_FULL_CUBE_COLLISION; } });
    }
  }
  // plantas aquáticas vivem dentro d'água
  for (const n of ['kelp', 'kelp_plant', 'seagrass', 'tall_seagrass']) {
    const b = BLOCKS.find((x) => x.name === n)!;
    for (let i = 0; i < b.stateCount; i++) {
      const s = b.baseState + i;
      FLAGS[s] |= F_WATERLOGGED;
      LIGHT_OPACITY[s] = 1;
    }
  }
  // texturas usadas diretamente pelos modelos
  for (const n of ['fulgor_torch', 'fulgor_torch_off', 'white_wool', 'iron_block', 'water_still', 'oak_log']) texLayer(n);
  freezeTextures();
}

initBlocks();

export * from './registry';
export { S };
