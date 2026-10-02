# hoobnn-agent-mods：Claude Code 状态栏 HUD 与插件

**简体中文** · [English](README.en.md)

我给几个编程 Agent 工具写的 mod、扩展和插件，按工具分目录放。目前能用的主要是 Claude Code 的三个 mod：状态栏 HUD、Tailscale 节点状态条和一言。

| 目录 | 对应工具 | 放什么 |
| --- | --- | --- |
| `claude-code/` | [Claude Code](https://code.claude.com) | mod（函数钩子插件），每个子目录都能用 `claude --plugin-dir` 单独加载 |
| `pi/` | [pi](https://github.com/badlogic/pi-mono) | 扩展 |
| `deepseek/` | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | `dsh` 插件 |
| `shared/` | 不限 | 多个工具的移植版都要用到的逻辑 |
| `scripts/` | | 检查脚本和本地安装辅助脚本 |

## Claude Code mod

| Mod | 作用 |
| --- | --- |
| [`hud`](claude-code/hud) | 把 [claude-hud](https://github.com/jarrodwatts/claude-hud) 0.10.0 改成 mod，显示模型、项目、git、上下文、用量、工具、子代理和待办，可以放在输入框上方或下方。另外加了：长任务结束提醒、上下文和额度预警、用量耗尽预测、每日预算、近 7 天花费、未提交改动提醒、一行任务摘要，以及 `/hud detail` 详情面板 |
| [`ts-band`](claude-code/ts-band) | 在输入框上方显示各 Tailscale 节点的状态：直连绿色、走中继或 DERP 黄色、离线红色；节点上线或掉线时弹提示 |
| [`hitokoto`](claude-code/hitokoto) | 在输入框上方显示一句[一言](https://hitokoto.cn)，可以定时换、每天一句、每个会话一句或每次发消息换一句 |

从本仓库的插件市场安装：

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
claude plugin install hitokoto@hoobnn-agent-mods
```

选项（`hud` 的 `position`、`dailyBudgetUsd`、`summaryEveryTurns`，`ts-band` 的 `nodes`、`hideOffline`，`hitokoto` 的 `refreshMode`、`categories` 等）都能在 `/config` 里改，也可以写在 `~/.claude/settings.json` 的 `pluginConfigs` 里。每个 mod 的完整说明见各自目录下的 README（英文）。

### 开发

- 用工作副本覆盖已安装的版本：`claude --plugin-dir claude-code/<mod>`。会监听文件，保存后钩子模块自动重新加载。
- `scripts/check.sh` 会校验、测试并类型检查所有 mod。mod API 还在早期阶段，Claude Code 升级后也跑一遍。`tsc` 需要的类型文件由 Claude Code 在第一次加载 mod 时放进 `.claude-plugin/types/`。
- 发布：把 mod 的 `plugin.json` 和 `.claude-plugin/marketplace.json` 里对应条目的 `version` 改掉，提交，然后执行 `claude plugin tag claude-code/<mod> --push`（tag 格式是 `<mod>--v<version>`）。已安装的用户执行 `claude plugin marketplace update hoobnn-agent-mods && claude plugin update <mod>@hoobnn-agent-mods` 更新。

## 许可

MIT。`claude-code/hud/hooks/hud` 是 claude-hud 的源码，沿用它自己的 MIT 许可（见 `claude-code/hud/LICENSE.claude-hud`）。
