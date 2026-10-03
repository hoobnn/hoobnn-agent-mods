// Renders the README previews of the band mods (ts-band, hitokoto, todo-bar,
// receipt) from what each one really draws: scripts/shots/<mod>.tsx runs as one
// of the mod's tests and prints the tree its band returned, drawn here in a
// terminal window like the spinner's shots.
// Usage: bun scripts/mod-shots.ts [<mod> ...]   (needs a Chromium: set CHROMIUM
// to its binary when Playwright's own is not installed)
import { copyFileSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { chromium } from 'playwright-core'

import { textWidth } from '../claude-code/spinner/hooks/themes'

const ROOT = join(import.meta.dir, '..')
const COLS = 92

const WHITE = '#e6e6e6'
const DIM = '#8a8a8a'
const ENGINE = '#d77757'
/** The terminal's named colors, as a dark theme draws them. */
const PALETTE: Record<string, string> = {
  black: '#3a3a3e', red: '#ff7b72', green: '#7ee787', yellow: '#e3b341', blue: '#79c0ff', magenta: '#d2a8ff',
  cyan: '#56d4e8', white: WHITE, gray: DIM, grey: DIM,
}

type Node = { type: string; props?: Record<string, unknown>; children?: (Node | string)[] }
/** A transcript line: runs of text with a color. */
type Line = [string, string?][]

/** One shot: the transcript above the band, and where the PNG goes. */
type Scene = { out: string; title: string; lines: Line[] }

const ASK: Line = [['> ', DIM], ['给 HUD 加一套 neon 主题，写好测试再发版', WHITE]]
const SCENES: Record<string, Record<string, Scene>> = {
  'todo-bar': {
    preview: {
      out: 'assets/preview.png',
      title: 'claude — aurora-app',
      lines: [
        ASK, [],
        [['⏺ ', WHITE], ['主题切换接好了，接着写测试。', WHITE]],
        [['⏺ ', '#7ee787'], ['Write', WHITE], ['(tests/theme.test.ts)', DIM]],
        [['  ⎿  ', DIM], ['Wrote 86 lines to tests/theme.test.ts', DIM]], [],
        [['✻ ', ENGINE], ['Writing tests…', ENGINE], [' (4m 12s · ↓ 9.6k tokens)', DIM]], [],
      ],
    },
    done: {
      out: 'assets/done.png',
      title: 'claude — aurora-app',
      lines: [
        ASK, [],
        [['⏺ ', WHITE], ['发好了：neon 主题已合入，6 项任务全部完成。', WHITE]], [],
        [['✻ Baked for 4m 12s', DIM]], [],
      ],
    },
  },
  receipt: {
    preview: {
      out: 'assets/preview.png',
      title: 'claude — aurora-app',
      lines: [
        ASK, [],
        [['⏺ ', WHITE], ['neon 主题加好了，测试修过一次后全部通过；子代理顺手更新了 README。', WHITE]], [],
        [['✻ Baked for 2m 13s', DIM]], [],
      ],
    },
  },
  'ts-band': {
    preview: {
      out: 'assets/preview.png',
      title: 'claude — aurora-app',
      lines: [
        [['> ', DIM], ['把构建产物同步到 vps-west', WHITE]], [],
        [['⏺ ', WHITE], ['vps-west 现在走 DERP 中继（sfo），传输会慢一些，我先压缩再传。', WHITE]], [],
      ],
    },
  },
  hitokoto: {
    preview: {
      out: 'assets/preview.png',
      title: 'claude — aurora-app',
      lines: [
        ASK, [],
        [['⏺ ', WHITE], ['好的，先读一下现有的主题系统。', WHITE]], [],
        [['✻ Baked for 38s', DIM]], [],
      ],
    },
  },
}

function findChromium(): string {
  if (process.env.CHROMIUM) return process.env.CHROMIUM
  const root = join(homedir(), 'Library/Caches/ms-playwright')
  const dir = readdirSync(root).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop()
  if (!dir) throw new Error('no Chromium found: set CHROMIUM')
  return join(root, dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell')
}

/** Runs the mod's shot test and returns the trees it printed, by name. */
function drawTrees(mod: string): Record<string, Node> {
  const test = join(ROOT, 'claude-code', mod, 'tests/zz-shot.test.tsx')
  copyFileSync(join(import.meta.dir, 'shots', `${mod}.tsx`), test)
  try {
    const run = Bun.spawnSync(['claude', 'plugin', 'test', join(ROOT, 'claude-code', mod)])
    const out = run.stdout.toString() + run.stderr.toString()
    if (run.exitCode !== 0) throw new Error(`${mod}: tests failed\n${out}`)
    const trees: Record<string, Node> = {}
    for (const m of out.matchAll(/^@@SHOT (\S+) (.*)$/gm)) trees[m[1]!] = JSON.parse(m[2]!)
    return trees
  } finally {
    rmSync(test, { force: true })
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Text with every non-ASCII character held to the cells a terminal gives it. */
function cells(s: string): string {
  return [...s].map(ch => (ch.charCodeAt(0) < 128 ? esc(ch) : `<span class="c${textWidth(ch)}">${esc(ch)}</span>`)).join('')
}

const size = (v: unknown) => (typeof v === 'number' ? `${v}ch` : String(v))

/** An Ink-style tree as flexbox, Box by Box and Text by Text. */
function nodeHtml(node: Node | string): string {
  if (typeof node === 'string') return cells(node)
  const p = node.props ?? {}
  const inner = (node.children ?? []).map(nodeHtml).join('')
  if (node.type === 'Box') {
    if (p.key === 'core') return ''
    const css = ['display:flex', `flex-direction:${p.flexDirection ?? 'row'}`]
    if (p.flexWrap) css.push(`flex-wrap:${p.flexWrap}`)
    if (p.columnGap) css.push(`column-gap:${size(p.columnGap)}`)
    if (p.flexGrow !== undefined) css.push(`flex-grow:${p.flexGrow}`)
    if (p.flexShrink !== undefined) css.push(`flex-shrink:${p.flexShrink}`)
    for (const k of ['paddingLeft', 'paddingRight', 'width', 'minWidth'] as const) {
      if (p[k] !== undefined) css.push(`${k.replace(/[A-Z]/, c => `-${c.toLowerCase()}`)}:${size(p[k])}`)
    }
    return `<div class="box" style="${css.join(';')}">${inner}</div>`
  }
  const css: string[] = []
  if (typeof p.color === 'string') css.push(`color:${PALETTE[p.color] ?? p.color}`)
  if (p.dimColor) css.push('opacity:.55')
  if (p.bold) css.push('font-weight:700')
  if (p.italic) css.push('font-style:italic')
  const cls = p.wrap === 'truncate-end' ? ' class="trunc"' : ''
  if (node.type === 'Button') return `<span style="${css.join(';')}">${cells(String(p.label ?? ''))}</span>`
  return `<span${cls} style="${css.join(';')}">${inner}</span>`
}

const lineHtml = (line: Line) =>
  `<div class="row">${line.map(([text, color]) => `<span style="color:${color ?? WHITE}">${cells(text)}</span>`).join('')}</div>`

const CSS = `
  body { margin: 0; background: #0e0e10; font-family: 'JetBrains Mono', 'PingFang SC', monospace; }
  #card { padding: 28px; display: inline-block; }
  .win { background: #1c1c1f; border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 1px #2a2a2e; }
  .bar { height: 40px; background: #232326; display: flex; align-items: center; padding: 0 16px; gap: 8px;
         font: 14px -apple-system, 'PingFang SC', sans-serif; color: #9a9a9e; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .title { margin-left: 14px; }
  .body { padding: 18px 22px 16px; font-size: 15px; line-height: 23px; color: ${WHITE}; width: ${COLS}ch; }
  .row { white-space: pre; min-height: 23px; }
  .band { width: 88ch; white-space: pre; }
  .box { min-width: 0; }
  .trunc { white-space: pre; overflow: hidden; text-overflow: ellipsis; display: block; }
  .c1, .c2 { display: inline-block; text-align: center; }
  .c1 { width: 1ch; } .c2 { width: 2ch; transform: scale(1.12); }
  .prompt { margin-top: 10px; border: 1px solid #4a4a50; border-radius: 6px; padding: 4px 12px; color: ${WHITE}; }
  .hint { color: #6a6a70; padding: 6px 12px 0; }
`

function windowHtml(scene: Scene, tree: Node): string {
  return `<div class="win">
    <div class="bar"><div class="dot" style="background:#ff5f57"></div><div class="dot" style="background:#febc2e"></div><div class="dot" style="background:#28c840"></div><div class="title">${esc(scene.title)}</div></div>
    <div class="body">${scene.lines.map(lineHtml).join('')}<div class="band">${nodeHtml(tree)}</div><div class="prompt">&gt; </div><div class="hint">? for shortcuts</div></div>
  </div>`
}

async function main() {
  const mods = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES)
  const browser = await chromium.launch({ executablePath: findChromium() })
  try {
    for (const mod of mods) {
      const scenes = SCENES[mod]
      if (!scenes) throw new Error(`no scenes for ${mod}`)
      const trees = drawTrees(mod)
      for (const [name, scene] of Object.entries(scenes)) {
        const tree = trees[name]
        if (!tree) throw new Error(`${mod}: the shot test printed no ${name}`)
        const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 900 } })
        await page.setContent(`<html><head><style>${CSS}</style></head><body><div id="card">${windowHtml(scene, tree)}</div></body></html>`)
        await page.evaluate(() => document.fonts.ready)
        await page.locator('#card').screenshot({ path: join(ROOT, 'claude-code', mod, scene.out) })
        await page.close()
        console.log(`${mod}: ${scene.out}`)
      }
    }
  } finally {
    await browser.close()
  }
}

await main()
