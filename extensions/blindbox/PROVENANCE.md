# 盲盒薄卡界面（4.0 候选）

2026-10-22 用户确认 `card-draw-concept-v5` 的单抽概念（薄卡从卡列中抽出、卡面由磨砂变清晰），并要求按同一语言补齐卡池与十连。概念图与审稿记录：

- 已批概念：`/zyx/agents/DSH/workspaces/dsh-piggy/tasks/results/next-iteration-20261021/review-20261022/card-draw-concept-v5.png`
  （SHA-256 `51d0bc2524f2aee4181adbf0ca4d64a075595af08029848a6375d2fc0b696c3a`）
- 独立动效预览（只作参考，不进扩展）：`/zyx/agents/codex/deliverables/piggy-plan-20261022/card-preview/`
- 设计记录：`docs/design/next-iteration-20261021.md`「盲盒独立采用 RhineLabUI 视觉」小节。

## 本版实际使用的东西

- 扩展里**没有新增图片**。卡面物品用 server.js `CATALOG` 里已有的 emoji（内置 emoji 字体，来源与许可见 `assets/PROVENANCE.md`、`THIRD-PARTY.md`）；卡壳、磨砂、暖灰纸底、内衬高光、阴影全部是扩展里的原生 CSS。
- 没有引入 WebGL / three.js / 预览工程的任何代码。预览里的 `whale-art.png`（SHA-256 `30379020aa2c9c37076e64d1d0e044005d5966032e5ded9b356dba387fe17676`）是独立预览的示意插画，**没有**打包进扩展，也没有贴成整张卡面或整页背景。
- 卡列透视用 CSS `perspective` + `rotateY` + `translateZ`；揭晓用 `transform`/`opacity` 合成动画，按「结果 id + 开始时间」算负延迟，轮询重画接着播。没有 RAF 循环。

## 概念与实现的差别（避免把稿件当成实机）

- 概念图是 1536×1024 的 2D 渲染，光影、景深、纸张颗粒是画出来的；实现是 CSS 3D 的分层近似，暖灰纸底、薄卡厚度、磨砂/清晰分区照概念走，但不承诺同样的物理光照。
- 概念图里的鲸鱼插画是示意；实机卡面是当前已批准的 emoji 物品（大鲸鱼就是 🐳 + 名字 + 星级），六星用金色描边和 CSS 星点庆祝。
- 卡池、十连的排版是本版新做的：概念稿只审了单抽。小窗上下结构（卡在上、结果与按钮在下），大窗（`bx-big`）卡在左、结果和按钮在右。

## 未做 / 待审

- 美术插画（把 emoji 换成逐张绘制的卡面）没有做，等用户另审。本版是完整可运行的代码候选，不是最终美术。
- 独立预览的软件渲染帧率（VM 下 41 帧、66～83ms 帧间隔）没有沿用，也没有在真实桌面窗口里做逐帧录屏验收；本版只有源码级行为测试和静态样式守卫。
