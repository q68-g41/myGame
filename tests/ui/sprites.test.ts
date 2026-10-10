// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BOSS_FIGHTERS, FIGHTERS } from '../../src/data/fighters';
import {
  ANIM_FRAMES,
  animatedSpriteElement,
  animUrl,
  ICON_SIZE,
  iconElement,
  iconUrl,
  MAP_ICON_SIZE,
  mapIconElement,
  mapIconUrl,
  SPRITE_SIZE,
  spriteElement,
  spriteUrl,
} from '../../src/ui/sprites';

/** 絵のファイルの中身（data URI）。キーはファイルのパス */
const FILES = import.meta.glob<string>('../../src/assets/sprites/*.png', { eager: true, query: '?inline', import: 'default' });
const ICON_FILES = import.meta.glob<string>('../../src/assets/icons/*.png', { eager: true, query: '?inline', import: 'default' });
const MAP_FILES = import.meta.glob<string>('../../src/assets/map/*.png', { eager: true, query: '?inline', import: 'default' });
const ANIM_FILES = import.meta.glob<string>('../../src/assets/anim/*.png', { eager: true, query: '?inline', import: 'default' });

/** PNG の幅と高さ（IHDR の値） */
function pngSize(dataUri: string): { width: number; height: number } {
  const bytes = Uint8Array.from(atob(dataUri.split(',')[1]!), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('ドット絵のファイル（仕様書 5.1）', () => {
  const ids = [...FIGHTERS, ...BOSS_FIGHTERS].map((fighter) => fighter.id);
  const files = Object.keys(FILES).map((path) => path.split('/').pop()!);

  it('キャラ14体とボス3体のすべてに絵があり、キャラにない絵はない', () => {
    for (const id of ids) {
      expect(spriteUrl(id), id).toBeTypeOf('string');
    }
    expect(files.map((file) => file.replace(/\.png$/, '')).sort()).toEqual([...ids].sort());
    expect(spriteUrl('unknown')).toBeNull();
  });

  it('どれも48×48', () => {
    for (const [path, dataUri] of Object.entries(FILES)) {
      expect(pngSize(dataUri), path).toEqual({ width: SPRITE_SIZE, height: SPRITE_SIZE });
    }
  });
});

describe('小さい絵のファイル（候補一覧・選んだ順の枠・控え）', () => {
  it('キャラ14体のすべてにあり、キャラにない絵はない（ボスは小さい表示に出ないので、なくてよい）', () => {
    const ids = FIGHTERS.map((fighter) => fighter.id);
    for (const id of ids) {
      expect(iconUrl(id), id).toBeTypeOf('string');
    }
    const files = Object.keys(ICON_FILES).map((path) => path.split('/').pop()!.replace(/\.png$/, ''));
    expect(files.sort()).toEqual([...ids].sort());
    expect(iconUrl('unknown')).toBeNull();
  });

  it('どれも32×32', () => {
    for (const [path, dataUri] of Object.entries(ICON_FILES)) {
      expect(pngSize(dataUri), path).toEqual({ width: ICON_SIZE, height: ICON_SIZE });
    }
  });
});

describe('コマ送りアニメのファイル（M7-3）', () => {
  it('キャラ14体とボス3体のすべてにあり、キャラにない絵はない', () => {
    const ids = [...FIGHTERS, ...BOSS_FIGHTERS].map((fighter) => fighter.id);
    for (const id of ids) {
      expect(animUrl(id), id).toBeTypeOf('string');
    }
    const files = Object.keys(ANIM_FILES).map((path) => path.split('/').pop()!.replace(/\.png$/, ''));
    expect(files.sort()).toEqual([...ids].sort());
    expect(animUrl('unknown')).toBeNull();
  });

  it('どれも 48×48 のコマを4つ横に並べた 192×48', () => {
    for (const [path, dataUri] of Object.entries(ANIM_FILES)) {
      expect(pngSize(dataUri), path).toEqual({ width: SPRITE_SIZE * ANIM_FRAMES, height: SPRITE_SIZE });
    }
  });
});

describe('マップのアイコンのファイル', () => {
  it('ボス以外のマスの種類すべてにあり、ほかの絵はない（ボスのマスはボスのドット絵を使う）', () => {
    const kinds = ['battle', 'elite', 'rest', 'scout', 'event'];
    for (const kind of kinds) {
      expect(mapIconUrl(kind), kind).toBeTypeOf('string');
    }
    const files = Object.keys(MAP_FILES).map((path) => path.split('/').pop()!.replace(/\.png$/, ''));
    expect(files.sort()).toEqual([...kinds].sort());
    expect(mapIconUrl('boss')).toBeNull();
  });

  it('どれも24×24', () => {
    for (const [path, dataUri] of Object.entries(MAP_FILES)) {
      expect(pngSize(dataUri), path).toEqual({ width: MAP_ICON_SIZE, height: MAP_ICON_SIZE });
    }
  });

  it('アイコンの要素は、指定の大きさで等倍に出す', () => {
    const img = mapIconElement(document, { url: mapIconUrl('rest')!, size: MAP_ICON_SIZE, className: 'map-node__icon' });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('width')).toBe('24');
    expect(img.classList.contains('map-node__icon')).toBe(true);
  });
});

describe('ドット絵の要素', () => {
  it('整数倍で拡大し、相手側は左右反転する', () => {
    const img = spriteElement(document, { url: spriteUrl('crimson-trial'), color: '#d9473f', scale: 2, flipped: true });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('width')).toBe('96');
    expect(img.getAttribute('height')).toBe('96');
    expect(img.classList.contains('sprite--flipped')).toBe(true);
    expect(img.getAttribute('alt')).toBe('');
    const player = spriteElement(document, { url: spriteUrl('crimson-trial'), color: '#d9473f', scale: 1 });
    expect(player.getAttribute('width')).toBe('48');
    expect(player.classList.contains('sprite--flipped')).toBe(false);
  });

  it('絵がなければ、属性の色の四角を同じ大きさで出す', () => {
    const box = spriteElement(document, { url: null, color: 'rgb(217, 71, 63)', scale: 2 });
    expect(box.tagName).toBe('SPAN');
    expect(box.classList.contains('sprite--placeholder')).toBe(true);
    expect(box.style.width).toBe('96px');
    expect(box.style.background).toContain('rgb(217, 71, 63)');
  });
});

