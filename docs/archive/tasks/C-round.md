# C 批次任务卡（2026-10-01）

> 规划/验收：Claude；执行：Codex（C3/C5/C6/C7）、DSH agent（C1/C2/C4）。卡上数值用户已确认。每卡末尾留「验证记录」「疑问」「验收意见」。

## Context
用户额度紧，本轮 Claude 只出计划/规范/验收，代码由 **Codex** 和 **DSH agent** 写。需求来自用户 9 条：调试模式要解锁才开、调试页要覆盖所有可解锁内容、番茄钟、胖猪、换肤、加冕道具化（并入 PR #3 恶魔契约）、加冕 App 改图鉴、钓鱼（星露谷式手动 + 自动）。**自定义导演系统、社区：本轮不做。**

用户已定：调试=连点版本号 7 次解锁；番茄钟=小奖励+猪陪伴；鱼=进背包可喂可卖+图鉴；换肤立绘用户自己找，Claude 出 SVG 规范。

现状（已核对代码，仓库 `/zyx/DSH/workspaces/dsh-pig`，main=b797012，存档 v12）：
- 调试：`src/client/index.js:332-366` Ctrl+Shift+D 开关，`writeStore(DEV_KEY)` 写 localStorage **永久记住** → 用户看到"没关"。`window.dshPigDev.on()` 也能直接开。调试页 `src/client/tabs/dev.js` 没有形态（猪猪王）入口。
- 形态：`packages/pet-core/src/data/evolution.js` 的 `FORMS`（仅 king）；主屏 `TABS` 里有 `crown` App（`src/client/constants.js:41`，`src/client/tabs/crown.js`）。
- PR #3（1nuoiscute，OPEN）：给 FORMS 加 `via` 字段，恶魔猪走商店「📜 契约」→背包使用，条件不齐不消耗；10 张 SVG。
- 体重：已有 `state.weightG`（`core/effects.js:77` 只增不减，下限 400g）。
- 背包使用：`src/client/tabs/bag.js:98` `ui.send('use',{item})`。

## 分工与协作
| 卡 | 内容 | 谁 | 依赖 |
|---|---|---|---|
| C1 | 调试模式解锁 + 调试页全覆盖 | DSH | 无 |
| C2 | 番茄钟 App | DSH | 无 |
| C3 | 合入 PR #3 + 王冠/契约道具化 + 变身 emoji 特效 | Codex | 无 |
| C4 | 图鉴 App（替换加冕 App 的位置） | DSH | C3 合入后 |
| C5 | 钓鱼 App（手动圆盘 QTE + 自动） | Codex | C4 合入后接图鉴「鱼」分区（先做本体） |
| C6 | 换肤框架 + 占位皮肤 | Codex | C3 |
| C7 | 胖猪（体重分档换立绘） | Codex | **等用户给圆猪图**，先不开工 |
| C8 | 六款角色外观：厨师／宇航员职业解锁，侦探／天使／海盗／巫师内置皮肤 | Codex | C6；用户 2026-10-03 确认 2 职业 + 4 皮肤 |

协作规则（沿用 `docs/archive/tasks/README.md`，以下为本轮补充）：
- DSH 在原目录 main 直接提交；Codex 用 worktree `/zyx/DSH/workspaces/dsh-pig-codex` 分支 `codex/next`，每卡完成 rebase 到 main 再快进合入。
- **本轮不升存档版本**：新字段一律 `ensureXxx(state)` 补默认值（参考 `core/lines.js` 的 `ensureDialogue`）。确需升版本只能由 Codex 做，且先在卡里写明。
- 提交**不加任何 AI 署名行**；外部贡献者（PR #3）的作者/Co-Authored-By 保留。
- 每卡：先写会红的测试再改；改完 `npm run build && npm test && npm run typecheck` 全绿；**README 和 CHANGELOG 同步更新**；界面截图存 `docs/screenshots/c<N>-*.png`（Playwright + `/usr/bin/chromium` 截隔离实例 3082，不碰用户 3080 的 dsh）。
- **不改现有页面排版**（只能加新 App / 替换格子内容）；两列 grid 用 `minmax(0,1fr)`，格子文字 ≤ 两行短字。
- 下面写的数值是**建议值，用户批准本计划即视为确认**；agent 觉得不合理写在卡末「疑问」里，不擅自改。

---

## C1 调试模式（DSH）
1. 去掉 Ctrl+Shift+D 和 `dshPigDev.on/toggle`（保留 `off`）。启动时 `removeStore(DEV_KEY)`/写 '0'，清掉老用户永久打开的状态。
2. 主屏九宫格底部加一行小字版本号 `v0.25.x`（灰色、不占格子）。**3 秒内连点 7 次**解锁；第 4 次起气泡提示「再点 N 次」；解锁后出现 🔧调试 App。**只存内存，刷新/重启即关**。调试页顶部加「关闭调试」按钮。
3. 调试页补「形态」组：每个 `FORMS` 一个按钮（直接设 `form`）+「恢复普通」；补「道具」组：一键给王冠/契约（C3 后）；以后皮肤、鱼也要有对应按钮。
4. 加测试 `test/dev-coverage.test.js`：遍历 `FORMS`（以及将来的 `SKINS`、`FISH`），断言 dev.js 里都有 `data-dev` 入口 —— 以后新加内容忘了调试入口会红。
5. 服务端 `routes.js` 的 `dev`/`giveAll` 不变（单机，不做鉴权）。

验收：刷新后无 🔧；连点 6 次不开、7 次开；刷新又关；控制台 `dshPigDev.on` 不存在；调试页能一键变猪猪王/恶魔猪/恢复。

## C2 番茄钟（DSH）
- 主屏新 App「🍅 番茄钟」。时长选 15/25/45 分钟，休息 5 分钟。
- 状态存服务端 `state.pomodoro = {startedAt, minutes, todayDone, day}`（`ensurePomodoro`），面板关了/刷新/重启都接着倒计时；到点由 `settlement` 或下次请求结算。
- 专注中：猪进入免打扰（复用 B6 免打扰），头顶小 🍅 + 剩余分钟；说一句陪伴台词（`data/lines.js` 加场景 `pomodoroStart/Done/Abandon`，各 3 句）。
- 完成：+8 🪙、+6 心情；**每天前 8 个**给奖励，之后只计数。中途放弃无奖励。
- 完成时浏览器 Notification（无权限就气泡），状态页显示今日完成数。

验收：开 25 分钟 → 刷新仍在倒计时；调试 +1 小时后结算给奖；第 9 个不给钱；放弃无奖励。

## C3 加冕道具化（Codex）
1. 先把 PR #3 合进来（保留作者），在其基础上改：`FORMS.via` 统一成 `'item'`，每个形态带 `item` 键。
2. 商店新货架「✨ 晋升」：`👑 王冠` 3000 🪙（key `crown`）、`😈 恶魔契约` 6666 🪙（沿用 PR）。条件不变（猪猪王 Lv40+三维各 20+本代打工 10 次；恶魔猪按 PR）。
3. 背包里这类道具的使用按钮文字取 `item.useLabel`：王冠＝「加冕」，契约＝「签约」。条件不齐→拒绝、不消耗、列出差哪条。
4. 成功时全屏 emoji 特效：王冠 👑✨ 从上落下 + 猪中心放大弹出一个 👑；契约 😈🔥 同理（放 `src/client/effects.js`，1.5 秒内结束，可重复触发不叠加卡顿）。
5. `/pig crown` 命令改成「有王冠就用，没有就提示去商店买」。已经加冕过的老存档保持 `form='king'` 不动。
6. 主屏 `crown` App 暂时保留，C4 替换。

验收：没王冠时加冕 App/命令都提示买；买了条件不齐点「加冕」不消耗；条件齐→特效→立绘变王；契约同理；老存档 king 不变。

## C4 图鉴（DSH，C3 合入后）
- 主屏 `crown` 位置换成「📖 图鉴」（`TABS` 同一格，key 改 `dex`，旧 `crown` tab 选中时回落到 `dex`）。
- 存档 `state.dex = {forms:{}, skins:{}, fish:{}, items:{}}`（`ensureDex`），记录「第一次获得时间/次数」。进背包、变身、换肤、钓到鱼时记。
- 分区（两层方块，同商店风格）：形态 / 皮肤 / 鱼 / 道具 / 纪念品。未获得显示灰色剪影 + 获得条件；形态卡显示条件进度（例如 魅力 12/20）。
- 分区注册表 `src/client/tabs/dex.js` 里留 `registerDexSection`，C5 鱼、C6 皮肤自己往里加。

验收：新猪图鉴全灰；买个苹果后「道具」点亮；调试变猪猪王后「形态」点亮；未解锁形态能看到差多少。

## C5 钓鱼（Codex）
**流程**（手动模式按用户复验意见改为圆盘技能检定）：
1. 抛竿：点击一次「抛竿」即可开始，使用固定标准距离，不设蓄力条。
2. 等咬钩：2–8 秒随机；出现「❗」后 **1 秒内**点击，否则跑掉。
3. 小游戏：指针沿圆盘顺时针转动，进入绿色命中区时点击或按空格；黄色完美区一次推进两格。难度 1–100 会缩窄命中区、加快转速，并把连续命中要求从 2 次提高到 4 次。点早或点晚只提示继续等待；连续三整圈都没有命中，鱼才会跑。
4. 结果卡：鱼 emoji、名字、尺寸、售价，「放进背包」。

