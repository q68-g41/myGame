/**
 * キャラのデータ（仮）。M2 の自動対戦用に、属性ごとに1体ずつ。M5 で本番のキャラに差し替える。
 * 能力値の目安（仕様書 3.2）：HP 80〜120、攻撃・防御・素早さ 30〜70
 */
import type { AttributeId, FighterDef, Stats } from '../engine/types';
import { getMove } from './moves';

/** 画面に出す名前つきのキャラ */
export type FighterData = FighterDef & { readonly name: string };

function fighter(
  attribute: AttributeId,
  name: string,
  stats: Stats,
  moveIds: readonly string[],
  id = `${attribute}-trial`,
): FighterData {
  return { id, name, attribute, stats, moves: moveIds.map(getMove) };
}

/** 仮のキャラ一覧 */
export const FIGHTERS: readonly FighterData[] = [
  fighter('crimson', '仮・紅', { hp: 95, attack: 65, defense: 45, speed: 60 }, [
    'crimson-strike',
    'crimson-burst',
    'quick-jab',
    'focus',
  ]),
  fighter('orange', '仮・橙', { hp: 115, attack: 55, defense: 60, speed: 40 }, [
    'orange-strike',
    'orange-burst',
    'green-strike',
    'mend',
  ]),
  fighter('yellow', '仮・黄', { hp: 85, attack: 60, defense: 40, speed: 70 }, [
    'yellow-strike',
    'yellow-burst',
    'quick-dart',
    'hinder',
  ]),
  fighter('green', '仮・翠', { hp: 105, attack: 50, defense: 55, speed: 50 }, [
    'green-strike',
    'green-burst',
    'blue-strike',
    'corrode',
  ]),
  fighter('blue', '仮・蒼', { hp: 100, attack: 55, defense: 65, speed: 45 }, [
    'blue-strike',
    'blue-burst',
    'crimson-strike',
    'break',
  ]),
  fighter('violet', '仮・紫', { hp: 90, attack: 70, defense: 40, speed: 55 }, [
    'violet-strike',
    'violet-burst',
    'yellow-strike',
    'brace',
  ]),
];

/**
 * ボスのキャラ（仮）。エリアごとに1体で、スタートの候補・スカウト・ふつうの相手には出ない。
 * 1体で3体のチームと戦うので、能力は目安（3.2）より大きい。行動パターンは bosses.ts
 */
export const BOSS_FIGHTERS: readonly FighterData[] = [
  fighter(
    'crimson',
    '仮・ボス1（紅）',
    { hp: 320, attack: 65, defense: 50, speed: 55 },
    ['crimson-strike', 'crimson-burst', 'quick-jab', 'focus'],
    'crimson-boss',
  ),
  fighter(
    'blue',
    '仮・ボス2（蒼）',
    { hp: 290, attack: 62, defense: 65, speed: 45 },
    ['blue-strike', 'blue-burst', 'corrode', 'mend'],
    'blue-boss',
  ),
  fighter(
    'violet',
    '仮・ボス3（紫）',
    { hp: 360, attack: 78, defense: 65, speed: 65 },
    ['violet-strike', 'violet-burst', 'quick-dart', 'hinder'],
    'violet-boss',
  ),
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
