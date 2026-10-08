import { describe, expect, it } from 'vitest';
import { chooseCommandStage1 } from '../../src/ai/cpu';
import { chooseCommand } from '../../src/ai/policy';
import { MAX_SELF_PLAY_TURNS, playCpuBattle } from '../../src/ai/selfPlay';
import { chooseCommandStage3, commandOptions, evaluateState } from '../../src/ai/stage3';
import { pickTeams, TEAM_SIZE_FOR_SIM } from '../../src/ai/teams';
import { RUN_CONTENT } from '../../src/data/content';
import { FIGHTERS } from '../../src/data/fighters';
import { CPU_LEVEL_BY_AREA, ELITE_CPU_LEVEL } from '../../src/engine/constants';
import type { AreaMap } from '../../src/engine/map';
import { createRng } from '../../src/engine/rng';
import { chooseTeam, enterNode, startRun } from '../../src/engine/run';
import type { BattleState, Combatant, CpuLevel } from '../../src/engine/types';
import { makeCombatant, makeMove, makeSupportMove } from '../helpers/fixtures';

// 紅のキャラに翠の技は等倍
const HIT = makeMove({ id: 'hit', attribute: 'green', power: 60 });
const QUICK = makeMove({ id: 'quick', attribute: 'green', kind: 'priority', power: 35 });

function battle(player: Combatant[], enemy: Combatant[]): BattleState {
  return {
    turn: 1,
    sides: { player: { team: player, active: 0 }, enemy: { team: enemy, active: 0 } },
    awaitingReplacement: [],
    winner: null,
  };
}

describe('段階3：選べるコマンドの一覧', () => {
  it('技と交代を並べる（技が先）', () => {
    const state = battle([makeCombatant({ moves: [HIT, QUICK] }), makeCombatant({ id: 'b' })], [makeCombatant()]);
    expect(commandOptions(state, 'player')).toEqual([
      { type: 'move', moveId: 'hit' },
      { type: 'move', moveId: 'quick' },
      { type: 'switch', to: 1 },
    ]);
  });

  it('使っても何も起きない補助技（満タンでの回復・上限の能力変化・状態異常の相手への状態異常）は外す', () => {
    const heal = makeSupportMove({ id: 'heal', effects: [{ type: 'heal', percent: 30 }] });
    const focus = makeSupportMove({ id: 'focus', effects: [{ type: 'stat', target: 'self', stat: 'attack', stages: 2 }] });
    const corrode = makeSupportMove({ id: 'corrode', effects: [{ type: 'status', status: 'erosion' }] });
    const self = makeCombatant({ moves: [HIT, heal, focus, corrode], stages: { attack: 3, defense: 0, speed: 0 } });
    const opponent = makeCombatant({ status: { id: 'slow', remaining: 1 } });
    expect(commandOptions(battle([self], [opponent]), 'player')).toEqual([{ type: 'move', moveId: 'hit' }]);

    const hurt = { ...self, hp: 50, stages: { attack: 0, defense: 0, speed: 0 } };
    expect(commandOptions(battle([hurt], [makeCombatant()]), 'player').map((c) => c.type === 'move' && c.moveId)).toEqual([
      'hit',
      'heal',
      'focus',
      'corrode',
    ]);
  });
});

describe('段階3：状態の点数', () => {
  it('決着していれば大きな点数、そうでなければHPの差（倒れたキャラは減点）と次の撃ち合いの見込み', () => {
    const state = battle([makeCombatant()], [makeCombatant()]);
    expect(evaluateState({ ...state, winner: 'enemy' }, 'enemy')).toBe(100);
    expect(evaluateState({ ...state, winner: 'player' }, 'enemy')).toBe(-100);
    // 同じキャラどうしなら、HPの差は0。素早さも同じなので、撃ち合いは後から動く側の負けと見積もる
    const even = evaluateState(state, 'enemy');
    expect(even).toBeLessThan(0);
    const hurt = battle([makeCombatant({ hp: 50 })], [makeCombatant()]);
    expect(evaluateState(hurt, 'enemy')).toBeGreaterThan(even);
  });
});

