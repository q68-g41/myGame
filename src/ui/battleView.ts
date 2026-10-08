/**
 * バトル画面に出す内容を、セッションから組み立てる（DOM は使わない）。
 * 画面はこの内容をそのまま描くだけにする。
 */
import { ATTRIBUTE_COLORS } from '../data/attributes';
import { getFighter } from '../data/fighters';
import { STATUS_NAMES } from '../data/labels';
import { getMove } from '../data/moves';
import { isMoveSelectable } from '../engine/moves';
import { activeOf, isFainted } from '../engine/team';
import type { Combatant, Side } from '../engine/types';
import { describeEvents } from './messages';
import { needsPlayerReplacement, type BattleSession } from './session';

/** command：技を選ぶ、replacement：倒れたので控えから選ぶ、ended：決着 */
export type BattlePhase = 'command' | 'replacement' | 'ended';

/** 場に出ているキャラの表示 */
export interface FighterPanelView {
  readonly name: string;
  readonly color: string;
  readonly hp: number;
  readonly maxHp: number;
  /** 状態異常の表示名。なければ null */
  readonly status: string | null;
  /** チームの各キャラが倒れていないか（残りの数の表示に使う） */
  readonly teamAlive: readonly boolean[];
}

/** 技ボタンの表示 */
export interface MoveButtonView {
  readonly id: string;
  readonly name: string;
  readonly disabled: boolean;
  /** 補足（大技の使用不可ターンなど）。なければ null */
  readonly note: string | null;
}

/** 控えのアイコンの表示 */
export interface BenchView {
  readonly index: number;
  readonly name: string;
  readonly color: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly fainted: boolean;
  /** いまタップして選べるか */
  readonly selectable: boolean;
}

export interface BattleView {
  readonly phase: BattlePhase;
  readonly enemy: FighterPanelView;
  readonly player: FighterPanelView;
  /** ログ1行 */
  readonly log: string;
  readonly moves: readonly MoveButtonView[];
  readonly bench: readonly BenchView[];
  /** 決着したときの結果。決着前は null */
  readonly result: 'win' | 'lose' | null;
}

function phaseOf(session: BattleSession): BattlePhase {
  if (session.state.winner !== null) {
    return 'ended';
  }
  return needsPlayerReplacement(session) ? 'replacement' : 'command';
}

function panel(session: BattleSession, side: Side): FighterPanelView {
  const sideState = session.state.sides[side];
  const active = activeOf(sideState);
  return {
    name: getFighter(active.id).name,
    color: ATTRIBUTE_COLORS[active.attribute],
    hp: active.hp,
    maxHp: active.stats.hp,
    status: active.status ? STATUS_NAMES[active.status.id] : null,
    teamAlive: sideState.team.map((member) => !isFainted(member)),
  };
}

function moveButtons(active: Combatant, phase: BattlePhase): MoveButtonView[] {
  return active.moves.map((move) => {
    const cooldown = active.cooldowns[move.id] ?? 0;
    return {
      id: move.id,
      name: getMove(move.id).name,
      disabled: phase !== 'command' || !isMoveSelectable(active, move.id),
      note: cooldown > 0 ? `あと${cooldown}ターン` : null,
    };
  });
}

function benchViews(session: BattleSession, phase: BattlePhase): BenchView[] {
  const sideState = session.state.sides.player;
  return sideState.team.flatMap((member, index) =>
    index === sideState.active
      ? []
      : [
          {
            index,
            name: getFighter(member.id).name,
            color: ATTRIBUTE_COLORS[member.attribute],
            hp: member.hp,
            maxHp: member.stats.hp,
            fainted: isFainted(member),
            selectable: phase === 'replacement' && !isFainted(member),
          },
        ],
  );
}

function logLine(session: BattleSession, phase: BattlePhase): string {
  if (phase === 'replacement') {
    return '控えから次のキャラを選んでください';
  }
  const lines = describeEvents(session.lastEvents, session.previousState);
  return lines.at(-1) ?? 'バトル開始！ 技を選んでください';
}

/** セッションから、バトル画面に出す内容を作る */
export function buildBattleView(session: BattleSession): BattleView {
  const phase = phaseOf(session);
  const { winner } = session.state;
  return {
    phase,
    enemy: panel(session, 'enemy'),
    player: panel(session, 'player'),
    log: logLine(session, phase),
    moves: moveButtons(activeOf(session.state.sides.player), phase),
    bench: benchViews(session, phase),
    result: winner === null ? null : winner === 'player' ? 'win' : 'lose',
  };
}
