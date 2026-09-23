/** Encantamentos com nomes próprios (mesma mecânica e níveis máximos do original). */
export interface EnchantInfo { id: string; name: string; max: number; targets: string[]; weight: number; minCost: (l: number) => number; maxCost: (l: number) => number; treasure?: boolean; excl?: string }

const E = (id: string, name: string, max: number, targets: string[], weight: number, base: number, per: number, span: number, extra: Partial<EnchantInfo> = {}): EnchantInfo => ({
  id, name, max, targets, weight, minCost: (l) => base + (l - 1) * per, maxCost: (l) => base + (l - 1) * per + span, ...extra,
});

/** alvos: 'weapon' espadas/machados, 'digger' ferramentas, 'armor', 'head', 'feet', 'bow', 'rod', 'breakable' */
export const ENCHANTS: EnchantInfo[] = [
  E('protection', 'Proteção', 4, ['armor'], 10, 1, 11, 11, { excl: 'prot' }),
  E('fire_protection', 'Anticalor', 4, ['armor'], 5, 10, 8, 8, { excl: 'prot' }),
  E('feather_falling', 'Pluma', 4, ['feet'], 5, 5, 6, 6),
  E('blast_protection', 'Anteparo', 4, ['armor'], 2, 5, 8, 8, { excl: 'prot' }),
  E('projectile_protection', 'Couraça', 4, ['armor'], 5, 3, 6, 6, { excl: 'prot' }),
  E('respiration', 'Fôlego', 3, ['head'], 2, 10, 10, 30),
  E('aqua_affinity', 'Mergulho', 1, ['head'], 2, 1, 0, 40),
  E('thorns', 'Espinhos', 3, ['chest'], 1, 10, 20, 50),
  E('depth_strider', 'Correnteza', 3, ['feet'], 2, 10, 10, 15),
  E('sharpness', 'Gume', 5, ['weapon'], 10, 1, 11, 20, { excl: 'dmg' }),
  E('smite', 'Exorcismo', 5, ['weapon'], 5, 5, 8, 20, { excl: 'dmg' }),
  E('bane_of_arthropods', 'Flagelo', 5, ['weapon'], 5, 5, 8, 20, { excl: 'dmg' }),
  E('knockback', 'Repelão', 2, ['sword'], 5, 5, 20, 50),
  E('fire_aspect', 'Ardor', 2, ['sword'], 2, 10, 20, 50),
  E('looting', 'Pilhagem', 3, ['sword'], 2, 15, 9, 50),
  E('sweeping', 'Varredura', 3, ['sword'], 2, 5, 9, 15),
  E('efficiency', 'Presteza', 5, ['digger'], 10, 1, 10, 50),
  E('silk_touch', 'Toque Sutil', 1, ['digger'], 1, 15, 0, 50, { excl: 'loot' }),
  E('unbreaking', 'Robustez', 3, ['breakable'], 5, 5, 8, 50),
  E('fortune', 'Bonança', 3, ['digger'], 2, 15, 9, 50, { excl: 'loot' }),
  E('power', 'Potência', 5, ['bow'], 10, 1, 10, 15),
  E('punch', 'Impulso', 2, ['bow'], 2, 12, 20, 25),
  E('flame', 'Chama', 1, ['bow'], 2, 20, 0, 30),
  E('infinity', 'Infinidade', 1, ['bow'], 1, 20, 0, 30, { excl: 'bowinf' }),
  E('luck_of_the_sea', 'Sorte do Mar', 3, ['rod'], 2, 15, 9, 50),
  E('lure', 'Isca', 3, ['rod'], 2, 15, 9, 50),
  E('mending', 'Remendo', 1, ['breakable'], 2, 25, 0, 50, { treasure: true, excl: 'bowinf' }),
];

export const ENCHANT_NAMES: Record<string, string> = Object.fromEntries(ENCHANTS.map((e) => [e.id, e.name]));

export function romanLevel(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? String(n);
}
