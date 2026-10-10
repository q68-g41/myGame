// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOUNDS, type SoundId } from '../../src/data/sounds';
import { startApp } from '../../src/ui/app';
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

/** Web Audio の代わり。作った音の粒の数と、resume を呼んだかを数える */
function fakeContext(state: AudioContextState = 'suspended') {
  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const counts = { oscillators: 0, noises: 0, resumed: 0 };
  const context = {
    state,
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: vi.fn(() => {
      counts.resumed += 1;
      return Promise.resolve();
    }),
    createGain: () => ({ gain: param(), connect: vi.fn() }),
    createOscillator: () => {
      counts.oscillators += 1;
      return { type: 'square', frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    },
    createBufferSource: () => {
      counts.noises += 1;
      return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    },
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { context: context as unknown as AudioContext, counts };
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
    expect(counts.resumed).toBe(2);

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

describe('アプリの効果音', () => {
  let root: HTMLElement;
  let played: SoundId[];
  let unlocks: number;
  let storage: { data: Map<string, string> } & Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  const player: SoundPlayer = {
    unlock: () => {
      unlocks += 1;
    },
    play: (id) => {
      played.push(id);
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

  it('早送りしても、勝ち負けの音は鳴らす', () => {
    open();
    enterFirstBattle();
    for (let i = 0; i < 500 && root.querySelector('.result') === null; i += 1) {
      root.querySelector<HTMLElement>('.playback-skip')?.click();
      const target =
        root.querySelector<HTMLButtonElement>('.confirm .button--primary') ??
        usableMove() ??
        root.querySelector<HTMLButtonElement>('.bench-button:not([disabled])');
      target?.click();
      root.querySelector<HTMLElement>('.playback-skip')?.click();
    }
    expect(root.querySelector('.result')).not.toBeNull();
    expect(played.filter((id) => id === 'win' || id === 'lose')).toHaveLength(1);
  });
});
