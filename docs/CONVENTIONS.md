# 编码规范（项目版）

这份是通用规范在本项目的落地版。**通用规范是参考，这里才是执行标准**；两者冲突时以本文件为准。

项目的性质决定了三处偏离通用规范，都写明了理由：

| 通用规范 | 本项目 | 为什么 |
|---|---|---|
| 文件 ≤ 约 400 行 | 源码、外壳模块（`apps/desktop/lib/`）、在线扩展都遵守；**豁免**：构建产物 `client.js`、外壳主进程 `apps/desktop/main.js`（约 1000 行，待拆，见 HANDOFF） | `client.js` 是 esbuild 产物；`main.js` 里窗口、拖动、面板、IPC 共用一堆 Electron 全局对象，拆分要重新做两个平台的真机验收 |
| 注释/标识符/日志不用 emoji | 代码里不用；**游戏数据、界面文案、CHANGELOG、README 保留**；在线扩展注释里的 ★（星级）保留 | 这个项目就是用 emoji 做的，`data/` 里的 emoji 是内容不是装饰 |
| 不引入构建步骤 | **允许**，且只用于客户端插件 | DSH 的客户端插件按 classic `<script src>` 加载，不打包就没法拆文件 |

## 先读哪些

- 人和 agent 的总入口：仓库根目录 [AGENTS.md](../AGENTS.md)（红线、流程、文档地图）。
- 「怎么加 X」：`docs/guides/` 下的 [writing-extensions](guides/writing-extensions.md)、[adding-lines](guides/adding-lines.md)、
  [adding-achievements](guides/adding-achievements.md)、[ui-style](guides/ui-style.md)、[desktop-architecture](guides/desktop-architecture.md)。

## 分层

依赖只能从外向内：`data/` → `core/` → `store/` → 组装层 → `src/client/`。

`data/` 和 `core/` 在 `packages/pet-core/src/` 下，是 DSH 插件和以后独立版共用的库（`@dsh-piggy/core`），
根目录 `core.js` / `data.js` 只做再导出。库的边界由 `test/core-boundary.test.js` 守住。

| 目录 | 职责 | 禁止 |
|---|---|---|
| `data/` | 静态数值表、常量 | 逻辑、IO、`Date.now()` |
| `core/` | 纯领域函数：`(state, ..., nowMs) => result` | 读写文件、发请求、操作 DOM、自己取时间 |
| `store/` | 存档读写、原子写、迁移 | 业务规则 |
| `index.js` `snapshot.js` `commands.js` `routes.js` | 组装：注册路由/命令、把状态序列化成面板用的形状 | 堆积业务规则 |
| `src/client/` | 渲染与交互 | 自己重算业务规则（只读快照字段） |

- 时间是外部输入，**必须作为参数传进 `core/`**。
- 随机数用 `core/random.js`（种子存在 `state.seed`），领域层禁止 `Math.random()`。
- 改存档结构：`core/upgrades.js` 表尾加一级 + `STATE_VERSION` +1 + 迁移测试。
- 数值集中在 `data/`，不许在逻辑里写裸数字。
- **金币只能走 `core/economy.js`**（`earnCoins` / `spendCoins` / `refundCoins`，写上来源）：账本靠它记，`test/economy.test.js` 拦着直接 `coins +=` / `-=`。规则见 [经济体系](design/economy.md)。
- 文件超过 400 行、或开始承担第二种职责，就拆。

## 命名

- 变量/函数 `camelCase`，类/类型 `PascalCase`，常量 `UPPER_SNAKE_CASE`，**新文件名 kebab-case**。
- 布尔值 `is`/`has`/`can`/`should` 开头；函数名用动词短语。
- 同一概念全项目同一个词：一律用 `fetch`，不要混 `get`/`retrieve`。
- 不用单字母变量（循环下标除外）；不用自造缩写（`id`/`url` 除外）。

## 函数

- ≤ 40 行、≤ 3 个参数（超出改对象参数）、嵌套 ≤ 3 层，优先 early return。
- 纯函数优先：返回新对象，不改入参。
- 有副作用的函数名字里体现：`writeStateFile`、`registerRoutes`。
- 数值计算处理边界：不留负数、`NaN`、越界。

