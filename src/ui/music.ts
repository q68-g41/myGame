/**
 * BGM の楽譜を読む・場面に合う曲を選ぶ（仕様書 7 の M7-3）。音は鳴らさない（鳴らすのは sound.ts）。
 */
import type { DrumKind, MusicId, MusicPart, TrackDef } from '../data/music';
import type { Side } from '../engine/types';

/** 音符1つ。at と length は8分音符いくつぶんか、note は音の高さの番号（A4 = 69） */
export interface NoteEvent {
  readonly at: number;
  readonly length: number;
  readonly note: number;
}

export interface DrumEvent {
  readonly at: number;
  readonly kind: DrumKind;
}

export type PartEvents =
  | { readonly kind: 'notes'; readonly events: readonly NoteEvent[]; readonly length: number }
  | { readonly kind: 'drums'; readonly events: readonly DrumEvent[]; readonly length: number };

const STEPS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 音名（例：A4、Bb4、C#5）を、音の高さの番号にする。読めない音名なら例外 */
export function noteNumber(name: string): number {
  const match = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (match === null) {
    throw new Error(`読めない音名：${name}`);
  }
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return 12 * (Number(match[3]) + 1) + STEPS[match[1]!]! + accidental;
}

/** 音の高さの番号を、周波数（Hz）にする */
export function noteFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function melodyEvents(notes: string): { events: NoteEvent[]; length: number } {
  const events: NoteEvent[] = [];
  let at = 0;
  for (const token of notes.replaceAll('|', ' ').trim().split(/\s+/)) {
    const [name = '', size = ''] = token.split(':');
    const length = Number(size);
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error(`読めない長さ：${token}`);
    }
    if (name !== 'r') {
      events.push({ at, length, note: noteNumber(name) });
    }
    at += length;
  }
  return { events, length: at };
}

/** パート1つを、鳴らす音の並びにする */
export function partEvents(part: MusicPart): PartEvents {
  switch (part.kind) {
    case 'melody':
      return { kind: 'notes', ...melodyEvents(part.notes) };
    case 'bass': {
      const events = part.roots.flatMap((root, bar) =>
        part.pattern.map((step, index) => ({
          at: bar * part.pattern.length + index,
          length: 1,
          note: noteNumber(root) + step,
        })),
      );
      return { kind: 'notes', events, length: part.roots.length * part.pattern.length };
    }
    case 'drums': {
      const steps = part.steps.replaceAll('|', '');
      const events: DrumEvent[] = [];
      [...steps].forEach((step, at) => {
        if (step === 'k' || step === 's' || step === 'h' || step === 't') {
          events.push({ at, kind: step });
        } else if (step !== '.') {
          throw new Error(`読めないドラム：${step}`);
        }
      });
      return { kind: 'drums', events, length: steps.length };
    }
  }
}

/** 曲1回ぶんの長さ（8分音符いくつぶんか）。いちばん長いパートに合わせる */
export function trackLength(track: TrackDef): number {
  return Math.max(...track.parts.map((part) => partEvents(part).length));
}

/** 8分音符1つの長さ（秒） */
export function unitSeconds(track: TrackDef): number {
  return 60 / track.bpm / 2;
}

/** いまの画面 */
export type MusicScene =
  | { readonly screen: 'top' | 'draft' | 'map' | 'reward' | 'rest' | 'scout' | 'event' | 'ended' }
  | {
      readonly screen: 'battle';
      readonly boss: boolean;
      /** 決着を画面に出したあとなら、勝った側。まだなら null */
      readonly winner: Side | null;
    };

/** 画面に合う曲を選ぶ。null なら鳴らさない */
export function chooseMusic(scene: MusicScene): MusicId | null {
  switch (scene.screen) {
    case 'battle':
      if (scene.winner !== null) {
        return scene.winner === 'player' ? 'victory' : 'defeat';
      }
      return scene.boss ? 'boss' : 'battle';
    // ランの結果の画面は、直前の勝ち負けの曲の余韻を残すため鳴らさない
    case 'ended':
      return null;
    default:
      return 'field';
  }
}
