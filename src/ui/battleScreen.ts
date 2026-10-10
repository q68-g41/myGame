/**
 * バトル画面（M3）。上半分は表示だけ（相手・自分・ログ1行）、下半分に操作（技ボタン 2×2・控え）。
 * 表示する内容は battleView.ts で組み立て、ここでは描くだけにする。
 */
import type {
  BattleView,
  BenchView,
  ConfirmView,
  FighterPanelView,
  MoveButtonView,
  MoveDetailView,
  OrderPreview,
} from './battleView';
import { el } from './dom';
import type { MotionKind } from './playback';
import { ANIM_CYCLE_MS, animatedSpriteElement, iconElement } from './sprites';

export interface BattleScreenHandlers {
  onMove(moveId: string): void;
  onBench(index: number): void;
  /** 選んだ控えで確定する（2タップ目） */
  onConfirm(): void;
  /** 控えの選択をやめる */
  onCancel(): void;
  /** 決着したあと、ランに戻る */
  onContinue(): void;
  /** 演出の速さを 1倍 ⇔ 2倍 に切り替える */
  onToggleSpeed(): void;
  /** 音（効果音と BGM）のオン ⇔ オフを切り替える */
  onToggleSound(): void;
  /** 演出を最後まで早送りする */
  onSkip(): void;
}

function hpLevel(hp: number, maxHp: number): 'high' | 'middle' | 'low' {
  const ratio = hp / maxHp;
  return ratio > 0.5 ? 'high' : ratio > 0.2 ? 'middle' : 'low';
}

/**
 * 場のキャラのパネル。動き（M7-1）は CSS のクラスで付ける：
 * fighter--hit（揺れて光る）、fighter--attack（前に出る）、fighter--faint（沈んで薄れる）、fighter--enter（入ってくる）、
 * fighter--fainted（倒れたあと。薄いまま止める）
 */
function fighterPanel(
  doc: Document,
  view: FighterPanelView,
  side: 'enemy' | 'player',
  hit: boolean,
  motion: MotionKind | null,
): HTMLElement {
  const classes = ['fighter', `fighter--${side}`];
  if (hit) {
    classes.push('fighter--hit');
  }
  if (motion !== null) {
    classes.push(`fighter--${motion}`);
  } else if (view.hp === 0 && !hit) {
    // 倒れたあとは、薄くしたまま止める（倒れる動きのコマと、ダメージで揺れるコマのあいだは除く）
    classes.push('fighter--fainted');
  }
  const panel = el(doc, 'div', classes.join(' '));
  panel.dataset.side = side;
  panel.dataset.fighter = view.id;

  // ドット絵（待機中はコマ送り）を2倍で出す。後ろに属性の色をうすく敷いて、暗い色の絵（ボス）も背景に埋もれないようにする。相手は左右反転
  const sprite = el(doc, 'div', 'fighter__sprite');
  sprite.style.setProperty('--sprite-glow', `${view.color}66`);
  sprite.setAttribute('aria-hidden', 'true');
  sprite.append(
    animatedSpriteElement(doc, { anim: view.anim, url: view.sprite, color: view.color, scale: 2, flipped: side === 'enemy' }),
  );

  const info = el(doc, 'div', 'fighter__info');
  const header = el(doc, 'div', 'fighter__header');
  header.append(el(doc, 'span', 'fighter__name', side === 'enemy' ? `相手：${view.name}` : view.name));
  const team = el(doc, 'span', 'fighter__team');
  team.setAttribute('aria-label', `残り ${view.teamAlive.filter(Boolean).length} 体`);
  for (const alive of view.teamAlive) {
    team.append(el(doc, 'span', alive ? 'team-dot' : 'team-dot team-dot--fainted'));
  }
  header.append(team);

  const bar = el(doc, 'div', 'hp-bar');
  const fill = el(doc, 'div', `hp-bar__fill hp-bar__fill--${hpLevel(view.hp, view.maxHp)}`);
  fill.style.width = `${(view.hp / view.maxHp) * 100}%`;
  bar.append(fill);

  const footer = el(doc, 'div', 'fighter__footer');
  footer.append(el(doc, 'span', 'fighter__hp', `HP ${view.hp} / ${view.maxHp}`));
  if (view.status !== null) {
    footer.append(el(doc, 'span', 'fighter__status', view.status));
  }

  info.append(header, bar, footer);
  panel.append(sprite, info);
  return panel;
}

