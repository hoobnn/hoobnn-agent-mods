import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, FinaleState, PetStats, Preview } from '../types'
import { m, resolveLanguage, setLang } from './i18n'
import { FINALE_MS, THEMES, THEME_NAMES, isThemeName, noise, textWidth } from './themes'
import type { Act, Finale, Mood, PetView, ThemeName } from './themes'

const theme = atom({ plugin: 'spinner', key: 'theme' } as const, 'clawd')
const choice = atom({ plugin: 'spinner', key: 'choice' } as const, 'random')
const isHidden = atom({ plugin: 'spinner', key: 'isHidden' } as const, false)
const isStageOff = atom({ plugin: 'spinner', key: 'isStageOff' } as const, false)
const isCompanionOff = atom({ plugin: 'spinner', key: 'isCompanionOff' } as const, false)
const finale = atom({ plugin: 'spinner', key: 'finale' } as const, null)
const preview = atom({ plugin: 'spinner', key: 'preview' } as const, null)
const activity = atom({ plugin: 'spinner', key: 'activity' } as const, { act: 'think' as Act })
const mood = atom({ plugin: 'spinner', key: 'mood' } as const, 'hello' as Mood)
const pet = atom({ plugin: 'spinner', key: 'pet' } as const, { xp: 0, love: 0 })
const pat = atom({ plugin: 'spinner', key: 'pat' } as const, null)

const PREVIEW_MS = 8000
/** Quiet this long after a turn, the companion dozes off. */
const SLEEP_MS = 5 * 60_000

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

/** Lv.1 at 0 xp, Lv.2 at 2, Lv.3 at 8, Lv.4 at 18: one xp a finished turn. */
export function levelOf(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 2)) + 1
}

/** What a tool call is about, short: `Bash: npm test`, `Edit: themes.ts`, `WebSearch`. */
export function toolLabel(e: { tool: string } & Record<string, unknown>): string {
  const clip = (s: string) => (textWidth(s) > 32 ? `${Array.from(s).slice(0, 31).join('')}…` : s)
  if (typeof e.command === 'string') return clip(`${e.tool}: ${e.command.split('\n')[0]!.trim()}`)
  const path = [e.file_path, e.notebook_path, e.path].find(p => typeof p === 'string') as string | undefined
  if (path) return clip(`${e.tool}: ${path.split('/').pop()}`)
  if (typeof e.pattern === 'string') return clip(`${e.tool}: ${e.pattern}`)
  return clip(e.tool.replace(/^mcp__[^_]+__/, ''))
}

