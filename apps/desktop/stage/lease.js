// @ts-check
/**
 * 整窗形状的租约（主进程）与页面侧的交互证据状态机。
 *
 * 主进程侧（createInteractionLease）：交互/抛掷期间 Linux 会把整个舞台窗口当可点区域；
 * 页面漏掉 pointerup/pointercancel（抢焦点、系统对话框、锁屏、原生捕获失效）时，
 * 整个桌面就被挡在舞台后面。用一个限期租约兜底：每次 true 续期，超时自动释放。
 *
 * 页面侧（createInteractionHold）：页面不能无条件续租。只要页面还活着，1s 心跳会把 3s 租约
 * 无限续下去，于是「漏松手 + 页面照常运行」就等于永久接管整屏。所以续租之前先看证据：
 * - 按下（pointerdown 主键）要带持续的指针证据；pointermove 的 buttons 为 0 直接证明那次
 *   pointerup 丢了，立刻释放；证据超过 EVIDENCE_MS 没刷新就不再算按着。
 * - 抛掷是游戏自己声明的（stage-bridge 起落时通知），但每个心跳用 isFlying() 复核：
 *   落地后最多一个心跳就把整窗交还给精确形状（新帧交接不再只依赖客户端那一次回调）。
 * - 复核不了的外部声明（老游戏包没有 isFlying）只用页面既有的 20s 守护兜住，不无限续。
 *
 * 两个模块都是纯逻辑，定时器可注入，Node 测试不需要真实等待。
 * @module dsh-piggy-desktop/stage/lease
 */

/**
 * @param {{
 *   onChange: (active:boolean, reason:string) => void,
 *   timeout?: number,
 *   setTimer?: (fn:()=>void, ms:number)=>any,
 *   clearTimer?: (timer:any)=>void,
 * }} options
 */
export function createInteractionLease(options) {
  const timeout = Number.isFinite(options.timeout) && options.timeout > 0 ? options.timeout : 3000
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? (timer => clearTimeout(timer))
  /** @type {any} */
  let timer = null
  let active = false
  let disposed = false

  function disarm() {
    if (timer === null) return
    clearTimer(timer)
    timer = null
  }

  function arm() {
    disarm()
    timer = setTimer(() => {
      timer = null
      if (!active && !disposed) return
      active = false
      if (!disposed) options.onChange(false, 'lease')
    }, timeout)
  }

  function release(reason) {
    disarm()
    if (!active) return false
    active = false
    if (!disposed) options.onChange(false, reason)
    return true
  }

  return {
    /** true 开始/续期；false 立即释放。 */
    request(activeNow) {
      if (disposed) return false
      if (activeNow === false) return release('page')
      if (!active) {
        active = true
        options.onChange(true, 'page')
      }
      arm()
      return true
    },
    release,
    isActive() { return active },
    dispose() {
      const wasActive = active
      disposed = true
      disarm()
      active = false
      if (wasActive) options.onChange(false, 'dispose')
    },
  }
}

/** 页面心跳间隔：既有值（页面每秒续一次，主进程租约 3s 过期）。 */
export const HEARTBEAT_MS = 1000
/** 按下证据的保鲜期：和主进程租约的 3s 同一个时限，两边对「过期」的判断才一致。 */
export const EVIDENCE_MS = 3000
/** 页面既有的兜底守护（20s）：只用于复核不了的外部声明。 */
export const GUARD_MS = 20000

/**
 * @typedef {{
 *   pointerId: number|string,
 *   button?: number,
 *   buttons?: number,
 * }} PointerInput
 *
 * @typedef {{
 *   send: (active:boolean) => void,
 *   onChange?: (active:boolean) => void,
 *   isFlying?: () => boolean|null,
 *   isHidden?: () => boolean,
 *   hasFocus?: () => boolean,
 *   now?: () => number,
 *   setTimer?: (fn:()=>void, ms:number)=>any,
 *   clearTimer?: (timer:any)=>void,
 *   setTick?: (fn:()=>void, ms:number)=>any,
 *   clearTick?: (timer:any)=>void,
 * }} HoldOptions
 */

/**
 * 页面侧：什么时候该由页面接管整窗，以及什么时候必须交还。
 * @param {HoldOptions} options
 */
