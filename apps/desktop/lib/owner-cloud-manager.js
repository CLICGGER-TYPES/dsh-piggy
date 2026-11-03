// @ts-check
/** Explicit first-sync bridge from the full owner archive cloud service to copy-and-switch. */

function sameConfig(left, right) {
  return left?.enabled === true && right?.enabled === true && left.provider === right.provider &&
    left.remote === right.remote && left.branch === right.branch
}

/** @param {{getHost:()=>any,getOwnerConfig:()=>any,settings:any,readyStore:any,archiveManager:any,isSupported:()=>boolean,isQuitting:()=>boolean}} deps */
export function createOwnerCloudManager(deps) {
  /** @type {Map<string,{ownerId:string,config:any,expires:number}>} */
  const previews = new Map()

  function current() {
    const owner = deps.getOwnerConfig()
    const loaded = deps.settings.load()
    return { owner, config: loaded.ok ? loaded.config : null, loadError: loaded.ok ? null : loaded.reason }
  }

  function status() {
    const { owner, config, loadError } = current()
    if (loadError) return { available: false, ready: false, reason: loadError }
    if (owner === null || owner?.source === 'task') return { available: false, ready: false, reason: '完整档云同步仅用于本机存档' }
    const host = deps.getHost()
    const available = deps.isSupported() && host !== null && host !== undefined && typeof host.firstSyncCloud === 'function'
    return { available, ready: available && deps.readyStore.matches(owner.ownerId, config), enabled: config?.enabled === true,
      branch: typeof config?.branch === 'string' ? config.branch : 'main', ...(available ? {} : { reason: '当前游戏包不支持完整档云同步' }) }
  }

  async function firstSync(direction) {
    if (deps.isQuitting()) return { ok: false, reason: '应用正在关闭' }
    if (direction !== 'local-to-cloud' && direction !== 'cloud-to-local') return { ok: false, reason: '请先选择首次同步方向' }
    const { owner, config, loadError } = current()
    if (loadError) return { ok: false, reason: loadError }
    if (owner === null || owner?.source === 'task') return { ok: false, reason: '完整档云同步仅用于本机存档' }
    if (!deps.isSupported()) return { ok: false, reason: '当前游戏包不支持完整档云同步' }
    if (config?.enabled !== true || !config.remote) return { ok: false, reason: '请先启用并保存仓库地址' }
    if (deps.readyStore.matches(owner.ownerId, config)) return { ok: false, reason: '当前完整档已完成首次同步' }
    const host = deps.getHost()
    if (host === null || host === undefined) return { ok: false, reason: '游戏运行时暂不可用' }
    let result
    try { result = await host.firstSyncCloud(direction) }
    catch { return { ok: false, reason: '首次同步暂时无法完成' } }
    if (result?.ok !== true) return result?.reason ? result : { ok: false, reason: '首次同步暂时无法完成' }
    const afterRequest = current()
    if (afterRequest.owner?.ownerId !== owner.ownerId || !sameConfig(config, afterRequest.config)) {
      return { ok: false, reason: '云存档设置已更改，请重新选择首次同步方向' }
    }

    if (direction === 'local-to-cloud') {
      try {
        deps.readyStore.write(owner.ownerId, config)
        const enabled = await host.configureCloudSave({ ...config, syncReady: true })
        if (enabled?.ok !== true) {
          deps.readyStore.clear(owner.ownerId, config)
          return { ok: false, reason: enabled?.reason ?? '已上传，但本机自动同步未能启用' }
        }
        return { ok: true, direction, created: result.created === true, alreadyCurrent: result.alreadyCurrent === true }
      } catch {
        deps.readyStore.clear(owner.ownerId, config)
        return { ok: false, reason: '云端档已准备，本机同步状态未能保存' }
      }
    }

    const archive = result.archive instanceof Uint8Array ? result.archive : null
    if (archive === null || archive.byteLength === 0) return { ok: false, reason: '云端没有有效的完整存档' }
    const preview = await deps.archiveManager.previewArchive(archive)
    if (preview?.ok !== true || typeof preview.token !== 'string') return preview
    const ownerId = deps.archiveManager.previewOwnerId(preview.token)
    if (typeof ownerId !== 'string' || ownerId !== result.ownerId) return { ok: false, reason: '云端完整档身份回读不匹配' }
    previews.set(preview.token, { ownerId, config: { ...config }, expires: Date.now() + 10 * 60 * 1000 })
    return { ok: true, direction, token: preview.token, summary: preview.summary, warnings: preview.warnings,
      deviceSettings: 'excluded', switchAfterImport: true }
  }

  async function importCloudPreview(token, options = {}) {
    if (deps.isQuitting()) return { ok: false, reason: '应用正在关闭' }
    const pending = previews.get(token)
    if (pending === undefined || pending.expires <= Date.now()) {
      previews.delete(token)
      return { ok: false, reason: '首次同步预览已过期，请重新读取云端' }
    }
    const { owner, config } = current()
    if (owner === null || owner?.source === 'task' || !sameConfig(pending.config, config)) {
      previews.delete(token)
      deps.archiveManager.clear()
      return { ok: false, reason: '云存档设置已更改，请重新预览' }
    }
    try { deps.readyStore.write(pending.ownerId, pending.config) }
    catch { return { ok: false, reason: '本机云同步状态无法保存；当前存档未切换' } }
    const result = await deps.archiveManager.importAndSwitch(token, { acceptWarnings: options.acceptWarnings === true })
    if (result?.ok !== true) {
      try { deps.readyStore.clear(pending.ownerId, pending.config) } catch { /* inactive marker is ignored unless identity matches */ }
      previews.delete(token)
      return result
    }
    previews.delete(token)
    return { ...result, cloudReadyAfterRestart: true }
  }

  function clear() {
    previews.clear()
    deps.archiveManager.clear()
  }

  return Object.freeze({ status, firstSync, importCloudPreview, clear })
}
