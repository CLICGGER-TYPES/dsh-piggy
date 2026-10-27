// @ts-check
/**
 * DSH 到桌面配对/工作接口的 HTTP 客户端。
 *
 * 只走 127.0.0.1；令牌从发现文件读，不进 URL、不写日志。回应只解析 JSON/字节，
 * 不把桌面端错误堆栈透给浏览器。
 *
 * @module dsh-piggy/adapters/dsh/external-client
 */

const JSON_HEADERS = { 'content-type': 'application/json' }

function headersFor(token, contentType) {
  return { authorization: `Bearer ${token}`, ...(contentType === undefined ? {} : { 'content-type': contentType }) }
}

async function request(fetchImpl, { base, token }, path, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000
  const response = await fetchImpl(base + path, {
    method: options.method ?? 'GET',
    headers: { ...headersFor(token, options.contentType), ...(options.headers ?? {}) },
    ...(options.body === undefined ? {} : { body: options.body }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const buffer = Buffer.from(await response.arrayBuffer())
  const type = String(response.headers.get('content-type') ?? '')
  const json = type.includes('application/json') && buffer.length > 0 ? safeJson(buffer) : null
  return { status: response.status, ok: response.ok, headers: Object.fromEntries(response.headers), buffer, json }
}

function safeJson(buffer) {
  try { return JSON.parse(buffer.toString('utf8')) } catch { return null }
}

export function createPairClient(options) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const pair = () => {
    const endpoint = options.endpoint()
    if (endpoint?.pair === undefined) throw Object.assign(new Error('pair endpoint missing'), { code: 'disconnected' })
    return endpoint.pair
  }
  return {
    info: options => request(fetchImpl, pair(), '/pair/info', { ...options, timeoutMs: 5000 }),
    state: options => request(fetchImpl, pair(), '/pair/state', options),
    act: body => request(fetchImpl, pair(), '/pair/act', { method: 'POST', body: JSON.stringify(body), contentType: 'application/json', timeoutMs: 10_000 }),
    command: body => request(fetchImpl, pair(), '/pair/command', { method: 'POST', body: JSON.stringify(body), contentType: 'application/json', timeoutMs: 10_000 }),
    prepare: body => request(fetchImpl, pair(), '/pair/merge/prepare', { method: 'POST', body: JSON.stringify(body), contentType: 'application/json', timeoutMs: 10_000 }),
    preview: (zip, requestId) => request(fetchImpl, pair(), '/pair/merge/preview', {
      method: 'POST', body: zip, contentType: 'application/zip', timeoutMs: 30_000,
      headers: requestId === undefined ? undefined : { 'x-request-id': requestId },
    }),
    commit: body => request(fetchImpl, pair(), '/pair/merge/commit', { method: 'POST', body: JSON.stringify(body), contentType: 'application/json', timeoutMs: 90_000 }),
    mergeStatus: mergeId => request(fetchImpl, pair(), `/pair/merge/status?mergeId=${encodeURIComponent(mergeId)}`, { timeoutMs: 10_000 }),
    rollback: body => request(fetchImpl, pair(), '/pair/merge/rollback', { method: 'POST', body: JSON.stringify(body), contentType: 'application/json', timeoutMs: 30_000 }),
    art: name => request(fetchImpl, pair(), `/pair/art/${encodeURIComponent(name)}`, { timeoutMs: 10_000 }),
    ext: path => request(fetchImpl, pair(), `/pair/ext/${path}`, { timeoutMs: 10_000 }),
    raw: (path, options) => request(fetchImpl, pair(), path, options),
  }
}

/** 工作事件 POST；401 时由调用方刷新发现文件后重试一次。 */
export function createWorkClient(options) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  return {
    post(event) {
      const endpoint = options.workEndpoint()
      if (endpoint === undefined) return Promise.reject(Object.assign(new Error('work endpoint missing'), { code: 'disconnected' }))
      return request(fetchImpl, endpoint, '/events', {
        method: 'POST', body: JSON.stringify(event), contentType: 'application/json', timeoutMs: 10_000,
      })
    },
    health() {
      const endpoint = options.workEndpoint()
      if (endpoint === undefined) return Promise.reject(Object.assign(new Error('work endpoint missing'), { code: 'disconnected' }))
      return request(fetchImpl, endpoint, '/health', { timeoutMs: 5000 })
    },
  }
}

export { request as httpRequest, JSON_HEADERS }
