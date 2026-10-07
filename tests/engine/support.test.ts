import { describe, expect, it } from 'vitest';
import { createBattle, createCombatant, resolveTurn } from '../../src/engine/battle';
import { percentOfMaxHp } from '../../src/engine/effects';
import { createRng } from '../../src/engine/rng';
import { activeCombatant } from '../../src/engine/team';
import type { BattleState, Combatant, Commands, MoveEffect, Side, Stats } from '../../src/engine/types';
import { makeCombatant, makeFighterDef, makeMove, makeSupportMove } from '../helpers/fixtures';

// 紅のキャラに翠の技 → 等倍・共鳴なし。威力60・攻撃=防御なら 27〜30 ダメージ
const NORMAL = makeMove({ id: 'normal', attribute: 'green', kind: 'normal', power: 60 });
const PRIORITY = makeMove({ id: 'priority', attribute: 'green', kind: 'priority', power: 30 });

function support(id: string, ...effects: MoveEffect[]) {
  return makeSupportMove({ id, effects });
}

const ATTACK_UP_2 = support('attack-up-2', { type: 'stat', target: 'self', stat: 'attack', stages: 2 });
const DEFENSE_DOWN = support('defense-down', { type: 'stat', target: 'opponent', stat: 'defense', stages: -1 });
const SPEED_UP = support('speed-up', { type: 'stat', target: 'self', stat: 'speed', stages: 1 });
const HEAL_30 = support('heal-30', { type: 'heal', percent: 30 });
const COMBO = support(
  'combo',
  { type: 'stat', target: 'self', stat: 'attack', stages: 1 },
  { type: 'stat', target: 'self', stat: 'speed', stages: -1 },
);
const MOVES = [NORMAL, PRIORITY, ATTACK_UP_2, DEFENSE_DOWN, SPEED_UP, HEAL_30, COMBO];

const use = (player: string, enemy: string): Commands => ({
  player: { type: 'move', moveId: player },
  enemy: { type: 'move', moveId: enemy },
});
const active = (state: BattleState, side: Side) => activeCombatant(state, side);

/** 1対1のバトル。キャラは戦闘中の状態から直接作る（HPや能力変化を指定できる） */
type Overrides = Partial<Omit<Combatant, 'stats'>> & { stats?: Partial<Stats> };

function duel(player: Overrides = {}, enemy: Overrides = {}): BattleState {
  return {
    turn: 1,
    sides: {
      player: { team: [makeCombatant({ moves: MOVES, ...player, stats: { hp: 999, speed: 60, ...player.stats } })], active: 0 },
      enemy: { team: [makeCombatant({ moves: MOVES, ...enemy, stats: { hp: 999, speed: 40, ...enemy.stats } })], active: 0 },
    },
    awaitingReplacement: [],
    winner: null,
  };
}

