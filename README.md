# hoobnn-agent-mods：Claude Code 状态栏 HUD 与插件

**简体中文** · [English](README.en.md)

我给几个编程 Agent 工具写的 mod、扩展和插件，按工具分目录放。目前能用的主要是 Claude Code 的五个 mod：状态栏 HUD、Tailscale 节点状态条、一言、运行动画和任务进度条。

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
| [`hud`](claude-code/hud) | 把 [claude-hud](https://github.com/jarrodwatts/claude-hud) 0.10.0 改成 mod，显示模型、项目、git、上下文、用量、工具、子代理和待办，可以放在输入框上方或下方。另外加了：长任务结束提醒、上下文和额度预警、用量耗尽预测（5 小时额度按最近一小时的速度算）、距自动压缩还剩多少 token、每日预算、近 7 天花费、未提交改动提醒、一行任务摘要，`/hud detail` 详情面板（含最近几轮的用时、花费和上下文增长），以及 12 套可随时切换的主题（科技霓虹、彩虹渐变、emoji、樱花 / 猫咪 / 机甲 / 热血等带颜文字看板娘的动漫风、Nerd Font 与 powerline） |
| [`ts-band`](claude-code/ts-band) | 在输入框上方显示 Tailscale 节点状态：全部直连时只占一个短标记，有节点走中继 / DERP（黄）或离线（红）时只列出这些节点；节点上线或掉线时弹提示；Claude 执行 `tailscale up/down/switch` 等命令后立即刷新，读取失败时保留上次的节点 |
| [`hitokoto`](claude-code/hitokoto) | 在输入框上方显示一句[一言](https://hitokoto.cn)，可以定时换、每天一句、每个会话一句或每次发消息换一句，点后面的 ↻ 换一句 |
| [`spinner`](claude-code/spinner) | AI 运行时的动画和宠物伴侣：输入框上方放动画小剧场，有像素风的雷霆战机横版射击、Claude 的 Clawd、吃豆人、电气鼠、蓝色机器猫、彩虹猫，以及猫、兔子、樱花、机甲、霓虹、小恐龙、小鱼、字符雨；宠物伴侣参考 Codex Pets，按思考 / 调工具 / 输出切换动作，气泡只说 Spinner 行没有的信息（正在跑的工具、等你确认），空闲时留在输入框上方，Claude 跑测试或提交时会说一声（通过 / 没过 / 提交好了），多个子代理并行时显示数量；跑完一轮、测试通过、提交成功都涨经验升级，点它或 `/spinner pet` 摸摸会冒爱心；一轮结束放 3 秒彩带并显示用时；14 套主题，`/spinner` 随时切换和预览；`reducedMotion` 让所有动画只画静止的一帧，终端太矮或太窄时宠物缩成一行 |
| [`todo-bar`](claude-code/todo-bar) | 输入框上方的任务进度条：Claude 写任务清单（TodoWrite、TaskCreate / TaskUpdate）时出现，显示正在做的一项、进度条、完成数和百分比，第二行是接下来的一两项；全部完成后显示用时，几秒后收起。只读这些工具调用的结果，不注册工具、不加提示词、不拦任何调用，不花 token；`/todos` 列出全部任务 |

从本仓库的插件市场安装：

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
claude plugin install hitokoto@hoobnn-agent-mods
claude plugin install spinner@hoobnn-agent-mods
claude plugin install todo-bar@hoobnn-agent-mods
```

选项（`hud` 的 `position`、`theme`、`dailyBudgetUsd`、`summaryEveryTurns`，`ts-band` 的 `nodes`、`hideOffline`，`hitokoto` 的 `refreshMode`、`categories`，`spinner` 的 `theme`、`stage`、`celebrate`、`companion` 等）都能在 `/config` 里改，也可以写在 `~/.claude/settings.json` 的 `pluginConfigs` 里。`/config` 是 mod 设置的唯一归处：斜杠命令改的设置（`/hud theme neon`、`/ts off`、`/spinner stage off`）都写回这里；每个 mod 都有 `visible` 选项，`/hud`、`/ts`、`/hitokoto`、`/spinner`、`/todos` 的 `off` / `on` 改的就是它。每个 mod 的完整说明见各自目录下的 README（英文）。

`spinner` 的效果（`clawd` 主题跑完一轮，宠物伴侣的气泡跟着工具变化，最后放庆祝动画；14 套主题的动图见 [`claude-code/spinner`](claude-code/spinner)）：

![spinner clawd 主题](claude-code/spinner/assets/clawd.gif)

![spinner 雷霆战机主题](claude-code/spinner/assets/thunder.gif)

这些 mod 都支持英语、简体中文、繁体中文、日语、韩语、西班牙语、法语、德语、巴西葡萄牙语和俄语。`hud` 跟随 claude-hud 配置里的 `language`；`ts-band`、`hitokoto`、`spinner` 和 `todo-bar` 有各自的 `language` 选项，默认 `auto`，依次跟随 Claude Code 的 `language` 设置、系统语言环境，都没有时用英语。

### 开发

- 用工作副本覆盖已安装的版本：`claude --plugin-dir claude-code/<mod>`。会监听文件，保存后钩子模块自动重新加载。
- 每个 mod 在 `hooks/config.ts` 里一次性读出选项（类型化的 `Config`）；`hooks/register.tsx` 放钩子和所有调用 `$` 的代码（引擎只在这个文件内追踪 `$`）。
- 各 mod 共用的代码放在 `claude-code/kit/`（语言解析、选项读取、横条叠放、写回 `/config`）。安装后的 mod 读不到自己目录以外的文件，所以由 `scripts/sync-kit.sh` 把每个 mod 用到的 kit 文件复制进它的 `hooks/kit/`：改 `claude-code/kit/`，再跑一遍脚本；副本过期时 `scripts/check.sh` 会报错。
- `scripts/check.sh` 先检查 kit 副本，再校验、测试并类型检查所有 mod，并按 [awesome-claude-code-mods](https://github.com/karanb192/awesome-claude-code-mods) 的规则列出每个 mod 的触及范围（L0 只绘制、L1 读取、L2 写入或运行、L3 联网）；超过 `scripts/reach.txt` 里给它定的等级就报错。mod API 还在早期阶段，Claude Code 升级后也跑一遍。`tsc` 需要的类型文件由 Claude Code 在第一次加载 mod 时放进 `.claude-plugin/types/`。
- `bun scripts/spinner-shots.ts` 用 `spinner` 自己的帧表重新渲染它的 GIF 和静态图（需要 ffmpeg 和 Playwright 的 Chromium）。
- 发布：把 mod 的 `plugin.json` 和 `.claude-plugin/marketplace.json` 里对应条目的 `version` 改掉，提交，然后执行 `claude plugin tag claude-code/<mod> --push`（tag 格式是 `<mod>--v<version>`）。已安装的用户执行 `claude plugin marketplace update hoobnn-agent-mods && claude plugin update <mod>@hoobnn-agent-mods` 更新。

## 许可

MIT。`claude-code/hud/hooks/hud` 是 claude-hud 的源码，沿用它自己的 MIT 许可（见 `claude-code/hud/LICENSE.claude-hud`）。
