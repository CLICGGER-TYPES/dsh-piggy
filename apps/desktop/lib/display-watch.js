// @ts-check
/** 显示器变化：主动通知游戏包、按新工作区收窗，并每 10 秒兜底对账。 */
import { createLinuxDisplayRebuild } from './linux-display-rebuild.js'
import { desktopViewportBounds } from './window-geometry.js'

/**
 * @param {{
 *   screen: any,
 *   pets: any,
 *   isQuitting: () => boolean,
 *   rebuildLinuxViews: () => Promise<any>,
 *   applyBounds: (pet: any, bounds: any, why: string) => any,
 *   pushGeometry: (pet: any) => void,
 *   log: (...parts: any[]) => any,
 *   platform: string,
 *   setInterval?: typeof globalThis.setInterval,
 * }} deps
 */
export function createDisplayWatch(deps) {
  const scheduleInterval = deps.setInterval ?? setInterval
  const displayRebuild = createLinuxDisplayRebuild({
    platform: deps.platform, displays: () => deps.screen.getAllDisplays(), rebuild: deps.rebuildLinuxViews,
    onError: error => deps.log('display view rebuild failed', String(error)),
  })

  const reclamp = (why, detail) => {
    if (deps.isQuitting() || deps.pets.all().length === 0) return
    if (displayRebuild.changed() || displayRebuild.busy()) return
    const areas = deps.screen.getAllDisplays().map(display => display.workArea)
    for (const pet of deps.pets.all()) {
      const window = pet.window
      if (window === null || window.isDestroyed()) continue
      deps.applyBounds(pet, desktopViewportBounds(window.getBounds(), areas), 'display')
      deps.pushGeometry(pet)
    }
    deps.log('display', why, JSON.stringify(detail ?? {}))
  }

  /** 注册显示器事件与兜底定时器；返回定时器句柄（退出时由 lifecycle 清理）。 */
  function start() {
    deps.screen.on('display-metrics-changed', (event, display, changedMetrics) => {
      reclamp('metrics-changed', { id: display?.id, scale: display?.scaleFactor, workArea: display?.workArea, changed: changedMetrics })
    })
    deps.screen.on('display-added', (event, display) => reclamp('added', { id: display?.id, bounds: display?.bounds, scale: display?.scaleFactor }))
    deps.screen.on('display-removed', (event, display) => reclamp('removed', { id: display?.id, bounds: display?.bounds }))
    // 兜底对账：显示器事件在个别平台/驱动下会漏（Shimeji 干脆每 5 秒轮询一次，因为 AWT 没有事件）。
    // 我们订阅了事件，再每 10 秒比一次工作区列表，不一样就当作「显示器变了」处理一次。
    let lastDisplayKey = ''
    const timer = scheduleInterval(() => {
      if (deps.pets.all().every(pet => pet.window === null || pet.window.isDestroyed())) return
      const key = JSON.stringify(deps.screen.getAllDisplays().map(display =>
        [display.id, display.workArea.x, display.workArea.y, display.workArea.width, display.workArea.height, display.scaleFactor]))
      if (key === lastDisplayKey) return
      lastDisplayKey = key
      reclamp('reconcile', { displays: deps.screen.getAllDisplays().length })
    }, 10000)
    timer.unref?.()
    return timer
  }

  return { start, reclamp, rebuild: displayRebuild }
}
