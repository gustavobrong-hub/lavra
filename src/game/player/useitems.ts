/**
 * Itens de uso com o botão direito: arco (puxar/soltar, força = (t² + 2t)/3 com t = ticks/20), escudo
 * (bloqueia pela frente após 5 ticks), arremessáveis (bola de neve, ovo, poção, pérola do vulto) e
 * ovos de criação. Comer e beber continuam em survival.ts.
 */
import type { Level } from '../level';
import type { Player } from './player';
import type { BlockHit } from '../raycast';
import { FACE_DX, FACE_DY, FACE_DZ } from '../raycast';
import { ItemStack } from '../items/stack';
import { item } from '../items/registry';
import { Arrow, Throwable } from '../entity/projectiles';
import { spawnMob } from '../entity/registry';
import { FLAGS, F_SOLID } from '../../world/blocks';

/** Força do arco pelo tempo puxado (BowItem.getPowerForTime). */
export function bowPower(ticks: number): number {
  let f = ticks / 20;
  f = (f * f + f * 2) / 3;
  return Math.min(1, f);
}

export const THROWABLES = new Set(['snowball', 'egg', 'splash_potion', 'shade_pearl', 'experience_bottle']);

export function hasArrows(p: Player): boolean {
  if (p.gameMode === 'creative') return true;
  return p.inventory.count('arrow') > 0 || p.inventory.count('tipped_arrow') > 0;
}

/** Arremessa o item da mão. Retorna true se usou. */
export function throwItem(level: Level, p: Player, st: ItemStack): boolean {
  if (p.throwCooldown > 0) return false;
  const one = st.copy(1);
  const t = new Throwable(level, one);
  t.owner = p;
  t.setPos(p.x, p.y + p.eyeHeight() - 0.1, p.z);
  if (st.id === 'splash_potion' || st.id === 'experience_bottle') t.shootFrom(p, p.pitch, p.yaw, -20, 0.5, 1);
  else t.shootFrom(p, p.pitch, p.yaw, 0, 1.5, 1);
  level.entities.add(t);
  level.emit('sound', { name: `throw.${st.id}`, x: p.x, y: p.y, z: p.z });
  if (p.gameMode !== 'creative') p.inventory.consumeHeld(1);
  p.throwCooldown = st.id === 'shade_pearl' ? 20 : 4;
  p.swing();
  return true;
}

/** Solta a flecha (BowItem.releaseUsing). */
export function releaseBow(level: Level, p: Player, bow: ItemStack, ticks: number): void {
  const f = bowPower(ticks);
  if (f < 0.1) return;
  const creative = p.gameMode === 'creative';
  const infinity = bow.enchantLevel('infinity') > 0;
  // flecha com poção tem prioridade se estiver na mão secundária
  const off = p.inventory.offhand;
  const tipped = off?.id === 'tipped_arrow' ? off : null;
  if (!creative && !tipped && p.inventory.count('arrow') <= 0 && p.inventory.count('tipped_arrow') <= 0) return;
  const a = new Arrow(level);
  a.owner = p;
  a.setPos(p.x, p.y + p.eyeHeight() - 0.1, p.z);
  a.shootFrom(p, p.pitch, p.yaw, 0, f * 3, 1);
  if (f === 1) a.crit = true;
  const pw = bow.enchantLevel('power');
  if (pw) a.baseDamage += pw * 0.5 + 0.5;
  a.punch = bow.enchantLevel('punch');
  if (bow.enchantLevel('flame')) { a.flame = true; a.fireTicks = 2000; }
  let usedTipped = tipped;
  if (!usedTipped && !creative && p.inventory.count('arrow') <= 0) {
    const i = p.inventory.findSlot('tipped_arrow');
    if (i >= 0) usedTipped = p.inventory.main[i];
  }
  if (usedTipped?.tag?.potion) a.potion = usedTipped.tag.potion as string;
  const infinite = creative || (infinity && !usedTipped);
  a.pickup = infinite ? 2 : 1;
  if (!infinite) {
    if (usedTipped) {
      usedTipped.count--;
      if (usedTipped.count <= 0) {
        if (p.inventory.offhand === usedTipped) p.inventory.offhand = null;
        else { const i = p.inventory.main.indexOf(usedTipped); if (i >= 0) p.inventory.main[i] = null; }
      }
      p.inventory.changed();
    } else p.inventory.remove('arrow', 1);
  }
  if (!creative) {
    const broke = p.inventory.held === bow ? p.inventory.damageHeld(1, bow.enchantLevel('unbreaking')) : false;
    if (broke) level.emit('toolBreak', { item: 'bow' });
  }
  level.entities.add(a);
  level.emit('sound', { name: 'bow.shoot', x: p.x, y: p.y, z: p.z, power: f });
}

/** Ovo de criação no bloco mirado. */
export function useSpawnEgg(level: Level, p: Player, st: ItemStack, hit: BlockHit | null): boolean {
  const type = (item(st.id)?.data?.entity as string) ?? '';
  if (!type || !hit) return false;
  let x = hit.x + FACE_DX[hit.face], y = hit.y + FACE_DY[hit.face], z = hit.z + FACE_DZ[hit.face];
  // se o bloco clicado não é sólido (grama alta), nasce nele
  if (!(FLAGS[level.getBlock(hit.x, hit.y, hit.z)] & F_SOLID)) { x = hit.x; y = hit.y; z = hit.z; }
  const m = spawnMob(level, type, x + 0.5, y, z + 0.5, { reason: 'egg', yaw: p.yaw + 180 });
  if (!m) return false;
  if (st.tag?.name) m.customName = st.tag.name;
  if (p.gameMode !== 'creative') p.inventory.consumeHeld(1);
  p.swing();
  return true;
}

