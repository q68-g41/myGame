/**
 * キャラのドット絵（仕様書 5.1）。1体48×48ピクセル・右向きで、ファイル名はキャラ ID。
 * 画面では整数倍で拡大し、相手側は左右反転して使う。絵がないキャラ（テスト用など）は、属性の色の四角で代わりにする。
 * バトルの場のキャラは、待機中のコマ送りアニメ（M7-3）を使う。4コマを横に並べた 192×48 の絵で、1コマ目は止まった絵と同じ。
 * 小さい表示（候補一覧・選んだ順の枠・控え）とマップのボスのマスには、別に用意した32×32の絵を等倍で使う。
 * マップのマスのアイコンは24×24で、ファイル名はマスの種類（battle など）。
 * 彩り手（主人公・M8）の絵は64×64の全身で、ファイル名は彩り手の ID。
 */
import { el } from './dom';

/** ドット絵の元の大きさ（ピクセル） */
export const SPRITE_SIZE = 48;

/** 小さい絵の大きさ（ピクセル）。等倍で出す */
export const ICON_SIZE = 32;

/** マップのマスのアイコンの大きさ（ピクセル）。等倍で出す */
export const MAP_ICON_SIZE = 24;

/** 彩り手の絵の大きさ（ピクセル） */
export const IRODORITE_SIZE = 64;

/** コマ送りアニメのコマの数 */
export const ANIM_FRAMES = 4;

/** コマ送りアニメの1周の長さ（style.css の idle-frames と同じ） */
export const ANIM_CYCLE_MS = 800;

const FILES = import.meta.glob<string>('../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });
const ICON_FILES = import.meta.glob<string>('../assets/icons/*.png', { eager: true, query: '?url', import: 'default' });
const MAP_FILES = import.meta.glob<string>('../assets/map/*.png', { eager: true, query: '?url', import: 'default' });
const ANIM_FILES = import.meta.glob<string>('../assets/anim/*.png', { eager: true, query: '?url', import: 'default' });
const IRODORITE_FILES = import.meta.glob<string>('../assets/irodorite/*.png', { eager: true, query: '?url', import: 'default' });

/** キャラ ID からドット絵の URL を引く。なければ null */
export function spriteUrl(fighterId: string): string | null {
  return FILES[`../assets/sprites/${fighterId}.png`] ?? null;
}

/** キャラ ID から小さい絵の URL を引く。なければ null */
export function iconUrl(fighterId: string): string | null {
  return ICON_FILES[`../assets/icons/${fighterId}.png`] ?? null;
}

/** キャラ ID からコマ送りアニメの絵の URL を引く。なければ null */
export function animUrl(fighterId: string): string | null {
  return ANIM_FILES[`../assets/anim/${fighterId}.png`] ?? null;
}

/** 彩り手の ID から絵の URL を引く。なければ null */
export function irodoriteUrl(irodoriteId: string): string | null {
  return IRODORITE_FILES[`../assets/irodorite/${irodoriteId}.png`] ?? null;
}

/** マスの種類からマップのアイコンの URL を引く。なければ null */
export function mapIconUrl(kind: string): string | null {
  return MAP_FILES[`../assets/map/${kind}.png`] ?? null;
}

/**
 * キャラの絵の要素。scale は拡大の倍率（整数）、flipped なら左右反転（相手側）。
 * 絵がなければ、color の四角を同じ大きさで出す
 */
export function spriteElement(
  doc: Document,
  options: { url: string | null; color: string; scale: number; flipped?: boolean; className?: string },
): HTMLElement {
  return pixelImage(doc, { ...options, size: SPRITE_SIZE * options.scale });
}

/**
 * コマ送りアニメの要素（バトルの場のキャラ）。コマを並べた絵を、1コマぶんの窓から少しずつずらして見せる。
 * コマ送りの絵がなければ、止まった絵（spriteElement）にする
 */
export function animatedSpriteElement(
  doc: Document,
  options: { anim: string | null; url: string | null; color: string; scale: number; flipped?: boolean },
): HTMLElement {
  if (options.anim === null) {
    return spriteElement(doc, options);
  }
  const size = SPRITE_SIZE * options.scale;
  const frame = el(doc, 'span', ['sprite', 'sprite--anim', options.flipped ? 'sprite--flipped' : ''].filter(Boolean).join(' '));
  frame.style.width = `${size}px`;
  frame.style.height = `${size}px`;
  const strip = el(doc, 'img', 'sprite__frames');
  strip.src = options.anim;
  strip.width = size * ANIM_FRAMES;
  strip.height = size;
  strip.alt = '';
  strip.decoding = 'async';
  frame.append(strip);
  return frame;
}

/**
 * 小さい絵の要素（32×32 を等倍）。絵がなければ color の四角、color も null なら空の枠（まだ選んでいない枠など）
 */
export function iconElement(
  doc: Document,
  options: { url: string | null; color: string | null; className?: string },
): HTMLElement {
  return pixelImage(doc, { url: options.url, color: options.color ?? 'transparent', size: ICON_SIZE, className: options.className });
}

/** 彩り手の絵（64×64）の要素。scale は拡大の倍率（整数）。絵がなければ color の四角 */
export function irodoriteElement(
  doc: Document,
  options: { url: string | null; color: string; scale: number; className?: string },
): HTMLElement {
  return pixelImage(doc, { url: options.url, color: options.color, size: IRODORITE_SIZE * options.scale, className: options.className });
}

/** マップのアイコンの要素（等倍）。size はマスのアイコン（24）とボスの絵（32）で変わる */
export function mapIconElement(doc: Document, options: { url: string; size: number; className?: string }): HTMLElement {
  return pixelImage(doc, { url: options.url, color: 'transparent', size: options.size, className: options.className });
}

function pixelImage(
  doc: Document,
  options: { url: string | null; color: string; size: number; flipped?: boolean; className?: string },
): HTMLElement {
  const size = options.size;
  const classes = ['sprite', options.flipped ? 'sprite--flipped' : '', options.className ?? ''].filter(Boolean).join(' ');
  if (options.url === null) {
    const box = el(doc, 'span', `${classes} sprite--placeholder`);
    box.style.width = `${size}px`;
    box.style.height = `${size}px`;
    box.style.background = options.color;
    box.setAttribute('aria-hidden', 'true');
    return box;
  }
  const img = el(doc, 'img', classes);
  img.src = options.url;
  img.width = size;
  img.height = size;
  img.alt = '';
  img.decoding = 'async';
  return img;
}
