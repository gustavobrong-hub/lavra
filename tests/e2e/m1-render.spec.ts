import { test, expect } from '@playwright/test';
import { trackErrors, waitWorldReady } from './helpers';

test('M1: mundo carrega e renderiza sem erros', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=lavra&time=2000&pos=-40,90,30&pitch=-20&yaw=200&debug=1');
  await waitWorldReady(page, 150);
  const info = await page.evaluate(() => {
    const g = (window as any).__lavra.game;
    return { gpu: g.pipeline.caps.gpu, fps: g.fps, drawn: g.pipeline.chunks.stats.drawn, loaded: g.streamer.stats.loaded, gen: g.streamer.stats.genMsAvg, mesh: g.streamer.stats.meshMsAvg };
  });
  console.log(JSON.stringify(info));
  expect(info.drawn).toBeGreaterThan(50);
  await page.screenshot({ path: 'tests/e2e/.results/m1-render.png' });
  expect(errors).toEqual([]);
});
