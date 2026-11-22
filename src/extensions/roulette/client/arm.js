// @ts-check
/**
 * 装弹动画与请求状态：点弹孔 -> 700ms 转轮动画 -> 发 arm。
 * 动画期间返回可取消并全额退款；arm 已发出但回包未到时挡住返回，
 * 等回包或 8 秒兜底，避免拿旧快照当“免费取消”而静默判负。
 */

/**
 * @param {{
 *   ui: any,
 *   chambers: number,
 *   cancel: (id: any) => void,
 *   later: (fn: () => void, ms: number) => any,
 *   send: (op: string) => any,
 *   rerender: () => void,
 *   toast: (text: string) => void,
 * }} deps
 */
export function createArm(deps) {
  const { ui, chambers, cancel, later, send, rerender, toast } = deps

  /** 清掉装弹动画/在途标记，并让旧请求的回调失效。 */
  function reset() {
    if (ui.armTimer !== null) {
      cancel(ui.armTimer)
      ui.armTimer = null
    }
    ui.arming = false
    ui.spinning = false
    ui.primerPop = false
    ui.primer = -1
    ui.armPending = false
    ui.armUncertain = false
    ui.armToken += 1
  }

  function load(index) {
    if (ui.arming || ui.armPending) return
    const hole = Number.isInteger(index) ? index : Math.floor(Math.random() * chambers)
    const token = ++ui.armToken
    ui.arming = true
    ui.spinning = true
    ui.primer = Math.max(0, Math.min(chambers - 1, hole))
    ui.primerPop = true
    rerender()
    ui.armTimer = later(function () {
      ui.armTimer = null
      if (ui.armToken !== token) return
      ui.armPending = true
      const result = send('arm')
      ui.arming = false
      ui.spinning = false
      ui.primerPop = false
      ui.primer = -1
      rerender()
      later(function () {
        if (ui.armToken !== token || !ui.armPending) return
        ui.armPending = false
        ui.armUncertain = true
        toast('装弹请求还没回来，返回会按已装弹处理')
        rerender()
      }, 8000)
      if (result && typeof result.then === 'function') {
        result.then(function (next) {
          if (ui.armToken !== token || !ui.armPending) return
          if (next && next.ok === false) {
            ui.armPending = false
            ui.armUncertain = false
            toast('装弹没送到，点弹孔重试')
            rerender()
          }
        }, function () {})
      }
    }, 700)
  }

  return { reset, load }
}
