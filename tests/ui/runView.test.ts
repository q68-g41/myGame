import { describe, expect, it } from 'vitest';
import { BOSSES } from '../../src/data/bosses';
import { RUN_CONTENT } from '../../src/data/content';
import { FIGHTERS } from '../../src/data/fighters';
import type { AreaMap } from '../../src/engine/map';
import { chooseTeam, enterNode, startRun, type RunState } from '../../src/engine/run';
import {
  battleCaption,
  buildDraftView,
  buildMapView,
  buildRunEndView,
  fighterDetail,
  focusDraftCandidate,
  INITIAL_DRAFT_UI,
  toggleDraftPick,
} from '../../src/ui/runView';
import { MAP_ICON_SIZE, mapIconUrl, SPRITE_SIZE, spriteUrl } from '../../src/ui/sprites';

/** テスト用のマップ：1層目 2マス → 2層目 3マス → ボス */
const MAP: AreaMap = {
  layers: [
    [
      { kind: 'battle', next: [0, 1] },
      { kind: 'battle', next: [2] },
    ],
    [
      { kind: 'event', next: [0] },
      { kind: 'elite', next: [0] },
      { kind: 'scout', next: [0] },
    ],
    [{ kind: 'boss', next: [] }],
  ],
};

const team = FIGHTERS.slice(0, 3).map((fighter) => ({ fighter, hp: fighter.stats.hp }));
const runAt = (position: RunState['position'], phase: RunState['phase'] = { kind: 'map' }): RunState => ({
  area: 0,
  map: MAP,
  position,
  team,
  charms: [],
  irodorite: null,
  phase,
  rng: 1,
});

describe('チーム選択', () => {
  it('タップした順に選び、もう一度タップで外す。3体選んだら、それ以上は選ばない', () => {
    let ui = INITIAL_DRAFT_UI;
    for (const index of [3, 0, 4]) {
      ui = toggleDraftPick(ui, index);
    }
    expect(ui).toEqual({ picks: [3, 0, 4], focused: 4 });
    expect(toggleDraftPick(ui, 1)).toEqual({ picks: [3, 0, 4], focused: 1 });
    expect(toggleDraftPick(ui, 3)).toEqual({ picks: [0, 4], focused: 3 });
  });

  it('候補・選んだ順・詳細・出発できるかを出す', () => {
    const run = startRun(RUN_CONTENT, 1);
    const empty = buildDraftView(run);
    expect(empty.candidates).toHaveLength(5);
    expect(empty.candidates.every((c) => c.order === null)).toBe(true);
    expect(empty.slots.map((slot) => slot.name)).toEqual([null, null, null]);
    expect(empty.detail).toBeNull();
    expect(empty.canConfirm).toBe(false);

    const view = buildDraftView(run, { picks: [2, 0], focused: 0 });
    expect(view.candidates.map((c) => c.order)).toEqual([2, null, 1, null, null]);
    expect(view.slots.map((slot) => slot.order)).toEqual([1, 2, 3]);
    expect(view.slots[0]!.name).toBe(view.candidates[2]!.name);
    expect(view.slots[2]!.name).toBeNull();
    expect(view.detail?.name).toBe(view.candidates[0]!.name);
    expect(view.canConfirm).toBe(false);
    expect(buildDraftView(run, { picks: [2, 0, 1], focused: 1 }).canConfirm).toBe(true);
  });

  it('長押しでは、選んだかどうかを変えずに、詳細だけそのキャラにする', () => {
    const picked = toggleDraftPick(toggleDraftPick(INITIAL_DRAFT_UI, 0), 2);
    expect(focusDraftCandidate(picked, 4)).toEqual({ picks: [0, 2], focused: 4 });
    expect(focusDraftCandidate(INITIAL_DRAFT_UI, 1)).toEqual({ picks: [], focused: 1 });
  });

  it('詳細には、属性・説明・能力・技（種類と威力、補助技は効果）を出す', () => {
    const crimson = FIGHTERS.find((fighter) => fighter.id === 'crimson-trial')!;
    expect(fighterDetail(crimson)).toEqual({
      name: 'ベニギツネ',
      color: expect.any(String),
      sprite: spriteUrl('crimson-trial'),
      attributeName: '紅属性',
      description: '炎のしっぽの狐。素早く、攻撃が高い',
      stats: 'HP 95・攻撃 65・防御 45・素早さ 60',
      moves: ['緋の爪（通常・威力60）', '紅炎落とし（大技・威力100）', '火花突き（先制・威力35）', '闘志（補助・攻撃↑2）'],
    });
  });
});

