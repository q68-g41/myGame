/**
 * CPU 同士の自動対戦（バランス確認用）。
 * 使い方：npm run sim -- --battles 1000 --seed 1
 */
import { playCpuBattle } from '../src/ai/selfPlay';
import { FIGHTERS, type FighterData } from '../src/data/fighters';
import { TEAM_SIZE_FOR_SIM, pickTeams } from '../src/ai/teams';
import { createRng, nextInt } from '../src/engine/rng';

function readOption(name: string, fallback: number): number {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index < 0) {
    return fallback;
  }
  const arg = args[index]!;
  const raw = arg.includes('=') ? arg.split('=')[1] : args[index + 1];
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} には 0 以上の整数を指定してください（いま ${raw}）`);
  }
  return value;
}

const percent = (value: number, total: number) => (total === 0 ? '-' : `${((value / total) * 100).toFixed(1)}%`);

function main(): void {
  const battles = readOption('battles', 1000);
  const seed = readOption('seed', 1);

  let rng = createRng(seed);
  let finished = 0;
  let playerWins = 0;
  const turnCounts: number[] = [];
  const byFighter = new Map<string, { fighter: FighterData; played: number; won: number }>(
    FIGHTERS.map((fighter) => [fighter.id, { fighter, played: 0, won: 0 }]),
  );

  for (let i = 0; i < battles; i += 1) {
    const teams = pickTeams(FIGHTERS, TEAM_SIZE_FOR_SIM, rng);
    rng = teams.rng;
    const battleSeed = nextInt(rng, 0, 0xffffffff);
    rng = battleSeed.rng;

    const result = playCpuBattle(teams.value.player, teams.value.enemy, createRng(battleSeed.value));
    if (result.winner === null) {
      continue;
    }
    finished += 1;
    turnCounts.push(result.turns);
    if (result.winner === 'player') {
      playerWins += 1;
    }
    for (const side of ['player', 'enemy'] as const) {
      for (const fighter of teams.value[side]) {
        const record = byFighter.get(fighter.id)!;
        record.played += 1;
        if (result.winner === side) {
          record.won += 1;
        }
      }
    }
  }

  const average = turnCounts.reduce((sum, turns) => sum + turns, 0) / Math.max(1, turnCounts.length);
  const lines = [
    'CPU同士の自動対戦（段階1どうし、3対3）',
    `対戦数: ${battles}  シード: ${seed}`,
    `決着: ${finished} / ${battles}`,
    `player 側の勝率: ${percent(playerWins, finished)}`,
    `ターン数: 平均 ${average.toFixed(1)} / 最短 ${Math.min(...turnCounts)} / 最長 ${Math.max(...turnCounts)}`,
    '',
    'キャラ別（出場数・勝率）',
    ...[...byFighter.values()].map(
      ({ fighter, played, won }) => `  ${fighter.name}  ${String(played).padStart(5)}  ${percent(won, played).padStart(6)}`,
    ),
  ];
  console.log(lines.join('\n'));

  if (finished < battles) {
    console.error(`決着しなかった対戦が ${battles - finished} 件あります`);
    process.exitCode = 1;
  }
}

main();
