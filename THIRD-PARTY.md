# 第三方致谢与许可

本仓库的**代码与文档**按 [MIT](LICENSE) 发布。**素材不自动适用 MIT**，按目录单独授权：

- 小猪立绘、形态、皮肤、徽章、反馈图：**Apache-2.0**（改自 Noto Emoji 🐖）；
- 钓鱼、菜园、矿洞、摸摸手等 AI 生成场景/道具：**CC BY 4.0**；
- Noto Color Emoji 字体及网页子集：**OFL-1.1**；
- 用户提供的原摸摸 GIF：权利链不属于本项目，**不随仓库/发布包分发，也不授予再分发许可**。

完整目录表和署名方式见 [LICENSE-ASSETS.md](LICENSE-ASSETS.md)。下面列出参考、依赖或提及的第三方内容。
除下面明确标注的 MIT 设计文档离线副本外，没有复制第三方代码或游戏原版素材——用到的数值与名称属于事实性数据。

## 设计参考资料

| 项目 | 许可 | 本插件用到了什么 |
|---|---|---|
| [xuemian168/qqpet_automation](https://github.com/xuemian168/qqpet_automation) | MIT（其原创部分） | 只参考**数值与名称**：属性阈值、三条疾病链的名称与分期、九门科目名、部分物品名。其源代码、数据文件结构与本项目不同，未复制 |
| [ice-cream-headache/ice-cream-headache.github.io](https://github.com/ice-cream-headache/ice-cream-headache.github.io) | MIT | 只参考**界面截图**（宠物在上、奶油色图标栏在下、带标签的属性条）。截图未随本包分发 |
| [guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui) | MIT | 参考设计 token 与 Button、Title、Modal、Tabs、Card、Badge、Progress、Input、Select 外观；菜园 4.0.8 沿用 Modal 的有机 clip-path 几何，以原生 DOM/CSS 实现，无 React 依赖。`docs/design/animal-island-ui/` 是上游 `docs/design-system/` 的离线副本（3.0.0 / `02fa9da`），许可原文见该目录 `LICENSE` |

## 运行时依赖

| 内容 | 许可 | 说明 |
|---|---|---|
| [Motion](https://motion.dev)（`motion`） | MIT | 客户端物理层：按压/挤压/拎起/倾斜的弹簧与帧循环。版本钉死 14.3.0（`motion` 14.3.0 + `motion-dom`/`framer-motion` 由 esbuild 打进 `client.js`）。2026-10-18 实测打包增量约 239KB 未压缩 / 56KB gzip（`client.js` 598KB → 836KB），低于游戏包 300KB 增量红线 |
| Nunito / Noto Sans SC | SIL OFL 1.1 | 客户端在浏览器里按需从 Google Fonts 加载；加载失败自动退回系统字体。**字体文件不随本包分发** |
| Noto Color Emoji | SIL OFL 1.1 | 桌面版整套字体：`apps/desktop/renderer/piggy-emoji.ttf`，许可原文见同目录 `piggy-emoji-LICENSE.txt`。网页子集：`assets/piggy-emoji.woff2`，由 `tools/build-emoji-font.py` 裁剪，许可原文见 `assets/piggy-emoji-LICENSE.txt` |

## 美术

### 小猪立绘（Apache-2.0）

小猪立绘改自 [Noto Emoji](https://github.com/googlefonts/noto-emoji) 的 🐖（`2D/svg/emoji_u1f416.svg`，
© 2013 Google LLC，**Apache License 2.0**）。项目作者以 Noto 🐖 为参考重绘了当前的无描边平涂 PNG：

- 普通/老年猪：`assets/pigs/base/`；
- 体型与形态：`assets/pigs/forms/`；
- 皮肤与职业：`assets/pigs/skins/`；
- 反馈场景：`assets/pigs/feedback/`；
- 猪主题徽章：`assets/pigs/badges/`。

这些文件按 Apache 2.0 发布（可以自由使用、修改、再分发，需保留本说明和许可全文），
许可全文和原始声明见 [`LICENSE-noto-emoji.txt`](LICENSE-noto-emoji.txt)。

旧路径 `assets/piglet.svg`、`assets/elder.svg`、`assets/badge-pig-1.png` 已不存在；
当前对应上面的 `assets/pigs/base/piglet/`、`assets/pigs/base/elder/`、`assets/pigs/badges/`。
以后新画的猪图只要是在这套立绘上改的，同样属于 Apache 2.0；完全另起炉灶、不参照任何素材的才算 MIT 原创。

### AI 生成场景与道具（CC BY 4.0）

钓鱼、菜园、矿洞、摸摸手等由项目 AI 出图流程生成、经用户审定的场景和道具，按
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 发布：

- `assets/fishing/`：钓点、浮漂、搏斗、鲫鱼结果；
- `assets/animations/pet-hand/`：高清独立手五帧图集；
- `extensions/farm/assets/`、`extensions/mine/assets/`：菜园、矿洞的纸感素材；
- `release/extension-variants/`：手动导入扩展变体的素材。

出处、提示词和逐图哈希见各目录的 `PROVENANCE.md` 与 manifest。建议署名：

> Art from dsh-piggy, licensed under CC BY 4.0.
> https://github.com/CLICGGER-TYPES/dsh-piggy

AI 生成内容在不同法域的可版权性不同；本项目只就自身拥有的权利授予上述许可。

### 反馈小猪与 PigHub 参考

`assets/pigs/feedback/` 的灵感来自 [PigHub](https://pighub.top/) 上的猪猪图片，
以其为参考由 AI（OpenAI 图像生成，codex 操作）重新生成，经维护者逐张审定；没有直接复制、描摹或拼贴原图。
生成过程、处理步骤见 [`assets/pigs/feedback/PROVENANCE.md`](assets/pigs/feedback/PROVENANCE.md)。
如果原图作者认为侵权或不希望这样使用，请开 issue，我们会删除相关图片。

### 用户提供的原摸摸 GIF（不随仓库分发）

`assets/animations/piglet-pet/` 只保留历史 manifest 和 `PROVENANCE.md`。
其中的 `reference.webp` 是用户提供的微信 GIF 的逐像素帧图集，原 GIF 的权利链不属于本项目，
**不授予开源或再分发许可**，已从当前仓库和发布包移除。当前运行时使用
`assets/animations/pet-hand/hand.webp` 的 AI 生成独立手层叠加原猪立绘，不再加载该历史图集。

### 应用图标

`apps/desktop/artwork/app-icon-source-20261027.png` 及导出的 `apps/desktop/build/icon.png`、
`icon.ico`、`tray.png` 由用户提供原图，按 CC BY 4.0 发布；只做等比缩放和透明补方，不重画五官或换色。

### 界面里的其它图形

界面里的其它图形一律用系统 emoji 字体渲染，不附带图形文件。

## 商标

QQ 宠物 / QQ 是腾讯控股有限公司的商标。本插件与腾讯**无任何关联，亦未获其授权**；
文档中提到该名称只为说明玩法与数值的参考来源。若权利人认为本仓库有不妥之处，
请开 issue，作者会立即调整或下架。
