// @ts-check
/** 桌面「外部连接」开关：持久化、发现标记、失败与 IPC 边界。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createExternalManager, readSettings } from '../lib/external.js'

const NOW = 1_800_000_000_000
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-external-settings-'))

function fakeHost(options = {}) {
  const calls = []
  let servers = []
  async function make(role, path) {
    const token = 'c'.repeat(64)
    const server = createServer((request, response) => {
      if (request.headers.authorization !== `Bearer ${token}`) { response.writeHead(401); response.end('{}'); return }
      if (request.url !== path) { response.writeHead(404); response.end('{}'); return }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, role: options[`${role}Role`] ?? role }))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return { server, port: server.address().port, token }
  }
  return {
    calls,
    metadata: async () => ({ gameVersion: '0.37.2', stateVersion: 15 }),
    externalEnable: async input => {
      calls.push(['enable', input])
      if (options.failEnable) throw new Error('port busy')
      mkdirSync(input.directory, { recursive: true })
      const pair = await make('piggy-pair', '/pair/info')
      const work = await make('piggy-work-events', '/health')
      servers = [pair.server, work.server]
      writeFileSync(join(input.directory, 'pair.json'), JSON.stringify({ version: 1, role: 'piggy-pair', port: pair.port, token: pair.token, pid: process.pid }))
      writeFileSync(join(input.directory, 'endpoint.json'), JSON.stringify({ version: 1, role: 'piggy-work-events', port: work.port, token: work.token, pid: process.pid }))
      return { ok: true, port: pair.port, stateVersion: 15, workDirectory: input.directory }
    },
    externalDisable: async () => {
      calls.push(['disable'])
      for (const server of servers) await new Promise(resolve => server.close(resolve))
      servers = []
      return { ok: true }
    },
  }
}

test('默认关闭：不开端口、不写发现文件', async () => {
  const dir = temp(), homes = [join(dir, 'home-a'), join(dir, 'home-b')]
  try {
    const host = fakeHost()
    const manager = createExternalManager({ userData: dir, host, appVersion: '0.6.7', homes, now: () => NOW })
    const status = await manager.init()
    assert.equal(status.enabled, false)
    assert.equal(status.defaultEnabled, false)
    assert.equal(status.running, false)
    assert.equal(status.pair, null)
    assert.equal(status.work, null)
    assert.equal(host.calls.length, 0)
    assert.equal(existsSync(join(homes[0], 'dsh-piggy', 'desktop-app.json')), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('打开后在两份 DSH_HOME 写应用标记（不含令牌），关闭时只删自己的', async () => {
  const dir = temp(), homes = [join(dir, 'home-a'), join(dir, 'home-b')]
  try {
    const host = fakeHost()
    const manager = createExternalManager({ userData: dir, host, appVersion: '0.6.7', homes, now: () => NOW })
    await manager.init()
    const status = await manager.setEnabled(true)
    assert.equal(status.ok, true)
    assert.equal(status.running, true)
    assert.equal(status.pair.reachable, true, '配对接口真能连上')
    assert.equal(status.work.reachable, true, '工作接口真能连上')
    assert.equal(status.pair.role, 'piggy-pair')
    assert.equal(status.work.role, 'piggy-work-events')
    assert.ok(status.pair.port > 0 && status.work.port > 0)
    assert.deepEqual(readSettings(dir), { version: 1, enabled: true })
    for (const home of homes) {
      const file = join(home, 'dsh-piggy', 'desktop-app.json')
      const marker = JSON.parse(readFileSync(file, 'utf8'))
      assert.equal(marker.version, 1)
      assert.equal(marker.pid, process.pid)
      assert.equal(marker.appVersion, '0.6.7')
      assert.equal(marker.gameVersion, '0.37.2')
      assert.equal(marker.stateVersion, 15)
      assert.equal(marker.external.enabled, true)
      assert.equal(marker.external.pair, true)
      assert.equal(marker.external.workEndpointDir, join(dir, 'work-endpoint'))
      assert.equal(JSON.stringify(marker).includes('token'), false)
    }
    const closed = await manager.setEnabled(false)
    assert.equal(closed.running, false)
    assert.equal(closed.pair, null)
    assert.equal(closed.work, null)
    for (const home of homes) assert.equal(existsSync(join(home, 'dsh-piggy', 'desktop-app.json')), false)
    assert.deepEqual(host.calls.map(call => call[0]), ['enable', 'disable'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('开关持久化：重启后仍打开；别人的标记删除时不动', async () => {
  const dir = temp(), homes = [join(dir, 'home-a')]
  try {
    const host = fakeHost()
    const first = createExternalManager({ userData: dir, host, appVersion: '0.6.7', homes, now: () => NOW })
    await first.init()
    await first.setEnabled(true)
    await first.close()
    const reopenedHost = fakeHost()
    const second = createExternalManager({ userData: dir, host: reopenedHost, appVersion: '0.6.7', homes, now: () => NOW })
    const status = await second.init()
    assert.equal(status.enabled, true)
    assert.equal(status.running, true)
    const file = join(homes[0], 'dsh-piggy', 'desktop-app.json')
    const marker = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...marker, pid: process.pid + 1 }))
    await second.setEnabled(false)
    assert.equal(existsSync(file), true, '不是自己写的标记不删')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('接口角色不对：两个接口都关掉，running=false，标记写 false', async () => {
  const dir = temp(), homes = [join(dir, 'home-a')]
  try {
    const host = fakeHost({ 'piggy-work-eventsRole': 'someone-else' })
    const manager = createExternalManager({ userData: dir, host, appVersion: '0.6.7', homes, now: () => NOW })
    await manager.init()
    const status = await manager.setEnabled(true)
    assert.equal(status.ok, false)
    assert.equal(status.enabled, true)
    assert.equal(status.running, false)
    assert.match(status.error, /work-/)
    assert.equal(status.pair.reachable, true, '报告哪个接口通了')
    assert.equal(status.work.reachable, false)
    assert.ok(host.calls.some(call => call[0] === 'disable'))
    const marker = JSON.parse(readFileSync(join(homes[0], 'dsh-piggy', 'desktop-app.json'), 'utf8'))
    assert.equal(marker.external.enabled, false)
    assert.equal(marker.external.pair, false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('启动失败：保留开关、状态带错误、标记写 enabled:false/pair:false', async () => {
  const dir = temp(), homes = [join(dir, 'home-a')]
  try {
    const host = fakeHost({ failEnable: true })
    const manager = createExternalManager({ userData: dir, host, appVersion: '0.6.7', homes, now: () => NOW })
    await manager.init()
    const status = await manager.setEnabled(true)
    assert.equal(status.ok, false)
    assert.equal(status.enabled, true)
    assert.equal(status.running, false)
    assert.match(status.error, /port busy/)
    const marker = JSON.parse(readFileSync(join(homes[0], 'dsh-piggy', 'desktop-app.json'), 'utf8'))
    assert.equal(marker.external.enabled, false)
    assert.equal(marker.external.pair, false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('IPC 边界：只有面板窗口能开关；preload 暴露 external.get/set；合并确认用原生对话框', () => {
  const main = readFileSync(new URL('main.js', new URL('../', import.meta.url)), 'utf8')
  const preload = readFileSync(new URL('preload.cjs', new URL('../', import.meta.url)), 'utf8')
  assert.match(main, /function fromPanelOnly\(event\)/)
  assert.match(main, /if \(!fromPanelOnly\(event\) \|\| externalManager === null\)/)
  assert.match(main, /piggy:external:get/)
  assert.match(main, /piggy:external:set/)
  assert.match(main, /dialog\.showMessageBox\(win, \{/)
  assert.match(preload, /external: \{/)
  assert.match(preload, /piggy:external:get/)
  assert.match(preload, /piggy:external:set/)
  assert.match(preload, /piggy:external/)
  assert.doesNotMatch(main, /fromPage\(event\) && externalManager/)
  assert.ok(existsSync(fileURLToPath(new URL('../lib/external.js', import.meta.url))))
})

test('外部开关文件坏了按关闭处理，不误开端口', async () => {
  const dir = temp()
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'external.json'), '{broken')
    assert.deepEqual(readSettings(dir), { version: 1, enabled: false })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