**规则**：
- 服务端在抛竿时用 `roll(state)` 决定鱼和尺寸，存 `state.fishing.pending`（60 秒过期）；客户端只上报成功/失败。禁止 `Math.random()` 进 core（小游戏动画在客户端可以用）。
- 每次抛竿饱食 −1；猪在打工/学习/旅行时不能钓。
- 自动模式：选 30/60 分钟，猪去钓鱼（占用状态同打工，复用 `core/activity.js`），每 3 分钟按鱼难度判一次成功率（难度越高越低，最低 20%），售价按 **70%**；每天最多 2 次。
- 鱼表 `data/fish.js`：15 种，普通 8 / 少见 4 / 稀有 2 / 传说 1；按真实时间分早/午/晚/夜出现；售价 8–300；可喂（饱食 = 售价/2，上限 60）；key 统一 `fish_` 前缀（避开已有 `fish` 小鱼干）。具体表 Codex 写进 `docs/numbers/C5-fish.md`，用户验收时看。
- 背包鱼：「喂」「卖」两个按钮；图鉴「鱼」分区记最大尺寸。调试页加「钓鱼」组（一键给每种鱼、跳过等待）。
- 小游戏 60fps 用 requestAnimationFrame；同一条鱼的连续命中进度跨状态轮询保留，面板关掉自动判失败并停循环。

验收：手动能钓上/会跑；稀有鱼明显更难；刷新时 pending 不重复发鱼；自动模式 30 分钟后结算；鱼可喂可卖，图鉴点亮。

### 验证记录 — C5（Codex，2026-10-02）
- `npm run build` 通过并重新生成 `client.js`（219445 bytes）；`npm test` 437/437；`npm run typecheck` 0 错误。核心随机只经 `rollerFor` / `chance`，小游戏的 `Math.random()` 仅在客户端生成每轮判定区位置。
- 鱼表见 `docs/numbers/C5-fish.md`：15 种，普通 8 / 少见 4 / 稀有 2 / 传说 1。存档仍为 v12；`ensureFishing(state)` 给老存档补 `pending`、鱼篓、序号和每日自动次数，并清洗坏数据，没有升存档版本。
- 3084 隔离实例 + Python Playwright + `/usr/bin/chromium` 实测：抛竿页只有单击「🎣 抛竿」，蓄力条为 0 个；2–8 秒内出现「❗」，1 秒窗口内提竿进入圆盘技能检定。提前点击后 QTE 保持，完整空一圈和两圈后仍保持，第三圈全空才回到抛竿页；界面用三颗心显示剩余圈数。难度 86 的客户端用例确认需要连续命中 4 次，旧蓄力与竖条界面均已移除；关闭面板仍会失败并停止 rAF。
- 抛竿后刷新仍读到同一个 `pending.id`，不会重新抽鱼；成功只先进入结果卡，点「放进背包」后才记录鱼篓与图鉴，因此重复刷新/重复点击不会多发鱼。
- 30 分钟自动钓鱼实测从 `activity.kind=fishing` 开始；调试快进 30 分钟后 `activity=null`，金币 90333→90449，已点亮鱼种 1→5。验收时同时发现并修复了调试快进没有推进活动结束时间的问题，新增红测守住。
- 鱼篓实测「喂」后鱼从背包移除；调试给予黄金锦鲤后图鉴点亮并记录最大 `59.0 cm`；「卖」后金币 90449→90669、鱼从背包移除。调试页逐条提供 15 种鱼，并有「跳过等待」。
- 截图：`docs/screenshots/c5-cast-auto.png`、`c5-minigame.png`、`c5-catch-result.png`、`c5-fish-bag.png`；10 秒录屏：`docs/screenshots/c5-fishing.webm`。抛竿页、小游戏截图和录屏已按单击抛竿与三圈容错重拍；Playwright 控制台与 page error 均为 0。

## C6 换肤（Codex）
- `data/skins.js`：`{key, label, emoji, art, scenes, author, description}`；默认皮肤 `default`（现有 piglet）。`state.skin` 与 `state.customSkins` 由 `ensureSkins` 给老存档补齐，不升存档版本。皮肤不进入商店和背包；主菜单「🎨 换肤」与图鉴皮肤详情都能切换。
- 立绘查找顺序：形态（王/恶魔）> 皮肤 > 默认。**形态优先，皮肤被盖住**（用户说进化形态不管）。缺动作图时回落到该皮肤待机图。
- 先放 1 个占位皮肤（把 piglet.svg 换色）走通流程，等用户的图再加。

### 给用户的皮肤 SVG 规范（每套皮肤）
格式同 `docs/ART-SPEC.md`：`viewBox="0 0 64 64"`、透明底、平涂无位图/字体/渐变/滤镜，猪站位与 `assets/piglet.svg` 对齐（脚底同一高度、身体同一中心）。

| 必需 | 文件名 | 场景 |
|---|---|---|
| ✅ | `skin-<名>.svg` | 待机 |
| ✅ | `-eat` | 吃东西 |
| ✅ | `-bathe` | 洗澡 |
| ✅ | `-play` | 玩耍 |
| ✅ | `-pet` | 被摸摸 |
| 可选 | `-relaxed` | 闭眼放松/睡觉 |
| 可选 | `-work` | 打工 |
| 可选 | `-study` | 学习 |
| 可选 | `-trip` | 旅行 |
| 可选 | `-fish` | 钓鱼（C5 新增场景） |

最少 5 张能上线，完整 10 张。可选的缺了用待机图。

用户自定义皮肤统一交一个 ZIP，不要求逐张上传。包内根目录放 `skin.json` 和 SVG；最少 5 张、完整 10 张：

```text
my-skin.zip
├── skin.json
├── idle.svg
├── eat.svg
├── bathe.svg
├── play.svg
├── pet.svg
├── relaxed.svg   # 可选
├── work.svg      # 可选
├── study.svg     # 可选
├── trip.svg      # 可选
└── fish.svg      # 可选
```

`skin.json` 至少写 `key`、`label`、`author`，可选 `description`；`key` 只允许小写字母、数字和连字符。导入时逐个校验 SVG 尺寸与禁用元素，文件缺失或格式不合格时列清单，不写入半套皮肤。C6 实现时同时提交 `docs/examples/skin-pack/` 和可直接下载的 `docs/examples/skin-pack-example.zip` 作为参考包。

显示优先级固定为：**晋升形态 > 当前皮肤 > 默认猪**。猪猪王或恶魔猪启用时仍保留用户选择的皮肤状态，但画面由形态覆盖；恢复普通形态后自动显示原先选择的皮肤。

### 验证记录 — C6（Codex，2026-10-02）

- 先写红测：核心测试最初因没有 `SKINS` 表失败，客户端测试因主菜单没有换肤 App 失败；导入包测试先因 `store/skin-pack.js` 不存在失败。实现后 `npm run build` 通过并重新生成 `client.js`（226319 bytes），`npm test` 445/445 通过，`npm run typecheck` 通过。
- 主菜单新增「🎨 换肤」，皮肤不在商店、不进入背包。内置薄荷占位皮肤、默认皮肤和玩家皮肤均可直接切换；图鉴皮肤详情有同一条切换入口；调试页会从皮肤表与存档自动列出每一种皮肤。
- 3084 实测导入 `docs/examples/skin-pack-example.zip` 成功，当前皮肤变为 `mint-example`，自定义立绘 `/dsh-piggy/art/custom-mint-example.svg` 返回 200。导入器先检查整包，要求根目录清单和 5 张必需 SVG，并拒绝外链、脚本、文字、位图、渐变、滤镜及错误视框，再统一落盘。
- 3084 实测优先级：选中 `mint-example` 时普通形态使用 `custom-mint-example`；调试切到猪猪王后仍保留 `skin=mint-example`，画面使用 `pig-king`；恢复普通形态后自动回到 `custom-mint-example`。动作文件缺失时客户端按场景清单回落到该皮肤待机图。
- 老存档由 `ensureSkins(state)` 补 `skin='default'` 和 `customSkins=[]`，未知或损坏的皮肤记录会被清理；存档版本保持 v12，未升级。
- 教程与参考包：`docs/CUSTOM-SKINS.md`、`docs/examples/skin-pack/`、`docs/examples/skin-pack-example.zip`。截图：`docs/screenshots/c6-skins.png`、`c6-import.png`、`c6-dex-switch.png`；Playwright 使用 `/usr/bin/chromium`，控制台错误和 page error 均为 0。
- 验收反馈后统一视觉：换肤列表复用背包的 `dp-item` 货架行，使用中状态复用全站选中态，换肤、图鉴和导入按钮统一复用 `dp-mini`，导入区复用 `dp-pick` 操作卡；3084 重新切换并重拍三张截图。

## C7 胖猪（Codex）
- 体重分 3 档：正常 / 圆润（≥ 理想体重 ×1.3）/ 胖胖（≥ ×1.6）；理想体重按等级取（Codex 从现有 weightG 增长数据算一张表写进数值单）。
- 减重：玩耍、打工、钓鱼、每天自然回落 2%（向理想体重）。
- 只作用于默认皮肤普通形态；王/恶魔/其他皮肤不变。
- **用户给图规范**：圆润、胖胖各一套，每套同上表（最少 5 张：待机/吃/洗澡/玩/摸），文件名 `pig-round*.svg`、`pig-fat*.svg`。

### 验证记录 — C7（Codex，2026-10-02）

