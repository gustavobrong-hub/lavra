import type { PropDef } from './types';

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const FACING4: PropDef = { name: 'facing', values: ['north', 'south', 'west', 'east'] };
export const FACING6: PropDef = { name: 'facing', values: ['north', 'south', 'west', 'east', 'up', 'down'] };
export const AXIS: PropDef = { name: 'axis', values: ['y', 'x', 'z'] };
export const AXIS_H: PropDef = { name: 'axis', values: ['x', 'z'] };
export const HALF: PropDef = { name: 'half', values: ['bottom', 'top'] };
export const DOUBLE_HALF: PropDef = { name: 'half', values: ['lower', 'upper'] };
export const SLAB_TYPE: PropDef = { name: 'type', values: ['bottom', 'top', 'double'] };
export const POWERED: PropDef = { name: 'powered', values: [false, true] };
export const OPEN: PropDef = { name: 'open', values: [false, true] };
export const LIT: PropDef = { name: 'lit', values: [false, true] };
export const SNOWY: PropDef = { name: 'snowy', values: [false, true] };
export const HINGE: PropDef = { name: 'hinge', values: ['left', 'right'] };
export const IN_WALL: PropDef = { name: 'in_wall', values: [false, true] };
export const ATTACH_FACE: PropDef = { name: 'face', values: ['floor', 'wall', 'ceiling'] };
export const LEVEL16: PropDef = { name: 'level', values: range(0, 15) };
export const POWER16: PropDef = { name: 'power', values: range(0, 15) };
export const AGE = (max: number): PropDef => ({ name: 'age', values: range(0, max) });
export const MOISTURE: PropDef = { name: 'moisture', values: range(0, 7) };
export const LAYERS: PropDef = { name: 'layers', values: range(1, 8) };
export const DISTANCE7: PropDef = { name: 'distance', values: range(1, 7) };
export const PERSISTENT: PropDef = { name: 'persistent', values: [false, true] };
export const STAGE2: PropDef = { name: 'stage', values: [0, 1] };
export const ROTATION16: PropDef = { name: 'rotation', values: range(0, 15) };
export const DELAY: PropDef = { name: 'delay', values: [1, 2, 3, 4] };
export const LOCKED: PropDef = { name: 'locked', values: [false, true] };
export const COMP_MODE: PropDef = { name: 'mode', values: ['compare', 'subtract'] };
export const EXTENDED: PropDef = { name: 'extended', values: [false, true] };
export const PISTON_TYPE: PropDef = { name: 'type', values: ['normal', 'sticky'] };
export const BED_PART: PropDef = { name: 'part', values: ['foot', 'head'] };
export const OCCUPIED: PropDef = { name: 'occupied', values: [false, true] };
export const CHEST_TYPE: PropDef = { name: 'type', values: ['single', 'left', 'right'] };
export const RAIL_SHAPE: PropDef = {
  name: 'shape',
  values: ['north_south', 'east_west', 'ascending_east', 'ascending_west', 'ascending_north', 'ascending_south',
    'south_east', 'south_west', 'north_west', 'north_east'],
};
export const RAIL_SHAPE_STRAIGHT: PropDef = {
  name: 'shape',
  values: ['north_south', 'east_west', 'ascending_east', 'ascending_west', 'ascending_north', 'ascending_south'],
};
export const HANGING: PropDef = { name: 'hanging', values: [false, true] };
export const BITES: PropDef = { name: 'bites', values: range(0, 6) };
export const CAULDRON_LEVEL: PropDef = { name: 'level', values: [0, 1, 2, 3] };
export const COMPOSTER_LEVEL: PropDef = { name: 'level', values: range(0, 8) };
export const HAS_BOOK: PropDef = { name: 'has_book', values: [false, true] };
export const VINE_N: PropDef = { name: 'north', values: [false, true] };
export const VINE_S: PropDef = { name: 'south', values: [false, true] };
export const VINE_W: PropDef = { name: 'west', values: [false, true] };
export const VINE_E: PropDef = { name: 'east', values: [false, true] };
export const VINE_UP: PropDef = { name: 'up', values: [false, true] };
export const TRIGGERED: PropDef = { name: 'triggered', values: [false, true] };
export const BOTTLES: PropDef = { name: 'bottles', values: range(0, 7) };
export const EGGS: PropDef = { name: 'eggs', values: [1, 2, 3, 4] };
