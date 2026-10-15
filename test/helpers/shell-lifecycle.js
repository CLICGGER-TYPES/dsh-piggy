// @ts-check
/** 执行生产安装与退出回调；只替换 Electron 外围，不复制关闭逻辑或启动安装器。 */
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

export function shellLifecycle(host, install = () => {}) {
  const source = readFileSync(new URL('../../apps/desktop/main.js', import.meta.url), 'utf8')
  const handlers = new Map(), scheduled = [], messages = []
  let exits = 0
  const context = createContext({
    host, quitting: false, hitTimer: 1, fullscreenWatch: null, topGuardTimer: null, stopDrag() {}, clearInterval() {},
    process: { env: {} }, fromPage: () => true, backupSave() {},
    log: (...args) => messages.push(args),
    setTimeout: callback => scheduled.push(callback),
    ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    shellUpdates: { status: () => ({ readyVersion: '0.6.7' }), install },
    app: {
      on: (name, callback) => handlers.set(name, callback),
      quit() {
        let prevented = false
        handlers.get('before-quit')({ preventDefault() { prevented = true } })
        if (!prevented) exits++
      },
    },
  })
  runInContext(source.slice(source.indexOf('let hostClosed = false'), source.indexOf("app.on('window-all-closed'")), context)
  const start = source.indexOf("ipcMain.handle('piggy:shell:install'")
  runInContext(source.slice(start, source.indexOf("ipcMain.handle('piggy:quit'", start)), context)
  return {
    install: () => handlers.get('piggy:shell:install')({}),
    runInstall: () => scheduled.shift()(),
    quit: () => context.app.quit(),
    state: () => ({ quitting: context.quitting, closed: runInContext('hostClosed', context),
      closing: runInContext('hostClosing !== null', context), hitTimer: context.hitTimer, exits }),
    messages,
  }
}
