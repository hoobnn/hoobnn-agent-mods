# todo-bar：Claude Code 任务进度条

**简体中文** · [English](README.en.md)

Claude 列出任务清单后，输入框上方会出现一条进度条：现在做到哪一项、这一项做了多久、总共完成了多少，一眼就能看到。它只读 Claude 本来就会发出的工具调用，不额外消耗 token。

![todo-bar：正在进行的任务、已用时间、进度条和接下来的任务](assets/preview.png)

## 功能

- **进度一目了然**：第一行是正在做的任务、进度条、完成数和百分比，第二行列出接下来的一两项。
- **任务计时**：一项任务做满 1 分钟后，后面会显示已用时间（如 `3m 12s`）；超过 `slowMinutes`（默认 10 分钟）变成黄色，卡住的步骤一眼就能看出来。
- **子代理在做什么**：Claude 派出子代理时，正在进行的任务下面每个子代理占一行：类型、任务描述、正在用的工具，跑满 1 分钟后显示已用时间。子代理结束就收起，最多列 3 行，再多的合成一行「还有 N 个子代理」。`showAgents` 可以关掉。
- **完成提示**：全部完成后进度条变绿，显示整份清单的总用时，8 秒后自动收起；Claude 再列新清单时会重新出现。
- **零 token、零干扰**：只在 `TodoWrite`、`TaskCreate`、`TaskUpdate` 执行完之后读取结果，不注册工具，不往系统提示词里加内容，也不拦截任何调用。被拒绝或失败的调用不计入，子代理自己的清单也不显示。
- **恢复会话不丢进度**：每个会话的清单都会保存，恢复会话后进度条还在。
- 输入框弹出 `/` 或 `@` 选择器时，进度条会暂时让开。

![todo-bar：全部任务完成](assets/done.png)

## 安装

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install todo-bar@hoobnn-agent-mods
```

## 命令

- `/todos`：列出全部任务和状态（`✓` 已完成、`●` 进行中、`○` 等待中），以及每项的用时、期间的工具调用次数和派出的子代理数，例如 `✓ 编写测试  5m 20s · 工具调用 14 次 · 子代理 2 个`。
- `/todos off`、`/todos on`：隐藏或显示进度条。这个设置会写回 `/config`，以后的会话也会沿用。

## 选项

在 `/config` 里修改，或写在 `~/.claude/settings.json` 的 `pluginConfigs` 里：

| 选项 | 作用 | 默认 |
| --- | --- | --- |
| `visible` | 显示进度条（`/todos off` / `on` 改的就是它） | 开 |
| `showNext` | 第二行显示接下来的一两项任务 | 开 |
| `showAgents` | 正在进行的任务下面列出还在运行的子代理 | 开 |
| `slowMinutes` | 当前任务做了多少分钟后时间变黄；0 表示不变色 | 10 |
| `language` | 界面语言：`auto`、`en`、`zh-Hans`、`zh-Hant`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru` | `auto` |

`language` 为 `auto` 时，依次跟随 Claude Code 的 `language` 设置和系统语言环境，都没有时用英语。

## 同系列 mod

[hoobnn-agent-mods](../../README.md) 里还有状态栏 HUD（`hud`）、回合回执（`receipt`）、运行动画和宠物（`spinner`）、Tailscale 节点状态（`ts-band`）和一言（`hitokoto`），可以搭配使用。

## 开发

- `hooks/register.tsx`：钩子（会话开始时的语言、`/todos` 和已保存的清单，读取工具调用，命令和横条）。
- `hooks/board.ts`：根据每次调用的内容生成进度条要画的清单。
- `hooks/config.ts`：选项，一次性读成类型化的 `Config`。
- `hooks/i18n.ts`：各语言文案。
- `hooks/kit/`：`claude-code/kit` 的副本；改源文件后运行 `scripts/sync-kit.sh`。
