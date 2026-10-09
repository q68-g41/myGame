import { describe, expect, it } from 'vitest';
import type { BattleEvent, BattleState } from '../../src/engine/types';
import { describeEvents } from '../../src/ui/messages';
import { startSession } from '../helpers/session';
import { getFighter } from '../../src/data/fighters';
import { memberAt } from '../../src/engine/team';

const state: BattleState = startSession(1).state;
const name = (side: 'player' | 'enemy', index: number) => getFighter(memberAt(state.sides[side], index).id).name;

const one = (event: BattleEvent) => describeEvents([event], state)[0];

describe('ログの文章', () => {
  it('技を使った・ダメージ（相性）・倒れた', () => {
    expect(one({ type: 'moveUsed', side: 'player', moveId: 'crimson-strike', moveKind: 'normal' })).toBe(
      `${name('player', 0)}の 緋の爪！`,
    );
    expect(
      one({ type: 'damage', side: 'enemy', amount: 35, hp: 50, effectiveness: 'advantage', resonance: true }),
    ).toBe(`相手の${name('enemy', 0)}に 35 のダメージ（有利！）`);
    expect(
      one({ type: 'damage', side: 'enemy', amount: 10, hp: 50, effectiveness: 'disadvantage', resonance: false }),
    ).toBe(`相手の${name('enemy', 0)}に 10 のダメージ（不利…）`);
    expect(one({ type: 'fainted', side: 'enemy', index: 1 })).toBe(`相手の${name('enemy', 1)}は 倒れた`);
  });

  it('お守りで回復したときは、そう書く', () => {
    expect(one({ type: 'healed', side: 'player', amount: 5, hp: 55, source: 'charm' })).toBe(
      `${name('player', 0)}は お守りで HPを 5 回復した`,
    );
  });

  it('能力変化・回復・状態異常', () => {
    expect(one({ type: 'statChanged', side: 'player', stat: 'attack', delta: 2, stage: 2 })).toBe(
      `${name('player', 0)}の 攻撃が 上がった`,
    );
    expect(one({ type: 'statChanged', side: 'enemy', stat: 'defense', delta: -1, stage: -1 })).toBe(
      `相手の${name('enemy', 0)}の 防御が 下がった`,
    );
    expect(one({ type: 'statChanged', side: 'player', stat: 'speed', delta: 0, stage: 3 })).toBe(
      `${name('player', 0)}の 素早さは これ以上変わらない`,
    );
    expect(one({ type: 'healed', side: 'player', amount: 30, hp: 90 })).toBe(`${name('player', 0)}は HPを 30 回復した`);
    expect(one({ type: 'healed', side: 'player', amount: 0, hp: 100 })).toBe(`${name('player', 0)}の HPは 満タンだ`);
    expect(one({ type: 'statusApplied', side: 'enemy', status: 'erosion' })).toBe(`相手の${name('enemy', 0)}は 侵蝕を受けた`);
    expect(one({ type: 'statusBlocked', side: 'enemy', status: 'slow' })).toBe(`相手の${name('enemy', 0)}には 効かなかった`);
    expect(one({ type: 'statusBlocked', side: 'player', status: 'erosion', reason: 'charm' })).toBe(
      `${name('player', 0)}は お守りで 侵蝕を 防いだ`,
    );
    expect(one({ type: 'statusDamage', side: 'player', status: 'erosion', amount: 9, hp: 80 })).toBe(
      `${name('player', 0)}は 侵蝕で 9 のダメージ`,
    );
    expect(one({ type: 'statusEnded', side: 'player', status: 'slow' })).toBe(`${name('player', 0)}の 鈍化が 治った`);
  });

  it('交代と決着', () => {
    expect(one({ type: 'switched', side: 'player', from: 0, to: 2, reason: 'command' })).toBe(
      `あなたは ${name('player', 0)}を戻して ${name('player', 2)}を出した`,
    );
    expect(one({ type: 'switched', side: 'enemy', from: 0, to: 1, reason: 'replacement' })).toBe(
      `相手は ${name('enemy', 1)}を出した`,
    );
    expect(one({ type: 'battleEnd', winner: 'player' })).toBe('あなたの勝ち！');
    expect(one({ type: 'battleEnd', winner: 'enemy' })).toBe('あなたの負け…');
  });

  it('交代のあとのイベントは、交代先のキャラの名前で書く', () => {
    const lines = describeEvents(
      [
        { type: 'switched', side: 'enemy', from: 0, to: 2, reason: 'replacement' },
        { type: 'moveUsed', side: 'enemy', moveId: 'blue-strike', moveKind: 'normal' },
      ],
      state,
    );
    expect(lines[1]).toBe(`相手の${name('enemy', 2)}の 蒼波！`);
  });
});
