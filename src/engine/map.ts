/**
 * 1エリア分の分岐マップ（4.3）。下の層から順に進み、最後の層がボス。
 * マップはシード付き乱数で作り、同じシードなら必ず同じマップになる。
 */
import { MAP_LAYER_MAX_WIDTH, MAP_LAYER_MIN_WIDTH } from './constants';
import { nextInt, pickDistinct, type RngResult, type RngState } from './rng';

/** マスの種類（4.2） */
export type NodeKind = 'battle' | 'elite' | 'rest' | 'scout' | 'event' | 'boss';

/** マップの1マス */
export interface MapNode {
  readonly kind: NodeKind;
  /** つながっている、次の層のマスの位置（左から何番目か） */
  readonly next: readonly number[];
}

/** 1エリアのマップ。layers[0] がいちばん下（最初に選ぶ層）で、最後の層がボス */
export interface AreaMap {
  readonly layers: readonly (readonly MapNode[])[];
}

/** マップ上の位置 */
export interface MapPosition {
  /** 層（0 が1層目） */
  readonly layer: number;
  /** 層の中で左から何番目か */
  readonly index: number;
}

/** 2層目に置くマスの候補。2〜3マスに、重ならないように置く */
const SECOND_LAYER_KINDS: readonly NodeKind[] = ['event', 'battle', 'elite'];

/** スカウトと戦闘を1回ずつ通る層（3層目と4層目）。添字は層（0 が1層目） */
const SCOUT_PAIR_LAYER = 2;

/**
 * 隣り合う層を、線が交差しないようにつなぐ。
 * 左端どうしから右端どうしまで、下の層か上の層のどちらかを1つずつ右へ進め、そのつど今いる2マスをつなぐ。
 * どのマスにも線が1本以上つながり、線は交差しない。
 */
function connectLayers(from: number, to: number, rng: RngState): RngResult<readonly (readonly number[])[]> {
  const next: number[][] = Array.from({ length: from }, () => []);
  let current = rng;
  let i = 0;
  let j = 0;
  next[0]!.push(0);
  while (i < from - 1 || j < to - 1) {
    let advanceFrom: boolean;
    if (i === from - 1) {
      advanceFrom = false;
    } else if (j === to - 1) {
      advanceFrom = true;
    } else {
      const draw = nextInt(current, 0, 1);
      current = draw.rng;
      advanceFrom = draw.value === 0;
    }
    if (advanceFrom) {
      i += 1;
    } else {
      j += 1;
    }
    next[i]!.push(j);
  }
  return { value: next, rng: current };
}

/** 1エリア分のマップを作る（4.3） */
export function generateAreaMap(rng: RngState): RngResult<AreaMap> {
  let current = rng;
  const width = (): number => {
    const draw = nextInt(current, MAP_LAYER_MIN_WIDTH, MAP_LAYER_MAX_WIDTH);
    current = draw.rng;
    return draw.value;
  };

  // 1. 戦闘
  const first: NodeKind[] = Array.from({ length: width() }, () => 'battle');
  // 2. イベント・戦闘・強敵のどれか（重ならないように選ぶ）
  const secondDraw = pickDistinct(SECOND_LAYER_KINDS, width(), current);
  current = secondDraw.rng;
  // 3. スカウト または 戦闘
  const third: NodeKind[] = Array.from({ length: width() }, () => {
    const draw = nextInt(current, 0, 1);
    current = draw.rng;
    return draw.value === 0 ? 'scout' : 'battle';
  });
  // 4. 3層目で選ばなかったほう（同じ列で、スカウトと戦闘が1回ずつになる）
  const fourth: NodeKind[] = third.map((kind) => (kind === 'scout' ? 'battle' : 'scout'));
  // 5. 戦闘 → 6. 休憩（全ルートが合流）→ 7. ボス
  const fifth: NodeKind[] = Array.from({ length: width() }, () => 'battle');
  const kinds: readonly (readonly NodeKind[])[] = [first, secondDraw.value, third, fourth, fifth, ['rest'], ['boss']];

  const layers = kinds.map((layerKinds, layer) => {
    const above = kinds[layer + 1];
    if (above === undefined) {
      return layerKinds.map((kind): MapNode => ({ kind, next: [] }));
    }
    if (layer === SCOUT_PAIR_LAYER) {
      // 3層目と4層目は、同じ列のマスとだけつなぐ
      return layerKinds.map((kind, index): MapNode => ({ kind, next: [index] }));
    }
    const links = connectLayers(layerKinds.length, above.length, current);
    current = links.rng;
    return layerKinds.map((kind, index): MapNode => ({ kind, next: links.value[index]! }));
  });

  return { value: { layers }, rng: current };
}

/** 位置のマスを取り出す。なければエラー */
export function nodeAt(map: AreaMap, position: MapPosition): MapNode {
  const node = map.layers[position.layer]?.[position.index];
  if (!node) {
    throw new Error(`マップの ${position.layer + 1} 層目・${position.index + 1} 番目のマスはありません`);
  }
  return node;
}

/**
 * 次に進めるマス（次の層での位置）。
 * まだどのマスにも入っていなければ1層目のすべて、ボスの層なら空。
 */
export function nextChoices(map: AreaMap, position: MapPosition | null): readonly number[] {
  if (position === null) {
    return map.layers[0]!.map((_node, index) => index);
  }
  return nodeAt(map, position).next;
}
