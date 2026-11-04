// @ts-check
/**
 * 旧版单 target runtime 的关闭流程。
 *
 * 关闭分两种：纯本地运行时直接持久化后拆；启用云存档时先排空 in-flight 操作、
 * 做最终推送，再持久化拆本地资源。最后一次写入失败必须保留 Store、owner lock
 * 和路由，让调用方修好磁盘后重试，不能把半关闭的运行时留在内存里。
 */

/**
 * @param {{
 *   state:{closed:boolean,accepting:boolean,busy:boolean,fault:unknown,disposePromise:Promise<any>|null,cleanupDone:boolean},
 *   getStore:() => any,
 *   getLedger:() => any,
 *   getSession:() => any,
 *   cloud:{current:() => any,stopTimer:() => void,pendingConfigures:() => number,whenConfiguresSettled:() => Promise<any>},
 *   transfer:{clear:() => void},
 *   mounts:Set<() => void>,
 *   active:Set<Promise<unknown>>,
 *   specialActive:Set<Promise<unknown>>,
 *   exclusiveActive:Set<Promise<unknown>>,
 *   release:() => void,
 * }} deps
 */
export function createRuntimeLifecycle(deps) {
  const { state, getStore, getLedger, getSession, cloud, transfer, mounts, active, specialActive, exclusiveActive, release } = deps

  function finishDispose({ flush = true } = {}) {
    if (state.cleanupDone) return
    // A failed final write must leave the live Store, owner lock and routes intact so
    // the caller can repair the filesystem and retry shutdown. Persist before teardown.
    if (flush && !state.fault) { getLedger().finish(getStore()); getStore().flush() }
    state.accepting = false
    cloud.stopTimer()
    state.closed = true
    getSession()?.dispose()
    for (const dispose of mounts) dispose()
    mounts.clear()
    transfer.clear()
    try { if (!state.fault) getStore().dispose() }
    finally {
      release()
      state.cleanupDone = true
    }
  }

  function dispose() {
    if (state.disposePromise !== null) return state.disposePromise
    if (state.closed) return Promise.resolve({ alreadyClosed: true })
    state.accepting = false
    if (cloud.pendingConfigures() > 0) {
      state.disposePromise = cloud.whenConfiguresSettled().then(() => {
        state.disposePromise = null
        return dispose()
      })
      return state.disposePromise
    }
    const current = cloud.current()
    if (current === null) {
      if (state.busy) {
        state.closed = true
        state.disposePromise = Promise.allSettled([...active, ...specialActive, ...exclusiveActive])
          .then(() => {
            try { finishDispose(); return { localPersisted: true, cloudPush: 'disabled' } }
            catch (error) { state.closed = false; state.accepting = true; state.disposePromise = null; throw error }
          })
        return state.disposePromise
      }
      try { finishDispose() }
      catch (error) { state.accepting = true; throw error }
      return Promise.resolve({ localPersisted: true, cloudPush: 'disabled' })
    }

    cloud.stopTimer()
    for (const unmount of mounts) unmount()
    mounts.clear()
    transfer.clear()
    state.disposePromise = (async () => {
      const pending = [...active, ...specialActive, ...exclusiveActive]
      await Promise.allSettled(pending)
      await current.sync.drain()

      let persistenceError = null
      if (!state.fault) {
        try { getLedger().finish(getStore()); getStore().flush() }
        catch (error) { persistenceError = error }
      }

      /** @type {{ok: false, reason: string, message?: string} | {ok: true, at: number}} */
      let cloudPush = state.fault
        ? { ok: false, reason: 'runtime-fault' }
        : persistenceError !== null
          ? { ok: false, reason: 'local-persist-failed' }
          : { ok: false, reason: 'not-attempted' }
      try {
        const closeResult = await current.sync.close({ finalPush: !state.fault && persistenceError === null })
        if (closeResult.finalPush === true) {
          current.lastPushAt = Date.now()
          cloudPush = { ok: true, at: current.lastPushAt }
        }
      } catch (error) {
        cloudPush = { ok: false, reason: 'final-push-failed', message: String(error?.message ?? error) }
        try { getStore()?.journal?.record?.('warn', 'cloud', '关闭时最终云推送失败', { reason: cloudPush.message }) } catch { /* the returned close result is still authoritative */ }
        console.warn(`[dsh-piggy] final cloud push failed: ${cloudPush.message}`)
      }

      finishDispose({ flush: false })
      if (persistenceError !== null) throw persistenceError
      return { localPersisted: !state.fault, cloudPush }
    })()
    return state.disposePromise
  }

  return { finishDispose, dispose }
}
