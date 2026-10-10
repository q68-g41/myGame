import { describe, expect, it } from 'vitest';
import { chooseCommandStage1 } from '../../src/ai/cpu';
import { chooseCommand, chooseReplacement } from '../../src/ai/policy';
import { MAX_SELF_PLAY_TURNS, playCpuBattle } from '../../src/ai/selfPlay';
import { chooseCommandStage2, chooseReplacementStage2, duelValue } from '../../src/ai/stage2';
import { pickTeams, TEAM_SIZE_FOR_SIM } from '../../src/ai/teams';
import { RUN_CONTENT } from '../../src/data/content';
import { FIGHTERS, PARTNER_FIGHTERS } from '../../src/data/fighters';
import { CPU_LEVEL_BY_AREA } from '../../src/engine/constants';
import { createRng } from '../../src/engine/rng';
import { chooseTeam, enterNode, runChoices, startRun } from '../../src/engine/run';
import type { BattleState, Combatant } from '../../src/engine/types';
import { createSession, playMove } from '../../src/ui/session';
import { makeCombatant, makeMove, makeSupportMove } from '../helpers/fixtures';

// 紅のキャラに翠の技は等倍。威力60・攻撃=防御=50 なら、予想ダメージは 28
const HIT = makeMove({ id: 'hit', attribute: 'green', power: 60 });
const HEAL = makeSupportMove({ id: 'heal', effects: [{ type: 'heal', percent: 50 }] });

function battle(player: Combatant[], enemy: Combatant[]): BattleState {
  return {
    turn: 1,
    sides: { player: { team: player, active: 0 }, enemy: { team: enemy, active: 0 } },
    awaitingReplacement: [],
    winner: null,
  };
}

const fighter = (overrides: Parameters<typeof makeCombatant>[0] = {}) => makeCombatant({ moves: [HIT], ...overrides });

describe('撃ち合いの見込み', () => {
  it('勝つなら残るHPの割合、負けるなら相手に残るHPの割合をマイナスにする', () => {
    // 自分は2ターンで倒せ、相手は5ターンかかる。先に動くので、受けるのは1回
    expect(duelValue({ hp: 100, maxHp: 100, damage: 30 }, { hp: 60, maxHp: 100, damage: 20 }, true)).toBe(0.8);
    // 自分は1回で倒される。相手の後に動くので、1回も攻撃できない
    expect(duelValue({ hp: 30, maxHp: 100, damage: 20 }, { hp: 100, maxHp: 100, damage: 40 }, false)).toBe(-1);
  });

  it('同じターン数なら、先に動くほうが勝つ', () => {
    const self = { hp: 100, maxHp: 100, damage: 50 };
    const opponent = { hp: 100, maxHp: 100, damage: 50 };
    expect(duelValue(self, opponent, true)).toBe(0.5);
    expect(duelValue(self, opponent, false)).toBe(-0.5);
  });

  it('お互いにダメージを出せなければ 0', () => {
    expect(duelValue({ hp: 10, maxHp: 10, damage: 0 }, { hp: 10, maxHp: 10, damage: 0 }, true)).toBe(0);
  });
});

describe('CPU 段階2：コマンド（仕様書 6）', () => {
  // 自分（HP20）は相手の1回の攻撃で倒れ、相手（HP100）を倒すには4回かかる → 不利
  const weak = fighter({ id: 'weak', hp: 20 });

  it('撃ち合いで勝てるなら、段階1と同じ技を選ぶ', () => {
    const state = battle([fighter({ stats: { attack: 100 } })], [fighter()]);
    expect(chooseCommandStage2(state, 'player')).toEqual(chooseCommandStage1(state, 'player'));
  });

  it('不利なら、相手の攻撃を1回受けても撃ち合いに勝てる控えと交代する', () => {
    const strong = fighter({ id: 'strong', stats: { attack: 100 } }); // 2回で倒せる。1回受けても HP72 で3回耐える
    const plain = fighter({ id: 'plain' }); // 4回かかり、3回で倒される → 交代しても負ける
    const state = battle([weak, plain, strong], [fighter()]);
    expect(chooseCommandStage2(state, 'player')).toEqual({ type: 'switch', to: 2 });
  });

  it('交代しても勝てる控えがいなければ、交代せずに攻撃する', () => {
    const state = battle([weak, fighter({ id: 'plain' }), fighter({ id: 'low', hp: 10, stats: { attack: 100 } })], [fighter()]);
    expect(chooseCommandStage2(state, 'player')).toEqual({ type: 'move', moveId: 'hit' });
  });

  it('HPが少なく、回復すれば撃ち合いに勝てるようになるなら、回復技を使う', () => {
    // 自分は素早い。HP20 → 回復して70、相手の攻撃を受けて42。相手（HP50）を2回で倒せるので勝てる
    const healer = fighter({ hp: 20, moves: [HIT, HEAL], stats: { speed: 60 } });
    expect(chooseCommandStage2(battle([healer], [fighter({ hp: 50 })]), 'player')).toEqual({ type: 'move', moveId: 'heal' });
    // 回復しても勝てないなら、少しでも削る
    expect(chooseCommandStage2(battle([healer], [fighter({ hp: 100 })]), 'player')).toEqual({ type: 'move', moveId: 'hit' });
  });

  it('倒れたあとは、撃ち合いの見込みが一番よい控えを出す', () => {
    const state = battle(
      [fighter({ hp: 0 }), fighter({ id: 'plain' }), fighter({ id: 'strong', stats: { attack: 100 } })],
      [fighter()],
    );
    expect(chooseReplacementStage2(state, 'player')).toBe(2);
    expect(chooseReplacement(state, 'player', 2)).toBe(2);
  });

  it('段階ごとに、使う考え方を切り替える', () => {
    const state = battle([weak, fighter({ id: 'strong', stats: { attack: 100 } })], [fighter()]);
    expect(chooseCommand(state, 'player', 1)).toEqual({ type: 'move', moveId: 'hit' });
    expect(chooseCommand(state, 'player', 2)).toEqual({ type: 'switch', to: 1 });
  });
});

