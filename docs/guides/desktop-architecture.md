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

- 窗口能力、主进程性能和外壳依赖的修复通过新安装包交付。新增**基础动作**（新 IPC 消息、新窗口能力）时，外壳升版本，
  游戏包 `apps/desktop/package.json` 的 `piggy.minShell` 视情况提高，`src/client/desktop/index.js` 的 `DESKTOP_VERSION` 加一；只优化现有动作不必增加约定版本。
- 游戏包要兼容「新游戏包 + 刚好满足 minShell 的旧外壳」：用新动作前先 `typeof shell.xxx === 'function'`。
- 外壳要兼容「老游戏包」：老游戏包会退回外壳自带的 `renderer/shell.js` 和下表「旧」消息，别删。

## 线程与持久化

| 执行位置 | 职责 |
|---|---|
| 窗口主线程 | Electron 窗口、拖动采样、命中判断、系统对话框、Chromium 网络和消息转发 |
| 游戏 Worker | 游戏 Store、路由、工作事件接口、事务账本和游戏存档；保持同一个单写者 |
| 更新 Worker | 版本记录和缓存、游戏包校验、解压、解析及暂存文件准备；不占用游戏单写者 |
| Windows 全屏探测 Worker | 创建和管理 PowerShell 探测进程，向主线程报告全屏状态；退出时等待进程和输出管道关闭 |
| 短生命周期签名 Worker | 外壳安装包的 Windows 发布者签名判断，复用更新器原有实现 |

外壳自己的日志、窗口状态、代理和全屏偏好采用异步文件操作。窗口状态保留防抖并串行写入，退出时写完最新快照；日志按接收顺序追加。静态资源通过异步文件响应提供，保留原有类型和缓存头。

Windows 上，现代游戏通过 `piggy:place` 上报可点区域后，命中完全由主进程读取光标并轮询判断，不再开启全局鼠标转发。切换到这个模式时，即使命中值没变也要重新设置转发选项。旧游戏仍使用页面的 `piggy:hit` 和鼠标转发；拖动捕获、心跳和松手最终几何确认独立保留。

游戏更新分为准备和提交：先下载、校验并解包到暂存目录，现用游戏继续运行；准备成功后关闭游戏写者，确认 `saved === true`，备份最终存档，再提交版本目录、原子切换 `active.json` 并重启。安装、回退和外壳安装共用一个切换排他，不能由两个窗口交错执行。准备任务可以单独取消，不永久关闭版本服务；失败准备包单独撤销，回退提交前核对当前存档与目标版本的兼容性。更新 Worker 内的同步包处理不会占用窗口线程，下载仍由主线程的 Chromium 网络栈执行，以保留系统代理和设备代理设置。

带非空 `pending` 的快照必须把同一份消息送到各窗口，因为生成快照时已经取走这些消息。Worker 先发送原始 JSON 快照文本，再返回对应路由响应；主线程只转发，preload 在页面进程解析并保持 `onStateChanged` 的对象接口。此类快照不能替换成空刷新通知，也不能只保留最新一份。POST 请求体用 ArrayBuffer 转移到 Worker 后再解析文本；二进制响应也在 Worker 内整理为独立 ArrayBuffer 后转移，不转移可能来自池化 Buffer 的底层存储。这些路径仍会完整接收请求体或响应体，并非端到端流式传输。

正常退出先停接工作事件，再完成游戏保存和资源清理。如果保存失败且宿主仍可运行，重新建立工作接口并发布发现文件后才返回保存错误，界面恢复时接口也可重新发现。外壳更新下载在退出时取消，已经开始的签名验证等待原验证器结束，避免直接终止 Worker 留下 PowerShell 子进程。

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
| `piggy:hit` | `setHit(bool)` | 单向 | 旧游戏的 Windows 穿透命中；现代游戏上报形状后由主进程轮询 |
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
| `piggy:state-changed` | `onStateChanged` | 两边 | 普通变更通知在 30ms 内合并并触发刷新；也可携带同一份含 `pending` 的快照，此时不合并，直接渲染 |

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
| `apps/desktop/lib/background-host.js`、`runtime-worker.js` | 游戏 Worker 的异步代理、路由和快照转发 |
| `apps/desktop/lib/background-versions.js`、`versions-worker.js` | 更新 Worker、Chromium 下载衔接和版本操作 |
| `apps/desktop/lib/fullscreen.js`、`fullscreen-worker.js` | 全屏偏好及 Windows 后台探测器 |
| `apps/desktop/lib/signature-worker.js` | Windows 外壳安装包签名校验 |
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
