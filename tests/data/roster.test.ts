import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_NAMES } from '../../src/data/attributes';
import { FIGHTERS } from '../../src/data/fighters';
import { MOVES, getMove } from '../../src/data/moves';
import { createCombatant } from '../../src/engine/battle';
import {
  ATTRIBUTE_ORDER,
  AREA_COUNT,
  MONOCHROME_ATTRIBUTES,
  AREA_STAT_MULTIPLIER,
  BATTLE_ENEMY_COUNT,
  DRAFT_CANDIDATE_COUNT,
  ELITE_ENEMY_COUNT,
  MAX_TEAM_SIZE,
  RUN_TEAM_SIZE,
} from '../../src/engine/constants';

describe('属性の表示名', () => {
  it('6属性すべてに表示名がある', () => {
    for (const attribute of ATTRIBUTE_ORDER) {
      expect(ATTRIBUTE_NAMES[attribute]).toBeTruthy();
    }
  });
});

describe('技のデータ（仕様書 3.6 の目安）', () => {
  const moves = Object.values(MOVES);

  it('ID も名前も重ならない', () => {
    expect(Object.keys(MOVES)).toHaveLength(moves.length);
    expect(new Set(moves.map((move) => move.name)).size).toBe(moves.length);
  });

  it('40個で、6色は属性ごとに6個（通常の技2つ・大技・先制技・補助技2つ）、白・黒は2個（通常の技・大技）ある（仕様書 7 の M5・M8）', () => {
    expect(moves).toHaveLength(40);
    for (const attribute of ATTRIBUTE_ORDER) {
      const kinds = moves.filter((move) => move.attribute === attribute).map((move) => move.kind);
      expect(kinds.sort()).toEqual(['big', 'normal', 'normal', 'priority', 'support', 'support']);
    }
    for (const attribute of MONOCHROME_ATTRIBUTES) {
      const kinds = moves.filter((move) => move.attribute === attribute).map((move) => move.kind);
      expect(kinds.sort()).toEqual(['big', 'normal']);
    }
  });

  it.each(moves)('$id の威力が目安の範囲（通常50〜70、大技90〜110、先制30〜40）', (move) => {
    expect(move.name).toBeTruthy();
    if (move.kind === 'support') {
      expect(move.effects.length).toBeGreaterThan(0);
      return;
    }
    const range = { normal: [50, 70], big: [90, 110], priority: [30, 40] }[move.kind];
    expect(move.power).toBeGreaterThanOrEqual(range[0]!);
    expect(move.power).toBeLessThanOrEqual(range[1]!);
  });

  it('存在しない技を取り出すとエラー', () => {
    expect(() => getMove('unknown')).toThrow('unknown');
  });
});

describe('キャラのデータ（仕様書 3.2 の目安）', () => {
  it('ID も名前も重ならない', () => {
    expect(new Set(FIGHTERS.map((fighter) => fighter.id)).size).toBe(FIGHTERS.length);
    expect(new Set(FIGHTERS.map((fighter) => fighter.name)).size).toBe(FIGHTERS.length);
  });

  it('名前は6文字まで（仕様書 5。狭い枠でも省略せずに出せる長さ）', () => {
    for (const fighter of FIGHTERS) {
      expect([...fighter.name].length, fighter.name).toBeLessThanOrEqual(6);
    }
  });

  it('14体で、6色は属性ごとに2体ずつ、白・黒は1体ずつ（カラスウサギ）いる（仕様書 7 の M5・M8）', () => {
    expect(FIGHTERS).toHaveLength(14);
    expect(FIGHTERS.map((fighter) => fighter.attribute).sort()).toEqual(
      [...ATTRIBUTE_ORDER, ...ATTRIBUTE_ORDER, ...MONOCHROME_ATTRIBUTES].sort(),
    );
  });

  it.each(FIGHTERS)('$name の能力値が目安の範囲（HP 80〜120、ほか 30〜70）で、戦闘に出せる', (fighter) => {
    expect(fighter.stats.hp).toBeGreaterThanOrEqual(80);
    expect(fighter.stats.hp).toBeLessThanOrEqual(120);
    for (const stat of [fighter.stats.attack, fighter.stats.defense, fighter.stats.speed]) {
      expect(stat).toBeGreaterThanOrEqual(30);
      expect(stat).toBeLessThanOrEqual(70);
    }
    // 技は 1〜4 個、重複なし、大技以外が1つ以上（createCombatant が検査する）
    expect(() => createCombatant(fighter)).not.toThrow();
  });
});

describe('ランに必要なキャラの数', () => {
  it('スタートの候補と、相手のチームを重ならないように選べるだけのキャラがいる', () => {
    expect(FIGHTERS.length).toBeGreaterThanOrEqual(DRAFT_CANDIDATE_COUNT);
    expect(DRAFT_CANDIDATE_COUNT).toBeGreaterThanOrEqual(RUN_TEAM_SIZE);
    // エリアごとの表が、エリアの数だけそろっている
    for (const table of [BATTLE_ENEMY_COUNT, ELITE_ENEMY_COUNT, AREA_STAT_MULTIPLIER]) {
      expect(table).toHaveLength(AREA_COUNT);
    }
    for (const count of [...BATTLE_ENEMY_COUNT.flat(), ...ELITE_ENEMY_COUNT]) {
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(Math.min(MAX_TEAM_SIZE, FIGHTERS.length));
    }
    expect(RUN_TEAM_SIZE).toBeLessThanOrEqual(MAX_TEAM_SIZE);
  });
});
