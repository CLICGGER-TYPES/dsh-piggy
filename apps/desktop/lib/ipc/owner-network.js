// @ts-check
/** 只注册面板使用的 owner LAN 控制，并把邀请仅交给可信面板。 */
export function registerOwnerNetworkIpc({ ipcMain, fromPanelOnly, manager }) {
  ipcMain.handle('piggy:owner-network:status', event => {
    if (!fromPanelOnly(event)) return { ok: false, available: false, reason: '来源不对' }
    return manager.status()
  })
  ipcMain.handle('piggy:owner-network:addresses', event => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.addresses()
  })
  ipcMain.handle('piggy:owner-network:start', (event, options) => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.start({
      listenAddress: typeof options?.listenAddress === 'string' ? options.listenAddress : '',
      advertisedHost: typeof options?.advertisedHost === 'string' ? options.advertisedHost : '',
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
  ipcMain.handle('piggy:owner-network:join', (event, link) => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.join(typeof link === 'string' ? link : '')
  })
  ipcMain.handle('piggy:owner-network:join-status', event => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.joinStatus()
  })
  ipcMain.handle('piggy:owner-network:join-leave', event => {
    if (!fromPanelOnly(event)) return { ok: false, reason: '来源不对' }
    return manager.joinLeave()
  })
}