- 先写测试并确认会红：核心测试因缺少 `WEIGHT_RULES` 失败，客户端测试因状态页和调试入口不存在失败；补实现后又用“调试胖胖预设经过一分钟仍留在胖胖档”的回归测试复现临界值回落问题，再把调试预设从精确边界改为 1.31 / 1.61 倍。
- `npm run build` 通过，重新生成 `client.js`（201035 bytes）；`npm test` 425/425 通过；`npm run typecheck` 通过。完整测试同时检查 core 没有 `Math.random()`、生成包与源码一致、源码不超过 400 行。
- 三档边界实测与自动测试一致：正常 `< 1.3×`，圆润 `≥ 1.3× 且 < 1.6×`，胖胖 `≥ 1.6×`。Lv1/10/20/40/60 的理想体重和分档表记录在 `docs/numbers/C7-weight.md`。
- 减重实测：成功玩耍减少超重部分 3%，同一游戏日最多计 10 次；完成打工按实际小时复利减少 3%；在线、离线及倍速结算均按每猪日 2% 自然回落；三种方式都不会低于理想体重。C5 尚未落地，因此钓鱼减重留到 C5 的真实钓鱼动作接入。
- 立绘实测：只有普通形态 + 默认皮肤 + 胖胖档切换 PR #4 的 `pig-fat` 待机与动作立绘，王、恶魔和其他皮肤不变；9 张 `pig-fat*.svg` 在 3084 均返回 HTTP 200。PR #4 没有圆润图，圆润档按卡记录状态并暂用普通立绘。
- 调试页有“正常 / 圆润 / 胖胖”三个入口；状态页显示当前体型、理想体重、下一档阈值或当天剩余玩耍减重次数。
- 隔离实例：3084。Playwright + `/usr/bin/chromium` 实拍：`docs/screenshots/c7-fat-idle.png`（胖胖待机）、`docs/screenshots/c7-fat-play.png`（玩耍动作）、`docs/screenshots/c7-round-status.png`（自然回落到圆润后的状态页）；动作总览另见贡献者原图 `docs/screenshots/pig-fat-actions.gif`。
- 存档版本保持 v12，未升级。新增可选 `state.bodyWeight = { playDay, plays }`；`migrate()` 每次通过 `ensureBodyWeight(state)` 给老存档补齐并清理坏值，不改变已有 `weightG`、形态或皮肤。

---

## 给 agent 的提示词（直接复制）

### 给 DSH agent
```
你在 dsh-piggy 仓库 /zyx/DSH/workspaces/dsh-pig 的 main 上工作。先读 docs/archive/tasks/README.md 和 docs/archive/tasks/C-round.md（本轮任务卡），按顺序做 C1 → C2 → C4（C4 要等 Codex 的 C3 合进 main 再开工，开工前 git log --oneline -15 确认）。
硬规则：
- 每卡先写会红的测试，再改代码；完成后 npm run build && npm test && npm run typecheck 全绿。
- 只 git add 自己改的文件，不要 git add -A；不要碰 codex/* 和 claude/* 分支；提交信息 feat(pig)/fix(pig) 开头，不加任何 AI 署名行。
- 不升存档版本、不改 core/upgrades.js 和 STATE_VERSION，新字段用 ensureXxx(state)。
- 不改现有页面排版，只加新 App；数值照卡上写的，不合理写到卡末「疑问」，不要自己改。
- 随机数只用 core/random.js，禁止 Math.random() 进 core。
- 每卡同步更新 README 和 CHANGELOG（未发布小节）。
- 界面截图：起隔离实例（DSH_HOME 用拷贝，端口 3082，见 docs/archive/tasks/README.md 验收段），Playwright 截图存 docs/screenshots/c<N>-*.png；不要动 3080 上用户在用的 dsh。
- 每卡做完在卡末「验证记录」写测试结果、截图路径，然后停下告诉我，等验收后再做下一张。
```

### 给 Codex
```
你在 dsh-piggy 仓库工作。先建 worktree：git -C /zyx/DSH/workspaces/dsh-pig worktree add /zyx/DSH/workspaces/dsh-pig-codex -b codex/next main，之后都在 /zyx/DSH/workspaces/dsh-pig-codex 里干活。先读 docs/archive/tasks/README.md、docs/archive/tasks/C-round.md、docs/ART-SPEC.md、docs/CONVENTIONS.md。
顺序：C3 → C5 → C6（C7 等我给图再做）。
C3 第一步：gh pr checkout 3 拿到 PR #3（作者 1nuoiscute）的提交，保留原作者，在其上按卡改成「王冠/契约都是商店道具」。
每卡完成：npm run build && npm test && npm run typecheck 全绿 → git rebase main → 在主目录 git merge --ff-only codex/next 合进 main（DSH agent 也在 main 上提交，冲突你解决，不要覆盖他们的改动）。
硬规则：
- 先写会红的测试再改；随机只用 core/random.js 的 roll/chance/pickOne，core 里禁止 Math.random()。
- 不升存档版本，新字段 ensureXxx(state)；真要升先停下问我。
- 不改现有页面排版，只加新 App / 新货架；数值照卡写，C5 鱼表写进 docs/numbers/C5-fish.md。
- 每加一种形态/皮肤/鱼，调试页（src/client/tabs/dev.js）都要有对应入口，test/dev-coverage.test.js 会检查。
- 提交 feat(pig)/fix(pig) 开头，不加任何 AI 署名行；同步更新 README 和 CHANGELOG。
- 界面截图：隔离实例 3082 + Playwright + /usr/bin/chromium，存 docs/screenshots/c<N>-*.png；钓鱼小游戏另录一段 10 秒 GIF/webm。不要动 3080 上用户在用的 dsh。
- 每卡做完在卡末「验证记录」写结果，停下告诉我，等验收再做下一张。
```

---

## Verification（Claude 验收清单，每卡）
1. `git log` 看提交：无 AI 署名、只动了相关文件、README/CHANGELOG 有更新。
2. 在干净拷贝里 `npm run build && npm test && npm run typecheck`。
3. 起隔离实例 3082，Playwright 按每卡「验收」逐条点一遍，对照 agent 截图；钓鱼必须实际玩一局手动 + 跑一次自动（调试 ×60 加速）。
4. 老存档（`test/fixtures/` 里 v12 样本 + 用户当前存档拷贝）加载不报错、king 形态保留。
5. 不合格写回卡末「验收意见」，让对应 agent 改。


---

## 验证记录（各 agent 每卡完成后追加）

### C1 调试模式（DSH agent，2026-10-01）

- `npm run build && npm test`：**328 / 328 通过**（新增 `test/dev-coverage.test.js` 11 条，
  改写 `test/client.test.js` 里 2 条 B1 时代的旧断言 —— 它们还在测 Ctrl+Shift+D）
- `npm run typecheck`：**0 错误**
- 真机验收（隔离实例 3082，`DSH_HOME=/zyx/DSH/workspaces/.dsh-home-test`，Playwright + `/usr/bin/chromium`）：

  | 验收项 | 实测 |
  |---|---|
  | 刷新后无 🔧 | `data-dev="false"`、`[data-app="dev"]` 0 个 ✓ |
  | 连点 6 次不开 / 7 次开 | 6 次后 `false`，第 7 次 `true` ✓ |
  | 第 4 次起提示 | 气泡「再点 3 次」✓ |
  | 刷新又关 | reload 后 `data-dev="false"` ✓ |
  | 控制台 | `dshPigDev.on` / `.toggle` 都是 `undefined`，只有 `off` 是函数 ✓ |
  | 调试页一键变形态 | 「形态」组有 猪猪王 / 恢复普通 ✓（截图里是调试页全貌） |

- 截图：`docs/screenshots/c1-home-version.png`（主屏版本号）、`c1-tap-hint.png`（第 4 次提示）、
  `c1-dev-tab.png`（解锁后直接落在调试页）、`c1-dev-app.png`（🔧 App 出现）、`c1-form-king.png`（调试页形态组）
- 改动文件：`src/client/dev-mode.js`（新，连点解锁 + 控制台 off）、`src/client/index.js`（去掉
  Ctrl+Shift+D 与 localStorage 记忆，接线给主屏与调试页）、`src/client/constants.js`（解锁参数）、
  `src/client/tabs/home.js`（版本号）、`src/client/tabs/dev.js`（关闭调试 + 形态组）、
  `src/client/css-tiles.js`（`.dp-version`）、`packages/pet-core/src/core/state.js`
  （`applyDevPatch` 支持 `form`，`null` = 恢复普通）、测试两个、README、CHANGELOG


### C1 尾巴：形态按钮拉等级（DSH agent，2026-10-01）

- 用户定了「要拉等级」：等级低于该形态所在阶段时，同一次 dev patch 里把等级顶到起始等级。
  起始等级由宿主从 `data/life.js` 读（`formsView` 新增 `stage` / `fromLevel`），客户端不写死数字。
- 测试 +4（幼年拉等级、等级够了不动、纸盒置灰、死猪置灰）；`npm test` 333/333、typecheck 0。
- 真机（隔离 3082）：`Lv.2 幼年猪` → 点「👑 猪猪王」→ `Lv.40 猪猪王`，立绘换成 `pig-king` ✓
  截图 `docs/screenshots/c1-tail-form-level.png`。
- 备注：纸盒存档在真机上进不到调试页（面板整屏是纸盒页），那条置灰逻辑用直接渲染调试页的
  单元测试守着。

### C2 番茄钟（DSH agent，2026-10-01）

- `npm run build && npm test`：**356 / 356 通过**（新增 `test/pomodoro.test.js` 23 条：核心 15、
  界面 7、真实 store 1；顺手把客户端挂具抽成 `test/helpers/bundle.js`，C1/C2 共用）
