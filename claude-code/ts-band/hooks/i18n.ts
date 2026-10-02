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

export type Key = 'cmd.description' | 'cmd.hidden' | 'cmd.shown' | 'link.direct' | 'link.relay' | 'link.offline' | 'toast.up' | 'toast.down' | 'error.read'

export const MESSAGES: Record<Lang, Record<Key, string>> = {
  en: {
    'cmd.description': 'Show or hide the Tailscale nodes band; off / on sets it (kept across sessions)',
    'cmd.hidden': 'Tailscale band hidden',
    'cmd.shown': 'Tailscale band shown',
    'link.direct': 'direct',
    'link.relay': 'relay',
    'link.offline': 'offline',
    'toast.up': 'Tailscale: {name} is online',
    'toast.down': 'Tailscale: {name} went offline',
    'error.read': 'Tailscale status unavailable: ',
  },
  'zh-Hans': {
    'cmd.description': '显示 / 隐藏 Tailscale 节点状态横条；off / on 直接指定（跨会话保持）',
    'cmd.hidden': 'Tailscale 横条已隐藏',
    'cmd.shown': 'Tailscale 横条已显示',
    'link.direct': '直连',
    'link.relay': '中继',
    'link.offline': '离线',
    'toast.up': 'Tailscale：{name} 已上线',
    'toast.down': 'Tailscale：{name} 已离线',
    'error.read': 'TS 读取失败：',
  },
  'zh-Hant': {
    'cmd.description': '顯示／隱藏 Tailscale 節點狀態橫條；off / on 直接指定（跨工作階段保留）',
    'cmd.hidden': 'Tailscale 橫條已隱藏',
    'cmd.shown': 'Tailscale 橫條已顯示',
    'link.direct': '直連',
    'link.relay': '中繼',
    'link.offline': '離線',
    'toast.up': 'Tailscale：{name} 已上線',
    'toast.down': 'Tailscale：{name} 已離線',
    'error.read': 'TS 讀取失敗：',
  },
  ja: {
    'cmd.description': 'Tailscale ノード状態バーの表示を切り替えます。off / on で指定（セッションをまたいで保持）',
    'cmd.hidden': 'Tailscale バーを非表示にしました',
    'cmd.shown': 'Tailscale バーを表示しました',
    'link.direct': '直接',
    'link.relay': 'リレー',
    'link.offline': 'オフライン',
    'toast.up': 'Tailscale: {name} がオンラインになりました',
    'toast.down': 'Tailscale: {name} がオフラインになりました',
    'error.read': 'Tailscale の状態を取得できません: ',
  },
  ko: {
    'cmd.description': 'Tailscale 노드 상태 표시줄 보이기/숨기기. off / on으로 지정(세션 간 유지)',
    'cmd.hidden': 'Tailscale 표시줄을 숨겼습니다',
    'cmd.shown': 'Tailscale 표시줄을 표시했습니다',
    'link.direct': '직접',
    'link.relay': '릴레이',
    'link.offline': '오프라인',
    'toast.up': 'Tailscale: {name} 온라인',
    'toast.down': 'Tailscale: {name} 오프라인',
    'error.read': 'Tailscale 상태를 읽을 수 없습니다: ',
  },
  es: {
    'cmd.description': 'Muestra u oculta la barra de nodos de Tailscale; off / on lo fija (se mantiene entre sesiones)',
    'cmd.hidden': 'Barra de Tailscale oculta',
    'cmd.shown': 'Barra de Tailscale visible',
    'link.direct': 'directo',
    'link.relay': 'vía relay',
    'link.offline': 'desconectado',
    'toast.up': 'Tailscale: {name} está en línea',
    'toast.down': 'Tailscale: {name} se desconectó',
    'error.read': 'No se pudo leer el estado de Tailscale: ',
  },
  fr: {
    'cmd.description': 'Affiche ou masque la barre des nœuds Tailscale\u00a0; off / on la fixe (réglage conservé entre les sessions)',
    'cmd.hidden': 'Barre Tailscale masquée',
    'cmd.shown': 'Barre Tailscale affichée',
    'link.direct': 'direct',
    'link.relay': 'via relais',
    'link.offline': 'hors ligne',
    'toast.up': 'Tailscale\u00a0: {name} est en ligne',
    'toast.down': 'Tailscale\u00a0: {name} est hors ligne',
    'error.read': 'Impossible de lire l’état de Tailscale\u00a0: ',
  },
  de: {
    'cmd.description': 'Tailscale-Knotenleiste ein- oder ausblenden; off / on legt sie fest (bleibt über Sitzungen erhalten)',
    'cmd.hidden': 'Tailscale-Leiste ausgeblendet',
    'cmd.shown': 'Tailscale-Leiste eingeblendet',
    'link.direct': 'direkt',
    'link.relay': 'Relay',
    'link.offline': 'offline',
    'toast.up': 'Tailscale: {name} ist online',
    'toast.down': 'Tailscale: {name} ist offline',
    'error.read': 'Tailscale-Status nicht lesbar: ',
  },
  'pt-BR': {
    'cmd.description': 'Mostra ou oculta a barra de nós do Tailscale; off / on define (configuração mantida entre sessões)',
    'cmd.hidden': 'Barra do Tailscale oculta',
    'cmd.shown': 'Barra do Tailscale visível',
    'link.direct': 'direto',
    'link.relay': 'via relay',
    'link.offline': 'offline',
    'toast.up': 'Tailscale: {name} está online',
    'toast.down': 'Tailscale: {name} ficou offline',
    'error.read': 'Não foi possível ler o status do Tailscale: ',
  },
  ru: {
    'cmd.description': 'Показать или скрыть панель узлов Tailscale; off / on задают явно (сохраняется между сессиями)',
    'cmd.hidden': 'Панель Tailscale скрыта',
    'cmd.shown': 'Панель Tailscale показана',
    'link.direct': 'напрямую',
    'link.relay': 'через релей',
    'link.offline': 'не в сети',
    'toast.up': 'Tailscale: {name} в сети',
    'toast.down': 'Tailscale: {name} не в сети',
    'error.read': 'Не удалось прочитать статус Tailscale: ',
  },
}
