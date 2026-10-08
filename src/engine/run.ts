/**
 * ローグライトの1ラン（4章）。
 * チームを選び、エリアごとの分岐マップを下から進み、戦闘をまたいでHPを持ち越す。戦闘に勝つたびに報酬を選ぶ。
 * エリアの最後のボスを倒すと次のエリアへ。最後のエリアのボスを倒せばクリア、全員倒れたら終わり。
 * ほかのエンジンと同じく、状態は書き換えずに新しい状態を返す。乱数の状態もランの状態に含める。
 */
import { createBattle } from './battle';
import {
  AREA_COUNT,
  AREA_STAT_MULTIPLIER,
  BATTLE_ENEMY_COUNT,
  BOSS_ENEMY_COUNT,
  BOSS_REWARD_PICKS,
  BOSS_STAT_MULTIPLIER,
  CPU_LEVEL_BY_AREA,
  DRAFT_CANDIDATE_COUNT,
  ELITE_ENEMY_COUNT,
  ELITE_REWARD_PICKS,
  ELITE_STAT_MULTIPLIER,
  REVIVE_HP_PERCENT,
  REWARD_OFFER_COUNT,
  RUN_TEAM_SIZE,
} from './constants';
import { percentOfMaxHp } from './effects';
import {
  boostStat,
  canLearn,
  learnMove,
  memberOf,
  STAT_BOOST_KEYS,
  statBoostAmount,
  type StatBoostKey,
} from './growth';
import { generateAreaMap, nextChoices, nodeAt, type AreaMap, type MapPosition, type NodeKind } from './map';
import { nodePhase, type EventDef, type EventOutcome } from './nodes';
import { createRng, nextSeed, pickDistinct, type RngResult, type RngState } from './rng';
import type { BattleState, CharmEffect, CpuLevel, FighterDef, MoveDef } from './types';

export { statBoostAmount, type StatBoostKey } from './growth';

/** お守り（4.4）。効果はチーム全体にかかる */
export interface CharmDef {
  readonly id: string;
  readonly effect: CharmEffect;
}

/** ランで使うデータ。エンジンはデータを直接読まず、ここで受け取る */
export interface RunContent {
  /** スタートの候補と、相手のチームに使うキャラ */
  readonly fighters: readonly FighterDef[];
  /** 報酬で覚えられる技 */
  readonly moves: readonly MoveDef[];
  /** 報酬で手に入るお守り */
  readonly charms: readonly CharmDef[];
  /** イベントのマスで起きるイベント */
  readonly events: readonly EventDef[];
}

/** チームの1体 */
export interface RunMember {
  readonly fighter: FighterDef;
  /** いまのHP。戦闘をまたいで持ち越す */
  readonly hp: number;
}

/** ランの結果 */
export type RunResult = 'cleared' | 'defeated';

/**
 * 戦闘後の報酬の選択肢（4.4）。
 * - move：新しい技。だれに覚えさせるか（4つ覚えていれば、どれを忘れるか）は選ぶときに決める
 * - stat：チームの1体の能力を1つ上げる（だれの・どの能力・いくつ上がるかは、選択肢を出すときに決まる）
 * - charm：お守り
 */
export type RewardOffer =
  | { readonly kind: 'move'; readonly move: MoveDef }
  | { readonly kind: 'stat'; readonly member: number; readonly stat: StatBoostKey; readonly amount: number }
  | { readonly kind: 'charm'; readonly charm: CharmDef };

/** 報酬の選び方 */
export interface RewardChoice {
  /** 選んだ選択肢の位置 */
  readonly offer: number;
  /** 技：覚えさせるキャラのチーム内の位置 */
  readonly member?: number;
  /** 技：4つ覚えているとき、忘れる技の位置 */
  readonly forget?: number;
}

/**
 * ランの段階。
 * - draft：候補からチームを選ぶ
 * - map：次のマスを選ぶ
 * - battle：戦闘中（相手のチーム・CPU の段階・バトルのシードは、マスに入ったときに決まる）
 * - reward：戦闘に勝って、報酬を選ぶ（強敵とボスなら2回。pick は何回目か、picks は全部で何回か）
 * - rest：休憩（HPを回復するか、技を強化するか）
 * - scout：スカウト（候補の1体とチームの1体を入れ替えるか、入れ替えずに進む）
 * - event：イベント（選択肢を選ぶと outcome と chosen に結果が入る。結果を見たらマップへ）
 * - ended：ランが終わった
 */
