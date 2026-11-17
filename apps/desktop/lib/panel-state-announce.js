// @ts-check
/** 存档变更广播：合并 30ms 内的多次动作，两个窗口一起刷新。 */
export function createStateAnnouncer(deps) {
  let timer = null
  return {
    announce() {
      if (timer !== null) return
      timer = deps.scheduleTimeout(() => { timer = null; deps.toPages('piggy:state-changed') }, 30)
    },
    pending: () => timer,
  }
}
