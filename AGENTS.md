# AGENTS.md — 给接手开发的人和 agent

先读这一页，再按需要读下面链接的文档。这里只放「不知道就会做错」的东西。

## 这是什么

**dsh-piggy**：一只养在桌面上的小猪（复刻 QQ 宠物的玩法，界面是动森 NookPhone 风格）。同一份代码两种形态：

- **DSH 插件**（网页面板）：根目录 `index.js` / `routes.js` / `store/` 是宿主，`src/client/` 打包成 `client.js`。
- **桌面版**（Electron）：`apps/desktop/` 是外壳，内置一份游戏包（Gitee 的 Windows 安装包除外：首次启动下载，见 HANDOFF 9.4）；游戏包可单独热更新，外壳要下载安装包更新。

| 目录 | 内容 |
|---|---|
| `packages/pet-core/src/` | 养成规则（`data/` 数值表、`core/` 纯函数），两种形态共用 |
| `store/`、`index.js`、`routes.js`、`snapshot.js` | 存档、HTTP 路由、给面板的快照 |
| `src/client/` | 面板界面（构建成 `client.js`，**改了源码要 `npm run build` 并提交 `client.js`**） |
| `apps/desktop/` | 桌面外壳（主进程、preload、打包配置） |
| `extensions/<key>/` | 在线扩展（菜园、矿洞、扭蛋、盲盒），玩家下载安装 |
| `assets/` | 游戏里的图和字体；每类放哪、怎么命名、出处见 [docs/ASSETS.md](docs/ASSETS.md)（新增素材要登记，测试会查） |
| `docs/` | 文档；`docs/ROADMAP.md` 是**唯一的待办清单**，`docs/numbers/` 是用户确认过的数值单，`docs/archive/` 是历史文档（不再更新） |

## 红线（必须先问用户）

1. **数值、台词、玩法、成就名单、界面布局**都由用户拍板。先出稿（数值单 / 审稿单 / 截图），用户确认后再写代码。
   「规则改了」不等于可以顺手改界面。
2. **大功能先出完整设计**给用户确认再整体做；修 bug 的版本只修 bug，不夹带新功能、不「预留」半成品。
3. **提交信息不署 AI 名字**（不加 Co-Authored-By 等）。格式见 [CONVENTIONS.md](docs/CONVENTIONS.md)「Git」。
4. **发版**：用户验收通过后才发；发版前 CHANGELOG 写好该版小节、README 同步（文字和截图）；GitHub、Gitee 两个渠道都要齐；**Gitee 一律从维护者本机推**（`scripts/gitee-publish.sh`），不让 GitHub Actions 往 Gitee 推。
   **npm 由维护者手动发**，不要替他发。步骤见 [HANDOFF.md](docs/HANDOFF.md) 第 9 节。
5. **不提交凭据**：令牌（如 `GITEE_TOKEN`）由维护者在命令里给，不写进任何文件；测试机账号密码不进仓库。
6. **emoji**：本项目以 emoji 为主——界面图标、物品、气泡、特效、游戏数据都可以用 emoji，参考项目里「不许用 emoji 当图标」之类的规定不适用。
   **不许用 emoji 的是给用户的回复和汇报**（聊天里说明进度、总结时不用）。代码注释、日志、提交信息也不用（见 CONVENTIONS）。
7. **参考项目和本项目冲突时，一律以本项目现在的做法为准**（设计系统、组件库、动效库都是）。
8. 改存档结构必须加迁移（`core/upgrades.js` + `STATE_VERSION` + 迁移测试），旧存档不能丢数据。
9. **需要图就直接用 AI 出**：立绘、动作图、图标都可以用你自带的生图工具（如 codex 的 `image_gen`）出，不用手画、不用描成 SVG。
   交**透明底 PNG**（离线抠底，不靠运行时滤镜）、缩到显示尺寸约 2 倍（立绘长边 ≤ 256px）、记 `PROVENANCE.md`；**图要用户过目才进 `assets/`**。
   规格见 [adding-features.md](docs/guides/adding-features.md) 3.5。

## 做事的方法

**完整版：[docs/guides/how-to-work.md](docs/guides/how-to-work.md)（接手前先读）。** 下面是要点：

1. **复述需求再动手**。分清「例子」和「需求」；能从代码/文档判断的自己判断，真有分歧一次问清；
   数值、文案、界面、花钱、删东西、对外发布、改别人的东西 → 先出方案等用户拍板。
2. **先看见问题，再动手**。拿到证据（日志/录屏/报错原文）再推理；**在问题发生的条件下复现**
   （Windows 125% 的问题在 Linux 上「测不出来」= 没测对地方）；**修前先量一个基准**，修后用同一方法再量一次；
   先用旧版本复现，证明你的测试抓得住这个问题。
