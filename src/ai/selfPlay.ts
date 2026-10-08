/**
 * CPU 同士の対戦や、CPU が遊ぶランを最後まで進める（バランス確認用。scripts/simulate.ts から使う）。
 */
import { createBattle, resolveTurn, submitReplacements } from '../engine/battle';
import { createRng, nextInt, type RngState } from '../engine/rng';
import {
  chooseTeam,
  createRunBattle,
  enterNode,
  finishBattle,
  runChoices,
  startRun,
  takeReward,
  type RunContent,
  type RunResult,
  type RunState,
} from '../engine/run';
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
  return playCpuBattleFrom(createBattle(player, enemy), rng);
}

/** 始まっているバトルを、段階1の CPU どうしで決着するまで進める */
export function playCpuBattleFrom(start: BattleState, rng: RngState): SelfPlayResult {
  let state = start;
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

/** CPU が遊んだランの結果 */
export interface CpuRunResult {
  /** ランの結果。決着しないバトルがあって打ち切ったら null */
  readonly result: RunResult | null;
  /** 戦った回数（負けた戦闘も含む） */
  readonly battles: number;
  readonly run: RunState;
}

/**
 * CPU にランを1回遊ばせる。チームは候補の先頭3体、次のマスは乱数で選び、戦闘は段階1の CPU どうしで進める。
 * 報酬は、能力強化の選択肢の先頭を選ぶ（いつも1つ以上ある）。
 * マスの選び方は、ランの乱数とは別の乱数（choiceSeed から作る）で決める。
 */
export function playCpuRun(content: RunContent, seed: number, choiceSeed: number): CpuRunResult {
  let run = chooseTeam(startRun(content, seed), [0, 1, 2]);
  let choiceRng = createRng(choiceSeed);
  let battles = 0;

  while (run.phase.kind !== 'ended') {
    if (run.phase.kind === 'battle') {
      const played = playCpuBattleFrom(createRunBattle(run), createRng(run.phase.seed));
      battles += 1;
      if (played.winner === null) {
        return { result: null, battles, run };
      }
      run = finishBattle(run, played.state, content);
      continue;
    }
    if (run.phase.kind === 'reward') {
      const offer = run.phase.offers.findIndex((candidate) => candidate.kind === 'stat');
      run = takeReward(run, { offer }, content);
      continue;
    }
    const choices = runChoices(run);
    const pick = nextInt(choiceRng, 0, choices.length - 1);
    choiceRng = pick.rng;
    run = enterNode(run, choices[pick.value]!, content);
  }

  return { result: run.phase.result, battles, run };
}
