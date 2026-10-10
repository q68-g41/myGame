import { RUN_CONTENT } from '../../src/data/content';
import { IRODORITE } from '../../src/data/irodorite';
import { chooseTeam, createRunBattle, enterNode, runChoices, startRun, type RunState } from '../../src/engine/run';
import { startApp } from '../../src/ui/app';
import { createSession, type BattleSession } from '../../src/ui/session';

/** アプリで、チーム選択まで進める（トップの「はじめる」→ 一覧の1人目の彩り手で進む） */
export function startAppDraft(root: HTMLElement, seed = 1): void {
  startApp(root, { buildId: 'test', newSeed: () => seed });
  root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
  root.querySelector<HTMLButtonElement>('.irodorite__controls .button--primary')!.click();
}

/** アプリで、ランの最初のバトルまで進める（1人目の彩り手で、相棒のあとに候補の先頭2体を選び、最初のマスに入る） */
export function startAppBattle(root: HTMLElement, seed = 1): void {
  startAppDraft(root, seed);
  for (const index of [0, 1]) {
    root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
  }
  root.querySelector<HTMLButtonElement>('.draft__controls .button--primary')!.click();
  root.querySelector<HTMLButtonElement>('.map-choice')!.click();
}

/** startAppBattle と同じ手順で進めた、ランの状態 */
function firstBattleRun(seed = 1): RunState {
  const run = chooseTeam(startRun(RUN_CONTENT, seed, IRODORITE[0]!), [0, 1]);
  return enterNode(run, runChoices(run)[0]!, RUN_CONTENT);
}

/** startAppBattle と同じバトルのセッション（画面に出る内容をテストで予想するのに使う） */
export function firstBattleSession(seed = 1): BattleSession {
  const run = firstBattleRun(seed);
  if (run.phase.kind !== 'battle') {
    throw new Error('1層目は戦闘のはず');
  }
  return createSession(createRunBattle(run), run.phase.seed);
}
