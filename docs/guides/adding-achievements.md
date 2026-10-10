# 加一项成就

成就只奖励一枚**小猪徽章**，不给金币、属性、称号（用户定的，见 `docs/design/achievements.md`）。
**加哪些成就、门槛定多少由用户拍板**：先把名单（名称、条件、门槛、徽章草图）给用户看，确认后再写。

设计背景：核心成就 `docs/design/achievements.md`，扩展成就与公共事件 `docs/design/extension-achievements.md`。

## 两张表

数据都是「一行一个数组」，**两张表的列顺序不一样**，照抄同表里的现有行最不容易错。

**核心成就** `packages/pet-core/src/data/achievements.js`：

```js
// [key,           名称,       分组,   emoji, 指标(metric), 门槛, 单位, 说明]
['first-meal', '开饭啦', '照顾', '🍎', 'feeds', 1, '次', '第一次成功喂食，把肚子填得暖暖的。'],
```

**扩展成就** `packages/pet-core/src/data/extension-achievements.js`：

```js
// [key,          名称,        扩展,   分组,   事件,      方式(mode), 门槛, 单位, 说明]
['farm-first', '菜园开张', 'farm', '菜园', 'harvest', 'total', 1, '次', '成功收获第一块成熟作物，买种和浇水还不算。'],
```

- `key`：kebab-case，全局唯一；徽章文件名就是 `badge-pig-<key>.svg`。
- 说明写「怎样才算」，把容易误会的边界写明（「敲裂石头还不算」「卖掉也保留记录」）。

## 指标从哪来（最容易漏的一步）

核心成就的 `metric` 有两种：

1. **计数**：读 `state.stats[metric]`，宿主每次结算按增量累计（换代、领养也不丢）。
   新计数指标必须在领域层**真的有地方加**它（如 `care.js` 的 `state.stats.feeds += 1`），否则成就永远解锁不了。
2. **专门算法**：图鉴种类数（`fishKinds`、`souvenirKinds`）、形态（`king`、`devil`）、等级（`level`）。
   要新加这种，在 `packages/pet-core/src/core/achievements.js` 的 `SPECIAL` 和 `progressFor` 里写算法，
   并同步 `test/achievements-guard.test.js` 里的 `SPECIAL`。

**不在 `SPECIAL` 里的指标一律当计数处理**——写错名字不会报错，只会永远是 0。`npm test` 会检查每个计数指标在领域层有人累加。

扩展成就的 `event` + `mode` 对应扩展用 `api.emit` 报的公共事件（`total` 累计、`kinds` 种类、`maximum` 最高值）：
事件和字段先登记在 `packages/pet-core/src/data/extension-events.js`，扩展里再 `emit`（见 [writing-extensions.md](writing-extensions.md)）。

## 徽章 PNG

放 `assets/pigs/badges/badge-pig-<key>.png`。规格（照现有 28 枚）：

- 透明底 PNG，长边 ≤256px，原尺寸图和逐字提示词留素材工作区，按 `tools/prepare-pig-art.py` 离线处理并登记素材表。
- **小猪是主图案**（沿用原作小猪轮廓和配色），用颜色、绶带、书本、鱼、王冠这类小配件区分主题。
- 未解锁时图鉴会把它画成灰色，不用另做灰版。

画完用 `node tools/achievement-preview.mjs` 打开 `http://127.0.0.1:8780` 看：真实核心 + 隔离存档，可切换示例进度 / 从零试玩 / 全部徽章，
不碰真实存档。把截图给用户确认图案。

## 不用做的事

- **不升存档版本**：成就记录是可选字段，新成就第一次结算时自动补上（已满足条件的老玩家会静默补发，完成日期记为未知）。
- 不改图鉴入口、不加主菜单 App：成就就在图鉴里。

## 写错了会怎样（测试兜底）

`test/achievements-guard.test.js`：key 重复、计数指标没人累加、扩展事件/字段没登记、徽章文件缺失或规格不对，都会红。
其他测试里的成就数量按数据推算，加成就不用改测试里的数字。

## 加完之后

1. `npm run build && npm test`，再用预览工具看一遍。
2. CHANGELOG 写新成就名单；README 的成就截图如有变化一起换。
