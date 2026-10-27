// @ts-check
/** 真实 Worker 的联动启动：版本来自实际游戏，半途失败不遗留新开的工作端口。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startBackgroundHost } from '../lib/background-host.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const read = path => JSON.parse(readFileSync(path, 'utf8'))

test('实际游戏版本随元数据、配对 info 返回；关闭时两种发现文件都移除', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-external-worker-')), endpoint = join(dir, 'endpoint')
  const host = await startBackgroundHost(ROOT, join(dir, 'state.json'), { workEventsDirectory: endpoint, workEventsAutoStart: false })
  try {
    const version = read(join(ROOT, 'package.json')).version
    assert.equal((await host.metadata()).gameVersion, version)
    await host.externalEnable({ directory: endpoint, appVersion: 'qa' })
    const pair = read(join(endpoint, 'pair.json'))
    const info = await fetch(`http://127.0.0.1:${pair.port}/pair/info`, { headers: { authorization: `Bearer ${pair.token}` } }).then(response => response.json())
    assert.equal(info.gameVersion, version)
    assert.equal(existsSync(join(endpoint, 'endpoint.json')), true)
    await host.externalDisable()
    assert.equal(existsSync(join(endpoint, 'pair.json')), false)
    assert.equal(existsSync(join(endpoint, 'endpoint.json')), false)
  } finally { await host.dispose(); rmSync(dir, { recursive: true, force: true }) }
})

test('写配对发现文件失败后，回收本次新开的工作接口', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-external-worker-')), endpoint = join(dir, 'endpoint')
  mkdirSync(join(endpoint, 'pair.json'), { recursive: true })
  const host = await startBackgroundHost(ROOT, join(dir, 'state.json'), { workEventsDirectory: endpoint, workEventsAutoStart: false })
  try {
    await assert.rejects(host.externalEnable({ directory: endpoint, appVersion: 'qa' }))
    assert.equal(existsSync(join(endpoint, 'endpoint.json')), false)
  } finally { await host.dispose(); rmSync(dir, { recursive: true, force: true }) }
})
