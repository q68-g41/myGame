import { RUN_CONTENT } from '../../src/data/content';
import { chooseTeam, createRunBattle, enterNode, runChoices, startRun, type RunState } from '../../src/engine/run';
import { startApp } from '../../src/ui/app';
import { createSession, type BattleSession } from '../../src/ui/session';

/** アプリで、ランの最初のバトルまで進める（候補の先頭3体を選び、最初のマスに入る） */
export function startAppBattle(root: HTMLElement, seed = 1): void {
  startApp(root, { buildId: 'test', newSeed: () => seed });
  root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
  for (const index of [0, 1, 2]) {
    root.querySelectorAll<HTMLButtonElement>('.candidate')[index]!.click();
  }
  root.querySelector<HTMLButtonElement>('.draft__controls .button--primary')!.click();
  root.querySelector<HTMLButtonElement>('.map-choice')!.click();
}

/** startAppBattle と同じ手順で進めた、ランの状態 */
function firstBattleRun(seed = 1): RunState {
  const run = chooseTeam(startRun(RUN_CONTENT, seed), [0, 1, 2]);
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
