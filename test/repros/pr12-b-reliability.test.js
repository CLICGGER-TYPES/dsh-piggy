// @ts-check
/** PR12 B 的可靠性回归，纳入 npm test；真实落盘、Worker 和生产退出回调。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { setTimeout as delay } from 'node:timers/promises'
import { createGameRuntime } from '../../runtime/index.js'
import { openWorkLedger } from '../../runtime/work-ledger.js'
import { acquireGameLock } from '../../runtime/owner-lock.js'
import { createStore } from '../../store.js'
import { hatchEgg } from '../../core.js'
import { startBackgroundHost } from '../../apps/desktop/lib/background-host.js'
import { shellLifecycle } from '../helpers/shell-lifecycle.js'

const temp = () => fs.mkdtempSync(join(tmpdir(), 'piggy-pr12-b-repro-'))
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'))
const work = at => ({ version: 1, source: 'test-reliability', id: 'turn:1', type: 'turn', at })

// 修改的是 Node 文件系统接口，真实账本写入/rename 路径仍然执行。
function replaceFs(name, replacement) {
  const original = fs[name]
  fs[name] = replacement(original)
  syncBuiltinESMExports()
  return () => { fs[name] = original; syncBuiltinESMExports() }
}

test('B 在途请求读完请求体时运行时已关闭，不能覆盖新写者存档', async () => {
  const directory = temp(), statePath = join(directory, 'state.json')
  const now = Date.now()
  fs.writeFileSync(statePath, JSON.stringify(hatchEgg(now)))
  const runtime = createGameRuntime({ statePath, now: () => now })
  const routes = []
  runtime.mountRoutes({ register(route) { routes.push(route); return () => {} } })
  let releaseBody, enteredBody
  const waiting = new Promise(resolve => { releaseBody = resolve })
  const entered = new Promise(resolve => { enteredBody = resolve })
  const req = { method: 'POST', url: '/dsh-piggy/act', async *[Symbol.asyncIterator]() {
    enteredBody(); await waiting; yield Buffer.from('{"action":"name","name":"迟到的旧请求"}')
  } }
  const res = { writeHead() {}, setHeader() {}, end() {} }
  let nextRuntime, request
  try {
    request = Promise.resolve(routes.find(route => route.path === req.url).handler(req, res))
    // 在释放请求体前立即捕获拒绝，避免修复后产生未处理拒绝。
    const finished = request.then(() => null, error => error)
    await entered
    runtime.dispose()
    nextRuntime = createGameRuntime({ statePath, now: () => now })
    nextRuntime.dispatchCommand('pig', 'name 新写者')
    nextRuntime.dispose()
    const committed = read(statePath)
    assert.equal(committed.name, '新写者')
    releaseBody()
    await finished
    // Store 的真实节流保存为 1500ms，等它到期才能抓到退出后的磁盘覆盖。
    await delay(1700)
    assert.deepEqual(read(statePath), committed)
  } finally {
    releaseBody(); await request?.catch(() => {})
    runtime.dispose(); nextRuntime?.dispose()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test(process.platform === 'win32' ? 'B Windows 提交不做目录 fsync，重复事件不再奖励' : 'B WAL rename 成功后目录 fsync 失败，下一步仍恢复已发布事务', () => {
  const directory = temp(), statePath = join(directory, 'state.json'), ledgerDir = `${statePath}.work-events`
  const now = Date.now(), walPath = join(ledgerDir, 'transaction.json')
  fs.writeFileSync(statePath, JSON.stringify(hatchEgg(now)))
  const ledger = openWorkLedger({ directory: ledgerDir, statePath, now: () => now })
  const store = createStore(statePath, { now: () => now })
  let injected = false
  const restore = replaceFs('fsyncSync', original => descriptor => {
    if (!injected && fs.fstatSync(descriptor).isDirectory() && fs.existsSync(walPath)) {
      injected = true
      throw Object.assign(new Error('测试注入：WAL 发布后目录同步失败'), { code: 'EIO' })
    }
    return original(descriptor)
  })
  try {
    if (process.platform === 'win32') {
      assert.equal(ledger.receive(store, work(now)).status, 'applied')
      assert.equal(injected, false, 'Windows 不应尝试目录 fsync')
      assert.equal(ledger.receive(store, work(now)).status, 'duplicate')
      return
    }
    assert.throws(() => ledger.receive(store, work(now)))
    assert.equal(injected, true)
    assert.equal(fs.existsSync(walPath), true)
    restore()
    ledger.finish(store)
    assert.equal(fs.existsSync(walPath), false, '已发布的 WAL 必须继续恢复')
    assert.equal(read(join(ledgerDir, 'receipts.json')).receipts.length, 1)
    assert.equal(ledger.receive(store, work(now)).status, 'duplicate')
  } finally { restore(); store.dispose(); fs.rmSync(directory, { recursive: true, force: true }) }
})

test('B 模拟 Windows rename 拒绝覆盖空锁目录，仍能回收并取得锁', () => {
  const directory = temp(), statePath = join(directory, 'state.json'), lock = `${statePath}.runtime.lock`
  fs.mkdirSync(lock)
  let injected = false, release
  const restore = replaceFs('renameSync', original => (from, to) => {
    if (to === lock && fs.existsSync(lock) && fs.readdirSync(lock).length === 0) {
      injected = true
      throw Object.assign(new Error('测试注入：Windows 空目标目录'), { code: 'EPERM' })
    }
    return original(from, to)
  })
  try {
    release = acquireGameLock(statePath)
    assert.equal(injected, true)
    assert.equal(fs.readdirSync(lock).length, 1)
    release()
    assert.equal(fs.existsSync(lock), false)
  } finally { restore(); release?.(); fs.rmSync(directory, { recursive: true, force: true }) }
})

test('B Worker 真实死亡后 before-quit 能结束主进程退出流程', async () => {
  const directory = temp(), gameDir = join(directory, 'game')
  fs.mkdirSync(join(gameDir, 'runtime'), { recursive: true })
  fs.writeFileSync(join(gameDir, 'package.json'), '{"type":"module"}')
  fs.writeFileSync(join(gameDir, 'environment.js'), 'export const environmentNote = () => ({})')
  fs.writeFileSync(join(gameDir, 'runtime/index.js'), `export const createGameRuntime = () => ({
    handle() { process.exit(23) }, dispose() {}, record() {}
  })`)
  let host
  try {
    host = await startBackgroundHost(gameDir, join(directory, 'state.json'))
    await assert.rejects(host.handle('GET', '/crash'), /worker exited: 23/)
    const source = fs.readFileSync(new URL('../../apps/desktop/main.js', import.meta.url), 'utf8')
    const handlers = new Map(), messages = []
    let quitCalls = 0, prevented = 0
    const app = { on(name, handler) { handlers.set(name, handler) }, quit() { quitCalls++ } }
    // 执行生产 before-quit 代码，Worker 用真实死亡状态，而不是复制退出逻辑。
    runInNewContext(source.slice(source.indexOf('let hostClosed = false'), source.indexOf("app.on('window-all-closed'")), {
      app, host, quitting: false, stopDrag() {}, hitTimer: null, clearInterval,
      log(...args) { messages.push(args) },
    })
    for (let attempt = 0; attempt < 2 && quitCalls === 0; attempt++) {
      handlers.get('before-quit')({ preventDefault() { prevented++ } })
      await delay(0)
    }
    assert.ok(quitCalls > 0 || prevented < 2, `死亡 Worker 阻止退出 ${prevented} 次：${JSON.stringify(messages)}`)
  } finally { await host?.dispose().catch(() => {}); fs.rmSync(directory, { recursive: true, force: true }) }
})

test('B 外壳安装器启动前必须等待后台保存完成', async () => {
  let completeSave
  const saved = new Promise(resolve => { completeSave = resolve })
  const steps = []
  const lifecycle = shellLifecycle({ dispose() {
    steps.push('saving')
    return saved.then(() => { steps.push('saved'); return { saved: true } })
  } }, () => steps.push('install'))
  try {
    const result = lifecycle.install()
    // 生产实现用 600ms 的调度；在测试中直接执行捕获的回调。
    const installed = lifecycle.runInstall()
    await delay(0)
    assert.equal(steps.includes('install'), false, `保存未完成就安装：${steps}`)
    assert.equal(steps.includes('saving'), true)
    completeSave()
    await result; await installed
    assert.deepEqual(steps, ['saving', 'saved', 'install'])
  } finally { completeSave() }
})
