/**
 * Efeitos de partículas do jogo: traduz eventos do nível (fumaça, corações, críticos…), quebra de blocos,
 * emissores de blocos próximos (fogueiras e chaminés, tochas, fogo, lava, folhas caindo), vaga-lumes à
 * noite e chuva/neve em volta da câmera.
 */
import type { Level } from '../level';
import { Particles, SP, PF } from '../../render/particles';
import { BLOCKS, BLOCK_OF, STATE_PROPS, TINT, TINT_IDS, FLAGS, F_LEAVES } from '../../world/blocks/registry';
import { BIOMES } from '../../world/gen/biomes';
import { MIN_Y, SECTION_COUNT } from '../../core/constants';

const E_CAMPFIRE = 1, E_TORCH = 2, E_FULGOR_TORCH = 3, E_FIRE = 4, E_LAVA = 5, E_LEAVES = 6;
const FIREFLY_BIOMES = new Set(['swamp', 'forest', 'flower_forest', 'plains', 'sunflower_plains', 'meadow', 'jungle', 'sparse_jungle', 'dark_forest', 'birch_forest', 'bosque_lume', 'river', 'taiga', 'old_growth_taiga']);

let KIND: Uint8Array | null = null;
function kindTable(): Uint8Array {
  if (KIND) return KIND;
  KIND = new Uint8Array(BLOCK_OF.length);
  for (let s = 0; s < BLOCK_OF.length; s++) {
    const b = BLOCKS[BLOCK_OF[s]];
    if (!b) continue;
    const n = b.name;
    if (n === 'campfire' || n === 'soul_campfire') KIND[s] = STATE_PROPS[s]?.lit === false ? 0 : E_CAMPFIRE;
    else if (n === 'torch' || n === 'wall_torch' || n === 'soul_torch' || n === 'soul_wall_torch') KIND[s] = E_TORCH;
    else if (n === 'fulgor_torch' || n === 'fulgor_wall_torch') KIND[s] = STATE_PROPS[s]?.lit === false ? 0 : E_FULGOR_TORCH;
    else if (n === 'fire' || n === 'soul_fire') KIND[s] = E_FIRE;
    else if (n === 'lava') KIND[s] = STATE_PROPS[s]?.level === 0 || STATE_PROPS[s]?.level === undefined ? E_LAVA : 0;
    else if (FLAGS[s] & F_LEAVES) KIND[s] = E_LEAVES;
  }
  return KIND;
}

const rnd = Math.random;
const hexRGB = (h: number): [number, number, number] => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const FACING: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

export class ParticleFx {
  /** emissores por seção (chave "cx,sy,cz") */
  private readonly emitters = new Map<string, Int32Array>();
  private scanQueue: [number, number, number][] = [];
  private center = [NaN, NaN, NaN];
  private fireflies = 0;

  constructor(private readonly level: Level, private readonly p: Particles, private readonly quality: () => number) {
    level.on((e) => {
      if (e.type === 'particle') this.onEvent(e as unknown as Record<string, unknown>);
      else if (e.type === 'blockBreak' && this.quality() > 0) {
        const s = e.state as number;
        if (s) this.p.blockDebris(s, e.x as number, e.y as number, e.z as number, this.tintFor(s, e.x as number, e.z as number));
      }
    });
    p.onSplash = (x, y, z) => {
      if (rnd() < 0.5) return;
      for (let i = 0; i < 2; i++) p.spawn({ x, y, z, vx: (rnd() - 0.5) * 1.5, vy: 1.5 + rnd() * 1.5, vz: (rnd() - 0.5) * 1.5, life: 0.25 + rnd() * 0.2, size: 0.035, sprite: SP.DROP, a: 0.8, grav: 18 });
    };
  }

  private mult(): number { return [0.25, 0.6, 1][this.quality()] ?? 1; }

