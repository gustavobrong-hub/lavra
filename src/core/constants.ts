/** Constantes globais do mundo — mesmos números da versão moderna do jogo de referência. */
export const CHUNK_SIZE = 16;
export const CHUNK_SHIFT = 4;
export const CHUNK_MASK = 15;
export const MIN_Y = -64;
export const MAX_Y = 320; // exclusivo
export const WORLD_HEIGHT = MAX_Y - MIN_Y; // 384
export const SECTION_COUNT = WORLD_HEIGHT >> 4; // 24
export const SECTION_VOLUME = 4096;
export const SEA_LEVEL = 63;
export const LAVA_LEVEL = -54; // cavernas abaixo disto enchem de lava

export const TICKS_PER_SECOND = 20;
export const TICK_MS = 1000 / TICKS_PER_SECOND;
export const DAY_TICKS = 24000;

/** Direções no mesmo ordinal do original: baixo, cima, norte(-Z), sul(+Z), oeste(-X), leste(+X). */
export const DOWN = 0, UP = 1, NORTH = 2, SOUTH = 3, WEST = 4, EAST = 5;
export const DIR_X = [0, 0, 0, 0, -1, 1] as const;
export const DIR_Y = [-1, 1, 0, 0, 0, 0] as const;
export const DIR_Z = [0, 0, -1, 1, 0, 0] as const;
export const OPPOSITE = [1, 0, 3, 2, 5, 4] as const;
export const DIR_NAMES = ['down', 'up', 'north', 'south', 'west', 'east'] as const;
/** Direções horizontais na ordem de rotação (sul, oeste, norte, leste) = yaw 0, 90, 180, 270. */
export const HORIZONTALS = [SOUTH, WEST, NORTH, EAST] as const;

export const DIM_OVERWORLD = 0;
export const DIM_INFERO = 1;
