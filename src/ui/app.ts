/**
 * 画面の切り替え（トップ → チーム選択 → マップ ⇔ 各マス（バトル・報酬・休憩・スカウト・イベント）→ ランの結果）と、
 * ターンの演出の再生。
 */
import { RUN_CONTENT } from '../data/content';
import { MAX_MOVES } from '../engine/constants';
import { chooseEventOption, leaveEvent, restHeal, restPowerUp, scoutRecruit, scoutSkip } from '../engine/nodes';
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
import { renderEventScreen, renderRestScreen, renderScoutScreen } from './nodeScreens';
import {
  buildEventView,
  buildRestView,
  buildScoutView,
  INITIAL_EVENT_UI,
  INITIAL_REST_UI,
  INITIAL_SCOUT_UI,
  restNotice,
  scoutNotice,
  type EventUiState,
  type RestUiState,
  type ScoutUiState,
} from './nodeView';
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
import { createSaveStore, type SavedGame } from './save';
import {
  createSession,
  needsPlayerReplacement,
  playMove,
  playReplacement,
  playSwitch,
  restoreSession,
  type BattleSession,
} from './session';
import { renderTopScreen } from './top';

export interface AppOptions {
  /** 画面に出すビルドの識別子 */
  readonly buildId: string;
  /** 新しいランのシードを作る（テストでは固定値にする） */
  readonly newSeed: () => number;
  /** 自動保存の保存先（ブラウザでは localStorage）。省くと保存しない */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
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
  const store = createSaveStore(options.storage ?? null);
  let run: RunState | null = null;
  let draft: DraftUiState = INITIAL_DRAFT_UI;
  let reward: RewardUiState = INITIAL_REWARD_UI;
  let rest: RestUiState = INITIAL_REST_UI;
  let scout: ScoutUiState = INITIAL_SCOUT_UI;
  let event: EventUiState = INITIAL_EVENT_UI;
  /** マップ画面の案内の代わりに出す、直前に起きたこと */
  let notice: string | null = null;
  /** 戦闘中だけ持つ */
  let session: BattleSession | null = null;
  let ui: UiState = INITIAL_UI_STATE;
  let playback: Playback | null = null;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  /** 長押しで詳細を出したあと、指を離したときのタップでは技を使わない */
  let suppressNextMove = false;

  /** 自動保存：画面を描くたびに、いまのランを保存する。ランが終わったら消す */
  const persist = () => {
    if (run === null) {
      return;
    }
    if (run.phase.kind === 'ended') {
      store.clear();
    } else if (run.phase.kind !== 'battle' || session !== null) {
      store.save(run, run.phase.kind === 'battle' ? session : null);
    }
  };

  const render = () => {
    if (run === null) {
      return;
    }
    persist();
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
      case 'rest':
        renderRestScreen(root, buildRestView(run, rest), restHandlers);
        return;
      case 'scout':
        renderScoutScreen(root, buildScoutView(run, scout), scoutHandlers);
        return;
      case 'event':
        renderEventScreen(root, buildEventView(run, event), eventHandlers);
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

  /** 画面だけが持つ状態を、最初に戻す（演出の速さは残す） */
  const resetScreens = () => {
    draft = INITIAL_DRAFT_UI;
    reward = INITIAL_REWARD_UI;
    rest = INITIAL_REST_UI;
    scout = INITIAL_SCOUT_UI;
    event = INITIAL_EVENT_UI;
    ui = { ...INITIAL_UI_STATE, speed: ui.speed };
    notice = null;
  };

  const startNewRun = () => {
    stopPlayback();
    run = startRun(RUN_CONTENT, options.newSeed());
    session = null;
    resetScreens();
    render();
  };

  /** 保存したランの続きから遊ぶ。読めないセーブだったら捨てて、トップに戻る */
  const resume = (saved: SavedGame) => {
    stopPlayback();
    resetScreens();
    try {
      run = saved.run;
      session = saved.battle === null ? null : restoreSession(saved.battle);
      render();
    } catch {
      store.clear();
      showTop();
    }
  };

  const showTop = () => {
    stopPlayback();
    run = null;
    session = null;
    const saved = store.load();
    renderTopScreen(root, {
      buildId: options.buildId,
      onStart: startNewRun,
      ...(saved === null ? {} : { onContinue: () => resume(saved) }),
    });
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
      notice = null;
      rest = INITIAL_REST_UI;
      scout = INITIAL_SCOUT_UI;
      event = INITIAL_EVENT_UI;
      if (run.phase.kind === 'battle') {
        session = createSession(createRunBattle(run), run.phase.seed);
        ui = { ...INITIAL_UI_STATE, speed: ui.speed };
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
    const area = run.area;
    notice = rewardNotice(run, choice);
    run = takeReward(run, choice, RUN_CONTENT);
    if (run.area !== area) {
      notice = `エリア${run.area + 1}に進んだ！（${notice}）`;
    }
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

  const restHandlers = {
    onSelect: (option: 'heal' | 'power') => {
      rest = { ...rest, selected: option };
      render();
    },
    // 2タップ目：回復ならそのまま、技の強化ならキャラを選びに進む
    onConfirm: () => {
      if (run === null || rest.selected === null) {
        return;
      }
      if (rest.selected === 'heal') {
        notice = restNotice(run, 'heal');
        run = restHeal(run);
      } else {
        rest = { ...rest, step: 'member' };
      }
      render();
    },
    onMember: (index: number) => {
      rest = { ...rest, step: 'move', member: index };
      render();
    },
    onMove: (index: number) => {
      if (run === null || rest.member === null) {
        return;
      }
      notice = restNotice(run, { member: rest.member, move: index });
      run = restPowerUp(run, rest.member, index);
      render();
    },
    onBack: () => {
      rest = rest.step === 'move' ? { ...rest, step: 'member', member: null } : { ...rest, step: 'choose' };
      render();
    },
  };

  const scoutHandlers = {
    onCandidate: (index: number) => {
      scout = { ...scout, selected: index };
      render();
    },
    onConfirm: () => {
      if (scout.selected !== null) {
        scout = { ...scout, step: 'member' };
        render();
      }
    },
    onMember: (index: number) => {
      if (run === null || scout.selected === null) {
        return;
      }
      notice = scoutNotice(run, { candidate: scout.selected, member: index });
      run = scoutRecruit(run, scout.selected, index);
      render();
    },
    onSkip: () => {
      if (run === null) {
        return;
      }
      notice = scoutNotice(run, 'skip');
      run = scoutSkip(run);
      render();
    },
    onBack: () => {
      scout = { ...scout, step: 'candidate' };
      render();
    },
  };

  const eventHandlers = {
    onSelect: (index: number) => {
      event = { selected: index };
      render();
    },
    onConfirm: () => {
      if (run === null || event.selected === null) {
        return;
      }
      run = chooseEventOption(run, event.selected);
      render();
    },
    onLeave: () => {
      if (run === null) {
        return;
      }
      run = leaveEvent(run);
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
