/**
 * バトルエンジンで使う型。
 * 状態はすべて読み取り専用で、更新するときは新しいオブジェクトを作る。
 * 表示名（キャラ名・技名・属性名）はエンジンでは持たず、src/data/ 側で ID に対応させる。
 */

/** 属性の ID。表示名（紅・橙・黄・翠・蒼・紫）はデータ側で差し替える */
export type AttributeId = 'crimson' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet';

/** 能力値。hp は最大HP */
export interface Stats {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
}

/** 能力変化の段階（-3〜+3）。HP は変化しない */
export interface StatStages {
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
}

/**
 * 技の種類。
 * - normal：通常の攻撃技
 * - big：大技（使ったあと一定ターン使えない）
 * - priority：先制技（技の中で先に動く）
 * 補助技は M2 で追加する。
 */
export type MoveKind = 'normal' | 'big' | 'priority';

/** 技の定義 */
export interface MoveDef {
  readonly id: string;
  readonly attribute: AttributeId;
  readonly kind: MoveKind;
  readonly power: number;
}

/** キャラの定義（戦闘に出す前のデータ） */
export interface FighterDef {
  readonly id: string;
  readonly attribute: AttributeId;
  readonly stats: Stats;
  readonly moves: readonly MoveDef[];
}

/** 戦闘中のキャラ */
export interface Combatant {
  readonly id: string;
  readonly attribute: AttributeId;
  readonly stats: Stats;
  readonly moves: readonly MoveDef[];
  /** いまのHP（0 で戦闘不能） */
  readonly hp: number;
  readonly stages: StatStages;
  /** 技ID → 使えない残りターン数。0 または未設定なら使える */
  readonly cooldowns: Readonly<Record<string, number>>;
}

/** 陣営 */
export type Side = 'player' | 'enemy';

/** バトル全体の状態 */
export interface BattleState {
  /** 次に処理するターンの番号（1 から） */
  readonly turn: number;
  readonly sides: Readonly<Record<Side, Combatant>>;
  /** 勝った陣営。決着前は null */
  readonly winner: Side | null;
}

/** 1ターンに選ぶコマンド。交代は M2 で追加する */
export interface MoveCommand {
  readonly type: 'move';
  readonly moveId: string;
}

export type Command = MoveCommand;

/** 双方のコマンド */
export type Commands = Readonly<Record<Side, Command>>;

/** 相性の結果 */
export type Effectiveness = 'advantage' | 'neutral' | 'disadvantage';

/** エンジンが返すイベント。画面はこれを順番に再生して演出を作る */
export type BattleEvent =
  | {
      readonly type: 'moveUsed';
      readonly side: Side;
      readonly moveId: string;
      readonly moveKind: MoveKind;
    }
  | {
      readonly type: 'damage';
      /** ダメージを受けた陣営 */
      readonly side: Side;
      readonly amount: number;
      /** ダメージを受けたあとのHP */
      readonly hp: number;
      readonly effectiveness: Effectiveness;
      readonly resonance: boolean;
    }
  | {
      readonly type: 'fainted';
      readonly side: Side;
    }
  | {
      readonly type: 'battleEnd';
      readonly winner: Side;
    };
