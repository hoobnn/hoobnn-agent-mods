import { atom, derive, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, DockPet, FinaleState, PetStats, Preview } from '../types'
import { USAGE, parseCommand } from './command'
import { readConfig } from './config'
import type { Choice, Config } from './config'
import { m, setLang } from './i18n'
import { isPickerOpen, stackAbove } from './kit/band'
import { drawPet, drawPetLine } from './kit/pet'
import { resolveLanguage } from './kit/lang'
import { keptRows, migrateStore, persist } from './kit/prefs'
import type { Prefs } from './kit/prefs'
import { bubbleOf, busyLabel, finaleOf, formatDuration, levelOf, newsOf, toolLabel } from './pet'
import { FINALE_MS, THEMES, THEME_NAMES, isThemeName, pickRandom, textWidth } from './themes'
import type { Act, Mood, ThemeName } from './themes'
import { PET_ROWS, dockPetOf, petArtOf } from './pets'
import type { PetState } from './pets'
import { AUDIO_BANDS, AudioMeter, lineSplitter } from './audio'
import type { AudioView } from './audio'
import type { StageProps } from './stage'

// The theme drawn this session ('' until session.start, or the first turn of a
// session resumed or cleared, which gets no session.start, picks one).
const theme = atom({ plugin: 'spinner', key: 'theme' } as const, '')
// The `theme` row: a theme, or `random`.
const choice = atom({ plugin: 'spinner', key: 'choice' } as const, 'random')
// Session mirrors of the `visible`, `stage` and `companion` rows, so a command shows at once;
// null in a session resumed or cleared, which gets no session.start: the rows' then.
const hiddenSet = atom({ plugin: 'spinner', key: 'isHidden' } as const, null as boolean | null)
const stageOffSet = atom({ plugin: 'spinner', key: 'isStageOff' } as const, null as boolean | null)
const companionOffSet = atom({ plugin: 'spinner', key: 'isCompanionOff' } as const, null as boolean | null)
// The rows themselves, set in register.
let rows: Config | null = null
const isHidden = derive([hiddenSet], set => set ?? !(rows?.isVisible ?? true))
const isStageOff = derive([stageOffSet], set => set ?? !(rows?.hasStage ?? true))
const isCompanionOff = derive([companionOffSet], set => set ?? !(rows?.hasCompanion ?? true))
const finale = atom({ plugin: 'spinner', key: 'finale' } as const, null)
const preview = atom({ plugin: 'spinner', key: 'preview' } as const, null)
const activity = atom({ plugin: 'spinner', key: 'activity' } as const, { act: 'think' as Act })
const mood = atom({ plugin: 'spinner', key: 'mood' } as const, 'hello' as Mood)
const pet = atom({ plugin: 'spinner', key: 'pet' } as const, { xp: 0, love: 0 })
const pat = atom({ plugin: 'spinner', key: 'pat' } as const, null)
const news = atom({ plugin: 'spinner', key: 'news' } as const, null)
// The pet for whoever draws it (hud beside its rows, or this plugin above the prompt).
const dock = atom({ plugin: 'spinner', key: 'dock' } as const, null as DockPet | null)
const isTurn = atom({ plugin: 'spinner', key: 'isTurn' } as const, false)
// True while a picker is open above the band (see kit/band).
const isPicking = atom({ plugin: 'spinner', key: 'isPicking' } as const, false)
// The audio theme's tap: whether anything plays, and why it could not run.
const tapState = atom({ plugin: 'spinner', key: 'tap' } as const, { isAudible: false, error: null as string | null })
// hud's say: true while it draws the pet beside its rows.
const hudDock = atom({ plugin: 'hud', key: 'dock' } as const, false)

const PREVIEW_MS = 8000
/** Below this many columns the band draws the pet in one row. */
const COMPACT_COLUMNS = 60
/** Cells the pet's bubble and stats take beside it above the prompt. */
const PET_LABEL_W = 24
/** How long the pet speaks of tests or a commit. */
const NEWS_MS = 4000
/** How long a pat's hearts float. */
const PAT_MS = 2500
/** How long an `ask` must stand before the pet shows it: the mode settles most at once. */
const ASK_DELAY_MS = 600
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

/** The pet's stats as the store keeps them, shared by every session. */
async function keptPet($: EngineInterface): Promise<PetStats> {
  const stats = (await $.store.get('pet')) as Partial<PetStats> | undefined
  return { xp: Number(stats?.xp) || 0, love: Number(stats?.love) || 0 }
}

/**
 * Adds `by` to the kept stats, read again just before: sessions running side
 * by side all raise the one pet instead of writing back their own copy.
 */
