/**
 * 画面の切り替え（トップ → チーム選択 → マップ ⇔ バトル → ランの結果）と、ターンの演出の再生。
 */
import { RUN_CONTENT } from '../data/content';
import { NODE_KIND_NAMES } from '../data/labels';
import { nodeAt } from '../engine/map';
import { MAX_MOVES } from '../engine/constants';
import {
  chooseTeam,
  createRunBattle,
  enterNode,
  finishBattle,
  startRun,
  takeReward,
  type RewardChoice,
  type RunState,
} from '../engine/run';
import { renderBattleScreen, type BattleScreenHandlers } from './battleScreen';
import { buildBattleView, INITIAL_UI_STATE, type UiState } from './battleView';
import { buildFrames, stepDuration, type PlaybackFrame } from './playback';
import { renderDraftScreen, renderMapScreen, renderRewardScreen, renderRunEndScreen } from './runScreens';
import {
  battleCaption,
  buildDraftView,
  buildMapView,
  buildRewardView,
  buildRunEndView,
  INITIAL_DRAFT_UI,
  INITIAL_REWARD_UI,
  rewardNotice,
  toggleDraftPick,
  type DraftUiState,
  type RewardUiState,
} from './runView';
import {
  createSession,
  needsPlayerReplacement,
  playMove,
  playReplacement,
  playSwitch,
  type BattleSession,
} from './session';
import { renderTopScreen } from './top';

export interface AppOptions {
  /** 画面に出すビルドの識別子 */
  readonly buildId: string;
  /** 新しいランのシードを作る（テストでは固定値にする） */
  readonly newSeed: () => number;
}

/** 技ボタンを長押しして、詳細を出すまでの時間 */
const LONG_PRESS_MS = 500;

