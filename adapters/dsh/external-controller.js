// @ts-check
/**
 * DSH 外部桌宠控制器：发现、连接、暂存/恢复、投递、面板代理、合并与退役。
 *
 * 内嵌运行时只在普通模式存在；外部模式关闭它，工作事件只进 outbox，面板请求
 * 通过独立令牌的配对接口转发。合并期间源端冻结，提交成功后退役。
 *
 * @module dsh-piggy/adapters/dsh/external-controller
 */

import { randomUUID } from 'node:crypto'
import { renameSync } from 'node:fs'

import { mergeSummary } from '../../core.js'
import { readStateFile } from '../../store/state-file.js'
import { detectDesktop, readEndpoints } from './external-discovery.js'
import { createPairClient, createWorkClient } from './external-client.js'
import { configPath, dshHomes, readConfig, stateFingerprint, writeConfig } from './external-files.js'
import { recoverRetirement } from './external-merge.js'
import { createOutbox } from './external-outbox.js'
import { createExternalPanel } from './external-panel.js'
import { createLifecycle, readReceipts } from './external-lifecycle.js'
import { createCommitFlow } from './external-commit.js'
import { prepareLiveSource, preparePausedSource } from './external-prepare.js'
import { createDelivery } from './external-delivery.js'

const BUSY_STATES = new Set(['merging', 'rolling-back', 'merge-unknown'])

/**
 * @param {object} options
 * @param {string} options.statePath
 * @param {any} options.embedded { ensure(), stop(), runtime() }
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 * @param {string} [options.gameVersion]
 * @param {(mode:'normal'|'external')=>void} [options.onModeChange]
 * @param {(message:string)=>void} [options.warn]
 * @param {string} [options.dshHome]
 * @param {string[]} [options.markerPaths]
 * @param {number} [options.timeoutMs]
 */
