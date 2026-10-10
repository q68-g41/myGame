/**
 * 効果音と BGM を鳴らす（仕様書 7 の M7-2・M7-3）。音のデータ（src/data/sounds.ts・src/data/music.ts）から、Web Audio でその場で音を作る。音のファイルは使わない。
 * ブラウザは、最初にタップするまで音を鳴らせないので、最初のタップで unlock() を呼んでから鳴らす。
 * 音が使えない環境（古いブラウザ・テスト）では、何もしない。
 */
import { DRUMS, ECHO, MUSIC_VOLUME, PULSE_DUTY, TRACKS, type DrumKind, type MusicId, type TrackDef, type Voice } from '../data/music';
import { MASTER_VOLUME, SOUNDS, type SoundId, type ToneDef } from '../data/sounds';
import { noteFrequency, partEvents, unitSeconds } from './music';

export interface SoundPlayer {
  /** 最初のタップで呼ぶ。音を鳴らせるようにする（何度呼んでもよい） */
  unlock(): void;
  /** 効果音を鳴らす。まだ鳴らせないときは何もしない */
  play(id: SoundId): void;
  /**
   * BGM を切り替える。null なら止める。いま鳴っている曲と同じなら、そのまま続ける。
   * まだ鳴らせないとき（最初のタップの前）は覚えておき、鳴らせるようになったら始める
   */
  music(id: MusicId | null): void;
}

/** 何もしない（音が使えない環境やテスト用） */
export const SILENT_PLAYER: SoundPlayer = { unlock: () => undefined, play: () => undefined, music: () => undefined };

/** BGM の音を、どれだけ先まで予約しておくか（秒）。画面の処理で少し遅れても、音が途切れないようにする */
const MUSIC_LOOKAHEAD_S = 1;
/** 次の予約が要るかを確かめる間隔 */
const MUSIC_TICK_MS = 250;
/** 曲を切り替えるとき、前の曲を消していく速さ（秒） */
const MUSIC_FADE_S = 0.05;

/** ブラウザの AudioContext を作る。使えなければ null */
function browserContext(): AudioContext | null {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  return Context === undefined ? null : new Context();
}

/** ザッという雑音の元（0.5秒）。同じ音になるように、決まった並びの乱数で作る */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.5);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

/** 細い矩形波（ファミコン風の音色）を作る */
function pulseWave(context: AudioContext, duty: number): PeriodicWave {
  const size = 64;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  for (let k = 1; k < size; k += 1) {
    real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  }
  return context.createPeriodicWave(real, imag);
}

/** 音の粒を1つ鳴らす。小さく始めて、すぐ大きくし、最後に消える（プツッという音を防ぐ） */
function playTone(context: AudioContext, tone: ToneDef, noise: () => AudioBuffer): void {
  const start = context.currentTime + (tone.at ?? 0);
  const end = start + tone.duration;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.volume * MASTER_VOLUME), start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(context.destination);

  if (tone.wave === 'noise') {
    const source = context.createBufferSource();
    source.buffer = noise();
    source.connect(gain);
    source.start(start);
    source.stop(end);
    return;
  }
  const oscillator = context.createOscillator();
  oscillator.type = tone.wave;
  oscillator.frequency.setValueAtTime(tone.from, start);
  if (tone.to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
  }
  oscillator.connect(gain);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

/** BGM を鳴らすのに使う道具 */
interface MusicTools {
  readonly context: AudioContext;
  readonly noise: () => AudioBuffer;
  readonly wave: (voice: Exclude<Voice, 'triangle'>) => PeriodicWave;
}

/** BGM の音符を1つ鳴らす予約をする */
function scheduleNote(
  tools: MusicTools,
  bus: AudioNode,
  voice: Voice,
  frequency: number,
  start: number,
  length: number,
  volume: number,
): void {
  const { context } = tools;
  const oscillator = context.createOscillator();
  if (voice === 'triangle') {
    oscillator.type = 'triangle';
  } else {
    oscillator.setPeriodicWave(tools.wave(voice));
  }
  oscillator.frequency.setValueAtTime(frequency, start);
  // 三角波（ベース）は短めに切って、音の粒を立たせる
  const end = start + length * (voice === 'triangle' ? 0.8 : 0.9);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(volume * 0.6, start + Math.min(0.25, length * 0.6));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(bus);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

/** BGM のドラムを1つ鳴らす予約をする */
function scheduleDrum(tools: MusicTools, bus: AudioNode, kind: DrumKind, start: number, volume: number): void {
  const { context } = tools;
  const drum = DRUMS[kind];
  const end = start + drum.duration;
  const gain = context.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, volume * drum.volume), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(bus);
  if (drum.wave === 'tone') {
    const oscillator = context.createOscillator();
    oscillator.type = kind === 'k' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(drum.from, start);
    oscillator.frequency.exponentialRampToValueAtTime(drum.to, end);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
    return;
  }
  const source = context.createBufferSource();
  source.buffer = tools.noise();
  const filter = context.createBiquadFilter();
  filter.type = kind === 'h' ? 'highpass' : 'bandpass';
  filter.frequency.value = drum.from;
  source.connect(filter);
  filter.connect(gain);
  source.start(start);
  source.stop(end + 0.02);
}

