// @ts-check
/**
 * 窗口的几何与输入面：窗口摆在哪、给页面推什么几何、哪些像素可点。
 *
 * 从 main.js 原样搬来。窗口本身的创建/关闭/重建在 lib/window-manager.js，
 * 拖动引擎和 IPC 仍留在组合根；这里只做「作用于窗口」的部分，方便单独测。
 * Electron 对象、屏、面板和日志都由调用方经 deps 传入。
 */
import { cursorHitsWindow } from './hit-physical.js'

/** 非拖动时，窗口位置/大小差这么多以内就不改（见 applyBounds）。 */
const BOUNDS_TOLERANCE = 2
/** 换位置后最多等这么久的新 hitShape；页面不再上报时恢复按当前形状命中，不能永久不可点。 */
const HIT_PENDING_MS = 600

/**
 * @param {{
 *   screen: any,
 *   platform: string,
 *   env: Record<string, string | undefined>,
 *   panel: { followPig: (pet: any) => void },
 *   scheduleWindowStateSave: () => void,
 *   log: (...parts: any[]) => any,
 *   startupInputTrace: { record: (key: string, label: string, detail: string) => void },
 *   traceSetIgnoreMouseEvents: (role: string, mode: string, source: string, ignore: boolean, forward: boolean | 'omitted', invoke: () => void) => void,
 * }} deps
 */
