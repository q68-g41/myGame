import { describe, expect, it } from 'vitest';
import { getCharm } from '../../src/data/charms';
import { RUN_CONTENT } from '../../src/data/content';
import { EVENTS, getEvent } from '../../src/data/events';
import { FIGHTERS } from '../../src/data/fighters';
import { REST_HEAL_PERCENT, REST_POWER_UP, SCOUT_CANDIDATE_COUNT } from '../../src/engine/constants';
import type { AreaMap } from '../../src/engine/map';
import {
  chooseEventOption,
  leaveEvent,
  restHeal,
  restHealPercent,
  restPowerUp,
  scoutRecruit,
  scoutSkip,
  type EventDef,
} from '../../src/engine/nodes';
import { enterNode, type RunMember, type RunState } from '../../src/engine/run';
import { deepFreeze } from '../helpers/fixtures';

/** 1層目：休憩・スカウト・イベント */
const MAP: AreaMap = {
  layers: [
    [
      { kind: 'rest', next: [] },
      { kind: 'scout', next: [] },
      { kind: 'event', next: [] },
    ],
  ],
};

const [crimson, orange, yellow] = FIGHTERS as [(typeof FIGHTERS)[number], (typeof FIGHTERS)[number], (typeof FIGHTERS)[number]];
const team: readonly RunMember[] = [
  { fighter: crimson, hp: 40 },
  { fighter: orange, hp: 110 },
  { fighter: yellow, hp: 1 },
];

const baseRun = (overrides: Partial<RunState> = {}): RunState => ({
  area: 0,
  map: MAP,
  position: null,
  team,
  charms: [],
  phase: { kind: 'map' },
  rng: 5,
  ...overrides,
});

const enter = (index: number, overrides: Partial<RunState> = {}) => enterNode(baseRun(overrides), index, RUN_CONTENT);

/** テスト用のイベントの段階のラン */
const eventRun = (event: EventDef, overrides: Partial<RunState> = {}): RunState =>
  baseRun({ phase: { kind: 'event', event, outcome: null }, ...overrides });

describe('休憩（4.2）', () => {
  it('ゆっくり休む：全員のHPが最大HPの30%（切り捨て）回復する。最大HPは超えない', () => {
    const run = restHeal(deepFreeze(enter(0)));
    const heal = (max: number) => Math.floor((max * REST_HEAL_PERCENT) / 100);
    expect(run.team.map((m) => m.hp)).toEqual([40 + heal(95), orange.stats.hp, 1 + heal(85)]);
    expect(run.phase).toEqual({ kind: 'map' });
  });

  it('休憩の回復を増やすお守りがあれば、回復する割合が増える', () => {
    const hotSpring = getCharm('hot-spring-charm');
    const bonus = hotSpring.effect.type === 'restHeal' ? hotSpring.effect.percent : 0;
    const charmed = enter(0, { charms: [hotSpring] });
    expect(restHealPercent(charmed)).toBe(REST_HEAL_PERCENT + bonus);
    expect(restHealPercent(enter(0))).toBe(REST_HEAL_PERCENT);
    const heal = (max: number) => Math.floor((max * (REST_HEAL_PERCENT + bonus)) / 100);
    expect(restHeal(charmed).team.map((m) => m.hp)).toEqual([40 + heal(95), orange.stats.hp, 1 + heal(85)]);
  });

  it('技をみがく：選んだキャラの攻撃技の威力が +10。ほかのキャラや技はそのまま', () => {
    const run = restPowerUp(deepFreeze(enter(0)), 1, 0);
    expect(run.team[1]!.fighter.moves[0]).toMatchObject({ id: 'orange-strike', power: 60 + REST_POWER_UP });
    expect(run.team[1]!.fighter.moves.slice(1)).toEqual(orange.moves.slice(1));
    expect(run.team[0]).toEqual(team[0]);
    expect(run.phase).toEqual({ kind: 'map' });
    // もう一度みがくと、さらに上がる
    const again = restPowerUp({ ...run, phase: { kind: 'rest' } }, 1, 0);
    expect(again.team[1]!.fighter.moves[0]).toMatchObject({ power: 60 + REST_POWER_UP * 2 });
  });

  it('補助技・ない技・休憩でないときはエラー', () => {
    expect(() => restPowerUp(enter(0), 1, 3)).toThrow('補助技');
    expect(() => restPowerUp(enter(0), 1, 4)).toThrow('ありません');
    expect(() => restPowerUp(enter(0), 3, 0)).toThrow('いません');
    expect(() => restHeal(baseRun())).toThrow('休憩の段階ではありません');
  });
});

