/**
 * Interação do jogador com blocos: mirar (raycast), quebrar com o tempo exato do original
 * (dureza × ferramenta × encantamentos × efeitos, ÷5 no ar e na água), atraso de 5 ticks entre quebras,
 * colocar blocos (atraso de 4 ticks ao segurar), usar blocos (portas, alavancas, bancadas...) e escolher bloco.
 */
import { AABB } from '../../core/aabb';
import { BLOCKS, BLOCK_OF, FLAGS, F_REPLACEABLE, F_SOLID, STATE_PROPS, getProp, withProp, isAir, F_FLUID, S, SHAPE, SHAPE_IDS } from '../../world/blocks';
import { blockBoxes } from '../../world/blocks/shapes';
import { raycastBlocks, FACE_DX, FACE_DY, FACE_DZ, type BlockHit } from '../raycast';
import type { Level } from '../level';
import type { Player } from './player';
import { placementFor } from './placement';
import { canHarvest, type ToolContext } from '../loot/blockdrops';
import { item } from '../items/registry';
import { ItemStack } from '../items/stack';

export interface InteractInput {
  attack: boolean; attackPressed: boolean;
  use: boolean; usePressed: boolean;
  pickPressed: boolean;
}

export class Interaction {
  target: BlockHit | null = null;
  /** bloco sendo quebrado */
  breakX = 0; breakY = 0; breakZ = 0;
  breaking = false;
  progress = 0;
  destroyDelay = 0;
  useDelay = 0;
  private hitSoundTimer = 0;
  /** 0..9 para a textura de rachadura (−1 = nada) */
  get crackStage(): number { return this.breaking && this.progress > 0 ? Math.min(9, Math.floor(this.progress * 10)) : -1; }
  onOpenBlock?: (x: number, y: number, z: number, state: number) => boolean;
  onUseItem?: (stack: ItemStack | null, hit: BlockHit | null) => boolean;

  constructor(private readonly level: Level, private readonly player: Player) {}

  reach(): number { return this.player.gameMode === 'creative' ? 5 : 4.5; }

  updateTarget(eyeX: number, eyeY: number, eyeZ: number): void {
    const [dx, dy, dz] = this.player.lookVec();
    this.target = raycastBlocks(this.level.world, eyeX, eyeY, eyeZ, dx, dy, dz, this.reach());
  }

  toolContext(): ToolContext {
    const held = this.player.inventory.held;
    const t = held ? item(held.id)?.tool : undefined;
    return {
      kind: t?.kind ?? null, tier: t?.tier ?? -1,
      silk: (held?.enchantLevel('silk_touch') ?? 0) > 0,
      fortune: held?.enchantLevel('fortune') ?? 0,
      shears: held?.id === 'shears',
    };
  }

  /** Progresso de quebra por tick (Player.getDestroySpeed / dureza / 30 ou 100). */
  destroyProgress(state: number): number {
    const def = BLOCKS[BLOCK_OF[state]].def;
    const hardness = def.hardness;
    if (hardness < 0) return 0;
    if (hardness === 0) return Infinity;
    const p = this.player;
    const held = p.inventory.held;
    const tool = held ? item(held.id)?.tool : undefined;
    const name = BLOCKS[BLOCK_OF[state]].name;
    let speed = 1;
    if (tool) {
      if (tool.kind === 'shears') speed = name === 'cobweb' || name.endsWith('_leaves') ? 15 : name.endsWith('_wool') ? 5 : name === 'vine' ? 2 : 1;
      else if (tool.kind === 'sword') speed = name === 'cobweb' ? 15 : (def.tool === 'hoe' || SHAPE[state] === SHAPE_IDS.cross || name === 'pumpkin' || name === 'melon' || name.endsWith('_leaves')) ? 1.5 : 1;
      else if (tool.kind === def.tool) speed = tool.speed;
    }
    if (speed > 1 && held) {
      const eff = held.enchantLevel('efficiency');
      if (eff > 0) speed += eff * eff + 1;
    }
    const haste = p.effectLevel('haste');
    if (haste) speed *= 1 + 0.2 * haste;
    const fatigue = p.effectLevel('mining_fatigue');
    if (fatigue) speed *= [0.3, 0.09, 0.0027, 0.00081][Math.min(3, fatigue - 1)];
    const aqua = (p.inventory.armor[3]?.enchantLevel('aqua_affinity') ?? 0) > 0;
    if (p.eyeInWater && !aqua) speed /= 5;
    if (!p.onGround && !p.flying) speed /= 5;
    const harvest = canHarvest(state, this.toolContext());
    return speed / hardness / (harvest ? 30 : 100);
  }

