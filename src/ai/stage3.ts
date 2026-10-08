/**
 * CPU 段階3（仕様書 6：エリア3と強敵）。
 * プレイヤーの交代や先制技を予想し、2手先までの損得で選ぶ。
 *
 * 自分のコマンドの候補（技・交代）と、プレイヤーのコマンドの候補（技・交代）のすべての組み合わせについて、
 * 1ターンをエンジンで計算する（1手目）。そのあとの状態を、HPの差と「次の撃ち合いの見込み」で点数にする（2手目）。
 * プレイヤーは、こちらにとって一番困る返し方をしてくることもあるので、最悪の場合と平均をまぜて比べる。
 * 乱数は固定のものを使い、本当の乱数（このあと出るダメージ）は見ない。
 */
import { resolveTurn, submitReplacements } from '../engine/battle';
import { DAMAGE_ROLL_MIN_PERCENT, MAX_STAGE } from '../engine/constants';
import { computeDamage } from '../engine/damage';
import { createRng } from '../engine/rng';
import { isAttackMove, selectableMoves } from '../engine/moves';
import { activeCombatant, opponentOf, switchTargets } from '../engine/team';
import type {
  BattleState,
  CharmEffect,
  Combatant,
  Command,
  Commands,
  MoveDef,
  Replacements,
  Side,
} from '../engine/types';
import { chooseReplacementStage2, matchup } from './stage2';

/** 見積もりに使う乱数（本当の乱数は使わない） */
const LOOKAHEAD_SEED = 0;

/** 決着したときの点数（HPの差より十分大きくする） */
const DECIDED_SCORE = 100;

/** 次の撃ち合いの見込みにかける重み（HPの差に対して） */
const MATCHUP_WEIGHT = 0.5;

/** 倒れたキャラ1体ぶんの減点（HPの割合とは別に。倒すことを後回しにしないため） */
const FAINT_PENALTY = 0.5;

/** 最悪の場合にかける重み（残りは平均）。自動対戦で比べて、最悪の場合だけで考えるのが一番強かった */
const WORST_CASE_WEIGHT = 1;

/**
 * 使っても何も起きない補助技か（HPが満タンでの回復、上限まで変わった能力の変化、すでに状態異常の相手への状態異常）。
 * 「何もしない」は最悪の場合でも損をしない手に見えて、くり返すと勝負がつかなくなるので、段階3は選ばない
 */
function isWasted(move: MoveDef, self: Combatant, opponent: Combatant): boolean {
  if (move.kind !== 'support') {
    return false;
  }
  return move.effects.every((effect) => {
    switch (effect.type) {
      case 'heal':
        return self.hp >= self.stats.hp;
      case 'stat': {
        const target = effect.target === 'self' ? self : opponent;
        const stage = target.stages[effect.stat];
        return effect.stages > 0 ? stage >= MAX_STAGE : stage <= -MAX_STAGE;
      }
      case 'status':
        return opponent.status !== null;
    }
  });
}

/** いま選べる攻撃技のどれかで、相手の場のキャラを確実に（乱数が一番低くても）倒せるか */
function canSurelyFaint(self: Combatant, opponent: Combatant, charms: readonly CharmEffect[]): boolean {
  return selectableMoves(self)
    .filter(isAttackMove)
    .some((move) => computeDamage(self, opponent, move, DAMAGE_ROLL_MIN_PERCENT, charms).amount >= opponent.hp);
}

/**
 * その陣営が、いま選べるコマンドの一覧（技と交代）。使っても何も起きない補助技は外す（全部外れるときは外さない）。
 * 相手の場のキャラを確実に倒せるときも、補助技は外す。1手先までしか読まないので、倒したあとに出てくる控えとの撃ち合いを
 * 嫌って、倒さずに回復をくり返し、勝負がつかなくなることがあるため
 */
export function commandOptions(state: BattleState, side: Side): readonly Command[] {
  const self = activeCombatant(state, side);
  const opponent = activeCombatant(state, opponentOf(side));
  const selectable = selectableMoves(self);
  const finishing = canSurelyFaint(self, opponent, state.sides[side].charms ?? []);
  const useful = selectable.filter(
    (move) => !isWasted(move, self, opponent) && !(finishing && move.kind === 'support'),
  );
  const moves = (useful.length > 0 ? useful : selectable).map((move): Command => ({ type: 'move', moveId: move.id }));
  const switches = switchTargets(state.sides[side]).map((to): Command => ({ type: 'switch', to }));
  return [...moves, ...switches];
}

/** チームの残りHPの割合の合計から、倒れたキャラの数ぶんを引いたもの */
function teamHealth(state: BattleState, side: Side): number {
  return state.sides[side].team.reduce(
    (sum, member) => sum + member.hp / member.stats.hp - (member.hp <= 0 ? FAINT_PENALTY : 0),
    0,
  );
}

/** 倒れて控えを選ぶ必要があれば、両陣営とも段階2の考え方で出しておく（見積もり用） */
function settleReplacements(state: BattleState): BattleState {
  if (state.awaitingReplacement.length === 0) {
    return state;
  }
  const replacements: Partial<Record<Side, number>> = {};
  for (const side of state.awaitingReplacement) {
    replacements[side] = chooseReplacementStage2(state, side);
  }
  return submitReplacements(state, replacements as Replacements).state;
}

/** 状態の点数（side から見て）。HPの差に、次の撃ち合いの見込みを足す */
export function evaluateState(state: BattleState, side: Side): number {
  if (state.winner !== null) {
    return state.winner === side ? DECIDED_SCORE : -DECIDED_SCORE;
  }
  const settled = settleReplacements(state);
  const opponent = opponentOf(side);
  const health = teamHealth(settled, side) - teamHealth(settled, opponent);
  const next = matchup(
    activeCombatant(settled, side),
    activeCombatant(settled, opponent),
    settled.sides[side].charms ?? [],
    settled.sides[opponent].charms ?? [],
  );
  return health + MATCHUP_WEIGHT * next;
}

/** 自分のコマンドの点数：プレイヤーの返し方ごとに1ターン計算し、最悪の場合と平均をまぜる */
function scoreCommand(state: BattleState, side: Side, command: Command, replies: readonly Command[]): number {
  const opponent = opponentOf(side);
  const scores = replies.map((reply) => {
    const commands = { [side]: command, [opponent]: reply } as Commands;
    const result = resolveTurn(state, commands, createRng(LOOKAHEAD_SEED));
    return evaluateState(result.state, side);
  });
  const worst = Math.min(...scores);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return WORST_CASE_WEIGHT * worst + (1 - WORST_CASE_WEIGHT) * average;
}

/** 段階3のコマンド。点数が同じなら、候補の並び順（技が先、交代が後）で先のもの */
export function chooseCommandStage3(state: BattleState, side: Side): Command {
  const options = commandOptions(state, side);
  const replies = commandOptions(state, opponentOf(side));
  let best: { command: Command; score: number } | null = null;
  for (const command of options) {
    const score = scoreCommand(state, side, command, replies);
    if (best === null || score > best.score) {
      best = { command, score };
    }
  }
  if (best === null) {
    throw new Error(`${side} に選べるコマンドがありません`);
  }
  return best.command;
}
