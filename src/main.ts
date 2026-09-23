/** Ponto de entrada: detecta recursos, carrega configurações e inicia o jogo. */
import './ui/styles.css';
import { Game } from './game/game';
import { seedFromString } from './core/rng';
import { loadSettings, applyPreset, suggestPreset, type Preset } from './settings';

const params = new URLSearchParams(location.search);

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLDivElement;
  const gl2 = document.createElement('canvas').getContext('webgl2');
  if (!gl2) {
    ui.innerHTML = '<div class="fatal"><h1>Lavra</h1><p>Seu navegador não tem WebGL2 disponível. Atualize o navegador ou ative a aceleração de hardware.</p></div>';
    return;
  }
  const settings = loadSettings();
  const preset = params.get('preset') as Preset | null;
  if (preset && preset !== 'personalizado') applyPreset(settings.graphics, preset);
  else if (!localStorage.getItem('lavra.settings.v1')) {
    const dbg = gl2.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? String(gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    applyPreset(settings.graphics, suggestPreset(gpu, navigator.hardwareConcurrency || 4));
  }
  const rd = params.get('rd');
  if (rd) settings.graphics.renderDistance = Math.max(2, Math.min(32, parseInt(rd, 10)));
  const seed = seedFromString(params.get('seed') ?? 'lavra');
  const time = params.has('time') ? parseInt(params.get('time')!, 10) : 1000;
  const spawnParam = params.get('pos');
  const spawn = spawnParam ? (spawnParam.split(',').map(Number) as [number, number, number]) : undefined;
  const mode = (params.get('mode') as 'survival' | 'creative' | null) ?? 'survival';
  const game = new Game(canvas, ui, settings, { seed, time, spawn, mode });
  if (params.has('pitch')) game.pitch = parseFloat(params.get('pitch')!);
  if (params.has('yaw')) game.yaw = parseFloat(params.get('yaw')!);
  if (params.has('kit')) {
    for (const id of ['stone', 'oak_planks', 'oak_log', 'glass', 'torch', 'oak_stairs', 'oak_slab', 'oak_door', 'sand']) game.give(id, 64);
    game.give('diamond_pickaxe'); game.give('diamond_shovel'); game.give('diamond_axe');
  }
  if (params.has('debug')) game.debug.toggle();
  (window as unknown as { __lavra: unknown }).__lavra = { game };
  canvas.addEventListener('click', () => game.input.requestLock());
  game.start();
}

boot();
