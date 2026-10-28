import { describe, expect, it } from 'vitest';

import { resolvePreferredSystemLocale, resolveSystemLocale } from '../locale';

describe('desktop locale resolution', () => {
  it('routes simplified and traditional Chinese tags separately', () => {
    for (const tag of ['zh', 'zh-CN', 'zh-Hans', 'zh-Hans-HK', 'zh-SG']) {
      expect(resolveSystemLocale(tag), tag).toBe('zh-CN');
    }
    for (const tag of ['zh-Hant', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant-CN', 'ZH_HANT_TW']) {
      expect(resolveSystemLocale(tag), tag).toBe('zh-TW');
    }
  });

  it('uses the first supported locale in the OS preference list', () => {
    expect(resolvePreferredSystemLocale(['de-DE', 'zh-Hant-TW', 'en-US'])).toBe('zh-TW');
    expect(resolvePreferredSystemLocale(['de-DE', 'ja-JP'])).toBe('ja');
    expect(resolvePreferredSystemLocale(['de-DE'])).toBe('en');
    expect(resolvePreferredSystemLocale(['fr-FR', 'en-US'])).toBe('fr');
    expect(resolveSystemLocale('fr-BE')).toBe('fr');
  });
});
