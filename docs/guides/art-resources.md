# 立绘 / 动作资源描述符（F04）

本文说明 F04 的立绘/动作资源合同：描述符与注册表核心在 `src/client/art-resources.js`，对现有代码的公开适配（`artSource`、默认只读注册表、隔离注册表工厂、皮肤归一化）在 `src/client/art-path.js`。它只解决「已有立绘、动作、皮肤怎样被选择和播放」，不新增素材、不新开 UI、不改存档，也不把资源描述符当成玩家/猪/存档身份。

## 先看结论

- 现有 `artSource(key)` 的 URL、`?v=` 版本、`custom-*` 本机版本和未知 key 的 `.svg` 兜底全部保持不变。
- 默认注册表 `defaultArtResources` 只读；内置动作 `blink`（100ms）和 `shy-pet`（420ms）由默认动作包声明。
- 新的动作/皮肤包用 `createArtResourceRegistry()` 建一个隔离注册表，`registerPack()` 整包校验、整包提交；失败不会半装。
- 资源身份是 `namespace/pack/key@revision`。相同 short key 在不同 namespace 或 revision 下拥有不同缓存键，不会互相覆盖。
- 没有远程资源、`eval`、`Function`、下载服务或新网络协议。

## 描述符

注册包：

```js
import { createArtResourceRegistry } from './art-path.js'

const registry = createArtResourceRegistry()

registry.registerPack({
  namespace: 'helper',
  pack: 'work',
  revision: '1',
  resources: [{
    key: 'sweep',
    kind: 'action',
    source: { scheme: 'path', path: 'pigs/helper/sweep.png' },
    duration: 250,
    eligibility: {
      art: 'piglet',
      stageNot: ['box', 'grave', 'dead-day'],
      absent: ['activity', 'idle', 'illness'],
      react: [],
      party: false,
    },
  }],
})
```

字段：

| 字段 | 说明 |
| --- | --- |
| `namespace` / `pack` | 小写 token，资源提供方和包名 |
| `key` | 包内 short key；现有内置图仍是 `piglet`、`feedback/faint` 这类旧 key |
| `revision` | 内容版本；内置图自动取 `PIG_ART_REVISIONS`，显式包不写时用包级 `revision`（默认 `1`） |
| `kind` | `art` / `action` / `skin`（本轮没有多帧动画剪辑；`duration` 只表示单张姿势动作的计时） |
| `source` | `builtin`（必须在 `PIG_ART_ASSETS` 表里）、`custom`（本机 `custom-*`）或 `path`（`/art/` 下的安全相对路径，`.png/.svg/.webp`） |
| `frame` | 可选 `[zoom, x%, y%]`；用于有内置/路径图的显式资源，自定义图仍走量图 |
| `duration` | 动作时长（ms，正数）；`kind: 'action'` 必填 |
| `eligibility` | 动作可用条件；字段 `art`、`stageNot`、`absent`、`react`、`moodNot`、`party` |
| `fallback` | 可选动作引用，或默认动作短 key（如 `'blink'`）；当前动作不满足 eligibility 时最多重试 4 跳，防循环 |

一条已解析资源长这样：

```js
const entry = registry.resolveRef({ namespace: 'helper', pack: 'work', key: 'sweep' })
entry.url        // /dsh-piggy/art/pigs/helper/sweep.png?v=1
entry.cacheKey   // helper/work/sweep@1
entry.artKey     // helper/work/sweep
entry.descriptor // 冻结的描述符
```

## 注册表 API

```js
createArtResourceRegistry({ parent } = {})
```

- `parent` 默认是只读的 `defaultArtResources`；传 `null` 得到完全隔离、不回落旧资源的注册表。父注册表必须是只读的（`readonly === true`）：子表只订阅自己的 records，不会收到父表热替换通知；可写/会变的父表在构造时直接拒绝。
- `registerPack(pack, { replace } = {})`：先校验整包，再一次性写入。重复 handle、包内重复 key、非法 source/revision/duration/eligibility 都会抛错，注册表保持原样。`replace: true` 用于同一 `namespace/pack/key` 的 revision 更新，只替换该 handle。
- `resolve(value)` / `resolveRef(ref)` / `resolveString(key)`：字符串保留旧 key 兜底；显式 ref 找不到就返回 `null`。
- `list({ kind, includeParent })`：默认包含父注册表的同名资源，按 handle 去重。
- `has(value)`：只对真实存在的 builtin/custom/显式资源为 true；旧 `.svg` 兜底不算存在。
- `subscribe(fn)`：revision 替换后收到 `{ namespace, pack, changes: [{ key, revision, previousRevision, cacheKey, previousCacheKey }] }`，返回取消订阅函数。

`createArtResourceRegistry()` 的默认父注册表是只读的 `defaultArtResources`；传 `parent: null` 可得到不继承默认资源的隔离表（旧字符串仍按 `.svg` 兜底）。默认注册表是只读的：`defaultArtResources.registerPack(...)` 直接抛错。隔离注册表只能写自己的表，不会修改默认表或父表。需要热更新时在子表自己 `registerPack`，不要依赖父表变更通知。

## 默认适配器

`src/client/art-path.js` 同时提供下面这些公开入口：

```js
artSource(key)          // 和旧实现相同的 URL 字符串
resolveArtSource(key)   // 完整的 ResolvedArtResource（url/cacheKey/artKey/descriptor）
hasBuiltinArt(key)      // 旧表查询，语义不变
hasArtResource(key)     // 真实资源存在（不含 .svg 兜底）
```

`artSource` 的三种旧行为：

