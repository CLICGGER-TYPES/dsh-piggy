# 布局门禁基线（2026-11-28）

`node tools/layout-lint.mjs --write-baseline` 的首次快照，对应提交 `feat/roulette-0202-entry-swap`。

## 口径

- 最小文字内边距：**6px**（与 `tools/layout-image-audit.mjs` 的素材内边距 6/8px 同口径；大场景 8px 未在这里另开规则）。
- 最小控件间距：**4px**（flex/grid 操作区的 `gap`）。
- 只查自己声明上下 `padding` 的、带背景/边框的可点文本控件；只补横向 padding 的继承子规则跳过。

## 当前违例：26 条

| 文件 | 条数 |
| --- | ---: |
| `src/client/css-dex.js` | 6 |
| `src/client/css-holo.js` | 2 |
| `src/client/css-pomodoro.js` | 4 |
| `src/client/css-tabs.js` | 4 |
| `src/client/css-tiles.js` | 4 |
| `src/extensions/roulette/client/styles.js` | 6 |

全部是既有紧凑 chip / 胶囊的 3–5px 上下内边距；`gap` 违例 0 条。明细见 `tools/layout-baseline.json`。

## 处理原则

- 不降低阈值，也不把新 UI 写入基线来“变绿”。
- 本轮新增的左轮顶栏设置条和右上角菜单已按 6px 修过（基线从 32 条降到 26 条）。
- 剩余 26 条是用户已接受的既有密度；以后改到这些控件时顺手修，修完重新生成基线。
- 新增同类违例会直接让 `test/unit/client/layout-rules.test.js` 失败。
