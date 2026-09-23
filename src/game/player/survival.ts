/**
 * Regras de sobrevivência aplicadas ao jogador a cada tick: ar e afogamento, lava e fogo,
 * sufocamento, vazio, cacto e amoras, comer (32 ticks), cama e dormir, XP e morte.
 */
import type { Player } from './player';
import type { Level } from '../level';
import { BLOCKS, BLOCK_OF, FLAGS, F_FULL_CUBE_COLLISION, OPAQUE, F_WATER, F_WATERLOGGED, STATE_PROPS } from '../../world/blocks';
import { item } from '../items/registry';
import { ItemStack } from '../items/stack';
import { xpNeeded, XpOrb, splitXp } from '../entity/xporb';

export function giveXp(p: Player, n: number): void {
  p.xpTotal += n;
  p.xpProgress += n / xpNeeded(p.xpLevel);
  while (p.xpProgress >= 1) {
    p.xpProgress = (p.xpProgress - 1) * xpNeeded(p.xpLevel);
    p.xpLevel++;
    p.xpProgress /= xpNeeded(p.xpLevel);
    p.host.emit?.('levelUp', { level: p.xpLevel });
  }
  p.score += n;
}

export function spawnXp(level: Level, x: number, y: number, z: number, amount: number): void {
  for (const v of splitXp(amount)) {
    const o = new XpOrb(level, v);
    o.setPos(x, y, z);
    o.vx = (Math.random() * 0.2 - 0.1) * 2; o.vy = Math.random() * 0.2 * 2; o.vz = (Math.random() * 0.2 - 0.1) * 2;
    level.entities.add(o);
  }
}

/** Tick de sobrevivência (depois da física). */
export function survivalTick(p: Player, level: Level): void {
  if (p.dead) return;
  const w = level.world;
  // ------------------------------------------------ ar
  const respiration = p.inventory.armor[3]?.enchantLevel('respiration') ?? 0;
  if (p.eyeInWater && !p.hasEffect('water_breathing') && p.gameMode === 'survival') {
    if (!(respiration > 0 && Math.random() >= 1 / (respiration + 1))) p.airSupply--;
    if (p.airSupply <= -20) {
      p.airSupply = 0;
      p.hurt({ type: 'drown', bypassArmor: true }, 2);
    }
  } else if (p.airSupply < p.maxAirSupply) p.airSupply = Math.min(p.maxAirSupply, p.airSupply + 4);
  // ------------------------------------------------ lava e fogo
  if (p.inLava) {
    if (!p.hasEffect('fire_resistance')) {
      p.hurt({ type: 'lava' }, 4);
      p.fireTicks = Math.max(p.fireTicks, 300);
    }
  }
  const feet = w.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  const feetName = BLOCKS[BLOCK_OF[feet]].name;
  if (feetName === 'fire' || feetName === 'soul_fire' || feetName === 'campfire' && STATE_PROPS[feet].lit) {
    if (!p.hasEffect('fire_resistance')) {
      p.hurt({ type: 'fire' }, feetName === 'soul_fire' ? 2 : 1);
      p.fireTicks = Math.max(p.fireTicks, 160);
    }
  }
  if (p.fireTicks > 0) {
    if (p.inWater || isRainingOn(level, p)) p.fireTicks = 0;
    else {
      if (p.fireTicks % 20 === 0 && !p.hasEffect('fire_resistance')) p.hurt({ type: 'onFire' }, 1);
      p.fireTicks--;
    }
  }
  // ------------------------------------------------ sufocamento (cabeça dentro de bloco sólido)
  if (!p.noPhysics) {
    const hx = Math.floor(p.x), hy = Math.floor(p.y + p.eyeHeight()), hz = Math.floor(p.z);
    const head = w.getBlock(hx, hy, hz);
    if (OPAQUE[head] && FLAGS[head] & F_FULL_CUBE_COLLISION) p.hurt({ type: 'suffocate', bypassArmor: true }, 1);
  }
  // ------------------------------------------------ vazio
  if (p.y < -128) p.hurt({ type: 'void', bypassArmor: true }, 4);
  // ------------------------------------------------ cacto e amoras
  const bb = p.bb.inflate(0.01);
  for (let x = Math.floor(bb.minX); x <= Math.floor(bb.maxX); x++) for (let z = Math.floor(bb.minZ); z <= Math.floor(bb.maxZ); z++) for (let y = Math.floor(bb.minY); y <= Math.floor(bb.maxY); y++) {
    const s = w.getBlock(x, y, z);
    const n = BLOCKS[BLOCK_OF[s]].name;
    if (n === 'cactus') p.hurt({ type: 'cactus' }, 1);
    else if (n === 'sweet_berry_bush' && (STATE_PROPS[s].age as number) > 0 && !p.sneaking && (Math.abs(p.x - p.prevX) > 0.003 || Math.abs(p.z - p.prevZ) > 0.003)) p.hurt({ type: 'cactus' }, 1);
    else if (n === 'magma_block' && y === Math.floor(p.y - 0.01) && !p.sneaking) p.hurt({ type: 'fire' }, 1);
  }
  // ------------------------------------------------ efeitos com dano
  if (p.hasEffect('poison') && p.health > 1) {
    const lvl = p.effectLevel('poison');
    const interval = Math.max(1, 25 >> (lvl - 1));
    if (p.age % interval === 0) p.hurt({ type: 'magic', bypassArmor: true }, 1);
  }
  if (p.hasEffect('regeneration')) {
    const lvl = p.effectLevel('regeneration');
    const interval = Math.max(1, 50 >> (lvl - 1));
    if (p.age % interval === 0) p.heal(1);
  }
  if (p.hasEffect('hunger')) p.food.addExhaustion(0.005 * p.effectLevel('hunger'));
  // exaustão por movimento (por tick)
  const dist = Math.hypot(p.x - p.prevX, p.z - p.prevZ);
  if (p.inWater && p.eyeInWater) p.food.addExhaustion(0.01 * Math.hypot(dist, p.y - p.prevY));
  else if (p.inWater) p.food.addExhaustion(0.01 * dist);
  else if (p.onGround && p.sprinting) p.food.addExhaustion(0.1 * dist);
}

