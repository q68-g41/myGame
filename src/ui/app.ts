/**
 * 画面の切り替え（トップ → バトル → 結果）と、ターンの演出の再生。
 */
import { renderBattleScreen, type BattleScreenHandlers } from './battleScreen';
import { buildBattleView, INITIAL_UI_STATE, type UiState } from './battleView';
import { buildFrames, stepDuration, type PlaybackFrame } from './playback';
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

interface Playback {
  readonly frames: readonly PlaybackFrame[];
  index: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** アプリを始める。最初はトップ画面 */
export function startApp(root: HTMLElement, options: AppOptions): void {
  let session: BattleSession | null = null;
  let ui: UiState = INITIAL_UI_STATE;
  let playback: Playback | null = null;

  const render = () => {
    if (session === null) {
      return;
    }
    const frame = playback === null ? null : (playback.frames[playback.index] ?? null);
    renderBattleScreen(root, buildBattleView(session, ui, frame), handlers);
  };

  const stopPlayback = () => {
    if (playback?.timer) {
      clearTimeout(playback.timer);
    }
    playback = null;
  };

  /** 次のコマへ進める。最後のコマのあとは、演出を終えて最終的な状態を見せる */
  const scheduleNextFrame = () => {
    const current = playback;
    if (current === null) {
      return;
    }
    current.timer = setTimeout(() => {
      current.index += 1;
      if (current.index >= current.frames.length) {
        playback = null;
      }
      render();
      scheduleNextFrame();
    }, stepDuration(current.frames.length, ui.speed));
  };

  /** セッションを進め、起きたことを演出として再生する。控えの選択は解除する */
  const update = (next: (current: BattleSession) => BattleSession) => {
    if (session === null || playback !== null) {
      return;
    }
    session = next(session);
    ui = { ...ui, selectedBench: null };
    const frames = buildFrames(session.previousState, session.lastEvents, session.state);
    if (frames.length > 0) {
      playback = { frames, index: 0, timer: null };
      scheduleNextFrame();
    }
    render();
  };

  const startBattle = () => {
    stopPlayback();
    session = startSession(options.newSeed());
    ui = { ...INITIAL_UI_STATE, speed: ui.speed };
    render();
  };

  const showTop = () => {
    stopPlayback();
    session = null;
    renderTopScreen(root, { buildId: options.buildId, onStart: startBattle });
  };

  const handlers: BattleScreenHandlers = {
    onMove: (moveId) => update((current) => playMove(current, moveId)),
    // 1タップ目：控えを選ぶ（もう一度押すと選択をやめる）
    onBench: (index) => {
      ui = { ...ui, selectedBench: ui.selectedBench === index ? null : index };
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
      ui = { ...ui, selectedBench: null };
      render();
    },
    onRetry: startBattle,
    onTitle: showTop,
    onToggleSpeed: () => {
      ui = { ...ui, speed: ui.speed === 1 ? 2 : 1 };
      render();
    },
    onSkip: () => {
      stopPlayback();
      render();
    },
  };

  showTop();
}
