# 第三方素材包 M3（安装 / 校验 / 静态路由 / 播放）

> 2026-11-04 · 目标：先让第三方扩展可以安全地携带动作和音效素材，安装、更新、卸载、回滚都不破坏第一方素材。
> 第一刀做安装、校验、命名空间和摘要；第二刀加只读静态路由和 `/state` 摘要字段；
> 第三刀接客户端动作注册与 DOM 播放入口；第四刀接音效注册与播放，M3 运行时链路完成。
> UI 卡片和 `trigger.on` 自动触发仍未接。

## 0. 一句话

扩展目录里多两个固定目录 `actions/<pack>/`、`sounds/<pack>/`；manifest 可选声明
`assetPacks: { actions?: string[], sounds?: string[] }`；安装前按第一方同一套 `pack.json`
schema 做完整校验，命名空间固定为 `ext-<extension-key>`，永远不能覆盖 `dsh-piggy`。

## 1. 范围

**本刀做**

- manifest 声明与实际目录一致性、`pack.json` 校验。
- ZIP / `.piggyext` 两种安装入口的文件白名单、路径逃逸、符号链接、大小写冲突、magic、尺寸、数量上限。
- 安装事务沿用现有“临时目录 → 换名 → 试加载 → 提交”，失败回滚。
- 扩展列表带只读素材包摘要（数量/帧数/文件数/字节/可用状态/基址）。
- 卸载时素材包随扩展目录一起删除。
- 第二刀：`actions/`、`sounds/` 的只读静态路由，只给 manifest 和 `pack.json` 都声明过的文件。
- 第三刀：客户端把可用动作包注册进可写 registry，并提供 `dsh-piggy:action` 播放入口（见 §12）。
- 第四刀：客户端把可用音效包注册进 `audio-context` 的扩展表，提供 `dsh-piggy:sound`
  播放入口，动作 `sound` 绑定 `ext-` key；文件失败回退 synth，再失败静音（见 §13）。

**本刀不做**

- 不做扩展页上的素材包卡片/试听/预览 UI（只把摘要穿过快照归一化）。
- 不把 `pack.json.trigger.on` 接到自动触发；第三方动作/音效仍由扩展显式事件播放。
- 不把第三方扩展文件放进存档备份（和现有 `server.js` 一样，重装扩展后重新下载）。

## 2. 目录布局

```text
extensions/<key>/
  manifest.json
  server.js
  client.js
  assets/                        现有：扩展界面图片
  actions/                       新：动作素材包
    <pack>/
      pack.json
      <action-key>/
        00.png | 00.webp
        01.png | 01.webp
        …
  sounds/                        新：音效素材包
    <pack>/
      pack.json
      <sound-key>.ogg | <sound-key>.wav
```

规则：

- 一个目录一个包；`pack` 名就是目录名。`pack.json.pack` 可省略（默认目录名），写了必须
  与目录名相等；第三方不允许第一方 `base/` 目录 + `pack: "actions"` 的历史例外。
- 动作 key 目录名必须等于 `pack.json.actions[].key`。
- 音效文件名必须等于 `<key>.ogg` 或 `<key>.wav`。
- 包目录里只允许 `pack.json`、帧文件或音频文件；`PROVENANCE.md`、`README`、脚本、SVG、
  HTML 一律拒收。第一方的 `PROVENANCE.md` 只用于源码仓库，不进入第三方安装包。
- 扩展可以只有 `actions`、只有 `sounds`，或两者都有；不声明 `assetPacks` 就是都没有。

## 3. manifest 声明

`assetPacks` 可选，缺省等价于 `{ "actions": [], "sounds": [] }`：

```json
{
  "key": "my-extension",
  "version": "1.2.0",
  "minGame": "0.37.2",
  "assetPacks": {
    "actions": ["wave", "sit"],
    "sounds": ["sfx"]
  }
}
```

