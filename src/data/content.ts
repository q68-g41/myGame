/** ランで使うデータ一式（エンジンにはこれを渡す） */
import type { RunContent } from '../engine/run';
import { FIGHTERS } from './fighters';

export const RUN_CONTENT: RunContent = { fighters: FIGHTERS };