## 类型

- Node 侧与客户端源码**每个文件开头 `// @ts-check`**，导出函数写 JSDoc（参数 + 返回）。
- 核心数据结构用 `@typedef` 定义，放在它的数据表所在模块（如 `data/shop.js` 的 `ShopItem`）。
- 外部输入（`state.json`、请求体、DOM 快照）先当 `unknown`，校验后再用。
- **不引入 TypeScript 编译**；用 `npm run typecheck`（`tsc --noEmit --allowJs --checkJs`）检查，源码首行写 `// @ts-check`。
- 当前 `noImplicitAny` 关着：先抓"属性不存在、参数类型不对"这类真错误，等 JSDoc 补齐再逐级收紧（脚本里有注释说明）。

## 错误处理

- 禁止空 `catch`，禁止 `catch { return false }` 这种吞错。
- 错误信息带上下文与关键参数：`buy failed: item="apple" coins=3 price=6`。
- 分开两类：
  - **业务拒绝**（余额不足、条件不满足）：返回 `{ ok: false, reason }`，不抛异常。
  - **系统异常**（文件损坏、写入失败）：记录日志 + **保留现场**（`.bak`），绝不静默覆盖或丢弃用户数据。

## 数据与兼容性

- 持久化数据带 `STATE_VERSION`；结构一变就加迁移函数 + 迁移测试。
- 旧存档必须能自动迁移，不丢数据。
- 写文件原子化：临时文件 → `fsync` → `rename`（`store/state-file.js`）。
- **产物新鲜度**：`client.js` 必须与 `src/client/` 一致，由 `test/bundle.test.js` 守住。

## 测试

- 修 bug 先写能复现的失败测试，再修代码。
- 新逻辑覆盖正常路径 + 边界（空值、0、上限、极端时间跨度）。
- 测试不依赖真实时钟、网络、执行顺序。
- **UI 改动必须在真实浏览器确认**（浏览器打开 `tools/preview.html`，或桌面版里看），测试通过 ≠ 显示正确。
- **桌面窗口/拖动改动必须真鼠标拖 + 录屏逐帧看**（[desktop-architecture.md](guides/desktop-architecture.md)「怎么验收」），只比起止坐标会漏掉中间的跳动。
- 能静态守住的规范写成测试（`test/conventions.test.js`、`lines-guard`、`achievements-guard`、`extensions-registry`），别只写在文档里。
- 提交前 `node --test` 全绿。

## 注释

- 只解释"为什么"，不重复"是什么"；公共函数写文档注释。
- **注释用中文**（新代码一律中文；老代码里的英文注释改到那段时顺手换，不专门批量改）。
- 代码标识符、注释、日志、提交信息不用 emoji；界面、文案、`data/` 游戏数据以 emoji 为主，随便用。给用户的回复和汇报不用 emoji。
- 每个文件开头一段中文说明「这个文件管什么、为什么这样」；踩过的坑写进对应代码的注释（带日期），别只留在聊天里。
- `TODO` / `FIXME` 带日期和原因。

## Git

- 格式：`<type>(<scope>): <中文描述>`，正文中文，写清「为什么」和怎么验证的。
  - type：`feat|fix|refactor|test|docs|style|perf|chore`。
  - scope 按模块（可省略）：`desktop`（外壳和桌面页面）、`panel`（面板界面）、`core`（养成规则）、`lines`（台词）、
    `ach`（成就）、`ext`（扩展宿主）、`ext-<key>`（某个在线扩展，如 `ext-farm`）、`store`、`release`（发版流程/工作流）。
  - 例：`fix(desktop): 开着面板拖猪，面板越跑越远（Windows 分数缩放）`。
- 发版提交：`release: vX.Y.Z — <一句话>`（版本号、CHANGELOG、README 同步都在这一个提交里）。
- **不署 AI 名字**：提交信息里不加 Co-Authored-By 之类的 AI 署名（维护者要求）。
- **每个提交只做一件事**，重构与功能不混提。
- 用户能感知的变化必须更新 `CHANGELOG.md`。
- 不提交本机绝对路径、临时文件、无关文件。
