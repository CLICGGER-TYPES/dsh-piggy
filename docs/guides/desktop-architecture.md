# 桌面版架构与 IPC 参考（外壳 0.6.x）

给要改桌面版的人看。玩家看 [desktop.md](desktop.md)。

## 一句话

两个透明置顶窗口，一份游戏包两边各跑一份：

| 窗口 | 里面有什么 | 谁决定它在哪、多大 |
|---|---|---|
| **猪窗口**（`win`，role=`pet`） | 只有猪、气泡、签到/打工小道具 | 游戏包算（`src/client/desktop/`），外壳照做（`piggy:place`）；拖动中由外壳按鼠标算（`dragTick`） |
| **面板窗口**（`panelWin`，role=`panel`） | 只有面板（名牌 + 卡片） | 外壳按猪的位置算（`apps/desktop/lib/panel-geometry.js`），页面只报自己多大 |

页面怎么知道自己在哪个窗口：`window.piggyShell.role`（preload 从启动参数 `--piggy-role=panel` 读）。
游戏包里按角色分工的代码在 `src/client/split.js`、`src/client/pending.js`、`src/client/desktop/panel-window.js`。

## 三条铁律（每条都是真实踩过的坑）

1. **按「真相」重算，不在上一轮结果上累加。** 猪的真相是「家」（脚底中心的屏幕点，`place.js`）；
   面板的真相是「猪现在在哪」。每一轮都从真相重新算窗口，算错一次下一轮自己纠正。
   反例：0.6.0 拖动时「面板回读位置 + 猪这帧挪了多少」→ 面板越跑越远（0.33.1 修）。
2. **不把 `getBounds()` 读回来再设回去。** Windows 125%/150% 下读回值比设的差 1px，读了再设
   一帧涨 1px（0.6.0 拖一次猪窗口从 345 宽涨到 482）。外壳以请求值 `petAsked` 为准。
3. **改窗口大小会有一帧画在旧位置**（Windows 透明窗口最明显）。所以猪窗口固定大小，
   冒气泡、开面板、换页都不改它；面板变高变矮只改面板窗口。

## 游戏包和外壳怎么分工

原则：**能放进游戏包的都放进游戏包**（玩家点一下就更新），外壳（要下载安装包）能不动就不动。

- 只有需要**新的基础动作**（新 IPC 消息、新窗口能力）时才改外壳：外壳升版本，
  游戏包 `apps/desktop/package.json` 的 `piggy.minShell` 视情况提高，`src/client/desktop/index.js` 的 `DESKTOP_VERSION` 加一。
- 游戏包要兼容「新游戏包 + 刚好满足 minShell 的旧外壳」：用新动作前先 `typeof shell.xxx === 'function'`。
- 外壳要兼容「老游戏包」：老游戏包会退回外壳自带的 `renderer/shell.js` 和下表「旧」消息，别删。

## IPC 消息全表

页面一侧都经 `window.piggyShell`（`apps/desktop/preload.cjs`）。主进程一侧在 `apps/desktop/main.js`，
每个处理函数开头用 `fromPet(event)` / `fromPage(event)` 核对是哪个窗口发的，**新加消息也要核对**。

### 猪窗口 → 主进程

| 通道 | piggyShell 方法 | 方式 | 说明 |
|---|---|---|---|
| `piggy:place` | `place({bounds?, shape?, pig?})` | 同步 | 设窗口位置大小、可点区域；`pig` 是猪在窗口里的框（0.33.1 起，面板按它贴猪）。返回最新几何 |
| `piggy:drag:start` | `beginDrag(pig)` | 单向 | 开始拖：带猪在窗口里的框；`slide:true` 表示页面会接 `piggy:drag-slide` |
| `piggy:drag:heartbeat` | `dragHeartbeat()` | 单向 | 拖动中每次 pointermove 发；2 秒没心跳主进程自己松手 |
| `piggy:drag:end` | `endDrag()` | 单向 | 松手 |
| `piggy:hit` | `setHit(bool)` | 单向 | Windows 穿透模式：鼠标在不在猪上 |
| `piggy:geometry:ask` | `askGeometry()` | 单向 | 挂载后主动要一次几何 |
| `piggy:panel:toggle` | `panel.toggle(open, pig)` | 单向 | 右键开/关面板 |

### 面板窗口 → 主进程

