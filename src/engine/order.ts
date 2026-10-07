import { findMove } from './moves';
import { nextInt, type RngResult, type RngState } from './rng';
import { effectiveSpeed } from './stats';
import { activeCombatant } from './team';
import type { BattleState, Command, Commands, Combatant, Side } from './types';

/**
 * 能力変化の倍率（×0.8 など）は小数で誤差が出るため、
 * 本来同じ素早さ（例：100 の -2段階 と 64）を同速として扱うための余白。
 */
const SPEED_TIE_TOLERANCE = 1e-9;

/** 行動の優先度。大きいほど先に動く（3.5：交代 → 先制技 → それ以外の技） */
function actionPriority(combatant: Combatant, command: Command): number {
  if (command.type === 'switch') {
    return 2;
  }
  return findMove(combatant, command.moveId).kind === 'priority' ? 1 : 0;
}

interface ActionKey {
  readonly priority: number;
  readonly speed: number;
}

function actionKey(state: BattleState, commands: Commands, side: Side): ActionKey {
  const combatant = activeCombatant(state, side);
  return { priority: actionPriority(combatant, commands[side]), speed: effectiveSpeed(combatant) };
}

/** a が先なら正、b が先なら負、決まらなければ 0 */
function compareActions(a: ActionKey, b: ActionKey): number {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  return compareSpeeds(a.speed, b.speed);
}

/** 素早さを比べる。a が速ければ正、b が速ければ負、同じなら 0 */
export function compareSpeeds(a: number, b: number): number {
  const diff = a - b;
  return Math.abs(diff) < SPEED_TIE_TOLERANCE ? 0 : diff;
}

/** 比較の結果から2陣営の順番を決める。同じならシード付き乱数で決める */
export function orderSides(diff: number, rng: RngState): RngResult<readonly Side[]> {
  if (diff > 0) {
    return { value: ['player', 'enemy'], rng };
  }
  if (diff < 0) {
    return { value: ['enemy', 'player'], rng };
  }
  const coin = nextInt(rng, 0, 1);
  return { value: coin.value === 0 ? ['player', 'enemy'] : ['enemy', 'player'], rng: coin.rng };
}

/**
 * このターンの行動順を決める（3.5）。
 * 1. 交代 2. 先制技 3. それ以外の技。同じ段階どうしは素早さが高い順、同じならシード付き乱数。
 * 素早さは場のキャラの、能力変化を反映した値を毎ターン比べ直す。
 * 乱数を引くのは同順のときだけ。
 */
export function decideActionOrder(
  state: BattleState,
  commands: Commands,
  rng: RngState,
): RngResult<readonly Side[]> {
  const diff = compareActions(actionKey(state, commands, 'player'), actionKey(state, commands, 'enemy'));
  return orderSides(diff, rng);
}
