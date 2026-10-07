import { describe, expect, it } from 'vitest';
import { decideActionOrder } from '../../src/engine/order';
import { createRng } from '../../src/engine/rng';
import type { BattleState, Combatant, Command, Commands, MoveKind, Side, StatStages } from '../../src/engine/types';
import { makeCombatant, makeMove } from '../helpers/fixtures';

const MOVES = [
  makeMove({ id: 'normal', kind: 'normal', power: 60 }),
  makeMove({ id: 'big', kind: 'big', power: 100 }),
  makeMove({ id: 'priority', kind: 'priority', power: 35 }),
];

function fighter(speed: number, stages: Partial<StatStages> = {}): Combatant {
  return makeCombatant({
    stats: { speed },
    stages: { attack: 0, defense: 0, speed: 0, ...stages },
    moves: MOVES,
  });
}

function battle(player: Combatant, enemy: Combatant): BattleState {
  // 控えを1体ずつ置いて、交代もできるようにする
  return {
    turn: 1,
    sides: { player: { team: [player, fighter(10)], active: 0 }, enemy: { team: [enemy, fighter(10)], active: 0 } },
    awaitingReplacement: [],
    winner: null,
  };
}

type Choice = MoveKind | 'switch';

function toCommand(choice: Choice): Command {
  return choice === 'switch' ? { type: 'switch', to: 1 } : { type: 'move', moveId: choice };
}

function commands(player: Choice, enemy: Choice): Commands {
  return { player: toCommand(player), enemy: toCommand(enemy) };
}

const PLAYER_FIRST: readonly Side[] = ['player', 'enemy'];
const ENEMY_FIRST: readonly Side[] = ['enemy', 'player'];

describe('行動順（仕様書 3.5）', () => {
  it('素早さが高いほうが先に動く', () => {
    const rng = createRng(1);
    expect(decideActionOrder(battle(fighter(60), fighter(40)), commands('normal', 'normal'), rng).value).toEqual(
      PLAYER_FIRST,
    );
    expect(decideActionOrder(battle(fighter(40), fighter(60)), commands('normal', 'normal'), rng).value).toEqual(
      ENEMY_FIRST,
    );
  });

  it('先制技は、素早さに関係なく通常の技より先に動く', () => {
    const state = battle(fighter(30), fighter(70));
    expect(decideActionOrder(state, commands('priority', 'normal'), createRng(1)).value).toEqual(PLAYER_FIRST);
  });

  it('大技は通常の技と同じ扱い（素早さ順）', () => {
    const state = battle(fighter(30), fighter(70));
    expect(decideActionOrder(state, commands('big', 'normal'), createRng(1)).value).toEqual(ENEMY_FIRST);
  });

  it('交代は、先制技より先に動く', () => {
    const state = battle(fighter(30), fighter(70));
    expect(decideActionOrder(state, commands('switch', 'priority'), createRng(1)).value).toEqual(PLAYER_FIRST);
  });

  it('両方が交代なら素早さ順（場に出ているキャラの素早さ）', () => {
    const state = battle(fighter(30), fighter(70));
    expect(decideActionOrder(state, commands('switch', 'switch'), createRng(1)).value).toEqual(ENEMY_FIRST);
  });

  it('両方が先制技なら素早さ順', () => {
    const state = battle(fighter(30), fighter(70));
    expect(decideActionOrder(state, commands('priority', 'priority'), createRng(1)).value).toEqual(ENEMY_FIRST);
  });

  it('能力変化を反映した素早さで比べる', () => {
    // 45 の +1段階 = 56.25 は、50 より速い
    const state = battle(fighter(45, { speed: 1 }), fighter(50));
    expect(decideActionOrder(state, commands('normal', 'normal'), createRng(1)).value).toEqual(PLAYER_FIRST);
  });

  it('順番が決まるときは乱数を使わない', () => {
    const rng = createRng(1);
    expect(decideActionOrder(battle(fighter(60), fighter(40)), commands('normal', 'normal'), rng).rng).toBe(rng);
  });
});

describe('同じ素早さのとき', () => {
  const state = battle(fighter(50), fighter(50));

  it('シード付き乱数で決め、乱数を1回使う', () => {
    const rng = createRng(1);
    const result = decideActionOrder(state, commands('normal', 'normal'), rng);
    expect(result.rng).not.toBe(rng);
  });

  it('同じシードなら同じ順番になる', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const first = decideActionOrder(state, commands('normal', 'normal'), createRng(seed));
      const second = decideActionOrder(state, commands('normal', 'normal'), createRng(seed));
      expect(second).toEqual(first);
    }
  });

  it('シードによって、どちらが先にもなる', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      orders.add(decideActionOrder(state, commands('normal', 'normal'), createRng(seed)).value.join(','));
    }
    expect(orders).toEqual(new Set(['player,enemy', 'enemy,player']));
  });

  it('能力変化の小数の誤差があっても同速として扱う（100 の -2段階 = 64）', () => {
    const tied = battle(fighter(100, { speed: -2 }), fighter(64));
    const orders = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      orders.add(decideActionOrder(tied, commands('normal', 'normal'), createRng(seed)).value.join(','));
    }
    expect(orders.size).toBe(2);
  });
});

describe('不正なコマンド', () => {
  it('覚えていない技を選んだらエラー', () => {
    const state = battle(fighter(50), fighter(50));
    const invalid: Commands = { player: { type: 'move', moveId: 'unknown' }, enemy: { type: 'move', moveId: 'normal' } };
    expect(() => decideActionOrder(state, invalid, createRng(1))).toThrow('unknown');
  });
});
