/**
 * Sentinela construída pelo jogador: 4 blocos de ferro em T com uma abóbora esculpida no topo
 * (em qualquer das duas orientações), como o golem do original. A sentinela feita pelo jogador nunca o ataca.
 */
import type { Level } from '../level';
import { BLOCKS, BLOCK_OF } from '../../world/blocks';
import { spawnMob } from '../entity/registry';
import type { Sentinela } from './sentinela';

const nameAt = (L: Level, x: number, y: number, z: number) => BLOCKS[BLOCK_OF[L.getBlock(x, y, z)]].name;

export function installGolemBuilding(level: Level): void {
  level.behavior((n) => n === 'carved_pumpkin' || n === 'jack_o_lantern', {
    placed(L, x, y, z) {
      if (nameAt(L, x, y - 1, z) !== 'iron_block' || nameAt(L, x, y - 2, z) !== 'iron_block') return;
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        if (nameAt(L, x + dx, y - 1, z + dz) !== 'iron_block' || nameAt(L, x - dx, y - 1, z - dz) !== 'iron_block') continue;
        // os cantos de baixo precisam estar vazios
        if (L.getBlock(x + dx, y - 2, z + dz) !== 0 || L.getBlock(x - dx, y - 2, z - dz) !== 0) continue;
        for (const [bx, by, bz] of [[x, y, z], [x, y - 1, z], [x, y - 2, z], [x + dx, y - 1, z + dz], [x - dx, y - 1, z - dz]]) {
          L.emit('blockBreak', { x: bx, y: by, z: bz, state: L.getBlock(bx, by, bz) });
          L.setBlock(bx, by, bz, 0);
        }
        const g = spawnMob(L, 'sentinela', x + 0.5, y - 2, z + 0.5, { reason: 'command' }) as Sentinela | null;
        if (g) { g.playerMade = true; g.persistent = true; }
        L.emit('sound', { name: 'sentinela.build', x, y, z });
        return;
      }
    },
  });
}
