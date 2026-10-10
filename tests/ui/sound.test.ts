// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACKS, type MusicId } from '../../src/data/music';
import { SOUNDS, type SoundId } from '../../src/data/sounds';
import { startApp } from '../../src/ui/app';
import { partEvents } from '../../src/ui/music';
import { buildFrames } from '../../src/ui/playback';
import { SETTINGS_KEY } from '../../src/ui/save';
import { playMove } from '../../src/ui/session';
import { createSoundPlayer, type SoundPlayer } from '../../src/ui/sound';
import { firstBattleSession } from '../helpers/app';

describe('効果音のデータ（M7-2）', () => {
  it('どの場面にも音の粒があり、長さは正、大きさは 0〜1', () => {
    for (const [id, tones] of Object.entries(SOUNDS)) {
      expect(tones.length, id).toBeGreaterThan(0);
      for (const tone of tones) {
        expect(tone.duration, id).toBeGreaterThan(0);
        expect(tone.volume, id).toBeGreaterThan(0);
        expect(tone.volume, id).toBeLessThanOrEqual(1);
        expect(tone.at ?? 0, id).toBeGreaterThanOrEqual(0);
        if (tone.wave !== 'noise') {
          expect(tone.from, id).toBeGreaterThan(0);
          expect(tone.to ?? tone.from, id).toBeGreaterThan(0);
        }
      }
    }
  });

  it('1つの音は1秒以内に鳴り終わる（演出のじゃまをしない）', () => {
    for (const [id, tones] of Object.entries(SOUNDS)) {
      const end = Math.max(...tones.map((tone) => (tone.at ?? 0) + tone.duration));
      expect(end, id).toBeLessThanOrEqual(1);
    }
  });
});