describe('段階3：コマンド（仕様書 6：プレイヤーの交代や先制技を予想する）', () => {
  it('相手の先制技で先に倒されそうなら、自分も先制技で（素早いので）先に倒しにいく', () => {
    // 自分（相手側の CPU）はHP20。プレイヤーの先制技は攻撃が高いので、受けると倒れる
    const cpu = makeCombatant({ id: 'cpu', hp: 20, moves: [HIT, QUICK], stats: { speed: 60 } });
    const player = makeCombatant({ id: 'player', hp: 15, moves: [QUICK], stats: { attack: 100, speed: 50 } });
    const state = battle([player], [cpu]);
    // 段階1は威力の高い技を選ぶが、それでは先制技で先に倒される
    expect(chooseCommandStage1(state, 'enemy')).toEqual({ type: 'move', moveId: 'hit' });
    expect(chooseCommandStage3(state, 'enemy')).toEqual({ type: 'move', moveId: 'quick' });
  });

  it('このターンで倒せるなら倒す（倒すのを後回しにしない）', () => {
    const cpu = makeCombatant({ id: 'cpu', moves: [HIT], stats: { attack: 100 } });
    const player = makeCombatant({ id: 'player', hp: 10, moves: [HIT] });
    const bench = makeCombatant({ id: 'bench', moves: [HIT], stats: { attack: 100, defense: 100 } });
    expect(chooseCommandStage3(battle([player, bench], [cpu]), 'enemy')).toEqual({ type: 'move', moveId: 'hit' });
  });
});

describe('段階3の強さ', () => {
  const battles = (levels: { player: CpuLevel; enemy: CpuLevel }, count: number) => {
    let rng = createRng(99);
    const results = [];
    for (let i = 0; i < count; i += 1) {
      const teams = pickTeams(FIGHTERS, TEAM_SIZE_FOR_SIM, rng);
      rng = teams.rng;
      results.push(playCpuBattle(teams.value.player, teams.value.enemy, createRng(i), levels));
    }
    return results;
  };
  const enemyWinRate = (results: ReturnType<typeof battles>) =>
    results.filter((result) => result.winner === 'enemy').length / results.length;

  it('段階3は段階2にも段階1にも勝ち越し、どの対戦も最後まで決着する', () => {
    const versus2 = battles({ player: 2, enemy: 3 }, 200);
    const versus1 = battles({ player: 1, enemy: 3 }, 100);
    expect(enemyWinRate(versus2)).toBeGreaterThan(0.55);
    expect(enemyWinRate(versus1)).toBeGreaterThan(0.65);
    for (const result of [...versus2, ...versus1, ...battles({ player: 3, enemy: 3 }, 50)]) {
      expect(result.winner).not.toBeNull();
      expect(result.turns).toBeLessThan(MAX_SELF_PLAY_TURNS);
    }
  });
});

describe('ランでの段階3', () => {
  it('エリア3の戦闘と、どのエリアの強敵も段階3', () => {
    const map: AreaMap = {
      layers: [
        [
          { kind: 'battle', next: [] },
          { kind: 'elite', next: [] },
        ],
      ],
    };
    const run = { ...chooseTeam(startRun(RUN_CONTENT, 1), [0, 1, 2]), map };
    expect(CPU_LEVEL_BY_AREA).toEqual([1, 2, 3]);
    expect(ELITE_CPU_LEVEL).toBe(3);
    for (const area of [0, 1, 2]) {
      expect(enterNode({ ...run, area }, 0, RUN_CONTENT).phase).toMatchObject({ cpu: CPU_LEVEL_BY_AREA[area] });
      expect(enterNode({ ...run, area }, 1, RUN_CONTENT).phase).toMatchObject({ cpu: 3 });
    }
  });

  it('段階3でも、画面から呼ぶ選び方が同じ答えを返す', () => {
    const state = battle([makeCombatant({ moves: [HIT] })], [makeCombatant({ moves: [HIT, QUICK] })]);
    expect(chooseCommand(state, 'enemy', 3)).toEqual(chooseCommandStage3(state, 'enemy'));
  });
});
