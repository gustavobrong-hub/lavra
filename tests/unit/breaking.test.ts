import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { Level } from '../../src/game/level';
import { Player } from '../../src/game/player/player';
import { Interaction } from '../../src/game/player/interaction';
import { ItemStack } from '../../src/game/items/stack';
import { S } from '../../src/world/blocks';

function ticksToBreak(block: string, tool: string | null, opts: { air?: boolean } = {}): number {
  const level = new Level(flatWorld(1));
  const p = new Player(level);
  p.setPos(0.5, 64, 0.5);
  p.onGround = !opts.air;
  if (tool) p.inventory.main[0] = new ItemStack(tool);
  const it = new Interaction(level, p);
  const dp = it.destroyProgress(S(block));
  return dp === Infinity ? 1 : Math.ceil(1 / dp);
}

describe('tempo de quebra (números do original)', () => {
  it('pedra na mão: 7,5 s', () => expect(ticksToBreak('stone', null)).toBe(150));
  it('pedra com picareta de madeira: 1,15 s', () => expect(ticksToBreak('stone', 'wooden_pickaxe')).toBe(23));
  it('pedra com picareta de diamante: 0,3 s', () => expect(ticksToBreak('stone', 'diamond_pickaxe')).toBe(6));
  it('terra na mão: 0,75 s', () => expect(ticksToBreak('dirt', null)).toBe(15));
  it('tronco na mão: 3 s', () => expect(ticksToBreak('oak_log', null)).toBe(60));
  it('obsidiana com picareta de diamante: 9,4 s', () => expect(ticksToBreak('obsidian', 'diamond_pickaxe')).toBe(188));
  it('folhas com tesoura: instantâneo', () => expect(ticksToBreak('oak_leaves', 'shears')).toBe(1));
  it('no ar é 5× mais lento', () => expect(ticksToBreak('dirt', null, { air: true })).toBe(75));
  it('rocha-mãe é inquebrável', () => {
    const level = new Level(flatWorld(1));
    const it2 = new Interaction(level, new Player(level));
    expect(it2.destroyProgress(S('bedrock'))).toBe(0);
  });
});
