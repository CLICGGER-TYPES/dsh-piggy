// @ts-check
/**
 * 猪窗口的生命周期：创建、关闭、Linux 显示器变化的整窗重建。
 *
 * 从 main.js 原样搬来；组合根仍持有启动顺序、live getter、剩余 IPC 和拖动引擎，
 * 这里只通过显式 deps 读写窗口/猪状态，窗口几何与命中面在 lib/window-surface.js。
 */
import { createResizeShape } from './resize-shape.js'
import { createPetWindow } from './pet-window.js'
import { MIN_WINDOW, WINDOW_PADDING, clampBounds, pigDisplayAtCursor } from './window-geometry.js'
import { auxiliaryWindowOptions } from './auxiliary-window.js'
import { SHOW_FALLBACK_MS, createShowGate } from './window-show.js'
import { pageCrashReason } from './startup-failure.js'

/** 页面还没报内容框之前的兜底尺寸：折叠的猪 + 留白。 */
const FALLBACK_CONTENT = { width: 132, height: 152 }

/**
 * @param {{
 *   BrowserWindow: any,
 *   screen: any,
 *   pets: any,
 *   primaryPet: () => any,
 *   panel: any,
 *   panelWindow: any,
 *   getPanelWindow: () => any,
 *   desktopLifecycle: { quitting: boolean },
 *   desktopRuntime: { getHost: () => any },
 *   pigSessions: Map<string, string>,
 *   platform: string,
 *   env: Record<string, string | undefined>,
 *   preloadPath: string,
 *   frameCap: number,
 *   log: (...parts: any[]) => any,
 *   startupInputTrace: { begin: () => void, record: (key: string, label: string, detail: string) => void },
 *   readWindowState: () => Promise<any>,
 *   surface: ReturnType<typeof import('./window-surface.js').createWindowSurface>,
 *   stopDrag: (pet: any) => void,
 *   confirmUpdateStartupIfReady: () => void,
 *   onRendererLoaded: () => void,
 *   onPrimaryWindowShown: (window: any) => void,
 *   handleStartupFailure: (error: Error) => Promise<any>,
 *   getCaptureCheck: () => (dir: string) => Promise<any>,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   setInterval?: typeof globalThis.setInterval,
 *   clearInterval?: typeof globalThis.clearInterval,
 * }} deps
 */