- `npm run typecheck`：**0 错误**
- 红测试：把 `store/api.js` freshen 里的结算钩子注释掉，「走真实 store」那条立刻变红（已复原）
- 卡上四条验收（隔离实例 3082，Playwright + 接口实测）：

  | 验收项 | 实测 |
  |---|---|
  | 开 25 分钟后刷新仍在倒计时 | 刷新后 `active: true`、`secondsLeft: 1493`，猪头顶药丸 🍅 24:55 ✓ |
  | 调试 +1 小时后结算发奖 | `todayDone: 1`，金币 500 → 508 ✓ |
  | 第 9 个不给钱 | 设今天=8 → 再完成一个：`todayDone: 9`，金币仍是 508 ✓ |
  | 放弃不给奖励 | 放弃前后 `todayDone` 与金币都不变，药丸消失 ✓ |

- 截图：`docs/screenshots/c2-home-tile.png`（主屏新 App）、`c2-app-idle.png`（三个时长）、
  `c2-focusing.png`（专注中：页面倒计时 + 猪头顶 🍅 + 开场台词）、`c2-after-reload.png`（刷新后还在走）、
  `c2-settled.png`、`c2-cap.png`（今天=8 之后）、`c2-abandoned.png`
- 实现要点：状态在 `state.pomodoro`（`ensurePomodoro` 补默认值，**不升存档版本**）；结算挂在
  `store/api.js` 的 freshen（每次读状态都会结算，所以关着面板也算）；完成时 `finishedAt` 变化，
  客户端按时间去重弹一次浏览器通知，没权限退回气泡
- **顺带一动**：调试页「⏩ +1 小时」以前只推进猪的时间（decay），墙上时钟不动，所以番茄钟永远
  等不到点。现在快进会把番茄钟的 `startedAt` / `restUntil` 一起往前挪并立即结算 —— 这是卡上
  「调试快进一小时后结算发奖」这条验收的前提，改动只在 `applyDevPatch` 的调试分支里。

### C2 返工（DSH agent，2026-10-01）

**1. 头顶 🍅 角标压面板（必改）**

- 原来 `.dp-pomo` 挂在**场景**上（`bottom:calc(100%+40px)`、`z-index:4`），面板打开时正好落在
  「今天完成」那行中间。现在改成挂在**猪立绘**上的小角标：`bottom:calc(100% + 2px)`、`right:-4px`、
  `z-index:1`（低于说话气泡的 2、也低于装扮层 3），跟着猪一起动。
- 真机实测（隔离 3082，`getBoundingClientRect` 采样）：
  - 面板收起：角标离猪头 **18px**（要求 ≤20px）；与面板/ HUD / 气泡重叠面积 **0 px²**（12 次采样）
  - 面板打开：角标离猪头 **19px**；与面板重叠 **0 px²**（面板底边 602、角标顶 639，让开 37px）、
    与 HUD 重叠 **0 px²**（HUD 右 789 < 角标左 828）
- 说话气泡和角标位置挨着，所以加了条规则：**猪说话时角标让位**（`showBubble` 先把它藏起来，
  气泡收起后按 `data-pomo` 放回来）。真机实测：摸一下猪 → 气泡「再多待一会儿」出现 → 角标隐藏；
  3.2 秒后气泡消失 → 角标回来（🍅 44:44）。
- 截图：`docs/screenshots/c2-pill-open.png`（面板打开）、`c2-pill-closed.png`（面板收起）、
  `c2-pill-open-zoom.png` / `c2-pill-closed-zoom.png`（放大自查没有重叠）、`c2-pill-bubble.png`（让位瞬间）；
  顺手把 `c2-focusing.png` 按新样式重截。

**2. 放弃前先结算（小修）**

- `abandonPomodoro` 现在先调 `settlePomodoro`：已经到点的按完成返回（`{ok:true, done:true, ...}`，
  照常计数发奖、说完成台词、恢复免打扰），没到点才走放弃分支（返回里带 `abandoned: true`）。
- 红测试：`test/pomodoro.test.js` 的「放弃一个已经到点的番茄」——先写红，再去掉修复里的两行确认它变红，
  然后复原。顺带发现原来那条「中途放弃」的测试其实一直在放弃一个**已经完成**的番茄（`at(20)` 是 20:00，
  45 分钟的那轮 10:45 就到点了），改成真正的 20 分钟后放弃。
- `npm run build && npm test`：**360 / 360 通过**；`npm run typecheck`：**0 错误**
- 改动文件：`packages/pet-core/src/core/pomodoro.js`、`src/client/scene.js`、`src/client/panel.js`、
  `src/client/effects.js`、`src/client/css-tiles.js`、`test/pomodoro.test.js`、README/CHANGELOG

### D1 桌面版 Windows 卡顿（DSH agent，2026-10-01）

**改了什么**

1. **窗口改小**：主进程不再铺满工作区，只框住页面报上来的内容外接矩形 + 16px（`lib/window-geometry.js`，
   纯函数可测）。以窗口**右下角**为锚：内容变大就往左上长，贴边时自动收进 `workArea`，多显示器按窗口所在的
   那块屏算。页面把「猪 + 面板 + 气泡」的框报上来（`piggy:content`），拖猪改成把鼠标增量交给主进程
   （`piggy:move`），页面自己不再改坐标；窗口位置存 `userData/window.json`。
2. **量框不被动画带跑**：渲染层改用布局盒（`offsetLeft/offsetTop/offsetWidth/offsetHeight` 累加到 body），
   再按 4px 取整比 key —— 呼吸/浮动只改 transform，猪闲着时一次都不上报。
3. `win.webContents.setFrameRate(30)`。
4. 阴影从做动画的 `.dp-pig` 挪到立绘（`.dp-pig-img`/`.dp-pig-emoji`）上；心情滤镜（脏/病/去世）同样挂在立绘上，
   网页版视觉不变。
5. Linux/macOS 没退化：X11 窗口形状照旧（可点区域仍是猪 + 面板两块），拖动、托盘、退出、更新 App 都没动。

**验收**

- 自动化：`apps/desktop/test/window.test.js` 7 条 + `test/desktop-shell.test.js` 3 条
  - 猪闲着 10 秒（120ms × 83 次 tick）`setShape`/`setContent` **多调 0 次**（红测试：改之前会一直调）
  - 拖猪时窗口跟着走（两次 pointermove → 两次 `moveBy`），页面坐标不写
  - 桌面版面板按屏幕空间朝上开、横向不挪；网页版（没有外壳时）行为不变
  - 几何：锚右下角、贴边收进 workArea、多显示器夹取、4px 取整
- `npm run build && npm test`：**370 / 370 通过**；`npm run typecheck`：**0 错误**
- **Linux 实机**（X11，本机 3840×2160 屏）：`apps/desktop` 用 electron 44.5.1 + `--ozone-platform=x11` 跑起来，
  python-xlib 查 X 树里的真实窗口（不信 capturePage）：
  - 收起：**117×114 DIP**（X 里 234×228 物理像素），停在工作区右下角；主进程日志 `bounds content 117x114` ✓
  - 面板展开：**324×271 DIP**（X 里 648×542），正好是面板 292 + 32 留白 ✓
  - 可点区域（`XShapeGetRectangles`）**2 块**：面板 (32,32,584,192) + 猪 (32,240,584,272) —— 空白角被抠掉，
    点得到桌面 ✓
- **给 Windows 用户的实测步骤**（Claude 补充：现象主要出在浏览器 —— 全屏透明置顶窗口压着，
  浏览器的 direct flip/overlay 失效）：
  1. 装免安装版 `dsh-piggy-portable-<版本>.exe`，开着猪，滚动一个长网页（新闻/微博都行），
     记录 1 分钟任务管理器里 `dsh-piggy` 和「桌面窗口管理器」的 CPU/GPU；
  2. 托盘「退出」关掉猪，同样滚动 1 分钟，再记一次；
  3. 对比两次；顺带确认：拖猪、展开面板、空白处点击落到桌面、托盘、退出、更新 App 都正常。
- **Windows 测试包：本机打不出来**（`apps/desktop` 没装 electron-builder，机器上也没有 wine，NSIS 打不了；
  `.github/workflows/release.yml` 是 `push: tags: v*` 触发的，还要标签与 `package.json` 版本一致）。
  可选：① 推一个 `v0.25.2`（或 0.25.1 的补丁版）标签，CI 会产出
  `dsh-piggy-portable-<版本>.exe`；② 在 Windows 机器上进 `apps/desktop` 跑 `npm install && npm run dist:win`。
  要哪种我照做（推标签需要你点头）。
- 截图/日志：`/zyx/DSH/workspaces/.piggy-desktop.log`、窗口日志在 `PIGGY_USERDATA/piggy.log`（临时目录，未入库）


### D1 返工（DSH agent，2026-10-01）：第 1 条修好；第 2 条（拖动）通过；第 3 条左上角展开**仍未通过**

**改了什么**

1. **外壳挂载顺序（Claude 指出的 bug）**：`renderer/shell.js` 现在在加载 `client.js` **之前**就挂好
   `window.__dshPiggyShell`（拿不到几何时 `room()` 返回 null）；`src/client/index.js` 里的外壳判断同时
   改成「每次用时现取」（`desktopShell()`，抽到 `src/client/desktop-shell.js`）。之前 client 挂载那一刻
   外壳还是 undefined → 桌面版被当成网页版：拖动只挪页面里的猪、窗口不跟、还写网页版的 POSITION_KEY。
2. **拖动改用屏幕坐标**：增量按 `event.screenX/screenY` 算（窗口自己在动，clientX 会算错；老环境没有
   screenX 时退回 clientX）。删掉了 `shell.js` 里那条重复的 `moveChannel` —— 以前两边都会发 `moveBy`，
   位移会翻倍。改完只有 `index.js` 的拖动发。
