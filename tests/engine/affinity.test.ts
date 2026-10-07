import { describe, expect, it } from 'vitest';
import {
  affinityMultiplier,
  getEffectiveness,
  isResonant,
  resonanceMultiplier,
} from '../../src/engine/affinity';
import type { AttributeId } from '../../src/engine/types';

// 仕様書 3.3 の相性表（行＝技の属性、列＝受ける側の属性）をそのまま写したもの
// 列の順：紅 橙 黄 翠 蒼 紫
const COLUMNS: AttributeId[] = ['crimson', 'orange', 'yellow', 'green', 'blue', 'violet'];
const SPEC_TABLE: Record<AttributeId, number[]> = {
  crimson: [1.0, 1.5, 1.5, 1.0, 0.7, 0.7],
  orange: [0.7, 1.0, 1.5, 1.5, 1.0, 0.7],
  yellow: [0.7, 0.7, 1.0, 1.5, 1.5, 1.0],
  green: [1.0, 0.7, 0.7, 1.0, 1.5, 1.5],
  blue: [1.5, 1.0, 0.7, 0.7, 1.0, 1.5],
  violet: [1.5, 1.5, 1.0, 0.7, 0.7, 1.0],
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
});

describe('共鳴', () => {
  it('技の属性と使うキャラの属性が同じなら ×1.2', () => {
    expect(isResonant('blue', 'blue')).toBe(true);
    expect(resonanceMultiplier('blue', 'blue')).toBe(1.2);
  });

  it('違えば ×1.0', () => {
    expect(isResonant('blue', 'green')).toBe(false);
    expect(resonanceMultiplier('blue', 'green')).toBe(1);
  });
});