describe('スカウト（4.2）', () => {
  it('チームにいないキャラから、重ならないように候補を3体出す', () => {
    for (let rng = 0; rng < 20; rng += 1) {
      const run = enter(1, { rng });
      if (run.phase.kind !== 'scout') {
        throw new Error('スカウトの段階のはず');
      }
      const ids = run.phase.candidates.map((fighter) => fighter.id);
      expect(ids).toHaveLength(SCOUT_CANDIDATE_COUNT);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.some((id) => team.some((member) => member.fighter.id === id))).toBe(false);
    }
  });

  it('候補の1体を、チームの1体と入れ替える。入った仲間はHP満タンで、抜けたキャラの位置に入る', () => {
    const run = enter(1);
    const candidate = run.phase.kind === 'scout' ? run.phase.candidates[2]! : crimson;
    const next = scoutRecruit(deepFreeze(run), 2, 0);
    expect(next.team[0]).toEqual({ fighter: candidate, hp: candidate.stats.hp });
    expect(next.team.slice(1)).toEqual(team.slice(1));
    expect(next.phase).toEqual({ kind: 'map' });
  });

  it('入れ替えずに進むこともできる', () => {
    const next = scoutSkip(enter(1));
    expect(next.team).toEqual(team);
    expect(next.phase).toEqual({ kind: 'map' });
  });

  it('いない候補・いないキャラ・スカウトでないときはエラー', () => {
    expect(() => scoutRecruit(enter(1), 3, 0)).toThrow('候補');
    expect(() => scoutRecruit(enter(1), 0, 3)).toThrow('いません');
    expect(() => scoutSkip(enter(0))).toThrow('スカウトの段階ではありません');
  });
});

