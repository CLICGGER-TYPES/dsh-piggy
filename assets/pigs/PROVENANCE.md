# 黑色轮廓 PNG 素材

2026-10-10 用户逐批审图后确认接入；最新大肥猪电脑图按用户要求重出。共181张：现有176项及5张补充动作。全部由内置 image_gen 生成/编辑；未手绘或描摹替代。原尺寸原图、参考、完整 job、审图记录和版本留在仓库外 `/zyx/codex/dsh-piggy-artwork/style-unification/2026-10-09/` 与 `2026-10-10/`。

每张选定版本、原图 SHA256、原尺寸、裁切范围、输出 SHA256 与逐字提示词路径记录在 manifest.json。逐字提示词保存在 docs/art-prompts/outlined-pigs/，不是复用摘要。

处理命令：`uv run --with pillow python tools/prepare-pig-art.py <工作区/all-selected.json>`，再运行 `tools/measure-feedback-framing.py`。原生alpha离线清掉≤8的噪点、将≥248的部分恢复完全不透明、按可见轮廓裁切；预乘alpha缩放到256方形画布内，保留16px安全边距；自适应256色透明PNG用tRNS保留透明背景与抗锯齿，不运行时抠白。白衣、眼白、翅膀、高光保留。分类放base/forms/skins/feedback/badges，角色目录按动作命名。

状态和玩法用图保持已有语义：死亡当天仍是倒下灰猪，幽灵旁有墓碑；猪递本身为纸箱；检疫、蚊子、扛葱等黑色幽默保留。暂不用的场景仍按原来的未使用表处理，不自行启用。

感谢 @1nuoiscute 的原立绘与动作贡献，以及用户逐版反馈。角色身份参考原项目与用户提供皮肤，原Noto Emoji衍生署名及许可证继续保留在THIRD-PARTY.md、LICENSE-noto-emoji.txt。旧游戏原图备份在工作区references/legacy-game-art/，不随npm包分发。
