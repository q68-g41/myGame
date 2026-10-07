import type { AttackMoveDef, AttributeId, Combatant, FighterDef, Stats, SupportMoveDef } from '../../src/engine/types';

/** テスト用のキャラ定義。能力値はすべて 50 */
export function makeFighterDef(
  overrides: Partial<Omit<FighterDef, 'stats'>> & { stats?: Partial<Stats> } = {},
): FighterDef {
  return {
    id: 'test-fighter',
    attribute: 'crimson',
    moves: [makeMove()],
    ...overrides,
    stats: { hp: 100, attack: 50, defense: 50, speed: 50, ...overrides.stats },
  };
}

/** オブジェクトを中まで凍結する（書き換えようとするとエラーになる） */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/** テスト用の攻撃技 */
export function makeMove(overrides: Partial<AttackMoveDef> = {}): AttackMoveDef {
  return {
    id: 'test-move',
    attribute: 'crimson',
    kind: 'normal',
    power: 60,
    ...overrides,
  };
}

/** テスト用の補助技 */
export function makeSupportMove(overrides: Partial<Omit<SupportMoveDef, 'kind'>> = {}): SupportMoveDef {
  return {
    id: 'test-support',
    attribute: 'crimson',
    effects: [{ type: 'stat', target: 'self', stat: 'attack', stages: 1 }],
    ...overrides,
    kind: 'support',
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
    status: null,
    ...overrides,
    stats,
  };
}
