/**
 * BGM のデータ（仕様書 7 の M7-3）。効果音と同じく、ブラウザの機能（Web Audio）でその場で鳴らす 8bit 風の曲。音のファイルは使わない。
 * 和風に聞こえるように、日本の五音の音階（陽音階・都節）で作った。既存作品の曲に似せない（仕様書 2）。
 *
 * 書き方：
 * - 音符は「音名+オクターブ:長さ」をすき間で区切って並べる（例：`A4:2 Bb4:1`）。長さは8分音符いくつぶんか。`r` は休み。`|` は小節の区切りで、読みやすくするためだけのもの
 * - ベースは、小節ごとの根音（roots）に、1小節8つの音の高さの差（pattern、半音いくつ上か）を当てはめて作る
 * - ドラムは1小節8文字。文字の意味は DRUMS を見る。`.` は鳴らさない
 */

/** 鳴らす曲。rival はライバル・クロとの戦い（M8） */
export type MusicId = 'field' | 'battle' | 'boss' | 'rival' | 'victory' | 'defeat';

/** 音色。pulse は細い矩形波（数字は幅の％）、triangle はやわらかい三角波 */
export type Voice = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle';

/** 矩形波の幅（0〜1） */
export const PULSE_DUTY: Readonly<Record<Exclude<Voice, 'triangle'>, number>> = {
  pulse12: 0.125,
  pulse25: 0.25,
  pulse50: 0.5,
};

export interface MelodyPart {
  readonly kind: 'melody';
  readonly voice: Voice;
  /** 大きさ（0〜1） */
  readonly volume: number;
  readonly notes: string;
}

export interface BassPart {
  readonly kind: 'bass';
  readonly voice: Voice;
  readonly volume: number;
  /** 小節ごとの根音 */
  readonly roots: readonly string[];
  /** 1小節8つの、根音からの高さの差（半音） */
  readonly pattern: readonly number[];
}

export interface DrumPart {
  readonly kind: 'drums';
  readonly volume: number;
  readonly steps: string;
}

export type MusicPart = MelodyPart | BassPart | DrumPart;

export interface TrackDef {
  /** 速さ（1分間の4分音符の数） */
  readonly bpm: number;
  /** くり返すか。くり返さない曲は1回鳴らして終わる */
  readonly loop: boolean;
  /** 少し響かせるか（やまびこのように、遅れて小さく重ねる） */
  readonly echo: boolean;
  readonly parts: readonly MusicPart[];
}

/** ドラムの音 */
export type DrumKind = 'k' | 's' | 'h' | 't';

export interface DrumDef {
  /** tone：高さが下がる短い音、noise：ザッという雑音 */
  readonly wave: 'tone' | 'noise';
  /** tone の始めと終わりの高さ（Hz）。noise では、通す音の高さ（Hz） */
  readonly from: number;
  readonly to: number;
  /** 長さ（秒） */
  readonly duration: number;
  /** 大きさ（0〜1）。パートの大きさをかけて鳴らす */
  readonly volume: number;
}

export const DRUMS: Readonly<Record<DrumKind, DrumDef>> = {
  // 太鼓：低くドン
  k: { wave: 'tone', from: 140, to: 42, duration: 0.16, volume: 1 },
  // 締め太鼓：ザッ
  s: { wave: 'noise', from: 1800, to: 1800, duration: 0.13, volume: 0.8 },
  // 小さな打ち物：チッ
  h: { wave: 'noise', from: 7000, to: 7000, duration: 0.04, volume: 0.35 },
  // つづみ風：ポン
  t: { wave: 'tone', from: 520, to: 260, duration: 0.1, volume: 0.6 },
};

/** BGM 全体の大きさ。効果音（MASTER_VOLUME）より控えめにする */
export const MUSIC_VOLUME = 0.35;

/** 響き（echo）の遅れ（4分音符いくつぶんか）・くり返しの強さ・混ぜる量 */
export const ECHO = { beats: 0.75, feedback: 0.28, mix: 0.35 } as const;

