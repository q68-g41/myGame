import { BIG_MOVE_COOLDOWN_TURNS, MAX_MOVES, SIDES } from './constants';
import { computeDamage, rollDamagePercent } from './damage';
import { findMove, isMoveSelectable } from './moves';
import { decideActionOrder } from './order';
import type { RngState } from './rng';
import type {
  BattleEvent,
  BattleState,
  Combatant,
  Command,
  Commands,
  FighterDef,
  MoveDef,
  Side,
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
    stages: { attack: 0, defense: 0, speed: 0 },
    cooldowns: {},
  };
}

/** 1対1のバトルを始める */
export function createBattle(player: FighterDef, enemy: FighterDef): BattleState {
  return {
    turn: 1,
    sides: { player: createCombatant(player), enemy: createCombatant(enemy) },
    winner: null,
  };
}

function assertSelectable(combatant: Combatant, command: Command): void {
  findMove(combatant, command.moveId);
  if (!isMoveSelectable(combatant, command.moveId)) {
    throw new Error(`${combatant.id} の技 ${command.moveId} はまだ使えません`);
  }
}

function withCombatant(sides: Sides, side: Side, combatant: Combatant): Sides {
  return { ...sides, [side]: combatant };
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
 * 1ターンを処理する（3.10）。
 * (いまの状態, 双方のコマンド, 乱数) → 次の状態 + イベントログ + 次の乱数の状態。
 * 引数の状態は書き換えない。同じ引数なら必ず同じ結果になる。
 */
export function resolveTurn(state: BattleState, commands: Commands, rng: RngState): TurnResult {
  // 1. 双方のコマンドを確定する
  if (state.winner !== null) {
    throw new Error('このバトルはすでに決着しています');
  }
  for (const side of SIDES) {
    assertSelectable(state.sides[side], commands[side]);
  }

  // 2. 交代（M2 で追加する）

  // 3. 技を行動順に実行する。順番が来たときに倒れていたら行動しない
  const events: BattleEvent[] = [];
  const order = decideActionOrder(state, commands, rng);
  let currentRng = order.rng;
  let sides = state.sides;

  for (const side of order.value) {
    const user = sides[side];
    if (user.hp <= 0) {
      continue;
    }
    const targetSide = opponentOf(side);
    const target = sides[targetSide];
    const move = findMove(user, commands[side].moveId);
    events.push({ type: 'moveUsed', side, moveId: move.id, moveKind: move.kind });

    const roll = rollDamagePercent(currentRng);
    currentRng = roll.rng;
    const damage = computeDamage(user, target, move, roll.value);
    const hp = Math.max(0, target.hp - damage.amount);

    sides = withCombatant(sides, side, afterMoveUsed(user, move));
    sides = withCombatant(sides, targetSide, { ...target, hp });
    events.push({
      type: 'damage',
      side: targetSide,
      amount: damage.amount,
      hp,
      effectiveness: damage.effectiveness,
      resonance: damage.resonance,
    });
    if (hp === 0) {
      events.push({ type: 'fainted', side: targetSide });
    }
  }

  // 4. ターン終了処理：大技の使用不可ターンの残りを1減らす（侵蝕・状態異常は M2 で追加する）
  sides = { player: tickCooldowns(sides.player), enemy: tickCooldowns(sides.enemy) };

  // 5. 勝敗を決める。1対1なので、倒れた側がいればその相手の勝ち
  //    （M1 ではターン終了時のダメージが無いため、両方が同時に倒れることはない）
  const loser = SIDES.find((side) => sides[side].hp <= 0);
  const winner = loser === undefined ? null : opponentOf(loser);
  if (winner !== null) {
    events.push({ type: 'battleEnd', winner });
  }

  return {
    state: { turn: state.turn + 1, sides, winner },
    events,
    rng: currentRng,
  };
}
