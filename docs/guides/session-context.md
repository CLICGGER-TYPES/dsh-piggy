# 会话边界：运行时、外部控制器与未来传输契约（F06）

状态：F06 会话边界已实现；LANTRANSPORT01 在独立候选增加显式配对的私有 LAN owner session 服务，尚未合并或做产品 UI/跨设备验收。本文保留 loopback/OwnerDocument 边界并区分当前 LAN 候选与仍未实现的公网责任；它不把公网、房间、稳定网络身份或完整联机写成已完成。

2026-11-05 补充：桌面版的「联机房间」是独立的内存中继（`apps/desktop/lib/room-server.js`），只同步每位玩家自己的外观摘要、位置和表情；它不打开 owner session、不共享 owner 文档、不改变本文的会话边界。房间协议、发现和窗口见 [desktop-architecture.md](desktop-architecture.md) 与 [room-multiplayer.md](../design/room-multiplayer.md)。

## 1. 为什么要有这一层

F02 已经建立“同一主人共用资源、每只猪本体独立”的写入权威，F03/F05 已经把
表现和音频绑定到显式的视图实例。但宿主入口此前仍靠隐式的“这个进程里唯一的
运行时/外部控制器”来表达归属：工作事件直接进当前运行时，外部暂停存档直接
按路径改写，提交/恢复只按配置字段推进。

当前产品只有一个本地猪，这样做能跑；但未来要支持本地多猪和每位玩家带猪联机，
必须先把“这次操作属于哪个宿主实例、哪位主人、哪只猪、哪份冻结存档、哪一代
运行时”写成显式能力。F06 只建立这个边界，不实现第二只猪、房间、服务器或
网络协议。

## 2. 当前真实数据流

```
DSH 宿主回调 ──> work-observer ──> embedded runtime.acceptWorkEvent(event, session)
                              └──> external controller.enqueue ──> outbox ──> 桌面 work endpoint
DSH 斜杠命令 ──> embedded runtime.dispatchCommand(verb, input, session)
              └─> external panel.command ──> 桌面 /pair/command ──> runtime.dispatchCommand
DSH 面板路由 ──> embedded runtime.handle(/dsh-piggy/state|act|...) ──> src/host/routes.js ──> store
              └─> external panel proxy ──> 桌面 /pair/state|act ──> runtime.handle
合并 ──> DSH external prepare(activity|pomodoro|fishing)
       ├─ 运行中：embedded runtime.prepareMerge(target, session) ──> owner 事务
       └─ 已暂停：external-prepare 校验会话/配置/冻结指纹后写单目标旧档
       ──> pair /pair/merge/preview ──> merge-service（runtimeId + epoch）
       ──> pair /pair/merge/commit ──> 桌面合并事务 ──> DSH retireEmbedded
```

关键点：

- 每个 `createGameRuntime` 只打开一份存档（`runtime/owner-lock.js`），持有一个
  store、一个 `ApplicationContext`、一个命令上下文和一个工作台账；
- store 仍是唯一玩法写入权威：`OwnerAuthority.transact` 同步提交/回滚共享资源
  和目标猪 body（见 [资源归属](resource-ownership.md)）；
- 外部控制器没有资源权威，只有“本机 loopback 配对目标 + 已暂存源文件”的
  精确能力；
- 桌面配对接口仍是 `127.0.0.1` + 独立令牌 + `clientId/requestId` 去重；
- 进程能力、loopback 令牌、昵称、文件路径、`runtimeId` 都不是网络身份。

## 3. 契约对象

实现位于 `runtime/session-context.js`。

### 3.1 SessionBinding

`createSessionBinding({ scope, transport, application?, commands?, capability?, runtimeId?, generation? })`
返回一个冻结的进程内能力：

