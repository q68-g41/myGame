import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_COLORS, ATTRIBUTE_NAMES } from '../../src/data/attributes';
import { ATTRIBUTE_ORDER, NEUTRAL_ATTRIBUTES } from '../../src/engine/constants';

// 画面の背景とパネルの色（src/ui/style.css の --color-bg と --color-panel）。
// テストでは CSS の中身を読み込めないので、ここに写しておく
const BACKGROUNDS = { '--color-bg': '#14141f', '--color-panel': '#1e1e2d' };

const ALL_ATTRIBUTES = [...ATTRIBUTE_ORDER, ...NEUTRAL_ATTRIBUTES];

/** 相対輝度（WCAG の式） */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('属性の表示名と色（白・黒を含む8属性）', () => {
  it('白と黒の表示名', () => {
    expect(ATTRIBUTE_NAMES.white).toBe('白');
    expect(ATTRIBUTE_NAMES.black).toBe('黒');
  });

  it.each(ALL_ATTRIBUTES)('%s の色は #rrggbb（光の色に透明度を足して使うため）', (attribute) => {
    expect(ATTRIBUTE_COLORS[attribute]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('8属性の色は重ならない', () => {
    expect(new Set(ALL_ATTRIBUTES.map((attribute) => ATTRIBUTE_COLORS[attribute])).size).toBe(8);
  });

  it.each(ALL_ATTRIBUTES)('%s の色は、暗い背景とパネルの上で見分けられる（コントラスト比3以上）', (attribute) => {
    for (const background of Object.values(BACKGROUNDS)) {
      expect(contrast(ATTRIBUTE_COLORS[attribute], background)).toBeGreaterThanOrEqual(3);
    }
  });
});
