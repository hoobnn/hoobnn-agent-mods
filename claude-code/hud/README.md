# hud：Claude Code 状态栏 HUD

**简体中文** · [English](README.en.md)

把 [claude-hud](https://github.com/jarrodwatts/claude-hud) 0.10.0 改成了 Claude Code mod：模型、项目、git、上下文、用量、正在跑的工具、子代理和待办，都集中在输入框旁边。可以放在输入框上方，也可以放在下方原来状态栏的位置。在 claude-hud 的基础上，还加了额度预警、用量耗尽预测、每日预算、一行任务摘要、详情面板，以及 12 套随时切换的主题。

![hud：neon 主题](assets/themes/neon.png)

## 功能

- **claude-hud 原有的信息都在**：模型和推理强度、项目和 git 分支及改动、上下文和用量进度条、正在跑的工具、子代理和待办。
- **提前预警**：上下文或额度到你设定的百分比时弹提示；按当前速度估算额度何时用完（5 小时额度按最近一小时的速度算）；Fable 这类按模型单独计的周额度也显示出来，同样预警和预测；距自动压缩还剩多少 token；提示缓存过期后，提醒下一条消息要重新写入多少 token；某一轮让上下文涨得特别多时，显示涨了多少和最近几轮的迷你柱状图（如 `上一轮 +98k ▂▁█`），一眼看出是哪一轮把上下文撑大的；未提交的改动或未推送的提交太多时提醒。
- **花费**：今天的花费对比每日预算，近 7 天花费的迷你折线图。
- **一行任务摘要**，以及 `/hud detail` 详情面板：每个工具的调用次数和耗时、最近几轮的用时、花费和上下文增长、子代理、待办、今天和本周的花费。
- **12 套主题**：科技霓虹、彩虹渐变、emoji、带颜文字看板娘的动漫风（樱花、猫咪、机甲、热血）、Tokyo Night、黑客帝国、Nerd Font 和 powerline。
- **长任务结束提醒**（macOS 可加提示音），以及远程控制的连接状态。

## 安装

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
```

它读取 claude-hud 自己的配置文件（`~/.claude/plugins/claude-hud/config.json` 和 `~/.claude/claude-hud.json`），已有的 claude-hud 设置可以直接沿用，`/claude-hud:configure` 也照常可用。

## 主题

用 `/hud theme <名字>` 立即切换；只输入 `/hud theme` 会弹窗选择；`/hud theme next` 换下一套，`/hud theme reset` 回到 `classic`。选择会写回 `/config` 的 `theme` 选项，以后的会话也会沿用。

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

## 命令

- `/hud`：显示或隐藏 HUD；`/hud off`、`/hud on` 直接设定（输入框底栏的 **HUD** 按钮也一样）。
- `/hud theme [名字|next|reset]`：切换主题。
- `/hud detail`：打开或关闭详情面板。Claude 工作时也能用。

## 选项

在 `/config` 里修改，或写在 `~/.claude/settings.json` 的 `pluginConfigs` 里：

| 选项 | 作用 | 默认 |
| --- | --- | --- |
| `visible` | 显示 HUD | 开 |
| `footerButton` | 在输入框底栏显示 **HUD** 开关按钮 | 开 |
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

和 claude-hud 的差异、mod 自行推算的字段、目录结构和从上游同步的步骤，见 [英文 README](README.en.md#development)。