export type RunPhase =
  | { readonly kind: 'draft'; readonly candidates: readonly FighterDef[] }
  | { readonly kind: 'map' }
  | { readonly kind: 'battle'; readonly enemy: readonly FighterDef[]; readonly cpu: CpuLevel; readonly seed: number }
  | { readonly kind: 'reward'; readonly offers: readonly RewardOffer[]; readonly pick: number; readonly picks: number }
  | { readonly kind: 'rest' }
  | { readonly kind: 'scout'; readonly candidates: readonly FighterDef[] }
  | {
      readonly kind: 'event';
      readonly event: EventDef;
      /** 選んだ選択肢の結果。まだ選んでいなければ null */
      readonly outcome: readonly EventOutcome[] | null;
      /** 選んだ選択肢の位置 */
      readonly chosen?: number;
    }
  | { readonly kind: 'ended'; readonly result: RunResult };

/** ランの状態 */
export interface RunState {
  /** いまのエリア（0 がエリア1） */
  readonly area: number;
  /** いまのエリアのマップ */
  readonly map: AreaMap;
  /** いまいるマス。スタート直後（まだどのマスにも入っていない）は null */
  readonly position: MapPosition | null;
  /** チーム。並び順が戦闘に出る順になる */
  readonly team: readonly RunMember[];
  /** 持っているお守り（手に入れた順） */
  readonly charms: readonly CharmDef[];
  readonly phase: RunPhase;
  /** 次に使う乱数の状態 */
  readonly rng: RngState;
}

/** ランを始める。マップを作り、スタートの候補を出す */
export function startRun(content: RunContent, seed: number): RunState {
  const map = generateAreaMap(createRng(seed));
  const candidates = pickDistinct(content.fighters, DRAFT_CANDIDATE_COUNT, map.rng);
  return {
    area: 0,
    map: map.value,
    position: null,
    team: [],
    charms: [],
    phase: { kind: 'draft', candidates: candidates.value },
    rng: candidates.rng,
  };
}

/** 候補からチームを選ぶ。picks は候補の位置で、選んだ順に戦闘に出る */
export function chooseTeam(run: RunState, picks: readonly number[]): RunState {
  const { phase } = run;
  if (phase.kind !== 'draft') {
    throw new Error('いまはチームを選ぶ段階ではありません');
  }
  if (picks.length !== RUN_TEAM_SIZE || new Set(picks).size !== picks.length) {
    throw new Error(`候補から違うキャラを ${RUN_TEAM_SIZE} 体選んでください`);
  }
  const team = picks.map((pick): RunMember => {
    const fighter = phase.candidates[pick];
    if (!fighter) {
      throw new Error(`候補の ${pick} 番目のキャラはいません`);
    }
    return { fighter, hp: fighter.stats.hp };
  });
  return { ...run, team, phase: { kind: 'map' } };
}

/** 次に進めるマス（次の層での位置） */
export function runChoices(run: RunState): readonly number[] {
  return run.phase.kind === 'map' ? nextChoices(run.map, run.position) : [];
}

/** 能力に倍率をかけたキャラ（強敵・ボス用）。HP・攻撃・防御だけを強くし、素早さは変えない */
function strengthen(fighter: FighterDef, multiplier: number): FighterDef {
  const scale = (value: number) => Math.round(value * multiplier);
  const { stats } = fighter;
  return {
    ...fighter,
    stats: { ...stats, hp: scale(stats.hp), attack: scale(stats.attack), defense: scale(stats.defense) },
  };
}

