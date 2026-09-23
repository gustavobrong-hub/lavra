/**
 * Conexões do pó de fulgor (getConnectingSide do original), compartilhadas entre a lógica de sinais e o
 * mesher (roda também no worker). 0 = não conecta, 1 = lado, 2 = sobe pela parede.
 * Fio isolado vira cruz (liga os 4 lados); com uma só conexão, vira linha (liga os dois lados opostos).
 */
import { BLOCKS, BLOCK_OF, OPAQUE, FLAGS, F_FULL_CUBE_COLLISION, SHAPE, SHAPE_IDS, STATE_PROPS } from '../blocks/registry';

export type Getter = (x: number, y: number, z: number) => number;
/** Ordem horizontal: norte, sul, oeste, leste (índices 2..5 do original). */
export const HDX = [0, 0, -1, 1], HDZ = [-1, 1, 0, 0];
const HNAME = ['north', 'south', 'west', 'east'];
const OPP = [1, 0, 3, 2];

let SOURCES: Uint8Array | null = null;
/** Blocos que emitem sinal (conectam o fio). */
function sources(): Uint8Array {
  if (SOURCES) return SOURCES;
  SOURCES = new Uint8Array(BLOCKS.length);
  for (const b of BLOCKS) {
    const n = b.name;
    if (n === 'fulgor_block' || n === 'lever' || n.endsWith('_button') || n.endsWith('pressure_plate') || n === 'fulgor_torch' || n === 'fulgor_wall_torch'
      || n === 'comparator' || n === 'target' || n === 'daylight_detector' || n === 'detector_rail' || n === 'trapped_chest') SOURCES[b.id] = 1;
  }
  return SOURCES;
}

export const isWire = (s: number): boolean => SHAPE[s] === SHAPE_IDS.dust;
/** Condutor: bloco sólido inteiro opaco que não é fonte (repassa energia forte). */
export function isConductor(s: number): boolean {
  if (s === 0 || !OPAQUE[s] || !(FLAGS[s] & F_FULL_CUBE_COLLISION)) return false;
  const n = BLOCKS[BLOCK_OF[s]].name;
  return n !== 'fulgor_block' && n !== 'observer' && n !== 'piston' && n !== 'sticky_piston' && n !== 'target';
}

/** O fio em (x,y,z) se liga ao bloco `s` no lado de índice d? (shouldConnectTo) */
function connectsTo(s: number, d: number): boolean {
  if (isWire(s)) return true;
  const sh = SHAPE[s];
  if (sh === SHAPE_IDS.repeater) {
    const f = STATE_PROPS[s].facing as string;
    return f === HNAME[d] || f === HNAME[OPP[d]];
  }
  const n = BLOCKS[BLOCK_OF[s]].name;
  if (n === 'observer') return STATE_PROPS[s].facing === HNAME[d];
  return sources()[BLOCK_OF[s]] === 1;
}

/** Conexão crua num lado (antes da regra de cruz/linha). */
function rawSide(get: Getter, x: number, y: number, z: number, d: number): 0 | 1 | 2 {
  const nx = x + HDX[d], nz = z + HDZ[d];
  const n = get(nx, y, nz);
  const above = get(x, y + 1, z);
  if (!isConductor(above)) {
    const canHold = isConductor(n) || SHAPE[n] === SHAPE_IDS.trapdoor;
    if (canHold && isWire(get(nx, y + 1, nz))) return OPAQUE[n] ? 2 : 1;
  }
  if (connectsTo(n, d)) return 1;
  if (!isConductor(n) && isWire(get(nx, y - 1, nz))) return 1;
  return 0;
}

/** Lados ligados (norte, sul, oeste, leste) já com a regra de cruz/linha. */
export function wireSides(get: Getter, x: number, y: number, z: number): [number, number, number, number] {
  const c = [0, 1, 2, 3].map((d) => rawSide(get, x, y, z, d)) as [number, number, number, number];
  const count = c.filter((v) => v > 0).length;
  if (count === 0) return [1, 1, 1, 1];
  if (count === 1) {
    for (let d = 0; d < 4; d++) if (c[d] > 0 && c[OPP[d]] === 0) c[OPP[d]] = 1;
  }
  return c;
}

/** Vizinhos de fio que trocam energia (mesma altura, degrau acima, degrau abaixo). */
export function wireNeighbors(get: Getter, x: number, y: number, z: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const aboveCond = isConductor(get(x, y + 1, z));
  for (let d = 0; d < 4; d++) {
    const nx = x + HDX[d], nz = z + HDZ[d];
    const n = get(nx, y, nz);
    if (isWire(n)) out.push([nx, y, nz]);
    if (isConductor(n)) { if (!aboveCond && isWire(get(nx, y + 1, nz))) out.push([nx, y + 1, nz]); }
    else if (isWire(get(nx, y - 1, nz))) out.push([nx, y - 1, nz]);
  }
  return out;
}
