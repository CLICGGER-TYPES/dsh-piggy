// @ts-check
/** 版本准备与激活之间先关闭单写者、确认保存并备份；失败后恢复原宿主。 */
import { access, copyFile } from 'node:fs/promises'
import { startBackgroundHost } from '../lib/background-host.js'

export function createGameChange(options) {
  let running = null, restarting = false
  async function perform(kind, target) {
    let prepared = null, saved = false, committed = false
    const versions = options.getVersions()
    try {
      if (kind === 'install') prepared = await versions.prepareInstall(target, options.onProgress)
      else if ((await versions.current()).previous === null) return { ok: false, reason: '没有上一个版本' }
      if (options.isQuitting()) throw new Error('正在退出，已取消版本切换')
      const result = await options.getHost().dispose()
      if (result?.saved !== true) throw new Error('存档没有成功保存，不能切换游戏版本')
      saved = true
      await options.backup(kind === 'install' ? 'v' + target.version : 'rollback')
      if (options.isQuitting()) throw new Error('正在退出，已取消版本切换')
      const resultVersion = kind === 'install' ? await versions.commitInstall(prepared) : await versions.rollback()
      if (kind === 'rollback' && resultVersion?.ok !== true) throw new Error(resultVersion?.reason ?? '回退失败')
      committed = true
      restarting = true
      prepared = null
      if (!options.isQuitting()) options.restart()
      return { ok: true, version: kind === 'install' ? target.version : resultVersion.version }
    } catch (error) {
      if (saved && !committed && !options.isQuitting()) {
        try { await options.recover() }
        catch (recoveryError) { return { ok: false, reason: String(error) + '；恢复宿主失败：' + String(recoveryError) } }
      }
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    } finally {
      if (prepared !== null) {
        try { await versions.discardPrepared(prepared) }
        catch (error) { options.log('prepared game cleanup failed', String(error)) }
      }
    }
  }
  function run(kind, target = null) {
    if (running !== null || restarting || options.isQuitting()) return Promise.resolve({ ok: false, reason: '正在切换版本或退出，请稍候' })
    options.setBusy(true)
    running = perform(kind, target).finally(() => { running = null; if (!restarting) options.setBusy(false) })
    return running
  }
  return { install: target => run('install', target), rollback: () => run('rollback'), idle: () => running ?? Promise.resolve(), cancel: () => options.getVersions()?.cancelPreparation() ?? Promise.resolve() }
}

/** 舞台入口的存档、宿主重建与在途导出写入适配。 */
export function createStageGameChanges(options) {
  let busy = false
  const writes = new Set()
  const trackWrite = task => {
    writes.add(task)
    void task.then(() => writes.delete(task), () => writes.delete(task))
    return task
  }
  const change = createGameChange({
    getVersions: options.getVersions, getHost: options.getHost, isQuitting: options.isQuitting,
    setBusy: value => { busy = value }, restart: options.restart, onProgress: fraction => options.toPages('piggy:progress', fraction), log: options.log,
    backup: label => backupStageSave(options.statePath(), label),
    async recover() {
      const host = await startBackgroundHost(options.getVersions().activeDir(), options.statePath(), {
        fetch: options.fetch, workEventsDirectory: options.workEventsDirectory(),
        onSnapshot: view => options.toPages('piggy:state-changed', view), onStateChanged: () => options.toPages('piggy:state-changed'),
      })
      if (options.isQuitting()) await host.dispose()
      else options.setHost(host)
    },
  })
  return { ...change, trackWrite, get busy() { return busy }, async close() {
    await change.cancel()
    await change.idle()
    await Promise.allSettled([...writes])
  } }
}

/** 已确认保存后复制完整存档；无小猪的空档无需备份。 */
export async function backupStageSave(source, label) {
  try { await access(source) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  await copyFile(source, source + '.before-' + label + '-' + new Date().toISOString().replace(/[:.]/g, '-'))
}
