import type { Combatant, MoveDef } from './types';

/** キャラが覚えている技を ID で探す。覚えていなければエラー */
export function findMove(combatant: Combatant, moveId: string): MoveDef {
  const move = combatant.moves.find((candidate) => candidate.id === moveId);
  if (!move) {
    throw new Error(`${combatant.id} は技 ${moveId} を覚えていません`);
  }
  return move;
}
