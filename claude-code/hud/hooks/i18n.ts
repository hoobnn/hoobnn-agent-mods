// The mod's own strings (what it adds to claude-hud's lines), in the language
// claude-hud is set to (`language` in its config), so one setting covers the HUD.
import { type CanonicalLanguage, getCanonicalLanguage, interpolate } from './hud/i18n/index.js'

/** A string, or its plural forms by `Intl.PluralRules` category (`other` required). */
type Text = string | { one?: string; few?: string; many?: string; other: string }

type Key =
  | 'rc.label'
  | 'rc.attached'
  | 'rc.connected'
  | 'surface.mobile'
  | 'surface.desktop'
  | 'forecast'
  | 'limit.fiveHour'
  | 'limit.sevenDay'
  | 'limit.scoped'
  | 'week'
  | 'streak'
  | 'git.dirty'
  | 'git.ahead'
  | 'compact.left'
  | 'cache.cold'
  | 'alert.context'
  | 'alert.fiveHour'
  | 'alert.sevenDay'
  | 'alert.scoped'
  | 'turn.done'
  | 'cmd.description'
  | 'theme.set'
  | 'theme.list'
  | 'theme.unknown'
  | 'theme.ask'
  | 'cmd.hidden'
  | 'cmd.shown'
  | 'pane.title'
  | 'pane.opened'
  | 'pane.closed'
  | 'pane.tools'
  | 'pane.noTools'
  | 'pane.toolStats'
  | 'pane.failed'
  | 'pane.agents'
  | 'pane.none'
  | 'pane.todos'
  | 'pane.spend'
  | 'pane.turns'
  | 'pane.turnRow'
  | 'spend.today'
  | 'spend.week'
  | 'summary.language'

// French (and German, Spanish, Russian) set a percent sign off with a space; French
// also a colon. A no-break space keeps the sign on its number.
const NB = ' '

