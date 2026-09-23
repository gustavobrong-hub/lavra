/** Pintores: rochas, solos, grama, gelo, fluidos, minérios, blocos de minério e madeiras. */
import { Tex, type Painter, type Palette, hex, mix, pal, ramp, scale } from '../tex';
import {
  WOOD_PALS, cobble, dirt, gemBlock, grassSide, grassTop, gravel, leaves, logSide, logTop, metalBlock, ore, planks,
  polished, sand, stone,
} from '../styles';

const STONE: Palette = pal(0x5d5d61, 0x6c6c70, 0x7a7a7e, 0x87878b, 0x95959a);
const DEEP: Palette = pal(0x2e2e34, 0x38383f, 0x42424a, 0x4c4c54, 0x57575f);

function deepslate(t: Tex): void {
  // camadas horizontais escuras (rocha metamórfica)
  for (let y = 0; y < 16; y++) {
    const band = t.vnoise(0, y, 4, 2);
    for (let x = 0; x < 16; x++) {
      const v = band * 0.55 + t.vnoise(x * 2, y, 8, 3) * 0.3 + (t.white(x, y) - 0.5) * 0.25;
      t.px(x, y, DEEP[Math.max(0, Math.min(4, Math.floor(v * 5)))]);
      t.h(x, y, 0.35 + v * 0.3);
    }
  }
  for (let i = 0; i < 4; i++) {
    const y = t.rng.nextInt(16), x0 = t.rng.nextInt(16), len = 3 + t.rng.nextInt(5);
    for (let x = x0; x < x0 + len; x++) { t.px(x, y, scale(DEEP[0], 0.8)); t.h(x, y, 0.15); }
  }
  t.material(0.2, 0, 0.3);
}

function speckled(t: Tex, base: Palette, specks: [number, number][]): void {
  t.noisePal(base, { contrast: 1.05, salt: 6 });
  for (const [c, dens] of specks) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (t.white(x, y, c & 0xff) < dens) {
        t.px(x, y, hex(c));
        if (t.white(x, y, 99) < 0.5) t.px(x + 1, y, mix(hex(c), t.get(x + 1, y), 0.5));
        t.h(x, y, 0.62);
      }
    }
  }
  t.material(0.22, 0, 0.3);
}

const GRANITE = pal(0x8a5a48, 0x996553, 0xa6715e, 0xb07c68, 0xbb8874);
const DIORITE = pal(0x9c9c9e, 0xb4b4b6, 0xc6c6c8, 0xd4d4d6, 0xe2e2e4);
const ANDESITE = pal(0x6f6f70, 0x7d7d7e, 0x898a8b, 0x949596, 0xa0a1a2);

function lava(t: Tex, flowing: boolean): void {
  const f = t.frame / t.frames;
  const P = pal(0x7a1a02, 0xb8340a, 0xe0580f, 0xf58a1c, 0xffbf45, 0xffe89a);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const sy = flowing ? y - f * 16 : y;
    const a = t.vnoise(x + Math.sin((sy + f * 16) * 0.4) * 1.5, sy, 4, 1);
    const b = t.vnoise(x, sy + f * 8, 8, 2);
    const v = a * 0.65 + b * 0.35 + Math.sin(f * Math.PI * 2 + x * 0.3) * 0.04;
    const i = Math.max(0, Math.min(P.length - 1, Math.floor(v * P.length)));
    t.px(x, y, P[i]);
    t.h(x, y, 1 - v);
    t.m(x, y, 0.3 + v * 0.4, 0, 0, 0.55 + v * 0.45);
  }
}

function water(t: Tex): void {
  // base neutra (a cor vem do bioma e do shader de água)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = t.vnoise(x, y, 4, 1) * 0.6 + t.vnoise(x, y, 8, 2) * 0.4;
    const g = 170 + v * 60;
    t.px(x, y, [g, g, g], 190);
    t.h(x, y, v);
  }
  t.material(0.96, 0, 0);
}

function oreFor(base: 'stone' | 'deep', gem: Palette, extra: Partial<Parameters<typeof ore>[1]> = {}): Painter {
  return (t) => ore(t, { base: base === 'stone' ? (tt) => stone(tt, STONE, 2) : deepslate, gem, ...extra });
}