export function createInteractionHold(options) {
  const send = typeof options.send === 'function' ? options.send : () => {}
  const onChange = typeof options.onChange === 'function' ? options.onChange : () => {}
  const now = typeof options.now === 'function' ? options.now : () => Date.now()
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? (timer => clearTimeout(timer))
  const setTick = options.setTick ?? ((fn, ms) => setInterval(fn, ms))
  const clearTick = options.clearTick ?? (timer => clearInterval(timer))
  /** null = 页面拿不到 isFlying（旧游戏包），声明只能按页面守护兜住。 */
  const isFlying = typeof options.isFlying === 'function' ? options.isFlying : null
  const isHidden = typeof options.isHidden === 'function' ? options.isHidden : () => false
  const hasFocus = typeof options.hasFocus === 'function' ? options.hasFocus : () => true

  /** @type {Map<number|string, number>} pointerId → 最后一次真实指针证据的时间 */
  const presses = new Map()
  /** 游戏声明的抛掷：每个心跳用 isFlying() 复核。 */
  let flight = false
  /** 复核不了的外部声明：只用页面守护兜住。 */
  let external = false
  let active = false
  let disposed = false
  /** @type {any} */
  let tick = null
  /** @type {any} */
  let guard = null
  /** @type {any} */
  let settle = null

  function flying() { return isFlying !== null && isFlying() === true }

  /** 按下还在不在：至少一个指针，且证据在保鲜期内。 */
  function holding() {
    if (presses.size === 0) return false
    const at = now()
    for (const seen of presses.values()) if (at - seen < EVIDENCE_MS) return true
    return false
  }

  function wants() {
    return (presses.size > 0 && holding()) || flight || external
  }

  function disarmGuard() {
    if (guard === null) return
    clearTimer(guard)
    guard = null
  }

  function armGuard() {
    if (guard !== null) return
    guard = setTimer(() => {
      guard = null
      external = false
      reconcile()
    }, GUARD_MS)
  }

  /** 放弃全部声明（不发送，交给 reconcile 决定收尾）。 */
  function drop() {
    presses.clear()
    flight = false
    external = false
    disarmGuard()
    if (settle !== null) { clearTimer(settle); settle = null }
  }

  function reconcile() {
    if (disposed) return
    // 页面被隐藏：按下的前提不成立，任何声明当场作废（主进程全屏监看会 hide 舞台窗）。
    if (isHidden()) drop()
    const next = wants()
    if (next === active) return
    active = next
    if (active) {
      send(true)
      if (tick === null) tick = setTick(beat, HEARTBEAT_MS)
    } else {
      if (tick !== null) { clearTick(tick); tick = null }
      disarmGuard()
      send(false)
    }
    onChange(active)
  }

  function beat() {
    if (disposed) return
    // 抛掷交接：落地/接住后 isFlying 变 false，最多一个心跳就把整窗换回精确形状。
    if (flight && isFlying !== null && !flying()) flight = false
    // 没有焦点又没有新证据：按下的前提不成立，交还。
    if (!holding() && !hasFocus()) presses.clear()
    if (!wants() || isHidden()) { reconcile(); return }
    // 有证据才续租，无证据的声明到这里已经过期并被释放。
    send(true)
  }

  /** 松手后等这一拍过去：抛掷在同一个 pointerup 里起飞，接管的下一棒是飞行而不是释放。 */
  function settleSoon() {
    if (settle !== null) return
    settle = setTimer(() => {
      settle = null
      if (disposed) return
      if (flying()) flight = true
      reconcile()
    }, 0)
  }

  return {
    /** 主键按下（右键/中键会弹原生菜单并把 pointerup 抢走，不接管）。 */
    pointerDown(input) {
      if (disposed) return false
      const id = input?.pointerId
      if (id === undefined || id === null) return false
      if (Number(input?.button ?? 0) !== 0) return false
      presses.set(id, now())
      reconcile()
      return active
    },
    /** 指针移动：buttons 为 0 说明那根指针已经松开了（pointerup 丢了）。 */
    pointerMove(input) {
      if (disposed) return
      const id = input?.pointerId
      const buttons = Number(input?.buttons)
      if (id === undefined || id === null || !Number.isFinite(buttons)) return
      if (buttons === 0) {
        if (presses.delete(id)) reconcile()
        return
      }
      if (!presses.has(id)) return
      presses.set(id, now())
      if (!active) reconcile()
    },
    /** 松开一根：还有别的指针按着就继续接管，全部松开才走交接。 */
    pointerUp(input) {
      if (disposed) return
      const id = input?.pointerId
      if (id === undefined || id === null) return
      if (!presses.delete(id)) return
      if (presses.size > 0) return
      settleSoon()
    },
    /** 游戏自己声明/收回整窗（目前只有抛掷）。 */
    external(next) {
      if (disposed) return
      if (next === true) {
        if (flying()) flight = true
        else { external = true; armGuard() }
      } else {
        flight = false
        external = false
        disarmGuard()
      }
      reconcile()
    },
    /** 失焦、页面隐藏、主进程租约到期：页面这份状态全部作废。 */
    reset() {
      if (disposed) return
      drop()
      reconcile()
    },
    active() { return active },
    dispose() {
      if (disposed) return
      const was = active
      drop()
      if (tick !== null) { clearTick(tick); tick = null }
      disposed = true
      active = false
      if (was) {
        send(false)
        onChange(false)
      }
    },
  }
}
