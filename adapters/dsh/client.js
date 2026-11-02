// @ts-check
/** DSH 仍加载原来的单文件入口；桌面宿主直接使用同一界面挂载函数。 */
import { mountGame, desktop, createClientPlugin } from '../../src/client/index.js'

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
if (/** @type {any} */ (window).__ModuleLoader__) {
  /** @type {any} */ (window).__ModuleLoader__.load({ id: 'dsh-piggy', factory: createClientPlugin })
}