- 只认 `actions` / `sounds` 两个字段；未知字段、非数组、重复包名直接拒绝。
- 声明了哪个包，就必须有对应 `pack.json`；没声明的目录里出现任何 `actions/`、`sounds/`
  文件都拒绝。这是“声明与实际目录一致”的硬规则。
- 不写 `assetPacks` 而目录里出现 `actions/` 或 `sounds/` 文件，也拒绝。
- 向后兼容：老扩展的 manifest 没有这个字段，安装逻辑完全不碰这两个目录。

## 4. 命名空间

| 资源 | 第一方 | 第三方 |
|---|---|---|
| 动作 handle | `dsh-piggy/<pack>/<action>` | `ext-<extension-key>/<pack>/<action>` |
| 音效 id | `<key>` / `sfx/<key>` | `ext-<extension-key>/<pack>/<sound-key>` |
| 注册表 | `dsh-piggy` | 按扩展隔离 |

- **命名空间不由 `pack.json` 提供**。`pack.json` 里出现 `namespace` 字段会被当作未知字段拒绝；
  安装器始终用 `ext-<key>` 推导。这样扩展不能冒充第一方，也不能冒充另一个扩展。
- 同一个扩展里，动作 key 跨包不能重复，音效 key 跨包不能重复。这样运行时短名解析不会歧义。
- 音效 id 加扩展前缀后，即使第三方音效叫 `tap`，也不会覆盖内置 `tap`。
- `pack.json.pack` 冒充 `dsh-piggy` 也不行：写了必须等于目录名，且 handle 仍带
  `ext-<key>` 前缀。
- 动作的 `sound` 做语法校验，可以写裸 `beep`，也可以写 `<sound-pack>/beep`；客户端注册动作时
  一律改写成 `ext-<key>/<sound>` 或 `ext-<key>/<pack>/<sound>`，只在扩展音效表里解析，
  不会误触发第一方同名音效。音效条目自己的 `fallback` 仍可写 `synth:<key>` 回退到内置 synth。
  显式动作 `fallback` 引用不能指向别的扩展 namespace；字符串 fallback 由运行时按“本扩展”
  解析。安装阶段不要求引用的目标已经存在（前向引用是合法用法）。

## 5. 上限

### 5.1 目录 / 数量

| 项 | 上限 |
|---|---|
| 扩展 key | `^[a-z0-9-]{2,24}$`（沿用现有） |
| 包名 `pack` | `^[a-z][a-z0-9-]{0,31}$` |
| 动作 / 音效 key | `^[a-z][a-z0-9-]{0,47}$` |
| 每个动作包的 `actions` | 64 条 |
| 每个音效包的 `sounds` | 64 条 |
| 动作帧数 | 2–48 帧 |
| 每个素材包文件数 | 256 |
| 每个素材包字节数 | 6 MB |
| 单个扩展全部素材包文件数 | 384 |
| 单个扩展全部素材包字节数 | 8 MB |
| 单个动作总时长 | 1–10,000 ms |
| 单个 `pack.json` | 512 KB |
| 整个扩展包（ZIP / JSON `.piggyext`） | 28 MB |

第一方动作包继续使用 `scripts/asset-packs.mjs` 的 6 MB / 256 文件预算；第三方与它同量级，
但额外限制扩展总预算，避免一个扩展塞进多个满包。

### 5.2 帧

- 文件名固定两位序号：`00.png`、`01.png`……必须从 00 连续；缺号、跳号、多文件都拒绝。
- 一个动作只能用一种格式：全 PNG 或全 WebP，不能混用。
- 单帧 ≤ 128 KB，长边 ≤ 512 px；安装器读 PNG IHDR / WebP VP8X、VP8L、VP8 头取尺寸。
- 内容必须与扩展名 magic 一致；只有扩展名对、内容不是有效图片的拒收。
- 动作必须写 `frames: { fps }` 或 `frames: { durationsMs }`；`durationMs` 必须等于帧总时长。
- 第三方动作**只支持帧序列**：`source`（引用第一方/外部图片）和 `motion`（引用第一方 CSS
  动效）都拒绝。这样素材包自包含，不会把路径指向扩展目录之外。

