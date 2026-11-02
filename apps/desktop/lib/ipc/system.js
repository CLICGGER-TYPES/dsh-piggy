// @ts-check
/**
 * 系统类 IPC 注册：外部连接、退出/导出/打开、全屏偏好和代理设置。
 * 只做注册；窗口、外部连接、全屏探测和代理配置仍由 main.js 持有，
 * 处理函数被调用时通过 getter 读取当前绑定。
 * @module dsh-piggy-desktop/ipc/system
 */
import { writeFile as defaultWriteFile } from 'node:fs/promises'
import { join } from 'node:path'

import { RELEASES_PAGE } from '../versions.js'
import { saveArchive } from '../save-export.js'

/** @typedef {{ handle: (channel: string, listener: (event: any, ...args: any[]) => any) => void }} IpcMain */

/**
 * 外部连接（设置 → 外部连接）：只允许面板窗口，扩展大窗口不行。
 * @param {{
 *   ipcMain: IpcMain,
 *   fromPanelOnly: (event: any) => boolean,
 *   getExternalManager: () => ReturnType<typeof import('../external.js').createExternalManager> | null,
 *   toPages: (channel: string, ...args: any[]) => void,
 * }} options
 */
export function registerExternalIpc({ ipcMain, fromPanelOnly, getExternalManager, toPages }) {
  ipcMain.handle('piggy:external:get', event => {
    const externalManager = getExternalManager()
    return fromPanelOnly(event) && externalManager !== null ? externalManager.status() : { ok: false, enabled: false, running: false, error: 'unavailable' }
  })
  ipcMain.handle('piggy:external:set', async (event, enabled) => {
    const externalManager = getExternalManager()
    if (!fromPanelOnly(event) || externalManager === null) return { ok: false, enabled: false, running: false, error: 'unavailable' }
    const status = await externalManager.setEnabled(enabled === true)
    toPages('piggy:external', status)
    return status
  })
}

/**
 * 页面动作：退出、导出日志、导出存档、打开发布页。
 * @param {{
 *   ipcMain: IpcMain,
 *   app: { getPath: (name: string) => string, quit: () => void },
 *   dialog: { showSaveDialog: (parentWindow: any, options: any) => Promise<any> },
 *   shell: { openExternal: (url: string) => any },
 *   fromPage: (event: any) => boolean,
 *   getWin: () => any,
 *   isQuitting: () => boolean,
 *   exportWrites: Set<Promise<any>>,
 *   log: (...parts: any[]) => any,
 *   writeFile?: typeof import('node:fs/promises').writeFile,
 * }} options
 */
export function registerSystemActionsIpc({ ipcMain, app, dialog, shell, fromPage, getWin, isQuitting, exportWrites, log, writeFile = defaultWriteFile }) {
  ipcMain.handle('piggy:quit', (event) => { if (fromPage(event)) app.quit() })
  // 设置 → 日志 → 导出：弹系统「另存为」，把日志写到用户选的位置。
  ipcMain.handle('piggy:save-log', async (event, payload) => {
    if (!fromPage(event)) return { ok: false, reason: '来源不对' }
    const name = typeof payload?.name === 'string' && payload.name.trim() !== '' ? payload.name.trim() : 'dsh-piggy-log.txt'
    const text = typeof payload?.text === 'string' ? payload.text : ''
    try {
      const picked = await dialog.showSaveDialog(getWin() ?? undefined, {
        title: '导出日志',
        defaultPath: join(app.getPath('downloads'), name),
        filters: [{ name: '日志文本', extensions: ['txt'] }, { name: '全部文件', extensions: ['*'] }],
      })
      if (isQuitting() || picked.canceled === true || typeof picked.filePath !== 'string' || picked.filePath === '') return { ok: false, canceled: true }
      const writing = writeFile(picked.filePath, text, 'utf8')
      exportWrites.add(writing)
      try { await writing } finally { exportWrites.delete(writing) }
      log('log exported', picked.filePath, String(text.length))
      return { ok: true, path: picked.filePath }
    } catch (error) {
      log('log export failed', String(error))
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    }
  })
  // 设置 → 存档 → 导出：只接受安全 ZIP 文件名和有限大小的字节，不接受调用方路径。
  ipcMain.handle('piggy:save-archive', async (event, payload) => {
    if (!fromPage(event)) return { ok: false, reason: '来源不对' }
    return saveArchive({
      dialog,
      parentWindow: getWin() ?? undefined,
      downloadsDir: app.getPath('downloads'),
      name: payload?.name,
      bytes: payload?.bytes,
      isClosing: isQuitting,
      async writeFile(path, bytes) {
        const writing = writeFile(path, bytes)
        exportWrites.add(writing)
        try { await writing } finally { exportWrites.delete(writing) }
      },
    })
  })
  ipcMain.handle('piggy:open', (event, url) => {
    // Only this repo's own pages: the release notes and installers.
    if (fromPage(event) && typeof url === 'string' && url.startsWith(RELEASES_PAGE.replace(/\/releases$/, '/'))) shell.openExternal(url)
  })
}

/**
 * 全屏偏好：隐藏 / 照常显示（见 lib/fullscreen.js）。
 * @param {{
 *   ipcMain: IpcMain,
 *   fromPage: (event: any) => boolean,
 *   getFullscreenWatch: () => ReturnType<typeof import('../fullscreen.js').createFullscreenWatch> | null,
 *   applyMacSpaces: () => void,
 * }} options
 */
export function registerFullscreenIpc({ ipcMain, fromPage, getFullscreenWatch, applyMacSpaces }) {
  ipcMain.handle('piggy:fullscreen:get', async event => {
    const fullscreenWatch = getFullscreenWatch()
    if (!fromPage(event) || fullscreenWatch === null) return null
    await fullscreenWatch.init()
    return fullscreenWatch.get()
  })
  ipcMain.handle('piggy:fullscreen:set', async (event, mode) => {
    const fullscreenWatch = getFullscreenWatch()
    if (!fromPage(event) || fullscreenWatch === null) return { ok: false, reason: '这个外壳不支持' }
    const result = await fullscreenWatch.set(mode)
    applyMacSpaces()
    return result
  })
}

/**
 * 代理设置：游戏、扩展和外壳下载共用（见 lib/proxy.js）。
 * @param {{
 *   ipcMain: IpcMain,
 *   fromPage: (event: any) => boolean,
 *   getProxySettings: () => ReturnType<typeof import('../proxy.js').createProxy> | null,
 * }} options
 */
export function registerProxyIpc({ ipcMain, fromPage, getProxySettings }) {
  /** @type {Array<'get'|'set'|'clear'|'test'>} */
  const actions = ['get', 'set', 'clear', 'test']
  for (const action of actions) {
    ipcMain.handle('piggy:proxy:' + action, async (event, value) => {
      const proxySettings = getProxySettings()
      if (!fromPage(event) || proxySettings === null) return { ok: false, reason: '代理设置不可用' }
      return proxySettings[action](value)
    })
  }
}
