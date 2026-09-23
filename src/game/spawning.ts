/**
 * Spawn natural (NaturalSpawner do original): limites por categoria escalados pelos chunks elegíveis
 * (monstros 70, criaturas 10, peixes 20, água 5 por 289 chunks), 3 grupos de até 4 tentativas por chunk,
 * distância 24–128 blocos do jogador, regras de luz (monstros: luz de bloco 0 e céu ≤ sorteio 0..7; animais
 * sobre grama com luz > 8) e listas ponderadas por bioma. Também o spawner de assombros (insônia ≥ 3 dias).
 */
import type { Level } from './level';
import type { Mob, MobCategory } from './entity/mob';
import { spawnMob } from './entity/registry';
import { BIOMES } from '../world/gen/biomes';
import { BLOCKS, BLOCK_OF, FLAGS, F_SOLID, F_FLUID, F_WATER, F_WATERLOGGED, F_FULL_CUBE_COLLISION, OPAQUE, F_LEAVES } from '../world/blocks';
import { MIN_Y } from '../core/constants';
import type { SpawnHint } from '../world/gen/overworld';
import type { Villager } from './village/villager';

interface Entry { type: string; weight: number; min: number; max: number }
type Table = Partial<Record<MobCategory, Entry[]>>;

const e = (type: string, weight: number, min: number, max: number): Entry => ({ type, weight, min, max });

const MONSTERS: Entry[] = [
  e('tecela', 100, 4, 4), e('carnical', 95, 4, 4), e('ossudo', 100, 4, 4), e('pavio', 100, 4, 4),
  e('gosma', 100, 4, 4), e('vulto', 10, 1, 4), e('feiticeira', 5, 1, 1), e('espreitador', 12, 1, 1),
];
const FARM: Entry[] = [e('sheep', 12, 4, 4), e('pig', 10, 4, 4), e('chicken', 10, 4, 4), e('cow', 8, 4, 4)];
const FISH_TEMPERATE: Entry[] = [e('lambari', 10, 3, 6)];
const FISH_WARM: Entry[] = [e('acara', 25, 8, 8), e('baiacu', 15, 1, 3)];
const FISH_RIVER: Entry[] = [e('tambaqui', 5, 1, 5)];

function tableFor(biome: string): Table {
  const b = BIOMES.find((x) => x.name === biome);
  if (!b) return { monster: MONSTERS, creature: FARM };
  if (b.name.startsWith('infero') || ['ember_forest', 'ash_forest', 'lament_valley', 'basalt_deltas'].includes(b.name)) {
    const inf: Record<string, Table> = {
      infero_wastes: { monster: [e('brasal', 50, 4, 4), e('fagulha', 10, 1, 2), e('vulto', 1, 4, 4)] },
      ember_forest: { monster: [e('fagulha', 20, 1, 3), e('vulto', 1, 4, 4)] },
      ash_forest: { monster: [e('vulto', 1, 4, 4), e('fagulha', 5, 1, 2)] },
      lament_valley: { monster: [e('ossudo', 20, 5, 5), e('brasal', 50, 4, 4), e('vulto', 1, 4, 4)] },
      basalt_deltas: { monster: [e('fagulha', 30, 1, 3), e('brasal', 40, 1, 1)] },
    };
    return inf[b.name] ?? {};
  }
  if (b.ocean) {
    const warm = b.name.includes('warm');
    const t: Table = { monster: [...MONSTERS.filter((x) => x.type !== 'gosma'), e('naufrago', 5, 1, 1)], water_ambient: warm ? FISH_WARM : FISH_TEMPERATE };
    return t;
  }
  if (b.river) return { monster: [...MONSTERS.filter((x) => x.type !== 'gosma'), e('naufrago', 100, 1, 1)], water_ambient: [...FISH_RIVER, ...FISH_TEMPERATE], creature: [] };
  const mon = MONSTERS.filter((x) => x.type !== 'gosma' || b.name === 'swamp');
  switch (b.name) {
    case 'desert': return { monster: mon, creature: [e('rabbit', 4, 2, 3)] };
    case 'snowy_plains': case 'snowy_taiga': case 'snowy_slopes': case 'grove': return { monster: mon, creature: [e('rabbit', 10, 2, 3), e('wolf', 1, 4, 4)] };
    case 'taiga': case 'old_growth_taiga': return { monster: mon, creature: [...FARM, e('wolf', 8, 4, 4), e('rabbit', 4, 2, 3)] };
    case 'forest': case 'birch_forest': case 'dark_forest': case 'flower_forest': return { monster: mon, creature: [...FARM, e('wolf', 5, 4, 4), e('musgarto', 4, 1, 3)] };
    case 'plains': case 'sunflower_plains': case 'meadow': return { monster: mon, creature: [...FARM, e('horse', 5, 2, 6), e('rabbit', 3, 2, 3)] };
    case 'savanna': case 'savanna_plateau': return { monster: mon, creature: [...FARM, e('horse', 1, 2, 6)] };
    case 'jungle': case 'sparse_jungle': return { monster: mon, creature: [...FARM, e('cat', 2, 1, 3), e('musgarto', 8, 1, 3)] };
    case 'swamp': return { monster: mon, creature: [...FARM, e('musgarto', 10, 1, 3)], water_ambient: FISH_TEMPERATE };
    case 'bosque_lume': return { monster: mon.filter((x) => x.type !== 'pavio'), creature: [e('musgarto', 12, 2, 4), e('rabbit', 6, 2, 3)] };
    case 'badlands': return { monster: mon, creature: [] };
    case 'jagged_peaks': case 'frozen_peaks': case 'stony_peaks': return { monster: mon, creature: [] };
    default: return { monster: mon, creature: FARM };
  }
}
const tableCache = new Map<string, Table>();
const tableOf = (biome: string): Table => { let t = tableCache.get(biome); if (!t) { t = tableFor(biome); tableCache.set(biome, t); } return t; };

