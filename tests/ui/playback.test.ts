// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectableMoves } from '../../src/engine/moves';
import { activeCombatant, switchTargets } from '../../src/engine/team';
import { describeEvents } from '../../src/ui/messages';
import { buildFrames, LOG_LINES, STEP_MS, stepDuration } from '../../src/ui/playback';
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
      const logs = describeEvents(session.lastEvents, session.previousState);
      expect(frames.map((frame) => frame.log)).toEqual(logs);
      // 画面に残すログは、このターンの直近3行（古い順で、最後がそのコマの行）
      frames.forEach((frame, index) => {
        expect(frame.logLines).toEqual(logs.slice(Math.max(0, index - 2), index + 1));
      });
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

  it('技を使ったコマでは前に出る、倒れたコマでは倒れる、交代のコマでは入ってくる動きを付ける（M7-1）', () => {
    let checked = 0;
    for (const session of sessions(40)) {
      const frames = buildFrames(session.previousState, session.lastEvents, session.state);
      session.lastEvents.forEach((event, index) => {
        const kind = { moveUsed: 'attack', fainted: 'faint', switched: 'enter' }[event.type as string];
        const side = 'side' in event ? event.side : null;
        expect(frames[index]!.motion).toEqual(kind === undefined ? null : { side, kind });
        checked += kind === undefined ? 0 : 1;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('コマごとに、イベントに合わせた効果音を決める。ダメージの音は相性で変える（M7-2）', () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 40]) {
      for (const session of sessions(seed)) {
        const frames = buildFrames(session.previousState, session.lastEvents, session.state);
        session.lastEvents.forEach((event, index) => {
          const sound = frames[index]!.sound;
          if (sound !== null) {
            seen.add(sound);
          }
          switch (event.type) {
            case 'moveUsed':
              expect(sound).toBe('move');
              break;
            case 'damage':
              expect(sound).toBe({ advantage: 'hitStrong', disadvantage: 'hitWeak', neutral: 'hit' }[event.effectiveness]);
              break;
            case 'statusDamage':
              expect(sound).toBe('hit');
              break;
            case 'switched':
              expect(sound).toBe('switch');
              break;
            case 'fainted':
              expect(sound).toBe('faint');
              break;
            case 'battleEnd':
              // 勝ち負けは効果音ではなく、BGM の短い曲で知らせる
              expect(sound).toBeNull();
              break;
            default:
              expect(sound === null || ['heal', 'status'].includes(sound)).toBe(true);
          }
        });
      }
    }
    expect(seen.has('move') && seen.has('faint')).toBe(true);
  });

  it('ダメージ・状態異常のダメージ・回復のコマでは、キャラの上に出す数字を決める。ダメージは相性で種類を変える（M7-4）', () => {
    const kinds = new Set<string>();
    for (const seed of [1, 2, 3, 40]) {
      for (const session of sessions(seed)) {
        const frames = buildFrames(session.previousState, session.lastEvents, session.state);
        session.lastEvents.forEach((event, index) => {
          const popup = frames[index]!.popup;
          if (popup !== null) {
            kinds.add(popup.kind);
          }
          switch (event.type) {
            case 'damage':
              expect(popup).toEqual({ side: event.side, amount: event.amount, kind: event.effectiveness });
              break;
            case 'statusDamage':
              expect(popup).toEqual({ side: event.side, amount: event.amount, kind: 'neutral' });
              break;
            case 'healed':
              // HPが満タンで回復しなかったときは出さない
              expect(popup).toEqual(event.amount > 0 ? { side: event.side, amount: event.amount, kind: 'heal' } : null);
              break;
            default:
              expect(popup).toBeNull();
          }
        });
      }
    }
    expect(kinds.has('neutral')).toBe(true);
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

describe('演出の長さ（仕様書 5：ログ1行を0.8秒、2倍速なら半分）', () => {
  it('1倍速ではログ1行を0.8秒出す', () => {
    expect(STEP_MS).toBe(800);
    expect(stepDuration(1)).toBe(800);
  });

  it('2倍速なら半分（0.4秒）', () => {
    expect(stepDuration(2)).toBe(400);
  });

  it('ログは直近の3行を残す', () => {
    expect(LOG_LINES).toBe(3);
  });
});

describe('バトル画面での演出', () => {
  let root: HTMLElement;
  /** ログのいちばん新しい行と、画面に残っている行 */
  const logText = () => root.querySelector('.battle__log-line--latest')?.textContent;
  const logLines = () => [...root.querySelectorAll('.battle__log-line')].map((line) => line.textContent);

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
    [...root.querySelectorAll<HTMLButtonElement>('.move-button')].find((button) => button.getAttribute('aria-disabled') !== 'true')!.click();

  it('技を選ぶと、ログが1行ずつ流れ、直近の3行が残る。1行0.8秒で進み、その間は技を選べない', () => {
    const session = playMove(firstBattleSession(), firstMoveId());
    const expected = describeEvents(session.lastEvents, session.previousState);

    tapFirstMove();
    expect(root.querySelector('.battle--playing')).not.toBeNull();
    expect(root.querySelector('.playback-skip')).not.toBeNull();
    expect([...root.querySelectorAll<HTMLButtonElement>('.move-button')].every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);

    const seen = [logText()];
    expect(logLines()).toEqual(expected.slice(0, 1));
    const step = stepDuration(1);
    for (let i = 1; i < expected.length; i += 1) {
      vi.advanceTimersByTime(step);
      seen.push(logText());
      expect(logLines()).toEqual(expected.slice(Math.max(0, i - 2), i + 1));
    }
    expect(seen).toEqual(expected);

    vi.advanceTimersByTime(step);
    expect(root.querySelector('.battle--playing')).toBeNull();
    // 演出が終わっても、最後の3行は残す
    expect(logLines()).toEqual(expected.slice(-3));
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
    vi.advanceTimersByTime(stepDuration(1) * count * 0.5 + 1);
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