3. **找根因，不找症状**。问到「一个机制能解释所有现象」为止；**猜测要用数据或模拟检验，不成立就扔**；
   同一类问题修了几轮还在冒 → 停下换结构、不要叠补丁；**不在上一轮结果上累加**（位置、尺寸、计数从源头重算）；
   不用「兜底」掩盖真问题。
4. **先查手边的，再查外面的**。写新的之前先 `grep` 代码 / 翻 `docs/` / 看 git 历史（`git log -S`），
   项目里往往早有工具和约定、上一轮也已经踩过；外面的资料**要一手来源**（官方文档、源码、LICENSE 原文、
   接口真实返回），搜索摘要只是线索；重要结论**交叉验证**，查不到就说查不到、别编。
5. **选最简单的做法**。先读现有代码和约定照着用；需要「巧妙」才能成立的方案多半没找到本质；
   卡住两三次就换思路（查官方文档/源码/别人怎么做），别加力度；改动范围和需求对齐（修 bug 就只修 bug）。
6. **同一个机制，所有地方一起看**。这份代码跑在网页和桌面两个窗口、Windows 和 Linux 上——
   修一处要把这些地方都过一遍；**能静态守住的规矩写成测试**（只写在文档里会被忘）。
7. **验到用户眼睛看到的那一层**。「测试通过」≠「显示正确」；过程类问题（拖动/动画/转场）**要录屏逐帧看**，
   只比起点终点会漏掉中间的 bug；用真实路径验证（真实接口、真实鼠标）；**结论要带数字**
   （「修前最远 204px，修后 90% 的帧 ≤2px」），不是「好像好了」；没验证的明说没验证。
8. **分寸**：删/覆盖/发布/改共享的东西之前先确认，并看清要动的是什么；**先上新、核对无误再删旧**；
   要权限账号的步骤计划阶段一次问清；凭据不进仓库/日志/文档；被别的事打断要主动说。
9. **收尾**：汇报讲清「做了什么、怎么验证（带数字）、没做什么、还要用户定什么」；把坑写进文档或长期记忆；
   **清理自己开的东西**（临时会话、后台进程、测试机、**测试产生的文件**）。

## 常用命令

```sh
npm install --no-save --package-lock=false esbuild@0.28.2 typescript@5.9.3 @types/node@20.19.43   # 首次
npm run build        # src/client → client.js
npm test             # 全部测试（含规范检查、台词/成就/扩展目录守卫）
npm run typecheck
cd apps/desktop && npm install && npm start           # 跑桌面版
```

## 文档地图

| 想做什么 | 读这个 |
|---|---|
| 了解现状、发版流程、测试机 | [docs/HANDOFF.md](docs/HANDOFF.md) |
| **现在该做什么、有什么待用户决定、已知问题** | [docs/ROADMAP.md](docs/ROADMAP.md)（做完一项就更新它） |
| 加图、找图、图的出处 | [docs/ASSETS.md](docs/ASSETS.md) |
| **做任何新功能**（新玩法、音效、动画、走路、动图、联网……）：流程、放哪、预留的扩展点、完工清单 | [docs/guides/adding-features.md](docs/guides/adding-features.md) |
| 编码规范、提交格式 | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| 写/改在线扩展 | [docs/guides/writing-extensions.md](docs/guides/writing-extensions.md) |
| 给猪加台词 | [docs/guides/adding-lines.md](docs/guides/adding-lines.md) |
| 加成就和徽章 | [docs/guides/adding-achievements.md](docs/guides/adding-achievements.md) |
| 改面板、按钮、扩展页面的样子（新组件先查动森 UI 设计系统 animal-island-ui 的规格） | [docs/guides/ui-style.md](docs/guides/ui-style.md) |
| 做动画、手感、爆点特效、手绘点缀、配色计算（先用 Motion、mo.js、Rough.js、Chroma.js 等成熟库，别自己造轮子） | [docs/guides/motion-libraries.md](docs/guides/motion-libraries.md) |
| 改桌面窗口、拖动、IPC | [docs/guides/desktop-architecture.md](docs/guides/desktop-architecture.md) |
| 玩法和数值的来源、视觉规范的来源 | [docs/DESIGN.md](docs/DESIGN.md) |
| **参考过哪些项目**（玩法、卡片、界面、动效库……各自许可和能怎么用；做新东西先查） | [docs/guides/references.md](docs/guides/references.md) |
| 立绘、皮肤（可以直接 AI 出图，规格见 adding-features 3.5） | [docs/ART-SPEC.md](docs/ART-SPEC.md)、[docs/guides/skin-pack-format.md](docs/guides/skin-pack-format.md) |
| 画「千奇百怪的小猪」（猪 + emoji 主题） | [docs/design/pig-kitchen-art.md](docs/design/pig-kitchen-art.md)（规范、许可、验收；图要用户确认） |
| 开发环境、打包、Gitee 渠道 | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
