/**
 * ライバル・クロのデータ（仕様書 4.6）。クロは選べない彩り手で、エリア2のボスの手前で必ず1回戦う。
 * あだ名・口ぐせ・チームの決め方は仮。相棒はカラスウサギ2体（白のシラハウサギ・黒のクロハウサギ）
 */
import type { RivalDef } from '../engine/run';
import { getFighter } from './fighters';

/** 画面に出すあだ名と口ぐせを持つライバル */
export type RivalData = RivalDef & {
  readonly name: string;
  /** 口ぐせ：クロとのバトルの始まりに、ログに1行出す */
  readonly catchphrase: string;
};

export const RIVAL: RivalData = {
  id: 'kuro',
  name: 'クロ',
  catchphrase: '結局ちょっとずつチマチマ',
  partners: [getFighter('white-twin'), getFighter('black-twin')],
  // ふつうのキャラから1体（ランダム）足して、3体のチームにする
  extraCount: 1,
};
