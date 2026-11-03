# 资源归属、每猪本体与旧存档适配（F02）

状态：本文记录 F02 的资源归属与旧单猪适配基线；后续 M2 显式 opt-in 候选的
边界和状态见第 7 节。本文不代表多猪 UI、联网或完整产品迁移已完成。

## 1. 一句话模型

```
OwnerAuthority（每位主人一个，显式生命周期）
  resources      唯一 canonical 可写家当集合
  legacyOpaque   未裁决旧扩展/未知字段，只保留一份
  format         version 等格式元数据
  onlineCursor   非持久化 owner-runtime 在线轮询水位
  targets        绑定到该主人的 PigTarget 集合

PigTarget（每只猪一个）
  body           该猪 canonical 本体/活动/装备选择；没有金币/背包/菜园副本
  state          给旧 pure core 的 live 扁平 facade（资源直接读 owner canonical）
```

旧 pure core 仍然收到一个扁平对象，但那个对象只是 facade：主人路径的读写落到
`OwnerAuthority.resources`，猪路径的读写落到 `PigTarget.body`。这不复制家当，
也不是第二个资源权威。真正的事务/回滚由 `store/owner-resources.js` 负责。

## 2. 字段归属

### 2.1 同一主人共有

| 路径 | 说明 |
|---|---|
| `coins` | 金币 |
| `wallets.*` | 所有扩展币钱包（含 farm） |
| `inventory.*` | 背包物品 |
| `dress` | 已购/共有装扮资产（不是当前穿戴选择） |
| `customSkins` | 自定义皮肤库（共有素材） |
| `dex.*` | 图鉴/收集记录 |
| `souvenirs` | 纪念品收藏 |
| `achievements` | 成就/证据/计数 |
| `daily.signIn`, `daily.online` | 签到/在线礼包；一位主人一条奖励流 |
| `extensions`, `extensionsRemoved` | 主人文档的扩展安装/可用状态 |
| `extData.farm.*` | 菜园、作物、种子、仓库、地块、成长/进度等共有家当 |
| `economy.totals`, `economy.days` | 金币账本合计/按日账本 |
| `fishing.bag`, `fishing.seq`, `fishing.autoDay`, `fishing.autoTrips`, `fishing.rod`, `fishing.spots`, `fishing.automation.*` | 鱼篓/鱼竿/钓点/自动钓鱼资产与计数 |

### 2.2 每只猪独立

`name`、`bornAt`、`hatched`、`dead`、`diedAt`、`stage`、`form`、`skin`、
`bodyWeight`、`ageMs`、`timeScale`、`ageForced`、`xp`、`weightG`、`satiety`、
`happiness`、`cleanliness`、`health`、`criticalDoctorVisits`、`worn`、`traits`、
`lessons`、`interests`、`illness`、`activity`、`outingStreak`、`restMinutes`、
`lastFedAt`、`lastActiveAt`、`lastSeenAt`、`settledUpTo`、`cooldowns`、`pending`、
`pendingSeq`、`dialogue`、`memories`、`stats`、`diary`、`pomodoro`、
`personality`、`catchphrase`、`motto`、`birthday`、`profileEdits`、
`isOfflineFeedEnabled`、`realWorkGrowth`、`seed`、`economy.fatigue`、
`fishing.pending`、`fishing.spot`。

容易混的几项：

- `economy` 混合：账本 `totals`/`days` 归主人，`fatigue` 归猪。
- `fishing` 混合：鱼篓/鱼竿/钓点解锁/自动钓鱼资产归主人；当前 `pending` 和
  当前选择的 `spot` 归猪。
- `dress` 是共有已购资产；`worn` 是每猪穿戴选择。
- `customSkins` 是共有皮肤库；`skin` 是每猪当前外观。
- `daily` 归主人，避免两只猪/两个视图各领一次日奖励。
- `timeScale`、`isOfflineFeedEnabled`、`dialogue.quiet` 是存档内的每猪偏好，
  不是设备音量/窗口设置。
- `extensions` 是主人文档的安装可用状态，不是设备设置。

### 2.3 格式与显式不透明命名空间

