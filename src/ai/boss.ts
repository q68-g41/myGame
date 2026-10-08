/**
 * ボスの行動（仕様書 6：決まった行動パターン＋条件分岐）。
 * パターンはデータ（src/data/bosses.ts）で決め、ここではそれを読んで技を選ぶだけにする。
 */
import { isMoveSelectable, selectableMoves } from '../engine/moves';
import { activeCombatant, opponentOf } from '../engine/team';
import type { BattleState, BossCondition, BossPattern, Combatant, Command, Side } from '../engine/types';

function holds(condition: BossCondition, state: BattleState, self: Combatant, opponent: Combatant): boolean {
  switch (condition.type) {
    case 'selfHpBelow':
      return self.hp * 100 < self.stats.hp * condition.percent;
    case 'turnEvery':
      return state.turn % condition.every === 0;
    case 'opponentHasNoStatus':
      return opponent.status === null;
    case 'selfStageBelow':
      return self.stages[condition.stat] < condition.stage;
  }
}

/**
 * ボスのコマンド。条件分岐を上から順に見て、条件がすべて当てはまり、その技が使えるなら使う。
 * どれも当てはまらなければ、ターン番号に合わせて rotation の技を使う（使えなければ次の技）。
 * それも使えなければ、選べる技の先頭
 */
export function chooseBossCommand(state: BattleState, side: Side, pattern: BossPattern): Command {
  const self = activeCombatant(state, side);
  const opponent = activeCombatant(state, opponentOf(side));
  for (const rule of pattern.rules) {
    if (rule.when.every((condition) => holds(condition, state, self, opponent)) && isMoveSelectable(self, rule.use)) {
      return { type: 'move', moveId: rule.use };
    }
  }
  const { rotation } = pattern;
  for (let offset = 0; offset < rotation.length; offset += 1) {
    const moveId = rotation[(state.turn - 1 + offset) % rotation.length]!;
    if (isMoveSelectable(self, moveId)) {
      return { type: 'move', moveId };
    }
  }
  const fallback = selectableMoves(self)[0];
  if (!fallback) {
    throw new Error(`${self.id} に選べる技がありません`);
  }
  return { type: 'move', moveId: fallback.id };
}
