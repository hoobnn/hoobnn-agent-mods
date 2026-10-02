import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, FinaleState, PetStats, Preview } from '../types'
import { USAGE, parseCommand } from './command'
import { readConfig } from './config'
import type { Choice } from './config'
import { m, setLang } from './i18n'
import { stackAbove } from './kit/band'
import { resolveLanguage } from './kit/lang'
import { keptRows, migrateStore, persist } from './kit/prefs'
import type { Prefs } from './kit/prefs'
import { bubbleOf, finaleOf, formatDuration, levelOf, toolLabel } from './pet'
import { FINALE_MS, THEMES, THEME_NAMES, isThemeName, pickRandom, textWidth } from './themes'
import type { Act, Mood, PetView, ThemeName } from './themes'

// The theme drawn this session ('' until session.start picks one).
const theme = atom({ plugin: 'spinner', key: 'theme' } as const, '')
// The `theme` row: a theme, or `random`.
const choice = atom({ plugin: 'spinner', key: 'choice' } as const, 'random')
// Session mirrors of the `visible`, `stage` and `companion` rows, so a command shows at once.
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

/** Client props are plain data: a key left undefined is refused, so it goes. */
function plain<T extends Record<string, unknown>>(props: T): T {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as T
}

/** The kit's hold on this mod's store and `/config` rows. */
function prefsOf($: EngineInterface): Prefs {
  return {
    kept: key => $.store.get(key),
    forget: key => $.store.delete(key),
    write: (field, value) => $.config.set({ key: `spinner.${field}`, value }),
  }
}

/**
 * The theme a choice names. `random` keeps the one this session already drew
 * at random (a reload brought by another row's change), unless `isFresh`.
 */
async function choose($: EngineInterface, picked: Choice, isFresh = false): Promise<ThemeName> {
  const current = await read($, theme)
  const wasRandom = (await read($, choice)) === 'random'
  const name =
    picked !== 'random' ? picked : !isFresh && wasRandom && isThemeName(current) ? current : pickRandom(await $.clock.now())
  await update($, choice, () => picked)
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

/** Sets a switch's session mirror and, when it changed, its row. */
async function setSwitch($: EngineInterface, field: 'visible' | 'stage' | 'companion', isOn: boolean): Promise<void> {
  // Each mirror spelled out: the engine reads which state a hook touches from the source.
  const wasOff =
    field === 'visible'
      ? await read($, isHidden)
      : field === 'stage'
        ? await read($, isStageOff)
        : await read($, isCompanionOff)
  if (wasOff === !isOn) return
  if (field === 'visible') await update($, isHidden, () => !isOn)
  else if (field === 'stage') await update($, isStageOff, () => !isOn)
  else await update($, isCompanionOff, () => !isOn)
  await persist(prefsOf($), field, isOn)
}

/** `/spinner` with no arguments: the theme, the pet, what is off, the themes and the usage. */
async function status($: EngineInterface): Promise<string> {
  const current = await read($, theme)
  const stats = await read($, pet)
  const lines = [
    m('cmd.status', { theme: `${current}${(await read($, choice)) === 'random' ? m('cmd.randomNote') : ''}` }),
    m('cmd.petStats', { theme: current, level: levelOf(stats.xp), xp: stats.xp, love: stats.love }),
  ]
  if (await read($, isHidden)) lines.push(m('cmd.hidden'))
  if (await read($, isStageOff)) lines.push(m('cmd.stageOff'))
  if (await read($, isCompanionOff)) lines.push(m('cmd.companionOff'))
  lines.push(m('cmd.themes', { list: THEME_NAMES.map(n => `${n} ${THEMES[n].happy}`).join(' · ') }), m('cmd.usage'))
  return lines.join('\n')
}

// What versions before 0.3 kept in the store, as `/config` rows.
const STORE_MOVES = {
  theme: (kept: unknown) => (kept === 'random' || isThemeName(kept) ? (['theme', kept] as const) : null),
  isHidden: (kept: unknown) => ['visible', kept !== true] as const,
  isStageOff: (kept: unknown) => ['stage', kept !== true] as const,
  isCompanionOff: (kept: unknown) => ['companion', kept !== true] as const,
}

export const register: Register = (on, options) => {
  const config = readConfig(options)
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
    setLang(resolveLanguage(config.language, settings.language, locale))
    await $.command.register({ name: 'spinner', description: m('cmd.description'), argumentHint: USAGE })

    const rows = readConfig({ ...options, ...(await keptRows(prefsOf($), STORE_MOVES)) })
    await choose($, rows.theme)
    await update($, isHidden, () => !rows.isVisible)
    await update($, isStageOff, () => !rows.hasStage)
    await update($, isCompanionOff, () => !rows.hasCompanion)
    const stats = (await $.store.get('pet')) as Partial<PetStats> | undefined
    await update($, pet, () => ({ xp: Number(stats?.xp) || 0, love: Number(stats?.love) || 0 }))
    const result = await next(e)
    await migrateStore(prefsOf($), STORE_MOVES)
    return result
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

    if (config.hasFinale) {
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
    const command = parseCommand(e.args)
    const list = THEME_NAMES.join(' · ')
    switch (command.kind) {
      case 'status':
        return { text: await status($) }
      case 'visible':
        await setSwitch($, 'visible', command.isOn)
        return { text: m(command.isOn ? 'cmd.shown' : 'cmd.hidden') }
      case 'stage':
        await setSwitch($, 'stage', command.isOn)
        return { text: m(command.isOn ? 'cmd.stageOn' : 'cmd.stageOff') }
      case 'companion':
        await setSwitch($, 'companion', command.isOn)
        return { text: m(command.isOn ? 'cmd.companionOn' : 'cmd.companionOff') }
      case 'pat': {
        const stats = await patPet($)
        return { text: m('cmd.pat', { theme: await read($, theme), love: stats.love }) }
      }
      case 'preview': {
        const current = await read($, theme)
        const name: ThemeName = command.theme ?? (isThemeName(current) ? current : 'clawd')
        const id = String(await $.clock.now())
        await update($, preview, () => ({ theme: name, id }))
        $.clock.after(PREVIEW_MS, () => void update($, preview, p => (p?.id === id ? null : p)))
        return { text: m('cmd.preview', { theme: name }) }
      }
      case 'theme': {
        const name = await choose($, command.theme, true)
        await persist(prefsOf($), 'theme', command.theme)
        return { text: command.theme === 'random' ? m('cmd.random', { theme: name }) : m('cmd.switched', { theme: name }) }
      }
      case 'unknown':
        return { text: m('cmd.unknown', { name: command.name, list }) }
    }
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
    const { Client } = ui

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
    return stackAbove(ui, stage, await next(e))
  })
}

/** Cells the mascot's region takes: its widest frame, with room for a symbol a terminal draws wide. */
function spriteWidth(name: ThemeName): number {
  return Math.max(...Object.values(THEMES[name].sprite).flat().map(textWidth)) + 2
}
