// @ts-check
/**
 * 下载/导入扩展的安装、替换与删除（从 store/ext-runtime.js 拆出来的安装职责）。
 *
 * 安装分两步：ext-catalog 给目录条目，ext-download 把文件取回并核对；这里负责
 * 把文件写进 extensions/<key>/、加载并在存档里建数据。文件先写临时目录再换名，
 * 写一半失败不会留半截。换名后如果 load 失败，当前做法与拆分前一致：返回
 * broken-extension，不改存档数据，但新文件已经替换旧文件（T04 需覆盖这个边界）。
 * 删除先让核心清数据，成功后再卸载模块、删目录；内置扩展的重新安装仍走核心。
 * @module dsh-piggy/store/ext-install
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { installExtension, openWallet, removeExtension } from '../core.js'
import { ASSET_NAME, CODE_FILES } from './ext-files.js'
import { LOCAL_MARK, makeImporter } from './ext-import.js'

/**
 * @param {{
 *   store: any,
 *   root: () => string,
 *   now: () => number,
 *   downloads: { fetchExtension: (key: string, entry: any) => Promise<any> },
 *   online: (force?: boolean) => Promise<{ entries: any[] }>,
 *   load: (key: string) => Promise<any>,
 *   hasLoaded: (key: string) => boolean,
 *   forgetLoaded: (key: string) => void,
 *   warn: (message: string) => void,
 *   getGameVersion: () => string,
 *   versionAtLeast: (have: string, need: string) => boolean,
 * }} deps
 */
export function createInstaller(deps) {
  /** 安装：内置的直接装回；下载的下载、核对、放好、加载，再在存档里建数据。 */
  async function install(key) {
    if (deps.store.state === null) return { ok: false, reason: 'absent' }
    // 玩家明确点安装或更新时重新核对目录，避免沿用一小时旧链接；离线仍保留已校验缓存。
    const { entries } = await deps.online(true)
    const entry = entries.find(candidate => candidate.key === key)
    if (entry === undefined) return { ok: false, reason: 'unknown-extension' }
    if (entry.builtin === true) return deps.store.mutate(state => installExtension(state, key))
    if (typeof entry.minGame === 'string' && !deps.versionAtLeast(deps.getGameVersion(), entry.minGame)) return { ok: false, reason: 'game-too-old', need: entry.minGame }
    const got = await deps.downloads.fetchExtension(key, entry)
    if (!got.ok) return got
    return place(key, got.files, false)
  }

  /** 把扩展的文件（相对路径 → 内容）放进扩展目录（先放临时目录再换名，坏了不留半截）、加载、在存档里建数据。local 是本地导入的非官方扩展。
   * @param {string} key @param {Map<string, Buffer>} files @param {boolean} local */
  async function place(key, files, local) {
    if (key === 'farm' && deps.store.state?.extData?.farm?.version >= 4) {
      const manifest = JSON.parse(files.get('manifest.json').toString('utf8'))
      // 第一课把菜园数据升到 v5；旧 3.1.0/4.0.x 会把它误作 v3 迁移，必须在替换文件前拒绝。
      const currentData = deps.store.state.extData.farm.version
      const compatible = currentData < 5 ? deps.versionAtLeast(manifest.version, '3.1.0')
        : deps.versionAtLeast(manifest.version, '4.1.0') || (deps.versionAtLeast(manifest.version, '3.1.1') && !deps.versionAtLeast(manifest.version, '4.0.0'))
      if (!compatible) {
        return { ok: false, reason: 'download-failed', message: '这份旧菜园不能读取当前进度，请使用 4.1.0 或 3.1.1 经典兼容版；菜币和进度未改动。' }
      }
    }
    const staging = join(deps.root(), '.' + key + '-' + deps.now())
    try {
      mkdirSync(join(staging, 'assets'), { recursive: true })
      for (const [name, buffer] of files) {
        if (!CODE_FILES.includes(name) && !(name.startsWith('assets/') && ASSET_NAME.test(name.slice('assets/'.length)))) throw new Error('不认识的文件：' + name)
        writeFileSync(join(staging, name), buffer)
      }
      if (local) writeFileSync(join(staging, LOCAL_MARK), JSON.stringify({ importedAt: deps.now() }))
      const target = join(deps.root(), key)
      rmSync(target, { recursive: true, force: true })
      renameSync(staging, target)
    } catch (error) {
      rmSync(staging, { recursive: true, force: true })
      return { ok: false, reason: 'download-failed', message: error instanceof Error ? error.message : String(error) }
    }
    const entryLoaded = await deps.load(key)
    if (entryLoaded === null || entryLoaded.module === null) return { ok: false, reason: 'broken-extension', message: entryLoaded?.error ?? '' }
    const initial = typeof entryLoaded.module.init === 'function' ? entryLoaded.module.init() : {}
    // 装上就开钱包（声明了货币的），扩展页顶上马上有余额条。
    return deps.store.mutate(state => {
      const result = installExtension(state, key, initial)
      if (result.ok) openWallet(state, key, entryLoaded.manifest?.economy?.currency)
      return result
    })
  }

  /** 本地导入扩展包（store/ext-import.js）：官方的直接装；不是官方的先说明，用户确认后才装。 */
  const importBundle = makeImporter({
    ready: () => deps.store.state !== null && deps.root() !== '',
    gameVersion: deps.getGameVersion(),
    versionAtLeast: deps.versionAtLeast,
    online: deps.online,
    place,
    warn: deps.warn,
  })

  /** 删除：核心清数据；下载的再把文件删掉。 */
  function remove(key) {
    const result = deps.store.mutate(state => removeExtension(state, key, deps.now()))
    if (result.ok && deps.hasLoaded(key)) {
      deps.forgetLoaded(key)
      rmSync(join(deps.root(), key), { recursive: true, force: true })
    }
    return result
  }

  return { install, importBundle, remove }
}
