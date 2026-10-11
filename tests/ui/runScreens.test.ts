// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTRIBUTE_NAMES } from '../../src/data/attributes';
import { RUN_CONTENT } from '../../src/data/content';
import { getFighter } from '../../src/data/fighters';
import { IRODORITE } from '../../src/data/irodorite';
import { chooseTeam, nodeEnemies, runChoices, startRun } from '../../src/engine/run';
import { startApp } from '../../src/ui/app';

const INTERACTIVE = 'button, a, input, select, textarea';

let root: HTMLElement;

function start(seed = 1): void {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.querySelector<HTMLElement>('#app')!;
  startApp(root, { buildId: 'test', newSeed: () => seed });
  root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
  // 彩り手を選ぶ画面：一覧の1人目（ヒナ。相棒はサクラシバ）で進む
  root.querySelector<HTMLButtonElement>('.irodorite__controls .button--primary')!.click();
}

/** 1人目の彩り手の相棒の名前 */
const PARTNER_NAME = getFighter(IRODORITE[0]!.partner.id).name;

const candidates = () => [...root.querySelectorAll<HTMLButtonElement>('.candidate')];
const confirmButton = () => root.querySelector<HTMLButtonElement>('.draft__controls .button--primary')!;
const onlyBottomIsInteractive = () => {
  expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
  expect(root.querySelector('.screen__controls')!.querySelectorAll(INTERACTIVE).length).toBeGreaterThan(0);
};

