// @ts-check
/** 用真实 Worker 验证字节转移、快照广播及保存失败后的本机接口恢复；所有数据留在临时目录。 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { hatchEgg } from '../../../core.js'
import { startBackgroundHost } from '../lib/background-host.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-runtime-host-'))
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const encode = value => new TextEncoder().encode(JSON.stringify(value)).buffer

function writeLegacyGame(directory) {
  const gameDir = join(directory, 'legacy-game')
  mkdirSync(gameDir)
  writeFileSync(join(gameDir, 'package.json'), '{"type":"module"}')
  // 旧包没有 runtime/index.js；仍使用仓库内真实 Store、路由及环境模块。
  for (const [file, name] of [['store.js', 'createStore'], ['routes.js', 'registerRoutes'], ['environment.js', 'environmentNote']]) {
    const origin = new URL('../../../' + file, import.meta.url).href
    writeFileSync(join(gameDir, file), `export { ${name} } from ${JSON.stringify(origin)}\n`)
  }
  return gameDir
}

function writeGameWithPending(directory) {
  const gameDir = join(directory, 'game')
  mkdirSync(join(gameDir, 'runtime'), { recursive: true })
  writeFileSync(join(gameDir, 'package.json'), '{"type":"module"}')
  for (const file of ['environment.js', 'runtime/local-server.js']) {
    writeFileSync(join(gameDir, file), `export * from ${JSON.stringify(new URL('../../../' + file, import.meta.url).href)}\n`)
  }
  // migrate 会清除落盘 pending；须由真实命令在 Worker 内生成尚未被快照消费的消息。
  writeFileSync(join(gameDir, 'runtime/index.js'), `
    import { createGameRuntime as createRuntime } from ${JSON.stringify(new URL('../../../runtime/index.js', import.meta.url).href)}
    export function createGameRuntime(options) {
      const runtime = createRuntime(options)
      runtime.dispatchCommand('pig', 'pet')
      return runtime
    }
  `)
  return gameDir
}

test('Worker 只转移 Buffer、Uint8Array 和 DataView 的有效字节，不泄漏相邻字节或分离原存储', async () => {
  const directory = temp(), gameDir = join(directory, 'game')
  mkdirSync(join(gameDir, 'runtime'), { recursive: true })
  writeFileSync(join(gameDir, 'package.json'), '{"type":"module"}')
  writeFileSync(join(gameDir, 'environment.js'), 'export const environmentNote = () => ({})')
  // 池化 Buffer 和共享视图都带偏移；第二次读取会暴露错误转移原存储的实现。
  writeFileSync(join(gameDir, 'runtime/index.js'), `
    const backing = Buffer.allocUnsafe(64).fill(0xa7)
    backing.set([3, 1, 4, 1, 5], 7)
    const views = {
      buffer: backing.subarray(7, 12),
      uint8: new Uint8Array(backing.buffer, backing.byteOffset + 7, 5),
      data: new DataView(backing.buffer, backing.byteOffset + 7, 5),
    }
    export const createGameRuntime = () => ({
      handle(method, url) {
        const body = views[url.slice(1)]
        if (!body || body.byteLength !== 5 || body.byteOffset < 7) throw new Error('view lost its byte range')
        return { status: 200, headers: { 'content-type': 'application/octet-stream',
          'x-view-offset': String(body.byteOffset), 'x-backing-size': String(body.buffer.byteLength) }, body }
      },
      dispose() {}, record() {},
    })
  `)
  let host
  try {
    host = await startBackgroundHost(gameDir, join(directory, 'state.json'))
    for (let round = 0; round < 2; round++) {
      for (const kind of ['buffer', 'uint8', 'data']) {
        const response = await host.handle('GET', '/' + kind)
        assert.equal(response.status, 200)
        assert.ok(response.body instanceof ArrayBuffer, kind)
        assert.equal(response.body.byteLength, 5, kind)
        assert.deepEqual([...new Uint8Array(response.body)], [3, 1, 4, 1, 5], kind)
        assert.ok(Number(response.headers['x-view-offset']) >= 7, kind)
        assert.ok(Number(response.headers['x-backing-size']) > 5, kind)
      }
    }
  } finally { await host?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

for (const mode of ['current', 'legacy']) {
  test(`Worker ${mode} 游戏的 ArrayBuffer 请求转移后内容正确，pending 原文广播一次且不丢失`, async () => {
    const directory = temp(), statePath = join(directory, 'state.json'), broadcasts = []
    let host
    try {
      const gameDir = mode === 'current' ? ROOT : writeLegacyGame(directory)
      host = await startBackgroundHost(gameDir, statePath, { onSnapshot: text => broadcasts.push(text) })
      const hatch = encode({ action: 'hatch' })
      const hatching = host.handle('POST', '/dsh-piggy/act', hatch)
      assert.equal(hatch.byteLength, 0, '主线程不能保留已转移的请求存储')
      assert.equal(JSON.parse((await hatching).body).hatched, true)
      broadcasts.length = 0
      const body = encode({ action: 'dev', patch: { say: 'eat' } })
      const request = host.handle('POST', '/dsh-piggy/act', body)
      assert.equal(body.byteLength, 0)
      const response = await request, view = JSON.parse(response.body)
      assert.equal(response.status, 200)
      assert.equal(view.pending.filter(event => event.kind === 'line').length, 1)
      assert.deepEqual(broadcasts, [response.body], '广播的是取走 pending 的同一份响应原文')
      assert.deepEqual(JSON.parse((await host.handle('GET', '/dsh-piggy/state')).body).pending, [])
      assert.equal(broadcasts.length, 1)
      const name = '转移名字'
      const renamed = await host.handle('POST', '/dsh-piggy/act', encode({ action: 'name', name }))
      assert.equal(JSON.parse(renamed.body).ok, true, '测试名字须符合宿主命名规则')
      assert.equal(JSON.parse(renamed.body).pig.name, name, '转移后 UTF-8 请求仍被真实路由解析')
      assert.deepEqual(await host.dispose(), { saved: true })
      assert.equal(read(statePath).name, name)
      assert.equal(existsSync(join(directory, 'endpoint')), false)
    } finally { await host?.dispose(); rmSync(directory, { recursive: true, force: true }) }
  })
}

test('旧游戏后台默认不监听端口，禁止所有 listen 时仍可完成游戏操作与保存', () => {
  const directory = temp(), statePath = join(directory, 'state.json')
  try {
    const gameDir = writeLegacyGame(directory), launcher = join(directory, 'check.mjs')
    const forbiddenListener = 'data:text/javascript,' + encodeURIComponent("import { Server } from 'node:net'; Server.prototype.listen = function() { throw new Error('legacy must not listen') }")
    writeFileSync(launcher, `
      import { startBackgroundHost } from ${JSON.stringify(new URL('../lib/background-host.js', import.meta.url).href)}
      const host = await startBackgroundHost(${JSON.stringify(gameDir)}, ${JSON.stringify(statePath)})
      try {
        const response = await host.handle('POST', '/dsh-piggy/act', '{"action":"hatch"}')
        if (!JSON.parse(response.body).hatched) throw new Error('legacy hatch unavailable')
      } finally { await host.dispose() }
    `)
    const result = spawnSync(process.execPath, ['--import', forbiddenListener, launcher], { encoding: 'utf8', timeout: 15000 })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(read(statePath).hatched, true)
    assert.equal(existsSync(join(directory, 'endpoint')), false)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('Worker 保存失败保留原错误与现场，重新发布健康接口且不取走 pending，解除阻挡后可重试保存', async () => {
  const directory = temp(), statePath = join(directory, 'state.json'), blocker = statePath + '.tmp'
  const endpointDir = join(directory, 'endpoint'), discoveryPath = join(endpointDir, 'endpoint.json'), broadcasts = []
  const state = hatchEgg(Date.now())
  writeFileSync(statePath, JSON.stringify(state))
  const original = readFileSync(statePath, 'utf8')
  const health = async discovery => {
    const response = await fetch(`http://127.0.0.1:${discovery.port}/health`, {
      headers: { authorization: `Bearer ${discovery.token}` }, signal: AbortSignal.timeout(5000),
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).role, 'piggy-work-events')
  }
  let host
  try {
    // 先阻止写入；健康检查或机器调度可能超过保存节流时间，不能在它们之后才注入故障。
    mkdirSync(blocker)
    host = await startBackgroundHost(writeGameWithPending(directory), statePath, { workEventsDirectory: endpointDir, onSnapshot: text => broadcasts.push(text) })
    const first = read(discoveryPath)
    await health(first)
    await assert.rejects(host.dispose(), error => {
      assert.match(error.message, /state\.json\.tmp/)
      assert.match(error.message, /EPERM|EISDIR|EACCES/)
      assert.doesNotMatch(error.message, /工作接口恢复失败/)
      return true
    })
    assert.equal(statSync(blocker).isDirectory(), true, '失败后不能清除阻挡现场')
    assert.equal(readFileSync(statePath, 'utf8'), original, '失败不能覆盖原存档')
    assert.equal(existsSync(statePath + '.runtime.lock'), true, '保存失败后仍持有单写者锁')
    const recovered = read(discoveryPath)
    assert.notEqual(recovered.token, first.token, '重新发现恢复后的真实接口')
    assert.equal(recovered.pid, first.pid, '由同一个 Worker 恢复服务')
    await health(recovered)
    assert.deepEqual(broadcasts, [], '恢复探测不能生成快照或取走 pending')
    rmSync(blocker, { recursive: true })
    const response = await host.handle('GET', '/dsh-piggy/state')
    assert.equal(response.status, 200)
    const view = JSON.parse(response.body)
    assert.equal(view.pending.filter(event => event.kind === 'line' && event.scene === 'pet').length, 1,
      '保存失败恢复只能探测可用性，不能取走命令产生的 pending')
    assert.deepEqual(broadcasts, [response.body])
    assert.deepEqual(JSON.parse((await host.handle('GET', '/dsh-piggy/state')).body).pending, [])
    assert.deepEqual(await host.dispose(), { saved: true })
    assert.equal(read(statePath).isOfflineFeedEnabled, true)
    assert.equal(read(statePath).stats.pets, 1, '保存的是 Worker 中真实命令产生的游戏状态')
    assert.deepEqual(read(statePath).pending, [])
    for (const path of [discoveryPath, statePath + '.runtime.lock', join(endpointDir, 'endpoint.runtime.lock')]) {
      assert.equal(existsSync(path), false, path)
    }
    await assert.rejects(fetch(`http://127.0.0.1:${recovered.port}/health`, { signal: AbortSignal.timeout(5000) }))
  } finally {
    if (existsSync(blocker)) rmSync(blocker, { recursive: true, force: true })
    await host?.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Worker startup preserves the original endpoint failure when cleanup also fails', async () => {
  const directory = temp(), statePath = join(directory, 'state.json'), endpoint = join(directory, 'not-a-directory')
  writeFileSync(statePath, JSON.stringify(hatchEgg(Date.now())))
  mkdirSync(statePath + '.tmp')
  writeFileSync(endpoint, 'preserve')
  try {
    await assert.rejects(startBackgroundHost(writeGameWithPending(directory), statePath, { workEventsDirectory: endpoint }), error => {
      assert.match(error.message, /EEXIST|ENOTDIR|real directory/)
      assert.match(error.message, /启动清理失败/)
      assert.match(error.message, /state\.json\.tmp/)
      return true
    })
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
