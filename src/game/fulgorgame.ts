/**
 * Lado "jogo" dos circuitos: TNT acesa (80 ticks, potência 4, pisca e incha no fim), ejetor e liberador
 * (sorteiam um espaço; flechas, arremessáveis, baldes, farinha de osso, ovos de criação, TNT, tesoura),
 * alvo e botões de madeira atingidos por projéteis, sensores de luz do dia a cada 20 ticks.
 */
import { Entity } from './entity/entity';
import type { Level } from './level';
import { explode } from './explosion';
import { installFulgor, tickPlates, hitTarget, updateDaylight } from '../world/logic/fulgor';
import { getBE, setBE, type ContainerBE } from './blockentity/blockentities';
import { ItemStack } from './items/stack';
import { Arrow, Throwable } from './entity/projectiles';
import { spawnMob } from './entity/registry';
import { item } from './items/registry';
import { boneMeal } from '../world/logic/growth';
import { BLOCKS, BLOCK_OF, STATE_PROPS, FLAGS, F_FLUID, F_REPLACEABLE, FLUID_LEVEL, F_LAVA, S, withProp, SHAPE, SHAPE_IDS } from '../world/blocks';
import { celestialAngle } from '../render/skymodel';
import type { Sheep } from './entity/species/animals';

export class PrimedTnt extends Entity {
  readonly type = 'tnt';
  fuse = 80;
  constructor(host: Level, public owner: Entity | null = null) {
    super(host);
    this.width = this.height = 0.98;
    this.stepHeight = 0;
  }
  tick(): void {
    this.age++;
    this.savePrev();
    this.updateFluids();
    if (!this.noGravity) this.vy -= 0.04;
    this.move(this.vx, this.vy, this.vz);
    this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98;
    if (this.onGround) { this.vx *= 0.7; this.vz *= 0.7; this.vy *= -0.5; }
    if (--this.fuse <= 0) {
      this.removed = true;
      explode(this.host as Level, this.x, this.y + 0.06125, this.z, 4, { source: this });
    } else if (this.age % 2 === 0) (this.host as Level).emit('particle', { kind: 'smoke', x: this.x, y: this.y + 0.5, z: this.z });
  }
}

const D: Record<string, [number, number, number]> = { down: [0, -1, 0], up: [0, 1, 0], north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0] };

export function primeTnt(L: Level, x: number, y: number, z: number, fuse = 80, owner: Entity | null = null): PrimedTnt {
  const t = new PrimedTnt(L, owner);
  t.setPos(x + 0.5, y, z + 0.5);
  const a = Math.random() * Math.PI * 2;
  t.vx = -Math.sin(a) * 0.02; t.vy = 0.2; t.vz = -Math.cos(a) * 0.02;
  t.fuse = fuse;
  L.entities.add(t);
  L.emit('sound', { name: 'tnt.prime', x, y, z });
  return t;
}

