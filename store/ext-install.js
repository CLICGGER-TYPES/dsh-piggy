// @ts-check
/**
 * 下载/导入扩展的安装、替换与删除（从 store/ext-runtime.js 拆出来的安装职责）。
 *
 * 安装分两步：ext-catalog 给目录条目，ext-download 把文件取回并核对；这里负责
 * 把文件写进 extensions/<key>/、加载并在存档里建数据。文件先写临时目录再换名，
 * 写一半失败不会留半截。
 *
 * 替换是一次「文件 + 加载表 + 存档」的事务：旧目录先换名留底，新目录就位后先用
 * ext-load 的 inspect 试加载（不碰 loaded 表和存档）、跑 init，最后才登记新模块、
 * 补进度、开钱包、在存档里建数据。任何一步失败都撤掉新目录、把旧目录换回来、放回
 * 旧的模块和进事务前的存档；第一次安装失败则什么都不留。旧目录只在整次安装成功后
 * 删除；换不回来时留在备份目录并如实报错，绝不为了「干净」删掉还能救的旧文件。
 * 同一个扩展名的安装按 key 排队，两个窗口同时点更新不会互相换走对方的目录。
 * 删除先让核心清数据，成功后再卸载模块、删目录；内置扩展的重新安装仍走核心。
 * @module dsh-piggy/store/ext-install
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { installExtension, openWallet, removeExtension } from '../src/host/core.js'
import { isExtensionFile } from './ext-files.js'
import { validateAssetPackFiles } from './ext-asset-packs.js'
import { LOCAL_MARK, makeImporter } from './ext-import.js'

/** 和 store/ext-runtime.js 的目录名校验一致（key 不能爬出 extensions/）。 */
const KEY = /^[a-z0-9-]{2,24}$/

/**
 * @param {{
 *   store: any,
 *   root: () => string,
 *   now: () => number,
 *   downloads: { fetchExtension: (key: string, entry: any) => Promise<any> },
 *   online: (force?: boolean) => Promise<{ entries: any[] }>,
 *   whenLoaded: (key: string) => Promise<any>,
 *   inspect: (key: string, cacheToken?: string) => Promise<any>,
 *   adopt: (key: string, entry: any) => void,
 *   snapshotLoaded: (key: string) => any,
 *   restoreLoaded: (key: string, entry: any) => void,
 *   hasLoaded: (key: string) => boolean,
 *   forgetLoaded: (key: string) => void,
 *   warn: (message: string) => void,
 *   getGameVersion: () => string,
 *   versionAtLeast: (have: string, need: string) => boolean,
 * }} deps
 */
