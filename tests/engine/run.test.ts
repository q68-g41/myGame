import { describe, expect, it } from 'vitest';
import { getCharm } from '../../src/data/charms';
import { RUN_CONTENT } from '../../src/data/content';
import { FIGHTERS } from '../../src/data/fighters';
import { createBattle, resolveTurn } from '../../src/engine/battle';
import {
  AREA_STAT_MULTIPLIER,
  BATTLE_ENEMY_COUNT,
  DRAFT_CANDIDATE_COUNT,
  ELITE_ENEMY_COUNT,
  ELITE_STAT_MULTIPLIER,
} from '../../src/engine/constants';
import type { AreaMap, MapPosition } from '../../src/engine/map';
import { createRng } from '../../src/engine/rng';
import {
  chooseTeam,
  createRunBattle,
  enterNode,
  finishBattle,
  nodeEnemies,
  runChoices,
  startRun,
  swapTeamOrder,
  type RunContent,
  type RunMember,
  type RunState,
} from '../../src/engine/run';
import type { BattleState, FighterDef } from '../../src/engine/types';
import { deepFreeze } from '../helpers/fixtures';
import { withEnemies } from '../helpers/run';

const CONTENT: RunContent = RUN_CONTENT;

/** テスト用のマップ（生成の決まりとは関係なく、マスの種類ごとの動きを確かめる） */
const TEST_MAP: AreaMap = {
  layers: [
    [
      { kind: 'battle', next: [0] },
      { kind: 'battle', next: [0, 1] },
    ],
    [
      { kind: 'elite', next: [0] },
      { kind: 'event', next: [0] },
    ],
    [{ kind: 'scout', next: [0] }],
    [{ kind: 'battle', next: [0] }],
    [{ kind: 'battle', next: [0] }],
    [{ kind: 'rest', next: [0] }],
    [{ kind: 'boss', next: [] }],
  ],
};

const member = (fighter: FighterDef, hp = fighter.stats.hp): RunMember => ({ fighter, hp });

/** マップの段階のランを作る */
function runAt(position: MapPosition | null, team: readonly RunMember[] = FIGHTERS.slice(0, 3).map((f) => member(f))): RunState {
  return withEnemies({ area: 0, map: TEST_MAP, position, team, charms: [], irodorite: null, phase: { kind: 'map' }, rng: createRng(3) });
}

/** プレイヤーの HP を決めて、決着したバトルを作る */
function decided(run: RunState, playerHp: readonly number[], winner: 'player' | 'enemy'): BattleState {
  const battle = createRunBattle(run);
  const team = battle.sides.player.team.map((combatant, index) => ({ ...combatant, hp: playerHp[index]! }));
  return { ...battle, sides: { ...battle.sides, player: { ...battle.sides.player, team } }, winner };
}

describe('ランを始める（4.1）', () => {
  it('マップを作り、キャラの中から重ならないように候補を5体出す', () => {
    const run = startRun(CONTENT, 1);
    expect(run.map.layers).toHaveLength(7);
    expect(run.position).toBeNull();
    expect(run.team).toEqual([]);
    if (run.phase.kind !== 'draft') {
      throw new Error('チームを選ぶ段階のはず');
    }
    expect(run.phase.candidates).toHaveLength(DRAFT_CANDIDATE_COUNT);
    expect(new Set(run.phase.candidates.map((fighter) => fighter.id)).size).toBe(DRAFT_CANDIDATE_COUNT);
  });

  it('同じシードなら同じラン', () => {
    expect(startRun(CONTENT, 9)).toEqual(startRun(CONTENT, 9));
    expect(startRun(CONTENT, 9)).not.toEqual(startRun(CONTENT, 10));
  });

  it('候補から3体を選ぶと、選んだ順にチームになり、HPは満タンでマップへ進む', () => {
    const run = startRun(CONTENT, 1);
    const candidates = run.phase.kind === 'draft' ? run.phase.candidates : [];
    const chosen = chooseTeam(deepFreeze(run), [4, 0, 2]);
    expect(chosen.team.map((m) => m.fighter.id)).toEqual([4, 0, 2].map((i) => candidates[i]!.id));
    expect(chosen.team.every((m) => m.hp === m.fighter.stats.hp)).toBe(true);
    expect(chosen.phase).toEqual({ kind: 'map' });
  });

  it('3体ちょうど、違うキャラを、候補の中から選ぶ', () => {
    const run = startRun(CONTENT, 1);
    expect(() => chooseTeam(run, [0, 1])).toThrow('3 体選んで');
    expect(() => chooseTeam(run, [0, 1, 2, 3])).toThrow('3 体選んで');
    expect(() => chooseTeam(run, [0, 0, 1])).toThrow('3 体選んで');
    expect(() => chooseTeam(run, [0, 1, 5])).toThrow('いません');
    expect(() => chooseTeam(chooseTeam(run, [0, 1, 2]), [0, 1, 2])).toThrow('チームを選ぶ段階ではありません');
  });
});

