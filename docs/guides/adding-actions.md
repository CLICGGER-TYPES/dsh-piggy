# 新增一个猪动作

动作的唯一事实来源是 `assets/actions/<目录>/pack.json`。播放器、帧序列、命中框和缓存版本都从这里生成；不要手改 `src/client/packs.generated.js`。

## 三步

1. 在 `pack.json` 的 `actions` 里加一条。单图动作继续用 `source`：

```json
{
  "key": "wag",
  "kind": "action",
  "source": { "scheme": "builtin", "key": "piglet-blink" },
  "durationMs": 480,
  "eligibility": { "art": "piglet", "react": ["", "pet"] },
  "trigger": { "on": "pet" }
}
```

2. 生成并校验：

```bash
npm run assets:sync
npm run check:assets
```

3. 正常构建：

```bash
npm run build
```

`npm run build` 会重新生成 `packs.generated.js`，并把动作注册进默认资源表。

## 帧序列

帧序列把 `source` 换成 `frames`，文件放在动作 key 同名目录里：

```text
assets/actions/base/wave/
  00.png
  01.png
  02.png
```

```json
{
  "key": "wave",
  "kind": "action",
  "frames": { "fps": 12 },
  "durationMs": 250,
  "eligibility": { "art": "piglet", "react": ["", "pet"] },
  "trigger": { "on": "pet" }
}
```

也可以用逐帧时长，列表长度必须和帧数一致：

```json
"frames": { "durationsMs": [80, 120, 160] },
"durationMs": 360
```

`fps` 和 `durationsMs` 只能写一个。3 帧 12fps 的总时长按累积取整为 250ms（83 + 84 + 83），`durationMs` 必须正好等于这个总和，不能手写成 249 或随便填。

生成器只输出每帧的 `path`、内容 `revision` 和 `durationMs`。不要手写取景或命中框，`frame` 字段会被拒绝。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `key` | 是 | `^[a-z][a-z0-9-]{0,47}$`，同包唯一；帧目录也用这个名字 |
| `kind` | 是 | 固定 `action` |
| `source` | 单图必填 | `builtin`（素材表 key）、`custom`（本机装扮）或 `path`（安全相对路径） |
| `frames` | 帧序列必填 | `{ "fps": 1–60 的整数 }` 或 `{ "durationsMs": [正整数…] }`；与 `source` 二选一 |
| `durationMs` | 是 | 正整数；单图是整段时长，帧序列必须等于所有帧时长之和 |
| `eligibility` | 否 | `art` / `stageNot` / `absent` / `react` / `moodNot` / `party` |
| `trigger` | 否 | `pet` / `feed` / `play` / `tap` / `idle` / `manual`；M2 才自动绑定 |
| `sound` | 否 | 动作播放时通过当前窗口通道播放的音效 key |
| `motion` | 否 | 引用已有 `dp-*` CSS 动效；与帧序列二选一 |
| `fallback` | 否 | 找不到时回退的动作 |

## 帧文件规则

- 2–48 帧，文件名必须是 `00.png`、`01.png`……两位连续；缺号、跳号、多出别的文件都会报错。
- 一个动作只能用一种格式：`.png` 或 `.webp`，不能混用。
- 单帧不超过 128KB，图片长边不超过 512px；内容是 PNG/WebP 会检查 magic 和尺寸。
- 文件放在 `assets/actions/<包目录>/<动作 key>/`，不是 `assets/pigs/`。
- 帧目录里不要再建子目录；出处说明放包根目录的 `PROVENANCE.md`。
- 新增帧文件时，在 `docs/ASSETS.md` 底部的登记块按实际格式补 `actions/*/*/*.png` 和/或 `actions/*/*/*.webp`，否则素材总表测试会报漏登记。

## 运行时行为

- 播放器按每帧 `durationMs` 切帧，`c.render()` 只换当前帧的图片；结束时回到静态立绘。
- 取消、被新动作抢占、页面隐藏或拖动受阻时，帧计时器会停掉并立刻退回静态图。
- 动作开始前预加载整段帧；任何一帧解码失败时这个动作不会开始。
- 单图动作的 URL、时长、预加载和播放计时保持原样。
- 帧动作暂按整帧可用区命中，不读取每帧轮廓；皮肤静态图和现有 hit shape 逻辑不变。

## 包

- 一个目录一个包，`pack.json` 的 `pack` 是包 id；不写时默认取目录名。
- 历史默认包 id 是 `actions`，目录为 `base/`，这样缓存 key 与旧版一致。
- 包目录里只放 `pack.json`、动作素材和 `PROVENANCE.md`；其它文件会被校验当成错误。

## 报错怎么看

```text
assets/actions/base/pack.json actions[0](wag).durationMs: 必须是正整数毫秒
assets/actions/base/pack.json actions[0](wag).source.key: 内置素材表里没有 "not-there"
assets/actions/base/pack.json actions[0](wave).frames: 找不到帧目录 assets/actions/base/wave
assets/actions/base/pack.json actions[0](wave).frames: 帧序号必须从 00 连续，缺少 01.png
assets/actions/base/pack.json actions[0](wave).frames: 00.png 是 513×32，长边超过 512
assets/actions/base/pack.json actions[0](wave).durationMs: 是 200ms，但 3 帧总时长为 250ms
src/client/packs.generated.js: 已过期；运行 npm run assets:sync
```

最后一条表示改了 `pack.json` 但没重新生成模块。

## 现在还没有的

- GIF / 图集 / 每帧独立命中框：帧动作按整帧命中，后续再扩展。
- 第三方动作包：M3，后置。

新增这些之前，先只加单图或上面的连续帧动作；不要复制播放器分支。
