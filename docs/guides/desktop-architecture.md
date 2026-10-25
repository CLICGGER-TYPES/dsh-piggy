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
   冒气泡、开面板、换页都不改它；新版面板使用固定透明外框，切页只变内部卡片高度；旧游戏包继续按内容大小调整面板窗口。

## 游戏包和外壳怎么分工

原则：**能放进游戏包的都放进游戏包**（玩家点一下就更新），外壳（要下载安装包）能不动就不动。

- 窗口能力、主进程性能和外壳依赖的修复通过新安装包交付。新增**基础动作**（新 IPC 消息、新窗口能力）时，外壳升版本，
  游戏包 `apps/desktop/package.json` 的 `piggy.minShell` 视情况提高，`src/client/desktop/index.js` 的 `DESKTOP_VERSION` 加一；只优化现有动作不必增加约定版本。
  2026-10-18：`DESKTOP_VERSION=6`，新增 `piggy:flight:move`；`minShell` 不提高（旧外壳仍能跑 A1，只是不抛）。
- 游戏包要兼容「新游戏包 + 刚好满足 minShell 的旧外壳」：用新动作前先 `typeof shell.xxx === 'function'`。
- 外壳要兼容「老游戏包」：老游戏包会退回外壳自带的 `renderer/shell.js` 和下表「旧」消息，别删。

### Windows 鼠标转发

默认穿透模式下，窗口启动时完全穿透且 `forward:false`。只有猪窗口发来的合法 `piggy:content`、`piggy:shape` 或布尔 `piggy:hit` 才确认旧版能力并开启转发；面板、扩展及非法消息不作为能力证据。

首次有效 `piggy:place`（含同步读取几何的 `place({})`）确认现代能力，此后保持 `forward:false`，迟到的旧消息不会降级。现代游戏上报形状后，主进程每 16ms 读取光标判断命中；命中与转发选项一起去重，能力变化时即使命中相同也重新设置。拖动捕获、心跳和松手后的同步几何屏障保持原流程。Linux、macOS 和 `PIGGY_SHAPE=1` 不走这条转发路径。

## 线程与持久化

| 执行位置 | 职责 |
|---|---|
| 窗口主线程 | Electron 窗口、拖动采样、命中判断、系统对话框、Chromium 网络和消息转发 |
| 游戏 Worker | 游戏 Store、路由、工作事件接口、事务账本和游戏存档；保持同一个单写者 |
| 更新 Worker | 版本记录和缓存、游戏包校验、解压、解析及暂存文件准备；不占用游戏单写者 |
| Windows 全屏探测 Worker | 创建和管理 PowerShell 探测进程，向主线程报告全屏状态；退出时等待进程和输出管道关闭 |
| 短生命周期签名 Worker | 外壳安装包的 Windows 发布者签名判断，复用更新器原有实现 |

外壳自己的日志、窗口状态、代理和全屏偏好采用异步文件操作。窗口状态保留防抖并串行写入，退出时写完最新快照；日志按接收顺序追加。日志和存档 ZIP 导出在系统对话框确认后异步写盘，退出等待已经开始的写入；退出后才确认的对话框不再创建文件。静态资源通过异步文件响应提供，保留原有类型和缓存头。

游戏更新分为准备和提交：先下载、校验并解包到暂存目录，现用游戏继续运行；准备成功后关闭游戏写者，确认 `saved === true`，备份最终存档，再提交版本目录、原子切换 `active.json` 并重启。安装、回退和外壳安装共用一个切换排他，不能由两个窗口交错执行。准备任务可以单独取消，不永久关闭版本服务；失败准备包单独撤销，回退提交前核对当前存档与目标版本的兼容性。更新 Worker 内的同步包处理不会占用窗口线程，下载仍由主线程的 Chromium 网络栈执行，以保留系统代理和设备代理设置。

下载响应通过 `Readable.fromWeb` 接入写盘管道。落盘失败时可以直接取消 Web reader，不必等待下一块网络数据；管道结束后由下载请求所有者中止底层请求，再释放临时文件。

