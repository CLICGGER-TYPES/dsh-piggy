// @ts-check
/** 执行生产拿锁与 ready 回调；第二实例仍收到 ready 时，不触碰首实例的真实暂存目录。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'

import { startBackgroundVersions } from '../lib/background-versions.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')

async function runStartup(userData, hasLock) {
  const calls = [], messages = []
  let quits = 0, ready = 0
  const context = createContext({
    needsX11: false, quitting: false, join, resolve,
    process: { platform: 'win32', env: { PIGGY_USERDATA: userData }, argv: [] },
    app: { setPath() {}, getPath: () => userData, getVersion: () => '0.6.6', isPackaged: false,
      requestSingleInstanceLock: () => hasLock,
      // Electron 44 可以在 quit 请求后继续触发 ready；故意不在这里改变 quitting。
      quit() { quits++ }, whenReady() { ready++; return Promise.resolve() } },
    session: { defaultSession: {}, fromPartition: () => ({}) },
    proxySettings: null, shellUpdates: null, versions: null, versionsStarting: null,
    createProxy() { calls.push('proxy'); return { async init() { calls.push('proxy-init') } } },
    shellUpdateMode: () => 'development', autoUpdater: {},
    createShellUpdates() { calls.push('shell'); return {} },
    bundledGameDir: () => ROOT, statePath: () => join(userData, 'state.json'),
    net: { fetch }, toPages() {}, log: (...parts) => messages.push(parts),
    async startBackgroundVersions(options) {
      calls.push('versions')
      const versions = await startBackgroundVersions(options)
      // 版本初始化之后由生产关闭分支收尾，不创建测试无关的游戏和窗口。
      context.quitting = true
      return versions
    },
  })
  const lockStart = source.indexOf('// Testing: keep a throwaway save')
  const lockEnd = source.indexOf('/** The game shipped inside the app', lockStart)
  const readyStart = source.indexOf('app.whenReady().then(async () => {')
  const readyEnd = source.indexOf('\n/**', readyStart)
  assert.ok(lockStart >= 0 && lockEnd > lockStart && readyStart > lockEnd && readyEnd > readyStart)
  runInContext(source.slice(lockStart, lockEnd), context)
  await runInContext(source.slice(readyStart, readyEnd), context)
  assert.equal(messages.some(parts => parts[0] === 'startup failed'), false, JSON.stringify(messages))
  return { calls, quits, ready }
}

test('第二实例拿锁失败后即使收到 ready，也不访问首实例的更新暂存目录', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'piggy-second-instance-'))
  let primary
  t.after(async () => { await primary?.close(); await rm(directory, { recursive: true, force: true }) })
  primary = await startBackgroundVersions({ userData: directory, bundledDir: ROOT,
    statePath: join(directory, 'state.json'), shellVersion: '0.6.6' })
  const root = join(directory, 'versions')
  const active = (await readdir(root)).find(name => /^\.update-[A-Za-z0-9]{6}$/.test(name))
  assert.ok(active)
  const pendingFile = join(root, active, 'in-flight-download.part')
  await writeFile(pendingFile, 'owned by the first instance')
  const result = await runStartup(directory, false)
  assert.equal(result.quits, 1)
  assert.equal(result.ready, 1, '回归确实触发了 quit 之后的 ready')
  assert.equal(await readFile(pendingFile, 'utf8'), 'owned by the first instance')
  assert.deepEqual(result.calls, [], '第二实例不能初始化代理、更新器或版本服务')
  assert.equal((await primary.current()).bundled, true)
})

test('取得单实例锁的实例仍执行生产 ready 初始化及版本服务收尾', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'piggy-primary-instance-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const result = await runStartup(directory, true)
  assert.equal(result.quits, 0)
  assert.equal(result.ready, 1)
  assert.deepEqual(result.calls, ['proxy', 'proxy-init', 'shell', 'versions'])
  assert.deepEqual(await readdir(join(directory, 'versions')), [])
})
