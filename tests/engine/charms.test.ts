import { describe, expect, it } from 'vitest';
import { CHARMS, getCharm } from '../../src/data/charms';
import { createBattle, resolveTurn, submitReplacements } from '../../src/engine/battle';
import { movePower } from '../../src/engine/charms';
import { calcDamage } from '../../src/engine/damage';
import { createRng } from '../../src/engine/rng';
import { activeCombatant } from '../../src/engine/team';
import type { BattleEvent, BattleState, CharmEffect } from '../../src/engine/types';
import { deepFreeze, makeFighterDef, makeMove } from '../helpers/fixtures';

const SWIFT = getCharm('swift-charm').effect;
const RELAY = getCharm('relay-charm').effect;

// 紅のキャラに翠の技 → 等倍・共鳴なし
const NORMAL = makeMove({ id: 'normal', attribute: 'green', kind: 'normal', power: 60 });
const PRIORITY = makeMove({ id: 'priority', attribute: 'green', kind: 'priority', power: 35 });
const fighter = (id: string, hp = 100) => makeFighterDef({ id, moves: [NORMAL, PRIORITY], stats: { hp, speed: 50 } });

describe('お守りのデータ（M4 は仕様書 4.4 の例の2つ）', () => {
  it('先制技の威力 +20% と、交代したときにHP5%回復', () => {
    expect(CHARMS.map((charm) => charm.effect)).toEqual([
      { type: 'movePower', moveKind: 'priority', percent: 20 },
      { type: 'switchInHeal', percent: 5 },
    ]);
    expect(new Set(CHARMS.map((charm) => charm.id)).size).toBe(CHARMS.length);
    expect(() => getCharm('unknown')).toThrow('unknown');
  });
});

describe('先手のお守り：先制技の威力 +20%', () => {
  it('先制技だけ威力が上がる（切り捨て）。お守りがなければそのまま', () => {
    expect(movePower(PRIORITY, [SWIFT])).toBe(42);
    expect(movePower(makeMove({ kind: 'priority', power: 33 }), [SWIFT])).toBe(39);
    expect(movePower(NORMAL, [SWIFT])).toBe(60);
    expect(movePower(PRIORITY)).toBe(35);
    expect(movePower(PRIORITY, [RELAY])).toBe(35);
  });

  it('バトルでは、お守りを持つ陣営の先制技のダメージだけが増える', () => {
    const state = createBattle([fighter('p', 999)], [fighter('e', 999)], { playerCharms: [SWIFT] });
    const commands = {
      player: { type: 'move', moveId: 'priority' },
      enemy: { type: 'move', moveId: 'priority' },
    } as const;
    const { events } = resolveTurn(state, commands, createRng(1));
    const damages = events.filter((event) => event.type === 'damage');
    const toEnemy = damages.find((event) => event.side === 'enemy')!;
    const toPlayer = damages.find((event) => event.side === 'player')!;
    const range = (power: number) =>
      [90, 100].map((rollPercent) =>
        calcDamage({ power, attack: 50, defense: 50, affinity: 1, resonance: 1, rollPercent }),
      );
    const [enemyMin, enemyMax] = range(42);
    const [playerMin, playerMax] = range(35);
    expect(toEnemy.amount).toBeGreaterThanOrEqual(enemyMin!);
    expect(toEnemy.amount).toBeLessThanOrEqual(enemyMax!);
    expect(toPlayer.amount).toBeGreaterThanOrEqual(playerMin!);
    expect(toPlayer.amount).toBeLessThanOrEqual(playerMax!);
  });
});

describe('入れ替えのお守り：交代で場に出たキャラのHPを、最大HPの5%回復', () => {
  /** 自分は控え（HP 50/100）と交代、相手は通常の技 */
  function switchTurn(charms: readonly CharmEffect[], benchHp = 50): { state: BattleState; events: readonly BattleEvent[] } {
    const state = createBattle([fighter('a'), fighter('b')], [fighter('e', 999)], {
      playerHp: [100, benchHp],
      playerCharms: charms,
    });
    return resolveTurn(
      deepFreeze(state),
      { player: { type: 'switch', to: 1 }, enemy: { type: 'move', moveId: 'normal' } },
      createRng(1),
    );
  }

  it('交代コマンドで出たキャラが、交代の直後に回復する（相手の攻撃より前）', () => {
    const { events } = switchTurn([RELAY]);
    expect(events.slice(0, 2)).toEqual([
      { type: 'switched', side: 'player', from: 0, to: 1, reason: 'command' },
      { type: 'healed', side: 'player', amount: 5, hp: 55, source: 'charm' },
    ]);
  });

  it('最大HPは超えない。満タンなら何も起きない', () => {
    expect(switchTurn([RELAY], 98).events[1]).toEqual({ type: 'healed', side: 'player', amount: 2, hp: 100, source: 'charm' });
    expect(switchTurn([RELAY], 100).events.some((event) => event.type === 'healed')).toBe(false);
  });

  it('お守りがなければ回復しない', () => {
    expect(switchTurn([]).events.some((event) => event.type === 'healed')).toBe(false);
    expect(switchTurn([SWIFT]).events.some((event) => event.type === 'healed')).toBe(false);
  });

  it('倒れたあとに控えから出したときも回復する', () => {
    const weak = makeFighterDef({ id: 'weak', moves: [NORMAL], stats: { hp: 10, speed: 1 } });
    let state = createBattle([weak, fighter('b')], [fighter('e', 999)], { playerHp: [10, 40], playerCharms: [RELAY] });
    state = resolveTurn(state, { player: { type: 'move', moveId: 'normal' }, enemy: { type: 'move', moveId: 'normal' } }, createRng(1)).state;
    expect(state.awaitingReplacement).toEqual(['player']);
    const replaced = submitReplacements(state, { player: 1 });
    expect(replaced.events).toEqual([
      { type: 'switched', side: 'player', from: 0, to: 1, reason: 'replacement' },
      { type: 'healed', side: 'player', amount: 5, hp: 45, source: 'charm' },
    ]);
    expect(activeCombatant(replaced.state, 'player').hp).toBe(45);
  });
});
