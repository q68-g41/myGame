/**
 * キャラの成長（報酬・休憩・イベントで共通に使う）：能力強化、技を覚える、技の威力を上げる。
 * どれも新しいオブジェクトを返し、引数は書き換えない。
 */
import { MAX_MOVES, STAT_BOOST_PERCENT } from './constants';
import { isAttackMove } from './moves';
import type { RunMember, RunState } from './run';
import type { FighterDef, MoveDef, Stats } from './types';

/** 能力強化で上げられる能力 */
export type StatBoostKey = keyof Stats;

/** 能力強化の対象になる能力の一覧 */
export const STAT_BOOST_KEYS: readonly StatBoostKey[] = ['hp', 'attack', 'defense', 'speed'];

/** 能力強化で上がる量（いまの値の STAT_BOOST_PERCENT %、四捨五入、最低1） */
export function statBoostAmount(value: number): number {
  return Math.max(1, Math.round((value * STAT_BOOST_PERCENT) / 100));
}

/** 能力を上げたキャラ。HPを上げたときは、いまのHPも同じだけ増える */
export function boostStat(member: RunMember, stat: StatBoostKey, amount: number): RunMember {
  const { fighter } = member;
  return {
    fighter: { ...fighter, stats: { ...fighter.stats, [stat]: fighter.stats[stat] + amount } },
    hp: stat === 'hp' ? member.hp + amount : member.hp,
  };
}

/** そのキャラがまだ覚えていない技か */
export function canLearn(fighter: FighterDef, move: MoveDef): boolean {
  return !fighter.moves.some((known) => known.id === move.id);
}

/** 技を覚えさせたキャラ。4つ覚えていれば forget の技と入れ替える */
export function learnMove(fighter: FighterDef, move: MoveDef, forget: number | undefined): FighterDef {
  if (!canLearn(fighter, move)) {
    throw new Error(`${fighter.id} は ${move.id} をもう覚えています`);
  }
  let moves: readonly MoveDef[];
  if (fighter.moves.length < MAX_MOVES) {
    if (forget !== undefined) {
      throw new Error('技の枠が空いているので、忘れる技は選べません');
    }
    moves = [...fighter.moves, move];
  } else {
    if (forget === undefined || fighter.moves[forget] === undefined) {
      throw new Error(`技が ${MAX_MOVES} つ埋まっているので、忘れる技を選んでください`);
    }
    moves = fighter.moves.with(forget, move);
  }
  // 大技が使えない間に、選べる技がなくならないようにする（3.6）
  if (moves.every((known) => known.kind === 'big')) {
    throw new Error('大技以外の技を1つ以上残してください');
  }
  return { ...fighter, moves };
}

/** 攻撃技の威力を上げたキャラ。補助技は選べない */
export function powerUpMove(fighter: FighterDef, index: number, amount: number): FighterDef {
  const move = fighter.moves[index];
  if (!move) {
    throw new Error(`${fighter.id} の ${index} 番目の技はありません`);
  }
  if (!isAttackMove(move)) {
    throw new Error(`補助技 ${move.id} は強化できません`);
  }
  return { ...fighter, moves: fighter.moves.with(index, { ...move, power: move.power + amount }) };
}

/** チームの1体を取り出す。いなければエラー */
export function memberOf(run: RunState, index: number | undefined): RunMember {
  const member = index === undefined ? undefined : run.team[index];
  if (!member) {
    throw new Error(`チームの ${index} 番目のキャラはいません`);
  }
  return member;
}
