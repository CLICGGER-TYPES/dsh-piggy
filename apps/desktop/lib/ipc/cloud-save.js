// @ts-check
import { normalizeCloudSaveSettings } from '../cloud-save-settings.js'

/** Desktop cloud-settings IPC. It only touches the local settings file/runtime control API. */
export function registerCloudSaveIpc({ ipcMain, fromPage, getHost, settings }) {
  ipcMain.handle('piggy:cloud:get', event => {
    if (!fromPage(event)) return { ok: false, reason: '来源不对' }
    return settings.load()
  })

  ipcMain.handle('piggy:cloud:set', async (event, value) => {
    if (!fromPage(event)) return { ok: false, reason: '来源不对' }
    let next
    try { next = normalizeCloudSaveSettings(value) }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '云存档设置无效' } }
    const host = getHost()
    if (host === null) return { ok: false, reason: '游戏运行时暂不可用' }
    const previous = settings.current()
    try {
      const applied = await host.configureCloudSave(next)
      if (applied?.ok !== true) return { ok: false, reason: applied?.reason ?? '云存档设置暂时无法应用' }
      try { return { ok: true, config: settings.save(next) } }
      catch {
        await host.configureCloudSave(previous).catch(() => {})
        return { ok: false, reason: '云存档设置无法保存到本机' }
      }
    } catch { return { ok: false, reason: '云存档设置暂时无法应用' } }
  })

  ipcMain.handle('piggy:cloud:test', async (event, value) => {
    if (!fromPage(event)) return { ok: false, reason: '来源不对' }
    let next
    try { next = normalizeCloudSaveSettings({ ...value, enabled: value?.enabled === true }) }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '云存档设置无效' } }
    if (!next.remote) return { ok: false, reason: '请先填写仓库地址' }
    const host = getHost()
    if (host === null) return { ok: false, reason: '游戏运行时暂不可用' }
    try { return await host.testCloudSave(next) }
    catch { return { ok: false, reason: '无法完成连接检查' } }
  })
}
