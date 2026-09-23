/**
 * Gerador da superfície (dimensão principal). Pipeline por coluna:
 * densidade → cavernas/aquíferos → superfície por bioma → rocha-mãe → minérios → árvores → vegetação → gelo/neve
 * → luz interna, heightmap e cores misturadas de bioma.
 */
import { LAVA_LEVEL, MAX_Y, MIN_Y, SEA_LEVEL } from '../../core/constants';
import { clamp, lerp, rgb565 } from '../../core/math';
import { Simplex2 } from '../../core/noise';
import { Random, hash2, hash3, hashToFloat, subSeed } from '../../core/rng';
import { S, OPAQUE, FLAGS, F_LEAVES, isAir } from '../blocks';
import { Chunk, Section } from '../chunk';
import { computeColumnLight } from '../light/columnlight';
import { BIOMES, type Biome } from './biomes';
import { CAVE_Y, CELL_Y, NCY, NY, TerrainSampler } from './terrain';
import { ChunkWriter } from './writer';
import { placeOres } from './features/ores';
import { growTree } from './features/trees';
import { decorateVegetation, type ColumnInfo } from './features/vegetation';
import { carveChunk } from './carvers';
import { placeStructures, type StructureHooks } from './structures';

export interface SpawnHint { type: string; x: number; y: number; z: number; count: number }

let ST: Record<string, number> | null = null;
function st(): Record<string, number> {
  if (ST) return ST;
  ST = {
    stone: S('stone'), deepslate: S('deepslate', { axis: 'y' }), water: S('water'), lava: S('lava'), bedrock: S('bedrock'),
    grass: S('grass_block'), grass_snowy: S('grass_block', { snowy: true }), dirt: S('dirt'), sand: S('sand'),
    red_sand: S('red_sand'), sandstone: S('sandstone'), red_sandstone: S('red_sandstone'), gravel: S('gravel'), clay: S('clay'),
    mud: S('mud'), podzol: S('podzol'), coarse: S('coarse_dirt'), snow_block: S('snow_block'), snow: S('snow'),
    ice: S('ice'), packed_ice: S('packed_ice'), lume_moss: S('lume_moss'), terracotta: S('terracotta'),
    calcite: S('calcite'), air: 0,
  };
  return ST;
}

const BAND_COLORS = ['orange', 'yellow', 'white', 'light_gray', 'red', 'brown', 'orange', 'white', 'red', 'yellow'];

export class OverworldGenerator {
  readonly terrain: TerrainSampler;
  private readonly surfNoise: Simplex2;
  private readonly patchNoise: Simplex2;
  hooks?: StructureHooks;

  constructor(readonly seed: number) {
    this.terrain = new TerrainSampler(seed);
    this.surfNoise = new Simplex2(new Random(subSeed(seed, 'surface')));
    this.patchNoise = new Simplex2(new Random(subSeed(seed, 'patch')));
  }

  biomeAt(x: number, z: number): number {
    const j = hash2(this.seed ^ 0x51f3, x, z);
    const jx = ((j & 3) - 1.5), jz = (((j >> 2) & 3) - 1.5);
    const gx = Math.floor((x + jx) / 4) * 4, gz = Math.floor((z + jz) / 4) * 4;
    return this.terrain.params(gx, gz).biome;
  }

  /** Tipo de bloco do topo naquela coluna (puro: usado também para validar árvores de chunks vizinhos). */
  topMaterial(x: number, z: number, y: number, b: Biome, slope: number): number {
    const T = st();
    const n = this.patchNoise.noise(x / 24, z / 24);
    if (b.mountain || b.name === 'windswept_hills' || b.name === 'stony_shore') {
      if (slope >= 4 || (b.surface === 'stone')) return y > 175 + n * 10 && b.precipitation === 'snow' ? T.snow_block : T.stone;
    }
    if (y > 190 + n * 12 && b.surface !== 'sand') return T.snow_block;
    switch (b.surface) {
      case 'sand': return T.sand;
      case 'red_sand': return T.red_sand;
      case 'terracotta': return slope >= 3 ? T.terracotta : T.red_sand;
      case 'snow': return b.mountain && y > 150 ? T.snow_block : T.grass_snowy;
      case 'stone': return T.stone;
      case 'gravel': return T.gravel;
      case 'podzol': return n > 0.25 ? T.coarse : T.podzol;
      case 'mud': return T.mud;
      case 'lume': return T.lume_moss;
      default: return b.name === 'savanna' && n > 0.55 ? T.coarse : T.grass;
    }
  }

