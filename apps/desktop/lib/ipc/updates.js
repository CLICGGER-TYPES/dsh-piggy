// @ts-check
/**
 * 更新 App / 外壳更新的 IPC 注册。只做注册；版本服务、外壳更新器和生命周期
 * 仍由 main.js 持有，处理函数被调用时通过 getter 读取当前绑定。
 * @module dsh-piggy-desktop/ipc/updates
 */

/** @typedef {{ handle: (channel: string, listener: (event: any, ...args: any[]) => any) => void }} IpcMain */
/** @typedef {{ kind: string, phase: string, cancelled: boolean }} Action */

/**
 * @param {{
 *   ipcMain: IpcMain,
 *   fromPage: (event: any) => boolean,
 *   toPages: (channel: string, ...args: any[]) => void,
 *   getVersions: () => Awaited<ReturnType<typeof import('../background-versions.js').startBackgroundVersions>> | null,
 *   getShellUpdates: () => ReturnType<typeof import('../shell-update.js').createShellUpdates> | null,
 *   isActionActive: () => boolean,
 *   reserveAction: (kind: string, phase?: string) => Action | null,
 *   releaseAction: (action: Action) => void,
 *   requireSavedGame: () => Promise<void>,
 *   backupSave: (label: string) => Promise<void>,
 *   restartGame: () => Promise<any>,
 *   closeShellResources: (options?: { keepShellUpdates?: boolean }) => Promise<any>,
 *   recoverAction: (error: unknown) => Promise<any>,
 *   isHostClosed: () => boolean,
 *   isCapture: () => boolean,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   log: (...parts: any[]) => any,
 * }} options
 */
export function registerUpdatesIpc(options) {
  const {
    ipcMain, fromPage, toPages, getVersions, getShellUpdates,
    isActionActive, reserveAction, releaseAction,
    requireSavedGame, backupSave, restartGame, closeShellResources, recoverAction,
    isHostClosed, isCapture, log, setTimeout = globalThis.setTimeout,
  } = options

  // 最近一次版本列表；两个窗口共用，安装/回退按它解析版本号。
  let releases = []
  let releasesRequest = 0

  ipcMain.handle('piggy:updates:current', event => (fromPage(event) ? getVersions()?.current() : null))
  ipcMain.handle('piggy:updates:list', async (event, fresh) => {
    const versions = getVersions()
    if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
    const request = ++releasesRequest
    try {
      const listed = await versions.list({ fresh: fresh === true })
      if (request === releasesRequest) releases = listed
      return { ok: true, releases: listed.map(({ manifest, packUrl, ...rest }) => rest) }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    }
  })
  ipcMain.handle('piggy:updates:install', async (event, version) => {
    const versions = getVersions()
    if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
    const target = releases.find(r => r.version === version)
    if (target === undefined) return { ok: false, reason: '先刷新一下版本列表' }
    if (target.blocked !== null) return { ok: false, reason: target.blocked === 'shell' ? '要先装新的安装包' : '存档太新，这个版本读不了' }
    const action = reserveAction('game-install', 'prepare')
    if (action === null) return { ok: false, reason: '正在切换版本，请稍候' }
    let prepared = null
    let restarting = false
    try {
      // 下载、校验、解包不影响正在玩的版本；成功保存并备份最终存档后才激活。
      prepared = await versions.prepareInstall(target, fraction => toPages('piggy:progress', fraction))
      if (action.cancelled) throw new Error('已取消版本准备')
      action.phase = 'commit'
      await requireSavedGame()
      await backupSave('v' + target.version)
      await versions.commitInstall(prepared)
      prepared = null
      restarting = true
      setTimeout(restartGame, 600)
      return { ok: true, version: target.version }
    } catch (error) {
      if (prepared !== null) {
        try { await versions.discardPrepared(prepared) }
        catch (cleanupError) { if (!action.cancelled) log('prepared game cleanup failed', String(cleanupError)) }
      }
      if (!action.cancelled && isHostClosed()) await recoverAction(error)
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    } finally { if (!restarting) releaseAction(action) }
  })
  ipcMain.handle('piggy:updates:rollback', async event => {
    const versions = getVersions()
    if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
    const action = reserveAction('game-rollback', 'prepare')
    if (action === null) return { ok: false, reason: '正在切换版本，请稍候' }
    let restarting = false
    try {
      const current = await versions.current()
      if (action.cancelled) throw new Error('已取消版本准备')
      if (current.previous === null) return { ok: false, reason: '没有上一个版本' }
      action.phase = 'commit'
      await requireSavedGame()
      await backupSave('rollback')
      const result = await versions.rollback()
      if (!result.ok) throw new Error(result.reason)
      restarting = true
      setTimeout(restartGame, 600)
      return result
    } catch (error) {
      if (!action.cancelled && isHostClosed()) await recoverAction(error)
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    } finally { if (!restarting) releaseAction(action) }
  })
  ipcMain.handle('piggy:shell:status', event => (fromPage(event) ? getShellUpdates()?.status() : null))
  ipcMain.handle('piggy:shell:download', async (event, version) => {
    const shellUpdates = getShellUpdates()
    if (!fromPage(event) || shellUpdates === null) return { ok: false, reason: '桌面外壳更新不可用' }
    if (isActionActive()) return { ok: false, reason: '正在切换版本，请稍候' }
    // 预览版里的外壳也能下：只有在用预览版游戏的人，页面才会把它列出来。
    const target = releases.find(release => release.latestShell === version && release.shellUpdate)
    if (target === undefined) return { ok: false, reason: '版本列表过期了，点上面的「刷新」再试一次' }
    return shellUpdates.download(version, target.prerelease === true, target.tag)
  })
  ipcMain.handle('piggy:shell:install', event => {
    const shellUpdates = getShellUpdates()
    if (!fromPage(event) || shellUpdates === null || shellUpdates.status().readyVersion === null) return { ok: false, reason: '还没有下载好桌面外壳' }
    if (isCapture()) return { ok: false, reason: '截图测试不会安装更新' }
    const action = reserveAction('shell-install')
    if (action === null) return { ok: false, reason: '正在切换版本，请稍候' }
    const readyVersion = shellUpdates.status().readyVersion
    // 安装器会替换整个外壳：关掉后台写者、等存档落盘之后再启动安装器。
    setTimeout(async () => {
      try {
        await requireSavedGame()
        await backupSave('shell-v' + readyVersion)
        await closeShellResources({ keepShellUpdates: true })
        const result = shellUpdates.install()
        if (!result.ok) throw new Error(result.reason)
      } catch (error) {
        try { await recoverAction(error) } finally { releaseAction(action) }
      }
    }, 600)
    return { ok: true }
  })
}
