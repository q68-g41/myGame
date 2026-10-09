/**
 * バトル画面に出す内容を、セッションから組み立てる（DOM は使わない）。
 * 画面はこの内容をそのまま描くだけにする。
 */
import { ATTRIBUTE_COLORS } from '../data/attributes';
import { getFighter } from '../data/fighters';
import { STATUS_NAMES } from '../data/labels';
import { getMove } from '../data/moves';
import { getEffectiveness } from '../engine/affinity';
import { movePower } from '../engine/charms';
import { findMove, isAttackMove, isMoveSelectable } from '../engine/moves';
import { compareSpeeds } from '../engine/order';
import { effectiveSpeed } from '../engine/stats';
import { activeOf, isFainted } from '../engine/team';
import type { CharmEffect, Combatant, Effectiveness, Side } from '../engine/types';
import { describeEvents } from './messages';
import { describeMove, MOVE_KIND_NAMES, summarizeEffects } from './moveInfo';
import { needsPlayerReplacement, type BattleSession } from './session';
import { iconUrl, spriteUrl } from './sprites';

/** command：技を選ぶ、replacement：倒れたので控えから選ぶ、playing：演出中、ended：決着 */
export type BattlePhase = 'command' | 'replacement' | 'playing' | 'ended';

/** 場に出ているキャラの表示 */
export interface FighterPanelView {
  /** キャラ ID（HPバーを動かすとき、同じキャラかどうかを見分ける） */
  readonly id: string;
  readonly name: string;
  readonly color: string;
  /** ドット絵の URL。絵がなければ null（属性の色の四角を出す） */
  readonly sprite: string | null;
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
  /** 属性の色 */
  readonly color: string;
  /** 威力。補助技は null */
  readonly power: number | null;
  /** 補助技の効果の要約。攻撃技は null */
  readonly summary: string | null;
  /** 種類のタグ（大技・先制・補助）。通常の技は null */
  readonly kindLabel: string | null;
  /** いまの相手への相性（有利・不利のマーク）。補助技は null */
  readonly effectiveness: Effectiveness | null;
}

/** 長押しで出す技の詳細 */
export interface MoveDetailView {
  readonly name: string;
  readonly lines: readonly string[];
}

/** 行動順の予告（相手の素早さが分からなければ unknown） */
export type OrderPreview = 'first' | 'later' | 'tie' | 'unknown';

/** 控えのアイコンの表示 */
export interface BenchView {
  readonly index: number;
  readonly name: string;
  readonly color: string;
  /** 小さい絵の URL。絵がなければ null（属性の色の四角を出す） */
  readonly icon: string | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly fainted: boolean;
  /** いまタップして選べるか */
  readonly selectable: boolean;
  /** 選んでいる（確定待ち）か */
  readonly selected: boolean;
}

/** 控えを選んだあとの確認（2タップ目） */
export interface ConfirmView {
  readonly index: number;
  /** 確認の文章 */
  readonly question: string;
  /** 確定ボタンの文字 */
  readonly confirmLabel: string;
}

/** 画面だけが持つ状態（エンジンには渡さない） */
export interface UiState {
  /** 選んでいる控えの位置。選んでいなければ null */
  readonly selectedBench: number | null;
  /** 演出の速さ（1倍・2倍） */
  readonly speed: 1 | 2;
  /** 長押しで詳細を出している技。出していなければ null */
  readonly detailMoveId: string | null;
}

/** 演出中に見せるコマ（playback.ts の PlaybackFrame と同じ形） */
export interface FrameOverlay {
  readonly state: BattleSession['state'];
  readonly log: string;
  readonly hit: Side | null;
}

export const INITIAL_UI_STATE: UiState = { selectedBench: null, speed: 1, detailMoveId: null };

export interface BattleView {
  readonly phase: BattlePhase;
  readonly enemy: FighterPanelView;
  readonly player: FighterPanelView;
  /** ログ1行 */
  readonly log: string;
  readonly moves: readonly MoveButtonView[];
  readonly bench: readonly BenchView[];
  /** 控えを選んで確定を待っているとき、その確認。なければ null */
  readonly confirm: ConfirmView | null;
  /** 演出でダメージを受けて光らせる陣営。なければ null */
  readonly hit: Side | null;
  /** 演出の速さ（メニューの表示に使う） */
  readonly speed: 1 | 2;
  /** 行動順の予告 */
  readonly orderPreview: OrderPreview;
  /** 長押しで出している技の詳細。なければ null */
  readonly detail: MoveDetailView | null;
  /** 決着したときの結果。決着前は null */
  readonly result: 'win' | 'lose' | null;
  /** いまのマスの説明（例：「3層目・強敵」）。なければ null */
  readonly caption: string | null;
}

function phaseOf(session: BattleSession): BattlePhase {
  if (session.state.winner !== null) {
    return 'ended';
  }
  return needsPlayerReplacement(session) ? 'replacement' : 'command';
}

