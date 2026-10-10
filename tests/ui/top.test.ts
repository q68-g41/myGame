// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTopScreen } from '../../src/ui/top';

describe('トップ画面', () => {
  let root: HTMLElement;
  const onStart = vi.fn();
  const onToggleSound = vi.fn(() => false);

  beforeEach(() => {
    onStart.mockClear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    renderTopScreen(root, { buildId: 'abc1234', onStart, sound: true, onToggleSound });
  });

  it('タイトルを表示する', () => {
    expect(root.querySelector('h1')?.textContent).toBe('彩霊のみち');
  });

  it('彩霊3体のドット絵を、上半分に並べる', () => {
    const sprites = root.querySelectorAll<HTMLImageElement>('.screen__view img.top__member');
    expect(sprites).toHaveLength(3);
    for (const sprite of sprites) {
      expect(sprite.getAttribute('src')).toBeTruthy();
    }
  });

  it('操作できる要素は下半分（操作領域）にだけ置く', () => {
    const view = root.querySelector('.screen__view')!;
    const controls = root.querySelector('.screen__controls')!;
    const interactive = 'button, a, input, select, textarea';

    expect(view.querySelectorAll(interactive)).toHaveLength(0);
    expect(controls.querySelectorAll(interactive).length).toBeGreaterThan(0);
  });

  it('はじめから遊ぶときの案内は、今の遊び方（彩り手を選んで相棒と旅に出る）に合わせる', () => {
    expect(root.querySelector('.screen__view .top__message')?.textContent).toBe('彩り手をえらんで、相棒と旅に出ます');
  });

  it('「はじめる」をタップするとランを始める', () => {
    root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('ビルドの識別子を表示する', () => {
    expect(root.querySelector('.top__build')?.textContent).toBe('build: abc1234');
  });

  it('もう一度描画しても要素が重複しない', () => {
    renderTopScreen(root, { buildId: 'abc1234', onStart, sound: true, onToggleSound });
    expect(root.querySelectorAll('.screen')).toHaveLength(1);
  });
});
