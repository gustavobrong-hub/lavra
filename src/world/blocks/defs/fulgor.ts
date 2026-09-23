import type { BlockDef } from '../types';
import {
  ATTACH_FACE, COMP_MODE, DELAY, DOUBLE_HALF, EXTENDED, FACING4, FACING6, HALF, HINGE, LIT, LOCKED, OPEN,
  PISTON_TYPE, POWER16, POWERED, RAIL_SHAPE, RAIL_SHAPE_STRAIGHT, TRIGGERED,
} from '../props';

const tiny = { hardness: 0, sound: 'wood' as const, layer: 'cutout' as const, opaque: false, tab: 'fulgor' as const };

export const FULGOR: BlockDef[] = [
  { name: 'fulgor_wire', label: 'Pó de fulgor', ...tiny, shape: 'dust', props: [POWER16], tex: { top: 'fulgor_dust_dot', side: 'fulgor_dust_line' }, tint: 'fulgor', light: (p) => ((p.power as number) > 0 ? Math.min(7, 1 + ((p.power as number) >> 1)) : 0), noItem: true, itemOf: 'fulgor_dust', sound: 'none' },
  { name: 'fulgor_torch', label: 'Tocha de fulgor', ...tiny, shape: 'torch', props: [LIT], defaults: { lit: true }, tex: (p) => (p.lit ? 'fulgor_torch' : 'fulgor_torch_off'), light: (p) => (p.lit ? 7 : 0) },
  { name: 'fulgor_wall_torch', label: 'Tocha de fulgor', ...tiny, shape: 'walltorch', props: [FACING4, LIT], defaults: { lit: true }, tex: (p) => (p.lit ? 'fulgor_torch' : 'fulgor_torch_off'), light: (p) => (p.lit ? 7 : 0), noItem: true, itemOf: 'fulgor_torch' },
  { name: 'repeater', label: 'Repetidor', hardness: 0, sound: 'wood', shape: 'repeater', layer: 'cutout', opaque: false, props: [FACING4, DELAY, LOCKED, POWERED], tex: (p) => ({ top: p.powered ? 'repeater_on' : 'repeater', side: 'smooth_stone', bottom: 'smooth_stone' }), tab: 'fulgor' },
  { name: 'comparator', label: 'Comparador', hardness: 0, sound: 'wood', shape: 'comparator', layer: 'cutout', opaque: false, props: [FACING4, COMP_MODE, POWERED], tex: (p) => ({ top: p.powered ? 'comparator_on' : 'comparator', side: 'smooth_stone', bottom: 'smooth_stone' }), tab: 'fulgor' },
  { name: 'lever', label: 'Alavanca', hardness: 0.5, sound: 'wood', shape: 'lever', layer: 'cutout', opaque: false, props: [ATTACH_FACE, FACING4, POWERED], defaults: { face: 'wall' }, tex: { side: 'cobblestone', handle: 'lever' }, tab: 'fulgor' },
  { name: 'stone_button', label: 'Botão de pedra', hardness: 0.5, tool: 'pickaxe', sound: 'stone', shape: 'button', layer: 'solid', opaque: false, props: [ATTACH_FACE, FACING4, POWERED], defaults: { face: 'wall' }, tex: 'stone', tab: 'fulgor' },
  { name: 'stone_pressure_plate', label: 'Placa de pressão de pedra', hardness: 0.5, tool: 'pickaxe', requiresTool: true, sound: 'stone', shape: 'plate', layer: 'solid', opaque: false, props: [POWERED], tex: 'stone', tab: 'fulgor' },
  { name: 'light_weighted_pressure_plate', label: 'Placa de pressão leve', hardness: 0.5, tool: 'pickaxe', requiresTool: true, sound: 'metal', shape: 'plate', layer: 'solid', opaque: false, props: [POWER16], tex: 'gold_block', tab: 'fulgor' },
  { name: 'heavy_weighted_pressure_plate', label: 'Placa de pressão pesada', hardness: 0.5, tool: 'pickaxe', requiresTool: true, sound: 'metal', shape: 'plate', layer: 'solid', opaque: false, props: [POWER16], tex: 'iron_block', tab: 'fulgor' },
  { name: 'fulgor_lamp', label: 'Lâmpada de fulgor', hardness: 0.3, sound: 'glass', props: [LIT], tex: (p) => (p.lit ? 'fulgor_lamp_on' : 'fulgor_lamp'), light: (p) => (p.lit ? 15 : 0), tab: 'fulgor' },
  { name: 'piston', label: 'Pistão', hardness: 1.5, tool: 'pickaxe', sound: 'stone', shape: 'piston', layer: 'solid', opaque: false, props: [FACING6, EXTENDED], defaults: { facing: 'up' }, tex: { top: 'piston_top', side: 'piston_side', bottom: 'piston_bottom', inner: 'piston_inner' }, tab: 'fulgor' },
  { name: 'sticky_piston', label: 'Pistão pegajoso', hardness: 1.5, tool: 'pickaxe', sound: 'stone', shape: 'piston', layer: 'solid', opaque: false, props: [FACING6, EXTENDED], defaults: { facing: 'up' }, tex: { top: 'piston_top_sticky', side: 'piston_side', bottom: 'piston_bottom', inner: 'piston_inner' }, tab: 'fulgor' },
  { name: 'piston_head', label: 'Cabeça de pistão', hardness: 1.5, tool: 'pickaxe', sound: 'stone', shape: 'pistonhead', layer: 'solid', opaque: false, props: [FACING6, PISTON_TYPE], tex: (p) => ({ top: p.type === 'sticky' ? 'piston_top_sticky' : 'piston_top', side: 'piston_side', bottom: 'piston_top' }), noItem: true, tab: 'none' },
  { name: 'moving_piston', label: 'Bloco em movimento', hardness: -1, shape: 'none', layer: 'none', opaque: false, solid: false, noItem: true, tab: 'none' },
  { name: 'observer', label: 'Observador', hardness: 3, tool: 'pickaxe', requiresTool: true, sound: 'stone', props: [FACING6, POWERED], defaults: { facing: 'south' }, tex: (p) => {
    const faces: Record<string, string> = { north: 'observer_side', south: 'observer_side', west: 'observer_side', east: 'observer_side', up: 'observer_top', down: 'observer_top' };
    const f = p.facing as string;
    const back: Record<string, string> = { north: 'south', south: 'north', west: 'east', east: 'west', up: 'down', down: 'up' };
    faces[f] = 'observer_front';
    faces[back[f]] = p.powered ? 'observer_back_on' : 'observer_back';
    return faces;
  }, tab: 'fulgor' },
  { name: 'tnt', label: 'TNT', hardness: 0, sound: 'grass', tex: { side: 'tnt_side', top: 'tnt_top', bottom: 'tnt_bottom' }, flammable: [15, 100], tab: 'fulgor' },
  { name: 'iron_door', label: 'Porta de ferro', hardness: 5, tool: 'pickaxe', requiresTool: true, sound: 'metal', shape: 'door', layer: 'cutout', opaque: false, props: [FACING4, DOUBLE_HALF, HINGE, OPEN, POWERED], tex: { top: 'iron_door_top', bottom: 'iron_door_bottom', side: 'iron_door_bottom' }, tab: 'fulgor' },
  { name: 'iron_trapdoor', label: 'Alçapão de ferro', hardness: 5, tool: 'pickaxe', requiresTool: true, sound: 'metal', shape: 'trapdoor', layer: 'cutout', opaque: false, props: [FACING4, HALF, OPEN, POWERED], tex: 'iron_trapdoor', tab: 'fulgor' },
  { name: 'rail', label: 'Trilho', hardness: 0.7, tool: 'pickaxe', sound: 'metal', shape: 'rail', layer: 'cutout', opaque: false, props: [RAIL_SHAPE], tex: (p) => (String(p.shape).includes('_') && ['south_east', 'south_west', 'north_west', 'north_east'].includes(p.shape as string) ? 'rail_corner' : 'rail'), tab: 'fulgor' },
  { name: 'powered_rail', label: 'Trilho energizado', hardness: 0.7, tool: 'pickaxe', sound: 'metal', shape: 'rail', layer: 'cutout', opaque: false, props: [RAIL_SHAPE_STRAIGHT, POWERED], tex: (p) => (p.powered ? 'powered_rail_on' : 'powered_rail'), tab: 'fulgor' },
  { name: 'detector_rail', label: 'Trilho detector', hardness: 0.7, tool: 'pickaxe', sound: 'metal', shape: 'rail', layer: 'cutout', opaque: false, props: [RAIL_SHAPE_STRAIGHT, POWERED], tex: (p) => (p.powered ? 'detector_rail_on' : 'detector_rail'), tab: 'fulgor' },
  { name: 'activator_rail', label: 'Trilho ativador', hardness: 0.7, tool: 'pickaxe', sound: 'metal', shape: 'rail', layer: 'cutout', opaque: false, props: [RAIL_SHAPE_STRAIGHT, POWERED], tex: (p) => (p.powered ? 'activator_rail_on' : 'activator_rail'), tab: 'fulgor' },
  { name: 'dispenser', label: 'Ejetor', hardness: 3.5, tool: 'pickaxe', requiresTool: true, sound: 'stone', props: [FACING6, TRIGGERED], defaults: { facing: 'north' }, tex: (p) => {
    const f = p.facing as string;
    if (f === 'up' || f === 'down') return { side: 'furnace_top', [f]: 'dispenser_front_vertical' };
    return { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', [f]: 'dispenser_front' };
  }, tab: 'fulgor' },
  { name: 'dropper', label: 'Liberador', hardness: 3.5, tool: 'pickaxe', requiresTool: true, sound: 'stone', props: [FACING6, TRIGGERED], defaults: { facing: 'north' }, tex: (p) => {
    const f = p.facing as string;
    if (f === 'up' || f === 'down') return { side: 'furnace_top', [f]: 'dropper_front_vertical' };
    return { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', [f]: 'dropper_front' };
  }, tab: 'fulgor' },
  { name: 'note_block', label: 'Bloco musical', hardness: 0.8, tool: 'axe', sound: 'wood', props: [POWERED], tex: 'note_block', tab: 'fulgor' },
  { name: 'daylight_detector', label: 'Sensor de luz do dia', hardness: 0.2, tool: 'axe', sound: 'wood', shape: 'daylight', layer: 'solid', opaque: false, props: [POWER16, { name: 'inverted', values: [false, true] }], tex: (p) => ({ top: p.inverted ? 'daylight_detector_inverted_top' : 'daylight_detector_top', side: 'daylight_detector_side', bottom: 'daylight_detector_side' }), tab: 'fulgor' },
  { name: 'target', label: 'Alvo', hardness: 0.5, tool: 'hoe', sound: 'grass', props: [POWER16], tex: { side: 'target_side', top: 'target_top' }, tab: 'fulgor' },
  { name: 'fulgor_bulb', label: 'Candeeiro de fulgor', hardness: 0.3, sound: 'glass', props: [LIT, POWERED], tex: (p) => (p.lit ? 'fulgor_lamp_on' : 'fulgor_lamp'), light: (p) => (p.lit ? 15 : 0), noItem: true, tab: 'none' },
];
