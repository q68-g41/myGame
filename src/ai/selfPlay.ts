/**
 * CPU 同士の対戦を最後まで進める（バランス確認用。scripts/simulate.ts から使う）。
 */
import { createBattle, resolveTurn, submitReplacements } from '../engine/battle';
import type { RngState } from '../engine/rng';
import type { BattleState, FighterDef, Side } from '../engine/types';
import { chooseCommandStage1, chooseReplacementStage1 } from './cpu';

/** 決着しないまま打ち切るターン数（無限ループを防ぐため） */
export const MAX_SELF_PLAY_TURNS = 200;

/** CPU 同士の対戦の結果 */
export interface SelfPlayResult {
  /** 勝った陣営。打ち切ったら null */
  readonly winner: Side | null;
  /** 処理したターン数 */
  readonly turns: number;
  readonly state: BattleState;
}

/** 段階1の CPU どうしで、決着するまで対戦する */
export function playCpuBattle(
  player: readonly FighterDef[],
  enemy: readonly FighterDef[],
  rng: RngState,
): SelfPlayResult {
  let state = createBattle(player, enemy);
  let currentRng = rng;
  let turns = 0;

  while (state.winner === null && turns < MAX_SELF_PLAY_TURNS) {
    if (state.awaitingReplacement.length > 0) {
      const replacements: Partial<Record<Side, number>> = {};
      for (const side of state.awaitingReplacement) {
        replacements[side] = chooseReplacementStage1(state, side);
      }
      state = submitReplacements(state, replacements).state;
      continue;
    }
    const commands = { player: chooseCommandStage1(state, 'player'), enemy: chooseCommandStage1(state, 'enemy') };
    const result = resolveTurn(state, commands, currentRng);
    state = result.state;
    currentRng = result.rng;
    turns += 1;
  }

  return { winner: state.winner, turns, state };
}
