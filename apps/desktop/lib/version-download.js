// @ts-check
/** Chromium 网络请求留在调用方；响应逐块写盘，不在 UI 线程拼接或解析整包。 */
import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/**
 * @param {{ url: string, headers: Record<string, string>, destination: string, fetch: typeof fetch, signal?: AbortSignal, onBytes?: (bytes: number) => void }} options
 */
export async function downloadVersionFile(options) {
  const response = await options.fetch(options.url, { headers: options.headers, signal: options.signal })
  const result = { ok: response.ok, status: response.status, etag: response.headers.get('etag') }
  if (!response.ok || response.body === null) {
    await response.body?.cancel()
    return { ...result, ok: false }
  }
  let bytes = 0
  let lastProgress = 0
  const progress = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length
      const now = Date.now()
      if (options.onBytes && now - lastProgress >= 100) {
        lastProgress = now
        options.onBytes(bytes)
      }
      callback(null, chunk)
    },
  })
  await pipeline(Readable.from(/** @type {any} */ (response.body)), progress,
    createWriteStream(options.destination, { flags: 'wx' }), { signal: options.signal })
  options.onBytes?.(bytes)
  return result
}
