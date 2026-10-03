// Generated from claude-code/kit/lang.ts by scripts/sync-kit.sh: edit the source, then re-run it.
// A mod's language: the `language` option, or with `auto` Claude Code's own
// `language` setting (free text: "简体中文", "Japanese", "pt-BR"), then the locale
// (LC_ALL, LC_MESSAGES, LANG), then English. The messages stay the mod's own:
// `createMessages(MESSAGES)` gives it `m` over them.

export type Lang = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'pt-BR' | 'ru'

export const LANGS: readonly Lang[] = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'ru']

/** The `language` option's values, as a manifest's `options` lists them. */
export const LANGUAGE_OPTIONS = ['auto', ...LANGS] as const

// Names a person may write, folded (lowercase, no spaces, `-`, `_` or `.`).
const NAMES: Record<string, Lang> = {
  en: 'en', english: 'en', 英语: 'en', 英文: 'en', 英語: 'en',
  zh: 'zh-Hans', zhcn: 'zh-Hans', zhsg: 'zh-Hans', zhhans: 'zh-Hans', chinese: 'zh-Hans',
  simplifiedchinese: 'zh-Hans', 中文: 'zh-Hans', 简体中文: 'zh-Hans', 简体: 'zh-Hans', 汉语: 'zh-Hans', 普通话: 'zh-Hans',
  zhtw: 'zh-Hant', zhhk: 'zh-Hant', zhmo: 'zh-Hant', zhhant: 'zh-Hant', traditionalchinese: 'zh-Hant',
  繁體中文: 'zh-Hant', 繁体中文: 'zh-Hant', 正體中文: 'zh-Hant', 繁體: 'zh-Hant', 繁体: 'zh-Hant',
  ja: 'ja', japanese: 'ja', 日本語: 'ja', 日语: 'ja',
  ko: 'ko', korean: 'ko', 한국어: 'ko', 韩语: 'ko', 韓語: 'ko',
  es: 'es', spanish: 'es', español: 'es', espanol: 'es', castellano: 'es', 西班牙语: 'es',
  fr: 'fr', french: 'fr', français: 'fr', francais: 'fr', 法语: 'fr',
  de: 'de', german: 'de', deutsch: 'de', 德语: 'de',
  pt: 'pt-BR', ptbr: 'pt-BR', portuguese: 'pt-BR', brazilianportuguese: 'pt-BR', português: 'pt-BR', portugues: 'pt-BR', 葡萄牙语: 'pt-BR',
  ru: 'ru', russian: 'ru', русский: 'ru', 俄语: 'ru',
}

const fold = (s: string) => s.trim().toLowerCase().replace(/[\s_.-]/g, '')

/** "简体中文", "zh_TW.UTF-8", "es-MX", "Deutsch" → a language the mods have, else null. */
export function parseLanguage(text: unknown): Lang | null {
  if (typeof text !== 'string' || !text.trim()) return null
  const bare = text.split('.')[0]!.split('@')[0]!
  const named = NAMES[fold(bare)]
  if (named) return named
  // A tag with a region or script this table does not list: its first subtag.
  const [primary = '', ...rest] = bare.trim().toLowerCase().split(/[-_\s]/)
  if (primary === 'zh') return rest.some(s => ['tw', 'hk', 'mo', 'hant'].includes(s)) ? 'zh-Hant' : 'zh-Hans'
  return NAMES[primary] ?? null
}

/** The language to draw in: the option unless `auto`, then the setting, then the locale. */
export function resolveLanguage(option: unknown, setting: unknown, locale: readonly (string | undefined)[]): Lang {
  if (typeof option === 'string' && option !== 'auto' && (LANGS as readonly string[]).includes(option)) return option as Lang
  return parseLanguage(setting) ?? locale.map(parseLanguage).find(Boolean) ?? 'en'
}


export type Params = Record<string, string | number>

/**
 * `m(key, params?, lang?)` over a mod's table: the message in the current
 * language (English when missing), its `{placeholders}` filled.
 */
export function createMessages<K extends string>(table: Record<Lang, Record<K, string>>) {
  let current: Lang = 'en'
  return {
    m: (key: K, params: Params = {}, lang: Lang = current): string =>
      (table[lang][key] ?? table.en[key]).replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? '')),
    setLang: (lang: Lang): void => {
      current = lang
    },
    lang: (): Lang => current,
  }
}
