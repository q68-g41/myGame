/**
 * ランの画面（チーム選択・マップ・ランの結果）。上半分は表示だけ、操作は下半分に集める。
 * 表示する内容は runView.ts で組み立て、ここでは描くだけにする。
 */
import { el } from './dom';
import type { DraftView, FighterDetailView, MapNodeView, MapView, RunEndView, TeamMemberView } from './runView';

const SVG_NS = 'http://www.w3.org/2000/svg';

function screen(doc: Document, className: string, view: HTMLElement, controls: HTMLElement): HTMLElement {
  view.classList.add('screen__view');
  view.setAttribute('aria-label', '表示');
  controls.classList.add('screen__controls');
  controls.setAttribute('aria-label', '操作');
  const root = el(doc, 'div', `screen ${className}`);
  root.append(view, controls);
  return root;
}

function button(doc: Document, className: string, text: string, onClick: () => void): HTMLButtonElement {
  const element = el(doc, 'button', className, text);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

function swatch(doc: Document, className: string, color: string | null): HTMLElement {
  const element = el(doc, 'span', className);
  element.style.background = color ?? 'transparent';
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function hpLevel(hp: number, maxHp: number): 'high' | 'middle' | 'low' {
  const ratio = hp / maxHp;
  return ratio > 0.5 ? 'high' : ratio > 0.2 ? 'middle' : 'low';
}

/** チームの1体（名前・HPバー・数字） */
function memberCard(doc: Document, member: TeamMemberView): HTMLElement {
  const card = el(doc, 'div', member.hp === 0 ? 'member member--fainted' : 'member');
  const header = el(doc, 'div', 'member__header');
  header.append(swatch(doc, 'member__icon', member.color), el(doc, 'span', 'member__name', member.name));
  const bar = el(doc, 'div', 'hp-bar');
  const fill = el(doc, 'div', `hp-bar__fill hp-bar__fill--${hpLevel(member.hp, member.maxHp)}`);
  fill.style.width = `${(member.hp / member.maxHp) * 100}%`;
  bar.append(fill);
  card.append(header, bar, el(doc, 'span', 'member__hp', `HP ${member.hp} / ${member.maxHp}`));
  return card;
}

function teamRow(doc: Document, team: readonly TeamMemberView[]): HTMLElement {
  const row = el(doc, 'div', 'team-status');
  row.setAttribute('aria-label', 'チーム');
  row.append(...team.map((member) => memberCard(doc, member)));
  return row;
}

/* ===== チーム選択 ===== */

export interface DraftScreenHandlers {
  /** 候補をタップした（選ぶ・外す） */
  onPick(index: number): void;
  /** 3体で出発する */
  onConfirm(): void;
}

function detailCard(doc: Document, detail: FighterDetailView): HTMLElement {
  const card = el(doc, 'div', 'fighter-detail');
  const header = el(doc, 'div', 'fighter-detail__header');
  header.append(
    swatch(doc, 'fighter-detail__icon', detail.color),
    el(doc, 'span', 'fighter-detail__name', detail.name),
    el(doc, 'span', 'fighter-detail__attribute', detail.attributeName),
  );
  const moves = el(doc, 'ul', 'fighter-detail__moves');
  moves.append(...detail.moves.map((move) => el(doc, 'li', '', move)));
  card.append(header, el(doc, 'p', 'fighter-detail__stats', detail.stats), moves);
  return card;
}

export function renderDraftScreen(root: HTMLElement, view: DraftView, handlers: DraftScreenHandlers): void {
  const doc = root.ownerDocument;

  // 上半分：選んだチームと、最後にタップした候補の詳細
  const display = el(doc, 'section', 'draft__view');
  const slots = el(doc, 'ol', 'draft__slots');
  slots.setAttribute('aria-label', '選んだチーム（出る順）');
  for (const slot of view.slots) {
    const item = el(doc, 'li', slot.name === null ? 'draft-slot draft-slot--empty' : 'draft-slot');
    item.append(
      el(doc, 'span', 'draft-slot__order', String(slot.order)),
      swatch(doc, 'draft-slot__icon', slot.color),
      el(doc, 'span', 'draft-slot__name', slot.name ?? '―'),
    );
    slots.append(item);
  }
  display.append(
    el(doc, 'h2', 'draft__title', 'チームを選ぶ'),
    el(doc, 'p', 'draft__hint', '候補から3体。タップした順に戦闘に出ます'),
    slots,
    view.detail === null ? el(doc, 'p', 'draft__placeholder', '候補をタップすると、能力と技が出ます') : detailCard(doc, view.detail),
  );

  // 下半分：候補5体と出発ボタン
  const controls = el(doc, 'section', 'draft__controls');
  const grid = el(doc, 'div', 'candidates');
  for (const candidate of view.candidates) {
    const pick = button(
      doc,
      candidate.order === null ? 'candidate' : 'candidate candidate--picked',
      '',
      () => handlers.onPick(candidate.index),
    );
    pick.setAttribute('aria-pressed', String(candidate.order !== null));
    pick.append(
      swatch(doc, 'candidate__icon', candidate.color),
      el(doc, 'span', 'candidate__name', candidate.name),
      el(doc, 'span', 'candidate__order', candidate.order === null ? '' : String(candidate.order)),
    );
    grid.append(pick);
  }
  const confirm = button(doc, 'button button--primary', 'この3体で出発', () => handlers.onConfirm());
  confirm.disabled = !view.canConfirm;
  controls.append(grid, confirm);

  root.replaceChildren(screen(doc, 'draft', display, controls));
}

/* ===== マップ ===== */

export interface MapScreenHandlers {
  /** 次のマスを選んだ（次の層での位置） */
  onChoose(index: number): void;
}

/** マスの位置（マップの枠に対する %）。左右は層のマス数で等分し、層は下から上へ並べる */
function nodePoint(view: MapView, layer: number, index: number): { x: number; y: number } {
  const width = view.layers[layer]!.length;
  const count = view.layers.length;
  return { x: ((index + 1) / (width + 1)) * 100, y: ((count - 1 - layer + 0.5) / count) * 100 };
}

const ACTIVE_STATES: ReadonlySet<MapNodeView['state']> = new Set(['current', 'choice', 'reachable']);

function mapLines(doc: Document, view: MapView): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'map__lines');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const layer of view.layers) {
    for (const node of layer) {
      for (const next of node.next) {
        const target = view.layers[node.layer + 1]![next]!;
        const from = nodePoint(view, node.layer, node.index);
        const to = nodePoint(view, target.layer, target.index);
        const line = doc.createElementNS(SVG_NS, 'line');
        const active = ACTIVE_STATES.has(node.state) && ACTIVE_STATES.has(target.state) && target.state !== 'current';
        line.setAttribute('class', active ? 'map-line map-line--active' : 'map-line');
        line.setAttribute('x1', String(from.x));
        line.setAttribute('y1', String(from.y));
        line.setAttribute('x2', String(to.x));
        line.setAttribute('y2', String(to.y));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(line);
      }
    }
  }
  return svg;
}

