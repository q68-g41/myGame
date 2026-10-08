/**
 * CPU の段階ごとに、コマンドと控えから出すキャラを選ぶ（仕様書 6）。
 */
import type { BattleState, Command, CpuLevel, Side } from '../engine/types';
import { chooseCommandStage1, chooseReplacementStage1 } from './cpu';
import { chooseCommandStage2, chooseReplacementStage2 } from './stage2';
import { chooseCommandStage3 } from './stage3';

/** 段階に合わせてコマンドを選ぶ */
export function chooseCommand(state: BattleState, side: Side, level: CpuLevel): Command {
  switch (level) {
    case 1:
      return chooseCommandStage1(state, side);
    case 2:
      return chooseCommandStage2(state, side);
    case 3:
      return chooseCommandStage3(state, side);
  }
}

/** 段階に合わせて、倒れたあとに控えから出すキャラを選ぶ（段階3は段階2と同じ考え方） */
export function chooseReplacement(state: BattleState, side: Side, level: CpuLevel): number {
  return level === 1 ? chooseReplacementStage1(state, side) : chooseReplacementStage2(state, side);
}
