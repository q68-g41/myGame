import { describe, expect, it } from 'vitest';
import { selectableMoves } from '../../src/engine/moves';
import { activeCombatant, switchTargets } from '../../src/engine/team';
import {
  needsPlayerReplacement,
  playMove,
  playReplacement,
  playSwitch,
  startSession,
  type BattleSession,
} from '../../src/ui/session';

/** 自分は「選べる技の先頭」と「控えの先頭」を選び続けて、決着まで進める */
function playToEnd(seed: number): { session: BattleSession; steps: number } {
  let session = startSession(seed);
  let steps = 0;
  while (session.state.winner === null && steps < 500) {
    if (needsPlayerReplacement(session)) {
      session = playReplacement(session, switchTargets(session.state.sides.player)[0]!);
    } else {
      session = playMove(session, selectableMoves(activeCombatant(session.state, 'player'))[0]!.id);
    }
    steps += 1;
  }
  return { session, steps };
}

describe('1戦の流れ', () => {
  it('3対3で始まる。同じシードなら同じチーム、違うシードなら（たいてい）違うチーム', () => {
    const a = startSession(1);
    expect(a.state.sides.player.team).toHaveLength(3);
    expect(a.state.sides.enemy.team).toHaveLength(3);
    expect(startSession(1).state).toEqual(a.state);

    const teams = new Set(
      [1, 2, 3, 4, 5].map((seed) => startSession(seed).state.sides.player.team.map((m) => m.id).join(',')),
    );
    expect(teams.size).toBeGreaterThan(1);
  });

  it('技を選ぶとターンが進み、相手も行動する', () => {
    const start = startSession(1);
    const moveId = selectableMoves(activeCombatant(start.state, 'player'))[0]!.id;
    const next = playMove(start, moveId);
    expect(next.state.turn).toBe(2);
    expect(next.previousState).toBe(start.state);
    const users = next.lastEvents.filter((event) => event.type === 'moveUsed').map((event) => event.side);
    expect(users).toContain('enemy');
  });

  it('交代するとターンが進み、交代は相手の行動より先に起きる', () => {
    const start = startSession(1);
    const next = playSwitch(start, 2);
    expect(next.state.turn).toBe(2);
    expect(next.state.sides.player.active).toBe(2);
    expect(next.lastEvents[0]).toEqual({ type: 'switched', side: 'player', from: 0, to: 2, reason: 'command' });
  });

  it('相手が倒れたら、CPU がすぐに控えを出す（自分は選ばなくてよい）', () => {
    // 決着までの間に、相手だけが倒れる場面が必ずあることを確かめる
    let session = startSession(3);
    let sawEnemyReplacement = false;
    while (session.state.winner === null) {
      session = needsPlayerReplacement(session)
        ? playReplacement(session, switchTargets(session.state.sides.player)[0]!)
        : playMove(session, selectableMoves(activeCombatant(session.state, 'player'))[0]!.id);
      if (session.lastEvents.some((e) => e.type === 'switched' && e.side === 'enemy' && e.reason === 'replacement')) {
        sawEnemyReplacement = true;
        expect(session.state.awaitingReplacement).not.toContain('enemy');
      }
    }
    expect(sawEnemyReplacement).toBe(true);
  });

  it('自分が倒れたら、控えを選ぶまで待つ', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      let session = startSession(seed);
      while (session.state.winner === null && !needsPlayerReplacement(session)) {
        session = playMove(session, selectableMoves(activeCombatant(session.state, 'player'))[0]!.id);
      }
      if (!needsPlayerReplacement(session)) {
        continue;
      }
      const choice = switchTargets(session.state.sides.player)[0]!;
      const replaced = playReplacement(session, choice);
      expect(replaced.state.sides.player.active).toBe(choice);
      expect(replaced.state.turn).toBe(session.state.turn);
      return;
    }
    throw new Error('自分が倒れる場面が見つかりませんでした');
  });

  it('どのシードでも、最後まで遊べて決着する', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const { session } = playToEnd(seed);
      expect(session.state.winner).not.toBeNull();
    }
  });
});
