# 新增一个音效

音效的唯一事实来源是 `assets/sounds/<目录>/pack.json`。`src/client/sounds.generated.js` 由构建生成，不要手改。

## 两种音效

| 类型 | 适合 | 需要的文件 |
|---|---|---|
| `synth` | 短提示、现有配方、离线兜底 | 无，写参数 |
| `file` | 真实录音、更复杂的声音 | `.ogg` 或 `.wav`，≤30KB、≤1.5s |

同一个 key 只能二选一；文件音效建议同时写 `fallback`，首次加载或解码失败时仍能响。

## 加一个合成音效

1. 在 `assets/sounds/builtin/pack.json` 的 `sounds` 里加一条：

```json
{
  "key": "new-cue",
  "synth": {
    "tones": [{ "type": "sine", "from": 440, "to": 660, "ms": 80, "gain": 0.3 }]
  }
}
```

2. 生成并校验：

```bash
npm run assets:sync
npm run check:assets
```

3. 在触发点调用 `playSound('new-cue')`。已有事件换声音只改 JSON；全新事件才加一行 call site。

## 加一个文件音效

1. 把 `wag.ogg` 放进 `assets/sounds/sfx/`（Opus，44.1kHz，单声道，≤1.5s，≤30KB）。
2. 加一条：

```json
{
  "key": "wag",
  "file": "wag.ogg",
  "durationMs": 420,
  "gain": 0.9,
  "debounceMs": 60,
  "fallback": "synth:tap"
}
```

3. `npm run assets:sync && npm run check:assets`。

运行时首次播放会先响 `fallback`，同时后台加载并解码；解码完成后同一 key 直接播文件。解码失败就继续用 `fallback`，不会反复请求坏文件。

## 动作自带音效

在动作的 `assets/actions/base/pack.json` 条目上写 `sound`：

```json
{
  "key": "wag",
  "sound": "wag"
}
```

动作成功播放时，会通过**当前窗口的音频通道**播放这个 key。`sfx/wag` 这种带包名的写法会取最后一段作为音效 key。

## 字段

| 字段 | 说明 |
|---|---|
| `key` | `^[a-z][a-z0-9-]{0,47}$`，全包唯一 |
| `synth.tones[].type` | `sine` / `triangle` / `sawtooth` / `square` |
| `from` / `to` | 20–20000 Hz |
| `ms` | 10–5000 |
| `gain` | 0–1 |
| `file` | `<key>.ogg` 或 `<key>.wav`；必须同时写 `durationMs` |
| `durationMs` | 文件音效 20–1500 的整数 |
| `debounceMs` | 0–2000，默认 60 |
| `priority` | 0–100；声部满时决定谁被拒，不抢占正在播的声音 |
| `maxVoices` | 1–2 |
| `fallback` | 音效 key 或 `synth:<key>` |

## 约定

- 音量三档 `0.32 / 0.55 / 0.82` 不变，`gain` 是音效自身系数。
- 文件音效的缓存 URL 带内容哈希，换文件会自动失效。
- 面板窗口、扩展窗口不响；猪窗口各自独立去重和停止。
- 不要为同一个事件同时接文件音效和代码里的临时 `new Audio()`。

## 还没做

- 第三方音效包 / 素材市场：M3，后置。
- 循环音效：当前 `loop` 只校验，不循环播放。
