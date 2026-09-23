/**
 * Combate do jogador (Player.attack do original): recarga por velocidade de ataque, dano × (0,2 + s² × 0,8),
 * crítico ×1,5 caindo, varredura da espada no chão, empurrão extra correndo, encantamentos (Gume, Exorcismo,
 * Flagelo, Repelão, Ardor), desgaste da arma e exaustão. Também a mira em entidades (alcance 3 / 6 no criativo).
 */
import type { Level } from '../level';
import type { Player } from './player';
import type { Entity } from '../entity/entity';
import type { Living } from '../entity/living';
import { item } from '../items/registry';
import { Fireball } from '../entity/projectiles';

export interface EntityHit { e: Entity; dist: number }

const ARTHROPODS = new Set(['tecela']);

/** Entidade sob a mira (antes dos blocos). */
export function pickEntity(level: Level, p: Player, maxDist: number): EntityHit | null {
  const ex = p.x, ey = p.y + p.eyeHeight(), ez = p.z;
  const [dx, dy, dz] = p.lookVec();
  const box = p.bb.expandTowards(dx * maxDist, dy * maxDist, dz * maxDist).inflate(1);
  let best: EntityHit | null = null;
  for (const e of level.entities.inBox(box, (o) => o !== p && o !== (p as Player & { vehicle?: Entity | null }).vehicle && canPick(o))) {
    const bb = e.bb.inflate(pickRadius(e));
    if (bb.contains(ex, ey, ez)) { if (!best || 0 < best.dist) best = { e, dist: 0 }; continue; }
    const h = bb.rayHit(ex, ey, ez, dx, dy, dz, maxDist);
    if (h && (!best || h.t < best.dist)) best = { e, dist: h.t };
  }
  return best;
}

function canPick(e: Entity): boolean {
  if (e.removed) return false;
  if (e.type === 'item' || e.type === 'xp_orb' || e.type === 'arrow' || e.type === 'harpoon' || e.type === 'throwable' || e.type === 'falling_block') return false;
  if (e.type === 'fireball') return true;
  return !(e as Living).dead;
}
function pickRadius(e: Entity): number { return e.type === 'fireball' ? 1 : 0; }

/** Velocidade de ataque do item na mão (ataques/s). */
export function attackSpeed(p: Player): number {
  const h = p.inventory.held;
  return (h && item(h.id)?.attack?.speed) || 4;
}

/** Fração de recarga 0..1 (getAttackStrengthScale). */
export function attackStrength(p: Player, adjust = 0.5): number {
  const delay = 20 / attackSpeed(p);
  return Math.max(0, Math.min(1, (p.attackStrengthTicker + adjust) / delay));
}