const COAL = pal(0x141416, 0x1f1f22, 0x2b2b2f, 0x3a3a3f, 0x55555c);
const IRON = pal(0x8a6a52, 0xb48a6a, 0xd2a882, 0xe6c3a0, 0xf4dcc0);
const COPPER = pal(0x7a3f22, 0xa65a2e, 0xc8733b, 0xdd8e56, 0x6cb89a);
const GOLD = pal(0x8a6a10, 0xc9a01d, 0xe8c238, 0xf8dc5c, 0xfff2a8);
const FULGOR = pal(0x0c4d5c, 0x137a8f, 0x1fb2c9, 0x5de4f0, 0xc8fbff);
const LAPIS = pal(0x0f2a78, 0x1b3fa3, 0x2957c9, 0x4677e0, 0x86a8f2);
const DIAMOND = pal(0x1a7f86, 0x2fb7bd, 0x5fe0dc, 0x9ff6ef, 0xe4fffc);
const EMERALD = pal(0x0b5a26, 0x128a38, 0x1db84c, 0x4be07a, 0xb6ffcf);

function woodSet(id: string): Record<string, Painter> {
  const w = WOOD_PALS[id];
  const leafPal: Palette = id === 'lume' ? pal(0x2a6f8a, 0x3b93b3, 0x57b8d6, 0x86dcef, 0xc4f6ff)
    : id === 'ash' ? pal(0x4e2f2f, 0x6a3b35, 0x87473c, 0xa35a44, 0xc27550)
      : id === 'birch' || id === 'spruce' ? pal(0x6c6c6c, 0x808080, 0x949494, 0xa6a6a6, 0xb8b8b8)
        : pal(0x5f5f5f, 0x737373, 0x878787, 0x999999, 0xababab);
  const out: Record<string, Painter> = {
    [`${id}_planks`]: (t) => planks(t, w.plank),
    [`${id}_log`]: (t) => logSide(t, w.bark, id === 'birch'),
    [`${id}_log_top`]: (t) => logTop(t, w.ring, w.bark),
    [`stripped_${id}_log`]: (t) => logSide(t, ramp(w.plank[3], 4, 0.18)),
    [`stripped_${id}_log_top`]: (t) => logTop(t, w.ring, ramp(w.plank[3], 4, 0.15)),
    [`${id}_leaves`]: (t) => {
      leaves(t, leafPal, id === 'spruce' ? 0.1 : id === 'lume' ? 0.2 : 0.16);
      if (id === 'lume') {
        // folhas-lume brilham (emissão + pontinhos claros)
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.alpha(x, y) > 0) t.m(x, y, 0.4, 0, 0.3, 0.35 + t.white(x, y, 8) * 0.3);
        for (let i = 0; i < 6; i++) { const x = t.rng.nextInt(16), y = t.rng.nextInt(16); if (t.alpha(x, y)) { t.px(x, y, hex(0xeaffff)); t.emit(x, y, 1); } }
      }
    },
  };
  return out;
}

