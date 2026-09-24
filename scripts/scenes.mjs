// Captura as cenas de referência estética (uma instância do Vite e do navegador para todas).
// Uso: node scripts/scenes.mjs [--only=pantano,oceano] [--tag=antes] [--rd=8]
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const tag = args.tag ?? 'atual';
const rd = args.rd ?? '8';
// h: altura da câmera acima do chão (ou da água)
const SCENES = {
  pantano: { pos: '1000,70,-3992', time: 12450, yaw: 90, pitch: -4, h: 2.2 },
  oceano: { pos: '440,70,-12', time: 12950, yaw: 80, pitch: -4, h: 2.5 },
  neve: { pos: '612,128,468', time: 18000, yaw: 30, pitch: 8, h: 3 },
  dia: { pos: '804,72,-108', time: 4000, yaw: 200, pitch: 5, h: 6 },
  meiodia: { pos: '612,90,-60', time: 6000, yaw: 140, pitch: 12, h: 8 },
  mardourado: { pos: '440,70,-12', time: 12330, yaw: 90, pitch: -3, h: 2 },
  vila: { pos: '3576,70,-3112', time: 17500, yaw: 180, pitch: 14, h: 9 },
  vagalumes: { pos: '1000,70,-3992', time: 16000, yaw: 90, pitch: 2, h: 2 },
  chuva: { pos: '612,90,-60', time: 5000, yaw: 140, pitch: 8, h: 3, rain: 1 },
};
const only = args.only ? args.only.split(',') : Object.keys(SCENES);
const outDir = resolve(root, 'tests/.out/cenas');
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root, logLevel: 'error', server: { port: 0, hmr: false, watch: null, strictPort: false } });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(args.w ?? 1280), height: Number(args.h ?? 720) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
for (const name of only) {
  const s = SCENES[name];
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/?seed=lavra&mode=creative&rd=${rd}&pos=${s.pos}&time=${s.time}&yaw=${s.yaw}&pitch=${s.pitch}${args.extra ?? ''}`);
  await page.waitForFunction(() => { const g = window.__lavra?.game; if (!g) return false; const st = g.streamer.stats; return g.ready && st.genQueue === 0 && st.meshQueue === 0 && st.meshInFlight === 0 && st.loaded > 60; }, null, { timeout: 240000, polling: 250 });
  await page.evaluate(([T, yaw, pitch, h, rain]) => {
    const g = window.__lavra.game;
    const p = g.player;
    const x = Math.floor(p.x), z = Math.floor(p.z);
    let y = 300;
    while (y > -60 && g.world.getBlock(x, y, z) === 0) y--;
    p.setPos(x + 0.5, y + 1 + h - 1.62, z + 0.5);
    p.vx = p.vy = p.vz = 0;
    g.level.rules.doDaylightCycle = false; g.level.rules.doMobSpawning = false; g.level.rules.doWeatherCycle = false;
    g.dayTime = T; g.level.rainLevel = rain; g.level.thunderLevel = 0;
    g.player.flying = true;
    g.yaw = yaw; g.pitch = pitch;
    g.hud.setVisible(false); g.hideHand = true;
  }, [s.time, s.yaw, s.pitch, s.h, s.rain ?? 0]);
  if (args.js) await page.evaluate(args.js);
  await page.waitForTimeout(Number(args.wait ?? 2500));
  const out = resolve(outDir, `${name}-${tag}.png`);
  await page.screenshot({ path: out });
  const fps = await page.evaluate(() => { const g = window.__lavra.game; return g.pipeline?.stats ?? null; });
  const ex = await page.evaluate(() => window.__lavra.game.pipeline.debugExposure());
  if (args.fps) {
    const fps = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t0 = performance.now();
      const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res((n / (performance.now() - t0)) * 1000); };
      requestAnimationFrame(f);
    }));
    console.log(`  ${name}: ${fps.toFixed(1)} FPS`);
  }
  console.log(`${name}: ${out} (${((Date.now() - t0) / 1000).toFixed(1)} s) ${JSON.stringify(fps)} exp=${JSON.stringify(ex)}`);
}
await browser.close();
await server.close();
if (errors.length) { console.log('ERROS:\n' + [...new Set(errors)].slice(0, 10).join('\n')); process.exitCode = 1; }
