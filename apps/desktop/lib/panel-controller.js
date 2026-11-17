// @ts-check
/**
 * 面板窗口的开关、贴猪几何、命中区域、z 序与 IPC。
 *
 * 窗口句柄仍由 lib/panel-window.js 唯一持有；这里只持有面板自身的状态机，
 * 通过 deps 读取主进程的窗口、猪和全局日志入口。逻辑从 main.js 原样搬来。
 */
import { createNiriPanelWindow } from './niri-panel-window.js'
import { createPanelInput } from './panel-input.js'
import { createPanelPlacement } from './panel-placement.js'
import { panelContentRect } from './panel-geometry.js'
import { panelToggleAction } from './panel-toggle.js'
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
 *   niri?: ReturnType<typeof import('./niri-client.js').createNiriWindow> | null,
 *   readBounds?: (pet: any) => { x: number, y: number, width: number, height: number },
 *   syncPet?: (pet: any) => any,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   clearTimeout?: typeof globalThis.clearTimeout,
 *   setInterval?: typeof globalThis.setInterval,
 *   clearInterval?: typeof globalThis.clearInterval,
 * }} deps
 */
export function createPanelController(deps) {
  const scheduleTimeout = deps.setTimeout ?? setTimeout
  const scheduleInterval = deps.setInterval ?? setInterval
  const clearTimer = deps.clearInterval ?? clearInterval
  const panelNiri = createNiriPanelWindow({
    niri: deps.niri ?? null,
    getPanelWindow: deps.getPanelWindow,
    log: deps.log,
    setTimeout: deps.setTimeout,
    clearTimeout: deps.clearTimeout,
  })
  const niriEnabled = panelNiri.enabled
  const placement = createPanelPlacement({ screen: deps.screen, readBounds: deps.readBounds, niriEnabled })
  const panelInput = createPanelInput({
    getPanelWindow: deps.getPanelWindow,
    screen: deps.screen,
    platform: deps.platform,
    BrowserWindow: deps.BrowserWindow,
    targetPet: panelTargetPet,
    extensionWindow: deps.extensionWindow,
    scheduleTimeout,
    setInterval: scheduleInterval,
    clearInterval: clearTimer,
    traceSetIgnoreMouseEvents: deps.traceSetIgnoreMouseEvents,
    sendBlur: () => sendPanel({ type: 'blur', toPet: false }),
    state: () => ({ open: panelOpen, fixed: panelFixedViewport, anchor: panelAnchor, size: panelSize }),
    recentlyShown: () => niriEnabled && panelShownAt > 0 && Date.now() - panelShownAt < 400,
  })
  /** 面板现在开着没有（用户眼里的「开」，窗口可能还在等页面报尺寸）。 */
  let panelOpen = false
  /** 这次面板朝哪边开、最高多高：打开时定一次，拖动松手后重新定。 */
  let panelAnchor = null
  /** 面板页面最近报的尺寸。 */
  let panelSize = null
  let panelFixedViewport = false
  let panelShapeKey = ''
  let panelHasNativeShape = false
  /** 最近一次给面板窗口设的位置：没变就不再 setBounds。 */
  let panelAsked = null
  /** 最近一次真正显示面板的时间：niri 显示新窗口抢焦点时，猪页会立刻发自动收起。 */
  let panelShownAt = 0
  /**
   * 面板当前服务哪只猪。null = 沿用主猪；多猪时右键第二只把面板改绑到它。
   * 面板页面按 ?pig= 路由 worker session，所以换猪必须换页面（见 openPanel）。
   */
  let panelTarget = null
  /** 当前面板页面按哪个 pigId 加载；null 表示默认会话（主猪的旧路径）。 */
  let panelLoadedPigId = null
  /** 页面还没 ready 时先记着：ready 后再把朋友资料发过去。 */
  let pendingFriend = null
  /** 朋友猪打开面板时用它的桌面窗口当锚点，不依赖本地猪的 panelPig。 */
  let friendAnchor = null
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
  function sendPanel(message) {
    const target = deps.getPanelWindow()
    if (target !== null && !target.isDestroyed() && deps.panelWindow.isReady()) target.webContents.send('piggy:panel', message)
  }

  const panelShape = createResizeShape(() => deps.getPanelWindow(), rects => {
    if (deps.getPanelWindow() && !deps.getPanelWindow().isDestroyed() && deps.platform !== 'darwin') deps.getPanelWindow().setShape(rects)
  }, () => deps.screen.getDisplayMatching(deps.getPanelWindow().getBounds()).scaleFactor)
  /** 面板页面换猪/重建后，旧的尺寸、位置和命中缓存全部作废。 */
  function resetPanelView() {
    panelShape.cancel()
    panelShapeKey = ''
    panelHasNativeShape = false
    panelAsked = null
    panelSize = null
    panelFixedViewport = false
    panelNiri.reset()
    panelInput.stop()
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
    if (panelOpen && pendingFriend !== null) {
      sendPanel({ type: 'friend', player: pendingFriend })
      pendingFriend = null
    }
  }
  /** 打开面板并切到朋友猪状态/居民卡（页面 ready 后补发）。 */
  function openFriend(player, anchor = null) {
    friendAnchor = anchor !== null && Number.isFinite(anchor?.x) && Number.isFinite(anchor?.y) && anchor.width > 0 && anchor.height > 0
      ? { x: anchor.x, y: anchor.y, width: anchor.width, height: anchor.height }
      : null
    pendingFriend = player
    openPanel(null, panelTargetPet())
    if (panelOpen && deps.panelWindow.isReady()) {
      sendPanel({ type: 'friend', player })
      pendingFriend = null
    }
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
  /** 把面板窗口放到该在的地方；第一次有尺寸时才显示（免得先闪一个空窗口）。 */
  function placePanel() {
    if (!panelOpen || deps.getPanelWindow() === null || deps.getPanelWindow().isDestroyed()) return
    const next = placement.bounds(panelTargetPet(), friendAnchor, panelAnchor, panelSize, panelFixedViewport)
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
    const window = deps.getPanelWindow()
    const firstShow = panelSize !== null && !window.isVisible()
    if (niriEnabled) {
      const sizeChanged = panelAsked === null || panelAsked.width !== next.width || panelAsked.height !== next.height
      if (sizeChanged) {
        // niri 会应用尺寸，位置仍由 move-floating-window 负责。
        const read = window.getBounds()
        window.setBounds({ x: read.x, y: read.y, width: next.width, height: next.height })
      }
      if (firstShow) {
        // 先透明，等 niri 把面板搬离默认位置再显示；否则会先在猪身上闪一下。
        panelNiri.hold()
      } else {
        panelNiri.moveTo(next)
      }
      panelAsked = next
    } else if (panelAsked === null || panelAsked.x !== next.x || panelAsked.y !== next.y
      || panelAsked.width !== next.width || panelAsked.height !== next.height) {
      window.setBounds(next)
      panelAsked = next
    }
    if (firstShow) {
      // macOS：预建面板绑在创建时的桌面空间；显示前加入所有空间，收起还原（closePanel）。
      // skipTransformProcessType 避免 Dock 闪烁和面板刚显示就失活。
      if (deps.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
      // 不抢焦点：GNOME 会把「抢焦点」变成一条「dsh-piggy is ready」的通知，每开一次面板弹一次
      //（2026-10-07 虚拟机录像里看到）。点进面板时它自然会拿到焦点。
      window.showInactive()
      // Wayland/XWayland 下 showInactive 的面板不进焦点链，点桌面不会触发 blur，
      // “点别处收起面板”就失效。这里只在 Wayland 会话补一次 focus；纯 X11 保持原行为。
      // niri 例外：focus() 会先让猪窗口 blur，游戏包的自动收起立刻把刚开的面板关掉。
      if (!niriEnabled && deps.platform === 'linux' && process.env.WAYLAND_DISPLAY) window.focus()
      raisePetAbovePanel()
      deps.log('panel shown', JSON.stringify({ bounds: next, anchor: panelAnchor?.vertical, pigId: panelTargetPet()?.pigId ?? null }))
      const pet = panelTargetPet()
      const notifyPet = () => {
        if (panelOpen && pet !== null && pet.window !== null && !pet.window.isDestroyed()) pet.window.webContents.send('piggy:panel', { type: 'open' })
      }
      // niri 显示新窗口时可能抢一次焦点，猪窗口的 blur 会触发游戏包的自动收起。
      // 把「面板已打开」的回声晚 60ms 发，让 blur 先走完（此时 isOpen 仍是 false）。
      if (niriEnabled) scheduleTimeout(notifyPet, 60)?.unref?.()
      else notifyPet()
      if (niriEnabled) panelNiri.sync(next)
      panelShownAt = Date.now()
    }
  }
  /**
   * 开面板，并把面板改绑到这只猪。
   * 面板页面的 API 请求按 URL 的 ?pig= 路由；已加载的页面不是这只猪时重建面板窗口
   * （不是改一个变量：否则面板会贴在新猪旁边却显示旧猪的数据）。
   */
  function openPanel(pig, pet = panelTargetPet()) {
    if (pet === null) return
    if (pig !== null && pig !== undefined) friendAnchor = null
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
    if (pet.panelPig === null && friendAnchor === null) return
    ensurePanelWindow()
    panelOpen = true
    panelInput.start()
    // niri 下用真实窗口位置开面板；用户可能用 Mod+拖拽在合成器里挪过猪。
    if (friendAnchor === null && typeof deps.syncPet === 'function') deps.syncPet(pet)
    // 每次打开都按默认规则重新挑对齐边（保持对齐只在拖完重定时用）
    panelAnchor = null
    panelAnchor = placement.decideAnchor(panelTargetPet(), friendAnchor, panelSize, undefined)
    if (panelAnchor === null) return
    sendPanel({ type: 'open', vertical: panelAnchor.vertical, maxHeight: panelAnchor.maxHeight })
    placePanel()
  }

  function closePanel(why) {
    if (!panelOpen) return
    // niri 显示新窗口时会抢一次焦点；猪页的 blur 自动收起会在面板刚显示的头几百毫秒
    // 发来 close。面板页在换页/重映射时也可能回一声。这个不是用户点击外部，忽略一次。
    if ((why === 'page' || why === 'page-pet') && niriEnabled && panelShownAt > 0 && Date.now() - panelShownAt < 400) {
      deps.log('panel close ignored after focus steal', JSON.stringify({ age: Date.now() - panelShownAt, from: why }))
      return
    }
    panelShownAt = 0
    pendingFriend = null
    friendAnchor = null
    panelOpen = false
    panelShape.cancel()
    panelShapeKey = ''
    panelNiri.cancel()
    panelInput.stop()
    if (deps.getPanelWindow() !== null && !deps.getPanelWindow().isDestroyed()) {
      deps.getPanelWindow().hide()
      if (deps.platform === 'darwin') deps.getPanelWindow().setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: false, skipTransformProcessType: true })
    }
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
    if (niriEnabled) panelNiri.refresh()
    const next = placement.decideAnchor(panelTargetPet(), friendAnchor, panelSize, panelAnchor?.horizontal)
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
    // niri 下固定透明外框会在卡片上方留一条透明区，XWayland 可能渲染成黑条；
    // 让窗口直接按内容尺寸走，位置由 niri move-floating-window 负责。
    panelFixedViewport = size.fixedViewport === true && !niriEnabled
    if (panelFixedViewport) panelInput.start()
    else {
      panelInput.stop()
      deps.traceSetIgnoreMouseEvents('panel', 'panel', 'panel-variable-viewport', false, 'omitted',
        () => deps.getPanelWindow().setIgnoreMouseEvents(false))
    }
    placePanel()
    if (deps.platform === 'darwin') panelInput.refresh()
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
    focusLeft: panelInput.focusLeft,
    ensure: ensurePanelWindow,
    open: openPanel,
    openFriend,
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
