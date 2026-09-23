import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { Level } from '../../src/game/level';
import { S, STATE_PROPS, BLOCKS, BLOCK_OF, withProp } from '../../src/world/blocks';
import { installFulgor } from '../../src/world/logic/fulgor';

function setup(primed?: { n: number }) {
  const world = flatWorld(3);
  const level = new Level(world);
  installFulgor(level, { primeTnt: () => { if (primed) primed.n++; } });
  return { world, level };
}
function run(level: Level, n: number): void { for (let i = 0; i < n; i++) { level.gameTime++; level.tickBlocks(); } }
const P = (w: ReturnType<typeof flatWorld>, x: number, y: number, z: number) => STATE_PROPS[w.getBlock(x, y, z)];
const name = (w: ReturnType<typeof flatWorld>, x: number, y: number, z: number) => BLOCKS[BLOCK_OF[w.getBlock(x, y, z)]].name;
function toggle(level: Level, x: number, y: number, z: number, on: boolean): void {
  level.setBlock(x, y, z, withProp(level.getBlock(x, y, z), 'powered', on));
}

describe('fulgor', () => {
  it('fio perde 1 por bloco a partir da alavanca (15 → 1)', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('lever', { face: 'floor', powered: false }));
    for (let x = 1; x <= 16; x++) level.setBlock(x, 64, 0, S('fulgor_wire'));
    toggle(level, 0, 64, 0, true);
    for (let x = 1; x <= 15; x++) expect(P(world, x, 64, 0).power).toBe(16 - x);
    expect(P(world, 16, 64, 0).power).toBe(0);
    toggle(level, 0, 64, 0, false);
    for (let x = 1; x <= 16; x++) expect(P(world, x, 64, 0).power).toBe(0);
  });

  it('lâmpada acende com o fio e apaga 4 ticks depois', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('lever', { face: 'floor', powered: false }));
    for (let x = 1; x <= 3; x++) level.setBlock(x, 64, 0, S('fulgor_wire'));
    level.setBlock(4, 64, 0, S('fulgor_lamp'));
    toggle(level, 0, 64, 0, true);
    expect(P(world, 4, 64, 0).lit).toBe(true);
    toggle(level, 0, 64, 0, false);
    run(level, 3);
    expect(P(world, 4, 64, 0).lit).toBe(true);
    run(level, 2);
    expect(P(world, 4, 64, 0).lit).toBe(false);
  });

  it('tocha inverte o sinal do bloco (porta NOT) com 2 ticks de atraso', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('stone'));
    level.setBlock(0, 65, 0, S('lever', { face: 'floor', powered: false }));
    level.setBlock(1, 64, 0, S('fulgor_wall_torch', { facing: 'east', lit: true }));
    run(level, 4);
    expect(P(world, 1, 64, 0).lit).toBe(true);
    toggle(level, 0, 65, 0, true); // alavanca no topo energiza o bloco (forte)
    run(level, 1);
    expect(P(world, 1, 64, 0).lit).toBe(true);
    run(level, 2);
    expect(P(world, 1, 64, 0).lit).toBe(false);
  });

  it('repetidor com atraso 4 liga a lâmpada 8 ticks depois e reforça para 15', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('lever', { face: 'floor', powered: false }));
    for (let x = 1; x <= 14; x++) level.setBlock(x, 64, 0, S('fulgor_wire'));
    // o repetidor "olha" para a entrada (oeste) e sai para o leste
    level.setBlock(15, 64, 0, S('repeater', { facing: 'west', delay: 4 }));
    for (let x = 16; x <= 20; x++) level.setBlock(x, 64, 0, S('fulgor_wire'));
    level.setBlock(21, 64, 0, S('fulgor_lamp'));
    run(level, 2);
    toggle(level, 0, 64, 0, true);
    expect(P(world, 14, 64, 0).power).toBe(2);
    run(level, 7);
    expect(P(world, 21, 64, 0).lit).toBe(false);
    run(level, 1);
    expect(P(world, 16, 64, 0).power).toBe(15);
    expect(P(world, 21, 64, 0).lit).toBe(true);
  });

  it('comparador em modo subtração', () => {
    const { world, level } = setup();
    // entrada de trás: alavanca → fio de 3 (força 13 no fim); lateral: fio com força 5
    level.setBlock(0, 64, 0, S('lever', { face: 'floor', powered: false }));
    level.setBlock(1, 64, 0, S('fulgor_wire'));
    level.setBlock(2, 64, 0, S('fulgor_wire'));
    level.setBlock(3, 64, 0, S('comparator', { facing: 'west', mode: 'subtract' }));
    level.setBlock(4, 64, 0, S('fulgor_wire'));
    level.setBlock(3, 64, 11, S('lever', { face: 'floor', powered: false }));
    for (let z = 1; z <= 10; z++) level.setBlock(3, 64, z, S('fulgor_wire'));
    toggle(level, 0, 64, 0, true);
    toggle(level, 3, 64, 11, true);
    run(level, 6);
    // trás = 14 (fio em x=2), lado = 6 (10º fio a partir da alavanca, em z=1) → 8
    expect(P(world, 4, 64, 0).power).toBe(8);
  });

  it('pistão empurra uma fila de blocos; o pegajoso puxa de volta', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('sticky_piston', { facing: 'east', extended: false }));
    level.setBlock(1, 64, 0, S('oak_planks'));
    level.setBlock(2, 64, 0, S('cobblestone'));
    level.setBlock(-1, 64, 0, S('lever', { face: 'floor', powered: false }));
    toggle(level, -1, 64, 0, true);
    expect(name(world, 1, 64, 0)).toBe('piston_head');
    expect(name(world, 2, 64, 0)).toBe('oak_planks');
    expect(name(world, 3, 64, 0)).toBe('cobblestone');
    toggle(level, -1, 64, 0, false);
    expect(name(world, 1, 64, 0)).toBe('oak_planks');
    expect(name(world, 2, 64, 0)).toBe('air');
    expect(P(world, 0, 64, 0).extended).toBe(false);
  });

  it('pistão não empurra obsidiana nem mais de 12 blocos', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('piston', { facing: 'east', extended: false }));
    level.setBlock(1, 64, 0, S('obsidian'));
    level.setBlock(-1, 64, 0, S('lever', { face: 'floor', powered: false }));
    toggle(level, -1, 64, 0, true);
    expect(P(world, 0, 64, 0).extended).toBe(false);
  });

  it('observador dá um pulso de 2 ticks quando o bloco da frente muda', () => {
    const { world, level } = setup();
    level.setBlock(0, 64, 0, S('observer', { facing: 'east', powered: false }));
    level.setBlock(-1, 64, 0, S('fulgor_lamp'));
    run(level, 5);
    level.setBlock(1, 64, 0, S('stone'));
    run(level, 2);
    expect(P(world, 0, 64, 0).powered).toBe(true);
    expect(P(world, -1, 64, 0).lit).toBe(true);
    run(level, 2);
    expect(P(world, 0, 64, 0).powered).toBe(false);
  });

  it('porta abre com energia e TNT acende', () => {
    const primed = { n: 0 };
    const { world, level } = setup(primed);
    level.batch(() => {
      level.setBlock(0, 64, 0, S('oak_door', { half: 'lower', facing: 'south' }));
      level.setBlock(0, 65, 0, S('oak_door', { half: 'upper', facing: 'south' }));
    });
    level.setBlock(1, 64, 0, S('lever', { face: 'floor', powered: false }));
    toggle(level, 1, 64, 0, true);
    expect(P(world, 0, 64, 0).open).toBe(true);
    expect(P(world, 0, 65, 0).open).toBe(true);
    level.setBlock(5, 64, 0, S('tnt'));
    level.setBlock(6, 64, 0, S('fulgor_block'));
    expect(primed.n).toBe(1);
    expect(name(world, 5, 64, 0)).toBe('air');
  });
});
