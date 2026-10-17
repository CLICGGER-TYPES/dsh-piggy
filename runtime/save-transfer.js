// @ts-check
/** 共享的二进制路由；预览只解析，不写目标存档。 */
import { randomUUID } from 'node:crypto'
import { createSaveArchive, parseSaveArchive } from './save-archive.js'
import { PACKAGE_VERSION } from '../snapshot.js'

const LIMIT = 32 * 1024 * 1024
const TTL = 10 * 60 * 1000
const WARNING_LIMIT = 50
const send = (res, code, value) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}
async function read(req, limit) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > limit) throw Object.assign(new Error('存档文件太大'), { status: 413 })
    chunks.push(bytes)
  }
  return Buffer.concat(chunks)
}

export function createSaveTransfer({ statePath, getStore, exclusive, replace, now = Date.now, isBusy = () => false }) {
  const previews = new Map()
  const archive = () => createSaveArchive({ statePath, state: getStore().state, gameVersion: PACKAGE_VERSION, nowMs: now() })
  const route = (suffix, method, action) => ({ kind: 'exact', path: `/dsh-piggy/save/${suffix}`,
    async handler(req, res) {
      if (req.method !== method) {
        res.setHeader('allow', method)
        return send(res, 405, { ok: false, error: `请使用 ${method}` })
      }
      try { await action(req, res) }
      catch (error) { send(res, error.status ?? 400, { ok: false, error: error.message }) }
    } })
  return {
    clear() { previews.clear() },
    routes: [
      route('export', 'GET', async (_req, res) => {
        const backup = await exclusive(() => {
          if (!getStore().state) throw new Error('接到小猪后即可备份')
          return archive()
        })
        res.writeHead(200, { 'content-type': 'application/zip', 'cache-control': 'no-store',
          'content-disposition': `attachment; filename="${backup.name}"` })
        res.end(backup.buffer)
      }),
      route('preview', 'POST', async (req, res) => {
        const input = await read(req, LIMIT)
        // 读请求体会让出事件循环，期间可能已经开始导入/导出；另一个窗口的预览不能清掉已被接受的导入令牌。
        if (isBusy()) throw Object.assign(new Error('正在处理存档，请稍后重试'), { status: 503 })
        for (const [token, entry] of previews) if (entry.expires <= now()) previews.delete(token)
        // 每个运行时只保留一份待确认预览，未压缩内容不会无限堆积。
        previews.clear()
        const parsed = parseSaveArchive(input, { nowMs: now() })
        const token = randomUUID()
        previews.set(token, { parsed, expires: now() + TTL })
        const allWarnings = Array.isArray(parsed.warnings) ? parsed.warnings : []
        const warnings = allWarnings.slice(0, WARNING_LIMIT)
        if (allWarnings.length > WARNING_LIMIT) warnings.push(`另有 ${allWarnings.length - WARNING_LIMIT} 条提示`)
        const summary = { ...parsed.summary, extensions: parsed.summary.extensions.length, skins: parsed.summary.skins.length, warnings }
        send(res, 200, { ok: true, token, summary, warnings })
      }),
      route('import', 'POST', async (req, res) => {
        const body = JSON.parse((await read(req, 2048)).toString('utf8'))
        const entry = previews.get(body?.token)
        if (!entry || entry.expires <= now()) throw new Error('预览已过期，请重新选择存档')
        const result = await exclusive(async () => {
          if (previews.get(body.token) !== entry) throw new Error('预览已过期，请重新选择存档')
          const backup = archive()
          const result = await replace(entry.parsed.files, backup.buffer)
          previews.clear()
          return result
        })
        send(res, 200, { ok: true, ...result })
      }),
    ],
  }
}
