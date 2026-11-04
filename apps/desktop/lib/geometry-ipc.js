// @ts-check
/**
 * 游戏包几何与输入面 IPC：内容框、摆放、抛掷、旧版命中/移动/形状。
 *
 * 从 main.js 原样搬来。窗口自身几何和命中计算在 lib/window-surface.js，
 * 拖动状态机在 lib/drag-engine.js；这里只把页面消息翻译成对窗口的操作。
 * Electron、屏、猪 registry 和日志都由组合根经 deps 传入，通道名和返回时机保持不变。
 */
import { MIN_WINDOW, contentBoundsForPig, moveAcrossDisplays, resizedPigScreenPoint, staggerPetBounds } from './window-geometry.js'

/**
 * @param {{
 *   ipcMain: { on: (channel: string, listener: (...args: any[]) => any) => any },
 *   screen: any,
 *   pets: any,
 *   platform: string,
 *   petForEvent: (event: any) => any,
 *   panel: { followPig: (pet: any) => void, reanchorPanel: (pet: any) => void },
 *   log: (...parts: any[]) => any,
 *   showPigWindow: (pet: any) => void,
 *   surface: ReturnType<typeof import('./window-surface.js').createWindowSurface>,
 * }} deps
 */
export function registerGeometryIpc(deps) {
  const {
    applyBounds, applyFlightBounds, applyShape, refreshHit, setLegacyHit, setHit,
    setPassthroughMode, isMouseShape, isPlaceRequest, pushGeometry,
    geometryOf, workAreaFor, currentSeq, skipNativeShape,
  } = deps.surface

  /**
   * The renderer reports the already-pinned pig and content in one frame.
   * Position and resize the window in one setBounds call around that pig point.
   */
  deps.ipcMain.on('piggy:content', (event, content) => {
    const pet = deps.petForEvent(event)
    if (pet === null) {
      if (content?.immediate === true) event.returnValue = null
      return
    }
    const width = content?.width
    const height = content?.height
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
      || (content.shape !== undefined && !isMouseShape(content.shape))) {
      if (content?.immediate === true) event.returnValue = null
      return
    }
    const window = pet.window
    setLegacyHit(pet, undefined, 'piggy:content')
    const anchor = { vertical: content?.anchor?.vertical === 'top' ? 'top' : 'bottom', horizontal: content?.anchor?.horizontal === 'left' ? 'left' : 'right' }
    const bounds = window.getBounds()
    const pigWindow = { x: Number(content?.pigWindow?.x), y: Number(content?.pigWindow?.y) }
    const hasPigWindow = Number.isFinite(pigWindow.x) && Number.isFinite(pigWindow.y)
    const pigSize = Number(content?.pig?.width) > 0 && Number(content?.pig?.height) > 0
      ? { width: Number(content.pig.width), height: Number(content.pig.height) } : pet.lastPigSize
    const sizeChanged = pet.lastPigWindow !== null
      && (pet.lastPigSize.width !== pigSize.width || pet.lastPigSize.height !== pigSize.height)
    const panelOpen = content?.panelOpen === true
    const changed = pet.lastContent === null
      || pet.lastContent.width !== width || pet.lastContent.height !== height
      || pet.lastContent.anchor.vertical !== anchor.vertical || pet.lastContent.anchor.horizontal !== anchor.horizontal
      || sizeChanged
      || (hasPigWindow && pet.lastPigWindow !== null && (pigWindow.x !== pet.lastPigWindow.x || pigWindow.y !== pet.lastPigWindow.y))

    if (pet.savedPigScreen !== null) {
      // 用「这次摆之前」的窗口 + 页面实际量到的猪位置判断：窗口已经不用再改、猪确实在存下的位置上。
      const pigNow = { x: Number(content?.pigNow?.x), y: Number(content?.pigNow?.y) }
      const settled = bounds.width === Math.max(MIN_WINDOW.width, Math.round(width))
        && bounds.height === Math.max(MIN_WINDOW.height, Math.round(height))
        && Math.abs(bounds.x + pigNow.x - pet.savedPigScreen.x) <= 1 && Math.abs(bounds.y + pigNow.y - pet.savedPigScreen.y) <= 1
      if (settled || panelOpen) pet.savedPigScreen = null
    }

    // 开、关面板本身不挪窗口（收起时窗口按打开时的范围留着位置）。只在打开那一刻记下猪的原位，
    // 面板开着时内容变化要按它摆回。以前开关面板也算「内容变了」，Windows 缩放下差 1px 就会
    // 重新 setBounds 一次，整块内容往上闪一下（用户 2026-10-05）。
    if (panelOpen && pet.lastContent?.panelOpen !== true && hasPigWindow) {
      const base = pet.lastPigWindow ?? pigWindow
      pet.restingPigScreen = pet.savedPigScreen ?? { x: bounds.x + base.x, y: bounds.y + base.y }
    }
    let moved = null
    if (changed && hasPigWindow) {
      const pigNow = { x: Number(content?.pigNow?.x), y: Number(content?.pigNow?.y) }
      const before = pet.lastPigWindow ?? (Number.isFinite(pigNow.x) && Number.isFinite(pigNow.y) ? pigNow : pigWindow)
      // 启动时以存下来的猪位置为准，直到页面量到的实际位置（pigNow，不是预测值）和它对上：
      // 启动那几次上报里窗口还在改大小，按预测值摆会让猪每次启动漂几像素。
      const pigBefore = pet.savedPigScreen ?? { x: bounds.x + before.x, y: bounds.y + before.y }
      // 启动时页面先画占位的纸盒，拿到存档才换成真正的猪：这个尺寸变化不是「调了小猪大小」，
      // 不能按脚底中心挪，直接摆回存下的位置（存的就是真猪的左上角）。
      const target = pet.savedPigScreen !== null ? pet.savedPigScreen
        : sizeChanged
          ? resizedPigScreenPoint(pet.restingPigScreen ?? pigBefore, pet.lastPigSize, pigSize)
          : (pet.restingPigScreen ?? pigBefore)
      if (sizeChanged && pet.restingPigScreen !== null) pet.restingPigScreen = target
      const area = deps.screen.getDisplayNearestPoint(target).workArea
      moved = applyBounds(pet, contentBoundsForPig({
        width, height, pigWindow: { ...pigWindow, ...pigSize }, panelOpen,
        allowPanelOverflow: sizeChanged,
      }, target, area), 'content')
    }
    if (!panelOpen) pet.restingPigScreen = null

    pet.lastContent = { width, height, anchor, panelOpen }
    if (hasPigWindow) pet.lastPigWindow = pigWindow
    pet.lastPigSize = pigSize
    // 记下「猪在屏幕上哪儿」：实机核对展开面板时它有没有动（日志里是 DIP 坐标）。
    const pigOnScreen = hasPigWindow ? { x: window.getBounds().x + pigWindow.x, y: window.getBounds().y + pigWindow.y } : null
    deps.log('content', JSON.stringify({ pigId: pet.pigId, window: window.getBounds(), anchor, panelOpen, pigOnScreen, target: pet.restingPigScreen, moved }))
    const shape = Array.isArray(content.shape) ? content.shape : []
    applyShape(pet, shape.slice(0, 64).map(r => ({
      x: Math.max(0, Math.round(Number(r.x) || 0)), y: Math.max(0, Math.round(Number(r.y) || 0)),
      width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
    })))
    if (pet.showGate !== null && pet.showGate.content()) deps.showPigWindow(pet)
    pet.lastShape = shape
    if (content?.immediate === true) {
      const current = window.getBounds()
      event.returnValue = { window: current, workArea: workAreaFor(current), seq: currentSeq() }
    }
  })

  /** 页面要几何：给它推一次（订阅晚于 did-finish-load 时靠这个）。 */
  deps.ipcMain.on('piggy:geometry:ask', (event) => {
    const pet = deps.petForEvent(event)
    if (pet === null) return
    pushGeometry(pet)
  })

  /**
   * 新游戏包的桌面逻辑：窗口摆哪、多大、哪里可点，都由页面算好，主进程只照做。
   * 同步返回改完后的几何，页面同一轮里就能接着用。以后这类调整只发游戏包，不用再发桌面程序。
   */
  deps.ipcMain.on('piggy:place', (event, request) => {
    const pet = deps.petForEvent(event)
    if (pet === null || !isPlaceRequest(request)) { event.returnValue = null; return }
    const window = pet.window
    if (pet.passthroughMode !== 'modern') {
      setPassthroughMode(pet, 'modern', 'piggy:place')
      setHit(pet, pet.passthroughHit, 'piggy:place')
    }
    // place({}) is a synchronous geometry query, not a landing/placement commit.
    // During native dragging even old pages must not compete with dragTick by
    // moving the window or restoring a stale precise drawing shape.
    const reading = request.bounds === undefined && request.shape === undefined && request.hitShape === undefined && request.pig === undefined
    if (reading || pet.dragSession !== null) {
      event.returnValue = geometryOf(window.getBounds(), pet)
      return
    }
    // 动画可单独更新真实输入；不能因此结束尚未提交新画面的整窗绘制保护。
    if (request.bounds === undefined && request.shape === undefined && request.pig === undefined) {
      const slide = pet.flightShapeActive ? pet.flightSlide : pet.dragShapeActive ? pet.lastDragSlide : { x: 0, y: 0 }
      pet.placedHitShape = request.hitShape.slice(0, 64).map(rect => ({
        x: rect.x - slide.x, y: rect.y - slide.y, width: rect.width, height: rect.height,
      }))
      pet.hasPlacedHitShape = true
      pet.hitPending = false
      refreshHit(pet)
      event.returnValue = geometryOf(window.getBounds(), pet)
      return
    }
    const b = request?.bounds
    const motionHandoff = Array.isArray(request.shape) && (pet.dragShapeActive || pet.flightShapeActive)
    if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
      let next = { x: Math.round(b.x), y: Math.round(b.y), width: Math.max(MIN_WINDOW.width, Math.round(b.width)), height: Math.max(MIN_WINDOW.height, Math.round(b.height)) }
      if (pet.staggerPending) {
        const others = deps.pets.all()
          .filter(other => other !== pet && other.window !== null && other.window !== undefined && !other.window.isDestroyed())
          .map(other => other.window.getBounds())
        next = staggerPetBounds(next, others, deps.screen.getDisplayMatching(next).workArea)
        pet.staggerPending = false
      }
      if (deps.platform === 'linux') pet.resizeShape?.begin(next, motionHandoff)
      applyBounds(pet, next, 'place')
    } else if (motionHandoff && deps.platform === 'linux') {
      // commitSlide transfers translate into layout without changing the window
      // size. Keep the old backing frame whole until the new layout is painted,
      // just as on resize; otherwise its new precise shape clips the old pig.
      pet.resizeShape?.begin(window.getBounds(), true)
    }
    // setBounds 是异步的（X11 要等 ConfigureNotify 回来），紧跟其后的 getBounds() 可能还是旧值。
    // 页面拿这个旧值做闭环核对，就会算出假偏差、再照着它挪窗口 —— 用户看到的「越修越偏」。
    // 这里把「请求值 vs 立刻回读值」的差记下来，先把机制钉死。
    if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
      const after = window.getBounds()
      if (Math.abs(after.x - Math.round(b.x)) > 1 || Math.abs(after.y - Math.round(b.y)) > 1) {
        deps.log('place-stale', JSON.stringify({ pigId: pet.pigId, asked: { x: Math.round(b.x), y: Math.round(b.y) }, read: after }))
      }
    }
    // 落地/接住后的正常摆放：抛掷滑动归零，形状回到未平移的版本。
    pet.flightSlide = { x: 0, y: 0 }
    pet.lastFlightShapeSlide = null
    pet.flightShapeActive = false
    pet.dragShapeActive = false
    if (Array.isArray(request.hitShape)) {
      pet.placedHitShape = request.hitShape.slice(0, 64).map(rect => ({
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      }))
      pet.hasPlacedHitShape = true
      // 这次 place 带来了新的输入面：窗口移动期间挂起的命中可以恢复。
      pet.hitPending = false
    }
    if (Array.isArray(request?.shape)) {
      pet.hasPlacedShape = true
      pet.placedShape = request.shape.slice(0, 64).map(r => ({
        x: Math.max(0, Math.round(Number(r.x) || 0)), y: Math.max(0, Math.round(Number(r.y) || 0)),
        width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
      }))
      pet.resizeShape?.update(pet.placedShape)
      // 新游戏包的第一次摆放就带真实尺寸和形状：窗口此前一直藏着，
      // 现在 setBounds + setShape 都做完了，可以显示了（Linux 防 Xwayland resize 崩溃）。
      if (pet.showGate !== null && pet.showGate.content()) deps.showPigWindow(pet)
    }
    refreshHit(pet)
    // 游戏包 0.33.1 起顺带报猪在窗口里的框（贴屏幕边时内容在窗口里挪过）：面板按它贴猪。
    const pig = request?.pig
    let panelPigChanged = false
    if (pig && [pig.x, pig.y, pig.width, pig.height].every(Number.isFinite) && pig.width > 0 && pig.height > 0) {
      panelPigChanged = pet.panelPig === null || pet.panelPig.x !== pig.x || pet.panelPig.y !== pig.y || pet.panelPig.width !== pig.width || pet.panelPig.height !== pig.height
      pet.panelPig = { x: pig.x, y: pig.y, width: pig.width, height: pig.height }
    }
    let speechChanged = false
    if (Object.hasOwn(request, 'speech')) {
      const s = request.speech
      const next = s && [s.x, s.y, s.width, s.height].every(Number.isFinite) && s.width > 0 && s.height > 0
        ? { x: s.x, y: s.y, width: s.width, height: s.height } : null
      speechChanged = JSON.stringify(pet.panelSpeech) !== JSON.stringify(next)
      pet.panelSpeech = next
    }
    if (pet.dragSession === null && pet.primary) {
      if (speechChanged) deps.panel.reanchorPanel(pet)
      else if (panelPigChanged) deps.panel.followPig(pet)
    }
    event.returnValue = geometryOf(window.getBounds(), pet)
  })

  /**
   * A2 抛掷：页面每帧算好窗口位置和 slide，主进程只挪窗口。
   * 和旧的 piggy:move（鼠标增量）是两条通道，payload 和语义都不同。
   */
  deps.ipcMain.on('piggy:flight:move', (event, frame) => {
    const pet = deps.petForEvent(event)
    if (pet === null) return
    if (pet.dragSession !== null) return
    if (frame === null || typeof frame !== 'object') return
    if (!Number.isFinite(frame.x) || !Number.isFinite(frame.y)) return
    const slide = frame.slide === undefined ? { x: 0, y: 0 } : frame.slide
    if (slide === null || typeof slide !== 'object' || ![slide.x, slide.y].every(Number.isFinite)) return
    if (pet.passthroughMode !== 'modern') {
      setPassthroughMode(pet, 'modern', 'piggy:flight:move')
      setHit(pet, pet.passthroughHit, 'piggy:flight:move')
    }
    pet.resizeShape?.cancel()
    applyFlightBounds(pet, frame.x, frame.y)
    pet.flightSlide = slide
    if (!pet.flightShapeActive) {
      pet.flightShapeActive = true
      // 只扩大绘制：逐帧 setShape 会刷空透明窗口，输入仍跟随当前立绘区域。
      // 落地/接住后页面会发 place，恢复精确绘制形状。
      if (!skipNativeShape) {
        const bounds = pet.window.getBounds()
        applyShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
      }
    }
    refreshHit(pet)
  })

  /** 旧游戏页面判断命中；现代游戏由主进程读取光标，不依赖穿透窗口收到 mousemove。 */
  deps.ipcMain.on('piggy:hit', (event, hit) => {
    const pet = deps.petForEvent(event)
    if (pet === null || typeof hit !== 'boolean') return
    if (pet.hasPlacedShape) return
    setLegacyHit(pet, hit, 'piggy:hit')
  })

  /** 旧游戏包（0.27.2 及以前）只会发鼠标增量：照旧支持，回退版本时拖动不坏。 */
  deps.ipcMain.on('piggy:move', (event, delta) => {
    const pet = deps.petForEvent(event)
    if (pet === null) return
    const dx = Number(delta?.dx)
    const dy = Number(delta?.dy)
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return
    pet.restingPigScreen = null
    applyBounds(pet, moveAcrossDisplays(pet.window.getBounds(), dx, dy, deps.screen.getAllDisplays().map(display => display.workArea)), 'move')
    if (pet.primary) deps.panel.reanchorPanel(pet)
  })

  deps.ipcMain.on('piggy:shape', (event, rects) => {
    const pet = deps.petForEvent(event)
    if (pet === null || !isMouseShape(rects)) return
    if (pet.lastShape.length === 0 && rects.length > 0) deps.log('first shape', pet.pigId ?? 'legacy', JSON.stringify(rects))
    setLegacyHit(pet, undefined, 'piggy:shape')
    pet.lastShape = rects
    applyShape(pet, rects.slice(0, 64).map(r => ({
      x: Math.round(Number(r.x) || 0), y: Math.round(Number(r.y) || 0),
      width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
    })))
  })
}
