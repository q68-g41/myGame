/**
 * 休憩・スカウト・イベントの画面。上半分は表示だけ、操作は下半分に集める。
 * 表示する内容は nodeView.ts で組み立て、ここでは描くだけにする。
 */
import { el } from './dom';
import type { EventView, NodeMemberView, RestView, ScoutView } from './nodeView';
import { button, charmLine, fighterDetailCard, screen, teamRow } from './runScreens';
import { iconElement } from './sprites';

/** 大きめの選択肢（見出しと説明の2行） */
function optionCard(
  doc: Document,
  title: string,
  detail: string,
  selected: boolean,
  color: string | null,
  onClick: () => void,
): HTMLButtonElement {
  const card = button(doc, selected ? 'node-option node-option--selected' : 'node-option', '', onClick);
  card.setAttribute('aria-pressed', String(selected));
  if (color !== null) {
    card.style.setProperty('--card-color', color);
  }
  card.append(el(doc, 'span', 'node-option__title', title), el(doc, 'span', 'node-option__detail', detail));
  return card;
}

/** キャラを選ぶボタンの並び */
function memberPicks(doc: Document, members: readonly NodeMemberView[], onPick: (index: number) => void): HTMLElement {
  const row = el(doc, 'div', 'node-members');
  for (const member of members) {
    const pick = button(doc, 'node-pick', '', () => onPick(member.index));
    pick.disabled = member.disabled === true;
    pick.style.setProperty('--card-color', member.color);
    pick.append(
      iconElement(doc, { url: member.icon, color: member.color, className: 'node-pick__icon' }),
      el(doc, 'span', 'node-pick__name', member.name),
      el(doc, 'span', 'node-pick__note', member.note),
    );
    row.append(pick);
  }
  return row;
}

function prompt(doc: Document, text: string): HTMLElement {
  const line = el(doc, 'p', 'node__prompt', text);
  line.setAttribute('role', 'status');
  return line;
}

/* ===== 休憩 ===== */

export interface RestScreenHandlers {
  onSelect(option: 'heal' | 'power'): void;
  onConfirm(): void;
  onMember(index: number): void;
  onMove(index: number): void;
  onBack(): void;
}

export function renderRestScreen(root: HTMLElement, view: RestView, handlers: RestScreenHandlers): void {
  const doc = root.ownerDocument;

  const display = el(doc, 'section', 'node__view');
  display.append(
    el(doc, 'h2', 'node__title', '休憩'),
    el(doc, 'p', 'node__text', 'たき火のそばで、ひと休みできそうだ。'),
    teamRow(doc, view.team),
    charmLine(doc, view.charms),
  );

  const controls = el(doc, 'section', 'node__controls');
  controls.append(prompt(doc, view.prompt));
  if (view.step === 'choose') {
    const options = el(doc, 'div', 'node-options');
    options.append(
      ...view.options.map((option) =>
        optionCard(doc, option.title, option.detail, option.selected, null, () => handlers.onSelect(option.id)),
      ),
    );
    const confirm = button(doc, 'button button--primary', '決定', () => handlers.onConfirm());
    confirm.disabled = !view.canConfirm;
    controls.append(options, confirm);
  } else {
    if (view.step === 'member') {
      controls.append(memberPicks(doc, view.members, (index) => handlers.onMember(index)));
    } else {
      const moves = el(doc, 'div', 'node-moves');
      for (const move of view.moves) {
        const pick = button(doc, 'node-pick', '', () => handlers.onMove(move.index));
        pick.disabled = move.disabled;
        pick.style.setProperty('--card-color', move.color);
        pick.append(el(doc, 'span', 'node-pick__name', move.name), el(doc, 'span', 'node-pick__note', move.detail));
        moves.append(pick);
      }
      controls.append(moves);
    }
    controls.append(button(doc, 'button button--secondary', '戻る', () => handlers.onBack()));
  }

  root.replaceChildren(screen(doc, 'rest', display, controls));
}

