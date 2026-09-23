/**
 * Construções das vilas (coordenadas locais: x à direita, z para a frente, frente/porta em z = d−1).
 * Casas de três tamanhos, oficinas de cada profissão (com o bloco de trabalho), capela, biblioteca,
 * fazendas com canal de água, currais, poço e postes de luz.
 */
import type { Build } from './builder';
import type { SpawnHint } from '../overworld';
import type { Chunk } from '../../chunk';

export interface TplCtx {
  chunk: Chunk;
  spawns: SpawnHint[];
  /** aleatório determinístico da construção */
  r: () => number;
  /** o chunk-alvo contém o "ponto de spawn" da construção? (evita criaturas duplicadas) */
  spawnHere(x: number, y: number, z: number): boolean;
  style: string;
}

export interface Template {
  id: string;
  w: number; d: number; h: number;
  weight: number;
  max: number;
  /** profissão do bloco de trabalho principal */
  job?: string;
  build(b: Build, c: TplCtx): void;
}

const JOB_BLOCK: Record<string, string> = {
  armeiro: 'blast_furnace', ferramenteiro: 'smithing_table', espadeiro: 'grindstone', pedreiro: 'stonecutter',
  curtidor: 'cauldron', acougueiro: 'smoker', cartografo: 'cartography_table', flecheiro: 'fletching_table',
  pastor: 'loom', pescador: 'barrel', clerigo: 'brewing_stand', bibliotecario: 'lectern', fazendeiro: 'composter',
};

function villager(b: Build, c: TplCtx, x: number, y: number, z: number, profession: string, bed?: [number, number, number]): void {
  const [wx, wy, wz] = b.world(x, y, z);
  if (!c.spawnHere(wx, wy, wz)) return;
  c.spawns.push({ type: 'villager', x: wx + 0.5, y: wy, z: wz + 0.5, count: 1, data: { profession, style: c.style, bed } });
}

/** Chão, alicerce e paredes com cantos de tora; limpa o interior. */
function shell(b: Build, w: number, d: number, h: number): void {
  const p = b.pal;
  b.foundation(0, 0, w - 1, d - 1, p.foundation);
  b.fill(0, 0, 0, w - 1, 0, d - 1, p.foundation);
  b.fill(1, 0, 1, w - 2, 0, d - 2, p.floor);
  b.clear(0, 1, 0, w - 1, h + 4, d - 1);
  b.walls(0, 1, 0, w - 1, h, d - 1, p.wall);
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) b.fill(x, 1, z, x, h, z, p.log, { axis: 'y' });
  // viga superior
  for (let x = 0; x < w; x++) { b.put(x, h, 0, p.log, { axis: 'x' }); b.put(x, h, d - 1, p.log, { axis: 'x' }); }
  for (let z = 1; z < d - 1; z++) { b.put(0, h, z, p.log, { axis: 'z' }); b.put(w - 1, h, z, p.log, { axis: 'z' }); }
}

function window(b: Build, x: number, y: number, z: number): void { b.put(x, y, z, b.pal.glass); }

/** Telhado + oitões (paredes triangulares) nas laterais. */
function roof(b: Build, w: number, d: number, h: number): void {
  const p = b.pal;
  b.gableRoof(-1, w, -1, d, h + 1, p.roof);
  const half = Math.floor((d + 1) / 2);
  for (let i = 0; i < half; i++) for (let z = i; z <= d - 1 - i; z++) {
    if (i === 0) continue;
    b.put(0, h + i, z, p.wallAlt); b.put(w - 1, h + i, z, p.wallAlt);
  }
}

/** Tocha de parede: `facing` aponta para longe da parede de apoio. */
function light(b: Build, x: number, y: number, z: number, facing: string): void {
  b.put(x, y, z, 'wall_torch', { facing });
}

// ------------------------------------------------------------------ casas
const casaPequena: Template = {
  id: 'casa_pequena', w: 5, d: 5, h: 3, weight: 10, max: 7,
  build(b, c) {
    shell(b, 5, 5, 3);
    b.door(2, 1, 4);
    window(b, 0, 2, 2); window(b, 4, 2, 2); window(b, 2, 2, 0);
    roof(b, 5, 5, 3);
    const bed = b.bed(1, 1, 2, 'north');
    b.put(3, 1, 1, 'crafting_table');
    light(b, 3, 3, 3, 'north');
    b.put(3, 1, 3, 'flower_pot');
    villager(b, c, 2, 1, 2, 'nenhuma', bed);
  },
};

