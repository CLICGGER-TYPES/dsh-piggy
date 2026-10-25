// @ts-check
/** 真实存档写入失败后恢复操作；生产外壳更新器验证重试安装与普通退出的关闭差异。 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { hatchEgg } from '../core.js'
import { startBackgroundHost } from '../apps/desktop/lib/background-host.js'
import { createShellUpdates } from '../apps/desktop/lib/shell-update.js'
import { shellLifecycle } from './helpers/shell-lifecycle.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 只替换更新器的网络和安装器入口，保留生产下载状态及 close/install 契约。 */
async function downloadedShellUpdates(onInstall) {
  const updater = new EventEmitter()
  updater.checkForUpdates = async () => ({ updateInfo: { version: '0.6.7' } })
  updater.downloadUpdate = async () => []
  updater.quitAndInstall = (silent, restart) => {
    assert.equal(silent, false)
    assert.equal(restart, true)
    onInstall()
  }
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.6.6', updater })
  assert.deepEqual(await updates.download('0.6.7'), { ok: true, version: '0.6.7' })
  return updates
}

for (const retry of ['安装', '退出']) {
  test(`安装前真实保存失败后恢复操作，并可重试${retry}`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'piggy-install-retry-'))
    const statePath = join(directory, 'state.json'), blocker = statePath + '.tmp'
    writeFileSync(statePath, JSON.stringify(hatchEgg(Date.now())))
    let host, updates, attempts = 0, installs = 0
    try {
      host = await startBackgroundHost(ROOT, statePath)
      await host.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'name', name: '待保存小猪' }))
      updates = await downloadedShellUpdates(() => { installs++ })
      const lifecycle = shellLifecycle({ dispose() { attempts++; return host.dispose() } }, undefined, { shellUpdates: updates })
      // 原子写的临时文件被目录占用，真实 openSync 会失败；不用假保存结果代替。
      mkdirSync(blocker)
      assert.equal(lifecycle.install().ok, true)
      await lifecycle.runInstall()
      assert.equal(installs, 0, '保存失败不能启动安装器')
      assert.equal(attempts, 1, '失败后留给用户重试，不能自动退出或再次关闭')
      assert.equal(lifecycle.state().quitting, false, '失败后恢复游戏请求')
      assert.equal(lifecycle.state().closing, false, '失败 Promise 不能留在关闭状态中')
      assert.equal(lifecycle.state().closed, false)
      assert.equal(lifecycle.state().hitTimer, 1, '保留命中轮询，猪仍然可点')
      assert.ok(lifecycle.messages.some(parts => String(parts).includes('desktop action failed')))
      assert.equal(lifecycle.dialogs.length, 1, '保存失败必须向用户报告')
      assert.match(lifecycle.dialogs[0].detail, /state\.json\.tmp/)
      assert.deepEqual(await updates.download('0.6.7'), { ok: true, version: '0.6.7' }, '保存失败不能关闭生产更新器')
      rmSync(blocker, { recursive: true })
      assert.equal((await host.handle('GET', '/dsh-piggy/state')).status, 200)
      if (retry === '安装') {
        assert.equal(lifecycle.install().ok, true)
        await lifecycle.runInstall()
        assert.equal(installs, 1)
        assert.equal(lifecycle.dialogs.length, 1, '重试成功不能再次报错')
      } else {
        await lifecycle.quit()
        assert.equal(lifecycle.state().exits, 1, '保存恢复后正常完成退出')
        assert.equal(updates.install().ok, false, '普通退出必须关闭生产更新器')
        assert.equal((await updates.download('0.6.7')).ok, false)
        assert.equal(installs, 0)
      }
      assert.equal(attempts, 2)
      assert.equal(lifecycle.state().closed, true)
      assert.equal(lifecycle.state().hitTimer, null)
      assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).name, '待保存小猪')
      assert.equal(existsSync(statePath + '.runtime.lock'), false)
    } finally {
      if (existsSync(blocker)) rmSync(blocker, { recursive: true, force: true })
      await host?.dispose()
      await updates?.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
}
