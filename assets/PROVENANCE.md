# 睡姿图片出处

> 当前（2026-10-13）只有一套无描边平涂，由旧版 1:1 重画，已放入 `assets/pigs/` 主路径；画风设置已移除。当前来源见 `assets/pigs/PROVENANCE.md` 和 manifest.json。以下为历史记录，不代表当前运行行为。

`*-sleep.png` 共 12 张：用 OpenAI `image_gen.imagegen` 生成，经用户逐版审图并确认第三版后，缩小到 256 × 191 像素用于游戏。工具没有提供具体模型版本。生成服务的使用条款以 [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/) 为准。

提示词要点：参照用户提供的原始小猪图片与本项目对应角色的立绘，画 Q 版侧卧睡姿；猪在睡垫**上面**，保留原始小猪的可爱感、体形比例、配色、衣服和道具；天使使用明显的大翅膀；透明背景；整张图完整入框。生成时按角色多轮修正衣服错位、胖猪显示问题与翅膀尺寸。原始生成提示词未保存在仓库，本段是制作要求摘要。

完整的续画提示词和各角色检查项见 [睡姿小猪提示词](../docs/art-prompts/sleep-poses.md)；它依据已确认第三版整理，不冒充历史逐字原文。

源图及审图拼图保存在工作区的 `dsh-piggy-artwork/sleep-mat/rework-v3/` 和 `dsh-piggy-artwork/sleep-mat/sleep-poses-contact-sheet-v3.png`。本目录中的 PNG 是游戏使用的缩小版。

资源预算：12 张 256 × 191 PNG 共 462,234 字节（约 452 KiB），随游戏包热更新分发，不单独增加桌面外壳资源。256 像素宽度覆盖最大约 163 像素的睡姿显示宽度。

## 2026-10-10 黑色轮廓 PNG 迁移

本页以上为历史睡姿记录。当前全部猪素材按类型放在assets/pigs/，详见[pigs/PROVENANCE.md](pigs/PROVENANCE.md)及manifest.json；原尺寸图与历史版本保存在仓库外。


## 联机大厅插画（2026-11-06）

`assets/room-lobby.png` 取自 2026-11-05 联机大厅原型 `01-lobby.png` 上方两只小猪的插画区域，
原型由 OpenAI Codex `image_gen` 生成、用户看过并确认“最开始夸的那个就可以”。2026-11-06 在
工作区 `work/20261106-piggy-room-art` 裁掉标题/按钮、把深色猪蹄调成身体同色、缩到 640×285，
没有重画或改变构图。按 **CC BY 4.0** 随本项目分发。

同日另有一版 Grok `image_gen` 五猪横幅，用户认为不好看，未进仓库、未进发布包。


## 联机房间猪圈背景（2026-11-06）

`assets/room-pen.png` 用本机 Grok CLI 的 `image_gen` 生成（grok.com，session
`01a1ae39-4a67-75f0-87df-6f4e3125ce6b`）：低木栅栏围住草地，水槽和干草在两侧，中间留空给实时小猪；
要求无猪、无人物、无文字。生成图为 1248×832 JPEG，转成 256 色 PNG（约 148 KB）后接入房间窗口。
用户 2026-11-06 看开发版预览后确认“就是这样，好看”。按 **CC BY 4.0** 随本项目分发。
提示词存档：`work/20261106-piggy-room-art/logs/pen-prompt.txt`（工作区，不进仓库）。

## 联机 2.5D 场景（2026-11-06）

`assets/room-pen-25d.png` 和 `assets/room-room-25d.png` 用本机 Grok CLI `image_gen` 生成（grok.com，sessions `01a1af76-d9ff-7653-bc75-6ac84e0d00b5` / `01a1af22-8b1a-7a13-ae41-8a0ffb892275`），16:9 1280×720，分别是一圈木栅栏的草地猪圈（小屋、池塘、树）和等距室内房间（木地板、窗、书桌、沙发、书架）。要求无猪、无人物、无文字；转 256 色 PNG 后接入房间窗口，猪仍用现有 2D 立绘叠层。用户 2026-11-06 确认 2.5D 纸片人方向。按 **CC BY 4.0** 随本项目分发。
