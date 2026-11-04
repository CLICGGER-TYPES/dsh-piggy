// @ts-check
/**
 * 会话边界的公共契约：组合范围、transport、拒绝原因/错误类型，以及显式持久化能力。
 *
 * 这里只放不依赖会话实例的常量与校验；会话发放、运行时登记和冻结源能力在
 * session-context.js。依赖单向（session-context -> contract），本模块不反向依赖它。
 *
 * @module dsh-piggy/runtime/session-context-contract
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
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/** @param {unknown} input @param {boolean} [allowPairedOwnerLan] @returns {{kind:string,origin:string}} */
export function normalizeTransport(input, allowPairedOwnerLan = false) {
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
