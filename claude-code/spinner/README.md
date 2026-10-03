# spinner：Claude Code 运行动画与宠物伴侣

**简体中文** · [English](README.en.md)

Claude 干活时，输入框上方会演一段小动画：像素风的横版射击、Claude 的吉祥物 Clawd、吃豆人、彩虹猫……还有一只会跟着 Claude 的动作变换姿势的宠物。一轮结束时放一小段彩带，显示这轮用了多久。共 15 套主题，随时切换，其中一套把电脑正在播放的声音画成频谱。

![spinner：Clawd 主题跑完一轮，宠物气泡跟着工具变化，最后放庆祝动画](assets/clawd.gif)

## 功能

- **动画小剧场**：Claude 工作时，输入框上方播放主题动画。其他 mod 的横条（hud、ts-band、hitokoto 等）排在它下面。
- **宠物伴侣**：参考 Codex Pets，按思考、调用工具、输出、等待切换姿势。气泡只说 Claude Code 自己的 Spinner 行没有的信息：正在跑的工具（`Bash: npm test`、`Edit: themes.ts`），或者有权限请求在等你确认；模型思考时它就埋头忙。多个子代理并行时显示数量（`Agent ×3`），只有一个时显示它的任务。Claude 跑测试或提交时，它会说几秒钟（测试通过、测试没过、提交好了）。
- **养成**：两轮之间宠物留在原地（完成、被中断、出错，安静 5 分钟后打瞌睡）。每跑完一轮、每次测试通过、每次提交都会涨经验升级（`Lv.4`）；点它或输入 `/spinner pet` 可以摸摸它（`♥12`，会冒爱心）。等级和好感度跨会话保存，同时开的几个会话养的是同一只。
- **Spinner 行上的吉祥物**：关掉宠物后，吉祥物会站到 Claude Code 自己的 Spinner 行前面（`[◉_◉]⊃━━ ✢ Choreographing… (4s · ↓ 14 tokens)`），原来的提示词、用时和 token 数不变。同一时间只显示一个吉祥物。
- **完成庆祝**：一轮结束后 3 秒，吉祥物身边放彩带并显示用时（`(=^▽^=)ﾉ  完成 · 12s`）；被中断是一张难过的脸，出错是一阵故障闪烁。
- **减少动画**：打开 `reducedMotion` 后，所有动画都只画静止的一帧，但仍会随 Claude 的状态变化。

## 主题

像素风场景，三行半格像素：

- `clawd`：Claude Code 的吉祥物 Clawd 散步路过，停下来干活，身边转着 Claude 的星芒；跑工具时敲笔记本，等你确认时头上冒 `?`。
- `thunder`：雷霆战机式横版射击，战机自动瞄准一波波敌机，有爆炸和计分；跑工具时敌机来得更快。
- `chomp`：吃豆人被四只幽灵追着跑，直到吞下能量豆。
- `sparky`：电气鼠一路冲过去，脸颊噼啪放电，跑工具时落下闪电。
- `bluecat`：蓝色机器猫戴着竹蜻蜓飞，跑工具时口袋里掉出道具。
- `nyan`：彩虹猫拖着彩虹飞过星空。

角色场景，两行：`cat`（猫）、`bunny`（兔子）、`sakura`（樱花）、`mecha`（机甲）、`neon`（霓虹）、`dino`（小恐龙）、`ocean`（小鱼）、`matrix`（字符雨）。也可以选 `random`，每个会话随机一套。

声音场景，四行：`audio` 把 Mac 正在播放的声音（音乐、视频、通话）实时画成频谱，每个频段一根柱子，顶上的峰值慢慢落下；左边的小人踩着节拍跳舞，宠物戴着大耳机。有声音时两轮之间也会显示，声音停几秒后收起。`random` 不会抽到它，要按名字选。

![audio 实拍：放音乐时的频谱](assets/audio-live.png)

`audio` 需要 macOS 14.2 及以上和 `swiftc`（Xcode 命令行工具：`xcode-select --install`）。第一次使用时，mod 用 `hooks/audio-tap.swift` 编译一个小程序（约 2 秒），只在这套主题显示时运行：它通过 Core Audio 读取系统输出，每秒 20 次把各频段的电平交给 mod，不保存、不写盘、不外传声音。macOS 会询问一次是否允许终端录制系统音频，拒绝的话柱子一直是平的。读不到声音时（其他系统、桌面 App、编译失败），场景里的小人睡着，`/spinner` 会说明原因。预览和下面的动图用的是合成信号。

