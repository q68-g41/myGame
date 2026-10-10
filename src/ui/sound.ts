/**
 * 効果音を鳴らす（仕様書 7 の M7-2）。音のデータ（src/data/sounds.ts）から、Web Audio でその場で音を作る。音のファイルは使わない。
 * ブラウザは、最初にタップするまで音を鳴らせないので、最初のタップで unlock() を呼んでから鳴らす。
 * 音が使えない環境（古いブラウザ・テスト）では、何もしない。
 */
import { MASTER_VOLUME, SOUNDS, type SoundId, type ToneDef } from '../data/sounds';

export interface SoundPlayer {
  /** 最初のタップで呼ぶ。音を鳴らせるようにする（何度呼んでもよい） */
  unlock(): void;
  /** 効果音を鳴らす。まだ鳴らせないときは何もしない */
  play(id: SoundId): void;
}

/** 何もしない（音が使えない環境やテスト用） */
export const SILENT_PLAYER: SoundPlayer = { unlock: () => undefined, play: () => undefined };

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

/** 効果音を鳴らす仕組みを作る。createContext を差し替えると、テストで使える */
export function createSoundPlayer(createContext: () => AudioContext | null = browserContext): SoundPlayer {
  let context: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  return {
    unlock: () => {
      try {
        context ??= createContext();
        if (context?.state === 'suspended') {
          context.resume().catch(() => undefined);
        }
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
  };
}
