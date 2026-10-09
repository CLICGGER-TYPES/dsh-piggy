// @ts-check
/**
 * 游戏热更新：从发行版（GitHub 或 Gitee，看 lib/channel.js）下载游戏包，校验后放进 userData/versions/<版本>/，
 * 下次启动就用它。安装包自带的那份是兜底；上一个版本留着，可以一键回退。
 *
 * 每个 Release 附两个文件（scripts/release-game.mjs 生成）：
 *   game-<版本>.manifest.json  { version, stateVersion, minShell, shellVersion, sha256, size, parts? }
 *   game-<版本>.json.gz        gzip 过的 { files: { 相对路径: base64 内容 } }
 * 游戏包超过发行版单个附件的上限（Gitee 100MiB）时拆成 game-<版本>.part-01.gz、-02 …，
 * manifest.parts 按顺序列出每卷的名字、大小、sha256；下载后按顺序拼回去再校验整包（外壳 0.6.3 起认）。
 *
 * Gitee 的 Windows 安装包不带游戏（离 100MiB 太近，2026-10-09 起）：安装包里只有 game-pin.json，
 * 写着配套的游戏版本和下载地址，第一次启动先下载（见 main.js 的 bootstrapGame）。
 *
 * 纯 Node（fetch、zlib、fs），不依赖 Electron；网络、时间都能换，测试直接跑。
 * @module dsh-piggy-desktop/versions
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { CHANNEL } from './channel.js'

export const RELEASES_URL = CHANNEL.releasesList
/** 版本列表问到之后半小时内不再问（GitHub 不登录每小时只给 60 次，两个窗口 + 重启很快就用完）。 */
export const RELEASES_TTL_MS = 30 * 60_000
export const RELEASES_PAGE = CHANNEL.releasesPage

/** `1.2.10` vs `1.2.9`, ignoring a leading v; missing parts count as 0. */
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

/**
 * @param {object} options
 * @param {string} options.userData   Electron's userData folder
 * @param {string} options.bundledDir the game shipped inside the installer
 * @param {string} options.shellVersion this app's own version
 * @param {string} options.statePath  the pig's save, to refuse versions too old to read it
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now] 测试用的时钟
 * @param {string} [options.releasesUrl]
 */
