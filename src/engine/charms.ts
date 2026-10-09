/**
 * お守りの効果（4.4）。お守りはチーム全体にかかる常時効果で、バトルでは陣営ごとに持つ。
 * 効果の種類ごとの意味は types.ts の CharmEffect を参照。
 */
import { getEffectiveness } from './affinity';
import { BIG_MOVE_COOLDOWN_TURNS } from './constants';
import { activeOf, isFainted, withActive, type Sides } from './team';
import type { AttackMoveDef, BattleEvent, CharmEffect, Combatant, Side, StatusId } from './types';

/** 割合（percent）の合計。当てはまる効果がなければ 0 */
function sumPercent(charms: readonly CharmEffect[], applies: (charm: CharmEffect) => number): number {
  return charms.reduce((sum, charm) => sum + applies(charm), 0);
}

/** HPが最大HPの percent % 以下か */
function hpAtMost(combatant: Combatant, percent: number): boolean {
  return combatant.hp * 100 <= combatant.stats.hp * percent;
}

/**
 * お守りを反映した技の威力（切り捨て）。user は技を使うキャラ（HPで効くお守りに使う。省くとHPの条件は見ない）。
 * 当てはまるお守りの割合を足してから、威力に掛ける（例：先制技+20% と 紅の技+15% なら、紅の先制技は +35%）
 */
export function movePower(move: AttackMoveDef, charms: readonly CharmEffect[] = [], user?: Combatant): number {
  const percent = sumPercent(charms, (charm) => {
    switch (charm.type) {
      case 'movePower':
        return charm.moveKind === move.kind ? charm.percent : 0;
      case 'attributePower':
        return charm.attribute === move.attribute ? charm.percent : 0;
      case 'lowHpPower':
        return user !== undefined && hpAtMost(user, charm.hpPercent) ? charm.percent : 0;
      default:
        return 0;
    }
  });
  return Math.floor((move.power * (100 + percent)) / 100);
}

/** 受けるダメージを減らす割合（受ける側の陣営のお守り）。100 を超えない */
export function damageCutPercent(move: AttackMoveDef, defender: Combatant, charms: readonly CharmEffect[] = []): number {
  const percent = sumPercent(charms, (charm) => {
    if (charm.type !== 'damageCut') {
      return 0;
    }
    if (charm.against === 'advantage') {
      return getEffectiveness(move.attribute, defender.attribute) === 'advantage' ? charm.percent : 0;
    }
    return charm.against === move.kind ? charm.percent : 0;
  });
  return Math.min(100, percent);
}

/** その状態異常を、お守りで防げるか */
export function guardsStatus(charms: readonly CharmEffect[] = [], status: StatusId): boolean {
  return charms.some((charm) => charm.type === 'statusGuard' && charm.status === status);
}

/** 回復技の回復量（最大HPの percent % を、お守りの分だけ増やす。切り捨て、最低1） */
export function healAmount(maxHp: number, percent: number, charms: readonly CharmEffect[] = []): number {
  const bonus = sumPercent(charms, (charm) => (charm.type === 'healPower' ? charm.percent : 0));
  return Math.max(1, Math.floor((maxHp * percent * (100 + bonus)) / 10000));
}

/** 大技を使ったあとの、使えないターン数（お守りで減る。0 より小さくならない） */
export function bigMoveCooldown(charms: readonly CharmEffect[] = []): number {
  const cut = charms.reduce((sum, charm) => (charm.type === 'cooldownCut' ? sum + charm.turns : sum), 0);
  return Math.max(0, BIG_MOVE_COOLDOWN_TURNS - cut);
}

/** （ラン）戦闘に勝ったあとに回復する割合。お守りがなければ 0 */
export function victoryHealPercent(charms: readonly CharmEffect[]): number {
  return sumPercent(charms, (charm) => (charm.type === 'victoryHeal' ? charm.percent : 0));
}

/** （ラン）休憩で回復する割合に、お守りで足す分。お守りがなければ 0 */
export function restHealBonus(charms: readonly CharmEffect[]): number {
  return sumPercent(charms, (charm) => (charm.type === 'restHeal' ? charm.percent : 0));
}

/** 場のキャラのHPを、お守りの効果で回復する。HPが満タンか、倒れていれば何もしない（イベントも出さない） */
function healActiveByCharm(sides: Sides, side: Side, percent: number): { sides: Sides; events: BattleEvent[] } {
  const active = activeOf(sides[side]);
  if (percent === 0 || isFainted(active) || active.hp >= active.stats.hp) {
    return { sides, events: [] };
  }
  const amount = Math.min(healAmount(active.stats.hp, percent), active.stats.hp - active.hp);
  const hp = active.hp + amount;
  return {
    sides: withActive(sides, side, { ...active, hp }),
    events: [{ type: 'healed', side, amount, hp, source: 'charm' }],
  };
}

/** 交代で場に出たキャラに、お守りの回復をかける */
export function healOnSwitchIn(sides: Sides, side: Side): { sides: Sides; events: BattleEvent[] } {
  const charms = sides[side].charms ?? [];
  return healActiveByCharm(sides, side, sumPercent(charms, (charm) => (charm.type === 'switchInHeal' ? charm.percent : 0)));
}

/** ターンの終わりに、場のキャラにお守りの回復をかける */
export function healOnTurnEnd(sides: Sides, side: Side): { sides: Sides; events: BattleEvent[] } {
  const charms = sides[side].charms ?? [];
  return healActiveByCharm(sides, side, sumPercent(charms, (charm) => (charm.type === 'turnEndHeal' ? charm.percent : 0)));
}
