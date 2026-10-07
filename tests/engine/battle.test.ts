import { describe, expect, it } from 'vitest';
import { createBattle, createCombatant, opponentOf, resolveTurn } from '../../src/engine/battle';
import { selectableMoves } from '../../src/engine/moves';
import { createRng, type RngState } from '../../src/engine/rng';
import { activeCombatant } from '../../src/engine/team';
import type { BattleEvent, BattleState, Commands, FighterDef, Side } from '../../src/engine/types';
import { deepFreeze, makeFighterDef, makeMove } from '../helpers/fixtures';

// 紅のキャラに翠の技 → 相性は等倍（d = 3）、共鳴なし。威力60・攻撃=防御なら 27〜30 ダメージ
const NORMAL = makeMove({ id: 'normal', attribute: 'green', kind: 'normal', power: 60 });
const BIG = makeMove({ id: 'big', attribute: 'green', kind: 'big', power: 100 });
const PRIORITY = makeMove({ id: 'priority', attribute: 'green', kind: 'priority', power: 30 });
const MOVES = [NORMAL, BIG, PRIORITY];

function fighter(overrides: Parameters<typeof makeFighterDef>[0] = {}): FighterDef {
  return makeFighterDef({ moves: MOVES, ...overrides });
}

/** 1対1のバトル（チーム1体ずつ） */
function duel(player: FighterDef, enemy: FighterDef): BattleState {
  return createBattle([player], [enemy]);
}

const active = (state: BattleState, side: Side) => activeCombatant(state, side);

function use(player: string, enemy: string): Commands {
  return { player: { type: 'move', moveId: player }, enemy: { type: 'move', moveId: enemy } };
}

describe('バトルの開始', () => {
  it('HPは最大、能力変化なし、大技も使える状態で、1ターン目から始まる', () => {
    const state = duel(fighter({ id: 'a' }), fighter({ id: 'b', stats: { hp: 80 } }));
    expect(state.turn).toBe(1);
    expect(state.winner).toBeNull();
    expect(state.awaitingReplacement).toEqual([]);
    expect(active(state, 'player')).toMatchObject({ id: 'a', hp: 100, cooldowns: {} });
    expect(active(state, 'enemy')).toMatchObject({ id: 'b', hp: 80, cooldowns: {} });
    expect(active(state, 'player').stages).toEqual({ attack: 0, defense: 0, speed: 0 });
  });

  it('技は 1〜4 個で、重複できない', () => {
    expect(() => createCombatant(fighter({ moves: [] }))).toThrow();
    const five = [1, 2, 3, 4, 5].map((n) => makeMove({ id: `m${n}` }));
    expect(() => createCombatant(fighter({ moves: five }))).toThrow();
    expect(() => createCombatant(fighter({ moves: [NORMAL, NORMAL] }))).toThrow();
  });

  it('大技以外の技を1つ以上覚えていないとエラー', () => {
    const big2 = makeMove({ id: 'big2', kind: 'big', power: 90 });
    expect(() => createCombatant(fighter({ moves: [BIG, big2] }))).toThrow('大技以外');
    expect(() => createCombatant(fighter({ moves: [BIG, PRIORITY] }))).not.toThrow();
  });

  it('相手の陣営', () => {
    expect(opponentOf('player')).toBe('enemy');
    expect(opponentOf('enemy')).toBe('player');
  });
});

