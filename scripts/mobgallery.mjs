// Galeria de criaturas: sobe um servidor Vite próprio (sem recarga automática), abre o jogo com
// ?gallery=... no Chromium (GPU real) e salva capturas de 4 ângulos.
// Uso: node scripts/mobgallery.mjs --types=cow,sheep@color=black,horse@walk --out=tests/.out/galeria [--views=0,1,2,3,4] [--zoom=2]
// Ângulos: 0 = 3/4 de frente, 1 = frente, 2 = lado, 3 = costas, 4 = de cima. `@baby` = filhote, `@walk` = andando,
// `@campo=valor` muda um campo da criatura (ex.: sheep@sheared=true, pavio@swell=20).
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const types = args.types ?? 'cow,carnical';
const out = args.out ?? 'tests/.out/galeria';
const views = (args.views ?? '0,1,2,3').split(',').map(Number);
mkdirSync(dirname(resolve(root, out)), { recursive: true });

const server = await createServer({ root, logLevel: 'error', server: { port: 0, hmr: false, watch: null, strictPort: false } });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(args.w ?? 1280), height: Number(args.h ?? 720) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${port}/?seed=galeria&rd=4&zoom=${args.zoom ?? 1}&gallery=${encodeURIComponent(types)}`);
await page.waitForFunction(() => window.__gallery && window.__lavra.game.streamer.stats.meshQueue === 0 && window.__lavra.game.streamer.stats.meshInFlight === 0, null, { timeout: 120000, polling: 200 });
await page.waitForTimeout(1500);
const files = [];
for (const v of views) {
  await page.evaluate((i) => window.__gallery.view(i), v);
  await page.waitForTimeout(700);
  const f = resolve(root, `${out}_${v}.png`);
  await page.screenshot({ path: f });
  files.push(f);
}
await browser.close();
await server.close();
console.log(files.join('\n'));
if (errors.length) { console.log('ERROS:\n' + errors.join('\n')); process.exitCode = 1; }