export const NATURAL_PAINTERS: Record<string, Painter> = {
  stone: (t) => stone(t, STONE),
  smooth_stone: (t) => { polished(t, pal(0x80808a, 0x8c8c95, 0x9797a0, 0xa2a2aa, 0xacacb4)); for (let x = 0; x < 16; x++) { t.px(x, 0, hex(0xb4b4bc)); t.px(x, 15, hex(0x6f6f78)); } },
  granite: (t) => speckled(t, GRANITE, [[0x6d4032, 0.08], [0xd8a894, 0.05]]),
  polished_granite: (t) => polished(t, GRANITE),
  diorite: (t) => speckled(t, DIORITE, [[0x6c6c70, 0.09], [0xf6f6f8, 0.06]]),
  polished_diorite: (t) => polished(t, DIORITE),
  andesite: (t) => speckled(t, ANDESITE, [[0x5a5a5c, 0.07], [0xb2b3b4, 0.05]]),
  polished_andesite: (t) => polished(t, ANDESITE),
  deepslate,
  deepslate_top: (t) => { deepslate(t); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y * 3) % 7 === 0) t.shadePx(x, y, 0.85); },
  cobbled_deepslate: (t) => cobble(t, DEEP, hex(0x1e1e23)),
  polished_deepslate: (t) => polished(t, DEEP),
  deepslate_bricks: (t) => { t.fill(hex(0x24242a)); for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x0 = c * 8 + (r % 2) * 4; for (let y = r * 4; y < r * 4 + 3; y++) for (let x = x0; x < x0 + 7; x++) { t.px(x, y, DEEP[1 + Math.floor(t.fbm(x, y) * 3)]); t.h(x, y, 0.6); } } t.material(0.2, 0, 0.3); },
  deepslate_tiles: (t) => { t.fill(hex(0x202025)); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let y = r * 4; y < r * 4 + 3; y++) for (let x = c * 4; x < c * 4 + 3; x++) { t.px(x, y, DEEP[1 + Math.floor(t.white(x, y) * 3)]); t.h(x, y, 0.6); } t.material(0.2, 0, 0.3); },
  tuff: (t) => speckled(t, pal(0x4f5249, 0x5b5e54, 0x676a5f, 0x72756a, 0x7e8175), [[0x9a9a8a, 0.06], [0x3c3e37, 0.06]]),
  calcite: (t) => speckled(t, pal(0xcfd2d1, 0xdcdedd, 0xe4e6e5, 0xeceeed, 0xf6f8f7), [[0xbcbebd, 0.06]]),
  cobblestone: (t) => cobble(t),
  mossy_cobblestone: (t) => {
    cobble(t);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (t.fbm(x, y, 70) > 0.55) { t.px(x, y, mix(hex(0x4d7a2c), hex(0x6a9a3a), t.white(x, y))); t.m(x, y, 0.1, 0, 0.8); }
    }
  },
  obsidian: (t) => {
    const p = pal(0x0c0814, 0x150e22, 0x1e1430, 0x2a1d42, 0x3c2a5c);
    t.noisePal(p, { contrast: 1.2, salt: 2 });
    for (let i = 0; i < 5; i++) { const x = t.rng.nextInt(16), y = t.rng.nextInt(16); t.px(x, y, hex(0x6e5a9a)); t.m(x, y, 0.95, 0, 0); }
    t.material(0.82, 0.02, 0.02);
  },
  crying_obsidian: (t) => {
    NATURAL_PAINTERS.obsidian(t);
    for (let i = 0; i < 9; i++) { const x = t.rng.nextInt(16), y = t.rng.nextInt(16); t.px(x, y, hex(0xa84dff)); t.emit(x, y, 1); t.px(x, y + 1, hex(0x7a2ad6)); t.emit(x, y + 1, 0.7); }
  },
  bedrock: (t) => {
    const p = pal(0x1d1d1f, 0x333336, 0x4a4a4e, 0x626266, 0x7d7d82);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.white(x, y) * 0.5 + t.vnoise(x, y, 8, 1) * 0.5;
      t.px(x, y, p[Math.min(4, Math.floor(v * 5))]);
      t.h(x, y, v);
    }
    t.material(0.1, 0, 0.2);
  },

  // solos
  dirt: (t) => dirt(t),
  coarse_dirt: (t) => { dirt(t); gravelSpots(t, 14); },
  rooted_dirt: (t) => { dirt(t); for (let i = 0; i < 5; i++) { let x = t.rng.nextInt(16), y = t.rng.nextInt(16); for (let k = 0; k < 4; k++) { t.px(x, y, hex(0xb89b6c)); x += t.rng.nextInt(3) - 1; y++; } } },
  podzol_top: (t) => {
    const p = pal(0x3f2a14, 0x4e3519, 0x5c401f, 0x6b4c27, 0x7a5a30);
    t.noisePal(p, { contrast: 1.3 });
    for (let i = 0; i < 20; i++) { const x = t.rng.nextInt(16), y = t.rng.nextInt(16); t.px(x, y, t.rng.next() < 0.5 ? hex(0x8a6a2a) : hex(0x2e1f10)); }
    t.material(0.08, 0, 0.8);
  },
  podzol_side: (t) => { dirt(t); for (let x = 0; x < 16; x++) { const d = 2 + (t.white(x, 0) < 0.4 ? 1 : 0); for (let y = 0; y < d; y++) t.px(x, y, mix(hex(0x4e3519), hex(0x6b4c27), t.white(x, y, 2))); } },
  mycelium_top: (t) => { t.noisePal(pal(0x5a4a5c, 0x6a5870, 0x786680, 0x86748e, 0x94849c), { contrast: 1.1 }); t.speckle(hex(0xb8a8be), 0.08, 3); t.material(0.06, 0, 0.8); },
  mycelium_side: (t) => { dirt(t); for (let x = 0; x < 16; x++) { const d = 3 + (t.white(x, 0) < 0.4 ? 1 : 0); for (let y = 0; y < d; y++) t.px(x, y, mix(hex(0x6a5870), hex(0x86748e), t.white(x, y, 2))); } },
  lume_moss_top: (t) => {
    t.noisePal(pal(0x1f5a63, 0x27707a, 0x2f8490, 0x3a98a2, 0x46acb4), { contrast: 1.2, salt: 5 });
    for (let i = 0; i < 10; i++) { const x = t.rng.nextInt(16), y = t.rng.nextInt(16); t.px(x, y, hex(0x9ef7ff)); t.emit(x, y, 0.9); }
    t.material(0.15, 0, 0.7);
  },
  lume_moss_side: (t) => {
    dirt(t);
    for (let x = 0; x < 16; x++) { const d = 3 + (t.white(x, 0) < 0.5 ? 1 : 0); for (let y = 0; y < d; y++) { t.px(x, y, mix(hex(0x27707a), hex(0x46acb4), t.white(x, y, 2))); if (t.white(x, y, 7) < 0.1) { t.px(x, y, hex(0x9ef7ff)); t.emit(x, y, 0.9); } } }
  },
  mud: (t) => { t.noisePal(pal(0x2c2522, 0x362d29, 0x3f3530, 0x483d37, 0x52463f), { contrast: 1.1 }); t.material(0.55, 0, 0.1); },
  packed_mud: (t) => { t.noisePal(pal(0x7a5e46, 0x866850, 0x91735a, 0x9b7d63, 0xa6886d), { contrast: 1 }); t.speckle(hex(0xc2a47a), 0.05, 4); t.material(0.1, 0, 0.7); },
  mud_bricks: (t) => { t.fill(hex(0x5b4636)); for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x0 = c * 8 + (r % 2) * 4; for (let y = r * 4; y < r * 4 + 3; y++) for (let x = x0; x < x0 + 7; x++) { t.px(x, y, mix(hex(0x8a6c52), hex(0xa4876a), t.fbm(x, y))); t.h(x, y, 0.6); } } },
  clay: (t) => { t.noisePal(pal(0x8e94a3, 0x9aa0ae, 0xa3a9b6, 0xadb2bf, 0xb7bcc8), { contrast: 0.8 }); t.material(0.2, 0, 0.4); },
  moss_block: (t) => { t.noisePal(pal(0x3f6a1e, 0x4c7d25, 0x598f2d, 0x67a236, 0x76b440), { contrast: 1.2 }); t.material(0.08, 0, 0.8); },
  gravel: (t) => gravel(t),
  sand: (t) => sand(t),
  red_sand: (t) => sand(t, pal(0xa2501e, 0xb05b24, 0xbd662b, 0xc87133, 0xd27d3d)),
  sandstone: (t) => sandstoneSide(t, pal(0xc8b27a, 0xd4be86, 0xdcc791, 0xe3cf9b, 0xead8a6)),
  sandstone_top: (t) => { sand(t, pal(0xd6c28a, 0xdcc791, 0xe1cd98, 0xe6d3a0, 0xebd9a8)); t.material(0.14, 0, 0.6); },
  sandstone_bottom: (t) => { sand(t, pal(0xcab47c, 0xd2bc85, 0xd9c48e, 0xdfcb97, 0xe5d1a0)); for (let x = 0; x < 16; x++) t.px(x, 0, hex(0xb89f66)); },
  chiseled_sandstone: (t) => { sandstoneSide(t, pal(0xc8b27a, 0xd4be86, 0xdcc791, 0xe3cf9b, 0xead8a6)); glyph(t, hex(0xb09a62)); },
  cut_sandstone: (t) => { sand(t, pal(0xd2bc84, 0xd8c28c, 0xdec893, 0xe3ce9b, 0xe8d4a3)); t.border(hex(0xb8a06a)); for (let x = 1; x < 15; x++) t.px(x, 7, hex(0xc4ac74)); },
  red_sandstone: (t) => sandstoneSide(t, pal(0x9c4a1c, 0xab5522, 0xb86029, 0xc36a31, 0xce7539)),
  red_sandstone_top: (t) => sand(t, pal(0xb05b24, 0xb96329, 0xc16b2f, 0xc97336, 0xd07b3d)),
  red_sandstone_bottom: (t) => { sand(t, pal(0xa8561f, 0xb05e25, 0xb8662b, 0xc06e31, 0xc87637)); for (let x = 0; x < 16; x++) t.px(x, 0, hex(0x8a4418)); },
  cut_red_sandstone: (t) => { sand(t, pal(0xb05b24, 0xb96329, 0xc16b2f, 0xc97336, 0xd07b3d)); t.border(hex(0x8a4418)); },
  terracotta: (t) => { t.noisePal(pal(0x8c513c, 0x965a43, 0x9e614a, 0xa66950, 0xae7056), { contrast: 0.7 }); t.material(0.15, 0, 0.5); },

  // grama
  grass_top: grassTop,
  grass_side: (t) => grassSide(t, (tt) => dirt(tt)),
  grass_side_snowy: (t) => grassSide(t, (tt) => dirt(tt), undefined, true),

  // gelo e neve
  snow: (t) => {
    t.noisePal(pal(0xdce6f0, 0xe6eef6, 0xeef4fa, 0xf5f9fd, 0xfcfdff), { contrast: 0.8, salt: 3 });
    t.speckle(hex(0xc8d4e2), 0.04, 5);
    t.material(0.3, 0, 0.6);
  },
  ice: (t) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.vnoise(x, y, 4, 1);
      t.px(x, y, mix(hex(0x7fa6e8), hex(0xb9d2fb), v), 170);
      t.h(x, y, 0.5);
    }
    // rachaduras
    for (let i = 0; i < 3; i++) {
      let x = t.rng.nextInt(16), y = t.rng.nextInt(16);
      for (let k = 0; k < 6; k++) { t.px(x, y, hex(0xe8f2ff), 210); t.h(x, y, 0.35); x += t.rng.nextInt(3) - 1; y += t.rng.nextInt(3) - 1; }
    }
    t.material(0.95, 0, 0);
  },
  packed_ice: (t) => { t.noisePal(pal(0x7c9fdc, 0x88aae4, 0x95b6ea, 0xa3c1ef, 0xb2ccf4), { contrast: 0.8 }); for (let i = 0; i < 4; i++) { let x = t.rng.nextInt(16), y = t.rng.nextInt(16); for (let k = 0; k < 5; k++) { t.px(x, y, hex(0xdfeaff)); x += t.rng.nextInt(3) - 1; y++; } } t.material(0.85, 0, 0); },
  blue_ice: (t) => { t.noisePal(pal(0x4f7fdc, 0x5b8ae4, 0x6897ea, 0x76a3f0, 0x86b0f4), { contrast: 0.7 }); t.material(0.92, 0, 0); },

  // fluidos
  water_still: water,
  water_flow: water,
  lava_still: (t) => lava(t, false),
  lava_flow: (t) => lava(t, true),

  // minérios
  coal_ore: oreFor('stone', COAL, { shine: 0.3 }),
  deepslate_coal_ore: oreFor('deep', COAL, { shine: 0.3 }),
  iron_ore: oreFor('stone', IRON, { shine: 0.5, metal: 0.4 }),
  deepslate_iron_ore: oreFor('deep', IRON, { shine: 0.5, metal: 0.4 }),
  copper_ore: oreFor('stone', COPPER, { shine: 0.55, metal: 0.6 }),
  deepslate_copper_ore: oreFor('deep', COPPER, { shine: 0.55, metal: 0.6 }),
  gold_ore: oreFor('stone', GOLD, { shine: 0.8, metal: 1 }),
  deepslate_gold_ore: oreFor('deep', GOLD, { shine: 0.8, metal: 1 }),
  fulgor_ore: oreFor('stone', FULGOR, { shine: 0.7, glow: 0.15, clusters: 5 }),
  deepslate_fulgor_ore: oreFor('deep', FULGOR, { shine: 0.7, glow: 0.15, clusters: 5 }),
  fulgor_ore_lit: oreFor('stone', FULGOR, { shine: 0.8, glow: 1, clusters: 5 }),
  deepslate_fulgor_ore_lit: oreFor('deep', FULGOR, { shine: 0.8, glow: 1, clusters: 5 }),
  lapis_ore: oreFor('stone', LAPIS, { shine: 0.6, clusters: 5 }),
  deepslate_lapis_ore: oreFor('deep', LAPIS, { shine: 0.6, clusters: 5 }),
  diamond_ore: oreFor('stone', DIAMOND, { shine: 0.95, glow: 0.12 }),
  deepslate_diamond_ore: oreFor('deep', DIAMOND, { shine: 0.95, glow: 0.12 }),
  emerald_ore: oreFor('stone', EMERALD, { shine: 0.9, clusters: 3 }),
  deepslate_emerald_ore: oreFor('deep', EMERALD, { shine: 0.9, clusters: 3 }),

  // blocos de minério
  coal_block: (t) => { t.noisePal(COAL, { contrast: 1.2 }); t.material(0.45, 0, 0.2); },
  raw_iron_block: (t) => { t.noisePal(pal(0x8e6d57, 0xa6826a, 0xbb977c, 0xcdab8f, 0xdcbea3), { contrast: 1.3 }); t.material(0.3, 0.3, 0.2); },
  raw_copper_block: (t) => { t.noisePal(pal(0x8a4a2a, 0xa55a33, 0xbf6c3f, 0xd2804e, 0x5f9e84), { contrast: 1.3 }); t.material(0.3, 0.5, 0.2); },
  raw_gold_block: (t) => { t.noisePal(pal(0xa47c12, 0xc49a1d, 0xdcb42e, 0xecca46, 0xf8e07a), { contrast: 1.3 }); t.material(0.45, 0.9, 0.1); },
  iron_block: (t) => metalBlock(t, pal(0x9a9aa0, 0xb4b4ba, 0xc8c8ce, 0xdadadf, 0xececf0), 1, 0.7),
  copper_block: (t) => metalBlock(t, pal(0x9a4c2c, 0xb45c36, 0xc86c42, 0xd87e52, 0xe69468), 1, 0.65),
  gold_block: (t) => metalBlock(t, pal(0xb0860e, 0xd4a818, 0xecc32c, 0xf8da4c, 0xfff08a), 1, 0.85),
  diamond_block: (t) => gemBlock(t, pal(0x2aa3a8, 0x46c7c9, 0x6ee0dc, 0x9cf0ea, 0xd2fffa)),
  emerald_block: (t) => gemBlock(t, pal(0x107a34, 0x18a045, 0x28c45a, 0x52dc7e, 0x9cf5b8)),
  lapis_block: (t) => { t.noisePal(LAPIS, { contrast: 1.1 }); t.speckle(hex(0xd8c26a), 0.03, 4); t.material(0.5, 0, 0.1); },
  fulgor_block: (t) => { gemBlock(t, FULGOR, 0.5); },
  amethyst_block: (t) => gemBlock(t, pal(0x51308a, 0x6a43a8, 0x8659c4, 0xa77fdc, 0xceb4f2)),

  ...woodSet('oak'), ...woodSet('spruce'), ...woodSet('birch'), ...woodSet('jungle'),
  ...woodSet('acacia'), ...woodSet('dark_oak'), ...woodSet('lume'), ...woodSet('ash'),
};

