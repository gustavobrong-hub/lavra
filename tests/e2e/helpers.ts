import type { Page } from '@playwright/test';

export interface LavraWindow { __lavra?: { game: any } }

/** Coleta erros do console e da página. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** Espera o mundo ao redor ficar pronto (colunas carregadas e malhas em dia). */
export async function waitWorldReady(page: Page, minLoaded = 100, timeout = 90_000): Promise<void> {
  await page.waitForFunction((min) => {
    const g = (window as unknown as LavraWindow).__lavra?.game;
    if (!g) return false;
    const st = g.streamer.stats;
    return st.loaded >= min && st.meshQueue < 8 && st.meshInFlight === 0 && st.genQueue === 0;
  }, minLoaded, { timeout, polling: 250 });
  await page.waitForTimeout(400);
}
