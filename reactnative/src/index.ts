import { getCalendars, getLocales } from "expo-localization";

import de from "../../translations/reactnative/de.json";
import en from "../../translations/reactnative/en.json";
import es from "../../translations/reactnative/es.json";
import fr from "../../translations/reactnative/fr.json";
import he from "../../translations/reactnative/he.json";
import it from "../../translations/reactnative/it.json";
import ko from "../../translations/reactnative/ko.json";
import pl from "../../translations/reactnative/pl.json";
import ptPT from "../../translations/reactnative/pt-PT.json";
import ru from "../../translations/reactnative/ru.json";
import tr_ from "../../translations/reactnative/tr.json";
import uk from "../../translations/reactnative/uk.json";
import zhHans from "../../translations/reactnative/zh-HANS.json";
import zhHant from "../../translations/reactnative/zh-HANT.json";

export const SUPPORTED_LANGUAGES = [
  "de",
  "en",
  "es",
  "fr",
  "he",
  "it",
  "ko",
  "pl",
  "pt",
  "ru",
  "tr",
  "uk",
  "zh",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LOCALE: SupportedLanguage = "en";

type TranslationCatalog = Record<
  string,
  Partial<Record<SupportedLanguage, string>>
>;

const catalog: TranslationCatalog = {};
let localeOverride: SupportedLanguage | null = null;

const translationBundles: Record<SupportedLanguage, Record<string, string>> = {
  de,
  en,
  es,
  fr,
  he,
  it,
  ko,
  pl,
  pt: ptPT,
  ru,
  tr: tr_,
  uk,
  zh: zhHans,
};

const extraTranslationBundles: Record<string, Record<string, string>> = {
  "zh-hans": zhHans,
  "zh-hant": zhHant,
};

function applyTranslationBundles(
  bundles: Record<string, Record<string, string>>,
) {
  Object.entries(bundles).forEach(([locale, entries]) => {
    registerTranslations(locale, entries);
  });
}

applyTranslationBundles(translationBundles);
applyTranslationBundles(extraTranslationBundles);

export function normalizeLocale(
  locale: string | null | undefined,
): SupportedLanguage {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  const lowerLocale = locale.toLowerCase();

  if (lowerLocale.startsWith("zh")) {
    return "zh";
  }

  if (lowerLocale.startsWith("pt")) {
    return "pt";
  }

  const [language] = lowerLocale.split(/[-_]/);

  if (language && isSupportedLanguage(language)) {
    return language;
  }

  return DEFAULT_LOCALE;
}

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function setLocaleOverride(locale: string | null) {
  localeOverride = locale ? normalizeLocale(locale) : null;
}

export function getLocaleOverride(): string | null {
  return localeOverride;
}

export function getCurrentLocale(): SupportedLanguage {
  if (localeOverride) {
    return normalizeLocale(localeOverride);
  }

  const detected = detectSystemLocale();
  return normalizeLocale(detected);
}

function detectSystemLocale(): string {
  const locales = getLocales?.() ?? [];

  if (locales.length > 0) {
    const primary = locales[0];
    const candidate =
      primary.languageTag ??
      (primary.languageCode
        ? [
            primary.languageCode,
            primary.regionCode ?? primary.languageRegionCode,
          ]
            .filter(Boolean)
            .join("-")
        : null);

    if (candidate) {
      return candidate;
    }
  }

  const calendars = getCalendars?.() ?? [];
  const calendarLocale = (
    calendars[0] as { localeIdentifier?: string } | undefined
  )?.localeIdentifier;

  return calendarLocale ?? DEFAULT_LOCALE;
}

export function registerTranslations(
  locale: string,
  localeEntries: Record<string, string>,
) {
  const normalizedLocale = normalizeLocale(locale);

  Object.entries(localeEntries).forEach(([englishText, localizedText]) => {
    if (!catalog[englishText]) {
      catalog[englishText] = {};
    }
    catalog[englishText][normalizedLocale] = localizedText;
  });
}

export function translate(key: string, locale?: string): string {
  const normalizedLocale = locale
    ? normalizeLocale(locale)
    : getCurrentLocale();

  if (normalizedLocale === DEFAULT_LOCALE) {
    return key;
  }

  const localizedValue = catalog[key]?.[normalizedLocale];
  return localizedValue ?? key;
}

/**
 * Main translation function - similar to iOS tr() function.
 * Translates a key to the current locale.
 * Falls back to the key itself if no translation is found.
 *
 * Supports placeholders:
 *   %@        — replaced sequentially by args
 *   %1$@,%2$@ — replaced by the arg at that position (1-indexed)
 * Unmatched placeholders are left as-is.
 *
 * @param key  - The English text to translate (used as lookup key)
 * @param args - Values to substitute into placeholders
 * @returns The translated text with placeholders replaced
 */
export function tr(key: string, ...args: string[]): string {
  const text = translate(key);
  if (args.length === 0) return text;

  // First: replace numbered placeholders %1$@, %2$@, …
  let result = text.replace(/%(\d+)\$@/g, (match, n) => {
    const i = parseInt(n, 10) - 1;
    return i >= 0 && i < args.length ? args[i] : match;
  });

  // Then: replace sequential %@ left-to-right
  let idx = 0;
  result = result.replace(/%@/g, (match) =>
    idx < args.length ? args[idx++] : match,
  );

  return result;
}

export type TranslationValue =
  | string
  | Record<string, string>
  | null
  | undefined;

/**
 * Pick the appropriate translation from a multi-language value object.
 * Useful when working with data that contains translations in multiple languages.
 *
 * @param value - A string, translation object, or null/undefined
 * @returns The translated string for the current locale
 */
export function pickTranslation(value: TranslationValue): string {
  const defaultValue = "";

  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === "string") {
    return value;
  }

  const locale = normalizeLocale(getCurrentLocale());
  const localized = value[locale] ?? value.en ?? Object.values(value)[0];

  return localized ?? defaultValue;
}

// For testing purposes
export function __clearTranslationsForTests() {
  Object.keys(catalog).forEach((englishText) => {
    delete catalog[englishText];
  });
  localeOverride = null;
  applyTranslationBundles(translationBundles);
}
