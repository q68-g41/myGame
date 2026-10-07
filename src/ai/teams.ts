/**
 * 自動対戦のチーム決め（シード付き乱数で、重ならないように選ぶ）。
 */
import { nextInt, type RngResult, type RngState } from '../engine/rng';
import type { FighterDef, Side } from '../engine/types';

/** 自動対戦のチームの人数 */
export const TEAM_SIZE_FOR_SIM = 3;

/** 候補から重ならないように size 体ずつ、2チーム分を選ぶ */
export function pickTeams<T extends FighterDef>(
  candidates: readonly T[],
  size: number,
  rng: RngState,
): RngResult<Readonly<Record<Side, readonly T[]>>> {
  if (candidates.length < size * 2) {
    throw new Error(`候補が足りません（${size * 2} 体必要、いま ${candidates.length} 体）`);
  }
  const pool = [...candidates];
  const picked: T[] = [];
  let current = rng;
  for (let i = 0; i < size * 2; i += 1) {
    const draw = nextInt(current, 0, pool.length - 1);
    current = draw.rng;
    picked.push(...pool.splice(draw.value, 1));
  }
  return { value: { player: picked.slice(0, size), enemy: picked.slice(size) }, rng: current };
}
