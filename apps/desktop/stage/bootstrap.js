// @ts-check
/**
 * 舞台页引导（整屏舞台 / 扩展大窗共用这一份）。
 *
 * 主舞台走现有网页版单页，只在 mount 时给游戏一个受限的舞台适配器
 * （位置写回、气泡下置、抛掷、散步、扩展大窗、代理/全屏能力）。
 * 这里只做页面自身的事：量形状、报交互状态、保存框；不复制玩法，也不写临时壳。
 *
 * 输入接管：按下/抛掷期间整窗可点（Linux setShape 同时裁绘制，A1），松手后交还精确形状。
 * 什么时候接管、什么时候必须交还，全部交给 lease.js 的 createInteractionHold：
 *   - 只有主键按下才算接管；右键/中键会弹原生菜单并把 pointerup 抢走。
 *   - 多指同时按着时，松一根不释放（另一根还在拖，形状提前收窄会裁掉后半段）。
 *   - 指针证据（pointermove 的 buttons）过期、buttons 为 0、页面隐藏、失焦、
 *     主进程租约到期、页面销毁这六路都会交还，页面自己不再无条件续租。
 *   - 抛掷由游戏声明，但每个心跳用 isFlying() 复核，落地后最多一个心跳交还。
 * @module dsh-piggy-desktop/stage/bootstrap
 */

import { createInteractionHold } from './lease.js'
import { collectStageHitShape, collectStageShape, stageShapeKey } from './overlay-shape.js'
import { installSavePicker } from './stage-compat.js'
import { pointerHitsShape } from './shape.js'

const stageShell = /** @type {any} */ (window).stageShell
const piggyShell = /** @type {any} */ (window).piggyShell
const role = stageShell?.role === 'ext' ? 'ext' : 'stage'

/** 舞台自己的样式：桌面版的一行状态条（网页版仍是三行窄卡，不改网页 UI）。 */
function installStageStyle() {
  const style = document.createElement('style')
  style.setAttribute('data-piggy-stage-style', '')
  style.textContent = [
    '[data-dsh-pig] .dp-hud{flex-direction:row!important;align-items:baseline!important;gap:10px!important;white-space:nowrap}',
    '[data-dsh-pig] .dp-hud>div{overflow:hidden;text-overflow:ellipsis;max-width:38vw}',
    // 舞台没有桌面窗口的投影/暗底，保留原来的可见性即可；这里不覆盖游戏配色。
  ].join('\n')
  document.head.appendChild(style)
  document.documentElement.setAttribute('data-piggy-stage', '')
  return style
}

/** 扩展大窗：沿用桌面版 loader 的 role=ext 安装顺序。 */
function mountExtension(game) {
  const shell = {
    role: 'ext',
    extKey: piggyShell?.extKey ?? null,
    ext: piggyShell?.ext,
    saves: piggyShell?.saves,
    proxy: piggyShell?.proxy,
    fullscreen: piggyShell?.fullscreen,
    geometry: piggyShell?.geometry,
    onStateChanged: piggyShell?.onStateChanged,
    beginDrag() {},
    endDrag() {},
    dragHeartbeat() {},
    syncGeometry() {},
    panel: {
      on: piggyShell?.panel?.on,
      onFx: piggyShell?.panel?.onFx,
      fx: (name, args) => piggyShell?.panel?.fx?.(name, args),
      toggle() {},
      size() {},
      close() {},
      raisePet() {},
    },
  }
  game.desktop.install(shell)
  game.mount({ stage: { role: 'ext' } })
  game.desktop.start()
}