| 桶 | 路径 | 规则 |
|---|---|---|
| 格式 | `version` | 不属于主人或猪；不参与归属推断 |
| 旧扩展命名空间 | `extData.*` 除 `extData.farm` | 在主人文档的 legacy-opaque 桶里保留一份；绝不按猪复制；不通过 `owner.state` 冒充家当；不声称已经归主人或猪。未来由扩展 manifest 显式声明归属后再迁移 |
| 未知顶层字段 | 表里没有的旧字段（如旧 `work`） | 无损保留在 legacy-opaque；不猜测 |
| 混合容器未知子路径 | 未登记的 `economy.*` / `fishing.*` | 无损保留到对应 opaque 桶；不猜测 |

`mountLegacyTarget` 建立的旧单猪目标保留旧行为：未知命名空间可读写，且只在
owner 文档里保存一份。`attachPig` 建立的新多目标上下文不允许写未声明命名空间：
读取返回冻结的只读投影（不是可写副本），顶层/混合容器的未知键写入会抛错；嵌套
写入、`Object.assign` 全状态写和随后的回滚都不绕过此保护。声明过的 owner/body
路径（金币、`extData.farm`、`economy.totals`、`fishing.bag`、猪本体等）仍可写。
若普通 normalizer（例如 `ensureEconomy()`）把已有的未知 opacity 原样带回来，B
事务允许该**未改变**投影通过但保留 canonical legacy 值，不会把 B 的副本写回去；
新增、删除或改写未知键仍拒绝。

这份表是当前实现的唯一归属表（`store/state-ownership.js`）。`MERGE_RULES` 的
sum/max/union 仍然只是合并策略，不是归属权威，不能拿来反推“共享/每猪”。

设备音量、音效开关、窗口位置/比例、渲染/播放句柄不在该存档边界内；本切片不把
它们改成主人共享状态。

### 2.4 窄歧义

`isOfflineFeedEnabled` 看起来像设备偏好，但它直接改变猪的离线照料规则，因此
按每猪保存；没有改默认值。若产品后续要把它移到设备设置，应另做迁移/原型确认，
不能在本架构重构里顺手改。

## 3. 唯一写入/事务

`OwnerAuthority.transact(target, execute)` 是 createStore/createApi 和内部多目标
上下文共用的唯一协调写入入口：

1. 校验 target 属于该 owner、target/owner 生命周期有效。
2. 同一 owner 已有同步事务时拒绝重入。
3. target 没有 body 时返回 absent，不执行。
4. 同步 facade 后，用 `composeLegacyState(resources, target body, opaque, format)`
   做一次完整快照（不只依赖当前 facade 已出现的键），并记录 owner 在线游标。
5. 同步执行 `execute(liveFlatState)`；纯 core 照旧直接改收到的对象。
6. 拒绝 thenable、事务中变化的 target generation、已释放/已 dispose 的 owner；
   这些失败恢复快照/游标并抛错。
7. 显式业务拒绝的**唯一标记**是对象 `{ ok: false, reason: <string> }`。命中时恢复
   resources + 当前 body + 在线游标，原样返回该拒绝对象，不转成通用 error；store
   提交不结算成就、不排保存。普通 falsy、无 reason 的 `{ok:false}`、数组、布尔
   返回值不算拒绝。
8. 成功时同步未声明 facade 属性；store 的 `afterSuccess` 在同一事务里结算成就并
   排原来的一个节流保存，然后刷新 sibling views。
9. 任一异常：恢复该 owner 的 resources、当前 target body 和在线游标；其他猪 body
   和其他 owner 不变；失败事务不排保存。

因为事务同步且 owner 只有一个，两个猪的“读余额→扣余额”不会交错，不能同一份
余额各扣一次。没有每猪计时器、每视图菜园结算器、每猪保存器或隐藏资源缓存。

### 3.1 owner 在线游标

- `owner.onlineCursor` 是 owner runtime 的非持久化数字，不是存档字段、ID 或计时器；
  `daily.online` 仍是唯一持久化在线状态。
- `store/api.js:freshen` 用这个 owner 游标调用原有 `core.recordOnline()`；成功提交后
  才推进游标。A、B 交错/同一时间戳轮询只累计一次真实区间；关闭 A 不影响 B/owner。
