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
 * - support：補助技（ダメージを与えず、能力変化や回復をする）
 */
export type AttackKind = 'normal' | 'big' | 'priority';
export type MoveKind = AttackKind | 'support';

/** 能力変化の対象になる能力 */
export type StatKey = keyof StatStages;

/** 状態異常の ID（3.8）。1体につき1つまで */
export type StatusId = 'erosion' | 'slow';

/** かかっている状態異常 */
export interface StatusState {
  readonly id: StatusId;
  /** 残りターン数。ターン終了処理で 1 減り、0 になったら治る */
  readonly remaining: number;
}

/** 補助技の効果 */
export type MoveEffect =
  | {
      /** 能力変化。stages は段階数（正なら上げる、負なら下げる） */
      readonly type: 'stat';
      readonly target: 'self' | 'opponent';
      readonly stat: StatKey;
      readonly stages: number;
    }
  | {
      /** 自分のHPを、最大HPの percent % 回復する */
      readonly type: 'heal';
      readonly percent: number;
    }
  | {
      /** 相手に状態異常を与える。すでに状態異常があれば効かない */
      readonly type: 'status';
      readonly status: StatusId;
    };

/** 攻撃技の定義 */
export interface AttackMoveDef {
  readonly id: string;
  readonly attribute: AttributeId;
  readonly kind: AttackKind;
  readonly power: number;
}

/** 補助技の定義。効果を順番に適用する */
export interface SupportMoveDef {
  readonly id: string;
  readonly attribute: AttributeId;
  readonly kind: 'support';
  readonly effects: readonly MoveEffect[];
}

/** 技の定義 */
export type MoveDef = AttackMoveDef | SupportMoveDef;

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
  /** かかっている状態異常。なければ null */
  readonly status: StatusState | null;
}

/** 陣営 */
export type Side = 'player' | 'enemy';

/**
 * お守りの効果（4.4：チーム全体にかかる常時効果）。
 * - movePower：その種類の技の威力を percent % 上げる（切り捨て）
 * - switchInHeal：交代で場に出たキャラ（倒れたあとに出したときも）のHPを、最大HPの percent % 回復する
 */
export type CharmEffect =
  | { readonly type: 'movePower'; readonly moveKind: AttackKind; readonly percent: number }
  | { readonly type: 'switchInHeal'; readonly percent: number };

/** 陣営ごとのチーム */
export interface SideState {
  /** チームのキャラ（1〜3体）。並び順は変わらない */
  readonly team: readonly Combatant[];
  /** 場に出ているキャラの、チーム内の位置 */
  readonly active: number;
  /** この陣営にかかっているお守りの効果。なければ省く */
  readonly charms?: readonly CharmEffect[];
}

/** バトル全体の状態 */
export interface BattleState {
  /** 次に処理するターンの番号（1 から） */
  readonly turn: number;
  readonly sides: Readonly<Record<Side, SideState>>;
  /**
   * 場のキャラが倒れて、控えから次を選ぶ必要がある陣営。
   * 空でなければ、submitReplacements で選ぶまで次のターンに進めない
   */
  readonly awaitingReplacement: readonly Side[];
  /** 勝った陣営。決着前は null */
  readonly winner: Side | null;
}

/** 技を使うコマンド */
export interface MoveCommand {
  readonly type: 'move';
  readonly moveId: string;
}

/** 控えと交代するコマンド */
export interface SwitchCommand {
  readonly type: 'switch';
  /** 交代先の、チーム内の位置 */
  readonly to: number;
}

export type Command = MoveCommand | SwitchCommand;

/** 双方のコマンド */
export type Commands = Readonly<Record<Side, Command>>;

/** 倒れたあとに控えから出すキャラ（陣営 → チーム内の位置） */
export type Replacements = Readonly<Partial<Record<Side, number>>>;

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
      /** 計算したダメージ（残りHPより多いこともある） */
      readonly amount: number;
      /** ダメージを受けたあとのHP */
      readonly hp: number;
      readonly effectiveness: Effectiveness;
      readonly resonance: boolean;
    }
  | {
      readonly type: 'statChanged';
      readonly side: Side;
      readonly stat: StatKey;
      /** 実際に変わった段階数（上限・下限で変わらなければ 0） */
      readonly delta: number;
      /** 変化したあとの段階 */
      readonly stage: number;
    }
  | {
      readonly type: 'healed';
      readonly side: Side;
      /** 実際に回復した量（HPが満タンなら 0） */
      readonly amount: number;
      /** 回復したあとのHP */
      readonly hp: number;
      /** お守りの効果で回復したときは 'charm'。技で回復したときは省く */
      readonly source?: 'charm';
    }
  | {
      readonly type: 'statusApplied';
      readonly side: Side;
      readonly status: StatusId;
    }
  | {
      /** すでに状態異常があって、効かなかった */
      readonly type: 'statusBlocked';
      readonly side: Side;
      readonly status: StatusId;
    }
  | {
      /** 状態異常によるダメージ（侵蝕） */
      readonly type: 'statusDamage';
      readonly side: Side;
      readonly status: StatusId;
      readonly amount: number;
      readonly hp: number;
    }
  | {
      /** 状態異常が治った */
      readonly type: 'statusEnded';
      readonly side: Side;
      readonly status: StatusId;
    }
  | {
      readonly type: 'switched';
      readonly side: Side;
      /** 引っ込めたキャラの位置 */
      readonly from: number;
      /** 出したキャラの位置 */
      readonly to: number;
      /** command：交代コマンド、replacement：倒れたあとに控えから出した */
      readonly reason: 'command' | 'replacement';
    }
  | {
      readonly type: 'fainted';
      readonly side: Side;
      /** 倒れたキャラの位置 */
      readonly index: number;
    }
  | {
      readonly type: 'battleEnd';
      readonly winner: Side;
    };
