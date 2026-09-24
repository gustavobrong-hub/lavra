import { test, expect } from '@playwright/test';
import { trackErrors, waitWorldReady } from './helpers';

test('M16: tela inicial com o mundo ao fundo, gráficos e começo do jogo', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('.title-screen')).toBeVisible();
  await waitWorldReady(page, 80);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/e2e/.results/m16-titulo.png' });
  // gráficos: troca de qualidade e volta
  await page.getByRole('button', { name: 'Gráficos' }).click();
  await expect(page.locator('.settings-box h2')).toHaveText('Gráficos');
  await page.getByRole('button', { name: 'Baixa', exact: true }).click();
  const g1 = await page.evaluate(() => (window as any).__lavra.game.settings.graphics.preset);
  expect(g1).toBe('baixo');
  await page.getByRole('button', { name: 'Alta', exact: true }).click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.locator('.title-screen')).toBeVisible();
  // jogar: a vitrine termina, a interface volta e o tempo vai para a manhã
  await page.getByRole('button', { name: 'Jogar' }).click();
  await expect(page.locator('.title-screen')).toHaveCount(0);
  const st = await page.evaluate(() => { const g = (window as any).__lavra.game; return { mode: g.player.gameMode, day: g.dayTime % 24000, open: g.ui.isOpen }; });
  expect(st.mode).toBe('survival');
  expect(st.day).toBeLessThan(1400);
  expect(st.open).toBe(false);
  expect(errors.filter((e) => !/pointer ?lock|WrongDocument/i.test(e))).toEqual([]);
});

test('M16: escolher Criativo na tela inicial e trocar de modo na pausa', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('.title-screen')).toBeVisible();
  await waitWorldReady(page, 80);
  await page.getByRole('button', { name: 'Criativo', exact: true }).click();
  await page.getByRole('button', { name: 'Jogar' }).click();
  await expect(page.locator('.title-screen')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__lavra.game.player.gameMode)).toBe('creative');
  // pausa: volta para Sobrevivência
  await page.evaluate(() => (window as any).__lavra.game.openPause());
  await expect(page.locator('.pause-box')).toBeVisible();
  await page.getByRole('button', { name: 'Sobrevivência', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__lavra.game.player.gameMode)).toBe('survival');
  await page.getByRole('button', { name: 'Voltar ao jogo' }).click();
  await expect(page.locator('.pause-box')).toHaveCount(0);
  expect(errors.filter((e) => !/pointer ?lock|WrongDocument/i.test(e))).toEqual([]);
});
