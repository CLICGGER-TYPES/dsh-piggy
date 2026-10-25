// @ts-check
/**
 * 舞台主进程的清理清单：定时器、窗口监听、host dispose 都从这里走。
 *
 * 退出和 renderer 崩溃共用一次 dispose；重复调用返回同一个 Promise，
 * 单项失败只记日志，不阻止后面的保存。
 * @module dsh-piggy-desktop/stage/lifecycle
 */

/**
 * @param {(message:string, error?:unknown) => void} [onError]
 */
export function createCleanup(onError = () => {}) {
  /** @type {Array<() => any>} */
  const tasks = []
  /** @type {Promise<{ok:boolean}>|null} */
  let running = null
  let closed = false

  return {
    /** 后加的先执行（窗口 -> 轮询 -> host）。 */
    add(task) {
      if (typeof task !== 'function') return () => {}
      if (closed) { onError('cleanup already closed'); return () => {} }
      tasks.push(task)
      return () => {
        const index = tasks.indexOf(task)
        if (index >= 0) tasks.splice(index, 1)
      }
    },
    get closed() { return closed },
    dispose() {
      if (running !== null) return running
      closed = true
      running = (async () => {
        let ok = true
        for (let index = tasks.length - 1; index >= 0; index -= 1) {
          try { await tasks[index]() } catch (error) { ok = false; onError('cleanup task failed', error) }
        }
        tasks.length = 0
        return { ok }
      })()
      return running
    },
  }
}
