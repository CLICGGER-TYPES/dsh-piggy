# 六款新猪皮肤（2026-10-24 审图，2026-11-06 接入）

六款新猪：邮差猪、园丁猪、雨衣猪、画家猪、消防员猪、音乐家猪。每只 11 个动作：
`idle / eat / bathe / play / pet / relaxed / work / study / trip / fish / sleep`。

## 来源

- 审图工作区：`<artwork-workspace>/deliverables/piggy-review/`
- 审图页：`index.html`（标题「六款新猪 · 结构与服装修订」），对照页 `comparison.html`
- 逐只目录：`originals/<角色>/` 为 1254×1254 原稿，`images/<角色>/` 为审图用 256 缩略图，`before/<角色>/` 为上一版对照
- 生成工具：`image_gen`；原稿为透明 RGBA
- 2026-11-06 用户确认「接入吧」，按审图后的 66 张接入；其余 33 张修订记录保留在审图页

## 处理

`tools/prepare-pig-art.py` 的同一套导出逻辑：透明通道去噪、裁掉透明边、等比缩到 224 内含 16px 边距、256×256、256 色调色板。逐图源图/成品 SHA-256、边界和字节数登记在 `assets/pigs/manifest.json`。

## 说明

本工作区没有保留这六款的逐字提示词；审图页的 66 个 `data-review-hash` 和 `manifest.json` 的源图 SHA-256 是当前可核对的来源凭据。后续如要补逐字提示词，应从原生成工作区取回，不能凭记忆补写。
