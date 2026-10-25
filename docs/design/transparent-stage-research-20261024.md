# 整屏透明舞台研究复核（2026-10-24）

本轮用户要求先研究整屏透明舞台，新农场问题等后续反馈。本轮只核查源码、既有实验和官方 API，运行纯逻辑测试；没有启动 GUI、替换本地运行包或发布。执行状态仅维护在 ROADMAP T1，本页记录设计依据与验收条件。

## 结论与建议

继续沿用现有可选 `--window-mode=stage` 候选研究：单个透明工作区窗口、单个游戏 renderer，共享猪、气泡和小面板；扩展大界面保留独立普通窗口。这样猪与小面板的位置交接由同一页面承担，减少跨原生窗口同步。它不能自动解决输入命中、多屏和缩放问题。

不建议现在另写一套游戏或直接切换默认架构。先验证既有候选的真实交互和异常释放；若跨屏大窗口不能满足混合 DPI，再评估每显示器一舞台的方案。后者需要明确交接状态、唯一游戏所有者和去重，不能只按窗口数量判断优劣。

## 当前代码究竟做到哪里

| 能力 | 代码事实 | 证据边界 |
|---|---|---|
| 可回退入口 | launcher + lib/window-mode 显式 stage，默认 split | 本轮入口测试通过，未替换本地 |
| 一页承载猪、气泡、面板 | stage/bootstrap 挂真实游戏，stage-bridge 注册受限适配器 | 已有实现，不代表布局与所有操作验收通过 |
| 屏边气泡与回复 | 适配器复用 bubble-fit，含屏顶下置、尾巴、菜单避让 | 几何测试通过，需长文、缩放、按住跨到期原生验证 |
| 抛掷与落地位置 | 复用 feel flight，落地写回 ctx、位置偏好及桌面脚底 | 旧“未写回”问题已有修正，真实飞行录像仍欠缺 |
| 扩展大窗与猪反应 | openBigTarget 三路分发；白名单 FX 交给真实 ctx 方法 | 不再仅依赖按钮属性，需第三方扩展与实际互动验收 |
| 跨屏几何 | 工作区外接矩形为原生窗口；空洞由工作区并集判断 | 负坐标、相邻屏和空洞纯逻辑通过，混合 DPI、拔插未实测 |
| 穿透与异常恢复 | Linux setShape；其他平台光标命中与 ignoreMouseEvents；交互租约 | 不能将租约单测等同整屏输入恢复验收 |

此前 ROADMAP 的“气泡/位置同步/通用扩展/反应转发缺口”需要更准确地表述为：已有补代码，未完成整体验收。代理修正报告也明确没有运行 GUI，不能据报告宣布完成。

## 本轮新识别的风险

1. **整屏输入接管过宽。** bootstrap 的 onPointerDown 对整个游戏 host 内的点击都启用 interacting，包含菜单按钮，不限拖猪。presenter 在 interacting 时将整个窗口作为可点区域；抛掷同样保持。应通过虚拟机底层点击计数核查普通按钮按下、拖动、飞行、松手后各阶段，不能只测静止空白穿透。
2. **3秒租约不等于丢松手后3秒恢复。** 页面每1秒自动续租；若仅漏 pointerup、页面仍正常运行，续租会继续，页面20秒守护才是另一层释放条件，pointermove 又会延长守护。3秒主要约束页面停止续租的情形。需要分别验证事件丢失、渲染器挂起和失焦；上述为代码推导，尚未在 VM 复现。
3. **绘制与输入耦合。** Linux 的 shape 同时裁绘制与命中。草稿用临时整窗避免飞行裁边，不能直接缩小 shape 来优化输入，否则可能重现裁切。需评估捕获策略与实际动画包络，明确交互结束时的帧交接。
4. **空白穿透不等于键盘释放。** 透明窗口 focusable=true；官方说明 ignoreMouseEvents 后有焦点仍会接键盘。必须验证回复输入、取消输入、Alt-Tab、点回其他应用，以及扩展打开/关闭后的焦点。
5. **扩展尺寸分支已经落后。** stage/main 的 createExtWindow 仍固定 minWidth=720/minHeight=480，没有采用 split 刚加入的 extension-window-geometry helper。高缩放小工作区可能再次出现超界。需统一到现有几何源后验证，本轮未改代码。
6. **平台差异。** 草稿在 Linux 上使用 setShape，Windows/macOS 使用命中轮询；官方 setShape 当前标注 Windows/Linux Experimental，不能以 Linux 通过推定其他系统通过。GNOME Wayland 会话中的 X11/XWayland 结果也不能证明原生 Wayland 同样可用。
7. **显示面积与资源。** 一个跨屏外接矩形可能包含大片屏间空洞；即便一个 renderer，也不保证更少 GPU 资源。必须测双4K、错位屏与隐藏/恢复，不能推广单屏800px实验。

