/**
 * ランの画面（チーム選択・マップ・ランの結果）に出す内容を、ランの状態から組み立てる（DOM は使わない）。
 */
import { ATTRIBUTE_COLORS, ATTRIBUTE_NAMES } from '../data/attributes';
import { getCharm } from '../data/charms';
import { getFighter } from '../data/fighters';
import { NODE_KIND_MARKS, NODE_KIND_NAMES, STAT_NAMES } from '../data/labels';
import { getMove } from '../data/moves';
import { AREA_COUNT, MAX_MOVES, RUN_TEAM_SIZE } from '../engine/constants';
import { nodeAt, type MapPosition, type NodeKind } from '../engine/map';
import { isAttackMove } from '../engine/moves';
import {
  runChoices,
  type RewardChoice,
  type RewardOffer,
  type RunMember,
  type RunResult,
  type RunState,
  type StatBoostKey,
} from '../engine/run';
import type { FighterDef, MoveDef } from '../engine/types';
import { MOVE_KIND_NAMES, summarizeEffects } from './moveInfo';
import { spriteUrl } from './sprites';

/** チームの1体の表示（HPつき） */
export interface TeamMemberView {
  readonly name: string;
  readonly color: string;
  readonly hp: number;
  readonly maxHp: number;
}

/* ===== チーム選択 ===== */

/** チーム選択で、画面だけが持つ状態 */
export interface DraftUiState {
  /** 選んだ候補の位置（選んだ順＝戦闘に出る順） */
  readonly picks: readonly number[];
  /** 最後にタップした候補（詳細を出す）。まだなければ null */
  readonly focused: number | null;
}

export const INITIAL_DRAFT_UI: DraftUiState = { picks: [], focused: null };

/** 候補のボタン */
export interface CandidateView {
  readonly index: number;
  readonly name: string;
  readonly color: string;
  readonly attributeName: string;
  /** 選んだ順番（1〜3）。選んでいなければ null */
  readonly order: number | null;
}

/** 候補の詳細（能力と技） */
export interface FighterDetailView {
  readonly name: string;
  readonly color: string;
  /** ドット絵の URL。絵がなければ null（属性の色の四角を出す） */
  readonly sprite: string | null;
  /** 例：「紅属性」 */
  readonly attributeName: string;
  /** 例：「HP 95・攻撃 65・防御 45・素早さ 60」 */
  readonly stats: string;
  /** 例：「紅撃（通常・威力60）」 */
  readonly moves: readonly string[];
}

/** 選んだチームの枠（1〜3番目） */
export interface DraftSlotView {
  readonly order: number;
  /** 選んだキャラ。まだなら null */
  readonly name: string | null;
  readonly color: string | null;
}

export interface DraftView {
  readonly candidates: readonly CandidateView[];
  readonly slots: readonly DraftSlotView[];
  readonly detail: FighterDetailView | null;
  /** 3体選んで、出発できるか */
  readonly canConfirm: boolean;
}

/** 技の種類と威力（補助技は効果）。例：「通常・威力60」「補助・攻撃↑2」 */
export function moveSummary(move: MoveDef): string {
  return isAttackMove(move)
    ? `${MOVE_KIND_NAMES[move.kind]}・威力${move.power}`
    : `${MOVE_KIND_NAMES[move.kind]}・${summarizeEffects(move.effects)}`;
}

function moveLine(fighter: FighterDef, index: number): string {
  const move = fighter.moves[index]!;
  return `${getMove(move.id).name}（${moveSummary(move)}）`;
}

/** キャラの能力と技の詳細 */
export function fighterDetail(fighter: FighterDef): FighterDetailView {
  const { stats } = fighter;
  return {
    name: getFighter(fighter.id).name,
    color: ATTRIBUTE_COLORS[fighter.attribute],
    sprite: spriteUrl(fighter.id),
    attributeName: `${ATTRIBUTE_NAMES[fighter.attribute]}属性`,
    stats: [
      `HP ${stats.hp}`,
      `${STAT_NAMES.attack} ${stats.attack}`,
      `${STAT_NAMES.defense} ${stats.defense}`,
      `${STAT_NAMES.speed} ${stats.speed}`,
    ].join('・'),
    moves: fighter.moves.map((_move, index) => moveLine(fighter, index)),
  };
}

/** 候補をタップしたあとの状態。選んでいれば外し、3体に満たなければ選ぶ。どちらでも詳細はそのキャラにする */
export function toggleDraftPick(ui: DraftUiState, index: number): DraftUiState {
  if (ui.picks.includes(index)) {
    return { picks: ui.picks.filter((pick) => pick !== index), focused: index };
  }
  const picks = ui.picks.length < RUN_TEAM_SIZE ? [...ui.picks, index] : ui.picks;
  return { picks, focused: index };
}

