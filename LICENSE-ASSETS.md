# 素材许可

本仓库的**代码和文档**按根目录 [LICENSE](LICENSE)（MIT）发布。
**素材不自动适用 MIT**：图片、字体、音视频和第三方内容按本页的目录表单独授权。
没有在本页列出的文件，默认归项目维护者所有，未授予再分发许可。
许可文本本身（`LICENSE`、`LICENSE-*`、`THIRD-PARTY.md`、本页）可按原文转载。

## 目录许可表

| 路径 | 内容 | 许可 | 说明 |
|---|---|---|---|
| `src/`、`packages/`、`runtime/`、`store/`、`adapters/`、`scripts/`、`test/`、`tools/` 下的代码与配置 | 插件、宿主、构建脚本、测试 | **MIT** | 根 [LICENSE](LICENSE) |
| `apps/desktop/` 下的 `.js`、`.mjs`、`.cjs`、`.json`、`.nsh` | 桌面外壳、打包与安装脚本 | **MIT** | 根 [LICENSE](LICENSE) |
| `docs/`、`README.md`、`CHANGELOG.md`、`THIRD-PARTY.md`、`AGENTS.md`、`cordis.patch.yml` | 文档、清单、配置 | **MIT** | 文中引用的第三方内容按各自许可；截图见下 |
| `assets/pigs/**/*.png`、`extensions/pig-puzzle/assets/pig.png`、`docs/examples/skin-pack/*.png` | 小猪立绘、形态、皮肤、徽章、反馈图、示例皮肤 | **Apache-2.0** | 改自 Noto Emoji 🐖；见下方「小猪立绘」 |
| `assets/pigs/manifest.json`、`assets/pigs/**/*.md` | 小猪素材清单与出处 | **MIT** | 记录本身按文档许可；记录的图片按上一行 |
| `assets/fishing/**/*.png` | 钓鱼场景、浮漂、搏斗、鱼图鉴/结果插画 | **CC BY 4.0** | AI 生成，用户审定 |
| `assets/fishing/*.json`、`assets/fishing/*.md` | 钓鱼素材清单与出处 | **MIT** | |
| `assets/animations/pet-hand/*.webp` | 高清独立手五帧图集 | **CC BY 4.0** | AI 生成，用户审定 |
| `assets/animations/pet-hand/*.json`、`*.md` | 手层清单与出处 | **MIT** | |
| `extensions/farm/assets/**` | 菜园场景、作物、工具、UI 图 | **CC BY 4.0** | AI 生成，用户审定 |
| `extensions/farm/*.json`、`extensions/farm/*.md` | 菜园清单、出处与代码数据 | **MIT** | |
| `extensions/mine/assets/**` | 矿洞场景、矿物、工具、UI 图 | **CC BY 4.0** | AI 生成，用户审定 |
| `release/extension-variants/**/*.webp` | 手动导入扩展变体的素材 | **CC BY 4.0** | 与已发布扩展同源 |
| `apps/desktop/artwork/*.png`、`apps/desktop/build/icon.png`、`icon.ico`、`tray.png` | 桌面应用图标与托盘图 | **CC BY 4.0** | 用户提供猪脸原图，只做等比缩放/透明补方 |
| `assets/room-pen.png` | 联机房间猪圈背景 | **CC BY 4.0** | Grok image_gen 生成，用户审定 |
| `assets/room-lobby.png` | 联机大厅两只小猪插画 | **CC BY 4.0** | 从用户确认的 Codex image_gen 原型裁切，用户选定 |
| `assets/ui-*.svg` | 历史未使用 UI 图标 | **MIT** | 项目原创矢量图 |
| `assets/piggy-emoji.woff2` | 网页 emoji 子集字体 | **OFL-1.1** | Noto Color Emoji 子集，见 `assets/piggy-emoji-LICENSE.txt` |
| `apps/desktop/renderer/piggy-emoji.ttf` | 桌面 emoji 整套字体 | **OFL-1.1** | 见 `apps/desktop/renderer/piggy-emoji-LICENSE.txt` |
| `assets/actions/**`、`assets/sounds/**` | 动作/音效清单与合成参数 | **MIT** | 不含第三方音频文件；音效运行时合成 |
| `assets/animations/piglet-pet/manifest.json`、`PROVENANCE.md` | 原 GIF 帧图集的历史记录 | **MIT** | 记录本身按文档许可；`reference.webp` 已移除，见下 |
| `docs/screenshots/**`、`docs/art/reviews/**`、`docs/art/*.png` | 截图、审图、示例图 | **文档 MIT；图中素材按上表** | 截图可按 MIT 用于说明本项目；图中的猪/场景/字体仍按各自许可 |

