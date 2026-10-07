import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, submitReplacements } from '../../src/engine/battle';
import { isAttackMove, selectableMoves } from '../../src/engine/moves';
import { createRng, type RngState } from '../../src/engine/rng';
import { activeCombatant, switchTargets } from '../../src/engine/team';
import type { BattleEvent, BattleState, Command, Commands, FighterDef, Side } from '../../src/engine/types';
import { deepFreeze, makeCombatant, makeFighterDef, makeMove } from '../helpers/fixtures';

// 紅のキャラに翠の技 → 等倍・共鳴なし
const NORMAL = makeMove({ id: 'normal', attribute: 'green', kind: 'normal', power: 60 });
const BIG = makeMove({ id: 'big', attribute: 'green', kind: 'big', power: 100 });
const MOVES = [NORMAL, BIG];

function fighter(id: string, overrides: Parameters<typeof makeFighterDef>[0] = {}): FighterDef {
  return makeFighterDef({ id, moves: MOVES, ...overrides });
}

const move = (moveId: string): Command => ({ type: 'move', moveId });
const switchTo = (to: number): Command => ({ type: 'switch', to });
const both = (player: Command, enemy: Command): Commands => ({ player, enemy });
const active = (state: BattleState, side: Side) => activeCombatant(state, side);

/** 3体ずつのチーム。HP が多く、すぐには決着しない */
function teams(): BattleState {
  const tough = { stats: { hp: 999 } };
  return createBattle(
    [fighter('p1', { ...tough, stats: { hp: 999, speed: 60 } }), fighter('p2', tough), fighter('p3', tough)],
    [fighter('e1', { ...tough, stats: { hp: 999, speed: 40 } }), fighter('e2', tough), fighter('e3', tough)],
  );
}

describe('チームでバトルを始める', () => {
  it('チームの先頭のキャラから場に出る', () => {
    const state = teams();
    expect(state.sides.player.active).toBe(0);
    expect(active(state, 'player').id).toBe('p1');
    expect(active(state, 'enemy').id).toBe('e1');
  });

  it('チームは 1〜3 体', () => {
    expect(() => createBattle([], [fighter('e')])).toThrow();
    const four = ['a', 'b', 'c', 'd'].map((id) => fighter(id));
    expect(() => createBattle(four, [fighter('e')])).toThrow();
    expect(() => createBattle([fighter('a')], [fighter('e')])).not.toThrow();
  });

  it('交代先に選べるのは、倒れていない控え', () => {
    const state = teams();
    expect(switchTargets(state.sides.player)).toEqual([1, 2]);
  });
});

describe('交代（仕様書 3.9）', () => {
  it('交代は技より先に行われ、相手の技は交代先に当たる', () => {
    // 相手のほうが遅くても速くても、交代が先
    const result = resolveTurn(teams(), both(switchTo(1), move('normal')), createRng(1));
    expect(result.events[0]).toEqual({ type: 'switched', side: 'player', from: 0, to: 1, reason: 'command' });
    expect(result.events[1]).toMatchObject({ type: 'moveUsed', side: 'enemy' });
    expect(result.events[2]).toMatchObject({ type: 'damage', side: 'player' });

    expect(active(result.state, 'player').id).toBe('p2');
    expect(active(result.state, 'player').hp).toBeLessThan(999);
    expect(result.state.sides.player.team[0]!.hp).toBe(999);
  });

  it('交代したキャラは、そのターン技を使わない', () => {
    const result = resolveTurn(teams(), both(switchTo(1), move('normal')), createRng(1));
    expect(result.events.filter((event) => event.type === 'moveUsed' && event.side === 'player')).toEqual([]);
  });

  it('両方が交代なら、素早さ順に交代する', () => {
    const result = resolveTurn(teams(), both(switchTo(2), switchTo(1)), createRng(1));
    expect(result.events).toEqual([
      { type: 'switched', side: 'player', from: 0, to: 2, reason: 'command' },
      { type: 'switched', side: 'enemy', from: 0, to: 1, reason: 'command' },
    ]);
  });

  it('交代すると、引っ込めたキャラの能力変化はリセットされる', () => {
    const buffed = makeCombatant({ id: 'buffed', moves: MOVES, stages: { attack: 2, defense: -1, speed: 1 } });
    const state: BattleState = {
      turn: 1,
      sides: {
        player: { team: [buffed, makeCombatant({ id: 'p2', moves: MOVES })], active: 0 },
        enemy: { team: [makeCombatant({ id: 'e1', moves: MOVES, stats: { hp: 999 } })], active: 0 },
      },
      awaitingReplacement: [],
      winner: null,
    };
    const result = resolveTurn(state, both(switchTo(1), move('normal')), createRng(1));
    expect(result.state.sides.player.team[0]!.stages).toEqual({ attack: 0, defense: 0, speed: 0 });
  });

  it('場のキャラや、倒れたキャラとは交代できない', () => {
    const state = teams();
    expect(() => resolveTurn(state, both(switchTo(0), move('normal')), createRng(1))).toThrow('交代できません');
    expect(() => resolveTurn(state, both(switchTo(3), move('normal')), createRng(1))).toThrow('交代できません');

    const fainted: BattleState = {
      ...state,
      sides: {
        ...state.sides,
        player: { ...state.sides.player, team: state.sides.player.team.with(1, { ...state.sides.player.team[1]!, hp: 0 }) },
      },
    };
    expect(() => resolveTurn(fainted, both(switchTo(1), move('normal')), createRng(1))).toThrow('交代できません');
  });
});