async function bumpPet($: EngineInterface, by: PetStats): Promise<PetStats> {
  const kept = await keptPet($)
  const next = { xp: kept.xp + by.xp, love: kept.love + by.love }
  await $.store.set('pet', next)
  return update($, pet, () => next)
}

/** One more xp, kept, and a toast when it brings a level. */
async function gainXp($: EngineInterface): Promise<void> {
  const after = await bumpPet($, { xp: 1, love: 0 })
  if (levelOf(after.xp) > levelOf(after.xp - 1)) {
    $.ui.toast(m('pet.levelUp', { theme: await read($, theme), level: levelOf(after.xp) }))
  }
}

/** Tests or a commit the main thread just ran: a word from the pet for a moment, and xp for good news. */
async function noteNews($: EngineInterface, command: string, isError: boolean, id: string): Promise<void> {
  const kind = newsOf(command, isError)
  if (kind === null) return
  await update($, news, () => ({ kind, id }))
  if (kind !== 'testFail') await gainXp($)
  $.clock.after(NEWS_MS, async () => {
    if ((await read($, news))?.id !== id) return
    await update($, news, () => null)
    await publishPet($)
  })
}

/** A pat: hearts in the band, one more point of affection, kept. */
async function patPet($: EngineInterface): Promise<PetStats> {
  const next = await bumpPet($, { xp: 0, love: 1 })
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

/** Reduced motion (the `reducedMotion` row): every animation one still frame. */
let isStill = false

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
  // A permission prompt waiting outranks news: it is the one the person must act on.
  const said = state === 'ask' ? null : await read($, news)
  const art = petArtOf(name, isThemeName(name) ? THEMES[name].color : THEMES.clawd.color)
  const view = {
    id: `${name}:${state}:${patId ?? ''}`,
    bubble: said ? m(`pet.${said.kind}`) : bubbleOf(state, now.tool),
    tone: said?.kind === 'testFail' ? 'error' : (TONE[state] ?? 'plain'),
    stats: `Lv.${levelOf(stats.xp)} ♥${stats.love}`,
  }
  const was = await read($, dock)
  // The same loop with new words keeps its frames.
  const next = was?.id === view.id ? { ...was, ...view } : dockPetOf(art, state, view, patId !== null, isStill)
  if (was?.id === next.id && was.bubble === next.bubble && was.stats === next.stats && was.tone === next.tone) return
  await update($, dock, () => next)
}

// ---- the audio theme's tap ----------------------------------------------------

/** The tap's levels, read by the band each frame. */
const meter = new AudioMeter()
/** The running tap, while the audio theme is drawn. */
let tap: { stop: () => void } | null = null
/** The props each band instance was last drawn with, by its key: a frame's answer carries them. */
const stageProps = new Map<string, StageProps>()

/** The tap's binary, built from its source beside it on first use (and again when the source is newer). */
async function buildTap($: EngineInterface): Promise<string> {
  const src = `${$.plugin.root}/hooks/audio-tap.swift`
  const bin = `${$.plugin.root}/hooks/audio-tap`
  const [built, source] = await Promise.all([$.fs.stat(bin).catch(() => null), $.fs.stat(src)])
  if (built && built.mtimeMs >= source.mtimeMs) return bin
  let out
  try {
    out = await $.process.run(['swiftc', '-O', src, '-o', bin], { timeoutMs: 120_000 })
  } catch (err) {
    // The engine's word first (no processes on this surface, or no swiftc), then the usual fix.
    throw new Error(`${err instanceof Error ? err.message : String(err)}; swiftc comes with xcode-select --install`)
  }
  if (out.exitCode !== 0) throw new Error(`swiftc: ${out.stderr.trim().split('\n')[0] || `exit ${out.exitCode}`}`)
  return bin
}

/** Starts the tap: its lines into the meter, `spinner.tap` told when sound starts or stops, or why it ended. */
function startTap($: EngineInterface): { stop: () => void } {
  let isStopped = false
  let stream: AsyncIterator<unknown> | undefined
  const fail = (error: string) => (isStopped ? undefined : update($, tapState, () => ({ isAudible: false, error })))
  void (async () => {
    let said = ''
    try {
      const bin = await buildTap($)
      if (isStopped) return
      const child = $.process.spawn({ argv: [bin, String(AUDIO_BANDS)] })
      stream = child[Symbol.asyncIterator]()
      const split = lineSplitter()
      let wasAudible = false
      for await (const chunk of child) {
        if (isStopped) break
        if (chunk.stream === 'stderr') {
          said = chunk.text.trim()
          continue
        }
        for (const line of split(chunk.text)) meter.push(line)
        if (meter.isAudible !== wasAudible) {
          wasAudible = meter.isAudible
          await update($, tapState, () => ({ isAudible: wasAudible, error: null }))
        }
      }
      await fail(said || 'the tap stopped')
    } catch (err) {
      await fail(said || (err instanceof Error ? err.message : String(err)))
    }
  })()
  return {
    stop: () => {
      isStopped = true
      void stream?.return?.()
    },
  }
}

