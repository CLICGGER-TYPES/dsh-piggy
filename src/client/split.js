// @ts-check
/**
 * 桌面版拆成两个窗口之后（外壳 0.6.0 起），两边页面怎么配合。
 *
 * 同一份游戏包在猪窗口和面板窗口里各挂一份，共用主进程里同一个存档：
 * - 任一边做了动作，主进程广播「存档变了」，两边立刻刷新（不等 4 秒轮询）。
 * - 面板里对猪的直接反应（喂食时猪的动作、冒气泡）转给猪窗口去演；面板窗口里看不见猪。
 * - 存档里排队的消息（pending）各管各的：猪的反应只在猪窗口演，提示条只在面板里出，
 *   见 panel.js 里 pigSide 那一段——否则两边各演一遍。
 * - 面板开/关、点外面自动收起由主进程转来的消息驱动。
 * @module dsh-piggy/client/split
 */
import { autoCollapseEnabled } from './auto-collapse.js'
import { desktopRole, desktopShell } from './desktop-shell.js'
import { closeFishing } from './tabs/fishing.js'

/** 面板窗口里会转给猪窗口的反应（参数都能直接过进程边界）。 */
export var PIG_FX = ['flash', 'react', 'burst', 'showBubble', 'transform', 'previewArt', 'idleNow', 'walkNow', 'birthdayNow']

/**
 * @param {any} ctx 挂载后的上下文（index.js 的 ctx）
 * @param {{ refresh: () => void, isFishing: () => boolean }} hooks
 * @returns {'pet'|'panel'|null}
 */
export function wireSplit(ctx, hooks) {
  var role = desktopRole()
  var shell = desktopShell()
  if (role === null || shell === null || shell.panel === undefined) return null
  if (typeof shell.onStateChanged === 'function') shell.onStateChanged(function (view) { if (view && Array.isArray(view.pending)) ctx.render(view); else hooks.refresh() })

  if (role === 'pet') {
    // 面板开着时猪自己冒气泡：先把猪窗口抬到面板上面，不然气泡被面板窗口盖住（外壳 0.6.4 起才有）。
    ;['showBubble', 'showLine'].forEach(function (name) {
      var own = ctx[name]
      if (typeof own !== 'function') return
      ctx[name] = function () {
        if (ctx.isOpen && typeof shell.panel.raisePet === 'function') shell.panel.raisePet()
        return own.apply(null, arguments)
      }
    })
    shell.panel.onFx(function (fx) {
      if (fx === null || typeof fx !== 'object' || PIG_FX.indexOf(fx.name) < 0) return
      var run = ctx[fx.name]
      if (typeof run === 'function') run.apply(null, Array.isArray(fx.args) ? fx.args : [])
    })
    shell.panel.on(function (message) {
      if (message && message.type === 'closed') ctx.isOpen = false
    })
    return role
  }

  // 面板窗口：对猪的反应一律转过去。
  PIG_FX.forEach(function (name) {
    ctx[name] = function () { shell.panel.fx(name, Array.prototype.slice.call(arguments)) }
  })
  shell.panel.on(function (message) {
    if (message === null || typeof message !== 'object') return
    if (message.type === 'open') {
      shell.setAnchor({ vertical: message.vertical === 'below' ? 'below' : 'above', maxHeight: Number(message.maxHeight) || 520 })
      if (!ctx.isOpen) ctx.setOpen(true)
      else ctx.fitPanel()
      shell.syncGeometry()
    } else if (message.type === 'closed') {
      if (ctx.isOpen) ctx.setOpen(false)
    } else if (message.type === 'blur') {
      // 焦点到了猪身上（摸猪、拖猪）不收；到了别的程序上，按「点外面自动收起」的设置来。
      if (message.toPet || !ctx.isOpen || !autoCollapseEnabled() || hooks.isFishing() || typing()) return
      ctx.setOpen(false)
    }
  })
  return role
}

/** 猪在屏幕左半边就把签到气泡放猪右边，否则放左边。拿不到窗口位置（测试里）时放左边。 */
function dailySide() {
  var w = /** @type {any} */ (globalThis.window)
  var s = w?.screen
  if (!s || typeof w.screenX !== 'number' || typeof s.availWidth !== 'number') return 'left'
  return w.screenX + (w.innerWidth || 0) / 2 < (s.availLeft || 0) + s.availWidth / 2 ? 'right' : 'left'
}

function typing() {
  var active = /** @type {any} */ (document.activeElement)
  var tag = active?.tagName?.toLowerCase?.() ?? ''
  return tag === 'input' || tag === 'textarea' || active?.getAttribute?.('contenteditable') === 'true'
}

/**
 * 拆窗口时的开关面板；不是拆窗口就返回 false，panel.js 照原来的走。
 * @param {any} ctx
 * @param {boolean} next
 * @returns {boolean} 处理过了
 */
export function splitSetOpen(ctx, next) {
  var role = desktopRole()
  if (role === 'pet') {
    // 猪窗口只记开没开，叫主进程把面板窗口开/关在猪旁边；自己这边永远只有猪。
    // 状态没变就不发（挂载时那次 setOpen(false) 不能去关别人刚打开的面板）。
    var changed = next !== ctx.isOpen
    ctx.isOpen = next
    ctx.host.setAttribute('data-open', 'false')
    // 面板开着时签到 / 礼包小气泡别顶在猪头上：面板窗口的底栏就在那儿，会被压住（用户 2026-10-10）。
    // 挪到猪身子旁边，往屏幕中间那一侧挪，免得挤到屏幕外。
    ctx.host.setAttribute('data-panel-open', String(next))
    ctx.host.setAttribute('data-daily-side', dailySide())
    ctx.card.hidden = true
    ctx.hud.hidden = true
    if (changed) desktopShell().panel.toggle(next)
    return true
  }
  if (role === 'panel' && !next) {
    // 面板窗口收起：窗口由主进程藏起来，卡片留着不拆，下次打开不用重建。
    var wasOpen = ctx.isOpen
    closeFishing(ctx)
    ctx.isOpen = false
    // 挂载时那次 setOpen(false)、主进程已经关掉之后的回声：都不用再叫主进程关。
    if (wasOpen) desktopShell().panel.close()
    return true
  }
  return false
}
