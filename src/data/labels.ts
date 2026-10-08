/** 画面に出す名前（仮）。表示だけに使い、ルールには使わない */
import type { StatKey, StatusId } from '../engine/types';

/** 状態異常の表示名（仕様書 3.8 の仮名） */
export const STATUS_NAMES: Readonly<Record<StatusId, string>> = {
  erosion: '侵蝕',
  slow: '鈍化',
};

/** 能力の表示名 */
export const STAT_NAMES: Readonly<Record<StatKey, string>> = {
  attack: '攻撃',
  defense: '防御',
  speed: '素早さ',
};
