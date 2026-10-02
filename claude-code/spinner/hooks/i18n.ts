// The mod's language: the `language` option, or with `auto` Claude Code's own
// `language` setting (free text: "简体中文", "Japanese", "pt-BR"), then the locale
// (LC_ALL, LC_MESSAGES, LANG), then English. Kept alike in ts-band, hitokoto and spinner:
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

export type Key =
  | 'cmd.description'
  | 'cmd.status'
  | 'cmd.randomNote'
  | 'cmd.themes'
  | 'cmd.usage'
  | 'cmd.switched'
  | 'cmd.random'
  | 'cmd.hidden'
  | 'cmd.shown'
  | 'cmd.stageOff'
  | 'cmd.stageOn'
  | 'cmd.preview'
  | 'cmd.unknown'
  | 'finale.done'
  | 'finale.aborted'
  | 'finale.error'

export const MESSAGES: Record<Lang, Record<Key, string>> = {
  en: {
    'cmd.description': 'Spinner animations: pick a theme, off / on, stage off / on, preview (kept across sessions)',
    'cmd.status': 'Theme: {theme}',
    'cmd.randomNote': ' (random each session)',
    'cmd.themes': 'Themes: {list}',
    'cmd.usage': 'Usage: /spinner <theme|random> · off / on · stage off / on · preview [theme]',
    'cmd.switched': 'Switched to {theme}',
    'cmd.random': 'A random theme each session; this one: {theme}',
    'cmd.hidden': 'Spinner animations off',
    'cmd.shown': 'Spinner animations on',
    'cmd.stageOff': 'Animation band above the prompt off',
    'cmd.stageOn': 'Animation band above the prompt on',
    'cmd.preview': 'Previewing {theme} above the prompt',
    'cmd.unknown': 'No theme called {name}. Themes: {list}',
    'finale.done': 'Done · {time}',
    'finale.aborted': 'Interrupted',
    'finale.error': 'Something went wrong',
  },
  'zh-Hans': {
    'cmd.description': '运行动画：切换主题、off / on 开关、stage off / on 开关动画带、preview 预览（跨会话保持）',
    'cmd.status': '当前主题：{theme}',
    'cmd.randomNote': '（每个会话随机）',
    'cmd.themes': '可选主题：{list}',
    'cmd.usage': '用法：/spinner <主题|random> · off / on · stage off / on · preview [主题]',
    'cmd.switched': '已切换到 {theme}',
    'cmd.random': '每个会话随机一个主题，这次是 {theme}',
    'cmd.hidden': '运行动画已关闭',
    'cmd.shown': '运行动画已开启',
    'cmd.stageOff': '输入框上方的动画带已关闭',
    'cmd.stageOn': '输入框上方的动画带已开启',
    'cmd.preview': '正在输入框上方预览 {theme}',
    'cmd.unknown': '没有叫 {name} 的主题。可选：{list}',
    'finale.done': '完成 · {time}',
    'finale.aborted': '已中断',
    'finale.error': '出错了',
  },
  'zh-Hant': {
    'cmd.description': '執行動畫：切換主題、off / on 開關、stage off / on 開關動畫帶、preview 預覽（跨工作階段保留）',
    'cmd.status': '目前主題：{theme}',
    'cmd.randomNote': '（每個工作階段隨機）',
    'cmd.themes': '可選主題：{list}',
    'cmd.usage': '用法：/spinner <主題|random> · off / on · stage off / on · preview [主題]',
    'cmd.switched': '已切換到 {theme}',
    'cmd.random': '每個工作階段隨機一個主題，這次是 {theme}',
    'cmd.hidden': '執行動畫已關閉',
    'cmd.shown': '執行動畫已開啟',
    'cmd.stageOff': '輸入框上方的動畫帶已關閉',
    'cmd.stageOn': '輸入框上方的動畫帶已開啟',
    'cmd.preview': '正在輸入框上方預覽 {theme}',
    'cmd.unknown': '沒有名為 {name} 的主題。可選：{list}',
    'finale.done': '完成 · {time}',
    'finale.aborted': '已中斷',
    'finale.error': '出錯了',
  },
  ja: {
    'cmd.description': '実行中アニメーション：テーマ切り替え、off / on、stage off / on、preview（セッションをまたいで保持）',
    'cmd.status': 'テーマ：{theme}',
    'cmd.randomNote': '（セッションごとにランダム）',
    'cmd.themes': 'テーマ一覧：{list}',
    'cmd.usage': '使い方：/spinner <テーマ|random> · off / on · stage off / on · preview [テーマ]',
    'cmd.switched': '{theme} に切り替えました',
    'cmd.random': 'セッションごとにランダムなテーマ。今回は {theme}',
    'cmd.hidden': '実行中アニメーションをオフにしました',
    'cmd.shown': '実行中アニメーションをオンにしました',
    'cmd.stageOff': '入力欄上のアニメーションバーをオフにしました',
    'cmd.stageOn': '入力欄上のアニメーションバーをオンにしました',
    'cmd.preview': '入力欄の上で {theme} をプレビュー中',
    'cmd.unknown': '{name} というテーマはありません。テーマ一覧：{list}',
    'finale.done': '完了 · {time}',
    'finale.aborted': '中断しました',
    'finale.error': 'エラーが発生しました',
  },
  ko: {
    'cmd.description': '실행 애니메이션: 테마 전환, off / on, stage off / on, preview(세션 간 유지)',
    'cmd.status': '현재 테마: {theme}',
    'cmd.randomNote': ' (세션마다 무작위)',
    'cmd.themes': '테마 목록: {list}',
    'cmd.usage': '사용법: /spinner <테마|random> · off / on · stage off / on · preview [테마]',
    'cmd.switched': '{theme}(으)로 전환했습니다',
    'cmd.random': '세션마다 무작위 테마, 이번에는 {theme}',
    'cmd.hidden': '실행 애니메이션을 껐습니다',
    'cmd.shown': '실행 애니메이션을 켰습니다',
    'cmd.stageOff': '입력창 위 애니메이션 띠를 껐습니다',
    'cmd.stageOn': '입력창 위 애니메이션 띠를 켰습니다',
    'cmd.preview': '입력창 위에서 {theme} 미리 보는 중',
    'cmd.unknown': '{name} 테마가 없습니다. 테마 목록: {list}',
    'finale.done': '완료 · {time}',
    'finale.aborted': '중단됨',
    'finale.error': '오류가 발생했습니다',
  },
  es: {
    'cmd.description': 'Animaciones del spinner: elige un tema, off / on, stage off / on, preview (se mantiene entre sesiones)',
    'cmd.status': 'Tema: {theme}',
    'cmd.randomNote': ' (al azar en cada sesión)',
    'cmd.themes': 'Temas: {list}',
    'cmd.usage': 'Uso: /spinner <tema|random> · off / on · stage off / on · preview [tema]',
    'cmd.switched': 'Cambiado a {theme}',
    'cmd.random': 'Un tema al azar en cada sesión; esta vez: {theme}',
    'cmd.hidden': 'Animaciones del spinner desactivadas',
    'cmd.shown': 'Animaciones del spinner activadas',
    'cmd.stageOff': 'Barra animada sobre el prompt desactivada',
    'cmd.stageOn': 'Barra animada sobre el prompt activada',
    'cmd.preview': 'Vista previa de {theme} sobre el prompt',
    'cmd.unknown': 'No hay ningún tema llamado {name}. Temas: {list}',
    'finale.done': 'Listo · {time}',
    'finale.aborted': 'Interrumpido',
    'finale.error': 'Algo salió mal',
  },
  fr: {
    'cmd.description': 'Animations du spinner : choix du thème, off / on, stage off / on, preview (réglage conservé entre les sessions)',
    'cmd.status': 'Thème : {theme}',
    'cmd.randomNote': ' (au hasard à chaque session)',
    'cmd.themes': 'Thèmes : {list}',
    'cmd.usage': 'Usage : /spinner <thème|random> · off / on · stage off / on · preview [thème]',
    'cmd.switched': 'Thème {theme} activé',
    'cmd.random': 'Un thème au hasard à chaque session ; cette fois : {theme}',
    'cmd.hidden': 'Animations du spinner désactivées',
    'cmd.shown': 'Animations du spinner activées',
    'cmd.stageOff': 'Bande animée au-dessus du prompt désactivée',
    'cmd.stageOn': 'Bande animée au-dessus du prompt activée',
    'cmd.preview': 'Aperçu de {theme} au-dessus du prompt',
    'cmd.unknown': 'Aucun thème nommé {name}. Thèmes : {list}',
    'finale.done': 'Terminé · {time}',
    'finale.aborted': 'Interrompu',
    'finale.error': 'Une erreur est survenue',
  },
  de: {
    'cmd.description': 'Spinner-Animationen: Thema wählen, off / on, stage off / on, preview (bleibt über Sitzungen erhalten)',
    'cmd.status': 'Thema: {theme}',
    'cmd.randomNote': ' (jede Sitzung zufällig)',
    'cmd.themes': 'Themen: {list}',
    'cmd.usage': 'Verwendung: /spinner <Thema|random> · off / on · stage off / on · preview [Thema]',
    'cmd.switched': 'Zu {theme} gewechselt',
    'cmd.random': 'Jede Sitzung ein zufälliges Thema; diesmal: {theme}',
    'cmd.hidden': 'Spinner-Animationen aus',
    'cmd.shown': 'Spinner-Animationen an',
    'cmd.stageOff': 'Animationsleiste über der Eingabe aus',
    'cmd.stageOn': 'Animationsleiste über der Eingabe an',
    'cmd.preview': 'Vorschau von {theme} über der Eingabe',
    'cmd.unknown': 'Kein Thema namens {name}. Themen: {list}',
    'finale.done': 'Fertig · {time}',
    'finale.aborted': 'Abgebrochen',
    'finale.error': 'Etwas ist schiefgelaufen',
  },
  'pt-BR': {
    'cmd.description': 'Animações do spinner: escolha um tema, off / on, stage off / on, preview (configuração mantida entre sessões)',
    'cmd.status': 'Tema: {theme}',
    'cmd.randomNote': ' (aleatório a cada sessão)',
    'cmd.themes': 'Temas: {list}',
    'cmd.usage': 'Uso: /spinner <tema|random> · off / on · stage off / on · preview [tema]',
    'cmd.switched': 'Trocado para {theme}',
    'cmd.random': 'Um tema aleatório a cada sessão; desta vez: {theme}',
    'cmd.hidden': 'Animações do spinner desativadas',
    'cmd.shown': 'Animações do spinner ativadas',
    'cmd.stageOff': 'Faixa animada acima do prompt desativada',
    'cmd.stageOn': 'Faixa animada acima do prompt ativada',
    'cmd.preview': 'Prévia de {theme} acima do prompt',
    'cmd.unknown': 'Nenhum tema chamado {name}. Temas: {list}',
    'finale.done': 'Pronto · {time}',
    'finale.aborted': 'Interrompido',
    'finale.error': 'Algo deu errado',
  },
  ru: {
    'cmd.description': 'Анимации спиннера: выбор темы, off / on, stage off / on, preview (сохраняется между сессиями)',
    'cmd.status': 'Тема: {theme}',
    'cmd.randomNote': ' (случайная в каждой сессии)',
    'cmd.themes': 'Темы: {list}',
    'cmd.usage': 'Использование: /spinner <тема|random> · off / on · stage off / on · preview [тема]',
    'cmd.switched': 'Тема переключена на {theme}',
    'cmd.random': 'Случайная тема в каждой сессии; сейчас: {theme}',
    'cmd.hidden': 'Анимации спиннера выключены',
    'cmd.shown': 'Анимации спиннера включены',
    'cmd.stageOff': 'Анимированная полоса над вводом выключена',
    'cmd.stageOn': 'Анимированная полоса над вводом включена',
    'cmd.preview': 'Предпросмотр {theme} над вводом',
    'cmd.unknown': 'Темы {name} нет. Темы: {list}',
    'finale.done': 'Готово · {time}',
    'finale.aborted': 'Прервано',
    'finale.error': 'Что-то пошло не так',
  },
}
