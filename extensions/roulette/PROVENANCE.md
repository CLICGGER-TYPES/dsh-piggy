# 左轮轮盘素材出处

本扩展的 5 张图来自左轮轮盘 UI 原型任务（`work/20261113-roulette/art/export/`），
由本机 Grok `image_gen` 生成、经用户审图采用；没有另画、没有用 MiniMax、没有改猪立绘。

## 文件

| 文件 | 原型名 | 用途 | SHA-256 |
|---|---|---|---|
| `assets/table-v1.webp` | table-v1 | 大堂主视觉的绒布底 | `bc0920adb0d3dea52e538164004c2426b12b578584cdcbcdba9b4a3765851ef6` |
| `assets/revolver-v2.webp` | revolver-v2 | 大堂主视觉、装弹页整枪 | `7fabc93ba8bda8a6244c4293790dd260a03f54860228139a0a9c8c4ecd4a0377` |
| `assets/cylinder-v1.webp` | cylinder-v1 | 牌桌六孔弹巢 | `a2c9f0c6aa4d42470bcd5f4d22a36409c145d164f1ac07f6d736b6339619db83` |
| `assets/bullet-v1.webp` | bullet-v1 | 弹巢计数、装弹页子弹 | `23aa4531f3e6003ac2a83e29f2edd1303262de5e2d3243f2b5bf027218bbb857` |
| `assets/chip-v1.webp` | chip-v1 | 底池筹码、大堂角标 | `08a8c450e5ab47f482a1c4d2be5e415674446eb59704045090a0f92320b194f3` |

## 来源与风格

- 生成命令：`grok -p "$(cat art/prompts/<name>.md)" --allow image_gen --output-format json --cwd art`
- 逐字提示词、原始图和抠图脚本在同任务的 `art/prompts/`、`art/raw/`、`art/process.py`。
- Style lock：`work/20261113-roulette/art/STYLE-LOCK.md`，依据项目 `art-source/ext-ui/README.md` 的菜园出图规范。
- 画风：动物森手绘平涂、无黑描边、左上暖光、奶油/土棕/薄荷/黄铜色板；图内不画文字，按钮和文字全部由代码渲染。
- 导出：原始 JPG 经纯色 chroma key 抠图后转透明 WebP，未缩放猪立绘，未重画道具。

图里的猪不使用新素材：大堂玩家头像走 `app.pigArt()`，AI 头像用 emoji；没有复制或修改游戏猪立绘。

## 许可

- 这 5 张图与项目其他 AI 生成场景/道具相同，按 **CC BY 4.0** 发布；署名建议：`Art from dsh-piggy, licensed under CC BY 4.0.`
- 代码（`manifest.json`、`server.js`、`client.js`、构建脚本与测试）按项目根 `LICENSE` 的 MIT 发布。
- 许可总表见仓库 `LICENSE-ASSETS.md`；原始生成工具、参考图或第三方内容的权利不在本项目声明范围内。
