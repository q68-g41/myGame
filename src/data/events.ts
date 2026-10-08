/**
 * イベントのデータ（仮）。文章で選択肢を見せ、リスクとリターンを選んでもらう（仕様書 4.2）。
 * M5 で本番の文章と数に作り直す前提。選択肢の説明には、起きることをそのまま書く。
 */
import type { EventDef, EventOption } from '../engine/nodes';

/** 画面に出す文章つきのイベント */
export type EventData = Omit<EventDef, 'options'> & {
  readonly title: string;
  readonly text: string;
  readonly options: readonly (EventOption & { readonly label: string; readonly description: string })[];
};

export const EVENTS: readonly EventData[] = [
  {
    id: 'old-shrine',
    title: '古びた祠',
    text: '道ばたに古びた祠がある。体力を供えると、力を授けてくれるらしい。',
    options: [
      {
        label: '体力を供える',
        description: '全員のHPが 最大HPの10% 減る。ランダムな1体の攻撃が上がる',
        effects: [
          { type: 'damage', target: 'all', percent: 10 },
          { type: 'statBoost', target: 'random', stat: 'attack' },
        ],
      },
      { label: '立ち去る', description: '何も起きない', effects: [] },
    ],
  },
  {
    id: 'glowing-spring',
    title: '光る泉',
    text: '青く光る泉がある。飲めば元気が出そうだが、ところどころ濁っている。',
    options: [
      {
        label: 'たっぷり飲む',
        description: '半々で、全員のHPが 最大HPの30% 回復するか、15% 減る',
        effects: [
          {
            type: 'gamble',
            chancePercent: 50,
            success: [{ type: 'heal', target: 'all', percent: 30 }],
            failure: [{ type: 'damage', target: 'all', percent: 15 }],
          },
        ],
      },
      {
        label: '少しだけ飲む',
        description: '全員のHPが 最大HPの10% 回復する',
        effects: [{ type: 'heal', target: 'all', percent: 10 }],
      },
    ],
  },
  {
    id: 'training-ground',
    title: '修行場',
    text: '岩だらけの修行場がある。きびしい修行に耐えれば、強くなれそうだ。',
    options: [
      {
        label: 'きびしく鍛える',
        description: '先頭のキャラのHPが 最大HPの25% 減る。そのキャラの攻撃と防御が上がる',
        effects: [
          { type: 'damage', target: 'lead', percent: 25 },
          { type: 'statBoost', target: 'lead', stat: 'attack' },
          { type: 'statBoost', target: 'lead', stat: 'defense' },
        ],
      },
      {
        label: '軽く体を動かす',
        description: '先頭のキャラの素早さが上がる',
        effects: [{ type: 'statBoost', target: 'lead', stat: 'speed' }],
      },
    ],
  },
];

const EVENT_BY_ID: ReadonlyMap<string, EventData> = new Map(EVENTS.map((event) => [event.id, event]));

/** ID からイベントを取り出す。なければエラー */
export function getEvent(id: string): EventData {
  const event = EVENT_BY_ID.get(id);
  if (!event) {
    throw new Error(`イベント ${id} のデータがありません`);
  }
  return event;
}
