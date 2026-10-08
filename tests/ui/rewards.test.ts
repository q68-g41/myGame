// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { CHARMS, getCharm } from '../../src/data/charms';
import { FIGHTERS } from '../../src/data/fighters';
import { getMove } from '../../src/data/moves';
import { createBattle } from '../../src/engine/battle';
import type { RewardOffer, RunState } from '../../src/engine/run';
import { startApp } from '../../src/ui/app';
import { buildBattleView } from '../../src/ui/battleView';
import { buildMapView, buildRewardView, INITIAL_REWARD_UI, rewardNotice } from '../../src/ui/runView';
import { createSession } from '../../src/ui/session';

const INTERACTIVE = 'button, a, input, select, textarea';

const team = FIGHTERS.slice(0, 3).map((fighter) => ({ fighter, hp: fighter.stats.hp }));
const OFFERS: readonly RewardOffer[] = [
  { kind: 'move', move: getMove('blue-burst') },
  { kind: 'stat', member: 0, stat: 'attack', amount: 7 },
  { kind: 'charm', charm: CHARMS[0]! },
];
const rewardRun = (pick = 1, picks = 1, members = team): RunState => ({
  area: 0,
  map: { layers: [[{ kind: 'battle', next: [] }]] },
  position: { layer: 0, index: 0 },
  team: members,
  charms: [],
  phase: { kind: 'reward', offers: OFFERS, pick, picks },
  rng: 1,
});

describe('報酬の画面に出す内容', () => {
  it('選択肢は 技・能力・お守り。選ぶまでは決定できない', () => {
    const view = buildRewardView(rewardRun());
    expect(view.heading).toBe('報酬を選ぶ');
    expect(view.offers.map((offer) => [offer.kindLabel, offer.title, offer.detail])).toEqual([
      ['技', '大瀑布', '蒼属性・大技・威力100'],
      ['能力', 'ベニギツネの攻撃 +7', '65 → 72'],
      ['お守り', '先手のお守り', '先制技の威力 +20%'],
    ]);
    expect(view.canConfirm).toBe(false);
    expect(view.detail).toBeNull();

    const selected = buildRewardView(rewardRun(), { ...INITIAL_REWARD_UI, selected: 1 });
    expect(selected.canConfirm).toBe(true);
    expect(selected.offers.map((offer) => offer.selected)).toEqual([false, true, false]);
    expect(selected.detail?.title).toBe('能力強化：ベニギツネの攻撃 +7');
  });

  it('強敵のときは、何回目かを出す', () => {
    expect(buildRewardView(rewardRun(2, 2)).heading).toBe('報酬を選ぶ（2/2）');
  });

  it('技を覚えさせるキャラ：もう覚えているキャラは選べない', () => {
    const blue = FIGHTERS.find((fighter) => fighter.id === 'blue-trial')!;
    const members = [team[0]!, { fighter: blue, hp: blue.stats.hp }, team[2]!];
    const view = buildRewardView(rewardRun(1, 1, members), { step: 'member', selected: 0, member: null });
    expect(view.prompt).toBe('大瀑布を だれに覚えさせますか？');
    expect(view.members.map((m) => [m.name, m.disabled, m.note])).toEqual([
      ['ベニギツネ', false, '技 4/4'],
      ['シズクサギ', true, 'もう覚えている'],
      ['イナホイタチ', false, '技 4/4'],
    ]);
  });

  it('忘れる技：忘れると大技だけになる技は選べない', () => {
    const bigHeavy = {
      ...team[0]!.fighter,
      moves: [getMove('crimson-burst'), getMove('orange-burst'), getMove('yellow-burst'), getMove('crimson-strike')],
    };
    const members = [{ fighter: bigHeavy, hp: 50 }, team[1]!, team[2]!];
    const view = buildRewardView(rewardRun(1, 1, members), { step: 'forget', selected: 0, member: 0 });
    expect(view.prompt).toBe('ベニギツネは 技を4つ覚えています。忘れる技を選んでください');
    expect(view.forgets.map((f) => [f.name, f.disabled])).toEqual([
      ['紅炎落とし', false],
      ['大地返し', false],
      ['鳴神', false],
      ['緋の爪', true],
    ]);
  });

  it('受け取ったあとにマップに出す一言', () => {
    expect(rewardNotice(rewardRun(), { offer: 0, member: 2 })).toBe('イナホイタチが 大瀑布を覚えた');
    expect(rewardNotice(rewardRun(), { offer: 1 })).toBe('ベニギツネの 攻撃が 7 上がった');
    expect(rewardNotice(rewardRun(), { offer: 2 })).toBe('先手のお守りを手に入れた');
  });

  it('マップに、持っているお守りを出す', () => {
    const run: RunState = { ...rewardRun(), phase: { kind: 'map' }, position: null, charms: [getCharm('relay-charm')] };
    expect(buildMapView(run).charms).toEqual(['入れ替えのお守り']);
  });

  it('先手のお守りがあれば、技ボタンの先制技の威力に反映する', () => {
    const crimson = FIGHTERS.find((fighter) => fighter.id === 'crimson-trial')!;
    const battle = createBattle([crimson], [FIGHTERS[1]!], { playerCharms: [getCharm('swift-charm').effect] });
    const view = buildBattleView(createSession(battle, 1));
    expect(view.moves.find((move) => move.id === 'quick-jab')?.power).toBe(42);
    expect(view.moves.find((move) => move.id === 'crimson-strike')?.power).toBe(60);
    const detail = buildBattleView(createSession(battle, 1), { selectedBench: null, speed: 1, detailMoveId: 'quick-jab' }).detail;
    expect(detail?.lines).toContain('威力 42（お守りで 35 から上がっている）');
  });
});

