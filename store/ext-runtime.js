// @ts-check
/**
 * 下载来的扩展（v0.30，设计见 docs/design/extension-download.md）。
 *
 * - 在线目录只从仓库的固定地址读（REGISTRY_URL），只装我们自己发布的；
 * - 每个文件下载后核对 sha256，`minGame` 高于当前游戏版本不装；
 * - 装在存档旁边的 `extensions/<key>/`，`server.js` 用动态 import 加载；
 * - 扩展只能改 `state.extData[key]`，动别的只能走这里给的 api（花钱、给东西、说话）；
 * - 扩展出错只影响它自己。
 * @module dsh-piggy/store/ext-runtime
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { extensionOn, installExtension, removeExtension } from '../core.js'
import { apiFor } from './ext-api.js'
import { backfillExtensionEvents, runExtensionAction } from './ext-actions.js'
import { CHANNEL } from '../channel.js'

/** 在线扩展目录：GitHub 或 Gitee，看打包时的渠道（channel.js）。 */
export const REGISTRY_URL = CHANNEL.registry
/** 扩展文件只许从本渠道的发行版附件和仓库原始文件下载。 */
export const ALLOWED_SOURCES = [CHANNEL.downloadBase + '/', CHANNEL.rawBase + '/']
const FILES = ['manifest.json', 'server.js', 'client.js']
const KEY = /^[a-z0-9-]{2,24}$/
const REGISTRY_TTL_MS = 10 * 60_000
const MAX_FILE_BYTES = 512 * 1024
/**
 * 国内直连 GitHub 很抖：同一个地址常常第一次连不上、几秒后就好了。
 * 所以每个文件都要有超时和重试，别让一次抖动变成「点了没反应」。
 */
const DOWNLOAD_ATTEMPTS = 3
const DOWNLOAD_TIMEOUT_MS = 12_000
const RETRY_BACKOFF_MS = [400, 1200]
const REGISTRY_ATTEMPTS = 2
const REGISTRY_TIMEOUT_MS = 10_000

/** 渠道名给日志和错误文案用（Gitee 包里不能写 GitHub）。 */
const CHANNEL_LABEL = { github: 'GitHub', gitee: 'Gitee' }[CHANNEL.name] ?? CHANNEL.name

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
function describeFetchError(error, url) {
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

const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms) })

/** 「0.31.0」≥「0.30.2」吗（测试版后缀不管）。 */
export function versionAtLeast(have, need) {
  const parse = text => String(text).split('-')[0].split('.').map(part => Number(part) || 0)
  const a = parse(have)
  const b = parse(need)
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return true
}

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')

/**
 * @param {any} store - createStore 的结果（要 filePath、state、mutate）
 * @param {object} options
 * @param {string} options.gameVersion
 * @param {typeof fetch} [options.fetch]
 * @param {string} [options.registryUrl] - 测试用；正式版永远是 REGISTRY_URL
 * @param {() => number} [options.now]
 * @param {(ms: number) => Promise<void>} [options.sleep] - 测试用，免得真等重试间隔
 */
