// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectableMoves } from '../../src/engine/moves';
import { activeCombatant } from '../../src/engine/team';
import type { BattleEvent } from '../../src/engine/types';
import { buildBattleView } from '../../src/ui/battleView';
import { describeMove, summarizeEffects } from '../../src/ui/moveInfo';
import { comparedEnemySpeed, playMove, playSwitch } from '../../src/ui/session';
import { startAppBattle } from '../helpers/app';
import { startSession } from '../helpers/session';
import { makeCombatant, makeMove, makeSupportMove } from '../helpers/fixtures';

describe('技の詳細（長押しで出す文章）', () => {
  const user = makeCombatant({ attribute: 'crimson' });
  const orange = makeCombatant({ attribute: 'orange' });

  it('攻撃技：属性・種類・威力・いまの相手への相性・共鳴', () => {
    const move = makeMove({ id: 'crimson-strike', attribute: 'crimson', kind: 'normal', power: 60 });
    expect(describeMove(move, user, orange)).toEqual({
      name: '紅撃',
      lines: ['紅属性・通常', '威力 60', 'いまの相手に 有利（×1.5）', '共鳴（×1.2）'],
    });
  });

  it('大技は「使ったあと2ターン使えない」、使用不可の間は残りも出す', () => {
    const big = makeMove({ id: 'blue-burst', attribute: 'blue', kind: 'big', power: 100 });
    const cooling = makeCombatant({ attribute: 'crimson', cooldowns: { 'blue-burst': 2 } });
    expect(describeMove(big, cooling, orange).lines).toEqual([
      '蒼属性・大技',
      '威力 100',
      'いまの相手に 等倍（×1）',
      '使ったあと 2ターン 使えない',
      'あと 2ターン 使えない',
    ]);
  });

  it('先制技と補助技', () => {
    const quick = makeMove({ id: 'quick-jab', attribute: 'yellow', kind: 'priority', power: 35 });
    expect(describeMove(quick, user, orange).lines).toContain('技の中で先に動く');

    const support = makeSupportMove({
      id: 'focus',
      effects: [
        { type: 'stat', target: 'self', stat: 'attack', stages: 2 },
        { type: 'stat', target: 'opponent', stat: 'defense', stages: -1 },
        { type: 'heal', percent: 30 },
        { type: 'status', status: 'erosion' },
      ],
    });
    expect(describeMove(support, user, orange)).toEqual({
      name: '集中',
      lines: ['紅属性・補助', '自分の攻撃を 2段階 上げる', '相手の防御を 1段階 下げる', '自分のHPを 最大HPの30% 回復する', '相手を 侵蝕 にする'],
    });
  });
});

describe('補助技の効果の要約（技ボタン）', () => {
  it('能力変化・回復・状態異常を短く書く', () => {
    expect(summarizeEffects([{ type: 'stat', target: 'self', stat: 'attack', stages: 2 }])).toBe('攻撃↑2');
    expect(summarizeEffects([{ type: 'stat', target: 'opponent', stat: 'defense', stages: -1 }])).toBe('相手の防御↓1');
    expect(summarizeEffects([{ type: 'heal', percent: 30 }])).toBe('回復 30%');
    expect(summarizeEffects([{ type: 'status', status: 'slow' }])).toBe('鈍化にする');
    expect(
      summarizeEffects([
        { type: 'stat', target: 'self', stat: 'attack', stages: 1 },
        { type: 'stat', target: 'self', stat: 'speed', stages: -1 },
      ]),
    ).toBe('攻撃↑1・素早さ↓1');
  });
});

describe('相手の素早さが分かったか', () => {
  const before = startSession(1).state;
  const enemyId = before.sides.enemy.team[0]!.id;
  const used = (side: 'player' | 'enemy', moveKind: 'normal' | 'priority' | 'big' | 'support'): BattleEvent => ({
    type: 'moveUsed',
    side,
    moveId: 'x',
    moveKind,
  });

  it('両方が先制技以外（または両方が先制技）なら、比べたことになる', () => {
    expect(comparedEnemySpeed(before, [used('player', 'normal'), used('enemy', 'big')])).toBe(enemyId);
    expect(comparedEnemySpeed(before, [used('enemy', 'support'), used('player', 'normal')])).toBe(enemyId);
    expect(comparedEnemySpeed(before, [used('player', 'priority'), used('enemy', 'priority')])).toBe(enemyId);
  });

  it('片方だけ先制技、片方が交代、片方が動けなかったときは、比べていない', () => {
    expect(comparedEnemySpeed(before, [used('player', 'priority'), used('enemy', 'normal')])).toBeNull();
    expect(
      comparedEnemySpeed(before, [{ type: 'switched', side: 'player', from: 0, to: 1, reason: 'command' }, used('enemy', 'normal')]),
    ).toBeNull();
    expect(comparedEnemySpeed(before, [used('player', 'normal')])).toBeNull();
  });

  it('相手が交代したあとに動いたら、交代先のキャラと比べたことになる', () => {
    const switched: BattleEvent = { type: 'switched', side: 'enemy', from: 0, to: 2, reason: 'command' };
    expect(comparedEnemySpeed(before, [switched, used('player', 'normal'), used('enemy', 'normal')])).toBe(
      before.sides.enemy.team[2]!.id,
    );
  });
});

