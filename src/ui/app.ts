/**
 * 画面の切り替え（トップ → 彩り手を選ぶ → チーム選択 → マップ ⇔ 各マス（バトル・報酬・休憩・スカウト・イベント）→ ランの結果）と、
 * ターンの演出の再生。
 */
import { RUN_CONTENT } from '../data/content';
import { IRODORITE } from '../data/irodorite';
import { MAX_MOVES } from '../engine/constants';
import { chooseEventOption, leaveEvent, restHeal, restPowerUp, scoutRecruit, scoutSkip } from '../engine/nodes';
import {
  chooseTeam,
  createRunBattle,
  draftPickCount,
  enterNode,
  finishBattle,
  startRun,
  swapTeamOrder,
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
import { renderIrodoriteScreen } from './irodoriteScreen';
import {
  buildIrodoriteSelectView,
  INITIAL_IRODORITE_UI,
  selectIrodorite,
  type IrodoriteUiState,
} from './irodoriteView';
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
  focusDraftCandidate,
  INITIAL_MAP_UI,
  tapMapMember,
  type MapUiState,
  toggleDraftPick,
  type DraftUiState,
  type RewardUiState,
} from './runView';
import { createSaveStore, createSettingsStore, type SavedGame } from './save';
import {
  createSession,
  needsPlayerReplacement,
  playMove,
  playReplacement,
  playSwitch,
  restoreSession,
  type BattleSession,
} from './session';
import type { SoundId } from '../data/sounds';
import { chooseMusic, type MusicScene } from './music';
import { SILENT_PLAYER, type SoundPlayer } from './sound';
import { renderTopScreen } from './top';

export interface AppOptions {
  /** 画面に出すビルドの識別子 */
  readonly buildId: string;
  /** 新しいランのシードを作る（テストでは固定値にする） */
  readonly newSeed: () => number;
  /** 自動保存の保存先（ブラウザでは localStorage）。省くと保存しない */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  /** 効果音と BGM を鳴らす仕組み（ブラウザでは Web Audio）。省くと鳴らさない */
  readonly sound?: SoundPlayer;
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
  const settings = createSettingsStore(options.storage ?? null);
  let run: RunState | null = null;
  /** 彩り手を選んでいるあいだだけ持つ（ランはまだ始まっていない） */
  let choosing: IrodoriteUiState | null = null;
  let draft: DraftUiState = INITIAL_DRAFT_UI;
  let mapUi: MapUiState = INITIAL_MAP_UI;
  let reward: RewardUiState = INITIAL_REWARD_UI;
  let rest: RestUiState = INITIAL_REST_UI;
  let scout: ScoutUiState = INITIAL_SCOUT_UI;
  let event: EventUiState = INITIAL_EVENT_UI;
  /** マップ画面の案内の代わりに出す、直前に起きたこと */
  let notice: string | null = null;
  /** 戦闘中だけ持つ */
  let session: BattleSession | null = null;
  /** 演出の速さと音のオン/オフは、前に開いたときの設定から始める */
  const loadedSettings = settings.load();
  let ui: UiState = { ...INITIAL_UI_STATE, speed: loadedSettings.speed, sound: loadedSettings.sound };
  const player = options.sound ?? SILENT_PLAYER;
  /** 効果音を鳴らす（音がオフなら鳴らさない） */
  const playSound = (id: SoundId | null) => {
    if (id !== null && ui.sound) {
      player.play(id);
    }
  };
  const saveSettings = () => settings.save({ speed: ui.speed, sound: ui.sound });
  /** 音（効果音と BGM）のオン ⇔ オフを切り替えて保存する。オンにしたときは、確かめのために鳴らす */
  const toggleSound = () => {
    ui = { ...ui, sound: !ui.sound };
    saveSettings();
    playSound('tap');
    syncMusic();
    return ui.sound;
  };
  let playback: Playback | null = null;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  /** 長押しで詳細を出したあと、指を離したときのタップでは技を使わない */
  let suppressNextMove = false;
  // 候補を長押ししたあとの click では、選ぶ・外すをしない
  let suppressNextPick = false;

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

  /** いまの画面（BGM を選ぶため）。バトルの勝ち負けは、決着の演出まで進んでから出す */
  const musicScene = (): MusicScene => {
    if (run === null) {
      return { screen: 'top' };
    }
    const { phase } = run;
    if (phase.kind !== 'battle') {
      return { screen: phase.kind };
    }
    const shown =
      session !== null &&
      (playback === null || session.lastEvents.slice(0, playback.index + 1).some((e) => e.type === 'battleEnd'));
    return { screen: 'battle', boss: phase.boss !== null, winner: shown ? (session?.state.winner ?? null) : null };
  };
  /** 画面に合う BGM にする（音がオフなら止める） */
  function syncMusic(): void {
    player.music(ui.sound ? chooseMusic(musicScene()) : null);
  }

  const render = () => {
    draw();
    syncMusic();
  };

