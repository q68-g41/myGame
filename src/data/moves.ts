/**
 * 技のデータ。属性ごとに6つ（通常の技・強い通常の技・大技・先制技・補助技2つ）で、全部で36個。
 * 名前は和風の世界観での仮置き（仕様書 8）。ID は名前と切り離してあり、名前を変えても ID は変えない。
 * 威力の目安（仕様書 3.6）：通常の技 50〜70、大技 90〜110、先制技 30〜40
 */
import type { AttackMoveDef, AttributeId, MoveDef, SupportMoveDef } from '../engine/types';

/** 画面に出す名前つきの技 */
export type MoveData = MoveDef & { readonly name: string };

/** 通常の技（キャラがはじめから覚えている基本の技） */
function strike(attribute: AttributeId, name: string): AttackMoveDef & { name: string } {
  return { id: `${attribute}-strike`, name, attribute, kind: 'normal', power: 60 };
}

/** 強い通常の技（主に報酬で覚える） */
function heavy(attribute: AttributeId, name: string): AttackMoveDef & { name: string } {
  return { id: `${attribute}-heavy`, name, attribute, kind: 'normal', power: 70 };
}

function burst(attribute: AttributeId, name: string): AttackMoveDef & { name: string } {
  return { id: `${attribute}-burst`, name, attribute, kind: 'big', power: 100 };
}

function quick(id: string, attribute: AttributeId, name: string): AttackMoveDef & { name: string } {
  return { id, name, attribute, kind: 'priority', power: 35 };
}

function support(id: string, name: string, attribute: AttributeId, effects: SupportMoveDef['effects']): MoveData {
  return { id, name, attribute, kind: 'support', effects };
}

const LIST: readonly MoveData[] = [
  // 紅
  strike('crimson', '緋の爪'),
  heavy('crimson', '焔突き'),
  burst('crimson', '紅炎落とし'),
  quick('quick-jab', 'crimson', '火花突き'),
  support('focus', '闘志', 'crimson', [{ type: 'stat', target: 'self', stat: 'attack', stages: 2 }]),
  support('kindle', '火照り', 'crimson', [
    { type: 'stat', target: 'self', stat: 'attack', stages: 1 },
    { type: 'stat', target: 'self', stat: 'speed', stages: 1 },
  ]),
  // 橙
  strike('orange', '土くれ打ち'),
  heavy('orange', '夕日の槌'),
  burst('orange', '大地返し'),
  quick('orange-quick', 'orange', '小石はじき'),
  support('brace', '構え', 'orange', [{ type: 'stat', target: 'self', stat: 'defense', stages: 2 }]),
  support('mend', '手当て', 'orange', [{ type: 'heal', percent: 30 }]),
  // 黄
  strike('yellow', '稲光打ち'),
  heavy('yellow', '黄金突き'),
  burst('yellow', '鳴神'),
  quick('quick-dart', 'yellow', '閃き'),
  support('quicken', '早駆け', 'yellow', [{ type: 'stat', target: 'self', stat: 'speed', stages: 2 }]),
  support('dazzle', '目くらまし', 'yellow', [{ type: 'stat', target: 'opponent', stat: 'attack', stages: -1 }]),
  // 翠
  strike('green', '笹打ち'),
  heavy('green', '青竹突き'),
  burst('green', '翠嵐'),
  quick('green-quick', 'green', 'つむじ風'),
  support('hinder', '足止め', 'green', [{ type: 'status', status: 'slow' }]),
  support('sprout', '芽吹き', 'green', [
    { type: 'heal', percent: 20 },
    { type: 'stat', target: 'self', stat: 'defense', stages: 1 },
  ]),
  // 蒼
  strike('blue', '蒼波'),
  heavy('blue', '水鏡打ち'),
  burst('blue', '大瀑布'),
  quick('blue-quick', 'blue', '雫はじき'),
  support('break', '崩し', 'blue', [{ type: 'stat', target: 'opponent', stat: 'defense', stages: -1 }]),
  support('stillwater', '静水', 'blue', [
    { type: 'stat', target: 'self', stat: 'defense', stages: 1 },
    { type: 'stat', target: 'opponent', stat: 'speed', stages: -1 },
  ]),
  // 紫
  strike('violet', '宵の一撃'),
  heavy('violet', '夜叉払い'),
  burst('violet', '百鬼夜行'),
  quick('violet-quick', 'violet', '夜駆け'),
  support('corrode', '蝕み', 'violet', [{ type: 'status', status: 'erosion' }]),
  support('haze', '朧', 'violet', [
    { type: 'stat', target: 'self', stat: 'defense', stages: 1 },
    { type: 'stat', target: 'opponent', stat: 'attack', stages: -1 },
  ]),
];

/** 技 ID → 技 */
export const MOVES: Readonly<Record<string, MoveData>> = Object.fromEntries(LIST.map((move) => [move.id, move]));

/** ID から技を取り出す。なければエラー */
export function getMove(id: string): MoveData {
  const move = MOVES[id];
  if (!move) {
    throw new Error(`技 ${id} のデータがありません`);
  }
  return move;
}
