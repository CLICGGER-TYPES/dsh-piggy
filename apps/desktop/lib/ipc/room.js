// @ts-check
/** 房间 IPC：面板建房/加入，房间窗口移动/发表情，所有入口都核对发送窗口。 */
import { formatRoomCode } from '../room-code.js'

const DENIED = { ok: false, reason: '来源不对' }

/**
 * @param {{
 *   ipcMain: any,
 *   fromPanelOnly: (event:any)=>boolean,
 *   fromRoom: (event:any)=>boolean,
 *   fromExt: (event:any)=>boolean,
 *   manager: any,
 *   roomWindow: { open: ()=>any },
 *   clipboard?: { writeText: (text:string)=>void },
 * }} options
 */
export function registerRoomIpc({ ipcMain, fromPanelOnly, fromRoom, fromExt, manager, roomWindow, clipboard }) {
  const panel = handler => (event, ...args) => fromPanelOnly(event) ? handler(event, ...args) : DENIED
  const room = handler => (event, ...args) => fromRoom(event) ? handler(event, ...args) : DENIED
  // 扩展大窗口（联机牌桌）只拿到查询、游戏消息、离开和复制邀请；建房/加入仍归面板。
  const ext = handler => (event, ...args) => fromExt(event) ? handler(event, ...args) : DENIED
  const shared = handler => (event, ...args) => (fromPanelOnly(event) || fromRoom(event) || fromExt(event)) ? handler(event, ...args) : DENIED

  ipcMain.handle('piggy:room:status', shared(() => manager.status()))

  ipcMain.handle('piggy:room:host', panel((event, profile, options) => manager.host(profile, options)))

  ipcMain.handle('piggy:room:join', panel((event, input, profile) => manager.join(input, profile)))

  ipcMain.handle('piggy:room:open', panel(() => {
    roomWindow.open()
    return { ok: true }
  }))

  ipcMain.handle('piggy:room:move', room((event, x, y, facing) => manager.move(x, y, facing)))

  ipcMain.handle('piggy:room:emote', room((event, name, targetId, x, y, facing) => manager.emote(name, targetId, x, y, facing)))

  ipcMain.handle('piggy:room:game', ext((event, input) => manager.game(input)))

  ipcMain.handle('piggy:room:leave', shared(() => manager.leave('left')))

  ipcMain.handle('piggy:room:copy', shared(async () => {
    if (clipboard === undefined || typeof clipboard.writeText !== 'function') return { ok: false, reason: '剪贴板不可用' }
    const status = manager.status()
    if (status?.inRoom !== true || typeof status.code !== 'string') return { ok: false, reason: '不在房间里' }
    const invite = typeof status.invite === 'string' && status.invite !== '' ? status.invite : ''
    const text = invite !== '' ? invite : formatRoomCode(status.code)
    try {
      clipboard.writeText(text)
      return { ok: true, code: formatRoomCode(status.code), invite: invite !== '' }
    } catch {
      return { ok: false, reason: '复制失败' }
    }
  }))
}
