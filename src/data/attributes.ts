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

/** 属性の色（仮素材の四角や技ボタンに使う） */
export const ATTRIBUTE_COLORS: Readonly<Record<AttributeId, string>> = {
  crimson: '#d9473f',
  orange: '#e8892c',
  yellow: '#d8b62a',
  green: '#4fb36a',
  blue: '#3f8fd9',
  violet: '#9a5fd0',
};