describe('能力変化の補助技（仕様書 3.6・3.7）', () => {
  it('自分の能力を上げる。ダメージは与えない', () => {
    const result = resolveTurn(duel(), use('attack-up-2', 'normal'), createRng(1));
    expect(result.events.slice(0, 2)).toEqual([
      { type: 'moveUsed', side: 'player', moveId: 'attack-up-2', moveKind: 'support' },
      { type: 'statChanged', side: 'player', stat: 'attack', delta: 2, stage: 2 },
    ]);
    expect(active(result.state, 'player').stages.attack).toBe(2);
    expect(active(result.state, 'enemy').hp).toBe(999);
  });

  it('相手の能力を下げる', () => {
    const result = resolveTurn(duel(), use('defense-down', 'normal'), createRng(1));
    expect(result.events[1]).toEqual({ type: 'statChanged', side: 'enemy', stat: 'defense', delta: -1, stage: -1 });
    expect(active(result.state, 'enemy').stages.defense).toBe(-1);
  });

  it('上下3段階で止まり、実際に変わった段階数をイベントに入れる', () => {
    const at2 = duel({ stages: { attack: 2, defense: 0, speed: 0 } });
    expect(resolveTurn(at2, use('attack-up-2', 'normal'), createRng(1)).events[1]).toEqual({
      type: 'statChanged',
      side: 'player',
      stat: 'attack',
      delta: 1,
      stage: 3,
    });

    const at3 = duel({ stages: { attack: 3, defense: 0, speed: 0 } });
    expect(resolveTurn(at3, use('attack-up-2', 'normal'), createRng(1)).events[1]).toMatchObject({ delta: 0, stage: 3 });

    const atMinus3 = duel({}, { stages: { attack: 0, defense: -3, speed: 0 } });
    expect(resolveTurn(atMinus3, use('defense-down', 'normal'), createRng(1)).events[1]).toMatchObject({
      delta: 0,
      stage: -3,
    });
  });

  it('効果が複数あれば、順番に適用する', () => {
    const result = resolveTurn(duel(), use('combo', 'normal'), createRng(1));
    expect(result.events.slice(1, 3)).toEqual([
      { type: 'statChanged', side: 'player', stat: 'attack', delta: 1, stage: 1 },
      { type: 'statChanged', side: 'player', stat: 'speed', delta: -1, stage: -1 },
    ]);
  });

  it('上げた攻撃は、次のターンのダメージに反映される', () => {
    const buffed = resolveTurn(duel(), use('attack-up-2', 'attack-up-2'), createRng(1));
    const next = resolveTurn(buffed.state, use('normal', 'attack-up-2'), buffed.rng);
    const lost = 999 - active(next.state, 'enemy').hp;
    // 60 × (50×1.5625 / 50) × 0.5 = 46.875 → 乱数0.90〜1.00 で 42〜46
    expect(lost).toBeGreaterThanOrEqual(42);
    expect(lost).toBeLessThanOrEqual(46);
  });

  it('上げた素早さは、次のターンの行動順に反映される', () => {
    // 自分 40、相手 45 → 素早さ +1 で 50 になり、次のターンは自分が先
    const state = duel({ stats: { speed: 40 } }, { stats: { speed: 45 } });
    const first = resolveTurn(state, use('speed-up', 'normal'), createRng(1));
    expect(first.events[0]).toMatchObject({ side: 'enemy' });
    const second = resolveTurn(first.state, use('normal', 'normal'), first.rng);
    expect(second.events[0]).toMatchObject({ type: 'moveUsed', side: 'player' });
  });
});

describe('回復の補助技', () => {
  it('最大HPの割合だけ回復する', () => {
    const state = duel({ hp: 500 });
    const result = resolveTurn(state, use('heal-30', 'heal-30'), createRng(1));
    // 999 × 30% = 299.7 → 299
    expect(result.events[1]).toEqual({ type: 'healed', side: 'player', amount: 299, hp: 799 });
  });

  it('最大HPを超えて回復しない。満タンなら 0', () => {
    const nearlyFull = resolveTurn(duel({ hp: 900 }), use('heal-30', 'heal-30'), createRng(1));
    expect(nearlyFull.events[1]).toEqual({ type: 'healed', side: 'player', amount: 99, hp: 999 });

    const full = resolveTurn(duel(), use('heal-30', 'heal-30'), createRng(1));
    expect(full.events[1]).toEqual({ type: 'healed', side: 'player', amount: 0, hp: 999 });
  });

  it('回復量は切り捨てで、最低 1', () => {
    expect(percentOfMaxHp(100, 30)).toBe(30);
    expect(percentOfMaxHp(95, 30)).toBe(28);
    expect(percentOfMaxHp(3, 10)).toBe(1);
  });
});

describe('補助技の行動順と乱数', () => {
  it('補助技は通常の技と同じく素早さ順。先制技より後', () => {
    const result = resolveTurn(duel(), use('attack-up-2', 'priority'), createRng(1));
    expect(result.events[0]).toMatchObject({ type: 'moveUsed', side: 'enemy', moveKind: 'priority' });
  });

  it('補助技はダメージの乱数を使わない', () => {
    const rng = createRng(1);
    expect(resolveTurn(duel(), use('attack-up-2', 'heal-30'), rng).rng).toBe(rng);
  });
});

describe('補助技の定義', () => {
  it('効果のない補助技はエラー', () => {
    const empty = makeSupportMove({ id: 'empty', effects: [] });
    expect(() => createCombatant(makeFighterDef({ moves: [NORMAL, empty] }))).toThrow('効果がありません');
  });

  it('補助技は「大技以外の技」に数える', () => {
    const big = makeMove({ id: 'big', kind: 'big', power: 100 });
    expect(() => createBattle([makeFighterDef({ moves: [big, HEAL_30] })], [makeFighterDef()])).not.toThrow();
  });
});
