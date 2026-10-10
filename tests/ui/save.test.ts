// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RUN_CONTENT } from '../../src/data/content';
import { getIrodorite } from '../../src/data/irodorite';
import { chooseTeam, startRun } from '../../src/engine/run';
import { startApp } from '../../src/ui/app';
import {
  createSaveStore,
  createSettingsStore,
  DEFAULT_SETTINGS,
  parseSavedGame,
  parseSettings,
  SAVE_KEY,
  SAVE_VERSION,
  serializeGame,
  SETTINGS_KEY,
} from '../../src/ui/save';
import { playMove } from '../../src/ui/session';
import { renderTopScreen } from '../../src/ui/top';
import { firstBattleSession } from '../helpers/app';

/** テスト用の保存先（localStorage と同じ形） */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe('保存の形', () => {
  const run = chooseTeam(startRun(RUN_CONTENT, 3), [0, 1, 2]);

  it('ランの状態を保存して、そのまま読み戻せる', () => {
    expect(parseSavedGame(serializeGame(run, null))).toEqual({ run, battle: null });
  });

  it('戦闘中は、バトルの状態・乱数・素早さが分かった相手も保存する', () => {
    const session = playMove(firstBattleSession(), firstBattleSession().state.sides.player.team[0]!.moves[0]!.id);
    const battleRun = { ...run, phase: { kind: 'battle' as const, enemy: [], cpu: 1 as const, boss: null, seed: 1 } };
    const saved = parseSavedGame(serializeGame(battleRun, session));
    expect(saved?.battle).toEqual({
      state: session.state,
      rng: session.rng,
      knownEnemySpeeds: [...session.knownEnemySpeeds],
    });
  });

  it('読めない・版が違う・形がおかしい・ランが終わっているセーブは捨てる（null）', () => {
    expect(parseSavedGame(null)).toBeNull();
    expect(parseSavedGame('{壊れた')).toBeNull();
    expect(parseSavedGame(JSON.stringify({ version: SAVE_VERSION + 1, run, battle: null }))).toBeNull();
    expect(parseSavedGame(JSON.stringify({ version: SAVE_VERSION, run: { phase: { kind: 'map' } }, battle: null }))).toBeNull();
    const ended = { ...run, phase: { kind: 'ended', result: 'defeated' } };
    expect(parseSavedGame(JSON.stringify({ version: SAVE_VERSION, run: ended, battle: null }))).toBeNull();
    // 戦闘中なのにバトルがない、戦闘中でないのにバトルがある
    const battleRun = { ...run, phase: { kind: 'battle', enemy: [], seed: 1 } };
    expect(parseSavedGame(JSON.stringify({ version: SAVE_VERSION, run: battleRun, battle: null }))).toBeNull();
  });

  it('彩り手を選んだランも保存して読み戻せる。彩り手を持たない前の形（版4）のセーブは捨てる', () => {
    const withIrodorite = chooseTeam(startRun(RUN_CONTENT, 3, getIrodorite('hina')), [0, 1]);
    expect(parseSavedGame(serializeGame(withIrodorite, null))).toEqual({ run: withIrodorite, battle: null });
    const { irodorite: _dropped, ...oldRun } = run;
    expect(parseSavedGame(JSON.stringify({ version: 4, run: oldRun, battle: null }))).toBeNull();
    expect(parseSavedGame(JSON.stringify({ version: SAVE_VERSION, run: oldRun, battle: null }))).toBeNull();
  });

  it('音の設定がない（M7-2 より前の）保存は、音をオンとして読む。音の値がおかしいときもオン', () => {
    expect(parseSettings('{"speed":2}')).toEqual({ speed: 2, sound: true });
    expect(parseSettings('{"speed":1,"sound":false}')).toEqual({ speed: 1, sound: false });
    expect(parseSettings('{"speed":1,"sound":"off"}')).toEqual({ speed: 1, sound: true });
  });

  it('保存先が使えなくても（例外を出しても）止まらない', () => {
    const broken = {
      getItem: () => {
        throw new Error('使えない');
      },
      setItem: () => {
        throw new Error('いっぱい');
      },
      removeItem: () => {
        throw new Error('使えない');
      },
    };
    const store = createSaveStore(broken);
    expect(store.load()).toBeNull();
    expect(() => store.save(run, null)).not.toThrow();
    expect(() => store.clear()).not.toThrow();
    expect(createSaveStore(null).load()).toBeNull();
  });
});

