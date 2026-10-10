<div align="center">

# hud：Claude Code 状态栏 HUD

**简体中文** · [English](README.en.md)

</div>

把 [claude-hud](https://github.com/jarrodwatts/claude-hud) 0.10.0 改成了 Claude Code mod：模型、项目、git、上下文、用量、正在跑的工具、子代理和待办，都集中在输入框旁边。可以放在输入框上方，也可以放在下方原来状态栏的位置。在 claude-hud 的基础上，还加了额度预警、用量耗尽预测、每日预算、一行任务摘要、详情面板，以及 12 套随时切换的主题。

![hud：neon 主题](assets/themes/neon.png)

## 功能

- claude-hud 原有的信息都在：模型和推理强度、项目和 git 分支及改动、上下文和用量进度条、正在跑的工具、子代理和待办。
- 提前预警：上下文或额度到你设定的百分比时弹提示；按当前速度估算额度何时用完（5 小时额度按最近一小时的速度算）；Fable 这类按模型单独计的周额度也显示出来，同样预警和预测；距自动压缩还剩多少 token；提示缓存过期后，提醒下一条消息要重新写入多少 token；某一轮让上下文涨得特别多时，显示涨了多少和最近几轮的迷你柱状图（如 `上一轮 +98k ▂▁█`），一眼看出是哪一轮把上下文撑大的；未提交的改动或未推送的提交太多时提醒。
- 花费：今天的花费对比每日预算，近 7 天花费的迷你折线图。
- 一行任务摘要，以及 `/hud detail` 详情面板：每个工具的调用次数和耗时、最近几轮的用时、花费和上下文增长、子代理、待办、今天和本周的花费。
- 12 套主题：科技霓虹、彩虹渐变、emoji、带颜文字看板娘的动漫风（樱花、猫咪、机甲、热血）、Tokyo Night、黑客帝国、Nerd Font 和 powerline。
- 长任务结束提醒（macOS 可加提示音），以及远程控制的连接状态。

## 安装

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
```

它读取 claude-hud 自己的配置文件（`~/.claude/plugins/claude-hud/config.json` 和 `~/.claude/claude-hud.json`），已有的 claude-hud 设置可以直接沿用，`/claude-hud:configure` 也照常可用。

## 主题

用 `/hud theme <名字>` 立即切换；只输入 `/hud theme` 会弹窗选择（列出接下来的四套，其他主题可在 Other 里输入；关掉弹窗或在 `-p` 模式下，会列出全部主题和示例）；`/hud theme next` 换下一套，`/hud theme reset` 回到 `classic`。选择会写回 `/config` 的 `theme` 选项，以后的会话也会沿用。

| 主题 | 风格 |
| --- | --- |
| `classic` | claude-hud 原样 |
| `neon` | 赛博朋克：霓虹真彩色，`⬢ ◆ ◈ ⚡`，`▰▱` 进度条，` ❯ ` 分隔 |
| `rainbow` | 每个元素一种颜色，进度条和模型名是彩虹渐变 |
| `emoji` | `🤖 📂 🌿 🧠 ⚡ 📅 ⏳ ✅` |
| `sakura` | 樱花粉，`🌸 🎀 🍡 💗`，`✿` 进度条，颜文字看板娘 `(◕‿◕)♡` |
| `kawaii` | 马卡龙色，`「Opus」`，`●○` 进度条，猫咪看板娘 `ฅ^•ω•^ฅ` |
| `mecha` | 紫、绿、橙，`UNIT·Opus◤`，`SYNC` / `PWR` 仪表，机器人看板娘 `[•_•]` |
| `shonen` | 红橙金，`🔥 ⭐ 🍥 💥`，渐变进度条，热血看板娘 `(ง •̀_•́)ง` |
| `tokyo-night` | Tokyo Night 配色，图标克制 |
| `matrix` | 黑底绿字，`▮▯` 进度条，` ┊ ` 分隔 |
| `nerd` | Nerd Font 图标（需要 Nerd Font） |
| `powerline` | Nerd Font 图标加 powerline 色块（需要 Nerd Font） |

同一个示例会话在 12 套主题下的样子：[assets/themes/gallery.png](assets/themes/gallery.png)；每套主题的单图在 `assets/themes/<主题>.png`。

动漫风主题的看板娘会跟着状态变脸：平时很淡定，跑工具时忙碌，上下文到 70%（或额度到 90%）开始担心，85% 慌张，用量耗尽时直接晕倒。`showMascot` 可以关掉它。

- 配色：主题的颜色覆盖在 claude-hud 的 `colors` 之上；在 claude-hud 自己的配置里改过（不是默认值）的颜色保持不变。
- 宽度：图标由 claude-hud 绘制，换行时会计入它们的宽度；分隔符都不宽于 ` │ `；powerline 每行多占 2 列，从 claude-hud 和附加行可用的列数里扣除。emoji 只用默认即显示为 emoji 的字符（不带 U+FE0F）。
- 已知限制：claude-hud 靠开头的 `[` 把 `[模型 | 提供方]` 标记（Bedrock、Vertex）保持在一行；去掉方括号的主题失去这个保护，终端较窄时这类标记可能在 ` | ` 处折行。

## 命令

- `/hud`：显示或隐藏 HUD；`/hud off`、`/hud on` 直接设定（输入框底栏的 「HUD」按钮也一样）。
- `/hud theme [名字|next|reset]`：切换主题。
- `/hud detail`：打开或关闭详情面板。Claude 工作时也能用。

## 选项

在 `/config` 里修改，或写在 `~/.claude/settings.json` 的 `pluginConfigs` 里：

| 选项 | 作用 | 默认 |
| --- | --- | --- |
| `visible` | 显示 HUD | 开 |
| `footerButton` | 在输入框底栏显示 「HUD」开关按钮 | 开 |
| `position` | `above` 放在输入框上方，`below` 放在下方原状态栏的位置 | `above` |
| `theme` | 主题 | `classic` |
| `showMascot` | 动漫风主题显示颜文字看板娘 | 开 |
| `contextAlerts` | 上下文到这些百分比时提醒，逗号分隔，如 `80,90`；留空关闭 | 空 |
| `usageAlerts` | 5 小时或 7 天额度到这些百分比时提醒；留空关闭 | 空 |
| `showForecast` | 按当前速度会在重置前用完时，显示预计用完的时间 | 开 |
| `compactWarnPercent` | 上下文到达自动压缩阈值的这个百分比后，显示还剩多少 token；0 关闭 | 60 |
| `coldCacheTokens` | 提示缓存过期后，上下文至少有这么多 token 时，提醒下一条消息要重新写入多少；0 关闭 | 20000 |
| `turnGrowthTokens` | 一轮让上下文涨了至少这么多 token 时，显示涨幅和最近几轮的迷你柱状图；0 关闭 | 20000 |
| `dailyBudgetUsd` | 每日预算（美元），显示今天的花费对比；0 关闭 | 0 |
| `showHistory` | 显示近 7 天花费折线和连续使用天数 | 关 |
| `summaryEveryTurns` | 第一轮后和每隔几轮生成一行任务摘要（复用提示词缓存）；0 关闭 | 5 |
| `notifyAfterSeconds` | 一轮跑了这么多秒以上才在结束时提醒；0 关闭 | 0 |
| `notifySound` | 结束提醒带提示音（macOS） | 开 |
| `gitDirtyWarn` | 未提交的改动达到这么多个路径时提醒；0 关闭 | 20 |
| `gitAheadWarn` | 未推送的提交达到这么多个时提醒；0 关闭 | 5 |
| `showAgents` | 显示 claude-hud 的子代理行（Claude Code 自己已经会列出，默认关） | 关 |
| `extraCmd` | claude-hud 的 `--extra-cmd`：一条 shell 命令，输出作为一个标签（需要 `CLAUDE_HUD_ALLOW_EXTRA_CMD=1`） | 空 |
| `debug` | 注册 `mcp__hud__hud_debug` 调试工具 | 关 |

语言跟随 claude-hud 配置文件里的 `language`（`en`、`zh-Hans`、`zh-Hant`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`），mod 新加的预警、面板、`/hud` 回复和任务摘要也一起跟随。

## 同系列 mod

[hoobnn-agent-mods](../../README.md) 里还有任务进度条（`todo-bar`）、回合回执（`receipt`）、运行动画和宠物（`spinner`）、Tailscale 节点状态（`ts-band`）和一言（`hitokoto`），可以搭配使用。

## 开发

### 自行推算的字段

Claude Code 的状态栏 stdin 里有这些字段，mod API 没有，所以由 mod 自己推算：

- `prompt_cache`：计时从主线程最后一次请求开始（取自 `turn.step`，没有时取 transcript 里主线程最后一条响应），时长按最后一次写缓存用的 TTL（写的是 1 小时档时为 `1h`，否则 `5m`）。`hit_ratio` 是整个会话里主线程输入中读缓存的部分所占的比例。
- `model_scoped`（按模型单独计的周额度，如 Fable 的）：mod API 和状态栏都不提供，所以从 Claude Code 自己缓存的用量接口结果读取，即 `.claude.json` 里的 `cachedUsageUtilization`（文件变化时才重读，超过一小时的数据不用，与 Claude Code 自己的读取方式一致）。不发任何请求。claude-hud 把它们和 5 小时、7 天额度画在一起，附带消耗速度。
- `session_name`：transcript 里 `/rename` 起的标题，没有时用自动生成的标题，再没有时用 slug。
- `workspace.repo`：从 `$.session.repo()` 的远程 URL 解析。
- `output_style`：设置里的 `outputStyle`。
- 会话第一次请求模型之前，`current_usage` 用引擎给出的上下文总量（按未缓存计），推理强度用设置里的 `effortLevel`；两者都在第一个 `turn.step` 到达后更新，并保存在会话状态里，重新加载后仍在。
- `total_api_duration_ms` 只统计这个会话里 mod 启用之后看到的请求。

### 新增部分的细节

- 远程控制：会话开启远程控制时，第一行末尾显示 ` │ ⇄ 远程控制`，链接到 claude.ai 上的这个会话，后面按端列出已连接的客户端（`已连接 手机 · 网页/桌面×2`）。Claude App 和 claude.ai 不会触发 `session.attach`，所以通过远程控制发来的消息或命令会把状态标为 `已连接`，直到桥接变化。引擎把桥接记在 `~/.claude/sessions/<pid>.json` 的 `bridgeSessionId` 里（按会话 id 查找），mod API 不提供，所以每 3 秒读一次这个文件，有变化时重画 HUD；客户端和所在的端取自 `session.attach` / `session.detach`。
- 附加行：宽度够时接在 claude-hud 最后一行后面，不够时单独占一行放在下面；放不下的部分依次让出，先是主题的看板娘，然后是 7 天折线，最后是 `⚠` git 提醒。每一部分只在有内容时显示：
  - `✎` 一行任务摘要：第一轮之后以及每隔 `summaryEveryTurns` 轮，用 `$.model.fork` 分叉当前对话生成（命中提示词缓存）。transcript 里有未完成的任务清单时跳过（清单已经说明模型在做什么），旧的摘要这期间也先让开。
  - 用量预测（`showForecast`）：5 小时、7 天或按模型计的周额度在重置前会用完时，显示预计用完的时间：5 小时额度在会话有 10 分钟读数后按最近一小时的速度算，周额度按本周期开始以来的速度算。
  - 距自动压缩还剩的 token（`距自动压缩 42k`）：上下文到达阈值的 `compactWarnPercent` 后显示。阈值取自 Claude Code 自己（`$.session.usage({ breakdown: 'summary' })`），上下文窗口变化时重新读取。
  - 提示缓存过期（`缓存已过期，下条消息重写 120k`）：会话用过的缓存过期后，如果下一条消息要重新写入的上下文不少于 `coldCacheTokens`，显示这个量。
  - 上下文涨幅（`上一轮 +98k ▂▁█`）：上一轮让上下文至少涨了 `turnGrowthTokens` 时，显示涨了多少，后面是最近 8 轮涨幅的迷你柱状图（压缩那一轮按 0 计）。灵感来自 token-weather 的逐轮图表。
  - 今天所有会话的花费对比 `dailyBudgetUsd`，数据来自 claude-hud 的每日花费账本；到 80% 变黄，超出变红。
  - 近 7 天花费的迷你折线和连续使用天数（`showHistory`）；无论是否显示，花费都会在 mod 的存储里保留 60 天。
  - `⚠` 未提交的路径数达到 `gitDirtyWarn`、未推送的提交数达到 `gitAheadWarn` 时提醒。
- 预警：上下文用量到达 `contextAlerts` 里的每个百分比、5 小时、7 天或按模型计的周额度到达 `usageAlerts` 里的每个百分比时弹 toast；每个阈值只提醒一次，读数回落到阈值以下 5 个百分点（如 `/compact` 或额度重置）后才会再次提醒。
- 结束提醒：主线程的一轮跑了 `notifyAfterSeconds` 秒或更久时，结束时弹 toast，开启 `notifySound` 时再响一声（macOS）。
- `/hud detail` 面板：本会话每个工具的调用次数、总耗时、平均耗时和失败数；最近 8 轮的用时、花费和上下文增长；子代理；待办；今天和本周的花费。
- 及时重画：压缩完成后立即重画；`/model` 之后也会重画（在新模型第一次请求之前就显示它）。
- 相对 claude-hud 的显示调整：` │ ` 和 ` | ` 分隔符调暗；正在跑的工具涉及的文件显示为相对会话目录的路径（`◐ Read src/a.ts`）；会话时长显示为 `⏱ 12m`，提示缓存显示为 `缓存 至 14:05`，不用占两列宽的 `⏱️`。

### 没有移植的部分

- OSC 8 `file://` 链接（项目路径）：`Link` 只接受 https，所以保留文字、去掉链接。https 链接（GitHub 分支）仍可点击。
- `worktree`（`--worktree` 会话的名称、路径和分支）：mod API 不提供。

### 目录结构

- `hooks/register.tsx`：钩子，以及所有调用 `$` 的代码（引擎只在这个文件内追踪 `$`）：会话开始、回合事件、`/hud`、刷新循环、预警、花费和摘要，以及渲染钩子。其他模块拿到的是包住 `$` 的闭包（`Io`、`SessionApi`）。
- `hooks/config.ts`：mod 的选项，一次性读成类型化的 `Config`。
- `hooks/stdin.ts`：根据会话（用量、设置、仓库、回合步骤）和 transcript 拼出 claude-hud 需要的状态栏 stdin；以及 claude-hud 读取的宿主信息（环境变量、平台、内存）。
- `hooks/render.ts`：一次渲染：claude-hud 的各行、远程控制标签、今天的花费；git 提醒用到的计数。
- `hooks/remote.ts`：远程控制的桥接（取自 `sessions/<pid>.json`）和它的标签。
- `hooks/summary.ts`：任务摘要的回复，整理成一行。
- `hooks/draw.tsx`：根据渲染钩子解析出的元素绘制各行（输入框上方或下方）和 `/hud detail` 面板。
- `hooks/live.ts`：模块在两次渲染之间、`$.state` 以外保存的东西（重新加载后还能找回的缓存、横条宽度、调试工具最近一次的结果）和当前主题。
- `hooks/kit/`：`claude-code/kit` 的副本（选项读取、写回 `/config`）；改源文件后运行 `scripts/sync-kit.sh`。
- `hooks/transcript-feed.ts`：为整个 mod 统一读取 transcript，只读一次、之后增量读取（只读新追加的行，按文件大小判断）。每一行都交给 claude-hud 自己的 `Parser`，也交给一个小读取器，用来补上 `$` 不提供的 stdin 字段：`session_name` 和 `prompt_cache`。
- `hooks/hud/`：claude-hud 的 `src/`（MIT，见 `LICENSE.claude-hud`），尽量贴近上游。本地改动：
  - `index.ts`：`main(source)` 从 mod 接收 stdin；错误和配置提示交给渲染输出；去掉了作为脚本运行的代码块。
  - `render/index.ts`：各行输出到 sink（`setRenderSink`、`emitLine`），不再用 `console.log`。
  - `i18n/`：在 `types.ts`、`index.ts` 和新文件里多了七种语言（`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`，另有别名 `pt`）；导出 `getCanonicalLanguage`；`isCjkLanguage` 也把 `ja` 和 `ko` 算进去。`config.ts` 的 `LANGUAGES` 列出了它们。
  - `config.ts`：`setConfigPatch` 把 mod 的选项叠加到已读取的配置上（除非 mod 的 `showAgents` 选项打开，否则 `showAgents` 关闭）。
  - `render/parts.ts`：`countLabel` 允许某种语言把数量写成 `Regeln: 3`（`{n}` 模板），避免 `3 Regeln` 这种需要复数变化的写法。
  - `transcript.ts`：导出 `Parser`，并通过 `setTranscriptProvider` 让 mod 接管 `parseTranscript`。
  - `git-runner.ts`：git 通过 `$.process.run` 运行；去掉了 Windows worker。
  - `config.ts`：限长读取配置改为一次 `readFileSync`；O_NOFOLLOW 改为 lstat 检查。
  - `render/theme.ts`（新增）：claude-hud 输出的符号（`[` `]`、`git:(`、`◐ ✓ ▸`、`⚠ ▲`、`⏱`、`↑↓`、`⎇`）以及 Context、Usage、Weekly、缓存和花费标签前的图标，在 `parts.ts`、`vcs.ts`、`activity.ts`、`usage.ts`、`lines.ts`、`labels.ts` 和 `colors.ts` 里通过 `glyph()` / `iconLabel()` 读取。默认值与上游一致，不调用 `setGlyphs` 时输出不变。
  - `claude-config-dir.ts`：`getHudCacheDir`（`plugins/claude-hud-mod`），供 `speed.ts` 和 `daily-cost.ts` 使用，缓存不会和状态栏版的 claude-hud 冲突。
- `hooks/shims/`：claude-hud 引用的 Node API，基于 `$` 实现。同步读取直接用渲染前取好的数据回答；没取到的先去取，再重跑这次渲染（`host.ts`）。写入先暂存，渲染完成后一次写出。
- `hooks/ansi.ts`：把 SGR 转义序列转成带样式的片段。
- `hooks/i18n.ts`：mod 自己的文案，覆盖 claude-hud 支持的所有语言，复数形式、金额和百分比按各语言习惯书写。
- `hooks/themes.ts`：各主题（配色、图标、分隔符、附加行颜色、powerline、渐变、看板娘），以及应用它们的片段效果。
- `hooks/extras.ts`：mod 新增内容的纯函数：阈值、用量预测、花费历史、git 计数、附加行和提示音。

### 从上游同步

把新的 `src/` 覆盖到 `hooks/hud/`（不要 `windows-git-worker.ts`），把 `node:*` 的 import 改指向 `../shims/*.js`（`node:fs/promises` 指向 `fs_promises.js`），重新应用上面列出的改动（新出现的硬编码符号也改走 `render/theme.ts`），然后在仓库根目录运行 `scripts/check.sh claude-code/hud`。要和上游对比，把 `mcp__hud__hud_debug` 报告的 stdin 喂给 `node <claude-hud>/dist/index.js`。
