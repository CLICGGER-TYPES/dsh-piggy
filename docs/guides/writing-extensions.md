# 写一个在线扩展

菜园、矿洞、扭蛋、盲盒都是**在线扩展**：代码不在游戏包里，玩家在「设置 → 🧩 扩展」里下载安装，可以单独更新、删除。
番茄钟、钓鱼是**内置扩展**（代码在游戏里，只是能开关，见 `packages/pet-core/src/data/extensions.js`），本文不讲。

做新扩展前：**玩法、数值、价格、概率由用户拍板**。先写数值单（参考 `docs/tasks/numbers/X1-blindbox.md` ~ `X4-mine.md`）给用户确认。
设计背景见 `docs/design/extension-download.md`（下载与安全）、`docs/design/extension-achievements.md`（成就事件）。

## 目录

```text
extensions/<key>/
  manifest.json   名字、版本、最低游戏版本、App 图标
  server.js       规则：数据怎么变（在宿主进程里跑，ES module）
  client.js       面板页面（普通脚本，在面板里跑）
```

- `key`：小写字母、数字、`-`，2～24 个字，**等于文件夹名**。
- 三个文件各 ≤ 512KB（宿主拒绝更大的）。不能引别的文件，`server.js` 也不能 `import` 游戏代码——
  它只能通过下面的 `api` 碰主存档。

## manifest.json

```json
{
  "key": "farm",
  "label": "菜园",
  "emoji": "🥬",
  "version": "1.1.0",
  "minGame": "0.31.0",
  "description": "买种、开垦、浇水，作物按真实时间生长；收获后可以卖出或放进背包。",
  "app": { "emoji": "🥬", "label": "菜园" }
}
```

- `version`：semver。**改了三个文件里的任何一个都要升版本**（测试会拦：目录里的校验值和文件对不上）。
- `minGame`：用到的宿主能力从哪个游戏版本起有，就写那个版本（例如用了 `api.emit` 写 `0.32.0` 以上）；拿不准写当前版本。
  游戏版本低于它时安装会提示「要先把游戏更新到 vX」。
- `app`：主菜单上的 App 图标（**一律用 emoji**，见 [ui-style.md](ui-style.md)）。

## server.js

```js
// @ts-check
export default {
  eventVersion: 1,                 // 用了 api.emit 就声明（见「成就事件」）
  init() { return { plots: [] } }, // 安装时的初始数据
  actions: {
    plant(data, payload, api) {    // 玩家点了什么就是一个动作
      if (!api.spend(10)) return { ok: false, reason: 'poor' }
      data.plots.push({ crop: payload.crop, at: api.now })
      return { ok: true }
    },
  },
  view(data, api) { return { plots: data.plots, coins: api.coins() } }, // 给面板画的数据
  progress(data) { return [] },     // 可选：从旧数据补录成就进度
}
```

### 动作的规矩（违反了不会马上报错，但会出数据问题）

1. **原地改 `data`**（宿主给的是事务副本里你那份数据）。返回新对象没用，宿主不会采用返回值里的数据。
   这是扩展里唯一允许「改入参」的地方（项目通用规范是纯函数，这里是例外）。
2. **同步**：不许 `async`、不许返回 Promise（宿主会拒绝并回滚）。
3. 时间用 **`api.now`**，不要 `Date.now()`；随机数可以用 `Math.random()`，但最好像扭蛋那样做成可注入的参数方便测试。
4. **拒绝返回 `{ ok: false, reason }`**，不抛异常。返回 `ok:false` 或抛错时，这次动作里对金币、背包、`data`、说的话、事件的改动**全部回滚**。
5. `payload` 来自页面，**当不可信输入校验**（是不是整数、在不在范围里）。
6. 金币、背包只能经 `api` 动，不能直接改主存档。

### api

| 方法 | 作用 | 限制 |
|---|---|---|
| `api.now` | 当前时间（毫秒） | — |
| `api.coins()` | 玩家现在有多少金币 | — |
| `api.spend(n)` | 扣钱，钱不够返回 `false` 且不扣 | n 取整，负数视为失败 |
| `api.earn(n)` | 给钱 | 单次最多 100000 |
| `api.give(itemKey, n)` | 往背包放游戏里已有的物品（商店物品或盲盒券） | 单次 1～99；不认识的物品返回 `false` |
| `api.count(itemKey)` | 背包里某物品有几个 | — |
| `api.take(itemKey, n)` | 从背包拿走，不够返回 `false` 且不拿 | — |
| `api.say(text)` | 让猪说一句 | 最多 80 个字（照猪台词的文风，见 [adding-lines.md](adding-lines.md)） |
| `api.emit(name, payload)` | 报一个成就进度事件 | 见下节；`view` 里调用永远返回 `false` |
| `api.eventVersion` | 宿主支持的事件协议版本（现在是 1） | 旧宿主没有 `emit`，用前先判断 `typeof api.emit === 'function'` |

