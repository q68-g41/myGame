// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BOSS_FIGHTERS, FIGHTERS } from '../../src/data/fighters';
import { SPRITE_SIZE, spriteElement, spriteUrl } from '../../src/ui/sprites';

/** 絵のファイルの中身（data URI）。キーはファイルのパス */
const FILES = import.meta.glob<string>('../../src/assets/sprites/*.png', { eager: true, query: '?inline', import: 'default' });

/** PNG の幅と高さ（IHDR の値） */
function pngSize(dataUri: string): { width: number; height: number } {
  const bytes = Uint8Array.from(atob(dataUri.split(',')[1]!), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('ドット絵のファイル（仕様書 5.1）', () => {
  const ids = [...FIGHTERS, ...BOSS_FIGHTERS].map((fighter) => fighter.id);
  const files = Object.keys(FILES).map((path) => path.split('/').pop()!);

  it('キャラ12体とボス3体のすべてに絵があり、キャラにない絵はない', () => {
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
