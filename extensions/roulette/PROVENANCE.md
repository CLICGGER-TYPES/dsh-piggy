# 左轮轮盘素材出处

本扩展的 6 张图来自左轮轮盘 UI 重做原型 v6（`work/20261117-roulette-ui-redesign/art/export/`），
由本机 Grok `image_gen` 生成、经用户审图采用；没有另画、没有用 MiniMax、没有改猪立绘。

## 文件

| 文件 | 原型名 | 用途 | SHA-256 |
|---|---|---|---|
| `assets/table-v2.webp` | table-v2 | 大堂主视觉、牌桌底纹 | `c999bc86c3612cbf413fde161817561a12038cb1b84d9d5bac0c332128cedf97` |
| `assets/revolver-v6.webp` | revolver-v6 | 大堂主视觉完整玩具枪 | `8a4565faa2953eed256f223cfecf2ff7adde0556788e75d19b4940f6ac902322` |
| `assets/cylinder-v4.webp` | cylinder-v4 | 牌桌六孔弹巢正面特写 | `280e9e120bc8bc8f9011b89b8b27886d2b2c5e91421f46cd399f65f8a70bda5a` |
| `assets/bullet-base-v4.webp` | bullet-base-v4 | 装弹底火标记 | `847a780bcf21d8529eafc9fe191949e9ca9e8f930e29b2b554cbbea43ac33755` |
| `assets/bullet-side-v4.webp` | bullet-side-v4 | 弹巢剩余子弹计数 | `202401a0b5088f8630477f3a5a98b1ae9699ac1f87443c28629e6ddfd54d05a5` |
| `assets/chip-v1.webp` | chip-v1 | 底池筹码 | `08a8c450e5ab47f482a1c4d2be5e415674446eb59704045090a0f92320b194f3` |

## 来源与风格

- 生成命令：`grok -p "$(cat art/prompts/<name>.md)" --allow image_gen --output-format json --cwd art`
- 逐字提示词、原始图和抠图脚本在同任务的 `art/prompts/`、`art/raw/`、`art/process.py`。
- 方案 A：侧视枪身静态，只有正面弹巢特写做旋转；侧视枪不显示子弹、不假装侧视转巢。
- 画风：animal-island-ui 玩具感、无黑描边、奶油/土棕/薄荷/黄铜色板；图内不画文字，按钮和文字全部由代码渲染。
- 导出：原始 JPG 经纯色 chroma key 抠图后转透明 WebP，未缩放猪立绘，未重画道具。

图里的猪不使用新素材：玩家头像走 `app.pigArt()`，AI 头像用 emoji；没有复制或修改游戏猪立绘。

## 许可

- 这 6 张图与项目其他 AI 生成场景/道具相同，按 **CC BY 4.0** 发布；署名建议：`Art from dsh-piggy, licensed under CC BY 4.0.`
- 代码（`manifest.json`、`server.js`、`client.js`、构建脚本与测试）按项目根 `LICENSE` 的 MIT 发布。
- 许可总表见仓库 `LICENSE-ASSETS.md`；原始生成工具、参考图或第三方内容的权利不在本项目声明范围内。
