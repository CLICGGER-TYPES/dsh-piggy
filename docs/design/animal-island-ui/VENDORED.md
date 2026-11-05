# animal-island-ui 设计系统（离线副本）

这是 [guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui) 的
`docs/design-system/` 目录离线副本，供改面板/加组件时直接查规格。

- 上游版本：`3.0.0`，提交 `02fa9da20534d303a4757563102229847e15b3c6`（2026-10-31）
- 复制日期：2026-11-05
- 许可：MIT，见同目录 [LICENSE](LICENSE)
- 上游设计系统索引：[docs/design-system/README.md](https://github.com/guokaigdg/animal-island-ui/tree/main/docs/design-system)

## 怎么用

1. 先看本项目 [界面规范](../../guides/ui-style.md)；项目已有组件和既定做法优先。
2. 项目里没有的控件，再来这里找对应组件规格（尺寸、圆角、阴影、状态、动效）。
3. 本项目是**原生 DOM + CSS**，不引入 React、不安装 `animal-island-ui` 包。照规格用
   `--ac-*` 变量实现；不要直接照搬 `--animal-*` 变量名。
4. 上游规则和本项目现状冲突时，以本项目为准（比如本项目用 emoji 做图标、焦点色用薄荷青）。
5. 照抄了某个组件的 CSS 后，在根目录 [THIRD-PARTY.md](../../../THIRD-PARTY.md) 的设计参考表里补一句。

## 变量映射

| 上游 | 本项目 | 说明 |
|---|---|---|
| `--animal-primary` | `--ac-primary` | 薄荷青主色 |
| `--animal-text` / `-text-secondary` | `--ac-text` / `--ac-text-body` | 棕色文字 |
| `--animal-bg` / `-bg-input` | `--ac-bg` / `--ac-bg-input` | 奶油底色 |
| `--animal-border` / `-border-light` | `--ac-border` / `--ac-border-light` | 边框一律 2px |
| `--animal-radius-*` | `--ac-radius-sm` / `--ac-radius-card` / `--ac-pill` | 小件 12px / 卡片 20px / 药丸 50px |
| `--animal-motion-*` | `--ac-ease` + 0.15–0.35s | 缓动统一 |

## 更新

重新从上游 `docs/design-system/` 复制，更新本文件的版本号/提交号/日期，并保留 `LICENSE`。
不要在这里改上游原文；项目自己的补充写在 `docs/guides/ui-style.md`。
