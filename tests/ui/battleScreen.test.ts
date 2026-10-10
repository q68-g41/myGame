// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFighter } from '../../src/data/fighters';
import { createBattle } from '../../src/engine/battle';
import { renderBattleScreen } from '../../src/ui/battleScreen';
import { buildBattleView } from '../../src/ui/battleView';
import { createSession } from '../../src/ui/session';
import { animUrl } from '../../src/ui/sprites';
import { startAppBattle } from '../helpers/app';

const INTERACTIVE = 'button, a, input, select, textarea';

let root: HTMLElement;

function startBattle(seed = 1): void {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.querySelector<HTMLElement>('#app')!;
  startAppBattle(root, seed);
}

/** 押せるボタン（技ボタンは、長押しできるように disabled ではなく aria-disabled で押せなくしている） */
const enabled = (selector: string) =>
  [...root.querySelectorAll<HTMLButtonElement>(selector)].filter(
    (button) => !button.disabled && button.getAttribute('aria-disabled') !== 'true',
  );

/** 演出中なら早送りして、最終的な画面にする */
function finishPlayback(): void {
  root.querySelector<HTMLElement>('.playback-skip')?.click();
}

/**
 * 1手進める：確認が出ていれば確定、そうでなければ選べる技の先頭、なければ選べる控えの先頭をタップする。
 * 押したあとの演出は早送りする。押せるものがなければ false
 */
function tapSomething(): boolean {
  finishPlayback();
  const target =
    root.querySelector<HTMLButtonElement>('.confirm .button--primary') ??
    enabled('.move-button')[0] ??
    enabled('.bench-button')[0];
  target?.click();
  finishPlayback();
  return target !== undefined && target !== null;
}

/** ログのいちばん新しい行 */
const logText = () => root.querySelector('.battle__log-line--latest')?.textContent;
const playerName = () => root.querySelector('[data-side="player"] .fighter__name')?.textContent;

