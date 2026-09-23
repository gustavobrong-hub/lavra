/**
 * Ticks aleatórios (3 por seção por tick, como o original): plantações (velocidade pela terra arada ao
 * redor), terra arada (umidade pela água a até 4 blocos), mudas → árvores, grama e micélio se espalhando,
 * folhas soltas caindo (distância 7), cana e cacto crescendo até 3, caules de abóbora/melancia dando fruto,
 * amoras, gelo e neve derretendo perto de luz, minério de fulgor apagando.
 */
import type { Level } from '../../game/level';
import { BLOCKS, BLOCK_OF, FLAGS, STATE_PROPS, S, withProp, OPAQUE, LIGHT_OPACITY, F_WATER, F_WATERLOGGED, F_LEAVES, F_RANDOM_TICK, F_SOLID } from '../blocks';
import { growTree, saplingTree } from '../gen/features/trees';
import { Random } from '../../core/rng';
import type { ChunkWriter } from '../gen/writer';
import { MIN_Y, SECTION_COUNT } from '../../core/constants';
import { ItemStack } from '../../game/items/stack';

const nameOf = (s: number) => BLOCKS[BLOCK_OF[s]].name;
const age = (s: number) => (STATE_PROPS[s].age as number) ?? 0;
const H4: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/** Luz bruta máxima (céu sem escurecimento), como getRawBrightness(pos, 0). */
function raw(L: Level, x: number, y: number, z: number): number {
  const r = L.world.getLightRaw(x, y, z);
  return Math.max(r >> 4, r & 15);
}

/** Escritor sobre o mundo com a mesma interface usada pelas árvores da geração. */
class WorldWriter {
  readonly x0 = -1e9; readonly z0 = -1e9;
  constructor(private readonly L: Level) {}
  inside(): boolean { return true; }
  touches(): boolean { return true; }
  get(x: number, y: number, z: number): number { return this.L.getBlock(x, y, z); }
  set(x: number, y: number, z: number, s: number): void { this.L.setBlock(x, y, z, s); }
  soft(x: number, y: number, z: number, s: number): void {
    const c = this.L.getBlock(x, y, z);
    if (c === 0 || (FLAGS[c] & 2 && !(FLAGS[c] & 4))) this.L.setBlock(x, y, z, s);
  }
  leaves(x: number, y: number, z: number, s: number): void {
    const c = this.L.getBlock(x, y, z);
    if (c === 0 || (FLAGS[c] & 2 && !(FLAGS[c] & 4)) || FLAGS[c] & F_LEAVES) this.L.setBlock(x, y, z, s);
  }
  log(x: number, y: number, z: number, s: number): void {
    const c = this.L.getBlock(x, y, z);
    if (!OPAQUE[c] || FLAGS[c] & F_LEAVES) this.L.setBlock(x, y, z, s);
  }
}

// ------------------------------------------------------------------ plantações
/** getGrowthSpeed do original. */
function growthSpeed(L: Level, x: number, y: number, z: number, block: number): number {
  let f = 1;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    let g = 0;
    const s = L.getBlock(x + i, y - 1, z + j);
    if (nameOf(s) === 'farmland') g = (STATE_PROPS[s].moisture as number) > 0 ? 3 : 1;
    if (i !== 0 || j !== 0) g /= 4;
    f += g;
  }
  const same = (dx: number, dz: number) => BLOCK_OF[L.getBlock(x + dx, y, z + dz)] === block;
  const we = same(-1, 0) || same(1, 0), ns = same(0, -1) || same(0, 1);
  if (we && ns) f /= 2;
  else if (same(-1, -1) || same(1, -1) || same(1, 1) || same(-1, 1)) f /= 2;
  return f;
}

const CROP_MAX: Record<string, number> = { wheat: 7, carrots: 7, potatoes: 7, beetroots: 3, ember_wart: 3 };

export function growCrop(L: Level, x: number, y: number, z: number, s: number, steps = 1): boolean {
  const n = nameOf(s);
  const max = CROP_MAX[n];
  if (max === undefined) return false;
  const a = age(s);
  if (a >= max) return false;
  L.setBlock(x, y, z, withProp(s, 'age', Math.min(max, a + steps)));
  return true;
}