  tick(inp: InteractInput): void {
    const p = this.player;
    if (this.destroyDelay > 0) this.destroyDelay--;
    if (this.useDelay > 0) this.useDelay--;
    const t = this.target;

    // ------------------------------------------------ quebrar
    if (inp.attack && t && !p.dead) {
      if (p.gameMode === 'creative') {
        if (this.destroyDelay <= 0 && (inp.attackPressed || this.destroyDelay === 0)) {
          const held = p.inventory.held;
          if (!(held && item(held.id)?.tool?.kind === 'sword')) {
            this.level.breakBlock(t.x, t.y, t.z, { drop: false, by: p });
            this.destroyDelay = 5;
          }
          p.swing();
        }
        this.breaking = false;
      } else if (p.gameMode === 'survival') {
        if (!this.breaking || t.x !== this.breakX || t.y !== this.breakY || t.z !== this.breakZ) {
          this.breaking = true;
          this.breakX = t.x; this.breakY = t.y; this.breakZ = t.z;
          this.progress = 0;
          this.hitSoundTimer = 0;
        }
        if (this.destroyDelay <= 0) {
          const st = this.level.getBlock(t.x, t.y, t.z);
          const dp = this.destroyProgress(st);
          if (dp > 0) {
            this.progress += dp;
            if (this.hitSoundTimer++ % 4 === 0) this.level.emit('blockHit', { x: t.x, y: t.y, z: t.z, state: st, face: t.face });
          }
          p.swing();
          if (this.progress >= 1) this.finishBreak(st);
        }
      }
    } else {
      this.breaking = false;
      this.progress = 0;
    }

    // ------------------------------------------------ usar
    if (inp.use && this.useDelay <= 0 && !p.dead) {
      this.useDelay = 4;
      this.use(inp.usePressed);
    }

    // ------------------------------------------------ escolher bloco (botão do meio)
    if (inp.pickPressed && t) this.pickBlock(t.state);
  }

  private finishBreak(st: number): void {
    const p = this.player;
    const t = this.target!;
    const tool = this.toolContext();
    const name = BLOCKS[BLOCK_OF[st]].name;
    // gelo quebrado vira água (sem Toque Sutil) se houver algo embaixo
    if ((name === 'ice') && !tool.silk) {
      const below = this.level.getBlock(t.x, t.y - 1, t.z);
      this.level.breakBlock(t.x, t.y, t.z, { drop: false, by: p });
      if (FLAGS[below] & (F_SOLID | F_FLUID)) this.level.setBlock(t.x, t.y, t.z, S('water'));
    } else this.level.breakBlock(t.x, t.y, t.z, { drop: true, tool, by: p });
    p.food.addExhaustion(0.005);
    const held = p.inventory.held;
    const def = held ? item(held.id) : undefined;
    if (held && def?.maxDamage && BLOCKS[BLOCK_OF[st]].def.hardness > 0) {
      const dmg = def.tool?.kind === 'sword' || def.attack && !def.tool ? 2 : 1;
      if (p.inventory.damageHeld(dmg, held.enchantLevel('unbreaking'))) this.level.emit('toolBreak', { item: held.id });
    }
    this.progress = 0;
    this.breaking = false;
    this.destroyDelay = 5;
  }

