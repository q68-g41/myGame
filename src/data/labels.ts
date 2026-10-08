/** 画面に出す名前（仮）。表示だけに使い、ルールには使わない */
import type { NodeKind } from '../engine/map';
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

/** マスの種類の表示名（仕様書 4.2） */
export const NODE_KIND_NAMES: Readonly<Record<NodeKind, string>> = {
  battle: '戦闘',
  elite: '強敵',
  rest: '休憩',
  scout: 'スカウト',
  event: 'イベント',
  boss: 'ボス',
};

/** マップのマスに出す1文字（仮素材。M5 でアイコンに差し替える） */
export const NODE_KIND_MARKS: Readonly<Record<NodeKind, string>> = {
  battle: '戦',
  elite: '強',
  rest: '休',
  scout: 'ス',
  event: '？',
  boss: 'ボ',
};