`extensions/*/client.js`、`server.js`、`manifest.json` 和 `assets/*/pack.json` 属于代码或数据，按 MIT。
`apps/desktop/build/optional-extensions.nsh` 是安装脚本，按 MIT。

## 小猪立绘（Apache-2.0）

`assets/pigs/` 下的小猪立绘、形态、皮肤、徽章、反馈图，以及从它们复制的 `extensions/pig-puzzle/assets/pig.png` 和 `docs/examples/skin-pack/*.png`，都改自
[Noto Emoji](https://github.com/googlefonts/noto-emoji) 的 🐖（`2D/svg/emoji_u1f416.svg`，Copyright 2013 Google LLC），
按 **Apache License 2.0** 发布。

- 许可全文与原始声明：[LICENSE-noto-emoji.txt](LICENSE-noto-emoji.txt)。
- 改动：重新描成无描边平涂 PNG，调整配色、表情、服饰、道具和体型；不是原图直接复制。
- 再分发时请保留 `LICENSE-noto-emoji.txt`、本说明和 `THIRD-PARTY.md` 中的署名。
- 旧文档里的 `assets/piglet.svg`、`assets/elder.svg`、`assets/badge-pig-1.png` 已不存在；当前对应 `assets/pigs/base/piglet/`、`assets/pigs/base/elder/`、`assets/pigs/badges/`。

## AI 生成素材（CC BY 4.0）

下面这些由项目 AI 出图流程生成、经用户审定的场景和道具，按
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) 发布：

- `assets/fishing/**/*.png`
- `assets/animations/pet-hand/*.webp`
- `extensions/farm/assets/**`
- `extensions/mine/assets/**`
- `release/extension-variants/**/*.webp`

你可以复制、修改、再分发，包括商用，条件是保留署名和许可链接。建议署名：

> Art from dsh-piggy, licensed under CC BY 4.0.
> https://github.com/CLICGGER-TYPES/dsh-piggy

AI 生成内容在不同法域的可版权性不同；本项目只就自身拥有的权利授予上述许可，不声称覆盖生成工具、参考图或第三方内容的全部权利。
`assets/pigs/feedback/` 的灵感来自 [PigHub](https://pighub.top/) 上的猪猪图片，但没有直接复制原图；如果原图作者认为不妥，请开 issue，我们会删除相关图片。

`apps/desktop/artwork/` 和 `apps/desktop/build/` 的应用图标由用户提供原图，按 CC BY 4.0 发布；只做等比缩放和透明补方，不重画五官或换色。

## 字体（OFL-1.1）

- `assets/piggy-emoji.woff2`：Noto Color Emoji 的网页子集，按 [SIL Open Font License 1.1](assets/piggy-emoji-LICENSE.txt) 发布。
- `apps/desktop/renderer/piggy-emoji.ttf`：Noto Color Emoji 整套字体，按 [SIL Open Font License 1.1](apps/desktop/renderer/piggy-emoji-LICENSE.txt) 发布。

子集/裁剪属于修改版本，仍按 OFL 1.1 分发；再分发时请保留对应的许可文件。

## 不随仓库分发的素材

- `assets/animations/piglet-pet/reference.webp`：用户提供的微信 GIF 的逐像素帧图集。原 GIF 的权利链不属于本项目，**不授予开源或再分发许可**，已从当前仓库和发布包移除。`manifest.json` / `PROVENANCE.md` 只保留历史哈希和出处记录。
- 该文件仍可能出现在旧提交或旧构建产物中；那些副本同样不适用本页许可。要彻底从 Git 历史移除，需要单独重写历史。
- 仓库外的原稿、审图图、宣传片工程、研究素材，不随仓库分发，也不在本页授权范围内。
- 桌面安装包里的 Electron/Node 运行时按各自的上游许可，不属于本项目素材。

## 第三方参考与删除请求

玩法数值参考 [xuemian168/qqpet_automation](https://github.com/xuemian168/qqpet_automation)（MIT，仅数值与名称），视觉参考 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui)（MIT，仅设计 token 与外观），小猪图参考 Noto Emoji（Apache-2.0）。
这些参考没有把对方的代码、文档或游戏原版素材复制进本仓库。

如果你认为本仓库的某张素材侵犯了你的权利，请到
[Issues](https://github.com/CLICGGER-TYPES/dsh-piggy/issues) 说明具体文件和理由；我们会核实并删除或替换。
