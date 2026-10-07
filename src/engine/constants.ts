/**
 * 仕様（docs/spec.md）の数値。ロジックに直接数値を書かず、ここから使う。
 * 数値はすべて仮で、バランス調整で変える前提。
 */
import type { AttributeId, Side, StatusId } from './types';

/** 陣営の一覧 */
export const SIDES: readonly Side[] = ['player', 'enemy'];

/** 1体が覚えられる技の数（3.6） */
export const MAX_MOVES = 4;

/** 1つの陣営のチームの最大人数（3対3） */
export const MAX_TEAM_SIZE = 3;

/** 属性の並び順。円になっていて、最後の次は最初に戻る（3.3） */
export const ATTRIBUTE_ORDER: readonly AttributeId[] = [
  'crimson',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
];

/** 相性の倍率（3.3） */
export const AFFINITY_MULTIPLIER = {
  advantage: 1.5,
  neutral: 1.0,
  disadvantage: 0.7,
} as const;

/** 共鳴（技とキャラの属性が同じ）の倍率（3.3） */
export const RESONANCE_MULTIPLIER = 1.2;

/** ダメージ式の最後に掛ける係数（3.4） */
export const DAMAGE_SCALE = 0.5;

/** ダメージの乱数の範囲。パーセントの整数で持ち、0.90〜1.00 を 0.01 刻みで選ぶ（3.4） */
export const DAMAGE_ROLL_MIN_PERCENT = 90;
export const DAMAGE_ROLL_MAX_PERCENT = 100;

/** 最低ダメージ（3.4） */
export const MIN_DAMAGE = 1;

/** 能力変化：1段階ごとの倍率と、上下の上限（3.7） */
export const STAGE_UP_MULTIPLIER = 1.25;
export const STAGE_DOWN_MULTIPLIER = 0.8;
export const MAX_STAGE = 3;

/** 大技を使ったあと、使えなくなるターン数（3.6） */
export const BIG_MOVE_COOLDOWN_TURNS = 2;

/** 状態異常の持続ターン数。かかったターンから数える（3.8） */
export const STATUS_DURATION: Readonly<Record<StatusId, number>> = {
  erosion: 3,
  slow: 2,
};

/** 侵蝕：ターン終了時に最大HPの何%のダメージを受けるか（切り捨て、最低1）（3.8） */
export const EROSION_DAMAGE_PERCENT = 10;

/** 鈍化：素早さの倍率（3.8） */
export const SLOW_SPEED_MULTIPLIER = 0.5;