function isRainingOn(level: Level & { rainLevel?: number }, p: Player): boolean {
  if (!(level.rainLevel && level.rainLevel > 0.2)) return false;
  return level.world.heightAt(Math.floor(p.x), Math.floor(p.z)) <= p.y + p.height;
}

// ------------------------------------------------------------------ comer e beber
export function useDuration(id: string): number {
  const def = item(id);
  if (def?.food) return def.food.fast ? 16 : 32;
  if (id === 'potion' || id === 'milk_bucket' || id === 'honey_bottle') return 32;
  return 0;
}

export function canStartUsing(p: Player, st: ItemStack): boolean {
  const def = item(st.id);
  if (def?.food) return p.gameMode !== 'survival' ? true : p.food.needsFood() || !!def.food.alwaysEdible;
  return st.id === 'potion' || st.id === 'milk_bucket' || st.id === 'honey_bottle';
}

/** Termina de comer/beber: aplica o alimento e devolve a sobra (tigela, garrafa, balde). */
export function finishUsing(p: Player, st: ItemStack): ItemStack | null {
  const def = item(st.id);
  if (def?.food) {
    p.food.eat(def.food.hunger, def.food.saturation);
    for (const [id, dur, amp, chance] of def.food.effects ?? []) if (Math.random() < chance) p.addEffect({ id, duration: dur, amplifier: amp });
    p.host.emit?.('eat', { x: p.x, y: p.y, z: p.z, item: st.id });
    return def.food.remainder ? new ItemStack(def.food.remainder) : null;
  }
  if (st.id === 'milk_bucket') { p.effects.clear(); return new ItemStack('bucket'); }
  if (st.id === 'potion') return new ItemStack('glass_bottle');
  return null;
}

/** Posição de renascer: cama (se ainda existir) ou ponto de nascimento do mundo. */
export function respawnPos(p: Player, level: Level, worldSpawn: [number, number, number]): [number, number, number] {
  if (p.spawnPoint) {
    const [x, y, z] = p.spawnPoint;
    const s = level.world.getBlock(x, y, z);
    if (BLOCKS[BLOCK_OF[s]].name.endsWith('_bed')) {
      // procura um espaço livre ao redor da cama
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const bx = x + dx, bz = z + dz;
        const a = level.world.getBlock(bx, y + 1, bz), b = level.world.getBlock(bx, y + 2, bz);
        if (!OPAQUE[a] && !OPAQUE[b] && !(FLAGS[a] & (F_WATER | F_WATERLOGGED))) return [bx + 0.5, y + 1.0, bz + 0.5];
      }
    }
    p.spawnPoint = null;
  }
  return worldSpawn;
}
