# B9 九宫格主屏 · 居民卡 · 打工方块 · 横幅只在状态页

**谁做**：Claude（2026-10-01）。**状态**：已做完并合入 main。**来源**：用户三条反馈 + 中途补充「整个面板也做成九宫格」。

## 给 DSH agent 的交接要点（先看这个）

1. **面板打开先是主屏**（`ctx.tab === 'home'`，`src/client/tabs/home.js`）：一格格 App 方块，点进去是页签，
   页签顶上「‹」回主屏（`appHeader`）。点进了大类的页签（学习/商店/背包/打工），`drillHeader` 的「‹」先回页签第一层。
2. **底部图标栏没删，只是不显示**（`css-tiles.js` 里 `.dp-card .dp-bar{display:none}`）：它的图标仍是
   各种提醒（`data-alert`）的计算处，主屏方块左上角的小标签就是读它的。测试辅助 `pickTab` 也还点它。
3. **横幅（走了 / 生病 / 在外面）只在状态页**：从 `panel.js` 搬到 `tabs/status.js` 的 `renderBanners`。
   主屏「状态」方块上挂「走了 / 生病 / 在外面」标签代替。
4. **居民卡**：`tabs/card.js` + `css-card.js`；数据在 core：`data/profile.js`（6 种性格、星座表）、
   `core/profile.js`（`assignPersonality` 拆盒时、`ensureProfile` 载入时补老猪、`setCatchphrase`/`setMotto`、
   `zodiacFor`、`profileView`）。新路由动作 `catchphrase` / `motto`（`{ text }`）。**存档版本没变**（新字段走 ensureProfile）。
5. 口头禅：`pickLine` 以 40% 在句末补「，口头禅」，生病/吃错药/走了不补，舞台说明「（…）」不补。
6. 打工：`ctx.drill.work` = 技能；`ctx.drill.pick` = 点开的职业；`ui.workTrait`/`ui.jobDetail` 已删。
7. 测试辅助：`openPanel(dom, app = 'status')` 默认点进状态；主屏测试用 `openPanel(dom, 'home')`；
   `sendJob(dom, key)` = 点职业方块再点详情里的「出发」。

## 做了什么
- 主屏：名字 ♀ Lv · 🪙，下面 状态 / 居民卡 / 学习 / 打工 / 商店 / 旅行 / 背包（开发者模式多一个调试）
- 居民卡：女孩粉、男孩蓝的点点卡（animal-island-ui Card pattern 参数），头像、名字、等级称号、形态，
  生日 / 星座 / 性格 / 口头禅（可改）/ 签名（可改），底部「养了 N 天 · 证书 · 纪念品 · 毕业」
- 打工：武力 / 魅力 / 智力 方块（右上角能干的份数）→ 职业方块（时长·报酬，没资格变灰 + 🔒）→ 详情卡（门槛 ✓✗、加成、消耗、出发）
- 修：猪出门时展开面板，下方区域被缩成「猪 + 道具」那么宽，名字框挤到猪身上（`[data-open=true][data-away]` 恢复面板宽）
- 横幅间距：横幅和后面的按钮行各留 14px

## 验证记录
- `npm run build && npm test`：**291 / 291**；`npm run typecheck` 0 错
- 截图（真实浏览器，用户存档拷贝）：`docs/screenshots/b9-*.png`（主屏、状态页横幅、商店无横幅、居民卡女孩/男孩/编辑中、
  打工三层）；B8 的 9 张也按新外壳（有「‹」回主屏）重截了。每张量过：面板 292、无横向溢出、无截断、方块等高
