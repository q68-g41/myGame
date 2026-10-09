/**
 * 休憩・スカウト・イベントの画面に出す内容を、ランの状態から組み立てる（DOM は使わない）。
 */
import { ATTRIBUTE_COLORS, ATTRIBUTE_NAMES } from '../data/attributes';
import { getEvent } from '../data/events';
import { getFighter } from '../data/fighters';
import { getMove } from '../data/moves';
import { REST_POWER_UP } from '../engine/constants';
import { isAttackMove } from '../engine/moves';
import { restHealPercent, type EventOutcome } from '../engine/nodes';
import type { RunState } from '../engine/run';
import {
  BOOST_STAT_NAMES,
  charmNames,
  fighterDetail,
  teamViews,
  type FighterDetailView,
  type TeamMemberView,
} from './runView';

/** 選べるキャラ（技を強化するキャラ、入れ替えるキャラ） */
export interface NodeMemberView {
  readonly index: number;
  readonly name: string;
  readonly color: string;
  readonly note: string;
}

const nameOf = (run: RunState, member: number) => getFighter(run.team[member]!.fighter.id).name;

/* ===== 休憩 ===== */

/**
 * 休憩の画面だけが持つ状態。
 * - choose：回復か技の強化かを選んで「決定」（2タップ）
 * - member：技を強化するキャラを選ぶ
 * - move：強化する攻撃技を選ぶ
 */
export interface RestUiState {
  readonly step: 'choose' | 'member' | 'move';
  readonly selected: 'heal' | 'power' | null;
  readonly member: number | null;
}

export const INITIAL_REST_UI: RestUiState = { step: 'choose', selected: null, member: null };

export interface RestView {
  readonly step: RestUiState['step'];
  readonly prompt: string;
  readonly options: readonly { readonly id: 'heal' | 'power'; readonly title: string; readonly detail: string; readonly selected: boolean }[];
  readonly canConfirm: boolean;
  readonly members: readonly NodeMemberView[];
  /** 強化する技の選択肢。補助技は選べない */
  readonly moves: readonly { readonly index: number; readonly name: string; readonly detail: string; readonly color: string; readonly disabled: boolean }[];
  readonly team: readonly TeamMemberView[];
  readonly charms: readonly string[];
}

export function buildRestView(run: RunState, ui: RestUiState = INITIAL_REST_UI): RestView {
  if (run.phase.kind !== 'rest') {
    throw new Error('いまは休憩の段階ではありません');
  }
  const member = ui.member === null ? undefined : run.team[ui.member];
  const prompt =
    ui.step === 'member'
      ? 'どのキャラの技を強化しますか？'
      : ui.step === 'move' && member
        ? `${getFighter(member.fighter.id).name}の どの技を強化しますか？`
        : '休憩のしかたを選んで「決定」を押してください';
  return {
    step: ui.step,
    prompt,
    options: [
      {
        id: 'heal',
        title: 'ゆっくり休む',
        detail: `全員のHPが 最大HPの${restHealPercent(run)}% 回復する`,
        selected: ui.selected === 'heal',
      },
      {
        id: 'power',
        title: '技をみがく',
        detail: `攻撃技を1つ選んで、威力 +${REST_POWER_UP}`,
        selected: ui.selected === 'power',
      },
    ],
    canConfirm: ui.selected !== null,
    members:
      ui.step === 'member'
        ? run.team.map((m, index) => ({
            index,
            name: getFighter(m.fighter.id).name,
            color: ATTRIBUTE_COLORS[m.fighter.attribute],
            note: `HP ${m.hp} / ${m.fighter.stats.hp}`,
          }))
        : [],
    moves:
      ui.step === 'move' && member
        ? member.fighter.moves.map((move, index) => ({
            index,
            name: getMove(move.id).name,
            detail: isAttackMove(move) ? `威力 ${move.power} → ${move.power + REST_POWER_UP}` : '補助技は強化できない',
            color: ATTRIBUTE_COLORS[move.attribute],
            disabled: !isAttackMove(move),
          }))
        : [],
    team: teamViews(run.team),
    charms: charmNames(run),
  };
}

/** 休憩のあと、マップに出す一言 */
export function restNotice(run: RunState, choice: { member: number; move: number } | 'heal'): string {
  if (choice === 'heal') {
    return '全員のHPが回復した';
  }
  const move = run.team[choice.member]?.fighter.moves[choice.move];
  if (!move || !isAttackMove(move)) {
    return '';
  }
  return `${nameOf(run, choice.member)}の ${getMove(move.id).name}の威力が ${move.power + REST_POWER_UP} になった`;
}

/* ===== スカウト ===== */

/**
 * スカウトの画面だけが持つ状態。
 * - candidate：仲間にするキャラを選んで「この仲間を入れる」（入れ替えずに進むこともできる）
 * - member：入れ替えるチームのキャラを選ぶ
 */
export interface ScoutUiState {
  readonly step: 'candidate' | 'member';
  readonly selected: number | null;
}

