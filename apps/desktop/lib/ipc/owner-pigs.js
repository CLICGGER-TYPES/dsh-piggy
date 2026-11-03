// @ts-check
/** Panel-only local owner roster IPC. Renderer can choose an existing target but cannot mint identities or paths. */

/** @param {{ipcMain:{handle:(channel:string,listener:(event:any,...args:any[])=>any)=>void},fromPanelOnly:(event:any)=>boolean,manager:any}} options */
export function registerOwnerPigsIpc({ ipcMain, fromPanelOnly, manager }) {
  ipcMain.handle('piggy:owner-pigs:status', event => {
    if (!fromPanelOnly(event)) return { ok: false, available: false, reason: '来源不对' }
    return manager.status()
  })
  ipcMain.handle('piggy:owner-pigs:list', event => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.list()
  })
  ipcMain.handle('piggy:owner-pigs:select', (event, pigId) => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.select(pigId)
  })
  ipcMain.handle('piggy:owner-pigs:add-and-select', event => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.addAndSelect()
  })
}
