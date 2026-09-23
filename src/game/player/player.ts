/**
 * Jogador: modos de jogo, agachar (sem cair de beiradas), correr (duplo toque ou tecla), voo do criativo
 * (duplo toque no pulo), poses (em pé 1,8 / agachado 1,5), olhos a 1,62 / 1,27, e dano de queda.
 */
import { Living, type DamageSource } from '../entity/living';
import type { EntityHost } from '../entity/entity';
import { Inventory } from '../inventory/inventory';
import { FoodData } from './food';

export type GameMode = 'survival' | 'creative' | 'spectator';

export interface PlayerInput {
  forward: number; // -1..1
  strafe: number; // +1 esquerda
  jump: boolean;
  sneak: boolean;
  sprintKey: boolean;
}

export class Player extends Living {
  readonly type = 'player';
  gameMode: GameMode = 'survival';
  flying = false;
  mayFly = false;
  instabuild = false;
  invulnerable = false;
  flySpeed = 0.05;
  sneaking = false;
  /** altura suavizada dos olhos (transição ao agachar) */
  eyeY = 1.62;
  prevEyeY = 1.62;
  readonly inventory = new Inventory();
  readonly food = new FoodData();
  xpLevel = 0;
  xpProgress = 0;
  xpTotal = 0;
  xpSeed = 0;
  selected = 0;
  spawnPoint: [number, number, number] | null = null;
  spawnDim = 0;
  /** duplo toque */
  private lastJumpPress = -100;
  private lastForwardPress = -100;
  private prevJump = false;
  private prevForward = false;
  sprintToggle = false;
  score = 0;
  sleepTimer = 0;
  sleeping = false;
  /** efeito de FOV suavizado */
  fovMod = 1;
  prevFovMod = 1;
  lastInput: PlayerInput = { forward: 0, strafe: 0, jump: false, sneak: false, sprintKey: false };
  /** 0..1 carregamento do arco/comida em uso */
  usingItemTicks = 0;
  usingItem = false;

  constructor(host: EntityHost) {
    super(host);
    this.width = 0.6;
    this.height = 1.8;
  }

  override eyeHeight(): number { return this.sneaking ? 1.27 : 1.62; }
  override isSneaking(): boolean { return this.sneaking; }
  override isFlying(): boolean { return this.flying; }
  protected override shouldBackOffEdges(): boolean { return this.sneaking && !this.flying && this.vy <= 0; }
  override suppressSlidingDownLadder(): boolean { return this.sneaking; }

  setGameMode(m: GameMode): void {
    this.gameMode = m;
    this.mayFly = m !== 'survival';
    this.instabuild = m === 'creative';
    this.invulnerable = m !== 'survival';
    if (m === 'survival') this.flying = false;
    if (m === 'spectator') { this.flying = true; this.noPhysics = true; } else this.noPhysics = false;
  }

  override getFlyingSpeed(): number {
    if (this.flying) return this.sprinting ? this.flySpeed * 2 : this.flySpeed;
    return this.sprinting ? 0.026 : 0.02;
  }

  canSprint(): boolean { return this.food.foodLevel > 6 || this.mayFly; }

