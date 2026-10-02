import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, DockPet, FinaleState, PetStats, Preview } from '../types'
import { USAGE, parseCommand } from './command'
import { readConfig } from './config'
import type { Choice } from './config'
import { m, setLang } from './i18n'
import { isPickerOpen, stackAbove } from './kit/band'
import { drawPet } from './kit/pet'
import { resolveLanguage } from './kit/lang'
import { keptRows, migrateStore, persist } from './kit/prefs'
import type { Prefs } from './kit/prefs'
import { bubbleOf, finaleOf, formatDuration, levelOf, toolLabel } from './pet'
import { FINALE_MS, THEMES, THEME_NAMES, isThemeName, pickRandom, textWidth } from './themes'
import type { Act, Mood, ThemeName } from './themes'
import { PET_ROWS, dockPetOf, petArtOf } from './pets'
import type { PetState } from './pets'

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
// The pet for whoever draws it (hud beside its rows, or this plugin above the prompt).
const dock = atom({ plugin: 'spinner', key: 'dock' } as const, null as DockPet | null)
const isTurn = atom({ plugin: 'spinner', key: 'isTurn' } as const, false)
// True while a picker is open above the band (see kit/band).
const isPicking = atom({ plugin: 'spinner', key: 'isPicking' } as const, false)
// hud's say: true while it draws the pet beside its rows.
const hudDock = atom({ plugin: 'hud', key: 'dock' } as const, false)

const PREVIEW_MS = 8000
/** Cells the pet's bubble and stats take beside it above the prompt. */
const PET_LABEL_W = 24
/** How long a pat's hearts float. */
const PAT_MS = 2500
/** Quiet this long after a turn, the companion dozes off. */
const SLEEP_MS = 5 * 60_000

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
  await publishPet($)
  return name
}

/** A pat: hearts in the band, one more point of affection, kept. */
async function patPet($: EngineInterface): Promise<PetStats> {
  const next = await update($, pet, p => ({ xp: p.xp, love: p.love + 1 }))
  await $.store.set('pet', next)
  const id = String(next.love)
  await update($, pat, () => id)
  if ((await read($, mood)) === 'sleep') await update($, mood, () => 'hello' as Mood)
  await publishPet($)
  $.clock.after(PAT_MS, async () => {
    if ((await read($, pat)) !== id) return
    await update($, pat, () => null)
    await publishPet($)
  })
  return next
}

const TONE: Partial<Record<PetState, DockPet['tone']>> = { ask: 'ask', error: 'error', aborted: 'aborted', sleep: 'sleep' }

/** Publishes the pet as it is now (`spinner.dock`), or null while it is off. */
async function publishPet($: EngineInterface): Promise<void> {
  if ((await read($, isHidden)) || (await read($, isCompanionOff))) {
    if ((await read($, dock)) !== null) await update($, dock, () => null)
    return
  }
  const name = await read($, theme)
  const now = await read($, activity)
  const state: PetState = (await read($, isTurn)) ? now.act : await read($, mood)
  const stats = await read($, pet)
  const patId = await read($, pat)
  const art = petArtOf(name, isThemeName(name) ? THEMES[name].color : THEMES.clawd.color)
  const view = {
    id: `${name}:${state}:${patId ?? ''}`,
    bubble: bubbleOf(state, now.tool),
    tone: TONE[state] ?? 'plain',
    stats: `Lv.${levelOf(stats.xp)} ♥${stats.love}`,
  }
  const was = await read($, dock)
  // The same loop with new words keeps its frames.
  const next = was?.id === view.id ? { ...was, ...view } : dockPetOf(art, state, view, patId !== null)
  if (was?.id === next.id && was.bubble === next.bubble && was.stats === next.stats && was.tone === next.tone) return
  await update($, dock, () => next)
}

