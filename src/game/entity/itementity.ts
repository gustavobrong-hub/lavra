/** Item solto no mundo (física do ItemEntity do original: gravidade 0,04, some após 5 minutos, junta pilhas). */
import { Entity, type EntityHost } from './entity';
import type { ItemStack } from '../items/stack';
import { BLOCK_FRICTION } from './living';

export class ItemEntity extends Entity {
  readonly type = 'item';
  pickupDelay = 10;
  lifespan = 6000;
  bobOffset = Math.random() * Math.PI * 2;
  /** quem jogou (não pega de volta imediatamente) */
  thrower = 0;

  constructor(host: EntityHost, public stack: ItemStack) {
    super(host);
    this.width = 0.25;
    this.height = 0.25;
    this.stepHeight = 0;
  }

  tick(): void {
    this.age++;
    this.savePrev();
    if (this.pickupDelay > 0 && this.pickupDelay !== 32767) this.pickupDelay--;
    this.updateFluids(0.014, 0.007);
    if (this.inWater && this.waterHeight > 0.1) {
      // flutua
      this.vx *= 0.99; this.vz *= 0.99;
      this.vy += this.vy < 0.06 ? 5e-4 : 0;
    } else if (this.inLava) {
      this.vx *= 0.95; this.vz *= 0.95;
      this.vy += this.vy < 0.06 ? 5e-4 : 0;
    } else if (!this.noGravity) this.vy -= 0.04;
    if (!this.onGround || this.vx * this.vx + this.vz * this.vz > 1e-5 || (this.age + this.id) % 4 === 0) {
      this.move(this.vx, this.vy, this.vz);
      let f = 0.98;
      if (this.onGround) f = BLOCK_FRICTION(this.blockUnder()) * 0.98;
      this.vx *= f; this.vy *= 0.98; this.vz *= f;
      if (this.onGround && this.vy < 0) this.vy *= -0.5;
    }
    if (this.inLava) {
      // itens queimam na lava
      this.removed = true;
      this.host.emit?.('itemBurn', { x: this.x, y: this.y, z: this.z });
    }
    if (this.age >= this.lifespan) this.removed = true;
  }
}
