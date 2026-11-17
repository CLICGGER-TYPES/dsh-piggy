// @ts-check
/**
 * 拖动状态机：按下、心跳、停止和每帧挪窗口。
 *
 * 从 main.js 原样搬来。这里只处理「一次拖动」的状态和窗口位置，窗口几何/命中面
 * 由 lib/window-surface.js 提供，面板跟随由 lib/panel-controller.js 提供。
 * 组合根只负责在 surface 装配好后创建引擎，并把 stopDrag 交给窗口/退出生命周期。
 */
import { dragHeartbeatExpired } from './drag-watchdog.js'
import { validDragOrigin } from './drag-origin.js'
import { pointerHitsShape } from './pointer-hit.js'
import { WINDOW_PADDING, desktopViewportBounds, dragPigBounds } from './window-geometry.js'

/**
 * @param {{
 *   screen: any,
 *   pets: any,
 *   petForEvent: (event: any) => any,
 *   panel: { followPig: (pet: any) => void, reanchorPanel: (pet: any) => void },
 *   log: (...parts: any[]) => any,
 *   surface: ReturnType<typeof import('./window-surface.js').createWindowSurface>,
 *   now?: () => number,
 *   setInterval?: typeof globalThis.setInterval,
 *   clearInterval?: typeof globalThis.clearInterval,
 * }} deps
 */
