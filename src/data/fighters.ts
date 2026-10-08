/**
 * キャラ（彩霊）のデータ。属性ごとに2体で、全部で12体。
 * 名前は和風の世界観での仮置き（仕様書 8）。ID は名前と切り離してあり、名前を変えても ID は変えない
 * （はじめの6体の ID が `〜-trial` なのは、M2 の仮キャラの ID をそのまま使っているため）。
 * 能力値の目安（仕様書 3.2）：HP 80〜120、攻撃・防御・素早さ 30〜70
 */
import type { AttributeId, FighterDef, Stats } from '../engine/types';
import { getMove } from './moves';

/** 画面に出す名前つきのキャラ */
export type FighterData = FighterDef & { readonly name: string };

function fighter(
  id: string,
  attribute: AttributeId,
  name: string,
  stats: Stats,
  moveIds: readonly string[],
): FighterData {
  return { id, name, attribute, stats, moves: moveIds.map(getMove) };
}

/** キャラの一覧（スタートの候補・スカウト・ふつうの相手に出る） */
export const FIGHTERS: readonly FighterData[] = [
  // 1体目：属性ごとの基本のキャラ
  fighter('crimson-trial', 'crimson', 'ベニギツネ', { hp: 95, attack: 65, defense: 45, speed: 60 }, [
    'crimson-strike',
    'crimson-burst',
    'quick-jab',
    'focus',
  ]),
  fighter('orange-trial', 'orange', 'ユウヒダヌキ', { hp: 115, attack: 55, defense: 60, speed: 40 }, [
    'orange-strike',
    'orange-burst',
    'green-strike',
    'mend',
  ]),
  fighter('yellow-trial', 'yellow', 'イナホイタチ', { hp: 85, attack: 60, defense: 40, speed: 70 }, [
    'yellow-strike',
    'yellow-burst',
    'quick-dart',
    'hinder',
  ]),
  fighter('green-trial', 'green', 'ヨモギガエル', { hp: 110, attack: 55, defense: 60, speed: 50 }, [
    'green-strike',
    'green-burst',
    'blue-strike',
    'corrode',
  ]),
  fighter('blue-trial', 'blue', 'シズクサギ', { hp: 100, attack: 55, defense: 65, speed: 45 }, [
    'blue-strike',
    'blue-burst',
    'crimson-strike',
    'break',
  ]),
  fighter('violet-trial', 'violet', 'フジチョウ', { hp: 90, attack: 70, defense: 45, speed: 55 }, [
    'violet-strike',
    'violet-burst',
    'yellow-strike',
    'brace',
  ]),
  // 2体目：1体目と役割を変えたキャラ
  fighter('crimson-guard', 'crimson', 'ベニコウラ', { hp: 120, attack: 50, defense: 65, speed: 30 }, [
    'crimson-heavy',
    'crimson-burst',
    'kindle',
    'green-strike',
  ]),
  fighter('orange-raider', 'orange', 'カキザル', { hp: 100, attack: 65, defense: 50, speed: 55 }, [
    'orange-heavy',
    'orange-quick',
    'yellow-strike',
    'brace',
  ]),
  fighter('yellow-trickster', 'yellow', 'ナノハナバチ', { hp: 90, attack: 55, defense: 50, speed: 60 }, [
    'yellow-heavy',
    'yellow-burst',
    'violet-strike',
    'dazzle',
  ]),
  fighter('green-charger', 'green', 'タケジカ', { hp: 100, attack: 65, defense: 50, speed: 55 }, [
    'green-heavy',
    'green-quick',
    'crimson-strike',
    'sprout',
  ]),
  fighter('blue-skirmisher', 'blue', 'アオシャチ', { hp: 95, attack: 60, defense: 50, speed: 60 }, [
    'blue-heavy',
    'blue-quick',
    'orange-strike',
    'stillwater',
  ]),
  fighter('violet-warden', 'violet', 'スミレヘビ', { hp: 105, attack: 60, defense: 60, speed: 50 }, [
    'violet-heavy',
    'violet-quick',
    'corrode',
    'haze',
  ]),
];

/**
 * ボスのキャラ。エリアごとに1体で、スタートの候補・スカウト・ふつうの相手には出ない。
 * 1体で3体のチームと戦うので、能力は目安（3.2）より大きい。行動パターンは bosses.ts
 */
export const BOSS_FIGHTERS: readonly FighterData[] = [
  fighter('crimson-boss', 'crimson', 'くすみ大猿', { hp: 320, attack: 65, defense: 50, speed: 55 }, [
    'crimson-strike',
    'crimson-burst',
    'quick-jab',
    'focus',
  ]),
  fighter('blue-boss', 'blue', 'くすみ大鯉', { hp: 290, attack: 62, defense: 65, speed: 45 }, [
    'blue-strike',
    'blue-burst',
    'corrode',
    'mend',
  ]),
  fighter('violet-boss', 'violet', 'くすみの主', { hp: 360, attack: 78, defense: 65, speed: 65 }, [
    'violet-strike',
    'violet-burst',
    'quick-dart',
    'hinder',
  ]),
];

const FIGHTER_BY_ID: ReadonlyMap<string, FighterData> = new Map(
  [...FIGHTERS, ...BOSS_FIGHTERS].map((data) => [data.id, data]),
);

/** ID からキャラ（ボスも含む）を取り出す。なければエラー */
export function getFighter(id: string): FighterData {
  const data = FIGHTER_BY_ID.get(id);
  if (!data) {
    throw new Error(`キャラ ${id} のデータがありません`);
  }
  return data;
}