主进程取得应用单实例锁后，更新服务启动时清理上次崩溃遗留的 `.update-` 加六位随机字符的私有目录，再创建本次暂存目录。拿锁失败的实例即使收到 `ready` 也不执行初始化。扫描或单个旧目录删除失败时，记录路径和错误后继续，清理失败不阻止启动。清理不触及已安装版本、版本记录或存档，也不跟随符号链接；正常关闭仍只清理本次目录。

带非空 `pending` 的快照必须把同一份消息送到各窗口，因为生成快照时已经取走这些消息。Worker 先发送原始 JSON 快照文本，再返回对应路由响应；主线程只转发，preload 在页面进程解析并保持 `onStateChanged` 的对象接口。此类快照不能替换成空刷新通知，也不能只保留最新一份。POST 请求体用 ArrayBuffer 转移到 Worker 后再解析文本；二进制响应也在 Worker 内整理为独立 ArrayBuffer 后转移，不转移可能来自池化 Buffer 的底层存储。这些路径仍会完整接收请求体或响应体，并非端到端流式传输。

正常退出先停接工作事件，再完成游戏保存和资源清理。如果保存失败且宿主仍可运行，重新建立工作接口并发布发现文件后才返回保存错误，界面恢复时接口也可重新发现。外壳更新关闭后不再接受新操作，取消已有下载，并等待在途检查、下载清理和签名验证完成。检查阶段尚无可用取消 token 时等待检查返回；签名验证等待原验证器结束，避免直接终止 Worker 留下 PowerShell 子进程。

## IPC 消息全表

页面一侧都经 `window.piggyShell`（`apps/desktop/preload.cjs`）。主进程一侧在 `apps/desktop/main.js`，
每个处理函数开头用 `fromPet(event)` / `fromPage(event)` 核对是哪个窗口发的，**新加消息也要核对**。

### 猪窗口 → 主进程

| 通道 | piggyShell 方法 | 方式 | 说明 |
|---|---|---|---|
| `piggy:place` | `place({bounds?, shape?, pig?})` | 同步 | 设窗口位置大小、可点区域；`pig` 是猪在窗口里的框（0.33.1 起，面板按它贴猪）。返回最新几何 |
| `piggy:drag:start` | `beginDrag({x,y,width,height,slide,origin?,visual?})` | 单向 | 开始拖：带猪在窗口里的定位框；`slide:true` 表示页面会接 `piggy:drag-slide`；`origin` 是 pointerdown 的屏幕坐标（手感层延迟到 4px 才发，主进程校验后当拖动起点）；未发布候选的可选 `visual` 是同坐标系完整绘制包络，不能替换原定位框 |
| `piggy:flight:move` | `flyMove({x,y,slide})` | 单向 | A2 抛掷（外壳 0.6.8 起）：页面算好窗口位置，主进程只 setBounds，不重排、不 followPig、不写 window.json；`slide` 用来平移可点/可见形状 |
| `piggy:drag:heartbeat` | `dragHeartbeat()` | 单向 | 拖动中每次 pointermove 发；2 秒没心跳主进程自己松手 |
| `piggy:drag:end` | `endDrag(release?)` | 同步 | 松手并返回最后一帧的窗口几何与滑动量 |
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
`piggy:save-log`（导出日志另存为）、`piggy:save-archive`（完整存档 ZIP 另存为，0.37.1-rc.2 起）、`piggy:quit`。都是 `invoke`（返回 Promise）。

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

### 完整存档传输（0.37.1-rc.2 预发布）

设置入口通过共用 runtime 的 `/dsh-piggy/save/export`、`/save/preview` 和 `/save/import` 操作完整 ZIP。预览不写目标目录；确认后冻结新操作、等待在途请求、结清工作账本和 Store，再保存自动备份并执行可恢复的替换。恢复必须在获取存档锁后、打开账本和 Store 前执行。每份猪独占目录，避免多个文件名共享资源。

桌面协议 v5 新增 `piggyShell.saves.save(name, Uint8Array)` / `piggy:save-archive`，只接受受限 ZIP 名称与字节，由系统保存框选目的地。协议 POST 使用 `arrayBuffer()`，不能将 ZIP 按 UTF-8 文本转码。旧外壳检测不到新方法时走浏览器下载，不提高 minShell。


### 2026-10-21：体型变化与原生裁剪