3. **锚边协议（面板展开不再靠推算）**：页面把「猪贴哪两条边」(`anchor`) 和内容框一起报上来，主进程
   固定住那两条边、往另一边长（`lib/window-geometry.js` 的 `contentBounds(before, content, area)`）。
   收益：不再用「上次报告的猪偏移」推算位置，去掉了那一路漂移。
4. **外壳把猪钉在锚边上**（`pinPig` 闭环）：面板撑宽场景时猪在 host 内部会偏，所以按猪的实际布局盒
   反推 host 内边距，让猪离锚边正好 16px；面板收起（内容对称）时保持上一次锚边。
5. **两个连带的坑**：① 客户端在桌面版不再写 `host.style.right/bottom`（和外壳的 left/top 一起会把
   host 拉宽，实测面板一开猪漂 207px）；② 外壳从没订阅 `piggy:geometry`，预载里 `geometry` 永远是
   null → `room()` 一直返回 null，桌面版挑边的分支根本没跑（新增 `askGeometry` 主动要一次）。

**测试**：`npm run build && npm test` → **378 / 378 通过**；`npm run typecheck` → **0 错误**。
新增/改动：
- `apps/desktop/test/window.test.js`（12 条）：真实加载顺序（client 挂载时外壳已在，先写红：把外壳挂回
  apply() 之后两条都会红）、外壳订阅并主动问几何、上报带猪的位置、四角展开收起几何不变量、
  「猪离锚边 16px」的钉边补偿。
- `test/desktop-shell.test.js`（5 条）：真实顺序 E2E（加载 shell.js → client.js，按住猪拖，断言 `moveBy`
  被调、累计位移 = 鼠标屏幕位移、页面里猪位置不变、不写 POSITION_KEY）、按屏幕坐标算增量、面板按屏幕
  空间挑边、网页版行为不变。

**X11 实机数据**（本机 3840×2160 物理 / 1920×985 工作区 DIP，electron 44.5.1 `--ozone-platform=x11`，
窗口位置用 python-xlib 读 X 树；拖动由页面内派发 PointerEvent 驱动真实代码路径 —— 这台机器上 XTEST
注入不生效，指针推不动，所以「真鼠标」这一环用合成事件代替）：
- **拖动 5 个来回（每次 300 DIP = 600 物理px）**：

  | 次数 | X 窗口 x 前 → 后 | 位移 | 误差 | 猪中心离鼠标 |
  |---|---|---|---|---|
  | 1（+300） | 3570 → 3606 | +36 px | 564 px（**被屏幕右缘夹住**，起点离右缘只有 27px） | 282 DIP |
  | 2（−300） | 3606 → 3006 | −600 px | **0 px** | 4.0 DIP |
  | 3（+300） | 3006 → 3606 | +600 px | **0 px** | 3.3 DIP |
  | 4（−300） | 3606 → 3006 | −600 px | **0 px** | 1.4 DIP |
  | 5（+300） | 3006 → 3606 | +600 px | **0 px** | 1.2 DIP |

  结论：除了被工作区夹住的第一次，误差 0px、猪始终贴在鼠标下（≤4 DIP），拖动这条过了。
- **左上角展开/收起：✗ 没通过**。把猪拖到左上角后（X 窗口 0,58 / 234×228 物理；猪屏幕坐标 27.1, 65.4 DIP）：
  - 展开：X 窗口 (0, 58, 648, 538)，面板完全在窗口里 ✓，但**猪跑到 234.5, 42.2 DIP（横移 +207.3，纵移 −23.2）** ✗
  - 收起：尺寸回到 117×114 ✓，但猪仍在 235.5, 45.0（相对收起态 +208.3 / −20.4）✗
  - `room()` 这次是好的：左上角 `{above:40, below:887, left:28, right:1819}` ✓
  - 现在的现象：窗口左边缘停在 0（屏幕左缘，被夹住），而猪在窗口右侧 —— 即主进程按「猪贴右边」的锚边
    把 324 宽的窗口放在 x=0 处就顶到屏幕左缘了。剩下要解决的是「面板朝右开」和「窗口往右长」这条链路
    没有真正对齐（客户端挑边 → 外壳读锚边 → 主进程固定边）三者的一致性问题，我没在本次做完。

**结论**：第 0 条（提交/记录）、第 1 条（加载顺序）✅；第 2 条（拖动）✅ 有实机数据；第 3 条（左上角展开时
猪不动）❌ 仍未通过。不申请验收，等 Claude 看这个诊断。
### C3 加冕道具化（Codex，2026-10-01）

- rebase 到包含 C1、C2、D1 的最新 `main` 后，`npm run build`：通过；`npm test`：
  **395 / 395 通过**；`npm run typecheck`：**0 错误**。`client.js` 由构建脚本重新生成且无未提交差异。
- 没有王冠时，加冕 App 与 `/pig crown` 都拒绝操作并提示去商店购买王冠。
- 买到王冠但条件不齐时，点「加冕」会拒绝、保留背包中的王冠，并逐条列出尚未满足的条件；
  条件全部满足后播放 `👑✨` 全屏特效、立绘切换为猪猪王，并消耗 1 个王冠。
- 恶魔契约走相同的商店购买、条件校验和成功消耗流程；背包按钮文字为「签约」，成功时播放
  `😈🔥` 全屏特效并切换为恶魔猪。
- 老存档实测：已有 `form='king'` 的存档加载后仍是猪猪王。旧版把 `crown` 当装扮键，加载迁移时
  `sanitizeDressList` 将 `dress` 与 `worn` 中的 `crown` 同步映射为 `royal-crown`，因此已购装扮不丢、
  穿戴状态保留；本轮**没有提升存档版本**，迁移是幂等的字段/键兼容处理。
- 截图：`docs/screenshots/c3-crown-needs-item.png`（无王冠提示）、
  `docs/screenshots/c3-promotion-shop.png`（晋升货架）、`docs/screenshots/c3-bag-crown.png`（背包加冕按钮）、
  `docs/screenshots/c3-king-effect.png`、`docs/screenshots/c3-king.png`、
  `docs/screenshots/c3-devil-effect.png`、`docs/screenshots/c3-devil.png`。
- 截图实测使用隔离实例与 Playwright + `/usr/bin/chromium`；后续隔离实例按用户要求固定使用 3084，
  不触碰 3080、3082、3083。

### C4 图鉴（Codex，2026-10-02）

- 先写 `test/dex.test.js` 与 `test/dex-client.test.js`，实现前定向运行 7 条全部失败；实现后完整验证：
  `npm run build` 通过，最终目录返工后 `npm test` **414 / 414 通过**，`npm run typecheck` **0 错误**，`client.js` 由构建脚本重新生成。
- 3084 隔离实例 + Playwright + `/usr/bin/chromium` 实测：新孵化的猪五个分区计数分别为形态 0/2、
  道具 0/63、纪念品 0/25，皮肤和鱼显示「等待收录」；买苹果后道具变 1/63，苹果显示「获得 1 次」；
  调试切成猪猪王后形态变 1/2，猪猪王显示「获得 1 次」，未解锁的恶魔猪仍列出等级、魅力、武力、
  本代玩耍的当前值/目标值。浏览器控制台无错误。
- 截图：`docs/screenshots/c4-home-dex.png`、`c4-sections-empty.png`、`c4-forms-locked.png`、
  `c4-items-apple.png`、`c4-forms-king.png`。
- 第一次复审把形态改成闪卡；第二次按用户确认的方案收紧为三列小卡，闪卡只用于形态与皮肤，且只有
  已解锁卡有倾斜和流光。未解锁形态使用对应 SVG 的灰黑剪影和锁章，详情只给谜面，不泄露精确数值；
  解锁后显示原色 SVG、简介、首次发现和获得次数。鱼与纪念品改成动森式博物馆格，道具改成可搜索、
  可按用途筛选的紧凑目录；点开任意条目时列表退出，由独立详情页接替。
- 最终 3084 实测：闪卡为 82 × 102.5 px；详情打开时列表条目数为 0；道具目录共 63 条，搜索「苹果」
  仅显示 1 条，清空搜索后筛选「晋升」显示 2 条；纪念品博物馆格为 25 条；浏览器控制台无错误。
  截图：`docs/screenshots/c4-dex-dashboard.png`、`c4-dex-small-cards.png`、
  `c4-dex-form-detail.png`、`c4-dex-item-catalog.png`、`c4-dex-museum.png`。
- 迁移：新增 `ensureDex(state, nowMs)`，老存档从当前形态、背包数量、已购家当、纪念品回填；已发现条目
  即使物品用掉或纪念品卖掉也保留，领养下一只猪时跟随主人继承。本轮**没有提升存档版本**，仍为 v12。


### D1 返工 2（DSH agent，2026-10-01）：根因已修（207px 跳没了），残余 12.8 / 24.9 DIP 仍未达标

**按 Claude 指出的根因改的**
1. `src/client/layout.js` 的桌面分支：`opensRight` 时在 host 上写 `data-panel-side="right"`（否则 `left`），
   网页版不写这个属性。
2. `src/client/css-base.js`：新增 `[data-dsh-pig][data-panel-side="right"] .dp-scene{justify-content:flex-start}`
   —— 朝右开时猪待在场景左端，不再「面板一撑宽场景、猪就从左端滑到右端（≈292−猪宽−留白 ≈ 207px）」。
   跟着猪定位的元素一起镜像：
   - `[data-panel-side="right"] .dp-bubble{right:auto;left:8px}`（`css-tabs.js` 里气泡尖角同样镜像
     `::after{left:auto;right:14px}`）
   - `[data-panel-side="right"] .dp-work{margin:0 0 6px 2px}`（打工道具是场景的 flex 兄弟，顺序不变）
   - HUD 仍从场景左边起（猪在左端时 9px 正好贴它）；番茄角标和装扮点位本来就挂在猪身上（`pig.appendChild`），
     不用改。