/** Client props are plain data: a key left undefined is refused, so it goes. */
function plain<T extends Record<string, unknown>>(props: T): T {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as T
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

/** A pat: hearts in the band, one more point of affection, kept. */
async function patPet($: EngineInterface): Promise<PetStats> {
  const next = await update($, pet, p => ({ xp: p.xp, love: p.love + 1 }))
  await $.store.set('pet', next)
  await update($, pat, () => String(next.love))
  if ((await read($, mood)) === 'sleep') await update($, mood, () => 'hello' as Mood)
  return next
}

/** Busy with the latest tool still running, else back to thinking. */
async function settle($: EngineInterface, running: Map<string, string>): Promise<void> {
  const last = [...running.values()].pop()
  await update($, activity, () => (last ? { act: 'tool' as Act, tool: last } : { act: 'think' as Act }))
}

/** The bubble says what the engine's spinner line does not: the tool, a prompt waiting, how the turn ended. */
function bubbleOf(state: Act | Mood, tool: string | undefined): string {
  if (state === 'tool') return tool ?? ''
  if (state === 'think' || state === 'say' || state === 'wait') return ''
  return m(`pet.${state}`)
}

export const register: Register = (on, options) => {
  const optionTheme = typeof options.theme === 'string' ? options.theme : 'random'
  const hasStage = options.stage !== false
  const hasFinale = options.celebrate !== false
  const hasCompanion = options.companion !== false
  // Tool calls running now: a pet stays busy until the last of parallel calls ends.
  const running = new Map<string, string>()
  let sleepTimer: { cancel: () => void } | undefined

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
      argumentHint: '[theme|random|pet|preview|off|on|stage off|companion off]',
    })

    // What /spinner chose wins over the option until the option is changed back to it.
    const kept = await $.store.get('theme')
    await choose($, typeof kept === 'string' ? kept : optionTheme)
    if ((await $.store.get('isHidden')) === true) await update($, isHidden, () => true)
    const keptStage = await $.store.get('isStageOff')
    await update($, isStageOff, () => (typeof keptStage === 'boolean' ? keptStage : !hasStage))
    const keptCompanion = await $.store.get('isCompanionOff')
    await update($, isCompanionOff, () => (typeof keptCompanion === 'boolean' ? keptCompanion : !hasCompanion))
    const stats = (await $.store.get('pet')) as Partial<PetStats> | undefined
    await update($, pet, () => ({ xp: Number(stats?.xp) || 0, love: Number(stats?.love) || 0 }))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    running.clear()
    sleepTimer?.cancel()
    await update($, activity, () => ({ act: 'think' as Act }))
    if (await read($, finale)) await update($, finale, () => null)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) return next(e)
    const label = toolLabel(e as unknown as { tool: string } & Record<string, unknown>)
    running.set(e.tool_use_id, label)
    await update($, activity, () => (e.tool === 'AskUserQuestion' ? { act: 'ask' as Act } : { act: 'tool' as Act, tool: label }))
    try {
      return await next(e)
    } finally {
      running.delete(e.tool_use_id)
      await settle($, running)
    }
  })

  // The one sure sign the person is being asked: the permission prompt itself.
  on('classic.Notification', async ($, e, next) => {
    if (e.notification_type === 'permission_prompt') await update($, activity, a => ({ ...a, act: 'ask' as Act }))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result
    running.clear()
    await update($, activity, () => ({ act: 'think' as Act }))

    const kind = finaleOf(e.reason)
    await update($, mood, () => (kind === 'answer' ? 'ready' : kind))
    sleepTimer?.cancel()
    sleepTimer = $.clock.after(SLEEP_MS, () => void update($, mood, () => 'sleep' as Mood))

    if (kind === 'answer') {
      const before = await read($, pet)
      const after = await update($, pet, p => ({ xp: p.xp + 1, love: p.love }))
      await $.store.set('pet', after)
      if (levelOf(after.xp) > levelOf(before.xp)) {
        $.ui.toast(m('pet.levelUp', { theme: await read($, theme), level: levelOf(after.xp) }))
      }
    }

    if (hasFinale) {
      const label =
        kind === 'answer' ? m('finale.done', { time: formatDuration(e.durationMs) }) : m(kind === 'aborted' ? 'finale.aborted' : 'finale.error')
      const id = e.turnId
      await update($, finale, () => ({ kind, label, id }))
      $.clock.after(FINALE_MS, () => void update($, finale, f => (f?.id === id ? null : f)))
    }
    return result
  })

  // A click on the band.
  on('ui.message', async ($, e, next) => {
    if ((e.data as { pat?: unknown } | null)?.pat === true) await patPet($)
    return next(e)
  })

  on('command.run', { command: 'spinner' }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const list = THEME_NAMES.join(' · ')
    const current = await read($, theme)

    if (verb === '') {
      const stats = await read($, pet)
      const lines = [
        m('cmd.status', { theme: `${current}${(await read($, choice)) === 'random' ? m('cmd.randomNote') : ''}` }),
        m('cmd.petStats', { theme: current, level: levelOf(stats.xp), xp: stats.xp, love: stats.love }),
      ]
      if (await read($, isHidden)) lines.push(m('cmd.hidden'))
      if (await read($, isStageOff)) lines.push(m('cmd.stageOff'))
      if (await read($, isCompanionOff)) lines.push(m('cmd.companionOff'))
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
    if (verb === 'companion' && (arg === 'off' || arg === 'on')) {
      await update($, isCompanionOff, () => arg === 'off')
      await $.store.set('isCompanionOff', arg === 'off')
      return { text: m(arg === 'off' ? 'cmd.companionOff' : 'cmd.companionOn') }
    }
    if (verb === 'pet') {
      const stats = await patPet($)
      return { text: m('cmd.pat', { theme: current, love: stats.love }) }
    }
    if (verb === 'preview') {
      if (arg && !isThemeName(arg)) return { text: m('cmd.unknown', { name: arg, list }) }
      const name = isThemeName(arg) ? arg : current
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
    // One mascot at a time: with the companion's row showing, it stays there.
    if ((await read($, isHidden)) || !(await read($, isCompanionOff))) return next(e)
    const ui = $.ui.resolve(e)
    if (!('Client' in ui)) return next(e)
    const { Box, Client } = ui
    const current = await read($, theme)
    const name: ThemeName = isThemeName(current) ? current : 'clawd'
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

  // The band, first match wins: a preview, the running turn, its finale, the
  // companion between turns, else nothing of this plugin's.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ui = $.ui.resolve(e)
    if (!('Client' in ui)) return next(e)
    const { Box, Client } = ui

    const shown: Preview | null = await read($, preview)
    const hidden = await read($, isHidden)
    const current = await read($, theme)
    const name: ThemeName = isThemeName(current) ? current : 'clawd'
    const columns = e.props.bodyColumns
    let stage = null

    if (shown && isThemeName(shown.theme)) {
      stage = <Client key={`preview-${shown.id}`} module="./stage.tsx" width="100%" props={{ theme: shown.theme, columns, hasScene: true, act: 'think' }} />
    } else if (!hidden) {
      const ended: FinaleState | null = await read($, finale)
      const isStaged = !(await read($, isStageOff))
      const isCompanion = !(await read($, isCompanionOff))
      const now: Activity = await read($, activity)
      const stats = await read($, pet)
      const patId = await read($, pat)
      const view = (state: Act | Mood): PetView => ({
        state,
        bubble: bubbleOf(state, now.tool),
        stats: `Lv.${levelOf(stats.xp)} ♥${stats.love}`,
      })
      // The scene and the companion row take what the band can spare.
      const fits = e.props.maxRows >= THEMES[name].rows + (isCompanion ? 1 : 0)

      if (e.props.isWorking && (isStaged || isCompanion)) {
        const props = { theme: name, columns, hasScene: isStaged && fits, act: now.act, pet: isCompanion ? view(now.act) : undefined, pat: patId ?? undefined }
        stage = <Client key="work" module="./stage.tsx" width="100%" props={plain(props)} />
      } else if (ended && isStaged && fits) {
        const props = { theme: name, columns, hasScene: true, act: now.act, finale: ended.kind, label: ended.label, pat: patId ?? undefined }
        stage = <Client key={`finale-${ended.id}`} module="./stage.tsx" width="100%" props={plain(props)} />
      } else if (isCompanion) {
        const props = { theme: name, columns, hasScene: false, act: now.act, pet: view(await read($, mood)), pat: patId ?? undefined, isIdle: true }
        stage = <Client key="idle" module="./stage.tsx" width="100%" props={plain(props)} />
      }
    }
    if (!stage) return next(e)

    // Other bands (another mod's) draw beneath this one rather than being replaced.
    const below = await next(e)
    return (
      <Box flexDirection="column">
        {/* Two cells in, as the engine indents the lines under the prompt. */}
        <Box paddingLeft={2}>{stage}</Box>
        {below}
      </Box>
    )
  })
}

/** Cells the mascot's region takes: its widest frame, with room for a symbol a terminal draws wide. */
function spriteWidth(name: ThemeName): number {
  return Math.max(...Object.values(THEMES[name].sprite).flat().map(textWidth)) + 2
}
