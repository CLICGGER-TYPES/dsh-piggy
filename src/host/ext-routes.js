// @ts-check
/**
 * 扩展相关的只读路由：
 *   GET /dsh-piggy/extensions/online
 *   GET /dsh-piggy/ext/<key>/client.js
 *   GET /dsh-piggy/ext/<key>/assets/<name>
 *   GET /dsh-piggy/ext/<key>/actions/<pack>/<file>
 *   GET /dsh-piggy/ext/<key>/sounds/<pack>/<file>
 *
 * 这里只做 URL 分发；文件白名单、路径逃逸和 pack.json 声明校验在
 * store/ext-view.js / store/ext-asset-file.js。
 * @module dsh-piggy/host/ext-routes
 */

/**
 * 扩展素材包路径：GET /dsh-piggy/ext/<key>/actions|sounds/<pack>/<file>。
 * 先解码再交给 store 校验；解不开的百分号编码直接拒绝（file: null）。
 */
function extAssetPath(path) {
  const match = /^\/dsh-piggy\/ext\/([a-z0-9-]+)\/(actions|sounds)\/([a-z][a-z0-9-]{0,31})\/(.+)$/.exec(path)
  if (match === null) return null
  try {
    return { key: match[1], kind: match[2], pack: match[3], file: decodeURIComponent(match[4]) }
  } catch {
    return { key: match[1], kind: match[2], pack: match[3], file: null }
  }
}

/** /dsh-piggy/ext 下的 URL 只要解码后含逃逸段就 403，不等到具体分支再判断。 */
function extPathEscapes(path) {
  let decoded
  try { decoded = decodeURIComponent(path) } catch { return true }
  if (decoded.includes('\0') || decoded.includes('\\')) return true
  return decoded.split('/').some(part => part === '.' || part === '..')
}

/**
 * @param {any} webServer
 * @param {any} store
 * @param {(res: any, status: number, body: any, extra?: any) => void} sendJson
 */
export function registerExtRoutes(webServer, store, sendJson) {
  const offOnline = webServer.register({
    kind: 'exact', path: '/dsh-piggy/extensions/online',
    handler: async (req, res) => {
      try {
        const force = String(req.url ?? '').includes('force=1')
        sendJson(res, 200, await store.ext.onlineView(force), { 'cache-control': 'no-store' })
      } catch (error) {
        sendJson(res, 200, { error: error instanceof Error ? error.message : String(error), entries: [] })
      }
    },
  })
  const offScript = webServer.register({
    kind: 'prefix', path: '/dsh-piggy/ext',
    handler: async (req, res) => {
      const path = String(req.url ?? '').split('?')[0]
      if (path.startsWith('/dsh-piggy/ext/') && extPathEscapes(path)) {
        if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' })
        return sendJson(res, 403, { error: 'forbidden' })
      }
      const asset = extAssetPath(path)
      if (asset !== null) {
        if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' })
        const file = asset.file === null
          ? { ok: false, status: 403 }
          : store.ext.assetPackFile(asset.key, asset.kind, asset.pack, asset.file)
        if (file.ok !== true) {
          const status = file.status === 403 ? 403 : 404
          return sendJson(res, status, { error: status === 403 ? 'forbidden' : 'not found' })
        }
        const headers = { 'content-type': file.type, 'cache-control': file.cache, etag: file.etag }
        const ifNoneMatch = req.headers?.['if-none-match']
        if (typeof ifNoneMatch === 'string'
          && (ifNoneMatch.trim() === '*' || ifNoneMatch.split(',').some(value => value.trim() === file.etag))) {
          res.writeHead(304, { 'cache-control': file.cache, etag: file.etag })
          return res.end()
        }
        res.writeHead(200, headers)
        return res.end(file.body)
      }
      const image = /^\/dsh-piggy\/ext\/([a-z0-9-]+)\/assets\/([a-z0-9.-]+)$/.exec(path)
      if (image !== null) {
        // 地址带 ?v=版本，扩展更新就换地址，所以可以放心缓存。
        const file = store.ext.assetFile(image[1], image[2])
        if (file === null) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found') }
        res.writeHead(200, { 'content-type': file.type, 'cache-control': 'max-age=86400' })
        return res.end(file.body)
      }
      const match = /^\/dsh-piggy\/ext\/([a-z0-9-]+)\/client\.js$/.exec(path)
      const script = match === null ? null : store.ext.clientScript(match[1])
      if (script === null) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found') }
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' })
      res.end(script)
    },
  })
  return () => { offOnline(); offScript() }
}
