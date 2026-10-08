/**
 * 画面とエンジンの間で、1戦の流れを管理する（DOM は使わない）。
 * ルールはエンジンに任せ、ここではコマンドを渡して結果を受け取るだけ。
 */
import { chooseCommandStage1, chooseReplacementStage1 } from '../ai/cpu';
import { pickTeams } from '../ai/teams';
import { FIGHTERS } from '../data/fighters';
import { createBattle, resolveTurn, submitReplacements } from '../engine/battle';
import { MAX_TEAM_SIZE } from '../engine/constants';
import { createRng, nextInt, type RngState } from '../engine/rng';
import type { BattleEvent, BattleState, Command, Replacements } from '../engine/types';

/** 1戦の状態 */
export interface BattleSession {
  readonly state: BattleState;
  readonly rng: RngState;
  /** 直前の操作で起きたこと（画面はこれを再生する） */
  readonly lastEvents: readonly BattleEvent[];
  /** 直前の操作の前の状態（ログの名前を引くのに使う） */
  readonly previousState: BattleState;
}

/** シードからチームを決めて、バトルを始める（M3：仮キャラ6体を3対3にランダムに分ける） */
export function startSession(seed: number): BattleSession {
  const teams = pickTeams(FIGHTERS, MAX_TEAM_SIZE, createRng(seed));
  const battleSeed = nextInt(teams.rng, 0, 0xffffffff);
  const state = createBattle(teams.value.player, teams.value.enemy);
  return { state, rng: createRng(battleSeed.value), lastEvents: [], previousState: state };
}

/** 自分が控えから次のキャラを選ぶ必要があるか */
export function needsPlayerReplacement(session: BattleSession): boolean {
  return session.state.awaitingReplacement.includes('player');
}

/** 相手だけが控えから選ぶ必要があれば、CPU に選ばせて出す */
function replaceEnemyIfNeeded(state: BattleState): { state: BattleState; events: readonly BattleEvent[] } {
  const awaiting = state.awaitingReplacement;
  if (!awaiting.includes('enemy') || awaiting.includes('player')) {
    return { state, events: [] };
  }
  return submitReplacements(state, { enemy: chooseReplacementStage1(state, 'enemy') });
}

/** 自分のコマンドでターンを進める。相手のコマンドは CPU（段階1）が選ぶ */
export function playCommand(session: BattleSession, command: Command): BattleSession {
  const commands = { player: command, enemy: chooseCommandStage1(session.state, 'enemy') };
  const turn = resolveTurn(session.state, commands, session.rng);
  const replaced = replaceEnemyIfNeeded(turn.state);
  return {
    state: replaced.state,
    rng: turn.rng,
    lastEvents: [...turn.events, ...replaced.events],
    previousState: session.state,
  };
}

/** 技を使う */
export function playMove(session: BattleSession, moveId: string): BattleSession {
  return playCommand(session, { type: 'move', moveId });
}

/** 控えと交代する（ターンを使う） */
export function playSwitch(session: BattleSession, to: number): BattleSession {
  return playCommand(session, { type: 'switch', to });
}

/** 倒れたあとに、控えから次のキャラを出す。相手も選ぶ必要があれば CPU が同時に選ぶ */
export function playReplacement(session: BattleSession, index: number): BattleSession {
  const { state } = session;
  const replacements: Replacements = state.awaitingReplacement.includes('enemy')
    ? { player: index, enemy: chooseReplacementStage1(state, 'enemy') }
    : { player: index };
  const result = submitReplacements(state, replacements);
  return { ...session, state: result.state, lastEvents: result.events, previousState: state };
}
