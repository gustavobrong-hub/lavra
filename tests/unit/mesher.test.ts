import { describe, expect, it } from 'vitest';
import { meshSection, pidx } from '../../src/mesh/mesher';
import { S } from '../../src/world/blocks';

function input() {
  return {
    blocks: new Uint16Array(18 * 18 * 18),
    light: new Uint8Array(18 * 18 * 18).fill(0xf0),
    tints: new Uint16Array(768).fill(0xffff),
    sx: 0, sy: 4, sz: 0, fancyLeaves: true,
  };
}

describe('mesher', () => {
  it('um cubo isolado gera 6 faces', () => {
    const inp = input();
    inp.blocks[pidx(5, 5, 5)] = S('stone');
    const out = meshSection(inp);
    expect(out.quads[0]).toBe(6);
  });
  it('greedy junta um chão plano 16x16 numa única face de cima', () => {
    const inp = input();
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) inp.blocks[pidx(x, 0, z)] = S('stone');
    // borda cheia abaixo para esconder a face de baixo
    for (let z = -1; z <= 16; z++) for (let x = -1; x <= 16; x++) inp.blocks[pidx(x, -1, z)] = S('stone');
    // vizinhos laterais também de pedra
    for (let i = -1; i <= 16; i++) { inp.blocks[pidx(-1, 0, i)] = S('stone'); inp.blocks[pidx(16, 0, i)] = S('stone'); inp.blocks[pidx(i, 0, -1)] = S('stone'); inp.blocks[pidx(i, 0, 16)] = S('stone'); }
    const out = meshSection(inp);
    expect(out.quads[0]).toBe(1);
  });
  it('seção cheia de pedra não gera faces e não conecta faces', () => {
    const inp = input();
    inp.blocks.fill(S('stone'));
    const out = meshSection(inp);
    expect(out.quads[0]).toBe(0);
    expect(out.vis).toBe(0);
  });
  it('seção vazia conecta todas as faces', () => {
    const out = meshSection(input());
    expect(out.vis).toBe((1 << 15) - 1);
  });
  it('planta gera quads de duas faces na camada recortada', () => {
    const inp = input();
    inp.blocks[pidx(3, 3, 3)] = S('poppy');
    const out = meshSection(inp);
    expect(out.quads[1]).toBe(4);
  });
  it('água gera superfície na camada de água', () => {
    const inp = input();
    inp.blocks[pidx(3, 3, 3)] = S('water');
    const out = meshSection(inp);
    expect(out.quads[3]).toBeGreaterThan(0);
  });
  it('todos os blocos geram malha sem erro', async () => {
    const { BLOCKS } = await import('../../src/world/blocks');
    for (const b of BLOCKS) {
      for (let i = 0; i < Math.min(b.stateCount, 64); i++) {
        const inp = input();
        inp.blocks[pidx(8, 8, 8)] = b.baseState + i;
        inp.blocks[pidx(8, 7, 8)] = S('stone');
        expect(() => meshSection(inp), b.name).not.toThrow();
      }
    }
  });
});
