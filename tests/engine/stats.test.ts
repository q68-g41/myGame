import { describe, expect, it } from 'vitest';
import {
  clampStage,
  effectiveAttack,
  effectiveDefense,
  effectiveSpeed,
  stageMultiplier,
} from '../../src/engine/stats';
import { makeCombatant } from '../helpers/fixtures';

describe('能力変化の倍率（仕様書 3.7）', () => {
  it.each([
    [0, 1],
    [1, 1.25],
    [2, 1.5625],
    [3, 1.953125],
    [-1, 0.8],
    [-2, 0.64],
    [-3, 0.512],
  ])('%s 段階 → ×%s', (stage, expected) => {
    expect(stageMultiplier(stage)).toBeCloseTo(expected, 12);
  });

  it('上下3段階までで止まる', () => {
    expect(clampStage(5)).toBe(3);
    expect(clampStage(-5)).toBe(-3);
    expect(stageMultiplier(4)).toBe(stageMultiplier(3));
    expect(stageMultiplier(-4)).toBe(stageMultiplier(-3));
  });

  it('攻撃・防御・素早さに能力変化を反映する', () => {
    const combatant = makeCombatant({
      stats: { attack: 40, defense: 60, speed: 80 },
      stages: { attack: 1, defense: -1, speed: 2 },
    });
    expect(effectiveAttack(combatant)).toBeCloseTo(50, 12);
    expect(effectiveDefense(combatant)).toBeCloseTo(48, 12);
    expect(effectiveSpeed(combatant)).toBeCloseTo(125, 12);
  });
});
