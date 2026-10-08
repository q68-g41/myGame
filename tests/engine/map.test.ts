import { describe, expect, it } from 'vitest';
import { MAP_LAYER_MAX_WIDTH, MAP_LAYER_MIN_WIDTH } from '../../src/engine/constants';
import { generateAreaMap, nextChoices, nodeAt, type AreaMap, type NodeKind } from '../../src/engine/map';
import { createRng } from '../../src/engine/rng';

const mapOf = (seed: number): AreaMap => generateAreaMap(createRng(seed)).value;
const SEEDS = Array.from({ length: 300 }, (_, i) => i);

/** 1層目からボスまでの、すべてのルート（通るマスの種類の並び） */
function allRoutes(map: AreaMap): NodeKind[][] {
  const walk = (layer: number, index: number): NodeKind[][] => {
    const node = nodeAt(map, { layer, index });
    if (node.next.length === 0) {
      return [[node.kind]];
    }
    return node.next.flatMap((next) => walk(layer + 1, next).map((route) => [node.kind, ...route]));
  };
  return map.layers[0]!.flatMap((_node, index) => walk(0, index));
}

const count = (route: readonly NodeKind[], kind: NodeKind) => route.filter((k) => k === kind).length;

describe('マップの形（4.3）', () => {
  it('7層で、1〜5層目は2〜3マス、休憩とボスは1マス', () => {
    for (const seed of SEEDS) {
      const { layers } = mapOf(seed);
      expect(layers).toHaveLength(7);
      for (const layer of layers.slice(0, 5)) {
        expect(layer.length).toBeGreaterThanOrEqual(MAP_LAYER_MIN_WIDTH);
        expect(layer.length).toBeLessThanOrEqual(MAP_LAYER_MAX_WIDTH);
      }
      expect(layers[5]!.map((node) => node.kind)).toEqual(['rest']);
      expect(layers[6]!.map((node) => node.kind)).toEqual(['boss']);
    }
  });

  it('層ごとのマスの種類：1層目 戦闘／2層目 イベント・戦闘・強敵（重ならない）／5層目 戦闘', () => {
    for (const seed of SEEDS) {
      const { layers } = mapOf(seed);
      expect(layers[0]!.every((node) => node.kind === 'battle')).toBe(true);
      const second = layers[1]!.map((node) => node.kind);
      expect(second.every((kind) => ['event', 'battle', 'elite'].includes(kind))).toBe(true);
      expect(new Set(second).size).toBe(second.length);
      expect(layers[4]!.every((node) => node.kind === 'battle')).toBe(true);
    }
  });

  it('3層目と4層目は同じ列どうしがつながり、スカウトと戦闘が1回ずつになる', () => {
    for (const seed of SEEDS) {
      const { layers } = mapOf(seed);
      const third = layers[2]!;
      const fourth = layers[3]!;
      expect(fourth).toHaveLength(third.length);
      third.forEach((node, index) => {
        expect(node.next).toEqual([index]);
        expect([node.kind, fourth[index]!.kind].sort()).toEqual(['battle', 'scout']);
      });
    }
  });

  it('どのマスも、次の層のマスとつながり、前の層のマスからたどり着ける', () => {
    for (const seed of SEEDS) {
      const { layers } = mapOf(seed);
      layers.forEach((layer, l) => {
        const above = layers[l + 1];
        for (const node of layer) {
          if (above === undefined) {
            expect(node.next).toEqual([]);
            continue;
          }
          expect(node.next.length).toBeGreaterThan(0);
          for (const next of node.next) {
            expect(next).toBeGreaterThanOrEqual(0);
            expect(next).toBeLessThan(above.length);
          }
        }
        if (above !== undefined) {
          const reached = new Set(layer.flatMap((node) => node.next));
          expect(reached.size).toBe(above.length);
        }
      });
    }
  });

  it('隣り合う層をつなぐ線は交差しない', () => {
    for (const seed of SEEDS) {
      for (const layer of mapOf(seed).layers) {
        const edges = layer.flatMap((node, from) => node.next.map((to) => [from, to] as const));
        for (const [a, b] of edges) {
          for (const [c, d] of edges) {
            // 左のマスから出る線は、右のマスから出る線より右へ行かない
            if (a < c) {
              expect(b).toBeLessThanOrEqual(d);
            }
          }
        }
      }
    }
  });

  it('どのルートでも、戦闘3〜4回・スカウト1回・休憩1回・ボス1回、強敵とイベントは0〜1回（4.2）', () => {
    for (const seed of SEEDS) {
      for (const route of allRoutes(mapOf(seed))) {
        expect(route).toHaveLength(7);
        expect(count(route, 'battle')).toBeGreaterThanOrEqual(3);
        expect(count(route, 'battle')).toBeLessThanOrEqual(4);
        expect(count(route, 'scout')).toBe(1);
        expect(count(route, 'rest')).toBe(1);
        expect(count(route, 'boss')).toBe(1);
        expect(count(route, 'elite')).toBeLessThanOrEqual(1);
        expect(count(route, 'event')).toBeLessThanOrEqual(1);
      }
    }
  });

  it('同じシードなら同じマップ。シードが違えば、いろいろな形になる', () => {
    expect(mapOf(42)).toEqual(mapOf(42));
    const shapes = new Set(SEEDS.map((seed) => JSON.stringify(mapOf(seed))));
    expect(shapes.size).toBeGreaterThan(SEEDS.length / 2);
    const secondKinds = new Set(SEEDS.flatMap((seed) => mapOf(seed).layers[1]!.map((node) => node.kind)));
    expect(secondKinds).toEqual(new Set(['event', 'battle', 'elite']));
  });
});

describe('次に進めるマス', () => {
  const map = mapOf(7);

  it('まだどのマスにも入っていなければ、1層目のすべて', () => {
    expect(nextChoices(map, null)).toEqual(map.layers[0]!.map((_node, index) => index));
  });

  it('マスにいれば、そのマスとつながっている次の層のマス。ボスの先はない', () => {
    expect(nextChoices(map, { layer: 0, index: 0 })).toEqual(map.layers[0]![0]!.next);
    expect(nextChoices(map, { layer: 6, index: 0 })).toEqual([]);
  });

  it('ないマスを指定するとエラー', () => {
    expect(() => nodeAt(map, { layer: 7, index: 0 })).toThrow('ありません');
    expect(() => nodeAt(map, { layer: 5, index: 1 })).toThrow('ありません');
  });
});