/** Caule: cresce e, maduro, dá fruto num vizinho livre sobre terra. */
function stemTick(L: Level, x: number, y: number, z: number, s: number, bonemeal = 0): void {
  const n = nameOf(s);
  const a = age(s);
  if (bonemeal) { L.setBlock(x, y, z, withProp(s, 'age', Math.min(7, a + bonemeal))); return; }
  if (a < 7) { L.setBlock(x, y, z, withProp(s, 'age', a + 1)); return; }
  const [dx, dz] = H4[Math.floor(Math.random() * 4)];
  const tx = x + dx, tz = z + dz;
  const below = nameOf(L.getBlock(tx, y - 1, tz));
  if (L.getBlock(tx, y, tz) !== 0 || !['dirt', 'grass_block', 'farmland', 'coarse_dirt', 'podzol', 'mud', 'moss_block', 'rooted_dirt'].includes(below)) return;
  const fruit = n === 'pumpkin_stem' ? 'pumpkin' : 'melon';
  L.setBlock(tx, y, tz, S(fruit));
  const facing = dx < 0 ? 'west' : dx > 0 ? 'east' : dz < 0 ? 'north' : 'south';
  L.setBlock(x, y, z, S(`attached_${n}`, { facing }));
}

// ------------------------------------------------------------------ mudas
export function growSapling(L: Level, x: number, y: number, z: number, s: number): void {
  if ((STATE_PROPS[s].stage as number) === 0) { L.setBlock(x, y, z, withProp(s, 'stage', 1)); return; }
  const n = nameOf(s);
  const wood = n.replace('_sapling', '');
  // 2×2 de mudas iguais (pinheiro, jatobá, carvalho-escuro) dá árvore grande
  let big = false, bx = x, bz = z;
  for (const [ox, oz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const ok = [[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => BLOCK_OF[L.getBlock(x + ox + a, y, z + oz + b)] === BLOCK_OF[s]);
    if (ok) { big = true; bx = x + ox; bz = z + oz; break; }
  }
  if (wood === 'dark_oak' && !big) return;
  const r = new Random((x * 73856093) ^ (z * 19349663) ^ (L.gameTime | 0));
  const kind = saplingTree(wood, r, big);
  // espaço livre acima
  for (let dy = 1; dy <= 5; dy++) if (OPAQUE[L.getBlock(x, y + dy, z)]) return;
  if (big) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) L.setBlock(bx + a, y, bz + b, 0);
  else L.setBlock(x, y, z, 0);
  growTree(kind, new WorldWriter(L) as unknown as ChunkWriter, r, big ? bx : x, y, big ? bz : z);
  L.emit('treeGrow', { x, y, z });
}

// ------------------------------------------------------------------ farinha de osso
export function boneMeal(L: Level, x: number, y: number, z: number): boolean {
  const s = L.getBlock(x, y, z);
  const n = nameOf(s);
  let ok = false;
  if (CROP_MAX[n] !== undefined && n !== 'ember_wart') ok = growCrop(L, x, y, z, s, 2 + Math.floor(Math.random() * 4));
  else if (n.endsWith('_sapling')) { ok = true; if (Math.random() < 0.45) growSapling(L, x, y, z, s); }
  else if (n === 'pumpkin_stem' || n === 'melon_stem') { ok = age(s) < 7; if (ok) stemTick(L, x, y, z, s, 2 + Math.floor(Math.random() * 4)); }
  else if (n === 'sweet_berry_bush') { ok = age(s) < 3; if (ok) L.setBlock(x, y, z, withProp(s, 'age', age(s) + 1)); }
  else if (n === 'grass_block' && L.getBlock(x, y + 1, z) === 0) {
    ok = true;
    // espalha capim e flores ao redor (caminhadas aleatórias, como o original)
    const flowers = ['buttercup', 'poppy', 'daisy', 'cornflower'];
    for (let i = 0; i < 128; i++) {
      let px = x, py = y + 1, pz = z;
      let valid = true;
      for (let j = 0; j < i / 16; j++) {
        px += Math.floor(Math.random() * 3) - 1; py += Math.floor(Math.random() * 3 - 1) * Math.floor(Math.random() * 3) / 2; pz += Math.floor(Math.random() * 3) - 1;
        py = Math.round(py);
        if (nameOf(L.getBlock(px, py - 1, pz)) !== 'grass_block' || OPAQUE[L.getBlock(px, py, pz)]) { valid = false; break; }
      }
      if (!valid || L.getBlock(px, py, pz) !== 0) continue;
      L.setBlock(px, py, pz, S(Math.random() < 0.125 ? flowers[Math.floor(Math.random() * flowers.length)] : 'short_grass'));
    }
  }
  if (ok) L.emit('particle', { kind: 'happy', x: x + 0.5, y: y + 0.5, z: z + 0.5, n: 15 });
  return ok;
}

// ------------------------------------------------------------------ comportamentos
function nearWater(L: Level, x: number, y: number, z: number): boolean {
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) for (let dy = 0; dy <= 1; dy++) {
    if (FLAGS[L.getBlock(x + dx, y + dy, z + dz)] & (F_WATER | F_WATERLOGGED)) return true;
  }
  return false;
}

