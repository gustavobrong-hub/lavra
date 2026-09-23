/**
 * Sentinela: golem de barro e pedra que protege a aldeia (IronGolem do original): 100 de vida, dano 7,5–21,5
 * lançando o alvo para cima, imune a queda e a empurrões, ataca monstros (menos o pavio), defende aldeões
 * atacados pelo jogador e às vezes oferece uma flor a um aldeão.
 */
import { Mob, type Drop } from '../entity/mob';
import type { Level } from '../level';
import type { Living } from '../entity/living';
import { Goal, MeleeAttackGoal, LookAtPlayerGoal, RandomLookAroundGoal, RandomStrollGoal, HurtByTargetGoal, NearestAttackableTargetGoal } from '../entity/ai/goals';

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
    this.followRange = 16;
  }
  get label(): string { return 'Sentinela'; }
  registerGoals(): void {
    this.goals.add(1, new MeleeAttackGoal(this, 1, true));
    this.goals.add(5, new OfferFlowerGoal(this));
    this.goals.add(6, new RandomStrollGoal(this, 0.6, 240, 8));
    this.goals.add(7, new LookAtPlayerGoal(this, 6));
    this.goals.add(8, new RandomLookAroundGoal(this));
    this.targets.add(2, new HurtByTargetGoal(this));
    this.targets.add(3, new NearestAttackableTargetGoal(this, (e) => (e as Living & { hostile?: boolean }).hostile === true && e.type !== 'pavio', false, 10));
  }
  override canReach(t: Living): boolean {
    if (t.type === 'player' && this.playerMade) return false;
    return super.canReach(t);
  }
  override doHurtTarget(t: Living): boolean {
    this.attackTimer = 10;
    this.host.emit('entityEvent', { id: this.id, event: 'golemAttack' });
    const dmg = this.attackDamage / 2 + Math.floor(Math.random() * this.attackDamage);
    const ok = t.hurt({ type: 'mob', attacker: this }, dmg);
    if (ok) t.vy += 0.4;
    this.host.emit('sound', { name: 'sentinela.attack', x: this.x, y: this.y, z: this.z });
    return ok;
  }
  protected override customAi(): void {
    if (this.attackTimer > 0) this.attackTimer--;
    if (this.offerFlower > 0) this.offerFlower--;
  }
  override drops(): Drop[] { return [{ id: 'iron_ingot', min: 3, max: 5 }, { id: 'poppy', min: 0, max: 2 }]; }
  override save(): Record<string, unknown> { return { ...super.save(), playerMade: this.playerMade }; }
  override load(d: Record<string, unknown>): void { super.load(d); this.playerMade = !!d.playerMade; }
}

/** De dia, às vezes, estende uma flor para um aldeão (400 ticks). */
class OfferFlowerGoal extends Goal {
  private v: Living | null = null;
  constructor(private g: Sentinela) { super(); this.flags = ['move', 'look']; }
  canUse(): boolean {
    if (!this.g.host.isDay() || Math.random() * 8000 >= 1) return false;
    this.v = this.g.host.entities.near(this.g.x, this.g.y, this.g.z, 6, (e) => e.type === 'villager')[0] as Living ?? null;
    return !!this.v;
  }
  override canContinue(): boolean { return this.g.offerFlower > 0; }
  override start(): void { this.g.offerFlower = 400; this.g.nav.stop(); }
  override stop(): void { this.g.offerFlower = 0; this.v = null; }
  override tick(): void { const v = this.v; if (v) this.g.lookCtl.lookAt(v.x, v.y + v.eyeHeight(), v.z, 30, 30); }
}