const EFFECTIVENESS_MARK = { advantage: '▲有利', neutral: '', disadvantage: '▼不利' } as const;

function moveButton(doc: Document, view: MoveButtonView, handlers: BattleScreenHandlers): HTMLButtonElement {
  const button = el(doc, 'button', 'move-button');
  button.type = 'button';
  // 使えない技も長押しで詳細を見られるように、disabled ではなく aria-disabled にする
  // （disabled のボタンは、ブラウザによっては指の操作を受け取らず、長押しが効かない）
  if (view.disabled) {
    button.setAttribute('aria-disabled', 'true');
  }
  button.dataset.moveId = view.id;
  // 属性の色を左の帯で見せる
  button.style.borderLeftColor = view.color;

  const top = el(doc, 'span', 'move-button__top');
  top.append(el(doc, 'span', 'move-button__name', view.name));
  if (view.kindLabel !== null) {
    top.append(el(doc, 'span', 'move-button__kind', view.kindLabel));
  }

  const bottom = el(doc, 'span', 'move-button__bottom');
  const power = el(doc, 'span', 'move-button__power');
  if (view.power === null) {
    // 補助技の効果が2つ以上なら、語の途中ではなく「・」のところで折り返す
    const parts = (view.summary ?? '').split('・');
    power.append(
      ...parts.map((part, index) => el(doc, 'span', 'move-button__effect', index < parts.length - 1 ? `${part}・` : part)),
    );
  } else {
    power.textContent = `威力 ${view.power}`;
  }
  bottom.append(power);
  if (view.effectiveness !== null && view.effectiveness !== 'neutral') {
    bottom.append(
      el(doc, 'span', `move-button__mark move-button__mark--${view.effectiveness}`, EFFECTIVENESS_MARK[view.effectiveness]),
    );
  }
  if (view.note !== null) {
    bottom.append(el(doc, 'span', 'move-button__note', view.note));
  }

  button.append(top, bottom);
  button.addEventListener('click', () => {
    if (!view.disabled) {
      handlers.onMove(view.id);
    }
  });
  // 長押しでブラウザのメニューが出ないようにする（長押しは技の詳細に使う）
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  return button;
}

const ORDER_PREVIEW_TEXT: Readonly<Record<OrderPreview, string>> = {
  first: '行動順：先に動ける',
  later: '行動順：後になる',
  tie: '行動順：同じ速さ（どちらが先かは運）',
  unknown: '行動順：？（相手の素早さがまだ分からない）',
};

function moveDetail(doc: Document, view: MoveDetailView): HTMLElement {
  const card = el(doc, 'div', 'move-detail');
  card.append(el(doc, 'p', 'move-detail__name', view.name));
  const list = el(doc, 'ul', 'move-detail__lines');
  list.append(...view.lines.map((line) => el(doc, 'li', '', line)));
  card.append(list);
  return card;
}

function benchButton(doc: Document, view: BenchView, handlers: BattleScreenHandlers): HTMLButtonElement {
  const classes = ['bench-button'];
  if (view.selectable) {
    classes.push('bench-button--selectable');
  }
  if (view.selected) {
    classes.push('bench-button--selected');
  }
  const button = el(doc, 'button', classes.join(' '));
  button.setAttribute('aria-pressed', String(view.selected));
  button.type = 'button';
  button.disabled = !view.selectable;
  button.dataset.index = String(view.index);

  // 倒れたキャラの絵は、色を抜いてうすく出す（CSS）
  const icon = iconElement(doc, {
    url: view.icon,
    color: view.fainted ? null : view.color,
    className: view.fainted ? 'bench-button__icon bench-button__icon--fainted' : 'bench-button__icon',
  });
  const label = el(doc, 'span', 'bench-button__label');
  label.append(
    el(doc, 'span', 'bench-button__name', view.name),
    el(doc, 'span', 'bench-button__hp', view.fainted ? '倒れている' : `HP ${view.hp} / ${view.maxHp}`),
  );
  button.append(icon, label);
  button.addEventListener('click', () => handlers.onBench(view.index));
  return button;
}

