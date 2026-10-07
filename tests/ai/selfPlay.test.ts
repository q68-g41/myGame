import { describe, expect, it } from 'vitest';
import { MAX_SELF_PLAY_TURNS, playCpuBattle } from '../../src/ai/selfPlay';
import { pickTeams, TEAM_SIZE_FOR_SIM } from '../../src/ai/teams';
import { FIGHTERS } from '../../src/data/fighters';
import { createRng } from '../../src/engine/rng';

describe('チーム決め', () => {
  it('重ならないように、3体ずつ選ぶ', () => {
    const { value } = pickTeams(FIGHTERS, TEAM_SIZE_FOR_SIM, createRng(1));
    expect(value.player).toHaveLength(3);
    expect(value.enemy).toHaveLength(3);
    const ids = [...value.player, ...value.enemy].map((fighter) => fighter.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('同じシードなら同じチーム', () => {
    expect(pickTeams(FIGHTERS, 3, createRng(5))).toEqual(pickTeams(FIGHTERS, 3, createRng(5)));
  });

  it('候補が足りなければエラー', () => {
    expect(() => pickTeams(FIGHTERS.slice(0, 5), 3, createRng(1))).toThrow('候補が足りません');
  });
});

describe('CPU 同士の自動対戦（M2 の完了条件）', () => {
  it('どのシードでも、最後まで回って決着する', () => {
    let rng = createRng(2026);
    for (let i = 0; i < 200; i += 1) {
      const teams = pickTeams(FIGHTERS, TEAM_SIZE_FOR_SIM, rng);
      rng = teams.rng;
      const result = playCpuBattle(teams.value.player, teams.value.enemy, createRng(i));
      expect(result.winner).not.toBeNull();
      expect(result.turns).toBeLessThan(MAX_SELF_PLAY_TURNS);
      const loser = result.winner === 'player' ? 'enemy' : 'player';
      expect(result.state.sides[loser].team.every((member) => member.hp === 0)).toBe(true);
    }
  });

  it('同じシードなら、同じ結果になる', () => {
    const { value } = pickTeams(FIGHTERS, 3, createRng(1));
    expect(playCpuBattle(value.player, value.enemy, createRng(9))).toEqual(
      playCpuBattle(value.player, value.enemy, createRng(9)),
    );
  });
});
