# 睡姿图片出处

`*-sleep.png` 共 12 张：用 OpenAI `image_gen.imagegen` 生成，经用户逐版审图并确认第三版后，缩小到 256 × 191 像素用于游戏。工具没有提供具体模型版本。生成服务的使用条款以 [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/) 为准。

提示词要点：参照用户提供的原始小猪图片与本项目对应角色的立绘，画 Q 版侧卧睡姿；猪在睡垫**上面**，保留原始小猪的可爱感、体形比例、配色、衣服和道具；天使使用明显的大翅膀；透明背景；整张图完整入框。生成时按角色多轮修正衣服错位、胖猪显示问题与翅膀尺寸。原始生成提示词未保存在仓库，本段是制作要求摘要。

完整的续画提示词和各角色检查项见 [睡姿小猪提示词](../docs/art-prompts/sleep-poses.md)；它依据已确认第三版整理，不冒充历史逐字原文。

源图及审图拼图保存在工作区的 `dsh-piggy-artwork/sleep-mat/rework-v3/` 和 `dsh-piggy-artwork/sleep-mat/sleep-poses-contact-sheet-v3.png`。本目录中的 PNG 是游戏使用的缩小版。

资源预算：12 张 256 × 191 PNG 共 462,234 字节（约 452 KiB），随游戏包热更新分发，不单独增加桌面外壳资源。256 像素宽度覆盖最大约 163 像素的睡姿显示宽度。
