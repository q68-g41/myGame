/**
 * ランの画面（チーム選択・マップ・報酬・ランの結果）。上半分は表示だけ、操作は下半分に集める。
 * 表示する内容は runView.ts で組み立て、ここでは描くだけにする。
 */
import { el } from './dom';
import type {
  DraftView,
  FighterDetailView,
  EnemyHintView,
  MapNodeView,
  MapView,
  RewardView,
  RunEndView,
  TeamMemberView,
} from './runView';
import { iconElement, irodoriteElement, mapIconElement, spriteElement } from './sprites';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function screen(doc: Document, className: string, view: HTMLElement, controls: HTMLElement): HTMLElement {
  view.classList.add('screen__view');
  view.setAttribute('aria-label', '表示');
  controls.classList.add('screen__controls');
  controls.setAttribute('aria-label', '操作');
  const root = el(doc, 'div', `screen ${className}`);
  root.append(view, controls);
  return root;
}

export function button(doc: Document, className: string, text: string, onClick: () => void): HTMLButtonElement {
  const element = el(doc, 'button', className, text);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

function hpLevel(hp: number, maxHp: number): 'high' | 'middle' | 'low' {
  const ratio = hp / maxHp;
  return ratio > 0.5 ? 'high' : ratio > 0.2 ? 'middle' : 'low';
}

/**
 * チームの1体（名前・HPバー・数字）。属性の色は --card-color で渡す（マップの並び替えのボタンでは、板にうすく混ぜる。CSS）。
 * 6文字の名前が1行に収まるように、絵を上、名前をその下に出す
 */
function memberCard(doc: Document, member: TeamMemberView, card: HTMLElement = el(doc, 'div', '')): HTMLElement {
  card.className = member.hp === 0 ? 'member member--fainted' : 'member';
  card.style.setProperty('--card-color', member.color);
  const header = el(doc, 'div', 'member__header');
  // 絵を上に、名前をその下に出す（3つ並ぶので、横に並べると6文字の名前が入らない）
  header.append(
    iconElement(doc, { url: member.icon, color: member.color, className: 'member__icon' }),
    el(doc, 'span', 'member__name', member.name),
  );
  const bar = el(doc, 'div', 'hp-bar');
  const fill = el(doc, 'div', `hp-bar__fill hp-bar__fill--${hpLevel(member.hp, member.maxHp)}`);
  fill.style.width = `${(member.hp / member.maxHp) * 100}%`;
  bar.append(fill);
  card.append(header, bar, el(doc, 'span', 'member__hp', `HP ${member.hp} / ${member.maxHp}`));
  return card;
}

/**
 * チームの一覧。onMember を渡すと、カードをボタンにする（マップ画面の並び替え）。
 * selected は選んでいるカードの位置
 */
export function teamRow(
  doc: Document,
  team: readonly TeamMemberView[],
  options: { readonly onMember?: (index: number) => void; readonly selected?: number | null } = {},
): HTMLElement {
  const row = el(doc, 'div', 'team-status');
  row.setAttribute('aria-label', 'チーム（出る順）');
  row.append(
    ...team.map((member, index) => {
      const { onMember } = options;
      if (onMember === undefined) {
        return memberCard(doc, member);
      }
      const card = memberCard(doc, member, button(doc, '', '', () => onMember(index)));
      const selected = options.selected === index;
      card.classList.add('member--button');
      card.classList.toggle('member--selected', selected);
      card.setAttribute('aria-pressed', String(selected));
      return card;
    }),
  );
  return row;
}

/** 持っているお守り（なければ「なし」）。名前の途中では折り返さない */
export function charmLine(doc: Document, charms: readonly string[]): HTMLElement {
  const line = el(doc, 'p', 'charm-line', 'お守り：');
  if (charms.length === 0) {
    line.append('なし');
    return line;
  }
  line.append(
    ...charms.map((name, index) => el(doc, 'span', 'charm-line__name', index < charms.length - 1 ? `${name}・` : name)),
  );
  return line;
}

/* ===== チーム選択 ===== */

export interface DraftScreenHandlers {
  /** 候補をタップした（選ぶ・外す） */
  onPick(index: number): void;
  /** 3体で出発する */
  onConfirm(): void;
}

/** キャラの詳細（説明・能力・技）。チーム選択とスカウトで使う */
export function fighterDetailCard(doc: Document, detail: FighterDetailView): HTMLElement {
  const card = el(doc, 'div', 'fighter-detail');
  // 属性の色は、名前の前の菱形で見せる（CSS）
  card.style.setProperty('--card-color', detail.color);
  const header = el(doc, 'div', 'fighter-detail__header');
  const title = el(doc, 'div', 'fighter-detail__title');
  // 説明は絵の横（名前と属性の下）に置き、絵の高さの中に収める
  title.append(
    el(doc, 'span', 'fighter-detail__name', detail.name),
    el(doc, 'span', 'fighter-detail__attribute', detail.attributeName),
    el(doc, 'span', 'fighter-detail__description', detail.description),
  );
  header.append(
    spriteElement(doc, { url: detail.sprite, color: detail.color, scale: 2, className: 'fighter-detail__sprite' }),
    title,
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
    const classes = ['draft-slot', slot.name === null ? 'draft-slot--empty' : '', slot.partner ? 'draft-slot--partner' : ''];
    const item = el(doc, 'li', classes.filter(Boolean).join(' '));
    item.append(
      // 相棒の枠は、順番の代わりに「相棒」と出す（1番目に入っていて外せない）
      el(doc, 'span', 'draft-slot__order', slot.partner ? `${slot.order} 相棒` : String(slot.order)),
      iconElement(doc, { url: slot.icon, color: slot.color, className: 'draft-slot__icon' }),
      el(doc, 'span', 'draft-slot__name', slot.name ?? '―'),
    );
    slots.append(item);
  }
  // 基準の幅で1行に収まる長さにする（2行になると、上半分に収まらない）
  const hint =
    view.pickCount < view.slots.length
      ? `相棒に続けて${view.pickCount}体。長押しで説明だけ見られます`
      : `タップした順に${view.pickCount}体。長押しで説明だけ見られます`;
  display.append(
    el(doc, 'h2', 'draft__title', 'チームを選ぶ'),
    el(doc, 'p', 'draft__hint', hint),
    slots,
    view.detail === null
      ? el(doc, 'p', 'draft__placeholder', '候補をタップすると、説明と能力・技が出ます')
      : fighterDetailCard(doc, view.detail),
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
    // 長押しで、選ばずに詳細だけ出す（app.ts で受ける）
    pick.dataset.candidateIndex = String(candidate.index);
    // 属性の色を、板にうすく混ぜる（CSS）
    pick.style.setProperty('--card-color', candidate.color);
    pick.append(
      iconElement(doc, { url: candidate.icon, color: candidate.color, className: 'candidate__icon' }),
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
  /** チームの1体をタップした（2体タップすると並び順を入れ替える） */
  onMember(index: number): void;
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
  // アイコンの絵があれば絵を、なければ1文字を出す
  const element = el(doc, 'div', `map-node map-node--${node.state} map-node--${node.kind}`, node.icon === null ? node.mark : '');
  if (node.icon !== null) {
    element.append(mapIconElement(doc, { url: node.icon.url, size: node.icon.size, className: 'map-node__icon' }));
  }
  const point = nodePoint(view, node.layer, node.index);
  element.style.left = `${point.x}%`;
  element.style.top = `${point.y}%`;
  element.dataset.layer = String(node.layer);
  element.dataset.index = String(node.index);
  element.setAttribute('role', 'img');
  const letter = node.letter === null ? '' : `${node.letter}・`;
  const lead = node.lead === null ? '' : ` 先頭の相手：${node.lead.name}`;
  element.setAttribute('aria-label', `${node.layer + 1}層目 ${node.name}（${letter}${NODE_STATE_LABELS[node.state]}）${lead}`);
  if (node.letter !== null) {
    element.append(el(doc, 'span', 'map-node__letter', node.letter));
  }
  // 戦うマスの下に、先頭の相手の属性の色を小さな四角で出す（ヒント。4.3）
  if (node.lead !== null) {
    const pip = el(doc, 'span', 'map-node__pip');
    pip.style.background = node.lead.color;
    element.append(pip);
  }
  return element;
}

/** 選ぶボタンの2行目に出す、先頭の相手の属性（「先頭」＋色の四角と名前の札） */
function leadChip(doc: Document, lead: EnemyHintView): HTMLElement {
  const hint = el(doc, 'span', 'map-choice__hint');
  const chip = el(doc, 'span', 'enemy-chip', lead.name);
  chip.style.setProperty('--chip-color', lead.color);
  hint.append(el(doc, 'span', 'map-choice__hint-label', '先頭'), chip);
  return hint;
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
    choose.append(el(doc, 'span', 'map-choice__letter', choice.letter));
    if (choice.icon !== null) {
      choose.append(mapIconElement(doc, { url: choice.icon.url, size: choice.icon.size, className: 'map-choice__icon' }));
    }
    choose.append(el(doc, 'span', 'map-choice__name', choice.name));
    if (choice.lead !== null) {
      choose.append(leadChip(doc, choice.lead));
    }
    choices.append(choose);
  }
  const order = el(doc, 'p', 'team-order-hint', '出る順：2体をタップすると入れ替え');
  controls.append(
    message,
    choices,
    order,
    teamRow(doc, view.team, { onMember: (index) => handlers.onMember(index), selected: view.selectedMember }),
    charmLine(doc, view.charms),
  );

  root.replaceChildren(screen(doc, 'map-screen', display, controls));
}

/* ===== 戦闘後の報酬 ===== */

export interface RewardScreenHandlers {
  /** 選択肢をタップした（1タップ目） */
  onOffer(index: number): void;
  /** 「決定」（2タップ目） */
  onConfirm(): void;
  /** 技を覚えさせるキャラを選んだ */
  onMember(index: number): void;
  /** 忘れる技を選んだ */
  onForget(index: number): void;
  /** 1つ前に戻る */
  onBack(): void;
}

function offerButton(doc: Document, offer: RewardView['offers'][number], handlers: RewardScreenHandlers): HTMLButtonElement {
  const choose = button(doc, offer.selected ? 'reward-offer reward-offer--selected' : 'reward-offer', '', () =>
    handlers.onOffer(offer.index),
  );
  choose.setAttribute('aria-pressed', String(offer.selected));
  if (offer.color !== null) {
    choose.style.borderLeftColor = offer.color;
  }
  const top = el(doc, 'span', 'reward-offer__top');
  top.append(el(doc, 'span', 'reward-offer__kind', offer.kindLabel), el(doc, 'span', 'reward-offer__title', offer.title));
  choose.append(top, el(doc, 'span', 'reward-offer__detail', offer.detail));
  return choose;
}

export function renderRewardScreen(root: HTMLElement, view: RewardView, handlers: RewardScreenHandlers): void {
  const doc = root.ownerDocument;

  // 上半分：選んでいる報酬の詳細と、チームの状態
  const display = el(doc, 'section', 'reward__view');
  display.append(el(doc, 'h2', 'reward__title', view.heading));
  if (view.detail === null) {
    display.append(el(doc, 'p', 'reward__placeholder', '戦闘に勝った！ 報酬をタップすると、くわしい内容が出ます'));
  } else {
    const card = el(doc, 'div', 'reward-detail');
    const lines = el(doc, 'ul', 'reward-detail__lines');
    lines.append(...view.detail.lines.map((line) => el(doc, 'li', '', line)));
    card.append(el(doc, 'p', 'reward-detail__title', view.detail.title), lines);
    display.append(card);
  }
  display.append(teamRow(doc, view.team), charmLine(doc, view.charms));

  // 下半分：段階ごとの選択肢
  const controls = el(doc, 'section', 'reward__controls');
  const prompt = el(doc, 'p', 'reward__prompt', view.prompt);
  prompt.setAttribute('role', 'status');
  controls.append(prompt);

  if (view.step === 'offer') {
    const offers = el(doc, 'div', 'reward-offers');
    offers.append(...view.offers.map((offer) => offerButton(doc, offer, handlers)));
    const confirm = button(doc, 'button button--primary', '決定', () => handlers.onConfirm());
    confirm.disabled = !view.canConfirm;
    controls.append(offers, confirm);
  } else {
    const options = el(doc, 'div', view.step === 'member' ? 'reward-members' : 'reward-forgets');
    if (view.step === 'member') {
      for (const member of view.members) {
        const choose = button(doc, 'reward-option', '', () => handlers.onMember(member.index));
        choose.disabled = member.disabled;
        choose.style.borderLeftColor = member.color;
        choose.append(
          iconElement(doc, { url: member.icon, color: member.color, className: 'reward-option__icon' }),
          el(doc, 'span', 'reward-option__name', member.name),
          el(doc, 'span', 'reward-option__note', member.note ?? ''),
        );
        options.append(choose);
      }
    } else {
      for (const forget of view.forgets) {
        const choose = button(doc, 'reward-option', '', () => handlers.onForget(forget.index));
        choose.disabled = forget.disabled;
        choose.style.borderLeftColor = forget.color;
        choose.append(el(doc, 'span', 'reward-option__name', forget.name), el(doc, 'span', 'reward-option__note', forget.detail));
        options.append(choose);
      }
    }
    controls.append(options, button(doc, 'button button--secondary', '戻る', () => handlers.onBack()));
  }

  root.replaceChildren(screen(doc, 'reward', display, controls));
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
  display.append(el(doc, 'h2', `run-end__title run-end__title--${view.result}`, view.title));
  if (view.irodorite !== null) {
    // 彩り手の絵（2倍）とあだ名
    const irodorite = el(doc, 'div', 'run-end__irodorite');
    irodorite.append(
      irodoriteElement(doc, {
        url: view.irodorite.portrait,
        color: view.irodorite.color,
        scale: 2,
        className: 'run-end__portrait',
      }),
      el(doc, 'span', 'run-end__name', view.irodorite.name),
    );
    display.append(irodorite);
  }
  display.append(el(doc, 'p', 'run-end__message', view.message), teamRow(doc, view.team));

  const controls = el(doc, 'section', 'run-end__controls');
  controls.append(
    button(doc, 'button button--primary', 'もう一度（新しいラン）', () => handlers.onRetry()),
    button(doc, 'button button--secondary', 'タイトルへ', () => handlers.onTitle()),
  );

  root.replaceChildren(screen(doc, 'run-end', display, controls));
}