| 字段 | 含义 |
|---|---|
| `kind: 'session-binding'` | 判别字段；伪造的 `{owner,target}` 对象不算 |
| `id` | 临时 SessionId（随机），不持久化 |
| `scope` | `host-runtime` 或 `external-controller` |
| `transport` | `{kind, origin}`；当前候选支持 `embedded` / `loopback-pair` / 经邀请认证创建的 `lan` session |
| `application` | 真实 owner/target 应用上下文；外部控制器为 null |
| `commands` | 与 application 同一 store 的命令边界 |
| `owner` / `target` / `commandScope` | 由 application/commands 直接派生的句柄 |
| `runtimeId` | 临时 RuntimeId；运行时每次重开更新 |
| `generation` | 处置代数；重开/释放后旧会话拒绝 |
| `assertLive()` | 已处置时抛 `SessionBoundaryError(session-disposed)` |
| `assertApplication()` | 没有真实 owner/target 或 application 已失效时拒绝 |
| `dispose()` | 幂等处置；只影响这个会话 |

`sessionOf(runtime)` 通过 `WeakMap` 按运行时对象取当前绑定；`bindRuntimeSession`
只由运行时在 `open()` 时登记。没有全局“最后一头猪/最后一个文件”槽位。

`assertLiveSession(binding, expected)` 在真正读写前校验：已处置、`runtimeId`、
处置代数、application、owner、target、命令作用域。缺目标不会回退到任意一只
活着的猪。

会话身份和 disposed 标志还不够：F02 的 target 可以被 `releaseTarget`，owner 可以
被 `dispose`，此时会话对象仍然“已发放且未处置”。`assertApplicationUsable(application)`
因此在 ledger.receive/WAL/资源/body/存档之前使用 F02 权威能力检查：

- `target.present === true`：live body，直接通过；
- 否则用 `OwnerAuthority.transact` 做无副作用探测；live 空档返回 `absent`，
  已 release 的 target / 已 dispose 的 owner 由权威层抛错；
- 抛错统一转成 `SessionBoundaryError(session-target-unusable)`，不复制资源、
  不重建 target、不新增影子 disposed 状态。

`acceptWorkEvent`、`dispatchCommand`、`snapshotForWrite`、`prepareMerge` 的
显式绑定和省略绑定的正常同进程入口都走同一个 `selectSession` 检查，所以
拒绝发生在台账/WAL/例行 prepare/flush 之前，而不是晚到
`store.installCommittedState` 才失败。capability-only（没有 host application）
的绑定不能冒充宿主猪。

### 3.2 FrozenSourceBinding

`createFrozenSourceBinding({ session, statePath, stateHash, suspendedAt, mergeId })`
代表“已暂停、没有打开运行时”的源端文件能力。`assertMatches({statePath,fingerprint})`
要求路径和 `stateFingerprint(state, receipts)` 都与冻结时一致；没有指纹的旧配置
不能冒充已冻结。

外部终结（activity/pomodoro/fishing）在写文件前必须同时满足：

1. 控制器会话仍活着；
2. 磁盘上的 `external-pet.json` 仍是同一 `clientId`、`paused`、同一
   `suspendedAt`/`mergeId`；
3. 文件指纹等于冻结指纹；
4. 显式持久化能力仍是 `legacy-flat-single-target`（或暂停文件没有非 legacy 能力）；不按字段名推断多目标。

任何一项不满足都以现有风格的 `{ok:false, reason}` 拒绝，不覆盖别的会话、导入
或手改的存档。

### 3.3 命令/事件/快照/回执

当前本地接口的 payload 保持不变；边界对象只是调用方必须携带的上下文：

| 方向 | 当前形状 | 会话要求 |
|---|---|---|
| 工作事件 | `{version:1, source, id, type, at}` | `acceptWorkEvent(event, binding)`；运行时在台账前校验绑定 |
| 斜杠命令 | `dispatchCommand(verb, input, binding)` | 校验绑定后才读状态/派发 |
| 快照 | `snapshot(store)` / `/pair/state` | 由运行时/控制器实例自身绑定，不跨实例 |
| 回执 | `{ok:true, status:'applied'|'duplicate', disposition}` | 见下表，不新增字段 |