### 5.3 音效

- 只接受 `.ogg`（`OggS`）和 `.wav`（`RIFF…WAVE`）。
- 单文件 ≤ 30 KB；文件音效必须写 20–1500 ms 的 `durationMs`。
- 文件名必须与 key 同名：`beep` → `beep.ogg` / `beep.wav`；不允许子目录。
- 同一个 key 只能 `synth` 或 `file` 二选一；`synth` 继续使用第一方同一套参数校验，不需要文件。
- `gain` 0–1、`debounceMs` 0–2000、`priority` 0–100、`maxVoices` 1–2、`loop` 布尔值。

## 6. 路径与安全

安装器对**每一个**文件路径做以下检查（JSON 包和 ZIP 同一套）：

1. 相对路径，不能以 `/` 开头，不能有盘符，不能有 `\`、`?`、`#`、NUL。
2. 不能有空段、`.`、`..`；不能有 `//`。
3. 只允许小写 ASCII 字母、数字、`.`、`_`、`-`、`/`。因此天然不会出现大小写冲突；
   仍会再按 lower-case 做一次重复检查，挡住未来放宽命名后的回归。
4. 顶层只允许 `manifest.json`、`server.js`、`client.js`、`assets/`、`actions/`、`sounds/`。
5. `actions/`、`sounds/` 下只允许 §2 的精确形状；脚本、HTML、SVG、外链、`local.json`
   等一律拒收。
6. ZIP：拒绝符号链接（central directory external attributes）、目录项以外的空段、重复文件、
   重叠数据区、CRC 不符、解压后超限、文件名 UTF-8 不能往返的条目。
7. 从磁盘读摘要时用 `lstat`；符号链接和非普通文件只标错，不跟随。

注意：ZIP 里的空目录项会被忽略，不当作文件；真正的文件仍必须逐条通过上面的路径规则。
不提供“解压到临时目录再扫描”的路径——安装器只在内存里得到 `Map<相对路径, Buffer>`，
写盘时逐级 `mkdir` 并写普通文件。

## 7. 安装管道

### 7.1 入口

1. **在线整包**：目录条目的 `bundle` 下载 `.piggyext`（JSON）→ `parseBundle`。
2. **本地导入**：面板选 `.piggyext` JSON，或直接选手工 ZIP；宿主把 ZIP 按二进制收下 →
   `parseBundle(Buffer)`。
3. **旧式逐文件**：`entry.files` 只允许代码和 `assets/`；带 `actions/`、`sounds/` 的扩展
   必须走整包（发行版附件名不能带斜杠），旧式目录会明确拒绝，不会装出半个包。

### 7.2 校验顺序

```text
读包
  → 包总大小 ≤ 28MB
  → ZIP 结构安全（符号链接/路径/CRC/重叠/条目数）
  → 代码三件齐全、各 ≤512KB
  → 顶层路径白名单
  → manifest.json 可解析、key 合法
  → assets 名单与实际图片一一对应
  → assetPacks 声明合法、声明与实际目录一致
  → pack.json 可解析、字段白名单、pack 名等于目录名
  → 动作帧连续/同格式/magic/尺寸/字节/时长
  → 音效文件同名/magic/字节/时长、synth 参数
  → 动作 sound/fallback 语法合法；显式 fallback namespace 只能是本扩展
  → 扩展总文件数/总字节
```

任何一步失败都返回 `invalid-bundle`（本地导入）或 `download-failed`（在线安装），
`message` 里写清哪个文件、哪个字段、期望什么。**校验在换文件之前完成**，失败不会碰旧目录。

### 7.3 写盘与事务

`store/ext-install.js` 的 `place()` 再校验一次（防调用方绕过），然后：