export const MESSAGES: Record<CanonicalLanguage, Record<Key, Text>> = {
  en: {
    'rc.label': '⇄ Remote Control',
    'rc.attached': 'connected: {who}',
    'rc.connected': 'connected',
    'surface.mobile': 'phone',
    'surface.desktop': 'web/desktop',
    forecast: '{label} runs out ≈{time} at this pace',
    'limit.fiveHour': '5-hour limit',
    'limit.sevenDay': '7-day limit',
    'limit.scoped': '{name} weekly limit',
    week: '7d',
    streak: '{n}-day streak',
    'git.dirty': { one: '{n} uncommitted change', other: '{n} uncommitted changes' },
    'git.ahead': { one: '{n} unpushed commit', other: '{n} unpushed commits' },
    'compact.left': '{tokens} to auto-compact',
    'cache.cold': 'cache cold: next message re-caches {tokens}',
    'alert.context': 'Context is {p}% full — consider /compact',
    'alert.fiveHour': '5-hour limit at {p}%',
    'alert.sevenDay': '7-day limit at {p}%',
    'alert.scoped': '{name} weekly limit at {p}%',
    'turn.done': '✓ Done in {d}',
    'cmd.description': 'Show or hide the claude-hud band; detail opens the details pane; theme switches its look',
    'theme.set': 'HUD theme: {name}',
    'theme.list': 'HUD themes (now {name}): {list}. /hud theme <name>, next or reset; * needs a Nerd Font',
    'theme.unknown': 'No theme named {name}. Themes: {list}',
    'theme.ask': 'Which HUD theme? (now {name}; Other: type any of {list})',
    'cmd.hidden': 'claude-hud band hidden',
    'cmd.shown': 'claude-hud band shown',
    'pane.title': 'HUD details',
    'pane.opened': 'HUD details pane opened (/hud detail closes it)',
    'pane.closed': 'HUD details pane closed',
    'pane.tools': 'Time by tool',
    'pane.noTools': 'No tool calls in this session yet',
    'pane.toolStats': '×{count} · {total} total · {avg} avg',
    'pane.failed': '{n} failed',
    'pane.agents': 'Subagents',
    'pane.none': 'None',
    'pane.todos': 'Todos',
    'pane.spend': 'Spend',
    'pane.turns': 'Recent turns',
    'pane.turnRow': '#{n} · {time} · {cost} · context {tokens}',
    'spend.today': 'Today {spent}',
    'spend.week': '7 days {spent}',
    'summary.language': 'English',
  },
  'zh-Hans': {
    'rc.label': '⇄ 远程控制',
    'rc.attached': '已连接 {who}',
    'rc.connected': '已连接',
    'surface.mobile': '手机',
    'surface.desktop': '网页/桌面',
    forecast: '{label}按当前速度 ≈{time} 用完',
    'limit.fiveHour': '5 小时额度',
    'limit.sevenDay': '7 天额度',
    'limit.scoped': '{name} 周额度',
    week: '7 天',
    streak: '连续 {n} 天',
    'git.dirty': '{n} 个改动未提交',
    'git.ahead': '{n} 个提交未推送',
    'compact.left': '距自动压缩 {tokens}',
    'cache.cold': '缓存已过期，下条消息重写 {tokens}',
    'alert.context': '上下文已用 {p}%，可以考虑 /compact',
    'alert.fiveHour': '5 小时额度已用 {p}%',
    'alert.sevenDay': '7 天额度已用 {p}%',
    'alert.scoped': '{name} 周额度已用 {p}%',
    'turn.done': '✓ 本轮完成，用时 {d}',
    'cmd.description': '显示 / 隐藏 claude-hud 横条；detail 打开详情面板；theme 切换主题',
    'theme.set': 'HUD 主题：{name}',
    'theme.list': 'HUD 主题（当前 {name}）：{list}。/hud theme <名称>、next 或 reset；带 * 的需要 Nerd Font',
    'theme.unknown': '没有名为 {name} 的主题。可选：{list}',
    'theme.ask': '换哪套 HUD 主题？（当前 {name}；也可在 Other 里输入：{list}）',
    'cmd.hidden': 'claude-hud 横条已隐藏',
    'cmd.shown': 'claude-hud 横条已显示',
    'pane.title': 'HUD 详情',
    'pane.opened': 'HUD 详情面板已打开（/hud detail 关闭）',
    'pane.closed': 'HUD 详情面板已关闭',
    'pane.tools': '工具耗时',
    'pane.noTools': '本会话还没有工具调用',
    'pane.toolStats': '×{count} 共 {total} 均 {avg}',
    'pane.failed': '失败 {n}',
    'pane.agents': '子代理',
    'pane.none': '无',
    'pane.todos': '待办',
    'pane.spend': '花费',
    'pane.turns': '最近几轮',
    'pane.turnRow': '#{n} · {time} · {cost} · 上下文 {tokens}',
    'spend.today': '今日 {spent}',
    'spend.week': '7 天 {spent}',
    'summary.language': 'Simplified Chinese',
  },
  'zh-Hant': {
    'rc.label': '⇄ 遠端控制',
    'rc.attached': '已連線 {who}',
    'rc.connected': '已連線',
    'surface.mobile': '手機',
    'surface.desktop': '網頁/桌面',
    forecast: '{label}依目前速度 ≈{time} 用完',
    'limit.fiveHour': '5 小時額度',
    'limit.sevenDay': '7 天額度',
    'limit.scoped': '{name} 週額度',
    week: '7 天',
    streak: '連續 {n} 天',
    'git.dirty': '{n} 個變更尚未提交',
    'git.ahead': '{n} 個提交尚未推送',
    'compact.left': '距自動壓縮 {tokens}',
    'cache.cold': '快取已過期，下則訊息重寫 {tokens}',
    'alert.context': '上下文已使用 {p}%，可以考慮執行 /compact',
    'alert.fiveHour': '5 小時額度已使用 {p}%',
    'alert.sevenDay': '7 天額度已使用 {p}%',
    'alert.scoped': '{name} 週額度已使用 {p}%',
    'turn.done': '✓ 本輪完成，耗時 {d}',
    'cmd.description': '顯示／隱藏 claude-hud 橫條；detail 開啟詳細資訊面板；theme 切換主題',
    'theme.set': 'HUD 主題：{name}',
    'theme.list': 'HUD 主題（目前 {name}）：{list}。/hud theme <名稱>、next 或 reset；帶 * 的需要 Nerd Font',
    'theme.unknown': '沒有名為 {name} 的主題。可選：{list}',
    'theme.ask': '換哪套 HUD 主題？（目前 {name}；也可在 Other 輸入：{list}）',
    'cmd.hidden': 'claude-hud 橫條已隱藏',
    'cmd.shown': 'claude-hud 橫條已顯示',
    'pane.title': 'HUD 詳細資訊',
    'pane.opened': 'HUD 詳細資訊面板已開啟（/hud detail 可關閉）',
    'pane.closed': 'HUD 詳細資訊面板已關閉',
    'pane.tools': '工具耗時',
    'pane.noTools': '本工作階段尚無工具呼叫',
    'pane.toolStats': '×{count} 共 {total} 平均 {avg}',
    'pane.failed': '失敗 {n}',
    'pane.agents': '子代理程式',
    'pane.none': '無',
    'pane.todos': '待辦事項',
    'pane.spend': '花費',
    'pane.turns': '最近幾輪',
    'pane.turnRow': '#{n} · {time} · {cost} · 上下文 {tokens}',
    'spend.today': '今日 {spent}',
    'spend.week': '7 天 {spent}',
    'summary.language': 'Traditional Chinese as used in Taiwan',
  },
  ja: {
    'rc.label': '⇄ リモートコントロール',
    'rc.attached': '接続中: {who}',
    'rc.connected': '接続中',
    'surface.mobile': 'スマホ',
    'surface.desktop': 'Web/デスクトップ',
    forecast: '{label}は今のペースだと ≈{time} に使い切ります',
    'limit.fiveHour': '5時間枠',
    'limit.sevenDay': '7日間枠',
    'limit.scoped': '{name} 週間枠',
    week: '7日間',
    streak: '{n}日連続',
    'git.dirty': '未コミットの変更 {n} 件',
    'git.ahead': '未プッシュのコミット {n} 件',
    'compact.left': '自動圧縮まで {tokens}',
    'cache.cold': 'キャッシュ切れ：次の送信で {tokens} を再キャッシュ',
    'alert.context': 'コンテキストの使用率が {p}% に達しました。/compact の実行を検討してください',
    'alert.fiveHour': '5時間枠の使用率が {p}% に達しました',
    'alert.sevenDay': '7日間枠の使用率が {p}% に達しました',
    'alert.scoped': '{name} 週間枠の使用率が {p}% に達しました',
    'turn.done': '✓ 応答完了（{d}）',
    'cmd.description': 'claude-hud の表示を切り替えます。detail で詳細パネル、theme でテーマを切り替えます',
    'theme.set': 'HUD テーマ：{name}',
    'theme.list': 'HUD テーマ（現在 {name}）：{list}。/hud theme <名前>、next、reset。* は Nerd Font が必要',
    'theme.unknown': '{name} というテーマはありません。テーマ：{list}',
    'theme.ask': 'どの HUD テーマにしますか？（現在 {name}。Other に入力も可：{list}）',
    'cmd.hidden': 'claude-hud を非表示にしました',
    'cmd.shown': 'claude-hud を表示しました',
    'pane.title': 'HUD 詳細',
    'pane.opened': 'HUD 詳細パネルを開きました（/hud detail で閉じます）',
    'pane.closed': 'HUD 詳細パネルを閉じました',
    'pane.tools': 'ツール別の所要時間',
    'pane.noTools': 'このセッションではまだツールが呼び出されていません',
    'pane.toolStats': '×{count} 合計 {total} 平均 {avg}',
    'pane.failed': '失敗 {n}',
    'pane.agents': 'サブエージェント',
    'pane.none': 'なし',
    'pane.todos': 'ToDo',
    'pane.spend': 'コスト',
    'pane.turns': '最近のターン',
    'pane.turnRow': '#{n} · {time} · {cost} · コンテキスト {tokens}',
    'spend.today': '今日 {spent}',
    'spend.week': '7日間 {spent}',
    'summary.language': 'Japanese',
  },
  ko: {
    'rc.label': '⇄ 원격 제어',
    'rc.attached': '연결됨: {who}',
    'rc.connected': '연결됨',
    'surface.mobile': '휴대폰',
    'surface.desktop': '웹/데스크톱',
    forecast: '{label}: 현재 속도면 ≈{time}에 소진',
    'limit.fiveHour': '5시간 한도',
    'limit.sevenDay': '7일 한도',
    'limit.scoped': '{name} 주간 한도',
    week: '7일',
    streak: '{n}일 연속',
    'git.dirty': '커밋하지 않은 변경 {n}개',
    'git.ahead': '푸시하지 않은 커밋 {n}개',
    'compact.left': '자동 압축까지 {tokens}',
    'cache.cold': '캐시 만료: 다음 메시지가 {tokens} 재캐시',
    'alert.context': '컨텍스트 사용량이 {p}%에 도달했습니다. /compact 실행을 고려해 보세요',
    'alert.fiveHour': '5시간 한도의 {p}%를 사용했습니다',
    'alert.sevenDay': '7일 한도의 {p}%를 사용했습니다',
    'alert.scoped': '{name} 주간 한도의 {p}%를 사용했습니다',
    'turn.done': '✓ 응답 완료 ({d})',
    'cmd.description': 'claude-hud 표시/숨기기. detail을 붙이면 상세 패널을 열고, theme으로 테마를 바꿉니다',
    'theme.set': 'HUD 테마: {name}',
    'theme.list': 'HUD 테마 (현재 {name}): {list}. /hud theme <이름>, next, reset. *는 Nerd Font 필요',
    'theme.unknown': '{name} 테마가 없습니다. 테마: {list}',
    'theme.ask': '어떤 HUD 테마로 바꿀까요? (현재 {name}, Other에 입력 가능: {list})',
    'cmd.hidden': 'claude-hud를 숨겼습니다',
    'cmd.shown': 'claude-hud를 표시했습니다',
    'pane.title': 'HUD 상세',
    'pane.opened': 'HUD 상세 패널을 열었습니다(/hud detail로 닫기)',
    'pane.closed': 'HUD 상세 패널을 닫았습니다',
    'pane.tools': '도구별 소요 시간',
    'pane.noTools': '이 세션에서는 아직 도구 호출이 없습니다',
    'pane.toolStats': '×{count} · 합계 {total} · 평균 {avg}',
    'pane.failed': '실패 {n}',
    'pane.agents': '하위 에이전트',
    'pane.none': '없음',
    'pane.todos': '할 일',
    'pane.spend': '비용',
    'pane.turns': '최근 턴',
    'pane.turnRow': '#{n} · {time} · {cost} · 컨텍스트 {tokens}',
    'spend.today': '오늘 {spent}',
    'spend.week': '7일 {spent}',
    'summary.language': 'Korean',
  },
  es: {
    'rc.label': '⇄ Control remoto',
    'rc.attached': 'conectado: {who}',
    'rc.connected': 'conectado',
    'surface.mobile': 'teléfono',
    'surface.desktop': 'web/escritorio',
    forecast: '{label}: a este ritmo se agota hacia las {time}',
    'limit.fiveHour': 'Límite de 5 h',
    'limit.sevenDay': 'Límite de 7 días',
    'limit.scoped': 'Límite semanal de {name}',
    week: '7 días',
    streak: { one: '{n} día seguido', other: '{n} días seguidos' },
    'git.dirty': { one: '{n} cambio sin confirmar', other: '{n} cambios sin confirmar' },
    'git.ahead': { one: '{n} commit sin enviar', other: '{n} commits sin enviar' },
    'compact.left': '{tokens} hasta la compactación',
    'cache.cold': 'caché fría: el próximo mensaje recachea {tokens}',
    'alert.context': `Contexto al {p}${NB}%: conviene ejecutar /compact`,
    'alert.fiveHour': `Límite de 5 horas al {p}${NB}%`,
    'alert.sevenDay': `Límite de 7 días al {p}${NB}%`,
    'alert.scoped': `Límite semanal de {name} al {p}${NB}%`,
    'turn.done': '✓ Respuesta lista en {d}',
    'cmd.description': 'Muestra u oculta la barra de claude-hud; detail abre el panel de detalles; theme cambia el tema',
    'theme.set': 'Tema del HUD: {name}',
    'theme.list': 'Temas del HUD (ahora {name}): {list}. /hud theme <nombre>, next o reset; * requiere una Nerd Font',
    'theme.unknown': 'No hay ningún tema llamado {name}. Temas: {list}',
    'theme.ask': '¿Qué tema de HUD? (ahora {name}; en Other puedes escribir: {list})',
    'cmd.hidden': 'Barra de claude-hud oculta',
    'cmd.shown': 'Barra de claude-hud visible',
    'pane.title': 'Detalles del HUD',
    'pane.opened': 'Panel de detalles del HUD abierto (/hud detail lo cierra)',
    'pane.closed': 'Panel de detalles del HUD cerrado',
    'pane.tools': 'Tiempo por herramienta',
    'pane.noTools': 'Todavía no hay llamadas a herramientas en esta sesión',
    'pane.toolStats': '×{count} · total {total} · promedio {avg}',
    'pane.failed': { one: '{n} error', other: '{n} errores' },
    'pane.agents': 'Subagentes',
    'pane.none': 'Ninguno',
    'pane.todos': 'Tareas',
    'pane.spend': 'Gasto',
    'pane.turns': 'Últimos turnos',
    'pane.turnRow': '#{n} · {time} · {cost} · contexto {tokens}',
    'spend.today': 'Hoy: {spent}',
    'spend.week': '7 días: {spent}',
    'summary.language': 'Spanish',
  },
  fr: {
    'rc.label': '⇄ Contrôle à distance',
    'rc.attached': `connecté${NB}: {who}`,
    'rc.connected': 'connecté',
    'surface.mobile': 'téléphone',
    'surface.desktop': 'web/bureau',
    forecast: `{label}${NB}: épuisée vers {time} à ce rythme`,
    'limit.fiveHour': 'Limite de 5 h',
    'limit.sevenDay': 'Limite de 7 jours',
    'limit.scoped': 'Limite hebdomadaire {name}',
    week: '7 jours',
    streak: { one: '{n} jour d’affilée', other: '{n} jours d’affilée' },
    'git.dirty': { one: '{n} modification non commitée', other: '{n} modifications non commitées' },
    'git.ahead': { one: '{n} commit non poussé', other: '{n} commits non poussés' },
    'compact.left': '{tokens} avant la compaction',
    'cache.cold': 'cache froid : le prochain message recache {tokens}',
    'alert.context': `Contexte rempli à {p}${NB}%${NB}: pensez à /compact`,
    'alert.fiveHour': `Limite de 5 heures utilisée à {p}${NB}%`,
    'alert.sevenDay': `Limite de 7 jours utilisée à {p}${NB}%`,
    'alert.scoped': `Limite hebdomadaire {name} utilisée à {p}${NB}%`,
    'turn.done': '✓ Réponse prête en {d}',
    'cmd.description': `Affiche ou masque la barre claude-hud${NB}; detail ouvre le panneau de détails${NB}; theme change le thème`,
    'theme.set': `Thème du HUD${NB}: {name}`,
    'theme.list': `Thèmes du HUD (actuel${NB}: {name})${NB}: {list}. /hud theme <nom>, next ou reset${NB}; * demande une Nerd Font`,
    'theme.unknown': `Aucun thème nommé {name}. Thèmes${NB}: {list}`,
    'theme.ask': `Quel thème pour le HUD${NB}? (actuel${NB}: {name}${NB}; dans Other, tapez${NB}: {list})`,
    'cmd.hidden': 'Barre claude-hud masquée',
    'cmd.shown': 'Barre claude-hud affichée',
    'pane.title': 'Détails du HUD',
    'pane.opened': 'Panneau de détails du HUD ouvert (/hud detail pour le fermer)',
    'pane.closed': 'Panneau de détails du HUD fermé',
    'pane.tools': 'Temps par outil',
    'pane.noTools': 'Aucun appel d’outil dans cette session pour l’instant',
    'pane.toolStats': '×{count} · total {total} · moyenne {avg}',
    'pane.failed': { one: '{n} échec', other: '{n} échecs' },
    'pane.agents': 'Sous-agents',
    'pane.none': 'Aucun',
    'pane.todos': 'Tâches',
    'pane.spend': 'Dépenses',
    'pane.turns': 'Derniers tours',
    'pane.turnRow': '#{n} · {time} · {cost} · contexte {tokens}',
    'spend.today': `Aujourd’hui${NB}: {spent}`,
    'spend.week': `7 jours${NB}: {spent}`,
    'summary.language': 'French',
  },
  de: {
    'rc.label': '⇄ Fernsteuerung',
    'rc.attached': 'verbunden: {who}',
    'rc.connected': 'verbunden',
    'surface.mobile': 'Smartphone',
    'surface.desktop': 'Web/Desktop',
    forecast: '{label}: bei diesem Tempo ≈{time} aufgebraucht',
    'limit.fiveHour': '5-Stunden-Limit',
    'limit.sevenDay': '7-Tage-Limit',
    'limit.scoped': '{name}-Wochenlimit',
    week: '7 Tage',
    streak: { one: '{n} Tag in Folge', other: '{n} Tage in Folge' },
    'git.dirty': { one: '{n} nicht committete Änderung', other: '{n} nicht committete Änderungen' },
    'git.ahead': { one: '{n} nicht gepushter Commit', other: '{n} nicht gepushte Commits' },
    'compact.left': '{tokens} bis zur Komprimierung',
    'cache.cold': 'Cache kalt: nächste Nachricht cacht {tokens} neu',
    'alert.context': `Kontext zu {p}${NB}% belegt – /compact empfohlen`,
    'alert.fiveHour': `5-Stunden-Limit zu {p}${NB}% ausgeschöpft`,
    'alert.sevenDay': `7-Tage-Limit zu {p}${NB}% ausgeschöpft`,
    'alert.scoped': `{name}-Wochenlimit zu {p}${NB}% ausgeschöpft`,
    'turn.done': '✓ Antwort fertig nach {d}',
    'cmd.description': 'claude-hud-Leiste ein- oder ausblenden; detail öffnet den Detailbereich; theme wechselt das Design',
    'theme.set': 'HUD-Design: {name}',
    'theme.list': 'HUD-Designs (aktiv: {name}): {list}. /hud theme <Name>, next oder reset; * braucht eine Nerd Font',
    'theme.unknown': 'Kein Design namens {name}. Designs: {list}',
    'theme.ask': 'Welches HUD-Design? (aktuell {name}; unter Other eintippen: {list})',
    'cmd.hidden': 'claude-hud-Leiste ausgeblendet',
    'cmd.shown': 'claude-hud-Leiste eingeblendet',
    'pane.title': 'HUD-Details',
    'pane.opened': 'HUD-Detailbereich geöffnet (/hud detail schließt ihn)',
    'pane.closed': 'HUD-Detailbereich geschlossen',
    'pane.tools': 'Zeit pro Tool',
    'pane.noTools': 'Noch keine Tool-Aufrufe in dieser Sitzung',
    'pane.toolStats': '×{count} · gesamt {total} · Ø {avg}',
    'pane.failed': '{n} fehlgeschlagen',
    'pane.agents': 'Subagenten',
    'pane.none': 'Keine',
    'pane.todos': 'Aufgaben',
    'pane.spend': 'Ausgaben',
    'pane.turns': 'Letzte Runden',
    'pane.turnRow': '#{n} · {time} · {cost} · Kontext {tokens}',
    'spend.today': 'Heute: {spent}',
    'spend.week': '7 Tage: {spent}',
    'summary.language': 'German',
  },
  'pt-BR': {
    'rc.label': '⇄ Controle remoto',
    'rc.attached': 'conectado: {who}',
    'rc.connected': 'conectado',
    'surface.mobile': 'celular',
    'surface.desktop': 'web/desktop',
    forecast: '{label}: no ritmo atual, esgota por volta das {time}',
    'limit.fiveHour': 'Limite de 5 h',
    'limit.sevenDay': 'Limite de 7 dias',
    'limit.scoped': 'Limite semanal do {name}',
    week: '7 dias',
    streak: { one: '{n} dia seguido', other: '{n} dias seguidos' },
    'git.dirty': { one: '{n} alteração sem commit', other: '{n} alterações sem commit' },
    'git.ahead': { one: '{n} commit sem push', other: '{n} commits sem push' },
    'compact.left': '{tokens} até a compactação',
    'cache.cold': 'cache frio: a próxima mensagem recacheia {tokens}',
    'alert.context': 'Contexto em {p}%: considere usar /compact',
    'alert.fiveHour': 'Limite de 5 horas em {p}%',
    'alert.sevenDay': 'Limite de 7 dias em {p}%',
    'alert.scoped': 'Limite semanal do {name} em {p}%',
    'turn.done': '✓ Resposta pronta em {d}',
    'cmd.description': 'Mostra ou oculta a barra do claude-hud; detail abre o painel de detalhes; theme troca o tema',
    'theme.set': 'Tema do HUD: {name}',
    'theme.list': 'Temas do HUD (atual: {name}): {list}. /hud theme <nome>, next ou reset; * precisa de uma Nerd Font',
    'theme.unknown': 'Nenhum tema chamado {name}. Temas: {list}',
    'theme.ask': 'Qual tema do HUD? (agora {name}; em Other digite: {list})',
    'cmd.hidden': 'Barra do claude-hud oculta',
    'cmd.shown': 'Barra do claude-hud visível',
    'pane.title': 'Detalhes do HUD',
    'pane.opened': 'Painel de detalhes do HUD aberto (/hud detail fecha)',
    'pane.closed': 'Painel de detalhes do HUD fechado',
    'pane.tools': 'Tempo por ferramenta',
    'pane.noTools': 'Nenhuma chamada de ferramenta nesta sessão ainda',
    'pane.toolStats': '×{count} · total {total} · média {avg}',
    'pane.failed': { one: '{n} falha', other: '{n} falhas' },
    'pane.agents': 'Subagentes',
    'pane.none': 'Nenhum',
    'pane.todos': 'Tarefas',
    'pane.spend': 'Gastos',
    'pane.turns': 'Últimos turnos',
    'pane.turnRow': '#{n} · {time} · {cost} · contexto {tokens}',
    'spend.today': 'Hoje: {spent}',
    'spend.week': '7 dias: {spent}',
    'summary.language': 'Brazilian Portuguese',
  },
  ru: {
    'rc.label': '⇄ Удалённое управление',
    'rc.attached': 'подключено: {who}',
    'rc.connected': 'подключено',
    'surface.mobile': 'телефон',
    'surface.desktop': 'веб/компьютер',
    forecast: '{label}: при текущем темпе будет исчерпан около {time}',
    'limit.fiveHour': 'Лимит на 5 ч',
    'limit.sevenDay': 'Лимит на 7 дн.',
    'limit.scoped': 'Недельный лимит {name}',
    week: '7 дн.',
    streak: { one: '{n} день подряд', few: '{n} дня подряд', many: '{n} дней подряд', other: '{n} дня подряд' },
    'git.dirty': {
      one: '{n} незакоммиченное изменение',
      few: '{n} незакоммиченных изменения',
      many: '{n} незакоммиченных изменений',
      other: '{n} незакоммиченного изменения',
    },
    'git.ahead': {
      one: '{n} неотправленный коммит',
      few: '{n} неотправленных коммита',
      many: '{n} неотправленных коммитов',
      other: '{n} неотправленного коммита',
    },
    'compact.left': '{tokens} до автосжатия',
    'cache.cold': 'кэш остыл: следующее сообщение перекэширует {tokens}',
    'alert.context': `Контекст заполнен на {p}${NB}% — стоит выполнить /compact`,
    'alert.fiveHour': `Лимит на 5 часов израсходован на {p}${NB}%`,
    'alert.sevenDay': `Лимит на 7 дней израсходован на {p}${NB}%`,
    'alert.scoped': `Недельный лимит {name} израсходован на {p}${NB}%`,
    'turn.done': '✓ Ответ готов за {d}',
    'cmd.description': 'Показать или скрыть панель claude-hud; detail открывает панель подробностей; theme меняет тему',
    'theme.set': 'Тема HUD: {name}',
    'theme.list': 'Темы HUD (сейчас {name}): {list}. /hud theme <имя>, next или reset; * нужен Nerd Font',
    'theme.unknown': 'Темы {name} нет. Темы: {list}',
    'theme.ask': 'Какую тему HUD выбрать? (сейчас {name}; в Other можно ввести: {list})',
    'cmd.hidden': 'Панель claude-hud скрыта',
    'cmd.shown': 'Панель claude-hud показана',
    'pane.title': 'Подробности HUD',
    'pane.opened': 'Панель подробностей HUD открыта (/hud detail закрывает её)',
    'pane.closed': 'Панель подробностей HUD закрыта',
    'pane.tools': 'Время по инструментам',
    'pane.noTools': 'В этой сессии ещё не было вызовов инструментов',
    'pane.toolStats': '×{count} · всего {total} · в среднем {avg}',
    'pane.failed': 'ошибок: {n}',
    'pane.agents': 'Субагенты',
    'pane.none': 'Нет',
    'pane.todos': 'Задачи',
    'pane.spend': 'Расходы',
    'pane.turns': 'Последние ходы',
    'pane.turnRow': '#{n} · {time} · {cost} · контекст {tokens}',
    'spend.today': 'Сегодня: {spent}',
    'spend.week': '7 дн.: {spent}',
    'summary.language': 'Russian',
  },
}

