# 第三方致谢与许可

本插件（`dsh-piggy`）的代码与美术以 MIT 发布；**小猪立绘例外，见下面「美术」**（改自 Noto Emoji，Apache 2.0）。
下面列出它参考、依赖或提及的第三方内容。没有复制任何第三方代码、文档或游戏原版素材——用到的数值与名称属于事实性数据。

## 设计参考资料

| 项目 | 许可 | 本插件用到了什么 |
|---|---|---|
| [xuemian168/qqpet_automation](https://github.com/xuemian168/qqpet_automation) | MIT（其原创部分） | 只参考**数值与名称**：属性阈值、三条疾病链的名称与分期、九门科目名、部分物品名。其源代码、数据文件结构与本项目不同，未复制 |
| [ice-cream-headache/ice-cream-headache.github.io](https://github.com/ice-cream-headache/ice-cream-headache.github.io) | MIT | 只参考**界面截图**（宠物在上、奶油色图标栏在下、带标签的属性条）。截图未随本包分发 |
| [guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui) | MIT | 只参考**设计 token**：颜色、圆角、缓动曲线。按其 `docs/design-system/css-variables.md` 的取值重写为纯 CSS |

## 运行时依赖

| 内容 | 许可 | 说明 |
|---|---|---|
| Nunito / Noto Sans SC | SIL OFL 1.1 | 客户端在浏览器里按需从 Google Fonts 加载；加载失败自动退回系统字体。**字体文件不随本包分发** |
| Noto Color Emoji | SIL OFL 1.1 | 仅桌面版：`apps/desktop/renderer/piggy-emoji.ttf`，整套原样附带（`tools/build-emoji-font.py` 复制），默认 emoji 样式，许可原文见同目录 `piggy-emoji-LICENSE.txt` |

## 美术

- **小猪立绘改自 [Noto Emoji](https://github.com/googlefonts/noto-emoji) 的 🐖**（`2D/svg/emoji_u1f416.svg`，
  © Google，**Apache License 2.0**）：项目作者以 Noto 🐖 的截图为参考重绘了 `assets/piglet.svg`；
  `assets/elder.svg`（老年猪）、各张皮肤 / 职业 / 形态立绘（`assets/skin-*`、`career-*`、`pig-*`）和成就徽章（`assets/badge-pig-*`）
  都在 `piglet.svg` 的基础上改画，同属衍生作品。这些文件按 Apache 2.0 发布（可以自由使用、修改、再分发，
  需保留本说明和许可全文），许可全文和原始声明见 [`LICENSE-noto-emoji.txt`](LICENSE-noto-emoji.txt)。
  改动：重新描成 64×64 视框的平涂路径，调整配色，加了表情、服饰、道具等。
- 以后新画的猪图只要是在 `piglet.svg` 上改的，同样属于这一条；完全另起炉灶、不参照任何素材的才算 MIT 原创。
- **不同状态的小猪图（`assets/feedback/*.png`）**：灵感来自 [PigHub](https://pighub.top/) 上的猪猪图片，
  以其为参考由 AI（OpenAI 图像生成，codex 操作）重新生成，经维护者逐张审定；没有直接复制、描摹或拼贴原图。
  生成过程、处理步骤见 [`assets/feedback/PROVENANCE.md`](assets/feedback/PROVENANCE.md)。
  如果原图作者认为侵权或不希望这样使用，请开 issue，我们会删除相关图片。
- 界面里的其它图形一律用系统 emoji 字体渲染，不附带图形文件。

## 商标

QQ 宠物 / QQ 是腾讯控股有限公司的商标。本插件与腾讯**无任何关联，亦未获其授权**；
文档中提到该名称只为说明玩法与数值的参考来源。若权利人认为本仓库有不妥之处，
请开 issue，作者会立即调整或下架。