  private tintFor(s: number, x: number, z: number): [number, number, number] | undefined {
    const t = TINT[s];
    if (t !== TINT_IDS.grass && t !== TINT_IDS.foliage && t !== TINT_IDS.birch && t !== TINT_IDS.spruce) return undefined;
    if (t === TINT_IDS.birch) return hexRGB(0x80a755);
    if (t === TINT_IDS.spruce) return hexRGB(0x619961);
    const c = this.level.world.getChunk(x >> 4, z >> 4);
    const b = BIOMES[c ? c.biomeAt(x & 15, z & 15) : 0];
    return hexRGB(t === TINT_IDS.grass ? b.grass : b.foliage);
  }

  // ------------------------------------------------------------------ eventos do nível
  private onEvent(e: Record<string, unknown>): void {
    const kind = e.kind as string;
    const x = e.x as number, y = e.y as number, z = e.z as number;
    const n = Math.max(1, Math.round(((e.n as number) ?? 1) * (this.quality() === 0 ? 0.4 : 1)));
    const P = this.p;
    for (let i = 0; i < n; i++) {
      const ox = (rnd() - 0.5) * 0.6, oy = (rnd() - 0.5) * 0.6, oz = (rnd() - 0.5) * 0.6;
      switch (kind) {
        case 'smoke':
          P.spawn({ x: x + ox, y: y + oy, z: z + oz, vx: ox * 0.3, vy: 0.4 + rnd() * 0.4, vz: oz * 0.3, life: 1 + rnd(), size: 0.1 + rnd() * 0.06, sprite: SP.SMOKE, r: 0.45, g: 0.45, b: 0.47, a: 0.85, flags: PF.ANIM, drag: 0.5 });
          break;
        case 'flame':
          P.spawn({ x: x + ox * 0.5, y: y + oy * 0.5, z: z + oz * 0.5, vy: 0.3, life: 0.5 + rnd() * 0.3, size: 0.08, sprite: SP.FLAME, flags: PF.EMISSIVE | PF.ANIM | PF.SHRINK });
          break;
        case 'heart':
          P.spawn({ x: x + ox, y: y + oy * 0.5, z: z + oz, vy: 0.6, life: 1.2, size: 0.12, sprite: SP.HEART, flags: PF.EMISSIVE, drag: 0.6 });
          break;
        case 'damage':
          P.spawn({ x: x + ox, y: y + oy * 0.5, z: z + oz, vy: 0.8, life: 0.9, size: 0.1, sprite: SP.HEART, r: 0.35, g: 0.12, b: 0.12, drag: 0.5 });
          break;
        case 'happy':
          P.spawn({ x: x + ox * 1.6, y: y + oy * 1.6, z: z + oz * 1.6, vy: 0.2, life: 0.8 + rnd() * 0.5, size: 0.09, sprite: SP.STAR, flags: PF.EMISSIVE | PF.FADE });
          break;
        case 'crit': case 'magicCrit': {
          const a = rnd() * Math.PI * 2, s = 2 + rnd() * 3;
          const c = kind === 'crit' ? [1, 0.95, 0.8] : [0.45, 0.85, 1];
          P.spawn({ x, y, z, vx: Math.cos(a) * s, vy: (rnd() - 0.3) * 3, vz: Math.sin(a) * s, life: 0.5 + rnd() * 0.3, size: 0.08, sprite: SP.CRIT, r: c[0], g: c[1], b: c[2], flags: PF.EMISSIVE | PF.SHRINK, drag: 0.1, grav: 4 });
          break;
        }
        case 'slime': case 'egg': case 'splash': {
          const c = kind === 'slime' ? [0.45, 0.85, 0.35] : kind === 'egg' ? [0.95, 0.9, 0.75] : [0.6, 0.7, 1];
          P.spawn({ x, y: y + 0.1, z, vx: ox * 6, vy: 2 + rnd() * 2, vz: oz * 6, life: 0.6 + rnd() * 0.4, size: 0.06, sprite: SP.DROP, r: c[0], g: c[1], b: c[2], flags: PF.COLLIDE, grav: 16 });
          break;
        }
        case 'snow':
          P.spawn({ x, y, z, vx: ox * 5, vy: 1 + rnd() * 2, vz: oz * 5, life: 0.6, size: 0.06, sprite: SP.SNOW, flags: PF.COLLIDE, grav: 14 });
          break;
        case 'portal':
          P.spawn({ x: x + ox, y: y + oy, z: z + oz, vx: ox * 2, vy: oy * 2, vz: oz * 2, life: 0.8, size: 0.06, sprite: SP.SPARK, r: 0.75, g: 0.35, b: 1, flags: PF.EMISSIVE | PF.SHRINK });
          break;
        case 'sweep':
          P.spawn({ x, y, z, life: 0.25, size: 0.5, sprite: SP.CLOUD, a: 0.6, flags: PF.GROW | PF.FADE });
          break;
        case 'block': {
          const s = e.state as number;
          if (s) { this.p.blockDebris(s, Math.floor(x), Math.floor(y), Math.floor(z), this.tintFor(s, Math.floor(x), Math.floor(z))); return; }
          break;
        }
        default:
          P.spawn({ x: x + ox, y: y + oy, z: z + oz, vy: 0.3, life: 0.6, size: 0.06, sprite: SP.SPARK, flags: PF.EMISSIVE | PF.SHRINK });
      }
    }
  }

