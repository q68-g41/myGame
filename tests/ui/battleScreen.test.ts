// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFighter } from '../../src/data/fighters';
import { createBattle } from '../../src/engine/battle';
import { renderBattleScreen } from '../../src/ui/battleScreen';
import { buildBattleView } from '../../src/ui/battleView';
import { createSession } from '../../src/ui/session';
import { startAppBattle } from '../helpers/app';

const INTERACTIVE = 'button, a, input, select, textarea';

let root: HTMLElement;

function startBattle(seed = 1): void {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.querySelector<HTMLElement>('#app')!;
  startAppBattle(root, seed);
}

const enabled = (selector: string) =>
  [...root.querySelectorAll<HTMLButtonElement>(selector)].filter((button) => !button.disabled);

/** 演出中なら早送りして、最終的な画面にする */
function finishPlayback(): void {
  root.querySelector<HTMLElement>('.playback-skip')?.click();
}

/**
 * 1手進める：確認が出ていれば確定、そうでなければ選べる技の先頭、なければ選べる控えの先頭をタップする。
 * 押したあとの演出は早送りする。押せるものがなければ false
 */
function tapSomething(): boolean {
  finishPlayback();
  const target =
    root.querySelector<HTMLButtonElement>('.confirm .button--primary') ??
    enabled('.move-button')[0] ??
    enabled('.bench-button')[0];
  target?.click();
  finishPlayback();
  return target !== undefined && target !== null;
}

const logText = () => root.querySelector('[role="status"]')?.textContent;
const playerName = () => root.querySelector('[data-side="player"] .fighter__name')?.textContent;

