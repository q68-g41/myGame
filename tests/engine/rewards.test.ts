import { describe, expect, it } from 'vitest';
import { CHARMS } from '../../src/data/charms';
import { RUN_CONTENT } from '../../src/data/content';
import { FIGHTERS } from '../../src/data/fighters';
import { getMove } from '../../src/data/moves';
import { createRunBattle, enterNode, finishBattle, statBoostAmount, takeReward, type RunState } from '../../src/engine/run';
import type { AreaMap } from '../../src/engine/map';
import type { BattleState, FighterDef } from '../../src/engine/types';
import { deepFreeze } from '../helpers/fixtures';

/** 1層目：戦闘・強敵 → ボス */
const MAP: AreaMap = {
  layers: [
    [
      { kind: 'battle', next: [0] },
      { kind: 'elite', next: [0] },
    ],
    [{ kind: 'boss', next: [] }],
  ],
};

const team = FIGHTERS.slice(0, 3).map((fighter) => ({ fighter, hp: fighter.stats.hp }));
const mapRun = (overrides: Partial<RunState> = {}): RunState => ({
  area: 0,
  map: MAP,
  position: null,
  team,
  charms: [],
  phase: { kind: 'map' },
  rng: 11,
  ...overrides,
});

/** 自分が勝ったことにしたバトル */
function won(run: RunState): BattleState {
  return { ...createRunBattle(run), winner: 'player' };
}

/** index のマスで戦って勝ち、報酬を選ぶ段階にしたラン */
function rewardRun(index = 0, overrides: Partial<RunState> = {}): RunState {
  const run = enterNode(mapRun(overrides), index, RUN_CONTENT);
  return finishBattle(run, won(run), RUN_CONTENT);
}

function offersOf(run: RunState) {
  if (run.phase.kind !== 'reward') {
    throw new Error('報酬を選ぶ段階のはず');
  }
  return run.phase.offers;
}

describe('報酬の選択肢（4.4）', () => {
  it('技・能力強化・お守りを1つずつ出す', () => {
    for (let rng = 0; rng < 30; rng += 1) {
      const offers = offersOf(rewardRun(0, { rng }));
      expect(offers.map((offer) => offer.kind)).toEqual(['move', 'stat', 'charm']);
      const [move, stat] = offers;
      // 技は、チームのだれかがまだ覚えていないもの
      if (move?.kind === 'move') {
        expect(team.some((m) => !m.fighter.moves.some((known) => known.id === move.move.id))).toBe(true);
      }
      // 能力強化は、いまの値の10%（四捨五入、最低1）
      if (stat?.kind === 'stat') {
        expect(stat.amount).toBe(statBoostAmount(team[stat.member]!.fighter.stats[stat.stat]));
      }
    }
  });

  it('上がる量は 10% を四捨五入、最低1', () => {
    expect(statBoostAmount(65)).toBe(7);
    expect(statBoostAmount(45)).toBe(5);
    expect(statBoostAmount(100)).toBe(10);
    expect(statBoostAmount(4)).toBe(1);
  });

  it('お守りを全部持っていたら、その分は別の能力強化になる', () => {
    const offers = offersOf(rewardRun(0, { charms: CHARMS }));
    expect(offers.map((offer) => offer.kind)).toEqual(['move', 'stat', 'stat']);
    const [, a, b] = offers;
    expect(a).not.toEqual(b);
  });

  it('同じ状態なら同じ選択肢', () => {
    expect(rewardRun(0)).toEqual(rewardRun(0));
  });

  it('強敵に勝つと2回選べる。1回目のあとは新しい選択肢が出て、2回目のあとはマップに戻る', () => {
    const first = rewardRun(1);
    expect(first.phase).toMatchObject({ kind: 'reward', pick: 1, picks: 2 });
    const statIndex = offersOf(first).findIndex((offer) => offer.kind === 'stat');
    const second = takeReward(first, { offer: statIndex }, RUN_CONTENT);
    expect(second.phase).toMatchObject({ kind: 'reward', pick: 2, picks: 2 });
    const last = takeReward(second, { offer: offersOf(second).findIndex((offer) => offer.kind === 'stat') }, RUN_CONTENT);
    expect(last.phase).toEqual({ kind: 'map' });
  });
});