/** Web Audio の代わり。作った音の粒の数と、resume を呼んだかを数える。resume すると動き出す */
function fakeContext(state: AudioContextState = 'suspended') {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const counts = { oscillators: 0, noises: 0, resumed: 0 };
  const gains: { gain: ReturnType<typeof param> }[] = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const context = {
    state,
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: vi.fn(() => {
      counts.resumed += 1;
      context.state = 'running';
      return Promise.resolve();
    }),
    suspend: vi.fn(() => Promise.resolve()),
    createGain: () => {
      const gain = { ...node(), gain: param(), context };
      gains.push(gain);
      return gain;
    },
    createDelay: () => ({ ...node(), delayTime: param() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param() }),
    createPeriodicWave: () => ({}),
    createOscillator: () => {
      counts.oscillators += 1;
      return { type: 'square', frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn(), setPeriodicWave: vi.fn() };
    },
    createBufferSource: () => {
      counts.noises += 1;
      return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    },
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { context: context as unknown as AudioContext, fake: context, counts, gains };
}

describe('効果音を鳴らす仕組み', () => {
  it('音が使えない環境では、何もしない（止まらない）', () => {
    const player = createSoundPlayer(() => null);
    expect(() => {
      player.unlock();
      player.play('hit');
    }).not.toThrow();
  });

  it('最初のタップ（unlock）までは鳴らさない。unlock のあとは、音の粒の数だけ鳴らす', () => {
    const { context, counts } = fakeContext();
    const create = vi.fn(() => context);
    const player = createSoundPlayer(create);

    player.play('hit');
    expect(create).not.toHaveBeenCalled();
    expect(counts.oscillators + counts.noises).toBe(0);

    player.unlock();
    player.unlock();
    expect(create).toHaveBeenCalledTimes(1);
    // 1回目で動き出すので、2回目は resume しない
    expect(counts.resumed).toBe(1);

    for (const id of Object.keys(SOUNDS) as SoundId[]) {
      const before = counts.oscillators + counts.noises;
      player.play(id);
      expect(counts.oscillators + counts.noises - before, id).toBe(SOUNDS[id].length);
    }
  });

  it('音を作るときに例外が出ても、止まらない', () => {
    const player = createSoundPlayer(() => {
      throw new Error('使えない');
    });
    expect(() => {
      player.unlock();
      player.play('tap');
    }).not.toThrow();
  });
});

/** 曲1回ぶんで鳴らす音の数 */
const notesPerLoop = (id: MusicId) => TRACKS[id].parts.reduce((sum, part) => sum + partEvents(part).events.length, 0);

describe('BGM を鳴らす仕組み（M7-3）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('最初のタップの前に頼まれた曲は覚えておき、タップしたら鳴らし始める', () => {
    const { context, counts } = fakeContext();
    const player = createSoundPlayer(() => context);
    player.music('battle');
    expect(counts.oscillators + counts.noises).toBe(0);

    player.unlock();
    expect(counts.oscillators + counts.noises).toBe(notesPerLoop('battle'));
  });

  it('同じ曲を頼んでも、最初から鳴らし直さない', () => {
    const { context, counts } = fakeContext();
    const player = createSoundPlayer(() => context);
    player.unlock();
    player.music('field');
    const after = counts.oscillators + counts.noises;
    player.music('field');
    vi.advanceTimersByTime(1000);
    expect(counts.oscillators + counts.noises).toBe(after);
  });

  it('くり返す曲は、終わりが近づくと次の1回ぶんを予約する。くり返さない曲は1回だけ', () => {
    const { context, fake, counts } = fakeContext();
    const player = createSoundPlayer(() => context);
    player.unlock();

    player.music('battle');
    const first = counts.oscillators + counts.noises;
    fake.currentTime = 100;
    vi.advanceTimersByTime(300);
    expect(counts.oscillators + counts.noises - first).toBe(notesPerLoop('battle'));

    player.music('victory');
    const jingle = counts.oscillators + counts.noises;
    fake.currentTime = 200;
    vi.advanceTimersByTime(1000);
    expect(counts.oscillators + counts.noises).toBe(jingle);
    expect(jingle - first - notesPerLoop('battle')).toBe(notesPerLoop('victory'));
  });

  it('止めると、前の曲を小さくしていき、次の予約もしない', () => {
    const { context, fake, counts, gains } = fakeContext();
    const player = createSoundPlayer(() => context);
    player.unlock();
    const before = gains.length;
    player.music('boss');
    // 曲ごとに最初に作るのが、その曲の音の出口
    const output = gains[before]!;
    player.music(null);
    expect(output.gain.setTargetAtTime).toHaveBeenCalled();

    const stopped = counts.oscillators + counts.noises;
    fake.currentTime = 100;
    vi.advanceTimersByTime(1000);
    expect(counts.oscillators + counts.noises).toBe(stopped);
  });

  it('音が使えない環境では、何もしない（止まらない）', () => {
    const player = createSoundPlayer(() => null);
    expect(() => {
      player.unlock();
      player.music('field');
      player.music(null);
    }).not.toThrow();
  });
});

