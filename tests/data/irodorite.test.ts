import { describe, expect, it } from 'vitest';
import { CHARMS, describeCharmEffect } from '../../src/data/charms';
import { RUN_CONTENT } from '../../src/data/content';
import { PARTNER_FIGHTERS } from '../../src/data/fighters';
import { getIrodorite, IRODORITE } from '../../src/data/irodorite';
import type { CharmEffect } from '../../src/engine/types';
import { irodoriteUrl } from '../../src/ui/sprites';

/** 効果の強さ（割合）。割合のない効果は null */
function strength(effect: CharmEffect): number | null {
  return 'percent' in effect ? effect.percent : null;
}

/** 種類と対象（属性・技の種類など）が同じ効果か（強さは見ない） */
function sameKind(a: CharmEffect, b: CharmEffect): boolean {
  const { percent: _a, ...restA } = { percent: 0, ...a };
  const { percent: _b, ...restB } = { percent: 0, ...b };
  return JSON.stringify(restA) === JSON.stringify(restB);
}

describe('彩り手のデータ（仕様書 4.6）', () => {
  it('いまは6人（ヒナ・モリエ・ワタ・ユヒ・リン・ソウ）。仕様書の表の順で、あだ名と口ぐせも表のとおり', () => {
    expect(IRODORITE.map(({ id, name, catchphrase }) => ({ id, name, catchphrase }))).toEqual([
      { id: 'hina', name: 'ヒナ', catchphrase: '宣伝！！！' },
      { id: 'morie', name: 'モリエ', catchphrase: 'やってみる！' },
      { id: 'wata', name: 'ワタ', catchphrase: '道具は、使う人の器を映す鏡' },
      { id: 'yuhi', name: 'ユヒ', catchphrase: 'ユヒは信じないです' },
      { id: 'rin', name: 'リン', catchphrase: 'やりてぇ' },
      { id: 'sou', name: 'ソウ', catchphrase: 'すみません、僕の方でやりますね！' },
    ]);
  });

  it('ライバルのクロは選べない（一覧に入らない）', () => {
    expect(IRODORITE.map((data) => data.id)).not.toContain('kuro');
    expect(() => getIrodorite('kuro')).toThrow('kuro');
  });

  it.each(IRODORITE)('$name の相棒は、その彩り手だけのキャラ（相棒の一覧にいて、ランのキャラにはいない）', (data) => {
    expect(data.partner.id).toBe(`${data.id}-partner`);
    expect(PARTNER_FIGHTERS).toContain(data.partner);
    expect(RUN_CONTENT.fighters).not.toContain(data.partner);
    expect(IRODORITE.filter((other) => other.partner.id === data.partner.id)).toHaveLength(1);
  });

  it.each(IRODORITE)('$name の特性は、同じ種類のふつうのお守りより少し強い（1.5倍まで）', (data) => {
    const traitStrength = strength(data.trait.effect);
    const charm = CHARMS.find((candidate) => sameKind(candidate.effect, data.trait.effect));
    expect(charm, data.trait.name).toBeDefined();
    const charmStrength = strength(charm!.effect);
    expect(traitStrength).not.toBeNull();
    expect(traitStrength!).toBeGreaterThan(charmStrength!);
    expect(traitStrength!).toBeLessThanOrEqual(charmStrength! * 1.5);
  });

  it.each(IRODORITE)('$name の特性には名前と、効果から作った説明がある。お守りと ID が重ならない', (data) => {
    expect(data.trait.name).toBeTruthy();
    expect(data.trait.description).toBe(describeCharmEffect(data.trait.effect));
    expect(CHARMS.map((charm) => charm.id)).not.toContain(data.trait.id);
  });

  it.each(IRODORITE)('$name には絵（64×64）がある', (data) => {
    expect(irodoriteUrl(data.id)).toBeTypeOf('string');
  });

  it('ID から取り出せる。ない ID はエラー', () => {
    expect(getIrodorite('wata').name).toBe('ワタ');
    expect(() => getIrodorite('unknown')).toThrow('unknown');
  });
});
