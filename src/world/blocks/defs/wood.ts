import type { BlockDef, TintKind } from '../types';
import {
  ATTACH_FACE, AXIS, DISTANCE7, DOUBLE_HALF, FACING4, HALF, HINGE, IN_WALL, OPEN, PERSISTENT, POWERED,
  ROTATION16, SLAB_TYPE, STAGE2,
} from '../props';

export interface WoodType { id: string; label: string; leafTint: TintKind; flammable: boolean; leafLight?: number }

export const WOODS: WoodType[] = [
  { id: 'oak', label: 'carvalho', leafTint: 'foliage', flammable: true },
  { id: 'spruce', label: 'pinheiro', leafTint: 'spruce', flammable: true },
  { id: 'birch', label: 'bétula', leafTint: 'birch', flammable: true },
  { id: 'jungle', label: 'jatobá', leafTint: 'foliage', flammable: true },
  { id: 'acacia', label: 'acácia', leafTint: 'foliage', flammable: true },
  { id: 'dark_oak', label: 'carvalho-escuro', leafTint: 'foliage', flammable: true },
  { id: 'lume', label: 'lume', leafTint: 'none', flammable: true, leafLight: 9 },
  { id: 'ash', label: 'cinzeiro', leafTint: 'none', flammable: false },
];

/** Texturas de tronco conforme o eixo (casca deitada fica girada 90°). */
export function logTex(side: string, end: string) {
  return (p: Record<string, unknown>) => {
    if (p.axis === 'x') return { up: `${side}@90`, down: `${side}@90`, north: `${side}@90`, south: `${side}@90`, west: end, east: end };
    if (p.axis === 'z') return { up: side, down: side, west: `${side}@90`, east: `${side}@90`, north: end, south: end };
    return { side, end };
  };
}

export function woodBlocks(w: WoodType): BlockDef[] {
  const fl: [number, number] | undefined = w.flammable ? [5, 20] : undefined;
  const flLog: [number, number] | undefined = w.flammable ? [5, 5] : undefined;
  const planks = `${w.id}_planks`;
  const base = { tool: 'axe' as const, sound: 'wood' as const };
  return [
    { name: `${w.id}_log`, label: `Tronco de ${w.label}`, hardness: 2, ...base, props: [AXIS], tex: logTex(`${w.id}_log`, `${w.id}_log_top`), flammable: flLog, tab: 'build' },
    { name: `stripped_${w.id}_log`, label: `Tronco descascado de ${w.label}`, hardness: 2, ...base, props: [AXIS], tex: logTex(`stripped_${w.id}_log`, `stripped_${w.id}_log_top`), flammable: flLog, tab: 'build' },
    { name: `${w.id}_wood`, label: `Madeira de ${w.label}`, hardness: 2, ...base, props: [AXIS], tex: logTex(`${w.id}_log`, `${w.id}_log`), flammable: flLog, tab: 'build' },
    { name: planks, label: `Tábuas de ${w.label}`, hardness: 2, resistance: 3, ...base, tex: planks, flammable: fl, tab: 'build' },
    {
      name: `${w.id}_leaves`, label: `Folhas de ${w.label}`, hardness: 0.2, tool: 'hoe', sound: 'grass', layer: 'cutout',
      opaque: false, opacity: 1, props: [DISTANCE7, PERSISTENT], defaults: { distance: 7, persistent: true },
      tex: `${w.id}_leaves`, tint: w.leafTint, waving: 1, randomTicks: true, flammable: w.flammable ? [30, 60] : undefined,
      light: w.leafLight ?? 0, tab: 'nature',
    },
    { name: `${w.id}_sapling`, label: `Muda de ${w.label}`, hardness: 0, shape: 'sapling', sound: 'plant', props: [STAGE2], tex: `${w.id}_sapling`, waving: 2, randomTicks: true, light: w.leafLight ? 5 : 0, tab: 'nature' },
    { name: `${w.id}_stairs`, label: `Escada de ${w.label}`, hardness: 2, resistance: 3, ...base, shape: 'stairs', layer: 'solid', opaque: false, props: [FACING4, HALF], tex: planks, flammable: fl, tab: 'build', data: { full: planks } },
    { name: `${w.id}_slab`, label: `Laje de ${w.label}`, hardness: 2, resistance: 3, ...base, shape: 'slab', layer: 'solid', opaque: false, props: [SLAB_TYPE], tex: planks, flammable: fl, tab: 'build', data: { full: planks } },
    { name: `${w.id}_fence`, label: `Cerca de ${w.label}`, hardness: 2, resistance: 3, ...base, shape: 'fence', layer: 'solid', opaque: false, tex: planks, flammable: fl, tab: 'deco' },
    { name: `${w.id}_fence_gate`, label: `Portão de ${w.label}`, hardness: 2, resistance: 3, ...base, shape: 'fencegate', layer: 'solid', opaque: false, props: [FACING4, OPEN, POWERED, IN_WALL], tex: planks, flammable: fl, tab: 'fulgor' },
    { name: `${w.id}_door`, label: `Porta de ${w.label}`, hardness: 3, ...base, shape: 'door', layer: 'cutout', opaque: false, props: [FACING4, DOUBLE_HALF, HINGE, OPEN, POWERED], tex: { top: `${w.id}_door_top`, bottom: `${w.id}_door_bottom`, side: `${w.id}_door_bottom` }, tab: 'fulgor' },
    { name: `${w.id}_trapdoor`, label: `Alçapão de ${w.label}`, hardness: 3, ...base, shape: 'trapdoor', layer: 'cutout', opaque: false, props: [FACING4, HALF, OPEN, POWERED], tex: `${w.id}_trapdoor`, tab: 'fulgor' },
    { name: `${w.id}_button`, label: `Botão de ${w.label}`, hardness: 0.5, ...base, shape: 'button', layer: 'solid', opaque: false, props: [ATTACH_FACE, FACING4, POWERED], tex: planks, tab: 'fulgor' },
    { name: `${w.id}_pressure_plate`, label: `Placa de pressão de ${w.label}`, hardness: 0.5, ...base, shape: 'plate', layer: 'solid', opaque: false, props: [POWERED], tex: planks, tab: 'fulgor' },
    { name: `${w.id}_sign`, label: `Placa de ${w.label}`, hardness: 1, ...base, shape: 'sign', layer: 'solid', opaque: false, props: [ROTATION16], tex: planks, tab: 'deco', data: { log: `${w.id}_log` } },
    { name: `${w.id}_wall_sign`, label: `Placa de ${w.label}`, hardness: 1, ...base, shape: 'wallsign', layer: 'solid', opaque: false, props: [FACING4], tex: planks, noItem: true, itemOf: `${w.id}_sign`, tab: 'none' },
  ];
}

export const WOOD_BLOCKS: BlockDef[] = WOODS.flatMap(woodBlocks);
