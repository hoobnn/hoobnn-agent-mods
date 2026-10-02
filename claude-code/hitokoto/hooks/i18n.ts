// hitokoto's messages; the language is resolved by the kit (kit/lang.ts).
import { createMessages } from './kit/lang'
import type { Lang } from './kit/lang'

export { parseLanguage, resolveLanguage } from './kit/lang'

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

export const { m, setLang } = createMessages(MESSAGES)
