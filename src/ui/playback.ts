/**
 * ターンの演出（仕様書 5）。エンジンが返したイベントを1つずつ「コマ」にして順番に見せる。
 * ルールの計算はせず、イベントに入っている結果（残りHPなど）を画面用の状態に写すだけ。
 */
import { memberAt, withActive } from '../engine/team';
import type { BattleEvent, BattleState, Combatant, Side } from '../engine/types';
import { describeEvents } from './messages';

/** 1ターンの演出の長さの上限（仕様書 5：1ターンの演出は2秒以内） */
export const TURN_PLAYBACK_BUDGET_MS = 2000;

/** 1コマの長さの上限（イベントが少ないターンでも、間延びしないように） */
export const MAX_STEP_MS = 500;

/** 演出の速さ */
export type PlaybackSpeed = 1 | 2;

/** 演出の1コマ */
export interface PlaybackFrame {
  /** このコマで画面に出す状態 */
  readonly state: BattleState;
  /** ログ1行 */
  readonly log: string;
  /** ダメージを受けて光らせる陣営。なければ null */
  readonly hit: Side | null;
}

/** イベント1つの結果を、画面用の状態に写す */
function applyForDisplay(state: BattleState, event: BattleEvent, final: BattleState): BattleState {
  const setActive = (side: Side, patch: (member: Combatant) => Partial<Combatant>) => {
    const sideState = state.sides[side];
    const member = memberAt(sideState, sideState.active);
    return { ...state, sides: withActive(state.sides, side, { ...member, ...patch(member) }) };
  };

  switch (event.type) {
    case 'damage':
    case 'healed':
    case 'statusDamage':
      return setActive(event.side, () => ({ hp: event.hp }));
    case 'statusApplied': {
      // かかった状態異常は、最終的な状態から写す（画面に出すのは種類だけ）
      const sideState = state.sides[event.side];
      return setActive(event.side, () => ({ status: memberAt(final.sides[event.side], sideState.active).status }));
    }
    case 'statusEnded':
      return setActive(event.side, () => ({ status: null }));
    case 'statChanged':
      return setActive(event.side, (member) => ({ stages: { ...member.stages, [event.stat]: event.stage } }));
    case 'switched':
      return { ...state, sides: { ...state.sides, [event.side]: { ...state.sides[event.side], active: event.to } } };
    case 'moveUsed':
    case 'statusBlocked':
    case 'fainted':
    case 'battleEnd':
      return state;
  }
}

/** 直前の状態とイベントから、演出のコマを作る。最後のコマのあとは最終的な状態を見せる */
export function buildFrames(
  before: BattleState,
  events: readonly BattleEvent[],
  final: BattleState,
): PlaybackFrame[] {
  const logs = describeEvents(events, before);
  let state = before;
  return events.map((event, index) => {
    state = applyForDisplay(state, event, final);
    const hit = event.type === 'damage' || event.type === 'statusDamage' ? event.side : null;
    return { state, log: logs[index]!, hit };
  });
}

/** 1コマの長さ。1ターン全体が2秒以内に収まるようにし、2倍速なら半分にする */
export function stepDuration(frameCount: number, speed: PlaybackSpeed): number {
  const step = Math.min(MAX_STEP_MS, TURN_PLAYBACK_BUDGET_MS / Math.max(1, frameCount));
  return step / speed;
}
