import './ui/style.css';
import { startApp } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('#app が見つかりません');
}

startApp(root, {
  buildId: __BUILD_ID__,
  // バトルごとのシード。エンジンには、この値から作ったシード付き乱数だけを渡す
  newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
});
