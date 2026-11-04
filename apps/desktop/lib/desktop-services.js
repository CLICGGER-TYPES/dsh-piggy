// @ts-check
/**
 * 桌面外壳的服务装配：从 DSH 导入存档、备份存档、托盘恢复、开机自启与托盘图标。
 * 逻辑从 main.js 原样搬来；窗口、猪和退出状态仍由组合根通过 deps 提供。
 */
import { access, copyFile, mkdir, rename } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { createAutostart } from './autostart.js'
import { recoverBounds, recoveryPayload } from './pig-recovery.js'
import { createDesktopTray } from './tray.js'

/**
 * @param {{
 *   app: any,
 *   dialog: any,
 *   Tray: any,
 *   Menu: any,
 *   nativeImage: any,
 *   iconPath: string,
 *   log: (...parts: any[]) => any,
 *   statePath: () => string,
 *   desktopLifecycle: any,
 *   getPetWindow: () => any,
 *   primaryPet: () => any,
 *   pets: any,
 *   screen: any,
 *   stopDrag: (pet: any) => void,
 *   applyBounds: (pet: any, bounds: any, why: string) => any,
 *   panel: { close: (why: string) => void },
 * }} deps
 */
export function createDesktopServices(deps) {
  /** Where the DSH plugin keeps its pig (the folder moved from dsh-pig to dsh-piggy). */
  async function dshSavePath() {
    const home = process.env.DSH_HOME?.trim() ? resolve(process.env.DSH_HOME.trim()) : join(homedir(), '.dsh')
    for (const folder of ['dsh-piggy', 'dsh-pig']) {
      const file = join(home, folder, 'state.json')
      try { await access(file); return file } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    return null
  }

  /** Copy DSH's pig over this one, keeping a copy of this one first. */
  async function importFromDsh() {
    const action = deps.desktopLifecycle.reserveAction('import', 'prepare')
    if (action === null) return
    try {
      const source = await dshSavePath()
      if (action.cancelled || deps.desktopLifecycle.quitting) return
      if (source === null) {
        await deps.dialog.showMessageBox({ type: 'info', message: '没找到 DSH 里的猪', detail: '默认找 ~/.dsh/dsh-piggy/state.json（或 DSH_HOME 下面）。' })
        return
      }
      const { response } = await deps.dialog.showMessageBox({
        type: 'question', buttons: ['导入', '算了'], defaultId: 0, cancelId: 1,
        message: '把 DSH 里的猪接过来？',
        detail: `从 ${source} 复制一份过来。桌面版现在这只会先备份，不会丢。`,
      })
      if (action.cancelled || deps.desktopLifecycle.quitting || response !== 0) return
      action.phase = 'commit'
      await deps.desktopLifecycle.requireSavedGame()
      const target = deps.statePath()
      await mkdir(dirname(target), { recursive: true })
      await backupSave('import')
      await copyFile(source, target + '.importing')
      await rename(target + '.importing', target)
      await deps.desktopLifecycle.restartGame()
    } catch (error) {
      if (!action.cancelled) await deps.desktopLifecycle.recoverAction(error)
    } finally { deps.desktopLifecycle.releaseAction(action) }
  }

  /** 开机自启的持久化：Windows 走 Electron 登录项，Linux 写 autostart 条目（见 lib/autostart.js）。 */
  const autostart = createAutostart({ app: deps.app, log: deps.log, isQuitting: () => deps.desktopLifecycle.quitting })

  /** 托盘恢复：清掉主猪陈旧的拖动/抛掷锚点，先把窗口移到主屏可见处，再让猪页把尺寸和家复位。 */
  function recoverPig() {
    const pet = deps.primaryPet()
    if (deps.desktopLifecycle.quitting || pet === null || pet.window === null || pet.window.isDestroyed()) return
    const payload = recoveryPayload(deps.screen.getPrimaryDisplay())
    if (payload === null) return
    deps.stopDrag(pet)
    pet.resizeShape?.cancel()
    pet.dragShapeActive = false
    pet.flightShapeActive = false
    pet.flightSlide = { x: 0, y: 0 }
    pet.lastDragSlide = { x: 0, y: 0 }
    pet.lastFlightShapeSlide = null
    pet.savedPigScreen = null
    pet.restingPigScreen = null
    pet.window.showInactive()
    deps.applyBounds(pet, recoverBounds(pet.window.getBounds(), payload.workArea), 'recover')
    pet.window.webContents.send('piggy:recover', payload)
    deps.log('recover', JSON.stringify({ ...payload, pigId: pet.pigId }))
  }

  /** Keep a copy of the save before the game code under it changes. */
  async function backupSave(label) {
    const file = deps.statePath()
    try { await access(file) } catch (error) { if (error.code === 'ENOENT') return; throw error }
    await copyFile(file, `${file}.before-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  }

  /** 托盘图标和菜单；窗口动作仍由主进程现有的入口处理。 */
  const tray = createDesktopTray({
    Tray: deps.Tray, Menu: deps.Menu, nativeImage: deps.nativeImage,
    icon: deps.iconPath,
    pig: {
      visible: () => deps.getPetWindow()?.isVisible() === true,
      hide: () => {
        deps.panel.close('tray')
        for (const pet of deps.pets.all()) { if (pet.window !== null && !pet.window.isDestroyed()) pet.window.hide() }
      },
      show: () => {
        for (const pet of deps.pets.all()) {
          if (pet.window !== null && !pet.window.isDestroyed() && !pet.window.isVisible()) pet.window.showInactive()
        }
      },
    },
    autostart,
    recoverPig,
    importFromDsh,
    quit: () => deps.app.quit(),
    log: deps.log,
    isQuitting: () => deps.desktopLifecycle.quitting,
  })

  return { tray, autostart, recoverPig, importFromDsh, backupSave, dshSavePath }
}
