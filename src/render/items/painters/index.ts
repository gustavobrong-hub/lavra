/** Registro dos sprites de itens (16×16), por id de item. */
import type { Painter } from '../../textures/tex';
import { TOOL_SPRITES } from './tools';
import { ARMOR_SPRITES } from './armor';
import { FOOD_SPRITES } from './food';
import { MATERIAL_SPRITES } from './materials';
import { MISC_SPRITES } from './misc';

export const ITEM_SPRITES: Record<string, Painter> = {
  ...TOOL_SPRITES,
  ...ARMOR_SPRITES,
  ...FOOD_SPRITES,
  ...MATERIAL_SPRITES,
  ...MISC_SPRITES,
};
