# 素材总表

`assets/` 里每个文件放哪、怎么命名、多大、从哪来、有没有在用，都以这里为准（2026-10-09 盘点）。
**新增或删除素材要同步改本页底部的「登记」**：`test/assets-registry.test.js` 会检查 `assets/` 里的每个文件都能对上一条登记，每条登记也至少能对上一个文件。

加图的流程和规格见 [AGENTS.md](../AGENTS.md) 红线第 9 条、[新功能指南 3.5](guides/adding-features.md)（可以直接 AI 出图，交透明底 PNG；图要用户过目才进 `assets/`）。SVG 立绘的画法见 [美术规格](ART-SPEC.md)。

## 方向：底图从 SVG 改成 PNG（用户 2026-10-09 定）

codex 正在重画立绘，**以后的底图（阶段、形态、皮肤、职业、徽章）都改成 PNG**，不再是 SVG。下表是改之前的现状；
迁移时要一起改的代码、分目录和命名，见 [路线图](ROADMAP.md)「PNG 底图迁移」。迁移完把本页的表和「登记」更新成 PNG。

## 现在的样子

`assets/` 目前是**平铺**的，只有反馈小猪放在子目录 `feedback/`；用文件名前缀分类。

| 类别 | 文件名规则 | 数量 | 格式与体积 | 代码里怎么用 | 出处 |
|---|---|---|---|---|---|
| 成长阶段 | `piglet.svg`、`elder.svg` | 2 | SVG 64×64，≤ 3KB | 阶段立绘（`data/life.js`） | 项目作者参照 Noto Emoji 🐖 重绘，Apache 2.0（[THIRD-PARTY](../THIRD-PARTY.md)） |
| 形态与体型 | `pig-<形态>[-<动作>].svg`：形态 `king` `devil`（加冕），`round` `fat`（体重） | 37 | SVG 64×64，≤ 8KB | `data/evolution.js`、`core/weight.js` 的 `art` 字段，加动作后缀拼出动作图 | 猪猪王、恶魔猪、胖猪立绘来自 [@1nuoiscute](https://github.com/1nuoiscute)（PR #2–#4），在 `piglet.svg` 上改画 |
| 皮肤 | `skin-<皮肤>[-<动作>].svg`：`mint` `angel` `detective` `pirate` `wizard` | 41 | SVG 64×64，≤ 5KB | `data/skins.js` | 用户给的皮肤原稿整理（原稿在总目录 `skins-source/`） |
| 职业外观 | `career-<职业>[-<动作>].svg`：`chef` `astronaut` | 18 | SVG 64×64，≤ 5KB | `data/skins.js`（职业皮肤） | 同上 |
| 睡姿 | `<上面任一立绘名>-sleep.png`，共 12 张 | 12 | 透明 PNG 256×191，≤ 41KB，共 452KB | `src/client/art.js` 的 `SLEEP_ART`；自定义皮肤可带 `sleep.svg` | AI 生成（OpenAI 图像生成，codex 操作），用户逐版审定，见 [assets/PROVENANCE.md](../assets/PROVENANCE.md) |
| 反馈小猪 | `feedback/<名字>.png` | 38 | 透明 PNG 长边 256，≤ 80KB，共 1.7MB | `src/client/feedback-art.js`（按状态选图）；盲盒寻访页 `recruit.png` | 灵感来自 [PigHub](https://pighub.top/)，AI 重新生成，见 [feedback/PROVENANCE.md](../assets/feedback/PROVENANCE.md) |
| 成就徽章 | `badge-pig-<成就 key>.svg` | 28 | SVG 64×64，≤ 4KB | `data/achievements.js`、`data/extension-achievements.js` 用 `'badge-pig-' + key` 拼 | 在 `piglet.svg` 上改画（含 [@1nuoiscute](https://github.com/1nuoiscute) 的 #6、#7） |
| 主菜单图标 | `ui-<App>.svg` | 15 | SVG，≤ 1KB | **不再使用**，见下 | — |
| 字体 | `piggy-emoji.woff2` | 1 | 1.0MB | 网页版 emoji 字体子集（「设置 → Emoji 样式」）；加了新 emoji 要重新裁，`test/emoji-coverage.test.js` 守着 | Noto Color Emoji 子集，SIL OFL 1.1（[THIRD-PARTY](../THIRD-PARTY.md)） |

动作后缀：`eat` `bathe` `play` `pet` `relaxed` `work` `study` `trip` `fish`，缺哪个就回退到不带后缀的那张（[皮肤包格式](guides/skin-pack-format.md)）。

### 反馈小猪用在哪

每张图的用途（哪个心情、哪种病、哪个职业……）以代码 `src/client/feedback-art.js` 为准，**不在这里重复抄一份**。要看全貌：开调试模式 → 「立绘」页，每张图旁边写着用在哪，点一下猪就换成那张。
文件名沿用了原始拼图的叫法（`collection-*` 是合集版式，其余是单张版式），看名字猜不出用途；按用途改名在规范化第 2 批里。

## 不再使用的素材

还在仓库里、但游戏不会加载的，删不删等用户定（[路线图](ROADMAP.md)「待用户决定」）：

| 文件 | 为什么没在用 |
|---|---|
| `ui-*.svg`（15 张） | 手绘主菜单图标，用户 2026-10-06 明确不要；`src/client/icon-style.js` 的 `iconStyle()` 固定返回 `'system'`，这些图永远不会被加载 |
| `pig-devil-fly.svg` | 没有任何代码或数据引用 |
| `feedback/collection-badge.png`、`collection-check.png`、`collection-cage.png`、`suspended.png`、`twitch.png` | 用户 2026-10-09 定为待定 / 不合适（`src/client/feedback-art.js` 的 `UNUSED_FEEDBACK_ART`），调试页仍能预览 |

## 原稿放在哪（不进仓库）

| 素材 | 原稿 |
|---|---|
| 皮肤、职业外观 | 总目录 `/zyx/DSH/workspaces/dsh-piggy/skins-source/` |
| 反馈小猪、睡姿 | `/zyx/codex/dsh-piggy-artwork/`（`feedback-static-svg/ai-drafts/selected-png/`、`sleep-mat/`）——还没并进总目录，见规范化第 2 批 |
| 生成提示词 | 仓库 [docs/art-prompts/](art-prompts/) |

重新处理反馈小猪图一律从原图跑 `tools/prepare-feedback-art.py`，不要在已经缩小的游戏图上再加工。

## 登记

`test/assets-registry.test.js` 读下面这一段：每行一个相对 `assets/` 的通配（`*` 不跨目录）。

```assets
piglet.svg
elder.svg
pig-*.svg
skin-*.svg
career-*.svg
*-sleep.png
PROVENANCE.md
feedback/*.png
feedback/PROVENANCE.md
feedback/README.md
badge-pig-*.svg
ui-*.svg
piggy-emoji.woff2
```
