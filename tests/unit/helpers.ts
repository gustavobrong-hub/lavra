import { World } from '../../src/world/world';
import { Chunk } from '../../src/world/chunk';
import { S } from '../../src/world/blocks';
import { computeColumnLight } from '../../src/world/light/columnlight';

/** Mundo plano de teste: pedra até y=63 (superfície em 64), raio em chunks. */
export function flatWorld(radius = 2, top = 63, block = 'stone'): World {
  const w = new World(0, 1);
  const st = S(block);
  for (let cz = -radius; cz <= radius; cz++) for (let cx = -radius; cx <= radius; cx++) {
    const c = new Chunk(cx, cz);
    for (let y = -64; y <= top; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.setBlockRaw(x, y, z, st);
    computeColumnLight(c);
    w.addChunk(c);
  }
  return w;
}
