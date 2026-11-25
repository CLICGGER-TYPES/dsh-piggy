// @ts-check
/**
 * 装弹：一个弹孔一发。玩家连续点不同弹孔，装满本局发数后按「开始转」提交孔位。
 * 动画期间返回可取消并全额退款；arm 已发出但回包未到时挡住返回，
 * 等回包或 8 秒兜底，避免拿旧快照当“免费取消”而静默判负。
 */

/**
 * @param {{
 *   ui: any,
 *   chambers: number,
 *   loadCount: () => number,
 *   cancel: (id: any) => void,
 *   later: (fn: () => void, ms: number) => any,
 *   send: (op: string, payload?: any) => any,
 *   rerender: () => void,
 *   toast: (text: string) => void,
 * }} deps
 */
export function createArm(deps) {
  const { ui, chambers, loadCount, cancel, later, send, rerender, toast } = deps

  /** 清掉装弹动画/在途标记，并让旧请求的回调失效。 */
  function reset() {
    if (ui.armTimer !== null) {
      cancel(ui.armTimer)
      ui.armTimer = null
    }
    ui.arming = false
    ui.spinning = false
    ui.holes = []
    ui.armedHoles = []
    ui.armPending = false
    ui.armUncertain = false
    ui.loaded = false
    ui.armToken += 1
  }

  function maxHoles() {
    const value = Math.floor(Number(loadCount()))
    return Number.isInteger(value) && value > 0 ? Math.min(chambers, value) : 1
  }

  /** 只把子弹放进弹孔，不转、不计时；同一孔再点一次即取出。 */
  function load(index) {
    if (ui.arming || ui.armPending || ui.spinning) return
    const hole = Number.isInteger(index) ? Math.max(0, Math.min(chambers - 1, index)) : null
    if (hole === null) return
    const at = ui.holes.indexOf(hole)
    if (at >= 0) ui.holes.splice(at, 1)
    else if (ui.holes.length >= maxHoles()) {
      toast('本局最多 ' + maxHoles() + ' 发')
      return
    } else ui.holes.push(hole)
    ui.holes.sort((a, b) => a - b)
    ui.loaded = ui.holes.length === maxHoles()
    rerender()
  }

  /** 随机装弹：一次选满本局发数，仍然是一个孔一发。 */
  function random() {
    if (ui.arming || ui.armPending || ui.spinning) return
    const pool = []
    for (let index = 0; index < chambers; index += 1) pool.push(index)
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(Math.random() * (index + 1))
      const swap = pool[index]
      pool[index] = pool[pick]
      pool[pick] = swap
    }
    ui.holes = pool.slice(0, maxHoles()).sort((a, b) => a - b)
    ui.loaded = ui.holes.length === maxHoles()
    rerender()
  }

  /** 玩家按「开始转」后才转轮并提交孔位；装弹本身不会走到这里。 */
  function spin() {
    if (ui.arming || ui.armPending || !ui.loaded) return
    const token = ++ui.armToken
    ui.arming = true
    ui.spinning = true
    rerender()
    ui.armTimer = later(function () {
      ui.armTimer = null
      if (ui.armToken !== token) return
      ui.armPending = true
      const result = send('arm', { holes: ui.holes.slice() })
      ui.arming = false
      ui.spinning = false
      ui.loaded = false
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
            ui.loaded = ui.holes.length === maxHoles()
            toast('装弹没送到，再点开始转')
            rerender()
          }
        }, function () {})
      }
    }, 700)
  }

  return { reset, load, random, spin }
}