describe('行動順の予告と技ボタンの表示', () => {
  const firstMove = (session: ReturnType<typeof startSession>) =>
    selectableMoves(activeCombatant(session.state, 'player')).find((move) => move.kind === 'normal')!.id;

  it('始めは相手の素早さが分からない（？）', () => {
    expect(buildBattleView(startSession(1)).orderPreview).toBe('unknown');
  });

  it('同じ段階の技どうしで1ターン戦ったあとは、いまの素早さで「先に動ける／後になる」を出す', () => {
    const start = startSession(1);
    const next = playMove(start, firstMove(start));
    const enemy = activeCombatant(next.state, 'enemy');
    expect(next.knownEnemySpeeds.has(enemy.id)).toBe(true);
    const player = activeCombatant(next.state, 'player');
    const expected =
      player.stats.speed > enemy.stats.speed ? 'first' : player.stats.speed < enemy.stats.speed ? 'later' : 'tie';
    expect(buildBattleView(next).orderPreview).toBe(expected);
  });

  it('知っている相手でも、交代して別の相手になったら分からない', () => {
    const start = startSession(1);
    const next = playSwitch(start, 1);
    expect(next.knownEnemySpeeds.size).toBe(0);
    expect(buildBattleView(next).orderPreview).toBe('unknown');
  });

  it('技ボタンに、属性の色・威力・種類・いまの相手への相性を出す', () => {
    const session = startSession(1);
    const player = activeCombatant(session.state, 'player');
    const view = buildBattleView(session);
    expect(view.moves.map((move) => move.id)).toEqual(player.moves.map((move) => move.id));
    for (const button of view.moves) {
      const move = player.moves.find((m) => m.id === button.id)!;
      if (move.kind === 'support') {
        expect(button.power).toBeNull();
        expect(button.summary).toBe(summarizeEffects(move.effects));
        expect(button.effectiveness).toBeNull();
        expect(button.kindLabel).toBe('補助');
      } else {
        expect(button.power).toBe(move.power);
        expect(button.summary).toBeNull();
        expect(button.effectiveness).not.toBeNull();
      }
    }
  });
});

describe('画面：長押しで詳細', () => {
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    startAppBattle(root);
  });

  afterEach(() => vi.useRealTimers());

  const firstButton = () => root.querySelector<HTMLButtonElement>('.move-button:not([disabled])')!;
  const press = (target: Element) => target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const release = (target: Element) => target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

  it('技ボタンに威力と行動順の予告が出る', () => {
    expect(root.querySelector('.move-button__power')?.textContent).toMatch(/^威力 \d+$/);
    expect(root.querySelector('.order-preview')?.textContent).toBe('行動順：？（相手の素早さがまだ分からない）');
  });

  it('長押しすると、ログの場所に技の詳細が出る。離すと消えて、技は使わない', () => {
    const button = firstButton();
    const name = button.querySelector('.move-button__name')?.textContent;
    press(button);
    vi.advanceTimersByTime(500);
    expect(root.querySelector('.move-detail__name')?.textContent).toBe(name);
    // 詳細は表示だけ（上半分に操作できる要素は置かない）
    expect(root.querySelector('.screen__view')!.querySelectorAll('button')).toHaveLength(0);

    // 指を離す → 詳細が消え、そのあとのタップ（click）では技を使わない
    release(root.querySelector('[data-move-id]')!);
    firstButton().click();
    expect(root.querySelector('.move-detail')).toBeNull();
    expect(root.querySelector('.battle--playing')).toBeNull();
    expect(root.querySelector('[role="status"]')?.textContent).toBe('バトル開始！ 技を選んでください');
  });

  it('すぐ離した（短いタップ）なら、詳細は出ずに技を使う', () => {
    const button = firstButton();
    press(button);
    vi.advanceTimersByTime(100);
    release(button);
    button.click();
    expect(root.querySelector('.move-detail')).toBeNull();
    expect(root.querySelector('.battle--playing')).not.toBeNull();
  });

  it('長押しのあとでも、次のタップでは技を使える', () => {
    press(firstButton());
    vi.advanceTimersByTime(500);
    release(root.querySelector('[data-move-id]')!);
    // 次のタップ
    const button = firstButton();
    press(button);
    release(button);
    button.click();
    expect(root.querySelector('.battle--playing')).not.toBeNull();
  });
});
