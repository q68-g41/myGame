/**
 * 効果音のデータ（仕様書 7 の M7-2）。8bit 風の音を、ブラウザの機能（Web Audio）でその場で作って鳴らす。
 * 1つの音は、いくつかの「音の粒」（ToneDef）を重ねたり、時間をずらして並べたりして作る。数値はここだけで調整する。
 * 既存作品の音に似せない（仕様書 2）。
 */

/** 鳴らす場面 */
export type SoundId =
  | 'tap'
  | 'select'
  | 'reward'
  | 'move'
  | 'hit'
  | 'hitStrong'
  | 'hitWeak'
  | 'heal'
  | 'status'
  | 'switch'
  | 'faint';

/** 音の粒：波の形・高さ（Hz）・長さ（秒）・大きさ（0〜1） */
export interface ToneDef {
  /** square：ピコピコ、triangle：やわらかい、sawtooth：ざらっとした、noise：ザッという雑音 */
  readonly wave: 'square' | 'triangle' | 'sawtooth' | 'noise';
  /** 始めの高さ（Hz）。noise では使わない */
  readonly from: number;
  /** 終わりの高さ（Hz）。省くと同じ高さのまま */
  readonly to?: number;
  /** 鳴らし始めるまでの時間（秒）。省くとすぐ */
  readonly at?: number;
  /** 長さ（秒） */
  readonly duration: number;
  /** 大きさ（0〜1）。全体の大きさ MASTER_VOLUME をかけて鳴らす */
  readonly volume: number;
}

/** 全体の大きさ */
export const MASTER_VOLUME = 0.25;

/** 音の高さ（Hz） */
const NOTE = {
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
} as const;

export const SOUNDS: Readonly<Record<SoundId, readonly ToneDef[]>> = {
  // ボタンを押した：短いピッ
  tap: [{ wave: 'square', from: 880, duration: 0.04, volume: 0.5 }],
  // マスを選んだ：上がるピロッ
  select: [{ wave: 'square', from: 660, to: 990, duration: 0.09, volume: 0.5 }],
  // 報酬を受け取った：2音で上がる
  reward: [
    { wave: 'square', from: NOTE.G5, duration: 0.08, volume: 0.5 },
    { wave: 'square', from: NOTE.C6, at: 0.08, duration: 0.14, volume: 0.5 },
  ],
  // 技を使った：シュッ（雑音＋上がる音）
  move: [
    { wave: 'noise', from: 0, duration: 0.07, volume: 0.25 },
    { wave: 'square', from: 300, to: 600, duration: 0.07, volume: 0.3 },
  ],
  // ダメージ（ふつう）：ドッ
  hit: [
    { wave: 'noise', from: 0, duration: 0.12, volume: 0.6 },
    { wave: 'square', from: 180, to: 80, duration: 0.1, volume: 0.5 },
  ],
  // ダメージ（有利）：強いドドッ
  hitStrong: [
    { wave: 'noise', from: 0, duration: 0.18, volume: 0.8 },
    { wave: 'square', from: 240, to: 60, duration: 0.16, volume: 0.6 },
    { wave: 'square', from: 120, to: 50, at: 0.08, duration: 0.12, volume: 0.5 },
  ],
  // ダメージ（不利）：弱いポコッ
  hitWeak: [{ wave: 'triangle', from: 220, to: 160, duration: 0.09, volume: 0.6 }],
  // 回復：やわらかく上がる3音
  heal: [
    { wave: 'triangle', from: NOTE.C5, duration: 0.08, volume: 0.6 },
    { wave: 'triangle', from: NOTE.E5, at: 0.07, duration: 0.08, volume: 0.6 },
    { wave: 'triangle', from: NOTE.G5, at: 0.14, duration: 0.14, volume: 0.6 },
  ],
  // 状態異常・能力の変化：ざらっと下がる
  status: [{ wave: 'sawtooth', from: 420, to: 180, duration: 0.22, volume: 0.35 }],
  // 交代：ポンと上がる
  switch: [{ wave: 'square', from: NOTE.C5, to: NOTE.G5, duration: 0.1, volume: 0.45 }],
  // 倒れた：長く下がる
  faint: [{ wave: 'square', from: 440, to: 110, duration: 0.42, volume: 0.45 }],
};
