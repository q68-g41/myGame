/**
 * 画面とエンジンの間で、1戦の流れを管理する（DOM は使わない）。
 * ルールはエンジンに任せ、ここではコマンドを渡して結果を受け取るだけ。
 */
import { chooseCommandStage1, chooseReplacementStage1 } from '../ai/cpu';
import { pickTeams } from '../ai/teams';
import { FIGHTERS } from '../data/fighters';
import { createBattle, resolveTurn, submitReplacements } from '../engine/battle';
import { memberAt } from '../engine/team';
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
  /**
   * 素早さが分かった相手のキャラ ID（行動順の予告に使う）。
   * 同じバトルで、そのキャラと同じ段階の技どうしで行動順を比べたら「分かった」とする
   */
  readonly knownEnemySpeeds: ReadonlySet<string>;
}

/** シードからチームを決めて、バトルを始める（M3：仮キャラ6体を3対3にランダムに分ける） */
export function startSession(seed: number): BattleSession {
  const teams = pickTeams(FIGHTERS, MAX_TEAM_SIZE, createRng(seed));
  const battleSeed = nextInt(teams.rng, 0, 0xffffffff);
  const state = createBattle(teams.value.player, teams.value.enemy);
  return { state, rng: createRng(battleSeed.value), lastEvents: [], previousState: state, knownEnemySpeeds: new Set() };
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

/**
 * このターンで、相手のどのキャラと素早さを比べたかを調べる。
 * 両方が技を使い、どちらも先制技か、どちらも先制技以外なら、行動順は素早さで決まっている。
 */
export function comparedEnemySpeed(before: BattleState, events: readonly BattleEvent[]): string | null {
  let enemyActive = before.sides.enemy.active;
  let enemyMover: { id: string; priority: boolean } | null = null;
  let playerPriority: boolean | null = null;
  for (const event of events) {
    if (event.type === 'switched' && event.side === 'enemy') {
      enemyActive = event.to;
    }
    if (event.type === 'moveUsed') {
      const priority = event.moveKind === 'priority';
      if (event.side === 'enemy') {
        enemyMover = { id: memberAt(before.sides.enemy, enemyActive).id, priority };
      } else {
        playerPriority = priority;
      }
    }
  }
  return enemyMover !== null && playerPriority === enemyMover.priority ? enemyMover.id : null;
}

/** 自分のコマンドでターンを進める。相手のコマンドは CPU（段階1）が選ぶ */
export function playCommand(session: BattleSession, command: Command): BattleSession {
  const commands = { player: command, enemy: chooseCommandStage1(session.state, 'enemy') };
  const turn = resolveTurn(session.state, commands, session.rng);
  const replaced = replaceEnemyIfNeeded(turn.state);
  const compared = comparedEnemySpeed(session.state, turn.events);
  return {
    state: replaced.state,
    rng: turn.rng,
    lastEvents: [...turn.events, ...replaced.events],
    previousState: session.state,
    knownEnemySpeeds: compared === null ? session.knownEnemySpeeds : new Set([...session.knownEnemySpeeds, compared]),
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