const casaMedia: Template = {
  id: 'casa_media', w: 7, d: 6, h: 3, weight: 8, max: 5,
  build(b, c) {
    shell(b, 7, 6, 3);
    b.door(3, 1, 5);
    window(b, 1, 2, 5); window(b, 5, 2, 5); window(b, 0, 2, 2); window(b, 6, 2, 2); window(b, 2, 2, 0); window(b, 4, 2, 0);
    roof(b, 7, 6, 3);
    const b1 = b.bed(1, 1, 2, 'north');
    const b2 = b.bed(5, 1, 2, 'north');
    b.put(3, 1, 1, 'chest', { facing: 'south' });
    b.entity(c.chunk, 3, 1, 1, { type: 'chest', loot: `vila_${c.style}` });
    b.put(1, 1, 4, 'crafting_table');
    b.fill(2, 1, 3, 4, 1, 3, b.pal.carpet);
    light(b, 3, 3, 4, 'north');
    villager(b, c, 2, 1, 3, 'nenhuma', b1);
    villager(b, c, 4, 1, 3, 'nenhuma', b2);
  },
};

const casaGrande: Template = {
  id: 'casa_grande', w: 9, d: 7, h: 6, weight: 4, max: 2,
  build(b, c) {
    shell(b, 9, 7, 6);
    b.door(4, 1, 6);
    for (const x of [1, 2, 6, 7]) { window(b, x, 2, 6); window(b, x, 5, 6); window(b, x, 2, 0); window(b, x, 5, 0); }
    window(b, 0, 2, 3); window(b, 8, 2, 3); window(b, 0, 5, 3); window(b, 8, 5, 3);
    // segundo andar com escada de mão
    b.fill(1, 3, 1, 7, 3, 5, b.pal.planks);
    b.clear(7, 3, 1, 7, 3, 1);
    b.fill(7, 1, 1, 7, 3, 1, 'ladder', { facing: 'south' });
    roof(b, 9, 7, 6);
    const b1 = b.bed(1, 4, 2, 'north');
    const b2 = b.bed(3, 4, 2, 'north');
    const b3 = b.bed(5, 4, 2, 'north');
    b.put(1, 1, 1, 'furnace', { facing: 'south' });
    b.put(2, 1, 1, 'crafting_table');
    b.put(3, 1, 1, 'chest', { facing: 'south' });
    b.entity(c.chunk, 3, 1, 1, { type: 'chest', loot: `vila_${c.style}` });
    b.fill(3, 1, 3, 5, 1, 4, b.pal.carpet);
    light(b, 4, 2, 5, 'north'); light(b, 4, 5, 5, 'north');
    villager(b, c, 2, 1, 3, 'nenhuma', b1);
    villager(b, c, 4, 1, 3, 'nenhuma', b2);
    villager(b, c, 6, 1, 3, 'nenhuma', b3);
  },
};

// ------------------------------------------------------------------ oficinas
function oficina(job: string, extra?: (b: Build, c: TplCtx) => void): Template {
  return {
    id: `oficina_${job}`, w: 7, d: 7, h: 4, weight: 1, max: 1, job,
    build(b, c) {
      const p = b.pal;
      b.foundation(0, 0, 6, 6, p.foundation);
      b.fill(0, 0, 0, 6, 0, 6, p.stone);
      b.clear(0, 1, 0, 6, 8, 6);
      // meia parede de pedra, pilares de tora, frente aberta com cerca
      b.walls(0, 1, 0, 6, 1, 6, p.stone);
      b.walls(0, 2, 0, 6, 4, 4, p.wallAlt);
      for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6], [0, 4], [6, 4]]) b.fill(x, 1, z, x, 4, z, p.log, { axis: 'y' });
      b.clear(1, 1, 6, 5, 1, 6);
      for (const x of [1, 5]) b.put(x, 1, 6, p.fence);
      b.fill(0, 5, 0, 6, 5, 6, p.slab, { type: 'bottom' });
      b.fill(1, 4, 5, 5, 4, 6, p.slab, { type: 'top' });
      window(b, 3, 3, 0); window(b, 0, 3, 2); window(b, 6, 3, 2);
      b.put(3, 1, 2, JOB_BLOCK[job], { facing: 'south' });
      b.put(1, 1, 1, 'chest', { facing: 'south' });
      b.entity(c.chunk, 1, 1, 1, { type: 'chest', loot: `oficina_${job}` });
      light(b, 5, 3, 1, 'south');
      extra?.(b, c);
      if (c.r() < 0.5) villager(b, c, 3, 1, 4, job);
    },
  };
}

