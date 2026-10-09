import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_NAMES } from '../../src/data/attributes';
import { CHARMS, describeCharmEffect, getCharm } from '../../src/data/charms';
import { createBattle, resolveTurn, submitReplacements } from '../../src/engine/battle';
import { bigMoveCooldown, healAmount, movePower } from '../../src/engine/charms';
import { ATTRIBUTE_ORDER } from '../../src/engine/constants';
import { calcDamage, computeDamage } from '../../src/engine/damage';
import { createRng } from '../../src/engine/rng';
import { activeCombatant } from '../../src/engine/team';
import type { BattleEvent, BattleState, CharmEffect, Commands } from '../../src/engine/types';
import { deepFreeze, makeCombatant, makeFighterDef, makeMove, makeSupportMove } from '../helpers/fixtures';

const SWIFT = getCharm('swift-charm').effect;
const RELAY = getCharm('relay-charm').effect;

// 紅のキャラに翠の技 → 等倍・共鳴なし
const NORMAL = makeMove({ id: 'normal', attribute: 'green', kind: 'normal', power: 60 });
const PRIORITY = makeMove({ id: 'priority', attribute: 'green', kind: 'priority', power: 35 });
const BIG = makeMove({ id: 'big', attribute: 'green', kind: 'big', power: 100 });
const WAIT = makeSupportMove({ id: 'wait', effects: [{ type: 'stat', target: 'self', stat: 'defense', stages: 1 }] });
const MEND = makeSupportMove({ id: 'mend', effects: [{ type: 'heal', percent: 30 }] });
const CORRODE = makeSupportMove({ id: 'corrode', effects: [{ type: 'status', status: 'erosion' }] });
const fighter = (id: string, hp = 100) =>
  makeFighterDef({ id, moves: [NORMAL, PRIORITY, BIG, WAIT], stats: { hp, speed: 50 } });
const use = (player: string, enemy: string): Commands => ({
  player: { type: 'move', moveId: player },
  enemy: { type: 'move', moveId: enemy },
});