落地锚点只属于当时的窗口尺寸；外框变化时，页面撤回 anchor，再按既有屏幕脚底坐标摆新框，避免旧偏移把较小立绘挤出窗口。窗口尺寸不变时保留锚点，不能恢复落地瞬移。

Linux 的 setShape 也裁剪绘制。窗口 resize 时先临时保留完整区域，等 webContents.beginFrameSubscription 提交目标尺寸的画面后才恢复最新精确 shape，并立即结束订阅；拖动、飞行和 WM 接受实际尺寸时取消旧订阅。依据 [Electron 帧提交订阅 API](https://www.electronjs.org/docs/latest/api/web-contents#contentsbeginframesubscriptiononlydirty-callback)。帧图先结合图片倍率与显示器倍率换回 DIP，已验证 100% / 200%，避免物理像素和逻辑像素相差一倍时持续订阅。正常静止、拖动与逐帧抛掷不持续捕获画面。Windows 穿透路径和 macOS 不启用此保护，本轮只验证 Linux。

### 固定面板外框（2026-10-21 候选）

页面通过 `panel.size(width, height, true)` 上报内容高度；新外壳预留本次锚点的最大高度，内容始终贴着猪的一边。Linux/Windows 的原生 shape 只覆盖真实内容，切页后等待新帧再提交轮廓；macOS 按内容框同步鼠标穿透。旧页面不传第三个参数，旧外壳忽略它，均继续支持原尺寸协议。Linux 虚拟机已复现旧版切页瞬时偏移 114px；Windows/macOS 本轮未实机验证。

开着面板跨屏拖动时，`panelBoundsFor` 接收当前全部工作区，按整个桌面外沿夹取；锚点保留的原 workArea 仅供静态排版、尺寸和松手重排使用，不能成为拖动中的屏幕围栏。该路径复用 `desktopViewportBounds`，不会每过屏缝就切换对齐方向。

### 边缘拖放绘制包络（2026-10-21 未发布候选）

`desktop/visual-bounds.js` 从原始猪定位盒、宽立绘留白与 `feelEnvelope` 推出固定绘制范围；动作变换中心仍是原定位盒。启动位置、拖动、飞行和活跃时的原生 shape 使用同一包络，home 与面板依然按脚底中心定位。连接的屏缝可以穿过，错位屏幕的空白不能作为可绘制区域。初始存档贴边时只向可容纳完整绘制范围的位置夹取，稳定后重复测量不能漂移。

新外壳声明 `piggyShell.dragVisualBounds === true`。没有传 `visual` 的旧游戏包沿用原方形定位盒夹取；旧外壳忽略新字段，游戏仍能运行，但拖到边缘的预防修复需要更新并重启外壳。不要把这项能力写成已经包含在已发布 0.6.7 中。

不能用松手后无条件清空 `commitSlide`/anchor 代替源头限制：实际原生录像已证明这种候选会引入单帧位置交接跳动。既有坏 anchor 通过同存档重启恢复；本轮不做运行中强制清零。验证范围和仍开放的快拖、混合缩放问题以 ROADMAP 为准。

拖动期间只有外壳 `dragTick` 拥有窗口位置与绘制形状。页面 `tick` 的统一入口必须拦住拖动和飞行，不能只在定时器/调度器里拦；直接的菜单、尺寸或动作几何回调也走同一约束。外壳用既有 `dragSession` 拒绝拖动期间普通 `place` 写入，不另设第二套拖动状态。`place({})` 始终是只读几何查询：保留现代能力握手，但不清空 slide、不退出整窗绘制形状、不触发落地提交。松手仍按原 IPC 顺序读取最后几何并交接。

同尺寸也有新旧画面交接：`commitSlide` 把 translate 交回布局后，第一份精确 shape 不能立刻裁剪仍在显示的旧缓冲。Linux 在退出 `dragShapeActive`/`flightShapeActive` 的第一次带 shape 提交中，复用 `resizeShape.begin(bounds, true)` 等新帧；只传 shape、未传 bounds 的提交同样处理。新的拖动/飞行取消旧订阅，精确形状只在目标画面到达后恢复。定向 VM 记录的订阅耗时 3–18ms、随后均结束，减少动态和零 slide 也已验证；不增加常驻帧捕获，不修改动作节奏。
