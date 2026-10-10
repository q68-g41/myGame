/**
 * キャラ（彩霊）のデータ。ふつうのキャラは6色が属性ごとに2体で12体。ほかに、彩り手の相棒（仕様書 4.6）とボスがいる。
 * 名前は和風の世界観での仮置き（仕様書 8）。ID は名前と切り離してあり、名前を変えても ID は変えない
 * （はじめの6体の ID が `〜-trial` なのは、M2 の仮キャラの ID をそのまま使っているため）。
 * 能力値の目安（仕様書 3.2）：HP 80〜120、攻撃・防御・素早さ 30〜70
 */
import type { AttributeId, FighterDef, Stats } from '../engine/types';
import { getMove } from './moves';

/** 画面に出す名前と説明つきのキャラ */
export type FighterData = FighterDef & {
  readonly name: string;
  /** どんな彩霊で、どう戦うか（チーム選択やスカウトの詳細で、絵の横に出す。24文字まで） */
  readonly description: string;
};

function fighter(
  id: string,
  attribute: AttributeId,
  name: string,
  stats: Stats,
  moveIds: readonly string[],
  description: string,
): FighterData {
  return { id, name, description, attribute, stats, moves: moveIds.map(getMove) };
}

/** ふつうのキャラの一覧（スタートの候補・スカウト・ふつうの相手に出る） */
export const FIGHTERS: readonly FighterData[] = [
  // 1体目：属性ごとの基本のキャラ
  fighter('crimson-trial', 'crimson', 'ベニギツネ', { hp: 95, attack: 65, defense: 45, speed: 60 }, [
    'crimson-strike',
    'crimson-burst',
    'quick-jab',
    'focus',
  ], '炎のしっぽの狐。素早く、攻撃が高い'),
  fighter('orange-trial', 'orange', 'ユウヒダヌキ', { hp: 115, attack: 55, defense: 60, speed: 40 }, [
    'orange-strike',
    'orange-burst',
    'green-strike',
    'mend',
  ], '風呂敷を背負った狸。HPが高く、手当てで粘る'),
  fighter('yellow-trial', 'yellow', 'イナホイタチ', { hp: 85, attack: 60, defense: 40, speed: 70 }, [
    'yellow-strike',
    'yellow-burst',
    'quick-dart',
    'hinder',
  ], '稲穂のしっぽのいたち。いちばん速い'),
  fighter('green-trial', 'green', 'ヨモギガエル', { hp: 110, attack: 55, defense: 60, speed: 50 }, [
    'green-strike',
    'green-burst',
    'blue-strike',
    'corrode',
  ], 'よもぎを背負った蛙。HPが高く、侵蝕を使う'),
  fighter('blue-trial', 'blue', 'シズクサギ', { hp: 100, attack: 55, defense: 65, speed: 45 }, [
    'blue-strike',
    'blue-burst',
    'crimson-strike',
    'break',
  ], 'しずく模様の鷺。防御が高く、相手の守りを崩す'),
  fighter('violet-trial', 'violet', 'フジチョウ', { hp: 90, attack: 70, defense: 45, speed: 55 }, [
    'violet-strike',
    'violet-burst',
    'yellow-strike',
    'brace',
  ], '藤の花の羽の蝶。攻撃が高く、打たれ弱い'),
  // 2体目：1体目と役割を変えたキャラ
  fighter('crimson-guard', 'crimson', 'ベニコウラ', { hp: 120, attack: 50, defense: 65, speed: 30 }, [
    'crimson-heavy',
    'crimson-burst',
    'kindle',
    'green-strike',
  ], '漆塗りの甲羅の亀。遅いが、とても硬い'),
  fighter('orange-raider', 'orange', 'カキザル', { hp: 100, attack: 65, defense: 50, speed: 55 }, [
    'orange-heavy',
    'orange-quick',
    'yellow-strike',
    'brace',
  ], '柿を持った身軽な猿。先制技で攻める'),
  fighter('yellow-trickster', 'yellow', 'ナノハナバチ', { hp: 90, attack: 55, defense: 50, speed: 60 }, [
    'yellow-heavy',
    'yellow-burst',
    'violet-strike',
    'dazzle',
  ], '花びらの羽の蜂。速く、相手の攻撃を下げる'),
  fighter('green-charger', 'green', 'タケジカ', { hp: 100, attack: 65, defense: 50, speed: 55 }, [
    'green-heavy',
    'green-quick',
    'crimson-strike',
    'sprout',
  ], '青竹の角の鹿。攻撃寄りで、先制技も使う'),
  fighter('blue-skirmisher', 'blue', 'アオシャチ', { hp: 95, attack: 60, defense: 50, speed: 60 }, [
    'blue-heavy',
    'blue-quick',
    'orange-strike',
    'stillwater',
  ], '波模様のしゃち。速めで、相手を遅くする'),
  fighter('violet-warden', 'violet', 'スミレヘビ', { hp: 105, attack: 60, defense: 60, speed: 50 }, [
    'violet-heavy',
    'violet-quick',
    'corrode',
    'haze',
  ], 'すみれ模様の蛇。守りながら相手を弱らせる'),
];

