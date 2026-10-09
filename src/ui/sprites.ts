/**
 * キャラのドット絵（仕様書 5.1）。1体48×48ピクセル・右向きで、ファイル名はキャラ ID。
 * 画面では整数倍で拡大し、相手側は左右反転して使う。絵がないキャラ（テスト用など）は、属性の色の四角で代わりにする。
 * 小さい表示（候補一覧・選んだ順の枠・控え）には、別に用意した32×32の絵を等倍で使う。
 */
import { el } from './dom';

/** ドット絵の元の大きさ（ピクセル） */
export const SPRITE_SIZE = 48;

/** 小さい絵の大きさ（ピクセル）。等倍で出す */
export const ICON_SIZE = 32;

const FILES = import.meta.glob<string>('../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });
const ICON_FILES = import.meta.glob<string>('../assets/icons/*.png', { eager: true, query: '?url', import: 'default' });

/** キャラ ID からドット絵の URL を引く。なければ null */
export function spriteUrl(fighterId: string): string | null {
  return FILES[`../assets/sprites/${fighterId}.png`] ?? null;
}

/** キャラ ID から小さい絵の URL を引く。なければ null */
export function iconUrl(fighterId: string): string | null {
  return ICON_FILES[`../assets/icons/${fighterId}.png`] ?? null;
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
 * 小さい絵の要素（32×32 を等倍）。絵がなければ color の四角、color も null なら空の枠（まだ選んでいない枠など）
 */
export function iconElement(
  doc: Document,
  options: { url: string | null; color: string | null; className?: string },
): HTMLElement {
  return pixelImage(doc, { url: options.url, color: options.color ?? 'transparent', size: ICON_SIZE, className: options.className });
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
