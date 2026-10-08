import { describe, expect, it } from 'vitest';
import { chooseBossCommand } from '../../src/ai/boss';
import { chooseCommand } from '../../src/ai/policy';
import { playCpuBattleFrom } from '../../src/ai/selfPlay';
import { BOSSES } from '../../src/data/bosses';
import { BOSS_FIGHTERS, FIGHTERS, getFighter } from '../../src/data/fighters';
import { createBattle, createCombatant } from '../../src/engine/battle';
import { AREA_COUNT } from '../../src/engine/constants';
import { createRng } from '../../src/engine/rng';
import type { BattleState, BossPattern, Combatant } from '../../src/engine/types';
import { makeCombatant, makeMove, makeSupportMove } from '../helpers/fixtures';

const STRIKE = makeMove({ id: 'strike', power: 60 });
const BURST = makeMove({ id: 'burst', kind: 'big', power: 100 });
const QUICK = makeMove({ id: 'quick', kind: 'priority', power: 35 });
const FOCUS = makeSupportMove({ id: 'focus', effects: [{ type: 'stat', target: 'self', stat: 'attack', stages: 2 }] });
const CORRODE = makeSupportMove({ id: 'corrode', effects: [{ type: 'status', status: 'erosion' }] });

const PATTERN: BossPattern = {
  fighterId: 'boss',
  rules: [
    {
      when: [
        { type: 'selfHpBelow', percent: 50 },
        { type: 'selfStageBelow', stat: 'attack', stage: 2 },
      ],
      use: 'focus',
    },
    { when: [{ type: 'turnEvery', every: 4 }, { type: 'opponentHasNoStatus' }], use: 'corrode' },
  ],
  rotation: ['strike', 'quick', 'burst'],
};

function battle(boss: Partial<Combatant>, opponent: Partial<Combatant> = {}, turn = 1): BattleState {
  const self = makeCombatant({ id: 'boss', moves: [STRIKE, BURST, QUICK, FOCUS, CORRODE], ...boss });
  return {
    turn,
    sides: {
      player: { team: [makeCombatant({ id: 'player', ...opponent })], active: 0 },
      enemy: { team: [self], active: 0 },
    },
    awaitingReplacement: [],
    winner: null,
  };
}

const choose = (state: BattleState) => chooseBossCommand(state, 'enemy', PATTERN);

describe('ボスの行動パターン（仕様書 6）', () => {
  it('条件に当てはまらなければ、ターンごとに決まった順の技を使う', () => {
    expect([1, 2, 3, 4, 5, 6].map((turn) => choose(battle({}, { status: { id: 'slow', remaining: 1 } }, turn)))).toEqual([
      { type: 'move', moveId: 'strike' },
      { type: 'move', moveId: 'quick' },
      { type: 'move', moveId: 'burst' },
      { type: 'move', moveId: 'strike' },
      { type: 'move', moveId: 'quick' },
      { type: 'move', moveId: 'burst' },
    ]);
  });

  it('順番の技が使えなければ（大技の使用不可）、次の技を使う', () => {
    expect(choose(battle({ cooldowns: { burst: 1 } }, {}, 3))).toEqual({ type: 'move', moveId: 'strike' });
  });

  it('条件分岐は上から順に見て、条件がすべて当てはまるものを使う', () => {
    // HPが半分未満で、攻撃がまだ上がっていない → 力をためる
    expect(choose(battle({ hp: 40 }))).toEqual({ type: 'move', moveId: 'focus' });
    // 攻撃がもう上がっていれば、次の条件を見る（4ターン目で、相手に状態異常がない → 侵蝕）
    expect(choose(battle({ hp: 40, stages: { attack: 2, defense: 0, speed: 0 } }, {}, 4))).toEqual({
      type: 'move',
      moveId: 'corrode',
    });
    // 相手に状態異常があれば、侵蝕はかけない
    expect(choose(battle({}, { status: { id: 'slow', remaining: 1 } }, 4))).toEqual({ type: 'move', moveId: 'strike' });
  });

  it('場のキャラがそのボスのときだけ、行動パターンで動く（それ以外は CPU の段階で選ぶ）', () => {
    const state = battle({ hp: 40 });
    expect(chooseCommand(state, 'enemy', 1, PATTERN)).toEqual({ type: 'move', moveId: 'focus' });
    expect(chooseCommand(state, 'enemy', 1, { ...PATTERN, fighterId: 'someone-else' })).toEqual(
      chooseCommand(state, 'enemy', 1, null),
    );
  });
});

describe('ボスのデータ', () => {
  it('エリアの数だけいて、ふつうのキャラの一覧には入っていない', () => {
    expect(BOSSES).toHaveLength(AREA_COUNT);
    for (const boss of BOSSES) {
      expect(FIGHTERS.some((fighter) => fighter.id === boss.fighter.id)).toBe(false);
      expect(BOSS_FIGHTERS).toContain(boss.fighter);
      expect(getFighter(boss.fighter.id).name).toBeTruthy();
      expect(boss.summary).toBeTruthy();
    }
  });

  it('戦闘に出せるキャラで、行動パターンの技はすべてそのボスが覚えている', () => {
    for (const boss of BOSSES) {
      expect(() => createCombatant(boss.fighter)).not.toThrow();
      expect(boss.pattern.fighterId).toBe(boss.fighter.id);
      const known = new Set(boss.fighter.moves.map((move) => move.id));
      for (const moveId of [...boss.pattern.rotation, ...boss.pattern.rules.map((rule) => rule.use)]) {
        expect(known.has(moveId)).toBe(true);
      }
    }
  });

  it('3体のチームと戦うと、どのボスも最後まで決着する（勝ったり負けたりする）', () => {
    for (const boss of BOSSES) {
      const winners = new Set<string | null>();
      for (let i = 0; i < 40; i += 1) {
        const team = [FIGHTERS[i % 6]!, FIGHTERS[(i + 1) % 6]!, FIGHTERS[(i + 3) % 6]!];
        const result = playCpuBattleFrom(createBattle(team, [boss.fighter]), createRng(i), { player: 1, enemy: 1 }, boss.pattern);
        expect(result.winner).not.toBeNull();
        winners.add(result.winner);
      }
      expect(winners).toEqual(new Set(['player', 'enemy']));
    }
  });
});
