/**
 * Poções com nomes próprios (ervas e bichos do Brasil) e os efeitos/durações do original.
 * Os ids de efeito são internos; os rótulos em pt-BR estão em EFFECT_LABELS.
 */
import type { Living, StatusEffect } from '../entity/living';

export interface PotionDef {
  id: string;
  label: string;
  color: number;
  effects: StatusEffect[];
}

export const EFFECT_LABELS: Record<string, string> = {
  speed: 'Velocidade', slowness: 'Lentidão', haste: 'Pressa', mining_fatigue: 'Cansaço', strength: 'Força',
  instant_health: 'Cura instantânea', instant_damage: 'Dano instantâneo', jump_boost: 'Impulso', nausea: 'Náusea',
  regeneration: 'Regeneração', resistance: 'Resistência', fire_resistance: 'Resistência ao fogo',
  water_breathing: 'Respiração aquática', invisibility: 'Invisibilidade', blindness: 'Cegueira',
  night_vision: 'Visão noturna', hunger: 'Fome', weakness: 'Fraqueza', poison: 'Veneno', wither: 'Definhar',
  absorption: 'Absorção', saturation: 'Saciedade', levitation: 'Levitação', slow_falling: 'Queda lenta',
  dolphins_grace: 'Graça do boto', luck: 'Sorte',
};

const P: PotionDef[] = [];
const byId = new Map<string, PotionDef>();
function add(id: string, label: string, color: number, effects: [string, number, number][]): void {
  const d = { id, label, color, effects: effects.map(([e, duration, amplifier]) => ({ id: e, duration, amplifier })) };
  P.push(d);
  byId.set(id, d);
}

/** base, longa (duração maior) e forte (nível II) — mesmas durações do original */
function family(id: string, label: string, color: number, effect: string, base: number, long?: number, strong?: [number, number]): void {
  add(id, label, color, [[effect, base, 0]]);
  if (long) add(`long_${id}`, label, color, [[effect, long, 0]]);
  if (strong) add(`strong_${id}`, `${label} II`, color, [[effect, strong[0], strong[1]]]);
}

add('water', 'Poção rala', 0x385dc6, []);
add('awkward', 'Poção turva', 0x385dc6, []);
add('mundane', 'Poção insossa', 0x385dc6, []);
add('thick', 'Poção grossa', 0x385dc6, []);
family('night_vision', 'Poção de coruja', 0x1f1fa1, 'night_vision', 3600, 9600);
family('invisibility', 'Poção de saci', 0x7f8392, 'invisibility', 3600, 9600);
family('leaping', 'Poção de perereca', 0x22ff4c, 'jump_boost', 3600, 9600, [1800, 1]);
family('fire_resistance', 'Poção de babosa', 0xe49a3a, 'fire_resistance', 3600, 9600);
family('swiftness', 'Poção de guaraná', 0x7cafc6, 'speed', 3600, 9600, [1800, 1]);
family('slowness', 'Poção de lodo', 0x5a6c81, 'slowness', 1800, 4800, [400, 3]);
family('water_breathing', 'Poção de guelra', 0x2e5299, 'water_breathing', 3600, 9600);
family('healing', 'Poção de arnica', 0xf82423, 'instant_health', 1, undefined, [1, 1]);
family('harming', 'Poção de peçonha', 0x430a09, 'instant_damage', 1, undefined, [1, 1]);
family('poison', 'Poção de timbó', 0x4e9331, 'poison', 900, 1800, [432, 1]);
family('regeneration', 'Poção de copaíba', 0xcd5cab, 'regeneration', 900, 1800, [450, 1]);
family('strength', 'Poção de catuaba', 0x932423, 'strength', 3600, 9600, [1800, 1]);
family('weakness', 'Poção de quebranto', 0x484d48, 'weakness', 1800, 4800);
family('slow_falling', 'Poção de paina', 0xf7f8e0, 'slow_falling', 1800, 4800);

export const POTIONS: readonly PotionDef[] = P;
export function potion(id: string): PotionDef | undefined { return byId.get(id); }
export function potionEffects(id: string): StatusEffect[] { return byId.get(id)?.effects.map((e) => ({ ...e })) ?? []; }
export const INSTANT = new Set(['instant_health', 'instant_damage']);

/** Duração no formato m:ss. */
export function fmtDuration(ticks: number): string {
  const s = Math.floor(ticks / 20);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Aplica os efeitos de uma poção (k = fração para poções arremessadas, 1 = bebida). */
export function applyPotion(e: Living, id: string, k = 1, source: Living | null = null): void {
  const undead = (e as Living & { undead?: boolean }).undead === true;
  for (const ef of potionEffects(id)) {
    if (INSTANT.has(ef.id)) {
      const heal = ef.id === 'instant_health' !== undead;
      if (heal) e.heal(Math.max(4 << ef.amplifier, 0) * k);
      else e.hurt({ type: 'magic', bypassArmor: true, attacker: source ?? undefined }, (6 << ef.amplifier) * k);
      continue;
    }
    const d = Math.floor(ef.duration * k + 0.5);
    if (d > 20) e.addEffect({ id: ef.id, duration: d, amplifier: ef.amplifier });
  }
}
