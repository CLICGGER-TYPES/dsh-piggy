// @ts-check
/** Owner 云存档接线：配置串行、首次同步、历史、自动推送和关闭前的最终推送。 */
import { dirname } from 'node:path'

import { normalizeCloudSaveSettings } from './cloud-save-settings.js'
import { testGitRemote } from './git-sync.js'
import { createOwnerCloudSync } from './owner-cloud-sync.js'

/**
 * @param {{
 *   ownerDocumentPath:string,
 *   options:{cloudSave?:any},
 *   now:()=>number,
 *   state:import('./owner-runtime-state.js').OwnerRuntimeState,
 *   guards:{assertAccepting:()=>void},
 *   journal:{record:(level:string,scope:string,message:string,fields?:object)=>void},
 * }} deps
 */
export function createOwnerCloudController(deps) {
  const { ownerDocumentPath, options, now, state, guards, journal } = deps
  let cloudConfig = options.cloudSave ?? null
  let cloud = null
  let cloudTimer = null
  let cloudTransition = false
  let cloudConfigureTail = Promise.resolve()
  let cloudConfigureCount = 0

  function createCloud(config = cloudConfig) {
    if (config === null || typeof config !== 'object' || config.enabled !== true || config.syncReady !== true ||
        typeof config.remote !== 'string' || config.remote.trim() === '') return null
    return createOwnerCloudSync({
      ownerDocumentPath,
      ownerId: state.ownerId,
      remote: config.remote,
      branch: typeof config.branch === 'string' && config.branch !== '' ? config.branch : 'main',
      provider: typeof config.provider === 'string' ? config.provider : 'github',
      device: typeof config.device === 'string' ? config.device : '',
      baseHead: typeof config.cloudBaseHead === 'string' ? config.cloudBaseHead : null,
      now,
    })
  }

  function startCloudTimer() {
    if (cloud === null || cloudTimer !== null) return
    const debounceMs = typeof cloudConfig?.debounceMs === 'number' && Number.isFinite(cloudConfig.debounceMs) && cloudConfig.debounceMs > 0
      ? cloudConfig.debounceMs : 10 * 60 * 1000
    cloudTimer = setInterval(() => {
      const current = cloud
      if (cloudTransition || current === null) return
      void current.pushSnapshot().then(result => {
        if (result?.ok === true) return
        journal.record('warn', 'cloud', '完整云存档推送未应用', {
          reason: typeof result?.reason === 'string' ? result.reason : 'CLOUD_FAILED',
        })
      }).catch(error => {
        const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'CLOUD_FAILED'
        journal.record('warn', 'cloud', '完整云存档推送失败', { code })
      })
    }, debounceMs)
    cloudTimer.unref?.()
  }

  async function configureCloudSaveNow(value) {
    guards.assertAccepting()
    let normalized
    try { normalized = normalizeCloudSaveSettings(value) }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '云存档设置无效' } }
    const previous = cloudConfig
    const sameConnection = previous?.enabled === true && normalized.enabled === true &&
      previous.provider === normalized.provider && previous.remote === normalized.remote && previous.branch === normalized.branch
    const next = { ...normalized,
      syncReady: value?.syncReady === true || (sameConnection && previous?.syncReady === true),
      cloudBaseHead: typeof value?.cloudBaseHead === 'string' ? value.cloudBaseHead :
        (sameConnection && typeof previous?.cloudBaseHead === 'string' ? previous.cloudBaseHead : null),
    }
    cloudTransition = true
    if (cloudTimer !== null) { clearInterval(cloudTimer); cloudTimer = null }
    const old = cloud
    cloud = null
    try {
      await old?.close()
      cloudConfig = next
      cloud = createCloud(next)
      if (cloud !== null) startCloudTimer()
      return { ok: true, enabled: cloud !== null }
    } catch {
      cloudConfig = previous
      cloud = createCloud(previous)
      if (cloud !== null) startCloudTimer()
      return { ok: false, reason: '云存档设置暂时无法应用' }
    } finally { cloudTransition = false }
  }

  function configureCloudSave(value) {
    cloudConfigureCount += 1
    const pending = cloudConfigureTail.then(() => configureCloudSaveNow(value))
    cloudConfigureTail = pending.then(() => { cloudConfigureCount -= 1 }, () => { cloudConfigureCount -= 1 })
    return pending
  }

  async function firstSyncCloud(direction) {
    guards.assertAccepting()
    if (cloudConfig?.enabled !== true || typeof cloudConfig.remote !== 'string' || cloudConfig.remote.trim() === '') {
      return { ok: false, reason: '请先启用并保存仓库地址' }
    }
    const current = cloud
    const temporary = current === null ? createOwnerCloudSync({
      ownerDocumentPath, ownerId: state.ownerId, remote: cloudConfig.remote,
      branch: typeof cloudConfig.branch === 'string' && cloudConfig.branch !== '' ? cloudConfig.branch : 'main',
      provider: typeof cloudConfig.provider === 'string' ? cloudConfig.provider : 'github',
      device: typeof cloudConfig.device === 'string' ? cloudConfig.device : '', now,
      baseHead: typeof cloudConfig.cloudBaseHead === 'string' ? cloudConfig.cloudBaseHead : null,
    }) : null
    const service = current ?? temporary
    if (service === null) return { ok: false, reason: '云存档服务不可用' }
    try { return await service.firstSync(direction) }
    finally { await temporary?.close() }
  }

  async function testCloudSave(value) {
    let config
    try { config = normalizeCloudSaveSettings({ ...value, enabled: value?.enabled === true }) }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '云存档设置无效' } }
    if (!config.remote) return { ok: false, reason: '请先填写仓库地址' }
    return testGitRemote({ remote: config.remote, cwd: dirname(ownerDocumentPath) })
  }

  /** @param {unknown} targetBranch */
  function history(targetBranch) {
    if (cloud === null || cloudTransition) return Promise.resolve({ ok: false, reason: '云存档尚未完成首次同步' })
    return cloud.history(targetBranch).then(historyValue => ({ ok: true, ...historyValue }), () => ({ ok: false, reason: '云端历史暂时无法读取' }))
  }

  function status() {
    return { enabled: cloud !== null, ready: cloudConfig?.syncReady === true && cloud !== null,
      branch: typeof cloudConfig?.branch === 'string' ? cloudConfig.branch : 'main' }
  }

  function init() {
    cloud = createCloud()
    startCloudTimer()
  }

  function stopTimer() {
    if (cloudTimer !== null) { clearInterval(cloudTimer); cloudTimer = null }
  }

  /** @param {boolean} hasFault */
  async function pushAndClose(hasFault) {
    stopTimer()
    /** @type {{ok:boolean,reason?:string}} */
    let cloudPush = { ok: false, reason: 'disabled' }
    if (cloud !== null) {
      try {
        cloudPush = hasFault ? { ok: false, reason: 'runtime-fault' } : await cloud.pushSnapshot()
        await cloud.close()
      } catch { cloudPush = { ok: false, reason: 'final-push-failed' } }
    }
    cloud = null
    return cloudPush
  }

  return {
    init,
    configure: configureCloudSave,
    test: testCloudSave,
    firstSync: firstSyncCloud,
    history,
    status,
    stopTimer,
    pendingConfigures: () => cloudConfigureCount,
    whenConfiguresSettled: () => cloudConfigureTail,
    pushAndClose,
  }
}