export function buildDraftView(run: RunState, ui: DraftUiState = INITIAL_DRAFT_UI): DraftView {
  if (run.phase.kind !== 'draft') {
    throw new Error('いまはチームを選ぶ段階ではありません');
  }
  const { candidates } = run.phase;
  const focused = ui.focused === null ? undefined : candidates[ui.focused];
  return {
    candidates: candidates.map((fighter, index) => {
      const order = ui.picks.indexOf(index);
      return {
        index,
        name: getFighter(fighter.id).name,
        color: ATTRIBUTE_COLORS[fighter.attribute],
        attributeName: ATTRIBUTE_NAMES[fighter.attribute],
        order: order < 0 ? null : order + 1,
      };
    }),
    slots: Array.from({ length: RUN_TEAM_SIZE }, (_, i): DraftSlotView => {
      const pick = ui.picks[i];
      const fighter = pick === undefined ? undefined : candidates[pick];
      return {
        order: i + 1,
        name: fighter ? getFighter(fighter.id).name : null,
        color: fighter ? ATTRIBUTE_COLORS[fighter.attribute] : null,
      };
    }),
    detail: focused ? fighterDetail(focused) : null,
    canConfirm: ui.picks.length === RUN_TEAM_SIZE,
  };
}

/* ===== マップ ===== */

/**
 * マスの見え方。
 * - current：いまいるマス
 * - choice：次に進めるマス
 * - reachable：この先たどり着けるマス
 * - passed：通り過ぎた層のマス
 * - unreachable：もうたどり着けないマス
 */
export type MapNodeState = 'current' | 'choice' | 'reachable' | 'passed' | 'unreachable';

export interface MapNodeView {
  readonly layer: number;
  readonly index: number;
  readonly kind: NodeKind;
  /** マスに出す1文字 */
  readonly mark: string;
  readonly name: string;
  readonly state: MapNodeState;
  /** 次に進めるマスなら、下の選択ボタンと同じ文字（A・B・C）。それ以外は null */
  readonly letter: string | null;
  /** つながっている次の層のマス */
  readonly next: readonly number[];
}

/** 次のマスを選ぶボタン */
export interface MapChoiceView {
  readonly index: number;
  readonly letter: string;
  readonly name: string;
}

export interface MapView {
  /** layers[0] がいちばん下の層 */
  readonly layers: readonly (readonly MapNodeView[])[];
  readonly choices: readonly MapChoiceView[];
  readonly team: readonly TeamMemberView[];
  /** 持っているお守りの名前 */
  readonly charms: readonly string[];
  /** 下半分に出す案内1行 */
  readonly message: string;
  /** 例：「エリア2・3層目 / 7層」。そのエリアでまだどのマスにも入っていなければ「エリア2・スタート」 */
  readonly progress: string;
}

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function charmNames(run: RunState): string[] {
  return run.charms.map((charm) => getCharm(charm.id).name);
}

export function teamViews(team: readonly RunMember[]): TeamMemberView[] {
  return team.map((member) => ({
    name: getFighter(member.fighter.id).name,
    color: ATTRIBUTE_COLORS[member.fighter.attribute],
    hp: member.hp,
    maxHp: member.fighter.stats.hp,
  }));
}

/** 次に進めるマスから、この先たどり着けるマスを層ごとに集める */
function reachableFrom(run: RunState, layer: number, choices: readonly number[]): ReadonlySet<string> {
  const reached = new Set<string>();
  let frontier = choices;
  for (let l = layer; l < run.map.layers.length && frontier.length > 0; l += 1) {
    const next = new Set<number>();
    for (const index of frontier) {
      reached.add(`${l}-${index}`);
      for (const n of nodeAt(run.map, { layer: l, index }).next) {
        next.add(n);
      }
    }
    frontier = [...next];
  }
  return reached;
}

function nodeState(position: MapPosition | null, layer: number, index: number, letter: string | null, reachable: ReadonlySet<string>): MapNodeState {
  if (position !== null && position.layer === layer && position.index === index) {
    return 'current';
  }
  if (letter !== null) {
    return 'choice';
  }
  if (position !== null && layer <= position.layer) {
    return 'passed';
  }
  return reachable.has(`${layer}-${index}`) ? 'reachable' : 'unreachable';
}