/** Busy with the latest tool still running, else back to thinking. */
async function settle($: EngineInterface, running: Map<string, string>): Promise<void> {
  const last = [...running.values()].pop()
  await update($, activity, () => (last ? { act: 'tool' as Act, tool: last } : { act: 'think' as Act }))
  await publishPet($)
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
  await publishPet($)
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
    await publishPet($)
    const result = await next(e)
    await migrateStore(prefsOf($), STORE_MOVES)
    return result
  })

  on('turn.start', async ($, e, next) => {
    running.clear()
    sleepTimer?.cancel()
    await update($, activity, () => ({ act: 'think' as Act }))
    await update($, isTurn, () => true)
    if (await read($, finale)) await update($, finale, () => null)
    await publishPet($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) return next(e)
    const label = toolLabel(e as unknown as { tool: string } & Record<string, unknown>)
    running.set(e.tool_use_id, label)
    await update($, activity, () => (e.tool === 'AskUserQuestion' ? { act: 'ask' as Act } : { act: 'tool' as Act, tool: label }))
    await publishPet($)
    try {
      return await next(e)
    } finally {
      running.delete(e.tool_use_id)
      await settle($, running)
    }
  })

  // The one sure sign the person is being asked: the permission prompt itself.
  on('classic.Notification', async ($, e, next) => {
    if (e.notification_type === 'permission_prompt') {
      await update($, activity, a => ({ ...a, act: 'ask' as Act }))
      await publishPet($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result
    running.clear()
    await update($, activity, () => ({ act: 'think' as Act }))
    await update($, isTurn, () => false)

    const kind = finaleOf(e.reason)
    await update($, mood, () => (kind === 'answer' ? 'ready' : kind))
    sleepTimer?.cancel()
    sleepTimer = $.clock.after(SLEEP_MS, async () => {
      await update($, mood, () => 'sleep' as Mood)
      await publishPet($)
    })

    if (kind === 'answer') {
      const before = await read($, pet)
      const after = await update($, pet, p => ({ xp: p.xp + 1, love: p.love }))
      await $.store.set('pet', after)
      if (levelOf(after.xp) > levelOf(before.xp)) {
        $.ui.toast(m('pet.levelUp', { theme: await read($, theme), level: levelOf(after.xp) }))
      }
    }

    await publishPet($)
    if (config.hasFinale) {
      const label =
        kind === 'answer' ? m('finale.done', { time: formatDuration(e.durationMs) }) : m(kind === 'aborted' ? 'finale.aborted' : 'finale.error')
      const id = e.turnId
      await update($, finale, () => ({ kind, label, id }))
      $.clock.after(FINALE_MS, () => void update($, finale, f => (f?.id === id ? null : f)))
    }
    return result
  })

  // A click on the pet, where this plugin draws it.
  on('ui.message', async ($, e, next) => {
    if ((e.data as { pat?: unknown } | null)?.pat === true) await patPet($)
    return next(e)
  })

  // A click on the pet where hud draws it: hud counts it in `hud.petPats`.
  on('state.set', { plugin: 'hud', key: 'petPats' }, async ($, e, next) => {
    const result = await next(e)
    await patPet($)
    return result
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
  // A picker (`/` commands, `@` files) opens above the band: the band steps aside meanwhile.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const isOpen = isPickerOpen(box.text, box.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return box
  })
  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPicking)) await update($, isPicking, () => false)
    return next(e)
  })

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

  // The band: a preview, else the running turn's scene or its finale, and the
  // pet right-aligned beside it unless hud has it beside its rows.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isPicking))) return next(e)
    const ui = $.ui.resolve(e)
    if (!('Client' in ui)) return next(e)
    const { Box, Client } = ui

    const shown: Preview | null = await read($, preview)
    const current = await read($, theme)
    const name: ThemeName = isThemeName(current) ? current : 'clawd'
    const pet = (await read($, isHidden)) || (await read($, hudDock)) ? null : await read($, dock)
    // Two cells in, and the pet's block on the right.
    const petColumns = pet ? pet.width + 1 + PET_LABEL_W : 0
    const columns = e.props.bodyColumns - 2 - petColumns
    const sceneFits = (rows: number) => e.props.maxRows >= Math.max(rows, pet ? PET_ROWS : 0)
    let scene = null

    if (shown && isThemeName(shown.theme)) {
      scene = <Client key={`preview-${shown.id}`} module="./stage.tsx" width={columns} props={{ theme: shown.theme, columns, act: 'think' }} />
    } else if (!(await read($, isHidden)) && !(await read($, isStageOff)) && sceneFits(THEMES[name].rows)) {
      const ended: FinaleState | null = await read($, finale)
      const now: Activity = await read($, activity)
      if (e.props.isWorking) {
        scene = <Client key="work" module="./stage.tsx" width={columns} props={{ theme: name, columns, act: now.act }} />
      } else if (ended) {
        const props = { theme: name, columns, act: now.act, finale: ended.kind, label: ended.label }
        scene = <Client key={`finale-${ended.id}`} module="./stage.tsx" width={columns} props={props} />
      }
    }
    if (!scene && !pet) return next(e)

    const band = (
      <Box flexDirection="row" justifyContent="space-between" alignItems="flex-end">
        {scene ?? <Box />}
        {pet ? <Box width={petColumns} justifyContent="flex-end">{drawPet(ui, pet, 'pet')}</Box> : null}
      </Box>
    )
    return stackAbove(ui, band, await next(e))
  })
}

/** Cells the mascot's region takes: its widest frame, with room for a symbol a terminal draws wide. */
function spriteWidth(name: ThemeName): number {
  return Math.max(...Object.values(THEMES[name].sprite).flat().map(textWidth)) + 2
}
