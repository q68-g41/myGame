import { EROSION_DAMAGE_PERCENT, SIDES } from './constants';
import { percentOfMaxHp } from './effects';
import { compareSpeeds, orderSides } from './order';
import type { RngState } from './rng';
import { effectiveSpeed } from './stats';
import { activeOf, isFainted, withActive, type Sides } from './team';
import type { BattleEvent, Combatant, Side } from './types';

/** ターン終了処理の結果 */
export interface TurnEndResult {
  readonly sides: Sides;
  readonly events: readonly BattleEvent[];
  readonly rng: RngState;
  /** この処理で倒れた陣営（倒れた順） */
  readonly fainted: readonly Side[];
}

/** 使用不可ターンの残りを1減らす。0 になった技は一覧から外す */
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

/** 状態異常の残りを1減らす。0 になったら治る */
function tickStatus(combatant: Combatant): Combatant {
  const { status } = combatant;
  if (status === null) {
    return combatant;
  }
  return { ...combatant, status: status.remaining > 1 ? { ...status, remaining: status.remaining - 1 } : null };
}

/** 侵蝕のダメージを受ける陣営を、素早さ順に並べる。両方なら比べ、同じならシード付き乱数で決める */
function erosionOrder(sides: Sides, rng: RngState): { order: readonly Side[]; rng: RngState } {
  const eroded = SIDES.filter((side) => {
    const active = activeOf(sides[side]);
    return !isFainted(active) && active.status?.id === 'erosion';
  });
  if (eroded.length < 2) {
    return { order: eroded, rng };
  }
  const diff = compareSpeeds(effectiveSpeed(activeOf(sides.player)), effectiveSpeed(activeOf(sides.enemy)));
  const decided = orderSides(diff, rng);
  return { order: decided.value, rng: decided.rng };
}

/**
 * ターン終了処理（3.10 の 4）。場にいて倒れていないキャラだけに行う（控えは止まる）。
 * 1. 侵蝕のダメージ（最大HPの10%、切り捨て、最低1）を素早さ順に1体ずつ
 * 2. 状態異常と大技の使用不可ターンの残りを1減らす
 */
export function processTurnEnd(sides: Sides, rng: RngState): TurnEndResult {
  let current = sides;
  const events: BattleEvent[] = [];
  const fainted: Side[] = [];

  const erosion = erosionOrder(current, rng);
  for (const side of erosion.order) {
    const active = activeOf(current[side]);
    const amount = percentOfMaxHp(active.stats.hp, EROSION_DAMAGE_PERCENT);
    const hp = Math.max(0, active.hp - amount);
    current = withActive(current, side, { ...active, hp });
    events.push({ type: 'statusDamage', side, status: 'erosion', amount, hp });
    if (hp === 0) {
      events.push({ type: 'fainted', side, index: current[side].active });
      fainted.push(side);
    }
  }

  for (const side of SIDES) {
    const active = activeOf(current[side]);
    if (isFainted(active)) {
      continue;
    }
    const ticked = tickStatus(tickCooldowns(active));
    current = withActive(current, side, ticked);
    if (active.status !== null && ticked.status === null) {
      events.push({ type: 'statusEnded', side, status: active.status.id });
    }
  }

  return { sides: current, events, rng: erosion.rng, fainted };
}
