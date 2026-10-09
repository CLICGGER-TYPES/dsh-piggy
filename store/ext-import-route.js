// @ts-check
/**
 * POST /dsh-piggy/extensions/import —— 本地导入扩展包（store/ext-import.js）。
 *
 * 请求体是 base64 文本，解开是 JSON `{ bundle: 扩展包原文, confirm: 布尔 }`：桌面版的本地协议把请求体当文本读，
 * 跟导入皮肤一样用 base64 才不会把中文读坏。导入成功回快照，好让面板马上看到新扩展。
 * @module dsh-piggy/store/ext-import-route
 */
import { BUNDLE_FILE_BYTES } from './ext-import.js'

export const EXT_IMPORT_ROUTE = '/dsh-piggy/extensions/import'
/** 三个文件的上限加上 JSON 转义和 base64 的膨胀。 */
const LIMIT = Math.ceil(BUNDLE_FILE_BYTES * 3 * 2 * 1.4)

/** @param {any} webServer @param {any} store @param {(store: any) => any} snapshot */
export function registerExtImportRoute(webServer, store, snapshot) {
  return webServer.register({
    kind: 'exact', path: EXT_IMPORT_ROUTE,
    handler: async (req, res) => {
      const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)) }
      if (req.method !== 'POST') return send(405, { ok: false, reason: 'method' })
      let size = 0
      const chunks = []
      for await (const chunk of req) {
        size += chunk.length
        if (size > LIMIT) return send(413, { ok: false, reason: 'too-large', message: '扩展包太大' })
        chunks.push(Buffer.from(chunk))
      }
      let body
      try { body = JSON.parse(Buffer.from(Buffer.concat(chunks).toString('ascii').trim(), 'base64').toString('utf8')) } catch { return send(400, { ok: false, reason: 'invalid-bundle', message: '这不是扩展包' }) }
      if (body === null || typeof body !== 'object' || typeof body.bundle !== 'string') return send(400, { ok: false, reason: 'invalid-bundle', message: '这不是扩展包' })
      try {
        const result = await store.ext.importBundle(body.bundle, body.confirm === true)
        if (result.ok !== true) return send(200, result)
        send(200, { ...snapshot(store), ...result, ok: true })
      } catch (error) {
        send(200, { ok: false, reason: 'invalid-bundle', message: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}
