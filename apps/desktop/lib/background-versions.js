// @ts-check
/** 更新使用独立 Worker；UI 线程只负责 Chromium 网络流和请求转发。 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'

import { downloadVersionFile } from './version-download.js'

/** @param {Parameters<typeof import('./versions.js').createVersions>[0]} options */
export async function startBackgroundVersions(options) {
  const root = join(options.userData, 'versions')
  await mkdir(root, { recursive: true })
  const temporaryDir = await mkdtemp(join(root, '.update-'))
  let worker
  try {
    worker = new Worker(new URL('./versions-worker.js', import.meta.url), {
      workerData: {
        userData: options.userData, bundledDir: options.bundledDir, shellVersion: options.shellVersion,
        statePath: options.statePath, releasesUrl: options.releasesUrl, temporaryDir,
      },
    })
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true })
    throw error
  }
  const pending = new Map()
  const downloads = new Map()
  let sequence = 0
  let cancelledThrough = 0
  let cancelling = null
  let closed = false
  let closing = null
  let failure = null
  let resolveReady, rejectReady
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })

  function fail(error) {
    failure = error
    rejectReady(error)
    for (const task of pending.values()) task.reject(error)
    pending.clear()
    for (const task of downloads.values()) task.controller.abort()
  }

  /** @returns {Promise<any>} */
  function request(method, args = [], onProgress = undefined) {
    if (closed || failure) return Promise.reject(failure ?? new Error('版本管理器已关闭'))
    return new Promise((resolve, reject) => {
      const id = ++sequence
      pending.set(id, { resolve, reject, onProgress, method })
      try { worker.postMessage({ kind: 'request', id, method, args, now: options.now?.() }) }
      catch (error) { pending.delete(id); reject(error) }
    })
  }

  function downloadReply(message) {
    if (closed || failure) return
    try { worker.postMessage({ kind: 'download-result', ...message, now: options.now?.() }) }
    catch (error) { fail(error); void close().catch(() => {}) }
  }

  function forwardDownload(message) {
    if (closed || failure) return
    if (message.preparation !== null && message.preparation <= cancelledThrough) {
      downloadReply({ id: message.id, error: '游戏包准备已取消' })
      return
    }
    const controller = new AbortController()
    const task = downloadVersionFile({
      url: message.url, headers: message.headers, destination: message.destination,
      fetch: options.fetch ?? globalThis.fetch, signal: controller.signal,
      onBytes: message.progress ? bytes => {
        if (!closed && !failure) worker.postMessage({ kind: 'download-progress', id: message.id, bytes })
      } : undefined,
    }).then(result => downloadReply({ id: message.id, result }),
      error => downloadReply({ id: message.id, error: error instanceof Error ? error.message : String(error) }))
      .finally(() => {
        // Electron 44 的 Readable 取消不保证中止 URLLoader；释放所有权前关闭底层请求。
        controller.abort()
        downloads.delete(message.id)
      })
    downloads.set(message.id, { controller, task, preparation: message.preparation })
  }

  worker.on('message', message => {
    if (message.kind === 'ready') resolveReady(undefined)
    else if (message.kind === 'startup-error') {
      fail(new Error(message.error))
      void close().catch(() => {})
    } else if (message.kind === 'response') {
      const task = pending.get(message.id)
      if (!task) return
      pending.delete(message.id)
      if ((task.method === 'prepareInstall' || task.method === 'preparePinned') && message.id <= cancelledThrough) task.reject(new Error('游戏包准备已取消'))
      else if (message.error) task.reject(new Error(message.error))
      else task.resolve(message.value)
    } else if (message.kind === 'progress' && message.id > cancelledThrough) pending.get(message.id)?.onProgress?.(message.fraction)
    else if (message.kind === 'download') forwardDownload(message)
  })
  worker.on('error', error => { fail(error); void close().catch(() => {}) })
  worker.on('exit', code => {
    if (!closed) {
      fail(new Error(`版本管理 Worker 已退出：${code}`))
      void close().catch(() => {})
    }
  })

  function close() {
    if (closing) return closing
    closed = true
    fail(failure ?? new Error('版本管理器已关闭'))
    // 先阻止迟到的提交并停止 Worker，再等流关闭，最后只清理本实例创建的目录。
    const terminating = worker.terminate()
    closing = (async () => {
      await Promise.allSettled([...downloads.values()].map(task => task.task))
      await terminating
      await rm(temporaryDir, { recursive: true, force: true })
    })()
    return closing
  }

  /** @returns {Promise<void>} */
  function discardPrepared(prepared) {
    // 关闭已经接管整个实例目录的清理；此时等待它，不再向已停止的 Worker 发请求。
    return closed ? close() : request('discardPrepared', [prepared])
  }

  /** @returns {Promise<void>} */
  function cancelPreparation() {
    if (closed) return close()
    if (cancelling) return cancelling
    const boundary = sequence
    cancelledThrough = boundary
    for (const task of downloads.values()) {
      if (task.preparation !== null && task.preparation <= boundary) task.controller.abort()
    }
    const cancelled = request('cancelPreparation')
    cancelling = (async () => {
      await cancelled
      await Promise.allSettled([...downloads.values()]
        .filter(task => task.preparation !== null && task.preparation <= boundary).map(task => task.task))
    })().finally(() => { cancelling = null })
    return cancelling
  }

  async function prepare(method, release, onProgress) {
    if (cancelling) await cancelling
    return request(method, [release], onProgress)
  }

  try { await ready } catch (error) { await close(); throw error }
  return {
    activeDir: () => request('activeDir'),
    needsGame: () => request('needsGame'),
    current: () => request('current'),
    saveVersion: () => request('saveVersion'),
    list: (settings = {}) => request('list', [settings]),
    rollback: () => request('rollback'),
    readPin: file => request('readPin', [file]),
    prepareInstall: (release, onProgress = undefined) => prepare('prepareInstall', release, onProgress),
    commitInstall: prepared => cancelling ? Promise.reject(new Error('游戏包准备已取消')) : request('commitInstall', [prepared]),
    discardPrepared,
    cancelPreparation,
    async installPinned(pin, onProgress = undefined) {
      const prepared = await prepare('preparePinned', pin, onProgress)
      try { return await request('commitInstall', [prepared]) }
      finally { await discardPrepared(prepared) }
    },
    close,
  }
}