  // ------------------------------------------------------------------ varredura de emissores
  private rescanCenter(cx: number, sy: number, cz: number): void {
    this.center = [cx, sy, cz];
    const R = 2;
    const q: [number, number, number][] = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) for (let dy = -2; dy <= 2; dy++) {
      const y = sy + dy;
      if (y < 0 || y >= SECTION_COUNT) continue;
      q.push([cx + dx, y, cz + dz]);
    }
    // mais perto primeiro
    q.sort((a, b) => (Math.abs(a[0] - cx) + Math.abs(a[2] - cz) + Math.abs(a[1] - sy)) - (Math.abs(b[0] - cx) + Math.abs(b[2] - cz) + Math.abs(b[1] - sy)));
    this.scanQueue = q;
    for (const k of [...this.emitters.keys()]) {
      const [x, y, z] = k.split(',').map(Number);
      if (Math.abs(x - cx) > R || Math.abs(z - cz) > R || Math.abs(y - sy) > 2) this.emitters.delete(k);
    }
  }

  private scanSection(cx: number, sy: number, cz: number): void {
    const w = this.level.world;
    const c = w.getChunk(cx, cz);
    const key = `${cx},${sy},${cz}`;
    const s = c?.sections[sy];
    if (!s) { this.emitters.delete(key); return; }
    const tab = kindTable();
    const b = s.blocks;
    const found: number[] = [];
    for (let i = 0; i < 4096; i++) {
      const st = b[i];
      if (st === 0) continue;
      const k = tab[st];
      if (!k) continue;
      const x = cx * 16 + (i & 15), z = cz * 16 + ((i >> 4) & 15), y = MIN_Y + sy * 16 + (i >> 8);
      if (k === E_LEAVES && w.getBlock(x, y - 1, z) !== 0) continue;
      if (k === E_LAVA && w.getBlock(x, y + 1, z) !== 0) continue;
      found.push(x, y, z, k, st);
    }
    if (found.length) this.emitters.set(key, Int32Array.from(found)); else this.emitters.delete(key);
  }

  // ------------------------------------------------------------------ por tick
  tick(px: number, py: number, pz: number, night: number, rain: number, time: number): void {
    if (this.quality() < 0) return;
    const cx = Math.floor(px / 16), cz = Math.floor(pz / 16), sy = Math.max(0, Math.min(SECTION_COUNT - 1, Math.floor((py - MIN_Y) / 16)));
    if (cx !== this.center[0] || cz !== this.center[2] || sy !== this.center[1]) this.rescanCenter(cx, sy, cz);
    if (!this.scanQueue.length) this.rescanCenter(cx, sy, cz);
    for (let i = 0; i < 6 && this.scanQueue.length; i++) { const [x, y, z] = this.scanQueue.shift()!; this.scanSection(x, y, z); }
    const m = this.mult();
    const P = this.p;
    const windX = 0.35 + Math.sin(time * 0.05) * 0.2, windZ = 0.12;
    for (const list of this.emitters.values()) {
      for (let j = 0; j < list.length; j += 5) {
        const x = list[j], y = list[j + 1], z = list[j + 2], k = list[j + 3], st = list[j + 4];
        switch (k) {
          case E_CAMPFIRE:
            if (rnd() < 0.35 * m) P.spawn({ x: x + 0.3 + rnd() * 0.4, y: y + 0.5, z: z + 0.3 + rnd() * 0.4, vx: windX * 0.4, vy: 1.1 + rnd() * 0.6, vz: windZ * 0.4, life: 5 + rnd() * 4, size: 0.3 + rnd() * 0.15, sprite: SP.SMOKE, r: 0.5, g: 0.5, b: 0.53, a: 0.32, flags: PF.GROW | PF.FADE, drag: 0.92, spin: (rnd() - 0.5) * 0.6 });
            if (rnd() < 0.06 * m) P.spawn({ x: x + 0.5, y: y + 0.4, z: z + 0.5, vx: (rnd() - 0.5) * 0.6, vy: 1.5 + rnd(), vz: (rnd() - 0.5) * 0.6, life: 0.8 + rnd() * 0.8, size: 0.03, sprite: SP.EMBER, flags: PF.EMISSIVE | PF.ADDITIVE | PF.SHRINK, grav: 0.8 });
            break;
          case E_TORCH: case E_FULGOR_TORCH: {
            const f = STATE_PROPS[st]?.facing as string | undefined;
            const d = f && FACING[f] ? FACING[f] : [0, 0];
            const fx = x + 0.5 - d[0] * 0.27, fz = z + 0.5 - d[1] * 0.27, fy = y + (f ? 0.92 : 0.72);
            if (k === E_TORCH) {
              if (rnd() < 0.05 * m) P.spawn({ x: fx, y: fy, z: fz, vy: 0.35 + rnd() * 0.2, life: 1 + rnd() * 0.6, size: 0.06, sprite: SP.SMOKE + 3, r: 0.3, g: 0.3, b: 0.32, a: 0.7, flags: PF.ANIM, drag: 0.5 });
              if (rnd() < 0.03 * m) P.spawn({ x: fx, y: fy - 0.05, z: fz, vy: 0.15, life: 0.35, size: 0.045, sprite: SP.FLAME, flags: PF.EMISSIVE | PF.ANIM | PF.SHRINK });
            } else if (rnd() < 0.05 * m) P.spawn({ x: fx + (rnd() - 0.5) * 0.1, y: fy - 0.1, z: fz + (rnd() - 0.5) * 0.1, vy: 0.2, life: 0.8, size: 0.03, sprite: SP.SPARK, r: 1, g: 0.2, b: 0.15, flags: PF.EMISSIVE | PF.SHRINK });
            break;
          }
          case E_FIRE:
            if (rnd() < 0.25 * m) P.spawn({ x: x + rnd(), y: y + 0.6, z: z + rnd(), vx: windX * 0.3, vy: 0.9 + rnd() * 0.5, vz: 0, life: 2 + rnd() * 2, size: 0.18 + rnd() * 0.1, sprite: SP.SMOKE, r: 0.3, g: 0.3, b: 0.3, a: 0.6, flags: PF.GROW | PF.FADE, drag: 0.9 });
            break;
          case E_LAVA:
            if (rnd() < 0.004 * m) P.spawn({ x: x + rnd(), y: y + 0.9, z: z + rnd(), vx: (rnd() - 0.5) * 1.5, vy: 3 + rnd() * 2, vz: (rnd() - 0.5) * 1.5, life: 1.5, size: 0.05, sprite: SP.EMBER, flags: PF.EMISSIVE | PF.ADDITIVE | PF.COLLIDE, grav: 9 });
            break;
          case E_LEAVES:
            if (rnd() < 0.0012 * m) {
              const t = this.tintFor(st, x, z) ?? [0.45, 0.65, 0.3];
              P.spawn({ x: x + rnd(), y: y - 0.05, z: z + rnd(), vx: windX * 0.6, vy: -0.7, vz: windZ, life: 7 + rnd() * 4, size: 0.07, sprite: SP.LEAF + (rnd() < 0.5 ? 1 : 0), r: t[0], g: t[1], b: t[2], flags: PF.COLLIDE | PF.WANDER | PF.FADE, drag: 0.5, spin: (rnd() - 0.5) * 3 });
            }
            break;
        }
      }
    }
    this.weather(px, py, pz, rain, m);
    this.ambient(px, py, pz, night, rain, m);
  }

  private biomeAt(x: number, z: number) {
    const c = this.level.world.getChunk(x >> 4, z >> 4);
    return BIOMES[c ? c.biomeAt(x & 15, z & 15) : 0];
  }

  private weather(px: number, py: number, pz: number, rain: number, m: number): void {
    if (rain < 0.05) return;
    const w = this.level.world;
    const n = Math.round(rain * 55 * m);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 14;
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      const bx = Math.floor(x), bz = Math.floor(z);
      const top = w.heightAt(bx, bz);
      if (top > py + 14) continue;
      const bio = this.biomeAt(bx, bz);
      if (bio.precipitation === 'none') continue;
      const y = Math.max(top + 1, py + 8 + rnd() * 8);
      const snow = bio.precipitation === 'snow' || bio.temp < 0.15 || y > 175;
      if (snow) this.p.spawn({ x, y, z, vx: 0.3, vy: -2.2 - rnd(), vz: 0.1, life: 8, size: 0.05, sprite: SP.SNOW, a: 0.95, flags: PF.COLLIDE | PF.WANDER, drag: 1 });
      else this.p.spawn({ x, y, z, vx: 0.4, vy: -17 - rnd() * 4, vz: 0.1, life: 2.2, size: 0.028, sprite: SP.RAIN, a: 0.55, flags: PF.COLLIDE | PF.STRETCH | PF.SPLASH });
    }
  }

  private ambient(px: number, py: number, pz: number, night: number, rain: number, m: number): void {
    // vaga-lumes em noites sem chuva, em biomas verdes
    if (night > 0.75 && rain < 0.2 && this.fireflies < 40 * m && rnd() < 0.6) {
      const bio = this.biomeAt(Math.floor(px), Math.floor(pz));
      if (FIREFLY_BIOMES.has(bio.name)) {
        const a = rnd() * Math.PI * 2, r = 3 + rnd() * 13;
        const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
        const top = this.level.world.heightAt(Math.floor(x), Math.floor(z));
        const y = top + 1 + rnd() * 2.5;
        if (Math.abs(y - py) < 10 && this.level.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 0) {
          const life = 6 + rnd() * 6;
          this.fireflies++;
          setTimeout(() => { this.fireflies--; }, life * 1000);
          this.p.spawn({ x, y, z, vx: (rnd() - 0.5) * 0.4, vy: (rnd() - 0.5) * 0.2, vz: (rnd() - 0.5) * 0.4, life, size: 0.1, sprite: SP.GLOW, r: 0.8, g: 1, b: 0.4, flags: PF.EMISSIVE | PF.ADDITIVE | PF.WANDER | PF.FADE, drag: 0.4 });
        }
      }
    }
  }
}
