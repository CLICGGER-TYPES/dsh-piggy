// @ts-check
/**
 * 舞台主进程的 IPC。每个处理函数先核对来源窗口，再校验参数；页面拿不到 node。
 * 渠道名沿用现有 piggy:*，让游戏里的更新/日志/存档/扩展代码不用改。
 * @module dsh-piggy-desktop/stage/ipc
 */

import { writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { dialog, ipcMain, shell } from 'electron'
import { RELEASES_PAGE } from '../lib/versions.js'
import { saveArchive } from '../lib/save-export.js'
import { sanitizeReport, validArchiveBytes, validArchiveName, validExtKey } from './shape.js'

/** @param {string} value */
function textName(value) {
  const name = typeof value === 'string' && value.trim() !== '' ? basename(value.trim()) : 'dsh-piggy-log.txt'
  return name === '' ? 'dsh-piggy-log.txt' : name
}

/**
 * @param {{
 *   fromPage: (event:any) => boolean,
 *   fromStage: (event:any) => boolean,
 *   fromExt: (event:any) => boolean,
 *   getStageWin: () => any,
 *   getVersions: () => any,
 *   getShellUpdates: () => any,
 *   getProxy: () => any,
 *   getFullscreenWatch: () => any,
 *   getReleases: () => any[],
 *   setReleases: (value:any[]) => void,
 *   applyReport: (payload:any) => void,
 *   setInteracting: (active:boolean) => void,
 *   geometry: () => any,
 *   saveArchive: (payload:any) => Promise<any>,
 *   sendProgress: (fraction:number) => void,
 *   downloadsDir: () => string,
 *   installShell: (version:string|null) => void,
 *   openExt: (key:string) => void,
 *   closeExt: () => void,
 *   forwardFx: (fx:any) => void,
 *   quit: () => void,
 *   restartGame: () => void,
 *   gameChange: { install: (target:any) => Promise<any>, rollback: () => Promise<any> },
 *   isClosing?: () => boolean,
 *   trackWrite?: (task:Promise<any>) => Promise<any>,
 *   log: (...parts:any[]) => void,
 * }} ctx
 */
export function registerStageIpc(ctx) {
  ipcMain.on('stage:report', (event, payload) => {
    if (!ctx.fromStage(event)) return
    ctx.applyReport(payload)
  })
  ipcMain.on('stage:interaction', (event, active) => {
    if (!ctx.fromStage(event) || typeof active !== 'boolean') return
    ctx.setInteracting(active)
  })
  ipcMain.on('stage:geometry:ask', event => {
    if (!ctx.fromPage(event)) { event.returnValue = null; return }
    event.returnValue = ctx.geometry()
  })

  ipcMain.on('piggy:ext:open', (event, key) => {
    if (!ctx.fromStage(event) || !validExtKey(key)) return
    ctx.openExt(key)
  })
  ipcMain.on('piggy:ext:close', event => {
    if (!ctx.fromExt(event)) return
    ctx.closeExt()
  })
  ipcMain.on('piggy:pig-fx', (event, fx) => {
    if (!ctx.fromExt(event) || fx === null || typeof fx !== 'object' || typeof fx.name !== 'string') return
    ctx.forwardFx({ name: fx.name, args: Array.isArray(fx.args) ? fx.args.slice(0, 8) : [] })
  })
  ipcMain.handle('piggy:quit', event => { if (ctx.fromPage(event)) ctx.quit() })

  ipcMain.handle('piggy:updates:current', event => (ctx.fromPage(event) ? ctx.getVersions()?.current() ?? null : null))
  ipcMain.handle('piggy:updates:list', async (event, fresh) => {
    const versions = ctx.getVersions()
    if (!ctx.fromPage(event) || versions === null) return { ok: false, reason: '不在舞台里' }
    try {
      const list = await versions.list({ fresh: fresh === true })
      ctx.setReleases(list)
      return { ok: true, releases: list.map(({ manifest, packUrl, ...rest }) => rest) }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    }
  })
  ipcMain.handle('piggy:updates:install', async (event, version) => {
    const versions = ctx.getVersions()
    if (!ctx.fromPage(event) || versions === null) return { ok: false, reason: '不在舞台里' }
    const target = ctx.getReleases().find(release => release.version === version)
    if (target === undefined) return { ok: false, reason: '先刷新一下版本列表' }
    if (target.blocked !== null) return { ok: false, reason: target.blocked === 'shell' ? '要先装新的安装包' : '存档太新，这个版本读不了' }
    return ctx.gameChange.install(target)
  })
  ipcMain.handle('piggy:updates:rollback', event => {
    if (!ctx.fromPage(event) || ctx.getVersions() === null) return { ok: false, reason: '不在舞台里' }
    return ctx.gameChange.rollback()
  })

  ipcMain.handle('piggy:shell:status', event => (ctx.fromPage(event) ? ctx.getShellUpdates()?.status() ?? null : null))
  ipcMain.handle('piggy:shell:download', async (event, version) => {
    const updates = ctx.getShellUpdates()
    if (!ctx.fromPage(event) || updates === null) return { ok: false, reason: '桌面外壳更新不可用' }
    const target = ctx.getReleases().find(release => release.latestShell === version && release.shellUpdate)
    if (target === undefined) return { ok: false, reason: '版本列表过期了，点上面的「刷新」再试一次' }
    return updates.download(version, target.prerelease === true, target.tag)
  })
  ipcMain.handle('piggy:shell:install', event => {
    const updates = ctx.getShellUpdates()
    if (!ctx.fromPage(event) || updates === null || updates.status().readyVersion === null) return { ok: false, reason: '还没有下载好桌面外壳' }
    setTimeout(() => { ctx.installShell(updates.status().readyVersion) }, 600)
    return { ok: true }
  })

  let proxy = null
  for (const action of ['get', 'set', 'clear', 'test']) {
    ipcMain.handle('piggy:proxy:' + action, async (event, value) => {
      if (!ctx.fromPage(event)) return { ok: false, reason: '来源不对' }
      proxy = proxy ?? ctx.getProxy()
      if (proxy === null) return { ok: false, reason: '代理设置不可用' }
      return proxy[action](value)
    })
  }
  ipcMain.handle('piggy:fullscreen:get', event => {
    const watch = ctx.getFullscreenWatch()
    return ctx.fromPage(event) && watch !== null ? watch.get() : null
  })
  ipcMain.handle('piggy:fullscreen:set', (event, mode) => {
    const watch = ctx.getFullscreenWatch()
    if (!ctx.fromPage(event) || watch === null) return { ok: false, reason: '这个外壳不支持' }
    return watch.set(mode)
  })

  ipcMain.handle('piggy:open', (event, url) => {
    if (!ctx.fromPage(event) || typeof url !== 'string') return
    if (url.startsWith(RELEASES_PAGE.replace(/\/releases$/, '/'))) shell.openExternal(url)
  })
  ipcMain.handle('piggy:save-log', async (event, payload) => {
    if (!ctx.fromPage(event)) return { ok: false, reason: '来源不对' }
    const name = textName(payload?.name)
    const text = typeof payload?.text === 'string' ? payload.text.slice(0, 16 * 1024 * 1024) : ''
    try {
      const picked = await dialog.showSaveDialog(ctx.getStageWin() ?? undefined, {
        title: '导出日志',
        defaultPath: join(ctx.downloadsDir(), name),
        filters: [{ name: '日志文本', extensions: ['txt'] }, { name: '全部文件', extensions: ['*'] }],
      })
      if (ctx.isClosing?.() || picked.canceled === true || typeof picked.filePath !== 'string' || picked.filePath === '') return { ok: false, canceled: true }
      const writing = writeFile(picked.filePath, text, 'utf8')
      await (ctx.trackWrite ? ctx.trackWrite(writing) : writing)
      return { ok: true, path: picked.filePath }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    }
  })
  ipcMain.handle('piggy:save-archive', async (event, payload) => {
    if (!ctx.fromPage(event)) return { ok: false, reason: '来源不对' }
    return saveArchive({
      dialog,
      parentWindow: ctx.getStageWin() ?? undefined,
      downloadsDir: ctx.downloadsDir(),
      name: payload?.name,
      bytes: payload?.bytes,
      isClosing: ctx.isClosing,
      writeFile: ctx.trackWrite ? (...args) => ctx.trackWrite(writeFile(...args)) : undefined,
    })
  })
  ipcMain.handle('stage:save-archive', async (event, payload) => {
    if (!ctx.fromStage(event)) return { ok: false, reason: '来源不对' }
    if (!validArchiveName(payload?.name) || !validArchiveBytes(payload?.bytes)) return { ok: false, reason: '存档文件名或数据不安全' }
    return ctx.saveArchive(payload)
  })
}
