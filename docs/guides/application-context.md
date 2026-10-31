# 应用上下文：目标猪、资源主人与命令边界（F02）

状态：F02 源码实现，未打包、未独立验收。本文说明现有单猪 store 如何接入真实的
owner 资源权威、每猪 body 和旧扁平存档适配；它不把文件分开、接口存在或私有内存
target 当成多猪/联机功能已经完成。

## 1. 为什么要有这一层

当前磁盘存档是一个扁平对象：`name`、`xp`、`satiety` 和 `coins`、`wallets`、
`inventory`、`extData.farm`、`economy` 放在同一份 `state.json` 里。用户已确认：

- 同一主人的多只猪共用金币、各币种钱包、背包、菜园和共有家当；
- 每只猪保留自己的名字、成长、身体、当前活动和穿戴选择；
- 不同主人不自动共池。

如果每只猪直接开一个旧 `createStore`，每个 store 都会持有可写的金币/背包/菜园
副本，可能重复结算或超卖。F02 因此建立 `OwnerAuthority`：一位主人一份 canonical
家当；每只猪只有自己的 body；旧 flat state 只是给 pure core 的适配 facade。

详细字段表和事务/持久化契约见 `docs/guides/resource-ownership.md`。

## 2. 现有消费者

| 位置 | 作用 | F02 后 |
|---|---|---|
| `store.js:createStore` | 打开一份旧 v15 存档，建立 owner 权威 + 一个 legacy target，持有 live facade、节流保存、flush/dispose、installCommittedState | 走 `createOwnerResources` + `mountLegacyTarget`；一个 owner 事务提交 resources+body；仍只有一个保存计时器/文件 |
| `store/api.js` | 喂食/洗澡/玩耍、工作/学习/旅行、购买/使用、钓鱼、扩展开关、改名、hatch/reset/adopt 等 | 命令方法经 `commands.runFor` -> `store.mutate` -> owner 事务；feed/freshen/rename/drainPending 也进入同一事务；hatch/reset/adopt 走 owner 整份替换后事务结算 |
| `store/target-context.js` | 显式 owner/target/scope、注入时钟、replaceState、assertScope | 新入口直接持有 OwnerAuthority/PigTarget；旧 `{getState,setState,now}` 入口保留给直接 createApi |
| `store/command-context.js` | `runFor`/`readFor`、scope 校验 | 仍只把显式 scope 命令送进 commit；commit 现在是 owner 事务；内部 execute 仍收到 `(state, commandScope)` |
| `snapshot.js` | 面板轮询读快照，内部调用 `store.freshen()` | 仍走同一 `store.freshen()`；读结算在一个 owner 事务里完成 |
| `runtime/index.js` | 包装 store 方法、epoch、exclusive、重开运行时 | 公共方法名/返回不变；重开重建 store+owner 上下文 |
| `store/ext-actions.js`、`ext-load.js`、`ext-install.js` | 扩展动作/安装通过 `store.mutate`；扩展仍整份克隆/恢复 | 公共 `mutate` 仍单参数；整份克隆进入 owner 事务。扩展逐字段归属仍是 F06 |
| `runtime/work-ledger.js` | 工作事件 WAL 直接计算并 `installCommittedState` | 文件/WAL 事务不变；安装整份状态经 owner replace，不新增第二写入器 |
| `runtime/save-transfer.js`、`runtime/merge-service.js`、`core/merge.js` | 导入/合并整份存档 | 仍整份重开/替换；多猪资源归属/迁移延后 |
| `src/client/sound.js`、桌面窗口设置 | 设备混音/窗口位置/显示偏好 | 属于设备/视图，不在 owner 存档同步范围 |

## 3. 上下文对象

### 3.1 新入口（createStore / owner 权威）

`createOwnerResources()` 返回 `OwnerAuthority`：

- `owner.state` 只暴露 canonical shared-resource 集合（金币、钱包、背包、共有收藏、
  菜园、账本合计/日账、钓鱼资产、扩展开关等），不是整只猪；未裁决的 `extData`
  扩展键在 owner legacy-opaque 桶里，不在 `owner.state` 里冒充家当；
- `owner.transact(target, fn)` 是同一 owner 的同步事务；成功提交、失败恢复
  resources + 当前 body + 非持久在线游标；显式 `{ok:false,reason:<string>}` 也
  原样返回拒绝结果但恢复两个部分；
- `owner.onlineCursor` 是 owner-runtime 非持久轮询水位；A/B 交错轮询只累计一次，
  不写入存档；
- `owner.mountLegacyTarget(state)` 只用于旧单猪存档；已有 target 时拒绝；
- `owner.attachPig({ body })` 是私有内存多目标构造，只接收已分类的猪 body，
  携带 owner resources/format/opaque 会拒绝；它只加 body，不复制/初始化家当；
- `owner.replaceLegacyState(target, next)` 是 hatch/reset/adopt/import/work-ledger
  的整份旧档替换，不是新增猪流程；
- `owner.releaseTarget(target)` 只释放该猪并清理 body/view/sync 引用，不销毁
  owner/B；`owner.dispose()` 显式结束 owner 并清理 holders。

`PigTarget`：

- `target.body` 是每猪 canonical 本体（名字、成长、身体、当前活动、cooldowns、
  worn/skin 选择、`economy.fatigue`、`fishing.pending/spot` 等）；不含 shared
  coins/inventory/farm；