/* ===== スカウト ===== */

export interface ScoutScreenHandlers {
  onCandidate(index: number): void;
  /** 「この仲間を入れる」→ 入れ替えるキャラを選ぶ */
  onConfirm(): void;
  onMember(index: number): void;
  /** 入れ替えずに進む */
  onSkip(): void;
  onBack(): void;
}

export function renderScoutScreen(root: HTMLElement, view: ScoutView, handlers: ScoutScreenHandlers): void {
  const doc = root.ownerDocument;

  const display = el(doc, 'section', 'node__view');
  display.append(el(doc, 'h2', 'node__title', 'スカウト'));
  if (view.detail === null) {
    display.append(el(doc, 'p', 'node__text', '仲間になってくれそうなキャラがいる。タップすると、説明と能力・技が出ます。'));
  } else {
    display.append(fighterDetailCard(doc, view.detail));
  }
  display.append(teamRow(doc, view.team));

  const controls = el(doc, 'section', 'node__controls');
  controls.append(prompt(doc, view.prompt));
  if (view.step === 'candidate') {
    const candidates = el(doc, 'div', 'node-members');
    for (const candidate of view.candidates) {
      const pick = button(doc, candidate.selected ? 'node-pick node-pick--selected' : 'node-pick', '', () =>
        handlers.onCandidate(candidate.index),
      );
      pick.setAttribute('aria-pressed', String(candidate.selected));
      pick.style.setProperty('--card-color', candidate.color);
      pick.append(
        iconElement(doc, { url: candidate.icon, color: candidate.color, className: 'node-pick__icon' }),
        el(doc, 'span', 'node-pick__name', candidate.name),
        el(doc, 'span', 'node-pick__note', `${candidate.attributeName}属性`),
      );
      candidates.append(pick);
    }
    const confirm = button(doc, 'button button--primary', 'この仲間を入れる', () => handlers.onConfirm());
    confirm.disabled = !view.canConfirm;
    controls.append(candidates, confirm, button(doc, 'button button--secondary', '入れ替えずに進む', () => handlers.onSkip()));
  } else {
    controls.append(
      memberPicks(doc, view.members, (index) => handlers.onMember(index)),
      button(doc, 'button button--secondary', '戻る', () => handlers.onBack()),
    );
  }

  root.replaceChildren(screen(doc, 'scout', display, controls));
}

/* ===== イベント ===== */

export interface EventScreenHandlers {
  onSelect(index: number): void;
  onConfirm(): void;
  /** 結果を見たら、マップへ */
  onLeave(): void;
}

export function renderEventScreen(root: HTMLElement, view: EventView, handlers: EventScreenHandlers): void {
  const doc = root.ownerDocument;

  const display = el(doc, 'section', 'node__view');
  display.append(el(doc, 'h2', 'node__title', view.title), el(doc, 'p', 'node__text', view.text));
  if (view.result !== null) {
    const result = el(doc, 'ul', 'event-result');
    result.append(...view.result.map((line) => el(doc, 'li', '', line)));
    display.append(result);
  }
  display.append(teamRow(doc, view.team));

  const controls = el(doc, 'section', 'node__controls');
  controls.append(prompt(doc, view.prompt));
  if (view.result === null) {
    const options = el(doc, 'div', 'node-options');
    options.append(
      ...view.options.map((option) =>
        optionCard(doc, option.label, option.description, option.selected, null, () => handlers.onSelect(option.index)),
      ),
    );
    const confirm = button(doc, 'button button--primary', '決定', () => handlers.onConfirm());
    confirm.disabled = !view.canConfirm;
    controls.append(options, confirm);
  } else {
    controls.append(button(doc, 'button button--primary', '次へ', () => handlers.onLeave()));
  }

  root.replaceChildren(screen(doc, 'event', display, controls));
}
