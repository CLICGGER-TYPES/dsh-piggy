# 重构计划（阶段 0–3）

目标：让代码符合 [CONVENTIONS.md](../CONVENTIONS.md)，**不改任何行为**。

原则：每一步独立提交、测试全绿、仓库随时可跑。Node 侧拆分后**保留同名 barrel**，
`import ... from '../core.js'` 这类路径一行都不用改 —— 这是把风险压到最低的关键。

## 进度（2026-09-30）

| 阶段 | 状态 | 提交 |
|---|---|---|
| 0 构建管线 | 完成 | `71f93df` |
| 1 data 拆 9 模块 + barrel | 完成（导出面 68→68） | `0f45945` |
| 1 存档损坏保留现场 | 完成（先红后绿 2 例） | `9cf960f` |
| 1 领域层时间参数化 | 完成（core 已零 `Date.now()`） | `4226eb7` |
| 1 注释去 emoji + 静态守卫 | 完成 | `f6047c4` |
| 1 core.js 拆 15 模块 | 完成（导出面 80→80） | `4c48db5` |
| 1 index.js 拆 snapshot/commands/routes | 完成（导出面 15→15） | `48a829c` |
| 1 store.js 抽出 state-file + api | 完成 | `3722e7b` |
| 1 文件行数守卫 | 完成 | `test(pig)` 提交 |
| 2 客户端抽出 styles/constants/values/normalize/storage/dom | 完成（index.js 2192→1397） | `6f7ea8e` |
| 2 客户端页签与外壳拆分 | 完成（index.js 2192→354） | `129f81b` `993666d` `3c01c27` |
| 3 类型收尾（typecheck + @ts-check + JSDoc） | 完成（0 错误） | 本轮 |

**阶段 3 已完成**：`npm run typecheck` 零错误，源码全部带 `// @ts-check`。

**阶段 2 已完成**：客户端与 Node 侧都没有超过 400 行的文件，全部模块化。

**阶段 1 已完成**：Node 侧没有任何文件超过 400 行（最大 351），全部导入路径保持不变。

## 阶段 0：构建管线（先建管线，不动代码）

| 项 | 内容 |
|---|---|
| 产物 | `client.js`（现状不变，仍是单文件） |
| 源码入口 | `src/client/index.js`（先只包一层，内容逐步搬） |
| 工具 | esbuild 0.28.1（harness 内已离线可用，JS API 实测通过） |
| 脚本 | `node scripts/build-client.mjs` |
| 守卫 | `test/bundle.test.js`：重新打包与已提交产物逐字节比对，不一致就失败 |
| 命令 | `npm run build` / `npm test` / `npm run typecheck` |

验收：`node --test` 全绿；故意改一行源码不重打包 → 产物测试失败。

## 阶段 1：Node 侧拆分（保留 barrel）

| 现在 | 拆成 | 备注 |
|---|---|---|
| `data.js` 714 | `data/{minutes,traits,life,illness,jobs,school,interests,travel,shop}.js` | 纯表，零逻辑 |
| `core.js` 1659 | `core/{effects,clock,activity,decay,growth,care,study,interests,work,travel,mood,state,migrate,views}.js` | `decay.js` 同时装 `finishActivity` 与四个 `finish*`，避免与 `activity.js` 循环依赖 |
| `index.js` 695 | `snapshot.js` `commands.js` `routes.js` + 精简的 `index.js` | `index.js` 仍是包入口，只做组装 |
| `store.js` 273 | `store/state-file.js`（读/原子写/保留现场）+ `store.js` | |

同时并入三件小修（各自独立提交）：
1. `fix(pig): 存档损坏时保留现场` —— 现在 `load()` 是裸 `catch { return null }`，文件一坏猪就静默消失。
2. `refactor(pig): 领域层的时间改为参数` —— `core/` 里 7 处 `Date.now()` 全部去掉。
3. `style(pig): 去掉注释中的 emoji` —— 15 处（游戏数据与界面文案保留）。

验收：`node --test` 全绿；导入路径零改动；插件在真实 DSH 里仍能加载。

## 阶段 2：客户端拆分 + 打包（唯一可能返工的一步）

`src/client/` → `{styles,art,store,api,normalize,shell}.js` + `tabs/{status,study,work,shop,travel,bag,dev}.js`，
`client.js` 变成产物。

验收：每个文件 ≤ 400 行；`tools/preview.html` 六个页签 + 调试页逐一在真实浏览器看过；
bundle 新鲜度测试通过。

## 阶段 3：收尾

- 新的 `core/`、`data/` 模块补齐 `// @ts-check` + JSDoc；`@typedef` 集中到 `core/types.js`。
- `node scripts/typecheck.mjs` 进提交前检查。
- 旧文件（`render.js` 等）按"碰到就补"的原则逐个补类型，不做一次性全库标注。

## 不做的事

- 不改任何游戏数值、界面文案、存档结构（`STATE_VERSION` 保持 7）。
- 不回改历史提交信息。
- 不为"将来可能用到"抽抽象层。
