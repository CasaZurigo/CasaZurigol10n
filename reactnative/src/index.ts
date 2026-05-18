import { getLocales } from "expo-localization";

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

const SUPPORTED_LANGUAGES = [
  "de",
  "en",
  "es",
  "fr",
  "he",
  "it",
  "ko",
  "pl",
  "pt-pt",
  "ru",
  "tr",
  "uk",
  "zh-hans",
  "zh-hant",
] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LOCALE: SupportedLanguage = "en";

const bundles: Record<SupportedLanguage, Record<string, string>> = {
  de,
  en,
  es,
  fr,
  he,
  it,
  ko,
  pl,
  "pt-pt": ptPT,
  ru,
  tr: tr_,
  uk,
  "zh-hans": zhHans,
  "zh-hant": zhHant,
};

const catalog: Record<string, Record<string, string>> = {};

function resolveLanguage(locale: string): SupportedLanguage {
  const lower = locale.toLowerCase();
  const [base] = lower.split(/[-_]/);

  if (base === "zh") {
    // Default to Traditional when no script in the tag, matching iOS.
    return lower.includes("hans") ? "zh-hans" : "zh-hant";
  }
  if (base === "pt") {
    return "pt-pt";
  }
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : DEFAULT_LOCALE;
}

function currentLanguage(): SupportedLanguage {
  return resolveLanguage(getLocales()[0]?.languageTag ?? DEFAULT_LOCALE);
}

function registerTranslations(
  locale: string,
  localeEntries: Record<string, string>,
) {
  const lang = resolveLanguage(locale);
  Object.entries(localeEntries).forEach(([englishText, localizedText]) => {
    if (!catalog[englishText]) {
      catalog[englishText] = {};
    }
    catalog[englishText][lang] = localizedText;
  });
}

Object.entries(bundles).forEach(([locale, entries]) =>
  registerTranslations(locale, entries),
);

function translate(key: string): string {
  const lang = currentLanguage();
  if (lang === DEFAULT_LOCALE) {
    return key;
  }
  return catalog[key]?.[lang] ?? key;
}

// Placeholders: %@ filled sequentially, %1$@/%2$@ by 1-indexed position.
export function tr(key: string, ...args: string[]): string {
  const text = translate(key);
  if (args.length === 0) return text;

  let result = text.replace(/%(\d+)\$@/g, (match, n) => {
    const i = parseInt(n, 10) - 1;
    return i >= 0 && i < args.length ? args[i] : match;
  });

  let idx = 0;
  result = result.replace(/%@/g, (match) =>
    idx < args.length ? args[idx++] : match,
  );

  return result;
}
