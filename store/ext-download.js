// @ts-check
/**
 * 在线扩展的下载（从 ext-runtime 拆出来）：按目录条目把扩展的全部文件拿下来、核对好，交回去放进扩展目录。
 *
 * - 0.36.1 起条目带 `bundle`：只下整个扩展包 `ext-<key>-<版本>.piggyext`，一个文件一个校验值，
 *   拆开后按本地导入同样的规矩核对（用户 2026-10-11：发行版别堆几十张图，请求太多国内更容易卡）。
 * - 没有 `bundle` 的老条目照旧按 `files` 逐个下载（0.36.0 及更早的游戏只认这个，目录里两样都留着）。
 * @module dsh-piggy/store/ext-download
 */
import { createHash } from 'node:crypto'
import { ASSET_NAME, MAX_FILE_BYTES, assetNames, describeAssetList, describeFetchError, describeFileTooBig, fileList, inBatches } from './ext-files.js'
import { BUNDLE_BYTES, parseBundle } from './ext-import.js'

/** 同时下载几个文件（只有逐个下载的老条目用得上）。 */
const DOWNLOAD_PARALLEL = 6
/**
 * 国内直连 GitHub 很抖：同一个地址常常第一次连不上、几秒后就好了。
 * 所以每个文件都要有超时和重试，别让一次抖动变成「点了没反应」。
 */
const DOWNLOAD_ATTEMPTS = 3
const DOWNLOAD_TIMEOUT_MS = 12_000
/** 整包最大约 7MB，给慢网多留点时间。 */
const BUNDLE_TIMEOUT_MS = 60_000
const RETRY_BACKOFF_MS = [400, 1200]

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const failed = message => ({ ok: /** @type {false} */ (false), reason: 'download-failed', message })

/**
 * @param {{ fetch: typeof fetch, wait: (ms: number) => Promise<void>, warn: (message: string) => void, sourceOk: (url: string) => boolean }} deps
 */
export function createDownloads(deps) {
  /** 拉一个文件：超时、网络抖动、坏包都再试；HTTP 4xx 和超大文件不重试。
   * @returns {Promise<{ok:boolean, retryable:boolean, message:string, buffer?:Buffer}>} */
  async function downloadOnce(name, spec, limit, timeout) {
    let response
    try {
      response = await deps.fetch(spec.url, { signal: AbortSignal.timeout(timeout) })
    } catch (error) {
      return { ok: false, retryable: true, message: `${name} 下载失败：${describeFetchError(error, spec.url)}` }
    }
    if (!response.ok) {
      return { ok: false, retryable: response.status >= 500, message: `${name} 下载失败：HTTP ${response.status}` }
    }
    let buffer
    try {
      buffer = Buffer.from(await response.arrayBuffer())
    } catch (error) {
      return { ok: false, retryable: true, message: `${name} 下载中断：${describeFetchError(error, spec.url)}` }
    }
    if (buffer.length > limit) return { ok: false, retryable: false, message: describeFileTooBig(name, buffer.length, limit) }
    if (sha256(buffer) !== spec.sha256.toLowerCase()) return { ok: false, retryable: true, message: `${name} 校验不对，可能下载坏了` }
    return { ok: true, retryable: false, message: '', buffer }
  }

  /** 带重试的下载。每次失败都留一行日志，事后能看出是哪一步、试了几次。
   * @returns {Promise<Buffer>} 试完还不行就抛错，错误文案直接给用户看。 */
  async function downloadFile(name, spec, limit = MAX_FILE_BYTES, timeout = DOWNLOAD_TIMEOUT_MS) {
    let result = { ok: false, retryable: false, message: `${name} 没有下载` }
    let attempt = 0
    for (attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
      result = await downloadOnce(name, spec, limit, timeout)
      if (result.ok === true && result.buffer !== undefined) return result.buffer
      deps.warn(`extension download failed: file="${name}" attempt=${attempt}/${DOWNLOAD_ATTEMPTS} url="${spec.url}" reason="${result.message}"`)
      if (result.retryable !== true || attempt === DOWNLOAD_ATTEMPTS) break
      await deps.wait(RETRY_BACKOFF_MS[attempt - 1] ?? 1200)
    }
    throw new Error(result.message + (attempt > 1 ? `（试了 ${attempt} 次）` : ''))
  }

  const usable = spec => spec !== null && typeof spec === 'object' && typeof spec.url === 'string' && typeof spec.sha256 === 'string'

  /** 整包：一个文件，拆开后核对名字、版本和图片清单（parseBundle 跟本地导入同一套）。 */
  async function fromBundle(key, entry) {
    const name = `ext-${key}-${entry.version}.piggyext`
    if (!usable(entry.bundle)) return failed('目录里缺少 ' + name)
    if (!deps.sourceOk(entry.bundle.url)) return failed('来源不对：' + name)
    let buffer
    try { buffer = await downloadFile(name, entry.bundle, BUNDLE_BYTES, BUNDLE_TIMEOUT_MS) } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      deps.warn(`extension install failed: key="${key}" reason="${message}"`)
      return failed(message)
    }
    const bundle = parseBundle(buffer.toString('utf8'))
    if ('message' in bundle) return failed(name + ' 打不开：' + bundle.message)
    if (!bundle.ok || bundle.key !== key || bundle.manifest.version !== entry.version) return failed(name + ' 和目录里的版本对不上')
    return { ok: /** @type {true} */ (true), files: bundle.files }
  }

  /** 老条目：代码三件和图片逐个下载。 */
  async function fromFiles(key, entry) {
    const assets = Object.keys(entry.files ?? {}).filter(name => name.startsWith('assets/')).map(name => name.slice('assets/'.length))
    if (!assets.every(name => ASSET_NAME.test(name))) return failed('目录里的图片名不对')
    const specs = fileList(assets).map(name => ({ name, spec: entry.files?.[name] }))
    for (const { name, spec } of specs) {
      if (!usable(spec)) return failed('目录里缺少 ' + name)
      if (!deps.sourceOk(spec.url)) return failed('来源不对：' + name)
    }
    // 几个文件一起下：慢的那个只拖自己，不把别的时间叠上去。
    const buffers = await inBatches(specs.map(({ name, spec }) => () => downloadFile(name, spec)), DOWNLOAD_PARALLEL).catch(error => (error instanceof Error ? error : new Error(String(error))))
    if (buffers instanceof Error) { deps.warn(`extension install failed: key="${key}" reason="${buffers.message}"`); return failed(buffers.message) }
    const files = new Map(specs.map(({ name }, index) => [name, buffers[index]]))
    let manifest = null
    try { manifest = JSON.parse(String(files.get('manifest.json'))) } catch { /* 下面按坏包处理 */ }
    const declared = assetNames(manifest)
    if (declared === null) {
      const why = describeAssetList(manifest)
      return failed('扩展的 manifest 图片清单不对' + (why === '' ? '' : '（' + why + '）'))
    }
    if (declared.length !== assets.length || !declared.every(name => assets.includes(name))) return failed('扩展的图片清单和目录对不上')
    return { ok: /** @type {true} */ (true), files }
  }

  /** @returns {Promise<{ok: true, files: Map<string, Buffer>} | {ok: false, reason: string, message: string}>} */
  function fetchExtension(key, entry) {
    return entry.bundle !== undefined ? fromBundle(key, entry) : fromFiles(key, entry)
  }

  return { fetchExtension }
}
