import './ui/style.css';
import { renderTopScreen } from './ui/top';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('#app が見つかりません');
}

renderTopScreen(root, { buildId: __BUILD_ID__ });
