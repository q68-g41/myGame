/**
 * 彩り手を選ぶ画面（仕様書 4.6・5）。上半分は表示だけ、操作は下半分に集める。
 * 表示する内容は irodoriteView.ts で組み立て、ここでは描くだけにする。
 */
import { el } from './dom';
import type { IrodoriteSelectView } from './irodoriteView';
import { button, fighterDetailCard, screen } from './runScreens';
import { irodoriteElement } from './sprites';

export interface IrodoriteScreenHandlers {
  /** 一覧の彩り手をタップした */
  onSelect(index: number): void;
  /** 選んでいる彩り手で進む（チーム選択へ） */
  onConfirm(): void;
}

export function renderIrodoriteScreen(root: HTMLElement, view: IrodoriteSelectView, handlers: IrodoriteScreenHandlers): void {
  const doc = root.ownerDocument;
  const { detail } = view;
  // 選び直すたびに画面を作り直すので、一覧のスクロール位置を引き継ぐ（下の方の彩り手を選んでも、一覧が先頭に戻らないように）
  const scrollTop = root.querySelector('.irodorite-choices')?.scrollTop ?? 0;

  // 上半分：選んでいる彩り手（絵・あだ名・口ぐせ・特性）と、相棒の詳細（属性の前に「相棒」と出す）。
  // 基準の画面で上半分に収めるため、見出しと案内は下半分に置く。口ぐせと特性が2行ずつになっても収まるように、
  // 相棒の名前は彩り手の横に出さず、相棒の詳細の側で示す
  const display = el(doc, 'section', 'irodorite__view');
  const card = el(doc, 'div', 'irodorite-detail');
  card.style.borderLeftColor = detail.color;
  const text = el(doc, 'div', 'irodorite-detail__text');
  const trait = el(doc, 'p', 'irodorite-detail__trait');
  trait.append(
    el(doc, 'span', 'irodorite-detail__label', '特性'),
    el(doc, 'span', 'irodorite-detail__trait-name', detail.traitName),
    el(doc, 'span', 'irodorite-detail__trait-effect', detail.traitDescription),
  );
  text.append(
    el(doc, 'span', 'irodorite-detail__name', detail.name),
    el(doc, 'span', 'irodorite-detail__catchphrase', `「${detail.catchphrase}」`),
    trait,
  );
  card.append(
    irodoriteElement(doc, { url: detail.portrait, color: detail.color, scale: 2, className: 'irodorite-detail__portrait' }),
    text,
  );
  const partner = { ...detail.partner, attributeName: `相棒・${detail.partner.attributeName}` };
  display.append(card, fighterDetailCard(doc, partner));

  // 下半分：見出しと案内、彩り手の一覧、進むボタン
  const controls = el(doc, 'section', 'irodorite__controls');
  controls.append(
    el(doc, 'h2', 'irodorite__title', '彩り手を選ぶ'),
    el(doc, 'p', 'irodorite__hint', '相棒はチームの1番目に入り、外せません'),
  );
  const grid = el(doc, 'div', 'irodorite-choices');
  for (const choice of view.choices) {
    const pick = button(
      doc,
      choice.selected ? 'irodorite-choice irodorite-choice--selected' : 'irodorite-choice',
      '',
      () => handlers.onSelect(choice.index),
    );
    pick.setAttribute('aria-pressed', String(choice.selected));
    pick.style.borderBottomColor = choice.color;
    pick.append(
      irodoriteElement(doc, { url: choice.portrait, color: choice.color, scale: 1, className: 'irodorite-choice__portrait' }),
      el(doc, 'span', 'irodorite-choice__name', choice.name),
    );
    grid.append(pick);
  }
  controls.append(grid, button(doc, 'button button--primary', 'この彩り手で進む', () => handlers.onConfirm()));

  root.replaceChildren(screen(doc, 'irodorite', display, controls));
  grid.scrollTop = scrollTop;
}