export function createWindowSurface(deps) {
  /**
   * Windows 上不用 setShape，改用鼠标穿透：现代游戏由主进程轮询命中，旧游戏由页面上报。
   * setShape 在 Windows 上是 SetWindowRgn，开关面板时可点区域整块变化，透明分层窗口会闪一下白
   * （用户 2026-10-05：装了 0.2.5 右键开关菜单仍闪白屏）。穿透模式下窗口区域从不变化。
   * PIGGY_SHAPE=1 可退回旧做法，方便对比排查。
   */
  const SKIP_NATIVE_SHAPE = deps.platform === 'win32' && deps.env.PIGGY_SHAPE !== '1'
  /** macOS 没有 setShape；独立输入区域也可叠加在 Linux 的保守绘制裁剪之上。 */
  const MOUSE_PASSTHROUGH = SKIP_NATIVE_SHAPE || deps.platform === 'darwin'
  /**
   * Wayland 桌面（原生 Wayland 或 XWayland）不支持 X11 的 setIgnoreMouseEvents 语义：
   * 启动时设成 true 后，窗口会一直收不到点击。Wayland 会话下保持窗口可交互，
   * 透明区域由窗口管理器/原生 shape 处理；纯 X11 会话仍走精确命中。
   */
  const ALWAYS_INTERACTIVE = deps.platform === 'linux' && Boolean(deps.env.WAYLAND_DISPLAY)
  let geometrySeq = 0
  /** 同一种换算错误只记一次，避免 16ms 轮询刷日志。 */
  let hitProblem = ''

  /** 这块窗口落在哪块屏上，就用那块屏的工作区。 */
  function workAreaFor(bounds) {
    return deps.screen.getDisplayMatching(bounds).workArea
  }

  /** 把窗口几何推给页面：面板要朝屏幕里侧开。 */
  function pushGeometry(pet) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed()) return
    const bounds = window.getBounds()
    window.webContents.send('piggy:geometry', geometryOf(bounds, pet, ++geometrySeq))
  }

  /** 窗口、它所在屏的工作区、所有屏的工作区：游戏包里的桌面逻辑按这些自己算窗口摆哪。 */
  function geometryOf(bounds, pet = null, seq = geometrySeq) {
    const displays = deps.screen.getAllDisplays()
    return {
      window: bounds,
      workArea: workAreaFor(bounds),
      workAreas: displays.map(display => display.workArea),
      // 显示器清单（含每块屏的缩放）：Windows 125%/150% 下的问题一直只能靠 2px 容差硬扛，
      // 把这些发给游戏包，日志里才能看出「是哪块屏、什么缩放」。
      displays: displays.map(display => ({ id: display.id, label: display.label,
        bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor, internal: display.internal })),
      dragSlide: pet?.lastDragSlide ?? { x: 0, y: 0 },
      seq,
    }
  }

  /**
   * 挪/改窗口。返回这次实际改了多少（没改返回 null），写进日志方便排查。
   * 除了拖动，差 2px 以内一律不动：Windows 125%/150% 缩放下 setBounds 设的尺寸和 getBounds
   * 读回来的常差 1px，精确比较会让每次内容上报都重新 setBounds，透明窗口就闪一下。
   */
  function applyBounds(pet, next, why) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed()) return null
    const before = window.getBounds()
    const delta = { x: next.x - before.x, y: next.y - before.y, width: next.width - before.width, height: next.height - before.height }
    // 分数缩放回读可能比请求大 1px；目标没变时不要每个拖动 tick 重设同一窗口。
    // 新目标仍用零容差，保证 1px 鼠标位移可达；真实外部偏移超出容差时继续纠正。
    const sameRequest = pet.petAsked !== null && ['x', 'y', 'width', 'height'].every(key => pet.petAsked[key] === next[key])
    const tolerance = (why === 'drag' || why === 'move') && !sameRequest ? 0 : BOUNDS_TOLERANCE
    if (Math.abs(delta.x) <= tolerance && Math.abs(delta.y) <= tolerance
      && Math.abs(delta.width) <= tolerance && Math.abs(delta.height) <= tolerance) return null
    // 窗口换了位置/大小：旧 hitShape 属于上一轮摆放，先放行桌面，等这次 place 的新 hitShape 再恢复。
    // 拖动期间命中被强制保持为 true（dragSession），不能在这里清。
    if (why === 'place' && pet.dragSession === null && pet.placedHitShape !== null && pet.hasPlacedHitShape === true) {
      pet.hitPending = true
      pet.hitPendingAt = Date.now()
      setHit(pet, false, 'placement-pending')
    }
    // Linux 现代游戏：页面可能一直不上报 hitShape（或只报空），这里标记允许用原生可见轮廓兜底，
    // 否则 setIgnoreMouseEvents(true) 会一直停在 1x1 输入区。旧游戏没有 bounds 的 place 不会走到这里。
    if (why === 'place' && deps.platform === 'linux' && pet.passthroughMode === 'modern') pet.fallbackArmed = true
    window.setBounds(next)
    pet.petAsked = { ...next }
    deps.panel.followPig(pet)
    // 拖动时每秒要挪几十次：别每次都写日志（Windows 上同步写盘会卡住主进程）。
    if (why !== 'drag' && why !== 'move') deps.log('bounds', why, pet.pigId ?? 'legacy', JSON.stringify(next))
    if (pet.primary) deps.scheduleWindowStateSave()
    pushGeometry(pet)
    return delta
  }

  function setHit(pet, hit, source = 'hit-state') {
    const window = pet?.window
    if (ALWAYS_INTERACTIVE) {
      if (window === null || window === undefined || window.isDestroyed()) return
      // Wayland 会话没有可靠的 X11 输入区语义：永远不要把自己设成鼠标穿透。
      if (pet.passthroughHit === true && pet.passthroughForward === false) return
      pet.passthroughHit = true
      pet.passthroughForward = false
      deps.traceSetIgnoreMouseEvents('pet', pet.passthroughMode, source, false, false,
        () => window.setIgnoreMouseEvents(false, { forward: false }))
      return
    }
    // Linux 的原生绘制轮廓就是可见猪/面板本身，不是 Windows 那种带透明留白的整窗；
    // 页面偶尔报空 hitShape 时用它兜底，避免窗口永久停在 1x1 的鼠标穿透区。
    const pig = pet.panelPig
    const hasLinuxShape = deps.platform === 'linux' && pet.passthroughMode === 'modern'
      && pet.fallbackArmed === true && !pet.flightShapeActive && !pet.dragShapeActive
      && pig !== null && pig !== undefined && [pig.x, pig.y, pig.width, pig.height].every(Number.isFinite)
      && pig.width > 0 && pig.height > 0
    if ((!MOUSE_PASSTHROUGH && pet.placedHitShape === null && !hasLinuxShape) || window === null || window === undefined || window.isDestroyed()) return
    const forward = pet.passthroughMode === 'legacy' && MOUSE_PASSTHROUGH
    if (hit === pet.passthroughHit && forward === pet.passthroughForward) return
    pet.passthroughHit = hit
    pet.passthroughForward = forward
    deps.traceSetIgnoreMouseEvents('pet', pet.passthroughMode, source, !hit, forward,
      () => window.setIgnoreMouseEvents(!hit, { forward }))
  }

  function setPassthroughMode(pet, next, source) {
    if (next === pet.passthroughMode) return
    const previous = pet.passthroughMode
    pet.passthroughMode = next
    deps.startupInputTrace.record(`mouse-mode:${previous}:${next}:${source}`, 'startup mouse mode', JSON.stringify({ from: previous, to: next, source, pigId: pet.pigId }))
  }

  function setLegacyHit(pet, hit = pet.passthroughHit, source = 'legacy') {
    if (pet.passthroughMode === 'modern') return
    setPassthroughMode(pet, 'legacy', source)
    setHit(pet, hit, source)
  }

  /** 只把合法的窗口协议消息作为能力证据，不能让坏消息启用全局转发。 */
  function isMouseRect(rect) {
    return rect != null && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
      && rect.width >= 0 && rect.height >= 0
  }
  function isMouseShape(rects) {
    return Array.isArray(rects) && rects.every(isMouseRect)
  }
  function isPlaceRequest(request) {
    return request !== null && typeof request === 'object' && !Array.isArray(request)
      && [request.bounds, request.pig].every(rect => rect === undefined || (isMouseRect(rect) && rect.width > 0 && rect.height > 0))
      && (request.shape === undefined || isMouseShape(request.shape))
      && (request.hitShape === undefined || isMouseShape(request.hitShape))
  }

  /** 穿透窗口可能收不到第一次 mousemove；主进程读取光标，保证首次点击就能命中猪。 */
  function shiftedShape(rects, slide) {
    if (slide.x === 0 && slide.y === 0) return rects
    return rects.map(rect => ({
      x: rect.x + slide.x,
      y: rect.y + slide.y,
      width: rect.width,
      height: rect.height,
    }))
  }

  function refreshHit(pet) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed() || pet.dragSession !== null) return
    if (!pet.hasPlacedShape && pet.placedHitShape === null && pet.hasPlacedHitShape !== true) return
    // 等待本轮 place 的新 hitShape：期间一律放行桌面，不能拿上一轮的命中继续点。
    // 页面不再上报时按当前窗口局部形状恢复，避免换位置后永久点不到猪。
    if (pet.hitPending && Date.now() - pet.hitPendingAt >= HIT_PENDING_MS) pet.hitPending = false
    if (pet.hitPending) { setHit(pet, false, 'placement-pending'); return }
    // 页面报过独立输入面后，缺 hitShape 时不再拿含透明预留的绘制轮廓兜底。
    // Linux 例外：setShape 已经把窗口裁成可见猪/面板，原生绘制轮廓本身就是精确输入面；
    // 页面的 hitShape 在换位/启动时可能为空或陈旧，继续信它会让窗口停在 1x1 穿透区。
    const preciseHit = Array.isArray(pet.placedHitShape) && pet.placedHitShape.length > 0 ? pet.placedHitShape : null
    const pig = pet.panelPig
    const linuxPig = deps.platform === 'linux' && pet.passthroughMode === 'modern'
      && pet.fallbackArmed === true && !pet.flightShapeActive && !pet.dragShapeActive
      && pig !== null && pig !== undefined && [pig.x, pig.y, pig.width, pig.height].every(Number.isFinite)
      && pig.width > 0 && pig.height > 0 ? [{ ...pig }] : null
    if (linuxPig === null && preciseHit === null && pet.hasPlacedHitShape === true) {
      setHit(pet, false, 'missing-hit-shape')
      return
    }
    const bounds = window.getBounds()
    // 只有旧契约把动作整窗绘制区域也当输入；新契约不能让透明预留抢走桌面点击。
    const baseShape = linuxPig ?? preciseHit ?? pet.placedHitShape ?? pet.placedShape
    const linuxFallbackActive = linuxPig !== null
    const shape = !linuxFallbackActive && preciseHit === null && (pet.flightShapeActive || pet.dragShapeActive)
      ? [{ x: 0, y: 0, width: bounds.width, height: bounds.height }]
      : shiftedShape(baseShape, pet.flightShapeActive ? pet.flightSlide : pet.dragShapeActive ? pet.lastDragSlide : pet.flightSlide)
    const { hit, problem } = cursorHitsWindow({ platform: deps.platform, screen: deps.screen, window, shape })
    if (problem !== hitProblem) {
      hitProblem = problem
      if (problem !== '') deps.log('hit conversion rejected', problem)
    }
    setHit(pet, hit, 'cursor-hit-test')
  }

  /** 抛掷只挪窗口，不重排、不 followPig、不推几何、不写 window.json（A2）。 */
  function applyFlightBounds(pet, x, y) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed()) return
    const size = pet.petAsked ?? window.getBounds()
    const next = { x: Math.round(x), y: Math.round(y), width: size.width, height: size.height }
    if (pet.petAsked !== null && pet.petAsked.x === next.x && pet.petAsked.y === next.y
      && pet.petAsked.width === next.width && pet.petAsked.height === next.height) return
    window.setBounds(next)
    pet.petAsked = { ...next }
  }

  /** 原生 shape 仍负责绘制裁剪；不能用更小的输入区域裁掉动作和特效。 */
  function applyShape(pet, rects) {
    const window = pet?.window
    if (SKIP_NATIVE_SHAPE || window === null || window === undefined || window.isDestroyed() || deps.platform === 'darwin' || typeof window.setShape !== 'function') return
    window.setShape(rects)
    if (pet.placedHitShape !== null) {
      // 原生绘制提交后重新应用独立输入，不能仅凭上次的命中布尔值跳过。
      pet.passthroughForward = null
      if (pet.dragSession !== null) setHit(pet, true, 'shape-commit')
      else refreshHit(pet)
    }
  }

  return {
    applyBounds,
    applyFlightBounds,
    applyShape,
    refreshHit,
    setHit,
    setPassthroughMode,
    setLegacyHit,
    isMouseRect,
    isMouseShape,
    isPlaceRequest,
    shiftedShape,
    pushGeometry,
    geometryOf,
    workAreaFor,
    currentSeq: () => geometrySeq,
    skipNativeShape: SKIP_NATIVE_SHAPE,
    mousePassthrough: MOUSE_PASSTHROUGH,
  }
}
