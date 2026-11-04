// @ts-check
/**
 * 全屏隐藏、macOS 桌面空间和置顶守护。状态与算法从 main.js 原样搬来；
 * 窗口、猪与面板仍由组合根通过 deps 提供。
 */
import { join } from 'node:path'

import { createFullscreenWatch, shouldHide } from './fullscreen.js'

/**
 * @param {{
 *   app: { getPath: (name: string) => string },
 *   screen: any,
 *   pets: any,
 *   primaryPet: () => any,
 *   getPetWindow: () => any,
 *   getPanelWindow: () => any,
 *   extensionLayer: any,
 *   panel: any,
 *   isQuitting: () => boolean,
 *   platform: string,
 *   pid: number,
 *   log: (...parts: any[]) => any,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   setInterval?: typeof globalThis.setInterval,
 * }} deps
 */
export function createFullscreenController(deps) {
  const scheduleTimeout = deps.setTimeout ?? setTimeout
  const scheduleInterval = deps.setInterval ?? setInterval

  /** @type {ReturnType<typeof createFullscreenWatch> | null} */
  let fullscreenWatch = null
  /** 是不是因为全屏才把猪藏起来的（托盘「藏起来」不算，全屏结束时不去动它）。 */
  let hiddenForFullscreen = false
  /** 全屏隐藏时具体藏了哪些窗口；恢复时只把当时可见的放回来。 */
  const hiddenPetsForFullscreen = new Set()
  /** 上一次探测：猪所在的屏是不是有程序全屏。 */
  let pigScreenFullscreen = false
  let topGuardTimer = null
  /** 重设置顶时会先关再开，自己会触发 always-on-top-changed(false)；这段时间里的事件不当作「被系统清掉」。 */
  let reassertingUntil = 0

  /**
   * 重新置顶。Windows 上别的程序全屏、退出时，系统有时把猪窗口的置顶清掉，之后猪就一直压在别的窗口下面；
   * 光调一次 setAlwaysOnTop(true) 在 Electron 里可能因为「状态没变」被跳过，所以先关再开。
   */
  function reassertTop(why) {
    if (deps.isQuitting()) return
    if (deps.extensionLayer.isFocused()) { deps.extensionLayer.sync(); return }
    reassertingUntil = Date.now() + 1000
    for (const target of [deps.getPanelWindow(), ...deps.pets.all().map(pet => pet.window)]) {
      if (target === null || target === undefined || target.isDestroyed() || !target.isVisible()) continue
      target.setAlwaysOnTop(false)
      target.setAlwaysOnTop(true, 'floating')
    }
    const primary = deps.getPetWindow()
    if (primary !== null && !primary.isDestroyed() && primary.isVisible()) primary.moveTop()
    deps.log('top reasserted', why)
  }

  /** macOS：「照常显示」时让猪跟进全屏程序的桌面空间；「隐藏」就留在原来的空间（系统默认）。 */
  function applyMacSpaces() {
    if (deps.platform !== 'darwin' || fullscreenWatch === null) return
    const show = fullscreenWatch.mode() === 'show'
    for (const target of [deps.getPanelWindow(), ...deps.pets.all().map(pet => pet.window)]) {
      if (target === null || target === undefined || target.isDestroyed()) continue
      target.setVisibleOnAllWorkspaces(show, { visibleOnFullScreen: show })
    }
  }

  /**
   * @param {{fullscreen:boolean, samePigScreen:boolean} | null} probe
   * 第一版只按主猪所在屏幕判断；一旦要藏，就把所有可见猪窗口一起藏，恢复时也只恢复当时可见的。
   */
  function onFullscreenProbe(probe) {
    if (deps.isQuitting() || deps.getPetWindow() === null || deps.getPetWindow().isDestroyed() || fullscreenWatch === null) return
    const covering = probe !== null && probe.fullscreen === true && probe.samePigScreen === true
    const ended = pigScreenFullscreen && !covering
    pigScreenFullscreen = covering
    if (shouldHide(fullscreenWatch.mode(), probe)) {
      if (!hiddenForFullscreen && deps.pets.all().some(pet => pet.window?.isVisible() === true) && !deps.pets.all().some(pet => pet.dragSession !== null)) {
        hiddenForFullscreen = true
        hiddenPetsForFullscreen.clear()
        deps.panel.close('fullscreen')
        for (const pet of deps.pets.all()) {
          const window = pet.window
          if (window === null || window.isDestroyed() || !window.isVisible()) continue
          hiddenPetsForFullscreen.add(pet)
          window.hide()
        }
        deps.log('fullscreen: pig hidden', JSON.stringify({ pigs: [...hiddenPetsForFullscreen].map(pet => pet.pigId) }))
      }
      return
    }
    if (hiddenForFullscreen) {
      hiddenForFullscreen = false
      for (const pet of hiddenPetsForFullscreen) {
        if (pet.window !== null && !pet.window.isDestroyed()) pet.window.showInactive()
      }
      hiddenPetsForFullscreen.clear()
      deps.log('fullscreen: pig back')
      reassertTop('fullscreen-ended')
      return
    }
    if (ended) reassertTop('fullscreen-ended')
    // 「照常显示」：全屏程序自己也是置顶窗口，每秒把猪抬回它上面一次。
    else if (covering && deps.getPetWindow().isVisible()) deps.panel.raisePetAbovePanel()
  }

  async function start() {
    fullscreenWatch = createFullscreenWatch({
      path: join(deps.app.getPath('userData'), 'fullscreen.json'), platform: deps.platform, selfPid: deps.pid, log: deps.log,
      pigHwnd: () => {
        try {
          const handle = deps.getPetWindow().getNativeWindowHandle()
          return String(handle.length >= 8 ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0))
        } catch { return '0' }
      },
      pigDisplayBounds: () => {
        if (deps.getPetWindow() === null || deps.getPetWindow().isDestroyed()) return null
        const display = deps.screen.getDisplayMatching(deps.getPetWindow().getBounds())
        const scale = display.scaleFactor || 1
        return { x: display.bounds.x * scale, y: display.bounds.y * scale, width: display.bounds.width * scale, height: display.bounds.height * scale }
      },
      onProbe: onFullscreenProbe,
    })
    await fullscreenWatch.init()
    if (deps.isQuitting()) return
    deps.log('fullscreen probe starting', JSON.stringify({ platform: deps.platform, mode: fullscreenWatch.mode() }))
    fullscreenWatch.start()
    applyMacSpaces()
    // 置顶守护：系统把置顶清掉时马上抢回来；有的情况下没有事件，再每 3 秒核对一次。
    deps.getPetWindow().on('always-on-top-changed', (event, on) => {
      if (!on && !deps.isQuitting() && Date.now() > reassertingUntil) scheduleTimeout(() => reassertTop('lost'), 200)
    })
    topGuardTimer = scheduleInterval(() => {
      if (deps.getPetWindow() === null || deps.getPetWindow().isDestroyed() || !deps.getPetWindow().isVisible()) return
      if (!deps.getPetWindow().isAlwaysOnTop() || (deps.getPanelWindow() !== null && !deps.getPanelWindow().isDestroyed() && deps.getPanelWindow().isVisible() && !deps.getPanelWindow().isAlwaysOnTop())) reassertTop('check')
    }, 3000)
    topGuardTimer.unref?.()
  }

  return {
    start,
    reassertTop,
    applyMacSpaces,
    onProbe: onFullscreenProbe,
    watch: () => fullscreenWatch,
    topGuardTimer: () => topGuardTimer,
  }
}