/** 曲1回ぶんを、start（秒）から鳴らす予約をする。1回ぶんの長さ（秒）を返す */
function scheduleTrack(tools: MusicTools, bus: AudioNode, track: TrackDef, start: number): number {
  const unit = unitSeconds(track);
  let length = 0;
  for (const part of track.parts) {
    const parsed = partEvents(part);
    length = Math.max(length, parsed.length);
    if (parsed.kind === 'drums') {
      for (const drum of parsed.events) {
        scheduleDrum(tools, bus, drum.kind, start + drum.at * unit, part.volume);
      }
    } else if (part.kind !== 'drums') {
      for (const note of parsed.events) {
        scheduleNote(tools, bus, part.voice, noteFrequency(note.note), start + note.at * unit, note.length * unit, part.volume);
      }
    }
  }
  return length * unit;
}

/** 鳴っている BGM */
interface PlayingMusic {
  readonly id: MusicId;
  /** この曲の音の出口 */
  readonly output: GainNode;
  /** 次の1回ぶんを鳴らし始める時刻（秒） */
  next: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** 効果音と BGM を鳴らす仕組みを作る。createContext を差し替えると、テストで使える */
export function createSoundPlayer(createContext: () => AudioContext | null = browserContext): SoundPlayer {
  let context: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  const waves = new Map<string, PeriodicWave>();
  /** 鳴らしたい曲（最初のタップの前でも覚えておく） */
  let wanted: MusicId | null = null;
  let playing: PlayingMusic | null = null;

  const toolsFor = (current: AudioContext): MusicTools => ({
    context: current,
    noise: () => (noise ??= noiseBuffer(current)),
    wave: (voice) => {
      let wave = waves.get(voice);
      if (wave === undefined) {
        wave = pulseWave(current, PULSE_DUTY[voice]);
        waves.set(voice, wave);
      }
      return wave;
    },
  });

  const stopMusic = () => {
    if (playing === null) {
      return;
    }
    const { output, timer } = playing;
    if (timer !== null) {
      clearTimeout(timer);
    }
    playing = null;
    try {
      output.gain.setTargetAtTime(0, output.context.currentTime, MUSIC_FADE_S);
      setTimeout(() => output.disconnect(), MUSIC_FADE_S * 8 * 1000);
    } catch {
      // 止められなくても、ゲームは止めない
    }
  };

  const startMusic = (current: AudioContext, id: MusicId) => {
    const track = TRACKS[id];
    const tools = toolsFor(current);
    // 音符は bus に、bus と響きは output にまとめる。止めるときは output を消していく
    const output = current.createGain();
    output.gain.value = MUSIC_VOLUME;
    output.connect(current.destination);
    const bus = current.createGain();
    bus.connect(output);
    if (track.echo) {
      const delay = current.createDelay(1);
      delay.delayTime.value = (60 / track.bpm) * ECHO.beats;
      const feedback = current.createGain();
      feedback.gain.value = ECHO.feedback;
      const wet = current.createGain();
      wet.gain.value = ECHO.mix;
      bus.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(output);
    }
    const state: PlayingMusic = { id, output, next: 0, timer: null };
    playing = state;
    // 少し先まで予約しておき、残りが少なくなったら次の1回ぶんを予約する。止まっている（画面を閉じている）あいだは予約しない
    const tick = () => {
      if (playing !== state) {
        return;
      }
      if (current.state === 'running' && current.currentTime > state.next - MUSIC_LOOKAHEAD_S) {
        const start = Math.max(state.next, current.currentTime + 0.05);
        state.next = start + scheduleTrack(tools, bus, track, start);
        if (!track.loop) {
          state.timer = null;
          return;
        }
      }
      state.timer = setTimeout(tick, MUSIC_TICK_MS);
    };
    tick();
  };

  /** 鳴らしたい曲に合わせる */
  const syncMusic = () => {
    if (context === null || context.state === 'closed' || playing?.id === wanted) {
      return;
    }
    stopMusic();
    if (wanted !== null) {
      try {
        startMusic(context, wanted);
      } catch {
        // 鳴らせなくても、ゲームは止めない
      }
    }
  };

  return {
    unlock: () => {
      try {
        if (context === null) {
          context = createContext();
          // 画面を閉じているあいだは音を止め、戻ってきたら続ける
          const current = context;
          if (current !== null && typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
              const action = document.hidden ? current.suspend() : current.resume();
              action.catch(() => undefined);
            });
          }
        }
        if (context?.state === 'suspended') {
          context.resume().catch(() => undefined);
        }
        syncMusic();
      } catch {
        context = null;
      }
    },
    play: (id) => {
      if (context === null || context.state === 'closed') {
        return;
      }
      const current = context;
      try {
        for (const tone of SOUNDS[id]) {
          playTone(current, tone, () => (noise ??= noiseBuffer(current)));
        }
      } catch {
        // 音が鳴らせなくても、ゲームは止めない
      }
    },
    music: (id) => {
      wanted = id;
      syncMusic();
    },
  };
}
