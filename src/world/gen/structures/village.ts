/**
 * Planejador de vilas: uma tentativa por região de 34×34 chunks (separação mínima de 8, como o original),
 * em biomas de planície, deserto, savana, taiga, neve, selva e pântano. Layout próprio: praça com poço e
 * sino no centro, ruas de 3 blocos que crescem em ramos a partir da praça e construções viradas para a rua,
 * assentadas no relevo (alicerce até o chão, sem declives grandes nem água).
 */
import { Random } from '../../../core/rng';
import { SEA_LEVEL } from '../../../core/constants';
import { BIOMES } from '../biomes';
import type { OverworldGenerator, SpawnHint } from '../overworld';
import type { StructurePiece, StructurePlanner } from './index';
import type { ChunkWriter } from '../writer';
import { Build, STYLES, st, type Rot, type StylePalette } from './builder';
import { TEMPLATES, buildPlaza, type Template, type TplCtx } from './villagetemplates';
import { FLAGS, F_SOLID, F_FLUID, OPAQUE } from '../../blocks';

const SPACING = 34, SEPARATION = 8, SALT = 10387312;
const MAX_R = 72;

export function villageStyle(biome: string): string | null {
  switch (biome) {
    case 'plains': case 'sunflower_plains': case 'meadow': return 'planicie';
    case 'desert': return 'deserto';
    case 'savanna': case 'savanna_plateau': return 'savana';
    case 'taiga': case 'old_growth_taiga': return 'taiga';
    case 'snowy_plains': case 'snowy_taiga': return 'neve';
    case 'jungle': case 'sparse_jungle': return 'selva';
    case 'swamp': return 'pantano';
    default: return null;
  }
}

interface Rect { x0: number; z0: number; x1: number; z1: number }
const overlaps = (a: Rect, b: Rect, m = 0) => a.x0 - m <= b.x1 && a.x1 + m >= b.x0 && a.z0 - m <= b.z1 && a.z1 + m >= b.z0;

export interface VillageLayout {
  x: number; z: number; y: number; style: string;
  pieces: StructurePiece[];
  rects: Rect[];
  bounds: Rect;
}

/** Começo de vila da região (em coordenadas de chunk). */
export function regionStart(seed: number, rx: number, rz: number): [number, number] {
  const r = Random.fromHash(seed, rx, rz, SALT);
  return [rx * SPACING + r.nextInt(SPACING - SEPARATION), rz * SPACING + r.nextInt(SPACING - SEPARATION)];
}

export class VillagePlanner implements StructurePlanner {
  readonly name = 'vila';
  private readonly cache = new Map<string, VillageLayout | null>();

