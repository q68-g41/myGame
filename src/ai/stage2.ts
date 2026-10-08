/**
 * CPU 段階2（仕様書 6：エリア2）。
 * 不利な相手なら控えと交代する。HPが少なければ補助技（回復）も検討する。それ以外は段階1と同じく、予想ダメージが最大の技を選ぶ。
 *
 * 「不利」は、いまの対面でお互いに一番ダメージの出る技を撃ち合ったとき（予想ダメージ・素早さ順）に負ける、と見積もること。
 * 交代すると、出たキャラが相手の攻撃を1回受けてから撃ち合いになるので、それでも勝てる控えがいるときだけ交代する。
 */
import { compareSpeeds } from '../engine/order';
import { effectiveSpeed } from '../engine/stats';
import { isMoveSelectable } from '../engine/moves';
import { activeCombatant, memberAt, opponentOf, switchTargets } from '../engine/team';
import { percentOfMaxHp } from '../engine/effects';
import type { BattleState, CharmEffect, Combatant, Command, Side } from '../engine/types';
import { bestAttack, chooseCommandStage1 } from './cpu';

/** 撃ち合いの見込みに使う、1ターンの予想ダメージ（攻撃技がなければ 0） */
function damagePerTurn(attacker: Combatant, defender: Combatant, charms: readonly CharmEffect[]): number {
  return bestAttack(attacker, defender, charms)?.damage ?? 0;
}

/**
 * 1対1で撃ち合ったときの見込み（自分から見た値）。
 * 勝つなら、勝ったときに残る自分のHPの割合（0より大きく1以下）。負けるなら、相手に残るHPの割合をマイナスにしたもの。
 */
export function duelValue(
  self: { readonly hp: number; readonly maxHp: number; readonly damage: number },
  opponent: { readonly hp: number; readonly maxHp: number; readonly damage: number },
  selfFirst: boolean,
): number {
  const myTurns = self.damage > 0 ? Math.ceil(opponent.hp / self.damage) : Number.POSITIVE_INFINITY;
  const theirTurns = opponent.damage > 0 ? Math.ceil(self.hp / opponent.damage) : Number.POSITIVE_INFINITY;
  if (myTurns === Number.POSITIVE_INFINITY && theirTurns === Number.POSITIVE_INFINITY) {
    return 0;
  }
  const iWin = myTurns < theirTurns || (myTurns === theirTurns && selfFirst);
  if (iWin) {
    const hitsTaken = selfFirst ? myTurns - 1 : myTurns;
    return Math.max(0, self.hp - hitsTaken * opponent.damage) / self.maxHp;
  }
  const hitsDealt = selfFirst ? theirTurns : theirTurns - 1;
  return -Math.max(0, opponent.hp - hitsDealt * self.damage) / opponent.maxHp;
}

/** 対面の見込み。selfHp を省くと、いまのHPで考える */
export function matchup(
  self: Combatant,
  opponent: Combatant,
  charms: readonly CharmEffect[],
  opponentCharms: readonly CharmEffect[],
  selfHp: number = self.hp,
): number {
  const selfFirst = compareSpeeds(effectiveSpeed(self), effectiveSpeed(opponent)) > 0;
  return duelValue(
    { hp: selfHp, maxHp: self.stats.hp, damage: damagePerTurn(self, opponent, charms) },
    { hp: opponent.hp, maxHp: opponent.stats.hp, damage: damagePerTurn(opponent, self, opponentCharms) },
    selfFirst,
  );
}

/** いま選べる回復技と、その回復量。なければ null */
function healMove(self: Combatant): { id: string; amount: number } | null {
  for (const move of self.moves) {
    if (move.kind !== 'support' || !isMoveSelectable(self, move.id)) {
      continue;
    }
    const percent = move.effects.reduce((sum, effect) => (effect.type === 'heal' ? sum + effect.percent : sum), 0);
    if (percent > 0) {
      return { id: move.id, amount: percentOfMaxHp(self.stats.hp, percent) };
    }
  }
  return null;
}

/** 段階2のコマンド */
export function chooseCommandStage2(state: BattleState, side: Side): Command {
  const sideState = state.sides[side];
  const self = activeCombatant(state, side);
  const opponent = activeCombatant(state, opponentOf(side));
  const charms = sideState.charms ?? [];
  const opponentCharms = state.sides[opponentOf(side)].charms ?? [];

  const current = matchup(self, opponent, charms, opponentCharms);
  if (current >= 0) {
    // 撃ち合いで勝てるなら、段階1と同じく一番ダメージの出る技
    return chooseCommandStage1(state, side);
  }

  // 1. 不利なら、相手の攻撃を1回受けても撃ち合いに勝てる控えのうち、一番よいものと交代する
  let target: { index: number; value: number } | null = null;
  for (const index of switchTargets(sideState)) {
    const member = memberAt(sideState, index);
    const hpAfterHit = member.hp - damagePerTurn(opponent, member, opponentCharms);
    if (hpAfterHit <= 0) {
      continue;
    }
    const value = matchup(member, opponent, charms, opponentCharms, hpAfterHit);
    if (value > 0 && (target === null || value > target.value)) {
      target = { index, value };
    }
  }
  if (target !== null) {
    return { type: 'switch', to: target.index };
  }

  // 2. HPが少なくて、回復すれば撃ち合いに勝てるようになるなら、回復技を使う
  const heal = healMove(self);
  if (heal !== null && self.hp < self.stats.hp) {
    const hpAfterHeal = Math.min(self.stats.hp, self.hp + heal.amount) - damagePerTurn(opponent, self, opponentCharms);
    if (hpAfterHeal > 0 && matchup(self, opponent, charms, opponentCharms, hpAfterHeal) > 0) {
      return { type: 'move', moveId: heal.id };
    }
  }

  // 3. それ以外は段階1と同じ（少しでも削っておく）
  return chooseCommandStage1(state, side);
}

/** 段階2の、倒れたあとに控えから出すキャラ：撃ち合いの見込みが一番よい控え。同じならチームの並び順で先のもの */
export function chooseReplacementStage2(state: BattleState, side: Side): number {
  const sideState = state.sides[side];
  const opponent = activeCombatant(state, opponentOf(side));
  const charms = sideState.charms ?? [];
  const opponentCharms = state.sides[opponentOf(side)].charms ?? [];
  let best: { index: number; value: number } | null = null;
  for (const index of switchTargets(sideState)) {
    const value = matchup(memberAt(sideState, index), opponent, charms, opponentCharms);
    if (best === null || value > best.value) {
      best = { index, value };
    }
  }
  if (best === null) {
    throw new Error(`${side} に出せる控えがいません`);
  }
  return best.index;
}