/** Ataque corpo a corpo do jogador contra `target`. */
export function playerAttack(level: Level, p: Player, target: Entity): void {
  if (target.type === 'fireball') { (target as Fireball).deflect(p); p.swing(); p.attackStrengthTicker = 0; return; }
  const t = target as Living;
  if (t.dead) return;
  const held = p.inventory.held;
  const def = held ? item(held.id) : undefined;
  let dmg = def?.attack?.damage ?? 1;
  // força e fraqueza
  dmg += 3 * p.effectLevel('strength');
  dmg -= 4 * p.effectLevel('weakness');
  let bonus = 0;
  const undead = (t as Living & { undead?: boolean }).undead === true;
  if (held) {
    const sh = held.enchantLevel('sharpness');
    if (sh) bonus += 0.5 * sh + 0.5;
    const sm = held.enchantLevel('smite');
    if (sm && undead) bonus += 2.5 * sm;
    const ba = held.enchantLevel('bane_of_arthropods');
    if (ba && ARTHROPODS.has(t.type)) { bonus += 2.5 * ba; t.addEffect({ id: 'slowness', duration: 20 + Math.floor(Math.random() * 10 * ba), amplifier: 3 }); }
  }
  const s = attackStrength(p);
  dmg *= 0.2 + s * s * 0.8;
  bonus *= s;
  p.attackStrengthTicker = 0;
  if (dmg <= 0 && bonus <= 0) return;
  const full = s > 0.9;
  let kb = held?.enchantLevel('knockback') ?? 0;
  let sprintHit = false;
  if (p.sprinting && full) { kb++; sprintHit = true; level.emit('sound', { name: 'attack.knockback', x: p.x, y: p.y, z: p.z }); }
  const crit = full && p.fallDistance > 0 && !p.onGround && !p.onClimbable() && !p.inWater && !p.hasEffect('blindness') && !sprintHit;
  if (crit) dmg *= 1.5;
  dmg += bonus;
  const walked = p.walkDist - p.prevWalkDist;
  const sweep = full && !crit && !sprintHit && p.onGround && walked < p.getSpeed() && def?.tool?.kind === 'sword';
  const fire = held?.enchantLevel('fire_aspect') ?? 0;
  let setFire = false;
  if (fire > 0 && t.fireTicks <= 0) { setFire = true; t.fireTicks = 20; }
  const hpBefore = t.health;
  const ok = t.hurt({ type: 'player', attacker: p }, dmg);
  if (ok) {
    if (kb > 0) {
      const r = p.yaw * Math.PI / 180;
      t.knockback(kb * 0.5, Math.sin(r), -Math.cos(r));
      p.vx *= 0.6; p.vz *= 0.6;
      p.sprinting = false;
    }
    if (sweep) {
      const extra = 1 + (held?.enchantLevel('sweeping') ? (held.enchantLevel('sweeping') / (held.enchantLevel('sweeping') + 1)) * dmg : 0);
      for (const o of level.entities.inBox(t.bb.inflate(1, 0.25, 1), (x) => x !== p && x !== t && (x as Living).health !== undefined && !(x as Living).dead)) {
        if (p.distanceSq(o.x, o.y, o.z) >= 9) continue;
        const l = o as Living;
        if ((l as Living & { ownerId?: number }).ownerId === p.id) continue;
        const r = p.yaw * Math.PI / 180;
        l.knockback(0.4, Math.sin(r), -Math.cos(r));
        l.hurt({ type: 'player', attacker: p }, extra);
      }
      level.emit('particle', { kind: 'sweep', x: p.x - Math.sin(p.yaw * Math.PI / 180), y: p.y + p.height * 0.5, z: p.z + Math.cos(p.yaw * Math.PI / 180) });
      level.emit('sound', { name: 'attack.sweep', x: p.x, y: p.y, z: p.z });
    }
    if (crit) { level.emit('particle', { kind: 'crit', x: t.x, y: t.y + t.height / 2, z: t.z, n: 12 }); level.emit('sound', { name: 'attack.crit', x: t.x, y: t.y, z: t.z }); }
    else if (!sweep) level.emit('sound', { name: full ? 'attack.strong' : 'attack.weak', x: t.x, y: t.y, z: t.z });
    if (bonus > 0) level.emit('particle', { kind: 'magicCrit', x: t.x, y: t.y + t.height / 2, z: t.z, n: 10 });
    p.lastHurtMob = t;
    // espinhos da armadura do alvo não se aplicam ao jogador aqui (monstros não usam)
    if (held && def?.maxDamage) {
      const cost = def.tool?.kind === 'sword' || !def.tool ? 1 : 2;
      if (p.inventory.damageHeld(cost, held.enchantLevel('unbreaking'))) level.emit('toolBreak', { item: held.id });
    }
    if (fire > 0) t.fireTicks = Math.max(t.fireTicks, fire * 80);
    const dealt = hpBefore - t.health;
    if (dealt > 2) level.emit('particle', { kind: 'damage', x: t.x, y: t.y + t.height / 2, z: t.z, n: Math.min(10, Math.floor(dealt * 0.5)) });
    p.food.addExhaustion(0.1);
  } else {
    level.emit('sound', { name: 'attack.nodamage', x: t.x, y: t.y, z: t.z });
    if (setFire) t.fireTicks = 0;
  }
  p.swing();
}