export function createExtRuntime(store, options) {
  const doFetch = options.fetch ?? globalThis.fetch
  const registryUrl = options.registryUrl ?? REGISTRY_URL
  const now = options.now ?? (() => Date.now())
  const wait = options.sleep ?? sleep
  // 没有存档路径（测试里的假存档）就当一个扩展都没装。
  const root = () => typeof store.filePath === 'string' ? join(dirname(store.filePath), 'extensions') : ''
  /** @type {Map<string, {manifest: any, module: any, error: string|null}>} */
  const loaded = new Map()
  let registry = { at: 0, entries: /** @type {any[]} */ ([]), error: /** @type {string|null} */ (null) }

  /** 下载和目录读取的失败都从这里出去：控制台一份（进日志），返回值一份（进界面）。 */
  function warn(message) {
    console.warn(`[dsh-piggy] ${message}`)
    if (typeof store.journal === 'function') store.journal('warn', 'ext', message)
  }

  /** 拉一个文件：超时、网络抖动、坏包都再试；HTTP 4xx 和超大文件不重试。
   * @returns {Promise<{ok:boolean, retryable:boolean, message:string, buffer?:Buffer}>} */
  async function downloadOnce(name, spec) {
    let response
    try {
      response = await doFetch(spec.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
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
    if (buffer.length > MAX_FILE_BYTES) return { ok: false, retryable: false, message: `${name} 太大（${buffer.length} 字节）` }
    if (sha256(buffer) !== spec.sha256.toLowerCase()) return { ok: false, retryable: true, message: `${name} 校验不对，可能下载坏了` }
    return { ok: true, retryable: false, message: '', buffer }
  }

  /** 带重试的下载。每次失败都留一行日志，事后能看出是哪一步、试了几次。
   * @returns {Promise<Buffer>} 试完还不行就抛错，错误文案直接给用户看。 */
  async function downloadFile(name, spec) {
    let result = { ok: false, retryable: false, message: `${name} 没有下载` }
    let attempt = 0
    for (attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
      result = await downloadOnce(name, spec)
      if (result.ok === true && result.buffer !== undefined) return result.buffer
      warn(`extension download failed: file="${name}" attempt=${attempt}/${DOWNLOAD_ATTEMPTS} url="${spec.url}" reason="${result.message}"`)
      if (result.retryable !== true || attempt === DOWNLOAD_ATTEMPTS) break
      await wait(RETRY_BACKOFF_MS[attempt - 1] ?? 1200)
    }
    throw new Error(result.message + (attempt > 1 ? `（试了 ${attempt} 次）` : ''))
  }

  function readManifest(key) {
    try {
      const manifest = JSON.parse(readFileSync(join(root(), key, 'manifest.json'), 'utf8'))
      return manifest !== null && typeof manifest === 'object' && manifest.key === key ? manifest : null
    } catch { return null }
  }

  /** 装在硬盘上的扩展（不管存档里有没有）。 */
  function installedKeys() {
    if (root() === '' || !existsSync(root())) return []
    return readdirSync(root()).filter(name => KEY.test(name) && readManifest(name) !== null)
  }

  async function load(key) {
    const manifest = readManifest(key)
    if (manifest === null) { loaded.delete(key); return null }
    try {
      const file = join(root(), key, 'server.js')
      const url = pathToFileURL(file).href + '?v=' + statSync(file).mtimeMs
      const imported = await import(url)
      const module = imported.default ?? imported
      loaded.set(key, { manifest, module, error: null })
      backfillExtensionEvents(store, { module }, { key, nowMs: now() })
    } catch (error) {
      loaded.set(key, { manifest, module: null, error: error instanceof Error ? error.message : String(error) })
    }
    return loaded.get(key)
  }

  /** 启动时把硬盘上的扩展都加载一遍。 */
  const ready = Promise.all(installedKeys().map(load)).catch(() => {})

  /** 快照里的扩展列表（下载来的那部分）。 */
  function list(state) {
    return [...loaded.entries()].filter(([key]) => state?.extData?.[key] !== undefined).map(([key, entry]) => ({
      key,
      label: String(entry.manifest.label ?? key),
      emoji: String(entry.manifest.emoji ?? '🧩'),
      description: String(entry.manifest.description ?? ''),
      version: String(entry.manifest.version ?? ''),
      eventVersion: entry.module?.eventVersion === 1 || typeof entry.module?.progress === 'function' ? 1 : 0,
      on: extensionOn(state, key),
      installed: true,
      builtin: false,
      app: entry.manifest.app ? { emoji: String(entry.manifest.app.emoji ?? entry.manifest.emoji ?? '🧩'), label: String(entry.manifest.app.label ?? entry.manifest.label ?? key) } : null,
      error: entry.error,
      apps: [], dexSections: [], shopKinds: [],
    }))
  }

  /** 每个开着的下载扩展给它的 App 页的数据。 */
  function views(state) {
    const out = {}
    for (const [key, entry] of loaded) {
      if (state?.extData?.[key] === undefined || !extensionOn(state, key) || typeof entry.module?.view !== 'function') continue
      try { out[key] = entry.module.view(structuredClone(state.extData[key]), apiFor(structuredClone(state), key, { nowMs: now() })) } catch { out[key] = { error: true } }
    }
    return out
  }

  /** 开着的下载扩展给商店和图鉴的入口。 */
  function parts(state, field) {
    return Object.entries(views(state)).flatMap(([extension, view]) => {
      const part = view?.[field]
      return part !== null && typeof part === 'object' && !Array.isArray(part) ? [{ ...part, extension }] : []
    })
  }
  const shelves = state => parts(state, 'shelf')
  const dex = state => parts(state, 'dex')

  /** 读在线目录，带超时和一次重试：目录站也会抖。 */
  async function readRegistry() {
    let lastError = null
    for (let attempt = 1; attempt <= REGISTRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await doFetch(registryUrl, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
        })
        if (response.status === 404) throw new Error('目录还没发布')
        if (!response.ok) throw new Error(`${CHANNEL_LABEL} 返回 ${response.status}`)
        const parsed = await response.json()
        return Array.isArray(parsed?.extensions) ? parsed.extensions.filter(entry => KEY.test(entry?.key ?? '')) : []
      } catch (error) {
        lastError = error
        warn(`extension registry failed: attempt=${attempt}/${REGISTRY_ATTEMPTS} url="${registryUrl}" reason="${describeFetchError(error, registryUrl)}"`)
        if (attempt < REGISTRY_ATTEMPTS) await wait(RETRY_BACKOFF_MS[0])
      }
    }
    throw lastError
  }

  /** 在线目录（带缓存）；`force` 时重新读。 */
  async function online(force = false) {
    if (!force && now() - registry.at < REGISTRY_TTL_MS && registry.error === null && registry.at > 0) return registry
    try {
      registry = { at: now(), entries: await readRegistry(), error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      registry = { at: now(), entries: registry.entries, error: /fetch failed|ENOTFOUND|ECONN|timed? ?out/i.test(message) ? `连不上 ${CHANNEL_LABEL}` : message }
    }
    return registry
  }

  /** 在线扩展列表给面板：每个写清能不能装、为什么。 */
  async function onlineView(force = false) {
    const { entries, error } = await online(force)
    const state = store.state
    return {
      error,
      entries: entries.map(entry => {
        const installed = state === null ? false : (entry.builtin === true ? !(state.extensionsRemoved ?? []).includes(entry.key) : state.extData?.[entry.key] !== undefined)
        const tooNew = typeof entry.minGame === 'string' && !versionAtLeast(options.gameVersion, entry.minGame)
        // 已装的下载扩展：目录里版本更新就可以「更新」（重新下载，数据保留）。
        const local = loaded.get(entry.key)?.manifest?.version ?? null
        const update = installed && entry.builtin !== true && local !== null && typeof entry.version === 'string' && !versionAtLeast(local, entry.version)
        return {
          local, update,
          key: entry.key, label: String(entry.label ?? entry.key), emoji: String(entry.emoji ?? '🧩'),
          description: String(entry.description ?? ''), version: String(entry.version ?? ''), builtin: entry.builtin === true,
          installed, minGame: typeof entry.minGame === 'string' ? entry.minGame : null, blocked: tooNew ? 'game-too-old' : null,
        }
      }),
    }
  }

  /** 安装：内置的直接装回；下载的下载、核对、放好、加载，再在存档里建数据。 */
  async function install(key) {
    if (store.state === null) return { ok: false, reason: 'absent' }
    const { entries } = await online(false)
    const entry = entries.find(candidate => candidate.key === key)
    if (entry === undefined) return { ok: false, reason: 'unknown-extension' }
    if (entry.builtin === true) return store.mutate(state => installExtension(state, key))
    if (typeof entry.minGame === 'string' && !versionAtLeast(options.gameVersion, entry.minGame)) return { ok: false, reason: 'game-too-old', need: entry.minGame }
    const specs = FILES.map(name => ({ name, spec: entry.files?.[name] }))
    for (const { name, spec } of specs) {
      if (spec === undefined || typeof spec.url !== 'string' || typeof spec.sha256 !== 'string') return { ok: false, reason: 'download-failed', message: '目录里缺少 ' + name }
      if (!ALLOWED_SOURCES.some(prefix => spec.url.startsWith(prefix)) && options.registryUrl === undefined) return { ok: false, reason: 'download-failed', message: '来源不对：' + name }
    }
    const staging = join(root(), '.' + key + '-' + now())
    try {
      mkdirSync(staging, { recursive: true })
      // 三个文件一起下：慢的那个只拖自己，不把另外两个的时间叠上去。
      const buffers = await Promise.all(specs.map(({ name, spec }) => downloadFile(name, spec)))
      for (let index = 0; index < specs.length; index += 1) writeFileSync(join(staging, specs[index].name), buffers[index])
      const target = join(root(), key)
      rmSync(target, { recursive: true, force: true })
      renameSync(staging, target)
    } catch (error) {
      rmSync(staging, { recursive: true, force: true })
      const message = error instanceof Error ? error.message : String(error)
      warn(`extension install failed: key="${key}" reason="${message}"`)
      return { ok: false, reason: 'download-failed', message }
    }
    const entryLoaded = await load(key)
    if (entryLoaded === null || entryLoaded.module === null) return { ok: false, reason: 'broken-extension', message: entryLoaded?.error ?? '' }
    const initial = typeof entryLoaded.module.init === 'function' ? entryLoaded.module.init() : {}
    return store.mutate(state => installExtension(state, key, initial))
  }

  /** 删除：核心清数据；下载的再把文件删掉。 */
  function remove(key) {
    const result = store.mutate(state => removeExtension(state, key, now()))
    if (result.ok && loaded.has(key)) {
      loaded.delete(key)
      rmSync(join(root(), key), { recursive: true, force: true })
    }
    return result
  }

  /** 执行扩展自己的动作；只交出它自己的数据。 */
  function act(key, op, payload) {
    const entry = loaded.get(key)
    if (entry === undefined) return { ok: false, reason: 'unknown-extension' }
    if (entry.module === null) return { ok: false, reason: 'broken-extension' }
    const handler = entry.module.actions?.[op]
    if (typeof handler !== 'function') return { ok: false, reason: 'unknown' }
    return store.mutate(state => runExtensionAction(state, handler, { key, payload, nowMs: now() }))
  }

  /** 扩展的面板脚本（GET /dsh-piggy/ext/<key>/client.js）。 */
  function clientScript(key) {
    if (!KEY.test(key) || !loaded.has(key)) return null
    try { return readFileSync(join(root(), key, 'client.js'), 'utf8') } catch { return null }
  }

  return { ready, list, views, shelves, dex, onlineView, install, remove, act, clientScript }
}
