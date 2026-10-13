# 无描边平涂 PNG 素材

2026-10-13 由旧版 1:1 重画，当前只有一套无描边平涂，原有181张，另追加下文两张用户审定微动作。全部使用内置 image_gen 生成/编辑并经审图选定；角色、脸型、比例、姿势、服饰与道具沿用旧版，不以程序删除轮廓线。

已导出成品由 tools/prepare-flat-art.py 放入 base/forms/skins/feedback/badges 主路径。原尺寸原稿、参考和审图历史保留在独立素材工作区 face-restore/2026-10-12/。本次接入只使用已经导出的图片，不再修改像素。

每张选定版本、参考、源图和成品 SHA256、尺寸、透明边界、字节数及逐字提示词路径见 manifest.json；提示词保存在 docs/art-prompts/flat-pigs/。取景由 tools/measure-feedback-framing.py 读取透明边界重算，保持既有可见高度，不写图片。

感谢 @1nuoiscute 的原立绘与动作贡献，以及用户逐版反馈。Noto Emoji 衍生署名及许可继续保留在 THIRD-PARTY.md、LICENSE-noto-emoji.txt。历史图与未通过稿不随游戏包分发。

## 眨眼与摸猪害羞（2026-10-13）

用户审定 batch1 的 blink/01-closed 与 shy-pet/01-shy，原件已是 256×256 透明 PNG，逐字节复制，不裁切、调色或重新居中。逐字提示词随仓库保存，源图和成品哈希见 manifest.json。序列复用现有 idle（不重复存图），统一使用 idle 取景；闭眼 100ms，害羞 420ms。其余未通过动作不接入。
