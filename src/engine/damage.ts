import { affinityMultiplier, getEffectiveness, isResonant, resonanceMultiplier } from './affinity';
import { damageCutPercent, movePower } from './charms';
import { DAMAGE_ROLL_MAX_PERCENT, DAMAGE_ROLL_MIN_PERCENT, DAMAGE_SCALE, MIN_DAMAGE } from './constants';
import { nextInt, type RngResult, type RngState } from './rng';
import { effectiveAttack, effectiveDefense } from './stats';
import type { AttackMoveDef, CharmEffect, Combatant, Effectiveness } from './types';

/**
 * 小数の計算誤差で、本来ちょうど整数になる値（例：9）が 8.999… になり、
 * 切り捨てで 1 小さくなるのを防ぐための余白。
 * 仕様の範囲の数値で、分数による正確な計算と結果が一致することを確かめてある。
 */
const FLOAT_TOLERANCE = 1e-9;

/** ダメージ式の入力。攻撃・防御は能力変化を反映した値 */
export interface DamageParams {
  readonly power: number;
  readonly attack: number;
  readonly defense: number;
  readonly affinity: number;
  readonly resonance: number;
  /** 乱数（パーセント。90〜100） */
  readonly rollPercent: number;
}

/**
 * ダメージ式（3.4）
 * floor(威力 × (攻撃 ÷ 防御) × 相性 × 共鳴 × 乱数 × 0.5)、最低 1
 */
export function calcDamage(params: DamageParams): number {
  const { power, attack, defense, affinity, resonance, rollPercent } = params;
  const raw = power * (attack / defense) * affinity * resonance * (rollPercent / 100) * DAMAGE_SCALE;
  return Math.max(MIN_DAMAGE, Math.floor(raw + FLOAT_TOLERANCE));
}

/** ダメージの乱数（パーセントの整数）を引く */
export function rollDamagePercent(rng: RngState): RngResult<number> {
  return nextInt(rng, DAMAGE_ROLL_MIN_PERCENT, DAMAGE_ROLL_MAX_PERCENT);
}

/** 技1回ぶんのダメージ */
export interface DamageResult {
  readonly amount: number;
  readonly effectiveness: Effectiveness;
  readonly resonance: boolean;
}

/**
 * 攻撃側・受ける側・技・乱数から、ダメージと相性・共鳴の結果を出す。
 * charms は攻撃側の陣営のお守り（威力が上がる）、defenderCharms は受ける側の陣営のお守り（ダメージが減る）。
 * ダメージを減らすお守りは、ダメージ式の結果に掛けて切り捨てる（最低1）
 */
export function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  move: AttackMoveDef,
  rollPercent: number,
  charms: readonly CharmEffect[] = [],
  defenderCharms: readonly CharmEffect[] = [],
): DamageResult {
  const base = calcDamage({
    power: movePower(move, charms, attacker),
    attack: effectiveAttack(attacker),
    defense: effectiveDefense(defender),
    affinity: affinityMultiplier(move.attribute, defender.attribute),
    resonance: resonanceMultiplier(move.attribute, attacker.attribute),
    rollPercent,
  });
  const cut = damageCutPercent(move, defender, defenderCharms);
  const amount = cut === 0 ? base : Math.max(MIN_DAMAGE, Math.floor((base * (100 - cut)) / 100));
  return {
    amount,
    effectiveness: getEffectiveness(move.attribute, defender.attribute),
    resonance: isResonant(move.attribute, attacker.attribute),
  };
}
