// @ts-check
/**
 * 面板窗口的开关、贴猪几何、命中区域、z 序与 IPC。
 *
 * 窗口句柄仍由 lib/panel-window.js 唯一持有；这里只持有面板自身的状态机，
 * 通过 deps 读取主进程的窗口、猪和全局日志入口。逻辑从 main.js 原样搬来。
 */
import { cursorHitsWindow } from './hit-physical.js'
import { PANEL_FALLBACK, panelAnchorFor, panelBoundsFor, panelContentRect, panelReferenceFor, panelViewportSize, pigScreenBox } from './panel-geometry.js'
import { panelToggleAction } from './panel-toggle.js'
import { pointerHitsShape } from './pointer-hit.js'
import { createResizeShape } from './resize-shape.js'

/**
 * @param {{
 *   panelWindow: ReturnType<typeof import('./panel-window.js').createPanelWindow>,
 *   getPanelWindow: () => any,
 *   screen: any,
 *   BrowserWindow: any,
 *   platform: string,
 *   pets: any,
 *   primaryPet: () => any,
 *   getPetWindow: () => any,
 *   extensionWindow: any,
 *   extensionLayer: any,
 *   ipcMain: { on: (channel: string, listener: (...args: any[]) => any) => any },
 *   petForEvent: (event: any) => any,
 *   fromPage: (event: any) => boolean,
 *   toPages: (channel: string, ...args: any[]) => void,
 *   log: (...parts: any[]) => any,
 *   traceSetIgnoreMouseEvents: (role: string, mode: string, source: string, ignore: boolean, forward: boolean | 'omitted', invoke: () => void) => void,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   setInterval?: typeof globalThis.setInterval,
 *   clearInterval?: typeof globalThis.clearInterval,
 * }} deps
 */
