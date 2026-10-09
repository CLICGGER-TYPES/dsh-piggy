# B5 日常：签到、在线礼包、宠物日记

**前置**：B1 做完。**数值全部以 [numbers/B5-daily.md](../../numbers/B5-daily.md) 为准**（用户 2026-10-01 已确认，按建议值）。
下面只写「怎么做」，数字一律查数值单，**不要自己改数**。

## 和 Claude 的分工边界（重要）

B2（成长）/ B3（疾病）/ B4（学习→职业）**都已合入 main**（存档到 v11）。Claude 之后还可能改 `settlement.js`、`clock.js`、`migrate.js`、`upgrades.js`、
`data/{life,illness,shop,school,jobs,interests}.js`。**这些文件 B5 尽量不碰**：

- 新东西放新文件：`packages/pet-core/src/data/daily.js`、`packages/pet-core/src/core/daily.js`、`packages/pet-core/src/core/diary.js`
- 新存档字段（`daily`、`diary`、`onlineMs` 等）**不加 upgrades 级、不改 STATE_VERSION**：像 `core/lines.js` 的 `ensureDialogue` 一样写 `ensureDaily(state)` / `ensureDiary(state)`，缺字段就补默认值，在 `migrate()` 末尾调用（migrate.js 只加这一两行）
- 礼包里用到 B3 的药，物品 key 如下 —— **B3 已合入，这些都已上架**（`itemByKey` 能查到）：

  | 物品 | key |
  |---|---|
  | 板蓝根 | `banlangen` |
  | 消食片 | `xiaoshipian` |
  | 枇杷糖浆 | `pipa-syrup` |
  | 百草丹 | `baicaodan` |
  | 还魂丹 | `soul`（现有） |

## 1. 一天的边界：06:00

- **已经有了**：`dayKeyFor(nowMs)` 在 `core/clock.js`（B2 写的，`core.js` 已导出），06:00 为界，返回 `'2026-10-01'`。直接用，不要再写一个
- 成长的「每天真实干活上限」也用它（`state.realWorkGrowth`），签到/礼包/日记跟它保持同一个「天」
- 签到、在线礼包计数、日记都用它判断「是不是新的一天」

## 2. 每日签到

- [x] 状态：`daily.signIn = { lastDay: '2026-10-01' | null, index: 0..11 }`
- [x] `canSignIn(state, nowMs)`：`lastDay !== dayKeyFor(nowMs)`
- [x] `signIn(state, nowMs)`：发放 `SIGN_IN_REWARDS[index]`（`data/daily.js`，照数值单 12 天表），`index = (index + 1) % 12`，写 `lastDay`
- [x] 断签不清零；死了也能签
- [x] 新路由动作 `signIn`；快照里加 `daily: { canSignIn, signInDay: index + 1, ... }`
- [x] 发放后 `announce(state, 'gift', ...)`，猪说一句（新台词场景 `signIn`，加在 `data/lines.js`，1–2 句样例就行，文案 B6 统一审）

## 3. 在线礼包（每小时一个）

**「在线」怎么算**：面板每 4 秒轮询一次 `GET /dsh-pig/state`。宿主层记录每次轮询的真实时间，两次轮询间隔 ≤ 30 秒就算这段在线，累加真实毫秒。

- [x] 记在 store 层（`store/api.js` 的 state 读取处）调一个纯函数 `recordOnline(state, lastPollMs, nowMs)`（`core/daily.js`），**不受时间倍率影响**
- [x] 状态：`daily.online = { day, onlineMs, given, unclaimed }`；换天时 `onlineMs/given` 清零，`unclaimed` 保留
- [x] 每满 1 小时：`given < 8` 且 `unclaimed < 3` 时 `unclaimed += 1, given += 1`
- [x] `openGift(state, nowMs)`：`unclaimed > 0` 时用 `core/random.js` 按数值单的概率表抽一项发放（**禁止 Math.random**，守卫会拦）
- [x] 新路由动作 `openGift`

## 4. 宠物日记

