import { pickTeams } from '../../src/ai/teams';
import { FIGHTERS } from '../../src/data/fighters';
import { createBattle } from '../../src/engine/battle';
import { MAX_TEAM_SIZE } from '../../src/engine/constants';
import { createRng, nextSeed } from '../../src/engine/rng';
import { createSession, type BattleSession } from '../../src/ui/session';

/** テスト用：仮キャラ6体を3対3にランダムに分けて、バトルを始める（同じシードなら同じバトル） */
export function startSession(seed: number): BattleSession {
  const teams = pickTeams(FIGHTERS, MAX_TEAM_SIZE, createRng(seed));
  const battleSeed = nextSeed(teams.rng);
  return createSession(createBattle(teams.value.player, teams.value.enemy), battleSeed.value);
}