describe('チームの並び順を変える（4.1）', () => {
  const team = [member(FIGHTERS[0]!, 10), member(FIGHTERS[1]!, 20), member(FIGHTERS[2]!, 30)];

  it('マップで次のマスを選ぶときに、2体の位置を入れ替えられる。HPはキャラについていく', () => {
    const run = deepFreeze(runAt({ layer: 2, index: 0 }, team));
    const swapped = swapTeamOrder(run, 0, 2);
    expect(swapped.team).toEqual([team[2], team[1], team[0]]);
    // 入れ替えたあとの戦闘は、新しい先頭から出る
    expect(createRunBattle({ ...swapped, phase: { kind: 'battle', enemy: [FIGHTERS[5]!], seed: 1, cpu: 1, boss: null } }).sides.player.team[0]?.id).toBe(FIGHTERS[2]!.id);
    // ほかは変わらない
    expect({ ...swapped, team: run.team }).toEqual(run);
  });

  it('マップ以外の段階や、同じ位置・いない位置ではエラー', () => {
    expect(() => swapTeamOrder(runAt(null, team), 1, 1)).toThrow('違う2体');
    expect(() => swapTeamOrder(runAt(null, team), 0, 3)).toThrow('違う2体');
    const draft = startRun(CONTENT, 1);
    expect(() => swapTeamOrder(draft, 0, 1)).toThrow('マップで次のマスを選ぶとき');
  });
});

