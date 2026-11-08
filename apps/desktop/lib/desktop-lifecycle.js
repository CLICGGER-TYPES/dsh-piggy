// @ts-check
/** 主进程关闭、安装交接与退出重试。资源和 host 都在使用时从 main.js 读取。 */

/**
 * @typedef {object} DesktopResources
 * @property {any} host
 * @property {any} hostStarting
 * @property {any} versions
 * @property {any} versionsStarting
 * @property {any} shellUpdates
 * @property {any} proxySettings
 * @property {any} fullscreenWatch
 * @property {any} externalManager
 * @property {any} [roomManager]
 * @property {any} [roomWindow]
 * @property {any} autostart
 * @property {Set<Promise<any>>} exportWrites
 * @property {any} topGuardTimer
 * @property {any} displayWatchTimer
 * @property {any} hitTimer
 * @property {any[]} [hitTimers]
 * @property {any} stateTimer
 * @property {() => Promise<any>} flushWindowState
 * @property {() => Promise<any>} flushLogs
 */

/**
 * @param {{
 *   app: { on: (name: string, listener: (event: any) => void) => void, quit: () => void, exit: (code: number) => void },
 *   dialog: { showMessageBox: (options: any) => Promise<any> },
 *   log: (...parts: any[]) => any,
 *   stopDrag: () => void,
 *   relaunch: () => void,
 *   isCapture: () => boolean,
 *   clearInterval: typeof globalThis.clearInterval,
 *   clearTimeout: typeof globalThis.clearTimeout,
 *   getResources: () => DesktopResources,
 *   setExternalManager: (manager: any) => void,
 *   setHitTimer: (timer: any) => void,
 * }} deps
 */
export function createDesktopLifecycle(deps) {
  let quitting = false
  let activeAction = null
  let quitAfterAction = false
  let hostClosed = false
  let hostClosing = null
  let shellClosed = false
  let shellClosing = null
  let quitTask = null

  function reserveAction(kind, phase = 'commit') {
    if (quitting || activeAction !== null) return null
    activeAction = { kind, phase, cancelled: false }
    return activeAction
  }

  function releaseAction(action) {
    if (activeAction !== action) return
    activeAction = null
    if (quitAfterAction) { quitAfterAction = false; deps.app.quit() }
  }

  /** 关闭外壳资源并排空日志；失败时清空 Promise，允许调用方重试。 */
  function closeShellResources({ keepShellUpdates = false } = {}) {
    if (shellClosing) return shellClosing
    const resources = deps.getResources()
    const fullscreenStopping = resources.fullscreenWatch?.stop()
    for (const timer of [resources.topGuardTimer, resources.displayWatchTimer, resources.hitTimer, ...(resources.hitTimers ?? [])]) deps.clearInterval(timer)
    deps.setHitTimer(null)
    deps.clearTimeout(resources.stateTimer)
    shellClosing = (async () => {
      await Promise.all([fullscreenStopping, keepShellUpdates ? undefined : resources.shellUpdates?.close(), resources.flushWindowState(),
        resources.proxySettings?.flush(), resources.fullscreenWatch?.flush(), resources.autostart.flush(),
        resources.roomManager?.dispose?.(), resources.roomWindow?.close?.(),
        Promise.allSettled([...resources.exportWrites])])
      try { await deps.getResources().versions?.close() } catch (error) { deps.log('versions shutdown failed', String(error)) }
      await resources.flushLogs()
      shellClosed = true
    })().catch(error => { shellClosing = null; throw error })
    return shellClosing
  }

  /** 保存失败时允许重试；此时不提前停止命中轮询。 */
  function prepareToQuit() {
    if (hostClosing) return hostClosing
    quitting = true
    deps.stopDrag()
    hostClosing = (async () => {
      const externalManager = deps.getResources().externalManager
      if (externalManager !== undefined) {
        try { await externalManager?.close() } catch (error) { deps.log('external shutdown failed', String(error)) }
        deps.setExternalManager(null)
      }
      const host = deps.getResources().host
      return host ? host.dispose() : { saved: true }
    })().then(result => {
      hostClosed = true
      if (!result.saved) deps.log('host worker exited; WAL retained; shutdown without save')
      deps.clearInterval(deps.getResources().hitTimer)
      deps.setHitTimer(null)
      return result
    }).catch(error => { hostClosing = null; quitting = false; throw error })
    return hostClosing
  }

  async function requireSavedGame() {
    const result = await prepareToQuit()
    if (result.saved !== true) throw new Error('游戏未成功保存，已取消切换；未完成的工作记录保留在磁盘上')
  }

  /** 关闭后的操作失败须恢复交互；若宿主已关闭则重启当前版本。 */
  async function recoverAction(error) {
    deps.log('desktop action failed', String(error))
    try {
      await deps.dialog.showMessageBox({ type: 'error', message: '操作未完成',
        detail: `${error instanceof Error ? error.message : String(error)}${hostClosed ? '\n将重新启动当前游戏。' : ''}` })
    } finally {
      if (hostClosed) await restartGame()
    }
  }

  async function restartGame() {
    quitting = true
    try { await prepareToQuit() } catch (error) { deps.log('host shutdown failed', String(error)); return }
    await closeShellResources()
    if (quitAfterAction) return deps.app.exit(0)
    if (deps.isCapture()) return deps.app.exit(0)
    deps.relaunch()
    deps.app.exit(0)
  }

  function beforeQuit(event) {
    if (shellClosed) return
    event.preventDefault()
    if (activeAction !== null) {
      quitAfterAction = true
      if (activeAction.phase === 'prepare') {
        const action = activeAction
        action.cancelled = true
        quitting = true
        if (action.kind === 'import') releaseAction(action)
        else void deps.getResources().versions.cancelPreparation().catch(error => deps.log('versions cancellation failed', String(error)))
      }
      return
    }
    if (quitTask === null) {
      quitTask = (async () => {
        quitting = true
        await Promise.allSettled([deps.getResources().proxySettings?.init(), deps.getResources().versionsStarting, deps.getResources().hostStarting])
        if (!deps.getResources().host) {
          try { await deps.getResources().versions?.close() } catch (error) { deps.log('versions shutdown failed', String(error)) }
        }
        await prepareToQuit()
        await closeShellResources()
        deps.app.quit()
      })().catch(async error => {
        deps.log('host shutdown failed', String(error))
        try { await recoverAction(error) }
        catch (dialogError) { deps.log('host shutdown recovery dialog failed', String(dialogError)) }
        finally { quitTask = null }
      })
    }
  }

  function registerBeforeQuit() { deps.app.on('before-quit', beforeQuit) }

  return {
    get quitting() { return quitting },
    get activeAction() { return activeAction },
    get quitAfterAction() { return quitAfterAction },
    get hostClosed() { return hostClosed },
    get hostClosing() { return hostClosing },
    get shellClosed() { return shellClosed },
    get shellClosing() { return shellClosing },
    get quitTask() { return quitTask },
    reserveAction, releaseAction, closeShellResources, prepareToQuit,
    requireSavedGame, recoverAction, restartGame, registerBeforeQuit,
  }
}
