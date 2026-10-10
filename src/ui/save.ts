/**
 * 自動保存と再開（仕様書 5：毎ターン自動保存。アプリを閉じても同じターンから再開できる）と、設定（演出の速さ）の保存。
 * 保存先はブラウザの localStorage。エンジンには持ち込まず、画面の側だけで扱う。
 */
import type { RunState } from '../engine/run';
import type { PlaybackSpeed } from './playback';
import { saveSession, type BattleSession, type SavedBattle } from './session';

/**
 * localStorage のキー。itch.io では、ほかの人の HTML ゲームと同じドメインで動くので、ゲームの名前を付けてぶつからないようにする。
 * （M6 で 'mygame.save' から変えた。前のキーは、ほかのゲームのものかもしれないので読まない・消さない）
 */
export const SAVE_KEY = 'sairei-no-michi.save';

/** 保存の形の版。形を変えて古いセーブが読めなくなるときに上げる（古い版のセーブは捨てる） */
export const SAVE_VERSION = 4;

/** 保存したゲーム：ランの状態と、戦闘中ならバトルの状態 */
export interface SavedGame {
  readonly run: RunState;
  readonly battle: SavedBattle | null;
}

interface SaveFile extends SavedGame {
  readonly version: number;
}

/** 保存する文字列にする */
export function serializeGame(run: RunState, session: BattleSession | null): string {
  const file: SaveFile = { version: SAVE_VERSION, run, battle: session === null ? null : saveSession(session) };
  return JSON.stringify(file);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * 保存した文字列を読む。読めない・版が違う・形がおかしいときは null。
 * 中身の細かい正しさまでは見ない（画面を作るときにエラーになったら、呼び出し側でセーブを捨てる）
 */
export function parseSavedGame(text: string | null): SavedGame | null {
  if (text === null) {
    return null;
  }
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(file) || file.version !== SAVE_VERSION || !isObject(file.run)) {
    return null;
  }
  const { run, battle } = file;
  if (
    typeof run.area !== 'number' ||
    !isObject(run.map) ||
    !Array.isArray(run.team) ||
    !isObject(run.phase) ||
    typeof run.phase.kind !== 'string'
  ) {
    return null;
  }
  if (run.phase.kind === 'ended') {
    return null;
  }
  const inBattle = run.phase.kind === 'battle';
  if (inBattle !== isObject(battle)) {
    return null;
  }
  if (isObject(battle) && (!isObject(battle.state) || typeof battle.rng !== 'number' || !Array.isArray(battle.knownEnemySpeeds))) {
    return null;
  }
  return { run: run as unknown as RunState, battle: inBattle ? (battle as unknown as SavedBattle) : null };
}

/** 保存先。使えない環境（プライベートブラウズなど）では何もしない */
export interface SaveStore {
  load(): SavedGame | null;
  save(run: RunState, session: BattleSession | null): void;
  clear(): void;
}

/** localStorage（など同じ形のもの）を使う保存先を作る。null なら保存しない */
export function createSaveStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null): SaveStore {
  return {
    load: () => {
      try {
        return parseSavedGame(storage?.getItem(SAVE_KEY) ?? null);
      } catch {
        return null;
      }
    },
    save: (run, session) => {
      try {
        storage?.setItem(SAVE_KEY, serializeGame(run, session));
      } catch {
        // 保存できなくても遊び続けられるようにする（容量不足・プライベートブラウズなど）
      }
    },
    clear: () => {
      try {
        storage?.removeItem(SAVE_KEY);
      } catch {
        // 消せなくても続ける
      }
    },
  };
}

/* ===== 設定（演出の速さ・音） ===== */

/** 設定の localStorage のキー。ランの保存とは別にして、ランが終わっても消さない（名前の付け方は SAVE_KEY と同じ） */
export const SETTINGS_KEY = 'sairei-no-michi.settings';

/** 開き直しても残す設定 */
export interface Settings {
  /** 演出の速さ */
  readonly speed: PlaybackSpeed;
  /** 効果音を鳴らすか（M7-2）。はじめはオン */
  readonly sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = { speed: 1, sound: true };

/** 保存した設定を読む。読めない・形がおかしいときは、最初の設定 */
export function parseSettings(text: string | null): Settings {
  if (text === null) {
    return DEFAULT_SETTINGS;
  }
  try {
    const file: unknown = JSON.parse(text);
    if (isObject(file) && (file.speed === 1 || file.speed === 2)) {
      // 音の設定がない（M7-2 より前に保存した）ときは、はじめの設定（オン）
      return { speed: file.speed, sound: typeof file.sound === 'boolean' ? file.sound : DEFAULT_SETTINGS.sound };
    }
  } catch {
    // 読めなければ最初の設定
  }
  return DEFAULT_SETTINGS;
}

/** 設定の保存先 */
export interface SettingsStore {
  load(): Settings;
  save(settings: Settings): void;
}

/** localStorage（など同じ形のもの）を使う設定の保存先を作る。null なら保存しない */
export function createSettingsStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null): SettingsStore {
  return {
    load: () => {
      try {
        return parseSettings(storage?.getItem(SETTINGS_KEY) ?? null);
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
    save: (settings) => {
      try {
        storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        // 保存できなくても遊び続けられるようにする
      }
    },
  };
}
