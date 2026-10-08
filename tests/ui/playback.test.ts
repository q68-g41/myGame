// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectableMoves } from '../../src/engine/moves';
import { activeCombatant, switchTargets } from '../../src/engine/team';
import { describeEvents } from '../../src/ui/messages';
import { buildFrames, MAX_STEP_MS, stepDuration, TURN_PLAYBACK_BUDGET_MS } from '../../src/ui/playback';
import { needsPlayerReplacement, playMove, playReplacement, type BattleSession } from '../../src/ui/session';
import { firstBattleSession, startAppBattle } from '../helpers/app';
import { startSession } from '../helpers/session';

describe('演出のコマ', () => {
  /** 決着までの各操作のセッションを集める */
  function sessions(seed: number): BattleSession[] {
    const list: BattleSession[] = [];
    let session = startSession(seed);
    while (session.state.winner === null) {
      session = needsPlayerReplacement(session)
        ? playReplacement(session, switchTargets(session.state.sides.player)[0]!)
        : playMove(session, selectableMoves(activeCombatant(session.state, 'player'))[0]!.id);
      list.push(session);
    }
    return list;
  }

  it('イベント1つにつき1コマで、ログはイベントの文章', () => {
    for (const session of sessions(1)) {
      const frames = buildFrames(session.previousState, session.lastEvents, session.state);
      expect(frames).toHaveLength(session.lastEvents.length);
      expect(frames.map((frame) => frame.log)).toEqual(describeEvents(session.lastEvents, session.previousState));
    }
  });

  it('最後のコマの HP・場のキャラ・状態異常は、エンジンが返した最終的な状態と同じ', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const session of sessions(seed)) {
        const last = buildFrames(session.previousState, session.lastEvents, session.state).at(-1)!.state;
        for (const side of ['player', 'enemy'] as const) {
          expect(last.sides[side].active).toBe(session.state.sides[side].active);
          expect(last.sides[side].team.map((m) => m.hp)).toEqual(session.state.sides[side].team.map((m) => m.hp));
          expect(last.sides[side].team.map((m) => m.status?.id ?? null)).toEqual(
            session.state.sides[side].team.map((m) => m.status?.id ?? null),
          );
        }
      }
    }
  });

  it('ダメージを受けたコマでは、受けた側を光らせる', () => {
    const session = sessions(1)[0]!;
    const frames = buildFrames(session.previousState, session.lastEvents, session.state);
    session.lastEvents.forEach((event, index) => {
      const expected = event.type === 'damage' || event.type === 'statusDamage' ? event.side : null;
      expect(frames[index]!.hit).toBe(expected);
    });
  });
});

describe('演出の長さ（仕様書 5：1ターン2秒以内、2倍速あり）', () => {
  it.each([1, 2, 4, 6, 10, 20])('イベント %i 個でも、1ターンが2秒以内', (count) => {
    expect(stepDuration(count, 1) * count).toBeLessThanOrEqual(TURN_PLAYBACK_BUDGET_MS);
    expect(stepDuration(count, 1)).toBeLessThanOrEqual(MAX_STEP_MS);
  });

  it('2倍速なら半分', () => {
    expect(stepDuration(4, 2)).toBe(stepDuration(4, 1) / 2);
  });
});

describe('バトル画面での演出', () => {
  let root: HTMLElement;
  const logText = () => root.querySelector('[role="status"]')?.textContent;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    startAppBattle(root);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const tapFirstMove = () =>
    [...root.querySelectorAll<HTMLButtonElement>('.move-button')].find((button) => !button.disabled)!.click();

  it('技を選ぶと、ログが1行ずつ流れ、2秒以内に終わる。その間は技を選べない', () => {
    const session = playMove(firstBattleSession(), firstMoveId());
    const expected = describeEvents(session.lastEvents, session.previousState);

    tapFirstMove();
    expect(root.querySelector('.battle--playing')).not.toBeNull();
    expect(root.querySelector('.playback-skip')).not.toBeNull();
    expect([...root.querySelectorAll<HTMLButtonElement>('.move-button')].every((b) => b.disabled)).toBe(true);

    const seen = [logText()];
    const step = stepDuration(expected.length, 1);
    for (let i = 1; i < expected.length; i += 1) {
      vi.advanceTimersByTime(step);
      seen.push(logText());
    }
    expect(seen).toEqual(expected);

    vi.advanceTimersByTime(step);
    expect(root.querySelector('.battle--playing')).toBeNull();
    expect(step * expected.length).toBeLessThanOrEqual(TURN_PLAYBACK_BUDGET_MS);
  });

  it('演出中にタップすると、最後まで早送りする', () => {
    tapFirstMove();
    root.querySelector<HTMLElement>('.playback-skip')!.click();
    expect(root.querySelector('.battle--playing')).toBeNull();
    expect(root.querySelector('.playback-skip')).toBeNull();
  });

  it('速さを ×2 にすると、半分の時間で終わる', () => {
    const speed = root.querySelector<HTMLButtonElement>('.menu__button')!;
    expect(speed.textContent).toBe('速さ ×1');
    speed.click();
    expect(root.querySelector('.menu__button')?.textContent).toBe('速さ ×2');

    const session = playMove(firstBattleSession(), firstMoveId());
    const count = session.lastEvents.length;
    tapFirstMove();
    vi.advanceTimersByTime(stepDuration(count, 1) * count * 0.5 + 1);
    expect(root.querySelector('.battle--playing')).toBeNull();
  });

  it('速さの切り替えボタンは、演出中も押せて、早送りにはならない', () => {
    tapFirstMove();
    root.querySelector<HTMLButtonElement>('.menu__button')!.click();
    expect(root.querySelector('.menu__button')?.textContent).toBe('速さ ×2');
    expect(root.querySelector('.battle--playing')).not.toBeNull();
  });

  /** 画面で始めたバトルで、最初に選べる技 */
  function firstMoveId(): string {
    return selectableMoves(activeCombatant(firstBattleSession().state, 'player'))[0]!.id;
  }
});
