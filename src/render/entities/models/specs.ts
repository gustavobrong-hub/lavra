/**
 * Tabela tipo de criatura → modelo, variante de pele e poses extras.
 */
import type { MobModelSpec } from '../mobvisual';
import type { ModelDef } from './boxmodel';
import { COW } from './defs/cow';
import { CARNICAL } from './defs/carnical';
import { MOB_LABELS } from '../../../game/entity/registry';

/** Modelo provisório (caixa com olhos) para tipos ainda sem arte própria. */
function placeholder(id: string, w: number, h: number, color: number): ModelDef {
  return {
    id: `ph_${id}`,
    parts: [{ name: 'body', pivot: [0, 0, 0], cubes: [{ o: [-w / 2, 0, -w / 2], s: [w, h, w] }] }],
    paint(sk) {
      sk.cube('body', (g, f) => {
        g.noise(color, 0.1);
        if (f === 'front') { g.rect(Math.floor(g.w * 0.2), Math.floor(g.h * 0.2), 3, 3, 0x111111); g.rect(Math.floor(g.w * 0.8) - 3, Math.floor(g.h * 0.2), 3, 3, 0x111111); }
      });
    },
  };
}

export const MOB_SPECS: Record<string, MobModelSpec> = {
  cow: { def: COW, babyHead: 1.4 },
  carnical: { def: CARNICAL, babyHead: 1.5, handOffset: [-2, -10, 1] },
  naufrago: { def: CARNICAL, variant: () => 'naufrago', babyHead: 1.5, handOffset: [-2, -10, 1] },
};

/** Specs dos grupos de arte: todo arquivo em defs/ que exporta `SPECS_*` entra automaticamente. */
const groups = import.meta.glob('./defs/*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
for (const mod of Object.values(groups)) {
  for (const [k, v] of Object.entries(mod)) if (k.startsWith('SPECS_') && v && typeof v === 'object') Object.assign(MOB_SPECS, v as Record<string, MobModelSpec>);
}

/** Garante um visual para todo tipo registrado (provisório até ganhar modelo). */
const SIZES: Record<string, [number, number, number]> = {
  pig: [14, 14, 0xe79a9a], sheep: [14, 20, 0xeeeeee], chicken: [6, 11, 0xdddddd], rabbit: [6, 8, 0x9a7b5a], musgarto: [12, 9, 0x5e7a3a],
  wolf: [9, 13, 0xc2692a], cat: [8, 10, 0xd08a3c], horse: [20, 25, 0x7a4a2a], lambari: [6, 4, 0x9fb7c9], tambaqui: [10, 6, 0x4a5a4a],
  baiacu: [10, 10, 0xd9c26a], acara: [7, 6, 0x3aafd9], ossudo: [8, 31, 0xd8d3c4], tecela: [22, 14, 0x2e2622], pavio: [9, 27, 0x6a8c3a],
  feiticeira: [8, 31, 0x4a2f5a], gosma: [8, 8, 0x74c05a], assombro: [14, 8, 0x3a4a7a], vulto: [9, 46, 0x141418], espreitador: [16, 16, 0x7a7a7a],
  fagulha: [9, 28, 0xe8a030], brasal: [60, 60, 0xe8e0d8], villager: [8, 31, 0x8a6a4a], sentinela: [14, 43, 0xb0b0b0],
};
for (const [t, [w, h, c]] of Object.entries(SIZES)) if (!MOB_SPECS[t]) MOB_SPECS[t] = { def: placeholder(t, w, h, c) };
void MOB_LABELS;
