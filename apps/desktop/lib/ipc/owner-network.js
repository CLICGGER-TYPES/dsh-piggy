// @ts-check
/** 只注册面板使用的 owner LAN 控制，并把邀请仅交给可信面板。 */
export function registerOwnerNetworkIpc({ ipcMain, fromPanelOnly, manager }) {
  ipcMain.handle('piggy:owner-network:status', event => {
    if (!fromPanelOnly(event)) return { ok: false, available: false, reason: '来源不对' }
    return manager.status()
  })
  ipcMain.handle('piggy:owner-network:start', (event, options) => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.start({
      listenAddress: typeof options?.listenAddress === 'string' ? options.listenAddress : undefined,
      advertisedHost: typeof options?.advertisedHost === 'string' ? options.advertisedHost : undefined,
    })
  })
  ipcMain.handle('piggy:owner-network:invite', (event, pigId) => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.invite(typeof pigId === 'string' ? pigId : '')
  })
  ipcMain.handle('piggy:owner-network:stop', event => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.stop()
  })
}