## 已有实验与本轮复核

2026-10-22 隔离实验，Electron 44.5.1、1280×800/DPR1、同游戏包和同存档副本，每组约60秒、60样本：双窗口/单舞台 CPU 均值2.290%/2.277%，工作集合计739.88/562.31 MiB，GPU进程工作集141.86/147.57 MiB。进程工作集合计可能重复共享页，顺序短采样不能证明普遍节省资源。该实验是早期独立原型，不能作为当前 stage 完整候选的验收或资源数据。

本轮运行以下现有纯逻辑测试：37通过、0失败、0跳过。未运行本轮原生 VM 测试，未新增截图或声称 UI 验收。

```sh
node --test apps/desktop/test/desktop-stage-geometry.test.js apps/desktop/test/desktop-stage-bridge.test.js apps/desktop/test/window-mode.test.js
```

## 候选验收矩阵

| 范围 | 虚拟机原生验证方式 | 通过条件 |
|---|---|---|
| 桌面输入 | 底层独立计数窗，静止/按钮按住/拖动/飞行/松手/异常中断逐段点击 | 非交互区符合明确策略；释放后底层点击成功；记录最长阻塞时长 |
| 拖放与飞行 | 真鼠标慢拖、快拖、四边/角落，录屏逐帧 | 完整绘制，无单帧消失；落地后轮询、开菜单、重启不弹回 |
| 气泡 | 长文、不同字号/体型、屏顶/底、菜单同开、回复跨自动到期 | 正文/回复可见可点，恰好一次请求与反馈，猪不被布局移动 |
| 扩展与焦点 | 至少一个通用 app.openBig 扩展；大窗返回、反应转发、输入与 Alt-Tab | 不误走网页铺满；反应真实到猪；焦点可恢复 |
| 位置和回退 | 旧 split 偏好副本→stage→split；分辨率改变与显示器拔插 | 同一脚底位置在可用区，偏好可读，养成数据不变 |
| 多屏与缩放 | Windows 100/125/150/200%，负坐标、上下错位、混合 DPI | 无空洞落点、坐标漂移、超屏扩展窗；记录实际显示配置 |
| 资源 | 当前双窗口与当前候选，同档同包重复交错采样 | 分开报告 CPU、内存口径、GPU、静止/动画；不只引用旧原型 |

所有 GUI 操作、截图和录屏只在虚拟机；操作走原生鼠标键盘，页面调试只读。保留双窗口回退，全部通过前不宣称可正式替换。先完成 Linux 当前候选闭环，再验证 Windows 高缩放和多屏；macOS 没有环境时明确保留未验证状态。

## 来源

- 仓库：apps/desktop/{launcher.js,stage/{main,bootstrap,present,lease,geometry}.js}；src/client/stage-{bridge,shell,position}.js。
- 修正承接报告：/tmp/piggy-next-20261023/stage-fix-report.md，仅作定位线索，结论已对照源码。
- 早期实验：/zyx/agents/codex/deliverables/piggy-tonight-20261022/stage-experiment/evidence/ASSESSMENT.md。
- Electron 官方 [setShape](https://www.electronjs.org/docs/latest/api/base-window#winsetshaperects-windows-linux-experimental)：形状同时约束绘制与输入。
- Electron 官方 [setIgnoreMouseEvents](https://www.electronjs.org/docs/latest/api/base-window#winsetignoremouseeventsignore-options)：鼠标穿透与键盘焦点的差别，以及平台应用时机。