describe('バトル画面', () => {
  beforeEach(() => startBattle());

  it('上半分にいまのマス・相手・自分・ログ、下半分に技ボタン 2×2 と控え2体がある', () => {
    const view = root.querySelector('.screen__view')!;
    const controls = root.querySelector('.screen__controls')!;
    expect(view.querySelector('.battle__caption')?.textContent).toBe('エリア1・1層目・戦闘');
    expect(view.querySelector('[data-side="enemy"]')).not.toBeNull();
    expect(view.querySelector('[data-side="player"]')).not.toBeNull();
    expect(view.querySelector('[role="status"]')?.textContent).toBe('バトル開始！ 技を選んでください');
    expect(controls.querySelectorAll('.move-button')).toHaveLength(4);
    expect(controls.querySelectorAll('.bench-button')).toHaveLength(2);
  });

  it('場のキャラはコマ送りのドット絵を2倍で出し（1コマぶんの窓に4コマ並べた絵）、相手側だけ左右反転する', () => {
    const player = root.querySelector<HTMLElement>('[data-side="player"] .sprite--anim')!;
    const enemy = root.querySelector<HTMLElement>('[data-side="enemy"] .sprite--anim')!;
    for (const frame of [player, enemy]) {
      expect(frame.style.width).toBe('96px');
      const strip = frame.querySelector<HTMLImageElement>('img.sprite__frames')!;
      expect(strip.getAttribute('width')).toBe('384');
      expect(strip.getAttribute('height')).toBe('96');
    }
    const fighter = (side: string) => root.querySelector<HTMLElement>(`[data-side="${side}"]`)!.dataset.fighter!;
    expect(player.querySelector('img')!.getAttribute('src')).toBe(animUrl(fighter('player')));
    expect(player.classList.contains('sprite--flipped')).toBe(false);
    expect(enemy.classList.contains('sprite--flipped')).toBe(true);
  });

  it('操作できる要素は下半分（操作領域）にだけ置く', () => {
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
  });

  it('控えのボタンに、キャラの小さい絵（32×32）が出る', () => {
    const icons = [...root.querySelectorAll<HTMLImageElement>('.bench-button img.bench-button__icon')];
    expect(icons).toHaveLength(2);
    expect(icons.every((icon) => icon.getAttribute('width') === '32')).toBe(true);
    expect(root.querySelector('.bench-button__icon--fainted')).toBeNull();
  });

  it('HP は自分も相手もバーと数字で出す', () => {
    for (const side of ['enemy', 'player']) {
      const panel = root.querySelector(`[data-side="${side}"]`)!;
      expect(panel.querySelector('.hp-bar__fill')).not.toBeNull();
      expect(panel.querySelector('.fighter__hp')?.textContent).toMatch(/^HP \d+ \/ \d+$/);
    }
  });

  it('技をタップするとターンが進み、ログが変わる', () => {
    const before = logText();
    enabled('.move-button')[0]!.click();
    expect(logText()).not.toBe(before);
  });

  it('控えをタップすると、技ボタンの代わりに交代の確認が出る（1タップ目）', () => {
    const bench = enabled('.bench-button')[0]!;
    const benchName = bench.querySelector('.bench-button__name')?.textContent;
    bench.click();
    expect(root.querySelector('.move-button')).toBeNull();
    expect(root.querySelector('.confirm__question')?.textContent).toBe(`${playerName()}を戻して ${benchName}と交代しますか？`);
    expect(root.querySelector('.bench-button--selected .bench-button__name')?.textContent).toBe(benchName);
    // 操作できる要素は下半分だけ
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
  });

  it('［やめる］か、同じ控えをもう一度タップすると、選択をやめて技ボタンに戻る', () => {
    enabled('.bench-button')[0]!.click();
    root.querySelector<HTMLButtonElement>('.confirm .button--secondary')!.click();
    expect(root.querySelector('.confirm')).toBeNull();
    expect(root.querySelectorAll('.move-button')).toHaveLength(4);

    enabled('.bench-button')[0]!.click();
    root.querySelector<HTMLButtonElement>('.bench-button--selected')!.click();
    expect(root.querySelector('.confirm')).toBeNull();
  });

  it('［交代する］でターンが進み、選んだ控えが場に出る（2タップ目）', () => {
    const bench = enabled('.bench-button')[1]!;
    const benchName = bench.querySelector('.bench-button__name')?.textContent;
    bench.click();
    root.querySelector<HTMLButtonElement>('.confirm .button--primary')!.click();
    expect(root.querySelector('.confirm')).toBeNull();
    // 演出の最初のコマが交代
    expect(playerName()).toBe(benchName);
    expect(logText()).toMatch(/を戻して .+を出した$/);
  });

  it('最後まで遊ぶと勝敗が出て、「次へ」で勝てば報酬、負ければランの結果に進む', () => {
    for (let i = 0; i < 300 && root.querySelector('.result') === null; i += 1) {
      expect(tapSomething()).toBe(true);
      // どの場面でも、操作できる要素は下半分だけ
      expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
    }
    const result = root.querySelector('.result');
    const text = result?.querySelector('.result__text')?.textContent;
    expect(text).toMatch(/あなたの(勝ち！|負け…)/);
    expect(result!.querySelectorAll('button')).toHaveLength(1);

    result!.querySelector<HTMLButtonElement>('button')!.click();
    if (text === 'あなたの勝ち！') {
      expect(root.querySelector('.reward')).not.toBeNull();
    } else {
      expect(root.querySelector('.run-end')).not.toBeNull();
    }
  });

  it('倒れたときは控えを選ぶ案内が出て、技は押せず、控えを2タップで出す', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      startBattle(seed);
      for (let i = 0; i < 300 && !root.querySelector('.battle--replacement') && !root.querySelector('.result'); i += 1) {
        enabled('.move-button')[0]!.click();
        finishPlayback();
      }
      if (!root.querySelector('.battle--replacement')) {
        continue;
      }
      expect(logText()).toBe('控えから次のキャラを選んでください');
      expect(enabled('.move-button')).toHaveLength(0);
      const bench = enabled('.bench-button')[0]!;
      const benchName = bench.querySelector('.bench-button__name')?.textContent;
      bench.click();
      expect(root.querySelector('.confirm__question')?.textContent).toBe(`${benchName}を出しますか？`);
      root.querySelector<HTMLButtonElement>('.confirm .button--primary')!.click();
      finishPlayback();
      expect(root.querySelector('.battle--command')).not.toBeNull();
      expect(playerName()).toBe(benchName);
      return;
    }
    throw new Error('自分が倒れる場面が見つかりませんでした');
  });
});

describe('補助技のボタン', () => {
  it('効果が2つ以上なら、語の途中ではなく「・」のところで折り返す', () => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    // アオシャチは「静水」（自分の防御↑1・相手の素早さ↓1）を覚えている
    const team = ['blue-skirmisher', 'crimson-trial', 'orange-trial'].map(getFighter);
    const session = createSession(createBattle(team, [getFighter('green-trial')]), 1);
    const handlers = {
      onMove: vi.fn(),
      onBench: vi.fn(),
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      onContinue: vi.fn(),
      onToggleSpeed: vi.fn(),
      onToggleSound: vi.fn(),
      onSkip: vi.fn(),
    };
    renderBattleScreen(root, buildBattleView(session), handlers);
    const button = root.querySelector('[data-move-id="stillwater"]')!;
    expect(button.querySelector('.move-button__power')?.textContent).toBe('防御↑1・相手の素早さ↓1');
    expect([...button.querySelectorAll('.move-button__effect')].map((part) => part.textContent)).toEqual([
      '防御↑1・',
      '相手の素早さ↓1',
    ]);
  });
});

