// @ts-check
/** 执行生产更新、安装与退出回调；只替换 Electron 外围，不复制协调逻辑或启动安装器。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { saveArchive } from '../../apps/desktop/lib/save-export.js'

export function shellLifecycle(host, install = () => ({ ok: true }), options = {}) {
  const source = readFileSync(new URL('../../apps/desktop/main.js', import.meta.url), 'utf8')
  const handlers = new Map(), scheduled = [], messages = [], dialogs = [], backups = [], notifications = []
  const pages = Object.fromEntries(['pet', 'panel'].map(role => [role, {
    send: (...args) => notifications.push([role, ...args]),
  }]))
  let exits = 0, relaunches = 0
  const context = createContext({
    host, hostStarting: null, versions: options.versions ?? null, versionsStarting: null,
    win: { isDestroyed: () => false, webContents: pages.pet },
    panelWin: { isDestroyed: () => false, webContents: pages.panel },
    extensionWindow: { current: () => null, owns: () => false },
    autostart: { flush: () => Promise.resolve() },
    hitTimer: 1, fullscreenWatch: null, topGuardTimer: null, displayWatchTimer: null, stateTimer: null,
    proxySettings: null,
    join, saveArchive, writeFile: options.writeFile,
    stopDrag() {}, clearInterval() {}, clearTimeout() {}, flushWindowState() {}, flushLogs() {},
    process: { env: {} },
    async backupSave(label) { backups.push(label); await options.backupSave?.(label) },
    relaunch() { relaunches++ },
    dialog: { async showMessageBox(options) { dialogs.push(options) }, showSaveDialog: options.showSaveDialog },
    log: (...args) => messages.push(args),
    setTimeout: callback => scheduled.push(callback),
    ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    shellUpdates: options.shellUpdates ?? { status: () => ({ readyVersion: '0.6.7' }), install, async close() {} },
    app: {
      getPath: () => '/downloads',
      on: (name, callback) => handlers.set(name, callback),
      exit(code) { assert.equal(code, 0); exits++ },
      quit() {
        let prevented = false
        handlers.get('before-quit')({ preventDefault() { prevented = true } })
        if (!prevented) exits++
      },
    },
  })
  // 预约、保存门禁、错误恢复和关闭共用生产闭包，不能以测试里的成功实现代替。
  const load = (start, end) => {
    const first = source.indexOf(start), last = source.indexOf(end, first)
    assert.ok(first >= 0 && last > first, `生产生命周期代码边界不存在：${start} → ${end}`)
    runInContext(source.slice(first, last), context, { filename: 'desktop-main-lifecycle.js' })
  }
  load('let quitting = false', '/** 合并确认')
  load('async function requireSavedGame()', '// ---- 更新 App')
  load('let hostClosed = false', "app.on('window-all-closed'")
  load('let releases = []', "ipcMain.handle('piggy:quit'")
  load('const exportWrites = new Set()', "ipcMain.handle('piggy:open'")
  const request = (name, args = [], role = 'pet') => handlers.get(name)({ sender: pages[role] }, ...args)
  return {
    request,
    install: () => request('piggy:shell:install'),
    runInstall: () => scheduled.shift()(),
    runScheduled: () => scheduled.shift()(),
    quit: () => { context.app.quit(); return runInContext('quitTask', context) },
    waitForQuit: () => runInContext('quitTask', context),
    state: () => ({ quitting: runInContext('quitting', context), closed: runInContext('hostClosed', context),
      closing: runInContext('hostClosing !== null', context), action: runInContext('activeAction', context),
      quitAfterAction: runInContext('quitAfterAction', context), shellClosed: runInContext('shellClosed', context),
      hitTimer: context.hitTimer, scheduled: scheduled.length, exits, relaunches }),
    messages, dialogs, backups, notifications,
  }
}