  const draw = () => {
    if (run === null) {
      if (choosing !== null) {
        renderIrodoriteScreen(root, buildIrodoriteSelectView(IRODORITE, choosing), irodoriteHandlers);
      }
      return;
    }
    persist();
    switch (run.phase.kind) {
      case 'draft':
        renderDraftScreen(root, buildDraftView(run, draft), draftHandlers);
        return;
      case 'map':
        renderMapScreen(root, buildMapView(run, notice, mapUi), mapHandlers);
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
      playSound(current.frames[current.index]?.sound ?? null);
      scheduleNextFrame();
    }, stepDuration(ui.speed));
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
    playSound(frames[0]?.sound ?? null);
  };

  /** 画面だけが持つ状態を、最初に戻す（演出の速さは残す） */
  const resetScreens = () => {
    choosing = null;
    draft = INITIAL_DRAFT_UI;
    reward = INITIAL_REWARD_UI;
    rest = INITIAL_REST_UI;
    scout = INITIAL_SCOUT_UI;
    event = INITIAL_EVENT_UI;
    ui = { ...INITIAL_UI_STATE, speed: ui.speed, sound: ui.sound };
    notice = null;
  };

  /** 「はじめから」：まず彩り手を選ぶ（4.6）。ランは「この彩り手で進む」で始める */
  const startNewRun = () => {
    stopPlayback();
    run = null;
    session = null;
    resetScreens();
    choosing = INITIAL_IRODORITE_UI;
    render();
  };

  const irodoriteHandlers = {
    onSelect: (index: number) => {
      if (choosing === null) {
        return;
      }
      choosing = selectIrodorite(choosing, index);
      render();
    },
    onConfirm: () => {
      const chosen = choosing === null ? undefined : IRODORITE[choosing.selected];
      if (chosen === undefined) {
        return;
      }
      run = startRun(RUN_CONTENT, options.newSeed(), chosen);
      choosing = null;
      render();
    },
  };

  /** 保存したランの続きから遊ぶ。読めないセーブだったら捨てて、トップに戻る */
  const resume = (saved: SavedGame) => {
    stopPlayback();
    resetScreens();
    try {
      run = saved.run;
      const { phase } = saved.run;
      session =
        saved.battle === null || phase.kind !== 'battle' ? null : restoreSession(saved.battle, phase.cpu, phase.boss);
      render();
    } catch {
      store.clear();
      showTop();
    }
  };

  const showTop = () => {
    stopPlayback();
    run = null;
    choosing = null;
    session = null;
    const saved = store.load();
    renderTopScreen(root, {
      buildId: options.buildId,
      sound: ui.sound,
      onToggleSound: toggleSound,
      onStart: startNewRun,
      ...(saved === null ? {} : { onContinue: () => resume(saved) }),
    });
    syncMusic();
  };

  const draftHandlers = {
    onPick: (index: number) => {
      if (suppressNextPick) {
        suppressNextPick = false;
        return;
      }
      draft = toggleDraftPick(draft, index, run === null ? undefined : draftPickCount(run));
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
      mapUi = INITIAL_MAP_UI;
      rest = INITIAL_REST_UI;
      scout = INITIAL_SCOUT_UI;
      event = INITIAL_EVENT_UI;
      if (run.phase.kind === 'battle') {
        session = createSession(createRunBattle(run), run.phase.seed, run.phase.cpu, run.phase.boss);
        ui = { ...INITIAL_UI_STATE, speed: ui.speed, sound: ui.sound };
      }
      render();
    },
    onMember: (index: number) => {
      if (run === null) {
        return;
      }
      const tapped = tapMapMember(mapUi, index);
      mapUi = tapped.ui;
      if (tapped.swap !== null) {
        run = swapTeamOrder(run, ...tapped.swap);
        notice = null;
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
      saveSettings();
      render();
    },
    onToggleSound: () => {
      toggleSound();
      render();
    },
    // 早送りしたときも、決着していれば勝ち負けの曲が鳴る（render のあとの BGM 合わせで）
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
  // チーム選択の候補の長押し：選ばずに、そのキャラの詳細を出す（指を離しても出したまま）
  root.addEventListener('pointerdown', (event) => {
    suppressNextMove = false;
    suppressNextPick = false;
    const candidate = (event.target as Element | null)?.closest<HTMLElement>('[data-candidate-index]');
    if (candidate?.dataset.candidateIndex !== undefined && run?.phase.kind === 'draft') {
      const index = Number(candidate.dataset.candidateIndex);
      pressTimer = setTimeout(() => {
        pressTimer = null;
        draft = focusDraftCandidate(draft, index);
        suppressNextPick = true;
        render();
      }, LONG_PRESS_MS);
      return;
    }
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

  // 効果音（M7-2）：ブラウザは最初のタップまで音を鳴らせないので、タップのたびに鳴らせるようにする（2回目からは何もしない）
  root.addEventListener('pointerdown', () => player.unlock());
  // ボタンを押したら短い音。マスを選んだとき・報酬を決めたときは、それぞれの音。技の音は演出で、音のオン/オフは切り替えのときに鳴らす
  root.addEventListener('click', (event) => {
    player.unlock();
    const target = (event.target as Element | null)?.closest?.('button');
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') {
      return;
    }
    if (target.dataset.moveId !== undefined || target.classList.contains('sound-toggle')) {
      return;
    }
    if (target.classList.contains('map-choice')) {
      playSound('select');
    } else if (target.classList.contains('button--primary') && target.closest('.reward__controls') !== null) {
      playSound('reward');
    } else {
      playSound('tap');
    }
  });

  showTop();
}
