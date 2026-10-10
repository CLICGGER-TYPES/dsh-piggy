# 素材总表

`assets/` 每个文件按本页登记；`test/assets-registry.test.js` 检查漏登记和空登记。当前猪素材统一使用黑色轮廓透明 PNG（2026-10-10 用户确认接入）。

## 分类与使用

| 类别 | 目录与命名 | 数量 | 使用 |
|---|---|---:|---|
| 阶段与普通猪 | `pigs/base/<角色>/<动作>.png` | 7 | 普通猪、老年猪 |
| 体型与形态 | `pigs/forms/<角色>/<动作>.png` | 41 | 圆猪、胖猪、猪猪王、恶魔猪 |
| 皮肤与职业 | `pigs/skins/<角色>/<动作>.png` | 67 | 薄荷、厨师、宇航员、侦探、天使、海盗、巫师 |
| 反馈场景 | `pigs/feedback/<名字>.png` | 38 | 状态、反应、病种、生日、寻访等 |
| 猪主题徽章 | `pigs/badges/badge-pig-<key>.png` | 28 | 成就与扩展成就 |
| 来源清单 | `pigs/manifest.json`、`pigs/PROVENANCE.md` | — | 版本、逐字提示词、原图和成品哈希、离线处理步骤 |
| 主菜单图标 | `ui-*.svg` | 15 | 历史未使用素材，保留现状 |
| 字体 | `piggy-emoji.woff2` | 1 | 网页 emoji 子集，Noto Color Emoji / OFL |

共181张 PNG，长边不超过256px，总计 1,666,848 字节。RGBA 或带 tRNS 的透明调色板均是真正透明 PNG；白衣、眼白和高光保留。原图不进游戏包。

数据中的 `art` key 不变，统一通过 `packages/pet-core/src/data/art-assets.js` 对应分类路径。主猪、睡姿、换肤、图鉴、居民卡、徽章与盲盒寻访都使用同一份映射。旧内置 SVG / 平铺 PNG URL 保留路由别名，返回当前 PNG；不再复制旧图到游戏目录。

导入皮肤推荐透明 PNG：根目录 `skin.json` 和动作图；兼容原安全 SVG 包，支持同一皮肤不同动作分别用新旧格式，但单个动作只放一种。存档 art key / scene 数据不变，无需迁移。见[格式规范](guides/skin-pack-format.md)和[制作教程](guides/creating-skins.md)。

## 原稿、逐字提示词与导出

- 原稿和所有生成版本：`/zyx/codex/dsh-piggy-artwork/style-unification/2026-10-09/`、`2026-10-10/`。
- 旧游戏素材备份：上述工作区 `2026-10-10/references/legacy-game-art/`，不随 npm 包发布。
- 逐字提示词：仓库 `docs/art-prompts/outlined-pigs/`；参考/完整 job 还保存在工作区。
- 导出：`tools/prepare-pig-art.py`；尺寸校准：`tools/measure-feedback-framing.py`。
- 出处与感谢：[pigs/PROVENANCE.md](../assets/pigs/PROVENANCE.md)。感谢 @1nuoiscute 的原形态和动作贡献及用户逐版审图；Noto 衍生许可继续随游戏包分发。

## 保持未使用的素材

`ui-*.svg`、恶魔飞行图和待定反馈图仍不自动启用。反馈场景优先级、反馈时隐藏装扮和死亡后幽灵语义继续以 `src/client/feedback-art.js` 为准，不因换图改变玩法。

## 登记

```assets
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