function confirmPanel(doc: Document, view: ConfirmView, handlers: BattleScreenHandlers): HTMLElement {
  const panel = el(doc, 'div', 'confirm');
  panel.append(el(doc, 'p', 'confirm__question', view.question));
  const actions = el(doc, 'div', 'confirm__actions');
  const ok = el(doc, 'button', 'button button--primary', view.confirmLabel);
  ok.type = 'button';
  ok.addEventListener('click', () => handlers.onConfirm());
  const cancel = el(doc, 'button', 'button button--secondary', 'やめる');
  cancel.type = 'button';
  cancel.addEventListener('click', () => handlers.onCancel());
  actions.append(cancel, ok);
  panel.append(actions);
  return panel;
}

function resultPanel(doc: Document, view: BattleView, handlers: BattleScreenHandlers): HTMLElement {
  const result = el(doc, 'div', 'result');
  result.append(el(doc, 'p', 'result__text', view.result === 'win' ? 'あなたの勝ち！' : 'あなたの負け…'));
  const next = el(doc, 'button', 'button button--primary', '次へ');
  next.type = 'button';
  next.addEventListener('click', () => handlers.onContinue());
  result.append(next);
  return result;
}

function menu(doc: Document, view: BattleView, handlers: BattleScreenHandlers): HTMLElement {
  const row = el(doc, 'div', 'menu');
  const speed = el(doc, 'button', 'menu__button', `速さ ×${view.speed}`);
  speed.type = 'button';
  speed.setAttribute('aria-label', `演出の速さ（いまは ${view.speed} 倍）`);
  speed.addEventListener('click', () => handlers.onToggleSpeed());
  const sound = el(doc, 'button', 'menu__button sound-toggle', view.sound ? '音 オン' : '音 オフ');
  sound.type = 'button';
  sound.setAttribute('aria-pressed', String(view.sound));
  sound.setAttribute('aria-label', `効果音と BGM（いまは${view.sound ? 'オン' : 'オフ'}）`);
  sound.addEventListener('click', () => handlers.onToggleSound());
  row.append(speed, sound);
  if (view.phase === 'playing') {
    row.append(el(doc, 'span', 'menu__hint', 'タップで早送り'));
  }
  return row;
}

/** 場のキャラのHPバーの、いまの幅（%）。キーは「陣営:キャラ ID」 */
function currentHpWidths(root: HTMLElement): Map<string, string> {
  const widths = new Map<string, string>();
  for (const fill of root.querySelectorAll<HTMLElement>('.fighter .hp-bar__fill')) {
    const panel = fill.closest<HTMLElement>('.fighter');
    const barWidth = fill.parentElement?.getBoundingClientRect().width ?? 0;
    // 動いている途中なら、いま見えている幅から続ける（幅が測れない環境では、目標の幅を使う）
    const width = barWidth > 0 ? `${(fill.getBoundingClientRect().width / barWidth) * 100}%` : fill.style.width;
    if (panel?.dataset.side !== undefined && panel.dataset.fighter !== undefined) {
      widths.set(`${panel.dataset.side}:${panel.dataset.fighter}`, width);
    }
  }
  return widths;
}

/**
 * HPバーをなめらかに動かす：描き直す前と同じキャラなら、前の幅から新しい幅へ CSS の transition で動かす。
 * 交代して別のキャラになったときは、動かさずにそのまま出す
 */