export const INITIAL_SCOUT_UI: ScoutUiState = { step: 'candidate', selected: null };

export interface ScoutView {
  readonly step: ScoutUiState['step'];
  readonly prompt: string;
  readonly candidates: readonly {
    readonly index: number;
    readonly name: string;
    readonly color: string;
    readonly attributeName: string;
    readonly selected: boolean;
  }[];
  readonly canConfirm: boolean;
  /** 選んでいる候補の詳細 */
  readonly detail: FighterDetailView | null;
  readonly members: readonly NodeMemberView[];
  readonly team: readonly TeamMemberView[];
  readonly charms: readonly string[];
}

export function buildScoutView(run: RunState, ui: ScoutUiState = INITIAL_SCOUT_UI): ScoutView {
  const { phase } = run;
  if (phase.kind !== 'scout') {
    throw new Error('いまはスカウトの段階ではありません');
  }
  const selected = ui.selected === null ? undefined : phase.candidates[ui.selected];
  return {
    step: ui.step,
    prompt:
      ui.step === 'member' && selected
        ? `${getFighter(selected.id).name}と だれを入れ替えますか？（抜けたキャラは戻りません）`
        : '仲間にするキャラを選んでください。入れ替えずに進むこともできます',
    candidates: phase.candidates.map((fighter, index) => ({
      index,
      name: getFighter(fighter.id).name,
      color: ATTRIBUTE_COLORS[fighter.attribute],
      attributeName: ATTRIBUTE_NAMES[fighter.attribute],
      selected: index === ui.selected,
    })),
    canConfirm: selected !== undefined,
    detail: selected ? fighterDetail(selected) : null,
    members:
      ui.step === 'member'
        ? run.team.map((m, index) => ({
            index,
            name: getFighter(m.fighter.id).name,
            color: ATTRIBUTE_COLORS[m.fighter.attribute],
            note: `HP ${m.hp} / ${m.fighter.stats.hp}`,
          }))
        : [],
    team: teamViews(run.team),
    charms: charmNames(run),
  };
}

/** スカウトのあと、マップに出す一言 */
export function scoutNotice(run: RunState, choice: { candidate: number; member: number } | 'skip'): string {
  if (choice === 'skip' || run.phase.kind !== 'scout') {
    return 'だれも入れ替えずに進んだ';
  }
  const fighter = run.phase.candidates[choice.candidate];
  return fighter ? `${getFighter(fighter.id).name}が仲間になった（${nameOf(run, choice.member)}と入れ替え）` : '';
}

/* ===== イベント ===== */

/** イベントの画面だけが持つ状態（選んでいる選択肢） */
export interface EventUiState {
  readonly selected: number | null;
}

export const INITIAL_EVENT_UI: EventUiState = { selected: null };

export interface EventView {
  readonly title: string;
  readonly text: string;
  readonly prompt: string;
  readonly options: readonly { readonly index: number; readonly label: string; readonly description: string; readonly selected: boolean }[];
  readonly canConfirm: boolean;
  /** 選んだあとの結果（1行ずつ）。まだ選んでいなければ null */
  readonly result: readonly string[] | null;
  readonly team: readonly TeamMemberView[];
  readonly charms: readonly string[];
}

function outcomeLine(run: RunState, outcome: EventOutcome): string {
  switch (outcome.type) {
    case 'gamble':
      return outcome.success ? 'うまくいった！' : 'うまくいかなかった…';
    case 'hp': {
      const name = nameOf(run, outcome.member);
      if (outcome.delta === 0) {
        const full = outcome.hp >= run.team[outcome.member]!.fighter.stats.hp;
        return full ? `${name}の HPは 満タンだ` : `${name}の HPは これ以上減らない`;
      }
      return outcome.delta > 0 ? `${name}は HPを ${outcome.delta} 回復した` : `${name}は HPが ${-outcome.delta} 減った`;
    }
    case 'stat':
      return `${nameOf(run, outcome.member)}の ${BOOST_STAT_NAMES[outcome.stat]}が ${outcome.amount} 上がった`;
    case 'nothing':
      return '何も起きなかった';
  }
}

export function buildEventView(run: RunState, ui: EventUiState = INITIAL_EVENT_UI): EventView {
  const { phase } = run;
  if (phase.kind !== 'event') {
    throw new Error('いまはイベントの段階ではありません');
  }
  const event = getEvent(phase.event.id);
  const done = phase.outcome !== null;
  const chosen = done && phase.chosen !== undefined ? event.options[phase.chosen] : undefined;
  return {
    title: event.title,
    text: event.text,
    prompt: done ? `「${chosen?.label ?? ''}」を選んだ` : 'どうしますか？ 選んで「決定」を押してください',
    options: event.options.map((option, index) => ({
      index,
      label: option.label,
      description: option.description,
      selected: index === ui.selected,
    })),
    canConfirm: ui.selected !== null,
    result: phase.outcome === null ? null : phase.outcome.map((outcome) => outcomeLine(run, outcome)),
    team: teamViews(run.team),
    charms: charmNames(run),
  };
}
