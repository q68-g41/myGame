// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp } from '../../src/ui/app';

// 休憩は6層目にあるので、ランを「5層目のマスにいて、チームも選んだ状態」から始める
vi.mock('../../src/engine/run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/engine/run')>();
  return {
    ...actual,
    startRun: (...args: Parameters<typeof actual.startRun>) => {
      const started = actual.startRun(...args);
      const run = actual.chooseTeam(started, [0, 1, 2].slice(0, actual.draftPickCount(started)));
      return { ...run, team: run.team.map((member) => ({ ...member, hp: 10 })), position: { layer: 4, index: 0 } };
    },
  };
});

const INTERACTIVE = 'button, a, input, select, textarea';

describe('休憩のマス（アプリの流れ）', () => {
  let root: HTMLElement;
  const primary = () => root.querySelector<HTMLButtonElement>('.screen__controls .button--primary')!;
  const hps = () => [...root.querySelectorAll('.member__hp')].map((hp) => hp.textContent);

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    startApp(root, { buildId: 'test', newSeed: () => 1 });
    root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
    root.querySelector<HTMLButtonElement>('.irodorite__controls .button--primary')!.click();
    expect(root.querySelector('.map-choice__name')?.textContent).toBe('休憩');
    root.querySelector<HTMLButtonElement>('.map-choice')!.click();
  });

  it('休憩の画面になる。操作は下半分だけ', () => {
    expect(root.querySelector('.rest')).not.toBeNull();
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
    expect(hps().every((hp) => hp?.startsWith('HP 10 /'))).toBe(true);
  });

  it('ゆっくり休む → 決定：全員のHPが回復して、マップ（ボスの手前）に戻る', () => {
    root.querySelectorAll<HTMLButtonElement>('.node-option')[0]!.click();
    primary().click();
    expect(root.querySelector('.map__message')?.textContent).toBe('全員のHPが回復した');
    expect(root.querySelector('.map-choice__name')?.textContent).toBe('ボス');
    expect(hps().every((hp) => !hp?.startsWith('HP 10 /'))).toBe(true);
  });

  it('技をみがく → キャラ → 技：威力が上がって、マップに戻る。「戻る」で1つ前に戻れる', () => {
    root.querySelectorAll<HTMLButtonElement>('.node-option')[1]!.click();
    primary().click();
    root.querySelector<HTMLButtonElement>('.node-members .node-pick')!.click();
    expect(root.querySelectorAll('.node-moves .node-pick')).toHaveLength(4);
    root.querySelector<HTMLButtonElement>('.screen__controls .button--secondary')!.click();
    expect(root.querySelector('.node-members')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.screen__controls .button--secondary')!.click();
    expect(root.querySelectorAll('.node-option')).toHaveLength(2);

    primary().click();
    root.querySelector<HTMLButtonElement>('.node-members .node-pick')!.click();
    const move = root.querySelector<HTMLButtonElement>('.node-moves .node-pick:not([disabled])')!;
    const name = move.querySelector('.node-pick__name')?.textContent;
    move.click();
    expect(root.querySelector('.map__message')?.textContent).toMatch(new RegExp(`の ${name}の威力が \\d+ になった$`));
  });
});
