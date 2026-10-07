import type { AttributeId } from '../engine/types';

/** 属性の表示名（仮）。世界観が決まったら、ここだけ差し替える */
export const ATTRIBUTE_NAMES: Readonly<Record<AttributeId, string>> = {
  crimson: '紅',
  orange: '橙',
  yellow: '黄',
  green: '翠',
  blue: '蒼',
  violet: '紫',
};
