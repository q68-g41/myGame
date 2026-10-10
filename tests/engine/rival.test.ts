import { describe, expect, it } from 'vitest';
import { RUN_CONTENT } from '../../src/data/content';
import { FIGHTERS, getFighter } from '../../src/data/fighters';
import { IRODORITE } from '../../src/data/irodorite';
import { RIVAL } from '../../src/data/rival';
import {
  AREA_STAT_MULTIPLIER,
  ELITE_STAT_MULTIPLIER,
  RIVAL_AREA,
  RIVAL_CPU_LEVEL,
  RIVAL_REWARD_PICKS,
} from '../../src/engine/constants';
import { generateAreaMap, type AreaMap } from '../../src/engine/map';
import { createRng } from '../../src/engine/rng';
import { createRunBattle, enterNode, finishBattle, startRun, type RunContent, type RunState } from '../../src/engine/run';
import { deepFreeze } from '../helpers/fixtures';

describe('ライバルのマス（仕様書 4.6）', () => {
  it('ライバルと戦うエリアのマップは8層で、休憩とボスのあいだにライバルのマスが1つある', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const { layers } = generateAreaMap(createRng(seed), { rival: true }).value;
      expect(layers).toHaveLength(8);
      expect(layers.slice(5).map((layer) => layer.map((node) => node.kind))).toEqual([['rest'], ['rival'], ['boss']]);
      // 休憩 → ライバル → ボスの1本道
      expect(layers[5]![0]!.next).toEqual([0]);
      expect(layers[6]![0]!.next).toEqual([0]);
    }
  });

  it('ライバルの層を足しても、ほかの層は同じシードなら同じ（乱数の使い方が変わらない）', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const plain = generateAreaMap(createRng(seed)).value.layers;
      const withRival = generateAreaMap(createRng(seed), { rival: true });
      expect(withRival.value.layers.slice(0, 6)).toEqual(plain.slice(0, 6));
      expect(withRival.rng).toBe(generateAreaMap(createRng(seed)).rng);
    }
  });

  it('ライバルと戦うのはエリア2だけ（エリア1のマップにはない）。ライバルのデータがなければ、どのエリアにもない', () => {
    expect(RIVAL_AREA).toBe(1);
    const kinds = (run: RunState) => run.map.layers.flat().map((node) => node.kind);
    expect(kinds(startRun(RUN_CONTENT, 1))).not.toContain('rival');
    const noRival: RunContent = { ...RUN_CONTENT, rival: null };
    expect(kinds(startRun(noRival, 1))).not.toContain('rival');
  });
});

describe('ライバル・クロとの戦い（仕様書 4.6）', () => {
  /** エリア2で、休憩のあと（ライバルの手前）にいるラン */
  const beforeRival = (seed = 3): RunState => {
    const map: AreaMap = generateAreaMap(createRng(seed), { rival: true }).value;
    const base = startRun(RUN_CONTENT, seed, IRODORITE[0]!);
    const team = [IRODORITE[0]!.partner, FIGHTERS[0]!, FIGHTERS[1]!].map((fighter) => ({ fighter, hp: fighter.stats.hp }));
    return { ...base, area: RIVAL_AREA, map, team, position: { layer: 5, index: 0 }, phase: { kind: 'map' } };
  };

  it('クロのデータ：相棒はカラスウサギ2体で、ふつうのキャラから1体足す。あだ名と口ぐせは仕様書の表のとおり', () => {
    expect(RIVAL.partners.map((fighter) => fighter.id)).toEqual(['white-twin', 'black-twin']);
    expect(RIVAL.extraCount).toBe(1);
    expect(RIVAL).toMatchObject({ id: 'kuro', name: 'クロ', catchphrase: '結局ちょっとずつチマチマ' });
    expect(RUN_CONTENT.rival).toBe(RIVAL);
  });

  it('マスに入ると、カラスウサギ2体と、ふつうのキャラ1体のチームが、強敵と同じ倍率で強くなって出る。CPU は段階3', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const run = enterNode(deepFreeze(beforeRival(seed)), 0, RUN_CONTENT);
      if (run.phase.kind !== 'battle') {
        throw new Error('戦闘の段階のはず');
      }
      const { enemy } = run.phase;
      expect(enemy.map((fighter) => fighter.id).slice(0, 2)).toEqual(['white-twin', 'black-twin']);
      expect(enemy).toHaveLength(3);
      expect(FIGHTERS.map((fighter) => fighter.id)).toContain(enemy[2]!.id);
      const multiplier = AREA_STAT_MULTIPLIER[RIVAL_AREA]! * ELITE_STAT_MULTIPLIER;
      for (const fighter of enemy) {
        const base = getFighter(fighter.id).stats;
        expect(fighter.stats).toEqual({
          hp: Math.round(base.hp * multiplier),
          attack: Math.round(base.attack * multiplier),
          defense: Math.round(base.defense * multiplier),
          speed: base.speed,
        });
      }
      expect(run.phase.cpu).toBe(RIVAL_CPU_LEVEL);
      expect(run.phase.boss).toBeNull();
    }
  });

  it('勝つと報酬を2回選ぶ（強敵と同じ）', () => {
    const run = enterNode(beforeRival(), 0, RUN_CONTENT);
    const battle = { ...createRunBattle(run), winner: 'player' as const };
    expect(finishBattle(run, battle, RUN_CONTENT).phase).toMatchObject({ kind: 'reward', pick: 1, picks: RIVAL_REWARD_PICKS });
    expect(RIVAL_REWARD_PICKS).toBe(2);
  });

  it('ライバルのデータがないのにライバルのマスに入るとエラー', () => {
    expect(() => enterNode(beforeRival(), 0, { ...RUN_CONTENT, rival: null })).toThrow('ライバル');
  });
});