const NODE_STATE_LABELS: Readonly<Record<MapNodeView['state'], string>> = {
  current: 'いまいるマス',
  choice: '進める',
  reachable: 'この先にある',
  passed: '通り過ぎた',
  unreachable: 'たどり着けない',
};

function mapNode(doc: Document, view: MapView, node: MapNodeView): HTMLElement {
  const element = el(doc, 'div', `map-node map-node--${node.state} map-node--${node.kind}`, node.mark);
  const point = nodePoint(view, node.layer, node.index);
  element.style.left = `${point.x}%`;
  element.style.top = `${point.y}%`;
  element.dataset.layer = String(node.layer);
  element.dataset.index = String(node.index);
  element.setAttribute('role', 'img');
  const letter = node.letter === null ? '' : `${node.letter}・`;
  element.setAttribute('aria-label', `${node.layer + 1}層目 ${node.name}（${letter}${NODE_STATE_LABELS[node.state]}）`);
  if (node.letter !== null) {
    element.append(el(doc, 'span', 'map-node__letter', node.letter));
  }
  return element;
}

export function renderMapScreen(root: HTMLElement, view: MapView, handlers: MapScreenHandlers): void {
  const doc = root.ownerDocument;

  // 上半分：マップ（表示だけ）。下から上へ進む
  const display = el(doc, 'section', 'map__view');
  const map = el(doc, 'div', 'map');
  map.setAttribute('aria-label', 'マップ');
  map.append(mapLines(doc, view));
  for (const layer of view.layers) {
    for (const node of layer) {
      map.append(mapNode(doc, view, node));
    }
  }
  display.append(el(doc, 'p', 'map__progress', view.progress), map);

  // 下半分：案内、次のマスのボタン、チームのHP
  const controls = el(doc, 'section', 'map__controls');
  const message = el(doc, 'p', 'map__message', view.message);
  message.setAttribute('role', 'status');
  const choices = el(doc, 'div', 'map-choices');
  for (const choice of view.choices) {
    const choose = button(doc, 'map-choice', '', () => handlers.onChoose(choice.index));
    choose.append(el(doc, 'span', 'map-choice__letter', choice.letter), el(doc, 'span', 'map-choice__name', choice.name));
    choices.append(choose);
  }
  controls.append(message, choices, teamRow(doc, view.team));

  root.replaceChildren(screen(doc, 'map-screen', display, controls));
}

/* ===== ランの結果 ===== */

export interface RunEndScreenHandlers {
  /** 新しいランを始める */
  onRetry(): void;
  onTitle(): void;
}

export function renderRunEndScreen(root: HTMLElement, view: RunEndView, handlers: RunEndScreenHandlers): void {
  const doc = root.ownerDocument;

  const display = el(doc, 'section', 'run-end__view');
  display.append(
    el(doc, 'h2', `run-end__title run-end__title--${view.result}`, view.title),
    el(doc, 'p', 'run-end__message', view.message),
    teamRow(doc, view.team),
  );

  const controls = el(doc, 'section', 'run-end__controls');
  controls.append(
    button(doc, 'button button--primary', 'もう一度（新しいラン）', () => handlers.onRetry()),
    button(doc, 'button button--secondary', 'タイトルへ', () => handlers.onTitle()),
  );

  root.replaceChildren(screen(doc, 'run-end', display, controls));
}