export const TRACKS: Readonly<Record<MusicId, TrackDef>> = {
  // タイトル・マップ・休憩など「みちゆき」：のんびり歩く旅の曲（D の陽音階）
  field: {
    bpm: 96,
    loop: true,
    echo: true,
    parts: [
      {
        kind: 'melody',
        voice: 'pulse25',
        volume: 0.22,
        notes:
          'A4:2 B4:1 D5:1 E5:2 D5:2 | B4:2 A4:2 G4:4 | E4:2 G4:1 A4:1 B4:2 D5:2 | A4:6 r:2 | ' +
          'D5:2 E5:1 G5:1 E5:2 D5:2 | B4:2 D5:2 A4:4 | G4:2 A4:1 B4:1 A4:2 G4:1 E4:1 | D4:6 r:2',
      },
      {
        kind: 'melody',
        voice: 'triangle',
        volume: 0.4,
        notes:
          'D3:2 A3:2 D3:2 A3:2 | G2:2 D3:2 G2:2 D3:2 | E3:2 B3:2 E3:2 B3:2 | A2:2 E3:2 A2:2 E3:2 | ' +
          'D3:2 A3:2 D3:2 A3:2 | G2:2 D3:2 G2:2 D3:2 | E3:2 B3:2 A2:2 E3:2 | D3:2 A3:2 D3:4',
      },
      { kind: 'drums', volume: 0.5, steps: 't...h...|t...h...|t...h...|t...h.h.|t...h...|t...h...|t...h...|t.h.t...' },
    ],
  },
  // 戦闘「たちあい」：速くて前のめりな曲（E の都節）
  battle: {
    bpm: 152,
    loop: true,
    echo: false,
    parts: [
      {
        kind: 'melody',
        voice: 'pulse25',
        volume: 0.2,
        notes:
          'E5:1 r:1 E5:1 F5:1 A5:2 F5:1 E5:1 | C5:2 B4:1 A4:1 B4:4 | E5:1 r:1 E5:1 F5:1 A5:2 B5:1 C6:1 | B5:2 A5:2 F5:2 E5:2 | ' +
          'A5:1 B5:1 C6:2 B5:1 A5:1 F5:2 | E5:1 F5:1 A5:2 F5:1 E5:1 C5:2 | B4:1 C5:1 E5:2 F5:1 E5:1 C5:1 B4:1 | E5:4 B4:2 E4:2',
      },
      {
        kind: 'bass',
        voice: 'triangle',
        volume: 0.45,
        roots: ['E2', 'A2', 'E2', 'F2', 'A2', 'F2', 'A2', 'E2'],
        pattern: [0, 0, 12, 0, 0, 12, 0, 12],
      },
      { kind: 'drums', volume: 0.55, steps: 'khshkhsh|khshkhsh|khshkhsh|khshkhsh|khshkhsh|khshkhsh|khshkhsh|khshssss' },
    ],
  },
  // ボス戦「くすみの影」：重くて暗い曲（D の都節）
  boss: {
    bpm: 132,
    loop: true,
    echo: false,
    parts: [
      {
        kind: 'melody',
        voice: 'pulse12',
        volume: 0.22,
        notes:
          'D5:3 Eb5:1 D5:2 A4:2 | Bb4:3 A4:1 G4:4 | D5:3 Eb5:1 G5:2 A5:2 | Bb5:2 A5:2 Eb5:4 | ' +
          'G5:1 A5:1 Bb5:2 A5:1 G5:1 Eb5:2 | D5:2 Eb5:2 A4:4 | Bb4:1 A4:1 G4:2 A4:1 Bb4:1 D5:2 | D5:6 r:2',
      },
      {
        kind: 'bass',
        voice: 'triangle',
        volume: 0.5,
        roots: ['D2', 'D2', 'D2', 'D2', 'G2', 'D2', 'G2', 'D2'],
        pattern: [0, 0, 12, 0, 1, 0, 7, 0],
      },
      { kind: 'melody', voice: 'pulse50', volume: 0.07, notes: 'D4:8 | D4:8 | D4:8 | Eb4:8 | D4:8 | D4:8 | D4:8 | D4:8' },
      { kind: 'drums', volume: 0.6, steps: 'k.hks.hk|k.hks.hk|k.hks.hk|k.hks.hk|k.hks.hk|k.hks.hk|k.hks.hk|k.h.ssss' },
    ],
  },
  // ライバル・クロとの戦い「好敵手」（M8）：戦闘の曲より速く、張りつめた決闘の曲（B の都節）。
  // ほかの曲と聞き分けられるように、音の高さ・音色（主旋律は太い矩形波）・リズムを変えた
  rival: {
    bpm: 160,
    loop: true,
    echo: false,
    parts: [
      {
        kind: 'melody',
        voice: 'pulse50',
        volume: 0.13,
        notes:
          'B4:1 r:1 B4:1 C5:1 E5:2 F#5:2 | G5:3 F#5:1 E5:2 C5:2 | B4:1 r:1 B4:1 C5:1 E5:2 G5:1 F#5:1 | E5:4 r:2 B4:1 C5:1 | ' +
          'E5:2 F#5:1 G5:1 B5:3 G5:1 | F#5:2 E5:1 F#5:1 G5:2 F#5:1 E5:1 | C5:2 E5:1 C5:1 B4:2 G4:1 F#4:1 | B4:6 r:2',
      },
      {
        kind: 'melody',
        voice: 'pulse12',
        volume: 0.08,
        notes:
          'r:4 E4:2 F#4:2 | G4:4 E4:4 | r:4 E4:2 G4:2 | B4:4 r:4 | ' +
          'C5:4 B4:4 | B4:4 C5:4 | G4:4 F#4:4 | B3:6 r:2',
      },
      {
        kind: 'bass',
        voice: 'triangle',
        volume: 0.42,
        roots: ['B2', 'B2', 'E2', 'B2', 'E2', 'C3', 'C3', 'B2'],
        pattern: [0, 12, 0, 12, 7, 12, 0, 12],
      },
      { kind: 'drums', volume: 0.55, steps: 'k.hsk.hs|k.hskths|k.hsk.hs|k.hsktss|k.hsk.hs|k.hskths|k.hsk.hs|ksksssss' },
    ],
  },
  // 勝ったとき：短いファンファーレ（C の陽音階）
  victory: {
    bpm: 150,
    loop: false,
    echo: false,
    parts: [
      { kind: 'melody', voice: 'pulse25', volume: 0.22, notes: 'G4:1 A4:1 C5:1 D5:1 F5:1 G5:1 A5:2 C6:6' },
      { kind: 'melody', voice: 'pulse50', volume: 0.1, notes: 'r:6 F5:2 A5:6' },
      { kind: 'melody', voice: 'triangle', volume: 0.45, notes: 'C3:2 F2:2 G2:2 r:2 C3:6' },
      { kind: 'drums', volume: 0.5, steps: '......k.|k.......' },
    ],
  },
  // 全滅したとき：静かに下がる短い曲（A の都節）
  defeat: {
    bpm: 84,
    loop: false,
    echo: false,
    parts: [
      { kind: 'melody', voice: 'triangle', volume: 0.3, notes: 'E5:2 D5:2 Bb4:2 A4:6' },
      { kind: 'melody', voice: 'triangle', volume: 0.45, notes: 'A2:4 Bb2:2 A2:6' },
    ],
  },
};
