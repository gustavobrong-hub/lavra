import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ITEM_SPRITES } from '../../src/render/items/painters';
import { Tex } from '../../src/render/textures/tex';

const LIST = fileURLToPath(new URL('../.out/items_needed.txt', import.meta.url));

/** Ids que precisam de sprite: a lista do orquestrador ou, num checkout limpo, todo item que não vira bloco. */
async function expectedIds(): Promise<string[]> {
  if (existsSync(LIST)) return readFileSync(LIST, 'utf8').split('\n').map((l) => l.split('\t')[0].trim()).filter(Boolean);
  const { ITEMS } = await import('../../src/game/items/registry');
  return ITEMS.filter((i) => !i.block).map((i) => i.id);
}

function paint(id: string): Tex {
  const t = new Tex(id);
  ITEM_SPRITES[id](t);
  return t;
}

describe('sprites de itens', () => {
  it('todo item esperado tem sprite', async () => {
    const ids = await expectedIds();
    expect(ids.length).toBeGreaterThan(100);
    const missing = ids.filter((id) => !ITEM_SPRITES[id]);
    expect(missing).toEqual([]);
  });

  it('pintar não lança exceção, é determinístico e nenhum sprite fica vazio', () => {
    const problems: string[] = [];
    for (const id of Object.keys(ITEM_SPRITES)) {
      let t: Tex;
      try { t = paint(id); } catch (e) { problems.push(`${id}: lançou ${(e as Error).message}`); continue; }
      let opaque = 0, clear = 0, black = 0;
      for (let i = 0; i < 256; i++) {
        const a = t.rgba[i * 4 + 3];
        if (a === 0) { clear++; continue; }
        opaque++;
        if (t.rgba[i * 4] === 0 && t.rgba[i * 4 + 1] === 0 && t.rgba[i * 4 + 2] === 0) black++;
      }
      if (opaque < 12) problems.push(`${id}: só ${opaque} pixels opacos`);
      if (clear === 0) problems.push(`${id}: sem fundo transparente`);
      if (black > 0) problems.push(`${id}: ${black} pixels de preto puro`);
      const again = paint(id);
      if (!again.rgba.every((v, i) => v === t.rgba[i])) problems.push(`${id}: não é determinístico`);
    }
    expect(problems).toEqual([]);
  });
});
