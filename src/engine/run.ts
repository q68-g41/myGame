/**
 * ローグライトの1ラン（4章）。
 * チームを選び、分岐マップを下から進み、戦闘をまたいでHPを持ち越す。ボスを倒せばクリア、全員倒れたら終わり。
 * ほかのエンジンと同じく、状態は書き換えずに新しい状態を返す。乱数の状態もランの状態に含める。
 */
import { createBattle } from './battle';
import {
  BATTLE_ENEMY_COUNT_BY_LAYER,
  BOSS_ENEMY_COUNT,
  BOSS_STAT_MULTIPLIER,
  DRAFT_CANDIDATE_COUNT,
  ELITE_ENEMY_COUNT,
  ELITE_STAT_MULTIPLIER,
  REVIVE_HP_PERCENT,
  RUN_TEAM_SIZE,
} from './constants';
import { percentOfMaxHp } from './effects';
import { generateAreaMap, nextChoices, nodeAt, type AreaMap, type MapPosition, type NodeKind } from './map';
import { createRng, nextSeed, pickDistinct, type RngResult, type RngState } from './rng';
import type { BattleState, FighterDef } from './types';

/** ランで使うデータ。エンジンはデータを直接読まず、ここで受け取る */
export interface RunContent {
  /** スタートの候補と、相手のチームに使うキャラ */
  readonly fighters: readonly FighterDef[];
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
 * ランの段階。
 * - draft：候補からチームを選ぶ
 * - map：次のマスを選ぶ
 * - battle：戦闘中（相手のチームとバトルのシードは、マスに入ったときに決まる）
 * - ended：ランが終わった
 */
export type RunPhase =
  | { readonly kind: 'draft'; readonly candidates: readonly FighterDef[] }
  | { readonly kind: 'map' }
  | { readonly kind: 'battle'; readonly enemy: readonly FighterDef[]; readonly seed: number }
  | { readonly kind: 'ended'; readonly result: RunResult };

/** ランの状態 */
export interface RunState {
  readonly map: AreaMap;
  /** いまいるマス。スタート直後（まだどのマスにも入っていない）は null */
  readonly position: MapPosition | null;
  /** チーム。並び順が戦闘に出る順になる */
  readonly team: readonly RunMember[];
  readonly phase: RunPhase;
  /** 次に使う乱数の状態 */
  readonly rng: RngState;
}

/** 戦闘になるマス */
const BATTLE_KINDS: ReadonlySet<NodeKind> = new Set(['battle', 'elite', 'boss']);

/** ランを始める。マップを作り、スタートの候補を出す */
export function startRun(content: RunContent, seed: number): RunState {
  const map = generateAreaMap(createRng(seed));
  const candidates = pickDistinct(content.fighters, DRAFT_CANDIDATE_COUNT, map.rng);
  return {
    map: map.value,
    position: null,
    team: [],
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

/** マスの種類と層から、相手のチームを決める */
function enemyTeam(
  kind: NodeKind,
  layer: number,
  content: RunContent,
  rng: RngState,
): RngResult<readonly FighterDef[]> {
  const count =
    kind === 'boss' ? BOSS_ENEMY_COUNT : kind === 'elite' ? ELITE_ENEMY_COUNT : BATTLE_ENEMY_COUNT_BY_LAYER[layer];
  if (count === undefined) {
    throw new Error(`${layer + 1} 層目の戦闘の相手の人数が決まっていません`);
  }
  const picked = pickDistinct(content.fighters, count, rng);
  const multiplier = kind === 'boss' ? BOSS_STAT_MULTIPLIER : kind === 'elite' ? ELITE_STAT_MULTIPLIER : 1;
  const team = multiplier === 1 ? picked.value : picked.value.map((fighter) => strengthen(fighter, multiplier));
  return { value: team, rng: picked.rng };
}

/**
 * 次のマスに進む。index は次の層での位置（runChoices のどれか）。
 * 戦闘・強敵・ボスなら相手のチームを決めて戦闘の段階に入る。
 * 休憩・スカウト・イベントは、いまは通るだけ（中身は M4-4 で入れる）。
 */
export function enterNode(run: RunState, index: number, content: RunContent): RunState {
  if (!runChoices(run).includes(index)) {
    throw new Error(`次の層の ${index + 1} 番目のマスには進めません`);
  }
  const position: MapPosition = { layer: run.position === null ? 0 : run.position.layer + 1, index };
  const node = nodeAt(run.map, position);
  if (!BATTLE_KINDS.has(node.kind)) {
    return { ...run, position };
  }
  const enemy = enemyTeam(node.kind, position.layer, content, run.rng);
  const seed = nextSeed(enemy.rng);
  return { ...run, position, phase: { kind: 'battle', enemy: enemy.value, seed: seed.value }, rng: seed.rng };
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
    { playerHp: run.team.map((member) => member.hp) },
  );
}

/**
 * 決着したバトルの結果をランに反映する。
 * 負けたらラン終了。勝ったらHPを持ち越し、倒れていたキャラは最大HPの一部で戻る。ボスに勝てばクリア。
 */
export function finishBattle(run: RunState, battle: BattleState): RunState {
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
  const cleared = nodeAt(run.map, run.position).kind === 'boss';
  return { ...run, team, phase: cleared ? { kind: 'ended', result: 'cleared' } : { kind: 'map' } };
}