describe('HPバーの動き', () => {
  const handlers = {
    onMove: vi.fn(),
    onBench: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onContinue: vi.fn(),
    onToggleSpeed: vi.fn(),
    onToggleSound: vi.fn(),
    onSkip: vi.fn(),
  };
  const battle = createBattle(['crimson-trial', 'blue-trial'].map(getFighter), ['green-trial', 'yellow-trial'].map(getFighter));
  const session = createSession(battle, 1);
  const view = buildBattleView(session);

  /** 描き直したあと、HPバーの幅（style）が順にどう変わったか */
  function widthChanges(next: typeof view): Record<string, string[]> {
    const observer = new MutationObserver(() => undefined);
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['style'], attributeOldValue: true });
    renderBattleScreen(root, next, handlers);
    // 記録には「変わる前の値」が入るので、次の記録の前の値と、最後の値を並べると「変わったあとの値」の列になる
    const before: Record<string, string[]> = { enemy: [], player: [] };
    for (const record of observer.takeRecords()) {
      const fill = record.target as HTMLElement;
      if (fill.classList.contains('hp-bar__fill')) {
        const side = fill.closest<HTMLElement>('.fighter')!.dataset.side!;
        before[side]!.push(/width:\s*([\d.]+%)/.exec(record.oldValue ?? '')![1]!);
      }
    }
    observer.disconnect();
    const changes: Record<string, string[]> = {};
    for (const side of ['enemy', 'player']) {
      const now = root.querySelector<HTMLElement>(`[data-side="${side}"] .hp-bar__fill`)!.style.width;
      changes[side] = before[side]!.length === 0 ? [] : [...before[side]!.slice(1), now];
    }
    return changes;
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    renderBattleScreen(root, view, handlers);
  });

  it('同じキャラのHPが減ったら、前の幅にしてから新しい幅にする（CSS の transition でなめらかに動く）', () => {
    const hp = view.enemy.maxHp / 2;
    const changes = widthChanges({ ...view, enemy: { ...view.enemy, hp } });
    expect(changes.enemy).toEqual(['100%', '50%']);
    // HPが変わらない側は動かさない
    expect(changes.player).toEqual([]);
    expect(root.querySelector<HTMLElement>('[data-side="enemy"] .hp-bar__fill')!.style.width).toBe('50%');
  });

  it('交代して別のキャラになったときは、動かさずに新しい幅で出す', () => {
    const changes = widthChanges({ ...view, enemy: { ...view.enemy, id: 'yellow-trial', hp: view.enemy.maxHp / 4 } });
    expect(changes.enemy).toEqual([]);
    expect(root.querySelector<HTMLElement>('[data-side="enemy"] .hp-bar__fill')!.style.width).toBe('25%');
  });

  it('2倍速のときは、画面に battle--fast を付けて、HPバーも速く動かす', () => {
    renderBattleScreen(root, { ...view, speed: 2 }, handlers);
    expect(root.querySelector('.battle--fast')).not.toBeNull();
    renderBattleScreen(root, view, handlers);
    expect(root.querySelector('.battle--fast')).toBeNull();
  });
});

describe('キャラの動き（M7-1）', () => {
  const handlers = {
    onMove: vi.fn(),
    onBench: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onContinue: vi.fn(),
    onToggleSpeed: vi.fn(),
    onToggleSound: vi.fn(),
    onSkip: vi.fn(),
  };
  const battle = createBattle(['crimson-trial', 'blue-trial'].map(getFighter), ['green-trial', 'yellow-trial'].map(getFighter));
  const view = buildBattleView(createSession(battle, 1));
  const panel = (side: string) => root.querySelector<HTMLElement>(`[data-side="${side}"]`)!;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
  });

  it('技を使ったコマでは、使った側だけが前に出る', () => {
    renderBattleScreen(root, { ...view, motion: { side: 'enemy', kind: 'attack' } }, handlers);
    expect(panel('enemy').classList.contains('fighter--attack')).toBe(true);
    expect(panel('player').classList.contains('fighter--attack')).toBe(false);
  });

  it('交代のコマでは、出てきた側が入ってくる', () => {
    renderBattleScreen(root, { ...view, motion: { side: 'player', kind: 'enter' } }, handlers);
    expect(panel('player').classList.contains('fighter--enter')).toBe(true);
  });

  it('HPが0になったコマでは揺れるだけ、倒れたコマで倒れる動き、そのあとは薄いまま止める', () => {
    const fainted = { ...view, player: { ...view.player, hp: 0 } };
    renderBattleScreen(root, { ...fainted, hit: 'player' }, handlers);
    expect(panel('player').className).toContain('fighter--hit');
    expect(panel('player').classList.contains('fighter--fainted')).toBe(false);

    renderBattleScreen(root, { ...fainted, motion: { side: 'player', kind: 'faint' } }, handlers);
    expect(panel('player').classList.contains('fighter--faint')).toBe(true);
    expect(panel('player').classList.contains('fighter--fainted')).toBe(false);

    renderBattleScreen(root, fainted, handlers);
    expect(panel('player').classList.contains('fighter--fainted')).toBe(true);
    expect(panel('enemy').classList.contains('fighter--fainted')).toBe(false);
  });

  it('待機中のコマ送りは、描き直しても最初のコマに戻らないように、いまの時刻から続きのコマで始める', () => {
    renderBattleScreen(root, view, handlers);
    expect(root.querySelector<HTMLElement>('.battle')!.style.getPropertyValue('--anim-delay')).toMatch(/^-\d+ms$/);
  });
});
