import { test, expect } from '@playwright/test';
import { trackErrors, waitWorldReady } from './helpers';

// vila de planície da semente "lavra" (centro em 552, 78, 328)
const VILA = { x: 552, y: 80, z: 328 };

test('M8: vila com aldeões, comércio, rotina e sentinela', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(`/?seed=lavra&time=2500&pos=${VILA.x},${VILA.y + 4},${VILA.z + 12}&yaw=180&pitch=15&mode=creative`);
  await waitWorldReady(page, 100);
  await page.evaluate(() => { const g = (window as any).__lavra.game; g.player.flying = true; g.level.rules.doMobSpawning = false; });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const g = (window as any).__lavra.game;
    const vs = g.level.entities.list.filter((e: any) => e.type === 'villager');
    const bells = [...g.level.pois.pois.values()].filter((p: any) => p.type === 'bell').length;
    const beds = [...g.level.pois.pois.values()].filter((p: any) => p.type === 'bed').length;
    const golems = g.level.entities.list.filter((e: any) => e.type === 'sentinela').length;
    return { n: vs.length, bells, beds, golems, profs: vs.filter((v: any) => v.profession !== 'nenhuma').length };
  });
  console.log(JSON.stringify(info));
  expect(info.n).toBeGreaterThanOrEqual(5);
  expect(info.bells).toBeGreaterThanOrEqual(1);
  expect(info.beds).toBeGreaterThanOrEqual(4);
  expect(info.golems).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: 'tests/e2e/.results/m8-vila.png' });

  // ------------------------------------------------ comércio pela tela
  const trade = await page.evaluate(async () => {
    const g = (window as any).__lavra.game;
    const { ItemStack } = await import(String('/src/game/items/stack.ts'));
    const p = g.player;
    let v = g.level.entities.list.find((e: any) => e.type === 'villager' && e.canTrade);
    if (!v) { v = g.level.entities.list.find((e: any) => e.type === 'villager'); v.profession = 'fazendeiro'; }
    v.goals.entries.length = 0;
    p.setPos(v.x + 1.5, v.y, v.z);
    p.setGameMode('survival');
    v.ensureOffers();
    const o = v.offers[0];
    // dá ao jogador o necessário para a primeira oferta
    p.inventory.add(new ItemStack(o.a.id, 64));
    if (o.b) p.inventory.add(new ItemStack(o.b.id, 64));
    v.interact(p, null);
    const scr = g.ui.top;
    const menu = scr?.menu;
    if (!menu) return { ok: false, why: 'sem tela' };
    menu.selectOffer(0);
    const before = v.tradeXp;
    const outId = menu.out[0]?.id;
    menu.click(2, 0);
    const carried = menu.carried?.id;
    return { ok: true, outId, carried, xp: v.tradeXp - before, level: v.tradeLevel, title: scr.el.querySelector('.panel-title')?.textContent };
  });
  console.log(JSON.stringify(trade));
  expect(trade.ok).toBe(true);
  expect(trade.carried).toBe(trade.outId);
  expect(trade.xp).toBeGreaterThan(0);
  await page.screenshot({ path: 'tests/e2e/.results/m8-comercio.png' });
  await page.keyboard.press('Escape');

  // ------------------------------------------------ noite: aldeões vão dormir
  await page.evaluate(() => { const g = (window as any).__lavra.game; g.dayTime = 12500; });
  let sleeping = 0;
  for (let i = 0; i < 30 && sleeping === 0; i++) {
    await page.waitForTimeout(1000);
    sleeping = await page.evaluate(() => (window as any).__lavra.game.level.entities.list.filter((e: any) => e.type === 'villager' && e.sleeping).length);
  }
  expect(sleeping).toBeGreaterThan(0);

  // ------------------------------------------------ sentinela construída pelo jogador
  const golem = await page.evaluate(async () => {
    const g = (window as any).__lavra.game;
    const { S } = await import(String('/src/world/blocks/index.ts'));
    const p = g.player;
    const x = Math.floor(p.x) + 4, y = Math.floor(p.y) + 3, z = Math.floor(p.z);
    for (let dy = 0; dy < 4; dy++) for (let dx = -1; dx <= 1; dx++) g.world.setBlock(x + dx, y + dy, z, 0);
    g.level.setBlock(x, y, z, S('iron_block'));
    g.level.setBlock(x, y + 1, z, S('iron_block'));
    g.level.setBlock(x - 1, y + 1, z, S('iron_block'));
    g.level.setBlock(x + 1, y + 1, z, S('iron_block'));
    const before = g.level.entities.list.filter((e: any) => e.type === 'sentinela' && e.playerMade).length;
    g.level.setBlock(x, y + 2, z, S('carved_pumpkin'));
    const after = g.level.entities.list.filter((e: any) => e.type === 'sentinela' && e.playerMade).length;
    return { before, after, block: g.world.getBlock(x, y + 1, z) };
  });
  expect(golem.after).toBe(golem.before + 1);
  expect(golem.block).toBe(0);

  expect(errors).toEqual([]);
});
