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

  // 上半分：選んでいる彩り手（絵・あだ名・口ぐせ・特性・相棒の名前）と、相棒の詳細。
  // 基準の画面で上半分に収めるため、見出しと案内は下半分に置く
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
  const partner = el(doc, 'p', 'irodorite-detail__partner');
  partner.append(el(doc, 'span', 'irodorite-detail__label', '相棒'), el(doc, 'span', '', detail.partner.name));
  text.append(
    el(doc, 'span', 'irodorite-detail__name', detail.name),
    el(doc, 'span', 'irodorite-detail__catchphrase', `「${detail.catchphrase}」`),
    trait,
    partner,
  );
  card.append(
    irodoriteElement(doc, { url: detail.portrait, color: detail.color, scale: 2, className: 'irodorite-detail__portrait' }),
    text,
  );
  display.append(card, fighterDetailCard(doc, detail.partner));

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
}
