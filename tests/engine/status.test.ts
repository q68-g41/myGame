import { describe, expect, it } from 'vitest';
import { resolveTurn, submitReplacements } from '../../src/engine/battle';
import { createRng, type RngState } from '../../src/engine/rng';
import { effectiveSpeed } from '../../src/engine/stats';
import { activeCombatant } from '../../src/engine/team';
import type { BattleEvent, BattleState, Combatant, Command, Commands, Side, Stats } from '../../src/engine/types';
import { makeCombatant, makeMove, makeSupportMove } from '../helpers/fixtures';

// 紅のキャラに翠の技 → 等倍・共鳴なし
const NORMAL = makeMove({ id: 'normal', attribute: 'green', kind: 'normal', power: 60 });
const WEAK = makeMove({ id: 'weak', attribute: 'green', kind: 'normal', power: 1 });
const EROSION = makeSupportMove({ id: 'erosion', effects: [{ type: 'status', status: 'erosion' }] });
const SLOW = makeSupportMove({ id: 'slow', effects: [{ type: 'status', status: 'slow' }] });
const WAIT = makeSupportMove({ id: 'wait', effects: [{ type: 'stat', target: 'self', stat: 'attack', stages: 0 }] });
const MOVES = [NORMAL, WEAK, EROSION, SLOW, WAIT];

type Overrides = Partial<Omit<Combatant, 'stats'>> & { stats?: Partial<Stats> };

const member = (overrides: Overrides = {}): Combatant =>
  makeCombatant({ moves: MOVES, ...overrides, stats: { hp: 1000, ...overrides.stats } });

function battle(player: Combatant[], enemy: Combatant[]): BattleState {
  return {
    turn: 1,
    sides: { player: { team: player, active: 0 }, enemy: { team: enemy, active: 0 } },
    awaitingReplacement: [],
    winner: null,
  };
}

const move = (moveId: string): Command => ({ type: 'move', moveId });
const use = (player: string, enemy: string): Commands => ({ player: move(player), enemy: move(enemy) });
const active = (state: BattleState, side: Side) => activeCombatant(state, side);

/** 決まったコマンドでターンを進め、各ターンのイベントを返す */
function play(state: BattleState, turns: Commands[], seed = 1): { state: BattleState; events: BattleEvent[][] } {
  let current = state;
  let rng: RngState = createRng(seed);
  const events: BattleEvent[][] = [];
  for (const commands of turns) {
    const result = resolveTurn(current, commands, rng);
    current = result.state;
    rng = result.rng;
    events.push([...result.events]);
  }
  return { state: current, events };
}

const statusDamages = (events: BattleEvent[], side: Side) =>
  events.filter((event) => event.type === 'statusDamage' && event.side === side);

describe('状態異常のかけ方（仕様書 3.6・3.8）', () => {
  it('補助技で相手に状態異常を与える', () => {
    const result = resolveTurn(battle([member({ stats: { speed: 60 } })], [member()]), use('slow', 'wait'), createRng(1));
    expect(result.events[1]).toEqual({ type: 'statusApplied', side: 'enemy', status: 'slow' });
    expect(active(result.state, 'enemy').status?.id).toBe('slow');
  });

  it('すでに状態異常があれば効かず、上書きしない', () => {
    const slowed = member({ status: { id: 'slow', remaining: 2 } });
    const result = resolveTurn(battle([member({ stats: { speed: 60 } })], [slowed]), use('erosion', 'wait'), createRng(1));
    expect(result.events[1]).toEqual({ type: 'statusBlocked', side: 'enemy', status: 'erosion' });
    expect(active(result.state, 'enemy').status?.id).toBe('slow');
  });
});

describe('侵蝕（仕様書 3.8）', () => {
  it('かかったターンから3回、ターン終了時に最大HPの10%のダメージを受けて治る', () => {
    // 1ターン目に侵蝕 → 1・2・3ターン目の終了時にダメージ → 3ターン目の終了時に治る
    const { state, events } = play(battle([member({ stats: { speed: 60 } })], [member()]), [
      use('erosion', 'wait'),
      use('wait', 'wait'),
      use('wait', 'wait'),
      use('wait', 'wait'),
    ]);
    expect(events.map((turn) => statusDamages(turn, 'enemy').length)).toEqual([1, 1, 1, 0]);
    expect(statusDamages(events[0]!, 'enemy')[0]).toEqual({
      type: 'statusDamage',
      side: 'enemy',
      status: 'erosion',
      amount: 100,
      hp: 900,
    });
    expect(events[2]!.at(-1)).toEqual({ type: 'statusEnded', side: 'enemy', status: 'erosion' });
    expect(active(state, 'enemy').hp).toBe(700);
    expect(active(state, 'enemy').status).toBeNull();
  });

  it('ダメージは切り捨てで、最低 1', () => {
    const tiny = member({ stats: { hp: 5 }, hp: 5, status: { id: 'erosion', remaining: 3 } });
    const result = resolveTurn(battle([member()], [tiny]), use('wait', 'wait'), createRng(1));
    expect(statusDamages([...result.events], 'enemy')[0]).toMatchObject({ amount: 1, hp: 4 });
  });

  it('侵蝕で倒れたら、ターン終了時に倒れて控えから選ぶ待ちになる', () => {
    const weak = member({ hp: 50, status: { id: 'erosion', remaining: 3 } });
    const result = resolveTurn(battle([member()], [weak, member()]), use('wait', 'wait'), createRng(1));
    expect(result.events.slice(-2)).toEqual([
      { type: 'statusDamage', side: 'enemy', status: 'erosion', amount: 100, hp: 0 },
      { type: 'fainted', side: 'enemy', index: 0 },
    ]);
    expect(result.state.awaitingReplacement).toEqual(['enemy']);
  });

  it('技で倒れたキャラは、侵蝕のダメージを受けない', () => {
    const weak = member({ hp: 1, status: { id: 'erosion', remaining: 3 }, stats: { speed: 10 } });
    const result = resolveTurn(battle([member({ stats: { speed: 60 } })], [weak, member()]), use('normal', 'wait'), createRng(1));
    expect(statusDamages([...result.events], 'enemy')).toEqual([]);
  });
});