function animateHpBars(screen: HTMLElement, before: ReadonlyMap<string, string>): void {
  const fills: { fill: HTMLElement; target: string }[] = [];
  for (const fill of screen.querySelectorAll<HTMLElement>('.fighter .hp-bar__fill')) {
    const panel = fill.closest<HTMLElement>('.fighter');
    const from = before.get(`${panel?.dataset.side}:${panel?.dataset.fighter}`);
    if (from !== undefined && from !== fill.style.width) {
      fills.push({ fill, target: fill.style.width });
      fill.style.width = from;
    }
  }
  for (const { fill, target } of fills) {
    // いったん前の幅で描かせてから、新しい幅にする（そうしないと transition が効かない）
    void fill.getBoundingClientRect();
    fill.style.width = target;
  }
}

/** バトル画面を描く（毎回まるごと描き直す） */
export function renderBattleScreen(root: HTMLElement, view: BattleView, handlers: BattleScreenHandlers): void {
  const doc = root.ownerDocument;
  const hpBefore = currentHpWidths(root);

  // 上半分：表示だけ
  const display = el(doc, 'section', 'screen__view battle__view');
  display.setAttribute('aria-label', '表示');
  // ログは直近の数行を残す。いちばん新しい行を明るく、古い行は薄くする
  const log = el(doc, 'p', 'battle__log');
  log.setAttribute('role', 'status');
  view.logLines.forEach((line, index) => {
    const latest = index === view.logLines.length - 1;
    log.append(el(doc, 'span', latest ? 'battle__log-line battle__log-line--latest' : 'battle__log-line', line));
  });
  if (view.caption !== null) {
    display.append(el(doc, 'p', 'battle__caption', view.caption));
  }
  const motionOf = (side: 'enemy' | 'player') => (view.motion?.side === side ? view.motion.kind : null);
  display.append(
    fighterPanel(doc, view.enemy, 'enemy', view.hit === 'enemy', motionOf('enemy')),
    fighterPanel(doc, view.player, 'player', view.hit === 'player', motionOf('player')),
    log,
  );
  if (view.detail !== null) {
    // 長押し中は、ログの上に技の詳細を重ねる（表示だけ。ほかの表示の位置は動かさない）
    display.append(moveDetail(doc, view.detail));
  }

  // 下半分：操作
  const controls = el(doc, 'section', 'screen__controls battle__controls');
  controls.setAttribute('aria-label', '操作');
  if (view.phase === 'ended') {
    controls.append(resultPanel(doc, view, handlers));
  } else if (view.confirm !== null) {
    // 2タップ目：技ボタンの場所に、交代（または次に出す）の確認を出す
    controls.append(confirmPanel(doc, view.confirm, handlers));
  } else {
    if (view.phase === 'command') {
      controls.append(el(doc, 'p', `order-preview order-preview--${view.orderPreview}`, ORDER_PREVIEW_TEXT[view.orderPreview]));
    }
    const moves = el(doc, 'div', 'moves');
    moves.append(...view.moves.map((move) => moveButton(doc, move, handlers)));
    controls.append(moves);
  }
  const bench = el(doc, 'div', 'bench');
  bench.append(...view.bench.map((member) => benchButton(doc, member, handlers)));
  controls.append(bench, menu(doc, view, handlers));

  const screen = el(doc, 'div', `screen battle battle--${view.phase}${view.speed === 2 ? ' battle--fast' : ''}`);
  // 待機中のコマ送りは、描き直しても最初のコマに戻らないように、いまの時刻から続きのコマで始める
  screen.style.setProperty('--anim-delay', `-${Math.round(performance.now() % ANIM_CYCLE_MS)}ms`);
  screen.append(display, controls);
  if (view.phase === 'playing') {
    // 演出中は画面全体を覆い、どこをタップしても早送りする（速さの切り替えだけはこの上に出す）
    const skip = el(doc, 'div', 'playback-skip');
    skip.setAttribute('aria-label', 'タップで早送り');
    skip.addEventListener('click', () => handlers.onSkip());
    screen.append(skip);
  }
  root.replaceChildren(screen);
  animateHpBars(screen, hpBefore);
}