/** Duração máxima de uso contínuo (ticks). */
export function holdDuration(id: string): number {
  if (id === 'bow' || id === 'shield' || id === 'harpoon') return 72000;
  return 0;
}

// ------------------------------------------------------------------ baldes, enxada, farinha de osso
import { raycastBlocks } from '../raycast';
import { S, BLOCKS, BLOCK_OF, FLUID_LEVEL, F_LAVA, F_REPLACEABLE, F_FLUID } from '../../world/blocks';
import { boneMeal } from '../../world/logic/growth';
import { DIM_INFERO } from '../../core/constants';

const bname = (s: number) => BLOCKS[BLOCK_OF[s]].name;

/** Balde vazio: pega fonte de água ou lava; balde cheio: despeja uma fonte. */
export function useBucket(level: Level, p: Player, st: ItemStack): boolean {
  const [dx, dy, dz] = p.lookVec();
  const reach = p.gameMode === 'creative' ? 5 : 4.5;
  const ex = p.x, ey = p.y + p.eyeHeight(), ez = p.z;
  if (st.id === 'bucket') {
    const hit = raycastBlocks(level.world, ex, ey, ez, dx, dy, dz, reach, { fluids: 'source' });
    if (!hit) return false;
    const s = level.getBlock(hit.x, hit.y, hit.z);
    if (!(FLAGS[s] & F_FLUID) || FLUID_LEVEL[s] !== 0) return false;
    const filled = FLAGS[s] & F_LAVA ? 'lava_bucket' : 'water_bucket';
    level.setBlock(hit.x, hit.y, hit.z, 0);
    level.emit('sound', { name: `bucket.fill.${filled === 'lava_bucket' ? 'lava' : 'water'}`, x: hit.x, y: hit.y, z: hit.z });
    giveBack(p, st, filled);
    return true;
  }
  if (st.id === 'water_bucket' || st.id === 'lava_bucket') {
    const hit = raycastBlocks(level.world, ex, ey, ez, dx, dy, dz, reach, { fluids: 'none' });
    if (!hit) return false;
    let x = hit.x, y = hit.y, z = hit.z;
    const clicked = level.getBlock(x, y, z);
    if (!(FLAGS[clicked] & F_REPLACEABLE)) { x += FACE_DX[hit.face]; y += FACE_DY[hit.face]; z += FACE_DZ[hit.face]; }
    const cur = level.getBlock(x, y, z);
    if (cur !== 0 && !(FLAGS[cur] & (F_REPLACEABLE | F_FLUID))) return false;
    if (st.id === 'water_bucket' && level.world.dim === DIM_INFERO) {
      level.emit('fizz', { x, y, z });
    } else {
      if (cur !== 0 && !(FLAGS[cur] & F_FLUID)) level.breakBlock(x, y, z, { drop: true, silent: true });
      level.setBlock(x, y, z, S(st.id === 'water_bucket' ? 'water' : 'lava'));
      level.emit('sound', { name: `bucket.empty.${st.id === 'lava_bucket' ? 'lava' : 'water'}`, x, y, z });
    }
    giveBack(p, st, 'bucket');
    return true;
  }
  return false;
}

function giveBack(p: Player, st: ItemStack, id: string): void {
  p.swing();
  if (p.gameMode === 'creative') { if (!p.inventory.count(id)) p.inventory.add(new ItemStack(id)); return; }
  if (st.count <= 1) { p.inventory.held = new ItemStack(id); return; }
  p.inventory.consumeHeld(1);
  if (p.inventory.add(new ItemStack(id)) > 0) p.host.emit?.('dropStack', { id });
}

/** Enxada: grama/terra/caminho → terra arada; terra grossa → terra. */
export function useHoe(level: Level, p: Player, st: ItemStack, hit: BlockHit | null): boolean {
  if (!hit || hit.face === 0) return false;
  const s = level.getBlock(hit.x, hit.y, hit.z);
  const n = bname(s);
  if (level.getBlock(hit.x, hit.y + 1, hit.z) !== 0) return false;
  let to: string | null = null;
  if (n === 'grass_block' || n === 'dirt' || n === 'dirt_path') to = 'farmland';
  else if (n === 'coarse_dirt' || n === 'rooted_dirt') to = 'dirt';
  if (!to) return false;
  level.setBlock(hit.x, hit.y, hit.z, S(to));
  level.emit('sound', { name: 'hoe.till', x: hit.x, y: hit.y, z: hit.z });
  if (p.gameMode !== 'creative') p.inventory.damageHeld(1, st.enchantLevel('unbreaking'));
  p.swing();
  return true;
}

export function useBoneMeal(level: Level, p: Player, hit: BlockHit | null): boolean {
  if (!hit) return false;
  if (!boneMeal(level, hit.x, hit.y, hit.z)) return false;
  if (p.gameMode !== 'creative') p.inventory.consumeHeld(1);
  p.swing();
  return true;
}

