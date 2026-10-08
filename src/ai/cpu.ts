/**
 * CPU の思考（仕様書 6）。エンジンと同じく純粋な関数で書き、同じ状態なら必ず同じ答えを返す。
 * 段階1：予想ダメージが最大の技を選ぶ（エリア1）
 */
import { DAMAGE_ROLL_MAX_PERCENT, DAMAGE_ROLL_MIN_PERCENT } from '../engine/constants';
import { computeDamage } from '../engine/damage';
import { isAttackMove, selectableMoves } from '../engine/moves';
import { activeCombatant, memberAt, opponentOf, switchTargets } from '../engine/team';
import type { AttackMoveDef, BattleState, CharmEffect, Combatant, Command, Side } from '../engine/types';

/** 予想ダメージに使う乱数（0.90〜1.00 の真ん中） */
const EXPECTED_ROLL_PERCENT = (DAMAGE_ROLL_MIN_PERCENT + DAMAGE_ROLL_MAX_PERCENT) / 2;

/** 予想ダメージ（乱数を真ん中の値にしたダメージ）。charms は攻撃側の陣営のお守り */
export function expectedDamage(
  attacker: Combatant,
  defender: Combatant,
  move: AttackMoveDef,
  charms: readonly CharmEffect[] = [],
): number {
  return computeDamage(attacker, defender, move, EXPECTED_ROLL_PERCENT, charms).amount;
}

/** いま選べる攻撃技のうち、予想ダメージが最大のもの。同じなら技の並び順で先のもの */
function bestAttack(
  attacker: Combatant,
  defender: Combatant,
  charms: readonly CharmEffect[] = [],
): { move: AttackMoveDef; damage: number } | null {
  let best: { move: AttackMoveDef; damage: number } | null = null;
  for (const move of selectableMoves(attacker).filter(isAttackMove)) {
    const damage = expectedDamage(attacker, defender, move, charms);
    if (best === null || damage > best.damage) {
      best = { move, damage };
    }
  }
  return best;
}

/**
 * 段階1のコマンド：予想ダメージが最大の技を選ぶ。交代はしない。
 * 選べる攻撃技がなければ（大技の使用不可中で、ほかが補助技だけのとき）、選べる技の先頭を使う。
 */
export function chooseCommandStage1(state: BattleState, side: Side): Command {
  const self = activeCombatant(state, side);
  const best = bestAttack(self, activeCombatant(state, opponentOf(side)), state.sides[side].charms);
  if (best !== null) {
    return { type: 'move', moveId: best.move.id };
  }
  const fallback = selectableMoves(self)[0];
  if (!fallback) {
    throw new Error(`${self.id} に選べる技がありません`);
  }
  return { type: 'move', moveId: fallback.id };
}

/**
 * 段階1の、倒れたあとに控えから出すキャラ：
 * 相手の場のキャラに対する予想ダメージが一番大きい控え。同じならチームの並び順で先のもの。
 */
export function chooseReplacementStage1(state: BattleState, side: Side): number {
  const sideState = state.sides[side];
  const opponent = activeCombatant(state, opponentOf(side));
  let best: { index: number; damage: number } | null = null;
  for (const index of switchTargets(sideState)) {
    const damage = bestAttack(memberAt(sideState, index), opponent, sideState.charms)?.damage ?? 0;
    if (best === null || damage > best.damage) {
      best = { index, damage };
    }
  }
  if (best === null) {
    throw new Error(`${side} に出せる控えがいません`);
  }
  return best.index;
}
