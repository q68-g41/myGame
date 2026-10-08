/**
 * お守りのデータ（仮）。M4 では仕様書 4.4 の例の2つだけ。M5 で20個に増やす。
 */
import type { CharmDef } from '../engine/run';

/** 画面に出す名前と説明つきのお守り */
export type CharmData = CharmDef & { readonly name: string; readonly description: string };

export const CHARMS: readonly CharmData[] = [
  {
    id: 'swift-charm',
    name: '先手のお守り',
    description: '先制技の威力 +20%',
    effect: { type: 'movePower', moveKind: 'priority', percent: 20 },
  },
  {
    id: 'relay-charm',
    name: '入れ替えのお守り',
    description: '交代で場に出たキャラのHPを 最大HPの5% 回復',
    effect: { type: 'switchInHeal', percent: 5 },
  },
];

const CHARM_BY_ID: ReadonlyMap<string, CharmData> = new Map(CHARMS.map((charm) => [charm.id, charm]));

/** ID からお守りを取り出す。なければエラー */
export function getCharm(id: string): CharmData {
  const charm = CHARM_BY_ID.get(id);
  if (!charm) {
    throw new Error(`お守り ${id} のデータがありません`);
  }
  return charm;
}
