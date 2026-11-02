// @ts-check
/**
 * 在线扩展目录的读取与缓存（从 store/ext-runtime.js 拆出来的目录职责）。
 *
 * 目录地址固定在 channel.js 里，只在需要时读：一小时内复用内存里的那份，
 * 读失败后先用存档旁的缓存顶着、过几分钟再试；页面显式刷新时马上去问，
 * 但仍带 ETag，304 就保留原列表。这里只管远端目录和目录列表的展示字段，
 * 安装动作（重新读目录、下载、放文件）留给 store/ext-install.js。
 * @module dsh-piggy/store/ext-catalog
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describeFetchError } from './ext-files.js'

/** 在线目录读到之后一小时内不再问（用户 2026-10-09：请求一次本地有了就别一直问，免得撞 GitHub 上限）。 */
const REGISTRY_TTL_MS = 60 * 60_000
/** 读失败后多久再试；这段时间里先用存在本地的那份。 */
const REGISTRY_RETRY_MS = 5 * 60_000
/** 读目录失败后隔多久再试。 */
const RETRY_BACKOFF_MS = [400, 1200]
const REGISTRY_ATTEMPTS = 2
const REGISTRY_TIMEOUT_MS = 10_000

/**
 * @param {{
 *   fetch: typeof fetch,
 *   wait: (ms: number) => Promise<void>,
 *   now: () => number,
 *   warn: (message: string) => void,
 *   getState: () => any,
 *   root: () => string,
 *   registryUrl: string,
 *   channelLabel: string,
 *   keyPattern: RegExp,
 *   getGameVersion: () => string,
 *   versionAtLeast: (have: string, need: string) => boolean,
 *   localVersion: (key: string) => string|null,
 *   isLocal: (key: string) => boolean,
 * }} deps
 */
export function createCatalog(deps) {
  let registry = { at: 0, entries: /** @type {any[]} */ ([]), error: /** @type {string|null} */ (null), etag: /** @type {string|null} */ (null) }
  /** @type {Promise<typeof registry>|null} 正在读的那一次：同时来的请求（两个窗口）共用它。 */
  let reading = null
  /** 在线目录存到存档旁边，重启后先用它，过期了再带 ETag 去问有没有变。 */
  const registryFile = () => deps.root() === '' ? '' : join(deps.root(), 'registry-cache.json')

  function loadSavedRegistry() {
    if (registry.at > 0 || registryFile() === '' || !existsSync(registryFile())) return
    try {
      const saved = JSON.parse(readFileSync(registryFile(), 'utf8'))
      if (Array.isArray(saved?.entries) && Number.isFinite(saved?.at)) {
        registry = { at: saved.at, entries: saved.entries.filter(entry => deps.keyPattern.test(entry?.key ?? '')), error: null, etag: typeof saved.etag === 'string' ? saved.etag : null }
      }
    } catch { /* 坏了就当没有，下面重新读 */ }
  }

  function saveRegistry() {
    if (registryFile() === '') return
    try {
      mkdirSync(deps.root(), { recursive: true })
      writeFileSync(registryFile() + '.tmp', JSON.stringify({ at: registry.at, etag: registry.etag, entries: registry.entries }))
      renameSync(registryFile() + '.tmp', registryFile())
    } catch (error) { deps.warn(`extension registry cache not saved: ${error instanceof Error ? error.message : String(error)}`) }
  }

  /**
   * 读在线目录，带超时和一次重试：目录站也会抖。带上次的 ETag 问，没变（304）就返回 null，不用重新下。
   * @param {string|null} etag
   * @returns {Promise<{ entries: any[], etag: string|null }|null>}
   */
  async function readRegistry(etag) {
    let lastError = null
    for (let attempt = 1; attempt <= REGISTRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await deps.fetch(deps.registryUrl, {
          headers: etag === null ? { accept: 'application/json' } : { accept: 'application/json', 'if-none-match': etag },
          signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
        })
        if (response.status === 304) return null
        if (response.status === 404) throw new Error('目录还没发布')
        if (!response.ok) throw new Error(`${deps.channelLabel} 返回 ${response.status}`)
        const parsed = await response.json()
        const entries = Array.isArray(parsed?.extensions) ? parsed.extensions.filter(entry => deps.keyPattern.test(entry?.key ?? '')) : []
        return { entries, etag: response.headers?.get?.('etag') ?? null }
      } catch (error) {
        lastError = error
        deps.warn(`extension registry failed: attempt=${attempt}/${REGISTRY_ATTEMPTS} url="${deps.registryUrl}" reason="${describeFetchError(error, deps.registryUrl)}"`)
        if (attempt < REGISTRY_ATTEMPTS) await deps.wait(RETRY_BACKOFF_MS[0])
      }
    }
    throw lastError
  }

  /**
   * 在线目录（带缓存）：一小时内直接用上次的；失败了先用本地那份，5 分钟后才再试。
   * `force`（页面上点刷新）时马上去问，但仍带 ETag，没变就不重新下。
   * @param {boolean} [force]
   */
  async function online(force = false) {
    loadSavedRegistry()
    if (reading !== null) return reading
    const freshFor = registry.error === null ? REGISTRY_TTL_MS : REGISTRY_RETRY_MS
    if (!force && registry.at > 0 && deps.now() - registry.at < freshFor) return registry
    reading = (async () => {
      try {
        const got = await readRegistry(registry.entries.length > 0 ? registry.etag : null)
        registry = got === null
          ? { ...registry, at: deps.now(), error: null }
          : { at: deps.now(), entries: got.entries, error: null, etag: got.etag }
        saveRegistry()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        registry = { ...registry, at: deps.now(), error: /fetch failed|ENOTFOUND|ECONN|timed? ?out/i.test(message) ? `连不上 ${deps.channelLabel}` : message }
      }
      return registry
    })()
    try { return await reading } finally { reading = null }
  }

  /**
   * 在线扩展列表给面板：每个写清能不能装、为什么。
   * @param {boolean} [force]
   */
  async function onlineView(force = false) {
    const { entries, error } = await online(force)
    const state = deps.getState()
    return {
      error,
      entries: entries.map(entry => {
        const installed = state === null ? false : (entry.builtin === true ? !(state.extensionsRemoved ?? []).includes(entry.key) : state.extData?.[entry.key] !== undefined)
        const tooNew = typeof entry.minGame === 'string' && !deps.versionAtLeast(deps.getGameVersion(), entry.minGame)
        // 已装的下载扩展：目录里版本更新就可以「更新」（重新下载，数据保留）。
        const local = deps.localVersion(entry.key)
        const update = installed && entry.builtin !== true && local !== null && typeof entry.version === 'string' && !deps.versionAtLeast(local, entry.version)
          && !deps.isLocal(entry.key)
        return {
          local, update,
          key: entry.key, label: String(entry.label ?? entry.key), emoji: String(entry.emoji ?? '🧩'),
          description: String(entry.description ?? ''), version: String(entry.version ?? ''), builtin: entry.builtin === true,
          installed, minGame: typeof entry.minGame === 'string' ? entry.minGame : null, blocked: tooNew ? 'game-too-old' : null,
        }
      }),
    }
  }

  return { online, onlineView }
}