| 通道 | piggyShell 方法 | 说明 |
|---|---|---|
| `piggy:panel:size` | `panel.size(w, h)` | 面板排好后的大小（只在真打开、内容画好后报，免得先小后大弹一下） |
| `piggy:panel:close` | `panel.close()` | 面板里点了收起 / 点外面自动收起 |
| `piggy:pig-fx` | `panel.fx(name, args)` | 面板里对猪的反应（`PIG_FX`：flash/react/burst/showBubble/transform），转给猪窗口演 |

### 主进程 → 页面

| 通道 | 订阅 | 发给 | 说明 |
|---|---|---|---|
| `piggy:geometry` | `onGeometry` | 猪窗口 | 窗口、所在屏和所有屏工作区、显示器缩放、`dragSlide` |
| `piggy:drag-slide` | `onDragSlide` | 猪窗口 | 拖到屏幕边、窗口被夹住时猪在窗口里该滑多少 |
| `piggy:panel` | `panel.on` | 两边 | `{type:'open', vertical, maxHeight}` / `{type:'closed'}` / `{type:'blur', toPet}` |
| `piggy:pig-fx` | `panel.onFx` | 猪窗口 | 面板转来的反应 |
| `piggy:state-changed` | `onStateChanged` | 两边 | 存档变了（任一边 POST 之后，30ms 内合并一次），马上刷新 |

### 两边都能用的

`piggy:updates:*`（游戏包版本切换）、`piggy:shell:*`（外壳更新）、`piggy:open`（用系统浏览器开链接）、
`piggy:save-log`（导出日志另存为）、`piggy:quit`。都是 `invoke`（返回 Promise）。

### 旧消息（只给老游戏包，别删）

| 通道 | 给谁 | 什么时候能删 |
|---|---|---|
| `piggy:content`、`piggy:shape` | 外壳 0.3.0 以前的游戏包（用 `renderer/shell.js` 那套） | 等游戏包的 `minShell` 和「回退到老版本」的最低版本都过了 0.27.x，且外壳不再提供回退到那些版本 |
| `piggy:move`（`moveBy`） | 0.27.2 及以前的游戏包拖动；新游戏包的「散步」也还在用 | 散步改用 `place` 之后 |

## 关键文件

| 文件 | 内容 |
|---|---|
| `apps/desktop/main.js` | 主进程：两个窗口、拖动（`dragTick`）、面板窗口一节、IPC |
| `apps/desktop/lib/panel-geometry.js` | 面板窗口摆哪（纯函数，有单测） |
| `apps/desktop/lib/window-geometry.js` | 拖动时窗口怎么跟鼠标、夹在哪些屏里 |
| `apps/desktop/preload.cjs` | `window.piggyShell` |
| `src/client/desktop/index.js` | 猪窗口页面：每轮量猪、按家算窗口、拖动起止 |
| `src/client/desktop/place.js` | 「家」模型 |
| `src/client/desktop/measure.js` | 猪窗口的固定框、气泡预留、可点区域 |
| `src/client/desktop/panel-window.js` | 面板窗口页面：排版、报尺寸 |
| `src/client/split.js`、`pending.js` | 两边页面的分工（谁演反应、谁出提示条） |

## 怎么验收（改了窗口/拖动相关的东西必须做）

单元测试（`test/panel-geometry.test.js`、`test/desktop-page.test.js`、`test/split.test.js`）只证明算法对。
**窗口真的显示在哪，只能真鼠标拖 + 录屏逐帧看**——只看拖动起止坐标会漏掉中间的跳动和漂移。

1. **Linux（GNOME Wayland）**：`node tools/desktop-geometry-check.mjs all`，加 `PIGGY_FILM_DIR=/tmp/film` 录下每次真拖，
   再 `uv run --with numpy --with scipy python tools/drag-film.py /tmp/film` 逐帧检查；面板相关的加 `--panel`。
   测试前先关屏保（屏保激活时真鼠标和录屏都失效）。
2. **Windows**：分数缩放（125%/150%）下的问题 Linux 和 100% 缩放都测不出来。虚拟机里把显示缩放调到 125%，
   用 QMP 绝对鼠标真拖、虚拟机里 ffmpeg `gdigrab` 录屏，同样用 `drag-film.py --panel` 分析。
   修前先用旧版录一次复现（0.33.1 的对照：修前面板偏 204px，修后 90% 的帧 ≤2px）。
3. 测试机的账号、IP、操作脚本在维护者本机笔记里，不进仓库。
