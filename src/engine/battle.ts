import { bigMoveCooldown, healOnSwitchIn } from './charms';
import { MAX_MOVES, MAX_TEAM_SIZE, SIDES } from './constants';
import { computeDamage, rollDamagePercent } from './damage';
import { applySupportMove } from './effects';
import { findMove, isAttackMove, isMoveSelectable } from './moves';
import { decideActionOrder } from './order';
import type { RngState } from './rng';
import { processTurnEnd } from './turnEnd';
import {
  activeOf,
  isFainted,
  isWiped,
  opponentOf,
  switchTargets,
  withActive,
  withMember,
  withSide,
  type Sides,
} from './team';
import type {
  AttackMoveDef,
  BattleEvent,
  BattleState,
  CharmEffect,
  Combatant,
  Command,
  Commands,
  FighterDef,
  Replacements,
  Side,
  SideState,
} from './types';

export { opponentOf };

/** 1ターン処理した結果 */
export interface TurnResult {
  readonly state: BattleState;
  /** このターンに起きたこと（画面はこれを順番に再生する） */
  readonly events: readonly BattleEvent[];
  /** 次のターンに渡す乱数の状態 */
  readonly rng: RngState;
}

/** 控えからキャラを出した結果 */
export interface ReplacementResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

const NO_STAGES = { attack: 0, defense: 0, speed: 0 } as const;

/** バトルを始めるときのオプション */
export interface BattleOptions {
  /** 自分のチームの、いまのHP（ランで持ち越したHP）。チームと同じ並び順。省くと全員満タンで始まる */
  readonly playerHp?: readonly number[];
  /** 自分の陣営にかかるお守りの効果。省くとなし */
  readonly playerCharms?: readonly CharmEffect[];
}

/** キャラの定義から、戦闘に出した状態を作る。hp を省くと満タンで出る */
export function createCombatant(def: FighterDef, hp: number = def.stats.hp): Combatant {
  if (def.moves.length === 0 || def.moves.length > MAX_MOVES) {
    throw new Error(`${def.id} の技の数は 1〜${MAX_MOVES} 個にしてください（いま ${def.moves.length} 個）`);
  }
  if (new Set(def.moves.map((move) => move.id)).size !== def.moves.length) {
    throw new Error(`${def.id} に同じ技が重複しています`);
  }
  // 大技が使えない間に、選べる技がなくならないようにする（3.6）
  if (def.moves.every((move) => move.kind === 'big')) {
    throw new Error(`${def.id} は大技以外の技を1つ以上覚えてください`);
  }
  for (const move of def.moves) {
    if (!isAttackMove(move) && move.effects.length === 0) {
      throw new Error(`補助技 ${move.id} に効果がありません`);
    }
  }
  if (!Number.isInteger(hp) || hp < 1 || hp > def.stats.hp) {
    throw new Error(`${def.id} のHPは 1〜${def.stats.hp} にしてください（いま ${hp}）`);
  }
  return {
    id: def.id,
    attribute: def.attribute,
    stats: def.stats,
    moves: def.moves,
    hp,
    stages: NO_STAGES,
    cooldowns: {},
    status: null,
  };
}

function createSide(team: readonly FighterDef[], hp?: readonly number[]): SideState {
  if (team.length === 0 || team.length > MAX_TEAM_SIZE) {
    throw new Error(`チームは 1〜${MAX_TEAM_SIZE} 体にしてください（いま ${team.length} 体）`);
  }
  if (hp !== undefined && hp.length !== team.length) {
    throw new Error(`HPの数（${hp.length}）がチームの人数（${team.length}）と合いません`);
  }
  return { team: team.map((def, index) => createCombatant(def, hp?.[index])), active: 0 };
}

/** バトルを始める。チームは 1〜3 体で、先頭のキャラから場に出る */
export function createBattle(
  player: readonly FighterDef[],
  enemy: readonly FighterDef[],
  options: BattleOptions = {},
): BattleState {
  const playerSide = createSide(player, options.playerHp);
  return {
    turn: 1,
    sides: {
      player: options.playerCharms === undefined ? playerSide : { ...playerSide, charms: options.playerCharms },
      enemy: createSide(enemy),
    },
    awaitingReplacement: [],
    winner: null,
  };
}

function assertCommandValid(side: SideState, command: Command): void {
  if (command.type === 'switch') {
    if (!switchTargets(side).includes(command.to)) {
      throw new Error(`チームの ${command.to} 番目とは交代できません`);
    }
    return;
  }
  const active = activeOf(side);
  findMove(active, command.moveId);
  if (!isMoveSelectable(active, command.moveId)) {
    throw new Error(`${active.id} の技 ${command.moveId} はまだ使えません`);
  }
}

/** 場のキャラを入れ替える。引っ込めたキャラの能力変化はリセットし、状態異常と大技の使用不可ターンは残す（3.9） */
function switchActive(sides: Sides, side: Side, to: number): Sides {
  const sideState = sides[side];
  const outgoing = activeOf(sideState);
  const reset = withMember(sideState, sideState.active, { ...outgoing, stages: NO_STAGES });
  return withSide(sides, side, { ...reset, active: to });
}

/** 技を使ったあとの状態。大技なら使用不可ターンを設定する（お守りで短くなる） */
function afterMoveUsed(user: Combatant, move: AttackMoveDef, charms: readonly CharmEffect[] = []): Combatant {
  const turns = bigMoveCooldown(charms);
  if (move.kind !== 'big' || turns === 0) {
    return user;
  }
  // このターンの終了処理で 1 減り、ちょうど「次から使えないターン数」になる
  return { ...user, cooldowns: { ...user.cooldowns, [move.id]: turns + 1 } };
}

