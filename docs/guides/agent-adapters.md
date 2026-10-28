# 接入其他 agent 框架

游戏运行时负责存档、工作事件去重、原有规则和状态通知。框架适配器只负责订阅真实工作、转换事件，以及必要的排队和重试。DSH 的入口位于 `adapters/dsh/`，根目录 `index.js` 保留原包的导出和安装方式。

## 两种接入方式

### 同一进程

```js
import { createGameRuntime } from 'dsh-piggy/runtime'

const game = createGameRuntime({
  statePath: '/absolute/path/to/state.json',
  onStateChanged: () => refreshPet(),
})

game.acceptWorkEvent({
  version: 1,
  source: 'my-agent',
  id: 'session-123:tool-456',
  type: 'tool',
  at: Date.now(),
})
```

运行时还提供 `handle(method, path, body)`、`mountRoutes(webServer)`、`dispatchCommand(name, input)` 和 `dispose()`。路由注册器只需提供 `register(route)` 并返回注销函数，不需要 Cordis 或 DSH。适配器不获得原始 Store。

一份存档只能由一个运行时打开。已关闭的运行时不接受新的游戏操作；退出会先恢复未完成事务并保存。日志导出保留原有关闭后读取能力。

### 独立进程

默认不开端口。桌面源码使用 `--work-events` 启用接收接口：

```sh
cd apps/desktop
npm run pack-game
npx electron . --work-events
```

接收器监听 `127.0.0.1` 的随机端口，发现文件位于 Electron userData 下的 `work-endpoint/endpoint.json`。文件包含 `version`、`role: "piggy-work-events"`、`port`、`token` 和 `pid`。目录只向当前用户开放，不要分享发现文件。

适配器读取发现文件，以 `Authorization: Bearer <token>` 调用：

| 方法与路径 | 用途 |
|---|---|
| `GET /health` | 查询协议版本、事件类型、去重窗口和确认语义 |
| `POST /events` | 提交一个工作事件，正文为 JSON |

只有工作事件接口向外开放，照顾、调试、存档和扩展管理路由不向外转发。带浏览器 Origin 的请求被拒绝。

无窗口的运行时也可以独立启动，读取同一格式的游戏存档：

```sh
node runtime/serve.mjs --work-events --state-path=/absolute/path/to/state.json --endpoint-directory=/absolute/path/to/private-endpoint
```

未传入 `--work-events` 时只打印关闭提示并退出，不创建存档、不监听端口。开启后不启动桌宠，也不监听其他游戏管理接口。桌面窗口和此入口不能同时打开同一份存档。

## 工作事件协议 v1

字段固定为 `version`、`source`、`id`、`type`、`at`，不接受 prompt、工具参数、输出或其他正文。

- `version`：固定为 `1`。
- `source`：框架命名空间，小写字母开头，最长 64 字符，可含数字、点和连字符。
- `id`：真实工作身份，最长 160 字符，可含字母、数字及 `_.:/-`；相同工作重试时保持不变。
- `type`：`message`、`turn`、`tool`、`toolError` 或 `agentError`。
- `at`：事件产生时的 Unix 毫秒时间，重试不能重写。接受过去七天内、至多未来五分钟的事件。

来源与 ID 共同去重。同一来源、同一 ID 再次提交不同类型或时间返回 `409`。来源字段是命名空间，不是框架真实性证明。

适配器应按真实完成的工作计数，不按流式更新次数、状态轮询或 idle 通知计数。缺少某类真实事件时可以不报告它，不需要猜测或补造。

### 确认与重试

成功返回 `200`，正文包含 `ok: true`、`status` 和 `disposition`：

- `status: "applied"`：已按原规则处理并提交；不代表一定发放奖励，例如原有每日上限仍生效。
- `disposition: "ignored"`：没有小猪或小猪已死亡，已提交收据，`status` 仍为 `"applied"`。
- `status: "duplicate"`：该工作已提交，不重复应用；`disposition` 返回首次提交的结果。

回复成功前，游戏状态和收据已经通过旁路事务提交。网络中断后可以重复投递同一事件。桥的入队确认与游戏提交确认是两件事；桥只能在游戏确认后移除事件。

运行时按当前游戏时间结算，`at` 用于投递窗口与身份校验，不把离线队列回放成历史时间模拟。窗口内最多保留 20,000 个收据，满时返回 `429`，不会提前逐出去重记录；过期事件返回 `422`，适配器应将这些结果交由自己的队列策略处理。

## 存档与线程

本次拆分不新增游戏存档字段，也不提高 STATE_VERSION。旁路收据与完整状态写前日志位于 `<statePath>.work-events/`，所有者锁位于 `<statePath>.runtime.lock/`。未完成事务先于 Store 打开恢复，状态冲突保留文件并停止操作。已有旧 OpenCode WAL 不自动迁入。