const CAPS: Record<string, number> = { monster: 70, creature: 10, water_ambient: 20, water_creature: 5, ambient: 15 };

function weighted(list: Entry[], r: () => number): Entry | null {
  let total = 0;
  for (const x of list) total += x.weight;
  if (total <= 0) return null;
  let k = r() * total;
  for (const x of list) { k -= x.weight; if (k < 0) return x; }
  return list[list.length - 1];
}

export class NaturalSpawner {
  /** dias sem dormir (ticks), por jogador — alimenta o spawner de assombros */
  timeSinceRest = 0;
  private phantomDelay = 1200;

  constructor(private readonly level: Level) {}

  /** Um tick de spawn (chamado a cada tick de jogo). */
  tick(): void {
    const L = this.level;
    if (!L.rules.doMobSpawning || L.players.length === 0) return;
    const p = L.players[0];
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    // chunks elegíveis: raio 8 ao redor do jogador e carregados
    const chunks: [number, number][] = [];
    for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) if (L.world.getChunk(pcx + dx, pcz + dz)) chunks.push([pcx + dx, pcz + dz]);
    if (!chunks.length) return;
    // contagem atual por categoria
    const counts: Record<string, number> = {};
    for (const en of L.entities.list) {
      const m = en as Mob;
      if (!m.category || m.removed || (m as Mob).persistent && m.category !== 'creature') continue;
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    }
    const spawnAnimals = L.gameTime % 400 === 0;
    const cats: MobCategory[] = ['monster', 'water_ambient', 'water_creature', 'ambient'];
    if (spawnAnimals) cats.push('creature');
    for (const cat of cats) {
      if (cat === 'monster' && L.difficulty === 'peaceful') continue;
      const cap = Math.floor((CAPS[cat] * chunks.length) / 289);
      if ((counts[cat] ?? 0) >= cap) continue;
      // embaralha a ordem dos chunks (como o original)
      for (let i = chunks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [chunks[i], chunks[j]] = [chunks[j], chunks[i]]; }
      for (const [cx, cz] of chunks) {
        const n = this.spawnInChunk(cat, cx, cz);
        counts[cat] = (counts[cat] ?? 0) + n;
        if ((counts[cat] ?? 0) >= cap) break;
      }
    }
    this.phantoms();
  }

  private spawnInChunk(cat: MobCategory, cx: number, cz: number): number {
    const L = this.level;
    const w = L.world;
    const x0 = cx * 16 + Math.floor(Math.random() * 16), z0 = cz * 16 + Math.floor(Math.random() * 16);
    const top = w.heightAt(x0, z0) + 1;
    const y0 = MIN_Y + Math.floor(Math.random() * (top - MIN_Y + 1));
    const s0 = w.getBlock(x0, y0, z0);
    if (FLAGS[s0] & F_SOLID && OPAQUE[s0]) return 0;
    let spawned = 0;
    for (let pack = 0; pack < 3; pack++) {
      let x = x0, z = z0;
      let entry: Entry | null = null;
      let group = 0, inGroup = 0;
      const tries = Math.ceil(Math.random() * 4);
      for (let t = 0; t < tries; t++) {
        x += Math.floor(Math.random() * 6) - Math.floor(Math.random() * 6);
        z += Math.floor(Math.random() * 6) - Math.floor(Math.random() * 6);
        const y = y0;
        const p = L.nearestPlayer(x + 0.5, y, z + 0.5, -1);
        if (!p) return spawned;
        const d2 = p.distanceSq(x + 0.5, y, z + 0.5);
        if (d2 <= 24 * 24 || d2 > 128 * 128) continue;
        if (!w.isLoaded(x, z)) continue;
        if (!entry) {
          const biome = this.biomeAt(x, z);
          const list = tableOf(biome)[cat];
          if (!list?.length) return spawned;
          entry = weighted(list, Math.random);
          if (!entry) return spawned;
          group = entry.min + Math.floor(Math.random() * (1 + entry.max - entry.min));
        }
        if (!this.placementOk(entry.type, cat, x, y, z)) continue;
        if (!this.rulesOk(entry.type, cat, x, y, z)) continue;
        const m = spawnMob(L, entry.type, x + 0.5, y, z + 0.5, { reason: 'natural' });
        if (!m) continue;
        if (!m.isFree(m.bb)) { m.removed = true; L.entities.remove(m); continue; }
        spawned++; inGroup++;
        if (inGroup >= group || inGroup >= 4) break;
      }
    }
    return spawned;
  }

  private biomeAt(x: number, z: number): string {
    const c = this.level.world.getChunk(x >> 4, z >> 4);
    return c ? BIOMES[c.biomes[((z & 15) << 4) | (x & 15)]].name : 'plains';
  }

  /** Posição de spawn: no chão (terrestres) ou dentro d'água (aquáticos). */
  private placementOk(type: string, cat: MobCategory, x: number, y: number, z: number): boolean {
    const w = this.level.world;
    const here = w.getBlock(x, y, z), above = w.getBlock(x, y + 1, z), below = w.getBlock(x, y - 1, z);
    const wet = (s: number) => (FLAGS[s] & (F_WATER | F_WATERLOGGED)) !== 0;
    if (cat === 'water_ambient' || cat === 'water_creature' || type === 'naufrago') {
      return wet(here) && wet(above) && (type !== 'naufrago' || wet(w.getBlock(x, y - 1, z)) || FLAGS[below] & F_SOLID) !== 0;
    }
    if (FLAGS[here] & (F_SOLID | F_FLUID) || FLAGS[above] & (F_SOLID | F_FLUID)) return false;
    // chão: bloco inteiro e sólido; não em folhas, vidro, bedrock...
    if (!(FLAGS[below] & F_FULL_CUBE_COLLISION) || !OPAQUE[below] || FLAGS[below] & F_LEAVES) return false;
    const bn = BLOCKS[BLOCK_OF[below]].name;
    if (bn === 'bedrock' || bn === 'barrier' || bn === 'magma_block' && type !== 'fagulha') return false;
    if (type === 'vulto' && FLAGS[w.getBlock(x, y + 2, z)] & F_SOLID) return false;
    return true;
  }

  /** Regras de luz e bioma por espécie (checkSpawnRules). */
  private rulesOk(type: string, cat: MobCategory, x: number, y: number, z: number): boolean {
    const L = this.level;
    const w = L.world;
    const raw = w.getLightRaw(x, y, z);
    const sky = raw >> 4, block = raw & 15;
    if (cat === 'monster') {
      if (L.world.dim === 1) return block <= 11 || type === 'brasal';
      if (type === 'gosma') {
        // pântano à noite (luz ≤ 7, varia com a lua) ou "chunk de gosma" abaixo de y 40
        const biome = this.biomeAt(x, z);
        if (biome === 'swamp' && y > 50 && y < 70 && Math.random() < 0.5 && Math.max(block, sky - L.skyDarken) <= Math.floor(Math.random() * 8)) return true;
        return y < 40 && slimeChunk(L.world.seed, x >> 4, z >> 4) && Math.random() * 10 < 1;
      }
      if (type === 'espreitador' && y > 0) return false;
      if (type === 'naufrago') {
        const biome = this.biomeAt(x, z);
        if (biome.includes('river')) return Math.random() * 15 < 1 && dark();
        return Math.random() * 40 < 1 && y < 58 && dark();
      }
      if (sky > Math.floor(Math.random() * 32)) return false;
      if (block > 0) return false;
      return dark();
      function dark(): boolean {
        const thunder = L.thunderLevel > 0.9;
        const lum = Math.max(block, sky - (thunder ? 10 : L.skyDarken));
        return lum <= Math.floor(Math.random() * 8);
      }
    }
    if (cat === 'creature') {
      const below = BLOCKS[BLOCK_OF[w.getBlock(x, y - 1, z)]].name;
      const ok = below === 'grass_block' || below === 'snow_block' && type === 'rabbit' || below === 'sand' && type === 'rabbit' || below === 'lume_moss' || below === 'podzol';
      return ok && Math.max(block, sky) > 8;
    }
    if (cat === 'water_ambient') return y >= 50 && y <= 64;
    return true;
  }

  /** Spawn de animais na geração do chunk (dicas do gerador). */
  onGenerated(spawns: SpawnHint[]): void {
    const L = this.level;
    for (const h of spawns) {
      // criaturas de estruturas (vilas): posição exata, sem regras de spawn
      if (h.type === 'villager' || h.type === 'sentinela' || h.type === 'cat' || h.data?.pen) {
        for (let i = 0; i < h.count; i++) {
          const ox = h.count > 1 ? (Math.random() - 0.5) * 2 : 0, oz = h.count > 1 ? (Math.random() - 0.5) * 2 : 0;
          const m = spawnMob(L, h.type, h.x + ox, h.y, h.z + oz, { reason: 'chunk' });
          if (!m) continue;
          m.persistent = true;
          if (h.type === 'villager') {
            const v = m as Villager;
            const d = h.data ?? {};
            if (d.profession && d.profession !== 'nenhuma') v.profession = d.profession as Villager['profession'];
            if (d.style) v.style = d.style as Villager['style'];
            const bed = d.bed as [number, number, number] | undefined;
            if (bed) v.claimAt('bed', bed[0], bed[1], bed[2]);
          }
        }
        continue;
      }
      for (let i = 0; i < h.count; i++) {
        const x = Math.floor(h.x + (Math.random() - 0.5) * 6), z = Math.floor(h.z + (Math.random() - 0.5) * 6);
        let y = Math.floor(h.y) + 3;
        while (y > h.y - 6 && !(FLAGS[L.world.getBlock(x, y - 1, z)] & F_SOLID)) y--;
        if (!this.placementOk(h.type, 'creature', x, y, z)) continue;
        spawnMob(L, h.type, x + 0.5, y, z + 0.5, { reason: 'chunk' });
      }
    }
  }

  /** Assombros: noite, céu aberto, jogador sem dormir há ≥ 3 dias (PhantomSpawner). */
  private phantoms(): void {
    const L = this.level;
    if (L.world.dim !== 0) return;
    this.timeSinceRest++;
    if (--this.phantomDelay > 0) return;
    this.phantomDelay = (60 + Math.floor(Math.random() * 60)) * 20;
    if (L.skyDarken < 5 || L.difficulty === 'peaceful') return;
    for (const p of L.players) {
      if (p.dead || p.gameMode !== 'survival') continue;
      const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
      if (by < 63 || !L.canSeeSky(bx, by, bz)) continue;
      if (Math.random() * Math.max(1, this.timeSinceRest) < 72000) continue;
      const n = 1 + Math.floor(Math.random() * ({ easy: 1, normal: 2, hard: 3 }[L.difficulty as 'easy'] + 1));
      for (let i = 0; i < n; i++) {
        spawnMob(L, 'assombro', p.x + Math.random() * 16 - 8, p.y + 20 + Math.random() * 14, p.z + Math.random() * 16 - 8, { reason: 'natural' });
      }
    }
  }
}

/** Chunk de gosma: 10% dos chunks, determinístico pela semente (como o original). */
export function slimeChunk(seed: number, cx: number, cz: number): boolean {
  let h = Math.imul(cx * 0x4c1906 + cx * cx * 0x4307a7, 1) ^ Math.imul(cz * 0x5ac0db + cz * cz * 0x4b9, 1) ^ seed ^ 0x3ad8025f;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return ((h >>> 0) % 10) === 0;
}
