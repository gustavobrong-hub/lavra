import { describe, expect, it } from 'vitest';
import {
  BLOCKS, S, stateCount, textureCount, TEXTURES, getProp, withProp, OPAQUE, LIGHT_EMIT, FACE_TEX, blockNameOf,
  isAir, isWater, FLUID_LEVEL, OCCLUDES,
} from '../../src/world/blocks';

describe('registro de blocos', () => {
  it('ar é o estado 0', () => {
    expect(S('air')).toBe(0);
    expect(isAir(0)).toBe(true);
  });
  it('tem blocos e estados suficientes, dentro do limite', () => {
    expect(BLOCKS.length).toBeGreaterThan(300);
    expect(stateCount()).toBeLessThan(16384);
    expect(textureCount()).toBeLessThanOrEqual(2048);
    console.log(`blocos=${BLOCKS.length} estados=${stateCount()} texturas=${TEXTURES.length} camadas=${textureCount()}`);
  });
  it('propriedades codificam e decodificam', () => {
    const log = S('oak_log', { axis: 'x' });
    expect(getProp(log, 'axis')).toBe('x');
    expect(blockNameOf(log)).toBe('oak_log');
    const z = withProp(log, 'axis', 'z');
    expect(getProp(z, 'axis')).toBe('z');
    const door = S('oak_door', { facing: 'east', half: 'upper', open: true });
    expect(getProp(door, 'facing')).toBe('east');
    expect(getProp(door, 'half')).toBe('upper');
    expect(getProp(door, 'open')).toBe(true);
    expect(getProp(door, 'hinge')).toBe('left');
  });
  it('tabelas coerentes', () => {
    expect(OPAQUE[S('stone')]).toBe(1);
    expect(OPAQUE[S('glass')]).toBe(0);
    expect(OPAQUE[S('oak_leaves')]).toBe(0);
    expect(LIGHT_EMIT[S('torch')]).toBe(14);
    expect(LIGHT_EMIT[S('lava')]).toBe(15);
    expect(isWater(S('water'))).toBe(true);
    expect(FLUID_LEVEL[S('water', { level: 3 })]).toBe(3);
    expect(OCCLUDES[S('oak_slab', { type: 'bottom' })]).toBe(1);
    expect(OCCLUDES[S('oak_slab', { type: 'double' })]).toBe(63);
    // grama: topo e lateral diferentes
    const g = S('grass_block');
    expect(FACE_TEX[g * 6 + 1]).not.toBe(FACE_TEX[g * 6 + 2]);
  });
  it('rotação de textura de tronco deitado', () => {
    const lx = S('oak_log', { axis: 'x' });
    expect(FACE_TEX[lx * 6 + 1] >> 12).toBe(1);
  });
});
