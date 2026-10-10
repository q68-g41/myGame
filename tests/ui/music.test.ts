import { describe, expect, it } from 'vitest';
import { DRUMS, TRACKS, type MusicId } from '../../src/data/music';
import { chooseMusic, noteFrequency, noteNumber, partEvents, trackLength, unitSeconds } from '../../src/ui/music';

describe('BGM の楽譜を読む', () => {
  it('音名を音の高さの番号にする（A4 = 69、♭は半音下、♯は半音上）', () => {
    expect(noteNumber('A4')).toBe(69);
    expect(noteNumber('C4')).toBe(60);
    expect(noteNumber('Bb4')).toBe(70);
    expect(noteNumber('C#5')).toBe(73);
    expect(noteFrequency(69)).toBe(440);
    expect(noteFrequency(81)).toBeCloseTo(880);
  });

  it('読めない音名・長さ・ドラムは例外にする（楽譜の書き間違いに気づけるように）', () => {
    expect(() => noteNumber('H4')).toThrow();
    expect(() => partEvents({ kind: 'melody', voice: 'pulse25', volume: 0.2, notes: 'A4:0' })).toThrow();
    expect(() => partEvents({ kind: 'drums', volume: 0.5, steps: 'kx' })).toThrow();
  });

  it('音符は長さのぶんだけ進み、休み（r）は音を出さずに進む', () => {
    const parsed = partEvents({ kind: 'melody', voice: 'pulse25', volume: 0.2, notes: 'A4:2 r:1 | B4:1' });
    expect(parsed).toEqual({
      kind: 'notes',
      events: [
        { at: 0, length: 2, note: 69 },
        { at: 3, length: 1, note: 71 },
      ],
      length: 4,
    });
  });

  it('ベースは、小節ごとの根音にパターンを当てはめる', () => {
    const parsed = partEvents({ kind: 'bass', voice: 'triangle', volume: 0.4, roots: ['E2', 'A2'], pattern: [0, 12] });
    expect(parsed.events.map((event) => ('note' in event ? event.note : null))).toEqual([40, 52, 45, 57]);
    expect(parsed.length).toBe(4);
  });

  it('8分音符1つの長さは、速さから決まる（96 なら 0.3125 秒）', () => {
    expect(unitSeconds(TRACKS.field)).toBe(0.3125);
  });
});

describe('BGM のデータ（M7-3）', () => {
  const ids = Object.keys(TRACKS) as MusicId[];

  it('どの曲も読めて、大きさは 0〜1', () => {
    for (const id of ids) {
      for (const part of TRACKS[id].parts) {
        expect(() => partEvents(part), id).not.toThrow();
        expect(part.volume, id).toBeGreaterThan(0);
        expect(part.volume, id).toBeLessThanOrEqual(1);
      }
    }
    for (const drum of Object.values(DRUMS)) {
      expect(drum.volume).toBeGreaterThan(0);
      expect(drum.volume).toBeLessThanOrEqual(1);
      expect(drum.duration).toBeGreaterThan(0);
    }
  });

  it('くり返す曲は8小節で、どのパートも同じ長さ（くり返したときにずれない）', () => {
    for (const id of ids.filter((track) => TRACKS[track].loop)) {
      for (const part of TRACKS[id].parts) {
        expect(partEvents(part).length, id).toBe(64);
      }
    }
  });

  it('勝ち負けの曲はくり返さず、5秒以内に終わる', () => {
    for (const id of ['victory', 'defeat'] as const) {
      expect(TRACKS[id].loop).toBe(false);
      expect(trackLength(TRACKS[id]) * unitSeconds(TRACKS[id])).toBeLessThanOrEqual(5);
    }
  });
});

describe('場面に合う曲を選ぶ', () => {
  it('トップ・チーム選択・マップ・報酬・休憩・スカウト・イベントは旅の曲', () => {
    for (const screen of ['top', 'draft', 'map', 'reward', 'rest', 'scout', 'event'] as const) {
      expect(chooseMusic({ screen })).toBe('field');
    }
  });

  it('バトルは戦闘の曲、ボス戦はボスの曲、クロ戦は「好敵手」。決着を見せたら勝ち負けの曲', () => {
    expect(chooseMusic({ screen: 'battle', opponent: 'normal', winner: null })).toBe('battle');
    expect(chooseMusic({ screen: 'battle', opponent: 'boss', winner: null })).toBe('boss');
    expect(chooseMusic({ screen: 'battle', opponent: 'rival', winner: null })).toBe('rival');
    expect(chooseMusic({ screen: 'battle', opponent: 'boss', winner: 'player' })).toBe('victory');
    expect(chooseMusic({ screen: 'battle', opponent: 'rival', winner: 'player' })).toBe('victory');
    expect(chooseMusic({ screen: 'battle', opponent: 'normal', winner: 'enemy' })).toBe('defeat');
  });

  it('ランの結果の画面では鳴らさない', () => {
    expect(chooseMusic({ screen: 'ended' })).toBeNull();
  });
});
