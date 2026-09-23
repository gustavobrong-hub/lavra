/**
 * Aldeões e a sentinela (golem protetor). Nesta etapa: corpo, atributos e objetivos básicos;
 * profissões, rotina, comércio e cruzamento chegam no marco das aldeias.
 */
import { Mob, type Drop } from '../mob';
import type { Level } from '../../level';
import { FloatGoal, PanicGoal, RandomStrollGoal, LookAtPlayerGoal, RandomLookAroundGoal, AvoidEntityGoal, MeleeAttackGoal, HurtByTargetGoal, NearestAttackableTargetGoal } from '../ai/goals';
import type { Living } from '../living';

export const PROFESSIONS = ['nenhuma', 'fazendeiro', 'pescador', 'pastor', 'flecheiro', 'cartografo', 'clerigo', 'armeiro', 'ferramenteiro', 'espadeiro', 'acougueiro', 'curtidor', 'bibliotecario', 'pedreiro', 'tolo'] as const;
export type Profession = typeof PROFESSIONS[number];
export const VILLAGE_STYLES = ['planicie', 'deserto', 'savana', 'taiga', 'neve', 'selva', 'pantano'] as const;

export class Villager extends Mob {
  readonly type = 'villager';
  profession: Profession = 'nenhuma';
  /** estilo de roupa pelo bioma de origem */
  style: typeof VILLAGE_STYLES[number] = 'planicie';
  tradeLevel = 1;
  baby = false;
  /** cabeça balançando "não" (recusa) — ticks */
  shakeHead = 0;
  sleeping = false;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 20; this.baseSpeed = 0.5; this.category = 'misc'; this.persistent = true;
    this.width = 0.6; this.height = 1.95;
    this.nav.canOpenDoors = true;
  }
  get label(): string { return 'Aldeão'; }
  override get isBaby(): boolean { return this.baby; }
  registerGoals(): void {
    this.goals.add(0, new FloatGoal(this));
    this.goals.add(1, new AvoidEntityGoal(this, (e) => e.type === 'carnical' || e.type === 'naufrago' || e.type === 'feiticeira', 8, 0.6, 0.7));
    this.goals.add(1, new PanicGoal(this, 0.7));
    this.goals.add(6, new RandomStrollGoal(this, 0.5));
    this.goals.add(8, new LookAtPlayerGoal(this, 8));
    this.goals.add(9, new RandomLookAroundGoal(this));
  }
  override drops(): Drop[] { return []; }
  override save(): Record<string, unknown> { return { ...super.save(), profession: this.profession, style: this.style, level: this.tradeLevel, baby: this.baby }; }
  override load(d: Record<string, unknown>): void {
    super.load(d);
    this.profession = (d.profession as Profession) ?? 'nenhuma'; this.style = (d.style as never) ?? 'planicie';
    this.tradeLevel = (d.level as number) ?? 1; this.baby = !!d.baby;
  }
}

/** Sentinela: golem de barro e pedra que protege a aldeia. */
export class Sentinela extends Mob {
  readonly type = 'sentinela';
  /** 0..10 ticks do golpe (braços sobem) */
  attackTimer = 0;
  /** oferecendo uma flor a um aldeão */
  offerFlower = 0;
  playerMade = false;
  constructor(level: Level) {
    super(level);
    this.maxHealth = 100; this.baseSpeed = 0.25; this.attackDamage = 15; this.knockbackResistance = 1;
    this.category = 'misc'; this.persistent = true; this.fallMult = 0;
    this.width = 1.4; this.height = 2.7;
  }
  get label(): string { return 'Sentinela'; }
  registerGoals(): void {
    this.goals.add(1, new MeleeAttackGoal(this, 1, true));
    this.goals.add(7, new LookAtPlayerGoal(this, 6));
    this.goals.add(8, new RandomLookAroundGoal(this));
    this.goals.add(6, new RandomStrollGoal(this, 0.6));
    this.targets.add(2, new HurtByTargetGoal(this));
    this.targets.add(3, new NearestAttackableTargetGoal(this, (e) => (e as Living & { hostile?: boolean }).hostile === true && e.type !== 'pavio', false, 10));
  }
  override doHurtTarget(t: Living): boolean {
    this.attackTimer = 10;
    this.host.emit('entityEvent', { id: this.id, event: 'golemAttack' });
    const dmg = this.attackDamage / 2 + Math.floor(Math.random() * this.attackDamage);
    const ok = t.hurt({ type: 'mob', attacker: this }, dmg);
    if (ok) t.vy += 0.4;
    return ok;
  }
  protected override customAi(): void {
    if (this.attackTimer > 0) this.attackTimer--;
    if (this.offerFlower > 0) this.offerFlower--;
  }
  override drops(): Drop[] { return [{ id: 'iron_ingot', min: 3, max: 5 }, { id: 'poppy', min: 0, max: 2 }]; }
}
