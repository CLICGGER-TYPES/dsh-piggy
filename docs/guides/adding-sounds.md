# 新增一个音效

## 现在（M1）

音效全部是程序合成配方，集中在 `src/client/sounds.js` 的 `RECIPES`。新增一个“已有事件”的声音仍然是改代码，但只有一处。

当前可用的 key：

```text
tap lift toss bounce land-soft land-hard dizzy purr flip catch
```

加一条配方：

```js
// src/client/sounds.js
RECIPES['new-cue'] = {
  tones: [{ type: 'sine', from: 440, to: 660, ms: 80, gain: 0.3 }],
}
```

再在触发点调用 `playSound('new-cue')`（或现有 `audio-context` 的 cue 入口）。音量、去重、免打扰、每窗口通道都不用动。

## 目标（M2）

改完后，新增/替换音效不再改播放器：

1. 把 `wag.ogg` 放进 `assets/sounds/sfx/`（Opus，44.1kHz，单声道，≤1.5s，≤30KB）。
2. 在 `assets/sounds/sfx/pack.json` 加一条：

```json
{
  "key": "wag",
  "file": "wag.ogg",
  "codec": "opus",
  "durationMs": 420,
  "gain": 0.9,
  "debounceMs": 60,
  "fallback": "synth:tap"
}
```

3. `npm run check:assets`。

替换已有事件 = 0 行代码；只有“全新事件”才需要在触发点加一行。

## 约定

- 音量三档 `0.32 / 0.55 / 0.82` 不变，`gain` 是音效自身系数。
- `debounceMs` 默认 60，和现有 `AUDIO_DEBOUNCE_MS` 同义。
- `priority` 只在声部满时决定谁被拒，不抢占正在播的声音。
- 合成配方保留为回退：文件损坏、离线或静音场景仍能响。
- 不要为同一个事件同时接文件音效和代码里的临时 `new Audio()`。

## 还没做

- 音频文件加载、解码缓存、`sound-registry`：M2。
- 每动作绑定音效：M2，届时 `pack.json` 的 `sound` 字段生效。
- 第三方音效包：M3，后置。

在 M2 落地前，`pack.json` 里的 `sound` 字段只会被校验格式，不会播放。
