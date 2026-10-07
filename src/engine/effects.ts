import { clampStage } from './stats';
import { activeOf, opponentOf, withActive, type Sides } from './team';
import type { BattleEvent, Side, SupportMoveDef } from './types';

/** 補助技を使った結果 */
export interface EffectResult {
  readonly sides: Sides;
  readonly events: readonly BattleEvent[];
}

/** 最大HPの percent %（切り捨て、最低1） */
export function percentOfMaxHp(maxHp: number, percent: number): number {
  return Math.max(1, Math.floor((maxHp * percent) / 100));
}

/**
 * 補助技の効果を順番に適用する（3.6）。
 * 能力変化は上下3段階で止まり、回復は最大HPを超えない。
 */
export function applySupportMove(sides: Sides, side: Side, move: SupportMoveDef): EffectResult {
  let current = sides;
  const events: BattleEvent[] = [];

  for (const effect of move.effects) {
    switch (effect.type) {
      case 'stat': {
        const targetSide = effect.target === 'self' ? side : opponentOf(side);
        const target = activeOf(current[targetSide]);
        const before = target.stages[effect.stat];
        const after = clampStage(before + effect.stages);
        current = withActive(current, targetSide, {
          ...target,
          stages: { ...target.stages, [effect.stat]: after },
        });
        events.push({ type: 'statChanged', side: targetSide, stat: effect.stat, delta: after - before, stage: after });
        break;
      }
      case 'heal': {
        const user = activeOf(current[side]);
        const amount = Math.min(percentOfMaxHp(user.stats.hp, effect.percent), user.stats.hp - user.hp);
        const hp = user.hp + amount;
        current = withActive(current, side, { ...user, hp });
        events.push({ type: 'healed', side, amount, hp });
        break;
      }
    }
  }

  return { sides: current, events };
}