export function createExternalController(options) {
  const statePath = options.statePath
  const now = options.now ?? (() => Date.now())
  const fetchImpl = options.fetch ?? globalThis.fetch
  const warn = options.warn ?? (message => console.warn(`[dsh-piggy] ${message}`))
  const homes = dshHomes(options.dshHome)
  const markerPaths = options.markerPaths ?? undefined
  let endpoint = null
  let marker = null
  let target = null
  let lastSnapshot = null
  let lastAt = null
  let error = null
  let mode = 'normal'
  let connection = 'disconnected'
  let preview = null
  let expiryTimer = null
  let configCorrupt = false
  let commandName = 'pig'

  const outbox = createOutbox({ statePath, now, warn })
  let read = readConfig(statePath)
  let config = read.ok ? read.config : null
  if (!read.ok && !read.missing) {
    configCorrupt = true
    try { renameSync(configPath(statePath), `${configPath(statePath)}.corrupt-${now()}`) } catch { /* evidence kept */ }
    warn('external-pet.json unreadable; kept a copy and will not open the embedded save')
  }

  const client = createPairClient({ fetch: fetchImpl, endpoint: () => endpoint })
  const workClient = createWorkClient({ fetch: fetchImpl, workEndpoint: () => endpoint?.work })

  function saveConfig(next) {
    config = writeConfig(statePath, { ...next, updatedAt: now() })
    return config
  }

  function applyMode(next) {
    if (mode === next) return
    mode = next
    options.onModeChange?.(next)
  }

  function baseConfig() {
    return {
      version: 1,
      pigState: config?.pigState ?? 'paused',
      connection,
      clientId: config?.clientId ?? randomUUID(),
      target: target ?? config?.target ?? null,
      suspendedAt: config?.suspendedAt ?? null,
      stateHash: config?.stateHash ?? null,
      mergeId: config?.mergeId ?? null,
      previewToken: null,
      lastSummary: config?.lastSummary ?? lastSnapshot?.pig ?? null,
    }
  }

  async function refresh() {
    if (configCorrupt) return { ok: false, reason: 'config-corrupt' }
    const result = await detectDesktop({ fetch: fetchImpl, markerPaths, homes, now, timeoutMs: options.timeoutMs ?? 3000 })
    if (!result.ok) {
      error = result.reason
      if (!BUSY_STATES.has(connection)) connection = mode === 'external' && connection === 'connected' ? 'reconnecting' : 'disconnected'
      return result
    }
    endpoint = { pair: result.pair, work: result.work }
    marker = result.marker
    target = result.target
    error = null
    if (!BUSY_STATES.has(connection)) connection = 'connected'
    if (config !== null) saveConfig({ ...config, target, lastSummary: result.target.summary ?? config.lastSummary })
    return result
  }

  /** 摘要是否一样：只比紧凑摘要里的字段，变了才写配置，别每 4 秒写一次盘。 */
  function sameSummary(a, b) {
    if (a === b) return true
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
    return a.name === b.name && a.level === b.level && a.days === b.days && a.coins === b.coins &&
      a.items === b.items && a.badges === b.badges && a.dead === b.dead && a.hatched === b.hatched && a.box === b.box
  }

  /**
   * 面板真拿到快照/动作结果后，用它刷新桌面猪的摘要。
   *
   * 设置卡片以前只读第一次探测的 /pair/info 摘要，面板里买了东西还是旧金币。
   * 这里只在真实结果回来之后才改（不按请求乐观改余额），pid/版本这些发现字段原样保留。
   * @param {any} summary summarizeSnapshot() 的紧凑摘要
   */
  function noteTargetSummary(summary) {
    if (summary === null || typeof summary !== 'object') return
    const known = target ?? config?.target ?? null
    if (known === null || sameSummary(known.summary ?? null, summary)) return
    const nextTarget = target === null ? { ...known, summary } : { ...target, summary }
    if (target !== null) target = nextTarget
    if (config !== null) saveConfig({ ...config, target: nextTarget })
  }

  async function refreshEndpoints() {
    if (marker === null) {
      const detected = await detectDesktop({ fetch: fetchImpl, markerPaths, homes, now, timeoutMs: options.timeoutMs ?? 3000 })
      if (detected.ok) { endpoint = { pair: detected.pair, work: detected.work }; marker = detected.marker; target = detected.target }
      return
    }
    const refreshed = readEndpoints(marker)
    if (refreshed !== null) endpoint = refreshed
  }

  function link() {
    // merged/dead 是只读展示字段：顶部标签据此区分「已合并」和「桌面猪已离开」。
    const summary = lastSnapshot?.pig?.dead === true ? { dead: true } : (target?.summary ?? null)
    return {
      state: mode === 'normal' ? 'connected' : connection,
      lastAt,
      queued: outbox.status().queued,
      merged: config?.pigState === 'merged',
      dead: summary?.dead === true || lastSnapshot?.dead === true,
    }
  }

  function snapshotsSummary() {
    try {
      const state = readStateFile(statePath, now()).state
      return state === null ? null : mergeSummary(state)
    } catch { return null }
  }

  function status() {
    const queue = outbox.status()
    const localSummary = config?.localSummary ?? (mode === 'normal' ? snapshotsSummary() : null)
    const desktop = target === null ? { found: false, running: true, enabled: false, reason: error ?? '', appVersion: '', gameVersion: '', stateVersion: 0, mergeRulesVersion: 0, pid: 0 } : {
      found: true, running: true, enabled: true, reason: error ?? '',
      appVersion: target.appVersion ?? '', gameVersion: target.gameVersion ?? '',
      stateVersion: target.stateVersion ?? 0, mergeRulesVersion: target.mergeRulesVersion ?? 0, pid: target.pid ?? 0,
    }
    return {
      ok: true,
      mode: mode === 'normal' ? 'embedded' : 'external',
      pigState: config?.pigState ?? 'none',
      connection: mode === 'normal' ? 'embedded' : connection,
      clientId: config?.clientId ?? null,
      target: target === null ? (config?.target ?? null) : { ...target, enabled: target.enabled ?? true, reason: error ?? '' },
      desktop,
      source: { summary: localSummary, hasPig: localSummary !== null },
      lastSummary: config?.lastSummary ?? lastSnapshot?.pig ?? null,
      queued: queue.queued,
      queueBytes: queue.bytes,
      dropped: queue.dropped,
      lastAt,
      error: error ?? (configCorrupt ? 'config-corrupt' : null),
      preview: preview === null ? null : { mergeId: preview.mergeId, expiresAt: preview.expiresAt },
      mergeId: config?.mergeId ?? preview?.mergeId ?? null,
      can: {
        connect: mode === 'normal',
        merge: mode === 'normal' || config?.pigState === 'paused',
        rollback: config?.pigState === 'merged',
        restoreEmbedded: config?.pigState === 'merged',
        act: mode === 'external' && connection === 'connected',
      },
      merged: config?.pigState === 'merged',
      canMerge: mode === 'normal' || config?.pigState === 'paused',
      canRollback: config?.pigState === 'merged',
      canRecoverInternal: config?.pigState === 'merged',
      canAct: mode === 'external' && connection === 'connected',
      configCorrupt,
      retirementPending: config?.retirementPending === true,
    }
  }

  async function freezeSource() {
    if (mode === 'external' && config?.pigState === 'paused') {
      const loaded = readStateFile(statePath, now())
      return { state: loaded.state, receipts: readReceipts(statePath), runtimeId: null, epoch: null, live: false }
    }
    const runtime = options.embedded.ensure()
    if (runtime === undefined || typeof runtime.exclusive !== 'function') throw Object.assign(new Error('embedded runtime unavailable'), { code: 'embedded-unavailable' })
    let result = null
    await runtime.exclusive(async () => { result = runtime.snapshotForWrite(); return null })
    if (result === null) throw Object.assign(new Error('embedded runtime returned no state'), { code: 'embedded-unavailable' })
    return { .../** @type {any} */ (result), live: true }
  }

  const ctx = {
    statePath, now, options, outbox, client, workClient,
    getConfig: () => config,
    setConfig: next => { config = next },
    saveConfig, baseConfig, refresh, refreshEndpoints,
    getMode: () => mode,
    setMode: applyMode,
    getConnection: () => connection,
    setConnection: next => { connection = next },
    getPreview: () => preview,
    setPreview: next => { preview = next },
    getExpiry: () => expiryTimer,
    setExpiry: next => { expiryTimer = next },
    getTarget: () => target,
    getMarker: () => marker,
    setError: next => { error = next },
    isConfigCorrupt: () => configCorrupt,
    freezeSource,
    stopEmbedded: () => options.embedded.stop(),
    embedded: () => options.embedded,
    scheduleDelivery: delay => delivery.schedule(delay),
    markSeen: () => { lastAt = now() },
    status, link,
  }
  const lifecycle = createLifecycle(ctx)
  // 提交失败分支要用取消预览/恢复源端；这两个方法在 lifecycle 里，创建后再挂回上下文。
  ctx.cancelPreview = reason => lifecycle.cancelPreview(reason)
  ctx.resumeSource = (suspendedAt, options) => lifecycle.resumeSource(suspendedAt, options)
  const commit = createCommitFlow(ctx)
  const delivery = createDelivery({
    outbox, workClient, active: () => mode === 'external' && !closed,
    refreshEndpoints: () => { void refreshEndpoints() },
    setError: next => { error = next },
  })
  let closed = false

  const panel = createExternalPanel({
    fetch: fetchImpl,
    endpoint: () => endpoint,
    status,
    clientId: () => config?.clientId ?? 'dsh-external',
    lastSnapshot: () => lastSnapshot,
    setSnapshot: snapshot => { lastSnapshot = snapshot },
    noteSummary: summary => { noteTargetSummary(summary) },
    markSeen: () => { lastAt = now() },
    refreshEndpoints: () => { void refreshEndpoints() },
  })
  ctx.getPanel = () => panel

  async function init() {
    outbox.load()
    const retirement = recoverRetirement(statePath)
    if (configCorrupt) {
      applyMode('external')
      connection = 'disconnected'
      return status()
    }
    if (retirement.retired) {
      applyMode('external')
      connection = 'connecting'
      await refresh().catch(() => {})
      if (config?.pigState === 'merge-unknown') setTimeout(() => { void commit.pollMergeStatus() }, 1000).unref?.()
      delivery.schedule(0)
      return status()
    }
    if (config !== null && config.pigState !== 'none') {
      applyMode('external')
      connection = 'connecting'
      await refresh().catch(() => {})
      if (config.pigState === 'merge-unknown') setTimeout(() => { void commit.pollMergeStatus() }, 1000).unref?.()
      delivery.schedule(0)
      return status()
    }
    applyMode('normal')
    outbox.resume()
    delivery.schedule(0)
    return status()
  }

  // 源端终结串行化：暂存期间直接改 state 文件，避免并发请求互相覆盖。
  let sourceQueue = Promise.resolve()
  function prepareSource(target) {
    const run = sourceQueue.then(() => (mode === 'external' && config?.pigState === 'paused'
      ? preparePausedSource(ctx, target)
      : prepareLiveSource(ctx, target)))
    sourceQueue = run.then(() => undefined, () => undefined)
    return run
  }

  async function prepare(target, side = 'target') {
    if (!['activity', 'pomodoro', 'fishing'].includes(target)) return { ok: false, reason: 'unknown-target' }
    if (side === 'source') return prepareSource(target)
    const detected = await refresh()
    if (!detected.ok) return { ok: false, reason: detected.reason }
    try {
      const response = await client.prepare({ clientId: config?.clientId ?? randomUUID(), requestId: randomUUID(), target })
      if (response.status !== 200 || response.json === null) return { ok: false, reason: response.status === 401 ? 'unauthorized' : 'desktop-busy' }
      return response.json
    } catch { return { ok: false, reason: 'disconnected' } }
  }

  return {
    init, refresh, status, link, panel, outbox, prepare,
    setCommandName(name) { commandName = name },
    get commandName() { return commandName },
    connect: mode => lifecycle.connect(mode),
    previewMerge: () => lifecycle.previewMerge(),
    cancelPreview: reason => lifecycle.cancelPreview(reason),
    disconnect: flags => lifecycle.disconnect(flags),
    commitMerge: choices => commit.commitMerge(choices),
    pollMergeStatus: () => commit.pollMergeStatus(),
    rollbackMerge: mergeId => commit.rollbackMerge(mergeId),
    restoreEmbedded: name => commit.restoreEmbedded(name),
    retryRetirement: () => commit.retryRetirement(),
    enqueue(event) {
      if (mode !== 'external') return { ok: false, reason: 'embedded' }
      const result = outbox.add(event)
      delivery.schedule(0)
      return result
    },
    close() {
      closed = true
      delivery.close()
      if (expiryTimer !== null) clearTimeout(expiryTimer)
      outbox.flush()
    },
    get mode() { return mode },
    get connection() { return connection },
    get config() { return config },
    get endpoint() { return endpoint },
    get previewState() { return preview },
  }
}

export { BUSY_STATES }
