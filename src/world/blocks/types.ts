export type PropValue = string | number | boolean;
export type Props = Record<string, PropValue>;
export interface PropDef { name: string; values: readonly PropValue[] }

export type ToolKind = 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'sword' | 'shears';
export type SoundKind =
  | 'stone' | 'wood' | 'gravel' | 'grass' | 'sand' | 'snow' | 'glass' | 'wool' | 'metal'
  | 'plant' | 'crop' | 'ladder' | 'lantern' | 'slime' | 'mud' | 'netherrack' | 'soul' | 'basalt'
  | 'bone' | 'ash' | 'coral' | 'honey' | 'amethyst' | 'lava' | 'water' | 'none';
export type RenderLayer = 'solid' | 'cutout' | 'translucent' | 'water' | 'none';
/** 0 sem cor, 1 grama, 2 folhagem, 3 água, 4 bétula fixa, 5 pinheiro fixo, 6 fulgor (por nível), 7 caule */
export type TintKind = 'none' | 'grass' | 'foliage' | 'water' | 'birch' | 'spruce' | 'fulgor' | 'stem' | 'lume';

/** Formas de render/colisão. 'cube' usa greedy meshing; as demais usam construtores de modelo. */
export type ShapeKind =
  | 'none' | 'cube' | 'cross' | 'crop' | 'fluid' | 'slab' | 'stairs' | 'fence' | 'fencegate' | 'wall'
  | 'pane' | 'door' | 'trapdoor' | 'torch' | 'walltorch' | 'ladder' | 'rail' | 'dust' | 'lever' | 'button'
  | 'plate' | 'carpet' | 'snowlayer' | 'farmland' | 'path' | 'cactus' | 'bed' | 'chest' | 'sign' | 'wallsign'
  | 'repeater' | 'comparator' | 'piston' | 'pistonhead' | 'lantern' | 'cake' | 'lilypad' | 'vine' | 'anvil'
  | 'cauldron' | 'brewing' | 'enchanting' | 'portal' | 'fire' | 'kelp' | 'doubleplant' | 'bush' | 'chain'
  | 'lectern' | 'composter' | 'grindstone' | 'stonecutter' | 'campfire' | 'flowerpot' | 'crystal' | 'hopper'
  | 'daylight' | 'endrod' | 'bars' | 'candle' | 'head' | 'stem' | 'cocoa' | 'bell' | 'scaffold' | 'cobweb'
  | 'sapling' | 'mushroom';

export type FaceKey = 'down' | 'up' | 'north' | 'south' | 'west' | 'east';
/** Texturas: string (todas as faces) ou por face/lado. `front` é a face voltada para `facing`. */
export interface TexFaces {
  all?: string; top?: string; bottom?: string; side?: string; front?: string; back?: string;
  north?: string; south?: string; west?: string; east?: string; end?: string;
  /** texturas extras usadas por modelos (ex.: 'inner', 'handle') */
  [extra: string]: string | undefined;
}
export type TexSpec = string | TexFaces;

export interface BlockDef {
  name: string;
  label: string;
  props?: PropDef[];
  defaults?: Props;
  hardness: number;
  resistance?: number;
  tool?: ToolKind;
  /** nível mínimo de ferramenta para colher: 0 madeira/ouro, 1 pedra, 2 ferro, 3 diamante */
  level?: number;
  requiresTool?: boolean;
  shape?: ShapeKind;
  layer?: RenderLayer;
  /** cubo opaco completo (esconde faces vizinhas e bloqueia toda a luz) */
  opaque?: boolean;
  /** tem colisão */
  solid?: boolean;
  light?: number | ((p: Props) => number);
  opacity?: number;
  tex?: TexSpec | ((p: Props) => TexSpec);
  tint?: TintKind;
  sound?: SoundKind;
  friction?: number;
  speedFactor?: number;
  jumpFactor?: number;
  gravity?: boolean;
  replaceable?: boolean;
  /** [encorajamento, inflamabilidade] como no original */
  flammable?: [number, number];
  randomTicks?: boolean;
  noItem?: boolean;
  /** item diferente ao pegar/quebrar (ex.: parede-tocha → tocha) */
  itemOf?: string;
  fluid?: 'water' | 'lava';
  climbable?: boolean;
  /** 1 folhas, 2 planta presa no chão, 3 topo de planta alta */
  waving?: 0 | 1 | 2 | 3;
  cullSame?: boolean;
  /** textura gira aleatoriamente por bloco (grama, areia, pedra…) */
  randomRotate?: boolean;
  /** categoria da aba no criativo */
  tab?: 'build' | 'nature' | 'deco' | 'fulgor' | 'util' | 'none';
  /** dados extras livres (cor de tinta, madeira, etc.) */
  data?: Record<string, unknown>;
}

export const FACE_KEYS: readonly FaceKey[] = ['down', 'up', 'north', 'south', 'west', 'east'];
