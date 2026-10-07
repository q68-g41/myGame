export interface TopScreenOptions {
  /** 画面に出すビルドの識別子（デプロイ後に最新版か確かめるため） */
  buildId: string;
}

const INITIAL_MESSAGE = '下のボタンで動作を確認できます';

/**
 * 仮のトップ画面（M0）。上半分は表示だけ、下半分に操作できる要素を集める。
 */
export function renderTopScreen(root: HTMLElement, options: TopScreenOptions): void {
  const doc = root.ownerDocument;

  const create = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text?: string,
  ): HTMLElementTagNameMap[K] => {
    const element = doc.createElement(tag);
    element.className = className;
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  };

  // 上半分：表示だけ
  const view = create('section', 'screen__view');
  view.setAttribute('aria-label', '表示');

  const subtitle = create('p', 'top__subtitle', '仮題');
  // 語の途中で折り返さないよう、2つのかたまりに分ける
  const title = create('h1', 'top__title');
  title.append(create('span', 'nowrap', 'ローグライト'), create('span', 'nowrap', '対戦コマンドゲーム'));

  // 仮素材：チーム3体ぶんの色付きの四角
  const team = create('div', 'top__team');
  team.setAttribute('aria-hidden', 'true');
  for (const variant of ['a', 'b', 'c']) {
    team.append(create('div', `top__member top__member--${variant}`));
  }

  const message = create('p', 'top__message', INITIAL_MESSAGE);
  message.setAttribute('role', 'status');

  view.append(subtitle, title, team, message);

  // 下半分：操作領域
  const controls = create('section', 'screen__controls');
  controls.setAttribute('aria-label', '操作');

  const startButton = create('button', 'button button--primary', 'はじめる');
  startButton.type = 'button';

  let tapCount = 0;
  startButton.addEventListener('click', () => {
    tapCount += 1;
    message.textContent = `準備中：バトルは M3 から遊べます（${tapCount}回目）`;
  });

  const build = create('p', 'top__build', `build: ${options.buildId}`);

  controls.append(startButton, build);

  const screen = create('div', 'screen');
  screen.append(view, controls);
  root.replaceChildren(screen);
}
