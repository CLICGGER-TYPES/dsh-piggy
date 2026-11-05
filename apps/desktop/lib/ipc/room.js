// @ts-check
/** 房间 IPC：面板建房/加入，房间窗口移动/发表情，所有入口都核对发送窗口。 */
import { formatRoomCode } from '../room-code.js'

const DENIED = { ok: false, reason: '来源不对' }

/**
 * @param {{
 *   ipcMain: any,
 *   fromPanelOnly: (event:any)=>boolean,
 *   fromRoom: (event:any)=>boolean,
 *   manager: any,
 *   roomWindow: { open: ()=>any },
 *   clipboard?: { writeText: (text:string)=>void },
 * }} options
 */
export function registerRoomIpc({ ipcMain, fromPanelOnly, fromRoom, manager, roomWindow, clipboard }) {
  const panel = handler => (event, ...args) => fromPanelOnly(event) ? handler(event, ...args) : DENIED
  const room = handler => (event, ...args) => fromRoom(event) ? handler(event, ...args) : DENIED
  const either = handler => (event, ...args) => (fromPanelOnly(event) || fromRoom(event)) ? handler(event, ...args) : DENIED

  ipcMain.handle('piggy:room:status', either(() => manager.status()))

  ipcMain.handle('piggy:room:host', panel((event, profile) => manager.host(profile)))

  ipcMain.handle('piggy:room:join', panel((event, input, profile) => manager.join(input, profile)))

  ipcMain.handle('piggy:room:open', panel(() => {
    roomWindow.open()
    return { ok: true }
  }))

  ipcMain.handle('piggy:room:move', room((event, x, facing) => manager.move(x, facing)))

  ipcMain.handle('piggy:room:emote', room((event, name, targetId, x, facing) => manager.emote(name, targetId, x, facing)))

  ipcMain.handle('piggy:room:leave', either(() => manager.leave('left')))

  ipcMain.handle('piggy:room:copy', either(async () => {
    if (clipboard === undefined || typeof clipboard.writeText !== 'function') return { ok: false, reason: '剪贴板不可用' }
    const status = manager.status()
    if (status?.inRoom !== true || typeof status.code !== 'string') return { ok: false, reason: '不在房间里' }
    try {
      clipboard.writeText(formatRoomCode(status.code))
      return { ok: true, code: formatRoomCode(status.code) }
    } catch {
      return { ok: false, reason: '复制失败' }
    }
  }))
}