describe('1ターンの処理', () => {
  const state = duel(fighter({ stats: { speed: 60 } }), fighter({ stats: { speed: 40 } }));

  it('速いほうから順に技を使い、それぞれダメージを与える', () => {
    const result = resolveTurn(state, use('normal', 'normal'), createRng(1));
    expect(result.events.map((event) => [event.type, 'side' in event ? event.side : null])).toEqual([
      ['moveUsed', 'player'],
      ['damage', 'enemy'],
      ['moveUsed', 'enemy'],
      ['damage', 'player'],
    ]);
    for (const side of ['player', 'enemy'] as const) {
      const lost = 100 - active(result.state, side).hp;
      expect(lost).toBeGreaterThanOrEqual(27);
      expect(lost).toBeLessThanOrEqual(30);
    }
    expect(result.state.turn).toBe(2);
    expect(result.state.winner).toBeNull();
  });

  it('ダメージのイベントに、ダメージ量・残りHP・相性・共鳴が入る', () => {
    const result = resolveTurn(state, use('normal', 'normal'), createRng(1));
    const damage = result.events.find((event) => event.type === 'damage' && event.side === 'enemy');
    expect(damage).toMatchObject({
      hp: active(result.state, 'enemy').hp,
      amount: 100 - active(result.state, 'enemy').hp,
      effectiveness: 'neutral',
      resonance: false,
    });
  });

  it('先制技は、遅くても先に動く', () => {
    const result = resolveTurn(state, use('normal', 'priority'), createRng(1));
    expect(result.events[0]).toMatchObject({ type: 'moveUsed', side: 'enemy', moveKind: 'priority' });
  });

  it('引数の状態を書き換えない', () => {
    const frozen = deepFreeze(duel(fighter({ stats: { speed: 60 } }), fighter()));
    const snapshot = structuredClone(frozen);
    const result = resolveTurn(frozen, deepFreeze(use('big', 'normal')), createRng(1));
    expect(frozen).toEqual(snapshot);
    expect(result.state).not.toBe(frozen);
  });

  it('同じ状態・コマンド・シードなら、同じ結果になる', () => {
    expect(resolveTurn(state, use('normal', 'big'), createRng(9))).toEqual(
      resolveTurn(state, use('normal', 'big'), createRng(9)),
    );
  });

  it('乱数の状態を進めて返す（次のターンに渡す）', () => {
    const rng = createRng(1);
    expect(resolveTurn(state, use('normal', 'normal'), rng).rng).not.toBe(rng);
  });
});

describe('倒れたとき', () => {
  // 攻撃が高いと一撃で倒せる：60 × (200/50) × 0.5 × 0.9 = 108 以上
  const strong = fighter({ id: 'strong', stats: { attack: 200 } });

  it('先に倒されたほうは行動しない。倒した側の勝ちで決着する', () => {
    const state = duel({ ...strong, stats: { ...strong.stats, speed: 60 } }, fighter({ stats: { speed: 40 } }));
    const result = resolveTurn(state, use('normal', 'normal'), createRng(1));
    expect(result.events.map((event) => event.type)).toEqual(['moveUsed', 'damage', 'fainted', 'battleEnd']);
    expect(result.events.at(-2)).toEqual({ type: 'fainted', side: 'enemy', index: 0 });
    expect(result.events.at(-1)).toEqual({ type: 'battleEnd', winner: 'player' });
    expect(active(result.state, 'enemy').hp).toBe(0);
    expect(result.state.winner).toBe('player');
  });

  it('後から動く側が倒しても、先に動いた側の行動は済んでいる', () => {
    const state = duel(fighter({ stats: { speed: 60 } }), { ...strong, stats: { ...strong.stats, speed: 40 } });
    const result = resolveTurn(state, use('normal', 'normal'), createRng(1));
    expect(result.events.map((event) => event.type)).toEqual([
      'moveUsed',
      'damage',
      'moveUsed',
      'damage',
      'fainted',
      'battleEnd',
    ]);
    expect(result.state.winner).toBe('enemy');
  });

  it('決着したあとはターンを進められない', () => {
    const state = duel({ ...strong, stats: { ...strong.stats, speed: 60 } }, fighter({ stats: { speed: 40 } }));
    const ended = resolveTurn(state, use('normal', 'normal'), createRng(1)).state;
    expect(() => resolveTurn(ended, use('normal', 'normal'), createRng(1))).toThrow('決着');
  });
});

