import { describe, expect, it } from 'vitest';
import {
  affinityMultiplier,
  getEffectiveness,
  isResonant,
  resonanceMultiplier,
} from '../../src/engine/affinity';
import type { AttributeId } from '../../src/engine/types';

// 仕様書 3.3 の相性表（行＝技の属性、列＝受ける側の属性）をそのまま写したもの
// 列の順：紅 橙 黄 翠 蒼 紫 白 黒
const COLUMNS: AttributeId[] = ['crimson', 'orange', 'yellow', 'green', 'blue', 'violet', 'white', 'black'];
const SPEC_TABLE: Record<AttributeId, number[]> = {
  crimson: [1.0, 1.5, 1.5, 1.0, 0.7, 0.7, 1.0, 1.0],
  orange: [0.7, 1.0, 1.5, 1.5, 1.0, 0.7, 1.0, 1.0],
  yellow: [0.7, 0.7, 1.0, 1.5, 1.5, 1.0, 1.0, 1.0],
  green: [1.0, 0.7, 0.7, 1.0, 1.5, 1.5, 1.0, 1.0],
  blue: [1.5, 1.0, 0.7, 0.7, 1.0, 1.5, 1.0, 1.0],
  violet: [1.5, 1.5, 1.0, 0.7, 0.7, 1.0, 1.0, 1.0],
  white: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5],
  black: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5, 1.0],
};

const cases = COLUMNS.flatMap((attacker) =>
  COLUMNS.map((defender, column) => [attacker, defender, SPEC_TABLE[attacker][column]] as const),
);

describe('属性相性（仕様書 3.3 の相性表）', () => {
  it.each(cases)('%s の技 → %s は ×%s', (attacker, defender, expected) => {
    expect(affinityMultiplier(attacker, defender)).toBe(expected);
  });

  it('有利・不利・等倍の判定', () => {
    expect(getEffectiveness('crimson', 'orange')).toBe('advantage');
    expect(getEffectiveness('crimson', 'yellow')).toBe('advantage');
    expect(getEffectiveness('crimson', 'blue')).toBe('disadvantage');
    expect(getEffectiveness('crimson', 'violet')).toBe('disadvantage');
    expect(getEffectiveness('crimson', 'crimson')).toBe('neutral');
    expect(getEffectiveness('crimson', 'green')).toBe('neutral');
  });

  it('円の端をまたいでも正しい（紫 → 紅・橙は有利）', () => {
    expect(getEffectiveness('violet', 'crimson')).toBe('advantage');
    expect(getEffectiveness('violet', 'orange')).toBe('advantage');
  });

  it('白・黒は6色とは相性がなく、技でも受ける側でも等倍', () => {
    for (const color of COLUMNS.slice(0, 6)) {
      for (const monochrome of ['white', 'black'] as const) {
        expect(getEffectiveness(monochrome, color)).toBe('neutral');
        expect(getEffectiveness(color, monochrome)).toBe('neutral');
      }
    }
  });

  it('白と黒はお互いに弱点（白の技 → 黒、黒の技 → 白は有利）。白どうし・黒どうしは等倍', () => {
    expect(getEffectiveness('white', 'black')).toBe('advantage');
    expect(getEffectiveness('black', 'white')).toBe('advantage');
    expect(getEffectiveness('white', 'white')).toBe('neutral');
    expect(getEffectiveness('black', 'black')).toBe('neutral');
  });
});

describe('共鳴', () => {
  it('技の属性と使うキャラの属性が同じなら ×1.2', () => {
    expect(isResonant('blue', 'blue')).toBe(true);
    expect(resonanceMultiplier('blue', 'blue')).toBe(1.2);
  });

  it('白・黒にも共鳴はある（白のキャラが白の技を使うと ×1.2）', () => {
    expect(resonanceMultiplier('white', 'white')).toBe(1.2);
    expect(resonanceMultiplier('black', 'black')).toBe(1.2);
    expect(resonanceMultiplier('white', 'black')).toBe(1);
  });

  it('違えば ×1.0', () => {
    expect(isResonant('blue', 'green')).toBe(false);
    expect(resonanceMultiplier('blue', 'green')).toBe(1);
  });
});
