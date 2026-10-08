// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTopScreen } from '../../src/ui/top';

describe('トップ画面', () => {
  let root: HTMLElement;
  const onStart = vi.fn();

  beforeEach(() => {
    onStart.mockClear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    renderTopScreen(root, { buildId: 'abc1234', onStart });
  });

  it('タイトルを表示する', () => {
    expect(root.querySelector('h1')?.textContent).toBe('ローグライト対戦コマンドゲーム');
  });

  it('操作できる要素は下半分（操作領域）にだけ置く', () => {
    const view = root.querySelector('.screen__view')!;
    const controls = root.querySelector('.screen__controls')!;
    const interactive = 'button, a, input, select, textarea';

    expect(view.querySelectorAll(interactive)).toHaveLength(0);
    expect(controls.querySelectorAll(interactive).length).toBeGreaterThan(0);
  });

  it('「はじめる」をタップするとバトルを始める', () => {
    root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('ビルドの識別子を表示する', () => {
    expect(root.querySelector('.top__build')?.textContent).toBe('build: abc1234');
  });

  it('もう一度描画しても要素が重複しない', () => {
    renderTopScreen(root, { buildId: 'abc1234', onStart });
    expect(root.querySelectorAll('.screen')).toHaveLength(1);
  });
});
