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
    applyBounds, applyShape, refreshHit, setHit, isMouseRect, shiftedShape, geometryOf, skipNativeShape,
  } = deps.surface

  /** 这块屏的刷新率；拿不到就按 60。 */
  function refreshRateAt(point) {
    const display = point === null || point === undefined ? deps.screen.getPrimaryDisplay() : deps.screen.getDisplayNearestPoint(point)
    const hz = Number(display?.displayFrequency)
    return Number.isFinite(hz) && hz >= 30 ? Math.min(240, Math.round(hz)) : 60
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
    const cursor = cursorOverride !== null && cursorOverride !== undefined
      && Number.isFinite(cursorOverride.x) && Number.isFinite(cursorOverride.y)
      ? { x: cursorOverride.x, y: cursorOverride.y } : deps.screen.getCursorScreenPoint()
    // 夹取按「所有屏」算，不按鼠标当前在哪块屏：鼠标一过两块屏的缝就换夹取范围，
    // 会把猪整只弹回去（上下屏最明显）。见 lib/window-geometry.js 的 dragPigBounds。
    const areas = deps.screen.getAllDisplays().map(display => display.workArea)
    // 按「猪」算，不按起始窗口算：拖动中窗口大小可能变（冒气泡、面板换页），
    // 用起始窗口的大小去 setBounds 会把窗口来回改大改小，猪就一抽一抽的。
    const pig = pet.dragSession.pig ?? { ...(pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }), ...pet.lastPigSize }
    // 窗口大小用请求值，不用回读值（见 petAsked 的说明）
    const wanted = dragPigBounds(pet.petAsked ?? window.getBounds(), pig, pet.dragSession.pigScreen, pet.dragSession.cursor, cursor, areas, pet.dragSession.visual)
    if (!pet.dragShapeActive) {
      pet.dragShapeActive = true
      if (!skipNativeShape) {
        const bounds = window.getBounds()
        applyShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
      }
      refreshHit(pet)
    }
    if (!pet.dragSession.slide) { applyBounds(pet, wanted, 'drag'); return }
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
    const bounds = pet.window.getBounds()
    // A1：页面可能延迟到移动 4px 才发 drag:start，带上 pointerdown 的屏幕坐标当起点。
    // 快速甩动时第一帧就可能离 pointerdown 上百像素，不能按 32px 拒绝；
    // 只拒绝非有限值、超出 512px 或不在当前屏工作区内的坏消息。
    const cursorNow = deps.screen.getCursorScreenPoint()
    const rawOrigin = given?.origin
    const originValid = rawOrigin !== null && rawOrigin !== undefined
      && Number.isFinite(rawOrigin.x) && Number.isFinite(rawOrigin.y)
    const originArea = originValid ? deps.screen.getDisplayNearestPoint(rawOrigin).workArea : null
    const acceptedOrigin = validDragOrigin(rawOrigin, cursorNow, originArea)
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
    if (!skipNativeShape) applyShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
    setHit(pet, true, 'drag-start')
    pet.resizeShape?.cancel()
    deps.log('drag start', JSON.stringify({ pigId: pet.pigId, bounds, pigScreen: pet.dragSession.pigScreen, pigFromPage: pigFromPage !== null,
      origin: acceptedOrigin }))
    // tick 频率跟显示器刷新率走，不再写死 60Hz：144Hz 屏上窗口 60Hz 地动、画面 144Hz 地刷，
    // 一样是抽帧（用户 2026-10-07：「帧数应该跟显示器同步」）。
    const hz = refreshRateAt(pet.dragSession.cursor)
    pet.dragTimer = scheduleInterval(() => dragTick(pet), 1000 / hz)
    pet.dragStats = { hz, ticks: 0, last: now(), maxGap: 0 }
  }

  /** 页面每次 pointermove 都会发心跳，跟着屏幕刷新走；顺手挪一次窗口。 */
  function heartbeatDrag(event) {
    const pet = deps.petForEvent(event)
    if (pet === null || pet.dragSession === null) return
    pet.dragSession.lastHeartbeat = now()
    // 页面每次 pointermove 都会发心跳，跟着屏幕刷新走；顺手挪一次窗口，
    // 比只靠主进程定时器（Windows 上计时精度约 15.6ms）更顺。
    dragTick(pet)
  }

  /** 页面松手：最后挪一帧、记日志、把几何同步回给页面。 */
  function endDrag(event) {
    const pet = deps.petForEvent(event)
    if (pet === null) return
    // 页面的 release 坐标可能比主进程此刻读到的光标旧（输入队列延迟）；
    // 主进程的光标是最新值，最后一帧用它算 slide。
    dragTick(pet)
    if (pet.dragSession !== null) {
      const bounds = pet.window === null || pet.window.isDestroyed() ? null : pet.window.getBounds()
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
    event.returnValue = geometryOf(pet.window?.getBounds() ?? { x: 0, y: 0, width: 0, height: 0 }, pet)
  }

  return { refreshRateAt, dragTick, stopDrag, startDrag, heartbeatDrag, endDrag }
}

/**
 * 注册拖动的三条 IPC；回调时机和原来 main.js 里的匿名监听一致。
 * @param {{ ipcMain: { on: (channel: string, listener: (...args: any[]) => any) => any }, engine: ReturnType<typeof createDragEngine> }} deps
 */
export function registerDragIpc(deps) {
  deps.ipcMain.on('piggy:drag:start', (event, given) => deps.engine.startDrag(event, given))
  deps.ipcMain.on('piggy:drag:heartbeat', event => deps.engine.heartbeatDrag(event))
  deps.ipcMain.on('piggy:drag:end', event => deps.engine.endDrag(event))
}