export function toDirt(L: Level, x: number, y: number, z: number): void {
  L.setBlock(x, y, z, S('dirt'));
}

/** Pisotear terra arada (queda > 0,5 com chance pela altura). */
export function trample(L: Level, x: number, y: number, z: number, fall: number, big: boolean): void {
  const s = L.getBlock(x, y, z);
  if (nameOf(s) !== 'farmland' || !big) return;
  if (Math.random() >= fall - 0.5) return;
  const above = L.getBlock(x, y + 1, z);
  if (above && CROP_MAX[nameOf(above)] !== undefined || nameOf(above).endsWith('_stem')) L.breakBlock(x, y + 1, z, { drop: true });
  toDirt(L, x, y, z);
}

function leafDistance(L: Level, x: number, y: number, z: number): number {
  let d = 7;
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const n = L.getBlock(x + dx, y + dy, z + dz);
    const nm = nameOf(n);
    if (nm.endsWith('_log') || nm.endsWith('_wood') || nm === 'mushroom_stem') return 1;
    if (FLAGS[n] & F_LEAVES) d = Math.min(d, ((STATE_PROPS[n].distance as number) ?? 7) + 1);
  }
  return Math.min(7, d);
}

export function installGrowth(level: Level): void {
  level.behavior((n) => CROP_MAX[n] !== undefined, {
    randomTick(L, x, y, z, s) {
      const n = nameOf(s);
      if (n === 'ember_wart') { if (Math.random() * 10 < 1) growCrop(L, x, y, z, s); return; }
      if (raw(L, x, y, z) < 9) return;
      if (n === 'beetroots' && Math.random() * 3 >= 1) return;
      const f = growthSpeed(L, x, y, z, BLOCK_OF[s]);
      if (Math.floor(Math.random() * (Math.floor(25 / f) + 1)) === 0) growCrop(L, x, y, z, s);
    },
  });
  level.behavior((n) => n === 'pumpkin_stem' || n === 'melon_stem', {
    randomTick(L, x, y, z, s) {
      if (raw(L, x, y, z) < 9) return;
      const f = growthSpeed(L, x, y, z, BLOCK_OF[s]);
      if (Math.floor(Math.random() * (Math.floor(25 / f) + 1)) === 0) stemTick(L, x, y, z, s);
    },
  });
  level.behavior((n) => n === 'attached_pumpkin_stem' || n === 'attached_melon_stem', {
    neighbor(L, x, y, z, s) {
      const f = STATE_PROPS[s].facing as string;
      const d = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[f]!;
      const fruit = nameOf(L.getBlock(x + d[0], y, z + d[1]));
      if (fruit !== 'pumpkin' && fruit !== 'melon') L.setBlock(x, y, z, S(nameOf(s).replace('attached_', ''), { age: 7 }));
    },
  });
  level.behavior((n) => n === 'farmland', {
    randomTick(L, x, y, z, s) {
      const m = STATE_PROPS[s].moisture as number;
      const wet = nearWater(L, x, y, z) || L.isRainingAt(x, y + 1, z);
      if (wet) { if (m < 7) L.setBlock(x, y, z, withProp(s, 'moisture', 7)); return; }
      if (m > 0) { L.setBlock(x, y, z, withProp(s, 'moisture', m - 1)); return; }
      const above = nameOf(L.getBlock(x, y + 1, z));
      if (CROP_MAX[above] === undefined && !above.endsWith('_stem')) toDirt(L, x, y, z);
    },
    neighbor(L, x, y, z) {
      // bloco sólido em cima vira terra
      const a = L.getBlock(x, y + 1, z);
      if (FLAGS[a] & F_SOLID && OPAQUE[a]) toDirt(L, x, y, z);
    },
  });
  level.behavior((n) => n.endsWith('_sapling'), {
    randomTick(L, x, y, z, s) {
      const r = L.world.getLightRaw(x, y + 1, z);
      if (Math.max(r & 15, (r >> 4) - L.skyDarken) >= 9 && Math.random() * 7 < 1) growSapling(L, x, y, z, s);
    },
  });
  level.behavior((n) => n === 'grass_block' || n === 'mycelium' || n === 'lume_moss', {
    randomTick(L, x, y, z, s) {
      const above = L.getBlock(x, y + 1, z);
      const blocked = LIGHT_OPACITY[above] >= 15 || FLAGS[above] & F_WATER && !(FLAGS[above] & F_WATERLOGGED);
      if (blocked) { toDirt(L, x, y, z); return; }
      if (raw(L, x, y + 1, z) < 9) return;
      for (let i = 0; i < 4; i++) {
        const px = x + Math.floor(Math.random() * 3) - 1, py = y + Math.floor(Math.random() * 5) - 3, pz = z + Math.floor(Math.random() * 3) - 1;
        if (nameOf(L.getBlock(px, py, pz)) !== 'dirt') continue;
        const pa = L.getBlock(px, py + 1, pz);
        if (LIGHT_OPACITY[pa] >= 15 || FLAGS[pa] & F_WATER || raw(L, px, py + 1, pz) < 4) continue;
        L.setBlock(px, py, pz, withProp(s, 'snowy', nameOf(pa) === 'snow'));
      }
    },
  });
  level.behavior((n) => n.endsWith('_leaves'), {
    neighbor(L, x, y, z, s) { L.scheduleTick(x, y, z, s, 1); },
    tick(L, x, y, z, s) {
      const d = leafDistance(L, x, y, z);
      if (d !== STATE_PROPS[s].distance) L.setBlock(x, y, z, withProp(s, 'distance', d));
    },
    randomTick(L, x, y, z, s) {
      if (STATE_PROPS[s].persistent || (STATE_PROPS[s].distance as number) < 7) return;
      // confere de novo (folhas geradas podem estar com distância antiga)
      const d = leafDistance(L, x, y, z);
      if (d < 7) { L.setBlock(x, y, z, withProp(s, 'distance', d)); return; }
      L.breakBlock(x, y, z, { drop: true });
    },
  });
  level.behavior((n) => n === 'sugar_cane' || n === 'cactus', {
    randomTick(L, x, y, z, s) {
      if (L.getBlock(x, y + 1, z) !== 0) return;
      let h = 1;
      while (BLOCK_OF[L.getBlock(x, y - h, z)] === BLOCK_OF[s]) h++;
      if (h >= 3) return;
      const a = age(s);
      if (a >= 15) { L.setBlock(x, y + 1, z, S(nameOf(s))); L.setBlock(x, y, z, withProp(s, 'age', 0)); }
      else L.setBlock(x, y, z, withProp(s, 'age', a + 1));
    },
  });
  level.behavior((n) => n === 'sweet_berry_bush', {
    randomTick(L, x, y, z, s) {
      if (age(s) < 3 && Math.random() * 5 < 1 && raw(L, x, y + 1, z) >= 9) L.setBlock(x, y, z, withProp(s, 'age', age(s) + 1));
    },
  });
  level.behavior((n) => n === 'ice' || n === 'snow', {
    randomTick(L, x, y, z, s) {
      const bl = L.world.getLightRaw(x, y, z) & 15;
      if (nameOf(s) === 'snow') { if (bl > 11) L.setBlock(x, y, z, 0); return; }
      if (bl > 11 - LIGHT_OPACITY[s]) {
        const below = L.getBlock(x, y - 1, z);
        L.setBlock(x, y, z, below === 0 ? 0 : S('water'));
      }
    },
  });
  level.behavior((n) => n === 'fulgor_ore' || n === 'deepslate_fulgor_ore', {
    randomTick(L, x, y, z, s) { if (STATE_PROPS[s].lit) L.setBlock(x, y, z, withProp(s, 'lit', false)); },
  });
}