describe('報酬の画面', () => {
  let root: HTMLElement;

  /** 最初の戦闘に勝つまで、シードを変えて遊ぶ（勝ったら報酬の画面で止まる） */
  function reachReward(): void {
    for (let seed = 1; seed < 30; seed += 1) {
      document.body.innerHTML = '<div id="app"></div>';
      root = document.querySelector<HTMLElement>('#app')!;
      startApp(root, { buildId: 'test', newSeed: () => seed });
      root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
      for (const index of [0, 1, 2]) {
        root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
      }
      root.querySelector<HTMLButtonElement>('.draft__controls .button--primary')!.click();
      root.querySelector<HTMLButtonElement>('.map-choice')!.click();
      for (let i = 0; i < 300 && root.querySelector('.result') === null; i += 1) {
        root.querySelector<HTMLElement>('.playback-skip')?.click();
        (
          root.querySelector<HTMLButtonElement>('.confirm .button--primary') ??
          root.querySelector<HTMLButtonElement>('.move-button:not([disabled])') ??
          root.querySelector<HTMLButtonElement>('.bench-button:not([disabled])')
        )?.click();
        root.querySelector<HTMLElement>('.playback-skip')?.click();
      }
      root.querySelector<HTMLButtonElement>('.result button')!.click();
      if (root.querySelector('.reward')) {
        return;
      }
    }
    throw new Error('最初の戦闘に勝てませんでした');
  }

  const offer = (kind: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('.reward-offer')].find(
      (button) => button.querySelector('.reward-offer__kind')?.textContent === kind,
    )!;
  const confirm = () => root.querySelector<HTMLButtonElement>('.reward__controls .button--primary')!;
  const onlyBottomIsInteractive = () => {
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
  };

  it('勝つと3択が下半分に出る。タップで選んで詳細が出て、「決定」で受け取る（2タップ）', () => {
    reachReward();
    expect(root.querySelectorAll('.screen__controls .reward-offer')).toHaveLength(3);
    expect(confirm().disabled).toBe(true);
    onlyBottomIsInteractive();

    offer('能力').click();
    expect(root.querySelector('.reward-detail__title')?.textContent).toMatch(/^能力強化：/);
    expect(root.querySelector('.reward')).not.toBeNull();
    confirm().click();
    expect(root.querySelector('.map-screen')).not.toBeNull();
    expect(root.querySelector('.map__message')?.textContent).toMatch(/が \d+ 上がった$/);
  });

  it('お守りを受け取ると、マップに出る', () => {
    reachReward();
    const name = offer('お守り').querySelector('.reward-offer__title')?.textContent;
    offer('お守り').click();
    confirm().click();
    expect(root.querySelector('.charm-line')?.textContent).toBe(`お守り：${name}`);
  });

  it('技は、覚えさせるキャラ → 忘れる技 の順に選ぶ。「戻る」で1つ前に戻れる', () => {
    reachReward();
    const moveName = offer('技').querySelector('.reward-offer__title')?.textContent;
    offer('技').click();
    confirm().click();
    expect(root.querySelector('.reward__prompt')?.textContent).toBe(`${moveName}を だれに覚えさせますか？`);
    expect(root.querySelectorAll('.reward-members .reward-option')).toHaveLength(3);
    onlyBottomIsInteractive();

    // 戻る → 3択に戻る（選んだものはそのまま）
    root.querySelector<HTMLButtonElement>('.reward__controls .button--secondary')!.click();
    expect(root.querySelectorAll('.reward-offer')).toHaveLength(3);
    confirm().click();

    const member = root.querySelector<HTMLButtonElement>('.reward-members .reward-option:not([disabled])')!;
    const memberName = member.querySelector('.reward-option__name')?.textContent;
    member.click();
    expect(root.querySelectorAll('.reward-forgets .reward-option')).toHaveLength(4);
    expect(root.querySelector('.reward__prompt')?.textContent).toBe(`${memberName}は 技を4つ覚えています。忘れる技を選んでください`);
    onlyBottomIsInteractive();

    root.querySelector<HTMLButtonElement>('.reward-forgets .reward-option:not([disabled])')!.click();
    expect(root.querySelector('.map__message')?.textContent).toBe(`${memberName}が ${moveName}を覚えた`);
  });
});