/** Runs the tap exactly while the audio theme's band can show. */
async function syncTap($: EngineInterface): Promise<void> {
  const wants = (await read($, theme)) === 'audio' && !(await read($, isHidden)) && !(await read($, isStageOff))
  if (wants && !tap) {
    await update($, tapState, () => ({ isAudible: false, error: null }))
    tap = startTap($)
  } else if (!wants && tap) {
    tap.stop()
    tap = null
    await update($, tapState, () => ({ isAudible: false, error: null }))
  }
}

/** What the band draws for the audio theme now: the meter's view, or null when the tap could not run. */
async function feedOf($: EngineInterface): Promise<AudioView | null> {
  return (await read($, tapState)).error ? null : meter.view()
}

/** Busy with the latest tool still running (subagents counted), else back to thinking. */
async function settle($: EngineInterface, running: Map<string, string>): Promise<void> {
  const last = busyLabel([...running.values()])
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
  if (field === 'visible') await update($, hiddenSet, () => !isOn)
  else if (field === 'stage') await update($, stageOffSet, () => !isOn)
  else await update($, companionOffSet, () => !isOn)
  await publishPet($)
  await syncTap($)
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
  if (current === 'audio') {
    const { error } = await read($, tapState)
    lines.push(error ? m('cmd.audioOff', { reason: error }) : m('cmd.audioOn'))
  }
  lines.push(m('cmd.themes', { list: THEME_NAMES.map(n => `${n} ${THEMES[n].happy}`).join(' · ') }), m('cmd.usage'))
  return lines.join('\n')
}