3. **发现并修掉一个把我上一轮实机数据全测歪的坑**：桌面版加载的是 `apps/desktop/game/` 里**打包好的**
   `client.js`，我前两轮改动没重新 `pack-game`，所以实机跑的是旧前端 —— 之前「左上角漂 207px」的数字里混着
   这个因素。现在每次实机前都先 `npm run pack-game`。

**测试（先写红）**：`test/desktop-shell.test.js` 新增 2 条 —— 四个角挑边（断言 `data-panel-side`、
面板贴哪边、HUD 起点）和 CSS 镜像规则。把属性写入和三条 CSS 撤掉后，两条都会红（已验证），恢复后绿。
`npm run build && npm test` → **380 / 380**；`npm run typecheck` → **0 错误**。

**X11 实机（本机 3840×2160，electron 44.5.1 `--ozone-platform=x11`，python-xlib 读 X 树；实机前先 pack-game）**
- 拖到左上角（X 窗口 (0,58,234×228)，猪屏幕坐标 (26.8, 64.5) DIP）→ 展开：
  - X 窗口 **(0,58,648×538)**、`data-panel-side=right`、面板 (10,94,292×97) **完全在窗口里** ✓
  - 猪屏幕坐标 **(14.0, 39.6)** → 位移 **(-12.8, -24.9) DIP** ✗（要求 ≤4）
  - 收起后 X 窗口回到 (0,58,234×228) ✓，猪 (15.7, 44.3)，相对收起态 (-11.1, -20.2) ✗
  - 另一次跑（猪先被拖过几个来回、收起态偏移不同）量到 **(-0.1, -0.4) DIP** ✓ —— 说明 207px 那一跳确实没了，
    残余位移跟「收起时猪离锚边多少」有关。
- 重叠检查：HUD∩猪 0px²、HUD∩面板 0px²、气泡∩面板 0px²、角标∩HUD 0px²、角标∩气泡 0px² ✓
  （注意：这次是新鲜存档，猪还是纸盒，气泡/番茄角标都是隐藏的，这几项证据偏弱）
- 截图：面板朝右开（猪在左上角）[`docs/screenshots/c-round-panel-right.png`](../../screenshots/c-round-panel-right.png) —— 纸盒在左上、
  面板在它下面、`戳三下` 提示在面板上方，目视不重叠 ✓

**残余位移的原因（我的判断，供 Claude 复核）**：外壳 `pinPig` 把猪钉在「离锚边 16px」，可收起时猪离窗口
左边其实是 26.8px（它钉的是右边/下边）。面板朝右开时锚边从 right 翻到 left，钉位从 26.8 变 16，这 ~11px 的
台阶被算进了猪的屏幕位移；纵向同理（收起贴底、展开贴顶，差 16 + HUD 那几像素 ≈ 25）。要压到 ≤4px，
得让「翻锚边」这一步也被主进程补偿掉（或者收起态就按面板将要开的方向钉），这轮没做完。

**结论**：根因（CSS 让猪永远靠右）✅ 已修，207px 跳消失；左上角展开/收起的残余位移 12.8 / 24.9 DIP
**未达标**，不申请验收。


### D1 返工 3（DSH agent，2026-10-01）：✅ 四个角展开/收起位移全部 0.0 DIP

**按 Claude 给的两步收敛做的**
1. `shell.js` 上报里多带 `pigWindow`（`layoutBox(.dp-pig)` 的**窗口坐标**，不减内容框原点）；
   key 里给它的档位是 **1px**（内容/猪在内容框里的位置仍是 4px）—— 主进程补完平移要靠这次重报验证，
   粗了会漏掉 4px 以内的补正。
2. `lib/window-geometry.js` 新增纯函数 `anchorCorrection(windowBounds, pigWindow, targetPigScreen, area)`：
   算「猪现在的屏幕坐标 − 内容变化前记下的屏幕坐标」，不为 0 就返回平移后的 bounds（夹进 workArea），
   差值 ≤1px 时返回 null（不折腾）。
3. `main.js`：内容变化（尺寸或锚边变了）时先 `setBounds` 改大小，同时记下 `anchorFix = {target: 猪的屏幕坐标}`；
   页面下一帧再来报（窗口大小变了，`pigWindow` 会变 → key 变 → 必然重报）时调 `anchorCorrection` 补一次平移，
   收敛或补满 3 次就撤掉这个标记。**闲着不触发**（没内容变化就不进这条分支）。
   Claude 说的根因就是这个：主进程把内容框原点当成窗口原点，面板换方向时最左/最上的框换人，差值变成十几像素。

**测试（先写红）**：`apps/desktop/test/window.test.js`
- 「四个角展开/收起：两步收敛后猪的屏幕坐标差 ≤ 4px」：模拟四个角各展开、收起一次（含锚边翻转的左上/左下），
  断言补正后 ≤4px、窗口不出界。**红证明**：把 `anchorCorrection` 直接 return null，这条立刻红。
- 「收敛不折腾」：容差内返回 null、差 10px 时正好补掉 10px。
- 外壳侧：「上报要带 pigWindow」。
`npm run build && npm test` → **383 / 383**；`npm run typecheck` → **0 错误**。

**X11 实机（`npm run pack-game` 之后跑，本机 3840×2160，electron 44.5.1 `--ozone-platform=x11`）**
四个角各拖过去 → 展开 → 收起，猪的屏幕坐标用**布局盒**量（`offsetLeft/offsetTop` 累加：
`getBoundingClientRect` 含浮动动画的 transform，会带 ±7px 噪声，上一轮就是这个把我自己骗了）：

| 角 | data-panel-side | 展开位移 (DIP) | 收起位移 (DIP) | 面板在窗口里 | 窗口尺寸回到收起态 |
|---|---|---|---|---|---|
| 左上 | right | **(0.0, 0.0)** | **(0.0, 0.0)** | ✓ | ✓ |
| 右上 | left | **(0.0, 0.0)** | **(0.0, 0.0)** | ✓ | ✓ |
| 左下 | right | **(0.0, 0.0)** | **(0.0, 0.0)** | ✓ | ✓ |
| 右下 | left | **(0.0, 0.0)** | **(0.0, 0.0)** | ✓ | ✓ |

主进程日志里能直接看到两步（左上角那次）：
```
bounds content {"x":1596,"y":743,"width":324,"height":271}   ← 第一步：改大小
bounds anchor  {"x":1584,"y":743,"width":324,"height":271}   ← 第二步：补 12px 平移
```
（补的这 12px 就是上一轮残余的十几像素。）截图（朝右开、猪在左上角）：
[`docs/screenshots/c-round-panel-right.png`](../../screenshots/c-round-panel-right.png)。

**上一轮的教训**：桌面版加载的是 `apps/desktop/game/` 里打包好的 `client.js`，改 `src/client` 后必须
`npm run pack-game` 再实机，否则测的是旧前端。

**C4 那件小事（加冕/签约台词）**：C3 还没合进 main —— `git merge-base --is-ancestor 6c20d76 HEAD` 为假，
`main..codex/next` 还有 12 个提交（加冕/签约/恶魔猪都在那边）。`data/lines.js` 里的 `coronation`/`contract`
场景和「成功时用它们」都依赖 C3 的晋升道具流程，所以我没动 `lines.js`（避免和 codex/next 冲突），
等 C3 合进来之后我马上补。

## 疑问（数值/规则觉得不合理写这里，等用户定）

- **C2 番茄钟**三条自己定的规则，等用户点头：
  1. 猪在打工 / 学习 / 旅行（`state.activity !== null`）时**开不了**番茄钟（它在外面陪不了你），
     返回 `reason: 'away'`；纸盒和已去世同理。
  2. 「休息 5 分钟」只做显示与提示，**可以直接开下一个**（不强制等待）。
  3. 开始前如果用户自己开着免打扰，结束后仍然保持免打扰（不覆盖用户设置）。

- **C1**：「形态」按钮按卡只改 `state.form`。而形态的立绘只在该形态对应的生活阶段才显示
  （猪猪王要 `middle`/青年以后，见 `formStageView`），所以幼年猪点「猪猪王」看不到变化。
  要不要让这个按钮顺手把等级顶到该形态所在的阶段（更好按着玩），还是保持"只改形态"？
  现在是保持原样，验收时可以先点「等级 → 成年 Lv40」再点形态。
  - **用户定（2026-10-01）：要。** 形态按钮在猪的等级低于该形态 `stage` 的起始等级时，同一次 patch 里把等级拉到那个起始等级（取 `data/life.js`，不要写死 40/10）；已经够了就不动等级。纸盒/死猪先孵化/复活再说，按钮置灰并写原因。


## 验收意见（Claude 写）

### C1（Claude，2026-10-01）：✅ 通过
- 提交 0ff5878：无 AI 署名，只动了 C1 相关文件，README/CHANGELOG 已更新；`client.js` 重新构建后无差异。
- `npm test` 328/328，`npm run typecheck` 0 错误（用 deepseek-harness 里的 tsc）。
- 自己起的隔离实例（3083，存档拷贝）+ Playwright 实测：老存档 localStorage 里是 `1` 启动仍为关；控制台只剩 `dshPigDev.off`；主屏显示 `v0.25.1`；第 6 次提示「再点 1 次」且未开，第 7 次开；调试页「👑 猪猪王」在 Lv40 下立绘变 `pig-king`、「恢复普通」能变回；「关闭调试」后 🔧 App 消失；刷新后仍是关、localStorage 为 `0`。
- 「疑问」里形态按钮要不要顺手把等级拉到对应阶段：等用户定，没定之前保持只改形态。

