// Captura de tela do jogo com servidor Vite próprio (sem recarga): útil para conferir mundos e estruturas.
// Uso: node scripts/shot.mjs --q="seed=lavra&pos=552,110,328&pitch=40&yaw=30&time=6000" --out=tests/.out/vila.png [--wait=2000] [--js="código extra"]
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const out = resolve(root, args.out ?? 'tests/.out/shot.png');
mkdirSync(dirname(out), { recursive: true });
const server = await createServer({ root, logLevel: 'error', server: { port: 0, hmr: false, watch: null, strictPort: false } });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(args.w ?? 1280), height: Number(args.h ?? 720) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${port}/?${args.q ?? 'seed=lavra'}`);
await page.waitForFunction(() => { const g = window.__lavra?.game; if (!g) return false; const s = g.streamer.stats; return g.ready && s.genQueue === 0 && s.meshQueue === 0 && s.meshInFlight === 0 && s.loaded > 60; }, null, { timeout: 180000, polling: 250 });
if (args.js) await page.evaluate(args.js);
await page.waitForTimeout(Number(args.wait ?? 1500));
await page.evaluate(() => { const g = window.__lavra.game; g.hud.setVisible(false); g.hideHand = true; });
await page.waitForTimeout(300);
await page.screenshot({ path: out });
if (args.info) console.log(await page.evaluate(args.info));
await browser.close();
await server.close();
console.log(out);
if (errors.length) { console.log('ERROS:\n' + errors.slice(0, 10).join('\n')); process.exitCode = 1; }
