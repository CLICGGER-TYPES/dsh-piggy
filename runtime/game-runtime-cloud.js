// @ts-check
/**
 * 旧版单 target runtime 的云存档接线：Git 同步、自动推送、手动路由和设置串行化。
 *
 * 这些逻辑原本长在 runtime/index.js 的闭包里；抽出来是为了让组合根只负责
 * 生命周期顺序。这里仍由组合根提供 Store、exclusive 和存档替换，模块不反向
 * import 组合根，依赖保持单向。
 */
import { dirname } from 'node:path'

import { createCloudRoutes } from './cloud-routes.js'
import { normalizeCloudSaveSettings } from './cloud-save-settings.js'
import { createGitSync, testGitRemote } from './git-sync.js'
import { createSaveArchive, parseSaveArchive } from './save-archive.js'

/**
 * @param {{
 *   options:any,
 *   getStore:() => any,
 *   getSpecialActive:() => Set<Promise<unknown>>,
 *   exclusive:(operation:() => Promise<any>, allowClosing?: boolean) => Promise<any>,
 *   replaceSaveFiles:(files:Map<string, Buffer>, backup:Buffer) => Promise<unknown>,
 *   assertAccepting:() => void,
 * }} deps
 */
export function createRuntimeCloud(deps) {
  const { options, getStore, getSpecialActive, exclusive, replaceSaveFiles, assertAccepting } = deps
  let cloudConfig = options.cloudSave ?? null
  let cloud = null
  let cloudTimer = null
  let cloudTransition = false
  let cloudConfigureTail = Promise.resolve()
  let cloudConfigureCount = 0

  function createCloudSync(config = cloudConfig) {
    if (config === null || typeof config !== 'object' || config.enabled !== true || config.syncReady === false) return null
    const remote = typeof config.remote === 'string' ? config.remote.trim() : ''
    if (remote === '') return null
    const branch = typeof config.branch === 'string' && config.branch !== '' ? config.branch : 'main'
    const device = typeof config.device === 'string' ? config.device : ''
    const debounceMs = typeof config.debounceMs === 'number' && Number.isFinite(config.debounceMs) && config.debounceMs > 0
      ? config.debounceMs : 10 * 60 * 1000
    const archive = () => {
      // Store 会被 open()/导入/合并替换；每次归档都读当前 Store，不能缓存旧句柄。
      const store = getStore()
      const built = createSaveArchive({ statePath: options.statePath, state: store?.state ?? null })
      return {
        buffer: built.buffer,
        name: built.name,
        summary: built.summary,
        stateVersion: store?.state?.version ?? null,
        lastSeenAt: store?.state?.lastSeenAt ?? null,
        level: built.summary?.level ?? null,
        coins: store?.state?.coins ?? null,
      }
    }
    const sync = createGitSync({
      statePath: options.statePath,
      remote,
      branch,
      device,
      insecureSkipTlsVerify: config.insecureSkipTlsVerify === true,
      archive,
      parse: (_name, buffer) => parseSaveArchive(buffer),
      importFiles: files => replaceSaveFiles(files, archive().buffer),
    })
    return { sync, remote, branch, device, debounceMs, lastPushAt: 0 }
  }

  function startCloudTimer() {
    if (cloud === null || cloudTimer !== null) return
    cloudTimer = setInterval(() => {
      const activeCloud = cloud
      if (cloudTransition || activeCloud === null) return
      void cloudSequence(activeCloud, sync => exclusive(() => sync.pushSnapshot(), true))
        .then(() => { if (cloud === activeCloud) activeCloud.lastPushAt = Date.now() })
        .catch(error => {
          const cause = /** @type {any} */ (error)
          if (cause?.code !== 'CLOUD_DISABLED') getStore()?.journal?.record?.('warn', 'cloud', '云存档推送失败', { reason: String(cause?.message ?? cause) })
        })
    }, cloud.debounceMs)
    cloudTimer.unref?.()
  }

  function activeCloud() {
    if (cloudTransition || cloud === null) throw Object.assign(new Error('云存档尚未启用或配置不完整'), { code: 'CLOUD_DISABLED', status: 409 })
    return cloud
  }

  function cloudSequence(current, operation) {
    return current.sync.sequence(sync => {
      // A queued operation accepted before the user closed or changed settings
      // must not start a new Git command against the previous remote.
      if (cloudTransition || cloud !== current) throw Object.assign(new Error('云存档设置已更改'), { code: 'CLOUD_DISABLED', status: 409 })
      return operation(sync)
    })
  }

  function cloudRouteList() {
    const getCloud = () => activeCloud()
    return createCloudRoutes({
      status: async () => cloud === null
        ? { enabled: false, remoteConfigured: false, lastPushAt: 0 }
        : { enabled: true, remoteConfigured: true, branch: cloud.branch, device: cloud.device, lastPushAt: cloud.lastPushAt },
      branches: () => { const current = getCloud(); return cloudSequence(current, sync => sync.listBranches()) },
      pull: branch => { const current = getCloud(); return cloudSequence(current, sync => exclusive(() => sync.applyBranch(branch), true)) },
      pullCommit: target => { const current = getCloud(); return cloudSequence(current, sync => exclusive(() => sync.applyCommit(target), true)) },
      commit: () => { const current = getCloud(); return cloudSequence(current, async sync => {
        const result = await exclusive(() => sync.pushSnapshot({ manual: true }), true)
        current.lastPushAt = Date.now()
        return result
      }) },
      history: branch => { const current = getCloud(); return cloudSequence(current, sync => sync.history(branch === '' ? current.branch : branch)) },
      push: () => { const current = getCloud(); return cloudSequence(current, async sync => {
        const result = await exclusive(() => sync.pushSnapshot(), true)
        current.lastPushAt = Date.now()
        return result
      }) },
    })
  }

  async function configureCloudSaveNow(value) {
    assertAccepting()
    const normalized = normalizeCloudSaveSettings(value)
    // First-sync/restore requires a separate user-facing decision flow. Until that
    // flow exists, local settings cannot arm automatic pushes or cloud restore routes.
    const nextConfig = { ...normalized, syncReady: value?.syncReady === true }
    const oldCloud = cloud
    const previousConfig = cloudConfig
    cloudTransition = true
    if (cloudTimer !== null) { clearInterval(cloudTimer); cloudTimer = null }
    cloud = null
    try {
      // Prevent new cloud route work first, then let already-owned operations drain.
      await Promise.allSettled([...getSpecialActive()])
      await oldCloud?.sync.close({ finalPush: false })
      cloudConfig = nextConfig
      options.cloudSave = nextConfig
      cloud = createCloudSync(nextConfig)
      if (cloud !== null) startCloudTimer()
      return { ok: true, config: nextConfig, enabled: cloud !== null }
    } catch (error) {
      // Configuration changes never leave a half-active service behind. Recreate the
      // previous service without triggering its shutdown final push.
      cloudConfig = previousConfig
      options.cloudSave = previousConfig
      cloud = createCloudSync(previousConfig)
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

  async function testCloudSave(value) {
    let config
    try { config = normalizeCloudSaveSettings({ ...value, enabled: value?.enabled === true }) }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '云存档设置无效' } }
    if (!config.remote) return { ok: false, reason: '请先填写仓库地址' }
    // This call is intentionally outside cloud.sync's mutation queue: ls-remote is
    // read-only and must not wait on a queue it is itself trying to inspect.
    return testGitRemote({ remote: config.remote, cwd: dirname(options.statePath) })
  }

  /** open() 时补齐初始云服务；已有服务不重建。 */
  function init() {
    if (cloud === null) cloud = createCloudSync(cloudConfig)
  }

  function current() { return cloud }
  function pendingConfigures() { return cloudConfigureCount }
  function whenConfiguresSettled() { return cloudConfigureTail }
  function stopTimer() {
    if (cloudTimer !== null) { clearInterval(cloudTimer); cloudTimer = null }
  }

  return {
    init,
    startTimer: startCloudTimer,
    routes: cloudRouteList,
    configure: configureCloudSave,
    test: testCloudSave,
    current,
    pendingConfigures,
    whenConfiguresSettled,
    stopTimer,
  }
}