// The BCP 47 tag `Intl` formats and pluralizes with, per language.
const INTL_TAG: Record<CanonicalLanguage, string> = {
  en: 'en-US',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  es: 'es',
  fr: 'fr-FR',
  de: 'de-DE',
  'pt-BR': 'pt-BR',
  ru: 'ru-RU',
}

/** The language the HUD draws in: claude-hud's, as its last config load set it. */
export function language(): CanonicalLanguage {
  return getCanonicalLanguage()
}

/** Whether the language sets text in CJK characters (two columns each). */
export function isCjk(lang: CanonicalLanguage = language()): boolean {
  return lang === 'zh-Hans' || lang === 'zh-Hant' || lang === 'ja' || lang === 'ko'
}

function pluralCategory(lang: CanonicalLanguage, n: number): string {
  try {
    return new Intl.PluralRules(INTL_TAG[lang]).select(n)
  } catch {
    return n === 1 ? 'one' : 'other'
  }
}

/** The message `key`, its `{placeholders}` filled; `params.n` picks a plural form. */
export function m(key: Key, params: Record<string, string | number> = {}, lang: CanonicalLanguage = language()): string {
  const text = MESSAGES[lang][key] ?? MESSAGES.en[key]
  const pattern =
    typeof text === 'string'
      ? text
      : ((text as Record<string, string | undefined>)[typeof params.n === 'number' ? pluralCategory(lang, params.n) : 'other'] ??
        text.other)
  return interpolate(pattern, params)
}

/** "$3.20", "3,20 $", "US$ 3,20": a USD amount as the language writes it. */
export function money(usd: number, lang: CanonicalLanguage = language()): string {
  try {
    return new Intl.NumberFormat(INTL_TAG[lang], {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'narrowSymbol',
    }).format(usd)
  } catch {
    return `$${usd.toFixed(2)}`
  }
}

/** The one-line task summary's prompt: the language by name and a length to keep to. */
export function summaryPrompt(lang: CanonicalLanguage = language()): string {
  const budget = isCjk(lang) ? 'at most 25 characters' : 'at most 8 words'
  return (
    `In ${m('summary.language', {}, lang)}, state in one line (${budget}) the task this session is working on right now. ` +
    'Output only that line: no quotes, no prefix, no closing punctuation.'
  )
}