export function createVersions(options) {
  const doFetch = options.fetch ?? fetch
  const releasesUrl = options.releasesUrl ?? RELEASES_URL
  const root = join(options.userData, 'versions')
  const activeFile = join(root, 'active.json')
  /** 版本列表和各版本 manifest 存在本地：{ at, etag, releases, manifests: { 地址: manifest } }。 */
  const cacheFile = join(root, 'releases-cache.json')
  const now = options.now ?? (() => Date.now())
  /** @type {{ at: number, etag: string|null, releases: any[]|null, manifests: Record<string, any> }|null} */
  let cache = null
  /** @type {Promise<any[]>|null} 正在问的那一次，两个窗口同时来就共用 */
  let asking = null

  const readJson = file => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
  const gameVersion = dir => readJson(join(dir, 'package.json'))?.version ?? '?'
  const installed = version => existsSync(join(root, version, 'package.json'))
  /** Gitee 的 Windows 安装包不带游戏，只能用下载的。 */
  const hasBundled = existsSync(join(options.bundledDir, 'package.json'))

  /**
   * What active.json says, cleaned: `active` is a downloaded version or null for
   * the installer's own game; `previous` is where the last switch came from.
   */
  function record() {
    const saved = readJson(activeFile)
    if (saved === null) return { active: null, previous: null }
    // A new installer brings its own game; a choice made under the old one no longer holds.
    // 不带游戏的安装包没有「自带的」可回，换了外壳也接着用已经下载的那份。
    if (saved.shell !== options.shellVersion && hasBundled) return { active: null, previous: null }
    const active = typeof saved.active === 'string' && installed(saved.active) ? saved.active : null
    const previous = (saved.previous === 'bundled' && hasBundled) || (typeof saved.previous === 'string' && saved.previous !== 'bundled' && installed(saved.previous)) ? saved.previous : null
    return { active, previous: previous === (active ?? 'bundled') ? null : previous }
  }

  /** The folder the game should load from right now. */
  function activeDir() {
    const active = record().active
    return active === null ? options.bundledDir : join(root, active)
  }

  /** 现在没有能跑的游戏（不带游戏的安装包第一次启动，或下载的那份被删了）。 */
  function needsGame() {
    return !existsSync(join(activeDir(), 'package.json'))
  }

  /** The save's version, so older games that cannot read it are refused. */
  function saveVersion() {
    const save = readJson(options.statePath)
    return typeof save?.version === 'number' ? save.version : 0
  }

  function current() {
    const rec = record()
    return {
      version: gameVersion(activeDir()),
      bundled: rec.active === null,
      bundledVersion: hasBundled ? gameVersion(options.bundledDir) : null,
      shell: options.shellVersion,
      previous: rec.previous === 'bundled' ? gameVersion(options.bundledDir) : rec.previous,
      previousIsBundled: rec.previous === 'bundled',
    }
  }

  /** Fetch JSON, with a clear message instead of an exception for the panel. */
  async function getJson(url, etag = null) {
    const headers = { accept: 'application/vnd.github+json', 'user-agent': 'dsh-piggy-desktop', ...(etag ? { 'if-none-match': etag } : {}) }
    const res = await doFetch(url, { headers })
    if (res.status === 304) return { notModified: true, body: null, etag }
    if (!res.ok) throw new Error(res.status === 403 ? 'GitHub 暂时不让查了（每小时次数用完），过会儿再试' : `GitHub 回了 ${res.status}`)
    return { notModified: false, body: await res.json(), etag: res.headers?.get?.('etag') ?? null }
  }

  function loadCache() {
    if (cache !== null) return cache
    const saved = readJson(cacheFile)
    cache = {
      at: Number.isFinite(saved?.at) ? saved.at : 0,
      etag: typeof saved?.etag === 'string' ? saved.etag : null,
      releases: Array.isArray(saved?.releases) ? saved.releases : null,
      manifests: saved?.manifests !== null && typeof saved?.manifests === 'object' ? saved.manifests : {},
    }
    return cache
  }

  function saveCache() {
    try {
      mkdirSync(root, { recursive: true })
      writeFileSync(cacheFile + '.tmp', JSON.stringify(cache))
      renameSync(cacheFile + '.tmp', cacheFile)
    } catch { /* 存不下也不影响这次 */ }
  }

  /**
   * 发行版列表：半小时内用本地那份；过期或 `fresh`（点刷新）时带 ETag 去问，没变（304，不算次数）就接着用。
   * 问不到（限流、断网）但本地有，就先用本地的，不报错。
   */
  async function releaseList(fresh) {
    const saved = loadCache()
    if (!fresh && saved.releases !== null && now() - saved.at < RELEASES_TTL_MS) return saved.releases
    if (asking !== null) return asking
    asking = (async () => {
      try {
        const got = await getJson(releasesUrl, saved.releases !== null ? saved.etag : null)
        if (!got.notModified) {
          Object.assign(saved, { releases: Array.isArray(got.body) ? got.body : [], etag: got.etag })
          // 只留还在列表里的版本的 manifest，免得越攒越多。
          const live = new Set(saved.releases.flatMap(release => (Array.isArray(release?.assets) ? release.assets : []).map(asset => asset.browser_download_url)))
          saved.manifests = Object.fromEntries(Object.entries(saved.manifests).filter(([url]) => live.has(url)))
        }
        saved.at = now()
        saveCache()
        return /** @type {any[]} */ (saved.releases)
      } catch (error) {
        if (saved.releases !== null) return saved.releases
        throw error
      }
    })()
    try { return await asking } finally { asking = null }
  }

  /** @type {Map<string, Promise<any>>} 正在下的 manifest，同时来的共用 */
  const fetchingManifests = new Map()

  /** 某个发行版的 manifest：发布后不会变，下过一次就记住。 */
  async function manifestFor(url) {
    const saved = loadCache()
    if (saved.manifests[url] !== undefined) return saved.manifests[url]
    if (!fetchingManifests.has(url)) {
      fetchingManifests.set(url, getJson(url).then(got => {
        saved.manifests[url] = got.body
        saveCache()
        return got.body
      }).finally(() => fetchingManifests.delete(url)))
    }
    return fetchingManifests.get(url)
  }

  /**
   * Every release that carries a game package, newest first, with whether it
   * can be installed here and why not.
   */
  async function list({ fresh = false } = {}) {
    const releases = await releaseList(fresh)
    const here = current()
    const save = saveVersion()
    const out = []
    for (const release of Array.isArray(releases) ? releases : []) {
      if (release.draft) continue
      const assets = Array.isArray(release.assets) ? release.assets : []
      const manifestAsset = assets.find(a => /^game-.+\.manifest\.json$/.test(a.name))
      const packAsset = assets.find(a => /^game-.+\.json\.gz$/.test(a.name))
      const hasParts = assets.some(a => /^game-.+\.part-\d+\.gz$/.test(a.name))
      if (!manifestAsset || (!packAsset && !hasParts)) continue
      let manifest
      try { manifest = await manifestFor(manifestAsset.browser_download_url) } catch { continue }
      const packUrls = packUrlsFor(manifest, assets, packAsset)
      if (packUrls === null) continue
      const version = String(manifest.version ?? release.tag_name).replace(/^v/, '')
      let blocked = null
      if (compareVersions(manifest.minShell ?? '0', options.shellVersion) > 0) blocked = 'shell'
      else if (Number(manifest.stateVersion ?? 0) < save) blocked = 'save'
      const latestShell = manifest.shellVersion ?? manifest.minShell ?? null
      out.push({
        version, tag: release.tag_name, name: release.name || release.tag_name,
        date: String(release.published_at ?? '').slice(0, 10),
        notes: String(release.body ?? '').slice(0, 1200),
        prerelease: release.prerelease === true,
        current: version === here.version,
        blocked, minShell: manifest.minShell ?? null, latestShell,
        shellUpdate: latestShell !== null && compareVersions(latestShell, options.shellVersion) > 0,
        // Gitee 的发行版没有 html_url，按 tag 拼。
        page: release.html_url ?? `${RELEASES_PAGE}/tag/${release.tag_name}`,
        manifest, packUrl: packUrls[0], packUrls,
      })
    }
    out.sort((a, b) => compareVersions(b.version, a.version))
    return out
  }

  /**
   * Download, check and unpack one version, then make it the active one.
   * Nothing changes on disk until the package has passed its checksum.
   * 分卷的包按 manifest.parts 的顺序逐卷下载、逐卷校验，拼起来再校验整包。
   * @param {{ version: string, manifest: any, packUrl?: string, packUrls?: string[] }} release
   * @param {(fraction: number) => void} [onProgress]
   */
  async function install(release, onProgress = () => {}) {
    const version = String(release.version)
    if (!/^[0-9A-Za-z.+-]{1,40}$/.test(version)) throw new Error('版本号不对')
    const urls = Array.isArray(release.packUrls) && release.packUrls.length > 0 ? release.packUrls : [String(release.packUrl)]
    const parts = Array.isArray(release.manifest.parts) ? release.manifest.parts : null
    if (parts !== null && parts.length !== urls.length) throw new Error('游戏包分卷对不上，没换')
    const total = Number(release.manifest.size) || 0
    const pieces = []
    let got = 0
    for (let i = 0; i < urls.length; i += 1) {
      const res = await doFetch(urls[i], { headers: { 'user-agent': 'dsh-piggy-desktop' } })
      if (!res.ok || res.body === null) throw new Error(urls.length > 1 ? `第 ${i + 1}/${urls.length} 卷下载失败（${res.status}）` : `下载失败（${res.status}）`)
      const chunks = []
      for await (const chunk of /** @type {any} */ (res.body)) {
        chunks.push(chunk)
        got += chunk.length
        if (total > 0) onProgress(Math.min(1, got / total))
      }
      const piece = Buffer.concat(chunks)
      if (parts !== null && createHash('sha256').update(piece).digest('hex') !== String(parts[i].sha256)) throw new Error(`第 ${i + 1} 卷校验不对，没换`)
      pieces.push(piece)
    }
    const pack = Buffer.concat(pieces)
    const sha = createHash('sha256').update(pack).digest('hex')
    if (sha !== String(release.manifest.sha256)) throw new Error('下载的文件校验不对，没换')
    const files = JSON.parse(gunzipSync(pack).toString('utf8')).files
    if (files === null || typeof files !== 'object' || typeof files['package.json'] !== 'string') throw new Error('游戏包里少东西，没换')

    const target = join(root, version)
    const staging = `${target}.part`
    rmSync(staging, { recursive: true, force: true })
    for (const [rel, base64] of Object.entries(files)) {
      const file = normalize(join(staging, rel))
      if (!file.startsWith(staging + sep)) throw new Error('游戏包里有可疑路径，没换')
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, Buffer.from(String(base64), 'base64'))
    }
    rmSync(target, { recursive: true, force: true })
    renameSync(staging, target)
    activate(version)
    onProgress(1)
    return { ok: true, version }
  }

  /** Point at `version` (or 'bundled'), remembering where we came from. */
  function activate(version) {
    const rec = record()
    const was = rec.active ?? 'bundled'
    mkdirSync(root, { recursive: true })
    const next = { active: version === 'bundled' ? null : version, previous: was === version ? rec.previous : was, shell: options.shellVersion }
    writeFileSync(activeFile + '.tmp', JSON.stringify(next))
    renameSync(activeFile + '.tmp', activeFile)
  }

  /** Go back to the version used before the last switch. */
  function rollback() {
    const rec = record()
    if (rec.previous === null) return { ok: false, reason: '没有上一个版本' }
    activate(rec.previous)
    return { ok: true, version: current().version }
  }

  /**
   * 不带游戏的安装包第一次启动：装 game-pin.json 写好的那个版本（和安装包同一次构建）。
   * @param {{ version: string, manifest: any, urls: string[] }} pin
   * @param {(fraction: number) => void} [onProgress]
   */
  async function installPinned(pin, onProgress = () => {}) {
    if (pin === null || typeof pin !== 'object' || !Array.isArray(pin.urls) || pin.urls.length === 0 || typeof pin.manifest?.sha256 !== 'string') {
      throw new Error('安装包里的游戏清单坏了，请重新下载安装包')
    }
    return install({ version: String(pin.version), manifest: pin.manifest, packUrls: pin.urls.map(String) }, onProgress)
  }

  return { activeDir, current, list, install, installPinned, needsGame, rollback, saveVersion }
}

/**
 * 一个发行版里游戏包的下载地址：整包一个，分卷按 manifest.parts 的顺序；缺卷返回 null（这个版本不列出来）。
 * @param {any} manifest
 * @param {Array<{ name: string, browser_download_url: string }>} assets
 * @param {{ browser_download_url: string } | undefined} packAsset
 */
export function packUrlsFor(manifest, assets, packAsset) {
  if (!Array.isArray(manifest.parts)) return packAsset ? [packAsset.browser_download_url] : null
  const urls = []
  for (const part of manifest.parts) {
    const asset = assets.find(a => a.name === part?.name)
    if (!asset) return null
    urls.push(asset.browser_download_url)
  }
  return urls.length > 0 ? urls : null
}
