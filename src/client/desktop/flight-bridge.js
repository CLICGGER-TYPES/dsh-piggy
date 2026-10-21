// @ts-check
/**
 * piggyShell.flight：A2 抛掷时「窗口跟飞」的桥。
 *
 * 页面只把算好的窗口位置交给外壳；弹道在 feel/flight-run，窗口驱动在外壳。
 * 旧外壳没有 flyMove 时 supported=false，页面自动退回原地落地。
 * @module dsh-piggy/client/desktop/flight-bridge
 */

/**
 * @param {{
 *   shell: any,
 *   readGeometry: () => any,
 *   pigInWindow: (win: {x:number,y:number,width:number,height:number}) => any,
 *   rehome: (win: {x:number,y:number,width:number,height:number}, pig: any, areas: any[]) => void,
 *   setFlying: (on: boolean) => void,
 *   isFlying: () => boolean,
 *   clearSlide: (slide: {x:number,y:number}) => void,
 *   forgetLayout: () => void,
 *   tick: () => void,
 * }} c
 */
export function createFlightBridge(c) {
  return {
    supported: typeof c.shell.flyMove === 'function',
    start: function () {
      const info = c.readGeometry()
      if (info === null || info === undefined || !info.window) return null
      const pig = c.pigInWindow(info.window)
      if (pig === null) return null
      return {
        home: { x: info.window.x + pig.x + pig.width / 2, y: info.window.y + pig.y + pig.height },
        pig: { x: pig.x, y: pig.y, width: pig.width, height: pig.height },
        window: { x: info.window.x, y: info.window.y, width: info.window.width, height: info.window.height },
        area: info.workArea,
        areas: info.workAreas ?? [info.workArea],
      }
    },
    move: function (x, y, slide) {
      if (typeof c.shell.flyMove !== 'function') return
      c.shell.flyMove({ x: x, y: y, slide: slide ?? { x: 0, y: 0 } })
    },
    setFlying: function (on) {
      c.setFlying(on === true)
      if (!c.isFlying()) { c.forgetLayout(); c.tick() }
    },
    /** 落地/接住后重定家：用最后一次请求的窗口位置 + 猪在窗口里的框 + slide，不依赖异步回读。 */
    finish: function (last) {
      c.setFlying(false)
      if (last !== null && last !== undefined && last.window && last.pig) {
        const pig = {
          x: last.pig.x + (last.slide?.x ?? 0),
          y: last.pig.y + (last.slide?.y ?? 0),
          width: last.pig.width,
          height: last.pig.height,
        }
        c.rehome(last.window, pig, last.areas ?? [])
      }
      c.clearSlide(last?.slide ?? { x: 0, y: 0 })
      c.forgetLayout()
      c.tick()
    },
  }
}
