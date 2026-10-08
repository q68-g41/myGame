/** ランで使うデータ一式（エンジンにはこれを渡す） */
import type { RunContent } from '../engine/run';
import { CHARMS } from './charms';
import { EVENTS } from './events';
import { FIGHTERS } from './fighters';
import { MOVES } from './moves';

export const RUN_CONTENT: RunContent = {
  fighters: FIGHTERS,
  moves: Object.values(MOVES),
  charms: CHARMS,
  events: EVENTS,
};
