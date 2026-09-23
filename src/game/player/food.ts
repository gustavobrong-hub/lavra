/**
 * Fome, saciedade e exaustão — mesmas regras do original (FoodData):
 * exaustão ≥ 4 consome saciedade (ou fome); regeneração rápida com fome 20 e saciedade,
 * lenta com fome ≥ 18 (1 ponto a cada 80 ticks); fome zerada causa dano a cada 80 ticks.
 */
export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';

export interface FoodHost {
  health: number;
  maxHealth: number;
  heal(n: number): void;
  hurt(src: { type: 'starve' }, n: number): boolean;
}

export class FoodData {
  foodLevel = 20;
  saturation = 5;
  exhaustion = 0;
  private timer = 0;
  lastFoodLevel = 20;

  /** `saturationValue` = valor de saciedade do alimento (já multiplicado, como na tabela da wiki). */
  eat(hunger: number, saturationValue: number): void {
    this.foodLevel = Math.min(20, this.foodLevel + hunger);
    this.saturation = Math.min(this.saturation + saturationValue, this.foodLevel);
  }

  addExhaustion(n: number): void {
    this.exhaustion = Math.min(40, this.exhaustion + n);
  }

  needsFood(): boolean { return this.foodLevel < 20; }

  tick(p: FoodHost, difficulty: Difficulty, naturalRegen = true): void {
    this.lastFoodLevel = this.foodLevel;
    if (this.exhaustion > 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(this.saturation - 1, 0);
      else if (difficulty !== 'peaceful') this.foodLevel = Math.max(this.foodLevel - 1, 0);
    }
    const hurt = p.health > 0 && p.health < p.maxHealth;
    if (naturalRegen && this.saturation > 0 && hurt && this.foodLevel >= 20) {
      if (++this.timer >= 10) {
        const f = Math.min(this.saturation, 6);
        p.heal(f / 6);
        this.addExhaustion(f);
        this.timer = 0;
      }
    } else if (naturalRegen && this.foodLevel >= 18 && hurt) {
      if (++this.timer >= 80) {
        p.heal(1);
        this.addExhaustion(6);
        this.timer = 0;
      }
    } else if (this.foodLevel <= 0) {
      if (++this.timer >= 80) {
        if (p.health > 10 || difficulty === 'hard' || (p.health > 1 && difficulty === 'normal')) p.hurt({ type: 'starve' }, 1);
        this.timer = 0;
      }
    } else this.timer = 0;
    // pacífico regenera fome
    if (difficulty === 'peaceful' && this.foodLevel < 20) this.foodLevel++;
  }

  toJSON(): object { return { f: this.foodLevel, s: this.saturation, e: this.exhaustion }; }
  load(o: { f?: number; s?: number; e?: number }): void {
    this.foodLevel = o.f ?? 20; this.saturation = o.s ?? 5; this.exhaustion = o.e ?? 0;
  }
}
