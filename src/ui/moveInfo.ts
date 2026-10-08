/**
 * 技ボタンと、長押しで出す技の詳細の文章（表示だけ。ルールの計算はエンジンの関数を使う）。
 */
import { ATTRIBUTE_NAMES } from '../data/attributes';
import { STAT_NAMES, STATUS_NAMES } from '../data/labels';
import { getMove } from '../data/moves';
import { getEffectiveness, isResonant } from '../engine/affinity';
import { AFFINITY_MULTIPLIER, BIG_MOVE_COOLDOWN_TURNS, RESONANCE_MULTIPLIER } from '../engine/constants';
import type { Combatant, MoveDef, MoveEffect, MoveKind } from '../engine/types';

/** 技の種類の表示名 */
export const MOVE_KIND_NAMES: Readonly<Record<MoveKind, string>> = {
  normal: '通常',
  big: '大技',
  priority: '先制',
  support: '補助',
};

function describeEffect(effect: MoveEffect): string {
  switch (effect.type) {
    case 'stat': {
      const who = effect.target === 'self' ? '自分' : '相手';
      const direction = effect.stages > 0 ? '上げる' : '下げる';
      return `${who}の${STAT_NAMES[effect.stat]}を ${Math.abs(effect.stages)}段階 ${direction}`;
    }
    case 'heal':
      return `自分のHPを 最大HPの${effect.percent}% 回復する`;
    case 'status':
      return `相手を ${STATUS_NAMES[effect.status]} にする`;
  }
}

/** 補助技の効果の短い要約（技ボタンに出す）。例：「攻撃↑2」「相手の防御↓1」「回復 30%」「侵蝕にする」 */
export function summarizeEffects(effects: readonly MoveEffect[]): string {
  return effects
    .map((effect) => {
      switch (effect.type) {
        case 'stat': {
          const arrow = effect.stages > 0 ? '↑' : '↓';
          const who = effect.target === 'self' ? '' : '相手の';
          return `${who}${STAT_NAMES[effect.stat]}${arrow}${Math.abs(effect.stages)}`;
        }
        case 'heal':
          return `回復 ${effect.percent}%`;
        case 'status':
          return `${STATUS_NAMES[effect.status]}にする`;
      }
    })
    .join('・');
}

/** 技の詳細（長押しで出す）。1行目は「属性・種類」、以降に威力・相性・効果などを並べる */
export function describeMove(move: MoveDef, user: Combatant, opponent: Combatant): { name: string; lines: string[] } {
  const lines = [`${ATTRIBUTE_NAMES[move.attribute]}属性・${MOVE_KIND_NAMES[move.kind]}`];
  if (move.kind === 'support') {
    lines.push(...move.effects.map(describeEffect));
  } else {
    lines.push(`威力 ${move.power}`);
    const effectiveness = getEffectiveness(move.attribute, opponent.attribute);
    const affinity = { advantage: '有利', neutral: '等倍', disadvantage: '不利' }[effectiveness];
    lines.push(`いまの相手に ${affinity}（×${AFFINITY_MULTIPLIER[effectiveness]}）`);
    if (isResonant(move.attribute, user.attribute)) {
      lines.push(`共鳴（×${RESONANCE_MULTIPLIER}）`);
    }
    if (move.kind === 'big') {
      lines.push(`使ったあと ${BIG_MOVE_COOLDOWN_TURNS}ターン 使えない`);
    }
    if (move.kind === 'priority') {
      lines.push('技の中で先に動く');
    }
  }
  const cooldown = user.cooldowns[move.id] ?? 0;
  if (cooldown > 0) {
    lines.push(`あと ${cooldown}ターン 使えない`);
  }
  return { name: getMove(move.id).name, lines };
}
