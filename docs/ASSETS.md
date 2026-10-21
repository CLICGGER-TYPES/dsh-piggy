# 素材总表

`assets/` 每个文件按本页登记；`test/assets-registry.test.js` 检查漏登记和空登记。当前只有一套无描边平涂透明 PNG，2026-10-13 由旧版 1:1 重画。

## 分类与使用

| 类别 | 目录与命名 | 数量 | 使用 |
|---|---|---:|---|
| 阶段与普通猪 | `pigs/base/<角色>/<动作>.png` | 9 | 普通猪、老年猪 |
| 体型与形态 | `pigs/forms/<角色>/<动作>.png` | 41 | 圆猪、胖猪、猪猪王、恶魔猪 |
| 皮肤与职业 | `pigs/skins/<角色>/<动作>.png` | 67 | 薄荷、厨师、宇航员、侦探、天使、海盗、巫师 |
| 反馈场景 | `pigs/feedback/<名字>.png` | 38 | 状态、反应、病种、生日、寻访等 |
| 猪主题徽章 | `pigs/badges/badge-pig-<key>.png` | 28 | 成就与扩展成就 |
| 来源清单 | `pigs/manifest.json`、`pigs/PROVENANCE.md` | — | 版本、逐字提示词、原图和成品哈希、离线处理步骤 |
| 主菜单图标 | `ui-*.svg` | 15 | 历史未使用素材，保留现状 |
| 字体 | `piggy-emoji.woff2` | 1 | 网页 emoji 子集，Noto Color Emoji / OFL |

共183张 PNG，长边不超过256px，总计 1,831,815 字节。透明背景保留，原图不进游戏包。

数据中的 `art` key 不变，统一通过 `packages/pet-core/src/data/art-assets.js` 对应分类路径。主猪、睡姿、换肤、图鉴、居民卡、徽章与盲盒寻访都使用同一份映射。旧内置 SVG / 平铺 PNG URL 保留路由别名，返回当前 PNG；不再复制旧图到游戏目录。

导入皮肤推荐透明 PNG：根目录 `skin.json` 和动作图；兼容原安全 SVG 包，支持同一皮肤不同动作分别用新旧格式，但单个动作只放一种。存档 art key / scene 数据不变，无需迁移。见[格式规范](guides/skin-pack-format.md)和[制作教程](guides/creating-skins.md)。

成品直接放在 `pigs/` 主路径，不再提供画风设置。来源见 [制作记录](../assets/pigs/PROVENANCE.md)。

## 原稿、逐字提示词与导出

- 当前平涂原稿与所有生成版本：素材工作区 `face-restore/2026-10-12/`；旧版历史原稿：`/zyx/codex/dsh-piggy-artwork/style-unification/2026-10-09/`、`2026-10-10/`。
- 旧游戏素材备份：上述工作区 `2026-10-10/references/legacy-game-art/`，不随 npm 包发布。
- 逐字提示词：仓库 `docs/art-prompts/flat-pigs/`；参考/完整 job 还保存在工作区。
- 导出：`tools/prepare-flat-art.py`；尺寸校准：`tools/measure-feedback-framing.py`。
- 出处与感谢：[pigs/PROVENANCE.md](../assets/pigs/PROVENANCE.md)。感谢 @1nuoiscute 的原形态和动作贡献及用户逐版审图；Noto 衍生许可继续随游戏包分发。

## 保持未使用的素材

2026-10-21 状态提示返修：`collection-mosquito.png`（倒地蚊子图）和 `hungry.png`（带食盆的整图）不再自动选用；素材保留。脏状态用原猪叠加既有苍蝇，饿状态用原猪加独立食物想象泡，不新增或改绘猪图。

`ui-*.svg`、恶魔飞行图和待定反馈图仍不自动启用。反馈场景优先级、反馈时隐藏装扮和死亡后幽灵语义继续以 `src/client/feedback-art.js` 为准，不因换图改变玩法。

## 登记

```assets
animations/piglet-pet/*.webp
animations/piglet-pet/manifest.json
animations/piglet-pet/PROVENANCE.md
pigs/base/*/*.png
pigs/forms/*/*.png
pigs/skins/*/*.png
pigs/feedback/*.png
pigs/badges/*.png
pigs/manifest.json
pigs/PROVENANCE.md
pigs/feedback/README.md
pigs/feedback/PROVENANCE.md
PROVENANCE.md
ui-*.svg
piggy-emoji.woff2
```

- 菜园第4轮：已审 farm-v4-fix4 场景/UI V2接入扩展；来源、加工规则和逐图哈希见 extensions/farm/PROVENANCE.md、fix4-art-pack.json，原稿与提示词保留在项目素材工作区。

- 菜园整体重画（4.0.8，未发布）：大农场 B、小农场 C1，新增 7 张花叶/木纹/控件图片；出处、逐图哈希见 extensions/farm/PROVENANCE.md、redraw-art-pack.json。其余容器、标题、按钮采用原生 CSS。

## 普通猪摸摸动画（候选，2026-10-21）

v07直接复用用户提供的原GIF：五帧112×112、每帧60ms，排成560×112无损 `animations/piglet-pet/reference.webp`，10,368字节，五格RGBA与GIF完全一致。包含手和猪，运行时固定比例播放；关闭小手改用原idle.png。此前重制图集均保留在研究备份，不再随游戏加载。来源与哈希见对应PROVENANCE.md和manifest.json，详见[实现与验证](design/pet-hand-snap.md)。