- `target.state` 是旧 pure core 用的 live flat facade。主人路径直接读写 owner
  canonical，猪路径直接读写 target.body；
- 旧 `mountLegacyTarget` 目标保留未知命名空间读写；`attachPig` 新目标的未知
  opaque 只读（冻结投影），写入/顶层新未知键/`Object.assign` 会被拒绝，避免 B
  改到 A 的未声明扩展数据；normalizer 原样带回的已有未知 economy 字段可通过，
  但 B 不得新增/删除/改写它们；
- `target.present` 表示该 target 当前是否有 body；
- `target.release()` 只释放自己。

`createApplicationContext({ owner, target, now })` 建立：

- `context.owner` 是 OwnerAuthority；`context.target` 是 PigTarget；
- `context.state` 读 `target.state`（live facade）；
- `context.replaceState(next)` 调用 `owner.replaceLegacyState(target, next)`；
- `context.scope = { kind: 'application-scope', owner, target }`，冻结；
- `assertScope` 同时校验 `kind`、owner/target 句柄和 `target.owner` 绑定。缺少
  discriminator、来自另一 owner/猪、或外部伪造对象都直接抛错，不会“只剩一只猪
  就用它”回退。句柄按进程内引用识别，不是持久 ownerId/pigId。

### 3.2 旧入口（直接 createApi 兼容）

`createApplicationContext({ getState, setState, now })` 保留 F01 的旧单扁平状态
边界：`owner.state === target.state === context.state` 指向同一个 live 根对象。
它只用于直接 `createApi(control)` 的兼容测试/宿主，不是 createStore 的资源权威。
两套入口不能混用：显式 owner/target 和旧 getState/setState 同时出现会 TypeError。

## 4. 命令与事务

`createCommandContext({ context, commit })`：

- `scope` 和 `now` 暴露给方法表；`runFor(scope, execute)` 先校验显式 scope，再
  把命令送进 commit。createStore 的 commit 是 owner 同步事务：改共享资源和改目标
  猪 body 一致提交/回滚。
- 内部 `execute` 仍收到 `(state, commandScope)` 两个参数；公共 `store.mutate(fn)`
  和旧 `createApi` 回调仍只收到一个 live flat state 参数。
- `readFor(scope)` 校验 scope 后返回 live facade 或 `null`；不读旧副本。
- commit 支持内部 `saveWhen(result)`，用于保持“无效改名/空 pending 队列不排保存”
  的基线行为。它不是公共 API。
- 显式业务拒绝标记是对象 `{ok:false, reason:<string>}`；owner 事务恢复资源和
  target body，store 不结算成就、不排保存、原样返回拒绝；其他 falsy/无 reason
  返回仍是成功路径。
- 没有异步队列、命令 ID、持久 revision、锁文件或网络认证；“同一主人同步操作不
  交错”只在本进程内成立，不是远端 exactly-once。

## 5. 保留的兼容项

- 公共方法名、参数、返回形状、拒绝原因、`null`/absent 行为保持不变。
- `createStore` 调用方式不变；直接 `createApi(control)` 的旧调用仍接受
  `now/getState/setState/mutate`。
- 注入时钟调用顺序不变：core 命令内的 `now()` 仍先于提交后的成就结算 `now()`。
- 公共 `store.mutate(fn)` 回调仍只收到一个 live 扁平参数；`commands.runFor` 的
  内部 execute 第二参数不泄漏。
- `mutate` 仍是“快照、执行、成功结算成就并排保存、抛错恢复并记录”；失败不排
  保存。现在恢复的是 owner resources + 当前 body。
- `hatch`/`reset`/`adopt`/`dev`/`rename`/`drainPending`/`freshen` 的公开返回和
  保存时机保持基线；`hatch`/`reset`/`adopt` 通过 owner replaceState 替换整份
  旧档，再事务结算成就。
- `flush`/`dispose` 仍只停一个计时器、写同一份存档；`installCommittedState`
  仍不重新结算、不排保存，并保留传入对象的身份。
- 存档版本仍 schema 15、farm 5；没有新增字段、迁移、`petId`/`ownerId`、默认资源
  或初始金币逻辑。
- 桌面 IPC、`routes.js`、`snapshot.js`、`client.js`、扩展协议、`packages/pet-core`
  规则和素材均未改动；本指南只随源码树发布。

## 6. 未实现/未收敛项

1. 物理多猪持久化格式、稳定 `ownerId`/`pigId`、自动迁移、重复导入幂等。
2. 公开多猪 selector/UI/每猪窗口、房间/会话/联机入口。
3. 扩展逐字段 owner/pig/device/room 归属；当前只把未裁决 extData 保留为不透明。
4. 工作事件 WAL、扩展安装/动作、合并/导入、DSH external adapter 的多猪语义。
5. 远端认证、命令 ID、版本/重试/重复回执、持久去重。
6. 设备设置与多视图在线时长/奖励的协调；当前 daily 仍归 owner，但没有产品多猪
   视图入口。
7. 菜园/工作收益按猪数重复结算：架构上共享资源只有一个权威，但真实多猪 UI、
   farm 结算器和联机尚未验收。

F02 只证明“源码边界/事务/旧档适配已实现”，不证明 UI、多猪产品、联机或独立验收。