export function createPanelController(deps) {
  const scheduleTimeout = deps.setTimeout ?? setTimeout
  const scheduleInterval = deps.setInterval ?? setInterval
  const clearTimer = deps.clearInterval ?? clearInterval

  /** 面板现在开着没有（用户眼里的「开」，窗口可能还在等页面报尺寸）。 */
  let panelOpen = false
  /** 这次面板朝哪边开、最高多高：打开时定一次，拖动松手后重新定。 */
  let panelAnchor = null
  /** 面板页面最近报的尺寸。 */
  let panelSize = null
  let panelFixedViewport = false
  let panelHitTimer = null
  let panelHit = null
  let panelShapeKey = ''
  let panelHasNativeShape = false
  /** 最近一次给面板窗口设的位置：没变就不再 setBounds。 */
  let panelAsked = null
  /**
   * 面板当前服务哪只猪。null = 沿用主猪；多猪时右键第二只把面板改绑到它。
   * 面板页面按 ?pig= 路由 worker session，所以换猪必须换页面（见 openPanel）。
   */
  let panelTarget = null
  /** 当前面板页面按哪个 pigId 加载；null 表示默认会话（主猪的旧路径）。 */
  let panelLoadedPigId = null

  let stateTimer = null
  /** 存档变了：两个窗口都刷新（合并 30ms 内的多次，一次动作可能连发几个请求）。 */
  function announceStateChanged() {
    if (stateTimer !== null) return
    stateTimer = scheduleTimeout(() => { stateTimer = null; deps.toPages('piggy:state-changed') }, 30)
  }

  /** 面板服务的那只猪：改绑目标还活着就用它，否则回主猪。 */
  function panelTargetPet() {
    if (panelTarget !== null && deps.pets.all().includes(panelTarget)) {
      const window = panelTarget.window
      if (window !== null && window !== undefined && !window.isDestroyed()) return panelTarget
    }
    return deps.primaryPet()
  }

  /** 面板页面 URL：带 ?pig= 时 game-protocol 把请求路由到这只猪的 session。 */
  function panelUrl() {
    const pigId = panelTargetPet()?.pigId ?? null
    return pigId === null ? 'piggy://app/index.html' : `piggy://app/index.html?pig=${encodeURIComponent(pigId)}`
  }

  /** 主猪在屏幕上的框（拖到屏幕边时加上猪在窗口里滑出去的那一截）。 */
  function pigOnScreen() {
    const pet = panelTargetPet()
    if (pet === null || pet.window === null || pet.window.isDestroyed() || pet.panelPig === null) return null
    return pigScreenBox(pet.petAsked, pet.window.getBounds(), pet.panelPig, pet.dragSession !== null ? { dragging: true, slide: pet.lastDragSlide } : {})
  }

  /** 按猪现在的位置决定面板朝哪边开、最高多高。 */
  function decidePanelAnchor() {
    const pig = panelReferenceOnScreen()
    if (pig === null) return null
    return panelAnchorFor(pig, deps.screen.getDisplayNearestPoint({ x: Math.round(pig.x + pig.width / 2), y: Math.round(pig.y + pig.height / 2) }).workArea,
      panelSize?.width ?? PANEL_FALLBACK.width, panelAnchor?.horizontal)
  }

  /** 面板窗口该在哪：每次都从猪现在在哪直接算（见 lib/panel-geometry.js 文件头）。 */
  function panelBounds() {
    const pet = panelTargetPet()
    const pig = panelReferenceOnScreen()
    if (pig === null || panelAnchor === null) return null
    return panelBoundsFor(pig, panelAnchor, panelViewportSize(panelAnchor, panelSize, panelFixedViewport),
      pet?.dragSession !== null && pet?.dragSession !== undefined ? deps.screen.getAllDisplays().map(display => display.workArea) : null)
  }

  function panelReferenceOnScreen() {
    const pet = panelTargetPet()
    const pig = pigOnScreen()
    if (pig === null || pet === null || pet.window === null || pet.window.isDestroyed() || pet.panelSpeech === null) return pig
    const speech = pigScreenBox(pet.petAsked, pet.window.getBounds(), pet.panelSpeech,
      pet.dragSession !== null ? { dragging: true, slide: pet.lastDragSlide } : {})
    return panelReferenceFor(pig, speech)
  }

  function sendPanel(message) {
    const target = deps.getPanelWindow()
    if (target !== null && !target.isDestroyed() && deps.panelWindow.isReady()) target.webContents.send('piggy:panel', message)
  }

  /** 固定外框只让实际卡片和名牌接收点击，透明预留区继续点到桌面。 */
  function refreshPanelHit() {
    if (!panelFixedViewport || !panelOpen || !panelAnchor || !deps.getPanelWindow() || deps.getPanelWindow().isDestroyed() || !deps.getPanelWindow().isVisible()) return
    const window = deps.getPanelWindow()
    const bounds = window.getBounds()
    // 和猪窗口同一套换算：Windows 跨屏按物理像素，其它平台保持 DIP 相减。
    const { hit } = cursorHitsWindow({ platform: deps.platform, screen: deps.screen, window,
      shape: [panelContentRect(bounds, panelAnchor, panelSize)] })
    if (hit === panelHit) return
    panelHit = hit
    deps.traceSetIgnoreMouseEvents('panel', 'panel', 'panel-hit', !hit, true,
      () => deps.getPanelWindow().setIgnoreMouseEvents(!hit, { forward: true }))
  }

  const panelShape = createResizeShape(() => deps.getPanelWindow(), rects => {
    if (deps.getPanelWindow() && !deps.getPanelWindow().isDestroyed() && deps.platform !== 'darwin') deps.getPanelWindow().setShape(rects)
  }, () => deps.screen.getDisplayMatching(deps.getPanelWindow().getBounds()).scaleFactor)

  function stopPanelHit() {
    if (panelHitTimer !== null) clearTimer(panelHitTimer)
    panelHitTimer = null
    panelHit = null
  }

  function startPanelHit() {
    if (deps.platform !== 'darwin' || !panelFixedViewport || !panelOpen || panelHitTimer !== null) return
    refreshPanelHit()
    panelHitTimer = scheduleInterval(refreshPanelHit, 16)
    panelHitTimer.unref?.()
  }

  /** 面板页面换猪/重建后，旧的尺寸、位置和命中缓存全部作废。 */
  function resetPanelView() {
    panelShape.cancel()
    panelShapeKey = ''
    panelHasNativeShape = false
    panelAsked = null
    panelSize = null
    panelFixedViewport = false
    stopPanelHit()
  }

  /** panel-window 的 onCreated：记录这次页面是按哪只猪加载的。 */
  function panelViewCreated() {
    resetPanelView()
    panelLoadedPigId = panelTargetPet()?.pigId ?? null
    deps.extensionLayer.sync()
  }

  /** panel-window 的 onReady：页面加载完时把打开状态补给它。 */
  function handleReady() {
    if (panelOpen && panelAnchor !== null) sendPanel({ type: 'open', vertical: panelAnchor.vertical, maxHeight: panelAnchor.maxHeight })
  }

  /**
   * 把猪窗口抬到面板窗口上面（用户 2026-10-08 反馈）。
   * 两个窗口同为 floating 置顶，点面板时系统把面板抬到最上，猪的动作和气泡被盖住；
   * 所以面板转来反应（piggy:pig-fx）时抬一次。
   * 只改 z 序不改大小；猪窗口除猪本体外都穿透点击，压在上面不挡面板操作。
   */
  function raisePetAbovePanel() {
    if (deps.extensionLayer.isFocused()) return
    const pet = panelTargetPet()
    if (pet === null || pet.window === null || pet.window.isDestroyed() || !pet.window.isVisible()) return
    // 置顶标记仍为 true 时，菜单也可能被其他应用盖住；先抬菜单，再抬猪。
    if (deps.getPanelWindow() !== null && !deps.getPanelWindow().isDestroyed() && deps.getPanelWindow().isVisible()) deps.getPanelWindow().moveTop()
    pet.window.moveTop()
  }

  /** 右键第二只时也把它叫到前面：置顶窗口也要先可见。 */
  function focusPetWindow(pet) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed()) return
    if (!window.isVisible()) window.showInactive()
    window.moveTop()
    window.focus?.()
  }

  function ensurePanelWindow() {
    return deps.panelWindow.ensure()
  }

  /**
   * 焦点离开了面板服务的那只猪或面板窗口：如果也没落到另一个上，就是点到别处了。
   * 面板打开时不抢焦点（见 placePanel），焦点多半还在猪窗口上，所以两个窗口的失焦都要听。
   * 多猪时焦点落到别的猪也算「点到别处」。
   */
  function panelFocusLeft() {
    if (!panelOpen) return
    scheduleTimeout(() => {
      if (!panelOpen) return
      const focused = deps.BrowserWindow.getFocusedWindow()
      const pet = panelTargetPet()
      if (focused !== null && (focused === pet?.window || focused === deps.getPanelWindow() || focused === deps.extensionWindow.current())) return
      // 原生窗口重新映射时焦点可能暂空，指针仍在真实面板内不能算外部点击。
      if (focused === null && panelAnchor && panelSize && deps.getPanelWindow() && !deps.getPanelWindow().isDestroyed() && deps.getPanelWindow().isVisible()) {
        const bounds = deps.getPanelWindow().getBounds()
        if (pointerHitsShape(deps.screen.getCursorScreenPoint(), bounds, [panelContentRect(bounds, panelAnchor, panelSize)])) return
      }
      sendPanel({ type: 'blur', toPet: false })
    }, 0)
  }

  /** 把面板窗口放到该在的地方；第一次有尺寸时才显示（免得先闪一个空窗口）。 */
  function placePanel() {
    if (!panelOpen || deps.getPanelWindow() === null || deps.getPanelWindow().isDestroyed()) return
    const next = panelBounds()
    if (next === null) return
    // 切页、拖动后换边及可用高度变化都从同一份内容框计算轮廓。
    if (deps.platform !== 'darwin') {
      if (panelFixedViewport) {
        const rect = panelContentRect(next, panelAnchor, panelSize)
        const key = [next.width, next.height, rect.y, rect.width, rect.height].join(',')
        if (key !== panelShapeKey) {
          panelShape.begin(next, true)
          panelShape.update([rect])
          panelShapeKey = key
          panelHasNativeShape = true
        }
      } else if (panelHasNativeShape) {
        panelShape.cancel()
        deps.getPanelWindow().setShape([{ x: 0, y: 0, width: next.width, height: next.height }])
        panelShapeKey = ''
        panelHasNativeShape = false
      }
    }
    if (panelAsked === null || panelAsked.x !== next.x || panelAsked.y !== next.y
      || panelAsked.width !== next.width || panelAsked.height !== next.height) {
      deps.getPanelWindow().setBounds(next)
      panelAsked = next
    }
    if (panelSize !== null && !deps.getPanelWindow().isVisible()) {
      // 不抢焦点：GNOME 会把「抢焦点」变成一条「dsh-piggy is ready」的通知，每开一次面板弹一次
      //（2026-10-07 虚拟机录像里看到）。点进面板时它自然会拿到焦点。
      deps.getPanelWindow().showInactive()
      raisePetAbovePanel()
      deps.log('panel shown', JSON.stringify({ bounds: next, anchor: panelAnchor?.vertical, pigId: panelTargetPet()?.pigId ?? null }))
      const pet = panelTargetPet()
      if (pet !== null && pet.window !== null && !pet.window.isDestroyed()) pet.window.webContents.send('piggy:panel', { type: 'open' })
    }
  }

  /**
   * 开面板，并把面板改绑到这只猪。
   * 面板页面的 API 请求按 URL 的 ?pig= 路由；已加载的页面不是这只猪时重建面板窗口
   * （不是改一个变量：否则面板会贴在新猪旁边却显示旧猪的数据）。
   */
  function openPanel(pig, pet = panelTargetPet()) {
    if (pet === null) return
    const targetPigId = pet.pigId ?? null
    if (deps.getPanelWindow() !== null && panelLoadedPigId !== targetPigId) {
      if (panelOpen) closePanel('retarget')
      deps.panelWindow.destroy()
      resetPanelView()
      panelOpen = false
    }
    panelTarget = pet
    if (Number.isFinite(pig?.x) && Number.isFinite(pig?.y) && pig?.width > 0 && pig?.height > 0) {
      pet.panelPig = { x: pig.x, y: pig.y, width: pig.width, height: pig.height }
    }
    if (pet.panelPig === null) return
    ensurePanelWindow()
    panelOpen = true
    startPanelHit()
    // 每次打开都按默认规则重新挑对齐边（保持对齐只在拖完重定时用）
    panelAnchor = null
    panelAnchor = decidePanelAnchor()
    if (panelAnchor === null) return
    sendPanel({ type: 'open', vertical: panelAnchor.vertical, maxHeight: panelAnchor.maxHeight })
    placePanel()
  }

  function closePanel(why) {
    if (!panelOpen) return
    panelOpen = false
    panelShape.cancel()
    panelShapeKey = ''
    stopPanelHit()
    if (deps.getPanelWindow() !== null && !deps.getPanelWindow().isDestroyed()) deps.getPanelWindow().hide()
    sendPanel({ type: 'closed' })
    const pet = panelTargetPet()
    if (pet !== null && pet.window !== null && !pet.window.isDestroyed()) pet.window.webContents.send('piggy:panel', { type: 'closed' })
    deps.log('panel closed', why)
  }

  /** 面板服务的那只猪挪了（拖动、散步、贴边修正）：面板按它的新位置重摆，不重新挑朝向（松手后再挑）。 */
  function followPig(pet = deps.primaryPet()) {
    if (pet === null || pet !== panelTargetPet()) return
    if (!panelOpen || deps.getPanelWindow() === null || deps.getPanelWindow().isDestroyed() || !deps.getPanelWindow().isVisible()) return
    placePanel()
  }

  /** 拖完 / 散步完：猪到了新地方，重新决定面板朝哪边开（放不下就换边）。 */
  function reanchorPanel(pet = deps.primaryPet()) {
    if (pet === null || pet !== panelTargetPet()) return
    if (!panelOpen) return
    const next = decidePanelAnchor()
    if (next === null) return
    const changed = panelAnchor === null || next.vertical !== panelAnchor.vertical || next.maxHeight !== panelAnchor.maxHeight
    panelAnchor = next
    if (changed) sendPanel({ type: 'open', vertical: next.vertical, maxHeight: next.maxHeight })
    placePanel()
  }

  /** 一只猪窗口真的关了：面板正服务它时收起，目标回落到还活着的主猪。 */
  function forgetTarget(pet) {
    if (panelTarget !== pet) return
    panelTarget = null
    closePanel('pet-closed')
  }

  /** 面板页面报内容尺寸（piggy:panel:size 的全部逻辑）。 */
  function setPanelSize(size) {
    const width = Number(size?.width)
    const height = Number(size?.height)
    if (!(width > 0) || !(height > 0)) return
    panelSize = { width: Math.ceil(width), height: Math.ceil(height) }
    // 新 preload 透传第三个参数；旧游戏包/旧 preload 自动沿用可变外框。
    panelFixedViewport = size.fixedViewport === true
    if (panelFixedViewport) startPanelHit()
    else {
      stopPanelHit()
      deps.traceSetIgnoreMouseEvents('panel', 'panel', 'panel-variable-viewport', false, 'omitted',
        () => deps.getPanelWindow().setIgnoreMouseEvents(false))
    }
    placePanel()
    if (deps.platform === 'darwin') refreshPanelHit()
  }

  /** 猪页面：右键开/关面板（带上猪在窗口里的框）。多猪时把同一个面板改绑到当前这只。 */
  function togglePanel(event, request) {
    const pet = deps.petForEvent(event)
    if (pet === null) return
    const serving = panelOpen && panelTargetPet() === pet
    if (panelOpen && !serving) {
      // 另一只猪的面板开着：右键谁就切到谁，不先收起再等第二次点击。
      focusPetWindow(pet)
      openPanel(request?.pig, pet)
      deps.log('panel retargeted', pet.pigId ?? 'legacy')
      return
    }
    const action = panelToggleAction({ requestedOpen: request?.open === true, isOpen: panelOpen,
      isVisible: deps.getPanelWindow() !== null && !deps.getPanelWindow().isDestroyed() && deps.getPanelWindow().isVisible() })
    if (action === 'open') openPanel(request?.pig, pet)
    else if (action === 'close') closePanel('pet')
    else {
      // 首次加载期间复按只保持打开意图；回传状态，免得猪页面误以为已经关闭。
      pet.window.webContents.send('piggy:panel', { type: 'open' })
      deps.log('panel loading click kept')
    }
  }

  return {
    isOpen: () => panelOpen,
    targetPet: panelTargetPet,
    url: panelUrl,
    viewCreated: panelViewCreated,
    handleReady,
    focusLeft: panelFocusLeft,
    ensure: ensurePanelWindow,
    open: openPanel,
    close: closePanel,
    followPig,
    reanchorPanel,
    raisePetAbovePanel,
    forgetTarget,
    setSize: setPanelSize,
    toggle: togglePanel,
    announceStateChanged,
    pendingStateTimer: () => stateTimer,
  }
}
