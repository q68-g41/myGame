import { el } from './dom';

export interface TopScreenOptions {
  /** 画面に出すビルドの識別子（デプロイ後に最新版か確かめるため） */
  buildId: string;
  /** 「はじめる」を押したとき */
  onStart: () => void;
}

/**
 * トップ画面。上半分は表示だけ、下半分に操作できる要素を集める。
 */
export function renderTopScreen(root: HTMLElement, options: TopScreenOptions): void {
  const doc = root.ownerDocument;

  // 上半分：表示だけ
  const view = el(doc, 'section', 'screen__view');
  view.setAttribute('aria-label', '表示');

  const subtitle = el(doc, 'p', 'top__subtitle', '仮題');
  // 語の途中で折り返さないよう、2つのかたまりに分ける
  const title = el(doc, 'h1', 'top__title');
  title.append(el(doc, 'span', 'nowrap', 'ローグライト'), el(doc, 'span', 'nowrap', '対戦コマンドゲーム'));

  // 仮素材：チーム3体ぶんの色付きの四角
  const team = el(doc, 'div', 'top__team');
  team.setAttribute('aria-hidden', 'true');
  for (const variant of ['a', 'b', 'c']) {
    team.append(el(doc, 'div', `top__member top__member--${variant}`));
  }

  const message = el(doc, 'p', 'top__message', '3対3のバトルを遊べます（仮素材）');
  view.append(subtitle, title, team, message);

  // 下半分：操作領域
  const controls = el(doc, 'section', 'screen__controls');
  controls.setAttribute('aria-label', '操作');

  const startButton = el(doc, 'button', 'button button--primary', 'はじめる');
  startButton.type = 'button';
  startButton.addEventListener('click', () => options.onStart());

  const build = el(doc, 'p', 'top__build', `build: ${options.buildId}`);
  controls.append(startButton, build);

  const screen = el(doc, 'div', 'screen');
  screen.append(view, controls);
  root.replaceChildren(screen);
}
