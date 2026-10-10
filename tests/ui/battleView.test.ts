import { describe, expect, it } from 'vitest';
import { getFighter } from '../../src/data/fighters';
import { selectableMoves } from '../../src/engine/moves';
import { activeCombatant, memberAt } from '../../src/engine/team';
import { buildBattleView, INITIAL_UI_STATE } from '../../src/ui/battleView';
import { needsPlayerReplacement, playMove, type BattleSession } from '../../src/ui/session';
import { startSession } from '../helpers/session';

const nameAt = (session: BattleSession, index: number) =>
  getFighter(memberAt(session.state.sides.player, index).id).name;

describe('バトル画面に出す内容', () => {
  const session = startSession(1);

  it('始めは技を選ぶ場面で、控えは2体（場のキャラ以外）', () => {
    const view = buildBattleView(session);
    expect(view.phase).toBe('command');
    expect(view.bench.map((member) => member.index)).toEqual([1, 2]);
    expect(view.confirm).toBeNull();
    expect(view.moves.every((move) => !move.disabled)).toBe(true);
  });

  it('バトルの始まりのログは、口ぐせの1行のあとに「バトル開始！」。口ぐせがなければ「バトル開始！」だけ', () => {
    const opening = 'ヒナ「宣伝！！！」';
    expect(buildBattleView(session, INITIAL_UI_STATE, null, null, opening).logLines).toEqual([
      opening,
      'バトル開始！ 技を選んでください',
    ]);
    expect(buildBattleView(session).logLines).toEqual(['バトル開始！ 技を選んでください']);
    // 1ターン目が終わったら、口ぐせは出さない
    const next = playMove(session, selectableMoves(activeCombatant(session.state, 'player'))[0]!.id);
    expect(buildBattleView(next, INITIAL_UI_STATE, null, null, opening).logLines).not.toContain(opening);
  });

  it('技を選ぶ場面では、控えを交代先として選べる。選ぶと確認が出る', () => {
    const view = buildBattleView(session, { ...INITIAL_UI_STATE, selectedBench: 2 });
    expect(view.bench.every((member) => member.selectable)).toBe(true);
    expect(view.bench.find((member) => member.index === 2)?.selected).toBe(true);
    expect(view.confirm).toEqual({
      index: 2,
      question: `${nameAt(session, 0)}を戻して ${nameAt(session, 2)}と交代しますか？`,
      confirmLabel: '交代する',
    });
  });

  it('倒れたときは「出しますか？」の確認になり、技は選べない', () => {
    let current = session;
    for (let i = 0; i < 100 && !needsPlayerReplacement(current); i += 1) {
      current = playMove(current, selectableMoves(activeCombatant(current.state, 'player'))[0]!.id);
    }
    expect(needsPlayerReplacement(current)).toBe(true);
    const target = buildBattleView(current).bench.find((member) => member.selectable)!;
    const view = buildBattleView(current, { ...INITIAL_UI_STATE, selectedBench: target.index });
    expect(view.phase).toBe('replacement');
    expect(view.moves.every((move) => move.disabled)).toBe(true);
    expect(view.confirm).toEqual({ index: target.index, question: `${target.name}を出しますか？`, confirmLabel: '出す' });
  });

  it('倒れている控えは選べず、選んでいても確認は出ない', () => {
    const fainted: BattleSession = {
      ...session,
      state: {
        ...session.state,
        sides: {
          ...session.state.sides,
          player: {
            ...session.state.sides.player,
            team: session.state.sides.player.team.with(1, { ...memberAt(session.state.sides.player, 1), hp: 0 }),
          },
        },
      },
    };
    const view = buildBattleView(fainted, { ...INITIAL_UI_STATE, selectedBench: 1 });
    expect(view.bench.find((member) => member.index === 1)?.selectable).toBe(false);
    expect(view.confirm).toBeNull();
  });
});