  /** Clique direito: usar o bloco mirado, colocar bloco ou usar o item. */
  use(fresh: boolean): void {
    const p = this.player;
    const t = this.target;
    const held = p.inventory.held;
    // usar o bloco (portas, alavancas, telas) — agachado com item na mão coloca em vez de usar
    if (t && !(p.sneaking && held)) {
      if (this.useBlock(t)) { p.swing(); return; }
    }
    if (this.onUseItem?.(held, t)) return;
    if (!held) return;
    const def = item(held.id);
    if (def?.block && t) {
      if (this.place(def.block, t)) {
        p.swing();
        if (p.gameMode !== 'creative') p.inventory.consumeHeld();
      }
    }
    void fresh;
  }

  /** Tenta colocar o bloco `name` a partir do acerto `t`. */
  place(name: string, t: BlockHit): boolean {
    const w = this.level.world;
    const p = this.player;
    let x = t.x, y = t.y, z = t.z;
    const clicked = w.getBlock(x, y, z);
    const bt = BLOCKS[BLOCK_OF[clicked]];
    const sameSlab = bt.name === name && bt.shape === 'slab' && STATE_PROPS[clicked].type !== 'double'
      && ((STATE_PROPS[clicked].type === 'bottom' && t.face === 1) || (STATE_PROPS[clicked].type === 'top' && t.face === 0));
    const sameSnow = bt.name === name && name === 'snow' && (STATE_PROPS[clicked].layers as number) < 8;
    if (!(FLAGS[clicked] & F_REPLACEABLE) && !sameSlab && !sameSnow) {
      x += FACE_DX[t.face]; y += FACE_DY[t.face]; z += FACE_DZ[t.face];
    }
    if (y < -64 || y >= 320) return false;
    const cur = w.getBlock(x, y, z);
    const curName = BLOCKS[BLOCK_OF[cur]].name;
    const mergingSlab = curName === name && BLOCKS[BLOCK_OF[cur]].shape === 'slab';
    if (!(isAir(cur) || FLAGS[cur] & F_REPLACEABLE || mergingSlab || (curName === name && name === 'snow'))) return false;
    const pl = placementFor(name, {
      world: w, x, y, z, face: t.face,
      hitX: t.px - t.x, hitY: t.py - t.y, hitZ: t.pz - t.z,
      yaw: p.yaw, pitch: p.pitch, sneaking: p.sneaking, replacing: cur,
    });
    if (!pl) return false;
    // não coloca dentro de entidades
    for (const [bx, by, bz, st] of pl.states) {
      const boxes = blockBoxes(st, bx, by, bz, (a, b, c) => w.getBlock(a, b, c));
      for (const b of boxes) {
        const box = new AABB(bx + b[0], by + b[1], bz + b[2], bx + b[3], by + b[4], bz + b[5]);
        const hit = this.level.entities.inBox(box, (e) => e.type !== 'item' && e.type !== 'xp_orb' && e.type !== 'arrow');
        if (hit.length || (p.bb.intersects(box) && !p.noPhysics)) return false;
      }
    }
    this.level.batch(() => { for (const [bx, by, bz, st] of pl.states) this.level.setBlock(bx, by, bz, st); });
    this.level.emit('blockPlace', { x, y, z, state: pl.states[0][3], by: p });
    return true;
  }