  /** Aplica a entrada do tick (equivalente ao LocalPlayer.aiStep). */
  applyInput(inp: PlayerInput): void {
    this.lastInput = inp;
    const now = this.age;
    // voo: duplo toque no pulo
    if (inp.jump && !this.prevJump && this.mayFly) {
      if (now - this.lastJumpPress < 7) {
        this.flying = !this.flying;
        this.lastJumpPress = -100;
      } else this.lastJumpPress = now;
    }
    this.prevJump = inp.jump;
    // agachar (e não levantar sob um teto baixo)
    const wantSneak = inp.sneak && !this.flying;
    if (wantSneak) this.sneaking = true;
    else if (this.sneaking) {
      const standBox = this.bb;
      standBox.maxY = this.y + 1.8;
      if (this.isFree(standBox)) this.sneaking = false;
    }
    this.height = this.sneaking ? 1.5 : 1.8;
    let fwd = inp.forward, str = inp.strafe;
    if (this.sneaking) { fwd *= 0.3; str *= 0.3; }
    if (this.usingItem) { fwd *= 0.2; str *= 0.2; }
    // corrida: duplo toque para frente ou tecla
    const forwardNow = inp.forward > 0.8;
    const canStart = forwardNow && !this.sneaking && this.canSprint() && !this.usingItem && !this.hasEffect('blindness');
    if (forwardNow && !this.prevForward) {
      if (now - this.lastForwardPress < 7 && canStart) this.sprinting = true;
      this.lastForwardPress = now;
    }
    this.prevForward = forwardNow;
    if (inp.sprintKey && canStart) this.sprinting = true;
    const hitWall = this.horizontalCollision && !this.minorHorizontalCollision;
    if (this.sprinting && (!forwardNow || hitWall || !this.canSprint() || (this.sneaking && !this.inWater))) this.sprinting = false;
    // voo: sobe/desce
    if (this.flying) {
      let j = 0;
      if (inp.sneak) j--;
      if (inp.jump) j++;
      if (j !== 0) this.vy += j * this.flySpeed * 3;
    }
    this.xxa = str;
    this.zza = fwd;
    this.jumping = inp.jump && !this.flying;
  }

  tick(): void {
    this.age++;
    this.savePrev();
    this.prevEyeY = this.eyeY;
    this.prevFovMod = this.fovMod;
    this.prevYawHead = this.yawHead;
    this.prevBodyYaw = this.bodyYaw;
    if (this.invulnerableTime > 0) this.invulnerableTime--;
    if (this.hurtTime > 0) this.hurtTime--;
    this.updateFluids();
    if (this.flying) {
      const vy0 = this.vy;
      super.aiStep();
      this.vy = vy0 * 0.6;
      this.fallDistance = 0;
      if (this.onGround && this.gameMode !== 'spectator') this.flying = false;
    } else super.aiStep();
    this.updateSwing();
    this.tickEffects();
    // olhos acompanham a pose suavemente
    this.eyeY += (this.eyeHeight() - this.eyeY) * 0.5;
    // corpo acompanha a cabeça
    this.yawHead = this.yaw;
    const moving = Math.hypot(this.x - this.prevX, this.z - this.prevZ) > 0.01;
    let diff = ((this.yaw - this.bodyYaw + 540) % 360) - 180;
    if (moving) this.bodyYaw += diff * 0.3;
    else if (Math.abs(diff) > 50) this.bodyYaw += diff - Math.sign(diff) * 50;
    diff = 0;
    // campo de visão (corrida +15%, voo +10%)
    let f = 1;
    if (this.flying) f *= 1.1;
    f *= (this.getSpeed() / this.movementSpeed + 1) / 2;
    if (this.usingItem && this.usingItemTicks > 0) f *= 1 - Math.min(1, this.usingItemTicks / 20) ** 2 * 0.15;
    this.fovMod += (f - this.fovMod) * 0.5;
  }

  protected override onJump(): void {
    this.food.addExhaustion(this.sprinting ? 0.2 : 0.05);
  }

  protected override onLand(fall: number): void {
    if (this.gameMode !== 'survival' || this.inWater) return;
    const under = this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
    const name = this.world ? under : 0;
    void name;
    let mult = 1;
    const nm = this.blockUnderName();
    if (nm === 'hay_block') mult = 0.2;
    else if (nm === 'slime_block' || nm === 'water' || nm === 'cobweb') mult = 0;
    else if (nm.endsWith('_bed')) mult = 0.5;
    const dmg = Math.ceil((fall - 3 - this.effectLevel('jump_boost')) * mult);
    if (dmg > 0) this.hurt({ type: 'fall' }, dmg);
  }

  blockUnderName(): string {
    const s = this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
    return blockNameCache(s);
  }

  override hurt(src: DamageSource, amount: number): boolean {
    if (this.invulnerable && src.type !== 'void' && src.type !== 'kill') return false;
    const ok = super.hurt(src, amount);
    if (ok) this.food.addExhaustion(0.1);
    return ok;
  }
}

import { BLOCKS, BLOCK_OF } from '../../world/blocks/registry';
const blockNameCache = (s: number): string => BLOCKS[BLOCK_OF[s]].name;
