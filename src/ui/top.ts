import { ATTRIBUTE_COLORS } from '../data/attributes';
import { getFighter } from '../data/fighters';
import { GAME_TITLE } from '../data/labels';
import { el } from './dom';
import { spriteElement, spriteUrl } from './sprites';

/** トップ画面に並べる彩霊（紅・蒼・翠の3体） */
const TOP_TEAM = ['crimson-trial', 'blue-skirmisher', 'green-charger'] as const;

export interface TopScreenOptions {
  /** 画面に出すビルドの識別子（デプロイ後に最新版か確かめるため） */
  buildId: string;
  /** 新しいランを始める */
  onStart: () => void;
  /** 保存したランがあれば、その続きから遊ぶ。なければ省く */
  onContinue?: () => void;
}

function button(doc: Document, className: string, text: string, onClick: () => void): HTMLButtonElement {
  const element = el(doc, 'button', className, text);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

/**
 * トップ画面。上半分は表示だけ、下半分に操作できる要素を集める。
 * 保存したランがあれば「つづきから」と「はじめから」を出す。「はじめから」は保存したランが消えるので、確認してから始める。
 */
export function renderTopScreen(root: HTMLElement, options: TopScreenOptions, confirmingNewRun = false): void {
  const doc = root.ownerDocument;
  const { onContinue } = options;

  // 上半分：表示だけ
  const view = el(doc, 'section', 'screen__view');
  view.setAttribute('aria-label', '表示');

  const subtitle = el(doc, 'p', 'top__subtitle', '仮題');
  const title = el(doc, 'h1', 'top__title', GAME_TITLE);

  const team = el(doc, 'div', 'top__team');
  team.setAttribute('aria-hidden', 'true');
  for (const id of TOP_TEAM) {
    const color = ATTRIBUTE_COLORS[getFighter(id).attribute];
    team.append(spriteElement(doc, { url: spriteUrl(id), color, scale: 2, className: 'top__member' }));
  }

  const message = el(
    doc,
    'p',
    'top__message',
    onContinue ? '前回のランの続きから遊べます' : '彩霊を3体えらんで、旅に出ます',
  );
  view.append(subtitle, title, team, message);

  // 下半分：操作領域
  const controls = el(doc, 'section', 'screen__controls');
  controls.setAttribute('aria-label', '操作');

  if (onContinue === undefined) {
    controls.append(button(doc, 'button button--primary', 'はじめる', () => options.onStart()));
  } else if (confirmingNewRun) {
    controls.append(
      el(doc, 'p', 'top__confirm', 'いまのランは消えます。はじめから遊びますか？'),
      button(doc, 'button button--primary', 'はじめから遊ぶ', () => options.onStart()),
      button(doc, 'button button--secondary', 'やめる', () => renderTopScreen(root, options)),
    );
  } else {
    controls.append(
      button(doc, 'button button--primary', 'つづきから', () => onContinue()),
      button(doc, 'button button--secondary', 'はじめから', () => renderTopScreen(root, options, true)),
    );
  }

  const build = el(doc, 'p', 'top__build', `build: ${options.buildId}`);
  controls.append(build);

  const screen = el(doc, 'div', 'screen');
  screen.append(view, controls);
  root.replaceChildren(screen);
}
