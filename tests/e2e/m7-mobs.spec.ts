import { test, expect, type Page } from '@playwright/test';
import { trackErrors, waitWorldReady } from './helpers';

/** Monta uma arena de pedra 21×21 no nível do jogador e devolve o centro. */
async function arena(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const g = (window as any).__lavra.game;
    const { S } = await import(String('/src/world/blocks/index.ts'));
    const p = g.player;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const stone = S('stone');
    for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) {
      g.world.setBlock(bx + dx, by - 1, bz + dz, stone);
      for (let dy = 0; dy < 4; dy++) g.world.setBlock(bx + dx, by + dy, bz + dz, 0);
    }
    // tira as criaturas da geração e bloqueia spawns
    for (const e of [...g.level.entities.list]) if (e !== p) e.removed = true;
    g.level.rules.doMobSpawning = false;
    p.setPos(bx + 0.5, by, bz + 0.5);
  });
}

async function spawn(page: Page, type: string, dx: number, dz: number, extra = ''): Promise<number> {
  return page.evaluate(async ({ type, dx, dz, extra }) => {
    const g = (window as any).__lavra.game;
    const reg = await import(String('/src/game/entity/registry.ts'));
    const p = g.player;
    const m = reg.spawnMob(g.level, type, p.x + dx, p.y, p.z + dz, { reason: 'command' });
    if (extra) new Function('m', 'g', extra)(m, g);
    return m.id;
  }, { type, dx, dz, extra });
}

/** Mira no centro da criatura (ajusta yaw/pitch da câmera). */
async function aimAt(page: Page, id: number): Promise<void> {
  await page.evaluate((id) => {
    const g = (window as any).__lavra.game;
    const m = g.level.entities.byId.get(id);
    if (!m) return;
    const p = g.player;
    const dx = m.x - p.x, dy = m.y + m.height * 0.5 - (p.y + p.eyeHeight()), dz = m.z - p.z;
    g.yaw = Math.atan2(-dx, dz) * 180 / Math.PI;
    g.pitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
  }, id);
}

async function give(page: Page, id: string, count = 1): Promise<void> {
  await page.evaluate(async ({ id, count }) => {
    const g = (window as any).__lavra.game;
    const { ItemStack } = await import(String('/src/game/items/stack.ts'));
    g.player.inventory.main[g.player.inventory.selected] = new ItemStack(id, count);
    g.player.inventory.changed();
  }, { id, count });
}

async function click(page: Page, button: 'Mouse0' | 'Mouse2', holdMs = 60): Promise<void> {
  await page.evaluate((b) => (window as any).__lavra.game.input.press(b), button);
  await page.waitForTimeout(holdMs);
  await page.evaluate((b) => (window as any).__lavra.game.input.release(b), button);
}

test('M7: criaturas — luta, ordenha, tosquia, arco e montaria', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=lavra&time=18000&pitch=0&yaw=0');
  await waitWorldReady(page, 100);
  await arena(page);

  // ------------------------------------------------ luta com espada contra um carniçal
  await give(page, 'iron_sword');
  const z = await spawn(page, 'carnical', 0, 4, 'm.mainHand = null; m.helmet = null; m.baby && m.setBaby(false);');
  let dead = false;
  for (let i = 0; i < 60 && !dead; i++) {
    await aimAt(page, z);
    await page.waitForTimeout(700); // recarga cheia da espada (0,625 s)
    await click(page, 'Mouse0');
    if (i === 1) await page.screenshot({ path: 'tests/e2e/.results/m7-luta.png' });
    dead = await page.evaluate((id) => { const m = (window as any).__lavra.game.level.entities.byId.get(id); return !m || m.dead; }, z);
  }
  expect(dead).toBe(true);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const g = (window as any).__lavra.game;
    return { hp: g.player.health, xp: g.player.xpTotal, orbs: g.level.entities.list.filter((e: any) => e.type === 'xp_orb').length };
  });
  expect(after.xp + after.orbs).toBeGreaterThan(0);

  // ------------------------------------------------ ordenhar a vaca
  const cow = await spawn(page, 'cow', 2, 2, 'm.goals.entries.length = 0;');
  await give(page, 'bucket');
  await aimAt(page, cow);
  await page.waitForTimeout(200);
  await click(page, 'Mouse2');
  await page.waitForTimeout(200);
  const held = await page.evaluate(() => (window as any).__lavra.game.player.inventory.held?.id);
  expect(held).toBe('milk_bucket');

  // ------------------------------------------------ tosquiar a ovelha
  const sheep = await spawn(page, 'sheep', -2, 2, 'm.goals.entries.length = 0; m.color = "black";');
  await give(page, 'shears');
  await aimAt(page, sheep);
  await page.waitForTimeout(200);
  await click(page, 'Mouse2');
  await page.waitForTimeout(300);
  const sheared = await page.evaluate((id) => (window as any).__lavra.game.level.entities.byId.get(id).sheared, sheep);
  expect(sheared).toBe(true);

  // ------------------------------------------------ arco: flecha na vaca
  const target = await spawn(page, 'cow', 0, 8, 'm.goals.entries.length = 0; m.maxHealth = m.health = 100;');
  await page.evaluate(async () => {
    const g = (window as any).__lavra.game;
    const { ItemStack } = await import(String('/src/game/items/stack.ts'));
    g.player.inventory.main[g.player.inventory.selected] = new ItemStack('bow');
    g.player.inventory.main[8] = new ItemStack('arrow', 16);
    g.player.inventory.changed();
  });
  await aimAt(page, target);
  await page.evaluate(() => (window as any).__lavra.game.input.press('Mouse2'));
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'tests/e2e/.results/m7-arco.png' });
  await page.evaluate(() => (window as any).__lavra.game.input.release('Mouse2'));
  await page.waitForTimeout(1500);
  const bow = await page.evaluate((id) => {
    const g = (window as any).__lavra.game;
    return { hp: g.level.entities.byId.get(id).health, arrows: g.player.inventory.count('arrow') };
  }, target);
  expect(bow.arrows).toBe(15);
  expect(bow.hp).toBeLessThan(100);

  // ------------------------------------------------ cavalo domado e selado: montar e andar
  const horse = await spawn(page, 'horse', 1.5, -1.5, 'm.goals.entries.length = 0; m.tameBy(g.player); m.saddled = true; m.baseSpeed = 0.3;');
  await give(page, 'stick');
  await aimAt(page, horse);
  await page.waitForTimeout(200);
  await click(page, 'Mouse2');
  await page.waitForTimeout(300);
  const mounted = await page.evaluate(() => !!(window as any).__lavra.game.player.vehicle);
  expect(mounted).toBe(true);
  const h0 = await page.evaluate((id) => { const h = (window as any).__lavra.game.level.entities.byId.get(id); return [h.x, h.z]; }, horse);
  await page.evaluate(() => { const g = (window as any).__lavra.game; g.yaw = 0; g.input.press(g.settings.controls.keys.forward); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/e2e/.results/m7-cavalo.png' });
  await page.evaluate(() => { const g = (window as any).__lavra.game; g.input.release(g.settings.controls.keys.forward); });
  const h1 = await page.evaluate((id) => { const h = (window as any).__lavra.game.level.entities.byId.get(id); return [h.x, h.z]; }, horse);
  expect(Math.hypot(h1[0] - h0[0], h1[1] - h0[1])).toBeGreaterThan(2);

  expect(errors).toEqual([]);
});
