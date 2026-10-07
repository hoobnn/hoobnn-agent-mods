# hoobnn-agent-mods：Claude Code mod 合集（状态栏 HUD、任务进度条、运行动画）

**简体中文** · [English](README.en.md)

让 Claude Code 的终端更好用、也更好看的六个 mod：状态栏 HUD、任务进度条、回合回执、运行动画和宠物、Tailscale 节点状态、一言。每个都能单独安装，装上就能用，设置都在 `/config` 里。仓库里也放了给其他编程 Agent 工具写的扩展，按工具分目录。

| 目录 | 对应工具 | 放什么 |
| --- | --- | --- |
| `claude-code/` | [Claude Code](https://code.claude.com) | mod（函数钩子插件），每个子目录都能用 `claude --plugin-dir` 单独加载；`kit/` 例外，放各 mod 共用的代码 |
| `pi/` | [pi](https://github.com/badlogic/pi-mono) | 扩展 |
| `deepseek/` | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | `dsh` 插件 |
| `shared/` | 不限 | 多个工具的移植版都要用到的逻辑 |
| `scripts/` | | 检查脚本和本地安装辅助脚本 |

## Claude Code mod

| Mod | 作用 |
| --- | --- |
| [`hud`](claude-code/hud) | 状态栏 HUD：模型、git、上下文、用量、工具和待办一目了然；额度预警（含 Fable 等按模型的周额度）、耗尽预测、缓存过期提醒、单轮上下文涨幅、每日预算、任务摘要、`/hud detail` 详情面板，12 套主题随时切换 |
| [`ts-band`](claude-code/ts-band) | Tailscale 节点状态：全部直连时只占一个小标记，有节点走中继或离线时才列出来，上线 / 掉线弹提示 |
| [`hitokoto`](claude-code/hitokoto) | 输入框上方的一句[一言](https://hitokoto.cn)和出处，可以定时换、每天一句、每个会话或每次发消息换一句 |
| [`spinner`](claude-code/spinner) | 运行动画和宠物伴侣：像素风小剧场（雷霆战机、Clawd、吃豆人、彩虹猫、系统音频频谱等 15 套主题），宠物跟着 Claude 的动作变换姿势、会升级，一轮结束放彩带 |
| [`todo-bar`](claude-code/todo-bar) | 任务进度条：正在做哪一项、做了多久、完成了多少，派出的子代理在干什么；只读 TodoWrite / Task 工具的结果，不花 token |
| [`receipt`](claude-code/receipt) | 回合回执：一轮结束后用一行说明改了几个文件、增删多少行、跑了几条命令、几条失败，改了代码没跑测试会标出来，还能逐处回放每次改动的 diff；Claude 原地打转时提醒，不花 token |

从本仓库的插件市场安装：

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
claude plugin install hitokoto@hoobnn-agent-mods
claude plugin install spinner@hoobnn-agent-mods
claude plugin install todo-bar@hoobnn-agent-mods
claude plugin install receipt@hoobnn-agent-mods
```

选项（`hud` 的 `position`、`theme`、`dailyBudgetUsd`、`summaryEveryTurns`，`ts-band` 的 `nodes`、`hideOffline`，`hitokoto` 的 `refreshMode`、`categories`，`spinner` 的 `theme`、`stage`、`celebrate`、`companion` 等）都能在 `/config` 里改，也可以写在 `~/.claude/settings.json` 的 `pluginConfigs` 里。`/config` 是 mod 设置的唯一归处：斜杠命令改的设置（`/hud theme neon`、`/ts off`、`/spinner stage off`）都写回这里；每个 mod 都有 `visible` 选项，`/hud`、`/ts`、`/hitokoto`、`/spinner`、`/todos`、`/receipt` 的 `off` / `on` 改的就是它。每个 mod 的完整说明见各自目录下的 README。

`spinner` 的效果（`clawd` 主题跑完一轮，宠物伴侣的气泡跟着工具变化，最后放庆祝动画；15 套主题的动图见 [`claude-code/spinner`](claude-code/spinner)）：

![spinner clawd 主题](claude-code/spinner/assets/clawd.gif)

![spinner 雷霆战机主题](claude-code/spinner/assets/thunder.gif)

其他 mod 的效果（截图都由 mod 自己真实画出的内容渲染）：

| `hud`（`neon` 主题，12 套主题总览见 [gallery.png](claude-code/hud/assets/themes/gallery.png)） |
| --- |
| ![hud neon 主题](claude-code/hud/assets/themes/neon.png) |

| `todo-bar` | `receipt` |
| --- | --- |
| ![todo-bar 任务进度条](claude-code/todo-bar/assets/preview.png) | ![receipt 回合回执](claude-code/receipt/assets/preview.png) |
| `ts-band` | `hitokoto` |
| ![ts-band Tailscale 节点状态](claude-code/ts-band/assets/preview.png) | ![hitokoto 一言](claude-code/hitokoto/assets/preview.png) |

这些 mod 都支持英语、简体中文、繁体中文、日语、韩语、西班牙语、法语、德语、巴西葡萄牙语和俄语。`hud` 跟随 claude-hud 配置里的 `language`；`ts-band`、`hitokoto`、`spinner`、`todo-bar` 和 `receipt` 有各自的 `language` 选项，默认 `auto`，依次跟随 Claude Code 的 `language` 设置、系统语言环境，都没有时用英语。

### 开发

- 用工作副本覆盖已安装的版本：`claude --plugin-dir claude-code/<mod>`。会监听文件，保存后钩子模块自动重新加载。
- 每个 mod 在 `hooks/config.ts` 里一次性读出选项（类型化的 `Config`）；`hooks/register.tsx` 放钩子和所有调用 `$` 的代码（引擎只在这个文件内追踪 `$`）。
- 各 mod 共用的代码放在 `claude-code/kit/`（语言解析、选项读取、横条叠放、写回 `/config`）。安装后的 mod 读不到自己目录以外的文件，所以由 `scripts/sync-kit.sh` 把每个 mod 用到的 kit 文件复制进它的 `hooks/kit/`：改 `claude-code/kit/`，再跑一遍脚本；副本过期时 `scripts/check.sh` 会报错。
- `scripts/check.sh` 先检查 kit 副本，再校验、测试并类型检查所有 mod，并按 [awesome-claude-code-mods](https://github.com/karanb192/awesome-claude-code-mods) 的规则列出每个 mod 的触及范围（L0 只绘制、L1 读取、L2 写入或运行、L3 联网）；超过 `scripts/reach.txt` 里给它定的等级就报错。mod API 还在早期阶段，Claude Code 升级后也跑一遍。`tsc` 需要的类型文件由 Claude Code 在第一次加载 mod 时放进 `.claude-plugin/types/`。
- `bun scripts/spinner-shots.ts` 用 `spinner` 自己的帧表重新渲染它的 GIF 和静态图（需要 ffmpeg 和 Playwright 的 Chromium）。
- `bun scripts/mod-shots.ts [<mod> ...]` 重新渲染 `ts-band`、`hitokoto`、`todo-bar`、`receipt` 的预览图：把 `scripts/shots/<mod>.tsx` 临时放进该 mod 的 `tests/` 跑一遍，取出横条真实画出的元素树，再套上终端窗口截图（需要 Playwright 的 Chromium）。
- 发布：把 mod 的 `plugin.json` 和 `.claude-plugin/marketplace.json` 里对应条目的 `version` 改掉，提交，然后执行 `claude plugin tag claude-code/<mod> --push`（tag 格式是 `<mod>--v<version>`）。已安装的用户执行 `claude plugin marketplace update hoobnn-agent-mods && claude plugin update <mod>@hoobnn-agent-mods` 更新。

## 许可

MIT。`claude-code/hud/hooks/hud` 是 claude-hud 的源码，沿用它自己的 MIT 许可（见 `claude-code/hud/LICENSE.claude-hud`）。
