// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { irodoriteUrl, spriteUrl } from '../../src/ui/sprites';
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

  it('上半分に、彩り手とその相棒のドット絵を2倍で並べる。「仮題」は出さない', () => {
    const irodorite = root.querySelector<HTMLImageElement>('.screen__view img.top__irodorite');
    const partner = root.querySelector<HTMLImageElement>('.screen__view img.top__partner');
    // 省いたときは一覧の1人目（ヒナとサクラシバ）
    expect(irodorite?.getAttribute('src')).toBe(irodoriteUrl('hina'));
    expect(irodorite?.getAttribute('width')).toBe('128');
    expect(partner?.getAttribute('src')).toBe(spriteUrl('hina-partner'));
    expect(partner?.getAttribute('width')).toBe('96');
    expect(root.textContent).not.toContain('仮題');
  });

  it('出す彩り手を選べる（相棒もその彩り手のもの）', () => {
    renderTopScreen(root, { buildId: 'abc1234', onStart, sound: true, onToggleSound, featured: 'kai' });
    expect(root.querySelector('img.top__irodorite')?.getAttribute('src')).toBe(irodoriteUrl('kai'));
    expect(root.querySelector('img.top__partner')?.getAttribute('src')).toBe(spriteUrl('kai-partner'));
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

  it('「はじめる」は、トップの操作領域の主なボタン（頭で ▶ を点滅させる。M7-4）', () => {
    expect(root.querySelector('.top__controls .button--primary')?.textContent).toBe('はじめる');
  });

  it('ビルドの識別子を表示する', () => {
    expect(root.querySelector('.top__build')?.textContent).toBe('build: abc1234');
  });

  it('もう一度描画しても要素が重複しない', () => {
    renderTopScreen(root, { buildId: 'abc1234', onStart, sound: true, onToggleSound });
    expect(root.querySelectorAll('.screen')).toHaveLength(1);
  });
});