回执语义（沿用现有 API，不伪造更强承诺）：

| 实际结果 | 含义 | 是否重复发奖 |
|---|---|---|
| `applied` + `disposition:'applied'` | 事件被接受并完成 | 否（首次） |
| `applied` + `disposition:'ignored'` | 事件被接受但没有可结算的猪 | 否 |
| `duplicate` | 同 `source+id` 已处理，重放 | 否 |
| HTTP 409 / id conflict | 拒绝（同一 ID 类型/时间不一致或外来目标） | 否 |
| HTTP 422 | 超出收据窗口，适配器丢弃并计数 | 否 |

没有命令 ID、持久 revision、跨进程 exactly-once 或网络认证；崩溃/重启后的
“最多一次”依赖现有工作台账 WAL + 收据，而不是新计数器。

## 4. 生命周期

- **运行时打开**：新 `generation`/`runtimeId`/SessionId；旧绑定 dispose。
- **运行时重开**（导入、合并提交、回滚）：旧绑定 dispose，新 store/application、
  新命令作用域、新台账句柄；旧句柄的调用被 `save replaced`/`closed` 拒绝。
- **插件卸载**：dispose observer、关闭控制器、处置外部会话、dispose 运行时。
- **外部连接**：冻结内嵌运行时，配置写 `paused` + `stateHash`；工作事件进
  outbox；面板/命令代理桌面猪。
- **外部合并预览**：冻结源端、创建源端备份、配置写 `mergeId/previewToken`；
  预览只属于创建它的控制器会话（`preview.sessionId`）。已暂停源端在预览前
  也核对冻结指纹，手改/导入过的文件不会被当成这份源猪。
- **提交/回滚/恢复**：提交前再次校验会话；成功后退役内嵌存档；失败/拒绝恢复
  源端；最近一次合并可撤销。
- **目标合并未终态（崩溃/未知）**：配置可能是 `pigState=paused` +
  `connection=merging`（重启后没有内存 preview）。此时只允许读状态和查询原
  事务；`disconnect`、源端/目标端 `prepare`、`previewMerge`、`restoreEmbedded`
  都返回现有形状的 `{ok:false, reason:'busy'}`，不会恢复/清理源端、开始新预览
  或覆盖存档。`pollMergeStatus` 继续按合并 id 只读查询，直到 committed /
  failed / rolled-back / timeout 终态。
- **外部断开**：队列非空需要明确丢弃；源端指纹变化需要确认；切回内嵌后从
  暂停时刻继续。
- **迟到投递**：POST 返回时控制器已关闭，则不改队列（事件留给下一个活着的
  进程重投；目标台账按 `source+id` 去重）。关闭后的面板代理不再发网络请求、
  不再改摘要，只返回现有形状的拒绝。

同一份存档目前只有一份 `.work-outbox.json`；本切片不保证同一路径上并发运行
多个 DSH 外部控制器时的队列隔离。`close()` 只处置自己的会话、不删除队列文件；
`disconnect` 是同一会话用户的明确清理。未来联机需要按会话/房间持久化队列。

## 5. 持久化范围

截至 F06 的已实现能力：

- 一位主人的一份扁平 v15/farmv5 `state.json`；
- 由该文档适配出一只 legacy 猪（F02 owner resources + body）；
- 整份导出/导入/预览/合并/撤销/恢复（旧语义）；
- 本机 loopback 配对/工作接口，一个 DSH 外部控制器对应一份存档。

明确不支持，并在会写入的地方拒绝或只声明责任：

