// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { RUN_CONTENT } from '../../src/data/content';
import { AREA_SKIES, DEFAULT_SKY } from '../../src/data/sky';
import { AREA_COUNT } from '../../src/engine/constants';
import { chooseTeam, startRun, type RunState } from '../../src/engine/run';
import { skyOf } from '../../src/ui/sky';
import { startApp } from '../../src/ui/app';
import { startAppBattle, startAppDraft } from '../helpers/app';

describe('画面の空（背景）を決める（仕様書 5）', () => {
  const draft = startRun(RUN_CONTENT, 1);
  const map = chooseTeam(draft, [0, 1, 2]);

  it('エリアごとに空があり、どれも違う', () => {
    expect(AREA_SKIES).toHaveLength(AREA_COUNT);
    expect(new Set(AREA_SKIES).size).toBe(AREA_COUNT);
  });

  it('ランの外（トップ・彩り手を選ぶ）とチーム選択は、決まった空', () => {
    expect(skyOf(null)).toBe(DEFAULT_SKY);
    expect(skyOf(draft)).toBe(DEFAULT_SKY);
  });

  it('ランの途中は、いまのエリアの空', () => {
    expect(map.phase.kind).toBe('map');
    AREA_SKIES.forEach((sky, area) => {
      expect(skyOf({ ...map, area })).toBe(sky);
    });
  });

  it('ランが終わったら、決まった空に戻る', () => {
    const ended: RunState = { ...map, phase: { kind: 'ended', result: 'defeated' } };
    expect(skyOf(ended)).toBe(DEFAULT_SKY);
  });
});

describe('アプリは、画面の根元に空を書く', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
  });

  it('トップ画面とチーム選択は決まった空、マップとバトルはエリア1の空', () => {
    startApp(root, { buildId: 'test', newSeed: () => 1 });
    expect(root.dataset.sky).toBe(DEFAULT_SKY);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    startAppDraft(root);
    expect(root.dataset.sky).toBe(DEFAULT_SKY);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    startAppBattle(root);
    expect(root.querySelector('.battle')).not.toBeNull();
    expect(root.dataset.sky).toBe(AREA_SKIES[0]);
  });
});
