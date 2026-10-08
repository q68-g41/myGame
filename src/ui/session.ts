/**
 * 画面とエンジンの間で、1戦の流れを管理する（DOM は使わない）。
 * ルールはエンジンに任せ、ここではコマンドを渡して結果を受け取るだけ。
 */
import { chooseCommand, chooseReplacement } from '../ai/policy';
import { resolveTurn, submitReplacements } from '../engine/battle';
import { memberAt } from '../engine/team';
import { createRng, type RngState } from '../engine/rng';
import type { BattleEvent, BattleState, BossPattern, Command, CpuLevel, Replacements } from '../engine/types';

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
  /** 相手の CPU の段階 */
  readonly cpu: CpuLevel;
  /** ボス戦なら、ボスの行動パターン。それ以外は null */
  readonly boss: BossPattern | null;
}

/** 始まったバトルと、そのバトルで使う乱数のシード、相手の CPU の段階（とボスの行動パターン）から、1戦の流れを始める */
export function createSession(
  state: BattleState,
  seed: number,
  cpu: CpuLevel = 1,
  boss: BossPattern | null = null,
): BattleSession {
  return { state, rng: createRng(seed), lastEvents: [], previousState: state, knownEnemySpeeds: new Set(), cpu, boss };
}

/** 保存したバトル（毎ターンの自動保存用。乱数の状態と、素早さが分かった相手も残す） */
export interface SavedBattle {
  readonly state: BattleState;
  readonly rng: RngState;
  readonly knownEnemySpeeds: readonly string[];
}

/** 保存する形にする */
export function saveSession(session: BattleSession): SavedBattle {
  return { state: session.state, rng: session.rng, knownEnemySpeeds: [...session.knownEnemySpeeds] };
}

/** 保存したバトルから、1戦の流れを再開する（直前に起きたことは残らない） */
export function restoreSession(saved: SavedBattle, cpu: CpuLevel, boss: BossPattern | null = null): BattleSession {
  return {
    state: saved.state,
    rng: saved.rng,
    lastEvents: [],
    previousState: saved.state,
    knownEnemySpeeds: new Set(saved.knownEnemySpeeds),
    cpu,
    boss,
  };
}

/** 自分が控えから次のキャラを選ぶ必要があるか */
export function needsPlayerReplacement(session: BattleSession): boolean {
  return session.state.awaitingReplacement.includes('player');
}

/** 相手だけが控えから選ぶ必要があれば、CPU に選ばせて出す */
function replaceEnemyIfNeeded(state: BattleState, cpu: CpuLevel): { state: BattleState; events: readonly BattleEvent[] } {
  const awaiting = state.awaitingReplacement;
  if (!awaiting.includes('enemy') || awaiting.includes('player')) {
    return { state, events: [] };
  }
  return submitReplacements(state, { enemy: chooseReplacement(state, 'enemy', cpu) });
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

/** 自分のコマンドでターンを進める。相手のコマンドは、そのバトルの段階の CPU が選ぶ */
export function playCommand(session: BattleSession, command: Command): BattleSession {
  const commands = { player: command, enemy: chooseCommand(session.state, 'enemy', session.cpu, session.boss) };
  const turn = resolveTurn(session.state, commands, session.rng);
  const replaced = replaceEnemyIfNeeded(turn.state, session.cpu);
  const compared = comparedEnemySpeed(session.state, turn.events);
  return {
    ...session,
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
    ? { player: index, enemy: chooseReplacement(state, 'enemy', session.cpu) }
    : { player: index };
  const result = submitReplacements(state, replacements);
  return { ...session, state: result.state, lastEvents: result.events, previousState: state };
}
