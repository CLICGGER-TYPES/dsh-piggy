// @ts-check
/** 用真实 Worker 的实际存档写入失败，验证安装取消后仍可操作、重试安装和正常退出。 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { hatchEgg } from '../core.js'
import { startBackgroundHost } from '../apps/desktop/lib/background-host.js'
import { shellLifecycle } from './helpers/shell-lifecycle.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

for (const retry of ['安装', '退出']) {
  test(`安装前真实保存失败后恢复操作，并可重试${retry}`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'piggy-install-retry-'))
    const statePath = join(directory, 'state.json'), blocker = statePath + '.tmp'
    writeFileSync(statePath, JSON.stringify(hatchEgg(Date.now())))
    let host, attempts = 0, installs = 0
    try {
      host = await startBackgroundHost(ROOT, statePath)
      await host.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'name', name: '待保存小猪' }))
      const lifecycle = shellLifecycle({ dispose() { attempts++; return host.dispose() } }, () => installs++)
      // 原子写的临时文件被目录占用，真实 openSync 会失败；不用假保存结果代替。
      mkdirSync(blocker)
      lifecycle.install()
      await lifecycle.runInstall()
      assert.equal(installs, 0, '保存失败不能启动安装器')
      assert.equal(attempts, 1, '失败后留给用户重试，不能自动退出或再次关闭')
      assert.equal(lifecycle.state().quitting, false, '失败后恢复游戏请求')
      assert.equal(lifecycle.state().closing, false, '失败 Promise 不能留在关闭状态中')
      assert.equal(lifecycle.state().closed, false)
      assert.equal(lifecycle.state().hitTimer, 1, '保留命中轮询，猪仍然可点')
      assert.ok(lifecycle.messages.some(parts => String(parts).includes('shell update shutdown failed')))
      rmSync(blocker, { recursive: true })
      assert.equal((await host.handle('GET', '/dsh-piggy/state')).status, 200)
      if (retry === '安装') {
        lifecycle.install()
        await lifecycle.runInstall()
        assert.equal(installs, 1)
      } else {
        lifecycle.quit()
        for (let i = 0; i < 100 && lifecycle.state().exits === 0; i++) await delay(10)
        assert.equal(lifecycle.state().exits, 1, '保存恢复后正常完成退出')
      }
      assert.equal(attempts, 2)
      assert.equal(lifecycle.state().closed, true)
      assert.equal(lifecycle.state().hitTimer, null)
      assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).name, '待保存小猪')
      assert.equal(existsSync(statePath + '.runtime.lock'), false)
    } finally {
      if (existsSync(blocker)) rmSync(blocker, { recursive: true, force: true })
      await host?.dispose()
      rmSync(directory, { recursive: true, force: true })
    }
  })
}
