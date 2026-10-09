/**
 * お守りのデータ（仕様書 4.4）。20個。名前は和風の世界観での仮置きで、数値も仮。
 * 説明文は効果から作るので、数値を変えても説明とずれない。
 */
import { ATTRIBUTE_ORDER, REST_HEAL_PERCENT } from '../engine/constants';
import type { CharmDef } from '../engine/run';
import type { AttackKind, CharmEffect } from '../engine/types';
import { ATTRIBUTE_NAMES } from './attributes';
import { STATUS_NAMES } from './labels';

/** 画面に出す名前と説明つきのお守り */
export type CharmData = CharmDef & { readonly name: string; readonly description: string };

/** 説明文での、技の種類の呼び方 */
const MOVE_KIND_LABELS: Readonly<Record<AttackKind, string>> = {
  normal: '通常の技',
  big: '大技',
  priority: '先制技',
};

/** お守りの効果の説明文 */
export function describeCharmEffect(effect: CharmEffect): string {
  switch (effect.type) {
    case 'movePower':
      return `${MOVE_KIND_LABELS[effect.moveKind]}の威力 +${effect.percent}%`;
    case 'attributePower':
      return `${ATTRIBUTE_NAMES[effect.attribute]}属性の技の威力 +${effect.percent}%`;
    case 'lowHpPower':
      return `HPが 最大HPの${effect.hpPercent}%以下のとき、攻撃技の威力 +${effect.percent}%`;
    case 'damageCut':
      return effect.against === 'advantage'
        ? `相手の技が有利な相性のとき、受けるダメージ -${effect.percent}%`
        : `${MOVE_KIND_LABELS[effect.against]}で受けるダメージ -${effect.percent}%`;
    case 'switchInHeal':
      return `交代で場に出たキャラのHPを 最大HPの${effect.percent}% 回復`;
    case 'turnEndHeal':
      return `ターンの終わりに、場のキャラのHPを 最大HPの${effect.percent}% 回復`;
    case 'statusGuard':
      return `${STATUS_NAMES[effect.status]}にならない`;
    case 'healPower':
      return `回復技の回復量 +${effect.percent}%`;
    case 'cooldownCut':
      return `大技の使えないターンが ${effect.turns}ターン短くなる`;
    case 'victoryHeal':
      return `戦闘に勝つと、全員のHPを 最大HPの${effect.percent}% 回復`;
    case 'restHeal':
      return `休憩で回復する量が 最大HPの${REST_HEAL_PERCENT}% → ${REST_HEAL_PERCENT + effect.percent}% になる`;
  }
}

function charm(id: string, name: string, effect: CharmEffect): CharmData {
  return { id, name, effect, description: describeCharmEffect(effect) };
}

export const CHARMS: readonly CharmData[] = [
  // 技の種類の威力
  charm('swift-charm', '先手のお守り', { type: 'movePower', moveKind: 'priority', percent: 20 }),
  charm('steady-charm', '鍛錬のお守り', { type: 'movePower', moveKind: 'normal', percent: 7 }),
  charm('burst-charm', '渾身のお守り', { type: 'movePower', moveKind: 'big', percent: 15 }),
  // 属性の威力（名前は属性の表示名から作る）
  ...ATTRIBUTE_ORDER.map((attribute) =>
    charm(`${attribute}-charm`, `${ATTRIBUTE_NAMES[attribute]}のお守り`, {
      type: 'attributePower',
      attribute,
      percent: 15,
    }),
  ),
  charm('last-stand-charm', '背水のお守り', { type: 'lowHpPower', hpPercent: 30, percent: 25 }),
  // 受けるダメージ
  charm('parry-charm', '受け流しのお守り', { type: 'damageCut', against: 'advantage', percent: 10 }),
  charm('bulwark-charm', '堅守のお守り', { type: 'damageCut', against: 'big', percent: 10 }),
  // 回復
  charm('relay-charm', '入れ替えのお守り', { type: 'switchInHeal', percent: 5 }),
  charm('breath-charm', '息吹のお守り', { type: 'turnEndHeal', percent: 3 }),
  charm('remedy-charm', '養生のお守り', { type: 'healPower', percent: 50 }),
  // 状態異常
  charm('purify-charm', '清めのお守り', { type: 'statusGuard', status: 'erosion' }),
  charm('nimble-charm', '身軽のお守り', { type: 'statusGuard', status: 'slow' }),
  // 大技
  charm('spirit-charm', '気力のお守り', { type: 'cooldownCut', turns: 1 }),
  // ラン
  charm('triumph-charm', '凱旋のお守り', { type: 'victoryHeal', percent: 10 }),
  charm('hot-spring-charm', '湯治のお守り', { type: 'restHeal', percent: 20 }),
];

const CHARM_BY_ID: ReadonlyMap<string, CharmData> = new Map(CHARMS.map((data) => [data.id, data]));

/** ID からお守りを取り出す。なければエラー */
export function getCharm(id: string): CharmData {
  const data = CHARM_BY_ID.get(id);
  if (!data) {
    throw new Error(`お守り ${id} のデータがありません`);
  }
  return data;
}