function panel(state: BattleSession['state'], side: Side): FighterPanelView {
  const sideState = state.sides[side];
  const active = activeOf(sideState);
  return {
    id: active.id,
    name: getFighter(active.id).name,
    color: ATTRIBUTE_COLORS[active.attribute],
    sprite: spriteUrl(active.id),
    hp: active.hp,
    maxHp: active.stats.hp,
    status: active.status ? STATUS_NAMES[active.status.id] : null,
    teamAlive: sideState.team.map((member) => !isFainted(member)),
  };
}

function moveButtons(
  active: Combatant,
  opponent: Combatant,
  phase: BattlePhase,
  charms: readonly CharmEffect[] = [],
): MoveButtonView[] {
  return active.moves.map((move) => {
    const cooldown = active.cooldowns[move.id] ?? 0;
    const attack = isAttackMove(move);
    return {
      id: move.id,
      name: getMove(move.id).name,
      disabled: phase !== 'command' || !isMoveSelectable(active, move.id),
      note: cooldown > 0 ? `あと${cooldown}ターン` : null,
      color: ATTRIBUTE_COLORS[move.attribute],
      power: attack ? movePower(move, charms, active) : null,
      summary: attack ? null : summarizeEffects(move.effects),
      kindLabel: move.kind === 'normal' ? null : MOVE_KIND_NAMES[move.kind],
      effectiveness: attack ? getEffectiveness(move.attribute, opponent.attribute) : null,
    };
  });
}

/** 行動順の予告（仕様書 5）。相手の素早さが分かっているときだけ、いまの素早さで比べる */
function orderPreview(session: BattleSession, state: BattleSession['state']): OrderPreview {
  const player = activeOf(state.sides.player);
  const enemy = activeOf(state.sides.enemy);
  if (!session.knownEnemySpeeds.has(enemy.id)) {
    return 'unknown';
  }
  const diff = compareSpeeds(effectiveSpeed(player), effectiveSpeed(enemy));
  return diff > 0 ? 'first' : diff < 0 ? 'later' : 'tie';
}

function benchViews(state: BattleSession['state'], phase: BattlePhase, ui: UiState): BenchView[] {
  const sideState = state.sides.player;
  // 技を選ぶときは交代先として、倒れたときは次に出すキャラとして選べる
  const canSelect = phase === 'command' || phase === 'replacement';
  return sideState.team.flatMap((member, index) =>
    index === sideState.active
      ? []
      : [
          {
            index,
            name: getFighter(member.id).name,
            color: ATTRIBUTE_COLORS[member.attribute],
            icon: iconUrl(member.id),
            hp: member.hp,
            maxHp: member.stats.hp,
            fainted: isFainted(member),
            selectable: canSelect && !isFainted(member),
            selected: ui.selectedBench === index,
          },
        ],
  );
}

function logLine(session: BattleSession, phase: BattlePhase): string {
  if (phase === 'replacement') {
    return '控えから次のキャラを選んでください';
  }
  const lines = describeEvents(session.lastEvents, session.previousState);
  // 起きたことがないのは、バトルの最初か、保存したところから再開した直後
  return lines.at(-1) ?? (session.state.turn === 1 ? 'バトル開始！ 技を選んでください' : '続きから。技を選んでください');
}

function confirmView(session: BattleSession, phase: BattlePhase, bench: readonly BenchView[], ui: UiState): ConfirmView | null {
  const selected = bench.find((member) => member.index === ui.selectedBench && member.selectable);
  if (!selected) {
    return null;
  }
  if (phase === 'replacement') {
    return { index: selected.index, question: `${selected.name}を出しますか？`, confirmLabel: '出す' };
  }
  const active = getFighter(activeOf(session.state.sides.player).id).name;
  return {
    index: selected.index,
    question: `${active}を戻して ${selected.name}と交代しますか？`,
    confirmLabel: '交代する',
  };
}

function detailView(state: BattleSession['state'], ui: UiState): MoveDetailView | null {
  if (ui.detailMoveId === null) {
    return null;
  }
  const player = activeOf(state.sides.player);
  return describeMove(findMove(player, ui.detailMoveId), player, activeOf(state.sides.enemy), state.sides.player.charms);
}

/**
 * セッションと画面の状態から、バトル画面に出す内容を作る。
 * 演出中は frame（そのコマの状態とログ）を見せ、ボタンはすべて押せなくする。
 */
export function buildBattleView(
  session: BattleSession,
  ui: UiState = INITIAL_UI_STATE,
  frame: FrameOverlay | null = null,
  caption: string | null = null,
): BattleView {
  const phase = frame !== null ? 'playing' : phaseOf(session);
  const state = frame?.state ?? session.state;
  const { winner } = session.state;
  const bench = benchViews(state, phase, ui);
  return {
    phase,
    enemy: panel(state, 'enemy'),
    player: panel(state, 'player'),
    log: frame?.log ?? logLine(session, phase),
    moves: moveButtons(activeOf(state.sides.player), activeOf(state.sides.enemy), phase, state.sides.player.charms),
    bench,
    confirm: phase === 'playing' ? null : confirmView(session, phase, bench, ui),
    hit: frame?.hit ?? null,
    speed: ui.speed,
    orderPreview: orderPreview(session, state),
    detail: detailView(state, ui),
    result: phase === 'ended' ? (winner === 'player' ? 'win' : 'lose') : null,
    caption,
  };
}