### C1 尾巴（Claude，2026-10-01）：✅ 通过
- a41a248：幼年猪点「猪猪王」直接到 Lv40 并换立绘；起始等级从 life 表读；测试齐。

### C2（Claude，2026-10-01）：⚠️ 功能通过，界面有 1 处要返工 + 1 处小修
通过的部分：c165155 无 AI 署名；`npm test` 356/356、typecheck 0、`client.js` 无差异；core 里无 `Math.random`/`Date.now`；主屏只是多了一格，原有排版没动。
自己起的隔离实例（3083，存档拷贝）实测：开 25 分钟后刷新仍显示 🍅 24:55；调试「+1 小时」后结算，金币 508→516、今日 1 个；今日已 9 个时再完成只计数不给钱；开 15 分钟后放弃，金币不变、猪说放弃台词。

要改：
1. **头顶 🍅 药丸压在面板上**（必改）。`.dp-pomo` 用 `bottom:calc(100% + 40px)` + `z-index:4`，面板打开时它正好落在面板「今天完成」那一行中间，盖住文字（你自己的 `c2-focusing.png` 里也是这样）。改成贴在猪立绘右上角的小角标（跟着猪走，不超出猪的范围上方 20px），层级低于面板，面板打开时不能盖住面板任何内容；也不能和猪的说话气泡、HUD 卡片重叠。改完补两张截图：面板打开 / 面板收起 时的专注状态。
2. **放弃前先结算**（小修）。`abandonPomodoro` 没先调 `settlePomodoro`：时间已到但还没轮询到时点「放弃」，会把一个已经完成的番茄当放弃丢掉。放弃时先结算，已经完成的就按完成处理并返回完成结果。补一条会红的测试。

---

## D1 桌面版 Windows 卡顿（插队，优先于 C4）

**现象**（用户反馈，2026-10-01）：Windows 用户开着**桌面版**猪，**浏览器**会卡（其他软件基本无感）；关掉猪就好。全屏透明置顶窗口压在浏览器上，会让浏览器的显卡直出通道（direct flip/overlay）失效、退回慢合成，所以主要是浏览器受影响。验收时也要让 Windows 用户开着猪滚动长网页，前后对比。

**Claude 排查结论**：
- 网页版猪本身不重：用真实存档隔离实例连续量 3 分钟，JS 约 1% CPU，节点/监听/内存没有增长；页面上一直在跑的动画只有一个（`.dp-pig` 的 bob/breathe，只改 transform）。
- 问题在桌面版外壳 `apps/desktop`：
  1. `main.js:105` 窗口**铺满整个工作区、透明、置顶**（`transparent:true` + `alwaysOnTop`）。Windows 上每帧都要合成一整块全屏带透明度的图层；猪一直在动，就是全屏 60fps 一直重新合成，整台机器跟着卡。Linux/X11 没这个代价，所以我们这边没发现。
  2. `renderer/shell.js` 每 120ms 量一遍猪和面板的框，变了就 `setShape`。呼吸动画会改 `getBoundingClientRect`：实测面板收起时每秒 1.7 次 `setShape`，Windows 上就是 `SetWindowRgn`，每次都会让整窗重绘。
  3. 次要：`.dp-pig` 在动的同时带 `filter: drop-shadow(...)`（`css-base.js:105/140/141`），可能每帧重算滤镜。

**修法**：
1. **窗口改小**（根治）：窗口不再铺满屏幕，只框住「猪 + 面板 + 气泡」外接矩形再留 16px 边。猪拖到哪，窗口就移到哪（`win.setBounds`，屏幕坐标）；面板打开/收起时改窗口大小。页面里的猪坐标改成相对窗口。面板往哪边展开沿用现在的规则（靠屏幕边时朝里开），由主进程按 `screen.getDisplayMatching().workArea` 算好，不能伸出屏幕。窗口改小以后 `setShape` 只在面板展开时用来抠掉空白角，或者干脆不用。
2. **不再被动画带着测**：量框时用不随动画变化的容器（`.dp-scene` 等布局框，PAD 已经盖住 9% 缩放），或者把结果取整到 4px 再比较，保证猪闲着时 `setShape`/`setBounds` 每秒 0 次。
3. `win.webContents.setFrameRate(30)`；面板收起、猪闲着时可以再降。
4. 把 `filter: drop-shadow` 从正在做动画的 `.dp-pig` 上挪到不动的外层，或者换成一个静态的阴影元素。网页版视觉不能变。
5. Linux（X11/Wayland 回退到 X11 那条路）和 macOS 行为不能退化：拖动、点穿空白处、托盘、多显示器都要还能用。

**验收**：
- 自动化：渲染层加一个测试，猪闲着 10 秒内 `setShape`/`setBounds` 调用 0 次；拖动时会跟。
- Linux 实机：窗口大小 ≈ 猪/面板外接框，用 python-xlib 查 X 树里的窗口尺寸（不能只看 `capturePage`）；空白处点击能点到桌面。
- **Windows 由用户找人实测**：发一个测试包（`dsh-piggy-portable-<版本>.exe`），同一台机器开猪前后，各看 1 分钟任务管理器里 dsh-piggy 和「桌面窗口管理器」的 CPU/GPU，记录到「验证记录」；拖动、展开面板、点穿都正常。

### D1（Claude，2026-10-01）：❌ 方向对，有 1 个确认的 bug + 1 个高风险点，改完再验
通过的部分：163c040 无 AI 署名；网页版改动都包在「检测到桌面外壳」的分支里，阴影挪到立绘上视觉等价；量框改成布局盒 + 4px 取整、`setFrameRate(30)`、窗口改小这几条思路都对；370 项测试全过。

要改：
1. **猪在屏幕上半部分时，面板整个看不见**（已确认）。外壳把猪钉在窗口右下角（`shell.js` `host.style.right/bottom = INSET`），主进程也以窗口右下角为锚往左上长（`window-geometry.js` `contentBounds`）。可 `fitPanel` 在 `room.below > room.above` 时让面板往**下**开（`top: calc(100% + gap)`），面板就落在窗口底边之外。Claude 用 Chromium 加载 `apps/desktop/renderer` + 伪造外壳复现：窗口在屏幕顶部（y=0）时，窗口高 552，面板却在 544–923，整块在窗口外；同时主进程会把窗口往下挪，猪会跳。
   修法：锚点跟着面板方向走。面板朝上开时，猪在窗口底部、锚右下角；面板朝下开时，猪在窗口顶部、锚**右上角**（窗口往下长）。横向同理：猪靠屏幕左边时锚左边、面板朝右开。原则是**展开、收起面板时，猪在屏幕上的位置一像素都不动**，收起后窗口回到原位。补几何测试：四个角各开一次、收一次，断言猪的屏幕坐标前后相等、面板完全在窗口内、窗口完全在 workArea 内。
2. **拖动用的是 `clientX`，可窗口自己在动**（高风险，没测到）。`index.js` 拖动按 `event.clientX - drag.lastX` 算增量再 `moveBy`；窗口一挪，鼠标相对窗口的坐标也跟着变，下一次算出来的增量就错了（追不上鼠标、抖、或者猪从鼠标底下溜走）。现有测试是「两次 pointermove → 两次 moveBy」，没模拟窗口真的移动，所以测不出来。改用 `event.screenX/screenY` 算增量（或者 pointerdown 时记下屏幕坐标和窗口位置，拖动时让主进程直接 `setBounds` 到「起点 + 鼠标屏幕位移」），同时检查 `shell.js` 的 `moveChannel` 和 `index.js` 不要两边都发 moveBy。**必须在 X11 实机上真的拖一次**：拖 300px，用 python-xlib 读拖之前/之后的窗口位置，差值误差在 4px 以内；来回拖 5 次，猪不能离开鼠标。
3. 这次的 X11 实测只有「收起」「朝上展开」两种情况，返工后要补「猪在屏幕左上角展开」「拖动」两项实测，数据写进验证记录。

Windows 测试包：走 CI 推标签的方式，需要用户批准，等上面两条修完再说。

### D1 返工（Claude，2026-10-01）：❌ 还没提交；面板修好了，拖动坏了
- **没提交**：8 个文件还在工作区（window-geometry / main / shell / index / layout / client.js / 两个测试），卡末也没有「D1 返工」验证记录。按规矩先提交、写记录再叫验收。
- ✅ 第 1 条修好：Claude 用同一套模拟（Chromium 加载 renderer + 伪造外壳）复测，窗口在屏幕顶部时面板在 156–535，完整落在 552 高的窗口里；猪钉在窗口顶部。几何测试 374 + 桌面 15 全过。
- ❌ **新 bug：桌面版拖猪，窗口不动**（已确认）。`shell.js` 先 `apply()` 挂猪（第 33 行），再 `start()` 设置 `window.__dshPiggyShell`（第 34/188 行）；`index.js:70` 只在挂载时判断一次 `deskShell`，那时还是 `undefined` → 桌面版被当成网页版：拖动在小窗口里挪猪（会被裁掉）、窗口不跟、还会读网页版的 `POSITION_KEY`。以前是 `moveChannel` 盖住了这个问题，这次把它删了就露出来了。模拟里按住猪拖 10px，`moveBy` 调用 0 次。
  修法：`__dshPiggyShell` 在 `apply()` **之前**就挂好（`room()` 里拿不到几何时返回 null 就行），或者 `index.js` 每次用时现取。补一个按**真实加载顺序**跑的测试：加载 `renderer/index.html` + `shell.js` + `client.js`，按住猪拖动，断言 `moveBy` 被调用且累计位移 = 鼠标屏幕位移，页面里猪的位置不变。现有测试是先设好外壳再挂载，和真实顺序相反，所以测不出来。