/** マスの種類・層・エリアから、相手のチームを決める。能力はエリアの倍率と、強敵・ボスの倍率をかけ合わせて強くする */
function enemyTeam(
  kind: NodeKind,
  layer: number,
  area: number,
  content: RunContent,
  rng: RngState,
): RngResult<readonly FighterDef[]> {
  const count =
    kind === 'boss'
      ? BOSS_ENEMY_COUNT[area]
      : kind === 'elite'
        ? ELITE_ENEMY_COUNT[area]
        : BATTLE_ENEMY_COUNT[area]?.[layer];
  const areaMultiplier = AREA_STAT_MULTIPLIER[area];
  if (count === undefined || areaMultiplier === undefined) {
    throw new Error(`エリア${area + 1}・${layer + 1} 層目の相手の人数か強さが決まっていません`);
  }
  const picked = pickDistinct(content.fighters, count, rng);
  const kindMultiplier = kind === 'boss' ? BOSS_STAT_MULTIPLIER : kind === 'elite' ? ELITE_STAT_MULTIPLIER : 1;
  const multiplier = areaMultiplier * kindMultiplier;
  const team = multiplier === 1 ? picked.value : picked.value.map((fighter) => strengthen(fighter, multiplier));
  return { value: team, rng: picked.rng };
}

/**
 * 次のマスに進む。index は次の層での位置（runChoices のどれか）。
 * 戦闘・強敵・ボスなら相手のチームを決めて戦闘の段階に入る。休憩・スカウト・イベントは、そのマスの段階に入る。
 */
export function enterNode(run: RunState, index: number, content: RunContent): RunState {
  if (!runChoices(run).includes(index)) {
    throw new Error(`次の層の ${index + 1} 番目のマスには進めません`);
  }
  const position: MapPosition = { layer: run.position === null ? 0 : run.position.layer + 1, index };
  const node = nodeAt(run.map, position);
  if (node.kind === 'rest' || node.kind === 'scout' || node.kind === 'event') {
    const phase = nodePhase(node.kind, run, content, run.rng);
    return { ...run, position, phase: phase.value, rng: phase.rng };
  }
  const enemy = enemyTeam(node.kind, position.layer, run.area, content, run.rng);
  const seed = nextSeed(enemy.rng);
  const cpu = CPU_LEVEL_BY_AREA[run.area];
  if (cpu === undefined) {
    throw new Error(`エリア${run.area + 1} の CPU の段階が決まっていません`);
  }
  return { ...run, position, phase: { kind: 'battle', enemy: enemy.value, cpu, seed: seed.value }, rng: seed.rng };
}

/** いまの戦闘を始める。チームは並び順のまま、持ち越したHPで出る */
export function createRunBattle(run: RunState): BattleState {
  const { phase } = run;
  if (phase.kind !== 'battle') {
    throw new Error('いまは戦闘の段階ではありません');
  }
  return createBattle(
    run.team.map((member) => member.fighter),
    phase.enemy,
    { playerHp: run.team.map((member) => member.hp), playerCharms: run.charms.map((charm) => charm.effect) },
  );
}

/**
 * 報酬の選択肢を出す（4.4）。技・能力強化・お守りを1つずつ。
 * 覚えられる技がない、またはお守りを全部持っていれば、その分は能力強化（重ならないもの）にする。
 */
function rewardOffers(run: RunState, content: RunContent, rng: RngState): RngResult<readonly RewardOffer[]> {
  let current = rng;
  const learnable = content.moves.filter((move) => run.team.some((member) => canLearn(member.fighter, move)));
  const charms = content.charms.filter((charm) => !run.charms.some((owned) => owned.id === charm.id));

  const moveDraw = pickDistinct(learnable, Math.min(1, learnable.length), current);
  current = moveDraw.rng;
  const charmDraw = pickDistinct(charms, Math.min(1, charms.length), current);
  current = charmDraw.rng;

  const boosts = run.team.flatMap((_member, index) => STAT_BOOST_KEYS.map((stat) => ({ member: index, stat })));
  const statCount = REWARD_OFFER_COUNT - moveDraw.value.length - charmDraw.value.length;
  const statDraw = pickDistinct(boosts, Math.min(statCount, boosts.length), current);
  current = statDraw.rng;

  const offers: RewardOffer[] = [
    ...moveDraw.value.map((move): RewardOffer => ({ kind: 'move', move })),
    ...statDraw.value.map(({ member, stat }): RewardOffer => ({
      kind: 'stat',
      member,
      stat,
      amount: statBoostAmount(run.team[member]!.fighter.stats[stat]),
    })),
    ...charmDraw.value.map((charm): RewardOffer => ({ kind: 'charm', charm })),
  ];
  return { value: offers, rng: current };
}

