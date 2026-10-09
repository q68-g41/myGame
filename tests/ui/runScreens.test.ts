// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { RUN_CONTENT } from '../../src/data/content';
import { chooseTeam, runChoices, startRun } from '../../src/engine/run';
import { startApp } from '../../src/ui/app';

const INTERACTIVE = 'button, a, input, select, textarea';

let root: HTMLElement;

function start(seed = 1): void {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.querySelector<HTMLElement>('#app')!;
  startApp(root, { buildId: 'test', newSeed: () => seed });
  root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
}

const candidates = () => [...root.querySelectorAll<HTMLButtonElement>('.candidate')];
const confirmButton = () => root.querySelector<HTMLButtonElement>('.draft__controls .button--primary')!;
const onlyBottomIsInteractive = () => {
  expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
  expect(root.querySelector('.screen__controls')!.querySelectorAll(INTERACTIVE).length).toBeGreaterThan(0);
};

function pickTeam(indices: readonly number[] = [0, 1, 2]): void {
  for (const index of indices) {
    candidates()[index]!.click();
  }
  confirmButton().click();
}

/** 報酬の画面なら、能力強化の選択肢を選んで受け取る（強敵なら2回） */
function takeStatRewards(): void {
  while (root.querySelector('.reward') !== null) {
    const stat = [...root.querySelectorAll<HTMLButtonElement>('.reward-offer')].find(
      (offer) => offer.querySelector('.reward-offer__kind')?.textContent === '能力',
    )!;
    stat.click();
    root.querySelector<HTMLButtonElement>('.reward__controls .button--primary')!.click();
  }
}

/** バトルを決着まで進めて「次へ」を押す（技の先頭か、確認か、控えの先頭をタップし、演出は早送り） */
function finishBattle(): string {
  for (let i = 0; i < 500 && root.querySelector('.result') === null; i += 1) {
    root.querySelector<HTMLElement>('.playback-skip')?.click();
    const target =
      root.querySelector<HTMLButtonElement>('.confirm .button--primary') ??
      root.querySelector<HTMLButtonElement>('.move-button:not([aria-disabled="true"])') ??
      root.querySelector<HTMLButtonElement>('.bench-button:not([disabled])');
    target?.click();
    root.querySelector<HTMLElement>('.playback-skip')?.click();
  }
  const result = root.querySelector('.result__text')!.textContent!;
  root.querySelector<HTMLButtonElement>('.result button')!.click();
  takeStatRewards();
  return result;
}

/**
 * いまの画面を1つ進める：マップは先頭の選択肢、バトルは決着まで、休憩は回復、スカウトは入れ替えない、
 * イベントは最初の選択肢を選んで結果を見る。進めた画面の種類を返す
 */
function playStep(): string {
  const primary = () => root.querySelector<HTMLButtonElement>('.screen__controls .button--primary')!;
  if (root.querySelector('.map-screen')) {
    root.querySelector<HTMLButtonElement>('.map-choice')!.click();
    return 'map';
  }
  if (root.querySelector('.rest')) {
    root.querySelector<HTMLButtonElement>('.node-option')!.click();
    primary().click();
    return 'rest';
  }
  if (root.querySelector('.scout')) {
    root.querySelector<HTMLButtonElement>('.screen__controls .button--secondary')!.click();
    return 'scout';
  }
  if (root.querySelector('.event')) {
    root.querySelector<HTMLButtonElement>('.node-option')!.click();
    primary().click();
    primary().click();
    return 'event';
  }
  finishBattle();
  return 'battle';
}

