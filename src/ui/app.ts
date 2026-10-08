/**
 * 画面の切り替え（トップ → バトル → 結果）。
 */
import { renderBattleScreen, type BattleScreenHandlers } from './battleScreen';
import { buildBattleView, INITIAL_UI_STATE, type UiState } from './battleView';
import {
  needsPlayerReplacement,
  playMove,
  playReplacement,
  playSwitch,
  startSession,
  type BattleSession,
} from './session';
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
  let ui: UiState = INITIAL_UI_STATE;

  const render = () => {
    if (session !== null) {
      renderBattleScreen(root, buildBattleView(session, ui), handlers);
    }
  };

  /** セッションを進める。控えの選択は解除する */
  const update = (next: (current: BattleSession) => BattleSession) => {
    if (session !== null) {
      session = next(session);
      ui = INITIAL_UI_STATE;
      render();
    }
  };

  const startBattle = () => {
    session = startSession(options.newSeed());
    ui = INITIAL_UI_STATE;
    render();
  };

  const showTop = () => {
    session = null;
    renderTopScreen(root, { buildId: options.buildId, onStart: startBattle });
  };

  const handlers: BattleScreenHandlers = {
    onMove: (moveId) => update((current) => playMove(current, moveId)),
    // 1タップ目：控えを選ぶ（もう一度押すと選択をやめる）
    onBench: (index) => {
      ui = { selectedBench: ui.selectedBench === index ? null : index };
      render();
    },
    // 2タップ目：確定。倒れたあとなら控えから出し、そうでなければ交代のコマンドでターンを進める
    onConfirm: () => {
      const index = ui.selectedBench;
      if (index !== null) {
        update((current) =>
          needsPlayerReplacement(current) ? playReplacement(current, index) : playSwitch(current, index),
        );
      }
    },
    onCancel: () => {
      ui = INITIAL_UI_STATE;
      render();
    },
    onRetry: startBattle,
    onTitle: showTop,
  };

  showTop();
}
