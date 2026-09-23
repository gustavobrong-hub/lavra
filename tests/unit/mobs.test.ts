import { describe, expect, it } from 'vitest';
import { flatWorld } from './helpers';
import { Level } from '../../src/game/level';
import { Player } from '../../src/game/player/player';
import { S } from '../../src/world/blocks';
import { Pathfinder } from '../../src/game/entity/ai/pathfinder';
import { spawnMob } from '../../src/game/entity/registry';
import { Cow, Sheep } from '../../src/game/entity/species/animals';
import type { Carnical, Gosma, Pavio } from '../../src/game/entity/species/monsters';
import { ItemStack } from '../../src/game/items/stack';
import { initItems } from '../../src/game/items/registry';
import { playerAttack } from '../../src/game/player/combat';
import { explode } from '../../src/game/explosion';
import { Arrow } from '../../src/game/entity/projectiles';

initItems();

function setup(radius = 3) {
  const world = flatWorld(radius);
  const level = new Level(world);
  const p = new Player(level);
  p.setPos(0.5, 64, 0.5);
  level.entities.add(p);
  level.players.push(p);
  return { world, level, p };
}
const OPTS = { width: 0.6, height: 1.95, maxFall: 3, canSwim: true, canOpenDoors: false, avoidWater: false, maxNodes: 800 };

function run(level: Level, p: Player | null, n: number): void {
  for (let i = 0; i < n; i++) {
    level.gameTime++;
    level.updateSky();
    if (p) { p.tick(); }
    level.entities.tick((e) => e !== p);
  }
}

describe('A* na grade de voxels', () => {
  it('contorna uma parede', () => {
    const { world } = setup();
    for (let z = -6; z <= 6; z++) for (let y = 64; y <= 66; y++) world.setBlock(3, y, z, S('stone'));
    const path = new Pathfinder(world).find(0, 64, 0, 8, 64, 0, OPTS, 0);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1];
    expect(last[0]).toBe(8);
    // nunca atravessa a parede
    for (const n of path!) expect(!(n[0] === 3 && n[2] >= -6 && n[2] <= 6)).toBe(true);
  });
  it('sobe degrau de 1 bloco mas não de 2', () => {
    const { world } = setup();
    world.setBlock(2, 64, 0, S('stone'));
    const p1 = new Pathfinder(world).find(0, 64, 0, 2, 65, 0, { ...OPTS, maxNodes: 50 }, 0);
    expect(p1?.some((n) => n[0] === 2 && n[1] === 65)).toBe(true);
    // torre de 2 blocos cercada: inalcançável
    for (let x = 4; x <= 6; x++) for (let z = -1; z <= 1; z++) { world.setBlock(x, 64, z, S('stone')); world.setBlock(x, 65, z, S('stone')); }
    const p2 = new Pathfinder(world).find(0, 64, 0, 5, 66, 0, { ...OPTS, maxNodes: 300 }, 0);
    expect(p2 === null || !(p2[p2.length - 1][0] === 5 && p2[p2.length - 1][1] === 66)).toBe(true);
  });
  it('não passa por cima de cerca', () => {
    const { world } = setup();
    for (let z = -48; z <= 47; z++) world.setBlock(3, 64, z, S('oak_fence'));
    const path = new Pathfinder(world).find(0, 64, 0, 6, 64, 0, { ...OPTS, maxNodes: 600 }, 0);
    const reached = path && path[path.length - 1][0] === 6;
    expect(reached).toBeFalsy();
  });
});

