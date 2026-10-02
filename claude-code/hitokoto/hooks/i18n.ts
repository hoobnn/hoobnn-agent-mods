// The mod's language: the `language` option, or with `auto` Claude Code's own
// `language` setting (free text: "简体中文", "Japanese", "pt-BR"), then the locale
// (LC_ALL, LC_MESSAGES, LANG), then English. Kept alike in ts-band and hitokoto:
// an installed mod reaches no file outside its own folder.

export type Lang = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'pt-BR' | 'ru'

export const LANGS: readonly Lang[] = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'ru']

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

/** "简体中文", "zh_TW.UTF-8", "es-MX", "Deutsch" → a language this mod has, else null. */
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

let current: Lang = 'en'

export function setLang(lang: Lang): void {
  current = lang
}

export function lang(): Lang {
  return current
}

/** The message `key` in the mod's language, its `{placeholders}` filled. */
export function m(key: Key, params: Record<string, string | number> = {}, lang: Lang = current): string {
  return (MESSAGES[lang][key] ?? MESSAGES.en[key]).replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))
}

export type Key = 'cmd.description' | 'cmd.hidden' | 'cmd.shown' | 'error.fetch' | 'error.parse'

export const MESSAGES: Record<Lang, Record<Key, string>> = {
  en: {
    'cmd.description': 'A new Hitokoto line; off / on hides or shows the band (kept across sessions)',
    'cmd.hidden': 'Hitokoto band hidden',
    'cmd.shown': 'Hitokoto band shown',
    'error.fetch': 'Couldn’t fetch a Hitokoto line: {error}',
    'error.parse': 'unreadable response',
  },
  'zh-Hans': {
    'cmd.description': '换一句一言；off / on 隐藏或显示横条（跨会话保持）',
    'cmd.hidden': '一言横条已隐藏',
    'cmd.shown': '一言横条已显示',
    'error.fetch': '一言获取失败：{error}',
    'error.parse': '返回内容无法解析',
  },
  'zh-Hant': {
    'cmd.description': '換一句一言；off / on 隱藏或顯示橫條（跨工作階段保留）',
    'cmd.hidden': '一言橫條已隱藏',
    'cmd.shown': '一言橫條已顯示',
    'error.fetch': '一言取得失敗：{error}',
    'error.parse': '回應內容無法解析',
  },
  ja: {
    'cmd.description': '新しい Hitokoto（一言）を表示します。off / on でバーを非表示／表示（セッションをまたいで保持）',
    'cmd.hidden': 'Hitokoto バーを非表示にしました',
    'cmd.shown': 'Hitokoto バーを表示しました',
    'error.fetch': 'Hitokoto を取得できませんでした: {error}',
    'error.parse': '応答を解析できません',
  },
  ko: {
    'cmd.description': 'Hitokoto(一言) 새로 고침. off / on으로 표시줄 숨기기/표시(세션 간 유지)',
    'cmd.hidden': 'Hitokoto 표시줄을 숨겼습니다',
    'cmd.shown': 'Hitokoto 표시줄을 표시했습니다',
    'error.fetch': 'Hitokoto를 가져오지 못했습니다: {error}',
    'error.parse': '응답을 해석할 수 없습니다',
  },
  es: {
    'cmd.description': 'Otra frase de Hitokoto; off / on oculta o muestra la barra (se mantiene entre sesiones)',
    'cmd.hidden': 'Barra de Hitokoto oculta',
    'cmd.shown': 'Barra de Hitokoto visible',
    'error.fetch': 'No se pudo obtener una frase de Hitokoto: {error}',
    'error.parse': 'respuesta ilegible',
  },
  fr: {
    'cmd.description': 'Nouvelle citation Hitokoto\u00a0; off / on masque ou affiche la barre (réglage conservé entre les sessions)',
    'cmd.hidden': 'Barre Hitokoto masquée',
    'cmd.shown': 'Barre Hitokoto affichée',
    'error.fetch': 'Impossible de récupérer une citation Hitokoto\u00a0: {error}',
    'error.parse': 'réponse illisible',
  },
  de: {
    'cmd.description': 'Neuer Hitokoto-Spruch; off / on blendet die Leiste aus oder ein (bleibt über Sitzungen erhalten)',
    'cmd.hidden': 'Hitokoto-Leiste ausgeblendet',
    'cmd.shown': 'Hitokoto-Leiste eingeblendet',
    'error.fetch': 'Hitokoto-Spruch konnte nicht geladen werden: {error}',
    'error.parse': 'Antwort nicht lesbar',
  },
  'pt-BR': {
    'cmd.description': 'Nova frase do Hitokoto; off / on oculta ou mostra a barra (configuração mantida entre sessões)',
    'cmd.hidden': 'Barra do Hitokoto oculta',
    'cmd.shown': 'Barra do Hitokoto visível',
    'error.fetch': 'Não foi possível obter uma frase do Hitokoto: {error}',
    'error.parse': 'resposta ilegível',
  },
  ru: {
    'cmd.description': 'Новая цитата Hitokoto; off / on скрывает или показывает панель (сохраняется между сессиями)',
    'cmd.hidden': 'Панель Hitokoto скрыта',
    'cmd.shown': 'Панель Hitokoto показана',
    'error.fetch': 'Не удалось получить цитату Hitokoto: {error}',
    'error.parse': 'не удалось разобрать ответ',
  },
}