- 失败/抛错/显式拒绝的事务恢复游标（`OwnerAuthority.transact` 快照），重试只计一次。
- 单猪首轮 `0 → now` 不计时长、超过 `pollGapMaxMs` 的 gap 忽略，与旧单猪行为一致。
- 旧 `createApplicationContext({getState,setState,now})` 的 owner 句柄有自己的
  `onlineCursor`，等价于原 `createApi` 的 `lastPollMs`；直接 `createApi` 兼容路径
  仍可独立工作。落盘格式没有新增 cursor 字段。

## 4. 生命周期

- `createOwnerResources()` 创建空权威。
- `owner.mountLegacyTarget(state)` 只用于旧单猪存档；已有 target 时拒绝，避免把
  重置/导入误当新增猪。
- `owner.attachPig({ body })` 是私有的内存多目标构造：只接收**已分类为猪本体**的
  body；携带 owner resources/format/未分类 opaque 字段会被拒绝，避免把整份旧档
  当 body 复制一份家当。通过校验后拆分/深拷贝并绑定同一 owner；不初始化/复制
  家当，不发初始金币，不调用 hatch/reset/adopt，不写第二份存档。
- `owner.replaceLegacyState(target, next)` 是 hatch/reset/adopt/import/work-ledger
  的整份旧档替换；保留当前整份存档语义，**不是**新增猪入口。
- `owner.releaseTarget(target)` 只释放 A，不销毁 owner/B；释放后从 holders 清理
  body/view/sync 引用，但保留幂等 release 与 stale handle 拒绝。A 的旧 view 失去
  可写家当别名；B/owner 继续。
- `owner.dispose()` 显式结束 owner 生命周期；清理 holders 引用并拒绝之后的操作。

## 5. 旧存档与持久化

- 磁盘仍是单份旧扁平 v15 存档；菜园仍是 farm v5。
- 读取：现有 `readStateFile` 迁移完成后，在内存里拆成 owner resources + 一只猪
  body + legacy-opaque + format。`ensureEconomy()` 在重写 economy 容器时保留未知
  own 字段（不解释、不参与规则），所以 `migrate()` 与实况 ledger normalizer 都不
  丢 `economy.*` 未知数据；known `totals`/`days`/`fatigue` 的清洗/边界/金额逻辑
  不变。没有第二次磁盘读取。
- A 的显式整容器替换 `state.economy = {...}` 或 `delete state.economy.foo` 仍是
  显式语义：未提供/删掉的未知键不会被 generic adapter 复活；只有真正被 normalizer
  原样带入的未知字段才保留。B 不能删除未知键（known-only 替换会保留现有 opaque）。
- 写入：仍由同一个 `writeStateFile` 写一份扁平 JSON；字段/值/可选/未知数据
  无损 round-trip。键顺序可能不同，语义相等是契约。
- 在 F02 默认 v15 路径中不升版本、不新增 ID/revision/文件/数据库，也不访问真实用户存档。
- 截至 F02，多猪持久化、稳定 `ownerId`/`pigId`、迁移、房间身份、命令 ID/重试/去重均延后；当时的 `attachPig` 只是私有内存构造。
- 默认 v15 路径的 `reset`/`adopt` 仍保留整份单猪存档/继承语义；不能拿它们当“再加一只猪”。M2 owner-document 路径的 body-only 行为见第 7 节。

## 6. 未收敛路径与诚实边界

- `store/ext-actions.js` 的扩展动作仍会克隆整份扁平状态再 `Object.assign` 回来；
  它现在经 `store.mutate` 进入 owner 事务，但不是按扩展逐字段的 owner/pig 设计。
- `store/ext-install.js` 的安装回滚仍会整份删除/恢复扁平 facade；同样经 owner
  事务，不做多猪持久化。
- 默认 v15 `runtime/work-ledger.js` 仍以整份状态 WAL + `installCommittedState` 提交；owner-document opt-in 使用 owner 文档事务路径，细节见第 7 节。
- `runtime/save-transfer.js`、`runtime/merge-service.js` 仍重开/替换整份旧档。
- `adapters/dsh/external-prepare.js`、`external-lifecycle.js`、
  `external-controller.js`、`external-merge.js` 仍是文件级整份状态路径，本切片
  不改；F06 收敛。
