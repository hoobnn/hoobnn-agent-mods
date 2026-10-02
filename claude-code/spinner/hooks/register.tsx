import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { FinaleState, Preview } from '../types'
import { m, resolveLanguage, setLang } from './i18n'
import { FINALE_MS, THEMES, THEME_NAMES, isThemeName, noise, textWidth } from './themes'
import type { Finale, ThemeName } from './themes'

const theme = atom({ plugin: 'spinner', key: 'theme' } as const, 'cat')
const choice = atom({ plugin: 'spinner', key: 'choice' } as const, 'random')
const isHidden = atom({ plugin: 'spinner', key: 'isHidden' } as const, false)
const isStageOff = atom({ plugin: 'spinner', key: 'isStageOff' } as const, false)
const finale = atom({ plugin: 'spinner', key: 'finale' } as const, null)
const preview = atom({ plugin: 'spinner', key: 'preview' } as const, null)

const PREVIEW_MS = 8000

/** Cells the mascot's region takes: its widest frame, with room for a symbol a terminal draws wide. */
function spriteWidth(name: ThemeName): number {
  return Math.max(...Object.values(THEMES[name].sprite).flat().map(textWidth)) + 2
}

export function pickRandom(seed: number): ThemeName {
  return THEME_NAMES[Math.floor(noise(seed) * THEME_NAMES.length)]!
}

/** `12s`, `3m 05s`, `1h 02m`. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`
}

function finaleOf(reason: string): Finale {
  return reason === 'answer' ? 'answer' : reason === 'aborted' ? 'aborted' : 'error'
}

/** Picks the theme a choice names, a fresh random one for `random`. */
async function choose($: EngineInterface, picked: string): Promise<ThemeName> {
  const name = isThemeName(picked) ? picked : pickRandom(await $.clock.now())
  await update($, choice, () => (isThemeName(picked) ? picked : 'random'))
  await update($, theme, () => name)
  return name
}

export const register: Register = (on, options) => {
  const optionTheme = typeof options.theme === 'string' ? options.theme : 'random'
  const hasStage = options.stage !== false
  const hasFinale = options.celebrate !== false

  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown }
    const locale = await Promise.all([
      $.env.get('LC_ALL').catch(() => undefined),
      $.env.get('LC_MESSAGES').catch(() => undefined),
      $.env.get('LANG').catch(() => undefined),
    ])
    setLang(resolveLanguage(options.language, settings.language, locale))
    await $.command.register({
      name: 'spinner',
      description: m('cmd.description'),
      argumentHint: '[theme|random|off|on|stage off|stage on|preview]',
    })

    // What /spinner chose wins over the option until the option is changed back to it.
    const kept = await $.store.get('theme')
    await choose($, typeof kept === 'string' ? kept : optionTheme)
    if ((await $.store.get('isHidden')) === true) await update($, isHidden, () => true)
    const keptStage = await $.store.get('isStageOff')
    await update($, isStageOff, () => (typeof keptStage === 'boolean' ? keptStage : !hasStage))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (await read($, finale)) await update($, finale, () => null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || !hasFinale) return result

    const kind = finaleOf(e.reason)
    const label =
      kind === 'answer' ? m('finale.done', { time: formatDuration(e.durationMs) }) : m(kind === 'aborted' ? 'finale.aborted' : 'finale.error')
    const id = e.turnId
    await update($, finale, () => ({ kind, label, id }))
    $.clock.after(FINALE_MS, () => void update($, finale, f => (f?.id === id ? null : f)))
    return result
  })

  on('command.run', { command: 'spinner' }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const list = THEME_NAMES.join(' · ')

    if (verb === '') {
      const lines = [m('cmd.status', { theme: `${await read($, theme)}${(await read($, choice)) === 'random' ? m('cmd.randomNote') : ''}` })]
      if (await read($, isHidden)) lines.push(m('cmd.hidden'))
      if (await read($, isStageOff)) lines.push(m('cmd.stageOff'))
      lines.push(m('cmd.themes', { list: THEME_NAMES.map(n => `${n} ${THEMES[n].happy}`).join(' · ') }), m('cmd.usage'))
      return { text: lines.join('\n') }
    }
    if (verb === 'off' || verb === 'on') {
      await update($, isHidden, () => verb === 'off')
      await $.store.set('isHidden', verb === 'off')
      return { text: m(verb === 'off' ? 'cmd.hidden' : 'cmd.shown') }
    }
    if (verb === 'stage' && (arg === 'off' || arg === 'on')) {
      await update($, isStageOff, () => arg === 'off')
      await $.store.set('isStageOff', arg === 'off')
      return { text: m(arg === 'off' ? 'cmd.stageOff' : 'cmd.stageOn') }
    }
    if (verb === 'preview') {
      if (arg && !isThemeName(arg)) return { text: m('cmd.unknown', { name: arg, list }) }
      const name = isThemeName(arg) ? arg : await read($, theme)
      const id = String(await $.clock.now())
      await update($, preview, () => ({ theme: name, id }))
      $.clock.after(PREVIEW_MS, () => void update($, preview, p => (p?.id === id ? null : p)))
      return { text: m('cmd.preview', { theme: name }) }
    }
    if (verb === 'random' || isThemeName(verb)) {
      const name = await choose($, verb)
      await $.store.set('theme', verb)
      return { text: verb === 'random' ? m('cmd.random', { theme: name }) : m('cmd.switched', { theme: name }) }
    }
    return { text: m('cmd.unknown', { name: verb, list }) }
  })

  // The mascot rides in front of the engine's own line, which keeps its word,
  // elapsed time and tokens.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (await read($, isHidden)) return next(e)
    const ui = $.ui.resolve(e)
    if (!('Client' in ui)) return next(e)
    const { Box, Client } = ui
    const current = await read($, theme)
    const name: ThemeName = isThemeName(current) ? current : 'cat'
    const native = await next(e)
    return (
      <Box flexDirection="row" columnGap={1}>
        {/* The engine's line opens with a blank row; the mascot sits on the line itself. */}
        <Box marginTop={1}>
          <Client key="sprite" module="./sprite.tsx" width={spriteWidth(name)} props={{ theme: name, mode: e.props.mode }} />
        </Box>
        {native}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ui = $.ui.resolve(e)
    if (!('Client' in ui)) return next(e)
    const { Box, Client } = ui

    const shown: Preview | null = await read($, preview)
    const ended: FinaleState | null = await read($, finale)
    // A preview asked for plays even while the animations are off.
    const isStaged = !(await read($, isStageOff)) && !(await read($, isHidden))
    const name = await read($, theme)
    const columns = e.props.bodyColumns

    let stage = null
    if (shown) {
      stage = <Client key={`preview-${shown.id}`} module="./stage.tsx" width="100%" props={{ theme: shown.theme, columns }} />
    } else if (isStaged && e.props.isWorking) {
      stage = <Client key="work" module="./stage.tsx" width="100%" props={{ theme: name, columns }} />
    } else if (isStaged && ended) {
      stage = (
        <Client key={`finale-${ended.id}`} module="./stage.tsx" width="100%" props={{ theme: name, columns, finale: ended.kind, label: ended.label }} />
      )
    }
    if (!stage) return next(e)

    // Other bands (another mod's) draw beneath this one rather than being replaced.
    const below = await next(e)
    return (
      <Box flexDirection="column">
        {stage}
        {below}
      </Box>
    )
  })
}
