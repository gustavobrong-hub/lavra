/**
 * Entidades de bloco (dados guardados no chunk): baús, barris, fornalhas (com a lógica exata do
 * original: combustível, 200 ticks por item — 100 no defumador/alto-forno —, XP acumulada), placas e geradores.
 */
import { ItemStack } from '../items/stack';
import { item } from '../items/registry';
import { findSmelting } from '../crafting/recipes';
import type { Level } from '../level';
import { BLOCKS, BLOCK_OF, STATE_PROPS, withProp } from '../../world/blocks';
import type { BlockEntityData } from '../../world/chunk';

export interface ContainerBE extends BlockEntityData { type: 'chest' | 'barrel'; items: (ItemStack | null)[] }
export interface FurnaceBE extends BlockEntityData {
  type: 'furnace';
  kind: 'furnace' | 'smoker' | 'blast';
  items: (ItemStack | null)[]; // entrada, combustível, saída
  litTime: number;
  litDuration: number;
  cook: number;
  cookTotal: number;
  xp: number;
}
export interface SignBE extends BlockEntityData { type: 'sign'; lines: string[]; color?: string; glow?: boolean }
export interface SpawnerBE extends BlockEntityData { type: 'spawner'; mob: string; delay: number }

const idx = (x: number, y: number, z: number) => ((y + 64) << 8) | ((z & 15) << 4) | (x & 15);

export function getBE<T extends BlockEntityData>(level: Level, x: number, y: number, z: number): T | undefined {
  const c = level.world.getChunk(x >> 4, z >> 4);
  return c?.blockEntities.get(idx(x, y, z)) as T | undefined;
}
export function setBE(level: Level, x: number, y: number, z: number, be: BlockEntityData | null): void {
  const c = level.world.getChunk(x >> 4, z >> 4);
  if (!c) return;
  if (be) c.blockEntities.set(idx(x, y, z), be); else c.blockEntities.delete(idx(x, y, z));
  c.dirty = true;
}

export function fuelTime(id: string): number {
  const def = item(id);
  if (def?.fuel) return def.fuel;
  // blocos de madeira genéricos queimam 300 ticks
  const b = def?.block ? BLOCKS.find((x) => x.name === def.block) : undefined;
  if (b?.def.flammable && b.def.sound === 'wood') return 300;
  return 0;
}

export function newFurnace(kind: FurnaceBE['kind']): FurnaceBE {
  return { type: 'furnace', kind, items: [null, null, null], litTime: 0, litDuration: 0, cook: 0, cookTotal: kind === 'furnace' ? 200 : 100, xp: 0 };
}

/** Um tick de fornalha (AbstractFurnaceBlockEntity.serverTick). Retorna true se algo mudou. */
export function tickFurnace(level: Level, x: number, y: number, z: number, f: FurnaceBE): boolean {
  const wasLit = f.litTime > 0;
  let changed = false;
  if (f.litTime > 0) f.litTime--;
  const input = f.items[0], fuel = f.items[1];
  const recipe = input ? findSmelting(input.id, f.kind) : null;
  f.cookTotal = f.kind === 'furnace' ? 200 : 100;
  const canBurn = (): boolean => {
    if (!input || !recipe) return false;
    const out = f.items[2];
    if (!out) return true;
    if (out.id !== recipe.result) return false;
    return out.count + recipe.count <= out.maxStack;
  };
  if (f.litTime > 0 || (fuel && input)) {
    if (f.litTime <= 0 && canBurn()) {
      f.litTime = fuel ? fuelTime(fuel.id) : 0;
      f.litDuration = f.litTime;
      if (f.litTime > 0 && fuel) {
        changed = true;
        fuel.count--;
        if (fuel.count <= 0) f.items[1] = fuel.id === 'lava_bucket' ? new ItemStack('bucket') : null;
      }
    }
    if (f.litTime > 0 && canBurn()) {
      f.cook++;
      if (f.cook >= f.cookTotal) {
        f.cook = 0;
        const out = f.items[2];
        if (!out) f.items[2] = new ItemStack(recipe!.result, recipe!.count);
        else out.count += recipe!.count;
        input!.count--;
        if (input!.count <= 0) f.items[0] = null;
        f.xp += recipe!.xp;
        changed = true;
      }
    } else f.cook = 0;
  } else if (f.litTime <= 0 && f.cook > 0) f.cook = Math.max(0, f.cook - 2);
  const lit = f.litTime > 0;
  if (wasLit !== lit) {
    const s = level.getBlock(x, y, z);
    if ('lit' in (STATE_PROPS[s] ?? {})) level.setBlock(x, y, z, withProp(s, 'lit', lit));
    changed = true;
  }
  return changed;
}

/** Solta o conteúdo de um container quebrado. */
export function dropContents(level: Level, x: number, y: number, z: number, items: (ItemStack | null)[]): void {
  for (const s of items) if (s && s.count > 0) level.spawnItem(x + 0.5, y + 0.5, z + 0.5, s);
}

/** Registra criação/remoção/tick das entidades de bloco no nível. */
export function installBlockEntities(level: Level): void {
  level.beTicker = (L, x, y, z) => {
    const be = getBE<FurnaceBE>(L, x, y, z);
    if (!be || be.type !== 'furnace') return false;
    tickFurnace(L, x, y, z, be);
    const c = L.world.getChunk(x >> 4, z >> 4);
    if (c) c.dirty = true;
    return true; // fornalhas ficam ativas enquanto carregadas (baratas)
  };
  const kindOf = (name: string): FurnaceBE['kind'] => (name === 'smoker' ? 'smoker' : name === 'blast_furnace' ? 'blast' : 'furnace');
  level.behavior((n) => n === 'furnace' || n === 'smoker' || n === 'blast_furnace', {
    placed: (L, x, y, z, s) => { if (!getBE(L, x, y, z)) setBE(L, x, y, z, newFurnace(kindOf(BLOCKS[BLOCK_OF[s]].name))); L.activeBE.add(`${x},${y},${z}`); },
    removed: (L, x, y, z) => {
      const f = getBE<FurnaceBE>(L, x, y, z);
      if (f) { dropContents(L, x, y, z, f.items); if (f.xp >= 1) L.emit('xp', { x: x + 0.5, y: y + 0.5, z: z + 0.5, amount: Math.floor(f.xp) }); }
      setBE(L, x, y, z, null);
      L.activeBE.delete(`${x},${y},${z}`);
    },
  });
  level.behavior((n) => n === 'chest' || n === 'trapped_chest' || n === 'barrel', {
    placed: (L, x, y, z, s) => { if (!getBE(L, x, y, z)) setBE(L, x, y, z, { type: BLOCKS[BLOCK_OF[s]].name === 'barrel' ? 'barrel' : 'chest', items: new Array(27).fill(null) } as ContainerBE); },
    removed: (L, x, y, z) => {
      const c = getBE<ContainerBE>(L, x, y, z);
      if (c) dropContents(L, x, y, z, c.items);
      setBE(L, x, y, z, null);
    },
  });
  level.behavior((n) => n.endsWith('_sign'), {
    placed: (L, x, y, z) => { if (!getBE(L, x, y, z)) setBE(L, x, y, z, { type: 'sign', lines: ['', '', '', ''] } as SignBE); },
    removed: (L, x, y, z) => setBE(L, x, y, z, null),
  });
}
