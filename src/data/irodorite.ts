/**
 * 彩り手（主人公）のデータ（仕様書 4.6）。ランの最初に1人選ぶ。
 * あだ名・口ぐせ・特性は仮。相棒の絵とデータができた人から順に足す（ライバルのクロは選べないので、ここには入れない）。
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

/** 選べる彩り手（仕様書 4.6 の表の順。いまは相棒の属性の順にもなっている） */
export const IRODORITE: readonly IrodoriteData[] = [
  // 紅のお守り（+15%）より少し強い
  irodorite('hina', 'ヒナ', '宣伝！！！', {
    name: '宣伝の旗',
    effect: { type: 'attributePower', attribute: 'crimson', percent: 20 },
  }),
  // 湯治のお守り（+20%）より少し強い。休憩で食パンを分け合う
  irodorite('morie', 'モリエ', 'やってみる！', {
    name: '焼きたての食パン',
    effect: { type: 'restHeal', percent: 30 },
  }),
  // 受け流しのお守り（-10%）より少し強い。遠眼鏡で、相手の得意な技を先に見ておく
  irodorite('wata', 'ワタ', '道具は、使う人の器を映す鏡', {
    name: '遠眼鏡',
    effect: { type: 'damageCut', against: 'advantage', percent: 15 },
  }),
  // 息吹のお守り（3%）より少し強い。キノコのかごから少しずつ元気を出す
  irodorite('yuhi', 'ユヒ', 'ユヒは信じないです', {
    name: 'キノコのかご',
    effect: { type: 'turnEndHeal', percent: 4 },
  }),
  // 渾身のお守り（+15%）より少し強い。幻灯機で大きく映し出す
  irodorite('rin', 'リン', 'やりてぇ', {
    name: '幻灯機',
    effect: { type: 'movePower', moveKind: 'big', percent: 20 },
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