  /** Blocos que reagem ao clique direito. */
  useBlock(t: BlockHit): boolean {
    const L = this.level;
    const s = L.getBlock(t.x, t.y, t.z);
    const bt = BLOCKS[BLOCK_OF[s]];
    const name = bt.name;
    const p = STATE_PROPS[s];
    switch (bt.shape) {
      case 'door': {
        if (name === 'iron_door') return false;
        const open = !p.open;
        const otherY = p.half === 'lower' ? t.y + 1 : t.y - 1;
        const other = L.getBlock(t.x, otherY, t.z);
        L.setBlock(t.x, t.y, t.z, withProp(s, 'open', open));
        if (BLOCK_OF[other] === bt.id) L.setBlock(t.x, otherY, t.z, withProp(other, 'open', open));
        L.emit('sound', { name: open ? 'door.open' : 'door.close', x: t.x, y: t.y, z: t.z });
        return true;
      }
      case 'trapdoor': {
        if (name === 'iron_trapdoor') return false;
        L.setBlock(t.x, t.y, t.z, withProp(s, 'open', !p.open));
        L.emit('sound', { name: p.open ? 'trapdoor.close' : 'trapdoor.open', x: t.x, y: t.y, z: t.z });
        return true;
      }
      case 'fencegate': {
        let ns = withProp(s, 'open', !p.open);
        if (!p.open) {
          // abre para longe do jogador
          const pf = playerFacing(this.player.yaw);
          const f = p.facing as string;
          if (pf === opposite(f)) ns = withProp(ns, 'facing', pf);
        }
        L.setBlock(t.x, t.y, t.z, ns);
        L.emit('sound', { name: p.open ? 'gate.close' : 'gate.open', x: t.x, y: t.y, z: t.z });
        return true;
      }
      case 'lever':
        L.setBlock(t.x, t.y, t.z, withProp(s, 'powered', !p.powered));
        L.emit('sound', { name: 'lever', x: t.x, y: t.y, z: t.z, pitch: p.powered ? 0.5 : 0.6 });
        return true;
      case 'button':
        if (p.powered) return true;
        L.setBlock(t.x, t.y, t.z, withProp(s, 'powered', true));
        L.scheduleTick(t.x, t.y, t.z, s, name === 'stone_button' ? 20 : 30);
        L.emit('sound', { name: 'button', x: t.x, y: t.y, z: t.z });
        return true;
      case 'repeater':
        L.setBlock(t.x, t.y, t.z, withProp(s, 'delay', ((p.delay as number) % 4) + 1));
        L.emit('sound', { name: 'click', x: t.x, y: t.y, z: t.z });
        return true;
      case 'comparator':
        L.setBlock(t.x, t.y, t.z, withProp(s, 'mode', p.mode === 'compare' ? 'subtract' : 'compare'));
        L.emit('sound', { name: 'click', x: t.x, y: t.y, z: t.z });
        return true;
      default:
        return this.onOpenBlock?.(t.x, t.y, t.z, s) ?? false;
    }
  }

  pickBlock(state: number): void {
    const p = this.player;
    const bt = BLOCKS[BLOCK_OF[state]];
    const id = bt.def.itemOf ?? bt.name;
    if (!item(id)) return;
    const inv = p.inventory;
    const hot = inv.main.slice(0, 9).findIndex((s) => s?.id === id);
    if (hot >= 0) { inv.selected = hot; inv.changed(); return; }
    if (p.gameMode === 'creative') {
      const empty = inv.main.slice(0, 9).findIndex((s) => !s);
      const slot = empty >= 0 ? empty : inv.selected;
      inv.main[slot] = new ItemStack(id, 1);
      inv.selected = slot;
      inv.changed();
    } else {
      const idx = inv.findSlot(id);
      if (idx >= 9) {
        const tmp = inv.main[inv.selected];
        inv.main[inv.selected] = inv.main[idx];
        inv.main[idx] = tmp;
        inv.changed();
      }
    }
  }
}

function playerFacing(yaw: number): string {
  const i = Math.floor(((yaw % 360) + 360 + 45) / 90) & 3;
  return ['south', 'west', 'north', 'east'][i];
}
function opposite(f: string): string {
  return ({ north: 'south', south: 'north', west: 'east', east: 'west' } as Record<string, string>)[f];
}

export { getProp };
