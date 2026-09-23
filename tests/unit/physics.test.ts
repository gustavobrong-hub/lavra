import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { Player } from '../../src/game/player/player';
import { S } from '../../src/world/blocks';

function mkPlayer(world = flatWorld()) {
  const p = new Player({ world });
  p.setPos(0.5, 64, 0.5);
  p.onGround = true;
  return p;
}
const input = (o: Partial<{ forward: number; strafe: number; jump: boolean; sneak: boolean; sprintKey: boolean }> = {}) =>
  ({ forward: 0, strafe: 0, jump: false, sneak: false, sprintKey: false, ...o });

function speedOver(p: Player, inp: ReturnType<typeof input>, warm = 60, measure = 40): number {
  for (let i = 0; i < warm; i++) { p.applyInput(inp); p.tick(); }
  const z0 = p.z, x0 = p.x;
  for (let i = 0; i < measure; i++) { p.applyInput(inp); p.tick(); }
  return (Math.hypot(p.z - z0, p.x - x0) / measure) * 20;
}

describe('física do jogador (números do original)', () => {
  it('anda a ~4,317 m/s', () => {
    expect(speedOver(mkPlayer(), input({ forward: 1 }))).toBeCloseTo(4.317, 2);
  });
  it('corre a ~5,612 m/s', () => {
    expect(speedOver(mkPlayer(), input({ forward: 1, sprintKey: true }))).toBeCloseTo(5.612, 2);
  });
  it('agachado a ~1,3 m/s', () => {
    expect(speedOver(mkPlayer(), input({ forward: 1, sneak: true }))).toBeCloseTo(1.295, 1);
  });
  it('pulo sobe ~1,25 bloco', () => {
    const p = mkPlayer();
    p.tick(); p.tick();
    let maxY = p.y;
    p.applyInput(input({ jump: true })); p.tick();
    for (let i = 0; i < 20; i++) { p.applyInput(input()); p.tick(); maxY = Math.max(maxY, p.y); }
    expect(maxY - 64).toBeGreaterThan(1.24);
    expect(maxY - 64).toBeLessThan(1.26);
    expect(p.onGround).toBe(true);
  });
  it('queda: 1 de dano por bloco depois do 3º (fórmula do original)', () => {
    const fall = (h: number) => {
      const p = mkPlayer();
      p.setPos(0.5, 64 + h, 0.5);
      p.onGround = false;
      for (let i = 0; i < 120 && !p.onGround; i++) { p.applyInput(input()); p.tick(); }
      return 20 - p.health;
    };
    expect(fall(4)).toBe(1);
    expect(fall(10)).toBeGreaterThanOrEqual(6);
    expect(fall(10)).toBeLessThanOrEqual(7);
    expect(fall(25)).toBe(20);
  });
  it('queda de 3 blocos não causa dano', () => {
    const p = mkPlayer();
    p.setPos(0.5, 67, 0.5);
    p.onGround = false;
    for (let i = 0; i < 60; i++) { p.applyInput(input()); p.tick(); }
    expect(p.health).toBe(20);
  });
  it('agachado não cai da beirada', () => {
    const w = flatWorld(2, 63);
    // plataforma de 1 bloco: remove o chão em volta de (0,63,0) até y=60
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) if (x !== 0 || z !== 0) for (let y = 60; y <= 63; y++) w.setBlock(x, y, z, 0);
    const p = mkPlayer(w);
    for (let i = 0; i < 80; i++) { p.applyInput(input({ forward: 1, sneak: true })); p.tick(); }
    expect(p.y).toBeCloseTo(64, 5);
    expect(Math.abs(p.z - 0.5)).toBeLessThan(0.85);
  });
  it('sobe degraus de laje (0,5) andando', () => {
    const w = flatWorld();
    for (let x = -3; x <= 3; x++) for (let z = 3; z <= 12; z++) w.setBlock(x, 64, z, S('stone_slab', { type: 'bottom' }));
    const p = mkPlayer(w);
    for (let i = 0; i < 25; i++) { p.applyInput(input({ forward: 1 })); p.tick(); }
    expect(p.z).toBeGreaterThan(4);
    expect(p.y).toBeCloseTo(64.5, 3);
  });
  it('não sobe um bloco inteiro sem pular', () => {
    const w = flatWorld();
    for (let x = -3; x <= 3; x++) w.setBlock(x, 64, 3, S('stone'));
    const p = mkPlayer(w);
    for (let i = 0; i < 40; i++) { p.applyInput(input({ forward: 1 })); p.tick(); }
    expect(p.z).toBeLessThan(2.71);
    expect(p.y).toBeCloseTo(64, 5);
  });
  it('voo do criativo: ~10,9 m/s', () => {
    const p = mkPlayer(flatWorld(8));
    p.setGameMode('creative');
    p.flying = true;
    p.setPos(0.5, 100, 0.5);
    p.onGround = false;
    expect(speedOver(p, input({ forward: 1 }), 70, 30)).toBeCloseTo(10.89, 1);
  });
});
