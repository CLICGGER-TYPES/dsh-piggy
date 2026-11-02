// @ts-check
/**
 * 外部模式的工作事件投递循环：按序重放、错误分档、退避；合并时暂停。
 *
 * 401 重读发现并重试一次；422 丢弃并计数；404/410 重读发现 + 退避；
 * 400/415 停止并显示；429/503/网络错误指数退避；409 停止（#14 5.4）。
 *
 * @module dsh-piggy/adapters/dsh/external-delivery
 */

export function createDelivery(ctx) {
  let timer = null
  let delay = 1000
  let closed = false

  /** 会话还在、模式还在、控制器还没关：才允许改队列或报错误。 */
  function live() {
    if (closed || !ctx.active()) return false
    return ctx.isLive === undefined ? true : ctx.isLive()
  }

  function schedule(nextDelay = delay) {
    if (!live()) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; void deliver() }, Math.max(0, nextDelay))
    timer.unref?.()
  }

  async function deliver() {
    if (!live()) return
    const state = ctx.outbox.status()
    if (state.paused || state.queued === 0) return
    const head = ctx.outbox.head()
    if (head === null) return
    try {
      let response = await ctx.workClient.post(head)
      if (response.status === 401) {
        ctx.refreshEndpoints()
        response = await ctx.workClient.post(head)
      }
      // 投递返回时控制器可能已经 close：这时不能 shift/清错误，事件留给下一个
      // 活着的进程重投；目标端按 source+id 收据去重，不会重复发奖。
      if (!live()) return
      if (response.status === 200 && response.json?.ok !== false) {
        ctx.outbox.shift()
        delay = 1000
        ctx.setError(null)
        schedule(0)
        return
      }
      if (response.status === 422) { ctx.outbox.dropHead('expired'); schedule(0); return }
      if (response.status === 401) { ctx.setError('token-expired'); schedule(30_000); return }
      if (response.status === 404 || response.status === 410) {
        ctx.setError('endpoint-gone')
        ctx.refreshEndpoints()
        delay = Math.min(delay * 2, 30_000)
        schedule(delay)
        return
      }
      if (response.status === 400 || response.status === 415) { ctx.setError('protocol'); return }
      if (response.status === 409) { ctx.setError('conflict'); return }
      ctx.setError(`http-${response.status}`)
      delay = Math.min(delay * 2, 60_000)
      schedule(delay)
    } catch {
      ctx.setError('disconnected')
      delay = Math.min(delay * 2, 60_000)
      schedule(delay)
    }
  }

  return {
    schedule,
    deliver,
    close() {
      closed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}
