// @ts-check
/** Background release checks shared by the desktop app and the DSH client. */

import { readStore, writeStore } from './storage.js'
import { CHANNEL } from '../../channel.js'

const READ_KEY = 'dsh-piggy:update-read'
const NOTIFIED_KEY = 'dsh-piggy:update-notified'
/** 网页版问到的最新正式版存在这台设备上，6 小时内刷新页面不再问（GitHub 不登录每小时 60 次）。 */
const LATEST_CACHE_KEY = 'dsh-piggy:latest-release'
export const LATEST_CACHE_MS = 6 * 60 * 60 * 1000
/** 最新正式版的接口：GitHub 或 Gitee，看打包时的渠道（channel.js）。 */
export const GITHUB_LATEST = CHANNEL.latestRelease

/**
 * Compare versions like semver: numbers first, and a prerelease (0.27.3-rc.2) sorts
 * before its release (0.27.3). The old split-on-dash version treated rc.2 as newer
 * than 0.27.3, so a tester would never be offered the final release.
 */
export function compareVersions(a, b) {
  const split = value => {
    const [main, pre] = String(value).replace(/^v/, '').split('-', 2)
    return { main: main.split('.').map(part => Number.parseInt(part, 10) || 0), pre: pre === undefined ? null : pre.split('.') }
  }
  const left = split(a), right = split(b)
  for (let i = 0; i < Math.max(left.main.length, right.main.length); i += 1) {
    if ((left.main[i] ?? 0) !== (right.main[i] ?? 0)) return (left.main[i] ?? 0) - (right.main[i] ?? 0)
  }
  if (left.pre === null || right.pre === null) return (left.pre === null ? 1 : 0) - (right.pre === null ? 1 : 0)
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i += 1) {
    const x = left.pre[i], y = right.pre[i]
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    if (x === y) continue
    const nx = Number(x), ny = Number(y)
    if (Number.isInteger(nx) && Number.isInteger(ny)) return nx - ny
    return x < y ? -1 : 1
  }
  return 0
}

/** Newest stable release from a list in any order. */
export function newestRelease(releases) {
  return (Array.isArray(releases) ? releases : [])
    .filter(release => release && release.prerelease !== true)
    .sort((a, b) => compareVersions(b.version, a.version))[0] ?? null
}

/** Fetch the newest public release (GitHub or Gitee, per channel) for the DSH notification-only page. */
export async function fetchGithubLatest(doFetch = fetch) {
  const response = await doFetch(GITHUB_LATEST, { headers: { accept: 'application/vnd.github+json' }, cache: 'no-store' })
  if (!response.ok) throw new Error((CHANNEL.name === 'gitee' ? 'Gitee ' : 'GitHub ') + response.status)
  const release = await response.json()
  if (release?.draft === true || release?.prerelease === true) return null
  const version = String(release?.tag_name ?? '').replace(/^v/, '')
  if (version === '') return null
  return {
    version,
    // Gitee 的发行版没有 html_url，按 tag 拼出发行版页面。
    page: String(release?.html_url ?? CHANNEL.releasesPage + '/tag/' + String(release?.tag_name ?? '')),
    notes: String(release?.body ?? '').slice(0, 1200),
    prerelease: false,
  }
}

/**
 * @param {object} options
 * @param {() => string} options.currentVersion
 * @param {() => any} options.getDesktop
 * @param {() => Promise<any>} options.fetchLatest
 * @param {(key:string) => string|null} options.read
 * @param {(key:string,value:string) => void} options.write
 * @param {() => boolean} options.canBubble
 * @param {() => boolean} [options.isViewing]
 * @param {(text:string) => void} options.showBubble
 * @param {() => void} options.changed
 */