function gravelSpots(t: Tex, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = t.rng.nextInt(16), y = t.rng.nextInt(16);
    t.px(x, y, mix(hex(0x6e6660), hex(0x9a918a), t.rng.next()));
    t.h(x, y, 0.75);
  }
}

function sandstoneSide(t: Tex, p: Palette): void {
  for (let y = 0; y < 16; y++) {
    const band = Math.floor(y / 4);
    for (let x = 0; x < 16; x++) {
      const v = 0.45 + (band % 2) * 0.12 + (t.fbm(x, y, band) - 0.5) * 0.4;
      let c = p[Math.max(0, Math.min(4, Math.floor(v * 5)))];
      if (y % 4 === 3) c = scale(p[1], 0.92);
      if (y % 4 === 0) c = mix(c, p[4], 0.3);
      t.px(x, y, c);
      t.h(x, y, y % 4 === 3 ? 0.3 : 0.55);
    }
  }
  t.material(0.12, 0, 0.55);
}

function glyph(t: Tex, c: [number, number, number]): void {
  const rows = [
    '................',
    '................',
    '................',
    '.....##..##.....',
    '....#..##..#....',
    '....#......#....',
    '.....#....#.....',
    '......#..#......',
    '.......##.......',
    '......#..#......',
    '.....#....#.....',
    '....#......#....',
    '................',
    '................',
    '................',
    '................',
  ];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (rows[y][x] === '#') { t.px(x, y, c); t.h(x, y, 0.25); }
}

export { ramp };
