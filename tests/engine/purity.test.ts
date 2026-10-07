import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_ORDER } from '../../src/engine/constants';

// src/engine/ のソースを文字列として読み込む
const sources = import.meta.glob<string>('../../src/engine/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('エンジンのルール', () => {
  it('ソースが読み込めている', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
  });

  // DOM・ブラウザAPIは tsconfig.engine.json の型チェックで禁止している。
  // 型では防げない「結果が毎回変わるもの」をここで確かめる。
  it.each(Object.entries(sources))('%s は Math.random や現在時刻を使わない', (_path, source) => {
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now|new Date\b|performance\.now/);
  });
});

describe('属性の並び順', () => {
  it('6属性が重複なく並んでいる', () => {
    expect(ATTRIBUTE_ORDER).toHaveLength(6);
    expect(new Set(ATTRIBUTE_ORDER).size).toBe(6);
  });
});
