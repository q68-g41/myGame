import { describe, expect, it } from 'vitest';
import charset from '../../src/assets/fonts/charset.txt?raw';

/** ゲームの文言が入っているファイル（scripts/subset-fonts.ts が文字を集めるのと同じ範囲） */
const SOURCES = import.meta.glob<string>(['../../src/**/*.ts', '../../src/**/*.css', '../../index.html'], {
  eager: true,
  query: '?raw',
  import: 'default',
});
const FONT_FILES = import.meta.glob<string>('../../src/assets/fonts/*.woff2', { eager: true, query: '?url', import: 'default' });
const LICENSES = import.meta.glob<string>('../../public/licenses/*.txt', { eager: true, query: '?raw', import: 'default' });

describe('同梱するフォント（仕様書 5・B案）', () => {
  it('文字を集めるファイルは、中身まで読めている（CSS も。vite.config.ts の test.css）', () => {
    expect(Object.keys(SOURCES)).toContain('../../src/ui/style.css');
    for (const [path, text] of Object.entries(SOURCES)) {
      expect(text, path).not.toBe('');
    }
  });

  it('ゲームで使う文字は、すべてフォントに入っている（足りなければ npm run fonts で作り直す）', () => {
    const included = new Set(charset);
    const missing = new Set<string>();
    for (const text of Object.values(SOURCES)) {
      for (const char of text) {
        if (char.codePointAt(0)! >= 0x20 && !included.has(char)) {
          missing.add(char);
        }
      }
    }
    expect([...missing].join('')).toBe('');
  });

  it('ドット風（DotGothic16）と、文章用（Zen Kaku Gothic New の標準・太字）の3つがある', () => {
    const files = Object.keys(FONT_FILES).map((path) => path.split('/').pop());
    expect(files.sort()).toEqual(['dotgothic16-400.woff2', 'zen-kaku-gothic-new-400.woff2', 'zen-kaku-gothic-new-700.woff2']);
  });

  it('フォントのライセンス（SIL Open Font License）の全文を、ゲームと一緒に配る', () => {
    const files = Object.keys(LICENSES).map((path) => path.split('/').pop());
    expect(files.sort()).toEqual(['OFL-DotGothic16.txt', 'OFL-ZenKakuGothicNew.txt']);
    for (const text of Object.values(LICENSES)) {
      expect(text).toContain('SIL OPEN FONT LICENSE');
    }
  });
});
