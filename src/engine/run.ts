/**
 * ローグライトの1ラン（4章）。
 * チームを選び、エリアごとの分岐マップを下から進み、戦闘をまたいでHPを持ち越す。戦闘に勝つたびに報酬を選ぶ。
 * エリアの最後のボスを倒すと次のエリアへ。最後のエリアのボスを倒せばクリア、全員倒れたら終わり。
 * 彩り手（4.6）を選んだランでは、相棒がはじめからチームにいて外せず、特性（外せないお守り）がはじめから効く。
 * ほかのエンジンと同じく、状態は書き換えずに新しい状態を返す。乱数の状態もランの状態に含める。
 */
import { createBattle } from './battle';
import { victoryHealPercent } from './charms';
import {
  AREA_COUNT,
  AREA_STAT_MULTIPLIER,
  BATTLE_ENEMY_COUNT,
  BOSS_REWARD_PICKS,
  CPU_LEVEL_BY_AREA,
  DRAFT_CANDIDATE_COUNT,
  ELITE_CPU_LEVEL,
  ELITE_ENEMY_COUNT,
  ELITE_REWARD_PICKS,
  ELITE_STAT_MULTIPLIER,
  REVIVE_HP_PERCENT,
  REWARD_OFFER_COUNT,
  RIVAL_AREA,
  RIVAL_CPU_LEVEL,
  RIVAL_REWARD_PICKS,
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
import { generateAreaMap, nextChoices, nodeAt, type AreaMap, type MapPosition } from './map';
import { nodePhase, type EventDef, type EventOutcome } from './nodes';
import { createRng, nextSeed, pickDistinct, type RngResult, type RngState } from './rng';
import type { BattleState, BossPattern, CharmEffect, CpuLevel, FighterDef, MoveDef } from './types';

export { statBoostAmount, type StatBoostKey } from './growth';

/** お守り（4.4）。効果はチーム全体にかかる */
export interface CharmDef {
  readonly id: string;
  readonly effect: CharmEffect;
}

/**
 * 彩り手（4.6）：ランの最初に選ぶ主人公。
 * 相棒はチーム選択で1番目に入り、外せない（スカウトで入れ替えられない）。並び順は変えられる。
 * 特性は、はじめから持っていて外せないお守り。ふつうのお守りと同じように効く
 */
export interface IrodoriteDef {
  readonly id: string;
  /** 相棒の彩霊。この彩り手だけのキャラ */
  readonly partner: FighterDef;
  /** 特性 */
  readonly trait: CharmDef;
}

/**
 * ライバル（4.6）：決まったエリアのボスの手前で、必ず1回戦う。
 * チームは相棒（partners）と、ふつうのキャラから extraCount 体（ランダム）。能力は強敵と同じ倍率で強くする
 */
export interface RivalDef {
  readonly id: string;
  readonly partners: readonly FighterDef[];
  readonly extraCount: number;
}

/** ボス（仕様書 4.2・6）：エリアの最後に1体で出て、行動パターンで動く */
export interface BossDef {
  readonly fighter: FighterDef;
  readonly pattern: BossPattern;
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
  /** エリアごとのボス（添字はエリア） */
  readonly bosses: readonly BossDef[];
  /** ライバル。いなければ null（ライバルのマスを置かない） */
  readonly rival: RivalDef | null;
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
 * - battle：戦闘中（相手のチーム・CPU の段階・ボスの行動パターン・バトルのシードは、マスに入ったときに決まる）
 * - reward：戦闘に勝って、報酬を選ぶ（強敵とボスなら2回。pick は何回目か、picks は全部で何回か）
 * - rest：休憩（HPを回復するか、技を強化するか）
 * - scout：スカウト（候補の1体とチームの1体を入れ替えるか、入れ替えずに進む）
 * - event：イベント（選択肢を選ぶと outcome と chosen に結果が入る。結果を見たらマップへ）
 * - ended：ランが終わった
 */
export type RunPhase =
  | { readonly kind: 'draft'; readonly candidates: readonly FighterDef[] }
  | { readonly kind: 'map' }
  | {
      readonly kind: 'battle';
      readonly enemy: readonly FighterDef[];
      readonly cpu: CpuLevel;
      /** ボス戦なら、ボスの行動パターン。それ以外は null */
      readonly boss: BossPattern | null;
      readonly seed: number;
    }
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
  /** 持っているお守り（手に入れた順）。彩り手の特性は入れない（irodorite の trait） */
  readonly charms: readonly CharmDef[];
  /** 選んだ彩り手。選んでいないランは null */
  readonly irodorite: IrodoriteDef | null;
  readonly phase: RunPhase;
  /** 次に使う乱数の状態 */
  readonly rng: RngState;
}

/**
 * ランを始める。マップを作り、スタートの候補を出す。
 * 彩り手を選んでいれば、その彩り手と相棒を持たせる（相棒は候補に出さない）
 */
export function startRun(content: RunContent, seed: number, irodorite: IrodoriteDef | null = null): RunState {
  const map = areaMap(0, content, createRng(seed));
  const pool = irodorite === null ? content.fighters : content.fighters.filter((fighter) => fighter.id !== irodorite.partner.id);
  const candidates = pickDistinct(pool, DRAFT_CANDIDATE_COUNT, map.rng);
  return {
    area: 0,
    map: map.value,
    position: null,
    team: [],
    charms: [],
    irodorite,
    phase: { kind: 'draft', candidates: candidates.value },
    rng: candidates.rng,
  };
}

/** チーム選択で、候補から選ぶ数。彩り手の相棒がいれば、その分だけ少ない（4.6：相棒＋2体） */
export function draftPickCount(run: RunState): number {
  return run.irodorite === null ? RUN_TEAM_SIZE : RUN_TEAM_SIZE - 1;
}

/**
 * 候補からチームを選ぶ。picks は候補の位置で、選んだ順に戦闘に出る。
 * 彩り手の相棒がいれば、相棒が1番目に入り、選んだキャラはそのあとに続く
 */
export function chooseTeam(run: RunState, picks: readonly number[]): RunState {
  const { phase } = run;
  if (phase.kind !== 'draft') {
    throw new Error('いまはチームを選ぶ段階ではありません');
  }
  const count = draftPickCount(run);
  if (picks.length !== count || new Set(picks).size !== picks.length) {
    throw new Error(`候補から違うキャラを ${count} 体選んでください`);
  }
  const picked = picks.map((pick): RunMember => {
    const fighter = phase.candidates[pick];
    if (!fighter) {
      throw new Error(`候補の ${pick} 番目のキャラはいません`);
    }
    return { fighter, hp: fighter.stats.hp };
  });
  const partner = run.irodorite?.partner;
  const team = partner === undefined ? picked : [{ fighter: partner, hp: partner.stats.hp }, ...picked];
  return { ...run, team, phase: { kind: 'map' } };
}

/** チームの中の、彩り手の相棒の位置。彩り手がいないか、相棒がチームにいなければ -1 */
export function partnerIndex(run: RunState): number {
  const partner = run.irodorite?.partner;
  return partner === undefined ? -1 : run.team.findIndex((member) => member.fighter.id === partner.id);
}

/** ランで効いているお守りの効果。彩り手の特性が先で、そのあとに手に入れたお守り */
export function runCharmEffects(run: RunState): readonly CharmEffect[] {
  const charms = run.charms.map((charm) => charm.effect);
  return run.irodorite === null ? charms : [run.irodorite.trait.effect, ...charms];
}

/**
 * チームの2体の並び順（戦闘に出る順）を入れ替える（4.1）。
 * マップで次のマスを選ぶ段階だけでできる。HPなどはそのまま、位置だけが変わる
 */
export function swapTeamOrder(run: RunState, a: number, b: number): RunState {
  if (run.phase.kind !== 'map') {
    throw new Error('並び順を変えられるのは、マップで次のマスを選ぶときだけです');
  }
  const first = run.team[a];
  const second = run.team[b];
  if (first === undefined || second === undefined || a === b) {
    throw new Error(`チームの違う2体を選んでください（${a} と ${b}）`);
  }
  const team = run.team.map((member, index) => (index === a ? second : index === b ? first : member));
  return { ...run, team };
}

/** エリアのマップを作る。ライバルと戦うエリアなら、ライバルのマスを置く */
function areaMap(area: number, content: RunContent, rng: RngState): RngResult<AreaMap> {
  return generateAreaMap(rng, { rival: content.rival !== null && area === RIVAL_AREA });
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

/** 戦闘・強敵のマスの種類・層・エリアから、相手のチームを決める。能力はエリアの倍率と、強敵の倍率をかけ合わせて強くする */
function enemyTeam(
  kind: 'battle' | 'elite',
  layer: number,
  area: number,
  content: RunContent,
  rng: RngState,
): RngResult<readonly FighterDef[]> {
  const count = kind === 'elite' ? ELITE_ENEMY_COUNT[area] : BATTLE_ENEMY_COUNT[area]?.[layer];
  const areaMultiplier = AREA_STAT_MULTIPLIER[area];
  if (count === undefined || areaMultiplier === undefined) {
    throw new Error(`エリア${area + 1}・${layer + 1} 層目の相手の人数か強さが決まっていません`);
  }
  const picked = pickDistinct(content.fighters, count, rng);
  const kindMultiplier = kind === 'elite' ? ELITE_STAT_MULTIPLIER : 1;
  const multiplier = areaMultiplier * kindMultiplier;
  const team = multiplier === 1 ? picked.value : picked.value.map((fighter) => strengthen(fighter, multiplier));
  return { value: team, rng: picked.rng };
}

/** ライバルのチーム：相棒のあとに、ふつうのキャラからランダムに足す。能力は強敵と同じ倍率で強くする */
function rivalTeam(rival: RivalDef, area: number, content: RunContent, rng: RngState): RngResult<readonly FighterDef[]> {
  const areaMultiplier = AREA_STAT_MULTIPLIER[area];
  if (areaMultiplier === undefined) {
    throw new Error(`エリア${area + 1} の相手の強さが決まっていません`);
  }
  const others = content.fighters.filter((fighter) => !rival.partners.some((partner) => partner.id === fighter.id));
  const extra = pickDistinct(others, rival.extraCount, rng);
  const multiplier = areaMultiplier * ELITE_STAT_MULTIPLIER;
  return { value: [...rival.partners, ...extra.value].map((fighter) => strengthen(fighter, multiplier)), rng: extra.rng };
}

/**
 * 次のマスに進む。index は次の層での位置（runChoices のどれか）。
 * 戦闘・強敵なら相手のチームを決めて、ボスならそのエリアのボスと、戦闘の段階に入る。休憩・スカウト・イベントは、そのマスの段階に入る。
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
  if (node.kind === 'rival') {
    if (content.rival === null) {
      throw new Error('ライバルのデータがありません');
    }
    const enemy = rivalTeam(content.rival, run.area, content, run.rng);
    const seed = nextSeed(enemy.rng);
    const phase: RunPhase = { kind: 'battle', enemy: enemy.value, cpu: RIVAL_CPU_LEVEL, boss: null, seed: seed.value };
    return { ...run, position, phase, rng: seed.rng };
  }
  const cpu = node.kind === 'elite' ? ELITE_CPU_LEVEL : CPU_LEVEL_BY_AREA[run.area];
  if (cpu === undefined) {
    throw new Error(`エリア${run.area + 1} の CPU の段階が決まっていません`);
  }
  if (node.kind === 'boss') {
    const boss = content.bosses[run.area];
    if (!boss) {
      throw new Error(`エリア${run.area + 1} のボスが決まっていません`);
    }
    const seed = nextSeed(run.rng);
    const phase: RunPhase = { kind: 'battle', enemy: [boss.fighter], cpu, boss: boss.pattern, seed: seed.value };
    return { ...run, position, phase, rng: seed.rng };
  }
  const enemy = enemyTeam(node.kind, position.layer, run.area, content, run.rng);
  const seed = nextSeed(enemy.rng);
  const phase: RunPhase = { kind: 'battle', enemy: enemy.value, cpu, boss: null, seed: seed.value };
  return { ...run, position, phase, rng: seed.rng };
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
    { playerHp: run.team.map((member) => member.hp), playerCharms: runCharmEffects(run) },
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
function enterNextArea(run: RunState, content: RunContent): RunState {
  const map = areaMap(run.area + 1, content, run.rng);
  return { ...run, area: run.area + 1, map: map.value, position: null, phase: { kind: 'map' }, rng: map.rng };
}

/**
 * 決着したバトルの結果をランに反映する。
 * 負けたらラン終了。勝ったらHPを持ち越し、倒れていたキャラは最大HPの一部で戻る（お守りがあれば、そのあと回復する）。
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

  // 勝ったら回復するお守りがあれば、倒れていたキャラは戻ったあとに回復する
  const victoryHeal = victoryHealPercent(runCharmEffects(run));
  const team = run.team.map((member, index): RunMember => {
    const max = member.fighter.stats.hp;
    const left = fighters[index]!.hp;
    const hp = left > 0 ? left : percentOfMaxHp(max, REVIVE_HP_PERCENT);
    return { ...member, hp: victoryHeal > 0 ? Math.min(max, hp + percentOfMaxHp(max, victoryHeal)) : hp };
  });
  const kind = nodeAt(run.map, run.position).kind;
  if (kind === 'boss' && run.area >= AREA_COUNT - 1) {
    return { ...run, team, phase: { kind: 'ended', result: 'cleared' } };
  }
  const picks =
    kind === 'boss' ? BOSS_REWARD_PICKS : kind === 'elite' ? ELITE_REWARD_PICKS : kind === 'rival' ? RIVAL_REWARD_PICKS : 1;
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
  return atBoss(next) ? enterNextArea(next, content) : { ...next, phase: { kind: 'map' } };
}
