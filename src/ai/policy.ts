/**
 * CPU の段階ごとに、コマンドと控えから出すキャラを選ぶ（仕様書 6）。
 */
import type { BattleState, Command, CpuLevel, Side } from '../engine/types';
import { chooseCommandStage1, chooseReplacementStage1 } from './cpu';
import { chooseCommandStage2, chooseReplacementStage2 } from './stage2';

/** 段階に合わせてコマンドを選ぶ（段階3はまだないので、段階2で代える） */
export function chooseCommand(state: BattleState, side: Side, level: CpuLevel): Command {
  return level === 1 ? chooseCommandStage1(state, side) : chooseCommandStage2(state, side);
}

/** 段階に合わせて、倒れたあとに控えから出すキャラを選ぶ */
export function chooseReplacement(state: BattleState, side: Side, level: CpuLevel): number {
  return level === 1 ? chooseReplacementStage1(state, side) : chooseReplacementStage2(state, side);
}
