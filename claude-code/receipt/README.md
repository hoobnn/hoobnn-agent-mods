<div align="center">

# receipt：Claude Code 回合回执

**简体中文** · [English](README.en.md)

</div>

Claude 每轮回复结束后，输入框上方会留下一行回执：改了几个文件、增删多少行、跑了几条命令、有几条失败。不用翻记录，就知道这一轮做了什么。Claude 原地打转时还会弹提示。全程不消耗 token。

![receipt：上一轮改了什么、跑了什么、读了什么](assets/preview.png)

```text
✓ 上一轮 2m 13s · 改动 3 个文件 +48 −12 · 命令 6 · 1 失败 · 读取 14 · 子代理 1 · ⚠ 1
```

## 功能

- 一行回执：先显示这一轮怎么结束的（`✓` 正常回答、`◼` 被中断、`✗` 出错）和用时，再列出有内容的几项：改动的文件和增删行数、执行的命令和失败数、读取次数（`Read`、`Grep`、`Glob`）、开了几个子代理、产生了几条预警。
- 子代理也算：子代理改的文件和跑的命令都计入开启它的这一轮。
- 不打扰：没用工具的纯聊天轮不留回执，下一轮开始时回执自动收起；输入框弹出 `/` 或 `@` 选择器时也会让开。
- 改了没验证就标出来：这一轮最后一次改代码之后没有跑过测试、构建、lint 或类型检查（或者根本没跑），回执末尾显示黄色的「未验证」，`/receipt` 里也会写明。只改 Markdown、纯文本这类文档不算。识别 `npm test`、`pytest`、`go test`、`cargo check`、`tsc`、`eslint`、`make`、`bash scripts/check.sh` 等常见写法，包括 `uv run`、`npx` 这类前缀。
- 逐处回放改动：回执末尾有「回放」按钮（`ctrl+x` `Tab` 聚焦横条后按 `r`），也可以输入 `/receipt replay`，打开面板逐处查看这一轮每次编辑的 diff：文件、增删行数、从第几行开始改，`n` / `p` 前后翻，`c` 或 `Esc` 关闭。diff 取自编辑实际执行后的结果，被拒绝或失败的编辑不会出现；子代理的编辑也在里面。每轮最多记录前 50 处，每处最多 120 行。
- 原地打转提醒：这一轮进行中，出现下面两种情况会弹 toast，每段连续只提醒一次：
  - 同一个调用连续失败 `repeatFailures` 次（默认 3），中间没有任何改动。编辑文件或跑了会改东西的命令（如 `sed -i`、`npm install`）算在推进，计数重来；`cat`、`ls` 这类只读命令不算。
  - 同一个文件被改回之前的样子，达到 `flipFlops` 次（默认 2）。
- 零 token：只在工具调用执行完后读取结果（Edit、Write、NotebookEdit 统计文件；有 git 行数用 git 的，没有就按补丁算；Bash 统计命令），不注册工具，不加提示词，不拦截调用。

## 安装

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install receipt@hoobnn-agent-mods
```

## 命令

- `/receipt`：完整列出上一轮的回执：每个文件的增删行数（新建的文件标「新建」）、每条失败的命令、每条预警。
- `/receipt replay`：打开回放面板，逐处查看上一轮每次编辑的 diff。
- `/receipt off`、`/receipt on`：隐藏或显示回执。这个设置会写回 `/config`，以后的会话也会沿用。

## 选项

在 `/config` 里修改，或写在 `~/.claude/settings.json` 的 `pluginConfigs` 里：

| 选项 | 作用 | 默认 |
| --- | --- | --- |
| `visible` | 两轮之间在输入框上方显示回执 | 开 |
| `repeatFailures` | 同一调用连续失败几次后提醒；0 关闭 | 3 |
| `flipFlops` | 同一文件来回改几次后提醒；0 关闭 | 2 |
| `flagUnverified` | 最后一次改代码之后没跑测试、构建或检查时，回执标「未验证」 | 开 |
| `language` | 界面语言：`auto`、`en`、`zh-Hans`、`zh-Hant`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru` | `auto` |

`language` 为 `auto` 时，依次跟随 Claude Code 的 `language` 设置和系统语言环境，都没有时用英语。

## 同系列 mod

[hoobnn-agent-mods](../../README.md) 里还有任务进度条（`todo-bar`）、状态栏 HUD（`hud`）、运行动画和宠物（`spinner`）、Tailscale 节点状态（`ts-band`）和一言（`hitokoto`），可以搭配使用。

## 开发

- `hooks/register.tsx`：钩子（会话开始时的语言和 `/receipt`，回合开始与结束，读取工具调用，命令和横条）。
- `hooks/ledger.ts`：根据每次调用的内容生成回执，以及两条打转规则。
- `hooks/config.ts`：选项，一次性读成类型化的 `Config`。
- `hooks/i18n.ts`：各语言文案。
- `hooks/kit/`：`claude-code/kit` 的副本；改源文件后运行 `scripts/sync-kit.sh`。
