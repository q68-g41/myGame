/**
 * ボスのデータ（仮）。エリアごとに1体（仕様書 4.2・6：決まった行動パターン＋条件分岐）。
 * 次の行動は画面で予告しない。名前と技は M5-5 で作り直す前提。
 */
import type { BossDef } from '../engine/run';
import { BOSS_FIGHTERS } from './fighters';

/** 画面やドキュメント用の、行動パターンの説明つきのボス */
export type BossData = BossDef & { readonly summary: string };

const [crimson, blue, violet] = BOSS_FIGHTERS as readonly [
  (typeof BOSS_FIGHTERS)[number],
  (typeof BOSS_FIGHTERS)[number],
  (typeof BOSS_FIGHTERS)[number],
];

/** エリアごとのボス（添字はエリア） */
export const BOSSES: readonly BossData[] = [
  {
    // エリア1：2回殴って大技。HPが半分を切ると力をため、大技を使えるときは必ず使う
    fighter: crimson,
    summary: '2回殴って大技。HPが半分を切ると攻撃を上げ、大技を使えるときは必ず使う',
    pattern: {
      fighterId: crimson.id,
      rules: [
        {
          when: [
            { type: 'selfHpBelow', percent: 50 },
            { type: 'selfStageBelow', stat: 'attack', stage: 2 },
          ],
          use: 'focus',
        },
        { when: [{ type: 'selfHpBelow', percent: 50 }], use: 'crimson-burst' },
      ],
      rotation: ['crimson-strike', 'crimson-strike', 'crimson-burst'],
    },
  },
  {
    // エリア2：相手に状態異常がなければ侵蝕をかける。HPが少なくなると回復する
    fighter: blue,
    summary: '状態異常のない相手には侵蝕をかける。HPが35%を切ると回復する',
    pattern: {
      fighterId: blue.id,
      rules: [
        { when: [{ type: 'opponentHasNoStatus' }], use: 'corrode' },
        { when: [{ type: 'selfHpBelow', percent: 35 }], use: 'mend' },
      ],
      rotation: ['blue-strike', 'blue-burst', 'blue-strike'],
    },
  },
  {
    // エリア3：3ターンごとに鈍化をかけ、先制技もまぜて攻める。HPが半分を切ると大技を使えるときは必ず使う
    fighter: violet,
    summary: '3ターンごとに鈍化をかける。先制技もまぜて攻め、HPが半分を切ると大技を使えるときは必ず使う',
    pattern: {
      fighterId: violet.id,
      rules: [
        { when: [{ type: 'turnEvery', every: 3 }, { type: 'opponentHasNoStatus' }], use: 'hinder' },
        { when: [{ type: 'selfHpBelow', percent: 50 }], use: 'violet-burst' },
      ],
      rotation: ['violet-strike', 'quick-dart', 'violet-burst'],
    },
  },
];
