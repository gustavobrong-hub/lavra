import { test, expect, type Page } from '@playwright/test';
import { trackErrors, waitWorldReady } from './helpers';

async function holdItem(page: Page, id: string, count = 1): Promise<void> {
  await page.evaluate(async ({ id, count }) => {
    const g = (window as any).__lavra.game;
    const { ItemStack } = await import(String('/src/game/items/stack.ts'));
    g.player.inventory.main[g.player.inventory.selected] = new ItemStack(id, count);
    g.player.inventory.changed();
  }, { id, count });
}
async function useAt(page: Page, x: number, y: number, z: number, yoff = 0.95): Promise<void> {
  await page.evaluate(({ x, y, z, yoff }) => {
    const g = (window as any).__lavra.game;
    const p = g.player;
    const dx = x + 0.5 - p.x, dy = y + yoff - (p.y + p.eyeHeight()), dz = z + 0.5 - p.z;
    g.yaw = Math.atan2(-dx, dz) * 180 / Math.PI;
    g.pitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
  }, { x, y, z, yoff });
  await page.waitForTimeout(150);
  await page.evaluate(() => (window as any).__lavra.game.input.tap('Mouse2'));
  await page.waitForTimeout(250);
}

test('M9: água, balde, enxada, plantio e farinha de osso', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=lavra&time=6000&pitch=30&yaw=0');
  await waitWorldReady(page, 100);
  // campo de grama plano 15×15 à frente
  const base = await page.evaluate(async () => {
    const g = (window as any).__lavra.game;
    const { S } = await import(String('/src/world/blocks/index.ts'));
    const p = g.player;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    for (let dx = -7; dx <= 7; dx++) for (let dz = -2; dz <= 12; dz++) {
      g.world.setBlock(bx + dx, by - 1, bz + dz, S('grass_block'));
      g.world.setBlock(bx + dx, by - 2, bz + dz, S('dirt'));
      for (let dy = 0; dy < 5; dy++) g.world.setBlock(bx + dx, by + dy, bz + dz, 0);
    }
    for (const e of [...g.level.entities.list]) if (e !== p) e.removed = true;
    g.level.rules.doMobSpawning = false;
    p.setPos(bx + 0.5, by, bz + 0.5);
    return { x: bx, y: by - 1, z: bz };
  });

  // ------------------------------------------------ balde de água escorre
  await holdItem(page, 'water_bucket');
  await useAt(page, base.x, base.y, base.z + 3);
  await page.waitForTimeout(3000);
  const water = await page.evaluate((b) => {
    const g = (window as any).__lavra.game;
    let n = 0;
    for (let dx = -7; dx <= 7; dx++) for (let dz = -3; dz <= 12; dz++) if (g.world.getBlock(b.x + dx, b.y + 1, b.z + dz) !== 0) n++;
    return { n, held: g.player.inventory.held?.id };
  }, base);
  expect(water.held).toBe('bucket');
  expect(water.n).toBeGreaterThan(20);
  await page.screenshot({ path: 'tests/e2e/.results/m9-agua.png' });

  // ------------------------------------------------ recolhe a fonte com balde
  // a correnteza empurra o jogador: volta para perto da fonte
  await page.evaluate((b) => { const g = (window as any).__lavra.game; g.player.setPos(b.x + 0.5, b.y + 1, b.z + 1.2); g.player.vx = g.player.vz = 0; }, base);
  await useAt(page, base.x, base.y + 1, base.z + 3);
  const back = await page.evaluate(() => (window as any).__lavra.game.player.inventory.held?.id);
  expect(back).toBe('water_bucket');
  await page.waitForTimeout(4000); // a corrente seca

  // ------------------------------------------------ enxada, sementes e farinha de osso
  await holdItem(page, 'iron_hoe');
  await useAt(page, base.x + 2, base.y, base.z + 2);
  const tilled = await page.evaluate((b) => {
    const g = (window as any).__lavra.game;
    const s = g.world.getBlock(b.x + 2, b.y, b.z + 2);
    return (window as any).__names?.[s] ?? s;
  }, base);
  const farmland = await page.evaluate(async () => { const { S } = await import(String('/src/world/blocks/index.ts')); return S('farmland'); });
  expect(tilled).toBe(farmland);
  await holdItem(page, 'wheat_seeds', 4);
  await useAt(page, base.x + 2, base.y, base.z + 2);
  await holdItem(page, 'bone_meal', 16);
  for (let i = 0; i < 8; i++) await useAt(page, base.x + 2, base.y + 1, base.z + 2, 0.06);
  const age = await page.evaluate(async (b) => {
    const g = (window as any).__lavra.game;
    const { STATE_PROPS } = await import(String('/src/world/blocks/index.ts'));
    return STATE_PROPS[g.world.getBlock(b.x + 2, b.y + 1, b.z + 2)]?.age;
  }, base);
  expect(age).toBe(7);
  await page.screenshot({ path: 'tests/e2e/.results/m9-trigo.png' });

  // ------------------------------------------------ colher: quebra e dropa trigo + sementes
  await page.evaluate((b) => {
    const g = (window as any).__lavra.game;
    g.level.breakBlock(b.x + 2, b.y + 1, b.z + 2, { drop: true });
  }, base);
  await page.waitForTimeout(300);
  const drops = await page.evaluate(() => (window as any).__lavra.game.level.entities.list.filter((e: any) => e.type === 'item').map((e: any) => e.stack.id));
  expect(drops).toContain('wheat');

  expect(errors).toEqual([]);
});