1. 在 `extensions/.<key>-<stamp>/` 建 staging，按文件路径逐级建目录。
2. 写 `local.json`（仅非官方本地导入）。
3. 按现有流程换名：旧目录 → `.bak`，staging → 目标目录。
4. `inspect` 试加载新 `server.js`；失败回滚文件、模块和存档。
5. 成功后才删 `.bak`。

素材包和代码在同一个目录里，所以天然共享同一次换名/回滚，不需要第二套事务。

## 8. 启用 / 停用 / 卸载 / 更新 / 回滚

| 操作 | 文件 | 存档 | 素材包 |
|---|---|---|---|
| 启用 / 停用 | 不动 | `state.extensions[key]` | 文件保留；启用/停用时客户端注册或注销，列表仍显示摘要 |
| 卸载 | 整个 `extensions/<key>/` 删除 | 清 `extData[key]`、钱包结算（现有规则） | 一起删除，不残留 |
| 更新 | 整个目录换名替换 | 保留 `extData[key]` | 旧包整体消失，新包整体出现 |
| 更新失败（校验/加载/init） | 回滚旧目录 | 回滚到事务前 | 旧包原样保留 |
| 首次安装失败 | 删除 staging | 不建数据 | 不残留 |

停用不会删除素材包：用户再次启用时不需要重新下载。客户端注册/注销见 §12、§13；
本节只保证文件语义。

## 9. 存储与列举

`runtime.list(state)` 的每条扩展多一个只读字段：

```js
assetPacks: {
  actions: [
    { kind: 'actions', pack: 'wave', namespace: 'ext-my-extension',
      base: '/dsh-piggy/ext/my-extension/actions/wave/',
      entries: 2, frames: 18, files: 19, bytes: 41234, available: true }
  ],
  sounds: [
    { kind: 'sounds', pack: 'sfx', namespace: 'ext-my-extension',
      base: '/dsh-piggy/ext/my-extension/sounds/sfx/',
      entries: 3, files: 4, bytes: 5120, available: true }
  ],
  ...(读取目录出错时才有 error: '读不懂 actions/.../pack.json')
}
```

- `entries` 是动作/音效数量，`frames` 只给动作包；摘要不塞完整帧列表。
- `available` 为 false 表示这个包读不懂或没有条目；`base` 是只读静态路由的基址。
- 没有素材包的老扩展仍然是 `{ actions: [], sounds: [] }`，其它字段不变。
- 摘要从磁盘 `lstat` / 目录列举得到，不写存档、不改扩展目录。
- 扩展加载失败（`server.js` 抛错）仍然保留 manifest 和摘要，方便面板显示“扩展坏了，
  但素材包还在”。
- 客户端 `normalizeExtensions()` 只做字段归一化，不渲染；UI 卡片留到下一刀。

### 9.1 静态路由（第二刀）

```text
GET /dsh-piggy/ext/<key>/actions/<pack>/pack.json
GET /dsh-piggy/ext/<key>/actions/<pack>/<action>/<NN>.png|webp
GET /dsh-piggy/ext/<key>/sounds/<pack>/pack.json
GET /dsh-piggy/ext/<key>/sounds/<pack>/<sound>.ogg|wav
```

- 只服务已加载、manifest 声明、`pack.json` 里确实列出的文件；未声明/不存在 404，
  路径逃逸、符号链接、反斜杠等不安全路径 403，非 GET 405。
- 读取时再次检查真实路径仍在扩展目录内，并轻量核对图片/音频 magic 与大小上限。
- MIME 固定为 json/png/webp/ogg/wav；响应带内容 hash 的 `etag` 和 `cache-control: no-cache`，
  `If-None-Match` 命中时 304。
- 路由和 `extensions.js` 都不注册播放器资源；播放/生命周期由第三刀的
  `ext-actions.js` 在客户端完成，见 §12。

## 10. 打包格式

### 10.1 `.piggyext` JSON（现有格式，向后兼容）

