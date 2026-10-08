// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { getEvent } from '../../src/data/events';
import { FIGHTERS } from '../../src/data/fighters';
import { chooseEventOption } from '../../src/engine/nodes';
import type { RunState } from '../../src/engine/run';
import { startApp } from '../../src/ui/app';
import { renderRestScreen } from '../../src/ui/nodeScreens';
import {
  buildEventView,
  buildRestView,
  buildScoutView,
  INITIAL_REST_UI,
  restNotice,
  scoutNotice,
} from '../../src/ui/nodeView';

const INTERACTIVE = 'button, a, input, select, textarea';

const team = FIGHTERS.slice(0, 3).map((fighter) => ({ fighter, hp: 50 }));
const runIn = (phase: RunState['phase']): RunState => ({
  area: 0,
  map: { layers: [[{ kind: 'rest', next: [] }]] },
  position: { layer: 0, index: 0 },
  team,
  charms: [],
  phase,
  rng: 3,
});

describe('休憩の画面に出す内容', () => {
  const run = runIn({ kind: 'rest' });

  it('回復と技の強化の2択。選ぶまでは決定できない', () => {
    const view = buildRestView(run);
    expect(view.options.map((o) => [o.title, o.detail])).toEqual([
      ['ゆっくり休む', '全員のHPが 最大HPの30% 回復する'],
      ['技をみがく', '攻撃技を1つ選んで、威力 +10'],
    ]);
    expect(view.canConfirm).toBe(false);
    expect(buildRestView(run, { ...INITIAL_REST_UI, selected: 'power' }).canConfirm).toBe(true);
  });

  it('技の強化：キャラ → 技の順に選ぶ。補助技は選べない', () => {
    expect(buildRestView(run, { step: 'member', selected: 'power', member: null }).members.map((m) => m.name)).toEqual([
      '仮・紅',
      '仮・橙',
      '仮・黄',
    ]);
    const moves = buildRestView(run, { step: 'move', selected: 'power', member: 0 });
    expect(moves.prompt).toBe('仮・紅の どの技を強化しますか？');
    expect(moves.moves.map((m) => [m.name, m.detail, m.disabled])).toEqual([
      ['紅撃', '威力 60 → 70', false],
      ['紅の大技', '威力 100 → 110', false],
      ['先手突き', '威力 35 → 45', false],
      ['集中', '補助技は強化できない', true],
    ]);
  });

  it('マップに出す一言', () => {
    expect(restNotice(run, 'heal')).toBe('全員のHPが回復した');
    expect(restNotice(run, { member: 0, move: 2 })).toBe('仮・紅の 先手突きの威力が 45 になった');
  });
});

describe('スカウトの画面に出す内容', () => {
  const candidates = FIGHTERS.slice(3, 6);
  const run = runIn({ kind: 'scout', candidates });

  it('候補3体。選ぶと詳細が出て、入れ替えるキャラを選びに進める', () => {
    const view = buildScoutView(run);
    expect(view.candidates.map((c) => c.name)).toEqual(['仮・翠', '仮・蒼', '仮・紫']);
    expect(view.canConfirm).toBe(false);
    expect(view.detail).toBeNull();

    const selected = buildScoutView(run, { step: 'candidate', selected: 1 });
    expect(selected.detail?.name).toBe('仮・蒼');
    const member = buildScoutView(run, { step: 'member', selected: 1 });
    expect(member.prompt).toBe('仮・蒼と だれを入れ替えますか？（抜けたキャラは戻りません）');
    expect(member.members.map((m) => m.note)).toEqual(['HP 50 / 95', 'HP 50 / 115', 'HP 50 / 85']);
  });

  it('マップに出す一言', () => {
    expect(scoutNotice(run, { candidate: 2, member: 1 })).toBe('仮・紫が仲間になった（仮・橙と入れ替え）');
    expect(scoutNotice(run, 'skip')).toBe('だれも入れ替えずに進んだ');
  });
});

