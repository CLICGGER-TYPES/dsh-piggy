# 只读布局检查

按任务单的 QA-SPEC 第5～7节执行；脚本零问题后，才能走真实玩家流程、逐张查看截图并写 PLAYTEST.md。脚本通过只表示几何检查通过，不能代替过程连拍、文字对比度和操作验收。

```sh
node tools/layout-audit-visible.mjs http://127.0.0.1:19346 /tmp/layout-report.json
```

使用提供全局 WebSocket 的 Node 运行（本次校验环境为 Node 26）。连接已有 CDP 实例，逐页只执行 Runtime.evaluate 读取布局；不打开页面、不点击、不调用游戏接口、不改 DOM、存档或窗口尺寸。尺寸与界面状态必须通过真实操作提前准备。Windows 是否可测以任务单授权为准，禁止拿其他运行实例的存档替代新开局。

JSON 包括：同层控件/标签/气泡/进度条重叠对及面积、装饰覆盖候选、附属元素漂移、被裁切文字、渲染字号、中心命中、过小图标/点击区域、越出窗口或裁切容器的元素。隐藏页签和完全在裁切区外的轮播页单列 skipped，不把不可见页上的控件当作当前可点按钮。

已有台词、签到气泡、番茄角标允许按 CSS 约定偏移挂在对象外侧；匹配到的例外单列 fixedOffsetExceptions，其中签到默认位置明确按场景上方7/16px及3px呼吸幅度核对。不要给其他对象添加宽泛豁免。装饰在较低层或同层较早绘制的情况列 backgroundExceptions，仍须截图核对；透明 PNG 的矩形候选也要逐项核对，不用中心命中取代所有装饰覆盖检查。

`passed`：至少一个实际可见页面，所有计数为0。`failed`：发现布局问题。`incomplete`：连接失败、读取失败或没有可见内容。后两种退出码均为1；没有页面绝不算通过。不要把本地伪造宿主预览或检测器校验样例当作实机验收。

场景内组件用现有语义类识别。新增标签、进度条、装饰或图标应声明 `data-layout-label`、`data-layout-progress`、`data-layout-decoration`、`data-layout-icon`，并为新的附属对象补明确归属；仅靠文字猜测对象归属容易误判。

## 静态子集门禁（npm test）

完整审计要连真实 CDP 页面；为了在无桌面的 `npm test` / CI 里也守住最容易回归的两条，仓库增加了静态子集：

```sh
node tools/layout-lint.mjs        # npm run lint:layout，打印当前违例
node tools/layout-lint.mjs --write-baseline
```

- 阈值：`tools/layout-metrics.mjs` 的 `MIN_TEXT_PADDING = 6`（和本指南素材内边距的普通场景 6px / 大场景 8px 同口径）、`MIN_CONTROL_GAP = 4`。改小阈值等于掩盖违例，`test/unit/client/layout-rules.test.js` 会盯住。
- 范围：`src/client/css-*.js` 与 `src/extensions/*/client/styles.js`；只检查自己声明了上下 `padding` 的带底/带框可点文本控件，和 flex/grid 操作区的 `gap`。只补横向 padding 的继承子规则不误伤。
- 基线：`tools/layout-baseline.json` 是 2026-11-28 的当前违例快照；测试只拦“新增违例”，已存在的紧凑控件先记录不改，避免为了变绿偷偷降阈值或大改用户已接受的布局。修好一条后可重新生成基线。
- 这是静态子集，不检查遮挡、命中、裁切、字重和真实字号，也不能代替上面的 CDP 实机审计。

## 文案预算

`test/helpers/copy-budget.js`（`npm run lint:copy`）用现有假 DOM 把左轮轮盘所有可渲染界面挂起来，统计每条直接文本的中文字数，单条上限 18；规则页长文排除。`test/unit/client/copy-budget.test.js` 跑同一套口径，超预算直接失败。
