// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp } from '../../src/ui/app';

const INTERACTIVE = 'button, a, input, select, textarea';

let root: HTMLElement;

function startBattle(seed = 1): void {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.querySelector<HTMLElement>('#app')!;
  startApp(root, { buildId: 'test', newSeed: () => seed });
  root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
}

const enabled = (selector: string) =>
  [...root.querySelectorAll<HTMLButtonElement>(selector)].filter((button) => !button.disabled);

/** 選べる技の先頭、または選べる控えの先頭をタップする。押せるものがなければ false */
function tapSomething(): boolean {
  const target = enabled('.move-button')[0] ?? enabled('.bench-button')[0];
  target?.click();
  return target !== undefined;
}

describe('バトル画面', () => {
  beforeEach(() => startBattle());

  it('上半分に相手・自分・ログ、下半分に技ボタン 2×2 と控え2体がある', () => {
    const view = root.querySelector('.screen__view')!;
    const controls = root.querySelector('.screen__controls')!;
    expect(view.querySelector('[data-side="enemy"]')).not.toBeNull();
    expect(view.querySelector('[data-side="player"]')).not.toBeNull();
    expect(view.querySelector('[role="status"]')?.textContent).toBe('バトル開始！ 技を選んでください');
    expect(controls.querySelectorAll('.move-button')).toHaveLength(4);
    expect(controls.querySelectorAll('.bench-button')).toHaveLength(2);
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
    const before = root.querySelector('[role="status"]')?.textContent;
    enabled('.move-button')[0]!.click();
    expect(root.querySelector('[role="status"]')?.textContent).not.toBe(before);
  });

  it('控えは、倒れて選ぶとき以外はタップできない', () => {
    expect(enabled('.bench-button')).toHaveLength(0);
  });

  it('最後まで遊ぶと勝敗が出て、「もう一度」と「タイトルへ」が押せる', () => {
    for (let i = 0; i < 300 && root.querySelector('.result') === null; i += 1) {
      expect(tapSomething()).toBe(true);
      // どの場面でも、操作できる要素は下半分だけ
      expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
    }
    const result = root.querySelector('.result');
    expect(result?.querySelector('.result__text')?.textContent).toMatch(/あなたの(勝ち！|負け…)/);

    result!.querySelectorAll<HTMLButtonElement>('button')[0]!.click();
    expect(root.querySelector('[role="status"]')?.textContent).toBe('バトル開始！ 技を選んでください');

    for (let i = 0; i < 300 && root.querySelector('.result') === null; i += 1) {
      tapSomething();
    }
    root.querySelectorAll<HTMLButtonElement>('.result button')[1]!.click();
    expect(root.querySelector('h1')?.textContent).toBe('ローグライト対戦コマンドゲーム');
  });

  it('倒れたときは控えを選ぶ案内が出て、技は押せず控えだけ押せる', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      startBattle(seed);
      for (let i = 0; i < 300 && !root.querySelector('.battle--replacement') && !root.querySelector('.result'); i += 1) {
        enabled('.move-button')[0]!.click();
      }
      if (!root.querySelector('.battle--replacement')) {
        continue;
      }
      expect(root.querySelector('[role="status"]')?.textContent).toBe('控えから次のキャラを選んでください');
      expect(enabled('.move-button')).toHaveLength(0);
      expect(enabled('.bench-button').length).toBeGreaterThan(0);
      enabled('.bench-button')[0]!.click();
      expect(root.querySelector('.battle--command')).not.toBeNull();
      return;
    }
    throw new Error('自分が倒れる場面が見つかりませんでした');
  });
});