describe('criaturas', () => {
  it('vaca anda até um ponto com o navegador', () => {
    const { level } = setup();
    const cow = spawnMob(level, 'cow', 0.5, 64, 0.5, { reason: 'command' })!;
    cow.goals.entries.length = 0; // só o navegador
    cow.nav.moveTo(10, 64, 4, 1, 0);
    run(level, null, 200);
    expect(Math.hypot(cow.x - 10.5, cow.z - 4.5)).toBeLessThan(1.5);
  });

  it('carniçal persegue e fere o jogador em sobrevivência (à noite)', () => {
    const { level, p } = setup();
    level.dayTime = 18000;
    const z = spawnMob(level, 'carnical', 8.5, 64, 0.5, { reason: 'command' }) as Carnical;
    z.mainHand = null; z.helmet = null;
    const hp = p.health;
    for (let i = 0; i < 300 && p.health >= hp; i++) run(level, p, 1);
    expect(z.target).toBe(p);
    expect(p.health).toBeLessThan(hp);
  });

  it('carniçal ignora jogador no criativo', () => {
    const { level, p } = setup();
    level.dayTime = 18000;
    p.setGameMode('creative');
    const z = spawnMob(level, 'carnical', 5.5, 64, 0.5, { reason: 'command' }) as Carnical;
    run(level, p, 100);
    expect(z.target).toBeNull();
  });

  it('carniçal queima ao sol', () => {
    const { level } = setup();
    level.dayTime = 6000;
    const z = spawnMob(level, 'carnical', 0.5, 64, 0.5, { reason: 'command' }) as Carnical;
    z.helmet = null;
    const hp = z.health;
    run(level, null, 200);
    expect(z.fireTicks > 0 || z.health < hp).toBe(true);
  });

  it('duas vacas alimentadas com trigo geram um filhote', () => {
    const { level, p } = setup();
    p.setGameMode('creative');
    const a = spawnMob(level, 'cow', 2.5, 64, 0.5, { reason: 'command' }) as Cow;
    const b = spawnMob(level, 'cow', 4.5, 64, 0.5, { reason: 'command' }) as Cow;
    p.inventory.held = new ItemStack('wheat', 2);
    expect(a.interact(p, p.inventory.held)).toBe(true);
    expect(b.interact(p, p.inventory.held)).toBe(true);
    run(level, p, 200);
    const babies = level.entities.list.filter((e) => e.type === 'cow' && (e as Cow).isBaby);
    expect(babies.length).toBe(1);
    expect(a.ageTicks).toBeGreaterThan(0);
  });

  it('ovelha tosquiada solta lã e volta a ter lã ao comer grama', () => {
    const { level, p, world } = setup();
    for (let x = -30; x <= 30; x++) for (let z = -30; z <= 30; z++) world.setBlock(x, 63, z, S('grass_block'));
    const s = spawnMob(level, 'sheep', 0.5, 64, 0.5, { reason: 'command' }) as Sheep;
    s.color = 'white';
    p.inventory.held = new ItemStack('shears');
    expect(s.interact(p, p.inventory.held)).toBe(true);
    expect(s.sheared).toBe(true);
    const wool = level.entities.list.filter((e) => e.type === 'item');
    expect(wool.length).toBeGreaterThanOrEqual(1);
    // só o objetivo de pastar (senão ela sai da grama); 1/1000 a cada 2 ticks, como o original
    s.goals.entries.splice(0, s.goals.entries.length, ...s.goals.entries.filter((e) => e.g.label === 'pastar'));
    for (let i = 0; i < 30000 && s.sheared; i++) run(level, null, 1);
    expect(s.sheared).toBe(false);
  });

  it('gosma grande se divide ao morrer', () => {
    const { level } = setup();
    const g = spawnMob(level, 'gosma', 0.5, 64, 0.5, { size: 4, reason: 'command' }) as Gosma;
    let spawned = 0;
    level.on((e) => { if (e.type === 'spawnMob' && e.mob === 'gosma') spawned++; });
    g.hurt({ type: 'generic' }, 100);
    expect(g.dead).toBe(true);
    expect(spawned).toBeGreaterThanOrEqual(2);
    expect(spawned).toBeLessThanOrEqual(4);
  });
});

describe('combate', () => {
  it('espada com recarga cheia dá o dano cheio; logo em seguida, bem menos', () => {
    const { level, p } = setup();
    const cow = spawnMob(level, 'cow', 1.5, 64, 0.5, { reason: 'command' })!;
    cow.maxHealth = cow.health = 100;
    p.inventory.held = new ItemStack('iron_sword');
    for (let i = 0; i < 20; i++) p.tick();
    playerAttack(level, p, cow);
    const full = 100 - cow.health;
    expect(full).toBeCloseTo(6, 5);
    cow.invulnerableTime = 0;
    p.tick();
    playerAttack(level, p, cow);
    const weak = 100 - cow.health - full;
    expect(weak).toBeLessThan(2);
  });
  it('crítico caindo multiplica por 1,5', () => {
    const { level, p } = setup();
    const cow = spawnMob(level, 'cow', 1.5, 64, 0.5, { reason: 'command' })!;
    cow.maxHealth = cow.health = 100;
    p.inventory.held = new ItemStack('iron_sword');
    for (let i = 0; i < 20; i++) p.tick();
    p.onGround = false; p.fallDistance = 0.5; p.sprinting = false;
    playerAttack(level, p, cow);
    expect(100 - cow.health).toBeCloseTo(9, 5);
  });
  it('explosão do pavio abre cratera e fere quem está perto', () => {
    const { level, p, world } = setup();
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) for (let y = 60; y <= 63; y++) world.setBlock(x, y, z, S('dirt'));
    p.setPos(2.5, 64, 0.5);
    const hp = p.health;
    explode(level, 0.5, 64, 0.5, 3, {});
    let removed = 0;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (world.getBlock(x, 63, z) === 0) removed++;
    expect(removed).toBeGreaterThan(5);
    expect(p.health).toBeLessThan(hp);
  });
  it('pavio incha perto do jogador e explode em 30 ticks', () => {
    const { level, p } = setup();
    level.dayTime = 18000;
    const c = spawnMob(level, 'pavio', 2.5, 64, 0.5, { reason: 'command' }) as Pavio;
    c.target = p;
    run(level, p, 45);
    expect(c.removed).toBe(true);
  });
  it('flecha cai com gravidade 0,05 e arrasto 0,99', () => {
    const { level } = setup(4);
    const a = new Arrow(level);
    a.setPos(0.5, 80, 0.5);
    a.vx = 0; a.vy = 0; a.vz = 3;
    level.entities.add(a);
    run(level, null, 1);
    expect(a.z).toBeCloseTo(3.5, 5);
    expect(a.vz).toBeCloseTo(2.97, 5);
    expect(a.vy).toBeCloseTo(-0.05, 5);
  });
});
