// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'

import { attachStageExternal, confirmStageMerge } from '../stage/external.js'

test('舞台联动仅允许舞台页控制，扩展窗口被拒绝；清理先停接口并移除 IPC', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-stage-external-')), handlers = new Map(), cleanup = []
  const stage = {}, ext = {}, calls = [], notifications = []
  let servers = []
  const token = 'd'.repeat(64)
  const endpoint = (role, path) => new Promise(resolve => {
    const server = createServer((request, response) => {
      if (request.headers.authorization !== `Bearer ${token}` || request.url !== path) { response.writeHead(401); response.end('{}'); return }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, role }))
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
  const host = {
    metadata: async () => ({ gameVersion: 'candidate', stateVersion: 15 }),
    externalEnable: async () => {
      calls.push('enable')
      const pair = await endpoint('piggy-pair', '/pair/info')
      const work = await endpoint('piggy-work-events', '/health')
      servers = [pair.server, work.server]
      const directory = join(dir, 'work-endpoint')
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, 'pair.json'), JSON.stringify({ version: 1, role: 'piggy-pair', port: pair.port, token, pid: process.pid }))
      writeFileSync(join(directory, 'endpoint.json'), JSON.stringify({ version: 1, role: 'piggy-work-events', port: work.port, token, pid: process.pid }))
      return { port: pair.port, stateVersion: 15 }
    },
    externalDisable: async () => {
      calls.push('disable')
      for (const server of servers) await new Promise(resolve => server.close(resolve))
      servers = []
    },
  }
  try {
    await attachStageExternal({
      app: { getPath: () => dir, getVersion: () => 'candidate' }, host,
      ipcMain: { handle: (key, fn) => handlers.set(key, fn), removeHandler: key => handlers.delete(key) },
      cleanup: { add: fn => cleanup.push(fn) }, fromStage: event => event.sender === stage,
      toPages: (...args) => notifications.push(args), log() {}, homes: [join(dir, 'dsh')],
    })
    assert.equal(handlers.get('piggy:external:get')({ sender: stage }).enabled, false)
    assert.equal((await handlers.get('piggy:external:set')({ sender: ext }, true)).ok, false)
    assert.deepEqual(calls, [])
    const enabled = await handlers.get('piggy:external:set')({ sender: stage }, true)
    assert.equal(enabled.running, true)
    assert.equal(notifications.length, 1)
    assert.equal(existsSync(join(dir, 'dsh/dsh-piggy/desktop-app.json')), true)
    await cleanup.pop()()
    assert.deepEqual(calls, ['enable', 'disable'])
    assert.equal(handlers.size, 0)
    assert.equal(existsSync(join(dir, 'dsh/dsh-piggy/desktop-app.json')), false)
  } finally { for (const close of cleanup.reverse()) await close(); rmSync(dir, { recursive: true, force: true }) }
})

test('舞台合并需明确原生确认，默认取消；窗口已关闭时不弹框', async () => {
  let options, visible = false
  const win = { isDestroyed: () => false, isVisible: () => visible, show() { visible = true }, focus() {} }
  const dialog = { async showMessageBox(parent, next) { assert.equal(parent, win); options = next; return { response: 0 } } }
  const plan = { source: { name: '内嵌', coins: 100 }, target: { name: '桌面', coins: 200 }, result: { name: '桌面', coins: 300 } }
  assert.equal(await confirmStageMerge({ dialog, getWindow: () => win, plan }), false)
  assert.equal(visible, true)
  assert.equal(options.defaultId, 0)
  assert.match(options.detail, /合并前会分别备份/)
  assert.equal(await confirmStageMerge({ dialog: { showMessageBox: async () => ({ response: 1 }) }, getWindow: () => win, plan }), true)
  assert.equal(await confirmStageMerge({ dialog: { showMessageBox() { throw Error('must not open') } }, getWindow: () => null, plan }), false)
})
