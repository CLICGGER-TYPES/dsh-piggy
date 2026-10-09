# 反馈小猪游戏图制作记录

这 38 张游戏图取自用户审定的 OpenAI `image_gen.imagegen` 输出。工具没有提供具体模型版本，提示词要点和逐图复用稿见 [../../docs/art-prompts/feedback-pigs.md](../../docs/art-prompts/feedback-pigs.md)。生成服务条款见 [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/)。原尺寸 PNG 保存在素材工作区 `dsh-piggy-artwork/feedback-static-svg/ai-drafts/selected-png/`，不随游戏包发布。

2026-10-09 用 `uv run --with pillow python tools/prepare-feedback-art.py <selected-png目录> <输出目录>` 从原图离线处理：

1. 对原本有透明通道的图片保留透明区域；对 RGB 白底图仅从画布边缘泛洪移除近白背景，保留被图形围住的眼白、衣服和道具白色。
2. 圆章图的红圈内白色也是背景，针对 `collection-badge.png` 额外移除圈内白色。
3. 外缘向内清理约 2 个原图像素并轻微柔化，避免缩小后出现白边；用 Lanczos 缩到长边 256px，保存为 RGBA PNG。

原图在复制进仓库前与工作区审定源图逐字节核对，38 张全部一致。处理结果共 1,705,176 字节，逐张在深色 `#263347` 和浅色 `#ecebdc` 底色上查看了审图拼图；另放大检查圆章圈内背景。审图拼图在素材工作区 `feedback-static-svg/cutout-review/contact-dark.png`、`contact-light.png`，不进游戏包。白衣服、白鸡、白汤碗和其他道具保留；图片边缘未见成片白框或白边。后续若改抠底参数，须从原图重新生成并复查，不在已缩小的游戏图上叠加处理。