describe('マップを進む', () => {
  it('最初は1層目のどれか、そのあとはつながっているマスへ進める', () => {
    expect(runChoices(runAt(null))).toEqual([0, 1]);
    expect(runChoices(runAt({ layer: 0, index: 1 }))).toEqual([0, 1]);
    expect(runChoices(runAt({ layer: 1, index: 0 }))).toEqual([0]);
  });

  it('つながっていないマスには進めない', () => {
    expect(() => enterNode(runAt({ layer: 0, index: 0 }), 1, CONTENT)).toThrow('進めません');
    expect(() => enterNode(runAt(null), 2, CONTENT)).toThrow('進めません');
  });

  it('戦闘マスに入ると、層ごとの人数の相手が決まり、戦闘になる（相手の能力はそのまま）', () => {
    const run = enterNode(deepFreeze(runAt(null)), 1, CONTENT);
    expect(run.position).toEqual({ layer: 0, index: 1 });
    if (run.phase.kind !== 'battle') {
      throw new Error('戦闘の段階のはず');
    }
    expect(run.phase.enemy).toHaveLength(BATTLE_ENEMY_COUNT[0]![0]!);
    for (const enemy of run.phase.enemy) {
      expect(FIGHTERS.find((fighter) => fighter.id === enemy.id)!.stats).toEqual(enemy.stats);
    }
    expect(runChoices(run)).toEqual([]);
  });

  it('強敵マスは人数が多く、HP・攻撃・防御が強い（素早さはそのまま）', () => {
    const run = enterNode(runAt({ layer: 0, index: 0 }), 0, CONTENT);
    if (run.phase.kind !== 'battle') {
      throw new Error('戦闘の段階のはず');
    }
    expect(run.phase.enemy).toHaveLength(ELITE_ENEMY_COUNT[0]!);
    for (const enemy of run.phase.enemy) {
      const base = FIGHTERS.find((fighter) => fighter.id === enemy.id)!.stats;
      expect(enemy.stats).toEqual({
        hp: Math.round(base.hp * ELITE_STAT_MULTIPLIER),
        attack: Math.round(base.attack * ELITE_STAT_MULTIPLIER),
        defense: Math.round(base.defense * ELITE_STAT_MULTIPLIER),
        speed: base.speed,
      });
    }
  });

  it('ボスのマスでは、そのエリアのボスが1体で出て、行動パターンで動く', () => {
    for (const area of [0, 1, 2]) {
      const run = enterNode({ ...runAt({ layer: 5, index: 0 }), area }, 0, CONTENT);
      if (run.phase.kind !== 'battle') {
        throw new Error('戦闘の段階のはず');
      }
      const boss = CONTENT.bosses[area]!;
      expect(run.phase.enemy).toEqual([boss.fighter]);
      expect(run.phase.boss).toEqual(boss.pattern);
    }
    // ボス以外の戦闘には、行動パターンはない
    expect(enterNode(runAt(null), 0, CONTENT).phase).toMatchObject({ kind: 'battle', boss: null });
  });

  it('休憩・スカウト・イベントのマスに入ると、それぞれの段階になる（チームはそのまま）', () => {
    const cases = [
      { from: { layer: 0, index: 1 }, to: 1, kind: 'event' },
      { from: { layer: 1, index: 0 }, to: 0, kind: 'scout' },
      { from: { layer: 4, index: 0 }, to: 0, kind: 'rest' },
    ] as const;
    for (const { from, to, kind } of cases) {
      const before = runAt(from);
      const run = enterNode(before, to, CONTENT);
      expect(run.position).toEqual({ layer: from.layer + 1, index: to });
      expect(run.phase.kind).toBe(kind);
      expect(run.team).toEqual(before.team);
      expect(runChoices(run)).toEqual([]);
    }
  });

  it('同じ状態から同じマスに入れば、相手もバトルのシードも同じ', () => {
    expect(enterNode(runAt(null), 0, CONTENT)).toEqual(enterNode(runAt(null), 0, CONTENT));
  });
});

describe('マップの相手（4.3）', () => {
  const run = startRun(CONTENT, 21);

  it('ランを始めると、エリア1の戦闘・強敵のマスの相手がもう決まっている（休憩・スカウト・イベント・ボスは null）', () => {
    expect(run.enemies.map((layer) => layer.length)).toEqual(run.map.layers.map((layer) => layer.length));
    run.map.layers.forEach((layer, l) =>
      layer.forEach((node, index) => {
        const enemy = nodeEnemies(run, { layer: l, index });
        if (node.kind === 'battle') {
          expect(enemy).toHaveLength(BATTLE_ENEMY_COUNT[0]![l]!);
        } else if (node.kind === 'elite') {
          expect(enemy).toHaveLength(ELITE_ENEMY_COUNT[0]!);
        } else {
          expect(enemy, node.kind).toBeNull();
        }
      }),
    );
  });

  it('マスに入ると、決めておいた相手と戦う（マップで見えていた相手と同じ）', () => {
    const chosen = chooseTeam(run, [0, 1, 2]);
    for (const index of runChoices(chosen)) {
      const entered = enterNode(chosen, index, CONTENT);
      expect(entered.phase.kind).toBe('battle');
      expect(entered.phase.kind === 'battle' ? entered.phase.enemy : null).toEqual(nodeEnemies(chosen, { layer: 0, index }));
    }
  });

  it('同じシードなら、同じ相手', () => {
    expect(startRun(CONTENT, 21).enemies).toEqual(run.enemies);
    expect(startRun(CONTENT, 22).enemies).not.toEqual(run.enemies);
  });
});

