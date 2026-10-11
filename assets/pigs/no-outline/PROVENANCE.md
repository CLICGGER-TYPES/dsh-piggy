# 无描边透明 PNG

2026-10-11 用户确认整套181张并要求接入与设置切换。全部使用内置 image_gen 编辑对应原尺寸黑色描边参考，v3普通猪作为画风参考，保留原耳型、姿势、服饰、道具、黑色实心对象和状态含义。每张逐字提示词在 docs/art-prompts/no-outline/batch/，生成、参考和成品SHA256及边界在 manifest.json。

原尺寸、所有版本、自查对照与完整 jobs.json 保留在仓库外：
`/zyx/codex/dsh-piggy-artwork/no-outline/2026-10-11/`。

离线处理：`uv run --with pillow python tools/prepare-no-outline-art.py <上述工作区>`。直接使用生成PNG原生alpha，仅清理alpha≤8噪点，alpha≥248恢复不透明；按alpha>16可见边界裁切，预乘alpha缩至长边224px，居中放到256×256透明画布，四周至少16px安全区；清空全透明像素RGB，导出256色透明表PNG。没有按白色或黑色抠除内容，眼白、白衣、翅膀、泡沫和高光保留。181张共1,363,636字节。

运行 `uv run --with pillow python tools/measure-feedback-framing.py --no-outline` 独立测量可见高度与桌面点击边界。无需运行时抠底或去描边滤镜。原图不进入npm包，旧描边素材保留供设置切换。

感谢 @1nuoiscute 的原角色与动作贡献，以及用户逐版审图。Noto Emoji衍生署名和许可继续见 THIRD-PARTY.md、LICENSE-noto-emoji.txt。扛葱图实际四条腿加卷尾，原始v1提示词的计数误述不改写；下次复用按工作区 prompts/collection-scallion-reuse-note.txt 修正。
