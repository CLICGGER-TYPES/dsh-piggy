# dsh-piggy 维护交接文档（2026-10-07，v0.33.1 / 外壳 0.6.1）

> 给接手维护的 DeepSeek / 任何 agent / 开发者。最短的入口是仓库根目录的 [AGENTS.md](../AGENTS.md)（红线和文档地图），这一页是完整的现状和流程。
> 本页取代 [2026-10-03 的交接记录](HANDOFF-2026-10-03.md)（那份停在 v0.27，只作历史参考）。
> 有冲突时以：用户最新的话 > 本页 > 其它文档 > 旧任务卡 为准。开工前先看最新 `git log`，别假设还是本页写的状态。

---

## 1. 先读这里（五分钟版）

- **是什么**：一只「QQ 宠物」式的电子猪。同一份代码有两种形态：**DSH 插件**（住在 DeepSeek Harness 网页里）和**桌面版**（Electron，Windows / Linux / macOS）。
- **代码在哪**：`/zyx/DSH/workspaces/dsh-piggy/code`（本机），远端 GitHub `CLICGGER-TYPES/dsh-piggy` 和 Gitee `clicgger/dsh-piggy`，**都只有 `main` 一个分支**。
- **每次改完必跑**：`npm run build && npm test && npm run typecheck`（700 多个测试，全绿才算完）。
- **「怎么加 X」先看 `docs/guides/`**：[开发新功能（总则）](guides/adding-features.md)、[写扩展](guides/writing-extensions.md)、[加台词](guides/adding-lines.md)、[加成就](guides/adding-achievements.md)、[界面规范](guides/ui-style.md)、[桌面架构与 IPC](guides/desktop-architecture.md)。
- **用户报问题时先让他导出日志**：「设置 → 日志 → 导出日志」，一份文件里同时有宿主、浏览器和桌面外壳三边的现场（见 [日志与导出](design/log-export.md)）。
- **发版**：改版本号 + 写 CHANGELOG → 提交 → 推 `v*` 标签 → GitHub Actions 发 GitHub、并构建 Gitee 渠道的包 → **本机**跑 `scripts/gitee-publish.sh` 推 Gitee → npm 由人手动发。详见第 9 节。
- **最重要的三条规矩**：数值/玩法设计先问用户再做；提交信息用中文、不加 AI 署名；改了界面一定要在真实浏览器 / 桌面窗口里看一眼（测试通过 ≠ 显示正确）。

---

## 2. 项目是什么

复刻 QQ 宠物 70–80% 的单机玩法：养成（饥饿 / 清洁 / 心情 / 健康 / 体重）、成长 60 级与形态、上学和 33 种职业、疾病和 20 种药、旅行、钓鱼、番茄钟、签到礼包、日记、图鉴、换肤与自定义皮肤包、加冕 / 恶魔签约，以及可在线下载的扩展玩法（盲盒寻访、扭蛋、菜园、矿洞）。规则全文：[玩法与养成规则](guides/gameplay.md)、[设计说明](DESIGN.md)。

