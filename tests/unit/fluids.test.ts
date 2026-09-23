import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { Level } from '../../src/game/level';
import { S, STATE_PROPS, BLOCKS, BLOCK_OF, FLAGS, F_LEAVES } from '../../src/world/blocks';
import { installFluids } from '../../src/world/logic/fluids';
import { installGrowth, boneMeal } from '../../src/world/logic/growth';

function setup() {
  const world = flatWorld(3);
  const level = new Level(world);
  installFluids(level);
  installGrowth(level);
  return { world, level };
}
function run(level: Level, n: number): void {
  for (let i = 0; i < n; i++) { level.gameTime++; level.tickBlocks(); }
}
const name = (w: ReturnType<typeof flatWorld>, x: number, y: number, z: number) => BLOCKS[BLOCK_OF[w.getBlock(x, y, z)]].name;
const lvl = (w: ReturnType<typeof flatWorld>, x: number, y: number, z: number) => STATE_PROPS[w.getBlock(x, y, z)].level as number;

describe('líquidos', () => {
  it('água corre 7 blocos no plano, perdendo 1 nível por bloco', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('water'));
    run(level, 200);
    for (let d = 1; d <= 7; d++) {
      expect(name(world, d, 64, 0)).toBe('water');
      expect(lvl(world, d, 64, 0)).toBe(d);
    }
    expect(name(world, 8, 64, 0)).toBe('air');
  });

  it('lava corre 3 blocos no mundo normal (níveis 2, 4, 6)', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('lava'));
    run(level, 400);
    expect(lvl(world, 1, 64, 0)).toBe(2);
    expect(lvl(world, 2, 64, 0)).toBe(4);
    expect(lvl(world, 3, 64, 0)).toBe(6);
    expect(name(world, 4, 64, 0)).toBe('air');
  });

  it('água cai num buraco e prefere o declive mais próximo', () => {
    const { world, level } = setup();
    level.setBlock(2, 63, 0, 0); // buraco a 2 blocos
    level.setBlock(0, 64, 0, S('water'));
    run(level, 100);
    expect(name(world, 2, 63, 0)).toBe('water');
    expect(lvl(world, 2, 63, 0)).toBeGreaterThanOrEqual(8); // caindo
    // o lado oposto ao buraco não recebe água (só escorre para o declive)
    expect(name(world, -2, 64, 0)).toBe('air');
  });

  it('duas fontes criam uma terceira (fonte infinita)', () => {
    const { world, level } = setup();
    for (let x = -1; x <= 3; x++) for (let z = -1; z <= 1; z++) level.setBlock(x, 64, z, S('stone'));
    for (let x = 0; x <= 2; x++) level.setBlock(x, 64, 0, 0);
    level.setBlock(0, 64, 0, S('water'));
    level.setBlock(2, 64, 0, S('water'));
    run(level, 50);
    expect(lvl(world, 1, 64, 0)).toBe(0);
  });

  it('lava fonte + água = obsidiana; lava corrente + água = pedregulho', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('lava'));
    level.setBlock(1, 64, 0, S('water'));
    run(level, 40);
    expect(name(world, 0, 64, 0)).toBe('obsidian');
    const b = setup();
    b.level.setBlock(0, 64, 5, S('lava', { level: 2 }));
    b.level.setBlock(1, 64, 5, S('water'));
    run(b.level, 40);
    expect(name(b.world, 0, 64, 5)).toBe('cobblestone');
  });

  it('tirar a fonte seca a água corrente', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('water'));
    run(level, 100);
    expect(name(world, 3, 64, 0)).toBe('water');
    level.setBlock(0, 64, 0, 0);
    run(level, 200);
    expect(name(world, 3, 64, 0)).toBe('air');
  });
});

describe('agricultura', () => {
  it('trigo em terra arada úmida cresce até maduro com ticks aleatórios', () => {
    const { world, level } = setup();
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) level.setBlock(x, 63, z, S('farmland', { moisture: 7 }));
    level.setBlock(2, 63, 0, S('water'));
    level.setBlock(0, 64, 0, S('wheat', { age: 0 }));
    const b = level.behaviorOf(world.getBlock(0, 64, 0))!;
    let n = 0;
    while ((STATE_PROPS[world.getBlock(0, 64, 0)].age as number) < 7 && n < 5000) { b.randomTick!(level, 0, 64, 0, world.getBlock(0, 64, 0)); n++; }
    expect(STATE_PROPS[world.getBlock(0, 64, 0)].age).toBe(7);
    // velocidade: f = 1 + 3 + 8×(3/4) = 10 → chance 1/3 por tick aleatório → ~21 ticks para 7 estágios
    expect(n).toBeLessThan(120);
  });

  it('terra arada seca sem água vira terra', () => {
    const { world, level } = setup();
    level.setBlock(0, 63, 0, S('farmland', { moisture: 1 }));
    const b = level.behaviorOf(world.getBlock(0, 63, 0))!;
    for (let i = 0; i < 3; i++) b.randomTick!(level, 0, 63, 0, world.getBlock(0, 63, 0));
    expect(name(world, 0, 63, 0)).toBe('dirt');
  });

  it('farinha de osso faz a muda virar árvore', () => {
    const { world, level } = setup();
    level.setBlock(0, 63, 0, S('grass_block'));
    level.setBlock(0, 64, 0, S('oak_sapling'));
    for (let i = 0; i < 40 && name(world, 0, 64, 0) === 'oak_sapling'; i++) boneMeal(level, 0, 64, 0);
    expect(name(world, 0, 64, 0)).toBe('oak_log');
  });

  it('folhas soltas caem depois de cortar o tronco', () => {
    const { world, level } = setup();
    for (let y = 64; y <= 67; y++) level.setBlock(0, y, 0, S('oak_log', { axis: 'y' }));
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) for (let y = 66; y <= 68; y++) if (x || z || y === 68) level.setBlock(x, y, z, S('oak_leaves', { persistent: false }));
    run(level, 20);
    for (let y = 64; y <= 67; y++) level.setBlock(0, y, 0, 0);
    run(level, 40);
    // ticks aleatórios nas folhas até sumirem
    for (let k = 0; k < 60; k++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) for (let y = 66; y <= 68; y++) {
      const s = world.getBlock(x, y, z);
      if (FLAGS[s] & F_LEAVES) level.behaviorOf(s)!.randomTick!(level, x, y, z, s);
      level.gameTime++; level.tickBlocks();
    }
    let left = 0;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) for (let y = 66; y <= 68; y++) if (FLAGS[world.getBlock(x, y, z)] & F_LEAVES) left++;
    expect(left).toBe(0);
  });
});