describe('イベントの画面に出す内容', () => {
  it('文章と選択肢（起きることの説明つき）。選んだあとは結果を1行ずつ出す', () => {
    const event = getEvent('training-ground');
    const run = runIn({ kind: 'event', event, outcome: null });
    const view = buildEventView(run);
    expect(view.title).toBe('修行場');
    expect(view.options.map((o) => o.label)).toEqual(['きびしく鍛える', '軽く体を動かす']);
    expect(view.result).toBeNull();

    const done = buildEventView(chooseEventOption(run, 0));
    expect(done.prompt).toBe('「きびしく鍛える」を選んだ');
    expect(done.result).toEqual(['仮・紅は HPが 23 減った', '仮・紅の 攻撃が 7 上がった', '仮・紅の 防御が 5 上がった']);
  });

  it('HPが変わらなかったときは、満タンか、これ以上減らないかを書く', () => {
    const spring = getEvent('glowing-spring');
    const run: RunState = {
      ...runIn({ kind: 'event', event: spring, outcome: null }),
      team: [{ fighter: FIGHTERS[0]!, hp: 95 }, { fighter: FIGHTERS[1]!, hp: 1 }, team[2]!],
    };
    const outcome = [
      { type: 'hp', member: 0, delta: 0, hp: 95 },
      { type: 'hp', member: 1, delta: 0, hp: 1 },
    ] as const;
    expect(buildEventView({ ...run, phase: { kind: 'event', event: spring, outcome, chosen: 0 } }).result).toEqual([
      '仮・紅の HPは 満タンだ',
      '仮・橙の HPは これ以上減らない',
    ]);
  });
});

describe('休憩の画面', () => {
  // 休憩は6層目にあるので、画面を直接描いて確かめる
  const run = runIn({ kind: 'rest' });
  const handlers = { onSelect: vi.fn(), onConfirm: vi.fn(), onMember: vi.fn(), onMove: vi.fn(), onBack: vi.fn() };
  const draw = (ui: Parameters<typeof buildRestView>[1]) => {
    document.body.innerHTML = '<div id="app"></div>';
    const root = document.querySelector<HTMLElement>('#app')!;
    renderRestScreen(root, buildRestView(run, ui), handlers);
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
    return root;
  };

  it('2択を選んで「決定」。選ぶまでは押せない', () => {
    const root = draw(INITIAL_REST_UI);
    expect(root.querySelector<HTMLButtonElement>('.button--primary')!.disabled).toBe(true);
    root.querySelectorAll<HTMLButtonElement>('.node-option')[1]!.click();
    expect(handlers.onSelect).toHaveBeenLastCalledWith('power');
    const selected = draw({ ...INITIAL_REST_UI, selected: 'power' });
    expect(selected.querySelector('.node-option--selected .node-option__title')?.textContent).toBe('技をみがく');
    selected.querySelector<HTMLButtonElement>('.button--primary')!.click();
    expect(handlers.onConfirm).toHaveBeenCalled();
  });

  it('キャラ → 技の順に選ぶ。補助技は押せず、「戻る」がある', () => {
    const members = draw({ step: 'member', selected: 'power', member: null });
    members.querySelectorAll<HTMLButtonElement>('.node-members .node-pick')[2]!.click();
    expect(handlers.onMember).toHaveBeenLastCalledWith(2);

    const moves = draw({ step: 'move', selected: 'power', member: 0 });
    const buttons = [...moves.querySelectorAll<HTMLButtonElement>('.node-moves .node-pick')];
    expect(buttons.map((b) => b.disabled)).toEqual([false, false, false, true]);
    buttons[1]!.click();
    expect(handlers.onMove).toHaveBeenLastCalledWith(1);
    moves.querySelector<HTMLButtonElement>('.button--secondary')!.click();
    expect(handlers.onBack).toHaveBeenCalled();
  });
});

