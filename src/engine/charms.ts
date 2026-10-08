/**
 * お守りの効果（4.4）。お守りはチーム全体にかかる常時効果で、バトルでは陣営ごとに持つ。
 */
import { percentOfMaxHp } from './effects';
import { activeOf, withActive, type Sides } from './team';
import type { AttackMoveDef, BattleEvent, CharmEffect, Side } from './types';

/** お守りを反映した技の威力（切り捨て） */
export function movePower(move: AttackMoveDef, charms: readonly CharmEffect[] = []): number {
  const percent = charms.reduce(
    (sum, charm) => (charm.type === 'movePower' && charm.moveKind === move.kind ? sum + charm.percent : sum),
    0,
  );
  return Math.floor((move.power * (100 + percent)) / 100);
}

/**
 * 交代で場に出たキャラに、お守りの回復をかける。
 * お守りがないか、HPが満タンなら何もしない（イベントも出さない）。
 */
export function healOnSwitchIn(sides: Sides, side: Side): { sides: Sides; events: BattleEvent[] } {
  const percent = (sides[side].charms ?? []).reduce(
    (sum, charm) => (charm.type === 'switchInHeal' ? sum + charm.percent : sum),
    0,
  );
  const incoming = activeOf(sides[side]);
  if (percent === 0 || incoming.hp >= incoming.stats.hp) {
    return { sides, events: [] };
  }
  const amount = Math.min(percentOfMaxHp(incoming.stats.hp, percent), incoming.stats.hp - incoming.hp);
  const hp = incoming.hp + amount;
  return {
    sides: withActive(sides, side, { ...incoming, hp }),
    events: [{ type: 'healed', side, amount, hp, source: 'charm' }],
  };
}
