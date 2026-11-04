// @ts-check
/** Owner 运行时的进程内共享状态与 owner 文件检查；不写盘、不做业务判断。 */
import { inspectOwnerDocumentFile } from './owner-document-file.js'

/**
 * @typedef {object} OwnerRuntimeState
 * @property {import('../store/owner-resources.js').OwnerAuthority|null} owner
 * @property {import('./session-context.js').SessionBinding|null} defaultSession
 * @property {string} ownerId
 * @property {string} revision
 * @property {unknown} fault
 * @property {boolean} closed
 * @property {boolean} accepting
 * @property {number} epoch
 */

/** @returns {OwnerRuntimeState} */
export function createOwnerRuntimeState() {
  return {
    owner: null,
    defaultSession: null,
    ownerId: '',
    revision: '',
    fault: null,
    closed: false,
    accepting: true,
    epoch: 0,
  }
}

/** @param {string} ownerDocumentPath */
export function inspectCurrentOwnerDocument(ownerDocumentPath) {
  const status = inspectOwnerDocumentFile(ownerDocumentPath)
  if (status.kind !== 'owner-document') {
    throw new Error(`owner document is not readable (${status.kind}); refusing to open an empty owner`)
  }
  return status
}

/**
 * 关闭和故障优先于会话与 target 探测；这两条门禁只读运行态，不碰磁盘。
 * @param {OwnerRuntimeState} state
 */
export function createRuntimeGuards(state) {
  function assertHealthy() {
    if (state.closed) throw new Error('owner document runtime closed')
    if (state.fault !== null) {
      throw Object.assign(new Error('owner document runtime is faulted; reopen after inspecting the saved document'), { status: 503 })
    }
  }

  function assertAccepting() {
    assertHealthy()
    if (!state.accepting) throw Object.assign(new Error('owner document runtime is closing'), { status: 503 })
  }

  return { assertHealthy, assertAccepting }
}
