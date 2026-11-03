// @ts-check
/**
 * 会话边界：把“这次命令/工作事件/合并属于哪个宿主实例、哪位主人、哪只猪、
 * 哪一份冻结存档”写成显式能力，而不是靠“当前猪/当前文件”的模块级槽位。
 *
 * 本模块只做身份、生命周期和拒绝原因，不实现网络、认证、房间或持久 ID：
 * - SessionId/RuntimeId 是进程内临时能力，不写存档、不当跨设备身份；
 * - OwnerId/PigId/RoomId 是未来稳定身份的保留名字，本切片没有实现；
 * - embedded / loopback-pair 是当前产品 transport；LAN 绑定只由显式 owner session
 *   server 在配对认证后发放；public-server 仍未实现。
 *
 * @module dsh-piggy/runtime/session-context
 */
import { randomUUID } from 'node:crypto'

/**
 * @typedef {import('../store/target-context.js').ApplicationContext} ApplicationContext
 * @typedef {import('../store/command-context.js').CommandContext} CommandContext
 */

/**
 * 会话属于哪一种组合。host-runtime 持有真实 owner/target；external-controller
 * 只有暂停/合并源文件的精确能力，不含资源权威。
 */
export const SESSION_SCOPE = Object.freeze({
  HOST_RUNTIME: 'host-runtime',
  EXTERNAL_CONTROLLER: 'external-controller',
})

/**
 * LAN 仅是已经配对的本地 owner-session transport 标签；它自身不验证认证。
 * public-server 仍拒绝，不能由数据身份或任意网络请求构造。
 */
export const SESSION_TRANSPORT = Object.freeze({
  EMBEDDED: 'embedded',
  LOOPBACK_PAIR: 'loopback-pair',
  LAN: 'lan',
  PUBLIC_SERVER: 'public-server',
})

/** @type {readonly string[]} */
const TRANSPORT_KINDS = Object.freeze([
  SESSION_TRANSPORT.EMBEDDED, SESSION_TRANSPORT.LOOPBACK_PAIR, SESSION_TRANSPORT.LAN, SESSION_TRANSPORT.PUBLIC_SERVER,
])
/** @type {Set<string>} */
const UNSUPPORTED_TRANSPORTS = new Set([SESSION_TRANSPORT.PUBLIC_SERVER])

/** 拒绝原因。沿用现有适配器的字符串 reason 风格，方便局部返回而不是抛错。 */
export const SESSION_BOUNDARY = Object.freeze({
  STALE: 'session-stale',
  DISPOSED: 'session-disposed',
  FOREIGN: 'session-foreign',
  SOURCE_CHANGED: 'source-changed',
  UNSUPPORTED_PERSISTENCE: 'unsupported-persistence',
  TARGET_UNUSABLE: 'session-target-unusable',
})

export class SessionBoundaryError extends Error {
  /** @param {string} reason @param {string} [message] */
  constructor(reason, message) {
    super(message ?? reason)
    this.name = 'SessionBoundaryError'
    this.code = reason
    // 冲突类错误：调用方/工作观察者不会把它当 503 自动重试。
    this.status = 409
  }
}

/** @param {unknown} value @returns {value is Record<string, any>} */
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/** @param {unknown} input @param {boolean} [allowPairedOwnerLan] @returns {{kind:string,origin:string}} */
function normalizeTransport(input, allowPairedOwnerLan = false) {
  if (!isRecord(input)) throw new TypeError('session binding needs an explicit transport')
  const kind = typeof input.kind === 'string' ? input.kind : ''
  if (!TRANSPORT_KINDS.includes(kind)) throw new TypeError(`unknown session transport: ${kind}`)
  if (UNSUPPORTED_TRANSPORTS.has(kind) || (kind === SESSION_TRANSPORT.LAN && !allowPairedOwnerLan)) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.UNSUPPORTED_PERSISTENCE, `${kind} transport is declared but not implemented`)
  }
  const origin = typeof input.origin === 'string' && input.origin !== '' ? input.origin : ''
  if (origin === '') throw new TypeError('session binding needs an explicit transport origin')
  return Object.freeze({ kind, origin })
}

/** 发放权威：只有本模块建出的对象才算会话能力；复制字段/方法不会复制身份。 */
const issuedSessions = new WeakSet()

/**
 * @typedef {object} SessionCreateOptions
 * @property {string} scope - SESSION_SCOPE 里的组合名
 * @property {{kind:string, origin:string}} transport
 * @property {ApplicationContext} [application] - 真实 owner/target 应用上下文
 * @property {CommandContext} [commands] - 与 application 同一 store 的命令边界
 * @property {{kind:string, [key:string]: unknown}} [capability] - 没有资源权威时的精确能力
 * @property {string|null} [runtimeId] - 运行时重新打开生成的临时 ID
 * @property {number} [generation] - 运行时/会话的处置代数
 */

