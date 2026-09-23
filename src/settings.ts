/** Configurações do jogo (gráficos, controles, áudio), com presets e persistência local. */

export type Preset = 'baixo' | 'medio' | 'alto' | 'ultra' | 'personalizado';

export interface GraphicsSettings {
  preset: Preset;
  renderDistance: number;
  renderScale: number;
  maxPixelRatio: number;
  shadows: 0 | 1 | 2 | 3 | 4; // 0 desligado … 4 ultra
  shadowDistance: number;
  clouds: 0 | 1 | 2; // desligado, rápidas, volumétricas
  volumetricLight: boolean;
  ssr: boolean;
  ssao: boolean;
  bloom: boolean;
  aa: 'off' | 'fxaa' | 'taa';
  dof: boolean;
  motionBlur: boolean;
  fancyLeaves: boolean;
  caveCulling: boolean;
  particles: 0 | 1 | 2;
  aoStrength: number;
  autoExposure: boolean;
  fov: number;
  viewBobbing: boolean;
  brightness: number;
  maxFps: number;
}

export interface ControlSettings {
  sensitivity: number;
  invertY: boolean;
  keys: Record<string, string>;
  toggleSprint: boolean;
  toggleSneak: boolean;
}

export interface AudioSettings {
  master: number;
  music: number;
  blocks: number;
  hostile: number;
  friendly: number;
  weather: number;
  ambient: number;
  players: number;
  ui: number;
}

export interface Settings {
  graphics: GraphicsSettings;
  controls: ControlSettings;
  audio: AudioSettings;
  guiScale: number;
  showFps: boolean;
}

export const PRESETS: Record<Exclude<Preset, 'personalizado'>, Partial<GraphicsSettings>> = {
  baixo: { renderDistance: 6, renderScale: 0.75, maxPixelRatio: 1, shadows: 0, shadowDistance: 48, clouds: 1, volumetricLight: false, ssr: false, ssao: false, bloom: false, aa: 'fxaa', fancyLeaves: false, particles: 1, autoExposure: false },
  medio: { renderDistance: 10, renderScale: 1, maxPixelRatio: 1, shadows: 2, shadowDistance: 96, clouds: 1, volumetricLight: false, ssr: false, ssao: false, bloom: true, aa: 'fxaa', fancyLeaves: true, particles: 2, autoExposure: true },
  alto: { renderDistance: 14, renderScale: 1, maxPixelRatio: 1.5, shadows: 3, shadowDistance: 128, clouds: 2, volumetricLight: true, ssr: true, ssao: true, bloom: true, aa: 'taa', fancyLeaves: true, particles: 2, autoExposure: true },
  ultra: { renderDistance: 20, renderScale: 1, maxPixelRatio: 2, shadows: 4, shadowDistance: 192, clouds: 2, volumetricLight: true, ssr: true, ssao: true, bloom: true, aa: 'taa', fancyLeaves: true, particles: 2, autoExposure: true },
};

export const DEFAULT_KEYS: Record<string, string> = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft', sprint: 'ControlLeft',
  inventory: 'KeyE', drop: 'KeyQ', chat: 'KeyT', command: 'Slash', playerList: 'Tab', perspective: 'F5',
  debug: 'F3', screenshot: 'F2', hideGui: 'F1', swapHands: 'KeyF', pickBlock: 'Mouse1', attack: 'Mouse0', use: 'Mouse2',
  hotbar1: 'Digit1', hotbar2: 'Digit2', hotbar3: 'Digit3', hotbar4: 'Digit4', hotbar5: 'Digit5', hotbar6: 'Digit6',
  hotbar7: 'Digit7', hotbar8: 'Digit8', hotbar9: 'Digit9', zoom: 'KeyC',
};

export function defaultSettings(): Settings {
  return {
    graphics: {
      preset: 'medio', renderDistance: 10, renderScale: 1, maxPixelRatio: 1, shadows: 2, shadowDistance: 96,
      clouds: 1, volumetricLight: false, ssr: false, ssao: false, bloom: true, aa: 'fxaa', dof: false, motionBlur: false,
      fancyLeaves: true, caveCulling: true, particles: 2, aoStrength: 1, autoExposure: true, fov: 70, viewBobbing: true,
      brightness: 0.5, maxFps: 0,
    },
    controls: { sensitivity: 0.5, invertY: false, keys: { ...DEFAULT_KEYS }, toggleSprint: false, toggleSneak: false },
    audio: { master: 0.8, music: 0.5, blocks: 1, hostile: 1, friendly: 1, weather: 1, ambient: 1, players: 1, ui: 0.7 },
    guiScale: 2,
    showFps: false,
  };
}

const KEY = 'lavra.settings.v1';

export function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      ...d, ...s,
      graphics: { ...d.graphics, ...(s.graphics ?? {}) },
      controls: { ...d.controls, ...(s.controls ?? {}), keys: { ...d.controls.keys, ...(s.controls?.keys ?? {}) } },
      audio: { ...d.audio, ...(s.audio ?? {}) },
    };
  } catch {
    return d;
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* armazenamento indisponível */ }
}

export function applyPreset(g: GraphicsSettings, p: Exclude<Preset, 'personalizado'>): void {
  Object.assign(g, PRESETS[p]);
  g.preset = p;
}

/** Escolhe o preset inicial pela GPU detectada. */
export function suggestPreset(gpu: string, cores: number): Exclude<Preset, 'personalizado'> {
  const g = gpu.toLowerCase();
  if (/swiftshader|llvmpipe|software|microsoft basic/.test(g)) return 'baixo';
  if (/rtx|radeon rx|apple m[2-9] (pro|max|ultra)|m[3-9] max|arc a7/.test(g)) return 'alto';
  if (/apple m\d|geforce|radeon|arc/.test(g)) return 'medio';
  if (/intel|uhd|iris|mali|adreno|powervr/.test(g)) return cores >= 8 ? 'medio' : 'baixo';
  return 'medio';
}