- 第 2、3 条（X11 实机真拖 300px、左上角展开）仍需实测数据，写进记录。

### D1 返工 2（Claude，2026-10-01）：第 1、2 条通过；第 3 条根因已定位
- ✅ 加载顺序（外壳先挂好 + 每次现取）、拖动用屏幕坐标、删掉重复的 `moveChannel`、订阅 `piggy:geometry`：都对。X11 拖动数据（往返 4 次误差 0）认可；第 1 次 +36px 是起点离右缘 27px 被夹住，属正常。
- ❌ 第 3 条（左上角展开猪横移 +207）根因：**老 CSS 让面板打开时猪永远靠右**。`css-base.js:98` `[data-open="true"] .dp-scene{width:var(--panel-width)}` 把场景撑到 292px，`css-base.js:91` 又是 `justify-content:flex-end` → 面板一开，猪在 host 里从左端跑到右端，位移 = 292 − 猪宽 − 留白 ≈ 207，跟你量到的一致。于是客户端想「朝右开」（`card.left=0`），可猪已经在右端，`sides()` 看到面板中心在猪左边 → 钉右 → 主进程倒推出负 x → 被左缘夹回 0 → 猪跳。三段逻辑各自都没错，错在场景排版没跟面板方向走。
  修法：
  1. `fitPanel` 桌面分支决定 `opensRight` 时，在 host 上写 `data-panel-side="right"`/`"left"`（网页版不写，保持现状）。
  2. CSS：`[data-dsh-pig][data-panel-side="right"] .dp-scene{justify-content:flex-start}`，让猪待在场景左端；HUD 卡片同时换到猪的右边（现在是 `ctx.hud.style.left='9px'` 写死，改成按方向设 left/right）。
  3. 番茄角标、气泡、打工道具（`.dp-prop`）、装扮点位这些相对猪定位的东西，在朝右开时检查一遍不跑偏。
  4. 测试：桌面版四个角（左上、右上、左下、右下）各展开、收起一次，断言**猪的布局框在窗口内的位置**和外壳钉的边一致、猪屏幕坐标前后差 ≤ 4px；网页版快照不变。
  5. X11 实机重测左上角，数据写进记录。

### C3（Claude，2026-10-01）：✅ 通过，可以合入 main
- codex/next 9 个提交：PR #3 三个提交作者仍是 1nuoiscute；无 AI 署名；没升存档版本；395 项测试全过，typecheck 0，`client.js` 重新构建后无差异。
- 迁移：旧「王冠」装扮改名「礼冠」(`royal-crown`)，「拥有」和「穿着」都走 `sanitizeDressList`，老玩家买过的不丢、穿着的照穿。
- Claude 自己起实例（3083，指到 codex 分支）走界面实测：加冕 App 显示五项条件进度；商店「晋升」货架有王冠 3000、恶魔契约 6666；买王冠后背包「晋升」格子写「×1 王冠 加冕」；条件齐时点它 → 公告「加冕成为猪猪王！」、满屏落 👑✨、猪身上弹大王冠、立绘变 `pig-king`、王冠被消耗。条件不齐时拒绝且不消耗由 `test/c3-promotion.test.js` 守着。
- 小问题（不挡合入，放进 C4 顺手改）：
  1. 加冕/签约成功后猪的气泡说的是通用的「用掉了。」，应该说一句加冕/签约台词（`data/lines.js` 加 `coronation`、`contract` 场景各 3 句）。
  2. Codex 的截图 `c3-bag-crown.png`（面板是收起的）和 `c3-king-effect.png`（特效已播完）没拍到要证明的东西，合入前换成面板展开的背包「晋升」格子、特效播放中的截图。
- 待用户定：商店里现在有两个 👑（「王冠」晋升道具、「礼冠」装扮）。

### D1 返工 2 残余位移（Claude，2026-10-01）
DSH 的判断方向对：剩下的 13/25 DIP 是「翻锚边」那一步没被补偿。更直接的原因是主进程把**内容框原点**当成了**窗口原点**：`shell.js` 报的 `pig` 坐标是相对 `content.x = 最左的框 − PAD` 的，而窗口原点是页面 (0,0)。面板换方向时最左/最上的框换了（HUD、面板、猪轮流当最左），这个差值就跟着变，于是出现十几、二十几像素的台阶。
建议改成两步、自己收敛：
1. 主进程照现在的算法先 `setBounds`（大小对了就行）。
2. 页面在下一帧量出猪在**窗口坐标**里的真实位置（直接用 `layoutBox(.dp-pig)`，不减 content 原点），报给主进程；主进程算「猪现在的屏幕坐标 − 展开前记下的猪屏幕坐标」，差值不为 0 就再平移一次窗口（夹进 workArea）。只在面板展开/收起、内容尺寸变化时做，闲着时不触发。
测试：四个角展开/收起后，猪的屏幕坐标差 ≤ 4px；X11 实机左上角重测。

### D1 返工 3（Claude，2026-10-01）：✅ 通过
- 77b918f：两步收敛（先改大小，下一帧按猪的窗口坐标补平移）；X11 实机四个角展开/收起位移都是 0.0 DIP，主进程日志能看到 content → anchor 两步；383 + 桌面 21 项测试全过。
- C3 由 Claude 代为 rebase 到 17b4174（无冲突，重建 client.js 无差异，400 + 21 全过）并快进合入 main（28d8fc4）。
- Linux 测试包：Claude 在 `dsh-pig-claude` 工作区从 28d8fc4 打出 `apps/desktop/dist/dsh-piggy-0.25.2-test.AppImage`（打包时用 `extraMetadata.version` 标成 0.25.2-test，仓库版本号没改）；包内 `resources/game/client.js` 与 main 逐字节一致。
- Windows 包仍待：推 tag 走 CI，需要用户批准。

---

## ⚠️ 开工前必读：Claude 在 C3 之后的改动（2026-10-01，已发 v0.25.2）

用户在桌面版实测截到问题，Claude 直接修了并发版。**DSH agent、Codex 开工前先同步最新 main**（`git log --oneline -5` 能看到 `b6b8e28 release: 0.25.2`）。

| 改了什么 | 文件 | 对你的影响 |
|---|---|---|
| 桌面版可点区域直接用窗口坐标、向外取整（以前漏缝＝用户看到的「黑条」，面板右边被切） | `apps/desktop/renderer/shell.js` | 改桌面版时别再把坐标换算到「内容框原点」 |
| 钉的是**整块内容**离窗口边 16px，不再只钉猪（面板朝下开时名字框会伸出窗口） | 同上 `pinPig` | 测试 `window.test.js` 断言已改 |
| 面板朝右开时名字框（HUD）、日历挪到猪右边 | `src/client/layout.js`、`src/client/css-tabs.js` | 加新的跟着猪定位的元素时，朝右开要镜像 |
| 番茄钟本地秒针：`src/client/pomodoro-clock.js`，在 `io.js` 里创建，面板重画后同一帧按本地时间覆盖（`ctx.pomoTick`） | `io.js`、`panel.js`、`tabs/pomodoro.js` | 别在别处再写倒计时文字；要显示剩余时间就交给它 |
| **去掉「礼冠」装扮**（用户定：王冠只保留能加冕的）。买过旧王冠装扮的存档读档时换成一顶王冠道具 | `data/shop.js`、`core/migrate.js` | 商店 63 件、装扮 11 件；图鉴的「道具/装扮」分区别再列礼冠 |
| macOS 上跳过 `setShape`；发版加了 macOS 构建机（未签名 dmg） | `apps/desktop/main.js`、`.github/workflows/release.yml` | 桌面版改动要想到 mac 没有可点区域裁剪 |
| 版本：插件 0.25.2，桌面外壳 0.1.2 | 两个 `package.json` | 下次发版前 CHANGELOG 写 `## [x.y.z] — 日期 · 主题` 小节 |

**验收方式也变了**：桌面版改动 Claude 会用 Electron 调试端口驱动 + python-xlib 截 X 窗口**真实像素**、读 XShape 可点区域，四个角各开一次面板逐张看图。只报坐标数字不算过。

### C8 六款角色外观 · 验证记录（Codex，2026-10-03）

- 用户确认厨师猪、宇航员猪由完成对应工作一次解锁；侦探猪、天使猪、海盗猪、巫师猪作为免费内置皮肤。54 张 SVG 均为 64 × 64、透明背景，覆盖待机及八个动作；钓鱼时回退本套待机图。
- 职业外观解锁后在换肤和图鉴切换，未解锁时换肤列表禁用按钮、图鉴显示灰影和谜面。晋升形态仍优先；调试页每套都有入口，职业按钮可一次解锁并预览。
- 职业解锁沿用 `state.dex.skins` 记录，不增加存档字段，版本保持 v12。旧存档此前没有按职业保存完成次数，需再完成对应工作一次；已选外观及已有图鉴记录读档后保留。
- `npm run build`、`npm test`（40 个测试文件全部通过）、`npm run typecheck` 通过。3084 隔离实例 + `/usr/bin/chromium` 的 Playwright 实测：两款职业图加载成功、四款免费皮肤可见、未解锁厨师不可选、图鉴灰影和提示正常、调试按钮切换立绘，浏览器 page error 为 0。
- 截图：[未解锁职业列表](../../screenshots/c8-career-locked.png)、[图鉴九宫格](../../screenshots/c8-looks-dex.png)、[厨师调试预览](../../screenshots/c8-chef-preview.png)、[宇航员调试预览](../../screenshots/c8-astronaut-preview.png)。