桌面外壳的 Store、路由、工作接收和持久化共用一个后台线程，主线程仅处理窗口和异步消息；扩展下载仍使用 Chromium 网络栈。DSH 的进程内适配保持原同步事件和命令返回方式，工作事件提交会同步落盘。

## DSH 与 OpenCode

DSH 的存档默认位置、斜杠命令和五类工作计数保持原样。DSH 回调目前没有已核实的持久事件 ID，因此适配器为每次观测分配身份，不宣称能够识别宿主重复发出的两个回调。

OpenCode 接入以 [WolalaQAQ/opencode-piggy](https://github.com/WolalaQAQ/opencode-piggy) 的当前公开主线为准。它是运行在 OpenCode V2 服务（2.0.26 或以上）里的自包含插件：订阅服务端公共事件，把真实工作映射成带稳定 ID 的工作事件，先写入插件自己的持久发件箱，再通过 dsh-piggy 的本机 HTTP 接口 `POST /events` 投递。插件不注册模型工具、不改模型上下文，也没有独立桥进程或 `runtime-adapter.js` 生命周期；游戏本体不导入 OpenCode 插件，也不管理插件进程。Desktop 和 TUI 连接同一个 OpenCode 服务时共用同一个插件，不需要按客户端分别安装。

安装、配置、离线包和排障以 upstream 的[插件使用指南](https://github.com/WolalaQAQ/opencode-piggy/blob/main/docs/guides/opencode.md)、[Releases](https://github.com/WolalaQAQ/opencode-piggy/releases) 和 OpenCode 官方的[插件文档](https://opencode.ai/docs/plugins/)为准。本文固定分析提交 `d8296b3b795b50c7070c0630fa049f07765a3f82`，对应实现入口为 [direct-client.js](https://github.com/WolalaQAQ/opencode-piggy/blob/d8296b3b795b50c7070c0630fa049f07765a3f82/packages/opencode-piggy/direct-client.js)、[game-endpoint.js](https://github.com/WolalaQAQ/opencode-piggy/blob/d8296b3b795b50c7070c0630fa049f07765a3f82/packages/opencode-piggy/game-endpoint.js) 和 [paths.js](https://github.com/WolalaQAQ/opencode-piggy/blob/d8296b3b795b50c7070c0630fa049f07765a3f82/packages/opencode-piggy/paths.js)。旧版文档提到的独立桥和 `runtime-adapter.js` 是早期原型，不属于当前公开主线。

### 当前目录兼容性（源码静态对比）

RC5 桌面版默认把工作接口发现文件放在桌面的 `piggy` 数据目录：

| 平台 | RC5 桌面默认 `work-endpoint` |
|---|---|
| Windows | `%APPDATA%\piggy\work-endpoint` |
| macOS | `~/Library/Application Support/piggy/work-endpoint` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/piggy/work-endpoint`（仅绝对路径的 `XDG_DATA_HOME` 生效） |

上面固定提交的插件在未设置选项时，仍先查 `<配置根目录>/dsh-piggy/work-endpoint`，再查 `<配置根目录>/dsh-piggy-desktop/work-endpoint`（Linux 配置根目录为 `${XDG_CONFIG_HOME:-~/.config}`）。所以三个平台都用默认值时，插件不会自动发现 RC5 桌面新建的 `piggy/work-endpoint`。这是对固定版本源码的静态对比，不是在真实界面复现的 bug，也不代表 Windows 已通过或失败。

需要在插件配置里把 `gameDirectory` 指向桌面实际的 `work-endpoint` 目录（`endpoint.json` 所在目录），不要指向 `state.json` 或它的上级 userData。写法见 upstream 的[配置游戏目录与队列](https://github.com/WolalaQAQ/opencode-piggy/blob/d8296b3b795b50c7070c0630fa049f07765a3f82/docs/guides/opencode.md#配置游戏目录与队列)；只使用其中已有的选项，不另造命令行参数。另一种已实现的方式是给桌面和 **OpenCode 服务进程**设置同一个 `PIGGY_USERDATA`（指向 userData 目录本身，即 `work-endpoint` 的父目录），插件会读取 `$PIGGY_USERDATA/work-endpoint`；只在启动桌面的终端里设置不会影响已经运行的 OpenCode 服务。

不要通过移动、复制或软链个人存档，也不要伪造 `endpoint.json` 或令牌来绕过目录问题。这里只描述 RC5 与固定版本第三方插件的现状；本仓库不改第三方代码，也不声称已经修复默认自动发现。
