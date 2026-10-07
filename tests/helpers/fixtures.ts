import type { AttributeId, Combatant, MoveDef, Stats } from '../../src/engine/types';

/** テスト用の技 */
export function makeMove(overrides: Partial<MoveDef> = {}): MoveDef {
  return {
    id: 'test-move',
    attribute: 'crimson',
    kind: 'normal',
    power: 60,
    ...overrides,
  };
}

/** テスト用の戦闘中キャラ。能力値はすべて 50、能力変化なし */
export function makeCombatant(
  overrides: Partial<Omit<Combatant, 'stats'>> & { stats?: Partial<Stats>; attribute?: AttributeId } = {},
): Combatant {
  const stats: Stats = { hp: 100, attack: 50, defense: 50, speed: 50, ...overrides.stats };
  return {
    id: 'test-fighter',
    attribute: 'crimson',
    moves: [makeMove()],
    hp: stats.hp,
    stages: { attack: 0, defense: 0, speed: 0 },
    cooldowns: {},
    ...overrides,
    stats,
  };
}