function pickTeam(indices: readonly number[] = [0, 1]): void {
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

  it('1番目の枠には、はじめから彩り手の相棒が入っている。候補に相棒は出ない', () => {
    const first = root.querySelector('.draft-slot')!;
    expect(first.classList.contains('draft-slot--partner')).toBe(true);
    expect(first.querySelector('.draft-slot__order')?.textContent).toBe('1 相棒');
    expect(first.querySelector('.draft-slot__name')?.textContent).toBe(PARTNER_NAME);
    expect(candidates().map((c) => c.querySelector('.candidate__name')?.textContent)).not.toContain(PARTNER_NAME);
    expect(root.querySelector('.draft__hint')?.textContent).toBe('相棒に続けて2体。長押しで説明だけ見られます');
  });

  it('候補の一覧と、選んだ順の枠に、キャラの小さい絵（32×32）が出る', () => {
    const icons = [...root.querySelectorAll<HTMLImageElement>('.candidate img.candidate__icon')];
    expect(icons).toHaveLength(5);
    expect(icons.every((icon) => icon.getAttribute('width') === '32')).toBe(true);
    // 相棒の枠だけ絵があり、まだ選んでいない枠は空の枠
    expect(root.querySelectorAll('.draft-slot img')).toHaveLength(1);
    candidates()[1]!.click();
    const slot = root.querySelectorAll<HTMLImageElement>('.draft-slot img.draft-slot__icon')[1];
    expect(slot?.getAttribute('src')).toBe(icons[1]!.getAttribute('src'));
  });

  it('候補をタップすると、詳細にそのキャラのドット絵が出る（2倍）', () => {
    expect(root.querySelector('.fighter-detail__sprite')).toBeNull();
    candidates()[2]!.click();
    const sprite = root.querySelector<HTMLImageElement>('.screen__view img.fighter-detail__sprite');
    expect(sprite?.getAttribute('width')).toBe('96');
    expect(sprite?.getAttribute('src')).toBeTruthy();
  });

  it('候補のボタンと詳細には、属性の色を --card-color で渡す（板の色と名前の前の菱形に使う。M7-4）', () => {
    const color = (element: Element | null) => (element as HTMLElement | null)?.style.getPropertyValue('--card-color');
    expect(candidates().every((candidate) => /^#[0-9a-f]{6}$/i.test(color(candidate) ?? ''))).toBe(true);
    candidates()[2]!.click();
    expect(color(root.querySelector('.fighter-detail'))).toBe(color(candidates()[2]!));
  });

  it('相棒のあとに2体選ぶまでは出発できない。タップした順が出る順になり、3体目は選べず、もう一度タップで外せる', () => {
    expect(confirmButton().disabled).toBe(true);
    candidates()[3]!.click();
    expect(confirmButton().disabled).toBe(true);
    candidates()[1]!.click();
    expect(root.querySelector('.fighter-detail__name')?.textContent).toBe(
      candidates()[1]!.querySelector('.candidate__name')?.textContent,
    );
    expect(confirmButton().disabled).toBe(false);
    // 2体選んだあとは、ほかの候補をタップしても選ばない（詳細だけ変わる）。候補の数字は、相棒のあとの出る順（2・3）
    candidates()[4]!.click();
    expect(candidates().map((c) => c.querySelector('.candidate__order')?.textContent)).toEqual(['', '3', '', '2', '']);

    candidates()[1]!.click();
    expect(confirmButton().disabled).toBe(true);
    expect(candidates().map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true', 'false']);
    onlyBottomIsInteractive();
  });

  it('詳細には、キャラの説明が出る', () => {
    candidates()[0]!.click();
    expect(root.querySelector('.screen__view .fighter-detail__description')?.textContent).toMatch(/。/);
  });

  describe('長押し', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    const press = (target: Element) => target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const release = (target: Element) => target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    it('候補を長押しすると、選ばずに詳細だけ出る。指を離したあとも出したまま', () => {
      const name = candidates()[3]!.querySelector('.candidate__name')?.textContent;
      press(candidates()[3]!);
      vi.advanceTimersByTime(500);
      expect(root.querySelector('.fighter-detail__name')?.textContent).toBe(name);
      release(candidates()[3]!);
      candidates()[3]!.click();
      expect(candidates().map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false', 'false']);
      expect(root.querySelector('.fighter-detail__name')?.textContent).toBe(name);
      onlyBottomIsInteractive();
    });

    it('選び終えたあとでも、長押しで選んでいない候補の詳細を見られる。選んだチームは変わらない', () => {
      for (const index of [0, 1]) {
        candidates()[index]!.click();
      }
      press(candidates()[4]!);
      vi.advanceTimersByTime(500);
      release(candidates()[4]!);
      candidates()[4]!.click();
      expect(root.querySelector('.fighter-detail__name')?.textContent).toBe(
        candidates()[4]!.querySelector('.candidate__name')?.textContent,
      );
      expect(candidates().map((c) => c.querySelector('.candidate__order')?.textContent)).toEqual(['2', '3', '', '', '']);
    });

    it('すぐ離した（短いタップ）なら、今までどおり選ぶ', () => {
      press(candidates()[2]!);
      vi.advanceTimersByTime(100);
      release(candidates()[2]!);
      candidates()[2]!.click();
      expect(candidates()[2]!.getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('出発すると、相棒が先頭で、そのあとに選んだ順のチームでマップに進む', () => {
    const names = [3, 0].map((i) => candidates()[i]!.querySelector('.candidate__name')?.textContent);
    pickTeam([3, 0]);
    expect(root.querySelector('.map-screen')).not.toBeNull();
    expect([...root.querySelectorAll('.member__name')].map((n) => n.textContent)).toEqual([PARTNER_NAME, ...names]);
  });
});

describe('マップの画面', () => {
  beforeEach(() => {
    start();
    pickTeam();
  });

  it('マップ全体は上半分（表示だけ）、次のマスのボタンとチームのHPは下半分', () => {
    const run = chooseTeam(startRun(RUN_CONTENT, 1, IRODORITE[0]!), [0, 1]);
    const total = run.map.layers.reduce((sum, layer) => sum + layer.length, 0);
    expect(root.querySelectorAll('.screen__view .map-node')).toHaveLength(total);
    expect(root.querySelectorAll('.screen__controls .map-choice')).toHaveLength(runChoices(run).length);
    expect(root.querySelectorAll('.screen__controls .member')).toHaveLength(3);
    // チームの一覧には、キャラの小さい絵（32×32）を出す
    const icons = [...root.querySelectorAll<HTMLImageElement>('.screen__controls .member img.member__icon')];
    expect(icons).toHaveLength(3);
    expect(icons.every((icon) => icon.getAttribute('width') === '32')).toBe(true);
    expect(root.querySelector('.map__progress')?.textContent).toBe('エリア1・スタート');
    onlyBottomIsInteractive();
  });

  describe('チームの並び順', () => {
    const members = () => [...root.querySelectorAll<HTMLButtonElement>('.screen__controls button.member')];
    const names = () => members().map((card) => card.querySelector('.member__name')?.textContent);

    it('チームのカードはボタン（下半分）。2体をタップすると、出る順が入れ替わる', () => {
      const before = names();
      expect(members()).toHaveLength(3);
      members()[0]!.click();
      expect(members()[0]!.getAttribute('aria-pressed')).toBe('true');
      expect(root.querySelector('.map__message')?.textContent).toBe(`${before[0]}と入れ替える仲間を選んでください`);
      members()[2]!.click();
      expect(names()).toEqual([before[2], before[1], before[0]]);
      expect(members().map((card) => card.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
      expect(root.querySelector('.map__message')?.textContent).toBe('進むマスを選んでください');
      onlyBottomIsInteractive();
    });

    it('同じカードをもう一度タップすると、選ぶのをやめる（入れ替えない）', () => {
      const before = names();
      members()[1]!.click();
      members()[1]!.click();
      expect(names()).toEqual(before);
      expect(members()[1]!.getAttribute('aria-pressed')).toBe('false');
    });

    it('入れ替えたあとの戦闘では、新しい先頭のキャラから場に出る', () => {
      const before = names();
      members()[0]!.click();
      members()[1]!.click();
      root.querySelector<HTMLButtonElement>('.map-choice')!.click();
      expect(root.querySelector('.battle')).not.toBeNull();
      expect(root.querySelector('.fighter--player .fighter__name')?.textContent).toBe(before[1]);
    });
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

  it('ヒント：戦うマスの下に先頭の相手の属性の色、選ぶボタンに「先頭」と属性の名前を出す（1体目だけ。仕様書 4.3）', () => {
    const run = chooseTeam(startRun(RUN_CONTENT, 1, IRODORITE[0]!), [0, 1]);
    const leadName = (index: number) => ATTRIBUTE_NAMES[nodeEnemies(run, { layer: 0, index })![0]!.attribute];
    const chips = [...root.querySelectorAll('.screen__controls .map-choice')].map((choice) => [
      choice.querySelector('.map-choice__hint-label')?.textContent,
      ...[...choice.querySelectorAll('.enemy-chip')].map((chip) => chip.textContent),
    ]);
    expect(chips).toEqual(runChoices(run).map((index) => ['先頭', leadName(index)]));
    // マップでは、戦うマス（戦闘・強敵・ボス）にだけ、色の四角が1つ付く
    for (const node of root.querySelectorAll<HTMLElement>('.screen__view .map-node')) {
      const fights = ['battle', 'elite', 'boss', 'rival'].some((kind) => node.classList.contains(`map-node--${kind}`));
      expect(node.querySelectorAll('.map-node__pip'), node.className).toHaveLength(fights ? 1 : 0);
    }
    const first = root.querySelector<HTMLElement>('.map-node[data-layer="0"][data-index="0"]')!;
    expect(first.getAttribute('aria-label')).toContain(`先頭の相手：${leadName(0)}`);
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
      // 選んだ彩り手（1人目のヒナ）の絵（2倍）とあだ名
      expect(root.querySelector('.run-end__name')?.textContent).toBe('ヒナ');
      expect(root.querySelector('img.run-end__portrait')?.getAttribute('width')).toBe('128');
      expect(seen.has('battle')).toBe(true);
      onlyBottomIsInteractive();
    }
  });

  it('ランの結果から、新しいラン（彩り手を選ぶところから）を始めるか、タイトルに戻れる', () => {
    start(1);
    pickTeam();
    for (let step = 0; step < 50 && root.querySelector('.run-end') === null; step += 1) {
      playStep();
    }
    // もう一度遊ぶときも、彩り手を選ぶところから
    root.querySelector<HTMLButtonElement>('.run-end .button--primary')!.click();
    expect(root.querySelector('.irodorite')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.irodorite__controls .button--primary')!.click();
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