export function createInstaller(deps) {
  /** 同一个扩展名的安装排队做；前一次失败也要让后一次接着跑。 */
  const queues = new Map()
  /** 临时目录/备份目录的后缀：now() 可能在同一毫秒返回两次，加序号避免撞名。 */
  let sequence = 0

  function inOrder(key, task) {
    const previous = queues.get(key) ?? Promise.resolve()
    const next = previous.then(task, task)
    const tail = next.catch(() => {})
    queues.set(key, tail)
    void tail.then(() => { if (queues.get(key) === tail) queues.delete(key) })
    return next
  }

  const nextStamp = () => String(deps.now()) + '-' + String(sequence += 1)
  const failure = (reason, message) => ({ ok: /** @type {false} */ (false), reason, message })
  const errorText = error => error instanceof Error ? error.message : String(error)

  /** 删自己建的文件/目录；删不掉时返回原因，交给调用方决定怎么报告。 */
  function safeRemove(path) {
    try {
      rmSync(path, { recursive: true, force: true })
      return null
    } catch (error) {
      return errorText(error)
    }
  }

  /** 用进事务前的快照恢复存档；快照和恢复之间没有 await，不会被别的操作插进来。 */
  function restoreState(snapshot) {
    if (snapshot === null) return true
    try {
      const result = deps.store.mutate(state => {
        for (const name of Object.keys(state)) delete state[name]
        Object.assign(state, snapshot)
        return { ok: true }
      })
      return result.ok === true
    } catch {
      return false
    }
  }

  /** 撤掉新目录、把旧目录换回来；换不回来就留在备份目录并说清路径。 */
  function restoreFiles(target, backup, hadTarget) {
    const removed = safeRemove(target)
    if (removed !== null) return { ok: false, message: '新文件没删掉：' + target + '（' + removed + '）' }
    if (!hadTarget) return { ok: true, message: '' }
    if (!existsSync(backup)) return { ok: false, message: '旧文件的备份不见了：' + backup }
    try {
      renameSync(backup, target)
      return { ok: true, message: '' }
    } catch (error) {
      return { ok: false, message: '旧文件还留在 ' + backup + '，没能自动换回来：' + errorText(error) }
    }
  }

  /**
   * 失败收尾：撤掉新文件、放回旧模块、恢复进事务前的存档。原来的扩展存在时把旧文件
   * 一起换回来；第一次安装失败则什么都不留。恢复本身失败也不删旧文件，把备份路径写进
   * 错误里。detail 是真正的失败原因，不能吞掉。
   */
  function rollback(key, target, backup, hadTarget, previous, stateBefore, reason, detail) {
    const files = restoreFiles(target, backup, hadTarget)
    const stateRestored = stateBefore === null || restoreState(stateBefore)
    deps.restoreLoaded(key, previous)
    const parts = []
    if (detail !== '') parts.push(String(detail))
    if (files.ok === true && stateRestored) {
      parts.push(hadTarget ? '原来的扩展和存档没有改动。' : '没有装上新文件。')
    } else {
      if (files.ok === true) parts.push(hadTarget ? '原来的文件已经放回。' : '没有装上新文件。')
      else parts.push(hadTarget ? '原来的文件没能自动换回来。' : '新文件没能删干净。', files.message)
      if (!stateRestored) parts.push('存档没能恢复到安装前。')
    }
    return failure(reason, parts.join('；'))
  }

  /** 旧目录已经换到备份、新目录还没就位时，把旧目录原样换回来；别碰还在原位的旧目录。 */
  function restoreOldOnly(target, backup, oldMoved) {
    if (!oldMoved) return { ok: true, message: '' }
    try {
      renameSync(backup, target)
      return { ok: true, message: '' }
    } catch (error) {
      return { ok: false, message: '旧文件还留在 ' + backup + '，没能自动换回来：' + errorText(error) }
    }
  }

  /** 换文件：旧目录留底、新目录就位；失败只还原已经挪走的旧目录并清理 staging。 */
  function swapFiles(target, staging, backup, hadTarget) {
    let oldMoved = false
    try {
      if (hadTarget) { renameSync(target, backup); oldMoved = true }
      renameSync(staging, target)
      return null
    } catch (error) {
      // 第一步换名失败时旧目录还在 target，不能删；只有旧目录已经挪走才把它换回来。
      const restored = restoreOldOnly(target, backup, oldMoved)
      safeRemove(staging)
      const detail = errorText(error)
      return failure('download-failed', restored.ok === true ? detail : detail + '；' + restored.message)
    }
  }

  /** 只读试加载新文件；失败就回滚，成功才把模块交给 commit。
   * @returns {Promise<{entry?: any, error?: any}>} */
  async function probe(key, target, backup, hadTarget, previous, staging) {
    let entry
    try {
      entry = await deps.inspect(key, 'install-' + basename(staging))
    } catch (error) {
      return { error: rollback(key, target, backup, hadTarget, previous, null, 'broken-extension', errorText(error)) }
    }
    if (entry === null || entry.module === null) {
      return { error: rollback(key, target, backup, hadTarget, previous, null, 'broken-extension', entry?.error ?? 'manifest.json 读不懂') }
    }
    return { entry }
  }

  /** 成功路径：登记新模块、补进度/钱包、跑 init、写存档，最后才删旧备份；中途失败整体回滚。 */
  function commit(key, target, backup, hadTarget, previous, entry) {
    let stateBefore
    try {
      stateBefore = deps.store.state === null ? null : structuredClone(deps.store.state)
    } catch (error) {
      return rollback(key, target, backup, hadTarget, previous, null, 'broken-extension', '存档快照失败：' + errorText(error))
    }
    try {
      deps.adopt(key, entry)
      const initial = typeof entry.module.init === 'function' ? entry.module.init() : {}
      const result = deps.store.mutate(state => {
        const installed = installExtension(state, key, initial)
        if (installed.ok) openWallet(state, key, entry.manifest?.economy?.currency)
        return installed
      })
      if (result.ok !== true) {
        return rollback(key, target, backup, hadTarget, previous, stateBefore, result.reason ?? 'broken-extension', result.message ?? '')
      }
      if (hadTarget) {
        const leftover = safeRemove(backup)
        if (leftover !== null) deps.warn('扩展装好了，但旧文件备份没删掉：' + backup + '（' + leftover + '）')
      }
      return result
    } catch (error) {
      return rollback(key, target, backup, hadTarget, previous, stateBefore, 'broken-extension', errorText(error))
    }
  }

  /** 真正的替换事务：staging 已经写好，旧目录在这里才换走，失败就按 rollback 还原。 */
  async function replace(key, staging, backup) {
    // 等这个扩展在启动时的那次加载结束，避免旧模块的加载结果刚好在新文件就位后才写回 loaded 表。
    try {
      await deps.whenLoaded(key)
    } catch (error) {
      safeRemove(staging)
      return failure('broken-extension', '等待上一次加载失败：' + errorText(error))
    }
    const target = join(deps.root(), key)
    const hadTarget = existsSync(target)
    const previous = deps.snapshotLoaded(key)
    const swapped = swapFiles(target, staging, backup, hadTarget)
    if (swapped !== null) return swapped
    const probed = await probe(key, target, backup, hadTarget, previous, staging)
    if (probed.error !== undefined) return probed.error
    return commit(key, target, backup, hadTarget, previous, probed.entry)
  }

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
    if (deps.store.state === null) return failure('absent', '')
    if (!KEY.test(key)) return failure('unknown-extension', '')
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
    const root = deps.root()
    if (root === '') return failure('absent', '')
    const checked = validateAssetPackFiles(key, files)
    if (checked.ok !== true) return failure('download-failed', '素材包校验失败：' + checked.message)
    const stamp = nextStamp()
    const staging = join(root, '.' + key + '-' + stamp)
    const backup = join(root, '.' + key + '-' + stamp + '.bak')
    try {
      mkdirSync(join(staging, 'assets'), { recursive: true })
      for (const [name, buffer] of files) {
        if (!isExtensionFile(name)) throw new Error('不认识的文件：' + name)
        const target = join(staging, name)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, buffer)
      }
      if (local) writeFileSync(join(staging, LOCAL_MARK), JSON.stringify({ importedAt: deps.now() }))
    } catch (error) {
      safeRemove(staging)
      return failure('download-failed', errorText(error))
    }
    return inOrder(key, () => replace(key, staging, backup))
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
    if (result.ok) {
      if (deps.hasLoaded(key)) deps.forgetLoaded(key)
      const root = deps.root()
      if (root !== '' && KEY.test(key)) rmSync(join(root, key), { recursive: true, force: true })
    }
    return result
  }

  return { install, importBundle, remove }
}
