/** ランで使うデータ一式（エンジンにはこれを渡す） */
import { MONOCHROME_ATTRIBUTES } from '../engine/constants';
import type { RunContent } from '../engine/run';
import { BOSSES } from './bosses';
import { CHARMS } from './charms';
import { EVENTS } from './events';
import { FIGHTERS } from './fighters';
import { MOVES } from './moves';

/** 報酬で覚えられる技。白・黒の技はカラスウサギ専用なので入れない（仕様書 3.6） */
const LEARNABLE_MOVES = Object.values(MOVES).filter((move) => !MONOCHROME_ATTRIBUTES.includes(move.attribute));

export const RUN_CONTENT: RunContent = {
  fighters: FIGHTERS,
  moves: LEARNABLE_MOVES,
  charms: CHARMS,
  events: EVENTS,
  bosses: BOSSES,
};