describe('バトル画面', () => {
  beforeEach(() => startBattle());

  it('上半分にいまのマス・相手・自分・ログ、下半分に技ボタン 2×2 と控え2体がある', () => {
    const view = root.querySelector('.screen__view')!;
    const controls = root.querySelector('.screen__controls')!;
    expect(view.querySelector('.battle__caption')?.textContent).toBe('エリア1・1層目・戦闘');
    expect(view.querySelector('[data-side="enemy"]')).not.toBeNull();
    expect(view.querySelector('[data-side="player"]')).not.toBeNull();
    expect(view.querySelector('[role="status"]')?.textContent).toBe('バトル開始！ 技を選んでください');
    expect(controls.querySelectorAll('.move-button')).toHaveLength(4);
    expect(controls.querySelectorAll('.bench-button')).toHaveLength(2);
  });

  it('場のキャラはドット絵を2倍で出し、相手側だけ左右反転する', () => {
    const player = root.querySelector<HTMLImageElement>('[data-side="player"] img.sprite')!;
    const enemy = root.querySelector<HTMLImageElement>('[data-side="enemy"] img.sprite')!;
    expect(player.getAttribute('width')).toBe('96');
    expect(enemy.getAttribute('width')).toBe('96');
    expect(player.classList.contains('sprite--flipped')).toBe(false);
    expect(enemy.classList.contains('sprite--flipped')).toBe(true);
  });

  it('操作できる要素は下半分（操作領域）にだけ置く', () => {
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
  });

  it('HP は自分も相手もバーと数字で出す', () => {
    for (const side of ['enemy', 'player']) {
      const panel = root.querySelector(`[data-side="${side}"]`)!;
      expect(panel.querySelector('.hp-bar__fill')).not.toBeNull();
      expect(panel.querySelector('.fighter__hp')?.textContent).toMatch(/^HP \d+ \/ \d+$/);
    }
  });

  it('技をタップするとターンが進み、ログが変わる', () => {
    const before = logText();
    enabled('.move-button')[0]!.click();
    expect(logText()).not.toBe(before);
  });

  it('控えをタップすると、技ボタンの代わりに交代の確認が出る（1タップ目）', () => {
    const bench = enabled('.bench-button')[0]!;
    const benchName = bench.querySelector('.bench-button__name')?.textContent;
    bench.click();
    expect(root.querySelector('.move-button')).toBeNull();
    expect(root.querySelector('.confirm__question')?.textContent).toBe(`${playerName()}を戻して ${benchName}と交代しますか？`);
    expect(root.querySelector('.bench-button--selected .bench-button__name')?.textContent).toBe(benchName);
    // 操作できる要素は下半分だけ
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
  });

  it('［やめる］か、同じ控えをもう一度タップすると、選択をやめて技ボタンに戻る', () => {
    enabled('.bench-button')[0]!.click();
    root.querySelector<HTMLButtonElement>('.confirm .button--secondary')!.click();
    expect(root.querySelector('.confirm')).toBeNull();
    expect(root.querySelectorAll('.move-button')).toHaveLength(4);

    enabled('.bench-button')[0]!.click();
    root.querySelector<HTMLButtonElement>('.bench-button--selected')!.click();
    expect(root.querySelector('.confirm')).toBeNull();
  });

  it('［交代する］でターンが進み、選んだ控えが場に出る（2タップ目）', () => {
    const bench = enabled('.bench-button')[1]!;
    const benchName = bench.querySelector('.bench-button__name')?.textContent;
    bench.click();
    root.querySelector<HTMLButtonElement>('.confirm .button--primary')!.click();
    expect(root.querySelector('.confirm')).toBeNull();
    // 演出の最初のコマが交代
    expect(playerName()).toBe(benchName);
    expect(logText()).toMatch(/を戻して .+を出した$/);
  });

  it('最後まで遊ぶと勝敗が出て、「次へ」で勝てば報酬、負ければランの結果に進む', () => {
    for (let i = 0; i < 300 && root.querySelector('.result') === null; i += 1) {
      expect(tapSomething()).toBe(true);
      // どの場面でも、操作できる要素は下半分だけ
      expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
    }
    const result = root.querySelector('.result');
    const text = result?.querySelector('.result__text')?.textContent;
    expect(text).toMatch(/あなたの(勝ち！|負け…)/);
    expect(result!.querySelectorAll('button')).toHaveLength(1);

    result!.querySelector<HTMLButtonElement>('button')!.click();
    if (text === 'あなたの勝ち！') {
      expect(root.querySelector('.reward')).not.toBeNull();
    } else {
      expect(root.querySelector('.run-end')).not.toBeNull();
    }
  });

  it('倒れたときは控えを選ぶ案内が出て、技は押せず、控えを2タップで出す', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      startBattle(seed);
      for (let i = 0; i < 300 && !root.querySelector('.battle--replacement') && !root.querySelector('.result'); i += 1) {
        enabled('.move-button')[0]!.click();
        finishPlayback();
      }
      if (!root.querySelector('.battle--replacement')) {
        continue;
      }
      expect(logText()).toBe('控えから次のキャラを選んでください');
      expect(enabled('.move-button')).toHaveLength(0);
      const bench = enabled('.bench-button')[0]!;
      const benchName = bench.querySelector('.bench-button__name')?.textContent;
      bench.click();
      expect(root.querySelector('.confirm__question')?.textContent).toBe(`${benchName}を出しますか？`);
      root.querySelector<HTMLButtonElement>('.confirm .button--primary')!.click();
      finishPlayback();
      expect(root.querySelector('.battle--command')).not.toBeNull();
      expect(playerName()).toBe(benchName);
      return;
    }
    throw new Error('自分が倒れる場面が見つかりませんでした');
  });
});

describe('補助技のボタン', () => {
  it('効果が2つ以上なら、語の途中ではなく「・」のところで折り返す', () => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    // アオシャチは「静水」（自分の防御↑1・相手の素早さ↓1）を覚えている
    const team = ['blue-skirmisher', 'crimson-trial', 'orange-trial'].map(getFighter);
    const session = createSession(createBattle(team, [getFighter('green-trial')]), 1);
    const handlers = {
      onMove: vi.fn(),
      onBench: vi.fn(),
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      onContinue: vi.fn(),
      onToggleSpeed: vi.fn(),
      onSkip: vi.fn(),
    };
    renderBattleScreen(root, buildBattleView(session), handlers);
    const button = root.querySelector('[data-move-id="stillwater"]')!;
    expect(button.querySelector('.move-button__power')?.textContent).toBe('防御↑1・相手の素早さ↓1');
    expect([...button.querySelectorAll('.move-button__effect')].map((part) => part.textContent)).toEqual([
      '防御↑1・',
      '相手の素早さ↓1',
    ]);
  });
});
