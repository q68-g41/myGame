/**
 * 仕様（docs/spec.md）の数値。ロジックに直接数値を書かず、ここから使う。
 * 数値はすべて仮で、バランス調整で変える前提。
 */
import type { AttributeId, CpuLevel, Side, StatusId } from './types';

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

/* ===== ローグライト進行（4章） ===== */

/** スタート時に出す候補の数（4.1） */
export const DRAFT_CANDIDATE_COUNT = 5;

/** ランで連れて歩くチームの人数（4.1） */
export const RUN_TEAM_SIZE = 3;

/** マップの1層のマス数（4.3）。休憩とボスの層は全ルートが合流するので1マス */
export const MAP_LAYER_MIN_WIDTH = 2;
export const MAP_LAYER_MAX_WIDTH = 3;

/** 1ランのエリアの数（4章）。最後のエリアのボスを倒せばクリア */
export const AREA_COUNT = 3;

/** 戦闘マスの相手の人数（仮）。[エリア][層]（層は 0 が1層目）。戦闘マスがあるのは1〜5層目 */
export const BATTLE_ENEMY_COUNT: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 2],
  [1, 2, 2, 2, 2],
  [2, 2, 2, 3, 3],
];

/** 強敵マス・ボスの相手の人数（仮）。添字はエリア */
export const ELITE_ENEMY_COUNT: readonly number[] = [2, 3, 3];
export const BOSS_ENEMY_COUNT: readonly number[] = [3, 3, 3];

/** エリアごとに、相手全員の能力にかける倍率（仮）。添字はエリア。強敵・ボスの倍率とかけ合わせる */
export const AREA_STAT_MULTIPLIER: readonly number[] = [1, 1.1, 1.2];

/**
 * 相手の CPU の段階（仕様書 6）。添字はエリア。強敵とボスもエリアの段階を使う。
 * 段階3はまだないので、エリア3も段階2（M5-3 で段階3にする）
 */
export const CPU_LEVEL_BY_AREA: readonly CpuLevel[] = [1, 2, 2];

/** 強敵・ボスの能力の倍率（仮）。HP・攻撃・防御にかけて四捨五入する（素早さは変えない） */
export const ELITE_STAT_MULTIPLIER = 1.1;
export const BOSS_STAT_MULTIPLIER = 1.2;

/** 戦闘に勝ったあと、倒れていたキャラが戻るときのHP。最大HPの%（切り捨て、最低1）（8. 未決の仮決め） */
export const REVIVE_HP_PERCENT = 10;

/** 戦闘後の報酬の選択肢の数（4.4） */
export const REWARD_OFFER_COUNT = 3;

/** 強敵に勝ったときに選べる報酬の回数（4.2） */
export const ELITE_REWARD_PICKS = 2;

/** ボスに勝ったときに選べる報酬の回数（仮）。最後のエリアのボスはクリアなので報酬はない */
export const BOSS_REWARD_PICKS = 2;

/** 能力強化で上がる量。いまの値の % （四捨五入、最低1）（4.4：10%前後） */
export const STAT_BOOST_PERCENT = 10;

/** 休憩：全員のHPを最大HPの何%回復するか（4.2） */
export const REST_HEAL_PERCENT = 30;

/** 休憩：技の強化で上がる威力（4.2 の補足） */
export const REST_POWER_UP = 10;

/** スカウトの候補の数（4.2） */
export const SCOUT_CANDIDATE_COUNT = 3;
