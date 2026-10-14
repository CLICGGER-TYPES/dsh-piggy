// @ts-check
/**
 * 下载扩展由哪些文件组成，以及下载出错时怎么说（ext-runtime / ext-import / 发版脚本共用）。
 *
 * - 代码三件：manifest.json、server.js、client.js，每个 ≤512KB。
 * - 图片（v0.36 起，用户 2026-10-11：扩展界面要用画好的素材）：manifest 里 `assets: ["bg.webp", …]` 列出，
 *   放在扩展目录的 `assets/` 里；在线目录的 `files` 里对应 `"assets/bg.webp": { url, sha256 }`。
 *   名字只许小写字母、数字、横线加 .webp / .png，单张 ≤512KB；0.37.1 起不限制图片张数和合计大小。
 *   面板里用 `app.asset('bg.webp')` 拿地址（GET /dsh-piggy/ext/<key>/assets/<name>）。
 * @module dsh-piggy/store/ext-files
 */

export const CODE_FILES = Object.freeze(['manifest.json', 'server.js', 'client.js'])
export const MAX_FILE_BYTES = 512 * 1024
export const ASSET_NAME = /^[a-z0-9][a-z0-9-]{0,47}\.(?:webp|png)$/
export const ASSET_TYPES = Object.freeze({ webp: 'image/webp', png: 'image/png' })

/**
 * manifest 里声明的图片名单；写错了返回 null（整个扩展当坏包拒绝，免得装上缺图）。
 * 哪里不对由 describeAssetList 说，免得两处判断走偏。
 * @param {any} manifest
 * @returns {string[]|null}
 */
export function assetNames(manifest) {
  const list = manifest?.assets
  if (list === undefined) return []
  return describeAssetList(manifest) === '' ? [...list] : null
}

/** 一个扩展的全部文件（相对扩展目录的路径）。 @param {string[]} assets */
export const fileList = assets => [...CODE_FILES, ...assets.map(name => 'assets/' + name)]

/** 给用户看的大小写法：KB / MB 各留一位小数，别只丢一串字节。 @param {number} bytes */
function size(bytes) {
  return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(1) + 'MB' : (bytes / 1024).toFixed(1) + 'KB'
}

/** 单个文件超过上限时怎么说（写清这个多大、上限多少、超了多少）。 @param {string} name @param {number} bytes @param {number} [limit] */
export function describeFileTooBig(name, bytes, limit = MAX_FILE_BYTES) {
  return `${name} 太大：${size(bytes)}，上限 ${size(limit)}，多了 ${size(bytes - limit)}`
}

/**
 * `manifest.assets` 哪里不对（名字不合法 / 重复），给报错指出真因；没问题返回 ''。
 * 和 assetNames 判为 null 的条件一一对应。
 * @param {any} manifest
 * @returns {string}
 */
export function describeAssetList(manifest) {
  const list = manifest?.assets
  if (list === undefined) return ''
  if (!Array.isArray(list)) return '图片清单得是一个数组'
  for (let index = 0; index < list.length; index += 1) {
    const name = list[index]
    if (typeof name !== 'string' || !ASSET_NAME.test(name)) return `第 ${index + 1} 张图片名不对：${String(name)}（只能小写字母、数字、横线加 .webp / .png）`
  }
  return new Set(list).size === list.length ? '' : '图片清单里有重复的名字'
}

/** 顺着 cause 链找最里层的错误码：fetch 失败时真正的原因藏在 cause 里。 */
function causeCode(error) {
  let current = error
  for (let depth = 0; depth < 5 && current !== null && typeof current === 'object'; depth += 1) {
    if (typeof current.code === 'string' && current.code !== '') return current.code
    current = current.cause
  }
  return ''
}

/** 一句话说清「为什么连不上」，给用户看也留给日志。 */
export function describeFetchError(error, url) {
  let host = url
  try { host = new URL(url).host } catch { /* 地址本身就不成形时原样写出来 */ }
  const code = causeCode(error)
  if (error?.name === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ETIMEDOUT') return `连接 ${host} 超时`
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') return `连接 ${host} 被中断`
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `域名 ${host} 解析不了`
  if (error?.name === 'AbortError') return `${host} 响应太慢`
  const detail = code !== '' ? code : (error instanceof Error ? error.message : String(error))
  return `连不上 ${host}（${detail}）`
}

/** 同时最多跑几个：图片有几十张，一起开连接国内直连 GitHub 更容易卡。 @template T @param {(() => Promise<T>)[]} jobs @param {number} limit */
export async function inBatches(jobs, limit) {
  /** @type {T[]} */
  const results = new Array(jobs.length)
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const index = next
      next += 1
      results[index] = await jobs[index]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker))
  return results
}
