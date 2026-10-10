# 皮肤包格式规范

[文档中心](../README.md) · [玩家换肤教程](skins.md) · [制作教程](creating-skins.md)

本页记录导入器实际执行的格式与安全限制，适合皮肤作者和工具开发者查阅。

## ZIP 限制

- 整个 ZIP 最大 2 MB。
- 最多 20 个文件。
- 文件必须直接位于 ZIP 根目录。
- 只接受未压缩或 Deflate 压缩，不接受加密 ZIP。
- 文件只能是 `skin.json` 或名称由小写英文字母组成的 `.png` 或兼容的 `.svg`。
- 每个解压后的文件最大 96 KB。

## 场景文件

必需场景：`idle`、`eat`、`bathe`、`play`、`pet`。

可选场景：`relaxed`、`work`、`study`、`trip`、`fish`、`sleep`。前五种缺少时回退到 `idle`；缺少 `sleep.png` / `sleep.svg` 时，打盹显示默认小猪睡姿。`sleep.png` 是横躺睡觉的专用图，与放松时的 `relaxed.png` 不同。

## skin.json 字段

| 字段 | 必需 | 限制 |
|---|---:|---|
| `key` | 是 | 1–24 位；小写字母、数字、短横线；首尾必须是字母或数字；不能与默认或内置皮肤重名 |
| `label` | 是 | 非空；导入时最多保留 30 个字符 |
| `author` | 否 | 默认“玩家”；最多保留 30 个字符 |
| `description` | 否 | 最多保留 100 个字符 |
| `emoji` | 否 | 默认 `🎨`；用于皮肤列表标识 |

同一个自定义 `key` 可以再次导入，用于更新已有皮肤。

## PNG 限制

- 完整 PNG 文件，带 alpha 通道或透明调色板；推荐长边 256px，最多 1024px。
- 单张仍最多 96KB；同一动作只能放 PNG / SVG 的一种。
- 导入不会修改存档结构，文件格式由存档旁边的实际图片决定。

## 旧 SVG 兼容限制

- 根文档必须包含 `<svg>`。
- 必须使用 `viewBox="0 0 64 64"`；数字之间可以使用空格。
- 禁止 `script`、`image`、`text`、`use`、`style`、`foreignObject`。
- 禁止 `linearGradient`、`radialGradient`、`filter`。
- 禁止 `DOCTYPE`、实体、`href`、`src`、事件属性和 `url()`。

这些限制让皮肤保持为可审查的纯矢量路径，并阻止脚本、外链资源、字体和位图进入页面。

## 安装与显示规则

- 导入器先校验整个包，失败时不会安装其中一部分。
- 皮肤文件保存在存档文件旁边的 `skins/` 目录。
- 导入成功后皮肤立即加入列表并成为当前皮肤。
- 显示优先级为“晋升形态 → 当前皮肤 → 默认猪”。晋升形态结束后会恢复之前选择的皮肤。
- 皮肤字段由 `ensureSkins(state)` 为旧存档补齐，不需要提升存档版本。
- 设置中的“小猪大小”使用同一比例（减号、百分比输入、加号）控制普通猪、导入皮肤和睡姿；导入的 PNG / SVG 首次加载时按透明部分的可见高度校准显示大小，不修改原文件。

实现以 [`store/skin-pack.js`](../../store/skin-pack.js) 和 [`packages/pet-core/src/data/skins.js`](../../packages/pet-core/src/data/skins.js) 为准。