  generate(cx: number, cz: number): { chunk: Chunk; spawns: SpawnHint[] } {
    const T = st();
    const chunk = new Chunk(cx, cz);
    const x0 = cx * 16, z0 = cz * 16;
    const ter = this.terrain;

    // ---------------------------------------------------------------- biomas por coluna
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) chunk.biomes[(z << 4) | x] = this.biomeAt(x0 + x, z0 + z);

    // ---------------------------------------------------------------- grade grossa
    const cols: Float32Array[] = [];
    const caves: Float32Array[] = [];
    const oceanCol: boolean[] = [];
    for (let j = 0; j <= 4; j++) {
      for (let i = 0; i <= 4; i++) {
        const gx = x0 + i * 4, gz = z0 + j * 4;
        const p = ter.params(gx, gz);
        cols.push(ter.column(gx, gz));
        caves.push(ter.caveColumn(gx, gz, p.h + p.amp));
        oceanCol.push(p.h < SEA_LEVEL - 1);
      }
    }

    const sections: Section[] = [];
    for (let si = 0; si < 24; si++) sections.push(new Section(undefined, new Uint8Array(4096)));
    const dens = new Float32Array(NY);
    const cav = new Float32Array(NCY);
    const tops = new Int16Array(256).fill(MIN_Y);
    const terrainTops = new Int16Array(256).fill(MIN_Y);

    for (let z = 0; z < 16; z++) {
      const j = z >> 2, tz = (z & 3) / 4;
      for (let x = 0; x < 16; x++) {
        const i = x >> 2, tx = (x & 3) / 4;
        const a = cols[j * 5 + i], b = cols[j * 5 + i + 1], c = cols[(j + 1) * 5 + i], d = cols[(j + 1) * 5 + i + 1];
        for (let k = 0; k < NY; k++) dens[k] = lerp(lerp(a[k], b[k], tx), lerp(c[k], d[k], tx), tz);
        const ca = caves[j * 5 + i], cb = caves[j * 5 + i + 1], cc = caves[(j + 1) * 5 + i], cd = caves[(j + 1) * 5 + i + 1];
        for (let k = 0; k < NCY; k++) cav[k] = lerp(lerp(ca[k], cb[k], tx), lerp(cc[k], cd[k], tx), tz);
        const ocean = oceanCol[j * 5 + i] || oceanCol[(j + 1) * 5 + i + 1];
        const wx = x0 + x, wz = z0 + z;
        let top = MIN_Y, ttop = MIN_Y;
        // primeiro acha o topo do terreno (sem cavernas) para proteger o fundo do mar
        for (let y = MAX_Y - 1; y >= MIN_Y; y--) {
          const f = (y - MIN_Y) / CELL_Y, k0 = Math.floor(f);
          const dv = k0 >= NY - 1 ? dens[NY - 1] : dens[k0] + (dens[k0 + 1] - dens[k0]) * (f - k0);
          if (dv > 0) { ttop = y; break; }
        }
        terrainTops[(z << 4) | x] = ttop;
        for (let y = MIN_Y; y < MAX_Y; y++) {
          const f = (y - MIN_Y) / CELL_Y, k0 = Math.floor(f);
          const dv = k0 >= NY - 1 ? dens[NY - 1] : dens[k0] + (dens[k0 + 1] - dens[k0]) * (f - k0);
          let s = 0;
          if (dv > 0) {
            const fc = (y - MIN_Y) / CAVE_Y, c0 = Math.floor(fc);
            const cv = c0 >= NCY - 1 ? cav[NCY - 1] : cav[c0] + (cav[c0 + 1] - cav[c0]) * (fc - c0);
            const protect = ocean && y > ttop - 9 && ttop < SEA_LEVEL + 2;
            if (cv < 0 && y > MIN_Y + 4 && !protect) {
              if (y < LAVA_LEVEL) s = T.lava;
              else {
                const lvl = ter.aquiferLevel(wx, y, wz);
                s = y <= lvl && y < SEA_LEVEL - 4 ? T.water : 0;
              }
            } else {
              if (y < 0) s = T.deepslate;
              else if (y < 8) s = hashToFloat(hash3(this.seed, wx, y, wz)) < (8 - y) / 8 ? T.deepslate : T.stone;
              else s = T.stone;
              if (y > top) top = y;
            }
          } else if (y <= SEA_LEVEL) s = T.water;
          if (s !== 0) {
            const sec = sections[(y - MIN_Y) >> 4];
            sec.blocks[((y & 15) << 8) | (z << 4) | x] = s;
          }
        }
        // rocha-mãe
        for (let y = MIN_Y; y <= MIN_Y + 4; y++) {
          const p = y === MIN_Y ? 1 : (MIN_Y + 5 - y) / 5;
          if (y === MIN_Y || hashToFloat(hash3(this.seed ^ 0xbed, wx, y, wz)) < p) {
            sections[0].blocks[((y & 15) << 8) | (z << 4) | x] = T.bedrock;
          }
        }
        tops[(z << 4) | x] = top;
      }
    }
    sections.forEach((s, i) => { s.recount(); chunk.sections[i] = s.count > 0 ? s : null; });

