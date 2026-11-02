// @ts-check
/** 用真实生命周期模块和真实 IPC 注册器，替换 Electron、窗口与外部资源。 */
import assert from 'node:assert/strict'
import { registerSystemActionsIpc } from '../../apps/desktop/lib/ipc/system.js'
import { registerUpdatesIpc } from '../../apps/desktop/lib/ipc/updates.js'
import { createDesktopLifecycle } from '../../apps/desktop/lib/desktop-lifecycle.js'

export function shellLifecycle(host, install = () => ({ ok: true }), options = {}) {
  const handlers = new Map(), scheduled = [], messages = [], dialogs = [], backups = [], notifications = []
  const pages = Object.fromEntries(['pet', 'panel'].map(role => [role, {
    send: (...args) => notifications.push([role, ...args]),
  }]))
  let exits = 0, relaunches = 0, hitTimer = 1
  const versions = options.versions ?? null
  const shellUpdates = options.shellUpdates ?? { status: () => ({ readyVersion: '0.6.7' }), install, async close() {} }
  const exportWrites = new Set()
  const log = (...args) => messages.push(args)
  const app = {
    getPath: () => '/downloads',
    on: (name, callback) => handlers.set(name, callback),
    exit(code) { assert.equal(code, 0); exits++ },
    quit() {
      let prevented = false
      handlers.get('before-quit')({ preventDefault() { prevented = true } })
      if (!prevented) exits++
    },
  }
  const dialog = {
    async showMessageBox(options) { dialogs.push(options) },
    showSaveDialog: options.showSaveDialog,
  }
  const lifecycle = createDesktopLifecycle({
    app, dialog, log, stopDrag() {}, relaunch() { relaunches++ }, isCapture: () => false,
    clearInterval() {}, clearTimeout() {}, setExternalManager() {}, setHitTimer: timer => { hitTimer = timer },
    getResources: () => ({
      host, hostStarting: null, versions, versionsStarting: null, shellUpdates, proxySettings: null,
      fullscreenWatch: null, externalManager: null, autostart: { flush: () => Promise.resolve() },
      exportWrites, topGuardTimer: null, displayWatchTimer: null, hitTimer, stateTimer: null,
      flushWindowState: () => options.flushWindowState?.(), flushLogs: () => options.flushLogs?.(),
    }),
  })
  const fromPage = event => Object.values(pages).includes(event.sender)
  const toPages = (channel, ...args) => {
    for (const [role, page] of Object.entries(pages)) page.send(channel, ...args)
  }
  const backupSave = async label => { backups.push(label); await options.backupSave?.(label) }
  const ipcMain = { handle: (name, callback) => handlers.set(name, callback) }

  lifecycle.registerBeforeQuit()
  registerUpdatesIpc({
    ipcMain, fromPage, toPages, getVersions: () => versions, getShellUpdates: () => shellUpdates,
    isActionActive: () => lifecycle.activeAction !== null,
    reserveAction: lifecycle.reserveAction, releaseAction: lifecycle.releaseAction,
    requireSavedGame: lifecycle.requireSavedGame, backupSave, restartGame: lifecycle.restartGame,
    closeShellResources: lifecycle.closeShellResources, recoverAction: lifecycle.recoverAction,
    isHostClosed: () => lifecycle.hostClosed, isCapture: () => false,
    setTimeout: callback => scheduled.push(callback), log,
  })
  registerSystemActionsIpc({
    ipcMain, app, dialog, shell: { openExternal() {} }, fromPage, getWin: () => null,
    isQuitting: () => lifecycle.quitting, exportWrites, log, writeFile: options.writeFile,
  })

  const request = (name, args = [], role = 'pet') => handlers.get(name)({ sender: pages[role] }, ...args)
  return {
    request,
    install: () => request('piggy:shell:install'),
    runInstall: () => scheduled.shift()(),
    runScheduled: () => scheduled.shift()(),
    quit: () => { app.quit(); return lifecycle.quitTask },
    waitForQuit: () => lifecycle.quitTask,
    state: () => ({ quitting: lifecycle.quitting, closed: lifecycle.hostClosed,
      closing: lifecycle.hostClosing !== null, action: lifecycle.activeAction,
      quitAfterAction: lifecycle.quitAfterAction, shellClosed: lifecycle.shellClosed,
      hitTimer, scheduled: scheduled.length, exits, relaunches }),
    messages, dialogs, backups, notifications,
  }
}