/** マップ画面の内容。notice があれば、案内の代わりに出す（直前に起きたこと） */
export function buildMapView(run: RunState, notice: string | null = null): MapView {
  const choices = runChoices(run);
  const nextLayer = run.position === null ? 0 : run.position.layer + 1;
  const letterOf = (index: number): string | null => {
    const at = choices.indexOf(index);
    return at < 0 ? null : CHOICE_LETTERS[at]!;
  };
  const reachable = reachableFrom(run, nextLayer, choices);

  const layers = run.map.layers.map((layer, l) =>
    layer.map((node, index): MapNodeView => {
      const letter = l === nextLayer ? letterOf(index) : null;
      return {
        layer: l,
        index,
        kind: node.kind,
        mark: NODE_KIND_MARKS[node.kind],
        name: NODE_KIND_NAMES[node.kind],
        state: nodeState(run.position, l, index, letter, reachable),
        letter,
        next: node.next,
      };
    }),
  );

  return {
    layers,
    choices: choices.map((index) => ({
      index,
      letter: letterOf(index)!,
      name: NODE_KIND_NAMES[nodeAt(run.map, { layer: nextLayer, index }).kind],
    })),
    team: teamViews(run.team),
    charms: charmNames(run),
    message: notice ?? '進むマスを選んでください',
    progress:
      run.position === null
        ? `エリア${run.area + 1}・スタート`
        : `エリア${run.area + 1}・${run.position.layer + 1}層目 / ${run.map.layers.length}層`,
  };
}

/** バトル画面に出す、いまのマスの説明（例：「エリア2・3層目・強敵」） */
export function battleCaption(run: RunState): string | null {
  if (run.position === null) {
    return null;
  }
  return `エリア${run.area + 1}・${run.position.layer + 1}層目・${NODE_KIND_NAMES[nodeAt(run.map, run.position).kind]}`;
}

/* ===== 戦闘後の報酬 ===== */

/**
 * 報酬の画面だけが持つ状態。
 * - offer：選択肢を選んで「決定」を押す（2タップ）
 * - member：技を覚えさせるキャラを選ぶ
 * - forget：4つ覚えているとき、忘れる技を選ぶ
 */
export interface RewardUiState {
  readonly step: 'offer' | 'member' | 'forget';
  /** 選んでいる選択肢。まだなら null */
  readonly selected: number | null;
  /** 技を覚えさせるキャラ（forget のとき） */
  readonly member: number | null;
}

export const INITIAL_REWARD_UI: RewardUiState = { step: 'offer', selected: null, member: null };

export interface RewardOfferView {
  readonly index: number;
  /** 種類（技・能力・お守り） */
  readonly kindLabel: string;
  readonly title: string;
  readonly detail: string;
  /** 属性やキャラの色。なければ null */
  readonly color: string | null;
  readonly selected: boolean;
}

/** 技を覚えさせるキャラの選択肢 */
export interface RewardMemberView {
  readonly index: number;
  readonly name: string;
  readonly color: string;
  readonly disabled: boolean;
  /** 選べない理由など。なければ null */
  readonly note: string | null;
}

/** 忘れる技の選択肢 */
export interface RewardForgetView {
  readonly index: number;
  readonly name: string;
  readonly detail: string;
  readonly color: string;
  /** 忘れると大技だけになってしまう技は選べない */
  readonly disabled: boolean;
}

export interface RewardView {
  /** 例：「報酬を選ぶ（1/2）」 */
  readonly heading: string;
  readonly step: RewardUiState['step'];
  /** 下半分に出す案内 */
  readonly prompt: string;
  readonly offers: readonly RewardOfferView[];
  readonly canConfirm: boolean;
  readonly members: readonly RewardMemberView[];
  readonly forgets: readonly RewardForgetView[];
  /** 上半分に出す、選んでいる報酬の詳細。選んでいなければ null */
  readonly detail: { readonly title: string; readonly lines: readonly string[] } | null;
  readonly team: readonly TeamMemberView[];
  readonly charms: readonly string[];
}

/** 能力の表示名（能力強化用。HP は最大HPが上がる） */
export const BOOST_STAT_NAMES: Readonly<Record<StatBoostKey, string>> = { hp: '最大HP', ...STAT_NAMES };

function offerView(run: RunState, offer: RewardOffer, index: number, selected: boolean): RewardOfferView {
  switch (offer.kind) {
    case 'move':
      return {
        index,
        kindLabel: '技',
        title: getMove(offer.move.id).name,
        detail: `${ATTRIBUTE_NAMES[offer.move.attribute]}属性・${moveSummary(offer.move)}`,
        color: ATTRIBUTE_COLORS[offer.move.attribute],
        selected,
      };
    case 'stat': {
      const { fighter } = run.team[offer.member]!;
      const value = fighter.stats[offer.stat];
      return {
        index,
        kindLabel: '能力',
        title: `${getFighter(fighter.id).name}の${BOOST_STAT_NAMES[offer.stat]} +${offer.amount}`,
        detail: `${value} → ${value + offer.amount}`,
        color: ATTRIBUTE_COLORS[fighter.attribute],
        selected,
      };
    }
    case 'charm': {
      const charm = getCharm(offer.charm.id);
      return { index, kindLabel: 'お守り', title: charm.name, detail: charm.description, color: null, selected };
    }
  }
}