interface Playback {
  readonly frames: readonly PlaybackFrame[];
  index: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** アプリを始める。最初はトップ画面 */
export function startApp(root: HTMLElement, options: AppOptions): void {
  let run: RunState | null = null;
  let draft: DraftUiState = INITIAL_DRAFT_UI;
  let reward: RewardUiState = INITIAL_REWARD_UI;
  /** マップ画面の案内の代わりに出す、直前に起きたこと */
  let notice: string | null = null;
  /** 戦闘中だけ持つ */
  let session: BattleSession | null = null;
  let ui: UiState = INITIAL_UI_STATE;
  let playback: Playback | null = null;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  /** 長押しで詳細を出したあと、指を離したときのタップでは技を使わない */
  let suppressNextMove = false;

  const render = () => {
    if (run === null) {
      return;
    }
    switch (run.phase.kind) {
      case 'draft':
        renderDraftScreen(root, buildDraftView(run, draft), draftHandlers);
        return;
      case 'map':
        renderMapScreen(root, buildMapView(run, notice), mapHandlers);
        return;
      case 'battle': {
        if (session === null) {
          return;
        }
        const frame = playback === null ? null : (playback.frames[playback.index] ?? null);
        renderBattleScreen(root, buildBattleView(session, ui, frame, battleCaption(run)), battleHandlers);
        return;
      }
      case 'reward':
        renderRewardScreen(root, buildRewardView(run, reward), rewardHandlers);
        return;
      case 'ended':
        renderRunEndScreen(root, buildRunEndView(run), runEndHandlers);
        return;
    }
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

  const startNewRun = () => {
    stopPlayback();
    run = startRun(RUN_CONTENT, options.newSeed());
    draft = INITIAL_DRAFT_UI;
    notice = null;
    session = null;
    render();
  };

  const showTop = () => {
    stopPlayback();
    run = null;
    session = null;
    renderTopScreen(root, { buildId: options.buildId, onStart: startNewRun });
  };

  const draftHandlers = {
    onPick: (index: number) => {
      draft = toggleDraftPick(draft, index);
      render();
    },
    onConfirm: () => {
      if (run === null) {
        return;
      }
      run = chooseTeam(run, draft.picks);
      notice = null;
      render();
    },
  };

  const mapHandlers = {
    onChoose: (index: number) => {
      if (run === null) {
        return;
      }
      run = enterNode(run, index, RUN_CONTENT);
      if (run.phase.kind === 'battle') {
        session = createSession(createRunBattle(run), run.phase.seed);
        ui = { ...INITIAL_UI_STATE, speed: ui.speed };
        notice = null;
      } else if (run.position !== null) {
        // 休憩・スカウト・イベントは、いまは通るだけ（中身は M4-4 で入れる）
        notice = `${NODE_KIND_NAMES[nodeAt(run.map, run.position).kind]}のマスを通った（中身は準備中）`;
      }
      render();
    },
  };

  const battleHandlers: BattleScreenHandlers = {
    onMove: (moveId) => {
      if (suppressNextMove) {
        suppressNextMove = false;
        return;
      }
      update((current) => playMove(current, moveId));
    },
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
    // 決着したら、結果をランに反映して報酬（またはランの結果）へ
    onContinue: () => {
      if (run === null || session === null || session.state.winner === null) {
        return;
      }
      stopPlayback();
      run = finishBattle(run, session.state, RUN_CONTENT);
      reward = INITIAL_REWARD_UI;
      notice = null;
      session = null;
      render();
    },
    onToggleSpeed: () => {
      ui = { ...ui, speed: ui.speed === 1 ? 2 : 1 };
      render();
    },
    onSkip: () => {
      stopPlayback();
      render();
    },
  };

  /** 報酬を受け取る。強敵ならもう1回選び、終わればマップへ */
  const receiveReward = (choice: RewardChoice) => {
    if (run === null) {
      return;
    }
    notice = rewardNotice(run, choice);
    run = takeReward(run, choice, RUN_CONTENT);
    reward = INITIAL_REWARD_UI;
    render();
  };

  const rewardHandlers = {
    onOffer: (index: number) => {
      reward = { ...reward, selected: index };
      render();
    },
    // 2タップ目：技なら覚えさせるキャラを選びに進み、それ以外はそのまま受け取る
    onConfirm: () => {
      if (run?.phase.kind !== 'reward' || reward.selected === null) {
        return;
      }
      if (run.phase.offers[reward.selected]?.kind === 'move') {
        reward = { ...reward, step: 'member' };
        render();
        return;
      }
      receiveReward({ offer: reward.selected });
    },
    // 技の枠が空いていればすぐ覚え、埋まっていれば忘れる技を選びに進む
    onMember: (index: number) => {
      if (run === null || reward.selected === null) {
        return;
      }
      if ((run.team[index]?.fighter.moves.length ?? 0) < MAX_MOVES) {
        receiveReward({ offer: reward.selected, member: index });
        return;
      }
      reward = { ...reward, step: 'forget', member: index };
      render();
    },
    onForget: (index: number) => {
      if (reward.selected === null || reward.member === null) {
        return;
      }
      receiveReward({ offer: reward.selected, member: reward.member, forget: index });
    },
    onBack: () => {
      reward = reward.step === 'forget' ? { ...reward, step: 'member', member: null } : { ...reward, step: 'offer' };
      render();
    },
  };

  const runEndHandlers = { onRetry: startNewRun, onTitle: showTop };

  // 技ボタンの長押し：押してから LONG_PRESS_MS で詳細を出し、指を離したら消す（画面を描き直しても続くよう root で受ける）
  root.addEventListener('pointerdown', (event) => {
    suppressNextMove = false;
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-move-id]');
    const moveId = button?.dataset.moveId;
    if (session === null || playback !== null || moveId === undefined) {
      return;
    }
    pressTimer = setTimeout(() => {
      pressTimer = null;
      ui = { ...ui, detailMoveId: moveId };
      suppressNextMove = true;
      render();
    }, LONG_PRESS_MS);
  });
  const endPress = () => {
    if (pressTimer !== null) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (ui.detailMoveId !== null) {
      ui = { ...ui, detailMoveId: null };
      render();
    }
  };
  root.addEventListener('pointerup', endPress);
  root.addEventListener('pointercancel', endPress);

  showTop();
}
