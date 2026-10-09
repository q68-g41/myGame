/**
 * 休憩・スカウト・イベントのマス（4.2）。
 * マスに入ると、ランはそのマスの段階になる。選んだら（イベントは結果を見たら）マップに戻る。
 */
import { restHealBonus } from './charms';
import { REST_HEAL_PERCENT, REST_POWER_UP, SCOUT_CANDIDATE_COUNT } from './constants';
import { percentOfMaxHp } from './effects';
import { boostStat, memberOf, powerUpMove, statBoostAmount, type StatBoostKey } from './growth';
import { nextInt, pickDistinct, type RngResult, type RngState } from './rng';
import type { RunContent, RunMember, RunPhase, RunState } from './run';

/** イベントの効果の対象。all：全員、lead：チームの先頭、random：ランダムな1体 */
export type EventTarget = 'all' | 'lead' | 'random';

/** イベントの効果 */
export type EventEffect =
  /** HPを最大HPの percent % 回復する（最大HPは超えない） */
  | { readonly type: 'heal'; readonly target: EventTarget; readonly percent: number }
  /** HPを最大HPの percent % 減らす（イベントでは倒れない。HPは1より下がらない） */
  | { readonly type: 'damage'; readonly target: EventTarget; readonly percent: number }
  /** 能力を1つ上げる（報酬の能力強化と同じ量） */
  | { readonly type: 'statBoost'; readonly target: EventTarget; readonly stat: StatBoostKey }
  /** chancePercent % で success、それ以外は failure の効果 */
  | {
      readonly type: 'gamble';
      readonly chancePercent: number;
      readonly success: readonly EventEffect[];
      readonly failure: readonly EventEffect[];
    };

/** イベントの選択肢 */
export interface EventOption {
  readonly effects: readonly EventEffect[];
}

/** イベント（文章や選択肢の名前はデータ側で持つ） */
export interface EventDef {
  readonly id: string;
  readonly options: readonly EventOption[];
}

/** イベントで起きたこと（画面はこれを順番に見せる） */
export type EventOutcome =
  | { readonly type: 'gamble'; readonly success: boolean }
  /** HPの変化。delta が正なら回復、負ならダメージ */
  | { readonly type: 'hp'; readonly member: number; readonly delta: number; readonly hp: number }
  | { readonly type: 'stat'; readonly member: number; readonly stat: StatBoostKey; readonly amount: number }
  | { readonly type: 'nothing' };

/** マスに入ったときの段階（戦闘以外）。乱数で候補やイベントを決める */
export function nodePhase(
  kind: 'rest' | 'scout' | 'event',
  run: RunState,
  content: RunContent,
  rng: RngState,
): RngResult<RunPhase> {
  switch (kind) {
    case 'rest':
      return { value: { kind: 'rest' }, rng };
    case 'scout': {
      // チームにいないキャラから候補を出す
      const others = content.fighters.filter((fighter) => !run.team.some((member) => member.fighter.id === fighter.id));
      const candidates = pickDistinct(others, Math.min(SCOUT_CANDIDATE_COUNT, others.length), rng);
      return { value: { kind: 'scout', candidates: candidates.value }, rng: candidates.rng };
    }
    case 'event': {
      if (content.events.length === 0) {
        throw new Error('イベントのデータがありません');
      }
      const draw = nextInt(rng, 0, content.events.length - 1);
      return { value: { kind: 'event', event: content.events[draw.value]!, outcome: null }, rng: draw.rng };
    }
  }
}

function assertPhase(run: RunState, kind: RunPhase['kind'], label: string): void {
  if (run.phase.kind !== kind) {
    throw new Error(`いまは${label}の段階ではありません`);
  }
}

/** HPを最大HPの percent % 増やす（delta > 0）か減らす（delta < 0）。最大HPを超えず、1より下がらない */
function changeHp(member: RunMember, percent: number, sign: 1 | -1): RunMember {
  const max = member.fighter.stats.hp;
  const amount = percentOfMaxHp(max, percent);
  const hp = sign > 0 ? Math.min(max, member.hp + amount) : Math.max(1, member.hp - amount);
  return { ...member, hp };
}

/* ===== 休憩 ===== */

/** 休憩で回復する割合（最大HPの %）。お守りで増える */
export function restHealPercent(run: RunState): number {
  return REST_HEAL_PERCENT + restHealBonus(run.charms.map((charm) => charm.effect));
}

/** 休憩：全員のHPを最大HPの30%（お守りがあればもっと）回復する */
export function restHeal(run: RunState): RunState {
  assertPhase(run, 'rest', '休憩');
  const percent = restHealPercent(run);
  return { ...run, team: run.team.map((member) => changeHp(member, percent, 1)), phase: { kind: 'map' } };
}