const capela: Template = {
  id: 'capela', w: 7, d: 11, h: 6, weight: 2, max: 1, job: 'clerigo',
  build(b, c) {
    const p = b.pal;
    shell(b, 7, 11, 6);
    b.walls(0, 1, 0, 6, 1, 10, p.stone);
    b.door(3, 1, 10);
    for (const z of [3, 5, 7]) { b.put(0, 3, z, 'yellow_stained_glass_pane'); b.put(6, 3, z, 'yellow_stained_glass_pane'); b.put(0, 4, z, 'blue_stained_glass_pane'); b.put(6, 4, z, 'blue_stained_glass_pane'); }
    b.put(3, 4, 0, 'red_stained_glass_pane');
    roof(b, 7, 11, 6);
    // torre do sino na frente
    b.fill(2, 7, 9, 4, 9, 10, p.stone);
    b.clear(3, 8, 9, 3, 8, 10);
    b.put(3, 8, 10, 'bell', { facing: 'south' });
    b.put(3, 1, 2, 'brewing_stand');
    for (const z of [5, 6, 7]) { b.put(1, 1, z, p.stairs, { facing: 'south' }); b.put(5, 1, z, p.stairs, { facing: 'south' }); }
    b.put(2, 1, 1, 'chest', { facing: 'south' });
    b.entity(c.chunk, 2, 1, 1, { type: 'chest', loot: 'oficina_clerigo' });
    light(b, 1, 4, 4, 'east'); light(b, 5, 4, 8, 'west');
    villager(b, c, 3, 1, 4, 'clerigo');
  },
};

const biblioteca: Template = {
  id: 'biblioteca', w: 9, d: 7, h: 4, weight: 2, max: 1, job: 'bibliotecario',
  build(b, c) {
    const p = b.pal;
    shell(b, 9, 7, 4);
    b.door(4, 1, 6);
    window(b, 2, 2, 6); window(b, 6, 2, 6);
    roof(b, 9, 7, 4);
    for (let x = 1; x <= 7; x++) { b.put(x, 1, 1, 'bookshelf'); b.put(x, 2, 1, 'bookshelf'); }
    for (const z of [2, 3, 4]) { b.put(1, 1, z, 'bookshelf'); b.put(7, 1, z, 'bookshelf'); }
    b.put(4, 1, 3, 'lectern', { facing: 'south' });
    b.put(2, 1, 4, p.stairs, { facing: 'west' });
    b.put(6, 1, 4, 'crafting_table');
    light(b, 4, 3, 5, 'north');
    villager(b, c, 3, 1, 4, 'bibliotecario');
    void p;
  },
};

// ------------------------------------------------------------------ fazendas, curral, postes
function fazenda(w: number, channels: number[]): Template {
  return {
    id: `fazenda_${w}`, w, d: 9, h: 1, weight: 6, max: 3, job: 'fazendeiro',
    build(b, c) {
      const p = b.pal;
      b.foundation(0, 0, w - 1, 8, 'dirt');
      b.clear(0, 1, 0, w - 1, 3, 8);
      b.fill(0, 0, 0, w - 1, 0, 8, p.log, { axis: 'x' });
      const crop = p.crops[Math.floor(c.r() * p.crops.length)];
      const maxAge = crop === 'beetroots' ? 3 : 7;
      for (let x = 1; x < w - 1; x++) for (let z = 1; z < 8; z++) {
        if (channels.includes(x)) { b.put(x, 0, z, 'water'); continue; }
        b.put(x, 0, z, 'farmland', { moisture: 7 });
        const age = Math.floor(c.r() * (maxAge + 1));
        b.put(x, 1, z, crop, { age });
      }
      b.put(0, 1, 8, 'composter', { level: Math.floor(c.r() * 5) });
      if (c.r() < 0.4) villager(b, c, 0, 1, 7, 'fazendeiro');
    },
  };
}

