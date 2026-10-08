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

/** 32bit の乱数を1つ引く（別の乱数の列のシードにする） */
export function nextSeed(rng: RngState): RngResult<number> {
  return nextInt(rng, 0, 0xffffffff);
}

/** 候補から重ならないように count 個を選ぶ（選んだ順に並ぶ） */
export function pickDistinct<T>(items: readonly T[], count: number, rng: RngState): RngResult<readonly T[]> {
  if (!Number.isInteger(count) || count < 0 || count > items.length) {
    throw new RangeError(`${items.length} 個の候補から ${count} 個は選べません`);
  }
  const pool = [...items];
  const picked: T[] = [];
  let current = rng;
  for (let i = 0; i < count; i += 1) {
    const draw = nextInt(current, 0, pool.length - 1);
    current = draw.rng;
    picked.push(...pool.splice(draw.value, 1));
  }
  return { value: picked, rng: current };
}
