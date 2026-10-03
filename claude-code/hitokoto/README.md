# hitokoto：Claude Code 输入框上方的一言

**简体中文** · [English](README.en.md)

在输入框上方显示一句[一言](https://hitokoto.cn)：诗词、文学、动画台词或哲理短句，后面淡淡地附上作者和出处。等 Claude 干活的时候，顺便读一句。

![hitokoto：输入框上方的一句一言和出处](assets/preview.png)

## 功能

- **一句话加出处**：句子后面是作者和出处，点末尾的 `↻` 换一句（`daily` 模式下没有这个按钮）。
- **四种更换方式**：定时换（默认每 30 分钟）、每天一句（所有会话同一句，过了零点换新的）、每个会话一句、每次发消息换一句。
- **按分类挑**：可以只要诗词、文学、哲学等分类。
- **省流量、不空白**：横条隐藏时不请求；同一时间只发一个请求，10 秒没响应算失败；上次取到的句子会保存，新会话或离线时直接显示它，不会空着。
- 在 `claude -p` 和 SDK 里不请求。

## 安装

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hitokoto@hoobnn-agent-mods
```

## 命令

- `/hitokoto`：立刻换一句（`daily` 模式下替换今天的这句）。
- `/hitokoto off`、`/hitokoto on`：隐藏或显示横条。这个设置会写回 `/config`，以后的会话也会沿用；重新显示时会先取一句新的。

## 选项

在 `/config` 里修改，或写在 `~/.claude/settings.json` 的 `pluginConfigs` 里：

| 选项 | 作用 | 默认 |
| --- | --- | --- |
| `visible` | 显示横条（`/hitokoto off` / `on` 改的就是它） | 开 |
| `refreshMode` | `interval` 定时换、`daily` 每天一句、`session` 每个会话一句、`prompt` 每次发消息换一句 | `interval` |
| `categories` | 一言的分类字母，逗号分隔，留空不限。a 动画、b 漫画、c 游戏、d 文学、e 原创、f 网络、g 其他、h 影视、i 诗词、j 网易云、k 哲学、l 抖机灵，例如 `d,i,k` | 空 |
| `intervalMinutes` | `interval` 模式下几分钟换一句（至少 1） | 30 |
| `language` | `/hitokoto` 回复和报错的语言：`auto`、`en`、`zh-Hans`、`zh-Hant`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`（句子本身是中文） | `auto` |

`language` 为 `auto` 时，依次跟随 Claude Code 的 `language` 设置和系统语言环境，都没有时用英语。

## 同系列 mod

[hoobnn-agent-mods](../../README.md) 里还有状态栏 HUD（`hud`）、任务进度条（`todo-bar`）、回合回执（`receipt`）、运行动画和宠物（`spinner`）和 Tailscale 节点状态（`ts-band`），可以搭配使用。

## 开发

- `hooks/register.tsx`：钩子（会话开始时的语言、`/hitokoto` 和对应模式的刷新计划，命令和横条）。
- `hooks/config.ts`：选项，一次性读成类型化的 `Config`。
- `hooks/parse.ts`：接口地址和返回内容的解析、出处和本地日期。
- `hooks/i18n.ts`：各语言文案。
- `hooks/kit/`：`claude-code/kit` 的副本；改源文件后运行 `scripts/sync-kit.sh`。
