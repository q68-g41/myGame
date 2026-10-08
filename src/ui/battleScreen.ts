/**
 * バトル画面（M3）。上半分は表示だけ（相手・自分・ログ1行）、下半分に操作（技ボタン 2×2・控え）。
 * 表示する内容は battleView.ts で組み立て、ここでは描くだけにする。
 */
import type { BattleView, BenchView, FighterPanelView, MoveButtonView } from './battleView';
import { el } from './dom';

export interface BattleScreenHandlers {
  onMove(moveId: string): void;
  onBench(index: number): void;
  onRetry(): void;
  onTitle(): void;
}

function hpLevel(hp: number, maxHp: number): 'high' | 'middle' | 'low' {
  const ratio = hp / maxHp;
  return ratio > 0.5 ? 'high' : ratio > 0.2 ? 'middle' : 'low';
}

function fighterPanel(doc: Document, view: FighterPanelView, side: 'enemy' | 'player'): HTMLElement {
  const panel = el(doc, 'div', `fighter fighter--${side}`);
  panel.dataset.side = side;

  // 仮素材：属性の色の四角（M4 でドット絵に差し替える）
  const sprite = el(doc, 'div', 'fighter__sprite');
  sprite.style.background = view.color;
  sprite.setAttribute('aria-hidden', 'true');

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

function moveButton(doc: Document, view: MoveButtonView, handlers: BattleScreenHandlers): HTMLButtonElement {
  const button = el(doc, 'button', 'move-button');
  button.type = 'button';
  button.disabled = view.disabled;
  button.dataset.moveId = view.id;
  button.append(el(doc, 'span', 'move-button__name', view.name));
  if (view.note !== null) {
    button.append(el(doc, 'span', 'move-button__note', view.note));
  }
  button.addEventListener('click', () => handlers.onMove(view.id));
  return button;
}

function benchButton(doc: Document, view: BenchView, handlers: BattleScreenHandlers): HTMLButtonElement {
  const button = el(doc, 'button', `bench-button${view.selectable ? ' bench-button--selectable' : ''}`);
  button.type = 'button';
  button.disabled = !view.selectable;
  button.dataset.index = String(view.index);

  const icon = el(doc, 'span', 'bench-button__icon');
  icon.style.background = view.fainted ? 'transparent' : view.color;
  icon.setAttribute('aria-hidden', 'true');
  const label = el(doc, 'span', 'bench-button__label');
  label.append(
    el(doc, 'span', 'bench-button__name', view.name),
    el(doc, 'span', 'bench-button__hp', view.fainted ? '倒れている' : `HP ${view.hp} / ${view.maxHp}`),
  );
  button.append(icon, label);
  button.addEventListener('click', () => handlers.onBench(view.index));
  return button;
}

function resultPanel(doc: Document, view: BattleView, handlers: BattleScreenHandlers): HTMLElement {
  const result = el(doc, 'div', 'result');
  result.append(el(doc, 'p', 'result__text', view.result === 'win' ? 'あなたの勝ち！' : 'あなたの負け…'));
  const retry = el(doc, 'button', 'button button--primary', 'もう一度');
  retry.type = 'button';
  retry.addEventListener('click', () => handlers.onRetry());
  const title = el(doc, 'button', 'button button--secondary', 'タイトルへ');
  title.type = 'button';
  title.addEventListener('click', () => handlers.onTitle());
  result.append(retry, title);
  return result;
}

/** バトル画面を描く（毎回まるごと描き直す） */
export function renderBattleScreen(root: HTMLElement, view: BattleView, handlers: BattleScreenHandlers): void {
  const doc = root.ownerDocument;

  // 上半分：表示だけ
  const display = el(doc, 'section', 'screen__view battle__view');
  display.setAttribute('aria-label', '表示');
  const log = el(doc, 'p', 'battle__log', view.log);
  log.setAttribute('role', 'status');
  display.append(fighterPanel(doc, view.enemy, 'enemy'), fighterPanel(doc, view.player, 'player'), log);

  // 下半分：操作
  const controls = el(doc, 'section', 'screen__controls battle__controls');
  controls.setAttribute('aria-label', '操作');
  if (view.phase === 'ended') {
    controls.append(resultPanel(doc, view, handlers));
  } else {
    const moves = el(doc, 'div', 'moves');
    moves.append(...view.moves.map((move) => moveButton(doc, move, handlers)));
    controls.append(moves);
  }
  const bench = el(doc, 'div', 'bench');
  bench.append(...view.bench.map((member) => benchButton(doc, member, handlers)));
  controls.append(bench);

  const screen = el(doc, 'div', `screen battle battle--${view.phase}`);
  screen.append(display, controls);
  root.replaceChildren(screen);
}
