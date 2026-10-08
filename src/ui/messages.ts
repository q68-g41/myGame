/**
 * イベントをログの文章にする（表示だけ。ルールは書かない）。
 */
import { getFighter } from '../data/fighters';
import { STAT_NAMES, STATUS_NAMES } from '../data/labels';
import { getMove } from '../data/moves';
import { memberAt } from '../engine/team';
import type { BattleEvent, BattleState, Side } from '../engine/types';

/** チーム内の位置にいるキャラの表示名 */
export function memberName(state: BattleState, side: Side, index: number): string {
  return getFighter(memberAt(state.sides[side], index).id).name;
}

/** ログを作るときの、いま場に出ているキャラの位置 */
type Actives = Record<Side, number>;

/** 文章の主語。相手のキャラには「相手の」を付ける */
function who(state: BattleState, actives: Actives, side: Side, index = actives[side]): string {
  const name = memberName(state, side, index);
  return side === 'enemy' ? `相手の${name}` : name;
}

const EFFECTIVENESS_NOTE = { advantage: '（有利！）', neutral: '', disadvantage: '（不利…）' } as const;

/** イベント1つを、ログ1行の文章にする */
function describeEvent(event: BattleEvent, state: BattleState, actives: Actives): string {
  const subject = (side: Side) => who(state, actives, side);
  switch (event.type) {
    case 'moveUsed':
      return `${subject(event.side)}の ${getMove(event.moveId).name}！`;
    case 'damage':
      return `${subject(event.side)}に ${event.amount} のダメージ${EFFECTIVENESS_NOTE[event.effectiveness]}`;
    case 'statChanged': {
      const stat = STAT_NAMES[event.stat];
      if (event.delta === 0) {
        return `${subject(event.side)}の ${stat}は これ以上変わらない`;
      }
      return `${subject(event.side)}の ${stat}が ${event.delta > 0 ? '上がった' : '下がった'}`;
    }
    case 'healed':
      if (event.source === 'charm') {
        return `${subject(event.side)}は お守りで HPを ${event.amount} 回復した`;
      }
      return event.amount === 0
        ? `${subject(event.side)}の HPは 満タンだ`
        : `${subject(event.side)}は HPを ${event.amount} 回復した`;
    case 'statusApplied':
      return `${subject(event.side)}は ${STATUS_NAMES[event.status]}を受けた`;
    case 'statusBlocked':
      return `${subject(event.side)}には 効かなかった`;
    case 'statusDamage':
      return `${subject(event.side)}は ${STATUS_NAMES[event.status]}で ${event.amount} のダメージ`;
    case 'statusEnded':
      return `${subject(event.side)}の ${STATUS_NAMES[event.status]}が 治った`;
    case 'switched': {
      const owner = event.side === 'player' ? 'あなた' : '相手';
      const incoming = memberName(state, event.side, event.to);
      return event.reason === 'command'
        ? `${owner}は ${memberName(state, event.side, event.from)}を戻して ${incoming}を出した`
        : `${owner}は ${incoming}を出した`;
    }
    case 'fainted':
      return `${who(state, actives, event.side, event.index)}は 倒れた`;
    case 'battleEnd':
      return event.winner === 'player' ? 'あなたの勝ち！' : 'あなたの負け…';
  }
}

/**
 * イベントを順番に、ログの文章にする。
 * before はイベントが起きる前の状態。交代のイベントのたびに場のキャラを入れ替えながら名前を引く。
 */
export function describeEvents(events: readonly BattleEvent[], before: BattleState): string[] {
  const actives: Actives = { player: before.sides.player.active, enemy: before.sides.enemy.active };
  return events.map((event) => {
    const text = describeEvent(event, before, actives);
    if (event.type === 'switched') {
      actives[event.side] = event.to;
    }
    return text;
  });
}
