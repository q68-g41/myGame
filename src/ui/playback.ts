/**
 * ターンの演出（仕様書 5）。エンジンが返したイベントを1つずつ「コマ」にして順番に見せる。
 * ルールの計算はせず、イベントに入っている結果（残りHPなど）を画面用の状態に写すだけ。
 */
import type { SoundId } from '../data/sounds';
import { memberAt, withActive } from '../engine/team';
import type { BattleEvent, BattleState, Combatant, Side } from '../engine/types';
import { describeEvents } from './messages';

/** 1コマ（ログ1行）を出す長さ（仕様書 5：1倍速で0.8秒。2倍速なら半分） */
export const STEP_MS = 800;

/** バトルのログに残す行の数（仕様書 5：直近の3行） */
export const LOG_LINES = 3;

/** 演出の速さ */
export type PlaybackSpeed = 1 | 2;

/**
 * 場のキャラの動き（M7-1）。attack：技を使って前に出る、faint：倒れて薄れる、enter：交代で入ってくる。
 * ダメージで揺れて光る動きは hit で表す
 */
export type MotionKind = 'attack' | 'faint' | 'enter';

export interface FrameMotion {
  readonly side: Side;
  readonly kind: MotionKind;
}

/** キャラの上に出す数字の種類（M7-4）。ダメージは相性で見た目を変え、回復は別の色にする */
export type PopupKind = 'advantage' | 'neutral' | 'disadvantage' | 'heal';

/** キャラの上に出す数字（ダメージ・回復） */
export interface FramePopup {
  readonly side: Side;
  readonly amount: number;
  readonly kind: PopupKind;
}

/** 演出の1コマ */
export interface PlaybackFrame {
  /** このコマで画面に出す状態 */
  readonly state: BattleState;
  /** このコマで出したログ1行 */
  readonly log: string;
  /** 画面に残すログ（このターンの直近 LOG_LINES 行。古い順で、最後がこのコマの行） */
  readonly logLines: readonly string[];
  /** ダメージを受けて光らせる陣営。なければ null */
  readonly hit: Side | null;
  /** このコマで動く場のキャラ。なければ null */
  readonly motion: FrameMotion | null;
  /** このコマでキャラの上に出す数字（M7-4）。なければ null */
  readonly popup: FramePopup | null;
  /** このコマで鳴らす効果音（M7-2）。なければ null */
  readonly sound: SoundId | null;
}

/** イベントから、鳴らす効果音を決める。勝ち負けは効果音ではなく、BGM の短い曲（src/data/music.ts）で知らせる */
function soundOf(event: BattleEvent): SoundId | null {
  switch (event.type) {
    case 'moveUsed':
      return 'move';
    case 'damage':
      return event.effectiveness === 'advantage' ? 'hitStrong' : event.effectiveness === 'disadvantage' ? 'hitWeak' : 'hit';
    case 'statusDamage':
      return 'hit';
    case 'healed':
      return event.amount > 0 ? 'heal' : null;
    case 'statusApplied':
      return 'status';
    case 'statChanged':
      return event.delta !== 0 ? 'status' : null;
    case 'switched':
      return 'switch';
    case 'fainted':
      return 'faint';
    default:
      return null;
  }
}

/** イベントから、場のキャラの動きを決める */
function motionOf(event: BattleEvent): FrameMotion | null {
  switch (event.type) {
    case 'moveUsed':
      return { side: event.side, kind: 'attack' };
    case 'fainted':
      return { side: event.side, kind: 'faint' };
    case 'switched':
      return { side: event.side, kind: 'enter' };
    default:
      return null;
  }
}

/** イベントから、キャラの上に出す数字を決める（ダメージ・状態異常のダメージ・回復） */
function popupOf(event: BattleEvent): FramePopup | null {
  switch (event.type) {
    case 'damage':
      return { side: event.side, amount: event.amount, kind: event.effectiveness };
    case 'statusDamage':
      return { side: event.side, amount: event.amount, kind: 'neutral' };
    case 'healed':
      return event.amount > 0 ? { side: event.side, amount: event.amount, kind: 'heal' } : null;
    default:
      return null;
  }
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
    return {
      state,
      log: logs[index]!,
      logLines: logs.slice(Math.max(0, index + 1 - LOG_LINES), index + 1),
      hit,
      motion: motionOf(event),
      popup: popupOf(event),
      sound: soundOf(event),
    };
  });
}

/** 1コマの長さ。ログ1行を読めるだけ出し、2倍速なら半分にする */
export function stepDuration(speed: PlaybackSpeed): number {
  return STEP_MS / speed;
}
