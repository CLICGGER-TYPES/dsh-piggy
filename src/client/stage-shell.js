// @ts-check
/**
 * 舞台适配器的注册表与转发规则（不碰 DOM）。
 *
 * 整屏舞台还是网页版单页：桌面外壳（window.__dshPiggyShell）必须保持 null，
 * 否则网页拖动会被当成桌面拖动、clampPig 也不管位置。舞台要的那几项能力
 * （写回位置、开关面板、扩展大窗、抛掷、散步、代理/全屏设置）由游戏在 mount 时
 * 注册一个受限适配器，只挂 window.piggyStage；壳里没有永久伪装。
 *
 * 本模块只放纯规则，DOM 生命周期在 stage-bridge.js，测试可以直接 import。
 * @module dsh-piggy/client/stage-shell
 */
import { PIG_FX } from './pig-fx.js'

/** @type {any} */
let current = null

/** 当前舞台适配器；网页版、默认桌面版里恒为 null。 */
export function stageShell() {
  return current
}

/** 由 stage-bridge 在 mount 时注册。 */
export function registerStageShell(adapter) {
  if (adapter === null || typeof adapter !== 'object') return null
  current = adapter
  return adapter
}

/** 只注销自己，避免旧实例 dispose 掉新实例。 */
export function unregisterStageShell(adapter) {
  if (current === adapter) current = null
}

/**
 * 扩展大界面走哪条路：桌面大窗 > 舞台独立窗口 > 网页铺满。
 * 不按按钮的 data-* 属性判断，第三方扩展调 app.openBig() 也走同一条路。
 * @param {any} desktop window.__dshPiggyShell（现有桌面外壳）
 * @param {any} stage stageShell()
 */
export function openBigTarget(desktop, stage) {
  if (desktop !== null && desktop !== undefined && desktop.ext && typeof desktop.ext.open === 'function') return 'desktop'
  if (stage !== null && stage !== undefined && stage.ext && typeof stage.ext.open === 'function') return 'stage'
  return 'page'
}

/**
 * 把一条转发来的反应交给游戏自己的 ctx 方法（气泡走 speech 的 version/定时器，
 * 动作走 effects，不直接写 DOM）。白名单外一律忽略。
 * @param {any} ctx
 * @param {{name?:string,args?:any[]}|null|undefined} fx
 */
export function applyPigFx(ctx, fx) {
  if (ctx === null || typeof ctx !== 'object') return false
  if (fx === null || typeof fx !== 'object' || typeof fx.name !== 'string') return false
  if (PIG_FX.indexOf(fx.name) < 0) return false
  var run = ctx[fx.name]
  if (typeof run !== 'function') return false
  run.apply(null, Array.isArray(fx.args) ? fx.args : [])
  return true
}

/**
 * 扩展大窗口里：把 ctx 上的反应换成「发给主进程，再转给舞台猪」。
 * 返回的函数恢复原方法（dispose 时必须调用）。
 * @param {any} ctx
 * @param {(name:string,args:any[])=>void} send
 */
export function forwardPigFx(ctx, send) {
  var originals = /** @type {Record<string, any>} */ ({})
  for (var i = 0; i < PIG_FX.length; i += 1) {
    var name = PIG_FX[i]
    if (typeof ctx[name] !== 'function') continue
    originals[name] = ctx[name]
    ctx[name] = (function (key) {
      return function () { send(key, Array.prototype.slice.call(arguments)) }
    })(name)
  }
  return function restore() {
    for (var key in originals) ctx[key] = originals[key]
  }
}