- 一份存档持久化多只猪的 body；
- 每猪独立存档/资源副本；
- 在没有显式多目标能力/schema marker 的情况下把整份存档当成多目标来合并/恢复；
- 把“切回/恢复”当成添加猪、加入房间或去重；
- 已合入产品仍没有 LAN/公网 listener 或连接 UI；独立 LAN 候选见 §6。公网服务器与身份、房间、跨进程持久 revision、素材命名空间仍未实现；
- 把进程能力、loopback token、昵称、路径、`runtimeId` 当网络身份。

`persistenceIssue(authority)` 只读取真实 store/控制器显式声明的持久化能力：
当前只有 `legacy-flat-single-target`。它**不**按存档里的 `pigs`、`pigBodies`、
`pigTargets` 或类似名字推断多目标，也不把这些名字当保留字；未知旧字段仍由迁移
和 owner legacy-opaque 原样保留。未来多目标格式必须带显式 schema marker/能力
声明，届时由这里拒绝全平持久化，而不是覆盖/复制整份别的猪存档。

## 6. 当前私有 LAN 候选与公网未实现项

`runtime/owner-lan-server.js` 在明确调用后创建一个 OwnerDocument session listener。默认绑定 `127.0.0.1`；显式绑定只接受具体 RFC1918/link-local 私有 IPv4，拒绝 `0.0.0.0` 与公网地址。发现文件不包含邀请/token。面板通过 panel-only IPC 生成一次性邀请，邀请绑定服务器确认过的 owner/pig roster 目标；配对后服务器创建 `kind:'lan'` binding，并将随机 bearer token 映射到该 binding。单个 listener 只服务一份 OwnerDocument，客户端不能带入另一位用户的 owner 档。后续状态/命令/动作不接受 `pigId`/`ownerId`，每个连接只读写绑定猪，共有资源仍经同一 OwnerAuthority。

请求限长、Origin 被拒绝、Host 必须精确匹配、邀请一次性/限时/限速。命令/动作有白名单；每 session 的序号/requestId 在本进程内去重，重连可读取 nextSequence 并重试相同请求。关闭 listener 会处置全部 session/token/内存回执；进程重启需重新配对。这只是进程内重放保护，不是崩溃后 exactly-once。

LAN HTTP 本身不加密，因此候选只适用于用户信任的私有网络，不能称为公网/Internet 传输。尚未实现：一台用户连接并携带自己的独立 owner/pig 档、跨 owner 会话、正式邀请/连接 UI、公网 TLS/加密身份、持久 room/member 权限、跨进程 durable revision/receipts、服务端/客户端重启后的持续身份与重连、DSH 实际外部客户端接线、房间发现/中继/多猪并行 UI。当前 Node 双客户端合同是本机 loopback socket 验证，不是跨设备真实 UI 验收。

## 7. 兼容与保留

- `createStore` 的公共方法名、参数、返回形状、拒绝原因不变；内部组合
  （`application`/`commands`）通过非枚举 symbol 暴露给运行时，不是新公共方法。
- `createStore`/`createGameRuntime`/`createExternalController` 的调用方式不变。
- 存档仍是 schema 15、farm 5，没有新增字段、版本、迁移、`petId`/`ownerId` 或
  默认资源。
- 桌面 IPC、渲染、设置流程、`/pair/*` 协议、插件 loopback 端点、导入/合并/
  归档失败行为不变。
- F02 资源/事务、F03 绑定表现、F04 资源命名、F05 音频通道字节不变。

## 8. 仍未做

- 本机多猪产品入口、`pigId`/`ownerId` 持久化、存档迁移；
- 产品 UI / 真实跨设备验收、房间及公网/端到端加密、跨进程持久认证；
- 新 UI 布局/流程/选择器；
- 产品单元/契约/UI 测试与构建（由 D01/V06 统一处理）；
- helper 75% XP、开关、lazy/rest、美术、巡逻（继续延后）。

开发者只写源码与作者测试；`test/integration/session-context.test.js` 在本交接中未执行，
独立 V06/PI-08 应在冻结候选上运行并另设计关键用例。