/**
 * 彩り手の相棒（仕様書 4.6）。その彩り手だけのキャラで、スタートの候補・スカウト・ふつうの相手には出ない。
 * ID は「彩り手の ID-partner」。カラスウサギ2体は、ライバル・クロの相棒（白は守りと回復、黒は速攻）
 */
export const PARTNER_FIGHTERS: readonly FighterData[] = [
  fighter('white-twin', 'white', 'シラハウサギ', { hp: 105, attack: 55, defense: 60, speed: 45 }, [
    'white-strike',
    'white-burst',
    'mend',
    'brace',
  ], '白いカラスウサギ。守りと回復が得意'),
  fighter('black-twin', 'black', 'クロハウサギ', { hp: 90, attack: 60, defense: 45, speed: 60 }, [
    'black-strike',
    'black-burst',
    'violet-quick',
    'hinder',
  ], '黒いカラスウサギ。素早さで攻める'),
  // ヒナの相棒。火照りで攻撃と素早さを上げて攻める
  fighter('hina-partner', 'crimson', 'サクラシバ', { hp: 105, attack: 60, defense: 50, speed: 55 }, [
    'crimson-strike',
    'crimson-burst',
    'quick-jab',
    'kindle',
  ], '桜のしっぽの柴犬。勢いに乗って攻める'),
  // ワタの相棒。速く、崩しで相手の防御を下げる
  fighter('wata-partner', 'yellow', 'キビタキ', { hp: 85, attack: 55, defense: 45, speed: 70 }, [
    'yellow-strike',
    'yellow-burst',
    'quick-dart',
    'break',
  ], '黄色い小鳥。素早く相手の守りを崩す'),
  // ソウの相棒。打たれ強く、朧と手当てで粘る
  fighter('sou-partner', 'violet', 'ヨイミミズク', { hp: 110, attack: 60, defense: 60, speed: 40 }, [
    'violet-strike',
    'violet-burst',
    'haze',
    'mend',
  ], '宵色のミミズク。打たれ強く、粘って戦う'),
  // モリエの相棒。素早く、目くらましで相手の攻撃を下げる
  fighter('morie-partner', 'orange', 'コムギネコ', { hp: 90, attack: 55, defense: 45, speed: 65 }, [
    'orange-strike',
    'orange-burst',
    'orange-quick',
    'dazzle',
  ], '小麦色の猫。すばしこく、相手をまどわす'),
  // ユヒの相棒。闘志で力をためて押し切る
  fighter('yuhi-partner', 'green', 'カラクサジシ', { hp: 110, attack: 65, defense: 55, speed: 45 }, [
    'green-strike',
    'green-burst',
    'focus',
    'sprout',
  ], '唐草模様の獅子。力をためて押し切る'),
  // リンの相棒。静水で相手を遅くしながら戦う
  fighter('rin-partner', 'blue', 'ミナモイヌ', { hp: 100, attack: 55, defense: 55, speed: 55 }, [
    'blue-strike',
    'blue-burst',
    'blue-quick',
    'stillwater',
  ], '水面色の犬。相手の足を止めて戦う'),
];

/**
 * ボスのキャラ。エリアごとに1体で、スタートの候補・スカウト・ふつうの相手には出ない。
 * 1体で3体のチームと戦うので、能力は目安（3.2）より大きい。行動パターンは bosses.ts
 */
export const BOSS_FIGHTERS: readonly FighterData[] = [
  fighter('crimson-boss', 'crimson', 'くすみ大猿', { hp: 320, attack: 65, defense: 50, speed: 55 }, [
    'crimson-strike',
    'crimson-burst',
    'quick-jab',
    'focus',
  ], 'エリア1のボス。くすんだ紅色の大きな猿'),
  fighter('blue-boss', 'blue', 'くすみ大鯉', { hp: 290, attack: 62, defense: 65, speed: 45 }, [
    'blue-strike',
    'blue-burst',
    'corrode',
    'mend',
  ], 'エリア2のボス。くすんだ蒼色の大きな鯉'),
  fighter('violet-boss', 'violet', 'くすみの主', { hp: 360, attack: 78, defense: 65, speed: 65 }, [
    'violet-strike',
    'violet-burst',
    'quick-dart',
    'hinder',
  ], 'エリア3のボス。正体のはっきりしない影'),
];

const FIGHTER_BY_ID: ReadonlyMap<string, FighterData> = new Map(
  [...FIGHTERS, ...PARTNER_FIGHTERS, ...BOSS_FIGHTERS].map((data) => [data.id, data]),
);

/** ID からキャラ（相棒とボスも含む）を取り出す。なければエラー */
export function getFighter(id: string): FighterData {
  const data = FIGHTER_BY_ID.get(id);
  if (!data) {
    throw new Error(`キャラ ${id} のデータがありません`);
  }
  return data;
}