/** 報酬を選ぶ段階に入る */
function enterReward(run: RunState, content: RunContent, pick: number, picks: number): RunState {
  const offers = rewardOffers(run, content, run.rng);
  return { ...run, phase: { kind: 'reward', offers: offers.value, pick, picks }, rng: offers.rng };
}

/** いまのマスがボスか */
function atBoss(run: RunState): boolean {
  return run.position !== null && nodeAt(run.map, run.position).kind === 'boss';
}

/** 次のエリアに進む。新しいマップを作り、1層目の手前から始める */
function enterNextArea(run: RunState): RunState {
  const map = generateAreaMap(run.rng);
  return { ...run, area: run.area + 1, map: map.value, position: null, phase: { kind: 'map' }, rng: map.rng };
}

/**
 * 決着したバトルの結果をランに反映する。
 * 負けたらラン終了。勝ったらHPを持ち越し、倒れていたキャラは最大HPの一部で戻る。
 * 最後のエリアのボスに勝てばクリア。それ以外は報酬を選ぶ（強敵とボスなら2回）。
 */
export function finishBattle(run: RunState, battle: BattleState, content: RunContent): RunState {
  if (run.phase.kind !== 'battle' || run.position === null) {
    throw new Error('いまは戦闘の段階ではありません');
  }
  if (battle.winner === null) {
    throw new Error('バトルがまだ決着していません');
  }
  const fighters = battle.sides.player.team;
  if (fighters.length !== run.team.length) {
    throw new Error('バトルのチームとランのチームが合いません');
  }
  if (battle.winner === 'enemy') {
    const team = run.team.map((member): RunMember => ({ ...member, hp: 0 }));
    return { ...run, team, phase: { kind: 'ended', result: 'defeated' } };
  }

  const team = run.team.map((member, index): RunMember => {
    const hp = fighters[index]!.hp;
    return { ...member, hp: hp > 0 ? hp : percentOfMaxHp(member.fighter.stats.hp, REVIVE_HP_PERCENT) };
  });
  const kind = nodeAt(run.map, run.position).kind;
  if (kind === 'boss' && run.area >= AREA_COUNT - 1) {
    return { ...run, team, phase: { kind: 'ended', result: 'cleared' } };
  }
  const picks = kind === 'boss' ? BOSS_REWARD_PICKS : kind === 'elite' ? ELITE_REWARD_PICKS : 1;
  return enterReward({ ...run, team }, content, 1, picks);
}

/**
 * 報酬を1つ受け取る（4.4）。
 * まだ選べる回数が残っていれば（強敵・ボス）、新しい選択肢を出す。
 * 残っていなければマップに戻る（ボスのあとなら、次のエリアのマップへ進む）。
 */
export function takeReward(run: RunState, choice: RewardChoice, content: RunContent): RunState {
  const { phase } = run;
  if (phase.kind !== 'reward') {
    throw new Error('いまは報酬を選ぶ段階ではありません');
  }
  const offer = phase.offers[choice.offer];
  if (!offer) {
    throw new Error(`報酬の ${choice.offer} 番目の選択肢はありません`);
  }

  let next: RunState;
  switch (offer.kind) {
    case 'move': {
      const member = memberOf(run, choice.member);
      const fighter = learnMove(member.fighter, offer.move, choice.forget);
      next = { ...run, team: run.team.with(choice.member!, { ...member, fighter }) };
      break;
    }
    case 'stat':
      next = { ...run, team: run.team.with(offer.member, boostStat(memberOf(run, offer.member), offer.stat, offer.amount)) };
      break;
    case 'charm':
      next = { ...run, charms: [...run.charms, offer.charm] };
      break;
  }

  if (phase.pick < phase.picks) {
    return enterReward(next, content, phase.pick + 1, phase.picks);
  }
  return atBoss(next) ? enterNextArea(next) : { ...next, phase: { kind: 'map' } };
}