describe('コマ送りアニメの要素', () => {
  it('1コマぶんの窓の中に、コマを並べた絵を置く。相手側は左右反転する', () => {
    const frame = animatedSpriteElement(document, {
      anim: animUrl('crimson-trial'),
      url: spriteUrl('crimson-trial'),
      color: '#d9473f',
      scale: 2,
      flipped: true,
    });
    expect(frame.classList.contains('sprite--anim')).toBe(true);
    expect(frame.classList.contains('sprite--flipped')).toBe(true);
    expect(frame.style.width).toBe('96px');
    expect(frame.style.height).toBe('96px');
    const strip = frame.querySelector('img')!;
    expect(strip.getAttribute('src')).toBe(animUrl('crimson-trial'));
    expect(strip.getAttribute('width')).toBe('384');
    expect(strip.getAttribute('alt')).toBe('');
  });

  it('コマ送りの絵がなければ、止まった絵を出す', () => {
    const img = animatedSpriteElement(document, { anim: null, url: spriteUrl('crimson-trial'), color: '#d9473f', scale: 2 });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe(spriteUrl('crimson-trial'));
  });
});

describe('小さい絵の要素', () => {
  it('32×32 を等倍で出す', () => {
    const img = iconElement(document, { url: iconUrl('crimson-trial'), color: '#d9473f', className: 'candidate__icon' });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('width')).toBe('32');
    expect(img.classList.contains('candidate__icon')).toBe(true);
  });

  it('絵がなければ属性の色の四角、色もなければ（まだ選んでいない枠）空の枠', () => {
    const box = iconElement(document, { url: null, color: 'rgb(217, 71, 63)' });
    expect(box.style.width).toBe('32px');
    expect(box.style.background).toContain('rgb(217, 71, 63)');
    const empty = iconElement(document, { url: null, color: null });
    expect(empty.style.width).toBe('32px');
    expect(empty.style.background).toContain('transparent');
  });
});
