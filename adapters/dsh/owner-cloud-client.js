// @ts-check
/**
 * DSH web-panel bridge for the loopback-only OwnerDocument cloud routes.
 *
 * This module owns paths, request bodies and failure normalization only. The
 * caller injects `request(method, path, body, { timeoutMs })`, so the contract
 * can be tested without a browser. Tokens stay in the returned preview object
 * and are never written to a URL, storage or a log line.
 */

export const OWNER_CLOUD_PATHS = Object.freeze({
  status: '/dsh-piggy/owner/cloud/status',
  firstSync: '/dsh-piggy/owner/cloud/first-sync',
  restore: '/dsh-piggy/owner/cloud/restore',
  history: '/dsh-piggy/owner/cloud/history',
  selection: '/dsh-piggy/owner/selection',
})

export const OWNER_CLOUD_TIMEOUTS = Object.freeze({
  status: 30_000,
  firstSync: 300_000,
  restore: 600_000,
  history: 60_000,
  selection: 30_000,
})

export const OWNER_CLOUD_REASONS = Object.freeze({
  loopback: '完整档云同步只在本机打开 DSH 时可用',
  unsupported: '当前 DSH 或插件版本没有完整档云能力',
  switching: '正在切换完整档，请稍后',
  network: '无法连接 DSH 后端',
  timeout: '请求超时，请稍后重试',
  unknown: '恢复请求的结果未知；请检查当前完整档',
  invalid: '请求无效',
  method: '当前版本不支持这个操作',
  conflict: '请求没有完成',
  server: '完整档请求失败',
  token: '恢复令牌无效',
  direction: '首次同步方向无效',
})

/** @typedef {{status:number, body:any, parseError?:boolean}} OwnerCloudResponse */
/** @typedef {(method:string, path:string, body:any, options:{timeoutMs:number}) => Promise<OwnerCloudResponse>} OwnerCloudRequest */

/** @param {string} code @param {string} reason @param {Record<string, unknown>} [extra] */
function failure(code, reason, extra = {}) {
  return { ok: false, code, reason, ...extra }
}

/** @param {string} code @param {string} reason */
function unavailable(code, reason) {
  return { ok: false, available: false, code, reason }
}

/** @param {unknown} error */
function timedOut(error) {
  const value = /** @type {any} */ (error)
  return value?.name === 'AbortError' || value?.code === 'timeout'
}

/** @param {any} response */
function reasonOf(response) {
  const body = response?.body
  return body !== null && typeof body === 'object' && typeof body.reason === 'string' ? body.reason : ''
}

/** @param {any} body @param {Record<string, unknown>} shape */
function keepFlags(body, shape) {
  if (body === null || typeof body !== 'object') return
  if (typeof body.imported === 'boolean') shape.imported = body.imported
  if (typeof body.switched === 'boolean') shape.switched = body.switched
}

/** @param {any} response */
function responseFailure(response) {
  const status = typeof response?.status === 'number' ? response.status : 0
  const reason = reasonOf(response)
  /** @type {Record<string, unknown>} */
  const flags = {}
  keepFlags(response?.body, flags)
  const parsed = response?.parseError !== true && status !== 0
  if (!parsed) return failure('bad-response', OWNER_CLOUD_REASONS.unsupported, flags)
  if (status === 403) return failure('loopback-only', OWNER_CLOUD_REASONS.loopback, flags)
  if (status === 404) return failure('owner-cloud-unsupported', OWNER_CLOUD_REASONS.unsupported, flags)
  if (status === 405) return failure('method', OWNER_CLOUD_REASONS.method, flags)
  if (status === 400) return failure('request-invalid', OWNER_CLOUD_REASONS.invalid, flags)
  if (status === 503) return failure('owner-switching', OWNER_CLOUD_REASONS.switching, flags)
  if (status === 409) return failure(reason === '' ? 'conflict' : reason, reason === '' ? OWNER_CLOUD_REASONS.conflict : reason, flags)
  if (status >= 400) return failure('server', reason === '' ? OWNER_CLOUD_REASONS.server : reason, flags)
  if (status >= 200 && status < 300) return bodyFailure(response?.body)
  return failure('bad-response', reason === '' ? OWNER_CLOUD_REASONS.unsupported : reason, flags)
}

/** A 2xx body that still says `ok:false` keeps the server conflict reason. */
function bodyFailure(body) {
  const reason = typeof body?.reason === 'string' ? body.reason : ''
  /** @type {Record<string, unknown>} */
  const flags = {}
  keepFlags(body, flags)
  return failure(reason === '' ? 'conflict' : reason, reason === '' ? OWNER_CLOUD_REASONS.conflict : reason, flags)
}

