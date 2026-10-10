import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_NAMES } from '../../src/data/attributes';
import { RUN_CONTENT } from '../../src/data/content';
import { BOSS_FIGHTERS, FIGHTERS, PARTNER_FIGHTERS } from '../../src/data/fighters';
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
  const all = [...FIGHTERS, ...PARTNER_FIGHTERS, ...BOSS_FIGHTERS];

  it('ID も名前も重ならない（ふつうのキャラ・相棒・ボスをまとめて）', () => {
    expect(new Set(all.map((fighter) => fighter.id)).size).toBe(all.length);
    expect(new Set(all.map((fighter) => fighter.name)).size).toBe(all.length);
  });

  it('どのキャラ（相棒・ボスも）にも説明があり、24文字まで（詳細の絵の横に2行で収まる長さ）', () => {
    for (const fighter of all) {
      expect(fighter.description, fighter.id).toBeTruthy();
      expect([...fighter.description].length, fighter.description).toBeLessThanOrEqual(24);
    }
  });

  it('名前は6文字まで（仕様書 5。狭い枠でも省略せずに出せる長さ）', () => {
    for (const fighter of [...FIGHTERS, ...PARTNER_FIGHTERS]) {
      expect([...fighter.name].length, fighter.name).toBeLessThanOrEqual(6);
    }
  });

  it('ふつうのキャラは12体で、6色が属性ごとに2体ずついる（仕様書 7 の M5）', () => {
    expect(FIGHTERS).toHaveLength(12);
    expect(FIGHTERS.map((fighter) => fighter.attribute).sort()).toEqual([...ATTRIBUTE_ORDER, ...ATTRIBUTE_ORDER].sort());
  });

  it.each([...FIGHTERS, ...PARTNER_FIGHTERS])('$name の能力値が目安の範囲（HP 80〜120、ほか 30〜70）で、戦闘に出せる', (fighter) => {
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

describe('彩り手の相棒（仕様書 4.6）', () => {
  it('カラスウサギ2体と、最初の彩り手3人（ヒナ・ワタ・ソウ）の相棒がいる', () => {
    expect(PARTNER_FIGHTERS.map((fighter) => fighter.id)).toEqual([
      'white-twin',
      'black-twin',
      'hina-partner',
      'wata-partner',
      'sou-partner',
    ]);
  });

  it('相棒は、スタートの候補・スカウト・ふつうの相手に出ない（ランのキャラに入らない）', () => {
    const ids = RUN_CONTENT.fighters.map((fighter) => fighter.id);
    for (const partner of PARTNER_FIGHTERS) {
      expect(ids, partner.id).not.toContain(partner.id);
    }
    expect(RUN_CONTENT.fighters).toBe(FIGHTERS);
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

describe('白・黒の技はカラスウサギ専用（仕様書 3.6）', () => {
  it('報酬で覚えられる技には、白・黒の技が入らない（6色の36個だけ）', () => {
    expect(RUN_CONTENT.moves).toHaveLength(36);
    for (const move of RUN_CONTENT.moves) {
      expect(MONOCHROME_ATTRIBUTES, move.id).not.toContain(move.attribute);
    }
  });

  it('カラスウサギ2体は、はじめから自分の属性の技を覚えている', () => {
    for (const attribute of MONOCHROME_ATTRIBUTES) {
      const twins = PARTNER_FIGHTERS.filter((fighter) => fighter.attribute === attribute);
      expect(twins).toHaveLength(1);
      expect(twins[0]!.moves.filter((move) => move.attribute === attribute).map((move) => move.kind).sort()).toEqual([
        'big',
        'normal',
      ]);
    }
  });

  it('白・黒の技を覚えているのは、カラスウサギ2体だけ', () => {
    const users = [...FIGHTERS, ...PARTNER_FIGHTERS, ...BOSS_FIGHTERS].filter((fighter) =>
      fighter.moves.some((move) => MONOCHROME_ATTRIBUTES.includes(move.attribute)),
    );
    expect(users.map((fighter) => fighter.id).sort()).toEqual(['black-twin', 'white-twin']);
  });
});
