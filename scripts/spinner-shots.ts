// Renders the spinner mod's README images from its own frame tables: a GIF and
// a still per theme, and a gallery of every theme's stage.
// Usage: bun scripts/spinner-shots.ts   (needs ffmpeg and a Chromium; set
// CHROMIUM to its binary when Playwright's own is not installed)
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { chromium } from 'playwright-core'

import { SPRITE_MS, STAGE_MS, THEMES, THEME_NAMES, blank, finaleScene, frame, hsl, padTo, poseOf, put, segments, textWidth } from '../claude-code/spinner/hooks/themes'
import type { Cell, Mode, Style, Theme } from '../claude-code/spinner/hooks/themes'

const COLS = 92
const WORK_FRAMES = 42
const FINALE_FRAMES = 24
const OUT = join(import.meta.dir, '../claude-code/spinner/assets')

const ENGINE = '#d77757'
const WHITE = '#e6e6e6'
const DIM = '#8a8a8a'

function findChromium(): string {
  if (process.env.CHROMIUM) return process.env.CHROMIUM
  const root = join(homedir(), 'Library/Caches/ms-playwright')
  const dir = readdirSync(root).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop()
  if (!dir) throw new Error('no Chromium found: set CHROMIUM')
  return join(root, dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell')
}

/** A row of cells; `isText` draws it as running text, not cell by cell. */
type Row = Cell[] & { isText?: boolean }

/** One row of runs written left to right. */
function line(parts: [string, Style?][]): Row {
  const g = blank(COLS, 1)
  let x = 0
  for (const [text, style] of parts) {
    put(g, x, 0, text, style)
    x += textWidth(text)
  }
  return g[0]!
}

function sprite(theme: Theme, mode: Mode, t: number): [string, Style][] {
  const frames = theme.sprite[poseOf(mode)]
  const width = Math.max(...Object.values(theme.sprite).flat().map(textWidth))
  const text = padTo(frame(frames, t), width)
  if (!theme.isRainbow) return [[text, { c: theme.color, b: true }]]
  return Array.from(text).map((ch, i) => [ch, { c: hsl((i * 40 + t * 24) % 360, 0.95, 0.62), b: true }])
}

/** The terminal's rows at frame `f`: a turn running, then its finale. */
function screen(theme: Theme, f: number): Row[] {
  const rows: Row[] = []
  const text = (parts: [string, Style?][]) => Object.assign(line(parts), { isText: true })
  const isDone = f >= WORK_FRAMES
  const mode: Mode = f < 14 ? 'thinking' : f < 28 ? 'tool-use' : 'responding'
  rows.push(text([['> ', { c: DIM }], ['给 spinner 再加几套主题，然后跑一遍测试', { c: WHITE }]]))
  rows.push(line([]))
  rows.push(text([['⏺ ', { c: WHITE }], ['好的，先改主题帧表，再跑测试确认每一帧都对齐。', { c: WHITE }]]))
  rows.push(text(f >= 14 ? [['  ⎿  ', { c: DIM }], ['$ claude plugin test claude-code/spinner', { c: DIM }]] : []))
  rows.push(line([]))
  if (isDone) {
    rows.push(text([['⏺ ', { c: WHITE }], ['搞定：8 套主题全部通过，6 个测试都绿了。', { c: WHITE }]]))
    rows.push(text([['✻ Baked for 12s', { c: DIM }]]))
  } else {
    const glyph = frame(['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'], f)
    const secs = 3 + Math.floor(f / 5)
    rows.push(line([
      ...sprite(theme, mode, Math.floor((f * STAGE_MS) / SPRITE_MS)),
      [' '],
      [`${glyph} `, { c: ENGINE }],
      ['Choreographing…', { c: ENGINE, b: true }],
      [` (${secs}s · ↓ ${(0.4 + f * 0.05).toFixed(1)}k tokens)`, { c: DIM }],
    ]))
    rows.push(line([]))
  }
  rows.push(line([]))
  const stage = isDone ? finaleScene(theme, 'answer', '完成 · 12s', f - WORK_FRAMES, COLS - 3) : theme.scene(f, COLS - 3)
  for (const row of stage) rows.push([...row, ...line([]).slice(0, 3)])
  return rows
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function rowHtml(row: Row): string {
  if (row.isText) {
    const runs = segments(row).map(seg => {
      const style = [seg.c ? `color:${seg.c}` : '', seg.b ? 'font-weight:700' : ''].filter(Boolean).join(';')
      return `<span${style ? ` style="${style}"` : ''}>${esc(seg.text)}</span>`
    })
    return `<div class="row text">${runs.join('')}</div>`
  }
  let html = ''
  for (let i = 0; i < row.length; i++) {
    const cell = row[i]!
    if (cell.ch === '') continue
    const w = row[i + 1]?.ch === '' ? 2 : 1
    const style = [cell.c ? `color:${cell.c}` : '', cell.b ? 'font-weight:700' : '', cell.d ? 'opacity:.5' : '', w === 2 ? 'width:2ch' : '']
      .filter(Boolean)
      .join(';')
    html += `<span${style ? ` style="${style}"` : ''}>${cell.ch === ' ' ? '&nbsp;' : esc(cell.ch)}</span>`
  }
  return `<div class="row">${html}</div>`
}

const CSS = `
  body { margin: 0; background: #0e0e10; font-family: 'JetBrains Mono', 'PingFang SC', monospace; }
  #card { padding: 28px; display: inline-block; }
  .win { background: #1c1c1f; border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 1px #2a2a2e; }
  .bar { height: 40px; background: #232326; display: flex; align-items: center; padding: 0 16px; gap: 8px;
         font: 14px -apple-system, 'PingFang SC', sans-serif; color: #9a9a9e; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .title { margin-left: 14px; }
  .body { padding: 18px 22px 16px; font-size: 15px; line-height: 23px; color: ${WHITE}; }
  .row { white-space: pre; height: 23px; display: flex; }
  .text { display: block; }
  .row:not(.text) span { display: inline-block; width: 1ch; text-align: center; overflow: visible; }
  .prompt { margin-top: 10px; border: 1px solid #4a4a50; border-radius: 6px; padding: 4px 12px; color: ${WHITE}; }
  .hint { color: #6a6a70; padding: 6px 12px 0; }
  .label { font: 600 14px -apple-system, 'PingFang SC', sans-serif; color: #b8b8be; margin: 18px 0 6px; }
  .label:first-child { margin-top: 0; }
`

function windowHtml(title: string, rows: Row[], withPrompt: boolean): string {
  return `<div class="win">
    <div class="bar"><div class="dot" style="background:#ff5f57"></div><div class="dot" style="background:#febc2e"></div><div class="dot" style="background:#28c840"></div><div class="title">${esc(title)}</div></div>
    <div class="body">${rows.map(rowHtml).join('')}${withPrompt ? '<div class="prompt">&gt; </div><div class="hint">? for shortcuts</div>' : ''}</div>
  </div>`
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: findChromium() })
  const shoot = async (html: string, path: string, scale: number) => {
    const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: 1400, height: 900 } })
    await page.setContent(`<html><head><style>${CSS}</style></head><body><div id="card">${html}</div></body></html>`)
    await page.evaluate(() => document.fonts.ready)
    await page.locator('#card').screenshot({ path })
    await page.close()
  }

  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    const title = `claude — aurora-app · /spinner ${name}`
    const dir = join(tmpdir(), `spinner-shots-${name}`)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir)
    for (let f = 0; f < WORK_FRAMES + FINALE_FRAMES; f++) {
      await shoot(windowHtml(title, screen(theme, f), true), join(dir, `f${String(f).padStart(3, '0')}.png`), 1)
    }
    await shoot(windowHtml(title, screen(theme, 20), true), join(OUT, `${name}.png`), 2)
    const gif = Bun.spawnSync([
      'ffmpeg', '-y', '-loglevel', 'error', '-framerate', String(1000 / STAGE_MS), '-i', join(dir, 'f%03d.png'),
      '-vf', 'split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      join(OUT, `${name}.gif`),
    ])
    if (gif.exitCode !== 0) throw new Error(gif.stderr.toString())
    rmSync(dir, { recursive: true, force: true })
    console.log(`${name}: gif + png`)
  }

  // Every theme's mascot and stage, one under another.
  const gallery = THEME_NAMES.map(name => {
    const theme = THEMES[name]
    const rows = [line([...sprite(theme, 'tool-use', 1), [' '], ['✻ ', { c: ENGINE }], ['Choreographing…', { c: ENGINE, b: true }]]), ...theme.scene(24, COLS)]
    return `<div class="label">${name}</div>${windowHtml(`/spinner ${name}`, rows, false)}`
  }).join('')
  await shoot(gallery, join(OUT, 'gallery.png'), 2)
  console.log('gallery.png')
  await browser.close()
}

await main()