/** Disparo do ejetor/liberador. */
function dispense(L: Level, x: number, y: number, z: number, s: number): void {
  const name = BLOCKS[BLOCK_OF[s]].name;
  let be = getBE<ContainerBE>(L, x, y, z);
  if (!be) { be = { type: 'chest', items: new Array(9).fill(null) }; setBE(L, x, y, z, be); }
  const full = be.items.map((it, i) => (it ? i : -1)).filter((i) => i >= 0);
  if (!full.length) { L.emit('sound', { name: 'dispenser.fail', x, y, z }); return; }
  const slot = full[Math.floor(Math.random() * full.length)];
  const st = be.items[slot]!;
  const f = STATE_PROPS[s].facing as string;
  const [dx, dy, dz] = D[f];
  const fx = x + dx, fy = y + dy, fz = z + dz;
  const px = x + 0.5 + dx * 0.7, py = y + 0.5 + dy * 0.7 - (dy === 0 ? 0.15 : 0), pz = z + 0.5 + dz * 0.7;
  const take = () => { st.count--; if (st.count <= 0) be!.items[slot] = null; };
  const drop = () => {
    const e = L.spawnItem(px, py, pz, st.copy(1), false);
    const sp = Math.random() * 0.1 + 0.2;
    e.vx = dx * sp + (Math.random() - 0.5) * 0.045; e.vy = 0.2 + (Math.random() - 0.5) * 0.045; e.vz = dz * sp + (Math.random() - 0.5) * 0.045;
    if (dy !== 0) e.vy = dy * sp;
    take();
  };
  L.emit('sound', { name: 'dispenser', x, y, z });
  L.emit('particle', { kind: 'smoke', x: px, y: py, z: pz, n: 5 });
  if (name === 'dropper') { drop(); return; }
  const id = st.id;
  if (id === 'arrow' || id === 'tipped_arrow') {
    const a = new Arrow(L);
    a.setPos(px, py, pz);
    a.shoot(dx, dy + 0.1, dz, 1.1, 6);
    a.pickup = 1;
    if (st.tag?.potion) a.potion = st.tag.potion as string;
    L.entities.add(a);
    take();
    return;
  }
  if (id === 'snowball' || id === 'egg' || id === 'splash_potion' || id === 'experience_bottle') {
    const t = new Throwable(L, st.copy(1));
    t.setPos(px, py, pz);
    t.shoot(dx, dy + 0.1, dz, id === 'splash_potion' || id === 'experience_bottle' ? 1.375 : 1.1, 6);
    L.entities.add(t);
    take();
    return;
  }
  const front = L.getBlock(fx, fy, fz);
  if (id === 'water_bucket' || id === 'lava_bucket') {
    if (front === 0 || FLAGS[front] & (F_REPLACEABLE | F_FLUID)) {
      L.setBlock(fx, fy, fz, S(id === 'water_bucket' ? 'water' : 'lava'));
      be.items[slot] = new ItemStack('bucket');
      return;
    }
    drop();
    return;
  }
  if (id === 'bucket') {
    if (FLAGS[front] & F_FLUID && FLUID_LEVEL[front] === 0) {
      L.setBlock(fx, fy, fz, 0);
      const filled = new ItemStack(FLAGS[front] & F_LAVA ? 'lava_bucket' : 'water_bucket');
      if (st.count === 1) be.items[slot] = filled;
      else { take(); L.spawnItem(px, py, pz, filled, false); }
      return;
    }
    drop();
    return;
  }
  if (id === 'bone_meal') { if (boneMeal(L, fx, fy, fz)) take(); return; }
  if (id === 'tnt') { primeTnt(L, fx, fy, fz); take(); return; }
  if (id.endsWith('_spawn_egg')) {
    const type = item(id)?.data?.entity as string;
    if (type) { spawnMob(L, type, fx + 0.5, fy, fz + 0.5, { reason: 'egg' }); take(); return; }
  }
  if (id === 'shears') {
    for (const e of L.entities.near(fx + 0.5, fy + 0.5, fz + 0.5, 1.5, (o) => o.type === 'sheep')) {
      const sh = e as Sheep;
      if (sh.sheared || sh.isBaby) continue;
      sh.sheared = true;
      L.spawnItem(sh.x, sh.y + 1, sh.z, new ItemStack(`${sh.color}_wool`, 1 + Math.floor(Math.random() * 3)));
      st.damage++;
      if (st.damage >= st.maxDamage) be.items[slot] = null;
      return;
    }
    return;
  }
  drop();
}

/** Liga os circuitos ao nível e ao jogo. */
export function installFulgorGame(level: Level): { tick(): void } {
  installFulgor(level, {
    primeTnt: (x, y, z, fuse) => { primeTnt(level, x, y, z, fuse); },
    dispense: (x, y, z, s) => dispense(level, x, y, z, s),
  });
  level.on((e) => {
    if (e.type === 'primeTnt') primeTnt(level, e.x as number, e.y as number, e.z as number, e.fuse as number);
    else if (e.type === 'projectileHitBlock') {
      const x = e.x as number, y = e.y as number, z = e.z as number;
      const s = level.getBlock(x, y, z);
      const n = BLOCKS[BLOCK_OF[s]].name;
      if (n === 'target') hitTarget(level, x, y, z, e.px as number, e.py as number, e.pz as number, e.kind === 'arrow');
      else if (SHAPE[s] === SHAPE_IDS.button && !n.startsWith('stone') && e.kind === 'arrow' && !STATE_PROPS[s].powered) {
        level.setBlock(x, y, z, withProp(s, 'powered', true));
        level.scheduleTick(x, y, z, s, 30);
      } else if (n === 'tnt' && e.burning) { level.setBlock(x, y, z, 0); primeTnt(level, x, y, z); }
    }
  });
  return {
    tick() {
      tickPlates(level);
      if (level.gameTime % 20 === 0) {
        const c = celestialAngle(level.dayTime);
        for (const p of level.pois.pois.values()) if (p.type === 'sensor') updateDaylight(level, p.x, p.y, p.z, c);
      }
    },
  };
}
