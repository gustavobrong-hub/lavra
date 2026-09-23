import { test, expect } from '@playwright/test';
import { trackErrors, waitWorldReady } from './helpers';

test('M10: circuito de fulgor montado e acionado no jogo', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=lavra&time=14000&pitch=40&yaw=0');
  await waitWorldReady(page, 100);
  const base = await page.evaluate(async () => {
    const g = (window as any).__lavra.game;
    const { S } = await import(String('/src/world/blocks/index.ts'));
    const p = g.player;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    for (let dx = -8; dx <= 8; dx++) for (let dz = -2; dz <= 14; dz++) {
      g.world.setBlock(bx + dx, by - 1, bz + dz, S('smooth_stone'));
      for (let dy = 0; dy < 5; dy++) g.world.setBlock(bx + dx, by + dy, bz + dz, 0);
    }
    for (const e of [...g.level.entities.list]) if (e !== p) e.removed = true;
    g.level.rules.doMobSpawning = false;
    p.setPos(bx + 0.5, by, bz + 0.5);
    const L = g.level;
    const z0 = bz + 3;
    // alavanca na frente do jogador, fio para o leste, repetidor e lâmpada
    L.setBlock(bx, by, z0, S('lever', { face: 'floor', facing: 'south', powered: false }));
    for (let x = 1; x <= 5; x++) L.setBlock(bx + x, by, z0, S('fulgor_wire'));
    L.setBlock(bx + 6, by, z0, S('repeater', { facing: 'west', delay: 2 }));
    L.setBlock(bx + 7, by, z0, S('fulgor_lamp'));
    // ramo oeste: bloco + tocha NOT + lâmpada
    for (let x = 1; x <= 3; x++) L.setBlock(bx - x, by, z0, S('fulgor_wire'));
    L.setBlock(bx - 4, by, z0, S('stone'));
    L.setBlock(bx - 5, by, z0, S('fulgor_wall_torch', { facing: 'west', lit: true }));
    L.setBlock(bx - 6, by, z0, S('fulgor_lamp'));
    // ramo norte: pistão pegajoso empurrando um bloco
    for (let z = 1; z <= 3; z++) L.setBlock(bx, by, z0 + z, S('fulgor_wire'));
    L.setBlock(bx, by, z0 + 4, S('sticky_piston', { facing: 'south', extended: false }));
    L.setBlock(bx, by, z0 + 5, S('oak_planks'));
    return { x: bx, y: by, z: z0 };
  });
  await page.waitForTimeout(600);
  const state = (async () => page.evaluate(async (b) => {
    const g = (window as any).__lavra.game;
    const { STATE_PROPS, BLOCKS, BLOCK_OF } = await import(String('/src/world/blocks/index.ts'));
    const P = (x: number, y: number, z: number) => STATE_PROPS[g.world.getBlock(x, y, z)];
    const N = (x: number, y: number, z: number) => BLOCKS[BLOCK_OF[g.world.getBlock(x, y, z)]].name;
    return {
      lever: P(b.x, b.y, b.z).powered, wire1: P(b.x + 1, b.y, b.z).power, lampE: P(b.x + 7, b.y, b.z).lit,
      torch: P(b.x - 5, b.y, b.z).lit, lampW: P(b.x - 6, b.y, b.z).lit, piston: P(b.x, b.y, b.z + 4).extended, pushed: N(b.x, b.y, b.z + 6),
    };
  }, base));
  const before = await state();
  expect(before.lampE).toBe(false);
  expect(before.torch).toBe(true);
  expect(before.lampW).toBe(true);
  await page.screenshot({ path: 'tests/e2e/.results/m10-desligado.png' });

  // clique direito na alavanca
  await page.evaluate((b) => {
    const g = (window as any).__lavra.game;
    const p = g.player;
    const dx = b.x + 0.5 - p.x, dy = b.y + 0.1 - (p.y + p.eyeHeight()), dz = b.z + 0.5 - p.z;
    g.yaw = Math.atan2(-dx, dz) * 180 / Math.PI;
    g.pitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
  }, base);
  await page.waitForTimeout(200);
  await page.evaluate(() => (window as any).__lavra.game.input.tap('Mouse2'));
  await page.waitForTimeout(800);
  const after = await state();
  expect(after.lever).toBe(true);
  expect(after.wire1).toBe(15);
  expect(after.lampE).toBe(true);
  expect(after.torch).toBe(false);
  expect(after.lampW).toBe(false);
  expect(after.piston).toBe(true);
  expect(after.pushed).toBe('oak_planks');
  await page.evaluate(() => { const g = (window as any).__lavra.game; g.pitch = 45; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/.results/m10-ligado.png' });
  expect(errors).toEqual([]);
});
