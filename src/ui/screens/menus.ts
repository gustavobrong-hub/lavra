/** Telas de menu: título (com o mundo ao fundo), pausa, novo mundo, gráficos e controles. */
import { h, type Screen } from '../ui';
import { drawLogo } from '../logo';
import { applyPreset, saveSettings, type Settings, type GraphicsSettings } from '../../settings';

function button(label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = h('button', cls, label);
  b.addEventListener('click', onClick);
  return b;
}

export type PlayMode = 'survival' | 'creative';

export interface TitleActions {
  play(mode: PlayMode): void;
  newWorld(seed: string, mode: PlayMode): void;
  graphics(): void;
  controls(): void;
}

/** Botões "Sobrevivência | Criativo" (segmentados). */
function modePicker(get: () => PlayMode, set: (m: PlayMode) => void): HTMLElement {
  const group = h('div', 'seg mode-seg');
  const opts: [PlayMode, string][] = [['survival', 'Sobrevivência'], ['creative', 'Criativo']];
  const btns = opts.map(([m, label]) => {
    const b = h('button', 'seg-btn', label);
    b.addEventListener('click', () => { set(m); refresh(); });
    group.append(b);
    return { m, b };
  });
  const refresh = () => { for (const { m, b } of btns) b.classList.toggle('on', m === get()); };
  refresh();
  return group;
}

export class TitleScreen implements Screen {
  readonly el: HTMLDivElement;
  readonly pauses = false;
  readonly freesMouse = true;

  constructor(a: TitleActions, initialMode: PlayMode = 'survival') {
    const logo = drawLogo('LAVRA', 18);
    logo.className = 'logo';
    let mode: PlayMode = initialMode;
    const seedIn = h('input', 'seed-input') as HTMLInputElement;
    seedIn.placeholder = 'semente (opcional)';
    seedIn.maxLength = 32;
    const newRow = h('div', 'new-world hidden', seedIn, button('Criar', () => a.newWorld(seedIn.value.trim(), mode)));
    this.el = h('div', 'screen title-screen',
      h('div', 'title-top', logo, h('div', 'tagline', 'sobreviver · construir · explorar')),
      h('div', 'menu-buttons',
        modePicker(() => mode, (m) => { mode = m; }),
        button('Jogar', () => a.play(mode), 'btn big primary'),
        button('Novo mundo', () => { newRow.classList.toggle('hidden'); if (!newRow.classList.contains('hidden')) seedIn.focus(); }, 'btn big'),
        newRow,
        h('div', 'menu-row',
          button('Gráficos', () => a.graphics(), 'btn'),
          button('Controles', () => a.controls(), 'btn'))),
      h('div', 'title-foot', 'Lavra 0.1 — texturas, criaturas e mundo gerados em código'));
    seedIn.addEventListener('keydown', (e) => { if (e.code === 'Enter') a.newWorld(seedIn.value.trim(), mode); e.stopPropagation(); });
  }

  onKey(e: KeyboardEvent): boolean { return e.code === 'Escape'; }
}

export interface PauseActions {
  resume(): void; graphics(): void; controls(): void; title(): void;
  mode(): PlayMode; setMode(m: PlayMode): void;
}

export class PauseScreen implements Screen {
  readonly el: HTMLDivElement;
  readonly pauses = true;
  readonly freesMouse = true;
  constructor(a: PauseActions) {
    this.el = h('div', 'screen pause-screen',
      h('div', 'pause-box',
        h('h2', '', 'Jogo pausado'),
        button('Voltar ao jogo', () => a.resume(), 'btn big primary'),
        h('div', 'pause-mode', h('span', 'set-label', 'Modo de jogo'), modePicker(() => a.mode(), (m) => a.setMode(m))),
        h('div', 'menu-row', button('Gráficos', () => a.graphics()), button('Controles', () => a.controls())),
        button('Tela inicial', () => a.title(), 'btn big')));
  }
}

// ------------------------------------------------------------------ configurações
type Opt<T> = [T, string];

function selectRow<T extends string | number | boolean>(label: string, opts: Opt<T>[], get: () => T, set: (v: T) => void): HTMLElement {
  const row = h('div', 'set-row', h('span', 'set-label', label));
  const group = h('div', 'seg');
  const btns = opts.map(([v, text]) => {
    const b = h('button', 'seg-btn', text);
    b.addEventListener('click', () => { set(v); refresh(); });
    group.append(b);
    return { v, b };
  });
  const refresh = () => { for (const { v, b } of btns) b.classList.toggle('on', v === get()); };
  refresh();
  (row as HTMLElement & { refresh?: () => void }).refresh = refresh;
  row.append(group);
  return row;
}

function sliderRow(label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string): HTMLElement {
  const val = h('span', 'set-value', fmt(get()));
  const input = h('input', 'set-slider') as HTMLInputElement;
  input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(get());
  input.addEventListener('input', () => { set(Number(input.value)); val.textContent = fmt(Number(input.value)); });
  const row = h('div', 'set-row', h('span', 'set-label', label), input, val);
  (row as HTMLElement & { refresh?: () => void }).refresh = () => { input.value = String(get()); val.textContent = fmt(get()); };
  return row;
}

