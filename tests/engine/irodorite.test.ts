import { describe, expect, it } from 'vitest';
import { getCharm } from '../../src/data/charms';
import { RUN_CONTENT } from '../../src/data/content';
import { FIGHTERS, getFighter } from '../../src/data/fighters';
import { DRAFT_CANDIDATE_COUNT, REST_HEAL_PERCENT, RUN_TEAM_SIZE } from '../../src/engine/constants';
import { percentOfMaxHp } from '../../src/engine/effects';
import type { AreaMap } from '../../src/engine/map';
import { restHealPercent, scoutRecruit } from '../../src/engine/nodes';
import {
  chooseTeam,
  createRunBattle,
  draftPickCount,
  finishBattle,
  partnerIndex,
  runCharmEffects,
  startRun,
  swapTeamOrder,
  type CharmDef,
  type IrodoriteDef,
  type RunContent,
  type RunState,
} from '../../src/engine/run';
import { deepFreeze } from '../helpers/fixtures';

/** テスト用の彩り手。相棒はサクラシバ、特性は勝ったあとに20%回復 */
const PARTNER = getFighter('hina-partner');
const VICTORY_HEAL = 20;
const TRAIT: CharmDef = { id: 'test-trait', effect: { type: 'victoryHeal', percent: VICTORY_HEAL } };
const IRODORITE: IrodoriteDef = { id: 'test', partner: PARTNER, trait: TRAIT };

/** チームを選んだあとの、彩り手のいるラン */
const chosen = (irodorite: IrodoriteDef = IRODORITE): RunState => chooseTeam(startRun(RUN_CONTENT, 7, irodorite), [1, 3]);

describe('彩り手を選んでランを始める（4.6）', () => {
  it('ランに彩り手を持たせる。彩り手を選ばなければ null', () => {
    expect(startRun(RUN_CONTENT, 7, IRODORITE).irodorite).toBe(IRODORITE);
    expect(startRun(RUN_CONTENT, 7).irodorite).toBeNull();
  });

  it('スタートの候補は5体のままで、相棒は出ない（ランのキャラに相棒が入っていても）', () => {
    const content: RunContent = { ...RUN_CONTENT, fighters: [...FIGHTERS, PARTNER] };
    for (let seed = 0; seed < 50; seed += 1) {
      const run = startRun(content, seed, IRODORITE);
      if (run.phase.kind !== 'draft') {
        throw new Error('チーム選択の段階のはず');
      }
      expect(run.phase.candidates).toHaveLength(DRAFT_CANDIDATE_COUNT);
      expect(run.phase.candidates.map((fighter) => fighter.id)).not.toContain(PARTNER.id);
    }
  });

  it('候補から選ぶのは、彩り手がいれば2体、いなければ今までどおり3体', () => {
    expect(draftPickCount(startRun(RUN_CONTENT, 7, IRODORITE))).toBe(RUN_TEAM_SIZE - 1);
    expect(draftPickCount(startRun(RUN_CONTENT, 7))).toBe(RUN_TEAM_SIZE);
  });

  it('相棒がHP満タンで1番目に入り、選んだ2体が選んだ順に続く', () => {
    const run = startRun(RUN_CONTENT, 7, IRODORITE);
    if (run.phase.kind !== 'draft') {
      throw new Error('チーム選択の段階のはず');
    }
    const next = chooseTeam(deepFreeze(run), [3, 1]);
    expect(next.team).toEqual([
      { fighter: PARTNER, hp: PARTNER.stats.hp },
      { fighter: run.phase.candidates[3], hp: run.phase.candidates[3]!.stats.hp },
      { fighter: run.phase.candidates[1], hp: run.phase.candidates[1]!.stats.hp },
    ]);
    expect(next.phase).toEqual({ kind: 'map' });
  });

  it('彩り手がいるのに3体選ぶ・同じ候補を2回選ぶとエラー', () => {
    const run = startRun(RUN_CONTENT, 7, IRODORITE);
    expect(() => chooseTeam(run, [0, 1, 2])).toThrow('2 体');
    expect(() => chooseTeam(run, [1, 1])).toThrow('2 体');
  });
});

