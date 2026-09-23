/**
 * Vegetação de 1–2 blocos (local ao chunk): grama, samambaias, flores, cactos, cana, abóboras,
 * melancias, cogumelos, amoras, vitórias-régias, algas e capim-marinho.
 */
import { SEA_LEVEL } from '../../../core/constants';
import { Random } from '../../../core/rng';
import { S, isAir, isWater } from '../../blocks';
import type { Chunk } from '../../chunk';
import { BIOMES } from '../biomes';

export interface ColumnInfo {
  /** y do bloco do topo (sólido ou fundo d'água) */
  top: Int16Array;
  /** 1 se há água acima do topo */
  wet: Uint8Array;
}

const grassTypes = new Set<number>();
let inited = false;
let ST: Record<string, number> = {};
function init(): void {
  if (inited) return;
  inited = true;
  ST = {
    grass: S('grass_block'), dirt: S('dirt'), sand: S('sand'), red_sand: S('red_sand'), podzol: S('podzol'),
    lume_moss: S('lume_moss'), mud: S('mud'), coarse: S('coarse_dirt'), snow: S('snow'),
    short_grass: S('short_grass'), fern: S('fern'), dead_bush: S('dead_bush'), cactus: S('cactus'),
    sugar_cane: S('sugar_cane'), pumpkin: S('pumpkin'), melon: S('melon'), brown_mushroom: S('brown_mushroom'),
    red_mushroom: S('red_mushroom'), lume_mushroom: S('lume_mushroom'), lily_pad: S('lily_pad'),
    kelp: S('kelp'), kelp_plant: S('kelp_plant'), seagrass: S('seagrass'), water: S('water'), clay: S('clay'),
    berries: S('sweet_berry_bush', { age: 3 }), gravel: S('gravel'),
  };
  grassTypes.add(ST.grass).add(ST.podzol).add(ST.lume_moss).add(ST.dirt).add(ST.coarse);
}

function dbl(name: string): [number, number] {
  return [S(name, { half: 'lower' }), S(name, { half: 'upper' })];
}