- `version` 从 2 升到 3 表示带素材包；没有素材包时仍是 1/2，字节不变。
- 新增可选 `assetPacks: { "actions/<pack>/...": "<base64>", "sounds/<pack>/...": "<base64>" }`。
- 旧宿主不认识 `assetPacks`，但它的白名单会拒绝 `actions/` 文件，因此不会装出半包；
  发布带素材包的扩展时 `minGame` 至少写本版本。

### 10.2 ZIP（本地导入）

- ZIP 根目录直接放 `manifest.json`、`server.js`、`client.js`、`assets/`、`actions/`、`sounds/`；
  不要求外层再套一层文件夹。
- 允许空目录项但会忽略；不允许符号链接、路径逃逸、绝对路径、反斜杠、大小写冲突。
- 在线下载仍优先 `.piggyext`；ZIP 是本地导入的补充，不改变在线目录协议。

## 11. 测试

`test/unit/host/ext-asset-packs.test.js` 覆盖：

- 合法 JSON 扩展包带 actions/sounds 安装成功、摘要正确、卸载清空。
- 同一内容打包成 ZIP 安装成功。
- 未声明文件、声明缺 `pack.json`、路径逃逸、`.` 段、绝对路径、大小写、脚本/SVG 拒绝。
- 帧缺号、混格式、坏 magic、超大帧、超长边拒绝。
- 音效坏 magic、超 30KB、文件名与 key 不一致拒绝；纯 synth 可安装。
- 重复动作 key、`pack.json` 写 `namespace`、`pack` 冒充 `dsh-piggy` 拒绝。
- ZIP 路径逃逸、符号链接拒绝。
- 更新替换旧素材包、保留存档数据；代码加载失败回滚旧包；坏素材包在换文件前失败。
- 现有 `ext-runtime` / `ext-install-rollback` / `ext-import` 测试保持通过。

## 12. 客户端注册/播放入口（第三刀）

### 12.1 注册链路

挂载 `mountGame()` 时：

- 没传 `artResources` 就创建一个**可写子 registry**，父级仍是只读的
  `defaultArtResources`；传了就用调用方的可写 registry。第一方动作包始终留在父级。
- 每次 `/state` 快照重画后，从 `extensions[].assetPacks.actions` 里取
  `available === true` 且扩展处于启用/已安装状态的包。
- 只信任由 key/pack 推导出的 `base`：
  `/dsh-piggy/ext/<key>/actions/<pack>/`；摘要里的 `base` 对不上就跳过该包。
- `GET <base>pack.json`，转换成 `ArtResourcePackInput`：
  - `namespace` 固定 `ext-<extension-key>`，`pack` 沿用目录名；
  - `pack.json.actions[]` 的 `durationMs` 转成 registry 的 `duration`；
  - `frames: { fps }` 或 `{ durationsMs }`：帧数由总时长反推（fps 用累积边界取整，
    与安装器算法一致），帧路径为 `ext/<key>/actions/<pack>/<action>/<NN>.png|webp`；
  - `frames: [{ path, revision, durationMs }]`（生成器形状）：逐帧保留时长，
    相对路径补上 `ext/<key>/` 前缀；
  - `source` 单图：URL 为 `base + 文件名`，在 registry 里存成
    `{ scheme: 'ext', path: 'ext/<key>/actions/<pack>/<file>' }`；
  - 动作 `fallback` 字符串改写为本扩展同包的引用，显式 namespace 只能是本扩展；
  - 动作 `sound` 改写为 `ext-<key>/<pack>/<sound>`（裸 key 保留为
    `ext-<key>/<sound>`），由音效表解析；没注册时静音。
- 帧格式（PNG/WebP）不在 `pack.json` 里声明：客户端只探测该动作的 `00.png`，
  404 再试 `00.webp`（静态路由只接受 GET）。
- 注册用 `registerPack({ replace: true })`；更新前先 `unregisterPack(namespace, pack)`，
  保证新 `pack.json` 里删掉的动作不会残留。停用、卸载、`available: false` 都走同一条注销路径。
