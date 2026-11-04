// @ts-check
/** DSH 仍加载原来的单文件入口；桌面宿主直接使用同一界面挂载函数。 */
import { mountGame, desktop, createClientPlugin } from '../../src/client/index.js'
import { createDshOwnerCloudClient } from './owner-cloud-client.js'

const game = { mount: mountGame, desktop }
;/** @type {any} */ (window).piggyGame = game
const requestCloudSettings = async (method, path, value) => {
  try {
    const response = await fetch(path, method === 'GET' ? { cache: 'no-store' } : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value ?? {}),
    })
    const body = await response.json()
    return response.ok ? body : { ok: false, reason: body?.reason || '云存档设置请求失败' }
  } catch { return { ok: false, reason: '无法读取云存档设置' } }
}
;/** @type {any} */ (window).__dshPiggyCloudSave = {
  get: () => requestCloudSettings('GET', '/dsh-piggy/cloud/settings'),
  set: value => requestCloudSettings('POST', '/dsh-piggy/cloud/settings', value),
  test: value => requestCloudSettings('POST', '/dsh-piggy/cloud/test-connection', value),
}

/** Same-origin loopback request; HTTP status stays visible for the bridge to map. */
const requestOwnerCloud = async (method, path, value, options) => {
  const timeoutMs = typeof options?.timeoutMs === 'number' && options.timeoutMs > 0 ? options.timeoutMs : 0
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller !== null && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    /** @type {RequestInit} */
    const init = { method, credentials: 'same-origin', cache: 'no-store' }
    if (controller !== null) init.signal = controller.signal
    if (method !== 'GET') {
      init.headers = { 'content-type': 'application/json' }
      init.body = JSON.stringify(value ?? {})
    }
    const response = await fetch(path, init)
    let body = null
    let parseError = false
    try { body = await response.json() } catch { parseError = true }
    return { status: response.status, body, parseError }
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}
;/** @type {any} */ (window).__dshPiggyOwnerCloud = createDshOwnerCloudClient(requestOwnerCloud)

if (/** @type {any} */ (window).__ModuleLoader__) {
  /** @type {any} */ (window).__ModuleLoader__.load({ id: 'dsh-piggy', factory: createClientPlugin })
}