export function decorateVegetation(chunk: Chunk, seed: number, info: ColumnInfo): void {
  init();
  const r = Random.fromHash(seed, chunk.cx, chunk.cz, 0x7e9);
  const get = (x: number, y: number, z: number) => chunk.getBlock(x, y, z);
  const set = (x: number, y: number, z: number, s: number) => chunk.setBlockRaw(x, y, z, s);
  const canPlant = (x: number, z: number): number => {
    const y = info.top[(z << 4) | x];
    if (info.wet[(z << 4) | x]) return -1000;
    const g = get(x, y, z);
    if (!grassTypes.has(g) && g !== ST.grass) return -1000;
    if (!isAir(get(x, y + 1, z))) return -1000;
    return y + 1;
  };
  const tallGrass = dbl('tall_grass'), largeFern = dbl('large_fern');

  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      const b = BIOMES[chunk.biomes[(z << 4) | x]];
      const top = info.top[(z << 4) | x];
      const wet = info.wet[(z << 4) | x];
      const ground = get(x, top, z);
      const roll = r.next();
      // --- aquático
      if (wet) {
        const depth = SEA_LEVEL - top;
        if (b.extras?.includes('kelp') && depth > 4 && roll < 0.08 && (ground === ST.gravel || ground === ST.sand || ground === ST.dirt)) {
          const len = Math.min(depth - 2, 3 + r.nextInt(12));
          for (let i = 1; i < len; i++) set(x, top + i, z, ST.kelp_plant);
          set(x, top + len, z, ST.kelp);
          continue;
        }
        if (b.extras?.includes('seagrass') && roll < 0.25 && depth >= 2) { set(x, top + 1, z, ST.seagrass); continue; }
        if (b.extras?.includes('lily_pad') && depth <= 2 && roll < 0.04) {
          let wy = top + 1;
          while (isWater(get(x, wy, z))) wy++;
          if (isAir(get(x, wy, z))) set(x, wy, z, ST.lily_pad);
        }
        continue;
      }
      const py = top + 1;
      if (!isAir(get(x, py, z))) continue;
      // --- deserto e ermos
      if (ground === ST.sand || ground === ST.red_sand) {
        if (b.extras?.includes('cactus') && roll < 0.006 && x > 0 && x < 15 && z > 0 && z < 15
          && isAir(get(x - 1, py, z)) && isAir(get(x + 1, py, z)) && isAir(get(x, py, z - 1)) && isAir(get(x, py, z + 1))) {
          const h = 1 + r.nextInt(3);
          for (let i = 0; i < h; i++) set(x, py + i, z, ST.cactus);
        } else if (b.extras?.includes('dead_bush') && roll < 0.012) set(x, py, z, ST.dead_bush);
        else if (b.extras?.includes('sugar_cane') && roll < 0.05 && nearWater(chunk, x, top, z)) {
          const h = 1 + r.nextInt(3);
          for (let i = 0; i < h; i++) set(x, py + i, z, ST.sugar_cane);
        }
        continue;
      }
      if (canPlant(x, z) < 0) continue;
      // --- cana perto d'água
      if (b.extras?.includes('sugar_cane') && roll < 0.08 && nearWater(chunk, x, top, z)) {
        const h = 1 + r.nextInt(3);
        for (let i = 0; i < h; i++) set(x, py + i, z, ST.sugar_cane);
        continue;
      }
      const density = b.grassDensity / 256;
      const fdens = b.flowerDensity / 256;
      if (roll < fdens * 3 && b.flowers.length) {
        set(x, py, z, S(b.flowers[r.nextInt(b.flowers.length)]));
      } else if (roll < fdens * 3 + density * 3) {
        const fernish = b.extras?.includes('ferns') && r.next() < 0.35;
        if (r.next() < 0.12 && isAir(get(x, py + 1, z))) {
          const [lo, hi] = fernish ? largeFern : tallGrass;
          set(x, py, z, lo); set(x, py + 1, z, hi);
        } else set(x, py, z, fernish ? ST.fern : ST.short_grass);
      } else if (b.extras?.includes('tall_grass') && roll < 0.35 && isAir(get(x, py + 1, z))) {
        set(x, py, z, tallGrass[0]); set(x, py + 1, z, tallGrass[1]);
      } else if (roll > 0.9965) {
        // raridades por bioma
        const e = b.extras ?? [];
        const pick = r.next();
        if (e.includes('pumpkin') && pick < 0.2) set(x, py, z, ST.pumpkin);
        else if (e.includes('melon') && pick < 0.5) set(x, py, z, ST.melon);
        else if (e.includes('berries') && pick < 0.6) set(x, py, z, ST.berries);
        else if (e.includes('mushrooms') && pick < 0.7) set(x, py, z, r.next() < 0.5 ? ST.brown_mushroom : ST.red_mushroom);
        else if (e.includes('lume_mushroom')) set(x, py, z, ST.lume_mushroom);
        else if (e.includes('sunflower') && isAir(get(x, py + 1, z))) {
          const [lo, hi] = dbl('sunflower'); set(x, py, z, lo); set(x, py + 1, z, hi);
        } else if ((e.includes('lilac') || e.includes('rose_bush') || e.includes('peony')) && isAir(get(x, py + 1, z))) {
          const opts = ['lilac', 'rose_bush', 'peony'].filter((o) => e.includes(o));
          const [lo, hi] = dbl(r.pick(opts)); set(x, py, z, lo); set(x, py + 1, z, hi);
        }
      } else if (b.extras?.includes('lume_mushroom') && roll > 0.985) {
        set(x, py, z, ST.lume_mushroom);
      }
    }
  }
}

function nearWater(c: Chunk, x: number, y: number, z: number): boolean {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nx > 15 || nz < 0 || nz > 15) continue;
    if (isWater(c.getBlock(nx, y, nz))) return true;
  }
  return false;
}
