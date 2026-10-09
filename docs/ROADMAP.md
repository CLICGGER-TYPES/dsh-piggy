# 路线图与待办

**这是唯一的待办清单**（2026-10-09 起）。HANDOFF、总目录 README、各轮任务卡里不再另记待办；做完一项就把它挪到「最近完成」，新想法先写进「待用户决定」。
历史计划在 [archive/](archive/)（[旧路线图 09-30](archive/ROADMAP-2026-09-30.md)、[各轮任务卡](archive/tasks/README.md)）。

## 当前版本

| | 版本 | 状态 |
|---|---|---|
| 游戏包 | v0.34.1 | GitHub 已发；**Gitee 未推**；npm 待维护者手动发 |
| 桌面外壳 | 0.6.3 | 同上 |
| 盲盒扩展 | 2.2.2 | GitHub 已发；**Gitee 附件未传** |
| 存档 | STATE_VERSION 12 | |

## 进行中

- **经济体系**（[设计](design/economy.md)，用户 2026-10-09「开始吧」「继续做」）：三批都已合进 main，**未发版，等用户验收后发 v0.35.0**：
  - 第 1、2 批：去每日上限、外出能钓鱼、`app.openShop`；底座（统一入口、记账、扩展规则、调试页「经济」）；扩展币钱包（汇率、删扩展自动结清、`buyable: false`）。
  - 第 3 批（[J1 数值单](numbers/J1-economy.md)）：菜园 2.0、矿洞 2.0、钓鱼 2.0、旅行 15 个地点（[纪念品故事审稿单](numbers/J1-souvenir-stories.md)）、商店新上 27 件、10 分钟短班、盲盒 3.0（凭证进钱包）、扭蛋 1.2。
  - 跟 J1 初稿不一样、要用户点头的：鱼饵降价（鲜虾 8、夜光 18）、等咬钩变长（竹竿 14～32 秒）、传说竿稀有 ×1.5；短途纪念品单独标便宜价；「工具」总货架不做；扭蛋不开自己的币。
  - 发版时要发的扩展：ext-farm 2.0.0、ext-mine 2.0.0、ext-blindbox 3.0.0、ext-gacha 1.2.0（都要游戏 0.35.0），GitHub 和 Gitee 都要传。

- **Gitee 发 v0.34.1**：维护者本机 `GITEE_TOKEN=… bash scripts/gitee-publish.sh v0.34.1`（先传游戏包再传安装包——Gitee 的 Windows 安装包不带游戏，首次启动要从 Gitee 下）；再传盲盒 2.2.2 的 Gitee 附件（[HANDOFF 9.3](HANDOFF.md)）。传完在 Win11 虚拟机用真的 Gitee 地址验一次首次下载。
- **项目规范化**（2026-10-09 体检）：
  - 第 1 批 文档和规划：已完成——本页、[素材总表](ASSETS.md)、`docs/archive/`、数值单挪到 `docs/numbers/`、文档链接检查测试。
  - 第 2 批 素材整理：**并进下面的「PNG 底图迁移」一起做**，不单独动。
- **PNG 底图迁移**（用户 2026-10-09 定：底图以后不用 SVG，改 PNG；codex 正在重画，分支 `codex/pig-size`）。等新图出来，先出完整设计给用户确认再整体做。要一起改的：
  - 选图拼路径：`src/client/art.js` 写死了 `'.svg'`（立绘、动作图），睡姿已经是 PNG；
  - 图片路由白名单：`routes.js` 只放行 `*.svg`、`*-sleep.png`、`feedback/*.png`，自定义皮肤只认 `custom-*.svg`；
  - 自定义皮肤包：`store/skin-pack.js` 只收 SVG（还做了 SVG 安全清洗），皮肤包格式、制作教程、示例 ZIP 都按 SVG 写——要定新旧格式怎么兼容（老玩家导入过的 SVG 皮肤不能坏）；
  - 数据表里的 `art` 名、成就徽章 `'badge-pig-' + key`、图鉴和换肤页、约 15 个测试；
  - 顺带做原来第 2 批的事：按类型分子目录、反馈图按用途改名、待定图和不再使用的图怎么处理、原稿统一到总目录 `art-source/`；
  - 体积：PNG 比 SVG 大得多（现在 SVG 每张 ≤ 8KB、共约 470KB），游戏包热更新和 Gitee 安装包余量都要算，见 [素材总表](ASSETS.md)。
  - 第 3 批 代码结构：见下面「技术待办」。

## 待用户决定