describe('控えにいる間（仕様書 3.10）', () => {
  it('大技の使用不可ターンは、控えにいる間は減らない', () => {
    let state = teams();
    let rng: RngState = createRng(1);
    const play = (commands: Commands) => {
      const result = resolveTurn(state, commands, rng);
      state = result.state;
      rng = result.rng;
    };

    play(both(move('big'), move('normal'))); // 1ターン目：p1 が大技 → 残り 2
    expect(active(state, 'player').cooldowns).toEqual({ big: 2 });

    play(both(switchTo(1), move('normal'))); // 2ターン目：p1 を控えへ
    play(both(move('normal'), move('normal'))); // 3ターン目
    expect(state.sides.player.team[0]!.cooldowns).toEqual({ big: 2 });

    play(both(switchTo(0), move('normal'))); // 4ターン目：p1 を戻す → 終了時に 1
    expect(selectableMoves(active(state, 'player')).map((m) => m.id)).not.toContain('big');
    play(both(move('normal'), move('normal'))); // 5ターン目 → 終了時に 0
    expect(selectableMoves(active(state, 'player')).map((m) => m.id)).toContain('big');
  });
});

describe('倒れたとき（仕様書 3.9・3.10）', () => {
  // 攻撃が高いと一撃で倒せる
  const strongDef = fighter('strong', { stats: { attack: 200, speed: 60 } });

  function faintEnemyLead(): BattleState {
    const state = createBattle([strongDef], [fighter('e1', { stats: { speed: 40 } }), fighter('e2'), fighter('e3')]);
    return resolveTurn(state, both(move('normal'), move('normal')), createRng(1)).state;
  }

  it('控えがいれば決着せず、控えから選ぶ待ちになる', () => {
    const state = faintEnemyLead();
    expect(state.winner).toBeNull();
    expect(state.awaitingReplacement).toEqual(['enemy']);
    expect(active(state, 'enemy').hp).toBe(0);
  });

  it('控えから選ぶまで、次のターンに進めない', () => {
    expect(() => resolveTurn(faintEnemyLead(), both(move('normal'), move('normal')), createRng(1))).toThrow(
      '控えから選んで',
    );
  });

  it('控えからキャラを出す。ターンは使わない', () => {
    const before = faintEnemyLead();
    const result = submitReplacements(before, { enemy: 2 });
    expect(result.events).toEqual([{ type: 'switched', side: 'enemy', from: 0, to: 2, reason: 'replacement' }]);
    expect(active(result.state, 'enemy').id).toBe('e3');
    expect(result.state.awaitingReplacement).toEqual([]);
    expect(result.state.turn).toBe(before.turn);
  });

  it('選べるのは倒れていない控えだけ。選ぶ必要のない陣営は指定できない', () => {
    const state = faintEnemyLead();
    expect(() => submitReplacements(state, {})).toThrow('選んでください');
    expect(() => submitReplacements(state, { enemy: 0 })).toThrow('出せません');
    expect(() => submitReplacements(state, { enemy: 1, player: 0 })).toThrow('必要がありません');
    expect(() => submitReplacements(teams(), { enemy: 1 })).toThrow('必要はありません');
  });

  it('引数の状態を書き換えない', () => {
    const state = deepFreeze(faintEnemyLead());
    const snapshot = structuredClone(state);
    submitReplacements(state, { enemy: 1 });
    expect(state).toEqual(snapshot);
  });

  it('全員倒れたら、その相手の勝ちで決着する', () => {
    const state = createBattle([strongDef], [fighter('e1', { stats: { speed: 40 } })]);
    const result = resolveTurn(state, both(move('normal'), move('normal')), createRng(1));
    expect(result.state.winner).toBe('player');
    expect(result.state.awaitingReplacement).toEqual([]);
    expect(result.events.at(-1)).toEqual({ type: 'battleEnd', winner: 'player' });
  });
});

describe('3対3を最後まで進める', () => {
  /** 威力が一番高い技を選び、倒れたら控えの先頭を出す */
  function strongest(state: BattleState, side: Side): Command {
    const moves = selectableMoves(active(state, side)).filter(isAttackMove).sort((a, b) => b.power - a.power);
    return move(moves[0]!.id);
  }

  function playToEnd(seed: number): { state: BattleState; log: BattleEvent[] } {
    let state = createBattle(
      [fighter('p1', { attribute: 'crimson' }), fighter('p2', { attribute: 'blue' }), fighter('p3')],
      [fighter('e1', { attribute: 'blue' }), fighter('e2', { attribute: 'green' }), fighter('e3')],
    );
    let rng = createRng(seed);
    const log: BattleEvent[] = [];
    while (state.winner === null && state.turn <= 100) {
      if (state.awaitingReplacement.length > 0) {
        const choices = Object.fromEntries(
          state.awaitingReplacement.map((side) => [side, switchTargets(state.sides[side])[0]!]),
        );
        const replaced = submitReplacements(state, choices);
        state = replaced.state;
        log.push(...replaced.events);
        continue;
      }
      const result = resolveTurn(state, both(strongest(state, 'player'), strongest(state, 'enemy')), rng);
      state = result.state;
      rng = result.rng;
      log.push(...result.events);
    }
    return { state, log };
  }

  it('どのシードでも、どちらかが全員倒れて決着する', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const { state, log } = playToEnd(seed);
      expect(state.winner).not.toBeNull();
      const loser = state.winner === 'player' ? 'enemy' : 'player';
      expect(state.sides[loser].team.every((member) => member.hp === 0)).toBe(true);
      expect(log.filter((event) => event.type === 'fainted' && event.side === loser)).toHaveLength(3);
    }
  });

  it('同じシードなら、最後まで同じ流れになる', () => {
    expect(playToEnd(3)).toEqual(playToEnd(3));
  });
});
