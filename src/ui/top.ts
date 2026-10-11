import { ATTRIBUTE_COLORS } from '../data/attributes';
import { getIrodorite, IRODORITE } from '../data/irodorite';
import { GAME_TITLE } from '../data/labels';
import { el } from './dom';
import { irodoriteElement, irodoriteUrl, spriteElement, spriteUrl } from './sprites';

export interface TopScreenOptions {
  /** 画面に出すビルドの識別子（デプロイ後に最新版か確かめるため） */
  buildId: string;
  /** 新しいランを始める */
  onStart: () => void;
  /** 保存したランがあれば、その続きから遊ぶ。なければ省く */
  onContinue?: () => void;
  /** 音（効果音と BGM）を鳴らすか */
  sound: boolean;
  /** 音（効果音と BGM）のオン ⇔ オフを切り替える。切り替えたあとの状態を返す */
  onToggleSound: () => boolean;
  /** 上半分に、相棒と並べて出す彩り手の ID。省くと一覧の1人目 */
  featured?: string;
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

  const title = el(doc, 'h1', 'top__title', GAME_TITLE);

  // 彩り手と、その相棒の彩霊を、どちらも2倍で並べる（足もとをそろえる）
  const featured = getIrodorite(options.featured ?? IRODORITE[0]!.id);
  const color = ATTRIBUTE_COLORS[featured.partner.attribute];
  const scene = el(doc, 'div', 'top__scene');
  scene.setAttribute('aria-hidden', 'true');
  scene.append(
    irodoriteElement(doc, { url: irodoriteUrl(featured.id), color, scale: 2, className: 'top__irodorite' }),
    spriteElement(doc, { url: spriteUrl(featured.partner.id), color, scale: 2, className: 'top__partner' }),
  );

  const message = el(
    doc,
    'p',
    'top__message',
    onContinue ? '前回のランの続きから遊べます' : '彩り手をえらんで、相棒と旅に出ます',
  );
  view.append(title, scene, message);

  // 下半分：操作領域
  const controls = el(doc, 'section', 'screen__controls top__controls');
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

  // 音（効果音と BGM）のオン/オフ（設定として保存する。M7-2・M7-3）
  const sound = button(doc, 'menu__button sound-toggle top__sound', options.sound ? '音 オン' : '音 オフ', () => {
    renderTopScreen(root, { ...options, sound: options.onToggleSound() }, confirmingNewRun);
  });
  sound.setAttribute('aria-pressed', String(options.sound));
  sound.setAttribute('aria-label', `効果音と BGM（いまは${options.sound ? 'オン' : 'オフ'}）`);

  const build = el(doc, 'p', 'top__build', `build: ${options.buildId}`);
  controls.append(sound, build);

  const screen = el(doc, 'div', 'screen');
  screen.append(view, controls);
  root.replaceChildren(screen);
}
