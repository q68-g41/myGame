import { RUN_CONTENT } from '../../src/data/content';
import { createRng } from '../../src/engine/rng';
import { areaEnemies, type RunContent, type RunState } from '../../src/engine/run';

/**
 * テスト用に組み立てたランに、マップの戦闘・強敵・ライバルのマスの相手を決めて持たせる
 * （本物のランでは、マップを作るときに決まる）。マップかエリアを変えたら、もう一度呼ぶ
 */
export function withEnemies<T extends Omit<RunState, 'enemies'>>(run: T, content: RunContent = RUN_CONTENT, seed = 1): T & Pick<RunState, 'enemies'> {
  return { ...run, enemies: areaEnemies(run.map, run.area, content, createRng(seed)).value };
}
