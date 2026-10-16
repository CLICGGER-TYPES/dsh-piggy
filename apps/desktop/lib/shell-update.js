// @ts-check
/** 桌面外壳更新与游戏包更新分离；关闭时等待检查、下载和签名验证全部收尾。 */
import { Worker } from 'node:worker_threads'
import { NsisUpdater } from 'electron-updater'
import { CancellationToken } from 'builder-util-runtime'

import { compareVersions } from './versions.js'
import { CHANNEL } from './channel.js'

/**
 * @param {string[]} publisherNames
 * @param {string} tempPath
 * @param {import('electron-updater/out/types.js').Logger|null} logger
 * @returns {Promise<string|null>}
 */
async function verifySignatureInWorker(publisherNames, tempPath, logger) {
  const worker = new Worker(new URL('./signature-worker.js', import.meta.url), {
    workerData: { publisherNames, tempPath },
  })
  try {
    /** @type {Promise<string|null>} */
    const result = new Promise((resolve, reject) => {
      worker.on('message', message => {
        if (message.kind === 'log') logger?.[message.level](message.message)
        else if (message.kind === 'error') reject(message.error)
        else if (message.kind === 'result') {
          if (message.value === null || typeof message.value === 'string') resolve(message.value)
          else reject(new Error('签名验证 Worker 返回了无效结果'))
        }
      })
      worker.once('error', reject)
      worker.once('exit', code => reject(new Error(`签名验证 Worker 在返回结果前退出（${code}）`)))
    })
    return await result
  } finally {
    await worker.terminate()
  }
}

/**
 * @param {{ platform: string, packaged: boolean, portable?: boolean, appImage?: string }} build
 */
export function shellUpdateMode(build) {
  if (!build.packaged) return 'development'
  if (build.platform === 'darwin') return 'unsigned-mac'
  if (build.platform === 'win32') return build.portable ? 'portable' : 'automatic'
  if (build.platform === 'linux') return build.appImage ? 'automatic' : 'manual'
  return 'manual'
}

/**
 * @param {{ mode: string, currentVersion: string, updater?: any, onProgress?: (fraction: number) => void, channel?: typeof CHANNEL }} options
 */
export function createShellUpdates(options) {
  const { mode, currentVersion, updater } = options
  const channel = options.channel ?? CHANNEL
  let readyVersion = null
  let busy = false
  let closed = false
  let downloading = null
  let operation = null
  let closing = null
  const signatures = new Set()
  if (mode === 'automatic') {
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    // 依赖的差分计划和 blockmap 解压仍同步运行；完整下载保留流式校验，代价是多用带宽。
    updater.disableDifferentialDownload = true
    if (process.platform === 'win32' && updater instanceof NsisUpdater) {
      if (typeof updater.verifyUpdateCodeSignature !== 'function') throw new Error('Windows 更新器的签名验证接口已变化')
      updater.verifyUpdateCodeSignature = async (publisherNames, tempPath) => {
        if (closed) throw new Error('桌面外壳更新已关闭')
        const signature = verifySignatureInWorker(publisherNames, tempPath, updater.logger)
        signatures.add(signature)
        try { return await signature } finally { signatures.delete(signature) }
      }
    }
    updater.on('download-progress', progress => options.onProgress?.(Math.max(0, Math.min(1, Number(progress.percent) / 100))))
  }

  const status = () => ({ mode, currentVersion, readyVersion })

  /**
   * @param {string} expectedVersion
   * @param {boolean} [prerelease] 外壳在预览版发布里时要让更新器也看预览版
   * @param {string} [tag] 带这个外壳的发行版；Gitee 没有「最新版」固定下载地址，按它拼出更新清单所在目录
   */
  async function download(expectedVersion, prerelease = false, tag = undefined) {
    if (closed) return { ok: false, reason: '桌面外壳更新已关闭' }
    if (mode !== 'automatic') return { ok: false, reason: '这个安装方式需要到发布页下载安装包' }
    if (busy) return { ok: false, reason: '桌面外壳正在下载' }
    if (readyVersion === expectedVersion) return { ok: true, version: readyVersion }
    if (compareVersions(expectedVersion, currentVersion) <= 0) return { ok: false, reason: '桌面外壳已经是这个版本' }
    busy = true
    readyVersion = null
    // 2026-10-16：先登记整轮操作，再调用更新器；检查尚无取消 token 时，关闭也必须等待。
    operation = Promise.resolve().then(async () => {
      try {
        if (closed) return { ok: false, reason: '桌面外壳更新已关闭' }
        updater.allowPrerelease = prerelease
        if (channel.name === 'gitee') {
          if (!tag) return { ok: false, reason: '版本列表过期了，点上面的「刷新」再试一次' }
          updater.setFeedURL({ provider: 'generic', url: `${channel.downloadBase}/${tag}` })
        }
        const result = await updater.checkForUpdates()
        if (closed) return { ok: false, reason: '桌面外壳更新已关闭' }
        const found = result?.updateInfo?.version
        if (found !== expectedVersion) return { ok: false, reason: found ? `发布页当前外壳是 v${found}，点「刷新」再试` : '还没有可自动安装的外壳包，请到发布页下载' }
        downloading = new CancellationToken()
        await updater.downloadUpdate(downloading)
        if (closed) return { ok: false, reason: '桌面外壳更新已关闭' }
        readyVersion = found
        return { ok: true, version: found }
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) }
      } finally {
        busy = false
        downloading = null
        operation = null
      }
    })
    return operation
  }

  function install() {
    if (closed) return { ok: false, reason: '桌面外壳更新已关闭' }
    if (mode !== 'automatic' || readyVersion === null) return { ok: false, reason: '还没有下载好桌面外壳' }
    updater.quitAndInstall(false, true)
    return { ok: true }
  }

  function close() {
    if (closing) return closing
    closed = true
    // 证书验证器自己管理 PowerShell 超时；正常退出等待它结束，不能直接终止 Worker 留下子进程。
    closing = Promise.allSettled([operation, ...signatures]).then(() => {})
    downloading?.cancel()
    return closing
  }

  return { status, download, install, close }
}
