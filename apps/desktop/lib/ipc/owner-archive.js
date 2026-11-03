// @ts-check
/** Panel-only owner archive IPC. The renderer receives opaque preview tokens, never target paths or identities. */

/** @param {{ipcMain:{handle:(channel:string,listener:(event:any,...args:any[])=>any)=>void},fromPanelOnly:(event:any)=>boolean,manager:any}} options */
export function registerOwnerArchiveIpc({ ipcMain, fromPanelOnly, manager }) {
  ipcMain.handle('piggy:owner-archive:status', event => {
    if (!fromPanelOnly(event)) return { ok: false, available: false, reason: '来源不对' }
    return manager.status()
  })
  ipcMain.handle('piggy:owner-archive:export', event => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.exportArchive()
  })
  ipcMain.handle('piggy:owner-archive:preview', (event, bytes) => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.previewArchive(bytes)
  })
  ipcMain.handle('piggy:owner-archive:import-and-switch', (event, token, options) => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.importAndSwitch(token, { acceptWarnings: options?.acceptWarnings === true })
  })
}