describe('戦闘とHPの持ち越し', () => {
  const team = [member(FIGHTERS[0]!, 40), member(FIGHTERS[1]!), member(FIGHTERS[2]!, 7)];
  const inBattle = () => enterNode(runAt(null, team), 0, CONTENT);

  it('バトルは、チームの並び順のまま、持ち越したHPで始まる', () => {
    const battle = createRunBattle(inBattle());
    expect(battle.sides.player.team.map((c) => c.id)).toEqual(team.map((m) => m.fighter.id));
    expect(battle.sides.player.team.map((c) => c.hp)).toEqual([40, FIGHTERS[1]!.stats.hp, 7]);
    expect(battle.sides.player.active).toBe(0);
  });

  it('勝ったら、残ったHPを持ち越して報酬を選ぶ（1回）', () => {
    const run = inBattle();
    const next = finishBattle(deepFreeze(run), decided(run, [12, 80, 7], 'player'), CONTENT);
    expect(next.team.map((m) => m.hp)).toEqual([12, 80, 7]);
    expect(next.phase).toMatchObject({ kind: 'reward', pick: 1, picks: 1 });
    expect(next.position).toEqual(run.position);
  });

  it('勝ったら、倒れていたキャラは最大HPの10%（切り捨て、最低1）で戻る', () => {
    const run = inBattle();
    const next = finishBattle(run, decided(run, [0, 50, 0], 'player'), CONTENT);
    expect(next.team.map((m) => m.hp)).toEqual([
      Math.floor(FIGHTERS[0]!.stats.hp / 10),
      50,
      Math.floor(FIGHTERS[2]!.stats.hp / 10),
    ]);

    const tiny = { ...FIGHTERS[0]!, stats: { ...FIGHTERS[0]!.stats, hp: 9 } };
    const small = enterNode(runAt(null, [member(tiny), member(FIGHTERS[1]!), member(FIGHTERS[2]!)]), 0, CONTENT);
    expect(finishBattle(small, decided(small, [0, 50, 50], 'player'), CONTENT).team[0]!.hp).toBe(1);
  });

  it('勝ったら回復するお守りがあれば、全員が回復する。倒れていたキャラは戻ったあとに回復する（最大HPは超えない）', () => {
    const triumph = getCharm('triumph-charm');
    const percent = triumph.effect.type === 'victoryHeal' ? triumph.effect.percent : 0;
    const heal = (fighter: FighterDef) => Math.floor((fighter.stats.hp * percent) / 100);
    const revive = (fighter: FighterDef) => Math.floor(fighter.stats.hp / 10);
    const run = { ...inBattle(), charms: [triumph] };
    const nearlyFull = FIGHTERS[1]!.stats.hp - 1;
    const next = finishBattle(run, decided(run, [12, nearlyFull, 0], 'player'), CONTENT);
    expect(next.team.map((m) => m.hp)).toEqual([
      12 + heal(FIGHTERS[0]!),
      FIGHTERS[1]!.stats.hp,
      revive(FIGHTERS[2]!) + heal(FIGHTERS[2]!),
    ]);
  });

  it('負けたらランは終わり', () => {
    const run = inBattle();
    const next = finishBattle(run, decided(run, [0, 0, 0], 'enemy'), CONTENT);
    expect(next.phase).toEqual({ kind: 'ended', result: 'defeated' });
    expect(runChoices(next)).toEqual([]);
  });

  it('最後のエリア（エリア3）のボスに勝ったらクリア。それより前のエリアなら報酬を選ぶ', () => {
    const last = enterNode({ ...runAt({ layer: 5, index: 0 }), area: 2 }, 0, CONTENT);
    expect(finishBattle(last, decided(last, [10, 0, 30], 'player'), CONTENT).phase).toEqual({ kind: 'ended', result: 'cleared' });
    const first = enterNode(runAt({ layer: 5, index: 0 }), 0, CONTENT);
    expect(finishBattle(first, decided(first, [10, 0, 30], 'player'), CONTENT).phase).toMatchObject({ kind: 'reward', picks: 2 });
  });

  it('エリアが進むほど相手が多く・強くなる（エリアの倍率と、強敵・ボスの倍率をかけ合わせる）', () => {
    for (const area of [0, 1, 2]) {
      // エリアを変えたら、相手もそのエリアで決め直す（マップを作るときに決まるので）
      const battle = enterNode(withEnemies({ ...runAt(null), area }), 1, CONTENT);
      const elite = enterNode(withEnemies({ ...runAt({ layer: 0, index: 0 }), area }), 0, CONTENT);
      if (battle.phase.kind !== 'battle' || elite.phase.kind !== 'battle') {
        throw new Error('戦闘の段階のはず');
      }
      expect(battle.phase.enemy).toHaveLength(BATTLE_ENEMY_COUNT[area]![0]!);
      expect(elite.phase.enemy).toHaveLength(ELITE_ENEMY_COUNT[area]!);
      const enemy = battle.phase.enemy[0]!;
      const base = FIGHTERS.find((fighter) => fighter.id === enemy.id)!.stats;
      expect(enemy.stats).toEqual({
        hp: Math.round(base.hp * AREA_STAT_MULTIPLIER[area]!),
        attack: Math.round(base.attack * AREA_STAT_MULTIPLIER[area]!),
        defense: Math.round(base.defense * AREA_STAT_MULTIPLIER[area]!),
        speed: base.speed,
      });
      const eliteEnemy = elite.phase.enemy[0]!;
      const eliteBase = FIGHTERS.find((fighter) => fighter.id === eliteEnemy.id)!.stats;
      expect(eliteEnemy.stats.hp).toBe(Math.round(eliteBase.hp * AREA_STAT_MULTIPLIER[area]! * ELITE_STAT_MULTIPLIER));
    }
  });

  it('決着していないバトルや、戦闘中でないときはエラー', () => {
    const run = inBattle();
    expect(() => finishBattle(run, createRunBattle(run), CONTENT)).toThrow('決着していません');
    expect(() => finishBattle(runAt(null), decided(run, [1, 1, 1], 'player'), CONTENT)).toThrow('戦闘の段階ではありません');
    expect(() => createRunBattle(runAt(null))).toThrow('戦闘の段階ではありません');
  });

  it('戦闘の能力変化・状態異常・大技の使用不可は持ち越さない（次のバトルは定義から作り直す）', () => {
    const run = inBattle();
    let battle = createRunBattle(run);
    const moveId = battle.sides.player.team[0]!.moves.find((move) => move.kind === 'big')!.id;
    const enemyMove = battle.sides.enemy.team[0]!.moves[0]!.id;
    battle = resolveTurn(battle, { player: { type: 'move', moveId }, enemy: { type: 'move', moveId: enemyMove } }, 1).state;
    const won = { ...battle, winner: 'player' as const };
    const next = { ...finishBattle(run, won, CONTENT), phase: { kind: 'map' as const } };
    const again = createRunBattle(enterNode(next, 0, CONTENT));
    expect(again.sides.player.team[0]!.cooldowns).toEqual({});
    expect(again.sides.player.team[0]!.stages).toEqual({ attack: 0, defense: 0, speed: 0 });
  });
});

describe('いまのHPから始めるバトル', () => {
  const team = FIGHTERS.slice(0, 2);

  it('HPは 1〜最大HP の整数で、チームと同じ数だけ渡す', () => {
    expect(() => createBattle(team, team, { playerHp: [0, 10] })).toThrow('HPは');
    expect(() => createBattle(team, team, { playerHp: [team[0]!.stats.hp + 1, 10] })).toThrow('HPは');
    expect(() => createBattle(team, team, { playerHp: [1.5, 10] })).toThrow('HPは');
    expect(() => createBattle(team, team, { playerHp: [10] })).toThrow('合いません');
    expect(createBattle(team, team, { playerHp: [1, 10] }).sides.player.team.map((c) => c.hp)).toEqual([1, 10]);
  });

  it('省くと満タン（相手はいつも満タン）', () => {
    const battle = createBattle(team, team, { playerHp: [1, 10] });
    expect(battle.sides.enemy.team.map((c) => c.hp)).toEqual(team.map((f) => f.stats.hp));
    expect(createBattle(team, team).sides.player.team.map((c) => c.hp)).toEqual(team.map((f) => f.stats.hp));
  });
});
