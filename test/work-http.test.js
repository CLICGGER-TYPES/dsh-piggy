// @ts-check
/** C 的真实 HTTP、显式启用与无窗口入口回归。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGameRuntime } from '../runtime/index.js'
import { startWorkEventServer } from '../runtime/local-server.js'
import { hatchEgg } from '../core.js'
import { startBackgroundHost } from '../apps/desktop/lib/background-host.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-http-'))
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const event = () => ({ version: 1, source: 'test-http', id: 'turn:1', type: 'turn', at: Date.now() })
const forbiddenListener = 'data:text/javascript,' + encodeURIComponent("import { Server } from 'node:net'; Server.prototype.listen = function() { throw new Error('default must not listen') }")

test('HTTP 随机端口及令牌，未认证 401，只开放两条路由；真实提交和重复', async () => {
  const directory = temp(), statePath = join(directory, 'state.json'), endpointDir = join(directory, 'endpoint')
  writeFileSync(statePath, JSON.stringify(hatchEgg(Date.now())))
  const runtime = createGameRuntime({ statePath })
  let endpoint
  try {
    endpoint = await startWorkEventServer({ directory: endpointDir, runtime })
    const discovery = read(join(endpointDir, 'endpoint.json'))
    assert.ok(discovery.port > 0)
    assert.match(discovery.token, /^[a-f0-9]{64}$/)
    if (process.platform !== 'win32') {
      assert.equal(statSync(endpointDir).mode & 0o777, 0o700)
      assert.equal(statSync(join(endpointDir, 'endpoint.json')).mode & 0o777, 0o600)
    }
    const base = `http://127.0.0.1:${discovery.port}`
    await assert.rejects(fetch(`http://[::1]:${discovery.port}/health`))
    assert.equal((await fetch(base + '/health')).status, 401)
    assert.equal((await fetch(base + '/events', { method: 'POST', body: '{}' })).status, 401)
    const headers = { authorization: `Bearer ${discovery.token}`, 'content-type': 'application/json' }
    const health = await fetch(base + '/health', { headers })
    assert.equal(health.status, 200)
    assert.equal((await health.json()).role, 'piggy-work-events')
    for (const path of ['/dsh-piggy/state', '/dsh-piggy/act', '/dsh-piggy/logs/export', '/health?extra=1', '/elsewhere']) {
      assert.equal((await fetch(base + path, { headers })).status, 404)
    }
    assert.equal((await fetch(base + '/health', { headers: { ...headers, origin: 'https://example.com' } })).status, 403)
    assert.equal((await fetch(base + '/events', { method: 'POST', headers: { ...headers, 'content-type': 'text/plain' }, body: '{}' })).status, 415)
    const body = JSON.stringify(event())
    const request = () => fetch(base + '/events', { method: 'POST', headers, body })
    assert.equal((await (await request()).json()).status, 'applied')
    assert.equal((await (await request()).json()).status, 'duplicate')
    assert.equal((await fetch(base + '/events', { method: 'POST', headers, body: JSON.stringify({ ...event(), prompt: 'secret' }) })).status, 400)
    await endpoint.close()
    assert.equal(existsSync(join(endpointDir, 'endpoint.json')), false)
    await assert.rejects(fetch(base + '/health', { headers }))
  } finally { await endpoint?.close(); runtime.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('桌面后台默认关闭：禁止任何 listen 调用时，游戏路由仍可用', () => {
  const directory = temp()
  try {
    const body = `import { startBackgroundHost } from ${JSON.stringify(new URL('../apps/desktop/lib/background-host.js', import.meta.url).href)};
      const host = await startBackgroundHost(${JSON.stringify(ROOT)}, ${JSON.stringify(join(directory, 'state.json'))});
      if ((await host.handle('GET', '/dsh-piggy/state')).status !== 200) throw new Error('game route unavailable');
      await host.dispose();`
    // 预加载在主进程及 Worker 内都生效；任何意外监听都会直接让测试失败。
    const launcher = join(directory, 'check.mjs')
    writeFileSync(launcher, body)
    const result = spawnSync(process.execPath, ['--import', forbiddenListener, launcher], { encoding: 'utf8', timeout: 15000 })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(existsSync(join(directory, 'work-endpoint')), false)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('无窗口入口没有 --work-events 时不监听、不创建存档或发现文件', () => {
  const directory = temp(), statePath = join(directory, 'state.json'), endpointDir = join(directory, 'endpoint')
  try {
    const result = spawnSync(process.execPath, ['--import', forbiddenListener, join(ROOT, 'runtime/serve.mjs'), `--state-path=${statePath}`, `--endpoint-directory=${endpointDir}`], { encoding: 'utf8', timeout: 15000 })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /disabled/)
    assert.equal(existsSync(statePath), false)
    assert.equal(existsSync(endpointDir), false)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('无窗口入口显式启用，SIGTERM 正常退出并清理发现文件', async () => {
  const directory = temp(), statePath = join(directory, 'state.json'), endpointDir = join(directory, 'endpoint')
  const child = spawn(process.execPath, [join(ROOT, 'runtime/serve.mjs'), '--work-events', `--state-path=${statePath}`, `--endpoint-directory=${endpointDir}`], { stdio: ['ignore', 'pipe', 'pipe'] })
  const exited = once(child, 'exit')
  let error = ''
  child.stderr.on('data', chunk => { error += chunk })
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        child.stdout.on('data', chunk => { if (String(chunk).includes('runtime ready')) resolve(undefined) })
        child.once('exit', code => reject(new Error(`serve exited ${code}: ${error}`)))
      }),
      new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('serve startup timeout')), 10000); timer.unref() }),
    ])
    const discovery = read(join(endpointDir, 'endpoint.json'))
    assert.equal((await fetch(`http://127.0.0.1:${discovery.port}/health`, { headers: { authorization: `Bearer ${discovery.token}` } })).status, 200)
    child.kill('SIGTERM')
    assert.equal((await exited)[0], 0, error)
    assert.equal(existsSync(join(endpointDir, 'endpoint.json')), false)
    assert.equal(existsSync(`${statePath}.runtime.lock`), false)
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited }
    rmSync(directory, { recursive: true, force: true })
  }
})

test('桌面后台显式启用时 HTTP 与界面共用同一存档和收据', async () => {
  const directory = temp(), statePath = join(directory, 'state.json'), endpointDir = join(directory, 'endpoint')
  let host
  try {
    host = await startBackgroundHost(ROOT, statePath, { workEventsDirectory: endpointDir })
    assert.equal(JSON.parse((await host.handle('POST', '/dsh-piggy/act', '{"action":"hatch"}')).body).hatched, true)
    const discovery = read(join(endpointDir, 'endpoint.json')), work = event()
    const response = await fetch(`http://127.0.0.1:${discovery.port}/events`, { method: 'POST', headers: { authorization: `Bearer ${discovery.token}`, 'content-type': 'application/json' }, body: JSON.stringify(work) })
    assert.equal((await response.json()).status, 'applied')
    assert.equal((await host.acceptWorkEvent(work)).status, 'duplicate')
    await host.dispose()
    assert.equal(existsSync(join(endpointDir, 'endpoint.json')), false)
  } finally { await host?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
