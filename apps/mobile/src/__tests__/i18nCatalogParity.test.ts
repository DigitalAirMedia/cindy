/**
 * i18next catalog 平价门:全部 locale 的组装后 catalog(locales/<locale>/index.ts)
 * key 结构必须完全一致,叶子非空,{{占位符}} 集合逐 key 一致。
 * 与根 scripts/check-i18n.mjs(desktop 专用)对应的 mobile 侧强制门,
 * 随 pnpm test:unit 阻断。直接从组装模块取数,新增区域文件自动纳入校验。
 */

import { describe, expect, it } from "vitest";
import { createInstance } from "i18next";

import enCommon from "@/i18n/locales/en";
import frCommon from "@/i18n/locales/fr";
import zhCNCommon from "@/i18n/locales/zh-CN";
import jaCommon from "@/i18n/locales/ja";
import koCommon from "@/i18n/locales/ko";
import zhTWCommon from "@/i18n/locales/zh-TW";

const CATALOGS: Record<string, unknown> = {
  en: enCommon,
  "zh-CN": zhCNCommon,
  ja: jaCommon,
  ko: koCommon,
  "zh-TW": zhTWCommon,
  fr: frCommon,
};

/** 展平嵌套 catalog 为 dot-path → 叶子字符串。遇到非 string 叶子直接失败。 */
function flatten(
  node: unknown,
  prefix: string,
  out: Map<string, string>,
): void {
  expect(node, `${prefix || "<root>"} 必须是对象或字符串`).toBeTruthy();
  if (typeof node === "string") {
    out.set(prefix, node);
    return;
  }
  expect(typeof node, `${prefix || "<root>"} 类型异常`).toBe("object");
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    flatten(value, prefix ? `${prefix}.${key}` : key, out);
  }
}

function flatCatalog(locale: string): Map<string, string> {
  const out = new Map<string, string>();
  flatten(CATALOGS[locale], "", out);
  return out;
}

function placeholdersOf(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/**
 * 各语言的复数类别由 Intl.PluralRules 决定,可能多于 en(如 fr 的 `_many`)。
 * en 有 `<base>_other` 时,locale 多出的、属于该语言复数类别的 `<base>_<cat>` 与 en 属同一
 * key 族(与 desktop scripts/check-i18n.mjs 的复数族判定一致),返回用于比对的 en key。
 */
function enKeyFor(
  locale: string,
  key: string,
  en: Map<string, string>,
): string | undefined {
  if (en.has(key)) return key;
  const match = key.match(PLURAL_SUFFIX);
  if (!match) return undefined;
  const other = `${key.slice(0, -(match[1].length + 1))}_other`;
  if (!en.has(other)) return undefined;
  const categories: readonly string[] = new Intl.PluralRules(locale)
    .resolvedOptions().pluralCategories;
  return categories.includes(match[1]) ? other : undefined;
}

describe("mobile i18n catalog parity", () => {
  const locales = Object.keys(CATALOGS);
  const flat = new Map(locales.map((locale) => [locale, flatCatalog(locale)]));
  const enKeys = [...flat.get("en")!.keys()].sort();

  it.each(locales)(
    "%s resolves browser action labels at their UI paths",
    async (locale) => {
      const instance = createInstance();
      await instance.init({
        lng: locale,
        fallbackLng: false,
        resources: { [locale]: { translation: CATALOGS[locale] as object } },
      });
      for (const action of [
        "browserBack",
        "browserForward",
        "browserMore",
        "browserShowSource",
        "browserShowPage",
        "browserAddToTask",
        "browserFileInfo",
      ]) {
        const key = `files.preview.${action}`;
        expect(instance.exists(key), `${locale}:${key}`).toBe(true);
        expect(instance.t(key)).not.toBe(key);
      }
    },
  );

  it.each(locales)("%s 与 en 的 key 全集一致", (locale) => {
    const en = flat.get("en")!;
    // 本语言额外的复数类别(见 enKeyFor)不算多余 key。
    const keys = [...flat.get(locale)!.keys()].filter(
      (key) => en.has(key) || enKeyFor(locale, key, en) === undefined,
    );
    expect(keys.sort()).toEqual(enKeys);
  });

  it.each(locales)("%s 所有叶子非空且不是待翻译占位", (locale) => {
    for (const [key, value] of flat.get(locale)!) {
      expect(value.trim(), `${locale}:${key} 不能为空`).not.toBe("");
      expect(value, `${locale}:${key} 不能残留 TODO 占位`).not.toMatch(
        /TODO|待翻译|待校对/,
      );
    }
  });

  it.each(locales)("%s 的 {{占位符}} 集合与 en 逐 key 一致", (locale) => {
    const en = flat.get("en")!;
    for (const [key, value] of flat.get(locale)!) {
      expect(placeholdersOf(value), `${locale}:${key} 占位符不一致`).toEqual(
        placeholdersOf(en.get(enKeyFor(locale, key, en) ?? key)!),
      );
    }
  });
});
