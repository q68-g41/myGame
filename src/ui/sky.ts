/**
 * いまの画面の空（背景）を決める（仕様書 5）。ランの途中はエリアの空、それ以外は DEFAULT_SKY。
 */
import { AREA_SKIES, DEFAULT_SKY, type SkyId } from '../data/sky';
import type { RunState } from '../engine/run';

export function skyOf(run: RunState | null): SkyId {
  if (run === null || run.phase.kind === 'draft' || run.phase.kind === 'ended') {
    return DEFAULT_SKY;
  }
  return AREA_SKIES[run.area] ?? DEFAULT_SKY;
}