/**
 * 建立一个显式会话能力。必须给出 scope、transport 和 application 或 capability；
 * 不读取任何“当前猪/当前文件”全局槽位。
 * @param {SessionCreateOptions} options
 * @param {boolean} [allowPairedOwnerLan] 是否由 OwnerDocument runtime 配对入口调用
 * @returns {SessionBinding}
 */
function createSessionBindingInternal(options, allowPairedOwnerLan = false) {
  if (!isRecord(options)) throw new TypeError('session binding needs explicit options')
  const scope = typeof options.scope === 'string' ? options.scope : ''
  if (scope === '') throw new TypeError('session binding needs an explicit scope')
  const transport = normalizeTransport(options.transport, allowPairedOwnerLan)
  const application = options.application ?? null
  if (application !== null && (typeof application.assertScope !== 'function' || application.scope === undefined)) {
    throw new TypeError('session binding application must be a live application context')
  }
  const commands = options.commands ?? null
  if (commands !== null && (commands.scope === undefined || typeof commands.readFor !== 'function')) {
    throw new TypeError('session binding commands must be a live command context')
  }
  if (application !== null && commands !== null && commands.scope !== application.scope) {
    throw new TypeError('session command context belongs to another application; refusing to mix them')
  }
  const capability = options.capability ?? null
  if (capability !== null && (!isRecord(capability) || typeof capability.kind !== 'string')) {
    throw new TypeError('session capability must be an explicit object with a kind')
  }
  if (application === null && capability === null) throw new TypeError('session binding needs a live application or an explicit capability')
  const runtimeId = typeof options.runtimeId === 'string' && options.runtimeId !== '' ? options.runtimeId : null
  const generation = Number.isSafeInteger(options.generation) && /** @type {number} */ (options.generation) >= 0
    ? /** @type {number} */ (options.generation)
    : 0
  const id = randomUUID()
  let disposed = false

  /** @type {SessionBinding} */
  const binding = {
    kind: 'session-binding',
    id,
    scope,
    transport,
    runtimeId,
    generation,
    application,
    commands,
    capability,
    get owner() { return application === null ? null : application.owner },
    get target() { return application === null ? null : application.target },
    get commandScope() { return commands === null ? null : commands.scope },
    get disposed() { return disposed },
    assertLive() {
      if (disposed) throw new SessionBoundaryError(SESSION_BOUNDARY.DISPOSED, `session ${id} disposed`)
      return binding
    },
    assertApplication() {
      if (disposed) throw new SessionBoundaryError(SESSION_BOUNDARY.DISPOSED, `session ${id} disposed`)
      if (application === null) throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, `session ${id} has no live owner/target application`)
      application.assertScope(application.scope)
      return application
    },
    describe() {
      return {
        sessionId: id,
        scope,
        transport: { ...transport },
        runtimeId,
        generation,
        disposed,
        hasApplication: application !== null,
        capability: capability === null ? null : capability.kind,
      }
    },
    dispose() { disposed = true },
  }
  issuedSessions.add(binding)
  return Object.freeze(binding)
}

/**
 * 普通调用方不能自行声明 LAN transport；OwnerDocument runtime 只在服务端完成配对和
 * roster 校验后调用此入口创建 host-runtime 绑定。
 * @param {SessionCreateOptions} options
 * @returns {SessionBinding}
 */
export function createOwnerLanSessionBinding(options) {
  if (!isRecord(options) || options.scope !== SESSION_SCOPE.HOST_RUNTIME ||
      options.transport?.kind !== SESSION_TRANSPORT.LAN || options.application == null || options.commands == null) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.UNSUPPORTED_PERSISTENCE,
      'LAN sessions require a paired OwnerDocument host runtime')
  }
  return createSessionBindingInternal(options, true)
}

/**
 * 建立普通会话能力；任意调用方不能借此伪造 LAN 配对。
 * @param {SessionCreateOptions} options
 * @returns {SessionBinding}
 */
export function createSessionBinding(options) {
  return createSessionBindingInternal(options)
}

/**
 * 会话背后的真实 owner/target 是否还能作为宿主猪使用。这是 F02 权威能力检查：
 * - target.present 为真时直接通过（live body）；
 * - 否则用 OwnerAuthority.transact 做无副作用探测：live 空档返回 absent，
 *   已 release 的 target / 已 dispose 的 owner 会由权威层抛错；
 * - 不复制/重建资源，也不新增影子 disposed 状态。
 * 拒绝原因在 ledger.receive/WAL/save 之前抛出，调用方不会看到晚到的
 * store.installCommittedState 失败。
 * @param {ApplicationContext|null} application
 * @returns {ApplicationContext}
 */