describe('アプリの効果音', () => {
  let root: HTMLElement;
  let played: SoundId[];
  let unlocks: number;
  /** BGM の切り替え（同じ曲が続くときは1つにまとめる） */
  let musics: (MusicId | null)[];
  let storage: { data: Map<string, string> } & Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  const player: SoundPlayer = {
    unlock: () => {
      unlocks += 1;
    },
    play: (id) => {
      played.push(id);
    },
    music: (id) => {
      if (musics.at(-1) !== id) {
        musics.push(id);
      }
    },
  };

  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
  }

  function open(): void {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    startApp(root, { buildId: 'test', newSeed: () => 1, storage, sound: player });
  }

  /** トップ → チーム選択 → 最初のマスまで進める */
  function enterFirstBattle(): void {
    root.querySelector<HTMLButtonElement>('.screen__controls .button--primary')!.click();
    for (const index of [0, 1, 2]) {
      root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
    }
    root.querySelector<HTMLButtonElement>('.draft__controls .button--primary')!.click();
    root.querySelector<HTMLButtonElement>('.map-choice')!.click();
  }

  const usableMove = () => root.querySelector<HTMLButtonElement>('.move-button:not([aria-disabled="true"])');

  beforeEach(() => {
    vi.useFakeTimers();
    played = [];
    unlocks = 0;
    musics = [];
    storage = memoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('画面に触れると、音を鳴らせるようにする', () => {
    open();
    root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(unlocks).toBeGreaterThan(0);
  });

  it('ボタンでピッ、マスを選ぶとピロッと鳴らす', () => {
    open();
    enterFirstBattle();
    expect(played).toEqual(['tap', 'tap', 'tap', 'tap', 'tap', 'select']);
  });

  it('技を使うと、演出のコマに合わせて音を鳴らす（技のボタン自体ではピッと鳴らさない）', () => {
    open();
    enterFirstBattle();
    played = [];

    const moveId = usableMove()!.dataset.moveId!;
    const session = playMove(firstBattleSession(), moveId);
    const expected = buildFrames(session.previousState, session.lastEvents, session.state)
      .map((frame) => frame.sound)
      .filter((sound) => sound !== null);

    usableMove()!.click();
    vi.advanceTimersByTime(5000);
    expect(played).toEqual(expected);
  });

  it('音をオフにすると鳴らさず、開き直してもオフのまま', () => {
    open();
    enterFirstBattle();
    const toggle = () => root.querySelector<HTMLButtonElement>('.sound-toggle')!;
    expect(toggle().textContent).toBe('音 オン');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');

    toggle().click();
    expect(toggle().textContent).toBe('音 オフ');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toEqual({ speed: 1, sound: false });

    played = [];
    usableMove()!.click();
    vi.advanceTimersByTime(5000);
    expect(played).toEqual([]);

    open();
    expect(root.querySelector('.sound-toggle')?.textContent).toBe('音 オフ');
    root.querySelector<HTMLButtonElement>('.screen__controls .button--primary')!.click();
    expect(played).toEqual([]);
  });

  it('トップ画面でも音のオン/オフを切り替えられる。オンにしたときは確かめのために鳴らす', () => {
    open();
    const toggle = () => root.querySelector<HTMLButtonElement>('.top__sound')!;
    toggle().click();
    expect(toggle().textContent).toBe('音 オフ');
    expect(played).toEqual([]);
    toggle().click();
    expect(toggle().textContent).toBe('音 オン');
    expect(played).toEqual(['tap']);
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toEqual({ speed: 1, sound: true });
  });

  it('トップからマップまでは旅の曲、バトルでは戦闘の曲', () => {
    open();
    expect(musics).toEqual(['field']);
    enterFirstBattle();
    expect(musics).toEqual(['field', 'battle']);
  });

  it('決着の演出まで進むと、勝ち負けの短い曲に変わる。早送りしても変わる。報酬の画面で旅の曲に戻る', () => {
    open();
    enterFirstBattle();
    for (let i = 0; i < 500 && root.querySelector('.result') === null; i += 1) {
      root.querySelector<HTMLElement>('.playback-skip')?.click();
      const target =
        root.querySelector<HTMLButtonElement>('.confirm .button--primary') ??
        usableMove() ??
        root.querySelector<HTMLButtonElement>('.bench-button:not([disabled])');
      target?.click();
      expect(musics.at(-1)).toBe('battle');
      root.querySelector<HTMLElement>('.playback-skip')?.click();
    }
    expect(root.querySelector('.result')).not.toBeNull();
    const ending = musics.at(-1);
    expect(['victory', 'defeat']).toContain(ending);
    root.querySelector<HTMLButtonElement>('.result button')!.click();
    expect(musics.at(-1)).toBe(ending === 'victory' ? 'field' : null);
  });

  it('音をオフにすると BGM も止め、オンに戻すと場面の曲を鳴らす', () => {
    open();
    enterFirstBattle();
    const toggle = () => root.querySelector<HTMLButtonElement>('.sound-toggle')!;
    toggle().click();
    expect(musics.at(-1)).toBeNull();
    toggle().click();
    expect(musics.at(-1)).toBe('battle');
  });

  it('音をオフにして開き直すと、BGM も鳴らさない', () => {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ speed: 1, sound: false }));
    open();
    expect(musics).toEqual([null]);
  });
});