export function createWindowManager(deps) {
  const scheduleTimeout = deps.setTimeout ?? setTimeout
  const scheduleInterval = deps.setInterval ?? setInterval
  const clearTimer = deps.clearInterval ?? clearInterval

  /** 主猪窗口入口：保留原来的调用方式（测试和窗口重建都走这里）。 */
  async function createWindow(override = null) {
    return createPigWindow(deps.primaryPet(), override)
  }

  /**
   * 给一只猪创建 pet window。多猪时每只窗口各有自己的 BrowserWindow、命中轮询和形状缓存；
   * window.json 仍只记主猪（第一版限制，见 docs/guides/desktop-architecture.md）。
   */
  async function createPigWindow(pet, override = null) {
    if (pet === null || pet === undefined || deps.desktopLifecycle.quitting) return
    const saved = override ?? (pet.primary ? await deps.readWindowState() : null)
    // 新猪第一次由页面摆放时，如果和已有宠物窗口重合，主进程会再错开一次。
    pet.staggerPending = saved === null && pet.primary !== true
    if (deps.desktopLifecycle.quitting) return
    pet.savedPigScreen = saved !== null && Number.isFinite(saved.pig?.x) && Number.isFinite(saved.pig?.y) ? { x: saved.pig.x, y: saved.pig.y } : null
    if (pet.savedPigScreen !== null) {
      // 显示器拔掉或换了分辨率：猪至少要整只留在某块屏上。
      const pigArea = deps.screen.getDisplayNearestPoint(pet.savedPigScreen).workArea
      const box = clampBounds({ ...pet.savedPigScreen, width: MIN_WINDOW.width, height: MIN_WINDOW.height }, pigArea)
      pet.savedPigScreen = { x: box.x, y: box.y }
    }
    const area = saved === null ? pigDisplayAtCursor(deps.screen).workArea : deps.screen.getDisplayMatching(saved).workArea
    const width = saved === null ? FALLBACK_CONTENT.width + WINDOW_PADDING * 2 : saved.width
    const height = saved === null ? FALLBACK_CONTENT.height + WINDOW_PADDING * 2 : saved.height
    const anchorRight = saved === null ? 18 : null
    // 多猪首启错开：只横向排开。纵向错开会把后面的窗口顶到工作区上沿，
    // 页面在 y=0 处会触发贴边/视觉范围换算，反而把猪挤到另一块屏；横向排不受影响。
    // 步长取 380px（实测展开窗口约 364×328），小屏按可用宽度收窄，4 只仍尽量不重叠。
    const cascadeSteps = Math.max(1, deps.pets.all().length - 1)
    const cascadeRoom = Math.max(0, area.width - width - anchorRight)
    const staggerStep = Math.max(140, Math.min(380, Math.floor(cascadeRoom / cascadeSteps)))
    const stagger = pet.primary ? 0 : Math.max(0, deps.pets.all().indexOf(pet)) * staggerStep
    const start = saved === null
      ? clampBounds({ x: area.x + area.width - width - anchorRight - stagger, y: area.y + area.height - height - anchorRight, width, height }, area)
      : clampBounds({ ...saved, width, height }, area)
    pet.petAsked = { ...start }
    pet.resizeShape ??= createResizeShape(() => pet.window, rects => deps.surface.applyShape(pet, rects), () => deps.screen.getDisplayMatching(pet.window.getBounds()).scaleFactor)
    pet.owner ??= createPetWindow({ BrowserWindow: deps.BrowserWindow })
    let startupPageFailureReported = false
    const url = pet.pigId === null ? 'piggy://app/index.html' : `piggy://app/index.html?pig=${encodeURIComponent(pet.pigId)}`
    const pigArguments = pet.pigId === null ? []
      : ['--piggy-role=pet', `--piggy-pig=${pet.pigId}`, ...(pet.primary ? ['--piggy-primary=1'] : [])]
    pet.owner.create({
      options: {
        ...start,
        transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
        alwaysOnTop: true, skipTaskbar: true, focusable: true, show: false,
        ...auxiliaryWindowOptions(deps.platform),
        backgroundColor: '#00000000',
        // 后台页也要维持 rAF 测量/形状上报频率，避免猪慢半拍或窗口移动后画面滞留。
        webPreferences: { preload: deps.preloadPath, contextIsolation: true, sandbox: true, backgroundThrottling: false,
          ...(pigArguments.length === 0 ? {} : { additionalArguments: pigArguments }) },
      },
      url,
      configure: window => {
        pet.window = window
        pet.webContentsId = Number.isInteger(window.webContents?.id) ? window.webContents.id : null
        deps.pets.bindWindow(pet)
        window.setAlwaysOnTop(true, 'floating')
        if (deps.frameCap > 0) window.webContents.setFrameRate(deps.frameCap)
        // Linux 先等页面报真实内容和形状再显示，避免 rootless Xwayland 旧尺寸缓冲 SIGSEGV。
        pet.showGate = createShowGate({ platform: deps.platform })
        deps.startupInputTrace.begin()
        if (deps.surface.mousePassthrough) {
          deps.surface.setPassthroughMode(pet, 'unknown', 'pet-window-configure')
          pet.passthroughForward = null
          deps.startupInputTrace.record('pet-window-configure', 'startup mouse configuration', JSON.stringify({ platform: deps.platform, passthrough: deps.surface.mousePassthrough, mode: pet.passthroughMode, pigId: pet.pigId }))
          deps.surface.setHit(pet, false, 'pet-window-configure')
        } else {
          deps.startupInputTrace.record('pet-window-configure', 'startup mouse configuration', JSON.stringify({ platform: deps.platform, passthrough: deps.surface.mousePassthrough, mode: pet.passthroughMode, pigId: pet.pigId }))
        }
        clearTimer(pet.hitTimer)
        pet.hitTimer = scheduleInterval(() => deps.surface.refreshHit(pet), 16)
        pet.hitTimer.unref?.()
      },
      onClosed: () => {
        deps.stopDrag(pet)
        pet.resizeShape?.cancel()
        clearTimer(pet.hitTimer)
        pet.hitTimer = null
        handlePetWindowClosed(pet)
      },
      onReadyToShow: window => {
        // 启动摆放最多管 3 秒：之后一律按猪当前位置算，免得哪次没对上就一直往回拽。
        scheduleTimeout(() => { if (pet.window === window) pet.savedPigScreen = null }, 3000)
        deps.log('ready-to-show', pet.pigId ?? 'legacy')
        if (pet.showGate !== null && pet.showGate.readyToShow()) showPigWindow(pet)
        // 页面一直不报内容：兜底显示，不能永远不出现。
        scheduleTimeout(() => {
          if (pet.window === window && pet.showGate !== null && pet.showGate.timeout()) {
            deps.log('show fallback', JSON.stringify(pet.showGate.status()))
            showPigWindow(pet)
          }
        }, SHOW_FALLBACK_MS).unref?.()
      },
      onDidFinishLoad: () => {
        deps.onRendererLoaded()
        const gate = pet.showGate === null ? null : pet.showGate.status()
        deps.log('page loaded', JSON.stringify({ gate, pigId: pet.pigId }))
        if (gate?.pending === true) deps.log('page loaded before show gate opened', JSON.stringify({ waiting: gate.waiting }))
        deps.surface.pushGeometry(pet)
        if (pet.primary) deps.confirmUpdateStartupIfReady()
      },
      onDidFailLoad: async (window, event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        deps.log('page failed', JSON.stringify({ errorCode, errorDescription, url: validatedURL, mainFrame: isMainFrame, pigId: pet.pigId }))
        if (isMainFrame !== true || deps.desktopLifecycle.quitting || startupPageFailureReported || window.isDestroyed() || window.isVisible() || pet.showGate?.pending !== true) return
        startupPageFailureReported = true
        await deps.handleStartupFailure(new Error(`游戏页面加载失败：${errorDescription}（${errorCode}）`))
      },
      onRendererGone: (window, event, details) => {
        deps.stopDrag(pet)
        const gate = pet.showGate === null ? null : pet.showGate.status()
        deps.log('renderer gone', JSON.stringify(details), JSON.stringify({ visible: window.isVisible(), gate, pigId: pet.pigId }))
        // 窗口还没显示过就崩：先留日志再提示；已显示的运行中故障只记日志。
        void reportStartupCrash(window, details, gate)
      },
      afterLoad: window => {
        window.on('blur', () => deps.panel.focusLeft())
        window.on('unresponsive', () => deps.log('window unresponsive', JSON.stringify({ gate: pet.showGate === null ? null : pet.showGate.status(), pigId: pet.pigId })))
        window.on('responsive', () => deps.log('window responsive', pet.pigId ?? 'legacy'))
        window.webContents.on('console-message', (event, level, message) => { if (level >= 2) deps.log('page:', message, pet.pigId ?? '') })
        if (deps.env.PIGGY_DEVTOOLS === '1') window.webContents.openDevTools({ mode: 'detach' })
        if (deps.env.PIGGY_CAPTURE && pet.primary) window.webContents.once('did-finish-load', () => { deps.getCaptureCheck()(deps.env.PIGGY_CAPTURE) })
      },
    })
    async function reportStartupCrash(window, details, gate) {
      if (deps.desktopLifecycle.quitting || startupPageFailureReported || window.isDestroyed() || window.isVisible() || gate?.pending !== true) return
      startupPageFailureReported = true
      await deps.handleStartupFailure(new Error(pageCrashReason(details)))
    }
  }

  /**
   * 一只 pet window 真的关了（重建时的旧窗口不会走到这里，pet-window 只在 current 匹配时回调）。
   * 只销毁自己的映射和 session；全部关完后关闭面板，等待原有托盘/退出路径。
   */
  function handlePetWindowClosed(pet) {
    pet.closing = true
    // 先按 webContents.id 从 registry 摘掉，再清字段：remove 需要旧的 id 才能删映射。
    deps.pets.remove(pet)
    pet.window = null
    pet.webContentsId = null
    closePetSession(pet)
    // 面板正服务这只猪：它没了，面板也收起，下一次右键按还活着的那只重开。
    deps.panel.forgetTarget(pet)
    if (pet.primary) {
      deps.panel.close('pet-closed')
      deps.log('primary pet window closed; panel closed, tray/recover stay primary-only')
    }
    if (deps.pets.all().length === 0) {
      deps.panel.close('all-pets-closed')
      deps.log('all pet windows closed')
    }
  }

  /** 关窗口时释放这只猪的 worker session；应用退出时 host 已经先释放，失败只记日志。 */
  function closePetSession(pet) {
    if (pet.token === null) return
    const token = pet.token
    const pigId = pet.pigId
    pet.token = null
    if (pigId !== null) deps.pigSessions.delete(pigId)
    const host = deps.desktopRuntime.getHost()
    if (host === null || deps.desktopLifecycle.quitting) return
    void Promise.resolve(host.closePigSession(token))
      .catch(error => deps.log('pet session close failed', pigId ?? 'legacy', String(error)))
  }

  /** 显示一只猪窗口（只显示一次；日志保留原来的 shown 行格式）。 */
  function showPigWindow(pet) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed() || window.isVisible()) return
    window.showInactive()
    deps.log('shown', pet.pigId ?? 'legacy', JSON.stringify(window.getBounds()), window.isVisible())
    if (pet.primary) deps.onPrimaryWindowShown(window)
  }

  /** Refresh native pixel/DIP caches by using the already-tested cold view path. */
  async function rebuildLinuxViews() {
    const pet = deps.primaryPet()
    if (deps.desktopLifecycle.quitting || pet === null || pet.window === null || pet.window.isDestroyed()) return
    const previous = pet.window
    const previousPanel = deps.getPanelWindow()
    const bounds = pet.petAsked ?? previous.getBounds()
    const pig = pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
    const saved = { ...bounds, pig: { x: bounds.x + pig.x, y: bounds.y + pig.y } }
    deps.stopDrag(pet)
    pet.resizeShape?.cancel()
    deps.panel.close('display')
    previous.hide()
    pet.lastContent = null
    pet.lastPigWindow = null
    pet.restingPigScreen = null
    pet.lastShape = []
    pet.placedShape = []
    pet.placedHitShape = null
    pet.hasPlacedShape = false
    pet.hasPlacedHitShape = false
    pet.hitPending = false
    pet.hitPendingAt = 0
    await createWindow(saved)
    previous.removeAllListeners()
    previous.webContents.removeAllListeners()
    pet.owner?.destroy(previous)
    if (previousPanel && !previousPanel.isDestroyed()) {
      previousPanel.removeAllListeners()
      previousPanel.webContents.removeAllListeners()
      deps.panelWindow.destroy(previousPanel)
    }
    deps.panelWindow.forget(previousPanel)
    if (deps.desktopLifecycle.quitting) return
    deps.panel.ensure()
    deps.surface.pushGeometry(pet)
    deps.log('display views rebuilt', JSON.stringify({ bounds: pet.window.getBounds(), pigId: pet.pigId }))
  }

  return {
    createWindow,
    createPigWindow,
    handlePetWindowClosed,
    closePetSession,
    rebuildLinuxViews,
    showPigWindow,
  }
}