1. `PIG_ART_ASSETS` 里的 key：`/dsh-piggy/art/<path>?v=<PIG_ART_REVISIONS[key]>`。
2. `custom-*`：`/dsh-piggy/art/<key>[?v=<本机版本>]`。
3. 其他字符串：`/dsh-piggy/art/<key>.svg`，不报新 UI 错误。

`defaultArtResources` 里只有内置动作是显式描述符；其余旧 key 按需生成同一份 legacy 描述符，因此不需要复制 `art-assets.js` / `feedback-art.js` 的表，也不会改变它们。

## 实际消费路径

- `src/client/art.js`：睡眠、反馈、微动作、基础皮肤/形态都走 `resolveArtSource`；动作通过 `pigActionResource()` 拿完整解析结果，不再拼接 `artSource(microArt)`。每个图片的选择令牌、替换失效和同 URL 取景更新由 `src/client/art-selection.js` 管；它不持有 context、计时器或「当前猪」。
- `src/client/pig-actions.js`：动作时长、eligibility、预加载 URL 都来自描述符；`pigActionArt()` 仍返回 `piglet-blink` / `piglet-shy-pet` 这样的旧动作图 key，`playPigAction(pig, action)` 或 `attachPigActions()` 返回的 `play()` 可以播放新注册动作。
- `src/client/normalize-skins.js`：`entry.art` 经 `normalizeArtKey()`。已有 `custom-*`、内置皮肤和旧 key 原样保留；带 `?`、`#`、反斜杠、`..`、URL 协议的值退化为空串，不再交给浏览器。
- `src/client/custom-art.js`：`customArtInk(src, cacheKey?)` / `measureCustomArt(image, src, sleep, cacheKey?)` 支持显式资源缓存键；不传时仍是旧 URL 键。`refreshCustomArt` / storage 事件现在告诉监听者被改动的根 key，`art.js` 只清这一套皮肤的取景。
- `src/client/presentation-context.js` / `index.js`：`mountGame({ artResources })` 可把隔离注册表注入 presentation；不传时行为完全不变。`index.js` 把同一个可选 registry 放进 `lifeOptions`，冻结的 `life.js` 原样 `{...c}` 转给 `attachPigActions`，所以普通挂载路径不需要改 `life.js`。`createArtContext()` 还会把注册表按猪元素绑定，作为未显式传参时播放器的回落；没有新的模块级「当前猪」。

## 缓存、revision 与失效

- 旧 builtin/custom 资源的缓存键仍是带版本的 URL，和现有取景/墨迹缓存完全一致。
- 显式注册资源的取景/墨迹缓存键是 `namespace/pack/key@revision`。两个 owner 用同一个 `custom-shared` short key 时，只有 revision 和 namespace 都相同才会命中同一缓存。
- 替换 revision 时，注册表只发出 `previousCacheKey`；活着的 art context 只删除这一条帧缓存和墨迹缓存。
- 替换当前已选资源时，通知会作废该图片的选择令牌；排队中的旧 apply 在写 DOM 前会重新解析同一 handle 的 descriptor，URL/revision 不变但 frame 或其他元数据变了也会被拦下。替换不会立即重绘：下一次正常 sync/轮询才选择新 descriptor；A 的替换不影响 B 或未变更的资源回调。
- 下一次 sync 即使 `image.src` 相同，也会比较 descriptor frame：新增/替换 frame 会重新写取景，移除 frame 会恢复 `builtinFrame` 默认；普通 polling 在取景未变时不重复写。自定义图仍按量图结果取景，不受 descriptor hint 覆盖。
- 同一个 `custom-*` 重新导入仍走 `customArtVersion` + `refreshCustomArt`；通知现在带根 key，`art.js` 只清该皮肤及其场景后缀，不再清空整张取景表。

## 校验与安全边界

- 所有描述符在提交前校验：namespace/pack/key/revision 格式、source scheme、内置 key 是否存在、path 是否越出 `/art/`、动作 duration、eligibility 字段和 fallback 都是显式合同。
- 描述符、source、eligibility、frame、fallback 会复制并冻结；注册后修改调用方对象不影响注册表。
- 只支持本地已有 scheme；没有 `http://`/`https://`/`data:`/`javascript:` source，没有 `eval`/`new Function`/`fetch`，没有远程下载、鉴权或跨设备同步。
- 未知/缺失动作为 no-op；不满足 eligibility 的显式动作按 `fallback` 最多重试 4 跳；立绘仍按旧 `.svg` 兜底，不新增可见错误 UI。

## 动作能力边界

F04 只支持「一张已审核姿势 + 计时」的单姿势动作：`duration` 到点就回到自动选图，`frame` 只描述这一张图的取景。没有多帧序列、关键帧、clip、音轨或播放器时间轴；未来要做真正的多帧动画，需要在描述符/播放器里显式加字段并单独验收，不能拿本轮 `kind` 或 `duration` 冒充动画系统。

## 不包含

- 新动作/皮肤/立绘素材，选择器、布局或 UI 改动。
- helper 的打工/休息/散步/巡逻玩法或 NPC 引擎（后续包可以注册资源，但本轮不实现）。
- 音效（F05）、联机会话/网络适配器（F06）。
- 存档结构、持久 id、迁移、玩家/猪身份或 owner 钱包/菜园归属。
- 远程资源服务、下载协议、鉴权框架。

## 测试

`test/art-resources.test.js` 是作者编写的 17 条回归说明，覆盖默认 URL 兼容、动作包、命名空间/revision 区分、原子注册、冻结、私有动作播放隔离、fallback、descriptor frame、未知兜底、普通挂载转发、皮肤归一化，以及 F04R 的排队旧选择失效、同 revision 元数据替换、同 URL frame 替换/移除和只读父表合同。开发卡只授权编写，不授权执行；独立 V04 在冻结源码上运行它和 6 个 presentation 测试。