export class GraphicsScreen implements Screen {
  readonly el: HTMLDivElement;
  readonly pauses = true;
  readonly freesMouse = true;
  constructor(private readonly s: Settings, onApply: () => void, onDone: () => void) {
    const g = s.graphics;
    const rows: HTMLElement[] = [];
    const changed = (custom = true) => {
      if (custom) g.preset = 'personalizado';
      saveSettings(s);
      onApply();
      for (const r of rows) (r as HTMLElement & { refresh?: () => void }).refresh?.();
    };
    const presetRow = selectRow<GraphicsSettings['preset']>('Qualidade', [['baixo', 'Baixa'], ['medio', 'Média'], ['alto', 'Alta'], ['ultra', 'Ultra'], ['personalizado', 'Pers.']], () => g.preset,
      (v) => { if (v !== 'personalizado') { applyPreset(g, v); changed(false); } });
    rows.push(presetRow,
      sliderRow('Distância de visão', 4, 24, 1, () => g.renderDistance, (v) => { g.renderDistance = v; changed(); }, (v) => `${v} chunks`),
      sliderRow('Campo de visão', 50, 110, 1, () => g.fov, (v) => { g.fov = v; changed(); }, (v) => `${v}°`),
      sliderRow('Brilho', 0, 1, 0.05, () => g.brightness, (v) => { g.brightness = v; changed(); }, (v) => `${Math.round(v * 100)}%`),
      sliderRow('Resolução', 0.5, 1, 0.05, () => g.renderScale, (v) => { g.renderScale = v; changed(); }, (v) => `${Math.round(v * 100)}%`),
      selectRow<GraphicsSettings['shadows']>('Sombras', [[0, 'Não'], [1, 'Baixas'], [2, 'Médias'], [3, 'Altas'], [4, 'Ultra']], () => g.shadows, (v) => { g.shadows = v; changed(); }),
      selectRow<GraphicsSettings['clouds']>('Nuvens', [[0, 'Não'], [1, 'Rápidas'], [2, 'Longe']], () => g.clouds, (v) => { g.clouds = v; changed(); }),
      selectRow<boolean>('Brilho e raios de sol', [[true, 'Sim'], [false, 'Não']], () => g.bloom, (v) => { g.bloom = v; g.volumetricLight = v && g.volumetricLight; changed(); }),
      selectRow<boolean>('Reflexos na água', [[true, 'Sim'], [false, 'Não']], () => g.ssr, (v) => { g.ssr = v; changed(); }),
      selectRow<GraphicsSettings['particles']>('Partículas', [[0, 'Mínimas'], [1, 'Menos'], [2, 'Todas']], () => g.particles, (v) => { g.particles = v; changed(); }),
      selectRow<boolean>('Exposição automática', [[true, 'Sim'], [false, 'Não']], () => g.autoExposure, (v) => { g.autoExposure = v; changed(); }),
      selectRow<boolean>('Balanço ao andar', [[true, 'Sim'], [false, 'Não']], () => g.viewBobbing, (v) => { g.viewBobbing = v; changed(); }));
    this.el = h('div', 'screen settings-screen',
      h('div', 'settings-box', h('h2', '', 'Gráficos'), h('div', 'set-list', ...rows), button('Concluir', onDone, 'btn big primary')));
  }
}

const CONTROLS: [string, string][] = [
  ['W A S D', 'andar'], ['Espaço', 'pular / nadar para cima'], ['Shift', 'agachar'], ['Ctrl', 'correr'],
  ['Botão esquerdo', 'quebrar / atacar'], ['Botão direito', 'usar / colocar'], ['Botão do meio', 'pegar bloco'],
  ['1–9 / roda', 'escolher item'], ['E', 'inventário'], ['Q', 'soltar item'], ['F', 'trocar de mão'],
  ['F5', 'câmera'], ['F1', 'esconder interface'], ['F3', 'depuração'], ['C', 'zoom'], ['Esc', 'pausa'],
];

export class ControlsScreen implements Screen {
  readonly el: HTMLDivElement;
  readonly pauses = true;
  readonly freesMouse = true;
  constructor(s: Settings, onDone: () => void) {
    const c = s.controls;
    const save = () => saveSettings(s);
    this.el = h('div', 'screen settings-screen',
      h('div', 'settings-box',
        h('h2', '', 'Controles'),
        h('div', 'set-list',
          sliderRow('Sensibilidade do mouse', 0, 1, 0.01, () => c.sensitivity, (v) => { c.sensitivity = v; save(); }, (v) => `${Math.round(v * 200)}%`),
          selectRow<boolean>('Inverter eixo Y', [[false, 'Não'], [true, 'Sim']], () => c.invertY, (v) => { c.invertY = v; save(); }),
          h('div', 'keys', ...CONTROLS.map(([k, d]) => h('div', 'key-row', h('kbd', '', k), h('span', '', d))))),
        button('Concluir', onDone, 'btn big primary')));
  }
}
