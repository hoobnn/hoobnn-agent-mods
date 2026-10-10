<div align="center">

# ts-band：在 Claude Code 里看 Tailscale 节点状态

**简体中文** · [English](README.en.md)

</div>

在输入框上方显示 Tailscale 组网里各节点的连接状态。全部直连时只占一个小标记；有节点走中继或掉线时才把它们列出来。让 Claude 往远程机器部署、同步文件之前，先看一眼链路是否正常。

![ts-band：两个节点走中继，一个节点离线](assets/preview.png)

## 功能

- 正常时几乎不占地方：所有节点在线且直连时，只显示 `TS ● 4/4 直连`。
- 有异常才展开：显示在线节点数，然后只列出需要注意的节点：`◐` 黄色表示走中继或 DERP（会标出 DERP 区域，如 `DERP-sfo`），`○` 红色表示离线。
- 上线 / 掉线提醒：节点上线或掉线时弹 toast。
- 及时刷新：每分钟读一次 `tailscale status --json`；Claude 执行 `tailscale up`、`down`、`set`、`switch`、`login`、`logout` 后立即刷新。
- 读取失败不清空：读取失败时保留上次的节点，后面附上错误信息；之后的重试间隔逐次翻倍（最长 10 分钟），没装 CLI 或守护进程没开时不会每次都重试。
- 在 `claude -p` 和 SDK 里不运行。

## 安装

先装好 [Tailscale](https://tailscale.com/download)，确保 `tailscale` 命令可用（macOS 应用自带的 CLI 也能找到），然后：

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
```

## 命令

- `/ts`：切换显示和隐藏；`/ts off`、`/ts on` 直接设定。这个设置会写回 `/config`，以后的会话也会沿用。

## 选项

在 `/config` 里修改，或写在 `~/.claude/settings.json` 的 `pluginConfigs` 里：

| 选项 | 作用 | 默认 |
| --- | --- | --- |
| `visible` | 显示横条（`/ts` 改的就是它） | 开 |
| `nodes` | 只显示这些节点，按填写顺序排列；`host=名字` 可以改显示名，如 `nas=家里, dev-box, vps-west=美西`。留空显示全部，在线数和提醒也只按选中的节点算 | 空 |
| `hideOffline` | 横条里不列离线节点（在线数仍然计入） | 关 |
| `tailscalePath` | `tailscale` 命令的路径；留空时依次在 PATH、Homebrew 和 macOS 应用里找 | 空 |
| `intervalSeconds` | 两次读取之间的秒数（至少 10） | 60 |
| `language` | 界面语言：`auto`、`en`、`zh-Hans`、`zh-Hant`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru` | `auto` |

`language` 为 `auto` 时，依次跟随 Claude Code 的 `language` 设置和系统语言环境，都没有时用英语。

## 同系列 mod

[hoobnn-agent-mods](../../README.md) 里还有状态栏 HUD（`hud`）、任务进度条（`todo-bar`）、回合回执（`receipt`）、运行动画和宠物（`spinner`）和一言（`hitokoto`），可以搭配使用。

## 开发

- `hooks/register.tsx`：钩子（会话开始时的语言、`/ts` 和定时读取，命令和横条）。
- `hooks/config.ts`：选项，一次性读成类型化的 `Config`。
- `hooks/parse.ts`：把 `tailscale status --json` 解析成节点，把 `nodes` 选项解析成筛选规则。
- `hooks/i18n.ts`：各语言文案。
- `hooks/kit/`：`claude-code/kit` 的副本；改源文件后运行 `scripts/sync-kit.sh`。
