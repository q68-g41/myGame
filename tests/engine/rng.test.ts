import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, nextSeed, pickDistinct, type RngState } from '../../src/engine/rng';

/** 乱数を count 回引いた値の並びを返す */
function drawFloats(seed: number, count: number): number[] {
  const values: number[] = [];
  let rng: RngState = createRng(seed);
  for (let i = 0; i < count; i += 1) {
    const result = nextFloat(rng);
    values.push(result.value);
    rng = result.rng;
  }
  return values;
}

describe('シード付き乱数', () => {
  it('同じシードなら同じ並びになる', () => {
    expect(drawFloats(42, 100)).toEqual(drawFloats(42, 100));
  });

  it('違うシードなら違う並びになる', () => {
    expect(drawFloats(1, 10)).not.toEqual(drawFloats(2, 10));
  });

  it('同じ状態から引くと同じ値になる（状態を書き換えない）', () => {
    const rng = createRng(7);
    expect(nextFloat(rng)).toEqual(nextFloat(rng));
  });

  it('途中の状態から再開しても、続きの並びが同じになる', () => {
    let rng = createRng(123);
    for (let i = 0; i < 5; i += 1) {
      rng = nextFloat(rng).rng;
    }
    const saved = rng;
    const resumed = nextFloat(saved).value;
    expect(resumed).toBe(drawFloats(123, 6)[5]);
  });

  it('小数は 0 以上 1 未満', () => {
    for (const value of drawFloats(99, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('シード 0 や負の数、大きな数でも使える', () => {
    for (const seed of [0, -1, 2 ** 40]) {
      const values = drawFloats(seed, 3);
      expect(new Set(values).size).toBe(3);
    }
  });
});

describe('nextInt', () => {
  it('min 以上 max 以下の整数を返し、両端も出る', () => {
    const counts = new Map<number, number>();
    let rng = createRng(2026);
    for (let i = 0; i < 6_000; i += 1) {
      const result = nextInt(rng, 1, 6);
      counts.set(result.value, (counts.get(result.value) ?? 0) + 1);
      rng = result.rng;
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    // 偏りが大きすぎないこと（期待値は各 1000 回）
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it('min と max が同じならその値を返す', () => {
    expect(nextInt(createRng(5), 3, 3).value).toBe(3);
  });

  it('範囲が不正ならエラーにする', () => {
    expect(() => nextInt(createRng(5), 6, 1)).toThrow(RangeError);
    expect(() => nextInt(createRng(5), 0.5, 2)).toThrow(RangeError);
  });
});

describe('重ならないように選ぶ', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];

  it('指定した数だけ、重ならずに選ぶ。同じ状態なら同じ結果', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const { value } = pickDistinct(items, 3, createRng(seed));
      expect(value).toHaveLength(3);
      expect(new Set(value).size).toBe(3);
      expect(value.every((item) => items.includes(item))).toBe(true);
    }
    expect(pickDistinct(items, 5, createRng(4))).toEqual(pickDistinct(items, 5, createRng(4)));
  });

  it('候補より多くは選べない', () => {
    expect(() => pickDistinct(items, 6, createRng(1))).toThrow(RangeError);
    expect(() => pickDistinct(items, -1, createRng(1))).toThrow(RangeError);
  });

  it('次のシードは 32bit の整数', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const { value } = nextSeed(createRng(seed));
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