describe('CPU 段階2の強さ', () => {
  const battles = (levels: { player: 1 | 2; enemy: 1 | 2 }, count: number, pool = FIGHTERS) => {
    let rng = createRng(77);
    const results = [];
    for (let i = 0; i < count; i += 1) {
      const teams = pickTeams(pool, TEAM_SIZE_FOR_SIM, rng);
      rng = teams.rng;
      results.push(playCpuBattle(teams.value.player, teams.value.enemy, createRng(i), levels));
    }
    return results;
  };

  // 段階2の強みは相性を読んだ交代。ふつうのキャラ（6色）どうしで比べる
  it('段階2は段階1に勝ち越す（ふつうのキャラどうし）', () => {
    const results = battles({ player: 1, enemy: 2 }, 300);
    const enemyWins = results.filter((result) => result.winner === 'enemy').length;
    expect(enemyWins / results.length).toBeGreaterThan(0.6);
  });

  // 白・黒は6色と相性がないので、交代で上を取れる場面が減る（3000戦で 0.63 → 0.60）。それでも勝ち越す
  it('彩り手の相棒（白・黒のカラスウサギを含む）が入っても、段階2は段階1に勝ち越す', () => {
    const results = battles({ player: 1, enemy: 2 }, 300, [...FIGHTERS, ...PARTNER_FIGHTERS]);
    const enemyWins = results.filter((result) => result.winner === 'enemy').length;
    expect(enemyWins / results.length).toBeGreaterThan(0.55);
  });

  it('段階2どうしでも、どの対戦も最後まで決着する（交代や回復をくり返して止まらない、がない）', () => {
    for (const result of battles({ player: 2, enemy: 2 }, 200, [...FIGHTERS, ...PARTNER_FIGHTERS])) {
      expect(result.winner).not.toBeNull();
      expect(result.turns).toBeLessThan(MAX_SELF_PLAY_TURNS);
    }
  });
});

describe('ランでの CPU の段階', () => {
  it('エリアごとの段階で戦う（エリア1は段階1、エリア2は段階2）', () => {
    const run = chooseTeam(startRun(RUN_CONTENT, 1), [0, 1, 2]);
    for (const area of [0, 1, 2]) {
      const entered = enterNode({ ...run, area }, runChoices(run)[0]!, RUN_CONTENT);
      expect(entered.phase).toMatchObject({ kind: 'battle', cpu: CPU_LEVEL_BY_AREA[area] });
    }
    expect(CPU_LEVEL_BY_AREA.slice(0, 2)).toEqual([1, 2]);
  });

  it('画面のバトルでも、その段階の CPU が相手のコマンドを選ぶ', () => {
    const state = battle([fighter({ id: 'p' })], [fighter({ id: 'weak', hp: 20 }), fighter({ id: 'strong', stats: { attack: 100 } })]);
    const stage1 = playMove(createSession(state, 1, 1), 'hit');
    const stage2 = playMove(createSession(state, 1, 2), 'hit');
    expect(stage1.lastEvents.some((event) => event.type === 'switched' && event.reason === 'command')).toBe(false);
    expect(stage2.lastEvents[0]).toEqual({ type: 'switched', side: 'enemy', from: 0, to: 1, reason: 'command' });
  });
});