/** @param {any} body */
export function normalizeStatus(body) {
  if (body === null || typeof body !== 'object' || body.ok !== true) {
    return unavailable('bad-response', OWNER_CLOUD_REASONS.unsupported)
  }
  return {
    ok: true,
    available: true,
    enabled: body.configured === true,
    configured: body.configured === true,
    ready: body.ready === true,
    branch: typeof body.branch === 'string' && body.branch !== '' ? body.branch : 'main',
    directionRequired: body.directionRequired === true,
    markerError: typeof body.markerError === 'string' ? body.markerError : null,
    transport: 'dsh',
    restartAfterImport: false,
  }
}

/**
 * @param {OwnerCloudRequest} request
 */
export function createDshOwnerCloudClient(request) {
  if (typeof request !== 'function') throw new TypeError('DshOwnerCloudClient needs a request function')

  /** @param {string} method @param {string} path @param {any} body @param {number} timeoutMs @returns {Promise<any>} */
  async function call(method, path, body, timeoutMs) {
    try {
      const response = await request(method, path, body, { timeoutMs })
      return response !== null && typeof response === 'object' ? response : { status: 0, body: null, parseError: true }
    } catch (error) {
      return { thrown: error }
    }
  }

  /** @param {any} result @param {boolean} unknownResult */
  function thrownFailure(result, unknownResult) {
    if (unknownResult) return failure('unknown', OWNER_CLOUD_REASONS.unknown, { unknown: true })
    return timedOut(result.thrown)
      ? failure('timeout', OWNER_CLOUD_REASONS.timeout, { retryable: true })
      : failure('network', OWNER_CLOUD_REASONS.network, { retryable: true })
  }

  /** @param {any} response */
  function successBody(response) {
    return response?.parseError !== true && response?.status === 200 &&
      response?.body !== null && typeof response?.body === 'object' && response.body.ok === true
  }

  async function ownerStatus() {
    const response = await call('GET', OWNER_CLOUD_PATHS.status, undefined, OWNER_CLOUD_TIMEOUTS.status)
    if (response.thrown !== undefined) {
      const mapped = thrownFailure(response, false)
      return { ok: false, available: false, code: mapped.code, reason: mapped.reason }
    }
    if (successBody(response)) return normalizeStatus(response.body)
    return { ...responseFailure(response), available: false }
  }

  /** @param {'cloud-to-local'|'local-to-cloud'} direction */
  async function firstSync(direction) {
    if (direction !== 'cloud-to-local' && direction !== 'local-to-cloud') {
      return failure('request-invalid', OWNER_CLOUD_REASONS.direction)
    }
    const response = await call('POST', OWNER_CLOUD_PATHS.firstSync, { direction }, OWNER_CLOUD_TIMEOUTS.firstSync)
    if (response.thrown !== undefined) return thrownFailure(response, false)
    if (!successBody(response)) return responseFailure(response)
    const body = response.body
    return direction === 'cloud-to-local' ? { ...body, switchAfterImport: true } : body
  }

  /**
   * @param {string} token
   * @param {{acceptWarnings?:boolean, pigId?:string}} [options]
   */
  async function importFirstSync(token, options = {}) {
    if (typeof token !== 'string' || token === '' || token.length > 128) {
      return failure('request-invalid', OWNER_CLOUD_REASONS.token)
    }
    /** @type {{token:string, acceptWarnings?:boolean, pigId?:string}} */
    const body = { token }
    if (options.acceptWarnings === true) body.acceptWarnings = true
    if (typeof options.pigId === 'string' && options.pigId !== '') body.pigId = options.pigId
    const response = await call('POST', OWNER_CLOUD_PATHS.restore, body, OWNER_CLOUD_TIMEOUTS.restore)
    if (response.thrown !== undefined) return thrownFailure(response, true)
    if (!successBody(response)) return responseFailure(response)
    return response.body
  }

  /** The DSH route reads the configured branch; the desktop-compatible argument is ignored. */
  async function ownerHistory(_branch) {
    const response = await call('GET', OWNER_CLOUD_PATHS.history, undefined, OWNER_CLOUD_TIMEOUTS.history)
    if (response.thrown !== undefined) return thrownFailure(response, false)
    if (!successBody(response)) return responseFailure(response)
    return response.body
  }

  async function selection() {
    const response = await call('GET', OWNER_CLOUD_PATHS.selection, undefined, OWNER_CLOUD_TIMEOUTS.selection)
    if (response.thrown !== undefined) return thrownFailure(response, false)
    if (!successBody(response)) return responseFailure(response)
    return response.body
  }

  return Object.freeze({
    version: 1,
    transport: 'dsh',
    restartAfterImport: false,
    ownerStatus,
    firstSync,
    importFirstSync,
    restore: importFirstSync,
    ownerHistory,
    selection,
  })
}