/** 休憩：チームの1体の攻撃技を1つ選んで、威力を上げる */
export function restPowerUp(run: RunState, member: number, move: number): RunState {
  assertPhase(run, 'rest', '休憩');
  const target = memberOf(run, member);
  const fighter = powerUpMove(target.fighter, move, REST_POWER_UP);
  return { ...run, team: run.team.with(member, { ...target, fighter }), phase: { kind: 'map' } };
}

/* ===== スカウト ===== */

/** スカウト：候補の1体を、チームの1体と入れ替える。入った仲間はHP満タンで、抜けたキャラの位置に入る */
export function scoutRecruit(run: RunState, candidate: number, member: number): RunState {
  const { phase } = run;
  if (phase.kind !== 'scout') {
    throw new Error('いまはスカウトの段階ではありません');
  }
  const fighter = phase.candidates[candidate];
  if (!fighter) {
    throw new Error(`スカウトの候補の ${candidate} 番目はいません`);
  }
  memberOf(run, member);
  return { ...run, team: run.team.with(member, { fighter, hp: fighter.stats.hp }), phase: { kind: 'map' } };
}

/** スカウト：だれも入れ替えずに進む */
export function scoutSkip(run: RunState): RunState {
  assertPhase(run, 'scout', 'スカウト');
  return { ...run, phase: { kind: 'map' } };
}

/* ===== イベント ===== */

/** 効果の対象になるチームの位置 */
function targetsOf(target: EventTarget, team: readonly RunMember[], rng: RngState): RngResult<readonly number[]> {
  switch (target) {
    case 'all':
      return { value: team.map((_member, index) => index), rng };
    case 'lead':
      return { value: [0], rng };
    case 'random': {
      const draw = nextInt(rng, 0, team.length - 1);
      return { value: [draw.value], rng: draw.rng };
    }
  }
}

interface EffectState {
  readonly team: readonly RunMember[];
  readonly outcome: readonly EventOutcome[];
  readonly rng: RngState;
}

/** イベントの効果を順番にかける */
function applyEffects(effects: readonly EventEffect[], start: EffectState): EffectState {
  let state = start;
  for (const effect of effects) {
    if (effect.type === 'gamble') {
      const draw = nextInt(state.rng, 1, 100);
      const success = draw.value <= effect.chancePercent;
      state = applyEffects(success ? effect.success : effect.failure, {
        ...state,
        outcome: [...state.outcome, { type: 'gamble', success }],
        rng: draw.rng,
      });
      continue;
    }
    const targets = targetsOf(effect.target, state.team, state.rng);
    let team = state.team;
    const outcome = [...state.outcome];
    for (const index of targets.value) {
      const member = team[index]!;
      let next: RunMember;
      if (effect.type === 'statBoost') {
        const amount = statBoostAmount(member.fighter.stats[effect.stat]);
        next = boostStat(member, effect.stat, amount);
        outcome.push({ type: 'stat', member: index, stat: effect.stat, amount });
      } else {
        next = changeHp(member, effect.percent, effect.type === 'heal' ? 1 : -1);
        outcome.push({ type: 'hp', member: index, delta: next.hp - member.hp, hp: next.hp });
      }
      team = team.with(index, next);
    }
    state = { team, outcome, rng: targets.rng };
  }
  return state;
}

/** イベント：選択肢を選ぶ。結果はランの状態に残り、leaveEvent でマップに戻る */
export function chooseEventOption(run: RunState, option: number): RunState {
  const { phase } = run;
  if (phase.kind !== 'event') {
    throw new Error('いまはイベントの段階ではありません');
  }
  if (phase.outcome !== null) {
    throw new Error('このイベントの選択肢は、もう選びました');
  }
  const chosen = phase.event.options[option];
  if (!chosen) {
    throw new Error(`イベントの ${option} 番目の選択肢はありません`);
  }
  const result = applyEffects(chosen.effects, { team: run.team, outcome: [], rng: run.rng });
  const outcome: readonly EventOutcome[] = result.outcome.length === 0 ? [{ type: 'nothing' }] : result.outcome;
  return { ...run, team: result.team, phase: { ...phase, outcome, chosen: option }, rng: result.rng };
}

/** イベント：結果を見たら、マップに戻る */
export function leaveEvent(run: RunState): RunState {
  const { phase } = run;
  if (phase.kind !== 'event' || phase.outcome === null) {
    throw new Error('イベントの選択肢をまだ選んでいません');
  }
  return { ...run, phase: { kind: 'map' } };
}