describe('報酬を受け取る', () => {
  it('能力強化：その能力が上がる。HPなら、いまのHPも同じだけ増える', () => {
    const run = rewardRun(0);
    const offers = offersOf(run);
    const hpRun: RunState = {
      ...run,
      team: [{ ...team[0]!, hp: 40 }, team[1]!, team[2]!],
      phase: { kind: 'reward', offers: [{ kind: 'stat', member: 0, stat: 'hp', amount: 10 }, ...offers.slice(1)], pick: 1, picks: 1 },
    };
    const next = takeReward(deepFreeze(hpRun), { offer: 0 }, RUN_CONTENT);
    expect(next.team[0]!.fighter.stats.hp).toBe(team[0]!.fighter.stats.hp + 10);
    expect(next.team[0]!.hp).toBe(50);
    expect(next.phase).toEqual({ kind: 'map' });

    const attackRun: RunState = {
      ...run,
      phase: { kind: 'reward', offers: [{ kind: 'stat', member: 2, stat: 'attack', amount: 6 }], pick: 1, picks: 1 },
    };
    const boosted = takeReward(attackRun, { offer: 0 }, RUN_CONTENT);
    expect(boosted.team[2]!.fighter.stats.attack).toBe(team[2]!.fighter.stats.attack + 6);
    expect(boosted.team[2]!.hp).toBe(team[2]!.hp);
  });

  it('お守り：手に入れると、次のバトルから自分の陣営に効く', () => {
    const run = rewardRun(0);
    const charmIndex = offersOf(run).findIndex((offer) => offer.kind === 'charm');
    const next = takeReward(run, { offer: charmIndex }, RUN_CONTENT);
    expect(next.charms).toHaveLength(1);
    const battleRun = enterNode({ ...next, position: null }, 0, RUN_CONTENT);
    const battle = createRunBattle(battleRun);
    expect(battle.sides.player.charms).toEqual([next.charms[0]!.effect]);
    expect(battle.sides.enemy.charms).toBeUndefined();
  });

  describe('技を覚える', () => {
    const learn = getMove('blue-burst');
    const moveRun = (fighters: readonly FighterDef[] = team.map((m) => m.fighter)): RunState => ({
      ...mapRun(),
      team: fighters.map((fighter) => ({ fighter, hp: fighter.stats.hp })),
      phase: { kind: 'reward', offers: [{ kind: 'move', move: learn }], pick: 1, picks: 1 },
    });

    it('4つ覚えていれば、選んだ技と入れ替える', () => {
      const next = takeReward(moveRun(), { offer: 0, member: 0, forget: 3 }, RUN_CONTENT);
      const moves = next.team[0]!.fighter.moves.map((move) => move.id);
      expect(moves).toEqual([...team[0]!.fighter.moves.slice(0, 3).map((move) => move.id), 'blue-burst']);
      expect(next.team[1]).toEqual(team[1]);
    });

    it('枠が空いていれば、忘れずに覚える', () => {
      const three = { ...team[0]!.fighter, moves: team[0]!.fighter.moves.slice(0, 3) };
      const next = takeReward(moveRun([three, team[1]!.fighter, team[2]!.fighter]), { offer: 0, member: 0 }, RUN_CONTENT);
      expect(next.team[0]!.fighter.moves.map((move) => move.id)).toEqual([...three.moves.map((m) => m.id), 'blue-burst']);
      expect(() =>
        takeReward(moveRun([three, team[1]!.fighter, team[2]!.fighter]), { offer: 0, member: 0, forget: 1 }, RUN_CONTENT),
      ).toThrow('枠が空いている');
    });

    it('覚えさせるキャラ・忘れる技を選んでいない、もう覚えている、はエラー', () => {
      expect(() => takeReward(moveRun(), { offer: 0 }, RUN_CONTENT)).toThrow('いません');
      expect(() => takeReward(moveRun(), { offer: 0, member: 0 }, RUN_CONTENT)).toThrow('忘れる技を選んで');
      const blue = FIGHTERS.find((fighter) => fighter.id === 'blue-trial')!;
      expect(() => takeReward(moveRun([blue, team[1]!.fighter, team[2]!.fighter]), { offer: 0, member: 0, forget: 0 }, RUN_CONTENT)).toThrow(
        'もう覚えています',
      );
    });

    it('入れ替えたあとに大技だけになる場合はエラー（大技以外の技を1つ以上残す）', () => {
      const allBig = { ...team[0]!.fighter, moves: [getMove('crimson-burst'), getMove('orange-burst'), getMove('yellow-burst'), getMove('crimson-strike')] };
      expect(() => takeReward(moveRun([allBig, team[1]!.fighter, team[2]!.fighter]), { offer: 0, member: 0, forget: 3 }, RUN_CONTENT)).toThrow(
        '大技以外',
      );
      expect(() => takeReward(moveRun([allBig, team[1]!.fighter, team[2]!.fighter]), { offer: 0, member: 0, forget: 0 }, RUN_CONTENT)).not.toThrow();
    });
  });

  it('報酬を選ぶ段階でない、ない選択肢を選ぶ、はエラー', () => {
    expect(() => takeReward(mapRun(), { offer: 0 }, RUN_CONTENT)).toThrow('報酬を選ぶ段階ではありません');
    expect(() => takeReward(rewardRun(0), { offer: 3 }, RUN_CONTENT)).toThrow('ありません');
  });

  it('最後のエリアのボスに勝ったら報酬はなく、クリアになる', () => {
    const run = enterNode(mapRun({ area: 2, position: { layer: 0, index: 0 } }), 0, RUN_CONTENT);
    expect(finishBattle(run, won(run), RUN_CONTENT).phase).toEqual({ kind: 'ended', result: 'cleared' });
  });

  it('それ以外のエリアのボスに勝ったら、報酬を2回選んでから、次のエリアの新しいマップへ進む', () => {
    const run = enterNode(mapRun({ position: { layer: 0, index: 0 } }), 0, RUN_CONTENT);
    let next = finishBattle(run, won(run), RUN_CONTENT);
    expect(next.phase).toMatchObject({ kind: 'reward', pick: 1, picks: 2 });
    next = takeReward(next, { offer: offersOf(next).findIndex((offer) => offer.kind === 'stat') }, RUN_CONTENT);
    expect(next.area).toBe(0);
    next = takeReward(deepFreeze(next), { offer: offersOf(next).findIndex((offer) => offer.kind === 'stat') }, RUN_CONTENT);
    expect(next.area).toBe(1);
    expect(next.position).toBeNull();
    expect(next.phase).toEqual({ kind: 'map' });
    expect(next.map.layers).toHaveLength(7);
    expect(next.map).not.toEqual(MAP);
    // チームとお守りはそのまま持ち越す
    expect(next.team.map((m) => m.fighter.id)).toEqual(team.map((m) => m.fighter.id));
  });
});