const curral: Template = {
  id: 'curral', w: 7, d: 7, h: 2, weight: 3, max: 2,
  build(b, c) {
    const p = b.pal;
    b.foundation(0, 0, 6, 6, 'dirt');
    b.fill(0, 0, 0, 6, 0, 6, 'grass_block');
    b.clear(0, 1, 0, 6, 3, 6);
    for (let i = 0; i <= 6; i++) { b.put(i, 1, 0, p.fence); b.put(i, 1, 6, p.fence); b.put(0, 1, i, p.fence); b.put(6, 1, i, p.fence); }
    b.put(3, 1, 6, `${p.fence}_gate`, { facing: 'south' });
    b.put(1, 1, 1, 'hay_block', { axis: 'y' });
    b.put(5, 1, 1, 'water');
    const [wx, wy, wz] = b.world(3, 1, 3);
    if (c.spawnHere(wx, wy, wz)) {
      const kind = ['cow', 'sheep', 'pig', 'chicken'][Math.floor(c.r() * 4)];
      c.spawns.push({ type: kind, x: wx + 0.5, y: wy, z: wz + 0.5, count: 2 + Math.floor(c.r() * 3), data: { pen: true } });
    }
  },
};

const poste: Template = {
  id: 'poste', w: 1, d: 1, h: 3, weight: 5, max: 10,
  build(b) {
    const p = b.pal;
    b.foundation(0, 0, 0, 0, p.foundation, 4);
    b.put(0, 0, 0, p.foundation);
    b.fill(0, 1, 0, 0, 2, 0, p.fence);
    if (p.light === 'lantern') b.put(0, 3, 0, 'lantern');
    else b.put(0, 3, 0, 'torch');
  },
};

export const TEMPLATES: Template[] = [
  casaPequena, casaMedia, casaGrande,
  oficina('armeiro', (b) => { b.put(5, 1, 3, 'anvil', { facing: 'east' }); }),
  oficina('ferramenteiro'), oficina('espadeiro'), oficina('pedreiro', (b) => { b.fill(5, 1, 2, 5, 1, 3, 'stone_bricks'); }),
  oficina('curtidor', (b) => { b.put(5, 1, 3, 'cauldron', { level: 3 }); }),
  oficina('acougueiro', (b) => { b.put(5, 1, 3, 'smoker', { facing: 'west' }); }),
  oficina('cartografo', (b) => { b.put(5, 1, 3, 'white_carpet'); }),
  oficina('flecheiro', (b) => { b.put(5, 1, 3, 'hay_block', { axis: 'y' }); }),
  oficina('pastor', (b) => { b.put(5, 1, 3, 'white_wool'); b.put(5, 2, 3, 'light_gray_wool'); }),
  oficina('pescador', (b) => { b.put(5, 1, 3, 'water'); }),
  capela, biblioteca,
  fazenda(7, [3]), fazenda(13, [3, 9]),
  curral, poste,
];

// ------------------------------------------------------------------ praça (poço + sino + postes)
export function buildPlaza(b: Build, c: TplCtx): void {
  const p = b.pal;
  // chão 11×11 de caminho
  b.foundation(-5, -5, 5, 5, p.foundation, 6);
  b.fill(-5, 0, -5, 5, 0, 5, p.path);
  b.clear(-5, 1, -5, 5, 5, 5);
  // poço 3×3 com água, beira de pedra e telhado
  b.fill(-2, -4, -2, 2, 0, 2, p.foundation);
  b.fill(-1, -3, -1, 1, 0, 1, 'water');
  b.walls(-2, 1, -2, 2, 1, 2, p.stone);
  b.fill(-1, 1, -1, 1, 1, 1, 0);
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) b.fill(x, 2, z, x, 3, z, p.fence);
  b.fill(-2, 4, -2, 2, 4, 2, p.slab, { type: 'bottom' });
  b.put(0, 3, 0, 'lantern', { hanging: true });
  // sino num poste
  b.fill(4, 1, 4, 4, 2, 4, p.log, { axis: 'y' });
  b.put(4, 3, 4, p.slab, { type: 'bottom' });
  b.put(3, 2, 4, 'bell', { facing: 'east' });
  // postes nos cantos
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5]]) {
    b.fill(x, 1, z, x, 2, z, p.fence);
    b.put(x, 3, z, p.light === 'lantern' ? 'lantern' : 'torch');
  }
  const [wx, wy, wz] = b.world(0, 1, 3);
  if (c.spawnHere(wx, wy, wz)) {
    c.spawns.push({ type: 'sentinela', x: wx + 3.5, y: wy, z: wz + 0.5, count: 1 });
    if (c.r() < 0.7) c.spawns.push({ type: 'cat', x: wx - 2.5, y: wy, z: wz + 1.5, count: 1 + Math.floor(c.r() * 2) });
  }
}