    // ---------------------------------------------------------------- superfície
    const height = (x: number, z: number): number => {
      if (x >= 0 && x < 16 && z >= 0 && z < 16) return terrainTops[(z << 4) | x];
      return ter.surfaceY(x0 + x, z0 + z);
    };
    const info: ColumnInfo = { top: new Int16Array(256), wet: new Uint8Array(256) };
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const wx = x0 + x, wz = z0 + z;
        const b = BIOMES[chunk.biomes[(z << 4) | x]];
        const top = tops[(z << 4) | x];
        info.top[(z << 4) | x] = top;
        if (top <= MIN_Y) continue;
        const wet = chunk.getBlock(x, top + 1, z) === T.water;
        info.wet[(z << 4) | x] = wet ? 1 : 0;
        const slope = Math.max(
          Math.abs(height(x + 1, z) - height(x - 1, z)),
          Math.abs(height(x, z + 1) - height(x, z - 1)),
        );
        const depth = 3 + Math.floor((this.surfNoise.noise(wx / 16, wz / 16) + 1) * 1.5);
        let topMat: number, filler: number, deep = 0;
        if (wet) {
          const uw = b.underwater;
          const n = this.patchNoise.noise(wx / 12, wz / 12);
          topMat = uw === 'sand' ? T.sand : uw === 'gravel' ? (n > 0.3 ? T.sand : T.gravel) : uw === 'clay' ? T.clay : uw === 'mud' ? T.mud : (n > 0.2 ? T.sand : T.dirt);
          if ((b.river || b.extras?.includes('clay')) && n < -0.55) topMat = T.clay;
          if (b.ocean && top < SEA_LEVEL - 18) topMat = n > 0.1 ? T.sand : T.gravel;
          filler = topMat === T.sand ? T.sand : topMat === T.gravel ? T.gravel : T.dirt;
          if (topMat === T.sand) deep = T.sandstone;
        } else {
          topMat = this.topMaterial(wx, wz, top, b, slope);
          filler = topMat === T.sand ? T.sand : topMat === T.red_sand ? T.terracotta : topMat === T.stone || topMat === T.snow_block ? T.stone : T.dirt;
          if (topMat === T.sand) deep = T.sandstone;
          if (b.beach && topMat === T.sand) deep = T.sandstone;
        }
        if (topMat === T.stone && filler === T.stone) { /* pedra exposta */ }
        else {
          let y = top;
          for (let dd = 0; dd <= depth && y > MIN_Y; dd++, y--) {
            const cur = chunk.getBlock(x, y, z);
            if (cur !== T.stone && cur !== T.deepslate) break;
            let m = dd === 0 ? topMat : filler;
            if (b.surface === 'terracotta' && dd > 0) {
              const band = BAND_COLORS[((y + Math.floor(this.patchNoise.noise(wx / 60, wz / 60) * 3)) % BAND_COLORS.length + BAND_COLORS.length) % BAND_COLORS.length];
              m = (y % 3 === 0) ? S(`${band}_terracotta`) : T.terracotta;
            }
            chunk.setBlockRaw(x, y, z, m);
          }
          if (deep) for (let dd = 0; dd < 3 && y > MIN_Y; dd++, y--) {
            const cur = chunk.getBlock(x, y, z);
            if (cur !== T.stone) break;
            chunk.setBlockRaw(x, y, z, deep);
          }
          if (b.surface === 'terracotta') {
            for (let dd = 0; dd < 20 && y > SEA_LEVEL - 10; dd++, y--) {
              const cur = chunk.getBlock(x, y, z);
              if (cur !== T.stone) continue;
              const band = BAND_COLORS[((y % BAND_COLORS.length) + BAND_COLORS.length) % BAND_COLORS.length];
              chunk.setBlockRaw(x, y, z, y % 2 === 0 ? S(`${band}_terracotta`) : T.terracotta);
            }
          }
        }
      }
    }

    const writer = new ChunkWriter(chunk);

    // ---------------------------------------------------------------- escavadores (ravinas e túneis)
    carveChunk(writer, this.seed, (x, z) => ter.surfaceY(x, z));

    // ---------------------------------------------------------------- minérios
    const isAirAt = (x: number, y: number, z: number): boolean => {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const s = writer.get(x + dx, y + dy, z + dz);
        if (s === 0) return true;
      }
      return false;
    };
    for (let sz = cz - 1; sz <= cz + 1; sz++) {
      for (let sx = cx - 1; sx <= cx + 1; sx++) {
        const p = ter.params(sx * 16 + 8, sz * 16 + 8);
        placeOres(writer, this.seed, sx, sz, BIOMES[p.biome].mountain === true || BIOMES[p.biome].name === 'windswept_hills', isAirAt);
      }
    }

    // ---------------------------------------------------------------- estruturas
    const spawns: SpawnHint[] = [];
    if (this.hooks) placeStructures(this.hooks, writer, this, spawns);

    // ---------------------------------------------------------------- árvores (chunks vizinhos incluídos)
    for (let sz = cz - 1; sz <= cz + 1; sz++) {
      for (let sx = cx - 1; sx <= cx + 1; sx++) this.treesFrom(writer, sx, sz);
    }

    // ---------------------------------------------------------------- vegetação local
    for (let i = 0; i < 256; i++) {
      // recalcula o topo (árvores podem ter mudado) só para vegetação no chão
      const x = i & 15, z = i >> 4;
      let y = info.top[i];
      while (y < MAX_Y - 1 && !isAir(chunk.getBlock(x, y + 1, z)) && chunk.getBlock(x, y + 1, z) !== T.water) y++;
      info.top[i] = y;
    }
    decorateVegetation(chunk, this.seed, info);

    // ---------------------------------------------------------------- neve e gelo
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const b = BIOMES[chunk.biomes[(z << 4) | x]];
        let y = MAX_Y - 1;
        while (y > MIN_Y && chunk.getBlock(x, y, z) === 0) y--;
        const s = chunk.getBlock(x, y, z);
        const cold = b.precipitation === 'snow' || y > 200;
        if (!cold) continue;
        if (s === T.water) { if (b.extras?.includes('ice') || b.river || b.precipitation === 'snow') chunk.setBlockRaw(x, y, z, T.ice); continue; }
        if (y + 1 < MAX_Y && (OPAQUE[s] || (FLAGS[s] & F_LEAVES))) {
          chunk.setBlockRaw(x, y + 1, z, T.snow);
          if (s === T.grass) chunk.setBlockRaw(x, y, z, T.grass_snowy);
        }
      }
    }

    // ---------------------------------------------------------------- spawn de animais na geração
    this.animalHints(chunk, info, spawns);

    // ---------------------------------------------------------------- cores misturadas de bioma
    this.blendTints(chunk);

    for (const s of chunk.sections) s?.recount();
    computeColumnLight(chunk);
    return { chunk, spawns };
  }

  /** Árvores originadas no chunk (sx, sz). Decisões dependem só do terreno puro (mesmo resultado de qualquer lado). */
  private treesFrom(w: ChunkWriter, sx: number, sz: number): void {
    const ter = this.terrain;
    const center = BIOMES[ter.params(sx * 16 + 8, sz * 16 + 8).biome];
    const r = Random.fromHash(this.seed, sx, sz, 0x7ee);
    let attempts = Math.floor(center.treeDensity);
    if (r.next() < center.treeDensity - attempts) attempts++;
    // florestas: variação por mancha
    for (let a = 0; a < attempts; a++) {
      const x = sx * 16 + r.nextInt(16), z = sz * 16 + r.nextInt(16);
      const kindRoll = r.next();
      if (!w.touches(x - 9, z - 9, x + 9, z + 9)) continue;
      const b = BIOMES[this.biomeAt(x, z)];
      if (!b.trees.length) continue;
      const y = ter.surfaceY(x, z);
      if (y < SEA_LEVEL) continue;
      const slope = Math.max(Math.abs(ter.surfaceY(x + 1, z) - ter.surfaceY(x - 1, z)), Math.abs(ter.surfaceY(x, z + 1) - ter.surfaceY(x, z - 1)));
      if (slope > 2) continue;
      const topM = this.topMaterial(x, z, y, b, slope);
      const T = st();
      if (topM !== T.grass && topM !== T.grass_snowy && topM !== T.podzol && topM !== T.coarse && topM !== T.lume_moss && topM !== T.dirt) continue;
      // caverna escavou o chão?
      const cave = ter.caveColumn(Math.floor(x / 4) * 4, Math.floor(z / 4) * 4, y + 4);
      if (cave[clamp(Math.round((y - MIN_Y) / CAVE_Y), 0, NCY - 1)] < 0.02) continue;
      let total = 0;
      for (const [, wgt] of b.trees) total += wgt;
      let pick = kindRoll * total;
      let kind = b.trees[0][0];
      for (const [k, wgt] of b.trees) { pick -= wgt; if (pick <= 0) { kind = k; break; } }
      growTree(kind, w, Random.fromHash(this.seed, x, z, 0x77), x, y + 1, z);
      // terra por baixo do tronco (se o topo era grama)
      if (w.inside(x, y, z)) {
        const g = w.get(x, y, z);
        if (g === T.grass || g === T.grass_snowy) w.set(x, y, z, T.dirt);
      }
    }
  }

  private animalHints(chunk: Chunk, info: ColumnInfo, out: SpawnHint[]): void {
    const r = Random.fromHash(this.seed, chunk.cx, chunk.cz, 0xa41);
    if (r.next() > 0.1) return;
    const x = r.nextInt(16), z = r.nextInt(16);
    const b = BIOMES[chunk.biomes[(z << 4) | x]];
    if (b.ocean || info.wet[(z << 4) | x]) return;
    const y = info.top[(z << 4) | x] + 1;
    const opts: string[] = b.name === 'desert' ? ['rabbit'] : b.name.includes('snow') ? ['rabbit', 'wolf'] :
      b.name === 'savanna' || b.name === 'savanna_plateau' ? ['horse', 'cow', 'sheep'] : b.name === 'jungle' ? ['chicken', 'musgarto', 'cat'] :
        b.name === 'bosque_lume' ? ['musgarto', 'rabbit'] : b.name.includes('taiga') ? ['wolf', 'rabbit', 'sheep'] : b.name === 'plains' || b.name === 'meadow' ? ['horse', 'cow', 'sheep', 'pig', 'chicken'] : ['cow', 'sheep', 'pig', 'chicken'];
    out.push({ type: r.pick(opts), x: chunk.cx * 16 + x + 0.5, y, z: chunk.cz * 16 + z + 0.5, count: 2 + r.nextInt(3) });
  }

  private blendTints(chunk: Chunk): void {
    // grade de quartos ao redor (margem de 2 quartos = 8 blocos)
    const N = 9;
    const gr = new Float32Array(N * N * 3), fo = new Float32Array(N * N * 3), wa = new Float32Array(N * N * 3);
    const x0 = chunk.cx * 16 - 8, z0 = chunk.cz * 16 - 8;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const b = BIOMES[this.terrain.params(x0 + i * 4, z0 + j * 4).biome];
      const k = (j * N + i) * 3;
      gr[k] = (b.grass >> 16) & 255; gr[k + 1] = (b.grass >> 8) & 255; gr[k + 2] = b.grass & 255;
      fo[k] = (b.foliage >> 16) & 255; fo[k + 1] = (b.foliage >> 8) & 255; fo[k + 2] = b.foliage & 255;
      wa[k] = (b.water >> 16) & 255; wa[k + 1] = (b.water >> 8) & 255; wa[k + 2] = b.water & 255;
    }
    const sample = (arr: Float32Array, fx: number, fz: number, c: number): number => {
      // média ponderada por distância num raio de 2 quartos
      let sum = 0, wsum = 0;
      const ci = fx / 4, cj = fz / 4;
      for (let j = Math.max(0, Math.floor(cj - 2)); j <= Math.min(N - 1, Math.ceil(cj + 2)); j++) {
        for (let i = Math.max(0, Math.floor(ci - 2)); i <= Math.min(N - 1, Math.ceil(ci + 2)); i++) {
          const d2 = (i - ci) * (i - ci) + (j - cj) * (j - cj);
          if (d2 > 6.25) continue;
          const w = 1 - d2 / 6.25;
          sum += arr[(j * N + i) * 3 + c] * w;
          wsum += w;
        }
      }
      return sum / wsum;
    };
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const fx = x + 8, fz = z + 8;
      const i = (z << 4) | x;
      const nudge = this.patchNoise.noise((chunk.cx * 16 + x) / 7, (chunk.cz * 16 + z) / 7) * 6;
      chunk.tints[i * 3] = rgb565(sample(gr, fx, fz, 0) + nudge, sample(gr, fx, fz, 1) + nudge, sample(gr, fx, fz, 2) + nudge * 0.5);
      chunk.tints[i * 3 + 1] = rgb565(sample(fo, fx, fz, 0) + nudge, sample(fo, fx, fz, 1) + nudge, sample(fo, fx, fz, 2));
      chunk.tints[i * 3 + 2] = rgb565(sample(wa, fx, fz, 0), sample(wa, fx, fz, 1), sample(wa, fx, fz, 2));
    }
  }
}