- `achievements`/`daily` 归 owner，在线轮询已有共享 owner cursor；但 `stats`
  仍是每猪。同一个 owner 的目标在 F02 只是内存夹具；M2 opt-in 候选能持久化多个
  target，但成就计数按多猪聚合还没有产品规则/真实 UI 验收，不能据此声称多猪
  成就/奖励已经完整正确。
- 多目标视图在共享资源出现**全新顶层键**时依赖事务后的 sibling refresh 或该视图
  自己的 ensureXxx 读取；没有公开多猪 UI，因此没有“所有视图实时同步新键”的产品
  承诺。
- 没有网络认证、房间权限、远端 exactly-once/去重/重放保护。未来 transport 必须
  增加已认证 owner/pig 上下文、命令 ID、版本、重试/重复规则和持久迁移。

## 7. M2 OwnerDocument opt-in 候选（2026-11-03；源码契约已接线，UI 未验）

- 只有调用者明确提供独立 `ownerDocumentPath` 才启用；首次迁移还必须明确传入
  `legacyStatePath`、`ownerId` 和 `pigId`。旧 v15 源文件按字节保持不变，默认
  DSH 与 Desktop 的 `statePath` 仍互相独立，不因同一进程或相同昵称自动合档。
- owner document 把 stable `ownerId`、多个 stable `pigId`、共享 resources、逐猪
  body、format 与 opaque 数据分开保存。调用者负责提供 ID；ID 只是数据身份，不能
  当作认证或权限。现有命令及 `/state`、`/act` 通过显式 session 绑定 target；没有
  进程全局 active-pig 槽或请求参数选猪。
- owner 模式下 reset/adopt/hatch 只替换当前猪 body并保留 owner resources 与其他
  target。工作事件的完整 before/next owner 文档、revision、target/session 和收据
  进入同一恢复流程；收据去重分区含 ownerId 与 pigId。flat archive、import/export、
  cloud endpoints 在该模式显式拒绝。
- 文件层使用 owner-document 事务、CAS revision 和短提交锁。多个进程可打开同一
  owner 文件，但写入陈旧 revision 会被拒绝并要求重新打开；没有实时跨进程同步。
- Desktop owner-document 模式暂不调用只读取旧 flat v15 `hatched` 字段的安装器
  预选导入器，避免把 owner document envelope 误认为已孵化存档。RESOURCEFLOW01
  已将可选 owner/pig 标签和实际 art registry 从 mount 传到 presentation/action player；
  扩展安装到 owner target、由运行时选择逐猪资源上下文仍未接入，默认 v15 安装器流程不变。
- 当前隔离 Node/类型契约已验证，且有一份私有 Electron 45.2.1 AppImage 完成静态回读
  （143,045,231 bytes，SHA-256 `aaf9d2c36eddbb42a8ef81362342449a52710de01dcb6bbc44c36b4b1be70d96`）；它未执行，也未接默认生产存档或做真实 UI 验收。没有正式多猪选择器、联网/房间权限、跨设备共享或声音包；相关桌面与 DSH UI 验收仍待独立执行。

## 8. 独立验收建议（开发者不执行）

F02 阶段列出的基础矩阵包含：双 target 共享金币/背包/菜园且 body 独立；A 消耗后
B 看到同一余额但 body 不变；并发/顺序扣款不超卖；throw/thenable/外来 target/
重入/absent 不半更新；显式 `{ok:false,reason}` 不部分提交且不排保存；A 释放不影响
B/owner；共享 owner 在线游标 A/B 同时间/交错只计一次、失败回滚、无持久 cursor
字段；B 不能写未声明 opaque，A legacy 仍可读写；旧 v15 与 farm v5 round-trip；
未知 economy/fishing/extData/顶层字段不丢；公共 `store.mutate` 单参数、
`installCommittedState`、保存节流、回滚/无多余写盘；然后才由后续 UI 验收验证
真实入口。M2 增加了 opt-in Node/文件事务契约；这些契约和源码检查不是 UI 通过。
