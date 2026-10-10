/**
 * 彩り手を選ぶ画面（仕様書 4.6・5）に出す内容を組み立てる（DOM は使わない）。
 * 「はじめから」のあと、チーム選択の前に出す。まだランは始まっていないので、彩り手の一覧から作る。
 */
import { ATTRIBUTE_COLORS } from '../data/attributes';
import type { IrodoriteData } from '../data/irodorite';
import { fighterDetail, type FighterDetailView } from './runView';
import { irodoriteUrl } from './sprites';

/** 彩り手を選ぶ画面で、画面だけが持つ状態 */
export interface IrodoriteUiState {
  /** 選んでいる彩り手の位置（一覧の中） */
  readonly selected: number;
}

/** はじめは一覧の1人目を選んでおく（上半分が空にならないように） */
export const INITIAL_IRODORITE_UI: IrodoriteUiState = { selected: 0 };

/** 一覧のボタン */
export interface IrodoriteChoiceView {
  readonly index: number;
  readonly name: string;
  /** 彩り手の絵（64×64）の URL。絵がなければ null */
  readonly portrait: string | null;
  /** 相棒の属性の色（枠の色に使う） */
  readonly color: string;
  readonly selected: boolean;
}

/** 選んでいる彩り手の詳細 */
export interface IrodoriteDetailView {
  readonly name: string;
  readonly portrait: string | null;
  readonly color: string;
  /** 例：「宣伝！！！」（かぎかっこは画面で付ける） */
  readonly catchphrase: string;
  /** 特性の名前。例：「宣伝の旗」 */
  readonly traitName: string;
  /** 特性の効果。例：「紅属性の技の威力 +20%」 */
  readonly traitDescription: string;
  /** 相棒の詳細（説明・能力・技） */
  readonly partner: FighterDetailView;
}

export interface IrodoriteSelectView {
  readonly choices: readonly IrodoriteChoiceView[];
  readonly detail: IrodoriteDetailView;
}

/** 一覧のボタンをタップしたあとの状態 */
export function selectIrodorite(ui: IrodoriteUiState, index: number): IrodoriteUiState {
  return { ...ui, selected: index };
}

export function buildIrodoriteSelectView(
  list: readonly IrodoriteData[],
  ui: IrodoriteUiState = INITIAL_IRODORITE_UI,
): IrodoriteSelectView {
  const chosen = list[ui.selected];
  if (!chosen) {
    throw new Error(`彩り手の ${ui.selected} 番目はいません`);
  }
  return {
    choices: list.map((data, index) => ({
      index,
      name: data.name,
      portrait: irodoriteUrl(data.id),
      color: ATTRIBUTE_COLORS[data.partner.attribute],
      selected: index === ui.selected,
    })),
    detail: {
      name: chosen.name,
      portrait: irodoriteUrl(chosen.id),
      color: ATTRIBUTE_COLORS[chosen.partner.attribute],
      catchphrase: chosen.catchphrase,
      traitName: chosen.trait.name,
      traitDescription: chosen.trait.description,
      partner: fighterDetail(chosen.partner),
    },
  };
}