export function assertApplicationUsable(application) {
  if (application === null || typeof application?.assertScope !== 'function') {
    throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'session has no host-runtime application')
  }
  application.assertScope(application.scope)
  const target = application.target
  if (target !== null && typeof target === 'object' && target.present === true) return application
  try {
    // ApplicationContext 的 owner 类型只声明资源句柄；真身是 OwnerAuthority。
    const authority = /** @type {any} */ (application.owner)
    const probe = authority.transact(target, () => ({ ok: true }))
    if (probe !== null && typeof probe === 'object' && probe.ok === false && probe.reason === 'absent') return application
    // A live body may have appeared between the present read and the probe.
    return application
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new SessionBoundaryError(SESSION_BOUNDARY.TARGET_UNUSABLE, `session target or owner is no longer usable: ${detail}`)
  }
}

/**
 * 只接受本模块实际发放的会话能力；伪造的 {owner,target} 普通对象不算。
 * 复制字段/方法不会复制 WeakSet 身份。
 * @param {unknown} binding
 * @returns {SessionBinding}
 */
function requireBinding(binding) {
  if (!isRecord(binding) || binding.kind !== 'session-binding' || typeof binding.assertLive !== 'function' || !issuedSessions.has(binding)) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'not an issued session binding')
  }
  return /** @type {SessionBinding} */ (binding)
}

/** 运行时对象 -> 该运行时当前代数绑定；按对象引用，没有全局“最后一头猪”槽位。 */
const runtimeSessions = new WeakMap()

/**
 * 把会话绑定登记到具体运行时对象上。运行时重新打开会登记新的绑定；
 * 旧绑定随旧会话 dispose，不会因为“同路径/同名”而复活。
 * @param {object} runtime
 * @param {SessionBinding} binding
 * @returns {object} 原运行时对象，便于链式返回
 */
export function bindRuntimeSession(runtime, binding) {
  if (!isRecord(runtime)) throw new TypeError('runtime session binding needs a runtime object')
  runtimeSessions.set(runtime, requireBinding(binding))
  return runtime
}

/**
 * 取某个运行时当前的会话能力。没有绑定的运行时直接拒绝，不回退到别的猪。
 * @param {unknown} runtime
 * @returns {SessionBinding}
 */
export function sessionOf(runtime) {
  if (!isRecord(runtime)) throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'runtime is not an object')
  const binding = runtimeSessions.get(runtime)
  if (binding === undefined) throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'runtime has no session binding')
  return binding
}

/**
 * 校验调用方带来的会话确实是当前这个 owner/target/命令边界/运行时代数。
 * 顺序是：先拒绝已处置，再拒绝外来/过期；缺失 target 不在这里回退。
 * @param {unknown} binding
 * @param {{runtimeId?: string|null, generation?: number, application?: ApplicationContext,
 *   owner?: object, target?: object, commandScope?: object}} [expected]
 * @returns {SessionBinding}
 */
export function assertLiveSession(binding, expected = {}) {
  const session = requireBinding(binding)
  session.assertLive()
  if (expected.runtimeId !== undefined && session.runtimeId !== expected.runtimeId) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.STALE, 'session belongs to another runtime generation')
  }
  if (expected.generation !== undefined && session.generation !== expected.generation) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.STALE, 'session belongs to another disposal generation')
  }
  if (expected.application !== undefined && session.application !== expected.application) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'session belongs to another application context')
  }
  if (expected.owner !== undefined && session.owner !== expected.owner) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'session belongs to another owner')
  }
  if (expected.target !== undefined && session.target !== expected.target) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'session belongs to another pig target')
  }
  if (expected.commandScope !== undefined && session.commandScope !== expected.commandScope) {
    throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'session belongs to another command scope')
  }
  return session
}

/**
 * @typedef {object} FrozenSourceCreateOptions
 * @property {SessionBinding} session - 拥有这份暂停存档的宿主会话
 * @property {string} statePath
 * @property {string|null} [stateHash] - stateFingerprint(state, receipts)
 * @property {number|null} [suspendedAt] - 暂停时钟；终结必须用它
 * @property {string|null} [mergeId]
 */

/**
 * 已暂存（没有打开运行时）的源端能力。它只允许按冻结指纹写这一份单目标
 * 旧存档；文件被别的进程/导入改过就不匹配，调用方必须在写之前发现。
 * @param {FrozenSourceCreateOptions} options
 */