- 挂载销毁时移除事件监听并注销所有第三方包；正在播放的帧动作由 registry 的
  `removed` 通知结束，不会留下旧计时器。

### 12.2 播放入口（公开契约）

扩展自己的 `client.js` 派发 DOM 事件：

```js
document.dispatchEvent(new CustomEvent('dsh-piggy:action', {
  detail: { key: 'ext-my-extension/wave/hello' },
}))
```

- `detail.key` 必须是 `ext-<extension-key>/<pack>/<action>`。
- 客户端只接受 `ext-` 前缀且当前**已注册**的 handle；未知 key、第一方
  `dsh-piggy/...`、裸短名一律忽略。
- 客户端在自己的 registry 里解析 handle，再调用 `playPigAction(pig, key)`；
  动作是否真的开场仍受现有 eligibility、拖动、隐藏页、preload 就绪等规则约束。
- 桌面拆窗口时，扩展 `client.js` 在面板/大界面窗口里跑，事件经
  `PIG_FX` 的 `playAction` 转发到猪窗口播放；网页版在同一个 document 里直接播。
- 这是第三方动作唯一的公开入口；不要直接改猪窗口 DOM，也不要依赖内部函数。

### 12.3 失败隔离

- `pack.json` 404/坏 JSON/非法字段/不认识的 base/registry 冲突都只注销或跳过**该包**，
  `console.warn` 每个包每个快照签名只报一次；其它扩展和第一方动作继续工作。
- 失败记忆按包摘要签名（版本、entries/frames/files/bytes）缓存；扩展更新或包内容
  摘要变化后会自动重试。
- 第一方命名空间 `dsh-piggy` 永远在父级 registry，第三方包没有写入路径能覆盖它。

### 12.4 第三刀仍不做

1. **UI**：扩展页仍只显示摘要，没有“试播/预览”按钮。
2. **触发时机**：第三方动作只能由扩展 `client.js` 的显式事件播放；`trigger.on`
   （pet/feed/idle 等）暂不接入自动触发。
3. **单图安装**：客户端转换支持 `source` 单图，但 M3 安装器仍只收帧序列（§5.2），
   单图形状留给后续安装协议或内置包使用。

## 13. 客户端音效注册/播放（第四刀）

### 13.1 注册链路

- 每次 `/state` 快照重画后，从 `extensions[].assetPacks.sounds` 里取
  `available === true` 且扩展处于启用/已安装状态的包。
- 只信任由 key/pack 推导出的 `base`：
  `/dsh-piggy/ext/<key>/sounds/<pack>/`；摘要里的 `base` 对不上就跳过该包。
- `GET <base>pack.json`，校验后注册到 `audio-context` 的扩展音效表：
  - 对外 key 固定 `ext-<extension-key>/<pack>/<sound-key>`；
  - `synth` 条目沿用第一方的 tones/noise 参数，播放时走同一个合成器；
  - `file` 条目存绝对 URL `base + file`，首次播放先 synth 回退，解码完成后优先播文件；
  - 保留 `gain`、`debounceMs`、`fallback`；文件解码缓存按包摘要签名失效。
- 注册/更新/卸载与动作包同一条 diff 生命周期：停用、删除、`available: false` 都注销；
  更新时先注销旧包再注册新包，`pack.json` 里删掉的音效不会残留。
- 挂载销毁时注销全部第三方音效包并移除事件监听。
- 第一方 `RECIPES` / `SOUND_FILES` 永远先查；扩展只能占用 `ext-` 前缀。

### 13.2 播放入口（公开契约）

扩展自己的 `client.js` 派发 DOM 事件：

```js
document.dispatchEvent(new CustomEvent('dsh-piggy:sound', {
  detail: { key: 'ext-my-extension/sfx/beep' },
}))
```

- `detail.key` 推荐固定 `ext-<extension-key>/<pack>/<sound>`；裸 `ext-<key>/<sound>`
  只在扩展内短名唯一时可用。
