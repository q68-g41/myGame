import './ui/style.css';
import { startApp } from './ui/app';
import { createSoundPlayer } from './ui/sound';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('#app が見つかりません');
}

/** 自動保存の保存先。使えない環境（設定で止めているなど）では保存しない */
function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

startApp(root, {
  buildId: __BUILD_ID__,
  storage: localStorageOrNull(),
  // 効果音（Web Audio）。使えないブラウザでは鳴らさない
  sound: createSoundPlayer(),
  // バトルごとのシード。エンジンには、この値から作ったシード付き乱数だけを渡す
  newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
});