describe('お守りのデータ（仕様書 4.4）', () => {
  it('20個あり、ID も名前も重ならず、説明がある', () => {
    expect(CHARMS).toHaveLength(20);
    expect(new Set(CHARMS.map((charm) => charm.id)).size).toBe(CHARMS.length);
    expect(new Set(CHARMS.map((charm) => charm.name)).size).toBe(CHARMS.length);
    for (const charm of CHARMS) {
      expect(charm.description).toBe(describeCharmEffect(charm.effect));
    }
    expect(() => getCharm('unknown')).toThrow('unknown');
  });

  it('効果の種類はすべて、どれかのお守りで使っている', () => {
    expect(new Set(CHARMS.map((charm) => charm.effect.type))).toEqual(
      new Set([
        'movePower',
        'attributePower',
        'lowHpPower',
        'damageCut',
        'switchInHeal',
        'turnEndHeal',
        'statusGuard',
        'healPower',
        'cooldownCut',
        'victoryHeal',
        'restHeal',
      ]),
    );
  });

  it('属性のお守りは属性ごとに1つで、名前は属性の表示名から作る', () => {
    for (const attribute of ATTRIBUTE_ORDER) {
      const charm = CHARMS.find((c) => c.effect.type === 'attributePower' && c.effect.attribute === attribute);
      expect(charm?.name).toBe(`${ATTRIBUTE_NAMES[attribute]}のお守り`);
    }
  });

  it('説明文は効果の数値から作る', () => {
    expect(describeCharmEffect({ type: 'movePower', moveKind: 'priority', percent: 20 })).toBe('先制技の威力 +20%');
    expect(describeCharmEffect({ type: 'switchInHeal', percent: 5 })).toBe('交代で場に出たキャラのHPを 最大HPの5% 回復');
    expect(describeCharmEffect({ type: 'attributePower', attribute: 'blue', percent: 15 })).toBe('蒼属性の技の威力 +15%');
    expect(describeCharmEffect({ type: 'damageCut', against: 'advantage', percent: 20 })).toBe(
      '相手の技が有利な相性のとき、受けるダメージ -20%',
    );
    expect(describeCharmEffect({ type: 'damageCut', against: 'big', percent: 25 })).toBe('大技で受けるダメージ -25%');
    expect(describeCharmEffect({ type: 'statusGuard', status: 'slow' })).toBe('鈍化にならない');
    expect(describeCharmEffect({ type: 'restHeal', percent: 20 })).toBe('休憩で回復する量が 最大HPの30% → 50% になる');
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

describe('威力を上げるお守り（属性・HPが少ないとき）', () => {
  const GREEN: CharmEffect = { type: 'attributePower', attribute: 'green', percent: 15 };
  const LOW_HP: CharmEffect = { type: 'lowHpPower', hpPercent: 30, percent: 30 };

  it('属性：その属性の技だけ上がる。ほかのお守りと重なるときは、割合を足してから掛ける', () => {
    expect(movePower(NORMAL, [GREEN])).toBe(69);
    expect(movePower(makeMove({ attribute: 'crimson', power: 60 }), [GREEN])).toBe(60);
    // 35 × (100 + 20 + 15)% = 47.25 → 47
    expect(movePower(PRIORITY, [SWIFT, GREEN])).toBe(47);
  });

  it('HPが少ないとき：使うキャラのHPが最大HPの30%以下なら、攻撃技が +30%', () => {
    expect(movePower(NORMAL, [LOW_HP], makeCombatant({ hp: 30 }))).toBe(78);
    expect(movePower(NORMAL, [LOW_HP], makeCombatant({ hp: 31 }))).toBe(60);
    // キャラを渡さなければ、HPの条件は見ない
    expect(movePower(NORMAL, [LOW_HP])).toBe(60);
    // ダメージにも反映される（威力78・攻撃=防御・等倍・乱数1.00 → 39）
    expect(computeDamage(makeCombatant({ hp: 30 }), makeCombatant(), NORMAL, 100, [LOW_HP]).amount).toBe(39);
  });
});

describe('受けるダメージを減らすお守り', () => {
  const PARRY: CharmEffect = { type: 'damageCut', against: 'advantage', percent: 20 };
  const BULWARK: CharmEffect = { type: 'damageCut', against: 'big', percent: 25 };
  const attacker = makeCombatant();
  const defender = makeCombatant(); // 紅
  const damage = (move: Parameters<typeof computeDamage>[2], charms: readonly CharmEffect[]) =>
    computeDamage(attacker, defender, move, 100, [], charms).amount;
  const blue = (overrides = {}) => makeMove({ attribute: 'blue', power: 60, ...overrides }); // 紅に有利（×1.5）

  it('相手の技が有利な相性のときだけ減る（ダメージ式の結果に掛けて切り捨て）', () => {
    expect(damage(blue(), [])).toBe(45);
    expect(damage(blue(), [PARRY])).toBe(36);
    expect(damage(NORMAL, [PARRY])).toBe(30);
  });

  it('大技：大技を受けたときだけ減る。両方当てはまれば割合を足す。最低1', () => {
    expect(damage(BIG, [BULWARK])).toBe(37);
    expect(damage(NORMAL, [BULWARK])).toBe(30);
    // 75 × (100 − 45)% = 41.25 → 41
    expect(damage(blue({ kind: 'big', power: 100 }), [PARRY, BULWARK])).toBe(41);
    expect(damage(makeMove({ attribute: 'green', power: 1 }), [PARRY, BULWARK, BULWARK])).toBe(1);
  });

  it('バトルでは、受ける側の陣営のお守りで減る（攻める側のお守りではない）', () => {
    const blueFighter = (id: string) => makeFighterDef({ id, moves: [blue()], stats: { hp: 999 } });
    const state = createBattle([blueFighter('p')], [blueFighter('e')], { playerCharms: [PARRY] });
    const { events } = resolveTurn(state, use('test-move', 'test-move'), createRng(1));
    const damageTo = (side: 'player' | 'enemy') =>
      events.flatMap((event) => (event.type === 'damage' && event.side === side ? [event.amount] : []))[0];
    // 乱数 0.90〜1.00 で、お守りなしは 40〜45、お守りありは 32〜36
    expect(damageTo('enemy')).toBeGreaterThanOrEqual(40);
    expect(damageTo('player')).toBeLessThanOrEqual(36);
  });
});

describe('ターンの終わりに回復するお守り', () => {
  const BREATH: CharmEffect = { type: 'turnEndHeal', percent: 4 };

  it('技のあと、ターンの終わりに場のキャラが最大HPの4%回復する。お守りのない陣営は回復しない', () => {
    const state = createBattle([fighter('p')], [fighter('e')], { playerHp: [50], playerCharms: [BREATH] });
    const { state: next, events } = resolveTurn(deepFreeze(state), use('normal', 'normal'), createRng(1));
    const hit = events.find((event) => event.type === 'damage' && event.side === 'player');
    const healed = events.filter((event) => event.type === 'healed');
    expect(healed).toEqual([
      { type: 'healed', side: 'player', amount: 4, hp: (hit?.type === 'damage' ? hit.hp : 0) + 4, source: 'charm' },
    ]);
    expect(events.indexOf(healed[0]!)).toBeGreaterThan(events.indexOf(hit!));
    expect(activeCombatant(next, 'player').hp).toBe(healed[0]?.type === 'healed' ? healed[0].hp : -1);
  });

  it('HPが満タンなら何も起きない。侵蝕で倒れたキャラは回復しない', () => {
    const full = createBattle([fighter('p')], [fighter('e')], { playerCharms: [BREATH] });
    expect(resolveTurn(full, use('wait', 'wait'), createRng(1)).events.some((e) => e.type === 'healed')).toBe(false);

    const start = createBattle([fighter('p'), fighter('b')], [fighter('e')], { playerHp: [5, 100], playerCharms: [BREATH] });
    const eroded: BattleState = {
      ...start,
      sides: {
        ...start.sides,
        player: {
          ...start.sides.player,
          team: [{ ...start.sides.player.team[0]!, status: { id: 'erosion', remaining: 3 } }, start.sides.player.team[1]!],
        },
      },
    };
    const { events } = resolveTurn(eroded, use('wait', 'wait'), createRng(1));
    expect(events.some((event) => event.type === 'fainted' && event.side === 'player')).toBe(true);
    expect(events.some((event) => event.type === 'healed')).toBe(false);
  });
});

describe('状態異常を防ぐお守り', () => {
  const PURIFY: CharmEffect = { type: 'statusGuard', status: 'erosion' };
  const NIMBLE: CharmEffect = { type: 'statusGuard', status: 'slow' };
  const corroder = makeFighterDef({ id: 'e', moves: [CORRODE, WAIT] });

  it('お守りの状態異常にはならない（お守りで防いだ、と分かるイベント）', () => {
    const state = createBattle([fighter('p')], [corroder], { playerCharms: [PURIFY] });
    const { state: next, events } = resolveTurn(state, use('wait', 'corrode'), createRng(1));
    expect(events).toContainEqual({ type: 'statusBlocked', side: 'player', status: 'erosion', reason: 'charm' });
    expect(activeCombatant(next, 'player').status).toBeNull();
  });

  it('ほかの状態異常は防がない', () => {
    const state = createBattle([fighter('p')], [corroder], { playerCharms: [NIMBLE] });
    const { state: next, events } = resolveTurn(state, use('wait', 'corrode'), createRng(1));
    expect(events).toContainEqual({ type: 'statusApplied', side: 'player', status: 'erosion' });
    expect(activeCombatant(next, 'player').status).toEqual({ id: 'erosion', remaining: 2 });
  });
});

describe('回復技の回復量を増やすお守り', () => {
  const REMEDY: CharmEffect = { type: 'healPower', percent: 50 };

  it('最大HPの割合をお守りの分だけ増やす（切り捨て、最低1）', () => {
    expect(healAmount(100, 30, [REMEDY])).toBe(45);
    expect(healAmount(95, 30, [REMEDY])).toBe(42);
    expect(healAmount(95, 30)).toBe(28);
    expect(healAmount(1, 30, [REMEDY])).toBe(1);
  });

  it('バトルで回復技を使うと、増えた量だけ回復する（お守りの回復には効かない）', () => {
    const healer = makeFighterDef({ id: 'p', moves: [MEND, WAIT] });
    const state = createBattle([healer], [fighter('e')], { playerHp: [10], playerCharms: [REMEDY] });
    const { events } = resolveTurn(state, use('mend', 'wait'), createRng(1));
    expect(events).toContainEqual({ type: 'healed', side: 'player', amount: 45, hp: 55 });
  });
});

describe('大技を早く使えるお守り', () => {
  const SPIRIT: CharmEffect = { type: 'cooldownCut', turns: 1 };

  it('使えないターン数が減る（0 より小さくならない）', () => {
    expect(bigMoveCooldown()).toBe(2);
    expect(bigMoveCooldown([SPIRIT])).toBe(1);
    expect(bigMoveCooldown([SPIRIT, SPIRIT, SPIRIT])).toBe(0);
  });

  it('Nターン目に大技を使ったら、N+1ターン目だけ選べず、N+2ターン目から選べる', () => {
    const state = createBattle([fighter('p', 999)], [fighter('e', 999)], { playerCharms: [SPIRIT] });
    const turn1 = resolveTurn(state, use('big', 'big'), createRng(1)).state;
    expect(activeCombatant(turn1, 'player').cooldowns).toEqual({ big: 1 });
    expect(activeCombatant(turn1, 'enemy').cooldowns).toEqual({ big: 2 });
    const turn2 = resolveTurn(turn1, use('wait', 'wait'), createRng(2)).state;
    expect(activeCombatant(turn2, 'player').cooldowns).toEqual({});
  });

  it('使えないターンが 0 になるなら、続けて使える', () => {
    const state = createBattle([fighter('p', 999)], [fighter('e', 999)], { playerCharms: [SPIRIT, SPIRIT] });
    const turn1 = resolveTurn(state, use('big', 'wait'), createRng(1)).state;
    expect(activeCombatant(turn1, 'player').cooldowns).toEqual({});
  });
});
