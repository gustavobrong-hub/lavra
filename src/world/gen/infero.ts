/**
 * Gerador do Ínfero (segunda dimensão): caverna colossal entre y=0 e y=128, mar de lava em y=31,
 * teto e piso de rocha-mãe, biomas próprios (versão inicial; refinada no marco do Ínfero).
 */
import { OctaveNoise, Simplex2 } from '../../core/noise';
import { Random, hash3, hashToFloat, subSeed } from '../../core/rng';
import { S } from '../blocks';
import { Chunk, Section } from '../chunk';
import { computeColumnLight } from '../light/columnlight';
import { BIOME_ID } from './biomes';
import type { SpawnHint } from './overworld';

export const INFERO_LAVA = 31;
export const INFERO_TOP = 128;

export class InferoGenerator {
  private readonly dens: OctaveNoise;
  private readonly biomeN: Simplex2;
  private readonly biomeN2: Simplex2;

  constructor(readonly seed: number) {
    this.dens = new OctaveNoise(new Random(subSeed(seed, 'infero3d')), -6, [1, 1, 0.5, 0.25]);
    this.biomeN = new Simplex2(new Random(subSeed(seed, 'inferoBiome')));
    this.biomeN2 = new Simplex2(new Random(subSeed(seed, 'inferoBiome2')));
  }

  biomeAt(x: number, z: number): number {
    const a = this.biomeN.noise(x / 300, z / 300), b = this.biomeN2.noise(x / 260, z / 260);
    if (a > 0.45) return BIOME_ID.ember_forest;
    if (a < -0.45) return BIOME_ID.ash_forest;
    if (b > 0.5) return BIOME_ID.lament_valley;
    if (b < -0.55) return BIOME_ID.basalt_deltas;
    return BIOME_ID.infero_wastes;
  }

  generate(cx: number, cz: number): { chunk: Chunk; spawns: SpawnHint[] } {
    const chunk = new Chunk(cx, cz);
    const rack = S('brasalito'), lava = S('lava'), bedrock = S('bedrock');
    const secs: Section[] = [];
    for (let si = 0; si < 24; si++) secs.push(new Section(undefined, new Uint8Array(4096)));
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = cx * 16 + x, wz = cz * 16 + z;
      chunk.biomes[(z << 4) | x] = this.biomeAt(wx, wz);
      for (let y = 0; y < INFERO_TOP; y++) {
        let s = 0;
        if (y === 0 || y === INFERO_TOP - 1) s = bedrock;
        else if (y < 5 && hashToFloat(hash3(this.seed, wx, y, wz)) < (5 - y) / 5) s = bedrock;
        else if (y > INFERO_TOP - 6 && hashToFloat(hash3(this.seed ^ 7, wx, y, wz)) < (y - (INFERO_TOP - 6)) / 5) s = bedrock;
        else {
          const n = this.dens.sample(wx, y * 1.8, wz);
          const band = Math.abs(y - 64) / 64; // mais sólido perto do teto e do piso
          const d = n + band * band * 1.2 - 0.35;
          if (d > 0) s = rack;
          else if (y <= INFERO_LAVA) s = lava;
        }
        if (s) secs[(y + 64) >> 4].blocks[((y & 15) << 8) | (z << 4) | x] = s;
      }
    }
    secs.forEach((s, i) => { s.recount(); chunk.sections[i] = s.count ? s : null; });
    chunk.tints.fill(0xffff);
    computeColumnLight(chunk);
    return { chunk, spawns: [] };
  }
}