- 客户端只接受当前**已注册**的 `ext-` key；未知 key、第一方 key、裸短名一律忽略。
- 桌面拆窗口时，事件经 `PIG_FX` 的 `playSound` 转发到猪窗口，用猪窗口的展示通道播放；
  网页版在同一个 document 里直接播。
- 动作 `pack.json` 里的 `sound: "sfx/beep"` 注册后变成 `ext-<key>/sfx/beep`，播放该动作时
  由现有 `c.audio.play(sound)` 自动带上，不需要额外事件。
- 是否出声仍受音效开关、音量档、每通道去重、免打扰、设备 3 声部上限约束。

### 13.3 失败隔离

- `pack.json` 404/坏 JSON/非法字段/不认识的 base 都只注销或跳过**该包**，
  `console.warn` 每个包每个快照签名只报一次；其它扩展和第一方音效继续工作。
- 文件 404、解码失败或格式不支持时，按条目 `fallback` 找本扩展 synth，再找内置
  `RECIPES`；都没有就静音，不抛异常，也不反复请求坏文件。
- 第一方音效表不被写入，扩展卸载后其 key 立即不可播放；重新启用会重新注册并恢复。

### 13.4 扩展卡片摘要与试播/试听（M3 收尾）

- 已安装扩展卡片在错误提示之后、开关之前显示只读素材包区域，不改变启用状态。
- 动作包显示 `动作包 N 个 · M 个动作 · K 帧`，音效包显示 `音效包 N 个 · M 条`；
  没有素材包、旧快照或坏字段时整块隐藏。
- 包名最多列 3 个，超出显示 `+N`；扩展停用或该组所有包 `available: false` 时显示
  `不可用`，不出现试播按钮。混合可用性时只给可用包提供按钮，不可用包名后标
  `（不可用）`。
- 试播/试听复用 `ext-runtime` 已注册的包缓存；缓存未命中时按需 `GET pack.json` 取
  第一个动作/音效 key，再派发 `dsh-piggy:action` / `dsh-piggy:sound`。失败静默，
  不弹提示，不改变开关。

## 14. 剩余（后续）

1. **自动触发**：把 `pack.json` 的 `trigger.on` 接到现有 pet/feed/idle 事件，仍只接受
   已注册的第三方动作；音效跟随动作或显式事件。
2. **UI（已完成）**：扩展卡片已显示动作/音效包摘要并支持试播/试听，见 §13.4。
3. **单图安装**：客户端转换支持 `source` 单图，但 M3 安装器仍只收帧序列（§5.2）。
4. **存档备份**：第三方扩展仍不进存档 ZIP；若以后官方扩展使用素材包，需要把
   `actions/`、`sounds/` 加入 `runtime/save-archive.js` 的文件白名单与官方哈希清单。
5. **发布链路**：`extension-entry.mjs` / `extension-bundle.mjs` 已能打包 `assetPacks`；
   带素材包的扩展是否走逐文件旧目录仍未支持（附件名不能带斜杠），发布时只发整包。

## 15. 明确不采用的方案

- **自动扫描 `actions/`、`sounds/` 目录，不要求 manifest 声明**：会安装未声明文件，无法在
  下载前判断包内容，也让“声明与实际一致”无法验证。采用显式白名单。
- **在 `pack.json` 里写 `namespace`**：第三方可以冒充第一方或别的扩展。命名空间必须由
  安装器从扩展 key 推导。
- **允许 `source: { scheme: 'path' }` 或外链**：等于把任意路径交给素材包；第三方只允许
  自包含帧序列。
- **为素材包单独做一套 ZIP 解析器**：复用 `store/zip.js`（`runtime/save-zip.js` 兼容转出）
  的路径/符号链接/CRC/重叠检查，只加 `allowDirectories` 选项，减少两套解析器漂移。
- **为每个包单独做事务**：素材包和代码同属一个扩展目录，复用现有目录换名/回滚即可。