/** Colheita das amoras com a mão (idade ≥ 2). */
export function harvestBerries(L: Level, x: number, y: number, z: number, s: number): boolean {
  const a = age(s);
  if (a < 2) return false;
  const n = 1 + Math.floor(Math.random() * 2) + (a === 3 ? 1 : 0);
  L.spawnItem(x + 0.5, y + 0.5, z + 0.5, new ItemStack('sweet_berries', n));
  L.setBlock(x, y, z, withProp(s, 'age', 1));
  L.emit('sound', { name: 'berries.pick', x, y, z });
  return true;
}

/** Ticks aleatórios: `speed` posições por seção não vazia, em chunks a até `radius` do centro. */
export function randomTicks(L: Level, cx: number, cz: number, radius: number, speed: number): void {
  if (speed <= 0) return;
  const w = L.world;
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    const c = w.getChunk(cx + dx, cz + dz);
    if (!c) continue;
    for (let sy = 0; sy < SECTION_COUNT; sy++) {
      const sec = c.sections[sy];
      if (!sec || sec.count === 0) continue;
      for (let k = 0; k < speed; k++) {
        const i = Math.floor(Math.random() * 4096);
        const s = sec.blocks[i];
        if (!(FLAGS[s] & F_RANDOM_TICK)) continue;
        const b = L.behaviorOf(s);
        if (!b?.randomTick) continue;
        b.randomTick(L, c.cx * 16 + (i & 15), MIN_Y + sy * 16 + (i >> 8), c.cz * 16 + ((i >> 4) & 15), s);
      }
    }
  }
}
