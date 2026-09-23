/**
 * Registro de criaturas: fábrica por tipo, preparação ao nascer (variantes por bioma, equipamento,
 * filhotes) e restauração a partir do save.
 */
import type { Level } from '../level';
import type { Mob } from './mob';
import { Cow, Pig, Sheep, Chicken, Rabbit, Musgarto } from './species/animals';
import { Wolf, Cat, Horse } from './species/tamables';
import { Lambari, Tambaqui, Baiacu, Acara } from './species/fish';
import { Carnical, Naufrago, Ossudo, Tecela, Pavio, Feiticeira, Gosma } from './species/monsters';
import { Assombro, Vulto, Espreitador } from './species/monsters2';
import { Fagulha, Brasal } from './species/infero';
import { Villager, Sentinela } from './species/village';
import { BIOMES } from '../../world/gen/biomes';
import type { Animal } from './animal';

export const MOB_FACTORY: Record<string, (L: Level) => Mob> = {
  cow: (L) => new Cow(L), pig: (L) => new Pig(L), sheep: (L) => new Sheep(L), chicken: (L) => new Chicken(L),
  rabbit: (L) => new Rabbit(L), musgarto: (L) => new Musgarto(L), wolf: (L) => new Wolf(L), cat: (L) => new Cat(L),
  horse: (L) => new Horse(L), lambari: (L) => new Lambari(L), tambaqui: (L) => new Tambaqui(L), baiacu: (L) => new Baiacu(L),
  acara: (L) => new Acara(L), carnical: (L) => new Carnical(L), naufrago: (L) => new Naufrago(L), ossudo: (L) => new Ossudo(L),
  tecela: (L) => new Tecela(L), pavio: (L) => new Pavio(L), feiticeira: (L) => new Feiticeira(L), gosma: (L) => new Gosma(L),
  assombro: (L) => new Assombro(L), vulto: (L) => new Vulto(L), espreitador: (L) => new Espreitador(L),
  fagulha: (L) => new Fagulha(L), brasal: (L) => new Brasal(L),
  villager: (L) => new Villager(L), sentinela: (L) => new Sentinela(L),
};

/** Registra fábricas extras (aldeões, sentinela, chefe) sem criar dependência circular. */
export function registerMob(type: string, f: (L: Level) => Mob): void { MOB_FACTORY[type] = f; }

export interface SpawnOpts {
  baby?: boolean;
  size?: number;
  yaw?: number;
  /** motivo: natural, geração do mundo, ovo de criação, gaiola, cruzamento, conversão */
  reason?: 'natural' | 'chunk' | 'egg' | 'spawner' | 'breed' | 'convert' | 'command';
}

function biomeAt(L: Level, x: number, z: number): string {
  const c = L.world.getChunk(Math.floor(x) >> 4, Math.floor(z) >> 4);
  if (!c) return 'plains';
  return BIOMES[c.biomes[((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)]]?.name ?? 'plains';
}

/** Cria, prepara e posiciona uma criatura (não adiciona ao nível). */
export function createMob(L: Level, type: string, x: number, y: number, z: number, o: SpawnOpts = {}): Mob | null {
  const f = MOB_FACTORY[type];
  if (!f) return null;
  const m = f(L);
  m.setPos(x, y, z);
  m.yaw = o.yaw ?? Math.random() * 360;
  m.init();
  finalize(L, m, o);
  return m;
}

export function spawnMob(L: Level, type: string, x: number, y: number, z: number, o: SpawnOpts = {}): Mob | null {
  const m = createMob(L, type, x, y, z, o);
  if (m) L.entities.add(m);
  return m;
}

/** finalizeSpawn do original: variantes, equipamento e filhotes. */
function finalize(L: Level, m: Mob, o: SpawnOpts): void {
  const biome = biomeAt(L, m.x, m.z);
  if (o.reason === 'egg' || o.reason === 'command' || o.reason === 'spawner') m.persistent = o.reason !== 'spawner';
  switch (m.type) {
    case 'carnical': case 'naufrago': {
      const c = m as Carnical;
      if (o.baby ?? Math.random() < 0.05) c.setBaby(true);
      if (o.reason !== 'convert') c.equipRandom();
      break;
    }
    case 'rabbit': {
      const r = m as Rabbit;
      if (biome === 'desert') r.variant = 'gold';
      else if (biome.includes('snow') || biome.includes('frozen') || biome === 'grove') r.variant = Math.random() < 0.8 ? 'white' : 'splotched';
      else r.variant = (['brown', 'brown', 'black', 'salt'] as const)[Math.floor(Math.random() * 4)];
      break;
    }
    case 'gosma': if (o.size) (m as Gosma).setSize(o.size); break;
    case 'tecela': break;
  }
  if (o.baby && (m as Animal).setBaby && m.type !== 'carnical' && m.type !== 'naufrago') (m as Animal).setBaby(true);
}

/** Restaura do save. */
export function loadMob(L: Level, d: Record<string, unknown>): Mob | null {
  const f = MOB_FACTORY[d.type as string];
  if (!f) return null;
  const m = f(L);
  m.init();
  m.load(d);
  return m;
}

export const MOB_LABELS: Record<string, string> = {
  cow: 'Vaca', pig: 'Porco', sheep: 'Ovelha', chicken: 'Galinha', rabbit: 'Coelho', musgarto: 'Musgarto', wolf: 'Lobo-guará',
  cat: 'Gato', horse: 'Cavalo', lambari: 'Lambari', tambaqui: 'Tambaqui', baiacu: 'Baiacu', acara: 'Acará', carnical: 'Carniçal',
  naufrago: 'Náufrago', ossudo: 'Ossudo', tecela: 'Tecelã', pavio: 'Pavio', feiticeira: 'Feiticeira', gosma: 'Gosma',
  assombro: 'Assombro', vulto: 'Vulto', espreitador: 'Espreitador', fagulha: 'Fagulha', brasal: 'Brasal',
  villager: 'Aldeão', sentinela: 'Sentinela', ignarca: 'Ignarca',
};
