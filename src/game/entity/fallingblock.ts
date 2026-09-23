/** Bloco caindo (areia, cascalho, concreto em pó, bigorna): gravidade 0,04 e pousa como bloco. */
import { Entity, type EntityHost } from './entity';
import { FLAGS, F_REPLACEABLE, BLOCKS, BLOCK_OF, F_FLUID } from '../../world/blocks/registry';

export interface FallingHost extends EntityHost {
  landFallingBlock(e: FallingBlock, x: number, y: number, z: number): void;
}

export class FallingBlock extends Entity {
  readonly type = 'falling_block';
  time = 0;

  constructor(host: FallingHost, public state: number) {
    super(host);
    this.width = 0.98;
    this.height = 0.98;
    this.stepHeight = 0;
  }

  tick(): void {
    this.age++;
    this.time++;
    this.savePrev();
    this.vy -= 0.04;
    this.move(this.vx, this.vy, this.vz);
    this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98;
    const bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
    const inside = this.world.getBlock(bx, by, bz);
    // pó de concreto vira concreto ao tocar água
    const name = BLOCKS[BLOCK_OF[this.state]].name;
    if (name.endsWith('_concrete_powder') && FLAGS[inside] & F_FLUID) {
      (this.host as FallingHost).landFallingBlock(this, bx, by, bz);
      this.removed = true;
      return;
    }
    if (this.onGround) {
      this.vx *= 0.7; this.vz *= 0.7;
      this.removed = true;
      (this.host as FallingHost).landFallingBlock(this, bx, by, bz);
    } else if (this.time > 600 || this.y < -128) {
      this.removed = true;
    }
    void F_REPLACEABLE;
  }
}