describe('トップ画面（保存したランがあるとき）', () => {
  let root: HTMLElement;
  const onStart = vi.fn();
  const onContinue = vi.fn();
  const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('.screen__controls button:not(.sound-toggle)')].map((b) => b.textContent);

  beforeEach(() => {
    onStart.mockClear();
    onContinue.mockClear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    renderTopScreen(root, { buildId: 'test', onStart, onContinue, sound: true, onToggleSound: () => true });
  });

  it('「つづきから」と「はじめから」を出す', () => {
    expect(buttons()).toEqual(['つづきから', 'はじめから']);
    root.querySelector<HTMLButtonElement>('.button--primary')!.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('「はじめから」は、ランが消えることを確認してから始める。「やめる」で戻れる', () => {
    root.querySelector<HTMLButtonElement>('.button--secondary')!.click();
    expect(onStart).not.toHaveBeenCalled();
    expect(root.querySelector('.top__confirm')?.textContent).toBe('いまのランは消えます。はじめから遊びますか？');
    expect(buttons()).toEqual(['はじめから遊ぶ', 'やめる']);
    root.querySelector<HTMLButtonElement>('.button--secondary')!.click();
    expect(buttons()).toEqual(['つづきから', 'はじめから']);

    root.querySelector<HTMLButtonElement>('.button--secondary')!.click();
    root.querySelector<HTMLButtonElement>('.button--primary')!.click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('自動保存と再開（アプリ）', () => {
  let root: HTMLElement;
  let storage: ReturnType<typeof memoryStorage>;

  /** 同じ保存先で、アプリを開き直す（アプリを閉じて、また開いたつもり） */
  function reopen(seed = 1): void {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    startApp(root, { buildId: 'test', newSeed: () => seed, storage });
  }

  const tap = (selector: string) => root.querySelector<HTMLButtonElement>(selector)!.click();
  const skip = () => root.querySelector<HTMLElement>('.playback-skip')?.click();

  beforeEach(() => {
    storage = memoryStorage();
    reopen();
  });

  it('はじめは保存したランがないので「はじめる」だけ', () => {
    expect([...root.querySelectorAll('.screen__controls button:not(.sound-toggle)')].map((b) => b.textContent)).toEqual(['はじめる']);
  });

  it('マップで閉じても、同じマップの同じ場所から再開できる', () => {
    tap('.screen__controls button');
    for (const index of [2, 0, 4]) {
      root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
    }
    tap('.draft__controls .button--primary');
    const team = [...root.querySelectorAll('.member__name')].map((n) => n.textContent);
    const map = root.querySelector('.map')!.innerHTML;

    reopen(999);
    tap('.screen__controls .button--primary');
    expect([...root.querySelectorAll('.member__name')].map((n) => n.textContent)).toEqual(team);
    expect(root.querySelector('.map')!.innerHTML).toBe(map);
  });

  it('マップで並び順を入れ替えたら、閉じて開き直しても入れ替えた順のまま', () => {
    tap('.screen__controls button');
    for (const index of [0, 1, 2]) {
      root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
    }
    tap('.draft__controls .button--primary');
    const members = () => [...root.querySelectorAll<HTMLButtonElement>('button.member')];
    const names = () => [...root.querySelectorAll('.member__name')].map((n) => n.textContent);
    const before = names();
    members()[0]!.click();
    members()[2]!.click();
    expect(names()).toEqual([before[2], before[1], before[0]]);

    reopen(999);
    tap('.screen__controls .button--primary');
    expect(names()).toEqual([before[2], before[1], before[0]]);
  });

  it('戦闘中に閉じても、同じターン・同じHPから再開でき、そのあとの展開も閉じなかったときと同じ', () => {
    tap('.screen__controls button');
    for (const index of [0, 1, 2]) {
      root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
    }
    tap('.draft__controls .button--primary');
    tap('.map-choice');
    tap('.move-button:not([aria-disabled="true"])');
    skip();
    const hpAfterTurn1 = [...root.querySelectorAll('.fighter__hp')].map((hp) => hp.textContent);

    // 閉じずに、もう1ターン進めた結果
    tap('.move-button:not([aria-disabled="true"])');
    skip();
    const expected = root.querySelector('.screen__view')!.innerHTML;

    // 1ターン目のあとに閉じた、とするために保存をやり直す
    storage = memoryStorage();
    reopen();
    tap('.screen__controls button');
    for (const index of [0, 1, 2]) {
      root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
    }
    tap('.draft__controls .button--primary');
    tap('.map-choice');
    tap('.move-button:not([aria-disabled="true"])');
    skip();

    reopen(999);
    tap('.screen__controls .button--primary');
    expect([...root.querySelectorAll('.fighter__hp')].map((hp) => hp.textContent)).toEqual(hpAfterTurn1);
    expect(root.querySelector('[role="status"]')?.textContent).toBe('続きから。技を選んでください');
    tap('.move-button:not([aria-disabled="true"])');
    skip();
    expect(root.querySelector('.screen__view')!.innerHTML).toBe(expected);
  });

  it('ランが終わったら、保存したランは消える', () => {
    tap('.screen__controls button');
    for (const index of [0, 1, 2]) {
      root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
    }
    tap('.draft__controls .button--primary');
    expect(storage.data.has(SAVE_KEY)).toBe(true);
    for (let step = 0; step < 300 && !root.querySelector('.run-end'); step += 1) {
      if (root.querySelector('.map-screen')) {
        tap('.map-choice');
      } else if (root.querySelector('.reward')) {
        tap('.reward-offer');
        tap('.reward__controls .button--primary');
        // 技なら、覚えさせるキャラと忘れる技も選ぶ
        root.querySelector<HTMLButtonElement>('.reward-members .reward-option:not([disabled])')?.click();
        root.querySelector<HTMLButtonElement>('.reward-forgets .reward-option:not([disabled])')?.click();
      } else if (root.querySelector('.rest') || root.querySelector('.event')) {
        tap('.node-option');
        tap('.screen__controls .button--primary');
        root.querySelector<HTMLButtonElement>('.node-members .node-pick')?.click();
        root.querySelector<HTMLButtonElement>('.node-moves .node-pick:not([disabled])')?.click();
        if (root.querySelector('.event-result')) {
          tap('.screen__controls .button--primary');
        }
      } else if (root.querySelector('.scout')) {
        tap('.screen__controls .button--secondary');
      } else if (root.querySelector('.result')) {
        tap('.result button');
      } else {
        skip();
        (
          root.querySelector<HTMLButtonElement>('.confirm .button--primary') ??
          root.querySelector<HTMLButtonElement>('.move-button:not([aria-disabled="true"])') ??
          root.querySelector<HTMLButtonElement>('.bench-button:not([disabled])')
        )?.click();
        skip();
      }
    }
    expect(root.querySelector('.run-end')).not.toBeNull();
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    reopen();
    expect([...root.querySelectorAll('.screen__controls button:not(.sound-toggle)')].map((b) => b.textContent)).toEqual(['はじめる']);
  });

  it('読めないセーブは捨てて、トップに戻る', () => {
    const run = chooseTeam(startRun(RUN_CONTENT, 1), [0, 1, 2]);
    // 形は合っているが、データにないキャラが入っている（画面を作るときにエラーになる）
    const broken = { ...run, team: run.team.map((m) => ({ ...m, fighter: { ...m.fighter, id: 'unknown' } })) };
    storage = memoryStorage({ [SAVE_KEY]: serializeGame(broken, null) });
    reopen();
    tap('.screen__controls .button--primary');
    expect(root.querySelector('h1')).not.toBeNull();
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    expect([...root.querySelectorAll('.screen__controls button:not(.sound-toggle)')].map((b) => b.textContent)).toEqual(['はじめる']);
  });
});

describe('保存のキー', () => {
  it('itch.io ではほかのゲームと同じドメインで動くので、ゲームの名前で始める', () => {
    expect(SAVE_KEY.startsWith('sairei-no-michi.')).toBe(true);
    expect(SETTINGS_KEY.startsWith('sairei-no-michi.')).toBe(true);
    expect(SAVE_KEY).not.toBe(SETTINGS_KEY);
  });
});

describe('設定（演出の速さ・音）の保存', () => {
  it('保存した設定を読み戻せる。読めない・形がおかしいときは最初の設定（×1）', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
    store.save({ speed: 2, sound: false });
    expect(store.load()).toEqual({ speed: 2, sound: false });
    for (const text of [null, '{', '{"speed":3}', '[]', '"2"']) {
      expect(parseSettings(text)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('保存先が使えなくても（例外を出しても）止まらない', () => {
    const broken = {
      getItem: () => {
        throw new Error('使えない');
      },
      setItem: () => {
        throw new Error('使えない');
      },
    };
    const store = createSettingsStore(broken);
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
    expect(() => store.save({ speed: 2, sound: true })).not.toThrow();
  });

  it('バトルで2倍速にすると、開き直しても2倍速のまま。ランの保存を消しても残る', () => {
    const storage = memoryStorage();
    const open = () => {
      document.body.innerHTML = '<div id="app"></div>';
      const root = document.querySelector<HTMLElement>('#app')!;
      startApp(root, { buildId: 'test', newSeed: () => 1, storage });
      return root;
    };
    let root = open();
    root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
    for (const index of [0, 1, 2]) {
      root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
    }
    root.querySelector<HTMLButtonElement>('.draft__controls .button--primary')!.click();
    root.querySelector<HTMLButtonElement>('.map-choice')!.click();
    expect(root.querySelector('.menu__button')?.textContent).toBe('速さ ×1');
    root.querySelector<HTMLButtonElement>('.menu__button')!.click();
    expect(root.querySelector('.menu__button')?.textContent).toBe('速さ ×2');
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toEqual({ speed: 2, sound: true });

    // 開き直して、つづきから
    root = open();
    root.querySelector<HTMLButtonElement>('.screen__controls .button--primary')!.click();
    expect(root.querySelector('.menu__button')?.textContent).toBe('速さ ×2');

    // ランの保存を消しても（ランが終わったときなど）、設定は残る
    createSaveStore(storage).clear();
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    expect(storage.data.has(SETTINGS_KEY)).toBe(true);
  });
});
