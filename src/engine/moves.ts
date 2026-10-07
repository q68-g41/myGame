import type { Combatant, MoveDef } from './types';

/** キャラが覚えている技を ID で探す。覚えていなければエラー */
export function findMove(combatant: Combatant, moveId: string): MoveDef {
  const move = combatant.moves.find((candidate) => candidate.id === moveId);
  if (!move) {
    throw new Error(`${combatant.id} は技 ${moveId} を覚えていません`);
  }
  return move;
}

/** その技をいま選べるか（大技の使用不可ターン中は選べない） */
export function isMoveSelectable(combatant: Combatant, moveId: string): boolean {
  return (combatant.cooldowns[moveId] ?? 0) <= 0;
}

/** いま選べる技の一覧 */
export function selectableMoves(combatant: Combatant): readonly MoveDef[] {
  return combatant.moves.filter((move) => isMoveSelectable(combatant, move.id));
}
