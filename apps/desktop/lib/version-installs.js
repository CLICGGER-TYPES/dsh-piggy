// @ts-check
/** 下载准备、令牌撤销与最终提交；取消准备不会关闭版本管理服务。 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { matchesPreparedFiles, unpackVersionFiles } from './version-files.js'

/**
 * @param {{ root: string, temporaryDir?: string,
 *   download: (url: string, headers: Record<string, string>, destination: string, onBytes?: (bytes: number) => void, signal?: AbortSignal) => Promise<{ ok: boolean, status: number }>,
 *   activate: (version: string) => void, installed: (version: string) => boolean, gameVersion: (directory: string) => string,
 *   saveVersion: () => number, recordSchema: (version: string, schema: number) => void }} options
 */
export function createVersionInstalls(options) {
  let sequence = 0
  let generation = 0
  let preparing = null
  let cancelling = null
  /** @type {Map<number, { version: string, directory: string, staging: string, files: string[], stateVersion: number, generation: number }>} */
  const preparedInstalls = new Map()

  async function prepareRelease(release, onProgress, signal, preparedGeneration) {
    signal.throwIfAborted()
    const version = String(release.version)
    if (!/^[0-9A-Za-z.+-]{1,40}$/.test(version) || version === '.' || version === '..') throw new Error('版本号不对')
    const urls = Array.isArray(release.packUrls) && release.packUrls.length > 0 ? release.packUrls : [String(release.packUrl)]
    const parts = Array.isArray(release.manifest.parts) ? release.manifest.parts : null
    if (parts !== null && parts.length !== urls.length) throw new Error('游戏包分卷对不上，没换')
    const total = Number(release.manifest.size) || 0
    mkdirSync(options.temporaryDir ?? options.root, { recursive: true })
    const directory = mkdtempSync(join(options.temporaryDir ?? options.root, 'prepare-'))
    const staging = join(directory, 'game')
    try {
      const pieces = []
      let got = 0
      for (let i = 0; i < urls.length; i += 1) {
        signal.throwIfAborted()
        const file = join(directory, `part-${i}.gz`)
        const res = await options.download(urls[i], { 'user-agent': 'dsh-piggy-desktop' }, file,
          bytes => { if (total > 0) onProgress(Math.min(1, (got + bytes) / total)) }, signal)
        signal.throwIfAborted()
        if (!res.ok) throw new Error(urls.length > 1 ? `第 ${i + 1}/${urls.length} 卷下载失败（${res.status}）` : `下载失败（${res.status}）`)
        const piece = readFileSync(file)
        if (parts !== null && createHash('sha256').update(piece).digest('hex') !== String(parts[i].sha256)) throw new Error(`第 ${i + 1} 卷校验不对，没换`)
        pieces.push(piece)
        got += piece.length
        rmSync(file)
      }
      const pack = Buffer.concat(pieces)
      const sha = createHash('sha256').update(pack).digest('hex')
      if (sha !== String(release.manifest.sha256)) throw new Error('下载的文件校验不对，没换')
      const files = unpackVersionFiles(pack, staging)
      const stateVersion = release.manifest.stateVersion
      if (!Number.isSafeInteger(stateVersion) || stateVersion < 0) throw new Error('游戏清单缺少有效存档版本，没换')
      const id = ++sequence
      onProgress(1)
      signal.throwIfAborted()
      preparedInstalls.set(id, { version, directory, staging, files, stateVersion, generation: preparedGeneration })
      return { id, version }
    } catch (error) {
      rmSync(directory, { recursive: true, force: true })
      throw error
    }
  }

  /** @param {{ version: string, manifest: any, packUrl?: string, packUrls?: string[] }} release @param {(fraction: number) => void} [onProgress] */
  function prepareInstall(release, onProgress = () => {}) {
    if (cancelling) return Promise.reject(new Error('正在取消游戏包准备，请稍候'))
    if (preparing) return Promise.reject(new Error('已有游戏包正在准备'))
    const state = { controller: new AbortController(), task: null }
    preparing = state
    const preparedGeneration = generation
    state.task = Promise.resolve().then(() => prepareRelease(release, onProgress, state.controller.signal, preparedGeneration))
      .finally(() => { if (preparing === state) preparing = null })
    return state.task
  }

  function commitInstall(prepared) {
    const entry = preparedInstalls.get(prepared.id)
    if (!entry || entry.version !== prepared.version || entry.generation !== generation) throw new Error('准备好的游戏版本已失效，请重新下载')
    if (entry.stateVersion < options.saveVersion()) throw new Error('存档太新，这个版本读不了，没换')
    const target = join(options.root, entry.version)
    if (existsSync(target)) {
      if (!options.installed(entry.version) || options.gameVersion(target) !== entry.version) throw new Error('已有版本目录不完整，没换')
      if (!matchesPreparedFiles(entry, target)) throw new Error('已有版本内容与本次下载的游戏包不一致，没换')
    } else {
      renameSync(entry.staging, target)
    }
    rmSync(entry.directory, { recursive: true, force: true })
    options.recordSchema(entry.version, entry.stateVersion)
    options.activate(entry.version)
    preparedInstalls.delete(prepared.id)
    return { ok: true, version: entry.version }
  }

  async function discardPrepared(prepared) {
    const entry = preparedInstalls.get(prepared.id)
    if (!entry || entry.version !== prepared.version) return
    rmSync(entry.directory, { recursive: true, force: true })
    preparedInstalls.delete(prepared.id)
  }

  /** @returns {Promise<void>} */
  function cancelPreparation() {
    if (cancelling) return cancelling
    generation += 1
    const state = preparing
    state?.controller.abort(new Error('游戏包准备已取消'))
    cancelling = (async () => {
      if (state) await Promise.allSettled([state.task])
      for (const [id, entry] of preparedInstalls) await discardPrepared({ id, version: entry.version })
    })().finally(() => { cancelling = null })
    return cancelling
  }

  async function finishInstall(prepared) {
    try { return commitInstall(prepared) }
    finally { await discardPrepared(prepared) }
  }

  /** @param {{ version: string, manifest: any, packUrl?: string, packUrls?: string[] }} release @param {(fraction: number) => void} [onProgress] */
  async function install(release, onProgress = () => {}) {
    return finishInstall(await prepareInstall(release, onProgress))
  }

  /** @param {{ version: string, manifest: any, urls: string[] }} pin @param {(fraction: number) => void} [onProgress] */
  async function preparePinned(pin, onProgress = () => {}) {
    if (pin === null || typeof pin !== 'object' || !Array.isArray(pin.urls) || pin.urls.length === 0 || typeof pin.manifest?.sha256 !== 'string') {
      throw new Error('安装包里的游戏清单坏了，请重新下载安装包')
    }
    return prepareInstall({ version: String(pin.version), manifest: pin.manifest, packUrls: pin.urls.map(String) }, onProgress)
  }

  /** @param {{ version: string, manifest: any, urls: string[] }} pin @param {(fraction: number) => void} [onProgress] */
  async function installPinned(pin, onProgress = () => {}) {
    return finishInstall(await preparePinned(pin, onProgress))
  }

  return { prepareInstall, preparePinned, commitInstall, discardPrepared, cancelPreparation, install, installPinned }
}
