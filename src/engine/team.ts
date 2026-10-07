import type { BattleState, Combatant, Side, SideState } from './types';

/** 倒れているか */
export function isFainted(combatant: Combatant): boolean {
  return combatant.hp <= 0;
}

/** チーム内の位置からキャラを取り出す。範囲外ならエラー */
export function memberAt(side: SideState, index: number): Combatant {
  const member = side.team[index];
  if (!member) {
    throw new Error(`チームの ${index} 番目のキャラはいません`);
  }
  return member;
}

/** 陣営の、場に出ているキャラ */
export function activeOf(side: SideState): Combatant {
  return memberAt(side, side.active);
}

/** バトルの、ある陣営の場に出ているキャラ */
export function activeCombatant(state: BattleState, side: Side): Combatant {
  return activeOf(state.sides[side]);
}

/** 交代先に選べる位置（倒れておらず、場に出ていない控え） */
export function switchTargets(side: SideState): readonly number[] {
  return side.team.flatMap((member, index) => (index !== side.active && !isFainted(member) ? [index] : []));
}

/** チーム全員が倒れたか */
export function isWiped(side: SideState): boolean {
  return side.team.every(isFainted);
}

/** チームの1体を差し替えた陣営を返す */
export function withMember(side: SideState, index: number, combatant: Combatant): SideState {
  memberAt(side, index);
  return { ...side, team: side.team.with(index, combatant) };
}