describe('チーム選択の画面', () => {
  beforeEach(() => start());

  it('候補5体は下半分、選んだチームと詳細は上半分（表示だけ）', () => {
    expect(root.querySelector('.draft')).not.toBeNull();
    expect(candidates()).toHaveLength(5);
    expect(root.querySelector('.screen__controls .candidates')).not.toBeNull();
    expect(root.querySelectorAll('.screen__view .draft-slot')).toHaveLength(3);
    onlyBottomIsInteractive();
  });

  it('候補の一覧と、選んだ順の枠に、キャラの小さい絵（32×32）が出る', () => {
    const icons = [...root.querySelectorAll<HTMLImageElement>('.candidate img.candidate__icon')];
    expect(icons).toHaveLength(5);
    expect(icons.every((icon) => icon.getAttribute('width') === '32')).toBe(true);
    // まだ選んでいない枠は、空の枠
    expect(root.querySelectorAll('.draft-slot img')).toHaveLength(0);
    candidates()[1]!.click();
    const slot = root.querySelector<HTMLImageElement>('.draft-slot img.draft-slot__icon');
    expect(slot?.getAttribute('src')).toBe(icons[1]!.getAttribute('src'));
  });

  it('候補をタップすると、詳細にそのキャラのドット絵が出る（2倍）', () => {
    expect(root.querySelector('.fighter-detail__sprite')).toBeNull();
    candidates()[2]!.click();
    const sprite = root.querySelector<HTMLImageElement>('.screen__view img.fighter-detail__sprite');
    expect(sprite?.getAttribute('width')).toBe('96');
    expect(sprite?.getAttribute('src')).toBeTruthy();
  });

  it('3体選ぶまでは出発できない。タップした順が出る順になり、もう一度タップで外せる', () => {
    expect(confirmButton().disabled).toBe(true);
    candidates()[3]!.click();
    candidates()[1]!.click();
    expect(root.querySelector('.fighter-detail__name')?.textContent).toBe(
      candidates()[1]!.querySelector('.candidate__name')?.textContent,
    );
    candidates()[4]!.click();
    expect(confirmButton().disabled).toBe(false);
    expect(candidates().map((c) => c.querySelector('.candidate__order')?.textContent)).toEqual(['', '2', '', '1', '3']);

    candidates()[1]!.click();
    expect(confirmButton().disabled).toBe(true);
    expect(candidates().map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true', 'true']);
    onlyBottomIsInteractive();
  });

  it('出発すると、選んだ順のチームでマップに進む', () => {
    const names = [3, 0, 4].map((i) => candidates()[i]!.querySelector('.candidate__name')?.textContent);
    pickTeam([3, 0, 4]);
    expect(root.querySelector('.map-screen')).not.toBeNull();
    expect([...root.querySelectorAll('.member__name')].map((n) => n.textContent)).toEqual(names);
  });
});

describe('マップの画面', () => {
  beforeEach(() => {
    start();
    pickTeam();
  });

  it('マップ全体は上半分（表示だけ）、次のマスのボタンとチームのHPは下半分', () => {
    const run = chooseTeam(startRun(RUN_CONTENT, 1), [0, 1, 2]);
    const total = run.map.layers.reduce((sum, layer) => sum + layer.length, 0);
    expect(root.querySelectorAll('.screen__view .map-node')).toHaveLength(total);
    expect(root.querySelectorAll('.screen__controls .map-choice')).toHaveLength(runChoices(run).length);
    expect(root.querySelectorAll('.screen__controls .member')).toHaveLength(3);
    expect(root.querySelector('.map__progress')?.textContent).toBe('エリア1・スタート');
    onlyBottomIsInteractive();
  });

  it('マスには文字の代わりにアイコンの絵、ボスのマスにはボスのドット絵を出す。次のマスのボタンにも同じ絵が出る', () => {
    const nodes = [...root.querySelectorAll<HTMLElement>('.map-node')];
    expect(nodes.every((node) => node.querySelector('img.map-node__icon') !== null)).toBe(true);
    const boss = root.querySelector('.map-node--boss img.map-node__icon');
    expect(boss?.getAttribute('width')).toBe('48');
    const battle = root.querySelector('.map-node--battle img.map-node__icon');
    expect(battle?.getAttribute('width')).toBe('24');
    // 絵を出したマスに、代わりの1文字は出さない（選択肢の A・B だけ）
    expect(root.querySelector('.map-node--boss')?.textContent).toBe('');
    const choiceIcons = [...root.querySelectorAll<HTMLImageElement>('.map-choice img.map-choice__icon')];
    expect(choiceIcons).toHaveLength(root.querySelectorAll('.map-choice').length);
    // 読み上げでは、マスの種類が分かる
    expect(boss?.closest('.map-node')?.getAttribute('aria-label')).toContain('ボス');
  });

  it('選択肢の文字（A・B…）が、マップの進めるマスにも付いている', () => {
    const letters = [...root.querySelectorAll('.map-choice__letter')].map((l) => l.textContent);
    const marked = [...root.querySelectorAll('.map-node--choice .map-node__letter')].map((l) => l.textContent);
    expect(marked).toEqual(letters);
    expect(letters[0]).toBe('A');
  });

  it('戦闘マスを選ぶとバトルになり、勝てば報酬を受け取ってから、HPを持ち越してマップに戻る', () => {
    root.querySelector<HTMLButtonElement>('.map-choice')!.click();
    expect(root.querySelector('.battle__caption')?.textContent).toBe('エリア1・1層目・戦闘');

    const result = finishBattle();
    if (result === 'あなたの負け…') {
      expect(root.querySelector('.run-end')).not.toBeNull();
      return;
    }
    expect(root.querySelector('.map__progress')?.textContent).toBe('エリア1・1層目 / 7層');
    expect(root.querySelector('.map__message')?.textContent).toMatch(/が \d+ 上がった$/);
    expect(root.querySelector('.map-node--current')?.getAttribute('data-layer')).toBe('0');
    // 戦闘のHP（倒れていたら10%で戻る）が、マップのチーム表示に出る
    const hps = [...root.querySelectorAll('.member__hp')].map((hp) => hp.textContent);
    expect(hps.every((hp) => /^HP [1-9]\d* \/ \d+$/.test(hp ?? ''))).toBe(true);
  });
});

describe('ランを最後まで', () => {
  it('どのシードでも、マップとバトルをくり返して、クリアか全滅の画面にたどり着く。どの画面でも操作は下半分だけ', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      start(seed);
      pickTeam();
      const seen = new Set<string>();
      for (let step = 0; step < 50 && root.querySelector('.run-end') === null; step += 1) {
        onlyBottomIsInteractive();
        seen.add(playStep());
      }
      expect(root.querySelector('.run-end')).not.toBeNull();
      expect(root.querySelector('.run-end__title')?.textContent).toMatch(/^(クリア！|全滅…)$/);
      expect(seen.has('battle')).toBe(true);
      onlyBottomIsInteractive();
    }
  });

  it('ランの結果から、新しいランを始めるか、タイトルに戻れる', () => {
    start(1);
    pickTeam();
    for (let step = 0; step < 50 && root.querySelector('.run-end') === null; step += 1) {
      playStep();
    }
    root.querySelector<HTMLButtonElement>('.run-end .button--primary')!.click();
    expect(root.querySelector('.draft')).not.toBeNull();
    expect(candidates().every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(true);

    pickTeam();
    for (let step = 0; step < 50 && root.querySelector('.run-end') === null; step += 1) {
      playStep();
    }
    root.querySelector<HTMLButtonElement>('.run-end .button--secondary')!.click();
    expect(root.querySelector('h1')?.textContent).toBe('彩霊のみち');
  });
});