function offerDetail(run: RunState, offer: RewardOffer): { title: string; lines: string[] } {
  const view = offerView(run, offer, 0, true);
  switch (offer.kind) {
    case 'move':
      return {
        title: `技：${view.title}`,
        lines: [view.detail, `チームのだれかに覚えさせる（${MAX_MOVES}つ覚えていたら、1つ忘れる）`],
      };
    case 'stat':
      return {
        title: `能力強化：${view.title}`,
        lines: [view.detail, ...(offer.stat === 'hp' ? ['いまのHPも同じだけ増える'] : [])],
      };
    case 'charm':
      return { title: `お守り：${view.title}`, lines: [view.detail, 'チーム全体に、ランの間ずっと効く'] };
  }
}

/** 技を覚えたあとの技が、大技だけにならないか */
function keepsNonBig(fighter: FighterDef, move: MoveDef, forget: number): boolean {
  return fighter.moves.some((known, index) => index !== forget && known.kind !== 'big') || move.kind !== 'big';
}

export function buildRewardView(run: RunState, ui: RewardUiState = INITIAL_REWARD_UI): RewardView {
  const { phase } = run;
  if (phase.kind !== 'reward') {
    throw new Error('いまは報酬を選ぶ段階ではありません');
  }
  const selectedOffer = ui.selected === null ? undefined : phase.offers[ui.selected];
  const move = selectedOffer?.kind === 'move' ? selectedOffer.move : null;
  const member = ui.member === null ? undefined : run.team[ui.member];

  let prompt = '報酬を1つ選んで「決定」を押してください';
  if (ui.step === 'member' && move) {
    prompt = `${getMove(move.id).name}を だれに覚えさせますか？`;
  } else if (ui.step === 'forget' && member) {
    prompt = `${getFighter(member.fighter.id).name}は 技を${MAX_MOVES}つ覚えています。忘れる技を選んでください`;
  }

  return {
    heading: phase.picks > 1 ? `報酬を選ぶ（${phase.pick}/${phase.picks}）` : '報酬を選ぶ',
    step: ui.step,
    prompt,
    offers: phase.offers.map((offer, index) => offerView(run, offer, index, index === ui.selected)),
    canConfirm: selectedOffer !== undefined,
    members:
      ui.step === 'member' && move
        ? run.team.map((m, index) => {
            const known = m.fighter.moves.some((k) => k.id === move.id);
            return {
              index,
              name: getFighter(m.fighter.id).name,
              color: ATTRIBUTE_COLORS[m.fighter.attribute],
              disabled: known,
              note: known ? '覚えている' : `技 ${m.fighter.moves.length}/${MAX_MOVES}`,
            };
          })
        : [],
    forgets:
      ui.step === 'forget' && member && move
        ? member.fighter.moves.map((known, index) => ({
            index,
            name: getMove(known.id).name,
            detail: moveSummary(known),
            color: ATTRIBUTE_COLORS[known.attribute],
            disabled: !keepsNonBig(member.fighter, move, index),
          }))
        : [],
    detail: selectedOffer ? offerDetail(run, selectedOffer) : null,
    team: teamViews(run.team),
    charms: charmNames(run),
  };
}

/** 報酬を受け取ったあと、マップに出す一言 */
export function rewardNotice(run: RunState, choice: RewardChoice): string {
  if (run.phase.kind !== 'reward') {
    return '';
  }
  const offer = run.phase.offers[choice.offer];
  if (!offer) {
    return '';
  }
  switch (offer.kind) {
    case 'move': {
      const member = choice.member === undefined ? undefined : run.team[choice.member];
      return member ? `${getFighter(member.fighter.id).name}が ${getMove(offer.move.id).name}を覚えた` : '';
    }
    case 'stat': {
      const name = getFighter(run.team[offer.member]!.fighter.id).name;
      return `${name}の ${BOOST_STAT_NAMES[offer.stat]}が ${offer.amount} 上がった`;
    }
    case 'charm':
      return `${getCharm(offer.charm.id).name}を手に入れた`;
  }
}

/* ===== ランの結果 ===== */

export interface RunEndView {
  readonly result: RunResult;
  readonly title: string;
  readonly message: string;
  readonly team: readonly TeamMemberView[];
}

export function buildRunEndView(run: RunState): RunEndView {
  if (run.phase.kind !== 'ended') {
    throw new Error('ランはまだ終わっていません');
  }
  const { result } = run.phase;
  const where = battleCaption(run) ?? '';
  return {
    result,
    title: result === 'cleared' ? 'クリア！' : '全滅…',
    message: result === 'cleared' ? `${AREA_COUNT}つのエリアを突破した！` : `${where}で全滅した`,
    team: teamViews(run.team),
  };
}