export function createDragEngine(deps) {
  const now = deps.now ?? Date.now
  const scheduleInterval = deps.setInterval ?? setInterval
  const clearTimer = deps.clearInterval ?? clearInterval
  const {
    applyBounds, applyShape, applyInputShape, refreshHit, setHit, isMouseRect, shiftedShape, geometryOf, skipNativeShape,
  } = deps.surface

  /** 这块屏的刷新率；拿不到就按 60。 */
  function refreshRateAt(point) {
    const display = point === null || point === undefined ? deps.screen.getPrimaryDisplay() : deps.screen.getDisplayNearestPoint(point)
    const hz = Number(display?.displayFrequency)
    return Number.isFinite(hz) && hz >= 30 ? Math.min(240, Math.round(hz)) : 60
  }

  /**
   * niri/XWayland 页面里的 `event.clientX/clientY` 是相对「拖动开始时窗口位置」的坐标：
   * 窗口被合成器移动不会改写它（实测 clientX 只跟物理指针走）。加上起始窗口位置就是
   * 全局 DIP 光标，不会因为窗口已经移走而把位移算两次。
   */
  function pageCursor(pet, given) {
    if (deps.surface.niriEnabled !== true) return null
    if (given === null || given === undefined) return null
    if (!Number.isFinite(given.x) || !Number.isFinite(given.y)) return null
    const start = pet?.dragSession?.startWindow
    if (start === null || start === undefined || !Number.isFinite(start.x) || !Number.isFinite(start.y)) return null
    return { x: start.x + given.x, y: start.y + given.y }
  }

  function dragTick(pet, cursorOverride) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed() || pet.dragSession === null) return
    if (pet.dragStats !== null) {
      const tickAt = now()
      pet.dragStats.ticks += 1
      pet.dragStats.maxGap = Math.max(pet.dragStats.maxGap, tickAt - pet.dragStats.last)
      pet.dragStats.last = tickAt
    }
    if (dragHeartbeatExpired(pet.dragSession.lastHeartbeat, now())) { stopDrag(pet); return }
    // 松手时页面把最后的屏幕坐标带过来：输入队列偶尔会把最后一次 move 排在 end 后面，
    // 只用主进程此刻读到的光标会少走一小段（贴边快速拖动时最明显）。
    const override = cursorOverride !== null && cursorOverride !== undefined
      && Number.isFinite(cursorOverride.x) && Number.isFinite(cursorOverride.y)
      ? { x: cursorOverride.x, y: cursorOverride.y } : null
    // niri 的定时 tick 没有新的指针坐标：只续命，不挪窗。挪窗必须等页面 pointermove
    // 带来的窗口局部坐标，并用已确认的窗口位置换算成全局坐标。
    if (override === null && deps.surface.niriEnabled === true) return
    let cursor
    if (override !== null) cursor = override
    else if (deps.surface.niriEnabled === true) cursor = pet.dragSession.lastCursor ?? pet.dragSession.cursor
    else cursor = deps.screen.getCursorScreenPoint()
    pet.dragSession.lastCursor = cursor
    // 夹取按「所有屏」算，不按鼠标当前在哪块屏：鼠标一过两块屏的缝就换夹取范围，
    // 会把猪整只弹回去（上下屏最明显）。见 lib/window-geometry.js 的 dragPigBounds。
    const areas = deps.surface.workAreas?.() ?? deps.screen.getAllDisplays().map(display => display.workArea)
    // 按「猪」算，不按起始窗口算：拖动中窗口大小可能变（冒气泡、面板换页），
    // 用起始窗口的大小去 setBounds 会把窗口来回改大改小，猪就一抽一抽的。
    const pig = pet.dragSession.pig ?? { ...(pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }), ...pet.lastPigSize }
    // 窗口大小用请求值，不用回读值（见 petAsked 的说明）
    const wanted = dragPigBounds(pet.petAsked ?? deps.surface.readBounds(pet), pig, pet.dragSession.pigScreen, pet.dragSession.cursor, cursor, areas, pet.dragSession.visual)
    if (!pet.dragShapeActive) {
      pet.dragShapeActive = true
      if (!skipNativeShape) {
        const bounds = deps.surface.readBounds(pet)
        applyShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
        applyInputShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
      }
      refreshHit(pet)
    }
    if (!pet.dragSession.slide) {
      applyBounds(pet, wanted, 'drag')
      return
    }
    // 窗口只在整个桌面的外沿夹取，屏幕接缝允许跨过；猪在窗口里滑过外沿留白：
    // GNOME 等窗口管理器不让程序把窗口摆到屏幕外，猪窗口四周又有透明留白（气泡区），
    // 拖到屏幕边上时窗口被卡住、猪就停在离边一大截的地方，松手才瞬移过去
    // （2026-10-07 虚拟机真拖录像逐帧看到的）。现在窗口夹在工作区里，超出去的那一截
    // 告诉页面，让它把猪在窗口里挪过去——猪一路跟着鼠标走到边上。
    const held = desktopViewportBounds(wanted, areas)
    const slide = { x: wanted.x - held.x, y: wanted.y - held.y }
    applyBounds(pet, held, 'drag')
    if (slide.x !== pet.dragSession.lastSlide.x || slide.y !== pet.dragSession.lastSlide.y) {
      pet.dragSession.lastSlide = slide
      pet.lastDragSlide = slide
      window.webContents.send('piggy:drag-slide', slide)
      deps.panel.followPig(pet)
      // 拖动期间用整窗形状（drag:start 时设置）：窗口被夹住时猪在窗口里滑，
      // 逐帧改 setShape 既慢又容易在 X11 上把猪裁掉/刷空。松手后页面 place 恢复精确形状。
    }
  }

  /** 停掉一只猪的拖动；不传 pet 时停全部（退出/显示器重建）。 */
  function stopDrag(pet = null) {
    const targets = pet === null ? deps.pets.all() : [pet]
    for (const target of targets) {
      clearTimer(target.dragTimer)
      target.dragTimer = null
      target.dragSession = null
      target.dragStats = null
      refreshHit(target)
    }
  }

  /** 页面按下：记下猪和光标的起点，按屏刷新率启动 tick。 */
  function startDrag(event, given) {
    const pet = deps.petForEvent(event)
    if (pet === null) return
    if (given != null && (!isMouseRect(given) || given.width <= 0 || given.height <= 0)) return
    stopDrag(pet)
    // 每次拖动都必须重新铺整窗形状；上一次拖动若没等到页面 place，dragShapeActive
    // 会一直为 true，下一次拖动沿用旧的小 shape，pet-snap/抬手动画就被裁掉。
    pet.dragShapeActive = false
    // niri 浮窗的位置回读是 0,0：按下时先查合成器里的真实位置，写回 petAsked，
    // 之后所有帧都从这个真实起点算增量，不能拿 0,0 当起点。
    deps.surface.syncPetFromNiri?.(pet)
    const bounds = deps.surface.readBounds(pet)
    // A1：页面可能延迟到移动 4px 才发 drag:start，带上 pointerdown 的屏幕坐标当起点。
    // 快速甩动时第一帧就可能离 pointerdown 上百像素，不能按 32px 拒绝；
    // 只拒绝非有限值、超出 512px 或不在当前屏工作区内的坏消息。
    const cursorNow = deps.screen.getCursorScreenPoint()
    const rawOrigin = given?.origin
    const originValid = rawOrigin !== null && rawOrigin !== undefined
      && Number.isFinite(rawOrigin.x) && Number.isFinite(rawOrigin.y)
    // niri/XWayland 下页面的 `event.screenX/screenY` 是窗口局部坐标：X11 原生窗口
    // 位置恒为 0,0，preload 只覆盖了 window.screenX，覆盖不到 PointerEvent.screenX。
    // 直接拿它当全局起点会让第一帧按窗口原点跳一次（物理机日志里 movedBy 2954）。
    // 这里补上合成器里的真实窗口位置，再和主进程光标校验。
    const pageOrigin = originValid && deps.surface.niriEnabled
      ? { x: rawOrigin.x + bounds.x, y: rawOrigin.y + bounds.y } : rawOrigin
    const originArea = pageOrigin !== null && pageOrigin !== undefined
      && Number.isFinite(pageOrigin.x) && Number.isFinite(pageOrigin.y)
      ? deps.surface.workAreaAt?.(pageOrigin) ?? deps.screen.getDisplayNearestPoint(pageOrigin).workArea : null
    // niri 下主进程读到的光标是 XWayland 的窗口局部坐标（窗口原生位置恒为 0,0），
    // 不能拿来校验页面起点。页面给的局部坐标 + 虚拟窗口位置才是全局 DIP。
    const acceptedOrigin = deps.surface.niriEnabled === true
      ? validDragOrigin(pageOrigin, pageOrigin, originArea)
      : validDragOrigin(pageOrigin, cursorNow, originArea)
    const dragOrigin = acceptedOrigin ?? cursorNow
    // 新游戏包会把猪在窗口里的位置和大小一起带过来（它自己量的，不再经过 piggy:content）。
    const pigFromPage = isMouseRect(given) && given.width > 0 && given.height > 0
      ? { x: given.x, y: given.y, width: given.width, height: given.height } : null
    // 延迟拖动的 origin 已由页面在 pointerdown 时验证；摸摸动画可能已改变当前墨迹，不能拿新帧否认旧命中。
    // 无合法 origin 的旧调用仍按当前输入判断，透明区域不能直接取得捕获。
    const inputSlide = pet.flightShapeActive ? pet.flightSlide : pet.dragShapeActive ? pet.lastDragSlide : { x: 0, y: 0 }
    if (pet.placedHitShape !== null && (pigFromPage === null
      || (acceptedOrigin === null && !pointerHitsShape(dragOrigin, bounds, shiftedShape(pet.placedHitShape, inputSlide))))) return
    const pig = pigFromPage ?? pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
    pet.dragSession = {
      cursor: dragOrigin,
      lastCursor: dragOrigin,
      startWindow: { x: bounds.x, y: bounds.y },
      pigScreen: { x: bounds.x + pig.x, y: bounds.y + pig.y },
      pig: pigFromPage,
      visual: pigFromPage !== null && isMouseRect(given?.visual) && given.visual.width > 0 && given.visual.height > 0
        && given.visual.x <= pigFromPage.x && given.visual.y <= pigFromPage.y
        && given.visual.x + given.visual.width >= pigFromPage.x + pigFromPage.width
        && given.visual.y + given.visual.height >= pigFromPage.y + pigFromPage.height
        ? { ...given.visual } : null,
      lastHeartbeat: now(),
      // 页面说它会接 piggy:drag-slide（猪在窗口里滑），主进程才把窗口夹在屏幕里
      slide: given?.slide === true,
      lastSlide: { x: 0, y: 0 },
    }
    pet.lastDragSlide = { x: 0, y: 0 }
    // 猪被拖走了：面板打开时记下的「原位」作废，否则下一次内容变化（比如点商店）
    // 会把窗口拽回原位 —— 用户看到的「瞬移」「拖着拖着卡在原地」。
    pet.restingPigScreen = null
    pet.savedPigScreen = null
    // 拖动期间每一帧都不写日志（60Hz 会刷爆），但起止各记一行：出问题时能看出拖了多远、
    // 起始窗口和猪的位置对不对得上（2026-10-06 的偏移排查就是缺这一段）。
    pet.dragShapeActive = true
    if (!skipNativeShape) {
      applyShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
      applyInputShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
    }
    setHit(pet, true, 'drag-start')
    pet.resizeShape?.cancel()
    deps.log('drag start', JSON.stringify({ pigId: pet.pigId, bounds, pigScreen: pet.dragSession.pigScreen, pigFromPage: pigFromPage !== null,
      origin: acceptedOrigin, cursor: cursorNow }))
    // tick 频率跟显示器刷新率走，不再写死 60Hz：144Hz 屏上窗口 60Hz 地动、画面 144Hz 地刷，
    // 一样是抽帧（用户 2026-10-07：「帧数应该跟显示器同步」）。
    const hz = refreshRateAt(pet.dragSession.cursor)
    pet.dragTimer = scheduleInterval(() => dragTick(pet), 1000 / hz)
    pet.dragStats = { hz, ticks: 0, last: now(), maxGap: 0 }
  }

  /** 页面每次 pointermove 都会发心跳，跟着屏幕刷新走；顺手挪一次窗口。 */
  function heartbeatDrag(event, given) {
    const pet = deps.petForEvent(event)
    if (pet === null || pet.dragSession === null) return
    pet.dragSession.lastHeartbeat = now()
    // 页面每次 pointermove 都会发心跳，跟着屏幕刷新走；顺手挪一次窗口，
    // 比只靠主进程定时器（Windows 上计时精度约 15.6ms）更顺。
    const cursor = pageCursor(pet, given)
    // niri 的空心跳只续命，不挪窗：它没有新的指针坐标。
    if (cursor === null && deps.surface.niriEnabled === true) return
    if (deps.surface.niriEnabled === true) {
      // 每个 pointermove 都发一次 move-floating-window 太贵；16ms 一帧刚好跟 60Hz。
      const last = Number(pet.dragSession.lastMoveAt) || 0
      if (now() - last < 14) return
      pet.dragSession.lastMoveAt = now()
    }
    dragTick(pet, cursor)
  }

  /** 页面松手：最后挪一帧、记日志、把几何同步回给页面。 */
  function endDrag(event, release = null) {
    const pet = deps.petForEvent(event)
    if (pet === null) return
    // 页面的 release 坐标可能比主进程此刻读到的光标旧（输入队列延迟）；
    // 主进程的光标是最新值，最后一帧用它算 slide。
    const cursor = pageCursor(pet, release) ?? pet.dragSession?.lastCursor ?? null
    dragTick(pet, cursor)
    if (pet.dragSession !== null) {
      // 把合并队列里最后几帧的位移同步发完，再查 niri 真位置；否则松手后
      // window.json / 面板锚点会比实际窗口少走最后一小段。
      deps.surface.flushNiriSync?.()
      deps.surface.syncPetFromNiri?.(pet)
      const bounds = pet.window === null || pet.window.isDestroyed() ? null : deps.surface.readBounds(pet)
      // 猪在窗口里的位置：页面给了就用它，没给就用上次量到的（和 dragTick 同一套兜底）。
      const pig = pet.dragSession.pig ?? pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
      const startWindow = { x: pet.dragSession.pigScreen.x - pig.x, y: pet.dragSession.pigScreen.y - pig.y }
      deps.log('drag end', JSON.stringify({ pigId: pet.pigId, bounds, from: startWindow, movedBy: bounds === null ? null
        : { x: bounds.x - startWindow.x, y: bounds.y - startWindow.y } }))
      // tick 是不是跟得上刷新率：maxGap 远大于 1000/hz 就说明主进程被别的活挡住了。
      if (pet.dragStats !== null) deps.log('drag ticks', JSON.stringify(pet.dragStats))
    }
    stopDrag(pet)
    pet.restingPigScreen = null
    deps.panel.reanchorPanel(pet)
    // 页面紧接着要读几何重定家：把最后一帧 slide 一起同步返回，避免 send/sendSync 乱序。
    event.returnValue = geometryOf(pet.window === null || pet.window.isDestroyed()
      ? { x: 0, y: 0, width: 0, height: 0 } : deps.surface.readBounds(pet), pet)
  }

  return { refreshRateAt, dragTick, stopDrag, startDrag, heartbeatDrag, endDrag }
}

/**
 * 注册拖动的三条 IPC；回调时机和原来 main.js 里的匿名监听一致。
 * @param {{ ipcMain: { on: (channel: string, listener: (...args: any[]) => any) => any }, engine: ReturnType<typeof createDragEngine> }} deps
 */
export function registerDragIpc(deps) {
  deps.ipcMain.on('piggy:drag:start', (event, given) => deps.engine.startDrag(event, given))
  deps.ipcMain.on('piggy:drag:heartbeat', (event, given) => deps.engine.heartbeatDrag(event, given))
  deps.ipcMain.on('piggy:drag:end', (event, release) => deps.engine.endDrag(event, release))
}