describe('大技（仕様書 3.6）', () => {
  // 決着しないよう HP を多くしておく
  const tough = fighter({ stats: { hp: 9999 } });

  function playTurns(commandsPerTurn: Commands[]): BattleState[] {
    const states: BattleState[] = [duel(tough, tough)];
    let rng: RngState = createRng(1);
    for (const commands of commandsPerTurn) {
      const result = resolveTurn(states.at(-1)!, commands, rng);
      states.push(result.state);
      rng = result.rng;
    }
    return states;
  }

  const selectableIds = (state: BattleState) => selectableMoves(active(state, 'player')).map((move) => move.id);

  it('Nターン目に使ったら、N+1・N+2 ターン目は選べず、N+3 ターン目から選べる', () => {
    // 1ターン目に大技 → 2・3ターン目は選べない → 4ターン目から選べる
    const states = playTurns([use('big', 'normal'), use('normal', 'normal'), use('normal', 'normal')]);
    const [turn1, turn2, turn3, turn4] = states;

    expect(turn1!.turn).toBe(1);
    expect(selectableIds(turn1!)).toContain('big');
    expect(selectableIds(turn2!)).not.toContain('big');
    expect(selectableIds(turn3!)).not.toContain('big');
    expect(turn4!.turn).toBe(4);
    expect(selectableIds(turn4!)).toContain('big');
  });

  it('使えないターンに大技を選ぶとエラー', () => {
    const [, turn2] = playTurns([use('big', 'normal')]);
    expect(() => resolveTurn(turn2!, use('big', 'normal'), createRng(1))).toThrow('まだ使えません');
  });

  it('使えないのは大技を使った側だけ', () => {
    const [, turn2] = playTurns([use('big', 'normal')]);
    expect(selectableMoves(active(turn2!, 'enemy')).map((move) => move.id)).toContain('big');
  });

  it('倒されて大技を使えなかったときは、使用不可にならない', () => {
    const state = duel(
      fighter({ stats: { speed: 40 } }),
      fighter({ stats: { speed: 60, attack: 200 } }),
    );
    const result = resolveTurn(state, use('big', 'normal'), createRng(1));
    expect(result.events.some((event) => event.type === 'moveUsed' && event.side === 'player')).toBe(false);
    expect(active(result.state, 'player').cooldowns).toEqual({});
  });
});

describe('不正なコマンド', () => {
  it('覚えていない技を選ぶとエラー', () => {
    const state = duel(fighter(), fighter());
    expect(() => resolveTurn(state, use('unknown', 'normal'), createRng(1))).toThrow('unknown');
  });
});

describe('バトルを最後まで進める', () => {
  /** 選べる技のうち、威力が一番高いものを選ぶ */
  function strongest(state: BattleState, side: 'player' | 'enemy'): string {
    const moves = [...selectableMoves(active(state, side))].sort((a, b) => b.power - a.power);
    return moves[0]!.id;
  }

  function playToEnd(seed: number): { state: BattleState; log: BattleEvent[] } {
    let state = duel(fighter({ id: 'a', attribute: 'crimson' }), fighter({ id: 'b', attribute: 'blue' }));
    let rng = createRng(seed);
    const log: BattleEvent[] = [];
    while (state.winner === null && state.turn <= 50) {
      const result = resolveTurn(state, use(strongest(state, 'player'), strongest(state, 'enemy')), rng);
      state = result.state;
      rng = result.rng;
      log.push(...result.events);
    }
    return { state, log };
  }

  it('どのシードでも決着がつく', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const { state, log } = playToEnd(seed);
      expect(state.winner).not.toBeNull();
      expect(log.at(-1)).toEqual({ type: 'battleEnd', winner: state.winner });
    }
  });

  it('同じシードなら、最後まで同じ流れになる', () => {
    expect(playToEnd(7)).toEqual(playToEnd(7));
  });
});
