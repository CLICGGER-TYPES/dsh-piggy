// @ts-check
/** PR12 C 的关闭重试故障复现；补丁到达前单独运行，不改生产实现。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createGameRuntime } from '../../runtime/index.js'
import { startWorkEventServer } from '../../runtime/local-server.js'

test('C 发现文件清理暂时失败后，close 可以重试并释放接口锁', async () => {
  const directory = fs.mkdtempSync(join(tmpdir(), 'piggy-pr12-c-repro-'))
  const endpointDir = join(directory, 'endpoint'), discoveryPath = join(endpointDir, 'endpoint.json')
  const runtime = createGameRuntime({ statePath: join(directory, 'state.json') })
  const unlink = fs.unlinkSync
  let endpoint, injected = false
  const restore = () => { fs.unlinkSync = unlink; syncBuiltinESMExports() }
  try {
    endpoint = await startWorkEventServer({ directory: endpointDir, runtime })
    const discovery = JSON.parse(fs.readFileSync(discoveryPath, 'utf8'))
    fs.unlinkSync = path => {
      if (!injected && path === discoveryPath) {
        injected = true
        throw Object.assign(new Error('测试注入：发现文件暂时不可删除'), { code: 'EACCES' })
      }
      return unlink(path)
    }
    syncBuiltinESMExports()
    await assert.rejects(endpoint.close(), /发现文件暂时不可删除/)
    assert.equal(injected, true)
    assert.equal(fs.existsSync(discoveryPath), true)
    await assert.rejects(fetch(`http://127.0.0.1:${discovery.port}/health`))
    restore()
    await endpoint.close()
    assert.equal(fs.existsSync(discoveryPath), false)
    assert.equal(fs.existsSync(join(endpointDir, 'endpoint.runtime.lock')), false)
    await endpoint.close()
  } finally {
    restore(); await endpoint?.close().catch(() => {})
    runtime.dispose(); fs.rmSync(directory, { recursive: true, force: true })
  }
})
