// The Android app config reads this file at build time, so it imports nothing.
export const SUPPORTED_LOCALES = [
  "de",
  "en",
  "es",
  "fr",
  "he",
  "it",
  "ko",
  "pl",
  "pt-PT",
  "ru",
  "tr",
  "uk",
  "zh-Hans",
  "zh-Hant",
] as const;

export type SupportedLanguage = Lowercase<(typeof SUPPORTED_LOCALES)[number]>;

// Each language's own name, as iOS writes it; Hermes has no Intl.DisplayNames.
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  de: "Deutsch",
  en: "English",
  es: "español",
  fr: "français",
  he: "עברית",
  it: "italiano",
  ko: "한국어",
  pl: "polski",
  "pt-pt": "português",
  ru: "русский",
  tr: "Türkçe",
  uk: "українська",
  "zh-hans": "中文",
  "zh-hant": "中文",
};