- [x] 状态：`diary = { entries: [{ day, text }], today: { ...计数 } }`，最多 60 篇
- [x] **当天计数**：在已有的发生点累加（喂食、洗澡、摸摸、打工回来+金币、上课、毕业、旅行+纪念品、生病、吃错药、病好、升级、长大、真实对话轮数、工具调用）。
  发生点在 care.js / settlement.js 的 finish* / feed() 里 —— **这些是 Claude 在改的文件，只加一行 `noteToday(state, 'feed')` 这样的调用，别动周围逻辑**；合并冲突由 Claude 处理
- [x] **写日记**：`writeDiaryIfNewDay(state, nowMs)` —— 发现 `dayKeyFor(nowMs)` 跟 `today.day` 不同，就把 `today` 拼成一篇（模板 `data/daily.js`，最多 5 句，猪的口吻，`[主人]` 占位符复用 `data/lines.js` 的 `OWNER_TOKEN`），然后清空 `today`。什么都没发生也写一句短的
- [x] 调用点：`store/api.js` 每次 state 读取时调一次（不放进 settlement，避免和 Claude 冲突）

## 5. 界面

- [x] 猪头上：可签到时冒 📅 小气泡，有礼包时冒 🎁（有签到先显示签到），点一下触发对应动作，领到什么用 toast 说
- [x] 状态页一行小字：「签到第 N/12 天」
- [x] 背包页加「📔 日记」分栏，按日期倒序，每篇折叠显示首句、点开看全文
- [x] 样式照 animal-island-ui 的 token（`src/client/css-base.js` 里的 `--ac-*`），**不新增颜色**

## 6. 测试（每条先红后绿）

- `dayKeyFor`：05:59 算前一天、06:00 算当天
- 签到：同一天第二次签不了；12 天后回到第 1 天；断签 3 天再签，拿的是下一天的礼包
- 在线：间隔 > 30 秒的两次轮询之间不算在线；满 1 小时给 1 个；一天最多 8 个；攒满 3 个不再给；时间倍率 ×60 时在线时长不变
- 礼包抽取：固定 `roll` 下结果确定；1 万次抽样分布接近数值单（±2%）
- 日记：跨 06:00 的第一次读取写出前一天那篇；超过 60 篇删最旧；什么都没做也有一篇

## 验证记录

**2026-10-01 · DSH agent**

- `npm run build && npm test`：**275 / 275 通过**（B5 开工前 231 → 新增 44 条，全部先红后绿）
- `npm run typecheck`：**0 错误**
- 提交：`2816e61` 签到 · `cdcde57` 在线礼包 · `6e9e3b0` 日记 · `c0d55a8` 界面
- 数值：只读 `docs/numbers/B5-daily.md`，一个数字都没改；12 天表、8/天、
  攒 3 个、概率表（40/25/20/10/4/1）逐条落进 `data/daily.js`
- 与 Claude 的边界：**没碰** `core/upgrades.js`、`STATE_VERSION`；
  `daily` / `diary` 走 `ensureDaily` / `ensureDiary` 补默认值（migrate 末尾各一行）；
  事件点只加了一行 `noteToday(...)`（care/growth/illness/settlement）
- 界面验证（`tools/preview.html`，已给假宿主补上 `daily`/`diary`）：
  - 猪头上：📅「签到第 3/12 天」→ 签到后变 🎁「有 2 个在线礼包」，点击分别发
    `signIn` / `openGift`（DOM 证据：`data-action="signIn"` → `"openGift"`）
  - 状态页小字：`📅 签到第 3/12 天 · 🎁 2`
  - 背包页日记：3 篇（`data-diary` 2026-09-30/29/28），点一行 `data-open` false→true、
    全文 `.dp-diary-full` hidden false
- **截图仍然存不下来**：MCP 的 `take_screenshot(filePath)` 拒绝所有目标路径
  （与 B1 同一个限制），只能给内联图。要看效果就开 `tools/preview.html`。
- 一步没做（卡里也没要求）：日记接 DeepSeek —— 卡上写明「以后想接再单独加开关」。