### reason（拒绝原因）

面板会把 `reason` 翻成一句话冒在猪头上（`src/client/io.js` 的 `reasons` 表）。**优先用已有的**：
`poor`（钱不够）、`unknown`、`unavailable`、`locked`、`no-ticket`、`no-shards`、`no-certs`、`empty`、`owned`……
表里没有的会显示「这个操作没成」。确实需要新原因，在 `io.js` 的表里加一条中文（这是游戏包改动，要随游戏版本发）。

### view

`view(data, api)` 返回面板要画的数据（只读副本，改了也不存）。两个可选的约定字段会被宿主拿去别处显示：

- `shelf`：商店里的一个货架 `{ key, label, emoji, color, currency, items: [{ key, emoji, label, note, price, disabled, pick }] }`
- `dex`：图鉴里的一个分区 `{ key, label, emoji, color, entries: [{ key, emoji, label, stars, blurb, potential, acquired }] }`

照抄 `extensions/farm/server.js` 的写法最稳。

### 成就事件（可选）

想让扩展有成就：

1. 在 `packages/pet-core/src/data/extension-events.js` 登记事件名和字段（这是游戏包改动）。
2. 扩展里成功的动作末尾 `api.emit('<事件>', { total | items | maximum })`：`total` 报**累计值**不是增量，`items` 报 key 数组（宿主取并集）。
3. 模块声明 `eventVersion: 1`；有旧数据的扩展再写 `progress(data)` 补录。
4. 成就本身照 [adding-achievements.md](adding-achievements.md) 加。

细节（幂等、事务、上限）见 `docs/design/extension-achievements.md`。

## client.js

普通脚本（不是 module），用 IIFE 包起来，加载后注册：

```js
;(function () {
  'use strict'
  window.dshPiggyExtensions.register('farm', {
    render(app) {
      // app.content：往里画；app.data：view() 的返回值（还没到时是 null）
      // app.send(op, payload)：调自己的动作；app.rerender()：只改了页面里的临时状态时重画
      // app.el(tag, className, text)、app.button(className, attrs, onClick)：和面板同一套小工具
      // app.openDex(section)：跳到图鉴里自己的分区
    },
  })
})()
```

- 样式写在自己的 `<style id="dsh-piggy-<key>-style">` 里，类名用自己的前缀（菜园用 `fm-`），**颜色、圆角、边框一律用面板的 `--ac-*` 变量**并给兜底值，
  按钮用面板现成的 `dp-btn` / `dp-mini`，别自己造按钮样式。规则见 [ui-style.md](ui-style.md)。
- 面板要简洁：不放大段说明文字、不加刻度条之类的装饰（用户明确要求过）。
- 出错只影响自己的页面（宿主会接住异常显示「这个扩展出错了」）。

## 本地测试

- **规则**：写 `test/<key>.test.js`，直接 `import` 扩展的 `server.js`，用假 `api` 调动作（照 `test/farm.test.js`）。数值单里的数字写成断言。
- **页面**：`test/farm.test.js` 后半有用 `fakeDom` 跑 `client.js` 的例子。
- **整条链路**（下载、校验、安装、事务）：照 `test/helpers/extension-achievements.js`，用 `createExtRuntime` + 假 `fetch` + `registryUrl`。
- **真机看界面**：桌面版的扩展装在存档旁边的 `extensions/<key>/`，可以把文件拷进去替换后重启看效果（存档里要已经装过这个扩展）。
- `npm test` 里的 `test/extensions-registry.test.js` 会检查文件齐全、manifest 合规、目录条目和文件一致、动作都是函数。

## 发版

见 [HANDOFF.md 9.3](../HANDOFF.md)：升 `manifest.json` 版本 → `node scripts/extension-entry.mjs <key>`（和 `--host gitee`）更新两份目录 →
GitHub 发**预发布、不设 latest** 的 `ext-<key>-<版本>`、Gitee 用 `scripts/gitee-release.mjs` 上传 → 提交目录、推 main → 用全新存档在线装一次验证。
