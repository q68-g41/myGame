/**
 * 画面の上半分の背景（空と山並み）の種類（仕様書 5）。色は src/ui/style.css の [data-sky] に置く。
 * エリアが進むと、夕暮れ → 夜 → くすんだ紫 と空の色が変わる。
 */
export type SkyId = 'night' | 'dusk' | 'deep' | 'kusumi';

/** ランの外（トップ・彩り手を選ぶ・チーム選択・ランの結果）の空：藍色の夜 */
export const DEFAULT_SKY: SkyId = 'night';

/** エリアごとの空（添字はエリア。0 がエリア1）：紅の夕暮れ・深い藍の夜・くすんだ紫 */
export const AREA_SKIES: readonly SkyId[] = ['dusk', 'deep', 'kusumi'];
