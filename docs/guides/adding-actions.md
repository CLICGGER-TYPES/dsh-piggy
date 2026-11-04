# 新增一个猪动作

动作的唯一事实来源是 `assets/actions/<目录>/pack.json`。播放器、命中框和缓存版本都从这里生成；不要手改 `src/client/packs.generated.js`。

## 三步

1. 在 `pack.json` 的 `actions` 里加一条（M1 先用现有内置图；帧序列在 M2 接入）：

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

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `key` | 是 | `^[a-z][a-z0-9-]{0,47}$`，同包唯一 |
| `kind` | 是 | 固定 `action` |
| `source` | 是 | `builtin`（素材表 key）、`custom`（本机装扮）或 `path`（安全相对路径） |
| `durationMs` | 是 | 正整数；播放器计时 |
| `eligibility` | 否 | `art` / `stageNot` / `absent` / `react` / `moodNot` / `party` |
| `trigger` | 否 | `pet` / `feed` / `play` / `tap` / `idle` / `manual`；M2 才自动绑定 |
| `sound` | 否 | 动作播放时通过当前窗口通道播放的音效 key |
| `motion` | 否 | 引用已有 `dp-*` CSS 动效；与帧序列二选一 |
| `fallback` | 否 | 找不到时回退的动作 |

不要写 `frames`：当前会直接报“帧序列尚未接入”，避免素材被静默忽略。

## 包

- 一个目录一个包，`pack.json` 的 `pack` 是包 id；不写时默认取目录名。
- 历史默认包 id 是 `actions`，目录为 `base/`，这样缓存 key 与旧版一致。
- 包目录里只放 `pack.json`、动作素材和 `PROVENANCE.md`；其它文件会被校验当成错误。

## 报错怎么看

```text
assets/actions/base/pack.json actions[0](wag).durationMs: 必须是正整数毫秒
assets/actions/base/pack.json actions[0](wag).source.key: 内置素材表里没有 "not-there"
src/client/packs.generated.js: 已过期；运行 npm run assets:sync
```

最后一条表示改了 `pack.json` 但没重新生成模块。

## 现在还没有的

- 帧序列 / GIF / 图集：M2。
- 第三方动作包：M3，后置。

新增这些之前，先只加单图动作；不要复制播放器分支。
