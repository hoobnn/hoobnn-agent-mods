import type { Language, MessageKey, Messages } from "./types.js";
import { en } from "./en.js";
import { zhHans } from "./zh-Hans.js";
import { zhHant } from "./zh-Hant.js";
import { ja } from "./ja.js";
import { ko } from "./ko.js";
import { es } from "./es.js";
import { fr } from "./fr.js";
import { de } from "./de.js";
import { ptBR } from "./pt-BR.js";
import { ru } from "./ru.js";

export type { Language, MessageKey, Messages };

export type CanonicalLanguage = "en" | "zh-Hans" | "zh-Hant" | "ja" | "ko" | "es" | "fr" | "de" | "pt-BR" | "ru";

const locales: Record<CanonicalLanguage, Messages> = {
  en,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  ja,
  ko,
  es,
  fr,
  de,
  "pt-BR": ptBR,
  ru,
};

// Resolve short language tags to canonical BCP 47 forms.
// Based on CLDR likely subtags: zh → zh-Hans-CN
// https://www.unicode.org/cldr/charts/latest/supplemental/likely_subtags.html
const CANONICAL: Record<Language, CanonicalLanguage> = {
  "en": "en",
  "zh": "zh-Hans",
  "zh-Hans": "zh-Hans",
  "zh-Hant": "zh-Hant",
  "zh-TW": "zh-Hant",
  "ja": "ja",
  "ko": "ko",
  "es": "es",
  "fr": "fr",
  "de": "de",
  "pt": "pt-BR",
  "pt-BR": "pt-BR",
  "ru": "ru",
};

let currentLanguage: Language = "en";

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

// https://www.rfc-editor.org/info/bcp47
export function getCanonicalLanguage(): CanonicalLanguage {
  return CANONICAL[currentLanguage] ?? "en";
}

// https://www.unicode.org/reports/tr11/
export function isCjkLanguage(): boolean {
  const canon = getCanonicalLanguage();
  return canon === "zh-Hans" || canon === "zh-Hant" || canon === "ja" || canon === "ko";
}

export function t(key: MessageKey): string {
  const canon = getCanonicalLanguage();
  return locales[canon]?.[key] ?? locales.en[key] ?? key;
}

// Minimal named-placeholder interpolation. Layout that varies by language
// (spacing, affix position) lives in each locale's pattern string rather than in
// render code. Unknown placeholders render as empty string (kept lenient).
export function interpolate(pattern: string, params: Record<string, string | number>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}