describe('イベント（4.2）', () => {
  it('マスに入ると、イベントの中から1つが決まる（同じ状態なら同じイベント）', () => {
    const ids = new Set<string>();
    for (let rng = 0; rng < 30; rng += 1) {
      const run = enter(2, { rng });
      if (run.phase.kind !== 'event') {
        throw new Error('イベントの段階のはず');
      }
      expect(run.phase.outcome).toBeNull();
      ids.add(run.phase.event.id);
      expect(enter(2, { rng })).toEqual(run);
    }
    expect(ids).toEqual(new Set(EVENTS.map((event) => event.id)));
  });

  it('回復は最大HPを超えず、ダメージでは倒れない（HPは1より下がらない）', () => {
    const event: EventDef = {
      id: 'test',
      options: [
        { effects: [{ type: 'heal', target: 'all', percent: 50 }] },
        { effects: [{ type: 'damage', target: 'all', percent: 50 }] },
      ],
    };
    const healed = chooseEventOption(deepFreeze(eventRun(event)), 0);
    expect(healed.team.map((m) => m.hp)).toEqual([40 + 47, orange.stats.hp, 1 + 42]);
    expect(healed.phase).toMatchObject({
      kind: 'event',
      chosen: 0,
      outcome: [
        { type: 'hp', member: 0, delta: 47, hp: 87 },
        { type: 'hp', member: 1, delta: 5, hp: 115 },
        { type: 'hp', member: 2, delta: 42, hp: 43 },
      ],
    });

    const damaged = chooseEventOption(eventRun(event), 1);
    expect(damaged.team.map((m) => m.hp)).toEqual([1, 110 - 57, 1]);
  });

  it('先頭・ランダムな1体を対象にでき、能力強化は報酬と同じ量（10%）上がる', () => {
    const event: EventDef = {
      id: 'test',
      options: [
        { effects: [{ type: 'statBoost', target: 'lead', stat: 'attack' }] },
        { effects: [{ type: 'statBoost', target: 'random', stat: 'speed' }] },
      ],
    };
    const lead = chooseEventOption(eventRun(event), 0);
    expect(lead.team[0]!.fighter.stats.attack).toBe(crimson.stats.attack + 7);
    expect(lead.phase).toMatchObject({ outcome: [{ type: 'stat', member: 0, stat: 'attack', amount: 7 }] });

    const picked = new Set<number>();
    for (let rng = 0; rng < 30; rng += 1) {
      const run = chooseEventOption(eventRun(event, { rng }), 1);
      const outcome = run.phase.kind === 'event' ? run.phase.outcome![0]! : null;
      if (outcome?.type !== 'stat') {
        throw new Error('能力強化のはず');
      }
      picked.add(outcome.member);
    }
    expect(picked).toEqual(new Set([0, 1, 2]));
  });

  it('賭け：確率で成功か失敗の効果。何も効果がなければ「何も起きない」', () => {
    const gamble = (chancePercent: number): EventDef => ({
      id: 'test',
      options: [
        {
          effects: [
            {
              type: 'gamble',
              chancePercent,
              success: [{ type: 'heal', target: 'lead', percent: 10 }],
              failure: [{ type: 'damage', target: 'lead', percent: 10 }],
            },
          ],
        },
        { effects: [] },
      ],
    });
    expect(chooseEventOption(eventRun(gamble(100)), 0).phase).toMatchObject({
      outcome: [{ type: 'gamble', success: true }, { type: 'hp', member: 0, delta: 9 }],
    });
    expect(chooseEventOption(eventRun(gamble(0)), 0).phase).toMatchObject({
      outcome: [{ type: 'gamble', success: false }, { type: 'hp', member: 0, delta: -9 }],
    });
    expect(chooseEventOption(eventRun(gamble(50)), 1).phase).toMatchObject({ outcome: [{ type: 'nothing' }] });
  });

  it('結果を見たらマップへ。選ぶ前に離れる・2回選ぶ・ない選択肢・イベントでないときはエラー', () => {
    const event = getEvent('old-shrine');
    const chosen = chooseEventOption(eventRun(event), 1);
    expect(leaveEvent(chosen).phase).toEqual({ kind: 'map' });
    expect(() => leaveEvent(eventRun(event))).toThrow('まだ選んでいません');
    expect(() => chooseEventOption(chosen, 0)).toThrow('もう選びました');
    expect(() => chooseEventOption(eventRun(event), 2)).toThrow('ありません');
    expect(() => chooseEventOption(baseRun(), 0)).toThrow('イベントの段階ではありません');
  });
});

describe('イベントのデータ', () => {
  it('ID が重ならず、どれも2つ以上の選択肢と文章がある', () => {
    expect(new Set(EVENTS.map((event) => event.id)).size).toBe(EVENTS.length);
    for (const event of EVENTS) {
      expect(event.title).toBeTruthy();
      expect(event.text).toBeTruthy();
      expect(event.options.length).toBeGreaterThanOrEqual(2);
      for (const option of event.options) {
        expect(option.label).toBeTruthy();
        expect(option.description).toBeTruthy();
      }
    }
    expect(() => getEvent('unknown')).toThrow('unknown');
  });

  it('どのイベントのどの選択肢を選んでも、チームが倒れない', () => {
    for (const event of EVENTS) {
      event.options.forEach((_option, index) => {
        for (let rng = 0; rng < 10; rng += 1) {
          const run = chooseEventOption(eventRun(event, { rng }), index);
          expect(run.team.every((member) => member.hp >= 1)).toBe(true);
        }
      });
    }
  });
});