| 形态 | 怎么跑 | 存档 |
|---|---|---|
| DSH 插件 | npm 包 `dsh-piggy`（社区目录别名 `dsh-plugin-piggy`），DSH 的 web profile 加载 | `$DSH_HOME/dsh-piggy/state.json` |
| 桌面版 | Electron 外壳（`apps/desktop/`）+ 游戏包（可热更新） | Electron userData 下 `dsh-piggy/state.json`；Linux `~/.config/dsh-piggy-desktop/`，Windows `%APPDATA%\dsh-piggy-desktop\`，macOS `~/Library/Application Support/dsh-piggy-desktop/` |

两边各养各的猪，桌面版托盘菜单可以导入 DSH 的存档。

---

## 3. 仓库与目录

本机总目录 `/zyx/DSH/workspaces/dsh-piggy/`（见同目录 README）：`code/` 代码、`skins-source/` 皮肤原稿、`feedback/` 用户报错截图录屏、`videos/` 宣传片工程、`design-refs/qqpet-ref/` QQ 宠物参考图（数值和疾病链的设计来源）、`archive/` 旧分支备份和历史快照。

> ⚠️ `/zyx/DSH/workspaces/dsh-pig` 是指向 `code/` 的旧链接，本机 DSH 已改成直接加载 `code/`（`~/.dsh/profiles/web/package.json` 里 `"dsh-piggy": "link:/zyx/DSH/workspaces/dsh-piggy/code"`）。

`code/` 里主要的东西：

| 路径 | 是什么 |
|---|---|
| `index.js` | DSH 插件入口：注册路由（`routes.js`）、斜杠命令 `/pig`（`commands.js`）、客户端脚本 |
| `snapshot.js` | 把存档整理成面板用的「快照」（客户端只读快照，不自己算规则） |
| `environment.js` | 版本号与环境说明（日志表头用）；`PACKAGE_VERSION` 的唯一定义处 |
| `routes.js` | HTTP 接口：`/dsh-piggy/state`（取快照）、`/dsh-piggy/act`（所有操作，body `{action, ...}`）、`/dsh-piggy/art`、`/dsh-piggy/ext/*` |
| `packages/pet-core/src/` | **领域库**：`data/`（数值表）、`core/`（纯函数规则）。根目录 `core.js` / `data.js` 只是再导出 |
| `store/` | 存档读写（原子写）、迁移、扩展运行时 `ext-runtime.js`、运行日志 `journal.js` |
| `src/client/` | 面板前端源码（原生 JS + DOM，不用框架）→ `npm run build` 打成根目录 `client.js`（**产物要提交**） |
| `extensions/` | 可下载扩展（`blindbox` `gacha` `farm` `mine`）+ 在线目录 `registry.json` / `registry-gitee.json` |
| `assets/` | 立绘 SVG（形态、皮肤、动作、App 图标） |
| `apps/desktop/` | 桌面外壳（Electron）：`main.js`、`preload.cjs`、`lib/`、`renderer/`、打包脚本 |
| `channels/` + `channel.js` | 发布渠道（github / gitee）的地址，见第 9.4 节 |
| `packages/dsh-plugin-piggy/` | npm 别名包（给社区目录检索用，只依赖 `dsh-piggy`） |
| `cordis.patch.yml` | DSH 加载插件用的配置层；`name` 必须和 package.json 的 `name` 一致 |
| `docs/` | 文档；`docs/tasks/` 历次任务卡，`docs/tasks/numbers/` 用户确认过的数值单 |
| `test/`、`apps/desktop/test/` | node:test 测试 |
| `tools/` | 预览页（`tools/preview.html`）、字体工具等 |

---

## 4. 架构

### 4.1 分层（硬规定，见 [CONVENTIONS](CONVENTIONS.md)）

依赖只能从外向内：`data/` → `core/` → `store/` → 组装层（`index.js` `snapshot.js` `routes.js` `commands.js`）→ `src/client/`。

- `core/` 是纯函数 `(state, ..., nowMs) => result`：**时间作参数传入，随机数用 `core/random.js`（种子在 `state.seed`），禁止 `Math.random()` / `Date.now()`**。
- 数值都在 `data/`，逻辑里不写裸数字。
- 业务拒绝返回 `{ ok: false, reason }`，不抛异常；系统异常要记日志并保留现场（`.bak`）。
- 客户端只渲染快照，不重算规则。

### 4.2 存档

- 当前 `STATE_VERSION = 12`（`packages/pet-core/src/core/constants.js`）。改存档结构：`core/upgrades.js` 表尾加一级 + 版本 +1 + 迁移测试。**不要随便升版本**；只是加字段就用 `ensureXxx(state)` 补默认值。
- 写文件原子化（`store/state-file.js`）：临时文件 → fsync → rename。旧档要能自动迁移，不丢数据。
- 时间推进是分段结算（离线一段时间后打开会按段补算）。

### 4.3 扩展系统

- **内置扩展**：番茄钟、钓鱼——可在「设置 → 🧩 扩展」开关 / 删除，注册表在 `packages/pet-core/src/data/extensions.js`。关掉后对应 App、商品、图鉴分区都隐藏，数据保留。
- **下载扩展**：`extensions/<key>/` 里 `manifest.json` + `server.js` + `client.js`。运行时 `store/ext-runtime.js`：
  - 只从本渠道的在线目录读（`CHANNEL.registry`），每个文件核对 sha256，`minGame` 高于当前游戏版本不装；
  - 扩展只能改自己的 `state.extData[key]`，其它一律走 `api`：`now`、`coins()`、`spend()`、`earn()`、`give()`、`say()`、`count()`、`take()`、`emit()`（成就事件）；
  - `view()` 可以返回 `shelf`（往商店加货架）、`dex`（往图鉴加分区，`style: 'holo'` 是闪卡）；
  - 出错只影响它自己。
- 写法和发布步骤：[写一个在线扩展](guides/writing-extensions.md)；设计背景：[扩展删除与在线下载](design/extension-download.md)、[扩展成就](design/extension-achievements.md)、[盲盒设计](design/blindbox.md)、数值单 `docs/tasks/numbers/X1–X4`。

### 4.4 桌面版：外壳和游戏包分开

- **外壳**（`apps/desktop/`，当前 **0.6.1**）：两个窗口（猪 / 面板）、托盘、更新器。改了 `main.js` / `preload.cjs` / `lib/` / `renderer/` 才需要升外壳版本，用户要重装或外壳自更新。结构和全部 IPC 见 [桌面架构](guides/desktop-architecture.md)。
- **游戏包**（= 插件那份代码，`apps/desktop/scripts/pack-game.mjs` 复制、`release-game.mjs` 打成 `game-<版本>.json.gz` + manifest）：在「设置 → 更新」里直接下载切换、可回退，不用重装。
- 窗口摆放、可点区域、桌面样式都放在游戏包里（`src/client/desktop/`），所以这类修复走游戏包更新就到。
- 详见 [更新机制](guides/updates.md)、[桌面版指南](guides/desktop.md)、`docs/DEVELOPMENT.md`「桌面程序和游戏包怎么分工」。

---

## 5. 开发环境

```bash
cd /zyx/DSH/workspaces/dsh-piggy/code
# 构建工具不写进依赖清单（--no-save），装一次即可
npm install --no-save --package-lock=false esbuild@0.28.2 typescript@5.9.3 @types/node@20.19.43
# 桌面版依赖
cd apps/desktop && npm ci
# 新版 npm 可能拦下安装脚本，导致 Electron 本体没下载：手动补一下
node node_modules/electron/install.js
```

- Node ≥ 20（本机 22）。没有框架、没有 TypeScript 编译：JS + JSDoc + `// @ts-check`，`npm run typecheck` 用 tsc 只做检查。
- 本机 DSH 源码在 `/zyx/DSH/deepseek-harness`（`master` 分支，2026-10-06 更新到 0.2.1-alpha.1；更新后要 `pnpm install && pnpm build`）。

---

## 6. 开发流程

1. 开工：`git status` 干净、`git pull` 到最新 `main`。多人 / 多 agent 同时做时，每人一个分支 + `git worktree`，做完合回 `main` 后删掉分支和工作目录（别再堆一堆旧分支）。
2. 改 bug：**先写能复现的失败测试**，再修。新功能覆盖正常路径和边界。
3. 改了 `src/client/` 一定 `npm run build`，把新的 `client.js` 一起提交（`test/bundle.test.js` 会检查它和源码一致）。
4. `npm run build && npm test && npm run typecheck` 全绿。
5. **界面改动要在真实环境看**：网页版起一个隔离 DSH 实例（第 8 节），桌面版启动真窗口截图看像素；只看代码或只量坐标不算验收。
6. 提交：中文、一个提交只做一件事、不加 AI 署名（不要 `Co-Authored-By: Claude/AI`）、用户能感知的变化写进 `CHANGELOG.md`、功能变了同步改 `README.md` 和玩家文档。
7. 新玩法 / 改数值：先出**数值确认单**（放 `docs/tasks/numbers/`）给用户确认，确认过的数字不要擅自改。

---

## 7. 开发规范补充（完整版见 [CONVENTIONS.md](CONVENTIONS.md)）

- 源码文件 ≤ 400 行（`client.js` 产物豁免），函数 ≤ 40 行、≤ 3 参数、嵌套 ≤ 3 层；超了就拆。
- 命名：camelCase / PascalCase / UPPER_SNAKE；新文件名 kebab-case；同一概念全项目一个词。
- 注释只写「为什么」；代码标识符 / 注释 / 日志 / 提交信息不用 emoji（游戏数据、界面文案、README、CHANGELOG 可以）。
- 禁止空 `catch`、吞错；错误信息带上下文参数。
- 界面风格：动森手机风（奶油底、圆角卡片、青绿按钮、App 方块主菜单），面板要简洁——不加刻度条和说明废话，跳转后返回原处。改布局前先问用户。
- 扩展的界面写在扩展自己的 `client.js` 里（`window.dshPiggyExtensions.register(key, { render })`，拿到 `app.el / app.button / app.send / app.rerender / app.data`）。

---

## 8. 调试与测试环境

### 8.1 网页版（DSH 插件）——用隔离实例，别碰用户正在用的 DSH

```bash
# 复制一份 DSH_HOME，把 profile 里的 dsh-piggy 链到要测的代码
cp -a ~/.dsh /tmp/pig-home && ln -sfn /zyx/DSH/workspaces/dsh-piggy/code /tmp/pig-home/profiles/web/node_modules/dsh-piggy
cd /zyx/DSH/deepseek-harness && DSH_HOME=/tmp/pig-home node --import tsx/esm apps/cli/src/bin.ts web --no-open --port 3087
# 日志第一行给出带 token 的地址
```
- 用户自己的 DSH 一般跑在 3080 端口（终端里 `pnpm dsh web`），测试用 3084 以上的端口。
- 接口可以直接调：`fetch('/dsh-piggy/act', {method:'POST', body: JSON.stringify({action:'hatch'})})`；`/dsh-piggy/state` 看快照。
- **调试模式**：主菜单底下的版本号 3 秒内连点 7 次，出现「调试」App（改数值、快进时间、切形态 / 体重档等）。接口 `{action:'dev', patch:{...}}`。
- 不支持的改动（比如扩展数据）：停服 → 改 `state.json` → 再启动。
- **排障先看日志**：设置 → 日志 → 导出日志。也可以直接 `curl /dsh-piggy/logs/export` 看那一份纯文本；落盘的那份在存档目录 `logs/dsh-piggy.log`（一行一条 JSON，满 1.5 MB 轮转）。

### 8.2 桌面版

```bash
cd apps/desktop && npm start          # 先打游戏包再启动
# 常用环境变量：
PIGGY_USERDATA=/tmp/pig-ud            # 用独立数据目录（别碰真存档）
PIGGY_DEVTOOLS=1                      # 自动打开开发者工具
PIGGY_RELEASES_URL=...                # 换更新源（测试用）
PIGGY_WAYLAND=1                       # Linux 强制走 Wayland（默认在 Wayland 下自动加 --ozone-platform=x11）
PIGGY_SHAPE=1                         # Windows 退回旧的窗口形状做法（对比排查）
PIGGY_CAPTURE=<文件> / PIGGY_CAPTURE_STEPS  # 截图自检模式
PIGGY_BUNDLED_GAME=/不存在的目录          # 模拟「安装包不带游戏」（Gitee Windows 包），走首次下载
PIGGY_GAME_PIN=<game-pin.json>            # 首次下载用的清单（scripts/write-game-pin.mjs 生成，可指本机 http 服务）
# 加 --remote-debugging-port=9333 可以用 Playwright 连上去操作页面
```
- 日志：外壳的窗口 / 更新记录写在 userData 下 `piggy.log`（Windows `%APPDATA%\dsh-piggy-desktop\piggy.log`）；**这些行现在也会同步进游戏日志**，所以让用户「设置 → 日志 → 导出日志」一份就够，不用再手工找两个文件。
- Linux：Wayland 下 `--ozone-platform=x11` 必须在命令行带（代码里已自动重启带上）；`capturePage()` 截到图不代表窗口真的显示了，要看真实屏幕像素。
- Windows：透明全屏窗口拖动会卡整机，窗口要开到内容大小；分数缩放下 `getBounds` 和 `setBounds` 会差 1px（已有 2px 容差）。

### 8.3 测试

- `npm test` 跑根目录 `test/**` 和 `apps/desktop/test/*`。客户端测试用假 DOM（`test/helpers/bundle.js`）。
- 测试不依赖真时钟、网络、执行顺序。

---

## 9. 构建与发版

### 9.1 版本号

| 什么 | 在哪 | 什么时候改 |
|---|---|---|
| 游戏版本 | 根 `package.json` `version` | 每次发版 |
| 别名包 | `packages/dsh-plugin-piggy/package.json` 的 `version` 和 `dependencies.dsh-piggy` | 和游戏版本同步 |
| 桌面外壳 | `apps/desktop/package.json` `version` | 只有改了外壳代码才升（当前 0.6.3；加基础动作时同时升 `src/client/desktop/index.js` 的 `DESKTOP_VERSION`） |
| 存档 | `STATE_VERSION` | 只有存档结构变了才升（配迁移） |
| 扩展 | `extensions/<key>/manifest.json` | 扩展改了就升，`minGame` 写需要的最低游戏版本 |

测试版用 `x.y.z-rc.N`（会自动标成预发布）。别频繁发包：一批改完自查完只出一个测试版，用户验收通过再发正式版。

### 9.2 正式发版步骤

1. 改上表里的版本号；在 `CHANGELOG.md` 写 `## [x.y.z] — 日期 · 主题` 小节（发布说明从这里取，写全改动）；README 同步。
2. `npm run build && npm test && npm run typecheck` → 提交（如 `release: v0.33.1 — 一句话`）→ 推 main。
3. 打标签推送：`git tag v0.33.1 && git push origin v0.33.1`。两条工作流自动跑：
   - `.github/workflows/release.yml` → **GitHub Release**：游戏包 + Windows 安装 / 便携版 + Linux AppImage + macOS dmg + 更新清单；
   - `.github/workflows/release-gitee.yml` → **只构建** Gitee 渠道的游戏包和安装包，存成 artifact，不往 Gitee 推。
   然后在**本机**：`GITEE_TOKEN=<令牌> bash scripts/gitee-publish.sh vX.Y.Z`（推代码和标签、建发行版、传附件、核对、删旧安装包，见 9.4）。
4. 等两边都绿，核对两边的附件齐全（GitHub `gh release view vX`；Gitee 看发行版页面）。
5. **npm 手动发**（CI 不发）：
   ```bash
   cd code && npm login && npm publish --access public && npm view dsh-piggy version
   cd packages/dsh-plugin-piggy && npm publish --access public && npm view dsh-plugin-piggy version
   ```
   已经发过的版本号不能再发。

### 9.3 在线扩展发版

1. 改扩展、升 `manifest.json` 版本。
2. GitHub：`node scripts/extension-entry.mjs <key>` 生成目录条目；`gh release create ext-<key>-<版本> extensions/<key>/{manifest.json,server.js,client.js} --prerelease --latest=false`（**一定要预发布 + 不设 latest**，否则会抢掉游戏正式版的「最新」）；更新 `extensions/registry.json`。
3. Gitee：`node scripts/extension-entry.mjs <key> --host gitee` 更新 `extensions/registry-gitee.json`；`GITEE_TOKEN=… node scripts/gitee-release.mjs ensure ext-<key>-<版本>` 拿到 id，再 `upload <id> extensions/<key>/manifest.json extensions/<key>/server.js extensions/<key>/client.js`。
4. 提交两个 registry 文件、推 main（GitHub 和 Gitee 的 main 都要有：本机 `git push gitee main`）。
5. 新附件刚传上去约 1 分钟后才能下载；用全新存档实际在线装一次验证。

### 9.4 两个发布渠道（GitHub / Gitee）

- 规则：**GitHub 那套保持原样；Gitee 是独立的一套**——Gitee 发出去的游戏包和外壳，检查更新、下载游戏包、在线扩展只走 gitee.com，不能依赖 GitHub（用户明确要求）。
- 地址集中在 `channels/github.js`、`channels/gitee.js`；`node scripts/set-channel.mjs <github|gitee>` 复制成 `channel.js` 和 `apps/desktop/lib/channel.js`。**仓库里提交的永远是 github**（`test/channel.test.js` 守着）。
- Gitee 工作流先用默认渠道跑测试，再切 gitee 打包，构建后用 `scripts/scan-channel.mjs` 扫描，发现 GitHub 地址就失败。
- Gitee 限制：发行版附件**单个 ≤ 100MiB（104,857,600 字节，实测）**、单仓库附件**总量 ≤ 1GB**。所以 Gitee 安装包另有瘦身：`apps/desktop/electron-builder.gitee.cjs`（最大压缩、只留中英文语言包）、`tools/slim-emoji-font.py`（emoji 字体只留用到的）、macOS dmg 用 `hdiutil` 转 lzma（ULMO）。当前大小（0.34.1 / 外壳 0.6.3）：Windows 92.5MiB（**不带游戏**，见下）、Linux 97.3、mac x64 96.2 / arm64 88.2——Linux 和 mac 自带游戏，余量也只剩 3～4MiB，再涨就要照 Windows 的做法分装。超限的文件 CI 不上传并给警告。发版后自动删除旧版本的安装包附件（游戏包保留）。
- **Gitee 一律从维护者本机推**（用户 2026-10-07 定）：GitHub Actions 不再碰 Gitee（机房连 Gitee 经常卡死或被重置，旧流程的清理步骤还在上传失败时删了旧安装包，Gitee 一段时间没有安装包可下）。
  流程：CI 构建出 artifact（`gitee-game`、`gitee-dist-<系统>`）→ 本机 `GITEE_TOKEN=<令牌> bash scripts/gitee-publish.sh vX.Y.Z`：
  等构建成功、下载 artifact、核对 `latest*.yml` 的 sha512 和安装包一致 → `git push gitee main` 和标签 → 建发行版、传游戏包和安装包、最后传更新清单 →
  核对 Gitee 上每个附件的名字和大小 → **全对了才**删旧版本的安装包。某次构建上传那步被取消但产物还在时，用 `--run <run id>` 指定。
  令牌由维护者在命令里给，不存文件、不放 GitHub Secrets 之外的地方。
- **Gitee 的 Windows 安装包不带游戏**（2026-10-09 用户定，外壳 0.6.3 起）：Windows 包离 100MiB 只剩约 0.5MiB，加图就超。
  CI 的 Windows 任务先取本次的 `gitee-game`，用 `apps/desktop/scripts/write-game-pin.mjs` 写 `game-pin.json`（版本、manifest、
  `<Gitee downloadBase>/v<版本>/<文件>`）放进安装包（`electron-builder.gitee.cjs` 里 win 只带它，linux/mac 照旧带 `game/`）。
  外壳启动时没有能跑的游戏就弹下载窗口（`apps/desktop/first-run.js`），装好再开猪；换外壳版本时继续用已下载的游戏（没有自带的可回）。
  ⚠️ 所以 **Gitee 发行版必须先把游戏包传上去**，不然新装的 Windows 用户第一次打开会 404（`gitee-publish.sh` 本来就先传游戏包）。
- **游戏包分卷**：`release-game.mjs` 生成的整包超过 95MiB 时自动拆成 `game-<版本>.part-01.gz`…，manifest 里 `parts` 记顺序和校验值，
  minShell 自动抬到 0.6.3；`gitee-publish.sh` 按 `game-*` 一起上传。外壳逐卷下载、逐卷校验、拼起来再校验整包。
- Gitee 的原始文件地址（raw）会 302 跳到 `raw.giteeusercontent.com`，附件会跳到 `foruda.gitee.com`，fetch 默认跟随即可。

---

## 10. 账号、密钥、外部服务

| 什么 | 在哪 / 谁管 |
|---|---|
| GitHub 仓库 | `CLICGGER-TYPES/dsh-piggy`（用户账号，本机 `gh` 已登录） |
| Gitee 仓库 | `clicgger/dsh-piggy`（公开） |
| `GITEE_TOKEN` | Gitee 私人令牌，维护者本机发 Gitee 时在命令里给（GitHub Secrets 里那份已不再被工作流使用，可以删）。**不要写进仓库、文档或日志** |
| npm | 包 `dsh-piggy`、`dsh-plugin-piggy`，由用户在本机 `npm login` 后手动发布 |
| 社区目录 | [dsh-plugin.org](https://dsh-plugin.org) 收录 Issue、[awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin) 自荐 PR（第三方维护，不是官方市场） |
| 音乐素材 | 宣传片 BGM 用 Mixkit 免费曲库（Mixkit Stock Music Free License） |

---

## 11. 和用户协作的约定（历次反馈总结）

- **先设计、再动手**：大功能先出完整设计 / 数值单给用户确认；修 bug 的版本只修 bug，新功能不要预留或半做。
- **数值、玩法、台词必须用户拍板**；确认过的数字不改，有意见写在任务卡里等用户定。
- **不擅自改界面排版**：规则变了不顺手改布局；改布局先问。界面改版要有肉眼可见的变化，最好出两三个方向让用户挑。
- **面板要简洁**：不加刻度条、说明性废话；状态条只在货架里；跳转后返回来处。
- **说话要实**：没核实的事别说「已完成」；自测（真实浏览器 / 桌面像素）过再报完工；做不到、没做的要直说。
- **给路径用绝对路径**，并说明在哪个分支 / 目录。
- **验收通过后再发版**；别频繁发测试版；能不升外壳就不升。
- **提交规矩**：`type(scope): 中文描述`、不加 AI 署名、功能变了改 README、发版写全 CHANGELOG（见 [CONVENTIONS](CONVENTIONS.md)「Git」）。
- 用户自己常在 3080 的 DSH 里玩，测试别占它的端口、别改它的存档。

---

## 12. 已知问题与待办（2026-10-07）

**桌面版窗口——v0.33.1 / 外壳 0.6.1 的状态**
- **猪和面板是两个窗口**，结构、IPC、验收方法见 [桌面架构](guides/desktop-architecture.md)，来龙去脉见 [I-round 第 15 节](tasks/I-round.md)。
  **别再把面板塞回猪窗口、也别加「改窗口大小后把猪补回原位」的记账**——那条路修了四轮都在补同一个结构问题。
- 0.33.1 修了「开着面板拖猪，面板越跑越远」（Windows 分数缩放）：根因是拖动时把猪窗口读回的大小再设回去，125% 下每帧涨 1px。
  修后在 Win11 虚拟机 125% 下真拖录屏逐帧量过（面板偏差 90% 的帧 ≤2px、不随时间增长；修前 204px），Linux GNOME 9 组真拖回归通过。
- 已知：GNOME 启动桌面版时会弹一条「dsh-piggy is ready」（猪窗口不抢焦点显示引起），未处理。
- 已知：拖到屏幕顶边时面板被夹在屏幕里，会和猪叠住一部分；松手后面板换到下方。
- 待办：`apps/desktop/main.js` 约 1000 行（规范豁免），「面板窗口」一节可以拆到 `lib/`；拆完要两个平台重新真拖录屏验收。
- 测试机（Linux GNOME、Win11）在维护者本机虚拟机里；账号、IP、操作脚本在维护者本机笔记，**不进仓库**。
  测试方法写在 [桌面架构](guides/desktop-architecture.md)「怎么验收」。非测试用的虚拟机不要碰。
- 被取代的方案留了底：DeepSeek 的覆盖模式在分支 `backup/deepseek-overlay-20261007`，更早的未提交改动在 `git stash@{0}`；确认不要后可删。

**用户反馈、未解决**
- Windows 桌面版猪「抽动」：录屏在 `/zyx/DSH/workspaces/dsh-piggy/feedback/`（上下跳 + 一帧叠影，像窗口移动和页面重排不同步）。要那台机器的 `%APPDATA%\dsh-piggy-desktop\piggy.log` 才能定位。
- 换皮肤后猪变小：本机没复现（皮肤立绘身子和默认猪一样大，体重放大系数也保留）。要具体皮肤、平台、截图。
- Linux 桌面版面板收起时拖猪，猪前面出现白块：已在拖动时隐藏礼包 / 戳一戳气泡，用户说还在，暂时搁置。

**风险**
- **扩展下载在国内直连 GitHub 会超时**（2026-10-06 查清）：插件进程用的是 Node 的 `fetch`（undici），它**不读系统代理**，而浏览器会读，所以网页上能开 GitHub、插件下载却卡住。已经做的：每个文件 12 秒超时、最多 3 次重试、并行下载、失败说清是哪一步，界面立刻显示「下载中…」并留可重试的失败提示。**没做的**：让插件的出网走系统代理（用户当时选了「只做超时重试反馈」，没要 Gitee 镜像兜底）。下次再有人报「下载不了」，先看导出日志里的 `ext` 行，确认是不是这类超时。
  已验证可行的修法（未做，要用户点头）：Node 24 起 `fetch` 认 `HTTP_PROXY/HTTPS_PROXY` + `NODE_USE_ENV_PROXY=1`，桌面外壳启动宿主时读系统代理带上即可（Win11 虚拟机实测从「连接被中断」变成正常下载）。
- Gitee Windows 安装包：外壳 0.6.0 起去掉了只给 WebGPU 用的 `dxcompiler.dll` / `dxil.dll`（`electron-builder.gitee.cjs` 的 afterPack），0.6.1 安装版 98,395,909 字节（约 93.8MiB），离 100MiB 上限约 6MiB；再超要继续瘦身。
- Gitee 附件总量：一版约 472MB，发版时新旧并存约 944MB，贴近 1GB。

**待用户决定 / 待拆卡**
- 学校改版（[G3 数值单](tasks/numbers/G3-school.md)：学制按年级升级）。
- E 批次现实作息 / 城市天气（[E-round](tasks/E-round.md)，需用户先拍板）。
- 「装扮」入口重设计（商店和背包入口暂时隐藏，数据保留，别删别升存档）。
- 自定义导演系统、游戏内社区（好友 / 联机）：延期。

**已解决（2026-10-06）**
- 网页版也自带 emoji 字体子集，「设置 → Emoji 样式」在网页版也能选了（以前只有桌面版有），见 CHANGELOG 的 Unreleased。
- 主菜单图标**保持一律用 emoji**：手绘 SVG 那一版（旧「主菜单图标」设置）用户明确说不要，别再恢复。

---

## 13. 常见坑

- `client.js` 忘了重建 → `test/bundle.test.js` 失败。
- `cordis.patch.yml` 的 `name` 和 package.json `name` 不一致 → 插件前端静默不挂载。
- 网页里 `window.confirm()` 会冻住页面；DSH 面板里不要用原生弹窗。
- 在线扩展 GitHub Release 忘了 `--prerelease --latest=false` → 「最新正式版」被扩展抢走，更新检查出错。
- 桌面版改了外壳代码却没升外壳版本 → 用户只更新游戏包拿不到修复。
- 截图验证大文件要等几秒再截，否则截到加载中的空白。
- DSH 本身更新后要 `pnpm install && pnpm build`，否则启动时会报找不到 `lib/*.js`。
- **桌面版几何的验收只看一条：猪的屏幕点有没有动**（点猪、开关面板、重启前后差 ≤2px）。「窗口在工作区内」「核对 0 次不符」「测试全绿」都不等于猪没动——2026-10-06 就是这么三次误判「修好了」。改完跑 `tools/desktop-geometry-check.mjs`，它跑不过就是没修好；在 GNOME（Wayland）桌面上它会用 `tools/gnome-pointer.py` 真鼠标拖（别在自己正用的机器上跑真拖，放虚拟机）。多屏、Windows 还要人工在真机上试。
- 桌面版是两个窗口（`docs/tasks/I-round.md` 第 15 节）：面板改动不许影响猪窗口的大小；猪窗口里「家」模型（第 13 节）仍然是每轮从头算窗口，**不要再加「记住上一轮」「核对补正」之类的记账**。
- 桌面拖动的验收要**真鼠标拖 + 录屏逐帧看**（`tools/drag-film.py`）：只看起止坐标看不出「拖到边上猪停住、松手瞬移」「拖动中猪消失一段」，这两个都是只在中间帧里出现的真 bug（2026-10-07）。
- 桌面页面里 `piggyShell.place({})` 回读的窗口尺寸在 setBounds 后立刻就是新的，但页面要等 resize 才重排：两者对不上的那一拍不能量（`index.js` 的 `layoutStale`），否则算出的猪位置差一个尺寸变化量。

---

## 14. 文档索引

- 玩家：[怎么玩](guides/gameplay.md) · [桌面版](guides/desktop.md) · [更新机制](guides/updates.md) · [换肤](guides/skins.md) · [做皮肤](guides/creating-skins.md) · [皮肤包格式](guides/skin-pack-format.md)
- 入口：[AGENTS.md](../AGENTS.md)
- 怎么加 X：[写扩展](guides/writing-extensions.md) · [加台词](guides/adding-lines.md) · [加成就](guides/adding-achievements.md) · [界面规范](guides/ui-style.md) · [桌面架构与 IPC](guides/desktop-architecture.md)
- 开发：[开发指南](DEVELOPMENT.md) · [编码规范](CONVENTIONS.md) · [设计说明](DESIGN.md) · [美术规格](ART-SPEC.md) · [扩展下载](design/extension-download.md) · [扩展成就](design/extension-achievements.md) · [扩展中心设计](design/extension-center.md) · [日志与导出](design/log-export.md)
- 历史：[CHANGELOG](../CHANGELOG.md) · [任务卡](tasks/README.md) · [数值单](tasks/numbers/) · [开发过程记录](PROCESS.md) · [旧交接 2026-10-03](HANDOFF-2026-10-03.md)
