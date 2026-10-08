/**
 * 画面の切り替え（トップ → バトル → 結果）。
 */
import { renderBattleScreen, type BattleScreenHandlers } from './battleScreen';
import { buildBattleView } from './battleView';
import { needsPlayerReplacement, playMove, playReplacement, startSession, type BattleSession } from './session';
import { renderTopScreen } from './top';

export interface AppOptions {
  /** 画面に出すビルドの識別子 */
  readonly buildId: string;
  /** 新しいバトルのシードを作る（テストでは固定値にする） */
  readonly newSeed: () => number;
}

/** アプリを始める。最初はトップ画面 */
export function startApp(root: HTMLElement, options: AppOptions): void {
  let session: BattleSession | null = null;

  const render = () => {
    if (session !== null) {
      renderBattleScreen(root, buildBattleView(session), handlers);
    }
  };

  const update = (next: (current: BattleSession) => BattleSession) => {
    if (session !== null) {
      session = next(session);
      render();
    }
  };

  const startBattle = () => {
    session = startSession(options.newSeed());
    render();
  };

  const showTop = () => {
    session = null;
    renderTopScreen(root, { buildId: options.buildId, onStart: startBattle });
  };

  const handlers: BattleScreenHandlers = {
    onMove: (moveId) => update((current) => playMove(current, moveId)),
    onBench: (index) =>
      update((current) => (needsPlayerReplacement(current) ? playReplacement(current, index) : current)),
    onRetry: startBattle,
    onTitle: showTop,
  };

  showTop();
}
