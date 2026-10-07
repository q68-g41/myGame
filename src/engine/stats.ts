import { MAX_STAGE, STAGE_DOWN_MULTIPLIER, STAGE_UP_MULTIPLIER } from './constants';
import type { Combatant } from './types';

/** 能力変化の段階を上下の上限に収める */
export function clampStage(stage: number): number {
  return Math.max(-MAX_STAGE, Math.min(MAX_STAGE, stage));
}

/** 能力変化の段階から倍率を出す（3.7）。+1 段階ごとに ×1.25、-1 段階ごとに ×0.8 */
export function stageMultiplier(stage: number): number {
  const clamped = clampStage(stage);
  return clamped >= 0 ? STAGE_UP_MULTIPLIER ** clamped : STAGE_DOWN_MULTIPLIER ** -clamped;
}

/** 能力変化を反映した攻撃 */
export function effectiveAttack(combatant: Combatant): number {
  return combatant.stats.attack * stageMultiplier(combatant.stages.attack);
}

/** 能力変化を反映した防御 */
export function effectiveDefense(combatant: Combatant): number {
  return combatant.stats.defense * stageMultiplier(combatant.stages.defense);
}

/** 能力変化を反映した素早さ（状態異常の鈍化は M2 で反映する） */
export function effectiveSpeed(combatant: Combatant): number {
  return combatant.stats.speed * stageMultiplier(combatant.stages.speed);
}
