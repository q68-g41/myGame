/** ランで使うデータ一式（エンジンにはこれを渡す） */
import { MONOCHROME_ATTRIBUTES } from '../engine/constants';
import type { RunContent } from '../engine/run';
import { BOSSES } from './bosses';
import { CHARMS } from './charms';
import { EVENTS } from './events';
import { FIGHTERS } from './fighters';
import { MOVES } from './moves';
import { RIVAL } from './rival';

/** 報酬で覚えられる技。白・黒の技はカラスウサギ専用なので入れない（仕様書 3.6） */
const LEARNABLE_MOVES = Object.values(MOVES).filter((move) => !MONOCHROME_ATTRIBUTES.includes(move.attribute));

export const RUN_CONTENT: RunContent = {
  // ふつうのキャラだけ。彩り手の相棒（カラスウサギも）は、その彩り手の専用なので入れない（仕様書 4.6）
  fighters: FIGHTERS,
  moves: LEARNABLE_MOVES,
  charms: CHARMS,
  events: EVENTS,
  bosses: BOSSES,
  // エリア2のボスの手前で戦う、ライバル・クロ（仕様書 4.6）
  rival: RIVAL,
};
