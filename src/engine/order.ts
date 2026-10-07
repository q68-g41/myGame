import { findMove } from './moves';
import { nextInt, type RngResult, type RngState } from './rng';
import { effectiveSpeed } from './stats';
import type { BattleState, Commands, MoveDef, Side } from './types';

/**
 * 能力変化の倍率（×0.8 など）は小数で誤差が出るため、
 * 本来同じ素早さ（例：100 の -2段階 と 64）を同速として扱うための余白。
 */
const SPEED_TIE_TOLERANCE = 1e-9;

/** 行動の優先度。大きいほど先に動く。交代は M2 で追加する */
function actionPriority(move: MoveDef): number {
  return move.kind === 'priority' ? 1 : 0;
}

interface ActionKey {
  readonly priority: number;
  readonly speed: number;
}

function actionKey(state: BattleState, commands: Commands, side: Side): ActionKey {
  const combatant = state.sides[side];
  const move = findMove(combatant, commands[side].moveId);
  return { priority: actionPriority(move), speed: effectiveSpeed(combatant) };
}

/** a が先なら正、b が先なら負、決まらなければ 0 */
function compareActions(a: ActionKey, b: ActionKey): number {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  const speedDiff = a.speed - b.speed;
  return Math.abs(speedDiff) < SPEED_TIE_TOLERANCE ? 0 : speedDiff;
}

/**
 * このターンの行動順を決める（3.5）。
 * 1. 先制技 2. それ以外の技は素早さが高い順 3. 同じならシード付き乱数で決める。
 * 素早さは能力変化を反映した値を、毎ターン比べ直す。
 * 乱数を引くのは同順のときだけ。
 */
export function decideActionOrder(
  state: BattleState,
  commands: Commands,
  rng: RngState,
): RngResult<readonly Side[]> {
  const diff = compareActions(actionKey(state, commands, 'player'), actionKey(state, commands, 'enemy'));
  if (diff > 0) {
    return { value: ['player', 'enemy'], rng };
  }
  if (diff < 0) {
    return { value: ['enemy', 'player'], rng };
  }
  const coin = nextInt(rng, 0, 1);
  return { value: coin.value === 0 ? ['player', 'enemy'] : ['enemy', 'player'], rng: coin.rng };
}