| | |
| --- | --- |
| `clawd`<br>![clawd](assets/clawd.gif) | `thunder`<br>![thunder](assets/thunder.gif) |
| `chomp`<br>![chomp](assets/chomp.gif) | `sparky`<br>![sparky](assets/sparky.gif) |
| `bluecat`<br>![bluecat](assets/bluecat.gif) | `nyan`<br>![nyan](assets/nyan.gif) |
| `cat`<br>![cat](assets/cat.gif) | `bunny`<br>![bunny](assets/bunny.gif) |
| `sakura`<br>![sakura](assets/sakura.gif) | `mecha`<br>![mecha](assets/mecha.gif) |
| `neon`<br>![neon](assets/neon.gif) | `dino`<br>![dino](assets/dino.gif) |
| `ocean`<br>![ocean](assets/ocean.gif) | `matrix`<br>![matrix](assets/matrix.gif) |
| `audio`<br>![audio](assets/audio.gif) | |

所有主题的吉祥物、场景和宠物合在一张图里：[assets/gallery.png](assets/gallery.png)；每套主题的静态图在 `assets/<主题>.png`。

`chomp`、`sparky`、`bluecat`、`nyan` 是从零绘制、另起名字的同人致敬；`clawd` 照着 Claude Code 欢迎界面上的样子绘制。

## 安装

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install spinner@hoobnn-agent-mods
```

像素场景需要支持真彩色的终端（Ghostty、iTerm2、WezTerm、kitty 等）。

## 命令

- `/spinner`：查看当前主题、宠物的等级和好感度，以及主题列表。
- `/spinner <主题>`、`/spinner random`：立即切换主题；`/spinner theme` 弹窗选择（给出随机和三套主题，其他主题可以在 Other 里输入）。
- `/spinner preview [主题]`：在输入框上方试播 8 秒。
- `/spinner pet`：摸摸宠物。
- `/spinner off` / `on`：关闭或打开全部动画；`/spinner stage off` / `on` 只管动画场景；`/spinner companion off` / `on` 只管宠物。

这些命令改的设置都会写回 `/config`，以后的会话也会沿用，并立即生效。选了 `random` 时，同一个会话里重新加载也不会换主题。

## 选项

在 `/config` 里修改，或写在 `~/.claude/settings.json` 的 `pluginConfigs` 里：

| 选项 | 作用 | 默认 |
| --- | --- | --- |
| `visible` | 全部动画的总开关（`/spinner off` / `on`，或输入框底栏的 **Spinner** 按钮） | 开 |
| `footerButton` | 在输入框底栏显示 **Spinner** 开关按钮 | 开 |
| `theme` | 主题 | `random` |
| `stage` | 输入框上方的动画场景 | 开 |
| `celebrate` | 一轮结束时的庆祝动画 | 开 |
| `companion` | 宠物伴侣 | 开 |
| `reducedMotion` | 吉祥物、场景和宠物只画静止画面，仍随状态变化 | 关 |
| `language` | `/spinner` 回复、宠物气泡和庆祝文字的语言：`auto`、`en`、`zh-Hans`、`zh-Hant`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru` | `auto` |

`language` 为 `auto` 时，依次跟随 Claude Code 的 `language` 设置和系统语言环境，都没有时用英语。

Claude 工作时，横条占主题的行数再加宠物一行；两轮之间只占一行。空间不够时先收起场景、保留宠物；不足 3 行或 60 列时，宠物缩成一行（吉祥物、气泡和等级）。吉祥物、场景和宠物在终端和桌面 App 里显示；其他界面保持 Claude Code 原本的 Spinner。

## 同系列 mod

[hoobnn-agent-mods](../../README.md) 里还有状态栏 HUD（`hud`）、任务进度条（`todo-bar`）、回合回执（`receipt`）、Tailscale 节点状态（`ts-band`）和一言（`hitokoto`），可以搭配使用。

## 开发

- `hooks/register.tsx`：钩子（会话开始，回合事件：活动、庆祝、宠物，`/spinner`，Spinner 行上的吉祥物和横条）。
- `hooks/config.ts`：选项，一次性读成类型化的 `Config`。
- `hooks/command.ts`：解析 `/spinner` 的参数。
- `hooks/pet.ts`：宠物的等级和气泡、工具标签、时长。
- `hooks/themes.ts`、`hooks/cells.ts`：主题和它们绘制用的字符网格；`hooks/stage.tsx`、`hooks/sprite.tsx`：负责播放动画的 `Client` 模块。
- `hooks/audio.ts`、`hooks/audio-tap.swift`：`audio` 主题的电平处理（增益、峰值、节拍）和它读取的系统音频小程序；`register.tsx` 负责编译、启动和停止它，场景每帧通过 `ui.message` 取最新电平。
- `hooks/i18n.ts`：各语言文案。
- `hooks/kit/`：`claude-code/kit` 的副本；改源文件后运行 `scripts/sync-kit.sh`。
- 仓库根目录的 `scripts/spinner-shots.ts` 从 `hooks/themes.ts` 重新渲染全部动图和静态图。
