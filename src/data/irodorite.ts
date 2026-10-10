/**
 * 彩り手（主人公）のデータ（仕様書 4.6）。ランの最初に1人選ぶ。
 * あだ名・口ぐせ・特性は仮。仕様書の表の18人がそろっている（ライバルのクロは選べないので、ここには入れない）。
 * 特性は、今のお守りの効果のどれかを、ふつうのお守り1個より少し強くしたもの。名前は絵の持ち物から付ける。
 */
import type { IrodoriteDef } from '../engine/run';
import type { CharmEffect } from '../engine/types';
import { describeCharmEffect, type CharmData } from './charms';
import { getFighter } from './fighters';

/** 画面に出すあだ名・口ぐせと、名前と説明つきの特性を持つ彩り手 */
export type IrodoriteData = IrodoriteDef & {
  /** あだ名（ゲームの中の名前） */
  readonly name: string;
  /** 口ぐせ：バトルの始まりに、ログに1行出す */
  readonly catchphrase: string;
  readonly trait: CharmData;
};

function irodorite(
  id: string,
  name: string,
  catchphrase: string,
  trait: { readonly name: string; readonly effect: CharmEffect },
): IrodoriteData {
  return {
    id,
    name,
    catchphrase,
    partner: getFighter(`${id}-partner`),
    trait: { id: `${id}-trait`, name: trait.name, effect: trait.effect, description: describeCharmEffect(trait.effect) },
  };
}

/** 選べる彩り手（仕様書 4.6 の表の順。18人） */
export const IRODORITE: readonly IrodoriteData[] = [
  // 紅のお守り（+15%）より少し強い
  irodorite('hina', 'ヒナ', '宣伝！！！', {
    name: '宣伝の旗',
    effect: { type: 'attributePower', attribute: 'crimson', percent: 20 },
  }),
  // 養生のお守り（+50%）より少し強い。淹れたての一杯でひと息つかせる
  irodorite('master', 'マスター', '今回の豆は、これです', {
    name: 'ドリップポット',
    effect: { type: 'healPower', percent: 75 },
  }),
  // 堅守のお守り（-10%）より少し強い。金槌で打ち固めた守り
  irodorite('dai', 'ダイ', 'すぐ直します！', {
    name: '金槌',
    effect: { type: 'damageCut', against: 'big', percent: 15 },
  }),
  // 橙のお守り（+15%）より少し強い
  irodorite('sunny', 'サニー', '昨日より高度を上げれたかしら', {
    name: '茜の折り鶴',
    effect: { type: 'attributePower', attribute: 'orange', percent: 20 },
  }),
  // 湯治のお守り（+20%）より少し強い。休憩で食パンを分け合う
  irodorite('morie', 'モリエ', 'やってみる！', {
    name: '焼きたての食パン',
    effect: { type: 'restHeal', percent: 30 },
  }),
  // 背水のお守り（+25%）より少し強い。苦しいときほど前向きに考える
  irodorite('taisho', '大将', 'ポジティブに考えると…', {
    name: '豆菓子の袋',
    effect: { type: 'lowHpPower', hpPercent: 30, percent: 35 },
  }),
  // 入れ替えのお守り（5%）より少し強い。あわてて交代しても、びわでひと息つく
  irodorite('miu', 'ミウ', 'あわわわ', {
    name: 'びわのかご',
    effect: { type: 'switchInHeal', percent: 7 },
  }),
  // 受け流しのお守り（-10%）より少し強い。遠眼鏡で、相手の得意な技を先に見ておく
  irodorite('wata', 'ワタ', '道具は、使う人の器を映す鏡', {
    name: '遠眼鏡',
    effect: { type: 'damageCut', against: 'advantage', percent: 15 },
  }),
  // 黄のお守り（+15%）より少し強い
  irodorite('shu', 'シュウ', 'このヒリつき…好きだな', {
    name: '稲妻の扇子',
    effect: { type: 'attributePower', attribute: 'yellow', percent: 20 },
  }),
  // 鍛錬のお守り（+7%）より少し強い。コン助が冴えていると、いつもの技も冴える
  irodorite('maru', 'マル', '今日もコン助が冴えている。', {
    name: '狐のお面',
    effect: { type: 'movePower', moveKind: 'normal', percent: 10 },
  }),
  // 先手のお守り（+20%）より少し強い。すぐに届ける
  irodorite('otakara', 'オタカラ', 'すぐ納品できます〜', {
    name: '宝袋',
    effect: { type: 'movePower', moveKind: 'priority', percent: 30 },
  }),
  // 息吹のお守り（3%）より少し強い。キノコのかごから少しずつ元気を出す
  irodorite('yuhi', 'ユヒ', 'ユヒは信じないです', {
    name: 'キノコのかご',
    effect: { type: 'turnEndHeal', percent: 4 },
  }),
  // 翠のお守り（+15%）より少し強い
  irodorite('kasa', 'カサ', '想像できることは、実現できる', {
    name: '竹とんぼ',
    effect: { type: 'attributePower', attribute: 'green', percent: 20 },
  }),
  // 蒼のお守り（+15%）より少し強い
  irodorite('taka', 'タカ先生', 'ここからはスーパー雑談です', {
    name: '分厚い書物',
    effect: { type: 'attributePower', attribute: 'blue', percent: 20 },
  }),
  // 凱旋のお守り（10%）より少し強い。勝ったら大盛りの丼
  irodorite('kai', 'カイ', 'きたー！！', {
    name: '大盛りの丼',
    effect: { type: 'victoryHeal', percent: 15 },
  }),
  // 渾身のお守り（+15%）より少し強い。幻灯機で大きく映し出す
  irodorite('rin', 'リン', 'やりてぇ', {
    name: '幻灯機',
    effect: { type: 'movePower', moveKind: 'big', percent: 20 },
  }),
  // 紫のお守り（+15%）より少し強い
  irodorite('tatsumichi', 'タツミチ', 'くすみに挑む男……', {
    name: '香炉',
    effect: { type: 'attributePower', attribute: 'violet', percent: 20 },
  }),
  // 凱旋のお守り（10%）より少し強い。戦いのあとの段取りがいい
  irodorite('sou', 'ソウ', 'すみません、僕の方でやりますね！', {
    name: '段取りの帳面',
    effect: { type: 'victoryHeal', percent: 15 },
  }),
];

const IRODORITE_BY_ID: ReadonlyMap<string, IrodoriteData> = new Map(IRODORITE.map((data) => [data.id, data]));

/** ID から彩り手を取り出す。なければエラー */
export function getIrodorite(id: string): IrodoriteData {
  const data = IRODORITE_BY_ID.get(id);
  if (!data) {
    throw new Error(`彩り手 ${id} のデータがありません`);
  }
  return data;
}
