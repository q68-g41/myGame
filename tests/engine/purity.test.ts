import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_ORDER, MONOCHROME_ATTRIBUTES } from '../../src/engine/constants';

// エンジン・データ・CPU のソースを文字列として読み込む
const sources = import.meta.glob<string>(['../../src/engine/**/*.ts', '../../src/data/**/*.ts', '../../src/ai/**/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('エンジンのルール', () => {
  it('ソースが読み込めている', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
  });

  // DOM・ブラウザAPIは tsconfig.engine.json の型チェックで禁止している（src/engine・src/data・src/ai）。
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

  it('円に入らない属性は白と黒の2つで、円の6属性とは重ならない', () => {
    expect(MONOCHROME_ATTRIBUTES).toEqual(['white', 'black']);
    for (const attribute of MONOCHROME_ATTRIBUTES) {
      expect(ATTRIBUTE_ORDER).not.toContain(attribute);
    }
  });
});