  /** Vilas cujo começo fica na região (rx, rz). */
  layout(gen: OverworldGenerator, rx: number, rz: number): VillageLayout | null {
    const key = `${rx},${rz}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    if (this.cache.size > 64) this.cache.clear();
    const [cx, cz] = regionStart(gen.seed, rx, rz);
    const lay = planVillage(gen, cx * 16 + 8, cz * 16 + 8);
    this.cache.set(key, lay);
    return lay;
  }

  private near(gen: OverworldGenerator, cx: number, cz: number): VillageLayout[] {
    const out: VillageLayout[] = [];
    const rx = Math.floor(cx / SPACING), rz = Math.floor(cz / SPACING);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const lay = this.layout(gen, rx + dx, rz + dz);
      if (!lay) continue;
      const b = lay.bounds;
      if (cx * 16 + 15 < b.x0 - 8 || cx * 16 > b.x1 + 8 || cz * 16 + 15 < b.z0 - 8 || cz * 16 > b.z1 + 8) continue;
      out.push(lay);
    }
    return out;
  }

  piecesNear(gen: OverworldGenerator, cx: number, cz: number): StructurePiece[] {
    const out: StructurePiece[] = [];
    for (const lay of this.near(gen, cx, cz)) out.push(...lay.pieces);
    return out;
  }

  /** Árvores não nascem dentro das vilas. */
  blocksTrees(gen: OverworldGenerator, x: number, z: number): boolean {
    const cx = x >> 4, cz = z >> 4;
    for (const lay of this.near(gen, cx, cz)) {
      const p: Rect = { x0: x, z0: z, x1: x, z1: z };
      for (const r of lay.rects) if (overlaps(r, p, 3)) return true;
    }
    return false;
  }
}

// ------------------------------------------------------------------ planejamento
function surface(gen: OverworldGenerator, x: number, z: number): number {
  return gen.terrain.surfaceY(x, z);
}

function planVillage(gen: OverworldGenerator, x: number, z: number): VillageLayout | null {
  const biome = BIOMES[gen.biomeAt(x, z)].name;
  const style = villageStyle(biome);
  if (!style) return null;
  const y = surface(gen, x, z);
  if (y < SEA_LEVEL) return null;
  // centro não pode ser muito acidentado
  let lo = y, hi = y;
  for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { const h = surface(gen, x + dx, z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  if (hi - lo > 4) return null;
  const pal = STYLES[style];
  const r = Random.fromHash(gen.seed, x, z, 0x7a11a);
  const pieces: StructurePiece[] = [];
  const rects: Rect[] = [];
  // praça
  const plaza: Rect = { x0: x - 5, z0: z - 5, x1: x + 5, z1: z + 5 };
  rects.push(plaza);
  pieces.push({
    minX: plaza.x0, minY: y - 6, minZ: plaza.z0, maxX: plaza.x1, maxY: y + 6, maxZ: plaza.z1,
    place(w, spawns) {
      const b = new Build(w, x, y, z, 0, pal);
      buildPlaza(b, ctx(w, spawns, style, Random.fromHash(gen.seed, x, z, 0x9a2)));
    },
  });
  // ruas: 4 saídas da praça, crescem em segmentos e ramificam
  interface Stub { x: number; z: number; dx: number; dz: number; depth: number }
  const stubs: Stub[] = [
    { x, z: z - 6, dx: 0, dz: -1, depth: 0 }, { x, z: z + 6, dx: 0, dz: 1, depth: 0 },
    { x: x - 6, z, dx: -1, dz: 0, depth: 0 }, { x: x + 6, z, dx: 1, dz: 0, depth: 0 },
  ];
  const roads: Rect[] = [];
  const counts = new Map<string, number>();
  let buildings = 0;
  while (stubs.length && roads.length < 18) {
    const s = stubs.shift()!;
    const len = 10 + r.nextInt(12);
    const ex = s.x + s.dx * (len - 1), ez = s.z + s.dz * (len - 1);
    const rect: Rect = s.dx !== 0
      ? { x0: Math.min(s.x, ex), z0: s.z - 1, x1: Math.max(s.x, ex), z1: s.z + 1 }
      : { x0: s.x - 1, z0: Math.min(s.z, ez), x1: s.x + 1, z1: Math.max(s.z, ez) };
    if (Math.max(Math.abs(rect.x0 - x), Math.abs(rect.x1 - x), Math.abs(rect.z0 - z), Math.abs(rect.z1 - z)) > MAX_R) continue;
    // não atravessa outras ruas (exceto a de origem, encostada) nem construções
    if (roads.some((o) => overlaps(o, rect) && !touchesEnd(o, s))) continue;
    if (rects.slice(1).some((o) => !roads.includes(o) && overlaps(o, rect))) continue;
    // relevo: sem degraus grandes nem água demais
    let wet = 0, prev = surface(gen, s.x, s.z), steep = false;
    for (let i = 0; i < len; i += 2) {
      const h = surface(gen, s.x + s.dx * i, s.z + s.dz * i);
      if (h < SEA_LEVEL) wet++;
      if (Math.abs(h - prev) > 3) steep = true;
      prev = h;
    }
    if (steep || wet > len / 5) continue;
    roads.push(rect);
    rects.push(rect);
    pieces.push(roadPiece(gen, rect, pal));
    // construções dos dois lados
    const along = s.dx !== 0 ? 'x' : 'z';
    for (const side of [-1, 1]) {
      let pos = 1 + r.nextInt(3);
      while (pos < len - 2) {
        const t = pickTemplate(r, counts);
        if (!t) break;
        const placed = tryPlace(gen, r, t, rect, along, side, pos, rects, x, z);
        if (placed) {
          rects.push(placed.rect);
          counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
          pieces.push(buildingPiece(gen, t, placed, pal, style));
          buildings++;
          pos += (along === 'x' ? placed.rect.x1 - placed.rect.x0 : placed.rect.z1 - placed.rect.z0) + 2 + r.nextInt(2);
        } else pos += 2;
      }
    }
    // continua reto e/ou ramifica
    const endX = s.x + s.dx * len, endZ = s.z + s.dz * len;
    if (s.depth < 3 && r.chance(0.75)) stubs.push({ x: endX, z: endZ, dx: s.dx, dz: s.dz, depth: s.depth + 1 });
    if (s.depth < 2) {
      const mx = s.x + s.dx * Math.floor(len / 2), mz = s.z + s.dz * Math.floor(len / 2);
      if (r.chance(0.45)) stubs.push({ x: mx + s.dz * 2, z: mz + s.dx * 2, dx: s.dz, dz: s.dx, depth: s.depth + 1 });
      if (r.chance(0.45)) stubs.push({ x: mx - s.dz * 2, z: mz - s.dx * 2, dx: -s.dz, dz: -s.dx, depth: s.depth + 1 });
    }
  }
  if (buildings < 4) return null;
  const bounds: Rect = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const q of rects) { bounds.x0 = Math.min(bounds.x0, q.x0); bounds.z0 = Math.min(bounds.z0, q.z0); bounds.x1 = Math.max(bounds.x1, q.x1); bounds.z1 = Math.max(bounds.z1, q.z1); }
  return { x, z, y, style, pieces, rects, bounds };
}

function touchesEnd(o: Rect, s: { x: number; z: number; dx: number; dz: number }): boolean {
  const px = s.x - s.dx, pz = s.z - s.dz;
  return px >= o.x0 - 1 && px <= o.x1 + 1 && pz >= o.z0 - 1 && pz <= o.z1 + 1;
}

function pickTemplate(r: Random, counts: Map<string, number>): Template | null {
  const ok = TEMPLATES.filter((t) => (counts.get(t.id) ?? 0) < t.max);
  if (!ok.length) return null;
  let total = 0;
  for (const t of ok) total += t.weight;
  let k = r.next() * total;
  for (const t of ok) { k -= t.weight; if (k <= 0) return t; }
  return ok[ok.length - 1];
}

interface Placed { rect: Rect; ox: number; oz: number; rot: Rot; y: number; seed: number }

/** Posiciona a construção ao lado da rua com a frente virada para ela. */
function tryPlace(gen: OverworldGenerator, r: Random, t: Template, road: Rect, along: 'x' | 'z', side: number, pos: number, rects: Rect[], cx: number, cz: number): Placed | null {
  const W = t.w, D = t.d;
  let rect: Rect, rot: Rot, ox: number, oz: number;
  if (along === 'x') {
    const x0 = road.x0 + pos;
    if (side < 0) { // ao norte da rua, frente para o sul
      rect = { x0, z0: road.z0 - 1 - D, x1: x0 + W - 1, z1: road.z0 - 2 };
      rot = 0; ox = rect.x0; oz = rect.z0;
    } else { // ao sul, frente para o norte
      rect = { x0, z0: road.z1 + 2, x1: x0 + W - 1, z1: road.z1 + 1 + D };
      rot = 2; ox = rect.x1; oz = rect.z1;
    }
  } else {
    const z0 = road.z0 + pos;
    if (side < 0) { // a oeste da rua, frente para o leste
      rect = { x0: road.x0 - 1 - D, z0, x1: road.x0 - 2, z1: z0 + W - 1 };
      rot = 3; ox = rect.x0; oz = rect.z1;
    } else { // a leste, frente para o oeste
      rect = { x0: road.x1 + 2, z0, x1: road.x1 + 1 + D, z1: z0 + W - 1 };
      rot = 1; ox = rect.x1; oz = rect.z0;
    }
  }
  if (Math.max(Math.abs(rect.x0 - cx), Math.abs(rect.x1 - cx), Math.abs(rect.z0 - cz), Math.abs(rect.z1 - cz)) > MAX_R) return null;
  if (along === 'x' ? rect.x1 > road.x1 : rect.z1 > road.z1) return null;
  for (const o of rects) if (overlaps(o, rect, o === road ? 0 : 1)) return null;
  // relevo
  let lo = Infinity, hi = -Infinity, sum = 0, n = 0, wet = 0;
  for (const [qx, qz] of [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1], [(rect.x0 + rect.x1) >> 1, (rect.z0 + rect.z1) >> 1]]) {
    const h = surface(gen, qx, qz);
    lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h; n++;
    if (h < SEA_LEVEL) wet++;
  }
  if (hi - lo > 5 || wet > 1) return null;
  const y = Math.max(SEA_LEVEL, Math.round(sum / n));
  return { rect, ox, oz, rot, y, seed: r.nextU32() };
}

function ctx(w: ChunkWriter, spawns: SpawnHint[], style: string, rr: Random): TplCtx {
  return {
    chunk: w.chunk, spawns, style,
    r: () => rr.next(),
    spawnHere: (x, y, z) => w.inside(x, y, z),
  };
}

function buildingPiece(gen: OverworldGenerator, t: Template, p: Placed, pal: StylePalette, style: string): StructurePiece {
  void gen;
  return {
    minX: p.rect.x0, minY: p.y - 12, minZ: p.rect.z0, maxX: p.rect.x1, maxY: p.y + t.h + 8, maxZ: p.rect.z1,
    place(w, spawns) {
      const b = new Build(w, p.ox, p.y, p.oz, p.rot, pal);
      t.build(b, ctx(w, spawns, style, new Random(p.seed)));
    },
  };
}

/** Rua de 3 blocos seguindo o relevo; ponte de tábuas sobre a água. */
function roadPiece(gen: OverworldGenerator, rect: Rect, pal: StylePalette): StructurePiece {
  return {
    minX: rect.x0, minY: SEA_LEVEL - 8, minZ: rect.z0, maxX: rect.x1, maxY: 200, maxZ: rect.z1,
    place(w) {
      const path = st(pal.path), bridge = st(pal.planks);
      for (let z = Math.max(rect.z0, w.z0); z <= Math.min(rect.z1, w.z0 + 15); z++) {
        for (let x = Math.max(rect.x0, w.x0); x <= Math.min(rect.x1, w.x0 + 15); x++) {
          // topo real da coluna (a geração já escreveu o terreno)
          let y = surface(gen, x, z) + 4;
          while (y > SEA_LEVEL - 10) {
            const s = w.get(x, y, z);
            if (s !== 0 && (FLAGS[s] & F_SOLID || FLAGS[s] & F_FLUID) && (OPAQUE[s] || FLAGS[s] & F_FLUID)) break;
            y--;
          }
          const top = w.get(x, y, z);
          if (FLAGS[top] & F_FLUID) { w.set(x, SEA_LEVEL - 1 >= y ? y : SEA_LEVEL - 1, z, bridge); continue; }
          w.set(x, y, z, path);
          for (let k = 1; k <= 3; k++) { const a = w.get(x, y + k, z); if (a !== 0 && !OPAQUE[a]) w.set(x, y + k, z, 0); }
        }
      }
    },
  };
}
