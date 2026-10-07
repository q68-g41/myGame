/**
 * 技のデータ（仮）。M2 の自動対戦用で、名前も数値も M5 で作り直す前提。
 * 威力の目安（仕様書 3.6）：通常の技 50〜70、大技 90〜110、先制技 30〜40
 */
import type { AttackMoveDef, AttributeId, MoveDef, SupportMoveDef } from '../engine/types';

/** 画面に出す名前つきの技 */
export type MoveData = MoveDef & { readonly name: string };

function strike(attribute: AttributeId, name: string): AttackMoveDef & { name: string } {
  return { id: `${attribute}-strike`, name, attribute, kind: 'normal', power: 60 };
}

function burst(attribute: AttributeId, name: string): AttackMoveDef & { name: string } {
  return { id: `${attribute}-burst`, name, attribute, kind: 'big', power: 100 };
}

function support(id: string, name: string, attribute: AttributeId, effects: SupportMoveDef['effects']): MoveData {
  return { id, name, attribute, kind: 'support', effects };
}

const LIST: readonly MoveData[] = [
  strike('crimson', '紅撃'),
  strike('orange', '橙撃'),
  strike('yellow', '黄撃'),
  strike('green', '翠撃'),
  strike('blue', '蒼撃'),
  strike('violet', '紫撃'),
  burst('crimson', '紅の大技'),
  burst('orange', '橙の大技'),
  burst('yellow', '黄の大技'),
  burst('green', '翠の大技'),
  burst('blue', '蒼の大技'),
  burst('violet', '紫の大技'),
  { id: 'quick-jab', name: '先手突き', attribute: 'crimson', kind: 'priority', power: 35 },
  { id: 'quick-dart', name: '先手撃ち', attribute: 'yellow', kind: 'priority', power: 35 },
  support('focus', '集中', 'crimson', [{ type: 'stat', target: 'self', stat: 'attack', stages: 2 }]),
  support('brace', '構え', 'orange', [{ type: 'stat', target: 'self', stat: 'defense', stages: 2 }]),
  support('break', '崩し', 'blue', [{ type: 'stat', target: 'opponent', stat: 'defense', stages: -1 }]),
  support('mend', '手当て', 'orange', [{ type: 'heal', percent: 30 }]),
  support('corrode', '蝕み', 'violet', [{ type: 'status', status: 'erosion' }]),
  support('hinder', '足止め', 'green', [{ type: 'status', status: 'slow' }]),
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
