import { describe, expect, it } from 'vitest';
import { calcDamage, computeDamage, rollDamagePercent } from '../../src/engine/damage';
import { createRng } from '../../src/engine/rng';
import { makeCombatant, makeMove } from '../helpers/fixtures';

const base = { power: 60, attack: 50, defense: 50, affinity: 1, resonance: 1, rollPercent: 100 };

describe('ダメージ計算（仕様書 3.4）', () => {
  it('計算例：威力60、攻撃=防御、等倍、共鳴なし → 乱数0.90で27、1.00で30', () => {
    expect(calcDamage({ ...base, rollPercent: 90 })).toBe(27);
    expect(calcDamage({ ...base, rollPercent: 100 })).toBe(30);
  });

  it('計算例：同じ条件なら、どの乱数でも 27〜30 に収まる', () => {
    for (let roll = 90; roll <= 100; roll += 1) {
      const damage = calcDamage({ ...base, rollPercent: roll });
      expect(damage).toBeGreaterThanOrEqual(27);
      expect(damage).toBeLessThanOrEqual(30);
    }
  });

  it('相性・共鳴・攻撃と防御の比を掛ける', () => {
    // 60 × (60/40) × 1.5 × 1.2 × 1.00 × 0.5 = 81
    expect(calcDamage({ ...base, attack: 60, defense: 40, affinity: 1.5, resonance: 1.2 })).toBe(81);
  });

  it('小数点以下は切り捨てる', () => {
    // 60 × 0.7 × 0.5 = 21、乱数0.95 で 19.95 → 19
    expect(calcDamage({ ...base, affinity: 0.7, rollPercent: 95 })).toBe(19);
  });

  it('ちょうど整数になる値は、小数の誤差で 1 小さくならない', () => {
    // 30 × (30/35) × 0.7 × 0.5 = 9（小数のまま計算すると 8.999… になる）
    expect(calcDamage({ ...base, power: 30, attack: 30, defense: 35, affinity: 0.7 })).toBe(9);
  });

  it('最低でも 1 ダメージ', () => {
    expect(calcDamage({ ...base, power: 1, attack: 1, defense: 100, affinity: 0.7, rollPercent: 90 })).toBe(1);
  });
});

describe('ダメージの乱数', () => {
  it('90〜100 の整数で、両端も出る', () => {
    const seen = new Set<number>();
    let rng = createRng(1);
    for (let i = 0; i < 2_000; i += 1) {
      const result = rollDamagePercent(rng);
      seen.add(result.value);
      rng = result.rng;
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
  });
});

describe('キャラと技からのダメージ', () => {
  it('相性と共鳴を判定して返す', () => {
    const attacker = makeCombatant({ attribute: 'crimson' });
    const defender = makeCombatant({ attribute: 'orange' });
    const move = makeMove({ attribute: 'crimson', power: 60 });

    // 60 × 1 × 1.5 × 1.2 × 1.00 × 0.5 = 54
    expect(computeDamage(attacker, defender, move, 100)).toEqual({
      amount: 54,
      effectiveness: 'advantage',
      resonance: true,
    });
  });

  it('計算例（仕様書 3.3）：白のキャラが白の技（威力60）を紅のキャラに使う → 相性は等倍、共鳴で 36', () => {
    const attacker = makeCombatant({ attribute: 'white' });
    const defender = makeCombatant({ attribute: 'crimson' });
    const move = makeMove({ attribute: 'white', power: 60 });

    // 60 × 1 × 1.0 × 1.2 × 1.00 × 0.5 = 36
    expect(computeDamage(attacker, defender, move, 100)).toEqual({
      amount: 36,
      effectiveness: 'neutral',
      resonance: true,
    });
  });

  it('計算例（仕様書 3.3）：白のキャラが白の技（威力60）を黒のキャラに使う → 有利と共鳴で 54', () => {
    const attacker = makeCombatant({ attribute: 'white' });
    const defender = makeCombatant({ attribute: 'black' });
    const move = makeMove({ attribute: 'white', power: 60 });

    // 60 × 1 × 1.5 × 1.2 × 1.00 × 0.5 = 54
    expect(computeDamage(attacker, defender, move, 100)).toEqual({
      amount: 54,
      effectiveness: 'advantage',
      resonance: true,
    });
  });

  it('白・黒のキャラが6色の技を受けるときは等倍（紫の技 → 黒のキャラは 30）', () => {
    const attacker = makeCombatant({ attribute: 'violet' });
    const defender = makeCombatant({ attribute: 'black' });
    const move = makeMove({ attribute: 'violet', power: 60 });
    expect(computeDamage(attacker, defender, move, 100)).toEqual({
      amount: 36,
      effectiveness: 'neutral',
      resonance: true,
    });
    expect(computeDamage(makeCombatant({ attribute: 'crimson' }), defender, move, 100)).toEqual({
      amount: 30,
      effectiveness: 'neutral',
      resonance: false,
    });
  });

  it('攻撃側の攻撃と、受ける側の防御の能力変化を使う', () => {
    const attacker = makeCombatant({ stages: { attack: 1, defense: 0, speed: 0 } });
    const defender = makeCombatant({ attribute: 'green', stages: { attack: 0, defense: -1, speed: 0 } });
    const move = makeMove({ attribute: 'green', power: 64 });

    // 64 × (62.5 / 40) × 1.0 × 1.0 × 1.00 × 0.5 = 50
    expect(computeDamage(attacker, defender, move, 100)).toEqual({
      amount: 50,
      effectiveness: 'neutral',
      resonance: false,
    });
  });

  it('受ける側の攻撃や、攻撃側の防御の能力変化は使わない', () => {
    const attacker = makeCombatant({ stages: { attack: 0, defense: 3, speed: 3 } });
    const defender = makeCombatant({ attribute: 'green', stages: { attack: 3, defense: 0, speed: 0 } });
    const move = makeMove({ attribute: 'green', power: 60 });
    expect(computeDamage(attacker, defender, move, 100).amount).toBe(30);
  });
});
