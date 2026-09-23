import { describe, expect, it } from 'vitest';
import { OverworldGenerator } from '../../src/world/gen/overworld';
import { S, blockNameOf } from '../../src/world/blocks';
import { BIOMES } from '../../src/world/gen/biomes';

describe('gerador da superfície', () => {
  it('é determinístico e rápido', () => {
    const g1 = new OverworldGenerator(12345);
    const g2 = new OverworldGenerator(12345);
    const t0 = performance.now();
    const a = g1.generate(0, 0).chunk;
    const t1 = performance.now();
    let n = 0;
    for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) { g1.generate(cx + 10, cz + 10); n++; }
    const t2 = performance.now();
    const b = g2.generate(0, 0).chunk;
    console.log(`primeiro chunk ${(t1 - t0).toFixed(1)}ms, média ${((t2 - t1) / n).toFixed(1)}ms`);
    for (let i = 0; i < 24; i++) {
      const sa = a.sections[i], sb = b.sections[i];
      expect(!!sa).toBe(!!sb);
      if (sa && sb) expect(Buffer.from(sa.blocks.buffer).equals(Buffer.from(sb.blocks.buffer))).toBe(true);
    }
  });
  it('tem rocha-mãe no fundo e terreno perto do nível do mar', () => {
    const g = new OverworldGenerator(42);
    const { chunk } = g.generate(3, -7);
    expect(chunk.getBlock(5, -64, 5)).toBe(S('bedrock'));
    const top = chunk.heightmap[0];
    expect(top).toBeGreaterThan(20);
    expect(top).toBeLessThan(320);
    const counts = new Map<string, number>();
    for (const s of chunk.sections) if (s) for (const v of s.blocks) counts.set(blockNameOf(v), (counts.get(blockNameOf(v)) ?? 0) + 1);
    console.log([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k}:${v}`).join(' '));
  });
  it('produz vários biomas numa área grande', () => {
    const g = new OverworldGenerator(7);
    const seen = new Map<string, number>();
    for (let z = -4000; z <= 4000; z += 200) for (let x = -4000; x <= 4000; x += 200) {
      const b = BIOMES[g.biomeAt(x, z)].name;
      seen.set(b, (seen.get(b) ?? 0) + 1);
    }
    console.log([...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
    expect(seen.size).toBeGreaterThan(8);
  });
});
