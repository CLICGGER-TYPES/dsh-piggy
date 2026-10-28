// @ts-check
/**
 * 已装扩展的发现、加载与调用（从 store/ext-runtime.js 拆出来的加载职责）。
 *
 * 下载来的扩展装在存档旁的 extensions/<key>/。启动时把 manifest 合法的目录都
 * 动态 import 一遍；某个扩展的 server.js 坏了只把自己标成 error，别的扩展和猪照常。
 * 这里负责硬盘读取、动态 import、ready 一次性加载、快照列表，以及已经加载的模块的
 * 动作和合并钩子；装/删/导入时的文件替换在 store/ext-install.js，面板视图在
 * store/ext-view.js。拆分只搬代码，不改变加载时机和失败隔离方式。
 * @module dsh-piggy/store/ext-load
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { extensionOn, openWallet } from '../core.js'
import { backfillExtensionEvents, runExtensionAction } from './ext-actions.js'
import { assetNames } from './ext-files.js'
import { LOCAL_MARK } from './ext-import.js'

/** 只接受普通对象/数组/字符串/有限数字/布尔/null；拒绝函数、循环引用和原型污染。 */
function plainData(value, depth) {
  if (depth > 64) throw new Error('mergeStates 返回值嵌套过深')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('mergeStates 返回值含非法数字')
    return value
  }
  if (Array.isArray(value)) return value.map(item => plainData(item, depth + 1))
  if (typeof value !== 'object') throw new Error('mergeStates 返回值含函数或未知类型')
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error('mergeStates 返回值必须是普通对象')
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('mergeStates 返回值含危险 key')
    out[key] = plainData(item, depth + 1)
  }
  return out
}

/**
 * @param {{
 *   store: any,
 *   root: () => string,
 *   loaded: Map<string, {manifest: any, module: any, error: string|null}>,
 *   now: () => number,
 *   keyPattern: RegExp,
 * }} deps
 */
export function createLoader(deps) {
  function readManifest(key) {
    try {
      const manifest = JSON.parse(readFileSync(join(deps.root(), key, 'manifest.json'), 'utf8'))
      return manifest !== null && typeof manifest === 'object' && manifest.key === key ? manifest : null
    } catch { return null }
  }

  /** 装在硬盘上的扩展（不管存档里有没有）。 */
  function installedKeys() {
    if (deps.root() === '' || !existsSync(deps.root())) return []
    return readdirSync(deps.root()).filter(name => deps.keyPattern.test(name) && readManifest(name) !== null)
  }

  async function load(key) {
    const manifest = readManifest(key)
    if (manifest === null) { deps.loaded.delete(key); return null }
    try {
      const file = join(deps.root(), key, 'server.js')
      const url = pathToFileURL(file).href + '?v=' + statSync(file).mtimeMs
      const imported = await import(url)
      const module = imported.default ?? imported
      deps.loaded.set(key, { manifest, module, error: null })
      backfillExtensionEvents(deps.store, { module }, { key, nowMs: deps.now() })
      // 已经装着的扩展更新后才声明货币：启动时就把钱包开好（汇率变了也在这里刷新）。
      const currency = manifest.economy?.currency
      const wallet = deps.store.state?.wallets?.[key]
      if (currency && deps.store.state?.extData?.[key] !== undefined && (wallet === undefined || wallet.rate !== Number(currency.rate) || wallet.label !== currency.label)) {
        deps.store.mutate(state => { openWallet(state, key, currency); return { ok: true } })
      }
    } catch (error) {
      deps.loaded.set(key, { manifest, module: null, error: error instanceof Error ? error.message : String(error) })
    }
    return deps.loaded.get(key)
  }

  /** 启动时把硬盘上的扩展都加载一遍。 */
  const ready = Promise.all(installedKeys().map(load)).catch(() => {})

  /** 快照里的扩展列表（下载来的那部分）。 */
  function list(state) {
    return [...deps.loaded.entries()].map(([key, entry]) => ({
      key,
      label: String(entry.manifest.label ?? key),
      emoji: String(entry.manifest.emoji ?? '🧩'),
      description: String(entry.manifest.description ?? ''),
      version: String(entry.manifest.version ?? ''),
      eventVersion: entry.module?.eventVersion === 1 || typeof entry.module?.progress === 'function' ? 1 : 0,
      on: extensionOn(state, key),
      installed: true,
      hasData: state?.extData?.[key] !== undefined,
      builtin: false,
      local: isLocal(key),
      app: entry.manifest.app ? { emoji: String(entry.manifest.app.emoji ?? entry.manifest.emoji ?? '🧩'), label: String(entry.manifest.app.label ?? entry.manifest.label ?? key) } : null,
      assets: assetNames(entry.manifest) ?? [],
      assetLayout: entry.manifest.assetLayout ?? {},
      error: entry.error,
      apps: [], dexSections: [], shopKinds: [],
    }))
  }

  /** 已加载扩展的 manifest 版本；没装时为 null，加载失败的扩展仍保留 manifest，因此仍返回它的版本（在线目录据此判断能不能更新）。 */
  function localVersion(key) {
    return deps.loaded.get(key)?.manifest?.version ?? null
  }

  /** 本地导入的扩展目录里有没有 local.json；在线目录不给它提示更新。 */
  function isLocal(key) {
    return existsSync(join(deps.root(), key, LOCAL_MARK))
  }

  function has(key) {
    return deps.loaded.has(key)
  }

  function forget(key) {
    deps.loaded.delete(key)
  }

  /** 执行扩展自己的动作；只交出它自己的数据。 */
  function act(key, op, payload) {
    const entry = deps.loaded.get(key)
    if (entry === undefined) return { ok: false, reason: 'unknown-extension' }
    if (entry.module === null) return { ok: false, reason: 'broken-extension' }
    const handler = entry.module.actions?.[op]
    if (typeof handler !== 'function') return { ok: false, reason: 'unknown' }
    return deps.store.mutate(state => runExtensionAction(state, handler, { key, payload, nowMs: deps.now(), currency: entry.manifest?.economy?.currency }))
  }

  /**
   * 合并钩子：只从目标端已安装、manifest 声明 mergeHook>=1 的扩展加载。
   * 扩展只能拿到自己的深拷贝，返回值必须是纯 JSON；不合格就抛错，降级为二选一。
   */
  function mergeStates() {
    const hooks = {}
    for (const [key, entry] of deps.loaded) {
      if (entry.module === null || typeof entry.module.mergeStates !== 'function') continue
      if (!Number.isInteger(entry.manifest?.mergeHook) || entry.manifest.mergeHook < 1) continue
      hooks[key] = (target, source) => {
        const result = entry.module.mergeStates(structuredClone(target), structuredClone(source))
        if (result === null || typeof result !== 'object' || Array.isArray(result)) throw new Error('mergeStates 必须返回对象')
        const clean = plainData(result, 0)
        if (JSON.stringify(clean).length > 1024 * 1024) throw new Error('mergeStates 返回值超过 1MB')
        if (!Object.hasOwn(clean, 'data') || clean.data === undefined) throw new Error('mergeStates 缺少 data')
        return clean
      }
    }
    return hooks
  }

  return { ready, load, installedKeys, list, localVersion, isLocal, has, forget, act, mergeStates }
}
