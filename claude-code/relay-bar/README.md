<div align="center">

# relay-bar

agent-relay 派活进度条。

**简体中文** · [English](README.en.md)

</div>

Claude 通过 [agent-relay](https://github.com/hoobnn/hoobnn-skills/tree/main/plugins/agent-relay) 把活派给 grok、codex、pi 等别家 agent 时，终端里平常只看得到一个转圈的 Bash 调用。装上 relay-bar 后，那条 Bash 调用下面每家 agent 占一行，显示它正在做什么，跑完留下结果；`/relay` 还能打开面板看它的思考、工具调用和回答。它只读 agent-relay 自己写的进度文件，不额外消耗 token。

```text
● codex  gpt-5.5·high  2m 10s  ⚙ Edit src/relay.ts                 工具 7/8
● grok                 48s     ∴ 先确认调用方有没有处理空列表
✓ pi                   1m 3s   完成 · 改了 2 个文件
```

## 功能

- 跟着发起它的调用走：主线程前台派的活，画在对话记录里那条 Bash 调用的下面，跑完后结果留在那里；后台派的（`run_in_background`）和子代理派的，主对话里看不到那条调用，就显示在输入框上方，结束 10 秒后收起（子代理的那条调用下面同样会显示）。这样不和其他 mod 抢输入框上方的位置。
- 每家一行：标记、agent 名、模型和推理强度、已用时间，后面跟它正在做的事（`⚙` 工具调用、`∴` 思考的最后一句、`›` 回答），以及工具调用的完成数。输入框上方最多 4 行，再多的合成一行「还有 N 个」。
- 结束提示：完成时显示改了几个文件，失败时显示报错的第一行，对方反问时显示「在等回答」；同时弹一个 toast。
- `/relay` 面板：本会话最近 10 次派活排成一排，点哪个看哪个；显示它的模型、用时、收到的 prompt，以及最近的思考、工具调用和回答。点横条上的 agent 名也能打开面板。
- 进程意外消失（被杀、电脑睡眠）、90 秒没有更新的派活会标成「进程已不在」。
- 零 token、零干扰：只在 Bash 命令里出现 `relay.py run` 或 `relay.py check` 时开始每秒读一次进度文件，派活全部结束就停止；不注册工具，不往系统提示词里加内容，也不改任何调用。

## 安装

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install relay-bar@hoobnn-agent-mods
```

还需要 agent-relay 支持写进度文件（`status.json`，hoobnn-skills 里的 agent-relay 已支持）。

## 命令

- `/relay`：打开派活面板。
- `/relay off`、`/relay on`：隐藏或显示横条。这个设置会写回 `/config`，以后的会话也会沿用。

## 选项

在 `/config` 里修改，或写在 `~/.claude/settings.json` 的 `pluginConfigs` 里：

| 选项 | 作用 | 默认 |
| --- | --- | --- |
| `visible` | 显示横条（`/relay off` / `on` 改的就是它） | 开 |
| `toast` | 派活结束、失败或对方反问时弹出 toast | 开 |
| `language` | 界面语言：`auto`、`en`、`zh-Hans`、`zh-Hant`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru` | `auto` |

`language` 为 `auto` 时，依次跟随 Claude Code 的 `language` 设置和系统语言环境，都没有时用英语。

## 它读的是什么

agent-relay 的每次运行在 `$XDG_STATE_HOME/agent-relay/runs/`（默认 `~/.local/state/agent-relay/runs/`）下有一个目录，`relay.py` 在 agent 工作期间大约每秒重写一次其中的 `status.json`，结束时再写一次最终状态：

```json
{"v": 1, "cli": "codex", "model": "gpt-5.5", "effort": "high", "pid": 12345, "cwd": "/repo",
 "prompt": "前 200 字", "started": 1761700000.0, "updated": 1761700130.0,
 "state": "starting | running | done | failed | asked", "session_id": "…", "caller_session": "…",
 "tools": {"done": 7, "total": 8},
 "steps": [{"type": "thought", "text": "…"}, {"type": "tool", "title": "Edit src/x.ts", "kind": "edit", "status": "in_progress"}],
 "ok": true, "error": null, "files_changed": 3, "ended": 1761700135.0}
```

`steps` 只带最近 40 步，每步文本截到 600 字；`ok` 及之后的字段只在结束时出现。relay-bar 只读派活开始后新建的目录，并跳过 `caller_session`（发起派活的 Claude Code 会话，取自 `CLAUDE_CODE_SESSION_ID`）不是本会话的那些，所以同一时刻别的会话在派活也不会混进来；子代理派的活和本会话同一个 ID，照常显示。旧版 relay.py 没有这个字段、或这一秒取不到本会话 ID 时，仍按时间收进来。

## 同系列 mod

[hoobnn-agent-mods](../../README.md) 里还有状态栏 HUD（`hud`）、任务进度条（`todo-bar`，显示 Claude 自己派出的子代理）、回合回执（`receipt`）、运行动画和宠物（`spinner`）、Tailscale 节点状态（`ts-band`）和一言（`hitokoto`），可以搭配使用。

## 开发

- `hooks/register.tsx`：钩子（发现 relay 调用后开始轮询、`/relay` 命令、横条和面板）。
- `hooks/runs.ts`：解析 `status.json`、合并本会话的派活、生成横条和面板要显示的文字。
- `hooks/config.ts`：选项，一次性读成类型化的 `Config`。
- `hooks/i18n.ts`：各语言文案。
- `hooks/kit/`：`claude-code/kit` 的副本；改源文件后运行 `scripts/sync-kit.sh`。