function mountStage(game) {
  installStageStyle()
  installSavePicker({ stageShell })

  let geometry = null
  let host = null
  let scheduled = false
  let lastKey = ''
  let lastHitKey = ''
  let disposed = false
  const removers = []

  const hold = createInteractionHold({
    send: active => stageShell?.setInteracting?.(active === true),
    onChange: () => schedule(),
    // 抛掷归游戏声明；页面按心跳复核，客户端那次回调丢了也能交还（新帧交接）。
    isFlying: () => {
      const api = /** @type {any} */ (window).piggyStage
      return typeof api?.isFlying === 'function' ? api.isFlying() === true : null
    },
    isHidden: () => document.visibilityState === 'hidden',
    hasFocus: () => document.hasFocus?.() !== false,
  })

  function schedule() {
    if (scheduled || disposed) return
    scheduled = true
    requestAnimationFrame(flush)
  }

  function flush() {
    scheduled = false
    if (disposed) return
    if (host === null) host = document.querySelector('[data-dsh-pig]')
    if (host === null) return
    const report = collectStageShape(host, document, /** @type {any} */ (window).piggyStage)
    if (report === null) return
    const interacting = hold.active()
    // 页面 zoom / 显示器切换会改 dpr 和 CSS 视口，猪的矩形可能一模一样；
    // 去重键必须带上这两个量，否则主进程收不到“缩放变了”的更新。
    const dpr = /** @type {any} */ (window).devicePixelRatio
    const viewport = {
      width: /** @type {any} */ (window).innerWidth,
      height: /** @type {any} */ (window).innerHeight,
    }
    lastHitKey = stageShapeKey(report.hitShape)
    const key = [stageShapeKey(report.shape), lastHitKey, interacting ? '1' : '0', String(dpr), viewport.width + 'x' + viewport.height].join('|')
    if (key === lastKey) return
    lastKey = key
    stageShell?.report?.({ ...report, dpr, viewport, interacting })
  }

  function onPointerDown(event) {
    if (host === null) return
    const api = /** @type {any} */ (window).piggyStage ?? {}
    const hitShape = collectStageHitShape(host, document, api)
    if (hitShape !== undefined) {
      // host/scene 的透明布局空间不能获取整窗租约；坐标和报告共用 CSS 视口。
      if (!pointerHitsShape({ x: event.clientX, y: event.clientY }, { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, hitShape)) return
    } else {
      const target = /** @type {any} */ (event?.target)
      if (typeof target?.closest !== 'function' || target.closest('[data-dsh-pig]') === null) return
    }
    hold.pointerDown({ pointerId: event.pointerId, button: event.button })
  }

  function onPointerMove(event) {
    hold.pointerMove({ pointerId: event.pointerId, buttons: event.buttons })
  }

  function onPointerEnd(event) {
    hold.pointerUp({ pointerId: event.pointerId })
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') hold.reset()
    else schedule()
  }

  function onGeometry(info) {
    if (info === null || info === undefined) return
    geometry = info
    schedule()
  }

  function attach(hostNode) {
    host = hostNode
    const observer = new MutationObserver(schedule)
    // 弹窗可以挂在 body；它们显隐后也要及时撤回输入，不能只监听 host。
    observer.observe(document.body, {
      subtree: true, childList: true, attributes: true, characterData: true,
      attributeFilter: ['style', 'class', 'hidden', 'src', 'data-open', 'data-panel-side', 'data-panel-vertical',
        'data-dragging', 'data-window-dragging', 'data-mood', 'data-react', 'data-feed', 'data-away', 'data-idle',
        'data-stage', 'data-ext-view', 'data-size', 'data-bubble-side', 'data-gift-side', 'data-gift-held'],
    })
    const resizer = new ResizeObserver(schedule)
    resizer.observe(host)
    for (const selector of ['.dp-scene', '.dp-card', '.dp-pig', '.dp-bubble', '.dp-hud', '.dp-daily', '.dp-work']) {
      const node = host.querySelector(selector)
      if (node !== null) resizer.observe(node)
    }
    removers.push(() => { observer.disconnect(); resizer.disconnect() })
    for (const [type, handler, options] of /** @type {any[]} */ ([
      ['resize', schedule, { passive: true }],
      ['pointermove', onPointerMove, { capture: true, passive: true }],
      ['pointermove', schedule, { capture: true, passive: true }],
      ['pointerdown', onPointerDown, true],
      ['pointerup', onPointerEnd, true],
      ['pointercancel', onPointerEnd, true],
      ['pointerup', schedule, null],
      ['pointercancel', schedule, null],
      ['blur', () => hold.reset(), null],
    ])) {
      window.addEventListener(type, handler, options ?? undefined)
      removers.push(() => window.removeEventListener(type, handler, options ?? undefined))
    }
    document.addEventListener('transitionend', schedule, { passive: true })
    document.addEventListener('animationend', schedule, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    removers.push(() => document.removeEventListener('transitionend', schedule))
    removers.push(() => document.removeEventListener('animationend', schedule))
    removers.push(() => document.removeEventListener('visibilitychange', onVisibility))
    if (document.fonts?.ready) document.fonts.ready.then(schedule).catch(function () {})
    // CSS 呼吸/翻转不产生 DOM mutation；只采样真实输入，变化时才重报绘制与输入。
    const hitTimer = setInterval(() => {
      if (disposed || hold.active() || document.visibilityState === 'hidden') return
      const api = /** @type {any} */ (window).piggyStage ?? {}
      if (stageShapeKey(collectStageHitShape(host, document, api)) !== lastHitKey) schedule()
    }, 32)
    removers.push(() => clearInterval(hitTimer))

    const offs = [
      stageShell?.onGeometry?.(onGeometry),
      stageShell?.onInteractionOff?.(() => hold.reset()),
    ]
    for (const off of offs) if (typeof off === 'function') removers.push(off)
    if (geometry === null) onGeometry(stageShell?.askGeometry?.() ?? stageShell?.geometry?.() ?? null)
    schedule()
    for (const delay of [120, 400, 1200, 3000]) {
      const timer = setTimeout(() => { schedule() }, delay)
      removers.push(() => clearTimeout(timer))
    }
  }

  const disposeGame = game.mount({
    stage: {
      role: 'stage',
      geometry: () => stageShell?.askGeometry?.() ?? stageShell?.geometry?.() ?? null,
      onGeometry: (callback) => {
        if (typeof callback !== 'function') return null
        const off = stageShell?.onGeometry?.(callback)
        onGeometry(stageShell?.askGeometry?.() ?? stageShell?.geometry?.() ?? null)
        return off
      },
      onBlur: (callback) => { if (typeof callback !== 'function') return null; return stageShell?.onBlur?.(callback) },
      onRecover: (callback) => { if (typeof callback !== 'function') return null; return stageShell?.onRecover?.(callback) },
      // 游戏自己声明的整窗请求（目前只有抛掷）：复核不了就只用页面守护兜住。
      setInteracting: active => hold.external(active === true),
    },
  })

  const tryAttach = (attempt = 0) => {
    if (disposed) return
    const node = document.querySelector('[data-dsh-pig]')
    if (node !== null) { attach(node); return }
    if (attempt > 60) { console.error('[stage] pig host missing after mount'); return }
    requestAnimationFrame(() => tryAttach(attempt + 1))
  }
  tryAttach()

  return function dispose() {
    if (disposed) return
    disposed = true
    try { hold.dispose() } catch { /* page is going away */ }
    try { disposeGame?.() } catch { /* page is going away */ }
    for (const remove of removers.splice(0)) remove()
  }
}

const game = /** @type {any} */ (window).piggyGame
if (game === null || game === undefined || typeof game.mount !== 'function') {
  console.error('[stage] client.js entry missing')
} else if (role === 'ext') {
  mountExtension(game)
} else {
  const dispose = mountStage(game)
  window.addEventListener('pagehide', () => dispose(), { once: true })
}
