import { AFFINITY_MULTIPLIER, ATTRIBUTE_ORDER, MONOCHROME_ATTRIBUTES, RESONANCE_MULTIPLIER } from './constants';
import type { AttributeId, Effectiveness } from './types';

function attributeIndex(attribute: AttributeId): number {
  const index = ATTRIBUTE_ORDER.indexOf(attribute);
  if (index < 0) {
    throw new Error(`未知の属性です: ${attribute}`);
  }
  return index;
}

/**
 * 技の属性と受ける側の属性から相性を決める（3.3）。
 * d = (守る側 − 攻める側 + 6) % 6 が 1・2 なら有利、4・5 なら不利、0・3 なら等倍。
 * 白・黒は円に入らない。白と黒のあいだはお互いに有利で、どちらかだけが白・黒（6色が相手）なら等倍。
 */
export function getEffectiveness(moveAttribute: AttributeId, defenderAttribute: AttributeId): Effectiveness {
  const moveIsMonochrome = MONOCHROME_ATTRIBUTES.includes(moveAttribute);
  const defenderIsMonochrome = MONOCHROME_ATTRIBUTES.includes(defenderAttribute);
  if (moveIsMonochrome || defenderIsMonochrome) {
    return moveIsMonochrome && defenderIsMonochrome && moveAttribute !== defenderAttribute ? 'advantage' : 'neutral';
  }
  const count = ATTRIBUTE_ORDER.length;
  const d = (attributeIndex(defenderAttribute) - attributeIndex(moveAttribute) + count) % count;
  if (d === 1 || d === 2) {
    return 'advantage';
  }
  if (d === count - 1 || d === count - 2) {
    return 'disadvantage';
  }
  return 'neutral';
}

/** 相性の倍率 */
export function affinityMultiplier(moveAttribute: AttributeId, defenderAttribute: AttributeId): number {
  return AFFINITY_MULTIPLIER[getEffectiveness(moveAttribute, defenderAttribute)];
}

/** 共鳴するか（技の属性と使うキャラの属性が同じ） */
export function isResonant(moveAttribute: AttributeId, userAttribute: AttributeId): boolean {
  return moveAttribute === userAttribute;
}

/** 共鳴の倍率 */
export function resonanceMultiplier(moveAttribute: AttributeId, userAttribute: AttributeId): number {
  return isResonant(moveAttribute, userAttribute) ? RESONANCE_MULTIPLIER : 1;
}
