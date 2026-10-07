import { BIG_MOVE_COOLDOWN_TURNS, MAX_MOVES, MAX_TEAM_SIZE, SIDES } from './constants';
import { computeDamage, rollDamagePercent } from './damage';
import { findMove, isMoveSelectable } from './moves';
import { decideActionOrder } from './order';
import type { RngState } from './rng';
import { activeOf, isFainted, isWiped, switchTargets, withMember } from './team';
import type {
  BattleEvent,
  BattleState,
  Combatant,
  Command,
  Commands,
  FighterDef,
  MoveDef,
  Replacements,
  Side,
  SideState,
} from './types';

type Sides = BattleState['sides'];

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

/** 相手の陣営 */
export function opponentOf(side: Side): Side {
  return side === 'player' ? 'enemy' : 'player';
}

/** キャラの定義から、戦闘に出した状態を作る */
export function createCombatant(def: FighterDef): Combatant {
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
  return {
    id: def.id,
    attribute: def.attribute,
    stats: def.stats,
    moves: def.moves,
    hp: def.stats.hp,
    stages: NO_STAGES,
    cooldowns: {},
  };
}

function createSide(team: readonly FighterDef[]): SideState {
  if (team.length === 0 || team.length > MAX_TEAM_SIZE) {
    throw new Error(`チームは 1〜${MAX_TEAM_SIZE} 体にしてください（いま ${team.length} 体）`);
  }
  return { team: team.map(createCombatant), active: 0 };
}

/** バトルを始める。チームは 1〜3 体で、先頭のキャラから場に出る */
export function createBattle(player: readonly FighterDef[], enemy: readonly FighterDef[]): BattleState {
  return {
    turn: 1,
    sides: { player: createSide(player), enemy: createSide(enemy) },
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

function withSide(sides: Sides, side: Side, sideState: SideState): Sides {
  return { ...sides, [side]: sideState };
}

/** 場のキャラを差し替える */
function withActive(sides: Sides, side: Side, combatant: Combatant): Sides {
  const sideState = sides[side];
  return withSide(sides, side, withMember(sideState, sideState.active, combatant));
}

/** 場のキャラを入れ替える。引っ込めたキャラの能力変化はリセットし、状態異常と大技の使用不可ターンは残す（3.9） */
function switchActive(sides: Sides, side: Side, to: number): Sides {
  const sideState = sides[side];
  const outgoing = activeOf(sideState);
  const reset = withMember(sideState, sideState.active, { ...outgoing, stages: NO_STAGES });
  return withSide(sides, side, { ...reset, active: to });
}

/** 技を使ったあとの状態。大技なら使用不可ターンを設定する */
function afterMoveUsed(user: Combatant, move: MoveDef): Combatant {
  if (move.kind !== 'big') {
    return user;
  }
  // このターンの終了処理で 1 減り、ちょうど「次から使えないターン数」になる
  return { ...user, cooldowns: { ...user.cooldowns, [move.id]: BIG_MOVE_COOLDOWN_TURNS + 1 } };
}

/** ターン終了時に、使用不可ターンの残りを1減らす。0 になった技は一覧から外す */
function tickCooldowns(combatant: Combatant): Combatant {
  const entries = Object.entries(combatant.cooldowns);
  if (entries.length === 0) {
    return combatant;
  }
  const cooldowns: Record<string, number> = {};
  for (const [moveId, remaining] of entries) {
    if (remaining > 1) {
      cooldowns[moveId] = remaining - 1;
    }
  }
  return { ...combatant, cooldowns };
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
      continue;
    }

    const targetSide = opponentOf(side);
    const target = activeOf(sides[targetSide]);
    const move = findMove(user, command.moveId);
    events.push({ type: 'moveUsed', side, moveId: move.id, moveKind: move.kind });

    const roll = rollDamagePercent(currentRng);
    currentRng = roll.rng;
    const damage = computeDamage(user, target, move, roll.value);
    const hp = Math.max(0, target.hp - damage.amount);

    sides = withActive(sides, side, afterMoveUsed(user, move));
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

  // 4. ターン終了処理：場のキャラだけ、大技の使用不可ターンの残りを1減らす（控えは止まる）
  for (const side of SIDES) {
    sides = withActive(sides, side, tickCooldowns(activeOf(sides[side])));
  }

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
  }

  return { state: { ...state, sides, awaitingReplacement: [] }, events };
}