/**
 * 決着を判定する（3.10 の 5）。
 * 全員倒れた陣営が1つならその相手の勝ち。両方なら、後に倒れた側の勝ち。
 */
function decideWinner(sides: Sides, faintOrder: readonly Side[]): Side | null {
  const wiped = SIDES.filter((side) => isWiped(sides[side]));
  if (wiped.length === 0) {
    return null;
  }
  if (wiped.length === 1) {
    return opponentOf(wiped[0]!);
  }
  const lastFainted = faintOrder.at(-1);
  if (lastFainted === undefined) {
    throw new Error('両方が全滅しているのに、倒れた記録がありません');
  }
  return lastFainted;
}

/**
 * 1ターンを処理する（3.10）。
 * (いまの状態, 双方のコマンド, 乱数) → 次の状態 + イベントログ + 次の乱数の状態。
 * 引数の状態は書き換えない。同じ引数なら必ず同じ結果になる。
 */
export function resolveTurn(state: BattleState, commands: Commands, rng: RngState): TurnResult {
  // 1. 双方のコマンドを確定する
  if (state.winner !== null) {
    throw new Error('このバトルはすでに決着しています');
  }
  if (state.awaitingReplacement.length > 0) {
    throw new Error('倒れたキャラの代わりを、先に控えから選んでください');
  }
  for (const side of SIDES) {
    assertCommandValid(state.sides[side], commands[side]);
  }

  const events: BattleEvent[] = [];
  const faintOrder: Side[] = [];
  const order = decideActionOrder(state, commands, rng);
  let currentRng = order.rng;
  let sides = state.sides;

  // 2・3. 交代と技を行動順に実行する（交代は行動順で先に来る）。順番が来たときに倒れていたら行動しない
  for (const side of order.value) {
    const sideState = sides[side];
    const user = activeOf(sideState);
    if (isFainted(user)) {
      continue;
    }
    const command = commands[side];

    if (command.type === 'switch') {
      sides = switchActive(sides, side, command.to);
      events.push({ type: 'switched', side, from: sideState.active, to: command.to, reason: 'command' });
      const healed = healOnSwitchIn(sides, side);
      sides = healed.sides;
      events.push(...healed.events);
      continue;
    }

    const move = findMove(user, command.moveId);
    events.push({ type: 'moveUsed', side, moveId: move.id, moveKind: move.kind });

    if (!isAttackMove(move)) {
      const applied = applySupportMove(sides, side, move);
      sides = applied.sides;
      events.push(...applied.events);
      continue;
    }

    const targetSide = opponentOf(side);
    const target = activeOf(sides[targetSide]);

    const roll = rollDamagePercent(currentRng);
    currentRng = roll.rng;
    const damage = computeDamage(user, target, move, roll.value, sides[side].charms, sides[targetSide].charms);
    const hp = Math.max(0, target.hp - damage.amount);

    sides = withActive(sides, side, afterMoveUsed(user, move, sides[side].charms));
    sides = withActive(sides, targetSide, { ...target, hp });
    events.push({
      type: 'damage',
      side: targetSide,
      amount: damage.amount,
      hp,
      effectiveness: damage.effectiveness,
      resonance: damage.resonance,
    });
    if (hp === 0) {
      events.push({ type: 'fainted', side: targetSide, index: sides[targetSide].active });
      faintOrder.push(targetSide);
    }
  }

  // 4. ターン終了処理：侵蝕のダメージ → 状態異常と大技の使用不可ターンの残りを1減らす（場のキャラだけ）
  const turnEnd = processTurnEnd(sides, currentRng);
  sides = turnEnd.sides;
  currentRng = turnEnd.rng;
  events.push(...turnEnd.events);
  faintOrder.push(...turnEnd.fainted);

  // 5. 倒れたキャラがいれば控えから選ぶ。控えがいなければ決着
  const winner = decideWinner(sides, faintOrder);
  if (winner !== null) {
    events.push({ type: 'battleEnd', winner });
  }
  const awaitingReplacement =
    winner === null ? SIDES.filter((side) => isFainted(activeOf(sides[side]))) : [];

  return {
    state: { turn: state.turn + 1, sides, awaitingReplacement, winner },
    events,
    rng: currentRng,
  };
}

/**
 * 倒れた場のキャラの代わりに、控えからキャラを出す（3.9：ターンを使わない）。
 * 選ぶ必要がある陣営（state.awaitingReplacement）すべての分を、まとめて渡す。
 */
export function submitReplacements(state: BattleState, replacements: Replacements): ReplacementResult {
  if (state.awaitingReplacement.length === 0) {
    throw new Error('控えから選ぶ必要はありません');
  }
  for (const side of SIDES) {
    const awaiting = state.awaitingReplacement.includes(side);
    const choice = replacements[side];
    if (awaiting && choice === undefined) {
      throw new Error(`${side} の控えから出すキャラを選んでください`);
    }
    if (!awaiting && choice !== undefined) {
      throw new Error(`${side} は控えから選ぶ必要がありません`);
    }
  }

  const events: BattleEvent[] = [];
  let sides = state.sides;
  for (const side of state.awaitingReplacement) {
    const sideState = sides[side];
    const to = replacements[side]!;
    if (!switchTargets(sideState).includes(to)) {
      throw new Error(`チームの ${to} 番目は出せません`);
    }
    sides = withSide(sides, side, { ...sideState, active: to });
    events.push({ type: 'switched', side, from: sideState.active, to, reason: 'replacement' });
    const healed = healOnSwitchIn(sides, side);
    sides = healed.sides;
    events.push(...healed.events);
  }

  return { state: { ...state, sides, awaitingReplacement: [] }, events };
}
