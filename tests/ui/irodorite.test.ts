// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { RUN_CONTENT } from '../../src/data/content';
import { IRODORITE } from '../../src/data/irodorite';
import { chooseTeam, startRun } from '../../src/engine/run';
import { startApp } from '../../src/ui/app';
import { buildIrodoriteSelectView, INITIAL_IRODORITE_UI, selectIrodorite } from '../../src/ui/irodoriteView';
import { charmNames } from '../../src/ui/runView';

const INTERACTIVE = 'button, a, input, select, textarea';

/** 一覧の中の、その彩り手の位置 */
const indexOf = (id: string): number => IRODORITE.findIndex((data) => data.id === id);

describe('彩り手を選ぶ画面に出す内容（仕様書 4.6・5）', () => {
  it('一覧は彩り手の表の順で、はじめは1人目を選んでいる', () => {
    const view = buildIrodoriteSelectView(IRODORITE);
    expect(view.choices.map((choice) => choice.name)).toEqual(IRODORITE.map((data) => data.name));
    expect(view.choices[0]!.name).toBe('ヒナ');
    expect(view.choices.map((choice) => choice.selected)).toEqual(IRODORITE.map((_data, index) => index === 0));
    expect(view.choices.every((choice) => typeof choice.portrait === 'string')).toBe(true);
  });

  it('選んでいる彩り手の、あだ名・口ぐせ・特性と、相棒の詳細', () => {
    const wata = indexOf('wata');
    const view = buildIrodoriteSelectView(IRODORITE, selectIrodorite(INITIAL_IRODORITE_UI, wata));
    expect(view.choices.map((choice) => choice.selected)).toEqual(IRODORITE.map((_data, index) => index === wata));
    expect(view.detail).toMatchObject({
      name: 'ワタ',
      catchphrase: '道具は、使う人の器を映す鏡',
      traitName: '遠眼鏡',
      traitDescription: '相手の技が有利な相性のとき、受けるダメージ -15%',
    });
    expect(view.detail.partner.name).toBe('キビタキ');
    expect(view.detail.partner.moves).toHaveLength(4);
  });

  it('いない彩り手を選んでいるとエラー', () => {
    expect(() => buildIrodoriteSelectView(IRODORITE, { selected: 99 })).toThrow('99');
  });

  it('お守りの行には、彩り手の特性を先に「（特性）」を付けて出す', () => {
    const run = chooseTeam(startRun(RUN_CONTENT, 1, IRODORITE[indexOf('sou')]!), [0, 1]);
    expect(charmNames(run)).toEqual(['段取りの帳面（特性）']);
    expect(charmNames(chooseTeam(startRun(RUN_CONTENT, 1), [0, 1, 2]))).toEqual([]);
  });
});

describe('彩り手を選ぶ画面', () => {
  let root: HTMLElement;
  const choices = () => [...root.querySelectorAll<HTMLButtonElement>('.irodorite-choice')];

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>('#app')!;
    startApp(root, { buildId: 'test', newSeed: () => 1 });
    root.querySelector<HTMLButtonElement>('.screen__controls button')!.click();
  });

  it('「はじめる」のあと、チーム選択の前に出る。見出し・一覧・進むボタンは下半分、詳細は上半分（表示だけ）', () => {
    expect(root.querySelector('.irodorite')).not.toBeNull();
    expect(root.querySelector('.draft')).toBeNull();
    expect(choices()).toHaveLength(IRODORITE.length);
    expect(root.querySelector('.screen__view')!.querySelectorAll(INTERACTIVE)).toHaveLength(0);
    expect(root.querySelector('.screen__controls .irodorite__title')?.textContent).toBe('彩り手を選ぶ');
    expect(root.querySelector('.screen__controls .irodorite__hint')?.textContent).toBe('相棒はチームの1番目に入り、外せません');
    expect(root.querySelector('.screen__controls .irodorite-choices')).not.toBeNull();
    expect(root.querySelector('.screen__controls .button--primary')?.textContent).toBe('この彩り手で進む');
  });

  it('彩り手の絵は、詳細では2倍（128）、一覧では等倍（64）', () => {
    expect(root.querySelector('.screen__view img.irodorite-detail__portrait')?.getAttribute('width')).toBe('128');
    const portraits = [...root.querySelectorAll<HTMLImageElement>('.irodorite-choice img.irodorite-choice__portrait')];
    expect(portraits).toHaveLength(IRODORITE.length);
    expect(portraits.every((img) => img.getAttribute('width') === '64')).toBe(true);
  });

  it('上半分に、あだ名・口ぐせ・特性と、相棒の詳細（ドット絵2倍・説明・能力・技）が出る', () => {
    expect(root.querySelector('.irodorite-detail__name')?.textContent).toBe('ヒナ');
    expect(root.querySelector('.irodorite-detail__catchphrase')?.textContent).toBe('「宣伝！！！」');
    expect(root.querySelector('.irodorite-detail__trait')?.textContent).toBe('特性宣伝の旗紅属性の技の威力 +20%');
    // 相棒の詳細には、属性の前に「相棒」と出す
    expect(root.querySelector('.screen__view .fighter-detail__name')?.textContent).toBe('サクラシバ');
    expect(root.querySelector('.screen__view .fighter-detail__attribute')?.textContent).toBe('相棒・紅属性');
    expect(root.querySelector('.screen__view img.fighter-detail__sprite')?.getAttribute('width')).toBe('96');
    expect(root.querySelectorAll('.screen__view .fighter-detail__moves li')).toHaveLength(4);
  });

  it('一覧をタップすると、その彩り手を選ぶ（詳細が変わる）', () => {
    const sou = indexOf('sou');
    choices()[sou]!.click();
    expect(choices().map((choice) => choice.getAttribute('aria-pressed'))).toEqual(
      IRODORITE.map((_data, index) => String(index === sou)),
    );
    expect(root.querySelector('.irodorite-detail__name')?.textContent).toBe('ソウ');
    expect(root.querySelector('.screen__view .fighter-detail__name')?.textContent).toBe('ヨイミミズク');
  });

  it('一覧をスクロールしてから選んでも、一覧のスクロール位置はそのまま（先頭に戻らない）', () => {
    root.querySelector<HTMLElement>('.irodorite-choices')!.scrollTop = 150;
    choices()[indexOf('kai')]!.click();
    expect(root.querySelector('.irodorite-detail__name')?.textContent).toBe('カイ');
    expect(root.querySelector<HTMLElement>('.irodorite-choices')!.scrollTop).toBe(150);
  });

  it('「この彩り手で進む」で、選んだ彩り手の相棒が1番目に入ったチーム選択になる', () => {
    choices()[indexOf('wata')]!.click();
    root.querySelector<HTMLButtonElement>('.irodorite__controls .button--primary')!.click();
    expect(root.querySelector('.draft')).not.toBeNull();
    expect(root.querySelector('.draft-slot--partner .draft-slot__name')?.textContent).toBe('キビタキ');
  });
});