export function createUpdateNotice(options) {
  let remote = null
  let latest = null
  let unread = false
  let checking = false
  let checked = false
  let error = null
  let timer = null
  let interval = null

  function signalId(candidate) {
    if (candidate === null) return ''
    return [candidate.kind, candidate.version, candidate.latestShell ?? ''].join(':')
  }

  function maybeBubble() {
    if (!unread || latest === null || !options.canBubble()) return
    const id = signalId(latest)
    if (options.read(NOTIFIED_KEY) === id) return
    const text = latest.kind === 'shell'
      ? '桌面版有更新啦，去更新 App 看看吧～'
      : '有新版本 v' + latest.version + ' 啦，去更新看看吧～'
    options.showBubble(text)
    options.write(NOTIFIED_KEY, id)
  }

  function accept(candidate, newest) {
    latest = candidate
    remote = newest
    const id = signalId(candidate)
    unread = candidate !== null && options.read(READ_KEY) !== id
    if (unread && options.isViewing?.()) {
      options.write(READ_KEY, id)
      unread = false
    }
    checking = false
    checked = true
    error = null
    maybeBubble()
    options.changed()
  }

  async function check() {
    if (checking) return
    checking = true
    error = null
    try {
      const desktop = options.getDesktop()
      if (desktop !== null && desktop?.updates) {
        const [current, result] = await Promise.all([desktop.updates.current(), desktop.updates.list()])
        if (!result?.ok) throw new Error(result?.reason || '没问到 GitHub')
        const newest = newestRelease(result.releases)
        const gameNew = newest !== null && compareVersions(newest.version, current?.version ?? options.currentVersion()) > 0
        const shellNew = newestRelease((result.releases ?? []).filter(release => release.shellUpdate === true))
        let candidate = null
        if (gameNew) candidate = { ...newest, kind: newest.blocked === 'shell' ? 'shell' : 'game' }
        else if (shellNew !== null) candidate = { ...shellNew, kind: 'shell' }
        accept(candidate, newest)
        return
      }
      const newest = await options.fetchLatest()
      const candidate = newest !== null && compareVersions(newest.version, options.currentVersion()) > 0
        ? { ...newest, kind: 'game' }
        : null
      accept(candidate, newest)
    } catch (caught) {
      checking = false
      error = caught instanceof Error ? caught.message : '检查更新失败'
      options.changed()
    }
  }

  /** 调试页用：假装有一个新正式版，看红点和设置里的提示长什么样。 */
  function simulate(version) {
    latest = { version: String(version), kind: 'game', prerelease: false }
    unread = true
    options.changed()
  }

  function markRead() {
    if (latest === null) return
    options.write(READ_KEY, signalId(latest))
    unread = false
    options.changed()
  }

  function start() {
    timer = window.setTimeout(check, 10_000)
    interval = window.setInterval(check, 6 * 60 * 60 * 1000)
  }

  function stop() {
    if (timer !== null) window.clearTimeout(timer)
    if (interval !== null) window.clearInterval(interval)
    timer = null
    interval = null
  }

  return {
    check, markRead, maybeBubble, simulate, start, stop,
    get latest() { return latest },
    get remote() { return remote },
    get unread() { return unread },
    get checking() { return checking },
    get checked() { return checked },
    get error() { return error },
  }
}

/**
 * 网页版的「最新正式版」：6 小时内用这台设备上存的那份，过期才去问；问不到就先用旧的。
 * @param {() => Promise<any>} fetchLatest
 * @param {{ read: (key: string) => string|null, write: (key: string, value: string) => void, now?: () => number }} store
 */
export async function cachedLatest(fetchLatest, store) {
  const now = store.now ? store.now() : Date.now()
  let saved = null
  try { saved = JSON.parse(store.read(LATEST_CACHE_KEY) || 'null') } catch { saved = null }
  if (saved !== null && typeof saved.at === 'number' && now - saved.at < LATEST_CACHE_MS) return saved.release ?? null
  try {
    const release = await fetchLatest()
    store.write(LATEST_CACHE_KEY, JSON.stringify({ at: now, release }))
    return release
  } catch (error) {
    if (saved !== null) return saved.release ?? null
    throw error
  }
}

/** Wire the release checker into the mounted client and start its timers. */
export function attachUpdateNotice(ctx, getDesktop, doFetch = fetch) {
  const notice = createUpdateNotice({
    currentVersion: () => ctx.view.version,
    getDesktop,
    fetchLatest: () => cachedLatest(() => fetchGithubLatest(doFetch), { read: readStore, write: writeStore }),
    read: readStore,
    write: writeStore,
    canBubble: () => ctx.view.pig !== null && ctx.bubble.hidden !== false,
    showBubble: text => ctx.showBubble(text, 4000),
    isViewing: () => ctx.tab === 'update',
    changed: () => {
      if (!ctx.stopped && ctx.isOpen && (ctx.tab === 'home' || ctx.tab === 'update')) ctx.renderContent()
    },
  })
  ctx.updateNotice = notice
  notice.start()
  return notice
}