describe('スカウト・イベントの画面', () => {
  let root: HTMLElement;
  const primary = () => root.querySelector<HTMLButtonElement>('.screen__controls .button--primary')!;
  const secondary = () => root.querySelector<HTMLButtonElement>('.screen__controls .button--secondary')!;
  const onlyBottomIsInteractive = () =>
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);

  /** バトルは決着まで進め、報酬は能力強化を受け取る */
  function playBattle(): void {
    for (let i = 0; i < 500 && root.querySelector('.result') === null; i += 1) {
      root.querySelector<HTMLElement>('.playback-skip')?.click();
      (
        root.querySelector<HTMLButtonElement>('.confirm .button--primary') ??
        root.querySelector<HTMLButtonElement>('.move-button:not([disabled])') ??
        root.querySelector<HTMLButtonElement>('.bench-button:not([disabled])')
      )?.click();
      root.querySelector<HTMLElement>('.playback-skip')?.click();
    }
    root.querySelector<HTMLButtonElement>('.result button')!.click();
    while (root.querySelector('.reward')) {
      [...root.querySelectorAll<HTMLButtonElement>('.reward-offer')]
        .find((offer) => offer.querySelector('.reward-offer__kind')?.textContent === '能力')!
        .click();
      primary().click();
    }
  }

  /**
   * シードを変えながらランを進め、マップで target のマスを選べるときは選ぶ。target の画面になったら止まる。
   * 休憩・スカウト・イベントの画面のうち target 以外は、すぐに済ませて進む
   */
  function reach(target: 'スカウト' | 'イベント', screenClass: string): void {
    for (let seed = 1; seed < 60; seed += 1) {
      document.body.innerHTML = '<div id="app"></div>';
      root = document.querySelector<HTMLElement>('#app')!;
      startApp(root, { buildId: 'test', newSeed: () => seed });
      root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
      for (const index of [0, 1, 2]) {
        root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
      }
      root.querySelector<HTMLButtonElement>('.draft__controls .button--primary')!.click();
      for (let step = 0; step < 30 && !root.querySelector('.run-end'); step += 1) {
        if (root.querySelector(screenClass)) {
          return;
        }
        if (root.querySelector('.map-screen')) {
          const choices = [...root.querySelectorAll<HTMLButtonElement>('.map-choice')];
          (choices.find((c) => c.querySelector('.map-choice__name')?.textContent === target) ?? choices[0]!).click();
        } else if (root.querySelector('.rest')) {
          root.querySelector<HTMLButtonElement>('.node-option')!.click();
          primary().click();
        } else if (root.querySelector('.scout')) {
          secondary().click();
        } else if (root.querySelector('.event')) {
          root.querySelector<HTMLButtonElement>('.node-option')!.click();
          primary().click();
          primary().click();
        } else {
          playBattle();
        }
      }
    }
    throw new Error(`${target}のマスにたどり着けませんでした`);
  }

  it('スカウト：候補を選んで「この仲間を入れる」→ 入れ替えるキャラを選ぶと、チームが入れ替わる', () => {
    reach('スカウト', '.scout');
    onlyBottomIsInteractive();
    expect(primary().disabled).toBe(true);
    const candidate = root.querySelectorAll<HTMLButtonElement>('.node-pick')[1]!;
    const name = candidate.querySelector('.node-pick__name')?.textContent;
    candidate.click();
    expect(root.querySelector('.fighter-detail__name')?.textContent).toBe(name);
    primary().click();
    root.querySelectorAll<HTMLButtonElement>('.node-members .node-pick')[2]!.click();
    expect(root.querySelector('.map__message')?.textContent).toMatch(new RegExp(`^${name}が仲間になった`));
    expect(root.querySelectorAll('.member__name')[2]?.textContent).toBe(name);
  });

  it('スカウト：入れ替えずに進むこともできる', () => {
    reach('スカウト', '.scout');
    secondary().click();
    expect(root.querySelector('.map__message')?.textContent).toBe('だれも入れ替えずに進んだ');
  });

  it('イベント：選択肢を選んで決定すると結果が出て、「次へ」でマップに戻る', () => {
    reach('イベント', '.event');
    onlyBottomIsInteractive();
    expect(root.querySelector('.event-result')).toBeNull();
    root.querySelectorAll<HTMLButtonElement>('.node-option')[1]!.click();
    primary().click();
    expect(root.querySelectorAll('.event-result li').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('.node-option')).toHaveLength(0);
    onlyBottomIsInteractive();
    primary().click();
    expect(root.querySelector('.map-screen')).not.toBeNull();
  });
});