/** The session's theme, switches and pet, from the rows. */
async function seed($: EngineInterface, rows: Config): Promise<void> {
  await choose($, rows.theme)
  await update($, hiddenSet, () => !rows.isVisible)
  await update($, stageOffSet, () => !rows.hasStage)
  await update($, companionOffSet, () => !rows.hasCompanion)
  const stats = await keptPet($)
  await update($, pet, () => stats)
  await publishPet($)
  await syncTap($)
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
  rows = config
  isStill = config.isStill
  // Tool calls running now: a pet stays busy until the last of parallel calls ends.
  const running = new Map<string, string>()
  // Every call still open, a subagent's too: an ask is shown only while its call is.
  const open = new Set<string>()
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

    await seed($, readConfig({ ...options, ...(await keptRows(prefsOf($), STORE_MOVES)) }))
    const result = await next(e)
    await migrateStore(prefsOf($), STORE_MOVES)
    return result
  })

  on('turn.start', async ($, e, next) => {
    // A session resumed or cleared: no session.start came to pick its theme or read its pet.
    if ((await read($, theme)) === '') await seed($, config)
    running.clear()
    sleepTimer?.cancel()
    await update($, activity, () => ({ act: 'think' as Act }))
    await update($, isTurn, () => true)
    if (await read($, finale)) await update($, finale, () => null)
    await publishPet($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    // A subagent's call is no news for the bubble, but its permission ask is.
    if (e.agentId) {
      open.add(e.tool_use_id)
      try {
        return await next(e)
      } finally {
        open.delete(e.tool_use_id)
        // Its ask answered: back to what the main thread is doing.
        if ((await read($, activity)).act === 'ask') await settle($, running)
      }
    }
    open.add(e.tool_use_id)
    const label = toolLabel(e as unknown as { tool: string } & Record<string, unknown>)
    running.set(e.tool_use_id, label)
    await update($, activity, () => (e.tool === 'AskUserQuestion' ? { act: 'ask' as Act } : { act: 'tool' as Act, tool: busyLabel([...running.values()]) }))
    await publishPet($)
    try {
      const result = await next(e)
      const command = (e as unknown as { command?: unknown }).command
      if (e.tool === 'Bash' && typeof command === 'string' && !('deny' in result && result.deny !== undefined)) {
        await noteNews($, command, result.isError === true, e.tool_use_id)
      }
      return result
    } finally {
      open.delete(e.tool_use_id)
      running.delete(e.tool_use_id)
      await settle($, running)
    }
  })

  // A call the engine puts to the person: `ask` from the permission check. The
  // mode often settles an ask by itself at once, so the pet waits a moment and
  // asks only if the call is still open.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    const id = e.tool_use_id
    if (verdict.decision === 'ask' && id !== undefined && open.has(id)) {
      $.clock.after(ASK_DELAY_MS, async () => {
        if (!open.has(id)) return
        await update($, activity, a => ({ ...a, act: 'ask' as Act }))
        await publishPet($)
      })
    }
    return verdict
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
      await gainXp($)
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
  // The audio band asking for this frame's levels: its props again, with them.
  on('ui.message', async ($, e, next) => {
    const data = e.data as { pat?: unknown; audio?: unknown } | null
    if (data?.pat === true) await patPet($)
    const drawn = data?.audio === true ? stageProps.get(e.element) : undefined
    const heard = await next(e)
    return drawn ? { ...heard, props: { ...drawn, audio: await feedOf($) } } : heard
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
      case 'pick': {
        // 2-4 options fit the dialog: random and three others; any theme typed under Other.
        const current = await read($, theme)
        const others = THEME_NAMES.filter(n => n !== current)
        const start = (await $.clock.now()) % others.length
        const offered = ['random', ...[0, 1, 2].map(i => others[(start + i) % others.length]!)]
        let answer: string
        try {
          answer = (await $.ui.ask(m('cmd.pick', { list }), { options: offered, header: 'Theme' })).trim().toLowerCase()
        } catch {
          // Dismissed, or no one to ask (-p): what `/spinner` alone says.
          return { text: await status($) }
        }
        if (answer !== 'random' && !isThemeName(answer)) return { text: m('cmd.unknown', { name: answer, list }) }
        const name = await choose($, answer, true)
        await syncTap($)
        await persist(prefsOf($), 'theme', answer)
        return { text: answer === 'random' ? m('cmd.random', { theme: name }) : m('cmd.switched', { theme: name }) }
      }
      case 'theme': {
        const name = await choose($, command.theme, true)
        await syncTap($)
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

  // A button in the prompt footer: `/spinner off` / `on`. Mode labels other plugins add stay beside it.
  if (config.hasFooterButton) {
    on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
      const hidden = await read($, isHidden)
      const below = await next(e)
      const { Box, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Button key="spinner-toggle" plain dimColor={hidden} label="Spinner" onPress={() => setSwitch($, 'visible', hidden)} />
          {below}
        </Box>
      )
    })
  }

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
          <Client key="sprite" module="./sprite.tsx" width={spriteWidth(name)} props={{ theme: name, mode: e.props.mode, still: isStill }} />
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
    // The audio theme's band, fed by the tap each frame; its props kept for the frames' answers.
    const heard = await read($, tapState)
    const live = name === 'audio' && tap !== null
    stageProps.clear()
    const audioStage = async (key: string, props: StageProps) => {
      const fed: StageProps = live ? { ...props, audio: await feedOf($), feed: !isStill } : props
      stageProps.set(key, fed)
      return <Client key={key} module="./stage.tsx" width={columns} props={fed} />
    }

    if (shown && isThemeName(shown.theme)) {
      const props: StageProps = { theme: shown.theme, columns, act: 'think', still: isStill }
      scene = shown.theme === 'audio' ? await audioStage(`preview-${shown.id}`, props) : <Client key={`preview-${shown.id}`} module="./stage.tsx" width={columns} props={props} />
    } else if (!(await read($, isHidden)) && !(await read($, isStageOff)) && sceneFits(THEMES[name].rows)) {
      const ended: FinaleState | null = await read($, finale)
      const now: Activity = await read($, activity)
      if (e.props.isWorking) {
        const props: StageProps = { theme: name, columns, act: now.act, still: isStill }
        scene = live ? await audioStage('work', props) : <Client key="work" module="./stage.tsx" width={columns} props={props} />
      } else if (live && !ended && heard.isAudible) {
        // Between turns the audio theme stays up while something plays.
        scene = await audioStage('listen', { theme: name, columns, act: 'wait', still: isStill })
      } else if (ended) {
        const props = { theme: name, columns, act: now.act, finale: ended.kind, label: ended.label, still: isStill }
        scene = <Client key={`finale-${ended.id}`} module="./stage.tsx" width={columns} props={props} />
      }
    }
    if (!scene && !pet) return next(e)

    // Too short or narrow for the pet's block: the pet in one row, the scene left out.
    if (pet && !shown && (e.props.maxRows < PET_ROWS || e.props.bodyColumns < COMPACT_COLUMNS)) {
      const mascot = { text: THEMES[name].sprite.say[0] ?? '', color: THEMES[name].color }
      return stackAbove(ui, <Box justifyContent="flex-end">{drawPetLine(ui, pet, mascot)}</Box>, await next(e))
    }
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