- **各扩展的自动化路线**（用户 2026-10-09「都以增量游戏的想法去设计」）：草案见 [design/automation.md](design/automation.md)（矿洞小矿工猪、菜园帮工猪、钓鱼加长自动钓；盲盒扭蛋不做）。等用户定方向、帮工和打工能不能同时、仓满多久，再出 J2 数值单。
- 圆润 / 胖胖体型要不要也用反馈小猪图（现在只有普通体型用，胖了就看不到；生日图除外）。
- 生日蛋糕要不要奖励（用户提过「蛋糕图鉴」，说以后再定）。
- 5 张待定反馈图（`collection-badge` 徽章、`collection-check` 检疫合格、`collection-cage` 笼子、`suspended`、`twitch`）放哪或删掉。
- 「装扮」入口重设计（商店和背包入口暂时隐藏，数据保留，别删别升存档；素材也不全）。
- 学校改版（[G3 数值单](numbers/G3-school.md)：学制按年级升级）。
- E 批次 现实作息 / 城市天气（[E-round](archive/tasks/E-round.md)、[提案](design/real-world-cycle.md)）。
- 扩展下载走系统代理：插件进程的 Node `fetch` 不读系统代理，国内直连 GitHub 会超时。已验证可行的修法：Node 24 + `HTTP(S)_PROXY` + `NODE_USE_ENV_PROXY=1`，由桌面外壳启动宿主时带上。用户当时只要了超时重试。
- 延期：自定义导演系统、游戏内社区（好友 / 联机）。

## 技术待办

- `apps/desktop/main.js` 约 1080 行（规范豁免）：「面板窗口」一节拆到 `lib/`；拆完两个平台都要真鼠标拖动录屏验收（[桌面架构](guides/desktop-architecture.md)）。
- `src/client/index.js` 正好 400 行，`routes.js` 392、`snapshot.js` 380：下次往里加功能前先拆。
- Gitee 安装包余量：Windows 不带游戏后约 92.5MiB；Linux 97.3、mac x64 96.2 / arm64 88.2 自带游戏，余量只剩 3～4MiB，再涨就照 Windows 的做法分装。Gitee 附件总量（新旧版本并存）接近 1GB，发版后要删旧安装包。
- GNOME 启动桌面版会弹「dsh-piggy is ready」（猪窗口不抢焦点显示引起）。
- 拖到屏幕顶边时面板被夹在屏幕里，会和猪叠住一部分；松手后面板换到下方。
- 被取代的方案留了底，确认不要后可删：分支 `backup/deepseek-overlay-20261007`、`git stash@{0}`。

## 用户反馈、未解决

- Windows 桌面版猪「抽动」：录屏在总目录 `feedback/`（上下跳 + 一帧叠影）。要那台机器的 `%APPDATA%\dsh-piggy-desktop\piggy.log`。
- 换皮肤后猪变小：本机没复现，要具体皮肤、平台、截图。
- Linux 桌面版面板收起时拖猪，猪前面出现白块：已在拖动时隐藏礼包 / 戳一戳气泡，用户说还在，暂时搁置。

## 已定下来的，别再改

- 猪和面板是**两个窗口**；别把面板塞回猪窗口，也别加「改窗口大小后把猪补回原位」的记账（[I-round 第 15 节](archive/tasks/I-round.md)）。
- 主菜单图标一律用 emoji（手绘 SVG 那一版用户明确不要）。
- 反馈小猪图的对应关系 2026-10-09 由用户逐张定过（`src/client/feedback-art.js`）：生病按病种和阶段、猪递只给纸盒、生日只在生日当天点蛋糕后显示 15 秒。
- 心情优先级：生病 > 脏 > 外出 > 饿（PR #8，用户确认）。反馈图显示时隐藏装扮（用户确认）。
- Gitee 一律从维护者本机推，GitHub Actions 不推 Gitee；Gitee 的 Windows 安装包不带游戏，其余照旧。

## 最近完成

- **v0.34.1 / 外壳 0.6.3**（2026-10-09）：Gitee Windows 安装包改成首次启动下载游戏；游戏包超过 95MiB 自动分卷；发布说明自动 @ 贡献者。
- **v0.34.0 / 外壳 0.6.2**（2026-10-09）：一猪多图（38 张反馈小猪）、生日蛋糕、打盹睡姿、调试页「立绘」；合入 @tetezi 的 #8；README 致谢 PigHub。
- 更早的见 [CHANGELOG](../CHANGELOG.md)。
