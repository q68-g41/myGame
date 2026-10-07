/**
 * シード付き乱数（mulberry32）。
 * 状態は 32bit の整数1つで、関数は「いまの状態 → 値と次の状態」を返すだけ。
 * 同じシードからは必ず同じ並びになり、状態をそのまま保存・再開できる。
 */

/** 乱数の状態（32bit の符号なし整数） */
export type RngState = number;

/** 乱数を1回引いた結果 */
export interface RngResult<T> {
  readonly value: T;
  readonly rng: RngState;
}

/** シードから乱数の状態を作る */
export function createRng(seed: number): RngState {
  return seed >>> 0;
}

/** 0 以上 1 未満の小数を引く */
export function nextFloat(rng: RngState): RngResult<number> {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: next };
}

/** min 以上 max 以下の整数を引く */
export function nextInt(rng: RngState, min: number, max: number): RngResult<number> {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError(`nextInt の範囲が不正です: ${min}〜${max}`);
  }
  const { value, rng: next } = nextFloat(rng);
  return { value: min + Math.floor(value * (max - min + 1)), rng: next };
}