describe('相棒は外せない（4.6）', () => {
  it('相棒の位置は、並び順を変えると一緒に動く。彩り手がいなければ -1', () => {
    const run = chosen();
    expect(partnerIndex(run)).toBe(0);
    expect(partnerIndex(swapTeamOrder(run, 0, 2))).toBe(2);
    expect(partnerIndex(chooseTeam(startRun(RUN_CONTENT, 7), [0, 1, 2]))).toBe(-1);
  });

  it('スカウトで、相棒は入れ替えられない（並び順を変えたあとも）。ほかの仲間は入れ替えられる', () => {
    const scout = (run: RunState): RunState => deepFreeze({ ...run, phase: { kind: 'scout', candidates: [FIGHTERS[0]!] } });
    expect(() => scoutRecruit(scout(chosen()), 0, 0)).toThrow('相棒');
    const swapped = swapTeamOrder(chosen(), 0, 2);
    expect(() => scoutRecruit(scout(swapped), 0, 2)).toThrow('相棒');
    const next = scoutRecruit(scout(swapped), 0, 0);
    expect(next.team[0]).toEqual({ fighter: FIGHTERS[0], hp: FIGHTERS[0]!.stats.hp });
    expect(next.team[2]!.fighter).toBe(PARTNER);
  });
});

describe('特性（外せないお守り）', () => {
  it('ランで効くお守りは、特性が先で、そのあとに手に入れたお守り。彩り手がいなければお守りだけ', () => {
    const swift = getCharm('swift-charm');
    expect(runCharmEffects({ ...chosen(), charms: [swift] })).toEqual([TRAIT.effect, swift.effect]);
    const plain = chooseTeam(startRun(RUN_CONTENT, 7), [0, 1, 2]);
    expect(runCharmEffects({ ...plain, charms: [swift] })).toEqual([swift.effect]);
  });

  it('特性は、手に入れたお守りの一覧には入らない（報酬で同じものが出たり、外したりしない）', () => {
    expect(chosen().charms).toEqual([]);
  });

  it('バトルでは、プレイヤーの陣営に特性がかかる', () => {
    const run: RunState = { ...chosen(), phase: { kind: 'battle', enemy: [FIGHTERS[5]!], cpu: 1, boss: null, seed: 1 } };
    expect(createRunBattle(run).sides.player.charms).toEqual([TRAIT.effect]);
  });

  it('勝ったあとの回復の特性は、ふつうのお守りと同じように効く', () => {
    const map: AreaMap = { layers: [[{ kind: 'battle', next: [0] }], [{ kind: 'boss', next: [] }]] };
    const base = chosen();
    const run: RunState = {
      ...base,
      map,
      position: { layer: 0, index: 0 },
      team: base.team.map((member) => ({ ...member, hp: 10 })),
      phase: { kind: 'battle', enemy: [FIGHTERS[5]!], cpu: 1, boss: null, seed: 1 },
    };
    const battle = { ...createRunBattle(run), winner: 'player' as const };
    const next = finishBattle(deepFreeze(run), battle, RUN_CONTENT);
    expect(next.team.map((member) => member.hp)).toEqual(
      run.team.map((member) => 10 + percentOfMaxHp(member.fighter.stats.hp, VICTORY_HEAL)),
    );
  });

  it('休憩の回復が増える特性も、ふつうのお守りと同じように効く', () => {
    const rest: IrodoriteDef = { ...IRODORITE, trait: { id: 'rest-trait', effect: { type: 'restHeal', percent: 25 } } };
    expect(restHealPercent(chosen(rest))).toBe(REST_HEAL_PERCENT + 25);
    expect(restHealPercent(chosen())).toBe(REST_HEAL_PERCENT);
  });
});