describe('鈍化（仕様書 3.8）', () => {
  it('素早さが半分になる', () => {
    expect(effectiveSpeed(member({ stats: { speed: 60 }, status: { id: 'slow', remaining: 2 } }))).toBe(30);
  });

  it('かかったターンと次のターンだけ効く（かかったターンは行動順が決まったあと）', () => {
    // 自分 40、相手 60。1ターン目に鈍化 → 2ターン目は相手 30 で自分が先 → 2ターン目の終了時に治る → 3ターン目は相手が先
    const { events } = play(battle([member({ stats: { speed: 40 } })], [member({ stats: { speed: 60 } })]), [
      use('slow', 'wait'),
      use('wait', 'wait'),
      use('wait', 'wait'),
    ]);
    const firstMover = (turn: BattleEvent[]) => turn.find((event) => event.type === 'moveUsed')?.side;
    expect(events.map(firstMover)).toEqual(['enemy', 'player', 'enemy']);
    expect(events[1]!.at(-1)).toEqual({ type: 'statusEnded', side: 'enemy', status: 'slow' });
  });
});

describe('交代と状態異常（仕様書 3.9・3.10）', () => {
  it('交代しても状態異常は残り、控えにいる間は止まる（ダメージも受けない）', () => {
    const eroded = member({ id: 'eroded', status: { id: 'erosion', remaining: 3 } });
    const switchOut: Commands = { player: move('wait'), enemy: { type: 'switch', to: 1 } };
    const switchBack: Commands = { player: move('wait'), enemy: { type: 'switch', to: 0 } };
    const { state, events } = play(battle([member()], [eroded, member()]), [
      switchOut, // 1ターン目：控えへ
      use('wait', 'wait'), // 2ターン目：控えにいる
      switchBack, // 3ターン目：戻る → 終了時にダメージ（残り 3 → 2）
    ]);
    expect(events.map((turn) => statusDamages(turn, 'enemy').length)).toEqual([0, 0, 1]);
    expect(active(state, 'enemy').id).toBe('eroded');
    expect(active(state, 'enemy').status).toEqual({ id: 'erosion', remaining: 2 });
    expect(active(state, 'enemy').hp).toBe(900);
  });
});

describe('侵蝕の処理順と、両方が全滅したとき（仕様書 3.10）', () => {
  // 両方とも最後の1体で、侵蝕の1回で倒れる
  const lastOne = (speed: number) => member({ hp: 10, stats: { speed }, status: { id: 'erosion', remaining: 3 } });

  it('侵蝕は素早さ順に処理し、後に倒れた側（遅い側）の勝ち', () => {
    const result = resolveTurn(battle([lastOne(60)], [lastOne(40)]), use('wait', 'wait'), createRng(1));
    const fainted = result.events.filter((event) => event.type === 'fainted').map((event) => event.side);
    expect(fainted).toEqual(['player', 'enemy']);
    expect(result.state.winner).toBe('enemy');
    expect(result.events.at(-1)).toEqual({ type: 'battleEnd', winner: 'enemy' });
  });

  it('素早さが逆なら、勝つ側も逆になる', () => {
    const result = resolveTurn(battle([lastOne(40)], [lastOne(60)]), use('wait', 'wait'), createRng(1));
    expect(result.state.winner).toBe('player');
  });

  it('同じ素早さなら、シード付き乱数で決まる（同じシードなら同じ結果）', () => {
    const state = battle([lastOne(50)], [lastOne(50)]);
    const winners = new Set<Side | null>();
    for (let seed = 0; seed < 20; seed += 1) {
      const first = resolveTurn(state, use('wait', 'wait'), createRng(seed));
      const second = resolveTurn(state, use('wait', 'wait'), createRng(seed));
      expect(second.state.winner).toBe(first.state.winner);
      winners.add(first.state.winner);
    }
    expect(winners).toEqual(new Set(['player', 'enemy']));
  });

  it('技で倒れたあと、相手が侵蝕で倒れて両方全滅したら、侵蝕で倒れた側（後）の勝ち', () => {
    // 自分（最後の1体）は相手の技で倒れ、相手（最後の1体）はターン終了時の侵蝕で倒れる
    const player = member({ hp: 1, stats: { speed: 60 } });
    const enemy = member({ hp: 10, stats: { speed: 40 }, status: { id: 'erosion', remaining: 3 } });
    const result = resolveTurn(battle([player], [enemy]), use('wait', 'weak'), createRng(1));
    const fainted = result.events.filter((event) => event.type === 'fainted').map((event) => event.side);
    expect(fainted).toEqual(['player', 'enemy']);
    expect(result.state.winner).toBe('enemy');
  });

  it('両方の場のキャラが倒れても控えがいれば、両方が控えから選ぶ', () => {
    const result = resolveTurn(battle([lastOne(60), member()], [lastOne(40), member()]), use('wait', 'wait'), createRng(1));
    expect(result.state.winner).toBeNull();
    expect(result.state.awaitingReplacement).toEqual(['player', 'enemy']);
    const replaced = submitReplacements(result.state, { player: 1, enemy: 1 });
    expect(replaced.events.map((event) => event.type)).toEqual(['switched', 'switched']);
    expect(replaced.state.awaitingReplacement).toEqual([]);
  });
});
