/** Registro de todos os pintores de textura de bloco, por nome. */
import type { Painter } from '../tex';
import { NATURAL_PAINTERS } from './natural';
import { COLOR_PAINTERS } from './colors';
import { BUILDING_PAINTERS } from './building';
import { INFERO_PAINTERS } from './infero';
import { PLANT_PAINTERS } from './plants';
import { CROP_PAINTERS } from './crops';
import { WOODPART_PAINTERS } from './woodparts';
import { FULGOR_PAINTERS } from './fulgor';
import { UTILITY_PAINTERS } from './utility';
import { ANIMATED_PAINTERS } from './animated';

export const PAINTERS: Record<string, Painter> = {
  ...NATURAL_PAINTERS,
  ...COLOR_PAINTERS,
  ...BUILDING_PAINTERS,
  ...INFERO_PAINTERS,
  ...PLANT_PAINTERS,
  ...CROP_PAINTERS,
  ...WOODPART_PAINTERS,
  ...FULGOR_PAINTERS,
  ...UTILITY_PAINTERS,
  ...ANIMATED_PAINTERS,
};