describe('マップ', () => {
  it('スタートでは、1層目のマスが A・B の選択肢になり、その先のマスは「この先にある」', () => {
    const view = buildMapView(runAt(null));
    expect(view.progress).toBe('エリア1・スタート');
    expect(view.message).toBe('進むマスを選んでください');
    const battleIcon = { url: mapIconUrl('battle'), size: MAP_ICON_SIZE };
    expect(view.choices).toEqual([
      { index: 0, letter: 'A', name: '戦闘', icon: battleIcon },
      { index: 1, letter: 'B', name: '戦闘', icon: battleIcon },
    ]);
    expect(view.layers[0]!.map((node) => [node.state, node.letter])).toEqual([
      ['choice', 'A'],
      ['choice', 'B'],
    ]);
    expect(view.layers[1]!.every((node) => node.state === 'reachable')).toBe(true);
    expect(view.layers[2]![0]).toMatchObject({ state: 'reachable', mark: 'ボ', name: 'ボス' });
  });

  it('マスにはアイコンの絵（24×24）を出す。ボスのマスは、そのエリアのボスのドット絵（48×48）', () => {
    const view = buildMapView(runAt(null));
    expect(view.layers[0]![0]!.icon).toEqual({ url: mapIconUrl('battle'), size: MAP_ICON_SIZE });
    expect(view.layers[2]![0]!.icon).toEqual({ url: spriteUrl(BOSSES[0]!.fighter.id), size: SPRITE_SIZE });
    // エリアが変わると、ボスの絵も変わる
    const area2 = buildMapView({ ...runAt(null), area: 1 });
    expect(area2.layers[2]![0]!.icon?.url).toBe(spriteUrl(BOSSES[1]!.fighter.id));
  });

  it('マスにいるときは、いまのマス・進めるマス・通り過ぎたマス・たどり着けないマスを分ける', () => {
    const view = buildMapView(runAt({ layer: 0, index: 0 }), '戦闘に勝った！');
    expect(view.progress).toBe('エリア1・1層目 / 3層');
    expect(view.message).toBe('戦闘に勝った！');
    expect(view.layers[0]!.map((node) => node.state)).toEqual(['current', 'passed']);
    expect(view.layers[1]!.map((node) => [node.state, node.letter])).toEqual([
      ['choice', 'A'],
      ['choice', 'B'],
      ['unreachable', null],
    ]);
    expect(view.choices.map((choice) => choice.name)).toEqual(['イベント', '強敵']);
  });

  it('チームのHPを出す', () => {
    const hurt = { ...runAt(null), team: [{ ...team[0]!, hp: 12 }, team[1]!, { ...team[2]!, hp: 0 }] };
    expect(buildMapView(hurt).team.map((m) => [m.name, m.hp, m.maxHp])).toEqual([
      ['ベニギツネ', 12, 95],
      ['ユウヒダヌキ', 115, 115],
      ['イナホイタチ', 0, 85],
    ]);
  });

  it('バトル画面には、いまのマスの層と種類を出す', () => {
    expect(battleCaption(runAt({ layer: 1, index: 1 }))).toBe('エリア1・2層目・強敵');
    expect(battleCaption({ ...runAt({ layer: 1, index: 1 }), area: 2 })).toBe('エリア3・2層目・強敵');
    expect(battleCaption(runAt(null))).toBeNull();
  });
});

describe('ランの結果', () => {
  it('クリアと全滅で、見出しと文章を変える', () => {
    const cleared = buildRunEndView(runAt({ layer: 2, index: 0 }, { kind: 'ended', result: 'cleared' }));
    expect(cleared).toMatchObject({ result: 'cleared', title: 'クリア！', message: '3つのエリアを突破した！' });
    const defeated = buildRunEndView(runAt({ layer: 1, index: 1 }, { kind: 'ended', result: 'defeated' }));
    expect(defeated).toMatchObject({ result: 'defeated', title: '全滅…', message: 'エリア1・2層目・強敵で全滅した' });
    expect(defeated.team).toHaveLength(3);
  });

  it('終わっていないランや、チーム選択でないときに作ろうとするとエラー', () => {
    expect(() => buildRunEndView(runAt(null))).toThrow('終わっていません');
    expect(() => buildDraftView(runAt(null))).toThrow('チームを選ぶ段階ではありません');
  });

  it('本物のランでも組み立てられる', () => {
    const run = enterNode(chooseTeam(startRun(RUN_CONTENT, 5), [0, 1, 2]), 0, RUN_CONTENT);
    expect(buildMapView({ ...run, phase: { kind: 'map' } }).layers).toHaveLength(7);
  });
});
