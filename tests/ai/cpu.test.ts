import { describe, expect, it } from 'vitest';
import { chooseCommandStage1, chooseReplacementStage1, expectedDamage } from '../../src/ai/cpu';
import type { BattleState, Combatant, Side } from '../../src/engine/types';
import { makeCombatant, makeMove, makeSupportMove } from '../helpers/fixtures';

function battle(player: Combatant[], enemy: Combatant[], activePlayer = 0): BattleState {
  return {
    turn: 1,
    sides: { player: { team: player, active: activePlayer }, enemy: { team: enemy, active: 0 } },
    awaitingReplacement: [],
    winner: null,
  };
}

const choose = (state: BattleState, side: Side = 'player') => chooseCommandStage1(state, side);

describe('予想ダメージ', () => {
  it('乱数を真ん中（0.95）にしたダメージ', () => {
    // 60 × 1 × 1 × 0.95 × 0.5 = 28.5 → 28
    const move = makeMove({ attribute: 'green', power: 60 });
    expect(expectedDamage(makeCombatant(), makeCombatant(), move)).toBe(28);
  });
});

describe('CPU 段階1：技の選び方（仕様書 6）', () => {
  it('予想ダメージが最大の技を選ぶ（威力だけでなく、相性と共鳴も考える）', () => {
    const plain = makeMove({ id: 'plain', attribute: 'blue', power: 70 }); // 蒼 → 橙は等倍、共鳴なし：70
    const resonant = makeMove({ id: 'resonant', attribute: 'crimson', power: 50 }); // 有利・共鳴：50 × 1.5 × 1.2 = 90
    const state = battle([makeCombatant({ moves: [plain, resonant] })], [makeCombatant({ attribute: 'orange' })]);
    expect(choose(state)).toEqual({ type: 'move', moveId: 'resonant' });
  });

  it('予想ダメージが同じなら、技の並び順で先のもの', () => {
    const a = makeMove({ id: 'a', attribute: 'green', power: 60 });
    const b = makeMove({ id: 'b', attribute: 'green', power: 60 });
    expect(choose(battle([makeCombatant({ moves: [a, b] })], [makeCombatant()]))).toEqual({ type: 'move', moveId: 'a' });
  });

  it('大技が使えない間は、ほかの技から選ぶ', () => {
    const normal = makeMove({ id: 'normal', attribute: 'green', power: 60 });
    const big = makeMove({ id: 'big', attribute: 'green', kind: 'big', power: 100 });
    const ready = makeCombatant({ moves: [normal, big] });
    expect(choose(battle([ready], [makeCombatant()]))).toEqual({ type: 'move', moveId: 'big' });

    const cooling = makeCombatant({ moves: [normal, big], cooldowns: { big: 2 } });
    expect(choose(battle([cooling], [makeCombatant()]))).toEqual({ type: 'move', moveId: 'normal' });
  });

  it('補助技は選ばない。選べる攻撃技がなければ、選べる技の先頭を使う', () => {
    const big = makeMove({ id: 'big', kind: 'big', power: 100 });
    const heal = makeSupportMove({ id: 'heal', effects: [{ type: 'heal', percent: 30 }] });
    const withAttack = makeCombatant({ moves: [heal, big] });
    expect(choose(battle([withAttack], [makeCombatant()]))).toEqual({ type: 'move', moveId: 'big' });

    const onlySupport = makeCombatant({ moves: [heal, big], cooldowns: { big: 1 } });
    expect(choose(battle([onlySupport], [makeCombatant()]))).toEqual({ type: 'move', moveId: 'heal' });
  });

  it('相手の陣営から見ても、相手の場のキャラに対して選ぶ', () => {
    const toCrimson = makeMove({ id: 'to-crimson', attribute: 'blue', power: 60 }); // 蒼 → 紅は有利
    const toOther = makeMove({ id: 'to-other', attribute: 'yellow', power: 60 }); // 黄 → 紅は不利
    const enemy = makeCombatant({ attribute: 'green', moves: [toOther, toCrimson] });
    expect(choose(battle([makeCombatant({ attribute: 'crimson' })], [enemy]), 'enemy')).toEqual({
      type: 'move',
      moveId: 'to-crimson',
    });
  });
});

describe('CPU 段階1：倒れたあとに出す控え', () => {
  const green = makeMove({ id: 'green', attribute: 'green', power: 60 });
  const blue = makeMove({ id: 'blue', attribute: 'blue', power: 60 });

  it('相手の場のキャラに一番ダメージを出せる控えを出す', () => {
    const fainted = makeCombatant({ hp: 0, moves: [green] });
    // 相手は紅：翠の技は等倍、蒼の技は有利
    const state = battle(
      [fainted, makeCombatant({ id: 'neutral', moves: [green] }), makeCombatant({ id: 'strong', moves: [blue] })],
      [makeCombatant({ attribute: 'crimson' })],
    );
    expect(chooseReplacementStage1(state, 'player')).toBe(2);
  });

  it('同じなら、チームの並び順で先の控え', () => {
    const fainted = makeCombatant({ hp: 0, moves: [green] });
    const state = battle([fainted, makeCombatant({ moves: [green] }), makeCombatant({ moves: [green] })], [makeCombatant()]);
    expect(chooseReplacementStage1(state, 'player')).toBe(1);
  });

  it('倒れている控えは選ばない', () => {
    const state = battle(
      [makeCombatant({ hp: 0, moves: [green] }), makeCombatant({ hp: 0, moves: [blue] }), makeCombatant({ moves: [green] })],
      [makeCombatant({ attribute: 'crimson' })],
    );
    expect(chooseReplacementStage1(state, 'player')).toBe(2);
  });
});