export function createFrozenSourceBinding(options) {
  if (!isRecord(options)) throw new TypeError('frozen source binding needs explicit options')
  const session = requireBinding(options.session)
  session.assertLive()
  const statePath = typeof options.statePath === 'string' ? options.statePath : ''
  if (statePath === '') throw new TypeError('frozen source binding needs a statePath')
  const stateHash = typeof options.stateHash === 'string' && options.stateHash !== '' ? options.stateHash : null
  const suspendedAt = Number.isFinite(options.suspendedAt) ? Number(options.suspendedAt) : null
  const mergeId = typeof options.mergeId === 'string' && options.mergeId !== '' ? options.mergeId : null
  const id = randomUUID()

  const binding = {
    kind: 'frozen-source',
    id,
    statePath,
    stateHash,
    suspendedAt,
    mergeId,
    sessionId: session.id,
    generation: session.generation,
    get disposed() { return session.disposed },
    assertLive() {
      session.assertLive()
      return binding
    },
    /**
     * 写前校验：同一路径 + 同一指纹。没有指纹的历史配置不能冒充“已冻结”。
     * @param {{statePath:string, fingerprint:string}} match
     */
    assertMatches(match) {
      session.assertLive()
      if (!isRecord(match) || match.statePath !== statePath) {
        throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'frozen source belongs to another save path')
      }
      if (stateHash === null) throw new SessionBoundaryError(SESSION_BOUNDARY.SOURCE_CHANGED, 'frozen source has no recorded fingerprint')
      if (match.fingerprint !== stateHash) {
        throw new SessionBoundaryError(SESSION_BOUNDARY.SOURCE_CHANGED, 'save changed since it was frozen')
      }
      return binding
    },
    describe() {
      return {
        sourceId: id,
        sessionId: session.id,
        generation: session.generation,
        statePath,
        hasFingerprint: stateHash !== null,
        suspendedAt,
        mergeId,
        disposed: session.disposed,
      }
    },
  }
  return Object.freeze(binding)
}

/** 当前唯一支持的全平持久化能力名；未来多目标格式必须显式声明，不能靠猜字段名。 */
export const FLAT_PERSISTENCE = Object.freeze({
  LEGACY_SINGLE_TARGET: 'legacy-flat-single-target',
})

/**
 * 持久化能力校验。只接受显式声明的单目标旧档能力（或没有能力的暂停文件）；
 * 不看存档里的 pigs/pigBodies/pigTargets 等未知旧字段，也不把它们当保留字。
 * 只有显式声明为非 legacy 的目标/格式（未来 schema marker 或 attachPig 组合）
 * 才在这里被拒绝，避免把整份 B 存档覆盖/复制成 A，或编造稳定 ID。
 * @param {{kind?: unknown}|null|undefined} authority - 来自真实 store/控制器的显式能力
 * @returns {string|null} 拒绝原因；显式 legacy 单目标或无能力返回 null
 */
export function persistenceIssue(authority) {
  if (authority === null || authority === undefined) return null
  if (isRecord(authority) && authority.kind === FLAT_PERSISTENCE.LEGACY_SINGLE_TARGET) return null
  return SESSION_BOUNDARY.UNSUPPORTED_PERSISTENCE
}

/**
 * @typedef {object} SessionBinding
 * @property {'session-binding'} kind
 * @property {string} id - 临时 SessionId；不持久化、不是稳定身份
 * @property {string} scope
 * @property {{kind:string, origin:string}} transport
 * @property {string|null} runtimeId - 临时 RuntimeId
 * @property {number} generation - 处置代数
 * @property {ApplicationContext|null} application
 * @property {CommandContext|null} commands
 * @property {{kind:string, [key:string]: unknown}|null} capability
 * @property {object|null} owner
 * @property {object|null} target
 * @property {object|null} commandScope
 * @property {boolean} disposed
 * @property {() => SessionBinding} assertLive
 * @property {() => ApplicationContext} assertApplication
 * @property {() => object} describe
 * @property {() => void} dispose
 */

/*
 * LAN session issuer 在配对成功后可创建 kind='lan' 的进程内绑定；令牌和邀请由
 * owner-lan-server 管理，不能从请求里的 ownerId/pigId 推导权限。
 * 仍未实现的公网/跨进程责任：
 * - 持久 OwnerId/PigId/RoomId 和跨进程/服务器身份；
 * - 公网认证、加密传输、房间策略、持久资源 revision 与素材命名空间；
 * - loopback/LAN 临时令牌、昵称、文件路径、RuntimeId 都不能当稳定网络身份；
 * - snapshot 必须带资源 revision 和目标 PigId，receipt 必须区分 accepted/completed/
 *   replayed/rejected，崩溃恢复下的 exactly-once 不能由本模块假装提供。
 * 这些未实现项在 docs/guides/session-context.md 中逐项列出。
 */
