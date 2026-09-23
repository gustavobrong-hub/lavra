import type { ToolKind } from '../../world/blocks/types';

export type ItemTab = 'build' | 'nature' | 'deco' | 'fulgor' | 'util' | 'tools' | 'combat' | 'food' | 'materials' | 'misc' | 'none';
export type ArmorSlot = 'head' | 'chest' | 'legs' | 'feet';

export interface ToolInfo {
  kind: ToolKind;
  /** nível de colheita: 0 madeira/ouro, 1 pedra, 2 ferro, 3 diamante, 4 ígneo */
  tier: number;
  /** multiplicador de velocidade de mineração do material */
  speed: number;
}

export interface FoodInfo {
  hunger: number;
  saturation: number;
  alwaysEdible?: boolean;
  fast?: boolean;
  /** efeitos [id, duração em ticks, amplificador, chance] */
  effects?: [string, number, number, number][];
  /** item que sobra (tigela, garrafa) */
  remainder?: string;
}

export interface ItemDef {
  id: string;
  label: string;
  maxStack: number;
  maxDamage?: number;
  /** bloco colocado ao usar */
  block?: string;
  tool?: ToolInfo;
  /** dano de ataque total (já com o 1 base) e ataques por segundo */
  attack?: { damage: number; speed: number };
  armor?: { slot: ArmorSlot; defense: number; toughness: number; knockback: number; material: string };
  food?: FoodInfo;
  /** ticks de queima na fornalha */
  fuel?: number;
  enchantability?: number;
  tab: ItemTab;
  /** nome do sprite do ícone (padrão = id) */
  icon?: string;
  /** cor de tingimento (tintas, poções, couro) */
  color?: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic';
  /** dados livres */
  data?: Record<string, unknown>;
}
