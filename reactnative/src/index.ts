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

export type SupportedLanguage =
  | "de"
  | "en"
  | "es"
  | "fr"
  | "he"
  | "it"
  | "ko"
  | "pl"
  | "pt"
  | "ru"
  | "tr"
  | "uk"
  | "zh";

const DEFAULT_LOCALE: SupportedLanguage = "en";

type TranslationCatalog = Record<string, Partial<Record<string, string>>>;

const catalog: TranslationCatalog = {};
let localeOverride: string | null = null;

const translationBundles: Record<string, Record<string, string>> = {
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

export function normalizeLocale(
  locale: string | null | undefined,
): SupportedLanguage {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  const lowerLocale = locale.toLowerCase();

  // Handle special cases for Chinese variants
  if (lowerLocale.startsWith("zh")) {
    if (lowerLocale.includes("hant") || lowerLocale.includes("tw")) {
      return "zh";
    }
    return "zh";
  }

  // Handle Portuguese
  if (lowerLocale.startsWith("pt")) {
    return "pt";
  }

  const [language] = lowerLocale.split(/[-_]/);

  if (language && language in translationBundles) {
    return language as SupportedLanguage;
  }

  return DEFAULT_LOCALE;
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
 * @param key - The English text to translate
 * @returns The translated text or the key if no translation exists
 */
export function tr(key: string): string {
  return translate(key);
}

/**
 * Alias for tr() - shorthand translation function.
 * @param key - The English text to translate
 * @returns The translated text or the key if no translation exists
 */
export const _ = tr;

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

/**
 * Get the list of supported languages.
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return [
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
  ];
}

/**
 * Check if a locale is supported.
 */
export function isLocaleSupported(locale: string): boolean {
  const normalized = normalizeLocale(locale);
  return normalized in translationBundles;
}

// For testing purposes
export function __clearTranslationsForTests() {
  Object.keys(catalog).forEach((englishText) => {
    delete catalog[englishText];
  });
  localeOverride = null;
  applyTranslationBundles(translationBundles);
}
